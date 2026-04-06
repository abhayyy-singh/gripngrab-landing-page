/* ============================================================================
   trial-paid.js — Grip & Grab
   Paid Trial Class Booking Module
   ----------------------------------------------------------------------------
   Self-contained IIFE. Drop this file after script.js in HTML.
   Triggers on any element with: data-paid-trial-trigger

   Reads from script.js:
     window.TIME_SLOTS    — time slot data
     window.CENTER_CONFIG — availability config (shared with membership modal)
   ============================================================================ */

(function () {
  'use strict';

  /* ── CONFIG ── */
  const CONFIG = {
    razorpay: {
      keyId:       'rzp_test_RZG0vfhDgIuZYI',
      amount:      200000,
      currency:    'INR',
      name:        'Grip&Grab',
      description: 'Trial Class Booking',
      image:       '',
      theme:       { color: '#ff6b6b' },
    },
    sheets: {
      url: 'https://script.google.com/macros/s/AKfycbyZHDnLUtQtCL5rkP8VCS4qvfv0lNP5uto-DEWvhVcIu3T1ndd-XSmk6ZP6RgUJPmbIuQ/exec',
    },
  };

  /* ── Center addresses ── */
  const CENTER_ADDRESSES = {
    'Lajpat Nagar': 'B-32, 3rd Floor, opposite Defence Colony, Lajpat Nagar, New Delhi 110024',
    'Saket':        '241, 2nd Floor, Westend Marg, near Garden of Five Senses, Saket, New Delhi 110030',
  };

  /* ── State ── */
  let modalEl        = null;
  let isOpen         = false;
  let selectedCenter = null;

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    injectModal();
    bindTriggers();
  }

  /* ============================================================
     MODAL HTML
     ============================================================ */
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

    <!-- STEP 1: Center select -->
    <div id="ptStepCenter">
      <div class="ptm-header">
        <h3 id="ptModalTitle">Book Your Trial Class</h3>
        <p>Which center would you like to visit?</p>
      </div>
      <div class="ptm-center-cards">
        <div class="ptm-center-card" data-center="Lajpat Nagar" tabindex="0" role="button" aria-label="Select Lajpat Nagar">
          <div class="ptm-center-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span class="ptm-center-card__name">Grip&amp;Grab Lajpat Nagar</span>
        </div>
        <div class="ptm-center-card" data-center="Saket" tabindex="0" role="button" aria-label="Select Saket">
          <div class="ptm-center-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span class="ptm-center-card__name">Grip&amp;Grab Saket</span>
        </div>
      </div>
    </div>

    <!-- STEP FULL: Center at capacity -->
    <div id="ptStepFull" style="display:none;">
      <div class="ptm-full-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
      </div>
      <h4 class="ptm-full-title" id="ptFullTitle"></h4>
      <p  class="ptm-full-msg"   id="ptFullMsg"></p>
      <button class="ptm-alt-btn"   id="ptAltBtn"       type="button"></button>
      <button class="ptm-back-link" id="ptBackFromFull" type="button">← Choose a different center</button>
    </div>

    <!-- STEP 2: Form -->
    <div id="ptStepForm" style="display:none;">
      <button class="ptm-back-link" id="ptBackFromForm" type="button">← Change center</button>

      <div class="ptm-banner">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
        </svg>
        <span>Your trial fee of ₹2,000 is redeemable against any membership plan you choose.</span>
      </div>

      <div class="ptm-header">
        <h3 id="ptFormTitle">Book Your Trial Class</h3>
        <p>Pay ₹2,000 to reserve your spot.</p>
      </div>

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

        <input type="hidden" id="ptLocation" name="location">

        <div class="ptm-group">
          <label for="ptDate">Preferred Date <span>*</span></label>
          <input type="date" id="ptDate" name="date" required>
          <span class="ptm-err" id="ptDateErr"></span>
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
    </div>

    <!-- Success -->
    <div id="ptSuccess" class="ptm-success" style="display:none;">
      <div class="ptm-success-icon">✓</div>
      <h4>Trial Class Booked!</h4>
      <p>Payment successful. A confirmation has been sent to your email.</p>
      <p class="ptm-payment-id" id="ptPaymentIdDisplay"></p>
    </div>

    <!-- Error -->
    <div id="ptError" class="ptm-error" style="display:none;">
      <div class="ptm-error-icon">✕</div>
      <h4>Payment Failed</h4>
      <p id="ptErrorMsg">Something went wrong. Please try again.</p>
      <button class="ptm-retry-btn" id="ptRetryBtn" type="button">Try Again</button>
    </div>

  </div>
</div>

<style>
  .ptm-overlay{position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-end;justify-content:center;}
  @media(min-width:560px){.ptm-overlay{align-items:center;}}
  .ptm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}
  .ptm-container{position:relative;background:#141414;color:#f0f0f0;font-family:'Poppins',sans-serif;width:100%;max-width:100%;max-height:93dvh;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;border-radius:24px 24px 0 0;padding:24px 20px 36px;box-sizing:border-box;border-top:1px solid rgba(255,255,255,0.08);}
  @media(min-width:560px){.ptm-container{max-width:460px;border-radius:20px;padding:32px 32px 36px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 32px 80px rgba(0,0,0,0.6);}}
  .ptm-handle{width:40px;height:4px;background:rgba(255,255,255,0.18);border-radius:2px;margin:0 auto 20px;}
  @media(min-width:560px){.ptm-handle{display:none;}}
  .ptm-close{position:absolute;top:8px;right:14px;background:rgba(255,255,255,0.08);border:none;cursor:pointer;color:#f0f0f0;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 0.2s;}
  .ptm-close:hover{background:rgba(255,255,255,0.16);}
  .ptm-center-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;}
  .ptm-center-card{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;padding:22px 16px;cursor:pointer;text-align:center;transition:border-color 0.2s,background 0.2s;display:flex;flex-direction:column;align-items:center;gap:10px;}
  .ptm-center-card:hover{border-color:rgba(255,107,107,0.5);background:rgba(255,107,107,0.06);}
  .ptm-center-card--selected{border-color:#ff6b6b!important;background:rgba(255,107,107,0.1)!important;}
  .ptm-center-card__icon{color:rgba(255,255,255,0.45);}
  .ptm-center-card__name{font-size:14px;font-weight:600;color:#fff;line-height:1.3;}
  #ptStepFull{text-align:center;padding:12px 0 8px;}
  .ptm-full-icon{width:72px;height:72px;border-radius:50%;background:rgba(255,180,0,0.1);border:1.5px solid rgba(255,180,0,0.25);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#f7d794;}
  .ptm-full-title{font-size:18px;font-weight:700;color:#fff;margin:0 0 10px;line-height:1.3;}
  .ptm-full-msg{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 22px;line-height:1.7;}
  .ptm-alt-btn{display:block;width:100%;padding:14px;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;font-size:14px;font-weight:700;font-family:'Poppins',sans-serif;border:none;border-radius:14px;cursor:pointer;transition:opacity 0.2s;margin-bottom:12px;}
  .ptm-alt-btn:hover{opacity:0.9;}
  .ptm-back-link{background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.45);font-size:13px;font-family:'Poppins',sans-serif;padding:0;margin-bottom:16px;display:block;transition:color 0.2s;}
  .ptm-back-link:hover{color:rgba(255,255,255,0.75);}
  .ptm-banner{display:flex;align-items:flex-start;gap:10px;background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.25);border-radius:12px;padding:12px 14px;margin-bottom:22px;font-size:13px;color:#ffb3b3;line-height:1.55;}
  .ptm-banner svg{flex-shrink:0;margin-top:2px;stroke:#ff6b6b;}
  .ptm-header{margin-bottom:22px;padding-right:40px;}
  .ptm-header h3{font-size:22px;font-weight:700;margin:0 0 5px;color:#fff;line-height:1.2;}
  .ptm-header p{font-size:13px;color:rgba(255,255,255,0.45);margin:0;}
  .ptm-form{display:flex;flex-direction:column;gap:16px;}
  .ptm-group{display:flex;flex-direction:column;gap:6px;}
  .ptm-group label{font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:0.04em;text-transform:uppercase;}
  .ptm-group label span{color:#ff6b6b;}
  .ptm-group input,.ptm-group select{width:100%;padding:14px 16px;border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;font-size:15px;font-family:'Poppins',sans-serif;background:rgba(255,255,255,0.05);color:#f0f0f0;box-sizing:border-box;transition:border-color 0.2s,background 0.2s;-webkit-appearance:none;appearance:none;}
  .ptm-group select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:40px;}
  .ptm-group input::placeholder{color:rgba(255,255,255,0.25);}
  .ptm-group select option{background:#1e1e1e;color:#f0f0f0;}
  .ptm-group input:focus,.ptm-group select:focus{outline:none;border-color:#ff6b6b;background:rgba(255,107,107,0.06);}
  .ptm-group input[type="date"]{color-scheme:dark;}
  .ptm-group input.ptm-invalid,.ptm-group select.ptm-invalid{border-color:#ff4444;}
  .ptm-group select:disabled{opacity:0.4;cursor:not-allowed;}
  .ptm-err{font-size:11.5px;color:#ff6b6b;min-height:14px;line-height:1.4;}
  .ptm-submit{margin-top:4px;padding:16px;background:linear-gradient(135deg,#ff6b6b,#ff4444);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:700;font-family:'Poppins',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;letter-spacing:0.01em;transition:opacity 0.2s,transform 0.15s;box-shadow:0 8px 24px rgba(255,107,107,0.3);}
  .ptm-submit:hover{opacity:0.9;transform:translateY(-1px);}
  .ptm-submit:active{transform:translateY(0);}
  .ptm-submit:disabled{opacity:0.45;cursor:not-allowed;transform:none;box-shadow:none;}
  .ptm-spinner{width:22px;height:22px;animation:ptm-spin 0.8s linear infinite;}
  .ptm-spinner circle{stroke:#fff;stroke-linecap:round;stroke-dasharray:60;stroke-dashoffset:20;}
  @keyframes ptm-spin{to{transform:rotate(360deg);}}
  .ptm-success{text-align:center;padding:24px 0 12px;}
  .ptm-success-icon{font-size:56px;line-height:1;margin-bottom:16px;color:#22c55e;}
  .ptm-success h4{font-size:20px;font-weight:700;color:#fff;margin:0 0 10px;}
  .ptm-success p{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 6px;}
  .ptm-payment-id{font-size:11px;color:rgba(255,255,255,0.3);word-break:break-all;margin-top:8px;}
  .ptm-error{text-align:center;padding:24px 0 12px;}
  .ptm-error-icon{font-size:56px;line-height:1;margin-bottom:16px;color:#ff4444;}
  .ptm-error h4{font-size:20px;font-weight:700;color:#fff;margin:0 0 10px;}
  .ptm-error p{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 6px;}
  .ptm-retry-btn{margin-top:16px;padding:13px 32px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:10px;font-size:14px;font-weight:600;font-family:'Poppins',sans-serif;cursor:pointer;transition:background 0.2s;}
  .ptm-retry-btn:hover{background:rgba(255,255,255,0.14);}
</style>`;

    document.body.insertAdjacentHTML('beforeend', html);
    modalEl = document.getElementById('ptModal');
    bindModalEvents();
  }

  /* ============================================================
     STEP NAVIGATION
     ============================================================ */
  function showStep(step) {
    document.getElementById('ptStepCenter').style.display = step === 'center'  ? 'block' : 'none';
    document.getElementById('ptStepFull').style.display   = step === 'full'    ? 'block' : 'none';
    document.getElementById('ptStepForm').style.display   = step === 'form'    ? 'block' : 'none';
    document.getElementById('ptSuccess').style.display    = step === 'success' ? 'block' : 'none';
    document.getElementById('ptError').style.display      = step === 'error'   ? 'block' : 'none';
  }

  /* ============================================================
     CENTER SELECTION
     ============================================================ */
  function onCenterSelect(shortName) {
    selectedCenter = shortName;

    document.querySelectorAll('.ptm-center-card').forEach(function (c) {
      c.classList.toggle('ptm-center-card--selected', c.dataset.center === shortName);
    });

    var fullName = shortName === 'Saket' ? 'Grip&Grab Saket' : 'Grip&Grab Lajpat Nagar';
    var config   = window.CENTER_CONFIG && window.CENTER_CONFIG[fullName];

    if (config && !config.available) {
      var altFull  = config.alternateCenter;
      var altShort = altFull === 'Grip&Grab Saket' ? 'Saket' : 'Lajpat Nagar';

      document.getElementById('ptFullTitle').textContent =
        'Grip&Grab ' + shortName + ' trials are currently full';
      document.getElementById('ptFullMsg').textContent =
        'We\'re not taking new trial bookings at Grip&Grab ' + shortName + ' right now. ' +
        'You can book your trial at ' + altFull + ' — spots are available there.';

      var altBtn = document.getElementById('ptAltBtn');
      altBtn.textContent = 'Book trial at ' + altFull;
      altBtn.onclick = function () { onCenterSelect(altShort); };

      showStep('full');
    } else {
      document.getElementById('ptFormTitle').textContent    = 'Book Trial — Grip&Grab ' + shortName;
      document.getElementById('ptLocation').value           = shortName;
      // document.getElementById('ptAddressDisplay').value     = CENTER_ADDRESSES[shortName] || '';
      populateTimeSlots(shortName);
      showStep('form');
    }
  }

  /* ============================================================
     TIME SLOTS
     ============================================================ */
  function populateTimeSlots(shortName) {
    var timeSelect = document.getElementById('ptTime');
    var slotKey    = shortName === 'Saket' ? 'Grip&Grab Saket' : 'Grip&Grab Lajpat Nagar';
    var slots      = (window.TIME_SLOTS && window.TIME_SLOTS[slotKey]) || {};
    var allSlots   = (slots.morning || []).concat(slots.evening || []);

    timeSelect.innerHTML = '<option value="" disabled selected>Select a time slot</option>';

    if (allSlots.length) {
      allSlots.forEach(function (slot) {
        var opt = document.createElement('option');
        opt.value = opt.textContent = slot;
        timeSelect.appendChild(opt);
      });
      timeSelect.disabled = false;
    } else {
      timeSelect.disabled = true;
    }
  }

  /* ============================================================
     EVENT BINDING
     ============================================================ */
  function bindTriggers() {
    document.querySelectorAll('[data-paid-trial-trigger]').forEach(function (el) {
      el.addEventListener('click', openModal);
    });
  }

  function bindModalEvents() {
    document.getElementById('ptModalClose').addEventListener('click', closeModal);
    document.getElementById('ptModalBackdrop').addEventListener('click', closeModal);
    document.getElementById('ptForm').addEventListener('submit', onFormSubmit);
    document.getElementById('ptRetryBtn').addEventListener('click', resetToForm);
    document.getElementById('ptBackFromFull').addEventListener('click', function () { showStep('center'); });
    document.getElementById('ptBackFromForm').addEventListener('click', function () { showStep('center'); });

    document.querySelectorAll('.ptm-center-card').forEach(function (card) {
      card.addEventListener('click', function () { onCenterSelect(card.dataset.center); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCenterSelect(card.dataset.center); }
      });
    });

    document.getElementById('ptName').addEventListener('input', function () {
      this.value = this.value.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    });

    document.getElementById('ptDate').setAttribute('min', new Date().toISOString().split('T')[0]);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeModal();
    });
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
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

  /* ============================================================
     FORM VALIDATION
     ============================================================ */
  function validateForm() {
    var valid  = true;
    var fields = [
      { id: 'ptName',     errId: 'ptNameErr',     msg: 'Please enter your name',         check: function (v) { return v.trim().length >= 2; } },
      { id: 'ptEmail',    errId: 'ptEmailErr',    msg: 'Please enter a valid email',     check: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); } },
      { id: 'ptPhone',    errId: 'ptPhoneErr',    msg: 'Please enter a 10-digit number', check: function (v) { return /^[0-9]{10}$/.test(v); } },
      { id: 'ptLocation', errId: 'ptLocationErr', msg: 'Please select a location',      check: function (v) { return v !== ''; } },
      { id: 'ptDate',     errId: 'ptDateErr',     msg: 'Please select a date',           check: function (v) { return v !== ''; } },
      { id: 'ptTime',     errId: 'ptTimeErr',     msg: 'Please select a time slot',      check: function (v) { return v !== ''; } },
    ];

    fields.forEach(function (f) {
      var el  = document.getElementById(f.id);
      var err = document.getElementById(f.errId);
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

  /* ============================================================
     FORM SUBMIT → RAZORPAY
     ============================================================ */
  function onFormSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    var rawDate = document.getElementById('ptDate').value;
    var d       = new Date(rawDate + 'T00:00:00');
    var formData = {
      name:      document.getElementById('ptName').value.trim(),
      email:     document.getElementById('ptEmail').value.trim(),
      phone:     document.getElementById('ptPhone').value.trim(),
      location:  document.getElementById('ptLocation').value,
      date:      d.getDate().toString().padStart(2, '0') + '/' +
                 (d.getMonth() + 1).toString().padStart(2, '0') + '/' +
                 d.getFullYear().toString().slice(-2),
      time:      document.getElementById('ptTime').value,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };

    openRazorpay(formData);
  }

  /* ============================================================
     RAZORPAY
     ============================================================ */
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
      notes:       { location: formData.location, date: formData.date, time: formData.time },
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

  /* ============================================================
     PAYMENT SUCCESS
     ============================================================ */
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
        dob:       '',
        plan:      'trial',
        amount:    CONFIG.razorpay.amount,
        paymentId: paymentId,
        orderId:   orderId,
        location:  formData.location,
        date:      formData.date,
        time:      formData.time,
      }),
    })
      .then(function () { console.log('Trial confirmation email sent.'); })
      .catch(function (err) { console.error('Email send failed:', err); });
  }

  function logToSheets(formData, paymentId) {
    var params = new URLSearchParams({
      formType:  'paid-trial',
      name:      formData.name,
      email:     formData.email,
      phone:     formData.phone,
      location:  formData.location,
      date:      formData.date,
      time:      formData.time,
      paymentId: paymentId,
      amount:    '₹2,000',
      status:    'Paid',
      timestamp: formData.timestamp,
      remarks:   '',
    });

    fetch(CONFIG.sheets.url + '?' + params.toString(), { method: 'GET' })
      .then(function () { console.log('Sheets entry logged.'); })
      .catch(function (err) { console.error('Sheets log failed:', err); });
  }

  /* ============================================================
     UI HELPERS
     ============================================================ */
  function setSubmitting(state) {
    var btn    = document.getElementById('ptSubmitBtn');
    var text   = btn.querySelector('.ptm-btn-text');
    var loader = btn.querySelector('.ptm-btn-loader');
    btn.disabled         = state;
    text.style.display   = state ? 'none'        : 'inline';
    loader.style.display = state ? 'inline-flex' : 'none';
  }

  function showSuccess(paymentId) {
    document.getElementById('ptStepForm').style.display = 'none';
    document.getElementById('ptError').style.display    = 'none';
    document.getElementById('ptSuccess').style.display  = 'block';
    document.getElementById('ptPaymentIdDisplay').textContent = 'Payment ID: ' + paymentId;
  }

  function showError(msg) {
    setSubmitting(false);
    document.getElementById('ptStepForm').style.display = 'none';
    document.getElementById('ptSuccess').style.display  = 'none';
    document.getElementById('ptError').style.display    = 'block';
    if (msg) document.getElementById('ptErrorMsg').textContent = msg;
  }

  function resetToForm() {
    document.getElementById('ptError').style.display   = 'none';
    document.getElementById('ptSuccess').style.display = 'none';
    showStep('form');
    setSubmitting(false);
  }

  /* ============================================================
     BOOT
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();