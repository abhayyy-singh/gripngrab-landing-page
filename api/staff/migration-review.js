/* ============================================================================
   api/staff/migration-review.js
   GET  — pending review queue
   POST — resolve one item: confirm (with optional edits merged into the
          member) or reject (dismiss without creating/changing a member)

   GET  /api/staff/migration-review
   POST /api/staff/migration-review
     Body: { id, resolution: 'confirm'|'reject', memberId?, memberFields? }
       - resolution 'confirm' + memberId: links this review item's payment/
         data to an existing member (e.g. a Bank Receipts name-mismatch
         resolved to the right person)
       - resolution 'confirm' + memberFields (no memberId): creates a new
         member from the raw row data (e.g. a personal-training row that
         needed a human to fill in the plan)
       - resolution 'reject': marks resolved with no further action
   ============================================================================ */

const { db, admin, requireStaff, writeAuditLog, sendError } = require('./_lib/firebaseAdmin');

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
    if (req.method === 'GET') {
      const snap = await db.collection('migration-review').where('status', '==', 'pending').get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ ok: true, items });
    }

    if (req.method === 'POST') {
      const { id, resolution, memberId, memberFields } = req.body || {};
      if (!id || !['confirm', 'reject'].includes(resolution)) {
        return res.status(400).json({ error: 'id and a valid resolution are required' });
      }

      const ref = db.collection('migration-review').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Review item not found' });

      if (resolution === 'confirm' && memberFields) {
        const newRef = db.collection('members').doc();
        await newRef.set({
          ...memberFields,
          status: memberFields.status || 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: staff.uid,
        });
      }

      await ref.set({
        status: resolution === 'confirm' ? 'confirmed' : 'rejected',
        resolvedBy: staff.uid,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        linkedMemberId: memberId || null,
      }, { merge: true });

      await writeAuditLog({
        actorUid: staff.uid, actorName: staff.name || staff.email,
        action: `migration-review-${resolution}`, targetMemberId: memberId || null,
        detail: { reviewItemId: id },
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return sendError(res, e);
  }
};
