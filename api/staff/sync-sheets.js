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
const { parseSaketTab, parseLajpatTab, matchBankReceipts, computeDueDate, checkPaymentPresence, monthKeyFromTabName } = require('./_lib/parseSheets');

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

// Minimum gap between syncs, enforced server-side regardless of who or what
// triggers it — a real day of staff usage never needs this button more
// often than every few minutes, and this is what would have stopped today's
// Firestore free-tier quota from being burned by rapid repeated syncs.
// Stored in Firestore (not in-memory) since serverless invocations don't
// share memory between requests.
const SYNC_COOLDOWN_MS = parseInt(process.env.SYNC_COOLDOWN_MS, 10) || 5 * 60 * 1000;

// Owner is exempt from the cooldown (trusted not to hammer it) — everyone
// else (coaches, or anything scripted) is still capped, since the point is
// protecting the shared Firestore quota from accidental rapid-fire use.
const RATE_LIMIT_EXEMPT_EMAILS = new Set(['itsabhaypvt@gmail.com']);

async function checkAndSetSyncRateLimit(staff) {
  const ref = db.collection('sync-meta').doc('rate-limit');
  const now = Date.now();
  const exempt = RATE_LIMIT_EXEMPT_EMAILS.has(staff.email);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const lastRunAt = doc.exists ? doc.data().lastRunAt : 0;
    const elapsed = now - lastRunAt;
    if (!exempt && elapsed < SYNC_COOLDOWN_MS) {
      return { allowed: false, waitSeconds: Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000) };
    }
    tx.set(ref, { lastRunAt: now }, { merge: true });
    return { allowed: true };
  });
}

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
  const byName = new Map(); // name -> { core, payments: [], attendedDates: [] }
  const review = new Map(); // dedupeKey -> entry (last write wins, same as Firestore .set)

  for (const { members, review: tabReview } of tabResults) {
    for (const r of tabReview) review.set(r.dedupeKey || JSON.stringify(r), r);
    for (const m of members) {
      const { __pendingPayment, __presentCount, __attendedDates, ...core } = m;
      if (!byName.has(m.name)) {
        byName.set(m.name, { core: { ...core, presentCount: __presentCount || 0 }, payments: [], attendedDates: [...(__attendedDates || [])] });
      } else {
        const entry = byName.get(m.name);
        const existing = entry.core;
        // Attendance is cumulative across the 3-month window — sum it,
        // don't let a later tab's value replace an earlier tab's count.
        existing.presentCount = (existing.presentCount || 0) + (__presentCount || 0);
        entry.attendedDates.push(...(__attendedDates || []));
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
  // Bounded to the last 13 months (the sync's own farthest reach: 3-month
  // window + 9-month long-cycle lookback + 1 month buffer) instead of the
  // whole collection. A payment older than that can never collide with
  // anything the current sync's tabs could find, so it doesn't need to be
  // in this dedupe seed — without this cap, this read grows by however many
  // payments get written every single sync, forever, since payments are
  // never deleted. Undated payments (Saket has no per-payment date column)
  // are excluded by the date filter, but never needed this protection in
  // the first place: Saket has no second source (like Lajpat's Bank
  // Receipts ledger) a transaction could double-count against, and its own
  // payment doc IDs are already deterministic per sheet row, so re-syncing
  // the same row can't create a duplicate regardless of this map.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 13);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const snap = await db.collection('payments').where('date', '>=', cutoffStr).get();
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

  const rateLimit = await checkAndSetSyncRateLimit(staff);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: `Sync ran recently — please wait ${rateLimit.waitSeconds}s before running it again.` });
  }

  // Scopes the sync to one center when the dashboard's center filter isn't
  // "All Centers" — reads/writes for the other center are skipped entirely
  // instead of always doing a full sync regardless of what's selected.
  // Bank Receipts (a Lajpat-file tab, but a shared ledger that can carry
  // Saket payments too) is only read when Lajpat is in scope — a Saket-only
  // sync trades away catching those cross-center entries for actually
  // staying scoped to Saket; run "All Centers" periodically to catch them.
  const requestedCenter = (req.body && req.body.center) || 'all';
  const wantsSaket = requestedCenter === 'saket' || requestedCenter === 'all';
  const wantsLajpat = requestedCenter === 'lajpat' || requestedCenter === 'all';

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

      // Tab reads are independent network round trips (no shared state
      // between them) — fired concurrently instead of one-at-a-time, since
      // sequential awaits here were the main cost of a sync (a few dozen
      // round trips end-to-end, each paying full request latency on its own).
      const tabRows = await Promise.all(tabInfo.tabs.map(tabName => readTab(sheetId, tabName)));
      const tabResults = tabInfo.tabs.map((tabName, i) => parseFn(tabRows[i], { sheet: key, tab: tabName }));
      const { byName, review } = mergeTabs(tabResults);
      const existing = await fetchExistingByName(center);

      for (const [name, { core, payments, attendedDates }] of byName) {
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
          // Coalesce, don't clobber: a blank cell in THIS sync's row just
          // means the sheet has nothing new to say about that field this
          // month — it does NOT mean the field should be erased. Real bug
          // this fixes: Kanika Parwal's manually-confirmed plan (set via
          // the "No Plan Set" guess UI) got silently wiped back to null by
          // the very next sync, because her sheet row's plan cell has
          // always been blank and this write was overwriting unconditionally
          // with whatever `core` parsed this time, even null/empty values.
          const coalescedCore = { ...core };
          for (const [k, v] of Object.entries(core)) {
            if ((v === null || v === undefined || v === '') && existingData[k] != null) {
              coalescedCore[k] = existingData[k];
            }
          }
          writeOps.push({ ref, data: { ...coalescedCore, ...statusUpdate, updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
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
          pauseDaysTotal: core.pauseDaysTotal ?? existingData?.pauseDaysTotal ?? 0,
          existingLastPaymentDate: existingData?.lastPaymentDate ?? null,
          existingLastPaymentAmount: existingData?.lastPaymentAmount ?? null,
          existingLastPaymentTab: existingData?.lastPaymentTab ?? null,
          existingDueDate: existingData?.dueDate ?? null,
          dueDateSource: existingData?.dueDateSource ?? null,
          presentCount: core.presentCount ?? existingData?.presentCount ?? 0,
          lastAttendedDate: core.lastAttendedDate ?? existingData?.lastAttendedDate ?? null,
          memberType: core.memberType ?? existingData?.memberType ?? null,
          verificationDismissedAt: existingData?.verificationDismissedAt ?? null,
          attendedDates: attendedDates || [], // this sync's window only (kept in-memory, never persisted directly)
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

    const EMPTY_TAB_INFO = { tabs: [], dateFrom: null, dateTo: null };
    const saket3mo  = wantsSaket  ? await processCenter(SAKET_SHEET_ID, 'saket', parseSaketTab, 'saket') : EMPTY_TAB_INFO;
    const lajpat3mo = wantsLajpat ? await processCenter(LAJPAT_SHEET_ID, 'lajpat', parseLajpatTab, 'lajpat') : EMPTY_TAB_INFO;

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
    const NO_PLAN_LOOKBACK_MONTHS = 9; // same window, but purely to recover a
      // lastPaymentAmount for plan-guessing — a member with no recognized
      // plan has no cycle to anchor a dueDate to, so no date gets inferred
      // for them here, only the amount.
    const lookbackPaymentByMember = new Map(); // memberId -> inferred date string
    const lookbackAmountByMember = new Map(); // memberId -> amount found in a lookback tab

    async function applyLookback(sheetId, center, tabInfo) {
      const maxExtra = Math.max(NO_PLAN_LOOKBACK_MONTHS, ...Object.values(LOOKBACK_MONTHS));
      const allTabNames = await listTabs(sheetId);
      const candidateTabs = olderMonthTabs(allTabNames, tabInfo.tabs.length, maxExtra); // most-recent-first
      if (!candidateTabs.length) return;

      const rowsByTab = new Map();
      const allRows = await Promise.all(candidateTabs.map(t => readTab(sheetId, t)));
      candidateTabs.forEach((t, i) => rowsByTab.set(t, allRows[i]));

      for (const [memberId, effective] of effectiveCoreByMemberId) {
        if (effective.center !== center) continue;
        const extraMonths = effective.plan ? LOOKBACK_MONTHS[effective.plan] : NO_PLAN_LOOKBACK_MONTHS;
        if (!extraMonths || !effective.startDate) continue;

        const day = effective.startDate.split('-')[2];
        const tabsToCheck = candidateTabs.slice(0, extraMonths);
        for (const tabName of tabsToCheck) {
          const amount = checkPaymentPresence(rowsByTab.get(tabName), effective.name, center);
          if (!amount) continue;
          if (!lookbackAmountByMember.has(memberId)) lookbackAmountByMember.set(memberId, amount); // most-recent tab wins, same scan order
          if (!effective.plan) break; // no plan -> no cycle to anchor a date to, amount above is all we needed
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

    // Independent per center (each only touches its own members via the
    // `center` filter inside), so run concurrently rather than back-to-back
    // — and only for whichever center(s) are actually in scope this run.
    await Promise.all([
      wantsSaket  ? applyLookback(SAKET_SHEET_ID, 'saket', saket3mo)   : Promise.resolve(),
      wantsLajpat ? applyLookback(LAJPAT_SHEET_ID, 'lajpat', lajpat3mo) : Promise.resolve(),
    ]);

    /* ---------- LAJPAT BANK RECEIPTS (shared ledger — match against BOTH centers) ---------- */
    const bankTabs = wantsLajpat ? (await listTabs(LAJPAT_SHEET_ID)).filter(t => /BANK RECEIPTS/i.test(t)) : [];
    const dateFrom = (wantsSaket && wantsLajpat)
      ? (saket3mo.dateFrom < lajpat3mo.dateFrom ? saket3mo.dateFrom : lajpat3mo.dateFrom)
      : (wantsLajpat ? lajpat3mo.dateFrom : saket3mo.dateFrom);
    const dateTo = (wantsSaket && wantsLajpat)
      ? (saket3mo.dateTo > lajpat3mo.dateTo ? saket3mo.dateTo : lajpat3mo.dateTo)
      : (wantsLajpat ? lajpat3mo.dateTo : saket3mo.dateTo);
    const byName = new Map(combinedDirectory.map(d => [d.name, d.id]));
    const bankTabRows = await Promise.all(bankTabs.map(tabName => readTab(LAJPAT_SHEET_ID, tabName)));
    for (let bi = 0; bi < bankTabs.length; bi++) {
      const tabName = bankTabs[bi];
      const rows = bankTabRows[bi];
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
    // Tracks the member's single MOST RECENT payment write this run — dated
    // or not — as one comparable sortKey ("2026-09-14" or, when undated,
    // the month it was recorded in as "2026-09"). Real bug this fixes:
    // Rashmi Dhandia had an exact-but-OLD date from the long-cycle lookback
    // (inferred June 4th from an earlier tab) and a genuinely newer
    // September payment that just happened to have no exact date (Saket
    // has no per-payment date column) — the old code only ever compared
    // DATED candidates against each other, so the undated-but-newer
    // September payment could never even enter the race and the stale June
    // date won by default. Comparing sortKeys as plain strings works
    // whether either side is a full date or just a month, since "2026-09"
    // already outranks "2026-06-04" on the month digit alone.
    const bestSortKeyByMember = new Map();
    const bestIsExactByMember = new Map();
    const lastPaymentAmountByMember = new Map();
    const lastPaymentTabByMember = new Map();
    for (const op of writeOps) {
      if (op.ref.parent.id !== 'payments' || !op.data.memberId) continue;
      const isExact = !!op.data.date;
      const sortKey = op.data.date || (op.data.paymentTab ? monthKeyFromTabName(op.data.paymentTab) : null) || '';
      if (op.data.totalAmount) {
        const prevKey = bestSortKeyByMember.get(op.data.memberId) ?? '';
        if (sortKey >= prevKey) {
          bestSortKeyByMember.set(op.data.memberId, sortKey);
          bestIsExactByMember.set(op.data.memberId, isExact);
          lastPaymentAmountByMember.set(op.data.memberId, op.data.totalAmount);
          lastPaymentTabByMember.set(op.data.memberId, op.data.paymentTab || null);
        }
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

    for (const [memberId, effective] of effectiveCoreByMemberId) {
      // Every "when did they last plausibly pay" signal, tagged with
      // whether it's an exact date or only a month, so whichever is
      // actually most recent wins regardless of precision — then the
      // winner's own precision decides whether lastPaymentDate (exact) or
      // lastPaymentTab (approximate) gets set below.
      const candidates = [];
      if (bestSortKeyByMember.has(memberId)) {
        candidates.push({ key: bestSortKeyByMember.get(memberId), exact: bestIsExactByMember.get(memberId), tab: lastPaymentTabByMember.get(memberId) });
      }
      if (lookbackPaymentByMember.has(memberId)) {
        candidates.push({ key: lookbackPaymentByMember.get(memberId), exact: true, tab: null }); // long-cycle-plan lookback (day inferred from startDate)
      }
      if (effective.existingLastPaymentDate) {
        candidates.push({ key: effective.existingLastPaymentDate, exact: true, tab: null }); // whatever a prior sync already had
      }
      if (effective.existingLastPaymentTab) {
        const mk = monthKeyFromTabName(effective.existingLastPaymentTab);
        if (mk) candidates.push({ key: mk, exact: false, tab: effective.existingLastPaymentTab });
      }
      if (effective.startDate) {
        // The CURRENT sheet's own cycle-start for this member — can be more
        // recent than any payment info found (Saket has no per-payment date
        // column at all, so a fresh renewal often only ever shows up as an
        // updated START DATE cell, never as a dated payment). Real bug this
        // fixes: an old lookback-found payment was overriding a member's
        // own newer startDate just because "a payment date exists" was
        // treated as always more trustworthy than startDate — producing a
        // due date BEFORE their start date.
        candidates.push({ key: effective.startDate, exact: true, tab: null });
      }
      let winner = null;
      for (const c of candidates) { if (!winner || c.key > winner.key) winner = c; }
      const lastPaymentDate = winner && winner.exact ? winner.key : null;
      const winnerTab = winner && !winner.exact ? winner.tab : null;

      // The due-date ANCHOR is separate from lastPaymentDate/lastPaymentTab
      // above (those stay winner-based, for the card's "last paid" display,
      // regardless of center). For Lajpat specifically, use the sheet's own
      // current Joining Date directly — confirmed against real examples
      // (Mitesh Sadh, Rayan Sharma) that Lajpat's sheet-keeper already
      // updates this correctly on every renewal, and letting the payment
      // search override it was landing on a completely different, wrong
      // month (found a payment in a DIFFERENT month than the sheet's own
      // due-date reflects, and trusted that over the correct Joining Date).
      // Saket has no such reliable field, so it still needs the search —
      // month-only winners anchor using the member's own payment-day
      // pattern (same day-of-month their startDate shows), same technique
      // the lookback uses for older tabs; falls back to the 1st only when
      // there's truly no day-of-month pattern on file.
      const dueDateAnchor = effective.center === 'lajpat'
        ? effective.startDate
        : (winner ? (winner.exact ? winner.key : `${winner.key}-${effective.startDate ? effective.startDate.split('-')[2] : '01'}`) : effective.startDate);
      let dueDate = computeDueDate(dueDateAnchor, effective.plan, effective.customDurationMonths);
      // Freeze/pause days extend the due date by however many days the
      // membership was paused — confirmed against real examples (Garima
      // Bhardwaj: 30 freeze days exactly explained her due date being 30
      // days later than the plain start+duration formula; Shashi Bhardwaj:
      // same, 10 days). The FREEZE cell is a running total re-shown in
      // every month's row (not scattered across different months), so
      // reading it from whichever tab is already being read is sufficient
      // — no extra lookback search needed for this one.
      if (dueDate && effective.pauseDaysTotal) {
        const d = new Date(dueDate + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + effective.pauseDaysTotal);
        dueDate = d.toISOString().slice(0, 10);
      }
      let dueDateSource = 'computed';

      // A manually-set due date (the override field for anchor-less
      // members, or any staff edit to Due Date) stays in place unless this
      // run actually found new payment evidence for this member — without
      // this, the very next sync would silently recompute over a manual
      // override and discard it, the same bug class as plans getting wiped.
      // Once real new evidence arrives, the override is superseded (goes
      // back to being sync-managed) rather than staying stuck forever.
      const foundNewPaymentThisRun = bestSortKeyByMember.has(memberId) || lookbackPaymentByMember.has(memberId);
      if (effective.dueDateSource === 'manual' && !foundNewPaymentThisRun) {
        dueDate = effective.existingDueDate;
        dueDateSource = 'manual';
      }

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
      } else if (!effective.plan && effective.memberType !== 'personal-training') {
        // No known plan at all -> no dueDate -> the overdue-based checks
        // above can never fire, even for someone who's clearly gone. Real
        // case this fixes: Shreya Yadav — plan unrecognized, last attended
        // 50+ days ago — was defaulting to 'active' simply because there
        // was nothing to compare a dueDate against, despite having
        // obviously stopped coming. Same 15-day threshold as the overdue
        // case, since "no plan + no attendance" is the same "clearly left"
        // signal — just without a dueDate to anchor it to. A no-plan member
        // who's still attending regularly (e.g. Shaurya) stays 'active' and
        // shows up in "No Plan Set" for a manual plan guess/confirm instead.
        const daysSinceAttended = effective.lastAttendedDate ? daysBetween(effective.lastAttendedDate, today) : Infinity;
        if (daysSinceAttended > 15) activityStatus = 'inactive';
      }

      // dueDate/lastPaymentDate are written even when null (not skipped) —
      // real bug this fixes: Shreya Yadav's plan went from known to
      // unrecognized between syncs, so this pass correctly computed no
      // dueDate — but the OLD dueDate from when her plan WAS known stayed
      // in Firestore untouched (conditional write skipped
      // it entirely), so the UI read a stale, in-the-past dueDate next to
      // a fresh 'active' status and fell through to showing "Overdue".
      const lastPaymentAmount = lastPaymentAmountByMember.get(memberId) ?? lookbackAmountByMember.get(memberId) ?? effective.existingLastPaymentAmount ?? null;
      // Already resolved by the same winner-takes-all comparison above —
      // null whenever the winning candidate was an exact date (dated always
      // beats an approximate month label for display), otherwise whichever
      // tab that winner came from, already accounting for the existing
      // stored value as a fallback candidate.
      const lastPaymentTab = winnerTab;

      // Two attendance summary stats, computed once here from this sync's
      // own attendance data and stored as plain numbers — not recomputed
      // live per dashboard view, which would mean re-reading the sheet (or
      // re-scanning stored per-day data) on every single card open.
      // Scoped to the current 3-month window only (same as everything else
      // attendance-related) — a dueDate further back than that wouldn't have
      // its post-due attendance fully captured anyway.
      const currentYearMonth = today.slice(0, 7);
      const daysAttendedThisMonth = effective.attendedDates.filter(d => d.slice(0, 7) === currentYearMonth).length;
      const daysAttendedAfterDue = dueDate ? effective.attendedDates.filter(d => d >= dueDate).length : null;

      const data = {
        activityStatus, lastPaymentDate: lastPaymentDate || null, dueDate: dueDate || null, lastPaymentAmount, lastPaymentTab,
        daysAttendedThisMonth, daysAttendedAfterDue, dueDateSource,
      };
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
