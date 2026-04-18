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

module.exports = async function handler(req, res) {


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
    'kids-monthly': 'Kids Monthly — ₹5,900 (₹5,000 + GST)',
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


  /* ── Center metadata — addresses + maps links ── */
 const CENTER_META = {
    'Grip&Grab Lajpat Nagar': {
      address:  'B-32, 3rd Floor, opposite Defence Colony, Lajpat Nagar, New Delhi 110024',
      mapsLink: 'https://maps.app.goo.gl/TGhC4Rz3XW65J5s18',
    },
    'Lajpat Nagar': {                                              // ← add karo
      address:  'B-32, 3rd Floor, opposite Defence Colony, Lajpat Nagar, New Delhi 110024',
      mapsLink: 'https://maps.app.goo.gl/TGhC4Rz3XW65J5s18',
    },
    'Grip&Grab Saket': {
      address:  '241, 2nd Floor, Westend Marg, near Garden of Five Senses, Saket, New Delhi 110030',
      mapsLink: 'https://maps.app.goo.gl/agrpCqbk3xc4wn9q7',
    },
    'Saket': {                                                     // ← add karo
      address:  '241, 2nd Floor, Westend Marg, near Garden of Five Senses, Saket, New Delhi 110030',
      mapsLink: 'https://maps.app.goo.gl/agrpCqbk3xc4wn9q7',
    },
  };
  /* Resolve center name from whichever field was sent */
  const centerName    = center || location || '';
  const centerMeta    = CENTER_META[centerName] ?? { address: centerName, mapsLink: 'https://maps.app.goo.gl/J3rfKoqepiDsr1QW9' };
  const centerAddress = centerMeta.address;
  const mapsLink      = centerMeta.mapsLink;
  const isTrial       = plan === 'trial';

  /* ── Customer confirmation email ── */
  const customerEmail = {
    from:    'Grip&Grab <noreply@gripandgrab.com>',
    to:      [email],
    subject: isTrial
      ? `Your trial class at Grip&Grab is confirmed!`
      : `Welcome to Grip&Grab! Your membership is confirmed`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${isTrial ? 'Trial Class Confirmed' : 'Membership Confirmed'} — Grip&amp;Grab</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f4;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:-0.5px;">Grip&amp;Grab</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Move Better. Live Stronger.</p>
          </td>
        </tr>

        <!-- Confirmed badge -->
        <tr>
          <td style="background:#18181b;padding:20px 40px;text-align:center;border-bottom:1px solid #e5e5e5;">
            <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:13px;font-weight:600;padding:6px 16px;border-radius:99px;letter-spacing:0.3px;">
              ✓ &nbsp;${isTrial ? 'Booking Confirmed' : 'Membership Confirmed'}
            </span>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:36px 40px 0;">
            <p style="margin:0 0 24px;font-size:16px;color:#111111;line-height:1.6;">
              Hi <strong>${name.split(' ')[0]}</strong>,<br><br>
              ${isTrial
                ? 'Your trial class at <strong>Grip&amp;Grab</strong> has been successfully booked. We\'re excited to have you!'
                : `Your <strong>${planLabel}</strong> membership at <strong>Grip&amp;Grab</strong> is now active. Welcome to the family!`
              }
            </p>
          </td>
        </tr>

        <!-- Booking details box -->
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellspacing="0" cellpadding="0" style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;margin-bottom:24px;">

              <!-- Center -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Center</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#111111;font-weight:600;">${centerName || 'Grip&amp;Grab'}</p>
                </td>
              </tr>

              <!-- Address -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Address</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#333333;line-height:1.5;">${centerAddress}</p>
                </td>
              </tr>

              ${isTrial ? `
              <!-- Date -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Date</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#111111;font-weight:600;">${date}</p>
                </td>
              </tr>
              <!-- Time -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Time Slot</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#111111;font-weight:600;">${time}</p>
                </td>
              </tr>` : `
              <!-- Plan -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Membership Plan</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#111111;font-weight:600;">${planLabel}</p>
                </td>
              </tr>`}

              <!-- Joining Date -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Joining Date</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#111111;font-weight:600;">${bookingDate}</p>
                </td>
              </tr>

              <!-- Amount -->
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Amount Paid</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#111111;font-weight:600;">₹${(amount / 100).toLocaleString('en-IN')}</p>
                </td>
              </tr>

              <!-- Payment ID -->
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Payment ID</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#555555;font-family:monospace;">${paymentId}</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        ${isTrial ? `
        <!-- ₹2,000 redeemable note — trial only -->
        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellspacing="0" cellpadding="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;font-size:13.5px;color:#92400e;line-height:1.6;">
                    <strong>💡 Note:</strong> Your trial fee of ₹2,000 is fully redeemable against any membership plan you choose.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''}

        <!-- Help text -->
        <tr>
          <td style="padding:0 40px 28px;">
            <p style="margin:0;font-size:14px;color:#444444;line-height:1.7;">
              ${isTrial
                ? 'See you at the gym! Carry this email as your booking reference.'
                : 'Our team will be in touch shortly with your onboarding details.'
              }<br><br>
              If you have any questions or need help, feel free to reach out to us on WhatsApp or give us a call — We\'re happy to assist.
            </p>
          </td>
        </tr>

        <!-- CTA buttons — Call + WhatsApp -->
        <tr>
          <td style="padding:0 40px 32px;text-align:center;">
            <table cellspacing="0" cellpadding="0" style="margin:0 auto;">
              <tr>
                <td style="padding-right:12px;">
                  <a href="tel:+917827373852"
                     style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 28px;border-radius:8px;letter-spacing:0.2px;">
                    📞 Call Us
                  </a>
                </td>
                <td>
                  <a href="https://wa.me/917827373852"
                     style="display:inline-block;background:#25d366;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 28px;border-radius:8px;letter-spacing:0.2px;">
                    💬 WhatsApp
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer — location + maps -->
        <tr>
          <td style="padding:20px 40px;background:#f9f9f9;border-top:1px solid #e5e5e5;text-align:center;">
            <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;">${centerAddress}</p>
            <a href="${mapsLink}"
               style="display:inline-block;margin-top:10px;font-size:12px;color:#ffffff;background:#0a0a0a;padding:6px 16px;border-radius:6px;text-decoration:none;">
              View on Google Maps →
            </a>
            <p style="margin:16px 0 0;font-size:11px;color:#bbbbbb;">
              © ${new Date().getFullYear()} Grip&amp;Grab · gripandgrab.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
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