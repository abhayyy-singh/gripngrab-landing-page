/* ============================================================================
   api/staff/sync-sheets.js
   Reads the last 3 monthly tabs from both attendance sheets, normalizes them
   via parseSheets.js, and upserts members/payments into Firestore. Queues
   anything ambiguous into migration-review instead of guessing.

   Performance note: an earlier version did one Firestore read + one write
   PER member/payment/review-item sequentially (~900 round trips for ~450
   members) and hit Vercel's function timeout partway through a real run.
   This version fetches each collection ONCE per sync, does all matching
   in-memory, and writes everything through batched commits (Firestore
   batches cap at 500 ops, so writes are chunked) — a handful of round
   trips total instead of hundreds.

   Safe to re-run (idempotent): existing members are matched by exact
   center+name; more than one existing match is treated as an unresolved
   duplicate and skipped with a review entry rather than guessed at.
   Re-running also completes/repairs a prior run that hit a timeout partway
   through, since matching is against whatever already exists in Firestore.

   POST /api/staff/sync-sheets   (any authenticated staff member; logged)
   ============================================================================ */

const { db, admin, requireStaff, writeAuditLog, sendError } = require('./_lib/firebaseAdmin');
const { listTabs, readTab } = require('./_lib/sheetsClient');
const { parseSaketTab, parseLajpatTab, matchBankReceipts, computeDueDate, checkPaymentPresence } = require('./_lib/parseSheets');

const SAKET_SHEET_ID  = '1itv1Iv641TCf_yin6ubPS7Ri0GcNhpNhzMdQuBEduSs';
const LAJPAT_SHEET_ID = '1msODlD2bnfLkBHKR1SKOdSc9jb8U_Tad';

// "FAB" is a recurring typo for "FEB" in the actual sheet tab names
// (ATT- FAB25, FAB-26 in Saket) — without this alias every February in
// the sheet's history is silently invisible to the sync.
const MONTH_RE = /(JAN|FAB|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i;
const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_ALIAS = { FAB: 'FEB' };

// Defaults to the last 3 months for normal/fast syncs. Set
// SYNC_MONTHS_WINDOW to a large number (e.g. 999) for a one-off deep
// backfill that picks up every reliably-dated tab in the sheet's history
// — only tabs with an explicit year in their name are ever included, so
// this never risks guessing a wrong year for the earliest, year-less tabs.
const MONTHS_WINDOW = parseInt(process.env.SYNC_MONTHS_WINDOW, 10) || 3;

function sortedMonthTabCandidates(tabNames) {
  return tabNames
    .map(name => {
      const m = MONTH_RE.exec(name);
      const yearMatch = /(\d{2,4})/.exec(name);
      if (!m || !yearMatch) return null;
      let year = parseInt(yearMatch[1], 10);
      if (year < 100) year += 2000;
      const monthAbbr = MONTH_ALIAS[m[1].toUpperCase()] || m[1].toUpperCase();
      const monthIdx = MONTH_NAMES.indexOf(monthAbbr);
      return { name, year, monthIdx, sortKey: year * 12 + monthIdx };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortKey - b.sortKey);
}

function lastNMonthTabs(tabNames, n = MONTHS_WINDOW) {
  const candidates = sortedMonthTabCandidates(tabNames);
  const picked = candidates.slice(-n);
  if (!picked.length) return { tabs: [], dateFrom: null, dateTo: null };
  const first = picked[0], last = picked[picked.length - 1];
  const dateFrom = `${first.year}-${String(first.monthIdx + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(last.year, last.monthIdx + 1, 0)).getUTCDate();
  const dateTo = `${last.year}-${String(last.monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { tabs: picked.map(c => c.name), dateFrom, dateTo };
}

/** Tabs OLDER than the normal sync window — e.g. skipRecent=3, count=9
 *  returns the 9 months before the last 3, most-recent first, for the
 *  long-cycle-plan payment lookback below. */
function olderMonthTabs(tabNames, skipRecent, count) {
  const candidates = sortedMonthTabCandidates(tabNames);
  const upToRecentWindow = candidates.slice(0, candidates.length - skipRecent);
  const older = upToRecentWindow.slice(-count);
  return older.map(c => c.name).reverse(); // most recent first
}

function stableId(str) {
  return str.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 140);
}

/** Commits an array of {ref, data, merge} write ops in chunks of <=500. */
async function commitInBatches(ops) {
  const CHUNK = 450; // headroom under Firestore's 500-op batch limit
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + CHUNK)) {
      batch.set(op.ref, op.data, { merge: op.merge !== false });
    }
    await batch.commit();
  }
}

