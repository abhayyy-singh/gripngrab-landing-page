/* ============================================================================
   api/staff/audit-log.js
   Owner-only, paginated. Append-only collection — no edit/delete path
   exists anywhere in the API, matching the Firestore rules.

   GET /api/staff/audit-log?limit=50&before=<ISO timestamp>
   ============================================================================ */

const { db, requireOwner, sendError } = require('./_lib/firebaseAdmin');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireOwner(req);
  } catch (e) { return sendError(res, e); }

  try {
    const limit = Math.min(parseInt((req.query && req.query.limit) || '50', 10) || 50, 200);
    let q = db.collection('audit-log').orderBy('timestamp', 'desc').limit(limit);
    if (req.query && req.query.before) {
      q = q.startAfter(new Date(req.query.before));
    }
    const snap = await q.get();
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ ok: true, entries });
  } catch (e) {
    return sendError(res, e);
  }
};
