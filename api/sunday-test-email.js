/* TEMPORARY — test the Sunday HIIT confirmation emails. Delete after testing. */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'haristhenics06@gmail.com';
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Not configured' });

  const name = 'Abhay Test';
  const phone = '9999999999';
  const email = 'itsabhaypvt@gmail.com';
  const paymentId = 'pay_test_sunday_001';

  const userEmail = buildUserEmail(name);
  const adminEmail = buildAdminEmail(name, phone, email, paymentId);

  const r1 = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Grip & Grab <noreply@gripandgrab.com>',
      to: [email],
      subject: '✓ Your Sunday HIIT Registration is Confirmed',
      html: userEmail,
    }),
  });

  const r2 = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Grip & Grab <noreply@gripandgrab.com>',
      to: [NOTIFY_EMAIL],
      subject: `New Registration: ${name} — Sunday HIIT Class`,
      html: adminEmail,
    }),
  });

  return res.status(200).json({ ok: true, userEmailSent: r1.ok, adminEmailSent: r2.ok });
};

function buildUserEmail(name) {
  return `<div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f7fa;padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#ff6b6b 0%,#f7d794 100%);padding:40px 30px;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:28px;font-weight:700;">Grip&Grab</h1>
    <p style="color:rgba(0,0,0,0.6);margin:10px 0 0;font-size:15px;font-weight:500;">🔥 Sunday HIIT — Registration Confirmed</p>
  </td></tr>
  <tr><td style="padding:40px 40px 20px;">
    <h2 style="color:#1a1a1a;margin:0;font-size:22px;">Hi ${name},</h2>
    <p style="color:#666;margin:15px 0 0;font-size:15px;line-height:1.7;">Your registration for our <strong>Sunday HIIT Class</strong> is confirmed. Get ready for an intense, energetic workout session with like-minded fitness enthusiasts.</p>
    <p style="color:#666;margin:15px 0 0;font-size:15px;line-height:1.7;"><strong>What to bring:</strong> Water bottle, towel, and your best energy!</p>
  </td></tr>
  <tr><td style="padding:20px 40px;background:#f8f9fc;border-top:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:8px 0;">Class Fee</td><td style="color:#1f2937;text-align:right;font-weight:700;">₹500</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;font-weight:600;padding:8px 0;">Status</td><td style="color:#16a34a;text-align:right;font-weight:700;">✓ Confirmed</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 40px 28px;background:#f8f9fc;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#9ca3af;font-size:11px;">See you on Sunday! Get ready to push your limits.</p>
    <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">Questions? <a href="mailto:haristhenics06@gmail.com" style="color:#ff6b6b;text-decoration:none;">Email us</a></p>
  </td></tr>
</table>
</td></tr></table></div>`;
}

function buildAdminEmail(name, phone, email, paymentId) {
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
  <tr><td style="padding:20px 40px;background:#f0fdf4;border-top:1px solid #e5e7eb;text-align:center;color:#166534;font-size:13px;font-weight:600;">✓ Payment confirmed • Registration complete</td></tr>
</table>
</td></tr></table></div>`;
}
