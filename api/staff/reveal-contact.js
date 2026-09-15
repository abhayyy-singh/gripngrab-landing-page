/* ============================================================================
   api/staff/reveal-contact.js
   Owner-only. Returns raw phone/email for one member. Every call is
   audit-logged — this is the only path through which contact info ever
   leaves the server for a member list request.

   POST /api/staff/reveal-contact   Body: { id }
   ============================================================================ */

const { db, requireOwner, writeAuditLog, sendError } = require('./_lib/firebaseAdmin');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let staff;
  try {
    staff = await requireOwner(req);
  } catch (e) { return sendError(res, e); }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const snap = await db.collection('members').doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Member not found' });
    const { phone, email, address } = snap.data();

    await writeAuditLog({
      actorUid: staff.uid, actorName: staff.name || staff.email,
      action: 'reveal-contact', targetMemberId: id,
    });

    return res.status(200).json({ ok: true, phone: phone || '', email: email || '', address: address || '' });
  } catch (e) {
    return sendError(res, e);
  }
};
