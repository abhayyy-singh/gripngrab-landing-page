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

  /* ── Sunday HIIT class registrations — separate flow, separate collection ── */
  if (notes.class === 'sunday-hiit') {
    return handleSundayHiit(payment, notes, res);
  }

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

/* ============================================================================
   Sunday HIIT class — Firestore write + dual email (user + admin)
   ============================================================================ */
async function handleSundayHiit(payment, notes, res) {
  const paymentId = payment.id ?? '';
  const email     = payment.email ?? '';
  const name      = notes.name  ?? '';
  const phone     = notes.phone ?? '';

  if (!paymentId || !name || !phone) {
    console.warn('[webhook][sunday-hiit] Missing fields — paymentId:', paymentId, 'name:', name, 'phone:', phone);
    return res.status(200).json({ ok: true, warn: 'missing fields, sunday-hiit skipped' });
  }

  const results = { paymentId, name, phone, emailSent: false, firestoreSaved: false };

  /* ── 1. Write to Firestore (idempotent via paymentId as doc ID) ── */
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyB8hiRT58l-n5f5nbaqtuViCJeOqEMp-_k';
  const fsUrl = `https://firestore.googleapis.com/v1/projects/gripngrab/databases/(default)/documents/sunday-hiit-registrations/${paymentId}?key=${FIREBASE_API_KEY}`;

  const toStr = v => ({ stringValue: String(v ?? '') });

  try {
    await fetch(fsUrl, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          name:       toStr(name),
          phone:      toStr(phone),
          email:      toStr(email),
          paymentId:  toStr(paymentId),
          amount:     { integerValue: '500' },
          status:     toStr('confirmed'),
          source:     toStr('webhook'),
          savedAt:    toStr(new Date().toISOString()),
        },
      }),
    });
    results.firestoreSaved = true;
  } catch (e) {
    console.error('[webhook][sunday-hiit] Firestore write failed:', e.message);
  }

  /* ── 2. Send both emails ── */
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL ?? 'haristhenics06@gmail.com';

  if (RESEND_API_KEY) {
    try {
      const r1 = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Grip & Grab <noreply@gripandgrab.com>',
          to:      [email || NOTIFY_EMAIL],
          subject: '✓ Your Sunday HIIT Registration is Confirmed',
          html:    buildSundayUserEmail(name),
        }),
      });

      const r2 = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Grip & Grab <noreply@gripandgrab.com>',
          to:      [NOTIFY_EMAIL],
          subject: `New Registration: ${name} — Sunday HIIT Class`,
          html:    buildSundayAdminEmail(name, phone, email, paymentId),
        }),
      });

      results.emailSent = r1.ok && r2.ok;
    } catch (e) {
      console.error('[webhook][sunday-hiit] Email send failed:', e.message);
    }
  }

  console.log('[webhook][sunday-hiit] done', results);
  return res.status(200).json({ ok: true, ...results });
}

function getNextSundayDate() {
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = istNow.getDay(); /* 0 = Sunday */
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  istNow.setDate(istNow.getDate() + daysUntilSunday);
  return istNow.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
}

function buildSundayUserEmail(name) {
  return `<div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f7fa;padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#ff6b6b 0%,#f7d794 100%);padding:40px 30px;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:28px;font-weight:700;">Grip&Grab</h1>
    <p style="color:rgba(0,0,0,0.6);margin:10px 0 0;font-size:15px;font-weight:500;">Sunday HIIT — Registration Confirmed</p>
  </td></tr>
  <tr><td style="padding:40px 40px 20px;">
    <h2 style="color:#1a1a1a;margin:0;font-size:22px;">Hi ${name},</h2>
    <p style="color:#666;margin:15px 0 0;font-size:15px;line-height:1.7;">Your registration for our <strong>Sunday HIIT Class</strong> is confirmed. Get ready for an intense, energetic workout session with like-minded fitness enthusiasts.</p>
    <p style="color:#666;margin:15px 0 0;font-size:15px;line-height:1.7;">See you on <strong>${getNextSundayDate()}</strong>!</p>
  </td></tr>
  <tr><td style="padding:20px 40px;background:#f8f9fc;border-top:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:8px 0;">Class Fee</td><td style="color:#1f2937;text-align:right;font-weight:700;">₹500</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:8px 0;border-top:1px solid #e5e7eb;">Timing</td><td style="color:#1f2937;text-align:right;font-weight:700;border-top:1px solid #e5e7eb;">Starts from 9:00 AM</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:8px 0;border-top:1px solid #e5e7eb;">Status</td><td style="color:#16a34a;text-align:right;font-weight:700;border-top:1px solid #e5e7eb;">Confirmed</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 40px 28px;background:#f8f9fc;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:11px;">See you on Sunday! Get ready to push your limits.</p>
    <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">Questions? <a href="mailto:haristhenics06@gmail.com" style="color:#ff6b6b;text-decoration:none;">Email us</a></p>
  </td></tr>
</table>
</td></tr></table></div>`;
}

function buildSundayAdminEmail(name, phone, email, paymentId) {
  return `<div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f7fa;padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#ff6b6b 0%,#f7d794 100%);padding:40px 30px;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:24px;font-weight:700;">New Registration</h1>
    <p style="color:rgba(0,0,0,0.6);margin:10px 0 0;font-size:14px;">Sunday HIIT Class</p>
  </td></tr>
  <tr><td style="padding:30px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;width:35%;padding:12px 0;border-bottom:1px solid #e5e7eb;">Name</td><td style="color:#1f2937;font-size:14px;padding:12px 0;border-bottom:1px solid #e5e7eb;">${name}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:12px 0;border-bottom:1px solid #e5e7eb;">Phone</td><td style="color:#1f2937;font-size:14px;padding:12px 0;border-bottom:1px solid #e5e7eb;">${phone}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:12px 0;border-bottom:1px solid #e5e7eb;">Email</td><td style="color:#1f2937;font-size:14px;padding:12px 0;border-bottom:1px solid #e5e7eb;">${email || '—'}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:12px 0;">Payment ID</td><td style="color:#1f2937;font-family:monospace;font-size:12px;padding:12px 0;">${paymentId}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 40px;background:#f0fdf4;border-top:1px solid #e5e7eb;text-align:center;color:#166534;font-size:13px;font-weight:600;">Payment confirmed • Registration complete</td></tr>
</table>
</td></tr></table></div>`;
}
