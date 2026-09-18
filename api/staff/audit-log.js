/* ============================================================================
   api/staff/audit-log.js
   Owner-only, paginated. Append-only collection — no edit/delete path
   exists anywhere in the API, matching the Firestore rules.

   GET /api/staff/audit-log?limit=50&before=<ISO timestamp>
   GET /api/staff/audit-log?memberId=<id>&limit=20   (recent history for one member)
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
    const memberId = req.query && req.query.memberId;
    const limit = Math.min(parseInt((req.query && req.query.limit) || (memberId ? '20' : '50'), 10) || 50, 200);

    if (memberId) {
      // Scoped, bounded read for one member's own recent history — shown
      // on-demand in the Edit modal (owner only), same pattern as Payment
      // History, not fetched for every card in a list. Plain equality
      // filter (no orderBy in the query itself) so this doesn't need a
      // composite Firestore index — sorted here in JS instead, same
      // approach members.js already uses for payment history.
      const snap = await db.collection('audit-log').where('targetMemberId', '==', memberId).get();
      const entries = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp?._seconds || 0) - (a.timestamp?._seconds || 0))
        .slice(0, limit);
      return res.status(200).json({ ok: true, entries });
    }

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
