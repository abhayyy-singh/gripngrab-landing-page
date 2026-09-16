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
const { parseSaketTab, parseLajpatTab, matchBankReceipts } = require('./_lib/parseSheets');

const SAKET_SHEET_ID  = '1itv1Iv641TCf_yin6ubPS7Ri0GcNhpNhzMdQuBEduSs';
const LAJPAT_SHEET_ID = '1msODlD2bnfLkBHKR1SKOdSc9jb8U_Tad';

const MONTH_RE = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i;
const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function lastNMonthTabs(tabNames, n = 3) {
  const candidates = tabNames
    .map(name => {
      const m = MONTH_RE.exec(name);
      const yearMatch = /(\d{2,4})/.exec(name);
      if (!m || !yearMatch) return null;
      let year = parseInt(yearMatch[1], 10);
      if (year < 100) year += 2000;
      const monthIdx = MONTH_NAMES.indexOf(m[1].toUpperCase());
      return { name, year, monthIdx, sortKey: year * 12 + monthIdx };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortKey - b.sortKey);
  const picked = candidates.slice(-n);
  if (!picked.length) return { tabs: [], dateFrom: null, dateTo: null };
  const first = picked[0], last = picked[picked.length - 1];
  const dateFrom = `${first.year}-${String(first.monthIdx + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(last.year, last.monthIdx + 1, 0)).getUTCDate();
  const dateTo = `${last.year}-${String(last.monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { tabs: picked.map(c => c.name), dateFrom, dateTo };
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

        let ref;
        if (matches.length === 1) {
          ref = matches[0].ref;
          writeOps.push({ ref, data: { ...core, updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
        } else {
          ref = db.collection('members').doc();
          writeOps.push({ ref, data: { ...core, status: 'active', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() } });
        }
        summary[key].membersUpserted++;
        combinedDirectory.push({ name, id: ref.id });

        for (const p of payments) {
          const id = stableId(`${ref.id}__${p.sourceSheetRowRef}`);
          writeOps.push({ ref: db.collection('payments').doc(id), data: { memberId: ref.id, ...p, createdAt: admin.firestore.FieldValue.serverTimestamp() } });
          summary[key].paymentsWritten++;
        }
      }

      for (const r of review) { if (queueReview(r)) summary[key].reviewQueued++; }
      return tabInfo;
    }

    const saket3mo  = await processCenter(SAKET_SHEET_ID, 'saket', parseSaketTab, 'saket');
    const lajpat3mo = await processCenter(LAJPAT_SHEET_ID, 'lajpat', parseLajpatTab, 'lajpat');

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
        writeOps.push({ ref: db.collection('payments').doc(id), data: { memberId, ...paymentData, createdAt: admin.firestore.FieldValue.serverTimestamp() } });
        summary.lajpat.bankReceiptsMatched++;
      }
      for (const r of review) { if (queueReview(r)) summary.lajpat.bankReceiptsUnmatched++; }
    }

    /* Compute each member's most recent payment date from every payment op
       queued above (both tab payments and matched Bank Receipts), and fold
       a lastPaymentDate update into the same batch. */
    const lastPaymentByMember = new Map();
    for (const op of writeOps) {
      if (op.ref.parent.id !== 'payments' || !op.data.memberId || !op.data.date) continue;
      const prev = lastPaymentByMember.get(op.data.memberId);
      if (!prev || op.data.date > prev) lastPaymentByMember.set(op.data.memberId, op.data.date);
    }
    for (const [memberId, lastPaymentDate] of lastPaymentByMember) {
      writeOps.push({ ref: db.collection('members').doc(memberId), data: { lastPaymentDate } });
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
