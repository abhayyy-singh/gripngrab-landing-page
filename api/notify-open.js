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
  const isHarish = program === 'harish-monthly' || /harish/i.test(program);

  function buildHarishEmail(name) {
    return `<div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f7fa;padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#ff6b6b 0%,#f7d794 100%);padding:40px 30px;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:28px;font-weight:700;">Grip&amp;Grab</h1>
    <p style="color:rgba(0,0,0,0.55);margin:8px 0 0;font-size:15px;font-weight:500;">Train with Haristhenics — Spots just opened</p>
  </td></tr>
  <tr><td style="padding:40px 40px 20px;">
    <h2 style="color:#1a1a1a;margin:0;font-size:22px;">Hi ${name},</h2>
    <p style="color:#666;margin:15px 0 0;font-size:15px;line-height:1.7;">You signed up to be notified when slots open for <strong>Train with Haristhenics</strong> at Grip&amp;Grab — and they're open now.</p>
    <p style="color:#666;margin:12px 0 0;font-size:15px;line-height:1.7;">Harish takes on a <strong>limited number of clients</strong> each month to ensure every person gets personal attention. Specialized in <strong>pain management &amp; better movement</strong> — once these slots are gone, the next opening could be weeks away.</p>
  </td></tr>
  <tr><td style="padding:0 40px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:12px;border-left:4px solid #ff6b6b;">
      <tr><td style="padding:20px 25px;color:#6b7280;font-size:14px;font-weight:600;">🏋️ Program</td><td style="padding:20px 25px;color:#1f2937;font-weight:600;">Train with Haristhenics — 1 Month</td></tr>
      <tr><td style="padding:20px 25px;color:#6b7280;font-size:14px;font-weight:600;border-top:1px solid #e5e7eb;">📍 Center</td><td style="padding:20px 25px;color:#1f2937;border-top:1px solid #e5e7eb;">Grip&amp;Grab</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 40px 30px;text-align:center;">
    <a href="${bookingLink}" style="display:inline-block;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;text-decoration:none;font-size:15px;font-weight:700;padding:15px 36px;border-radius:10px;">Secure Your Spot Now →</a>
  </td></tr>
  <tr><td style="padding:20px 40px 28px;background:#f8f9fc;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#6b7280;font-size:13px;">Questions? <a href="https://wa.me/917827373852" style="color:#ff6b6b;text-decoration:none;">WhatsApp us</a> or call <a href="tel:+917827373852" style="color:#ff6b6b;text-decoration:none;">+91 78273 73852</a></p>
    <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">You received this because you signed up for slot notifications at gripandgrab.com</p>
  </td></tr>
</table>
</td></tr></table></div>`;
  }

  function buildEmail(name) {
    return `<div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f7fa;padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#ff6b6b 0%,#f7d794 100%);padding:40px 30px;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:28px;font-weight:700;">Grip&amp;Grab</h1>
    <p style="color:rgba(0,0,0,0.55);margin:8px 0 0;font-size:15px;font-weight:500;">Slots are now open!</p>
  </td></tr>
  <tr><td style="padding:40px 40px 20px;">
    <h2 style="color:#1a1a1a;margin:0;font-size:22px;">Hi ${name},</h2>
    <p style="color:#666;margin:15px 0 0;font-size:15px;line-height:1.7;">You had asked us to notify you when slots open up — and here we are! <strong>${program}</strong>${center ? ` at <strong>${center}</strong>` : ''} now has open slots. Spots fill up fast, so book yours now.</p>
  </td></tr>
  <tr><td style="padding:0 40px 30px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;border-radius:12px;border-left:4px solid #ff6b6b;">
      <tr><td style="padding:20px 25px;color:#6b7280;font-size:14px;font-weight:600;">🏋️ Program</td><td style="padding:20px 25px;color:#1f2937;font-weight:600;">${program}</td></tr>
      <tr><td style="padding:20px 25px;color:#6b7280;font-size:14px;font-weight:600;border-top:1px solid #e5e7eb;">📍 Center</td><td style="padding:20px 25px;color:#1f2937;border-top:1px solid #e5e7eb;">Grip&amp;Grab</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 40px 30px;text-align:center;">
    <a href="${bookingLink}" style="display:inline-block;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;text-decoration:none;font-size:15px;font-weight:700;padding:15px 36px;border-radius:10px;">Book Your Spot Now →</a>
  </td></tr>
  <tr><td style="padding:20px 40px 28px;background:#f8f9fc;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;color:#6b7280;font-size:13px;">Questions? <a href="https://wa.me/917827373852" style="color:#ff6b6b;text-decoration:none;">WhatsApp us</a> or call <a href="tel:+917827373852" style="color:#ff6b6b;text-decoration:none;">+91 78273 73852</a></p>
    <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">You received this because you signed up for slot notifications at gripandgrab.com</p>
  </td></tr>
</table>
</td></tr></table></div>`;
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
          subject: isHarish
            ? `Slots just opened — Train with Haristhenics at Grip&Grab`
            : `🎉 Spots open — ${program}${center ? ' at ' + center : ''}`,
          html: isHarish
            ? buildHarishEmail(lead.name || 'there')
            : buildEmail(lead.name || 'there'),
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
