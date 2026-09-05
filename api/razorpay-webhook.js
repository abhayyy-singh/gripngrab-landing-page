/* ============================================================================
   api/razorpay-webhook.js — Grip & Grab
   Razorpay sends a signed POST to this URL on every payment.captured event.
   This is the reliable trigger for emails + Firestore — works even if the
   browser closes immediately after payment.

   Vercel env vars required:
     RAZORPAY_WEBHOOK_SECRET  — copy from Razorpay Dashboard → Webhooks
     RESEND_API_KEY
     NOTIFY_EMAIL             (optional, defaults to haristhenics06@gmail.com)
     FIREBASE_API_KEY         (web API key, for Firestore REST write)

   Razorpay Dashboard setup:
     Webhooks → Add Webhook
     URL:    https://gripandgrab.com/api/razorpay-webhook
     Events: payment.captured
   ============================================================================ */

const crypto = require('crypto');

/* Vercel: disable body parser so we can verify the raw body signature */
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  /* ── Collect raw body ── */
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

  /* ── Verify Razorpay signature ── */
  const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  if (secret && signature) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expected !== signature) {
      console.error('[webhook] Invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    console.warn('[webhook] No webhook secret configured — skipping signature check');
  }

  /* ── Parse event ── */
  let event;
  try { event = JSON.parse(rawBody); } catch(e) { return res.status(400).json({ error: 'Bad JSON' }); }

  if (event.event !== 'payment.captured') {
    return res.status(200).json({ ok: true, skipped: event.event });
  }

  const payment   = event?.payload?.payment?.entity ?? {};
  const notes     = payment.notes ?? {};

  const paymentId = payment.id            ?? '';
  const amount    = payment.amount        ?? 0;   /* paise */
  const email     = payment.email         ?? '';
  const phone     = (payment.contact || '').replace('+91','');
  const name      = notes.customerName    || payment.name || '';
  const plan      = notes.plan            ?? '';
  const planLabel = notes.planLabel       ?? plan;
  const center    = notes.center          ?? '';
  const date      = notes.date            ?? '';
  const time      = notes.time            ?? '';
  const dob       = notes.dob             ?? '';

  if (!paymentId || !email || !plan) {
    console.warn('[webhook] Missing fields — paymentId:', paymentId, 'email:', email, 'plan:', plan);
    return res.status(200).json({ ok: true, warn: 'missing fields, email skipped' });
  }

  const results = { paymentId, email, emailSent: false, firestoreSaved: false };

  /* ── 1. Write to Firestore (idempotent via paymentId as doc ID) ── */
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyB8hiRT58l-n5f5nbaqtuViCJeOqEMp-_k';
  const fsUrl = `https://firestore.googleapis.com/v1/projects/gripngrab/databases/(default)/documents/enrollments/${paymentId}?key=${FIREBASE_API_KEY}`;

  const toStr = v => ({ stringValue: String(v ?? '') });
  const toInt = v => ({ integerValue: String(Math.round(Number(v) || 0)) });

  try {
    await fetch(fsUrl, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          name:       toStr(name),
          email:      toStr(email),
          phone:      toStr(phone),
          dob:        toStr(dob),
          plan:       toStr(plan),
          planLabel:  toStr(planLabel),
          center:     toStr(center),
          amount:     toInt(amount / 100),
          paymentId:  toStr(paymentId),
          date:       toStr(date),
          time:       toStr(time),
          status:     toStr('active'),
          source:     toStr('webhook'),
          savedAt:    toStr(new Date().toISOString()),
        },
      }),
    });
    results.firestoreSaved = true;
  } catch (e) {
    console.error('[webhook] Firestore write failed:', e.message);
  }

  /* ── 2. Send emails via send-email API ── */
  const SITE = 'https://gripandgrab.com';

  try {
    const r = await fetch(`${SITE}/api/send-email`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, phone, dob, plan, planLabel,
        center, location: center, date, time,
        amount: amount,   /* send-email expects paise */
        paymentId,
        source: 'webhook',
      }),
    });
    results.emailSent = r.ok;
    if (!r.ok) console.error('[webhook] send-email returned', r.status, await r.text());
  } catch (e) {
    console.error('[webhook] send-email fetch failed:', e.message);
  }

  console.log('[webhook] done', results);
  return res.status(200).json({ ok: true, ...results });
};
