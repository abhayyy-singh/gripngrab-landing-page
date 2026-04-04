/* ============================================================================
   api/send-email.js
   Vercel Serverless Function — Membership Booking Email
   ----------------------------------------------------------------------------
   Called after Razorpay payment success (client-side).
   Sends confirmation email to the customer + notification to Harish.

   ENV VARS required in Vercel dashboard:
     RESEND_API_KEY   → your Resend API key  (re_xxxxxxxxxxxx)
     NOTIFY_EMAIL     → Harish's email for new booking notifications

   POST /api/send-email
   Body (JSON):
     {
       name, email, phone, dob,
       plan, amount, paymentId, orderId
     }
   ============================================================================ */

export default async function handler(req, res) {

  /* ── Only POST allowed ── */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Read + validate body ── */
  const { name, email, phone, dob, plan, amount, paymentId, orderId } = req.body ?? {};

  if (!name || !email || !plan || !paymentId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  /* ── Guard: Resend key must be set ── */
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL ?? 'placeholder@example.com';

  if (!RESEND_API_KEY || RESEND_API_KEY === 'REPLACE_ME') {
    console.error('RESEND_API_KEY not set in environment variables');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  /* ── Build readable plan label ── */
  const planLabels = {
    monthly:    'Monthly — ₹8,000 + GST',
    quarterly:  'Quarterly — ₹21,000 + GST',
    halfyearly: 'Half Yearly — ₹36,000 + GST',
    yearly:     'Yearly — ₹60,000 + GST',
    trial:      'Trial Class — ₹2,000',
  };
  const planLabel = planLabels[plan] ?? plan;

  /* ── Extra fields (trial sends location/date/time; membership sends center) ── */
  const center   = req.body.center   ?? '';
  const location = req.body.location ?? center;
  const date     = req.body.date     ?? '';
  const time     = req.body.time     ?? '';

  const bookingDate = new Date().toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  });

  /* ── Customer confirmation email ── */
  const customerEmail = {
    from:    'Grip&Grab <noreply@gripandgrab.com>',
    to:      [email],
    subject: `Welcome to Grip&Grab! Your membership is confirmed 🎉`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Membership Confirmed</title>
  <style>
    body { margin:0; padding:0; background:#0a0a0a; font-family:'Helvetica Neue',Arial,sans-serif; color:#ffffff; }
    .wrapper { max-width:560px; margin:0 auto; padding:40px 20px; }
    .logo-row { text-align:center; margin-bottom:32px; }
    .logo-row img { height:50px; }
    .card { background:#141414; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:32px; }
    h1 { font-size:22px; font-weight:700; margin:0 0 8px; }
    .subtitle { color:rgba(255,255,255,0.5); font-size:14px; margin:0 0 28px; }
    .row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.07); font-size:14px; }
    .row:last-child { border-bottom:none; }
    .label { color:rgba(255,255,255,0.45); }
    .value { font-weight:600; text-align:right; }
    .plan-badge { display:inline-block; background:linear-gradient(135deg,#ff6b6b,#f7d794); color:#000; font-weight:700; font-size:13px; padding:6px 16px; border-radius:20px; margin:20px 0 28px; }
    .footer-note { margin-top:28px; font-size:12px; color:rgba(255,255,255,0.3); text-align:center; line-height:1.6; }
    .cta { display:block; text-align:center; margin:24px 0 0; background:linear-gradient(135deg,#ff6b6b,#f7d794); color:#000; font-weight:700; font-size:14px; padding:14px 32px; border-radius:30px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <h1>You're in, ${name.split(' ')[0]}! 💪</h1>
      <p class="subtitle">${plan === 'trial' ? 'Your trial class at Grip&amp;Grab is confirmed.' : 'Your Grip&amp;Grab membership has been confirmed.'}</p>

      <div class="plan-badge">${planLabel}</div>

      <div class="row">
        <span class="label">Name</span>
        <span class="value">${name}</span>
      </div>
      <div class="row">
        <span class="label">Email</span>
        <span class="value">${email}</span>
      </div>
      <div class="row">
        <span class="label">Phone</span>
        <span class="value">${phone}</span>
      </div>
      ${plan !== 'trial' ? `
      <div class="row">
        <span class="label">Date of Birth</span>
        <span class="value">${dob ?? '—'}</span>
      </div>` : ''}
      ${(location || center) ? `
      <div class="row">
        <span class="label">Center</span>
        <span class="value">${location || center}</span>
      </div>` : ''}
      ${date ? `
      <div class="row">
        <span class="label">Date</span>
        <span class="value">${date}</span>
      </div>` : ''}
      ${time ? `
      <div class="row">
        <span class="label">Time Slot</span>
        <span class="value">${time}</span>
      </div>` : ''}
      <div class="row">
        <span class="label">Booking Date</span>
        <span class="value">${bookingDate}</span>
      </div>
      <div class="row">
        <span class="label">Payment ID</span>
        <span class="value" style="font-size:12px;font-family:monospace;">${paymentId}</span>
      </div>

      <a href="https://gripandgrab.com" class="cta">Visit gripandgrab.com</a>

      <p class="footer-note">
        ${plan === 'trial' ? 'See you at the gym! Carry this email as your booking reference.' : 'Our team will reach out shortly with next steps.'}<br>
        Keep this email for your records — Payment ID: ${paymentId}
      </p>
    </div>
  </div>
</body>
</html>`,
  };

  /* ── Internal notification to Harish ── */
  const notifyEmail = {
    from:    'Grip&Grab Bookings <noreply@gripandgrab.com>',
    to:      [NOTIFY_EMAIL],
    subject: `New ${plan === 'trial' ? 'Trial Booking' : 'Membership'}: ${name} — ${planLabel}`,
    html: `
<div style="font-family:monospace;padding:24px;background:#0a0a0a;color:#fff;max-width:480px;">
  <h2 style="margin:0 0 16px;">New Membership Booking</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 0;color:#aaa;">Name</td><td style="padding:8px 0;font-weight:bold;">${name}</td></tr>
    <tr><td style="padding:8px 0;color:#aaa;">Email</td><td style="padding:8px 0;">${email}</td></tr>
    <tr><td style="padding:8px 0;color:#aaa;">Phone</td><td style="padding:8px 0;">${phone}</td></tr>
    <tr><td style="padding:8px 0;color:#aaa;">DOB</td><td style="padding:8px 0;">${dob ?? '—'}</td></tr>
    <tr><td style="padding:8px 0;color:#aaa;">Plan</td><td style="padding:8px 0;color:#f7d794;font-weight:bold;">${planLabel}</td></tr>
    <tr><td style="padding:8px 0;color:#aaa;">Amount</td><td style="padding:8px 0;">₹${(amount / 100).toLocaleString('en-IN')}</td></tr>
    <tr><td style="padding:8px 0;color:#aaa;">Payment ID</td><td style="padding:8px 0;font-size:12px;">${paymentId}</td></tr>
    <tr><td style="padding:8px 0;color:#aaa;">Order ID</td><td style="padding:8px 0;font-size:12px;">${orderId ?? '—'}</td></tr>
    ${(location || center) ? `<tr><td style="padding:8px 0;color:#aaa;">Center</td><td style="padding:8px 0;">${location || center}</td></tr>` : ''}
    ${date ? `<tr><td style="padding:8px 0;color:#aaa;">Date</td><td style="padding:8px 0;">${date}</td></tr>` : ''}
    ${time ? `<tr><td style="padding:8px 0;color:#aaa;">Time</td><td style="padding:8px 0;">${time}</td></tr>` : ''}
    <tr><td style="padding:8px 0;color:#aaa;">Date</td><td style="padding:8px 0;">${bookingDate}</td></tr>
  </table>
</div>`,
  };

  /* ── Send both emails via Resend ── */
  try {
    const sendMail = async (payload) => {
      const r = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Resend error ${r.status}: ${err}`);
      }
      return r.json();
    };

    await sendMail(customerEmail);
    await sendMail(notifyEmail);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Email send failed:', err.message);
    /* Don't expose internals to client */
    return res.status(500).json({ error: 'Failed to send confirmation email' });
  }
}