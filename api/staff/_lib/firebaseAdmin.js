/* ============================================================================
   api/staff/_lib/firebaseAdmin.js
   Shared Firebase Admin SDK singleton for all /api/staff/* endpoints.

   Reads FIREBASE_SERVICE_ACCOUNT_KEY (base64-encoded service account JSON)
   from Vercel env vars. This service account is also shared as Viewer on
   both attendance Google Sheets, so the same credentials cover both
   Firestore Admin access and Sheets API reads.

   Never expose this module or its exports to client-side code.
   ============================================================================ */

const admin = require('firebase-admin');

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
  const json = Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(json);
}

function getApp() {
  if (admin.apps.length) return admin.apps[0];
  return admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount()),
  });
}

const app = getApp();
const db  = admin.firestore(app);
const auth = admin.auth(app);

/**
 * Verifies the Firebase ID token from an Authorization: Bearer <token> header.
 * Returns the decoded token (with .uid) or throws.
 */
async function verifyRequestToken(req) {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    const err = new Error('Missing bearer token');
    err.statusCode = 401;
    throw err;
  }
  try {
    return await auth.verifyIdToken(match[1]);
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.statusCode = 401;
    throw err;
  }
}

/**
 * Looks up the caller's role from staff-users/{uid}.
 * Throws a 403 if the uid has no staff-users record (not an authorized staff member).
 */
async function getStaffProfile(uid) {
  const snap = await db.collection('staff-users').doc(uid).get();
  if (!snap.exists) {
    const err = new Error('Not an authorized staff member');
    err.statusCode = 403;
    throw err;
  }
  return { uid, ...snap.data() };
}

/**
 * Convenience: verify token + load staff profile in one call.
 * Use at the top of every api/staff/*.js handler.
 */
async function requireStaff(req) {
  const decoded = await verifyRequestToken(req);
  return getStaffProfile(decoded.uid);
}

/**
 * Requires the caller to be role: 'owner'. Throws 403 otherwise.
 */
async function requireOwner(req) {
  const staff = await requireStaff(req);
  if (staff.role !== 'owner') {
    const err = new Error('Owner access required');
    err.statusCode = 403;
    throw err;
  }
  return staff;
}

/**
 * Writes one audit-log entry. Never fails the calling request if logging
 * itself fails (logs to console instead) — but always call this before
 * returning a successful response, not fire-and-forget, so ordering is
 * deterministic for the audit trail.
 */
async function writeAuditLog({ actorUid, actorName, action, targetMemberId = null, detail = null }) {
  try {
    await db.collection('audit-log').add({
      actorUid, actorName, action, targetMemberId, detail,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[audit-log] write failed:', e.message);
  }
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  if (status === 500) console.error('[api/staff] error:', err);
  return res.status(status).json({ error: err.message || 'Internal error' });
}

module.exports = {
  admin, db, auth,
  getServiceAccount,
  requireStaff, requireOwner,
  writeAuditLog,
  sendError,
};
