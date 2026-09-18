/* ============================================================================
   api/staff/members.js
   GET  — list members (role-redacted: coaches never receive phone/email)
   POST — create or update a member (any staff; audit-logged)

   GET  /api/staff/members?center=saket|lajpat|all
   POST /api/staff/members   Body: { id?, ...memberFields }
   ============================================================================ */

const { db, admin, requireStaff, writeAuditLog, sendError } = require('./_lib/firebaseAdmin');
const { computeDueDate, monthKeyFromTabName } = require('./_lib/parseSheets');

const EDITABLE_FIELDS = [
  'name', 'phone', 'email', 'address', 'dob', 'center', 'memberType', 'plan',
  'customDurationMonths', 'defaultFeeAmount', 'startDate', 'dueDate',
  'firstJoinedDate', 'status', 'pauseDaysTotal', 'personalTrainingConfirmedActive',
  'presentCount', 'lastAttendedDate', 'pausedUntil', 'lastPaymentDate',
  'verificationDismissedAt', 'lastPaymentAmount', 'lastPaymentTab',
];

// Contact info is masked in the list view for everyone, including the owner —
// "Show Contact" always requires an explicit click through reveal-contact.js,
// so every actual view of raw contact info leaves an audit trail. This is
// stricter than the coach restriction (coach additionally never gets a
// reveal option at all — enforced by reveal-contact.js being owner-only).
function redactContact(member) {
  const { phone, email, address, ...safe } = member;
  return { ...safe, phone: null, email: null, address: null, contactHidden: true };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let staff;
  try {
    staff = await requireStaff(req);
  } catch (e) { return sendError(res, e); }

  try {
    if (req.method === 'GET' && req.query && req.query.payments) {
      // Sorted client-side (not .orderBy() in the query) to avoid needing a
      // composite Firestore index — per-member payment counts are small.
      const memberId = req.query.payments;
      const snap = await db.collection('payments').where('memberId', '==', memberId).get();
      // Saket payments have no exact date at all (no per-payment date
      // column in that sheet) — sorting on `date` alone left them in
      // whatever order Firestore happened to return them, not chronological
      // order. Falling back to the month the payment was recorded in
      // (paymentTab) fixes that: a dated entry always sorts above an
      // undated one from the same month, since e.g. "2026-08-15" > "2026-08"
      // as plain strings, and different months still compare correctly.
      const sortKey = p => p.date || (p.paymentTab ? monthKeyFromTabName(p.paymentTab) : null) || '';
      const payments = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
      return res.status(200).json({ ok: true, payments });
    }

    if (req.method === 'GET') {
      const center = (req.query && req.query.center) || 'all';
      const includeArchived = req.query && req.query.includeArchived === '1';
      let q = db.collection('members');
      if (center === 'saket' || center === 'lajpat') q = q.where('center', '==', center);
      // Archived = only ever appeared in older sheet history, not in the
      // current 3-month roster at all — kept in Firestore for the record
      // (total joins/history), but hidden from the day-to-day dashboard by
      // default. Filtered at the QUERY level, not after fetching: archived
      // members outnumber active ones 2:1 (1098 vs 454), and every doc read
      // counts against the daily Firestore quota whether or not it's kept —
      // reading and then discarding 1098 docs on every dashboard load was
      // most of that quota's real usage. Safe because `status` is only ever
      // 'active' or 'archived' on every existing doc (verified directly).
      if (!includeArchived) q = q.where('status', '==', 'active');
      const snap = await q.get();
      const members = snap.docs.map(d => ({ id: d.id, ...d.data() })).map(redactContact);

      await writeAuditLog({
        actorUid: staff.uid, actorName: staff.name || staff.email,
        action: 'view-members', detail: { center, count: members.length },
      });

      return res.status(200).json({ ok: true, members, role: staff.role });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { id, ...fields } = body;
      const update = {};
      for (const key of EDITABLE_FIELDS) {
        if (key in fields) update[key] = fields[key];
      }
      if (!Object.keys(update).length) {
        return res.status(400).json({ error: 'No editable fields provided' });
      }

      let docRef, action, existingData = null;
      if (id) {
        docRef = db.collection('members').doc(id);
        const existingSnap = await docRef.get();
        existingData = existingSnap.exists ? existingSnap.data() : null;
      }

      // A manual edit only normally runs sync's own dueDate computation is
      // never re-run, so setting plan alone (e.g. confirming a guessed plan
      // from "No Plan Set") left dueDate untouched — the member never
      // actually left "No Plan Set" even though the edit succeeded, since
      // that view is keyed off dueDate being null. Recompute it here
      // whenever an edit touches one of its inputs, using the edited value
      // where given and falling back to whatever's already on the doc.
      const touchesDueDateInputs = ['plan', 'startDate', 'customDurationMonths', 'lastPaymentDate']
        .some(k => k in update);
      if ('dueDate' in update) {
        // Caller (e.g. the manual Due Date override for anchor-less
        // members) set this explicitly — tag it so sync knows not to
        // silently recompute over it later. Same class of bug as the
        // plan-getting-wiped one: without this tag, the very next sync
        // would overwrite a manual due date back to whatever the formula
        // says, discarding the override with no signal anything happened.
        update.dueDateSource = 'manual';
      } else if (touchesDueDateInputs) {
        const plan = update.plan ?? existingData?.plan ?? null;
        let startDate = update.startDate ?? existingData?.startDate ?? null;
        const customDurationMonths = update.customDurationMonths ?? existingData?.customDurationMonths ?? null;
        const lastPaymentDate = update.lastPaymentDate ?? existingData?.lastPaymentDate ?? null;
        let anchor = lastPaymentDate || startDate;
        if (!anchor && plan) {
          // Genuinely nothing to anchor a cycle to — no start date, no
          // payment date on record at all (real case: Kanika Parwal). Without
          // this, plan saves fine but dueDate stays null forever, which is
          // exactly the same "confirmed but never leaves the list" trap as
          // the original bug, just from a different cause. The guess UI
          // offers manual start/due date fields for exactly this group; this
          // is the backstop for when those are left blank — today is the
          // most honest fallback anchor, since that's the moment being
          // confirmed. Written into startDate too so the record stays
          // traceable instead of having an invisible assumed date.
          anchor = new Date().toISOString().slice(0, 10);
          if (!startDate) update.startDate = anchor;
        }
        update.dueDate = computeDueDate(anchor, plan, customDurationMonths);
        update.dueDateSource = 'computed';
      }

      if (id) {
        await docRef.set({ ...update, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: staff.uid }, { merge: true });
        action = 'edit-member';
      } else {
        if (!update.name || !update.center) {
          return res.status(400).json({ error: 'name and center are required to create a member' });
        }
        docRef = db.collection('members').doc();
        await docRef.set({
          ...update,
          status: update.status || 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: staff.uid,
        });
        action = 'create-member';
      }

      await writeAuditLog({
        actorUid: staff.uid, actorName: staff.name || staff.email,
        action, targetMemberId: docRef.id, detail: update,
      });

      return res.status(200).json({ ok: true, id: docRef.id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return sendError(res, e);
  }
};
