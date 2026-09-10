/* ============================================================================
   api/sunday-class-register.js — Sunday HIIT Class Registration
   Creates Razorpay order for ₹500 HIIT class

   POST /api/sunday-class-register
   Body: { name, phone }
   ============================================================================ */

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone } = req.body ?? {};

  if (!name || !phone) {
    return res.status(400).json({ error: 'Missing name or phone' });
  }

  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay not configured' });
  }

  try {
    /* Create Razorpay order */
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 50000, /* ₹500 in paise */
        currency: 'INR',
        receipt: `sunday-${Date.now()}`,
        notes: {
          name: name,
          phone: phone,
          class: 'sunday-hiit',
        },
      }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      throw new Error(`Razorpay error: ${err}`);
    }

    const order = await orderRes.json();

    return res.status(200).json({
      ok: true,
      razorpayOrderId: order.id,
    });
  } catch (err) {
    console.error('[sunday-class] Order creation failed:', err.message);
    return res.status(500).json({ error: 'Failed to create order' });
  }
};
