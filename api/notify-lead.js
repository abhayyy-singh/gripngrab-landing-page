/* ============================================================================
   api/notify-lead.js — Grip & Grab
   Notify Me — sends email to admin + confirmation email to user
   ============================================================================ */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, program, center } = req.body ?? {};

  if (!name || !phone || !program) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL || 'haristhenics06@gmail.com';

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  /* ── Admin email ── */
  const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:540px;margin:32px auto;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
    <div style="background:linear-gradient(135deg,#ff6b6b,#f7d794);padding:24px 28px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:rgba(0,0,0,0.5);letter-spacing:2px;text-transform:uppercase;">Grip &amp; Grab</p>
      <h2 style="margin:6px 0 0;font-size:22px;color:#000;font-weight:800;">🔔 New Notify Me Lead</h2>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.45);width:110px;">Name</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#f0f0f0;font-weight:600;">${name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.45);">Phone</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#f0f0f0;font-weight:600;">${phone}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.45);">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#f0f0f0;font-weight:600;">${email || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.45);">Program</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#f0f0f0;font-weight:600;">${program}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:rgba(255,255,255,0.45);">Center</td>
          <td style="padding:10px 0;font-size:14px;color:#f0f0f0;font-weight:600;">${center || '—'}</td>
        </tr>
      </table>
      <div style="margin-top:20px;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px 16px;">
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">Received at ${now}</p>
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;">
        View all leads at <strong style="color:rgba(255,255,255,0.6);">gripandgrab.com/admin</strong>
      </p>
    </div>
  </div>
</body>
</html>`.trim();

  /* ── User confirmation email ── */
  const userHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;">
    <div style="background:linear-gradient(135deg,#ff6b6b,#f7d794);padding:28px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);letter-spacing:2px;text-transform:uppercase;">Grip &amp; Grab</p>
      <h2 style="margin:8px 0 0;font-size:24px;color:#000;font-weight:800;">You're on the list! 🔔</h2>
    </div>
    <div style="padding:28px;">
      <p style="font-size:15px;color:#222;margin:0 0 16px;">Hi ${name},</p>
      <p style="font-size:15px;color:#444;margin:0 0 24px;line-height:1.6;">
        We've noted your interest in <strong>${program}</strong>${center ? ` at <strong>${center}</strong>` : ''}.
        As soon as spots open up, you'll be the first to know.
      </p>
      <div style="background:#f9f9f9;border-radius:12px;padding:18px 20px;margin-bottom:24px;border:1px solid #eee;">
        <p style="margin:0;font-size:13px;color:#888;">In the meantime, feel free to reach out to us at</p>
        <p style="margin:6px 0 0;font-size:14px;color:#222;font-weight:600;">haristhenics06@gmail.com</p>
      </div>
      <p style="font-size:14px;color:#666;margin:0;line-height:1.6;">
        — Team Grip &amp; Grab
      </p>
    </div>
  </div>
</body>
</html>`.trim();

  try {
    const emails = [
      /* Admin notification */
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Grip & Grab <noreply@gripandgrab.com>',
          to:      [NOTIFY_EMAIL],
          subject: `🔔 Notify Me — ${program} (${center || 'Unknown Center'})`,
          html:    adminHtml,
        }),
      }),
    ];

    /* User confirmation — only if email provided */
    if (email) {
      emails.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'Grip & Grab <noreply@gripandgrab.com>',
            to:      [email],
            subject: `You're on the list — ${program} at Grip & Grab`,
            html:    userHtml,
          }),
        })
      );
    }

    await Promise.all(emails);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify-lead handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
