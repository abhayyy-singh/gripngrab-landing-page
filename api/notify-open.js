/* ============================================================================
   api/notify-open.js — Grip & Grab
   Sends "slots are now open" emails to a list of notify-me leads.
   Called from the admin panel when admin toggles slots ON.

   POST /api/notify-open
   Body: { program, center, leads: [{ name, email, phone }] }
   ============================================================================ */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { program, center, leads } = req.body ?? {};

  if (!program || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const bookingLink = 'https://gripandgrab.com';

  function buildEmail(name) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;">

    <div style="background:linear-gradient(135deg,#ff6b6b,#f7d794);padding:28px;">
      <p style="margin:0;font-size:11px;font-weight:700;color:rgba(0,0,0,0.4);letter-spacing:2px;text-transform:uppercase;">Grip &amp; Grab</p>
      <h2 style="margin:8px 0 0;font-size:26px;color:#000;font-weight:800;">Spots are open! 🎉</h2>
    </div>

    <div style="padding:28px 28px 24px;">
      <p style="font-size:15px;color:#222;margin:0 0 16px;">Hi ${name},</p>
      <p style="font-size:15px;color:#444;margin:0 0 24px;line-height:1.6;">
        Great news — <strong>${program}</strong>${center ? ` at <strong>${center}</strong>` : ''} now has <strong>open slots</strong>!
        You'd asked us to notify you, and here we are.
      </p>
      <p style="font-size:14px;color:#555;margin:0 0 28px;line-height:1.6;">
        Spots fill up quickly — book yours before they're gone.
      </p>

      <a href="${bookingLink}" style="display:block;text-align:center;padding:16px 24px;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;font-size:15px;font-weight:700;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Book Your Spot Now →
      </a>

      <div style="background:#f9f9f9;border-radius:12px;padding:16px 20px;border:1px solid #eee;">
        <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">
          Questions? Reach out at <strong style="color:#555;">haristhenics06@gmail.com</strong>
        </p>
      </div>

      <p style="font-size:14px;color:#999;margin:20px 0 0;text-align:center;font-size:12px;">
        You received this because you signed up for slot notifications at gripandgrab.com
      </p>
    </div>
  </div>
</body>
</html>`.trim();
  }

  /* Send emails in batches of 5 to avoid rate limits */
  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const lead of leads) {
    if (!lead.email) { results.skipped++; continue; }

    try {
      const r = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from:    'Grip & Grab <noreply@gripandgrab.com>',
          to:      [lead.email],
          subject: `🎉 Spots open — ${program}${center ? ' at ' + center : ''}`,
          html:    buildEmail(lead.name || 'there'),
        }),
      });
      if (r.ok) results.sent++; else results.failed++;
    } catch (_) {
      results.failed++;
    }

    /* Small delay between sends */
    await new Promise(r => setTimeout(r, 120));
  }

  return res.status(200).json({ ok: true, ...results });
};
