/**
 * trial-paid.js
 * ─────────────────────────────────────────────────────────────
 * Self-contained paid trial module for Haristhenics.
 * Drop this file in your project and add one line to HTML:
 *   <script src="trial-paid.js"></script>
 *
 * Triggers on any element with:  data-paid-trial-trigger
 * ─────────────────────────────────────────────────────────────
 * DEPENDENCIES (must be loaded before this file):
 *   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
 *
 * CONFIGURE the CONFIG object below before going live.
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ─── CONFIG — edit these before going live ─────────────────── */
  const CONFIG = {
    razorpay: {
      keyId: 'rzp_live_RZDqqPc9XD0IjO',   // TODO: paste your live key
      amount: 200000,                        // ₹2,000 in paise
      currency: 'INR',
      name: 'Haristhenics',
      description: 'Trial Class Booking',
      image: '',                             // optional: your logo URL
      theme: { color: '#1a1a2e' }
    },
    emailJS: {
      publicKey: 'BFneCQi-ij58Ef_9C',
      serviceId: 'ABHAYPVT',
      templateId: 'trail_confirmation',    // TODO: create this template in EmailJS dashboard
      bccEmail: 'haristhenics06@gmail.com'  // Harish gets BCC of every booking email
    },
    sheets: {
      // Your existing Apps Script web app URL
      url: 'https://script.google.com/macros/s/AKfycbyZHDnLUtQtCL5rkP8VCS4qvfv0lNP5uto-DEWvhVcIu3T1ndd-XSmk6ZP6RgUJPmbIuQ/exec'
    }
  };
  /* ─────────────────────────────────────────────────────────────── */

  /* ─── Time slots per location ──────────────────────────────────── */
 const TIME_SLOTS = {
  'Lajpat Nagar': [
    '7:00 AM – 8:00 AM',
    '8:00 AM – 9:00 AM',
    '9:00 AM – 10:00 AM',
    '10:00 AM – 11:00 AM',
    '5:00 PM – 6:00 PM',
    '6:00 PM – 7:00 PM',
    '7:00 PM – 8:00 PM',
    '8:00 PM – 9:00 PM'
  ],
  'Saket': [
    '8:00 AM – 9:00 AM',
    '9:00 AM – 10:00 AM',
    '10:00 AM – 11:00 AM',
    '5:00 PM – 6:00 PM',
    '6:00 PM – 7:00 PM',
    '7:00 PM – 8:00 PM',
    '8:00 PM – 9:00 PM'
  ]
};
  /* ─── Internal state ────────────────────────────────────────────── */
  let modalEl = null;
  let isOpen = false;

  /* ─── Init: called once on DOMContentLoaded ─────────────────────── */
  function init() {
    injectModal();
    bindTriggers();
    emailjs.init(CONFIG.emailJS.publicKey);
  }

  /* ─── Inject modal HTML into body ───────────────────────────────── */
  function injectModal() {
    const html = `
<div id="ptModal" class="ptm-overlay" role="dialog" aria-modal="true" aria-labelledby="ptModalTitle" style="display:none;">
  <div class="ptm-backdrop" id="ptModalBackdrop"></div>
  <div class="ptm-container">
    <div class="ptm-handle"></div>

    <button class="ptm-close" id="ptModalClose" aria-label="Close" type="button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- Info banner -->
    <div class="ptm-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      <span>Your trial fee of ₹2,000 is redeemable against any membership plan you choose.</span>
    </div>

    <div class="ptm-header">
      <h3 id="ptModalTitle">Book Your Trial Class</h3>
      <p>Pay ₹2,000 to reserve your spot. Fill in your details below.</p>
    </div>

    <!-- Form -->
    <form id="ptForm" class="ptm-form" novalidate autocomplete="on">

      <div class="ptm-group">
        <label for="ptName">Full Name <span>*</span></label>
        <input type="text" id="ptName" name="name" placeholder="Your full name" required autocomplete="name" minlength="2">
        <span class="ptm-err" id="ptNameErr"></span>
      </div>

      <div class="ptm-group">
        <label for="ptEmail">Email Address <span>*</span></label>
        <input type="email" id="ptEmail" name="email" placeholder="your@email.com" required autocomplete="email">
        <span class="ptm-err" id="ptEmailErr"></span>
      </div>

      <div class="ptm-group">
        <label for="ptPhone">Phone Number <span>*</span></label>
        <input type="tel" id="ptPhone" name="phone" placeholder="10-digit mobile number" required autocomplete="tel" pattern="[0-9]{10}">
        <span class="ptm-err" id="ptPhoneErr"></span>
      </div>

      <div class="ptm-row">
        <div class="ptm-group">
          <label for="ptLocation">Location <span>*</span></label>
          <select id="ptLocation" name="location" required>
            <option value="" disabled selected>Select location</option>
            <option value="Lajpat Nagar">Lajpat Nagar</option>
            <option value="Saket">Saket</option>
          </select>
          <span class="ptm-err" id="ptLocationErr"></span>
        </div>

        <div class="ptm-group">
          <label for="ptDate">Preferred Date <span>*</span></label>
          <input type="date" id="ptDate" name="date" required>
          <span class="ptm-err" id="ptDateErr"></span>
        </div>
      </div>

      <div class="ptm-group">
        <label for="ptTime">Time Slot <span>*</span></label>
        <select id="ptTime" name="time" required disabled>
          <option value="" disabled selected>Select location first</option>
        </select>
        <span class="ptm-err" id="ptTimeErr"></span>
      </div>

      <button type="submit" class="ptm-submit" id="ptSubmitBtn">
        <span class="ptm-btn-text">Pay ₹2,000 &amp; Book Trial</span>
        <span class="ptm-btn-loader" style="display:none;">
          <svg class="ptm-spinner" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
          </svg>
        </span>
      </button>

    </form>

    <!-- Success state -->
    <div id="ptSuccess" class="ptm-success" style="display:none;">
      <div class="ptm-success-icon">✓</div>
      <h4>Trial Class Booked!</h4>
      <p>Payment successful. A confirmation has been sent to your email.</p>
      <p class="ptm-payment-id" id="ptPaymentIdDisplay"></p>
    </div>

    <!-- Error state -->
    <div id="ptError" class="ptm-error" style="display:none;">
      <div class="ptm-error-icon">✕</div>
      <h4>Payment Failed</h4>
      <p id="ptErrorMsg">Something went wrong. Please try again or call us at <a href="tel:+919971250050">+91 99712 50050</a>.</p>
      <button class="ptm-retry-btn" id="ptRetryBtn" type="button">Try Again</button>
    </div>

  </div>
</div>

<style>
  /* ── Overlay & backdrop ── */
  .ptm-overlay{
    position:fixed;inset:0;z-index:9999;
    display:flex;align-items:flex-end;justify-content:center;
  }
  @media(min-width:560px){
    .ptm-overlay{align-items:center;}
  }
  .ptm-backdrop{
    position:fixed;inset:0;
    background:rgba(0,0,0,0.75);
    backdrop-filter:blur(4px);
    -webkit-backdrop-filter:blur(4px);
  }

  /* ── Container — bottom sheet on mobile, centered card on desktop ── */
  .ptm-container{
    position:relative;
    background:#141414;
    color:#f0f0f0;
    font-family:'Poppins',sans-serif;
    width:100%;
    max-width:100%;
    max-height:92dvh;
    overflow-y:auto;
    overflow-x:hidden;
    -webkit-overflow-scrolling:touch;
    border-radius:24px 24px 0 0;
    padding:24px 20px 36px;
    box-sizing:border-box;
    border-top:1px solid rgba(255,255,255,0.08);
  }
  @media(min-width:560px){
    .ptm-container{
      max-width:460px;
      border-radius:20px;
      padding:32px 32px 36px;
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 32px 80px rgba(0,0,0,0.6);
    }
  }

  /* ── Drag handle (mobile) ── */
  .ptm-handle{
    width:40px;height:4px;
    background:rgba(255,255,255,0.2);
    border-radius:2px;
    margin:0 auto 20px;
  }
  @media(min-width:560px){.ptm-handle{display:none;}}

  /* ── Close button ── */
  .ptm-close{
    position:absolute;top:5px;right:15px;
    background:rgba(255,255,255,0.08);
    border:none;cursor:pointer;
    color:#f0f0f0;
    width:36px;height:36px;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    transition:background 0.2s;
    flex-shrink:0;
  }
  .ptm-close:hover{background:rgba(255,255,255,0.15);}

  /* ── Info banner ── */
  .ptm-banner{
    display:flex;align-items:flex-start;gap:10px;
    background:rgba(255,107,107,0.1);
    border:1px solid rgba(255,107,107,0.25);
    border-radius:12px;
    padding:12px 14px;
    margin-bottom:22px;
    font-size:13px;
    color:#ffb3b3;
    line-height:1.55;
  }
  .ptm-banner strong{color:#ff6b6b;}
  .ptm-banner svg{flex-shrink:0;margin-top:2px;stroke:#ff6b6b;}

  /* ── Header ── */
  .ptm-header{margin-bottom:22px;padding-right:40px;}
  .ptm-header h3{
    font-size:22px;font-weight:700;
    margin:0 0 5px;color:#ffffff;
    line-height:1.2;
  }
  .ptm-header p{font-size:13px;color:rgba(255,255,255,0.45);margin:0;}

  /* ── Form layout ── */
  .ptm-form{display:flex;flex-direction:column;gap:16px;}
  .ptm-group{display:flex;flex-direction:column;gap:6px;}
  .ptm-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  @media(max-width:400px){.ptm-row{grid-template-columns:1fr;}}

  /* ── Labels ── */
  .ptm-group label{
    font-size:12px;font-weight:600;
    color:rgba(255,255,255,0.55);
    letter-spacing:0.04em;
    text-transform:uppercase;
  }
  .ptm-group label span{color:#ff6b6b;}

  /* ── Inputs & selects ── */
  .ptm-group input,
  .ptm-group select{
    width:100%;
    padding:14px 16px;
    border:1.5px solid rgba(255,255,255,0.1);
    border-radius:12px;
    font-size:15px;
    font-family:'Poppins',sans-serif;
    background:rgba(255,255,255,0.05);
    color:#f0f0f0;
    box-sizing:border-box;
    transition:border-color 0.2s,background 0.2s;
    -webkit-appearance:none;
    appearance:none;
  }
  .ptm-group select{
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat:no-repeat;
    background-position:right 14px center;
    padding-right:40px;
  }
  .ptm-group input::placeholder{color:rgba(255,255,255,0.25);}
  .ptm-group select option{background:#1e1e1e;color:#f0f0f0;}
  .ptm-group input:focus,
  .ptm-group select:focus{
    outline:none;
    border-color:#ff6b6b;
    background:rgba(255,107,107,0.06);
  }
  .ptm-group input[type="date"]{color-scheme:dark;}
  .ptm-group input.ptm-invalid,
  .ptm-group select.ptm-invalid{border-color:#ff4444;}
  .ptm-group select:disabled{opacity:0.4;cursor:not-allowed;}

  /* ── Error text ── */
  .ptm-err{font-size:11.5px;color:#ff6b6b;min-height:14px;line-height:1.4;}

  /* ── Submit button ── */
  .ptm-submit{
    margin-top:4px;
    padding:16px;
    background:linear-gradient(135deg,#ff6b6b,#ff4444);
    color:#fff;
    border:none;
    border-radius:14px;
    font-size:16px;
    font-weight:700;
    font-family:'Poppins',sans-serif;
    cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:10px;
    width:100%;
    letter-spacing:0.01em;
    transition:opacity 0.2s,transform 0.15s;
    box-shadow:0 8px 24px rgba(255,107,107,0.3);
  }
  .ptm-submit:hover{opacity:0.9;transform:translateY(-1px);}
  .ptm-submit:active{transform:translateY(0);}
  .ptm-submit:disabled{opacity:0.45;cursor:not-allowed;transform:none;box-shadow:none;}

  /* ── Spinner ── */
  .ptm-spinner{width:22px;height:22px;animation:ptm-spin 0.8s linear infinite;}
  .ptm-spinner circle{stroke:#fff;stroke-linecap:round;stroke-dasharray:60;stroke-dashoffset:20;}
  @keyframes ptm-spin{to{transform:rotate(360deg);}}

  /* ── Success state ── */
  .ptm-success{text-align:center;padding:24px 0 12px;}
  .ptm-success-icon{
    font-size:56px;line-height:1;
    margin-bottom:16px;
    color:#22c55e;
  }
  .ptm-success h4{font-size:20px;font-weight:700;color:#fff;margin:0 0 10px;}
  .ptm-success p{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 6px;}
  .ptm-payment-id{
    font-size:11px;color:rgba(255,255,255,0.3);
    word-break:break-all;margin-top:8px;
  }

  /* ── Error state ── */
  .ptm-error{text-align:center;padding:24px 0 12px;}
  .ptm-error-icon{font-size:56px;line-height:1;margin-bottom:16px;color:#ff4444;}
  .ptm-error h4{font-size:20px;font-weight:700;color:#fff;margin:0 0 10px;}
  .ptm-error p{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 6px;}
  .ptm-error a{color:#ff6b6b;}
  .ptm-retry-btn{
    margin-top:16px;padding:13px 32px;
    background:rgba(255,255,255,0.08);
    border:1px solid rgba(255,255,255,0.15);
    color:#fff;border-radius:10px;
    font-size:14px;font-weight:600;
    font-family:'Poppins',sans-serif;
    cursor:pointer;transition:background 0.2s;
  }
  .ptm-retry-btn:hover{background:rgba(255,255,255,0.14);}
</style>`;

    document.body.insertAdjacentHTML('beforeend', html);
    modalEl = document.getElementById('ptModal');

    // Bind internal events
    document.getElementById('ptModalClose').addEventListener('click', closeModal);
    document.getElementById('ptModalBackdrop').addEventListener('click', closeModal);
    document.getElementById('ptLocation').addEventListener('change', onLocationChange);
    document.getElementById('ptForm').addEventListener('submit', onFormSubmit);
    document.getElementById('ptRetryBtn').addEventListener('click', resetToForm);
    document.getElementById('ptName').addEventListener('input', function() { // ← ADD
  this.value = this.value.replace(/\b\w/g, function(c) { return c.toUpperCase(); }); // ← ADD
}); // ← ADD

    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('ptDate').setAttribute('min', today);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeModal();
    });
  }

  /* ─── Bind all [data-paid-trial-trigger] elements ───────────────── */
  function bindTriggers() {
    document.querySelectorAll('[data-paid-trial-trigger]').forEach(function (el) {
      el.addEventListener('click', openModal);
    });
  }

  /* ─── Open / Close ──────────────────────────────────────────────── */
  function openModal() {
    isOpen = true;
    modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(function () { document.getElementById('ptName').focus(); }, 100);
  }

  function closeModal() {
    isOpen = false;
    modalEl.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ─── Location → populate time slots ────────────────────────────── */
  function onLocationChange() {
    const loc = this.value;
    const timeSelect = document.getElementById('ptTime');
    timeSelect.innerHTML = '<option value="" disabled selected>Select a time slot</option>';
    (TIME_SLOTS[loc] || []).forEach(function (slot) {
      const opt = document.createElement('option');
      opt.value = slot;
      opt.textContent = slot;
      timeSelect.appendChild(opt);
    });
    timeSelect.disabled = false;
  }

  /* ─── Form validation ────────────────────────────────────────────── */
  function validateForm() {
    let valid = true;
    const fields = [
      { id: 'ptName',     errId: 'ptNameErr',     msg: 'Please enter your name',         check: v => v.trim().length >= 2 },
      { id: 'ptEmail',    errId: 'ptEmailErr',     msg: 'Please enter a valid email',     check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
      { id: 'ptPhone',    errId: 'ptPhoneErr',     msg: 'Please enter a 10-digit number', check: v => /^[0-9]{10}$/.test(v) },
      { id: 'ptLocation', errId: 'ptLocationErr',  msg: 'Please select a location',       check: v => v !== '' },
      { id: 'ptDate',     errId: 'ptDateErr',      msg: 'Please select a date',           check: v => v !== '' },
      { id: 'ptTime',     errId: 'ptTimeErr',      msg: 'Please select a time slot',      check: v => v !== '' }
    ];

    fields.forEach(function (f) {
      const el = document.getElementById(f.id);
      const err = document.getElementById(f.errId);
      if (!f.check(el.value)) {
        err.textContent = f.msg;
        el.classList.add('ptm-invalid');
        valid = false;
      } else {
        err.textContent = '';
        el.classList.remove('ptm-invalid');
      }
    });
    return valid;
  }

  /* ─── Form submit → validate → Razorpay ─────────────────────────── */
  function onFormSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    const formData = {
      name:     document.getElementById('ptName').value.trim(),
      email:    document.getElementById('ptEmail').value.trim(),
      phone:    document.getElementById('ptPhone').value.trim(),
      location: document.getElementById('ptLocation').value,
      date:     (function() { var d = new Date(document.getElementById('ptDate').value + 'T00:00:00'); return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear().toString().slice(-2); })(),
      time:     document.getElementById('ptTime').value,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    openRazorpay(formData);
  }

  /* ─── Razorpay ───────────────────────────────────────────────────── */
  function openRazorpay(formData) {
    if (typeof Razorpay === 'undefined') {
      showError('Payment gateway not loaded. Please refresh and try again.');
      return;
    }

    setSubmitting(true);

    const options = {
      key:         CONFIG.razorpay.keyId,
      amount:      CONFIG.razorpay.amount,
      currency:    CONFIG.razorpay.currency,
      name:        CONFIG.razorpay.name,
      description: CONFIG.razorpay.description,
      image:       CONFIG.razorpay.image,
      prefill: {
        name:    formData.name,
        email:   formData.email,
        contact: formData.phone
      },
      notes: {
        location: formData.location,
        date:     formData.date,
        time:     formData.time
      },
      theme: CONFIG.razorpay.theme,

      handler: function (response) {
        // Payment success
        const paymentId = response.razorpay_payment_id;
        onPaymentSuccess(formData, paymentId);
      },

      modal: {
        ondismiss: function () {
          // User closed Razorpay without paying — just re-enable the button
          setSubmitting(false);
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      setSubmitting(false);
      showError('Payment failed: ' + (response.error.description || 'Unknown error'));
    });

    rzp.open();
  }

  /* ─── After successful payment ──────────────────────────────────── */
  function onPaymentSuccess(formData, paymentId) {
    const enriched = Object.assign({}, formData, {
      paymentId: paymentId,
      amount:    '₹2,000',
      status:    'Paid'
    });

    // Run both in parallel — failure of one won't block the other
    sendEmail(enriched);
    logToSheets(enriched);

    showSuccess(paymentId);
  }

  /* ─── EmailJS — single email, Harish in BCC ─────────────────────── */
  function sendEmail(data) {
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return;
    }

    const templateParams = {
  to_name:    data.name,
  to_email:   data.email,
  bcc_email:  CONFIG.emailJS.bccEmail,
  location:   data.location,
  address:    data.location === 'Lajpat Nagar'
                ? 'B-32, 3rd Floor, opposite Defence Colony, Lajpat Nagar, New Delhi 110024'
                : '241, 2nd Floor, Westend Marg, near Garden of Five Senses, Saket, New Delhi 110030',
  maps_link:  data.location === 'Lajpat Nagar'
                ? 'https://maps.app.goo.gl/iGKT4JykAP11F5HE7'
                : 'https://maps.app.goo.gl/iDnR6GBrYRXK6hH96',
  date:       data.date,
  time:       data.time,
  phone:      data.phone,
  payment_id: data.paymentId,
  amount:     data.amount,
  timestamp:  data.timestamp
};
console.log('📧 EMAIL DEBUG:', JSON.stringify(templateParams));
   emailjs.send(
  CONFIG.emailJS.serviceId,
  CONFIG.emailJS.templateId,
  templateParams
)
    .then(function () {
      console.log('✅ Trial booking email sent');
    })
    .catch(function (err) {
      console.error('❌ EmailJS error:', err);
    });
  }

  /* ─── Google Sheets via Apps Script ─────────────────────────────── */
  function logToSheets(data) {
    const params = new URLSearchParams({
      formType:  'paid-trial',
      name:      data.name,
      email:     data.email,
      phone:     data.phone,
      location:  data.location,
      date:      data.date,
      time:      data.time,
      paymentId: data.paymentId,
      amount:    data.amount,
      status:    data.status,
      timestamp: data.timestamp,
      remarks:   ''   // Harish fills this manually in the sheet
    });

    fetch(CONFIG.sheets.url + '?' + params.toString(), { method: 'GET' })
      .then(function () { console.log('✅ Sheets entry logged'); })
      .catch(function (err) { console.error('❌ Sheets error:', err); });
  }

  /* ─── UI helpers ─────────────────────────────────────────────────── */
  function setSubmitting(state) {
    const btn    = document.getElementById('ptSubmitBtn');
    const text   = btn.querySelector('.ptm-btn-text');
    const loader = btn.querySelector('.ptm-btn-loader');
    btn.disabled       = state;
    text.style.display  = state ? 'none' : 'inline';
    loader.style.display = state ? 'inline-flex' : 'none';
  }

  function showSuccess(paymentId) {
    document.getElementById('ptForm').style.display = 'none';
    document.getElementById('ptError').style.display = 'none';
    document.getElementById('ptSuccess').style.display = 'block';
    document.getElementById('ptPaymentIdDisplay').textContent = 'Payment ID: ' + paymentId;
  }

  function showError(msg) {
    setSubmitting(false);
    document.getElementById('ptForm').style.display = 'none';
    document.getElementById('ptSuccess').style.display = 'none';
    const errEl = document.getElementById('ptError');
    errEl.style.display = 'block';
    if (msg) document.getElementById('ptErrorMsg').textContent = msg;
  }

  function resetToForm() {
    document.getElementById('ptError').style.display = 'none';
    document.getElementById('ptSuccess').style.display = 'none';
    document.getElementById('ptForm').style.display = 'flex';
    setSubmitting(false);
  }

  /* ─── Boot ───────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();