/**
 * Merges all parsed rows for one center's 3 tabs into one in-memory record
 * per distinct name, coalescing field-by-field (a later tab's blank value
 * never overwrites an earlier tab's real value — only a non-blank value
 * ever updates a field), and collects every payment leg from every tab
 * (not just the latest).
 */
function mergeTabs(tabResults) {
  const byName = new Map(); // name -> { core, payments: [] }
  const review = new Map(); // dedupeKey -> entry (last write wins, same as Firestore .set)

  for (const { members, review: tabReview } of tabResults) {
    for (const r of tabReview) review.set(r.dedupeKey || JSON.stringify(r), r);
    for (const m of members) {
      const { __pendingPayment, __presentCount, ...core } = m;
      if (!byName.has(m.name)) {
        byName.set(m.name, { core: { ...core, presentCount: __presentCount || 0 }, payments: [] });
      } else {
        const existing = byName.get(m.name).core;
        // Attendance is cumulative across the 3-month window — sum it,
        // don't let a later tab's value replace an earlier tab's count.
        existing.presentCount = (existing.presentCount || 0) + (__presentCount || 0);
        for (const [k, v] of Object.entries(core)) {
          if (v !== null && v !== undefined && v !== '') existing[k] = v;
        }
      }
      if (__pendingPayment) byName.get(m.name).payments.push({ ...__pendingPayment, sourceSheetRowRef: m.sourceSheetRowRef });
    }
  }
  return { byName, review: [...review.values()] };
}

/** Fetches every existing member for a center once; returns name -> docs[] (0/1/>1). */
async function fetchExistingByName(center) {
  const snap = await db.collection('members').where('center', '==', center).get();
  const map = new Map();
  for (const doc of snap.docs) {
    const name = doc.data().name;
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(doc);
  }
  return map;
}

async function fetchExistingReviewIds() {
  const snap = await db.collection('migration-review').get();
  const map = new Map(); // id -> status
  for (const doc of snap.docs) map.set(doc.id, doc.data().status);
  return map;
}

/** memberId -> Map<roundedAmount, docId> of payments already on record —
 *  used to stop the same real-world payment being counted twice when it
 *  shows up both in a member's own tab row (Lajpat AMOUNT column / Saket
 *  CASH+BANK) and again in the separate Bank Receipts ledger. Confirmed
 *  with real data: a member's payment can legitimately appear in both
 *  sources for the same transaction. Keyed by docId (not just a Set of
 *  amounts) so re-writing the SAME payment's own doc on a re-sync is never
 *  mistaken for a duplicate of itself. */
async function fetchExistingPaymentAmounts() {
  const snap = await db.collection('payments').get();
  const map = new Map();
  for (const doc of snap.docs) {
    const { memberId, totalAmount } = doc.data();
    if (!memberId || !totalAmount) continue;
    if (!map.has(memberId)) map.set(memberId, new Map());
    map.get(memberId).set(Math.round(totalAmount), doc.id);
  }
  return map;
}

/** Returns true and records the claim if this (memberId, amount) is new or
 *  belongs to this exact docId already; returns false if a DIFFERENT doc
 *  already claimed the same amount for this member (a real duplicate). */
