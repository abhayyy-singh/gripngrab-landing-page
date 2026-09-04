/* ============================================================================
   api/job-apply.js — Grip & Grab
   Receives a job application and emails the admin.
   POST /api/job-apply
   Body: { name, phone, email, role, experience, portfolio, note }
   ============================================================================ */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, role, experience, portfolio, note } = req.body ?? {};
  if (!name || !phone || !email || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL || 'haristhenics06@gmail.com';
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const row = (label, value) => value ? `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:rgba(255,255,255,0.45);width:120px;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:#f0f0f0;font-weight:600;">${value}</td>
    </tr>` : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:540px;margin:32px auto;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
    <div style="background:linear-gradient(135deg,#ff6b6b,#f7d794);padding:24px 28px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:rgba(0,0,0,0.5);letter-spacing:2px;text-transform:uppercase;">Grip &amp; Grab — Careers</p>
      <h2 style="margin:6px 0 0;font-size:22px;color:#000;font-weight:800;">💼 New Job Application</h2>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;">
        ${row('Role',        role)}
        ${row('Name',        name)}
        ${row('Phone',       phone)}
        ${row('Email',       email)}
        ${row('Experience',  experience || '—')}
        ${row('Portfolio',   portfolio  || '—')}
        ${row('Note',        note       || '—')}
      </table>
      <div style="margin-top:20px;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px 16px;">
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">Received at ${now}</p>
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.4);text-align:center;">
        View all applications at <strong style="color:rgba(255,255,255,0.6);">gripandgrab.com/admin</strong>
      </p>
    </div>
  </div>
</body></html>`.trim();

  try {
    await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Grip & Grab <noreply@gripandgrab.com>',
        to:      [NOTIFY_EMAIL],
        subject: `💼 Job Application — ${role}`,
        html,
      }),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('job-apply error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
