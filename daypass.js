/* ============================================================================
   daypass.js — Grip & Grab
   Day Pass Booking Module
   ----------------------------------------------------------------------------
   Self-contained IIFE. Drop this file after script.js in HTML.
   Triggers on any element with: data-daypass-trigger

   Reads from script.js:
     window.CENTER_CONFIG — availability config (shared with membership modal)
   ============================================================================ */

(function () {
  'use strict';

  const CONFIG = {
    razorpay: {
      keyId:       'rzp_live_ShEMzudk4Y6hrO',
      amount:      100000,
      currency:    'INR',
      name:        'Grip&Grab',
      description: 'Day Pass',
      image:       '',
      theme:       { color: '#ff6b6b' },
    },
    sheets: {
      url: 'https://script.google.com/macros/s/AKfycbyZHDnLUtQtCL5rkP8VCS4qvfv0lNP5uto-DEWvhVcIu3T1ndd-XSmk6ZP6RgUJPmbIuQ/exec',
    },
  };

  let modalEl        = null;
  let isOpen         = false;
  let selectedCenter = null;

  /* ── INIT ── */
  function init() {
    injectModal();
    bindTriggers();
  }

  /* ── MODAL HTML ── */
  function injectModal() {
    const html = `
<div id="dpModal" class="dpm-overlay" role="dialog" aria-modal="true" aria-labelledby="dpModalTitle" style="display:none;">
  <div class="dpm-backdrop" id="dpModalBackdrop"></div>
  <div class="dpm-container">
    <div class="dpm-handle"></div>
    <button class="dpm-close" id="dpModalClose" aria-label="Close" type="button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- STEP 1: Center select -->
    <div id="dpStepCenter">
      <div class="dpm-header">
        <h3 id="dpModalTitle">Get Your Day Pass</h3>
        <p>Choose your comfortable day and time — walk in anytime during gym hours.</p>
      </div>
      <div class="dpm-center-cards">
        <div class="dpm-center-card" data-center="Lajpat Nagar" tabindex="0" role="button" aria-label="Select Lajpat Nagar">
          <div class="dpm-center-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span class="dpm-center-card__name">Grip&amp;Grab Lajpat Nagar</span>
        </div>
        <div class="dpm-center-card" data-center="Saket" tabindex="0" role="button" aria-label="Select Saket">
          <div class="dpm-center-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span class="dpm-center-card__name">Grip&amp;Grab Saket</span>
        </div>
      </div>
    </div>

    <!-- STEP FULL -->
    <div id="dpStepFull" style="display:none;">
      <div class="dpm-full-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
      </div>
      <h4 class="dpm-full-title" id="dpFullTitle"></h4>
      <p  class="dpm-full-msg"   id="dpFullMsg"></p>
      <button class="dpm-alt-btn" id="dpAltBtn" type="button"></button>
      <div id="nl-dpm"></div>
      <button class="dpm-back-link" id="dpBackFromFull" type="button">← Choose a different center</button>
    </div>

    <!-- STEP 2: Form -->
    <div id="dpStepForm" style="display:none;">
      <button class="dpm-back-link" id="dpBackFromForm" type="button">← Change center</button>

      <div class="dpm-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
        </svg>
        <span>Valid only for the selected date. Walk in anytime during your chosen session. Non-refundable &amp; non-cancellable.</span>
      </div>

      <div class="dpm-header">
        <h3 id="dpFormTitle">Day Pass — Grip&amp;Grab</h3>
        <p>₹1,000 &nbsp;·&nbsp; Monday to Saturday</p>
      </div>

      <form id="dpForm" class="dpm-form" novalidate autocomplete="on">
        <div class="dpm-group">
          <label for="dpName">Full Name <span>*</span></label>
          <input type="text" id="dpName" name="name" placeholder="Your full name" required autocomplete="name" minlength="2">
          <span class="dpm-err" id="dpNameErr"></span>
        </div>
        <div class="dpm-group">
          <label for="dpEmail">Email Address <span>*</span></label>
          <input type="email" id="dpEmail" name="email" placeholder="your@email.com" required autocomplete="email">
          <span class="dpm-err" id="dpEmailErr"></span>
        </div>
        <div class="dpm-group">
          <label for="dpPhone">Phone Number <span>*</span></label>
          <input type="tel" id="dpPhone" name="phone" placeholder="10-digit mobile number" required autocomplete="tel" pattern="[0-9]{10}">
          <span class="dpm-err" id="dpPhoneErr"></span>
        </div>
        <input type="hidden" id="dpLocation" name="location">
        <div class="dpm-group">
          <label for="dpDate">Date (Mon–Sat) <span>*</span></label>
          <input type="date" id="dpDate" name="date" required>
          <span class="dpm-err" id="dpDateErr"></span>
        </div>
        <div class="dpm-group">
          <label for="dpSession">Session <span>*</span></label>
          <select id="dpSession" name="session" required>
            <option value="" disabled selected>Select a session</option>
            <option value="Morning (7:30 AM – 11:30 AM)">Morning — 7:30 AM to 11:30 AM</option>
            <option value="Evening (5:30 PM – 9:00 PM)">Evening — 5:30 PM to 9:00 PM</option>
          </select>
          <span class="dpm-err" id="dpSessionErr"></span>
        </div>
        <button type="submit" class="dpm-submit" id="dpSubmitBtn">
          <span class="dpm-btn-text">Pay ₹1,000 &amp; Get Day Pass</span>
          <span class="dpm-btn-loader" style="display:none;">
            <svg class="dpm-spinner" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
            </svg>
          </span>
        </button>
      </form>
    </div>

    <!-- Success -->
    <div id="dpSuccess" class="dpm-success" style="display:none;">
      <div class="dpm-success-icon">✓</div>
      <h4>Day Pass Confirmed!</h4>
      <p>Payment successful. A confirmation has been sent to your email.</p>
      <p class="dpm-payment-id" id="dpPaymentIdDisplay"></p>
    </div>

    <!-- Error -->
    <div id="dpError" class="dpm-error" style="display:none;">
      <div class="dpm-error-icon">✕</div>
      <h4>Payment Failed</h4>
      <p id="dpErrorMsg">Something went wrong. Please try again.</p>
      <button class="dpm-retry-btn" id="dpRetryBtn" type="button">Try Again</button>
    </div>

  </div>
</div>

<style>
  .dpm-overlay{position:fixed;inset:0;z-index:10002;display:flex;align-items:flex-end;justify-content:center;}
  @media(min-width:560px){.dpm-overlay{align-items:center;}}
  .dpm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}
  .dpm-container{position:relative;background:#141414;color:#f0f0f0;font-family:'Poppins',sans-serif;width:100%;max-width:100%;max-height:93dvh;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;border-radius:24px 24px 0 0;padding:24px 20px 36px;box-sizing:border-box;border-top:1px solid rgba(255,255,255,0.08);}
  @media(min-width:560px){.dpm-container{max-width:460px;border-radius:20px;padding:32px 32px 36px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 32px 80px rgba(0,0,0,0.6);}}
  .dpm-handle{width:40px;height:4px;background:rgba(255,255,255,0.18);border-radius:2px;margin:0 auto 20px;}
  @media(min-width:560px){.dpm-handle{display:none;}}
  .dpm-close{position:absolute;top:8px;right:14px;background:rgba(255,255,255,0.08);border:none;cursor:pointer;color:#f0f0f0;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 0.2s;}
  .dpm-close:hover{background:rgba(255,255,255,0.16);}
  .dpm-center-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;}
  .dpm-center-card{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;padding:22px 16px;cursor:pointer;text-align:center;transition:border-color 0.2s,background 0.2s;display:flex;flex-direction:column;align-items:center;gap:10px;}
  .dpm-center-card:hover{border-color:rgba(255,107,107,0.5);background:rgba(255,107,107,0.06);}
  .dpm-center-card--selected{border-color:#ff6b6b!important;background:rgba(255,107,107,0.1)!important;}
  .dpm-center-card__icon{color:rgba(255,255,255,0.45);}
  .dpm-center-card__name{font-size:14px;font-weight:600;color:#fff;line-height:1.3;}
  #dpStepFull{text-align:center;padding:12px 0 8px;}
  .dpm-full-icon{width:72px;height:72px;border-radius:50%;background:rgba(255,180,0,0.1);border:1.5px solid rgba(255,180,0,0.25);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#f7d794;}
  .dpm-full-title{font-size:18px;font-weight:700;color:#fff;margin:0 0 10px;line-height:1.3;}
  .dpm-full-msg{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 22px;line-height:1.7;}
  .dpm-alt-btn{display:block;width:100%;padding:14px;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;font-size:14px;font-weight:700;font-family:'Poppins',sans-serif;border:none;border-radius:14px;cursor:pointer;transition:opacity 0.2s;margin-bottom:12px;}
  .dpm-alt-btn:hover{opacity:0.9;}
  .dpm-notify-btn{display:block;width:100%;padding:13px;border:1.5px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;font-family:'Poppins',sans-serif;border-radius:14px;text-align:center;text-decoration:none;margin-bottom:12px;transition:border-color 0.2s,color 0.2s;box-sizing:border-box;}
  .dpm-notify-btn:hover{border-color:rgba(255,255,255,0.3);color:#fff;}
  .dpm-back-link{background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.45);font-size:13px;font-family:'Poppins',sans-serif;padding:0;margin-bottom:16px;display:block;transition:color 0.2s;}
  .dpm-back-link:hover{color:rgba(255,255,255,0.75);}
  .dpm-banner{display:flex;align-items:flex-start;gap:10px;background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.2);border-radius:12px;padding:12px 14px;margin-bottom:20px;font-size:12.5px;color:#ffb3b3;line-height:1.6;}
  .dpm-banner svg{flex-shrink:0;margin-top:2px;stroke:#ff6b6b;}
  .dpm-header{margin-bottom:20px;padding-right:40px;}
  .dpm-header h3{font-size:22px;font-weight:700;margin:0 0 5px;color:#fff;line-height:1.2;}
  .dpm-header p{font-size:13px;color:rgba(255,255,255,0.45);margin:0;}
  .dpm-form{display:flex;flex-direction:column;gap:16px;}
  .dpm-group{display:flex;flex-direction:column;gap:6px;}
  .dpm-group label{font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:0.04em;text-transform:uppercase;}
  .dpm-group label span{color:#ff6b6b;}
  .dpm-group input,.dpm-group select{width:100%;padding:14px 16px;border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;font-size:15px;font-family:'Poppins',sans-serif;background:rgba(255,255,255,0.05);color:#f0f0f0;box-sizing:border-box;transition:border-color 0.2s,background 0.2s;-webkit-appearance:none;appearance:none;}
  .dpm-group select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:40px;}
  .dpm-group input::placeholder{color:rgba(255,255,255,0.25);}
  .dpm-group select option{background:#1e1e1e;color:#f0f0f0;}
  .dpm-group input:focus,.dpm-group select:focus{outline:none;border-color:#ff6b6b;background:rgba(255,107,107,0.06);}
  .dpm-group input[type="date"]{color-scheme:dark;}
  .dpm-group input.dpm-invalid,.dpm-group select.dpm-invalid{border-color:#ff4444;}
  .dpm-err{font-size:11.5px;color:#ff6b6b;min-height:14px;line-height:1.4;}
  .dpm-submit{margin-top:4px;padding:16px;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;border:none;border-radius:14px;font-size:16px;font-weight:700;font-family:'Poppins',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;letter-spacing:0.01em;transition:opacity 0.2s,transform 0.15s;box-shadow:0 8px 24px rgba(255,107,107,0.3);}
  .dpm-submit:hover{opacity:0.9;transform:translateY(-1px);}
  .dpm-submit:active{transform:translateY(0);}
  .dpm-submit:disabled{opacity:0.45;cursor:not-allowed;transform:none;box-shadow:none;}
  .dpm-spinner{width:22px;height:22px;animation:dpm-spin 0.8s linear infinite;}
  .dpm-spinner circle{stroke:#000;stroke-linecap:round;stroke-dasharray:60;stroke-dashoffset:20;}
  @keyframes dpm-spin{to{transform:rotate(360deg);}}
  .dpm-success{text-align:center;padding:24px 0 12px;}
  .dpm-success-icon{font-size:56px;line-height:1;margin-bottom:16px;color:#22c55e;}
  .dpm-success h4{font-size:20px;font-weight:700;color:#fff;margin:0 0 10px;}
  .dpm-success p{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 6px;}
  .dpm-payment-id{font-size:11px;color:rgba(255,255,255,0.3);word-break:break-all;margin-top:8px;}
  .dpm-error{text-align:center;padding:24px 0 12px;}
  .dpm-error-icon{font-size:56px;line-height:1;margin-bottom:16px;color:#ff4444;}
  .dpm-error h4{font-size:20px;font-weight:700;color:#fff;margin:0 0 10px;}
  .dpm-error p{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 6px;}
  .dpm-retry-btn{margin-top:16px;padding:13px 32px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:10px;font-size:14px;font-weight:600;font-family:'Poppins',sans-serif;cursor:pointer;transition:background 0.2s;}
  .dpm-retry-btn:hover{background:rgba(255,255,255,0.14);}
</style>`;

    document.body.insertAdjacentHTML('beforeend', html);
    modalEl = document.getElementById('dpModal');
    bindModalEvents();
  }

  /* ── STEP NAVIGATION ── */
  function showStep(step) {
    document.getElementById('dpStepCenter').style.display = step === 'center'  ? 'block' : 'none';
    document.getElementById('dpStepFull').style.display   = step === 'full'    ? 'block' : 'none';
    document.getElementById('dpStepForm').style.display   = step === 'form'    ? 'block' : 'none';
    document.getElementById('dpSuccess').style.display    = step === 'success' ? 'block' : 'none';
    document.getElementById('dpError').style.display      = step === 'error'   ? 'block' : 'none';
  }

  /* ── CENTER SELECTION ── */
  function onCenterSelect(shortName) {
    selectedCenter = shortName;

    document.querySelectorAll('.dpm-center-card').forEach(function (c) {
      c.classList.toggle('dpm-center-card--selected', c.dataset.center === shortName);
    });

    var fullName = shortName === 'Saket' ? 'Grip&Grab Saket' : 'Grip&Grab Lajpat Nagar';
    var config   = window.CENTER_CONFIG && window.CENTER_CONFIG[fullName];

    if (config && !config.daypassAvailable) {
      var altFull  = config.alternateCenter;
      var altShort = altFull === 'Grip&Grab Saket' ? 'Saket' : 'Lajpat Nagar';

      document.getElementById('dpFullTitle').textContent =
        'Day passes at Grip&Grab ' + shortName + ' are currently unavailable';
      document.getElementById('dpFullMsg').textContent =
        'We\'re not offering day passes at Grip&Grab ' + shortName + ' right now. ' +
        'You can get a day pass at ' + altFull + ' — spots are available there.';

      var altBtn = document.getElementById('dpAltBtn');
      altBtn.textContent = 'Get day pass at ' + altFull;
      altBtn.onclick = function () { onCenterSelect(altShort); };

      showStep('full');
      window.NotifyLeads && window.NotifyLeads.render('nl-dpm', 'Day Pass', 'Grip&Grab ' + shortName);
    } else {
      document.getElementById('dpFormTitle').textContent = 'Day Pass — Grip&Grab ' + shortName;
      document.getElementById('dpLocation').value        = shortName;
      showStep('form');
    }
  }

  /* ── EVENT BINDING ── */
  function bindTriggers() {
    document.querySelectorAll('[data-daypass-trigger]').forEach(function (el) {
      el.addEventListener('click', openModal);
    });
  }

  function bindModalEvents() {
    document.getElementById('dpModalClose').addEventListener('click', closeModal);
    document.getElementById('dpModalBackdrop').addEventListener('click', closeModal);
    document.getElementById('dpForm').addEventListener('submit', onFormSubmit);
    document.getElementById('dpRetryBtn').addEventListener('click', resetToForm);
    document.getElementById('dpBackFromFull').addEventListener('click', function () { showStep('center'); });
    document.getElementById('dpBackFromForm').addEventListener('click', function () { showStep('center'); });

    document.querySelectorAll('.dpm-center-card').forEach(function (card) {
      card.addEventListener('click', function () { onCenterSelect(card.dataset.center); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCenterSelect(card.dataset.center); }
      });
    });

    document.getElementById('dpName').addEventListener('input', function () {
      this.value = this.value.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    });

    var dateInput = document.getElementById('dpDate');
    dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);
    dateInput.addEventListener('change', function () {
      var d = new Date(this.value + 'T00:00:00');
      if (d.getDay() === 0) {
        document.getElementById('dpDateErr').textContent = 'Day passes are not available on Sundays.';
        this.value = '';
        this.classList.add('dpm-invalid');
      } else {
        document.getElementById('dpDateErr').textContent = '';
        this.classList.remove('dpm-invalid');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeModal();
    });
  }

  /* ── OPEN / CLOSE ── */
  function openModal() {
    isOpen         = true;
    selectedCenter = null;
    modalEl.style.display        = 'flex';
    document.body.style.overflow = 'hidden';
    showStep('center');
  }

  function closeModal() {
    isOpen = false;
    modalEl.style.display        = 'none';
    document.body.style.overflow = '';
  }

  /* ── FORM VALIDATION ── */
  function validateForm() {
    var valid  = true;
    var fields = [
      { id: 'dpName',    errId: 'dpNameErr',    msg: 'Please enter your name',          check: function (v) { return v.trim().length >= 2; } },
      { id: 'dpEmail',   errId: 'dpEmailErr',   msg: 'Please enter a valid email',      check: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); } },
      { id: 'dpPhone',   errId: 'dpPhoneErr',   msg: 'Please enter a 10-digit number',  check: function (v) { return /^[0-9]{10}$/.test(v); } },
      { id: 'dpDate',    errId: 'dpDateErr',    msg: 'Please select a date (Mon–Sat)',  check: function (v) { if (!v) return false; var d = new Date(v + 'T00:00:00'); return d.getDay() !== 0; } },
      { id: 'dpSession', errId: 'dpSessionErr', msg: 'Please select a session',         check: function (v) { return v !== ''; } },
    ];

    fields.forEach(function (f) {
      var el  = document.getElementById(f.id);
      var err = document.getElementById(f.errId);
      if (!f.check(el.value)) {
        err.textContent = f.msg;
        el.classList.add('dpm-invalid');
        valid = false;
      } else {
        err.textContent = '';
        el.classList.remove('dpm-invalid');
      }
    });

    return valid;
  }

  /* ── FORM SUBMIT → RAZORPAY ── */
  function onFormSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    var rawDate = document.getElementById('dpDate').value;
    var d       = new Date(rawDate + 'T00:00:00');
    var formData = {
      name:      document.getElementById('dpName').value.trim(),
      email:     document.getElementById('dpEmail').value.trim(),
      phone:     document.getElementById('dpPhone').value.trim(),
      location:  document.getElementById('dpLocation').value,
      date:      d.getDate().toString().padStart(2, '0') + '/' +
                 (d.getMonth() + 1).toString().padStart(2, '0') + '/' +
                 d.getFullYear().toString().slice(-2),
      session:   document.getElementById('dpSession').value,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };

    openRazorpay(formData);
  }

  /* ── RAZORPAY ── */
  function openRazorpay(formData) {
    if (typeof Razorpay === 'undefined') {
      showError('Payment gateway not loaded. Please refresh and try again.');
      return;
    }

    setSubmitting(true);

    var rzp = new Razorpay({
      key:         CONFIG.razorpay.keyId,
      amount:      CONFIG.razorpay.amount,
      currency:    CONFIG.razorpay.currency,
      name:        CONFIG.razorpay.name,
      description: CONFIG.razorpay.description,
      image:       CONFIG.razorpay.image,
      prefill:     { name: formData.name, email: formData.email, contact: formData.phone },
      notes:       { location: formData.location, date: formData.date, session: formData.session },
      theme:       CONFIG.razorpay.theme,
      handler: function (response) {
        onPaymentSuccess(formData, response.razorpay_payment_id, response.razorpay_order_id || '');
      },
      modal: { ondismiss: function () { setSubmitting(false); } },
    });

    rzp.on('payment.failed', function (response) {
      setSubmitting(false);
      showError('Payment failed: ' + (response.error.description || 'Unknown error'));
    });

    rzp.open();
  }

  /* ── PAYMENT SUCCESS ── */
  function onPaymentSuccess(formData, paymentId, orderId) {
    sendConfirmationEmail(formData, paymentId, orderId);
    logToSheets(formData, paymentId);
    showSuccess(paymentId);
  }

  function sendConfirmationEmail(formData, paymentId, orderId) {
    fetch('/api/send-email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:      formData.name,
        email:     formData.email,
        phone:     formData.phone,
        plan:      'day-pass',
        amount:    CONFIG.razorpay.amount,
        paymentId: paymentId,
        orderId:   orderId,
        location:  formData.location,
        date:      formData.date,
        time:      formData.session,
      }),
    })
      .then(function () { console.log('Day pass email sent.'); })
      .catch(function (err) { console.error('Email failed:', err); });
  }

  function logToSheets(formData, paymentId) {
    var params = new URLSearchParams({
      formType:  'day-pass',
      name:      formData.name,
      email:     formData.email,
      phone:     formData.phone,
      location:  formData.location,
      date:      formData.date,
      session:   formData.session,
      paymentId: paymentId,
      amount:    '₹1,000',
      status:    'Paid',
      timestamp: formData.timestamp,
      remarks:   '',
    });

    fetch(CONFIG.sheets.url + '?' + params.toString(), { method: 'GET' })
      .then(function () { console.log('Day pass logged to Sheets.'); })
      .catch(function (err) { console.error('Sheets log failed:', err); });
  }

  /* ── UI HELPERS ── */
  function setSubmitting(on) {
    var btn    = document.getElementById('dpSubmitBtn');
    var text   = btn.querySelector('.dpm-btn-text');
    var loader = btn.querySelector('.dpm-btn-loader');
    btn.disabled         = on;
    text.style.display   = on ? 'none' : 'flex';
    loader.style.display = on ? 'flex' : 'none';
  }

  function showSuccess(paymentId) {
    setSubmitting(false);
    document.getElementById('dpPaymentIdDisplay').textContent = 'Payment ID: ' + paymentId;
    showStep('success');
  }

  function showError(msg) {
    setSubmitting(false);
    document.getElementById('dpErrorMsg').textContent = msg || 'Something went wrong.';
    showStep('error');
  }

  function resetToForm() { showStep('form'); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
