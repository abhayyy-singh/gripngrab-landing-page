/* ============================================================================
   api/staff/sync-sheets.js
   Reads the last 3 monthly tabs from both attendance sheets, normalizes them
   via parseSheets.js, and upserts members/payments into Firestore. Queues
   anything ambiguous into migration-review instead of guessing.

   Safe to re-run (idempotent): existing members are matched by exact
   center+name; more than one existing match is treated as an unresolved
   duplicate and skipped with a review entry rather than guessed at.

   POST /api/staff/sync-sheets   (any authenticated staff member; logged)
   ============================================================================ */

const { db, admin, requireStaff, writeAuditLog, sendError } = require('./_lib/firebaseAdmin');
const { listTabs, readTab } = require('./_lib/sheetsClient');
const { parseSaketTab, parseLajpatTab, matchBankReceipts } = require('./_lib/parseSheets');

const SAKET_SHEET_ID  = '1itv1Iv641TCf_yin6ubPS7Ri0GcNhpNhzMdQuBEduSs';
const LAJPAT_SHEET_ID = '1msODlD2bnfLkBHKR1SKOdSc9jb8U_Tad';

const MONTH_RE = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i;

function lastNMonthTabs(tabNames, n = 3) {
  const candidates = tabNames
    .map(name => {
      const m = MONTH_RE.exec(name);
      const yearMatch = /(\d{2,4})/.exec(name);
      if (!m || !yearMatch) return null;
      let year = parseInt(yearMatch[1], 10);
      if (year < 100) year += 2000;
      const monthIdx = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
        .indexOf(m[1].toUpperCase());
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

async function findExistingMember(center, name) {
  const snap = await db.collection('members')
    .where('center', '==', center)
    .where('name', '==', name)
    .get();
  return snap.docs; // 0, 1, or >1
}

async function upsertMember(memberData) {
  const { __pendingPayment, ...core } = memberData;
  const matches = await findExistingMember(core.center, core.name);

  if (matches.length > 1) {
    return { docRef: null, duplicate: true };
  }

  let docRef;
  if (matches.length === 1) {
    docRef = matches[0].ref;
    // Coalesce, don't clobber: a later month's tab can leave a field blank
    // (e.g. the plan-code suffix only gets written once at signup) — that
    // blank must never overwrite a value an earlier sync already captured.
    // Empty string is also treated as "no new value" for the same reason.
    const coalesced = {};
    for (const [k, v] of Object.entries(core)) {
      if (v !== null && v !== undefined && v !== '') coalesced[k] = v;
    }
    await docRef.set({ ...coalesced, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } else {
    docRef = db.collection('members').doc();
    await docRef.set({
      ...core,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return { docRef, duplicate: false, pendingPayment: __pendingPayment };
}

function stableId(str) {
  return str.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 140);
}

async function upsertPayment(memberId, payment, sourceSheetRowRef) {
  const id = stableId(`${memberId}__${sourceSheetRowRef || payment.date + '_' + payment.totalAmount}`);
  await db.collection('payments').doc(id).set({
    memberId, ...payment,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function queueReview(entry) {
  const id = stableId(entry.dedupeKey || `${entry.type}__${entry.sheet}__${entry.tab}__${JSON.stringify(entry.rawData).slice(0, 100)}`);
  const ref = db.collection('migration-review').doc(id);
  const existing = await ref.get();
  if (existing.exists && existing.data().status !== 'pending') return; // don't reopen a resolved item
  const { dedupeKey, ...toWrite } = entry;
  await ref.set({ ...toWrite, queuedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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

  const combinedDirectory = []; // {name, id} across BOTH centers — Bank Receipts is a shared ledger

  try {
    /* ---------- SAKET ---------- */
    const saket3mo = lastNMonthTabs(await listTabs(SAKET_SHEET_ID));
    summary.saket.tabs = saket3mo.tabs;
    for (const tabName of saket3mo.tabs) {
      const rows = await readTab(SAKET_SHEET_ID, tabName);
      const { members, review } = parseSaketTab(rows, { sheet: 'saket', tab: tabName });
      for (const m of members) {
        const { docRef, duplicate, pendingPayment } = await upsertMember(m);
        if (duplicate) {
          await queueReview({ type: 'duplicate-name', sheet: 'saket', tab: tabName, dedupeKey: `duplicate_saket_${m.name}`, rawData: { name: m.name }, status: 'pending' });
          summary.saket.membersDuplicateSkipped++;
          continue;
        }
        summary.saket.membersUpserted++;
        combinedDirectory.push({ name: m.name, id: docRef.id });
        if (pendingPayment) {
          await upsertPayment(docRef.id, pendingPayment, m.sourceSheetRowRef);
          summary.saket.paymentsWritten++;
        }
      }
      for (const r of review) { await queueReview(r); summary.saket.reviewQueued++; }
    }

    /* ---------- LAJPAT ---------- */
    const lajpat3mo = lastNMonthTabs(await listTabs(LAJPAT_SHEET_ID));
    summary.lajpat.tabs = lajpat3mo.tabs;
    for (const tabName of lajpat3mo.tabs) {
      const rows = await readTab(LAJPAT_SHEET_ID, tabName);
      const { members, review } = parseLajpatTab(rows, { sheet: 'lajpat', tab: tabName });
      for (const m of members) {
        const { docRef, duplicate, pendingPayment } = await upsertMember(m);
        if (duplicate) {
          await queueReview({ type: 'duplicate-name', sheet: 'lajpat', tab: tabName, dedupeKey: `duplicate_lajpat_${m.name}`, rawData: { name: m.name }, status: 'pending' });
          summary.lajpat.membersDuplicateSkipped++;
          continue;
        }
        summary.lajpat.membersUpserted++;
        combinedDirectory.push({ name: m.name, id: docRef.id });
        if (pendingPayment) {
          await upsertPayment(docRef.id, pendingPayment, m.sourceSheetRowRef);
          summary.lajpat.paymentsWritten++;
        }
      }
      for (const r of review) { await queueReview(r); summary.lajpat.reviewQueued++; }
    }

    /* ---------- LAJPAT BANK RECEIPTS (shared ledger — match against BOTH centers) ---------- */
    // Confirmed against real data: Saket members' payments sometimes land in
    // this Lajpat-hosted tab (shared company bank account). The LN/SAKET
    // amount columns on each row already say which center's books the
    // money credits, independent of which center the member belongs to.
    // Scoped to the same 3-month window as the member tabs — receipts from
    // earlier months are legitimately out of scope, not a data problem.
    const bankTabs = (await listTabs(LAJPAT_SHEET_ID)).filter(t => /BANK RECEIPTS/i.test(t));
    const dateFrom = saket3mo.dateFrom < lajpat3mo.dateFrom ? saket3mo.dateFrom : lajpat3mo.dateFrom;
    const dateTo   = saket3mo.dateTo   > lajpat3mo.dateTo   ? saket3mo.dateTo   : lajpat3mo.dateTo;
    for (const tabName of bankTabs) {
      const rows = await readTab(LAJPAT_SHEET_ID, tabName);
      const pseudoMembers = combinedDirectory.map(d => ({ name: d.name }));
      const { payments, review } = matchBankReceipts(rows, pseudoMembers, {
        sheet: 'lajpat', tab: tabName, dateFrom, dateTo,
      });
      const byName = new Map(combinedDirectory.map(d => [d.name, d.id]));
      for (const p of payments) {
        const memberId = byName.get(p.memberName);
        if (!memberId) continue;
        const { memberName, ...paymentData } = p;
        await upsertPayment(memberId, paymentData, p.sourceSheetRowRef);
        summary.lajpat.bankReceiptsMatched++;
      }
      for (const r of review) { await queueReview(r); summary.lajpat.bankReceiptsUnmatched++; }
    }

    await writeAuditLog({
      actorUid: staff.uid, actorName: staff.name || staff.email,
      action: 'sync-sheets', detail: summary,
    });

    return res.status(200).json({ ok: true, summary });
  } catch (e) {
    return sendError(res, e);
  }
};
