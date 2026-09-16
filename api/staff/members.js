/* ============================================================================
   api/staff/members.js
   GET  — list members (role-redacted: coaches never receive phone/email)
   POST — create or update a member (any staff; audit-logged)

   GET  /api/staff/members?center=saket|lajpat|all
   POST /api/staff/members   Body: { id?, ...memberFields }
   ============================================================================ */

const { db, admin, requireStaff, writeAuditLog, sendError } = require('./_lib/firebaseAdmin');

const EDITABLE_FIELDS = [
  'name', 'phone', 'email', 'address', 'dob', 'center', 'memberType', 'plan',
  'customDurationMonths', 'defaultFeeAmount', 'startDate', 'dueDate',
  'firstJoinedDate', 'status', 'pauseDaysTotal', 'personalTrainingConfirmedActive',
  'presentCount', 'lastAttendedDate', 'pausedUntil', 'lastPaymentDate',
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
      const payments = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return res.status(200).json({ ok: true, payments });
    }

    if (req.method === 'GET') {
      const center = (req.query && req.query.center) || 'all';
      let q = db.collection('members');
      if (center === 'saket' || center === 'lajpat') q = q.where('center', '==', center);
      const snap = await q.get();
      let members = snap.docs.map(d => ({ id: d.id, ...d.data() })).map(redactContact);

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

      let docRef, action;
      if (id) {
        docRef = db.collection('members').doc(id);
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