function claimPaymentSlot(recordedAmountsByMember, memberId, amount, docId) {
  const rounded = Math.round(amount);
  if (!recordedAmountsByMember.has(memberId)) recordedAmountsByMember.set(memberId, new Map());
  const forMember = recordedAmountsByMember.get(memberId);
  const existingDocId = forMember.get(rounded);
  if (existingDocId && existingDocId !== docId) return false;
  forMember.set(rounded, docId);
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let staff;
  try {
    staff = await requireStaff(req);
  } catch (e) { return sendError(res, e); }

  const summary = {
    saket:  { tabs: [], membersUpserted: 0, membersDuplicateSkipped: 0, paymentsWritten: 0, reviewQueued: 0 },
    lajpat: { tabs: [], membersUpserted: 0, membersDuplicateSkipped: 0, paymentsWritten: 0, reviewQueued: 0, bankReceiptsMatched: 0, bankReceiptsUnmatched: 0 },
  };

  try {
    const writeOps = [];
    const combinedDirectory = []; // {name, id} across BOTH centers — Bank Receipts is a shared ledger
    const existingReviewIds = await fetchExistingReviewIds();
    const seenReviewIds = new Set(); // de-dupes review entries within this same run before touching Firestore
    const recordedAmountsByMember = await fetchExistingPaymentAmounts(); // seeded from prior syncs, added to below as this run records new payments

    function queueReview(entry) {
      const id = stableId(entry.dedupeKey || `${entry.type}__${entry.sheet}__${entry.tab}__${JSON.stringify(entry.rawData).slice(0, 100)}`);
      if (seenReviewIds.has(id)) return false;
      seenReviewIds.add(id);
      const priorStatus = existingReviewIds.get(id);
      if (priorStatus && priorStatus !== 'pending') return false; // don't reopen a resolved item
      const { dedupeKey, ...toWrite } = entry;
      writeOps.push({
        ref: db.collection('migration-review').doc(id),
        data: { ...toWrite, queuedAt: admin.firestore.FieldValue.serverTimestamp() },
      });
      return true;
    }

    const effectiveCoreByMemberId = new Map(); // memberId -> best-known-so-far {plan, customDurationMonths, startDate}

    async function processCenter(sheetId, center, parseFn, key) {
      const tabInfo = lastNMonthTabs(await listTabs(sheetId));
      summary[key].tabs = tabInfo.tabs;

      const tabResults = [];
      for (const tabName of tabInfo.tabs) {
        const rows = await readTab(sheetId, tabName);
        tabResults.push(parseFn(rows, { sheet: key, tab: tabName }));
      }
      const { byName, review } = mergeTabs(tabResults);
      const existing = await fetchExistingByName(center);

      for (const [name, { core, payments }] of byName) {
        const matches = existing.get(name) || [];
        if (matches.length > 1) {
          queueReview({ type: 'duplicate-name', sheet: key, tab: tabInfo.tabs[tabInfo.tabs.length - 1], dedupeKey: `duplicate_${key}_${name}`, rawData: { name }, status: 'pending' });
          summary[key].membersDuplicateSkipped++;
          continue;
        }

        let ref, existingData = null;
        if (matches.length === 1) {
          ref = matches[0].ref;
          existingData = matches[0].data();
          // Reappeared in the current 3-month window — if they'd been
          // archived (only found in older history, not any recent tab),
          // that no longer applies, they're clearly back.
          const statusUpdate = existingData.status === 'archived' ? { status: 'active' } : {};
          writeOps.push({ ref, data: { ...core, ...statusUpdate, updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
        } else {
          ref = db.collection('members').doc();
          writeOps.push({ ref, data: { ...core, status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
        }
        summary[key].membersUpserted++;
        combinedDirectory.push({ name, id: ref.id });

        // For the final due-date pass: this sync's new value if it set one,
        // else whatever was already on the existing Firestore doc — a
        // coalesced write can leave plan/startDate out entirely when this
        // round's tabs had nothing new to say about them.
        effectiveCoreByMemberId.set(ref.id, {
          name, center,
          plan: core.plan ?? existingData?.plan ?? null,
          customDurationMonths: core.customDurationMonths ?? existingData?.customDurationMonths ?? null,
          startDate: core.startDate ?? existingData?.startDate ?? null,
          existingLastPaymentDate: existingData?.lastPaymentDate ?? null,
          presentCount: core.presentCount ?? existingData?.presentCount ?? 0,
          lastAttendedDate: core.lastAttendedDate ?? existingData?.lastAttendedDate ?? null,
          memberType: core.memberType ?? existingData?.memberType ?? null,
          verificationDismissedAt: existingData?.verificationDismissedAt ?? null,
        });

        for (const p of payments) {
          const id = stableId(`${ref.id}__${p.sourceSheetRowRef}`);
          if (!claimPaymentSlot(recordedAmountsByMember, ref.id, p.totalAmount, id)) continue; // same amount already claimed by a different payment doc — real duplicate, skip
          writeOps.push({ ref: db.collection('payments').doc(id), data: { memberId: ref.id, ...p, createdAt: admin.firestore.FieldValue.serverTimestamp() } });
          summary[key].paymentsWritten++;
        }
      }

      for (const r of review) { if (queueReview(r)) summary[key].reviewQueued++; }
      return tabInfo;
    }

    const saket3mo  = await processCenter(SAKET_SHEET_ID, 'saket', parseSaketTab, 'saket');
    const lajpat3mo = await processCenter(LAJPAT_SHEET_ID, 'lajpat', parseLajpatTab, 'lajpat');

    /* ---------- LONG-CYCLE-PLAN PAYMENT LOOKBACK ----------
       A quarterly plan's whole cycle already fits inside the normal
       3-month window, but half-yearly (6mo) and yearly (12mo) members
       often paid further back than that — their dueDate would otherwise
       anchor on a stale startDate even though they've clearly renewed
       since (confirmed with real data: Rashmi Dhandia's May payment was
       invisible to a 3-month sync). Rather than a full-history backfill
       (tried, tabled — it explodes the review queue with old, messier
       data without fixing Saket at all, since Saket has no per-payment
       date column regardless of how far back you look), this looks back
       ONLY for members who already exist with a long-cycle plan, and
       ONLY checks "was a payment recorded here" per tab — it never
       creates new members or review items from the older tabs.
       The exact day within a month is never in the sheet for these older
       rows either way, so the day is taken from the member's own current
       startDate (the pattern they've always paid on) and only the
       month/year comes from wherever the payment was actually found. */
    // All three get the same 9-month lookback: the yearly-plan tabs are
    // already being fetched regardless, so letting quarterly/half-yearly
    // members search the same already-fetched range is free — and useful,
    // since someone overdue by more than one cycle (real example: Rashmi
    // Dhandia, quarterly, whose last payment was several cycles back) needs
    // more than their nominal plan length to find it.
    const LOOKBACK_MONTHS = { quarterly: 9, 'half-yearly': 9, yearly: 9, custom: 9 };
    const lookbackPaymentByMember = new Map(); // memberId -> inferred date string

    async function applyLookback(sheetId, center, tabInfo) {
      const maxExtra = Math.max(...Object.values(LOOKBACK_MONTHS));
      const allTabNames = await listTabs(sheetId);
      const candidateTabs = olderMonthTabs(allTabNames, tabInfo.tabs.length, maxExtra); // most-recent-first
      if (!candidateTabs.length) return;

      const rowsByTab = new Map();
      for (const t of candidateTabs) rowsByTab.set(t, await readTab(sheetId, t));

      for (const [memberId, effective] of effectiveCoreByMemberId) {
        if (effective.center !== center) continue;
        const extraMonths = LOOKBACK_MONTHS[effective.plan];
        if (!extraMonths || !effective.startDate) continue;

        const day = effective.startDate.split('-')[2];
        const tabsToCheck = candidateTabs.slice(0, extraMonths);
        for (const tabName of tabsToCheck) {
          const found = checkPaymentPresence(rowsByTab.get(tabName), effective.name, center);
          if (!found) continue;
          const m = /([A-Z]{3})/i.exec(tabName);
          const y = /(\d{2,4})/.exec(tabName);
          if (!m || !y) break;
          let year = parseInt(y[1], 10); if (year < 100) year += 2000;
          const monthAbbr = MONTH_ALIAS[m[1].toUpperCase()] || m[1].toUpperCase();
          const monthIdx = MONTH_NAMES.indexOf(monthAbbr);
          if (monthIdx === -1) break;
          const inferredDate = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${day}`;
          lookbackPaymentByMember.set(memberId, inferredDate);
          break; // most-recent match wins, stop scanning further back
        }
      }
    }

    await applyLookback(SAKET_SHEET_ID, 'saket', saket3mo);
    await applyLookback(LAJPAT_SHEET_ID, 'lajpat', lajpat3mo);

    /* ---------- LAJPAT BANK RECEIPTS (shared ledger — match against BOTH centers) ---------- */
    const bankTabs = (await listTabs(LAJPAT_SHEET_ID)).filter(t => /BANK RECEIPTS/i.test(t));
    const dateFrom = saket3mo.dateFrom < lajpat3mo.dateFrom ? saket3mo.dateFrom : lajpat3mo.dateFrom;
    const dateTo   = saket3mo.dateTo   > lajpat3mo.dateTo   ? saket3mo.dateTo   : lajpat3mo.dateTo;
    const byName = new Map(combinedDirectory.map(d => [d.name, d.id]));
    for (const tabName of bankTabs) {
      const rows = await readTab(LAJPAT_SHEET_ID, tabName);
      const pseudoMembers = combinedDirectory.map(d => ({ name: d.name }));
      const { payments, review } = matchBankReceipts(rows, pseudoMembers, { sheet: 'lajpat', tab: tabName, dateFrom, dateTo });
      for (const p of payments) {
        const memberId = byName.get(p.memberName);
        if (!memberId) continue;

        const { memberName, ...paymentData } = p;
        const id = stableId(`${memberId}__${p.sourceSheetRowRef}`);

        // Same real transaction can show up both in the member's own tab
        // row AND this separate Bank Receipts ledger — skip writing it here
        // rather than double-count revenue when a DIFFERENT payment doc
        // already claimed the same amount for this member.
        if (!claimPaymentSlot(recordedAmountsByMember, memberId, p.totalAmount, id)) {
          summary.lajpat.bankReceiptsMatched++; // still a real, matched payment — just not double-written
          continue;
        }

        writeOps.push({ ref: db.collection('payments').doc(id), data: { memberId, ...paymentData, createdAt: admin.firestore.FieldValue.serverTimestamp() } });
        summary.lajpat.bankReceiptsMatched++;
      }
      for (const r of review) { if (queueReview(r)) summary.lajpat.bankReceiptsUnmatched++; }
    }

    /* Compute each member's most recent payment date from every payment op
       queued above (both tab payments and matched Bank Receipts) — falling
       back to whatever lastPaymentDate a prior sync already found, if this
       run didn't see a newer one. Then compute dueDate ONCE, here, from the
       fully-resolved (plan, startDate, lastPaymentDate) — never per-tab —
       anchored on the most recent payment when one is on record, since a
       sheet's startDate can be stale relative to an actual recent renewal
       (this was the root cause behind due dates sitting in the past even
       for members who had clearly just paid). */
    const lastPaymentByMember = new Map();
    for (const op of writeOps) {
      if (op.ref.parent.id !== 'payments' || !op.data.memberId || !op.data.date) continue;
      const prev = lastPaymentByMember.get(op.data.memberId);
      if (!prev || op.data.date > prev) lastPaymentByMember.set(op.data.memberId, op.data.date);
    }
    const today = new Date().toISOString().slice(0, 10);
    const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

    for (const [memberId, effective] of effectiveCoreByMemberId) {
      const candidates = [
        lastPaymentByMember.get(memberId),      // this sync's own dated payments (Bank Receipts, Lajpat Pay-Rec-date)
        lookbackPaymentByMember.get(memberId),   // long-cycle-plan lookback (day inferred from startDate)
        effective.existingLastPaymentDate,       // whatever a prior sync already had
      ].filter(Boolean);
      const lastPaymentDate = candidates.length ? candidates.sort().pop() : null; // most recent wins

      const anchor = lastPaymentDate || effective.startDate;
      const dueDate = computeDueDate(anchor, effective.plan, effective.customDurationMonths);

      /* activityStatus — separates "genuinely due, still training" from
         "hasn't set foot in the gym in weeks" so the due-list isn't
         cluttered with people who've clearly already left (Anshul Kishore,
         Neha Kaul, Aakil Haider — all flagged in real testing: overdue for
         a long time AND zero recent attendance). Personal-training members
         are skipped — their attendance isn't tracked in this sheet at all. */
      let activityStatus = 'active';
      if (effective.memberType !== 'personal-training' && dueDate && dueDate < today) {
        const daysSinceDue = daysBetween(dueDate, today);
        const daysSinceAttended = effective.lastAttendedDate ? daysBetween(effective.lastAttendedDate, today) : Infinity;

        // "No, Genuinely Due" on a prior review sets this — don't ask
        // again for 14 days while it's being followed up on, even though
        // the underlying pattern (long overdue + still attending) hasn't
        // changed and would otherwise re-flag on every sync.
        const recentlyDismissed = effective.verificationDismissedAt && daysBetween(effective.verificationDismissedAt, today) < 14;

        if (daysSinceAttended <= 15) {
          // still coming despite being overdue on paper
          activityStatus = (daysSinceDue >= 20 && effective.presentCount >= 10 && !recentlyDismissed)
            ? 'needs-verification' // long overdue but clearly still training regularly — payment may be unrecorded, not missing
            : 'overdue';           // normal, legitimate reminder case
        } else {
          activityStatus = 'inactive'; // stopped coming a while after going overdue — no point nagging them
        }
      } else if (dueDate && dueDate < today) {
        activityStatus = 'inactive'; // personal-training, overdue — no attendance signal to check against
      }

      const data = { activityStatus };
      if (lastPaymentDate) data.lastPaymentDate = lastPaymentDate;
      if (dueDate) data.dueDate = dueDate;
      writeOps.push({ ref: db.collection('members').doc(memberId), data });

      if (activityStatus === 'needs-verification') {
        const queued = queueReview({
          type: 'payment-verification-needed',
          sheet: effective.center,
          tab: '',
          dedupeKey: `needs-verification_${effective.center}_${effective.name}`,
          rawData: { memberId, name: effective.name, dueDate, lastAttendedDate: effective.lastAttendedDate, presentCount: effective.presentCount },
          status: 'pending',
        });
        if (queued) summary[effective.center].reviewQueued++;
      }
    }

    await commitInBatches(writeOps);

    await writeAuditLog({
      actorUid: staff.uid, actorName: staff.name || staff.email,
      action: 'sync-sheets', detail: summary,
    });

    return res.status(200).json({ ok: true, summary, totalWrites: writeOps.length });
  } catch (e) {
    return sendError(res, e);
  }
};
