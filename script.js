/* ============================================================================
   script.js — Grip & Grab
   ============================================================================
   Sections:
     1.  CONFIG & CONSTANTS
     2.  DOM REFERENCES
     3.  NAVBAR
     4.  MOBILE MENU
     5.  SCROLL ANIMATIONS
     6.  VIDEO CONTROLS
     7.  TIMELINE ANIMATION
     8.  GALLERY
     9.  FAQ
    10.  FREE TRIAL MODAL (time-slot helper — modal itself in trial-paid.js)
    11.  MEMBERSHIP MODAL
          Step 1 — center selection + availability check
          Step 2 — plan + details form + payment
    12.  PAYMENT ABSTRACTION LAYER
    13.  UTILITY FUNCTIONS
   ============================================================================ */

'use strict';

/* ============================================================================
   1. CONFIG & CONSTANTS
   ============================================================================ */

/* ── Center availability
   To mark a center as full:  set available: false
   alternateCenter must match a key in this same object exactly.
   Change here + redeploy — nothing else needs touching.               ── */
const CENTER_CONFIG = {
  'Grip&Grab Lajpat Nagar': {
    available:       false,
    alternateCenter: 'Grip&Grab Saket',
  },
  'Grip&Grab Saket': {
    available:       true,
    alternateCenter: 'Grip&Grab Lajpat Nagar',
  },
};

/* ── Time slots — single source of truth for all modals ── */
const TIME_SLOTS = {
  'Grip&Grab Lajpat Nagar': {
    morning: ['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM'],
    evening: ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'],
  },
  'Grip&Grab Saket': {
    morning: ['7:30 AM', '8:30 AM', '9:30 AM', '10:30 AM'],
    evening: ['5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'],
  },
};

/* ── Membership plans ── */
const MEMBERSHIP_PLANS = [
  { id: 'monthly',    label: 'Monthly',     price: 8000,  period: '/month',    badge: 'Most Flexible', save: '' },
  { id: 'quarterly',  label: 'Quarterly',   price: 21000, period: '/3 months', badge: 'Great Value',   save: 'Save ₹3,000' },
  { id: 'halfyearly', label: 'Half Yearly', price: 36000, period: '/6 months', badge: 'Most Popular',  save: 'Save ₹12,000' },
  { id: 'yearly',     label: 'Yearly',      price: 60000, period: '/year',     badge: 'Best Deal',     save: 'Save ₹36,000' },
];

/* ── Google Sheets CRM webhook ── */
const SHEETS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbxZTMBH6CLnbvzS6Bl5XYlG-hj0-kB-MDEcVcYZIht0sVTMVNNlYZ-ptPLt5i6VMbLc/exec';

/* ============================================================================
   2. DOM REFERENCES
   ============================================================================ */

const navbar     = document.getElementById('navbar');
const hero       = document.querySelector('.hero');
const footer     = document.querySelector('.footer');
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

/* ============================================================================
   3. NAVBAR
   ============================================================================ */

let heroVisible   = false;
let footerVisible = false;

function toggleNavbar() {
  const visible          = footerVisible || heroVisible;
  navbar.style.opacity       = visible ? '1' : '0';
  navbar.style.pointerEvents = visible ? 'auto' : 'none';
  navbar.style.transform     = visible ? 'translateY(0)' : 'translateY(-100%)';
}

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 100);
});

new IntersectionObserver(
  (entries) => { footerVisible = entries.some((e) => e.isIntersecting); toggleNavbar(); },
  { threshold: 0.1 }
).observe(footer);

new IntersectionObserver(
  (entries) => { heroVisible = entries.some((e) => e.isIntersecting); toggleNavbar(); },
  { threshold: 0.2 }
).observe(hero);

/* ============================================================================
   4. MOBILE MENU
   ============================================================================ */

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  mobileMenu.classList.toggle('active');
  document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : 'auto';
});

mobileMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = 'auto';
  });
});

/* ============================================================================
   5. SCROLL ANIMATIONS
   ============================================================================ */

(() => {
  const obs = new IntersectionObserver(
    (entries, o) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('show'); o.unobserve(entry.target); }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );
  document.querySelectorAll('.animate-left, .animate-right, .animate-up, .animate-fade')
    .forEach((el) => obs.observe(el));
})();

window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset;
  document.querySelectorAll('.floating-label').forEach((el, i) => {
    el.style.transform = `translateY(${-(scrolled * (0.3 + i * 0.1))}px)`;
  });
});

window.addEventListener('load', () => {
  document.body.style.opacity = '1';
  document.querySelectorAll('.hero-content > *').forEach((el, i) => {
    setTimeout(() => { el.style.animationDelay = `${i * 0.2}s`; el.classList.add('animate-fade-in'); }, i * 100);
  });
});

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (window.innerWidth > 768 && mobileMenu.classList.contains('active')) {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  }, 250);
});

/* ============================================================================
   6. VIDEO CONTROLS
   ============================================================================ */

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/* Hero auto-play video */
const heroVideo = document.getElementById('autoPlayVideo');
if (heroVideo) {
  let userHasInteracted = false;
  const onFirstInteraction = () => {
    if (!userHasInteracted) { userHasInteracted = true; heroVideo.muted = false; }
  };
  ['click', 'touchstart', 'touchmove', 'scroll'].forEach((evt) =>
    document.addEventListener(evt, onFirstInteraction, { once: true })
  );
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        heroVideo.muted = !userHasInteracted && isMobile;
        heroVideo.play().catch(() => {});
      } else { heroVideo.pause(); }
    },
    { threshold: 0.5 }
  ).observe(heroVideo);
}

/* Testimonial videos */
document.querySelectorAll('.testimonial-card').forEach((card) => {
  const video = card.querySelector('video');
  if (!video) return;
  video.setAttribute('controls', 'false');
  if (isMobile) {
    card.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (video.paused) {
        video.setAttribute('controls', 'true'); video.muted = false;
        video.play().catch(() => {});
        setTimeout(() => video.setAttribute('controls', 'false'), 1000);
      } else {
        video.setAttribute('controls', 'true'); video.pause();
        video.muted = true; video.currentTime = 0;
        setTimeout(() => video.setAttribute('controls', 'false'), 1000);
      }
    });
  } else {
    card.addEventListener('mouseenter', () => { video.muted = false; video.play().catch(() => {}); });
    card.addEventListener('mouseleave', () => { video.pause(); video.muted = true; video.currentTime = 0; });
  }
});

/* Lazy-load off-screen videos */
document.querySelectorAll('video').forEach((v) => {
  v.muted = true;
  v.addEventListener('loadstart', () => { v.style.backgroundColor = '#1a1a1a'; });
  v.addEventListener('canplay',   () => { v.style.backgroundColor = 'transparent'; });
  v.addEventListener('error',     () => { v.style.backgroundColor = '#2a2a2a'; });
  if (v.getBoundingClientRect().top > window.innerHeight * 1.5) {
    v.dataset.src = v.src; v.src = '';
    new IntersectionObserver(([entry], obs) => {
      if (entry.isIntersecting) { v.src = v.dataset.src; v.load(); obs.unobserve(v); }
    }, { rootMargin: '100px' }).observe(v);
  }
});

/* ============================================================================
   7. TIMELINE ANIMATION
   ============================================================================ */

(() => {
  const items    = document.querySelectorAll('.timeline-item');
  const progress = document.getElementById('timelineProgress');
  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.classList.contains('active')) return;
        const item = entry.target;
        const step = parseInt(item.dataset.step, 10);
        item.classList.add('active');
        item.querySelector('.timeline-number')?.classList.add('active');
        item.querySelector('.timeline-content')?.classList.add('active');
        if (progress) progress.style.height = `${(step / items.length) * 100}%`;
      });
    },
    { threshold: 0.5, rootMargin: '-10% 0px -10% 0px' }
  ).observe = (() => {
    const o = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.target.classList.contains('active')) return;
          const item = entry.target;
          const step = parseInt(item.dataset.step, 10);
          item.classList.add('active');
          item.querySelector('.timeline-number')?.classList.add('active');
          item.querySelector('.timeline-content')?.classList.add('active');
          if (progress) progress.style.height = `${(step / items.length) * 100}%`;
        });
      },
      { threshold: 0.5, rootMargin: '-10% 0px -10% 0px' }
    );
    items.forEach((item) => o.observe(item));
    return o.observe.bind(o);
  })();
})();

/* ============================================================================
   8. GALLERY
   ============================================================================ */

let currentGallery    = null;
let currentSlideIndex = 0;

function openGallery(gymLocation) {
  if (!window.galleryData?.[gymLocation]) return;
  currentGallery = window.galleryData[gymLocation]; currentSlideIndex = 0;
  const modal = document.getElementById('galleryModal');
  if (!modal) return;
  document.getElementById('galleryTitle').textContent   = currentGallery.title;
  document.getElementById('galleryMainImage').src        = currentGallery.images[0];
  document.getElementById('galleryMainImage').alt        = currentGallery.title;
  document.getElementById('currentSlide').textContent    = '1';
  document.getElementById('totalSlides').textContent     = currentGallery.images.length;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeGallery() {
  document.getElementById('galleryModal')?.classList.remove('active');
  document.body.style.overflow = 'auto'; currentGallery = null;
}
function changeSlide(direction) {
  if (!currentGallery) return;
  currentSlideIndex = (currentSlideIndex + direction + currentGallery.images.length) % currentGallery.images.length;
  document.getElementById('galleryMainImage').src     = currentGallery.images[currentSlideIndex];
  document.getElementById('currentSlide').textContent = currentSlideIndex + 1;
}
document.addEventListener('keydown', (e) => {
  if (!currentGallery) return;
  if (e.key === 'ArrowLeft')  changeSlide(-1);
  if (e.key === 'ArrowRight') changeSlide(1);
  if (e.key === 'Escape')     closeGallery();
});
window.openGallery = openGallery; window.closeGallery = closeGallery; window.changeSlide = changeSlide;

/* ============================================================================
   9. FAQ
   ============================================================================ */

function toggleFaq(element) {
  const faqItem  = element.parentElement;
  const isActive = faqItem.classList.contains('active');
  document.querySelectorAll('.faq-item').forEach((item) => item.classList.remove('active'));
  if (!isActive) faqItem.classList.add('active');
}
window.toggleFaq = toggleFaq;

/* ============================================================================
   10. FREE TRIAL MODAL — time-slot helper
   trial-paid.js reads window.TIME_SLOTS (full center names).
   Legacy trial form uses short names — bridged here.
   ============================================================================ */

const TRIAL_TIME_SLOTS = {
  'Lajpat Nagar': TIME_SLOTS['Grip&Grab Lajpat Nagar'],
  'Saket':        TIME_SLOTS['Grip&Grab Saket'],
};

function updateTimeSlots() {
  const locationEl = document.getElementById('trialLocation');
  const timeEl     = document.getElementById('trialTime');
  if (!locationEl || !timeEl) return;
  const slots = TRIAL_TIME_SLOTS[locationEl.value];
  timeEl.innerHTML = '<option value="" disabled selected>Select your preferred time</option>';
  if (slots) {
    const mg = document.createElement('optgroup'); mg.label = 'Morning Sessions';
    slots.morning.forEach((t) => { const o = document.createElement('option'); o.value = o.textContent = t; mg.appendChild(o); });
    const eg = document.createElement('optgroup'); eg.label = 'Evening Sessions';
    slots.evening.forEach((t) => { const o = document.createElement('option'); o.value = o.textContent = t; eg.appendChild(o); });
    timeEl.appendChild(mg); timeEl.appendChild(eg); timeEl.disabled = false;
  } else { timeEl.disabled = true; }
}
window.updateTimeSlots = updateTimeSlots;

document.addEventListener('DOMContentLoaded', () => {
  const locationEl = document.getElementById('trialLocation');
  if (locationEl) {
    locationEl.addEventListener('change', updateTimeSlots);
    if (locationEl.value) updateTimeSlots();
  }
});

/* ============================================================================
   11. MEMBERSHIP MODAL
   ----------------------------------------------------------------------------
   Step 1 — center selection + availability check
   Step "full" — center at capacity message
   Step 2 — plan cards + details form + payment
   ============================================================================ */

(function () {
  'use strict';

  /* ── State ── */
  const state = {
    isOpen:         false,
    isSubmitting:   false,
    selectedCenter: null,
    selectedPlan:   null,
  };

  /* ── DOM refs ── */
  let modal, backdrop, closeBtn, form, submitBtn,
      successEl, errorEl, retryBtn,
      stepCenter, stepFull, stepForm;

  /* ==========================================================
     INJECT HTML
     ========================================================== */
  function injectModal() {
    const centerCardsHTML = Object.keys(CENTER_CONFIG).map((name) => `
      <div class="mm-center-card" data-center="${name}" tabindex="0" role="button" aria-label="Select ${name}">
        <div class="mm-center-card__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <span class="mm-center-card__name">${name}</span>
      </div>
    `).join('');

    const planCardsHTML = MEMBERSHIP_PLANS.map((p) => `
      <div class="mm-plan ${p.id === 'halfyearly' ? 'mm-plan--popular' : ''}"
           data-plan-id="${p.id}" data-plan-price="${p.price}"
           tabindex="0" role="button" aria-label="${p.label} plan">
        <div class="mm-plan__badge">${p.badge}</div>
        <div class="mm-plan__name">${p.label}</div>
        <div class="mm-plan__price">
          <span class="mm-plan__currency">₹</span>${p.price.toLocaleString('en-IN')}
          <span class="mm-plan__period">${p.period}</span>
        </div>
        ${p.save ? `<div class="mm-plan__save">${p.save}</div>` : '<div class="mm-plan__save">&nbsp;</div>'}
        <div class="mm-plan__gst">+ 18% GST</div>
      </div>
    `).join('');

    document.body.insertAdjacentHTML('beforeend', `
<div id="mmModal" class="mm-overlay" role="dialog" aria-modal="true" aria-labelledby="mmModalTitle" style="display:none;">
  <div class="mm-backdrop" id="mmBackdrop"></div>
  <div class="mm-container">
    <div class="mm-handle"></div>
    <button class="mm-close" id="mmClose" aria-label="Close" type="button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- STEP 1: Center select -->
    <div id="mmStepCenter">
      <div class="mm-header">
        <h3 id="mmModalTitle">Join Grip&amp;Grab</h3>
        <p>Which center would you like to join?</p>
      </div>
      <div class="mm-center-cards">${centerCardsHTML}</div>
      <span class="mm-err" id="mmCenterErr"></span>
    </div>

    <!-- STEP FULL: Center at capacity -->
    <div id="mmStepFull" style="display:none;">
      <div class="mm-full-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
      </div>
      <h4 class="mm-full-title" id="mmFullTitle"></h4>
      <p  class="mm-full-msg"   id="mmFullMsg"></p>
      <button class="mm-alt-btn"   id="mmAltBtn"        type="button"></button>
      <button class="mm-back-link" id="mmBackFromFull"  type="button">← Choose a different center</button>
    </div>

    <!-- STEP 2: Plan + form -->
    <div id="mmStepForm" style="display:none;">
      <button class="mm-back-link" id="mmBackFromForm" type="button">← Change center</button>
      <div class="mm-header mm-header--compact">
        <h3 id="mmFormTitle">Join Grip&amp;Grab</h3>
        <p  id="mmFormSubtitle">Choose your plan and fill in your details.</p>
      </div>
      <div class="mm-plans" id="mmPlans" role="radiogroup">${planCardsHTML}</div>
      <span class="mm-err" id="mmPlanErr"></span>
      <form id="mmForm" class="mm-form" novalidate autocomplete="on">
        <div class="mm-group">
          <label for="mmName">Full Name <span>*</span></label>
          <input type="text"  id="mmName"  name="name"  placeholder="Your full name"           required autocomplete="name"  minlength="2">
          <span class="mm-err" id="mmNameErr"></span>
        </div>
        <div class="mm-group">
          <label for="mmEmail">Email Address <span>*</span></label>
          <input type="email" id="mmEmail" name="email" placeholder="your@email.com"            required autocomplete="email">
          <span class="mm-err" id="mmEmailErr"></span>
        </div>
        <div class="mm-group">
          <label for="mmPhone">Phone Number <span>*</span></label>
          <input type="tel"   id="mmPhone" name="phone" placeholder="10-digit mobile number"   required autocomplete="tel" pattern="[0-9]{10}">
          <span class="mm-err" id="mmPhoneErr"></span>
        </div>
        <div class="mm-group">
          <label for="mmDob">Date of Birth <span>*</span></label>
          <input type="date"  id="mmDob"   name="dob"                                          required autocomplete="bday">
          <span class="mm-err" id="mmDobErr"></span>
        </div>
        <button type="submit" class="mm-submit" id="mmSubmit">
          <span class="mm-btn-text">Pay &amp; Join Now</span>
          <span class="mm-btn-loader" style="display:none;">
            <svg class="mm-spinner" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
            </svg>
          </span>
        </button>
      </form>
    </div>

    <!-- SUCCESS -->
    <div id="mmSuccess" class="mm-success" style="display:none;">
      <div class="mm-success-icon">✓</div>
      <h4>Welcome to Grip&amp;Grab!</h4>
      <p>Payment confirmed. A confirmation email is on its way.</p>
      <p class="mm-payment-ref" id="mmPaymentRef"></p>
    </div>

    <!-- ERROR -->
    <div id="mmError" class="mm-error" style="display:none;">
      <div class="mm-error-icon">✕</div>
      <h4>Something went wrong</h4>
      <p id="mmErrorMsg">Payment could not be completed. Please try again.</p>
      <button class="mm-retry-btn" id="mmRetry" type="button">Try Again</button>
    </div>
  </div>
</div>`);

    injectStyles();
  }

  /* ==========================================================
     STYLES
     ========================================================== */
  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
.mm-overlay { position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center; }
@media(min-width:560px){.mm-overlay{align-items:center;}}
.mm-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px); }
.mm-container {
  position:relative;background:#141414;color:#f0f0f0;font-family:'Poppins',sans-serif;
  width:100%;max-width:100%;max-height:93dvh;overflow-y:auto;overflow-x:hidden;
  -webkit-overflow-scrolling:touch;border-radius:24px 24px 0 0;
  padding:24px 20px 40px;box-sizing:border-box;border-top:1px solid rgba(255,255,255,0.08);
}
@media(min-width:560px){.mm-container{max-width:520px;border-radius:20px;padding:32px 32px 40px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 32px 80px rgba(0,0,0,0.65);}}
.mm-handle{width:40px;height:4px;background:rgba(255,255,255,0.18);border-radius:2px;margin:0 auto 20px;}
@media(min-width:560px){.mm-handle{display:none;}}
.mm-close{position:absolute;top:8px;right:14px;background:rgba(255,255,255,0.08);border:none;cursor:pointer;color:#f0f0f0;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:background 0.2s;}
.mm-close:hover{background:rgba(255,255,255,0.16);}
.mm-header{margin-bottom:20px;padding-right:44px;}
.mm-header--compact{margin-bottom:14px;padding-right:0;}
.mm-header h3{font-size:22px;font-weight:700;margin:0 0 4px;color:#fff;}
.mm-header p{font-size:13px;color:rgba(255,255,255,0.45);margin:0;}
.mm-back-link{background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.45);font-size:13px;font-family:'Poppins',sans-serif;padding:0;margin-bottom:16px;display:block;transition:color 0.2s;}
.mm-back-link:hover{color:rgba(255,255,255,0.75);}
/* Center cards */
.mm-center-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;}
.mm-center-card{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.1);border-radius:16px;padding:22px 16px;cursor:pointer;text-align:center;transition:border-color 0.2s,background 0.2s;display:flex;flex-direction:column;align-items:center;gap:10px;}
.mm-center-card:hover{border-color:rgba(255,107,107,0.5);background:rgba(255,107,107,0.06);}
.mm-center-card--selected{border-color:#ff6b6b!important;background:rgba(255,107,107,0.1)!important;}
.mm-center-card__icon{color:rgba(255,255,255,0.45);}
.mm-center-card__name{font-size:14px;font-weight:600;color:#fff;line-height:1.3;}
/* Full state */
#mmStepFull{text-align:center;padding:12px 0 8px;}
.mm-full-icon{width:72px;height:72px;border-radius:50%;background:rgba(255,180,0,0.1);border:1.5px solid rgba(255,180,0,0.25);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;color:#f7d794;}
.mm-full-title{font-size:18px;font-weight:700;color:#fff;margin:0 0 10px;line-height:1.3;}
.mm-full-msg{font-size:14px;color:rgba(255,255,255,0.5);margin:0 0 22px;line-height:1.7;}
.mm-alt-btn{display:block;width:100%;padding:14px;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;font-size:14px;font-weight:700;font-family:'Poppins',sans-serif;border:none;border-radius:14px;cursor:pointer;transition:opacity 0.2s;margin-bottom:12px;}
.mm-alt-btn:hover{opacity:0.9;}
/* Plans */
.mm-plans{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:6px;}
@media(min-width:440px){.mm-plans{grid-template-columns:repeat(4,1fr);}}
.mm-plan{background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.1);border-radius:14px;padding:12px 8px 10px;cursor:pointer;text-align:center;transition:border-color 0.2s,background 0.2s;display:flex;flex-direction:column;align-items:center;gap:3px;}
.mm-plan:hover{border-color:rgba(255,107,107,0.5);background:rgba(255,107,107,0.06);}
.mm-plan--selected{border-color:#ff6b6b!important;background:rgba(255,107,107,0.1)!important;}
.mm-plan--popular{border-color:rgba(247,215,148,0.4);}
.mm-plan__badge{font-size:9px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.05em;}
.mm-plan__name{font-size:13px;font-weight:700;color:#fff;}
.mm-plan__price{font-size:15px;font-weight:800;color:#f7d794;line-height:1.1;}
.mm-plan__currency{font-size:11px;vertical-align:super;}
.mm-plan__period{font-size:10px;font-weight:400;color:rgba(255,255,255,0.4);}
.mm-plan__save{font-size:10px;color:#7dd87d;font-weight:500;}
.mm-plan__gst{font-size:9px;color:rgba(255,255,255,0.3);}
/* Form */
.mm-form{display:flex;flex-direction:column;gap:14px;margin-top:18px;}
.mm-group{display:flex;flex-direction:column;gap:5px;}
.mm-group label{font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.05em;text-transform:uppercase;}
.mm-group label span{color:#ff6b6b;}
.mm-group input{width:100%;padding:13px 15px;border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;font-size:15px;font-family:'Poppins',sans-serif;background:rgba(255,255,255,0.05);color:#f0f0f0;box-sizing:border-box;transition:border-color 0.2s,background 0.2s;-webkit-appearance:none;appearance:none;}
.mm-group input:focus{outline:none;border-color:rgba(255,107,107,0.6);background:rgba(255,255,255,0.07);}
.mm-group input[type="date"]{color-scheme:dark;}
.mm-group input.mm-invalid{border-color:#ff5252!important;}
.mm-err{font-size:11px;color:#ff5252;min-height:14px;display:block;}
/* Submit */
.mm-submit{width:100%;padding:16px;background:linear-gradient(135deg,#ff6b6b,#f7d794);color:#000;font-size:15px;font-weight:700;border:none;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity 0.2s,transform 0.15s;margin-top:4px;}
.mm-submit:hover{opacity:0.92;transform:translateY(-1px);}
.mm-submit:active{transform:translateY(0);}
.mm-submit:disabled{opacity:0.55;cursor:not-allowed;transform:none;}
.mm-spinner{width:20px;height:20px;animation:mmSpin 0.8s linear infinite;}
.mm-spinner circle{stroke:#000;stroke-linecap:round;stroke-dasharray:80;stroke-dashoffset:60;}
@keyframes mmSpin{to{transform:rotate(360deg);}}
/* Success / Error */
.mm-success,.mm-error{text-align:center;padding:32px 20px 8px;}
.mm-success-icon{width:60px;height:60px;border-radius:50%;background:rgba(100,220,100,0.15);display:flex;align-items:center;justify-content:center;font-size:28px;color:#7dd87d;margin:0 auto 16px;}
.mm-error-icon{width:60px;height:60px;border-radius:50%;background:rgba(255,82,82,0.15);display:flex;align-items:center;justify-content:center;font-size:28px;color:#ff5252;margin:0 auto 16px;}
.mm-success h4,.mm-error h4{font-size:18px;font-weight:700;margin:0 0 8px;}
.mm-success p,.mm-error p{font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 6px;}
.mm-payment-ref{font-size:11px;font-family:monospace;color:rgba(255,255,255,0.3)!important;}
.mm-retry-btn{margin-top:16px;padding:12px 32px;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);color:#fff;border-radius:30px;cursor:pointer;font-size:14px;font-weight:600;font-family:'Poppins',sans-serif;transition:background 0.2s;}
.mm-retry-btn:hover{background:rgba(255,255,255,0.14);}
`;
    document.head.appendChild(s);
  }

  /* ==========================================================
     CACHE REFS
     ========================================================== */
  function cacheRefs() {
    modal      = document.getElementById('mmModal');
    backdrop   = document.getElementById('mmBackdrop');
    closeBtn   = document.getElementById('mmClose');
    form       = document.getElementById('mmForm');
    submitBtn  = document.getElementById('mmSubmit');
    successEl  = document.getElementById('mmSuccess');
    errorEl    = document.getElementById('mmError');
    retryBtn   = document.getElementById('mmRetry');
    stepCenter = document.getElementById('mmStepCenter');
    stepFull   = document.getElementById('mmStepFull');
    stepForm   = document.getElementById('mmStepForm');
  }

  /* ==========================================================
     OPEN / CLOSE / STEPS
     ========================================================== */
  function openModal(e) {
    if (e) e.preventDefault();
    state.isOpen = true;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    showStep('center');
  }

  function closeModal() {
    state.isOpen = false;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function showStep(step) {
    stepCenter.style.display = step === 'center'  ? 'block' : 'none';
    stepFull.style.display   = step === 'full'    ? 'block' : 'none';
    stepForm.style.display   = step === 'form'    ? 'block' : 'none';
    successEl.style.display  = step === 'success' ? 'block' : 'none';
    errorEl.style.display    = step === 'error'   ? 'block' : 'none';
  }

  /* ==========================================================
     STEP 1 — CENTER SELECTION
     ========================================================== */
  function onCenterSelect(centerName) {
    state.selectedCenter = centerName;
    const config = CENTER_CONFIG[centerName];

    /* Highlight card */
    document.querySelectorAll('.mm-center-card').forEach((c) =>
      c.classList.toggle('mm-center-card--selected', c.dataset.center === centerName)
    );

    if (config.available) {
      document.getElementById('mmFormTitle').textContent    = `Join ${centerName}`;
      document.getElementById('mmFormSubtitle').textContent = 'Choose your plan and fill in your details.';
      resetFormOnly();
      showStep('form');
    } else {
      const alt = config.alternateCenter;
      document.getElementById('mmFullTitle').textContent =
        `${centerName} is currently full`;
      document.getElementById('mmFullMsg').textContent =
        `We're not taking new joinings at ${centerName} right now. You can join at ${alt} — spots are open there.`;
      const altBtn = document.getElementById('mmAltBtn');
      altBtn.textContent = `Join ${alt} instead`;
      altBtn.onclick = () => onCenterSelect(alt);
      showStep('full');
    }
  }

  /* ==========================================================
     STEP 2 — PLAN SELECTION
     ========================================================== */
  function selectPlan(planEl) {
    document.querySelectorAll('.mm-plan').forEach((p) => p.classList.remove('mm-plan--selected'));
    planEl.classList.add('mm-plan--selected');
    state.selectedPlan = MEMBERSHIP_PLANS.find((p) => p.id === planEl.dataset.planId);
    clearErr('mmPlanErr');
    if (state.selectedPlan) {
      const total = state.selectedPlan.price + Math.round(state.selectedPlan.price * 0.18);
      submitBtn.querySelector('.mm-btn-text').textContent =
        `Pay ₹${total.toLocaleString('en-IN')} & Join Now`;
    }
  }

  /* ==========================================================
     VALIDATION
     ========================================================== */
  function showErr(id, msg)            { const el = document.getElementById(id); if (el) el.textContent = msg; }
  function clearErr(id)                { const el = document.getElementById(id); if (el) el.textContent = ''; }
  function markInvalid(el, id, msg)    { el.classList.add('mm-invalid');    showErr(id, msg); }
  function markValid(el, id)           { el.classList.remove('mm-invalid'); clearErr(id); }

  function validateForm() {
    let ok = true;
    if (!state.selectedPlan) { showErr('mmPlanErr', 'Please select a membership plan.'); ok = false; }
    const n = document.getElementById('mmName');
    const e = document.getElementById('mmEmail');
    const p = document.getElementById('mmPhone');
    const d = document.getElementById('mmDob');
    if (!n.value.trim() || n.value.trim().length < 2)            { markInvalid(n, 'mmNameErr',  'Please enter your full name.');           ok = false; } else markValid(n, 'mmNameErr');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.value.trim()))      { markInvalid(e, 'mmEmailErr', 'Please enter a valid email address.');    ok = false; } else markValid(e, 'mmEmailErr');
    if (!/^[0-9]{10}$/.test(p.value.trim()))                     { markInvalid(p, 'mmPhoneErr', 'Please enter a valid 10-digit number.'); ok = false; } else markValid(p, 'mmPhoneErr');
    if (!d.value)                                                  { markInvalid(d, 'mmDobErr',   'Please enter your date of birth.');      ok = false; } else markValid(d, 'mmDobErr');
    return ok;
  }

  /* ==========================================================
     FORM SUBMIT
     ========================================================== */
  async function handleSubmit(e) {
    e.preventDefault();
    if (state.isSubmitting || !validateForm()) return;

    const payload = {
      name:   document.getElementById('mmName').value.trim(),
      email:  document.getElementById('mmEmail').value.trim(),
      phone:  document.getElementById('mmPhone').value.trim(),
      dob:    document.getElementById('mmDob').value,
      center: state.selectedCenter,
      plan:   state.selectedPlan,
    };
    const gst   = Math.round(payload.plan.price * 0.18);
    const total = payload.plan.price + gst;

    state.isSubmitting = true;
    setLoading(true);

    /* Calls Section 12 abstraction — swap gateway here later */
    processPayment({
      amount:      total,
      amountPaise: total * 100,
      name:        payload.name,
      email:       payload.email,
      phone:       payload.phone,
      description: `${payload.plan.label} Membership — ${payload.center}`,

      onSuccess: async (txId) => {
        /* Fire-and-forget — never block success UX */
        fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payload.name, email: payload.email, phone: payload.phone, dob: payload.dob, center: payload.center, plan: payload.plan.id, amount: total * 100, paymentId: txId }),
        }).catch((err) => console.error('Email:', err));
        fetch(SHEETS_WEBHOOK_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'Membership', name: payload.name, email: payload.email, phone: payload.phone, dob: payload.dob, center: payload.center, plan: payload.plan.label, amount: `₹${total.toLocaleString('en-IN')}`, paymentId: txId, timestamp: new Date().toISOString() }),
        }).catch((err) => console.error('Sheets:', err));
        document.getElementById('mmPaymentRef').textContent = `Payment ID: ${txId}`;
        state.isSubmitting = false; setLoading(false);
        showStep('success');
      },
      onDismiss: () => { state.isSubmitting = false; setLoading(false); },
      onError:   (msg) => {
        document.getElementById('mmErrorMsg').textContent = msg || 'Payment could not be completed. Please try again.';
        state.isSubmitting = false; setLoading(false);
        showStep('error');
      },
    });
  }

  /* ==========================================================
     UI HELPERS
     ========================================================== */
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.querySelector('.mm-btn-text').style.display   = on ? 'none' : 'flex';
    submitBtn.querySelector('.mm-btn-loader').style.display = on ? 'flex' : 'none';
  }

  function resetFormOnly() {
    if (form) form.reset();
    document.querySelectorAll('.mm-plan').forEach((p) => p.classList.remove('mm-plan--selected'));
    state.selectedPlan = null; state.isSubmitting = false;
    if (submitBtn) submitBtn.querySelector('.mm-btn-text').textContent = 'Pay & Join Now';
    setLoading(false);
    document.querySelectorAll('.mm-err').forEach((el) => { el.textContent = ''; });
    document.querySelectorAll('.mm-group input').forEach((el) => el.classList.remove('mm-invalid'));
  }

  /* ==========================================================
     BIND EVENTS
     ========================================================== */
  function bindEvents() {
    document.querySelectorAll('[data-membership-trigger]').forEach((el) =>
      el.addEventListener('click', openModal)
    );
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.isOpen) closeModal(); });

    document.querySelectorAll('.mm-center-card').forEach((card) => {
      card.addEventListener('click', () => onCenterSelect(card.dataset.center));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCenterSelect(card.dataset.center); }
      });
    });

    document.getElementById('mmBackFromFull').addEventListener('click', () => showStep('center'));
    document.getElementById('mmBackFromForm').addEventListener('click', () => showStep('center'));

    document.querySelectorAll('.mm-plan').forEach((planEl) => {
      planEl.addEventListener('click', () => selectPlan(planEl));
      planEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlan(planEl); }
      });
    });

    form.addEventListener('submit', handleSubmit);
    retryBtn.addEventListener('click', () => showStep('form'));
  }

  /* ==========================================================
     INIT
     ========================================================== */
  function init() { injectModal(); cacheRefs(); bindEvents(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.openMembershipModal = openModal;

})();

/* ============================================================================
   12. PAYMENT ABSTRACTION LAYER
   ----------------------------------------------------------------------------
   ALL payment calls route through processPayment().
   To swap gateway: replace ONLY this function body.
   The onSuccess / onDismiss / onError interface never changes.
   ============================================================================ */

/**
 * processPayment(options)
 * @param {object} options
 *   amount        {number}   INR total (e.g. 9440)
 *   amountPaise   {number}   paise    (e.g. 944000)  — Razorpay needs paise
 *   name          {string}
 *   email         {string}
 *   phone         {string}
 *   description   {string}
 *   onSuccess     {fn(transactionId)}
 *   onDismiss     {fn()}
 *   onError       {fn(message)}
 *
 * Current provider: Razorpay
 * Next provider:    HDFC SmartGateway (see commented block below)
 */
function processPayment(options) {

  /* ── RAZORPAY (active) ── */
  if (typeof Razorpay === 'undefined') {
    options.onError('Payment gateway not loaded. Please refresh and try again.');
    return;
  }

  const rzp = new Razorpay({
    key:         'rzp_test_RZG0vfhDgIuZYI',
    amount:      options.amountPaise,
    currency:    'INR',
    name:        'Grip&Grab',
    description: options.description,
    prefill:     { name: options.name, email: options.email, contact: options.phone },
    theme:       { color: '#ff6b6b' },
    handler:     (response) => options.onSuccess(response.razorpay_payment_id),
    modal:       { ondismiss: () => options.onDismiss() },
  });
  rzp.on('payment.failed', (r) =>
    options.onError('Payment failed: ' + (r.error.description || 'Unknown error'))
  );
  rzp.open();

  /* ── HDFC SmartGateway (ready to enable) ────────────────────────────
  //
  // Step 1 — create order server-side (never expose merchant key in frontend)
  // const { orderId } = await fetch('/api/create-order', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ amount: options.amount, currency: 'INR' }),
  // }).then((r) => r.json());
  //
  // Step 2 — redirect to HDFC payment page
  // HDFC uses a form POST redirect flow (not a JS SDK like Razorpay).
  // Build a hidden form, submit it to HDFC's endpoint with:
  //   merchant_id, order_id, currency, amount, redirect_url, cancel_url,
  //   language, merchant_param, checksum (SHA256 of fields + working_key)
  //
  // Step 3 — HDFC POSTs result to /api/hdfc-callback
  // Verify checksum server-side, then redirect user to success/failure page
  // and emit onSuccess(transactionId) or onError(msg) accordingly.
  //
  // To activate: comment out the Razorpay block above, uncomment this block,
  // add api/create-order.js and api/hdfc-callback.js to /api folder.
  //
  ─────────────────────────────────────────────────────────────────────── */
}

/* ============================================================================
   13. UTILITY FUNCTIONS
   ============================================================================ */

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  if (mobileMenu?.classList.contains('active')) {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.scrollToSection = scrollToSection;

document.addEventListener('DOMContentLoaded', () => {
  /* Kids Fitness Card toggle */
  const kidsCard        = document.querySelector('.kids-card');
  const scrollIndicator = document.querySelector('.scroll-indicator');
  if (scrollIndicator && kidsCard) {
    scrollIndicator.addEventListener('click', (e) => { e.stopPropagation(); kidsCard.classList.toggle('expanded'); });
  }
  /* Tooltips */
  document.querySelectorAll('[data-tooltip]').forEach((el) => {
    el.addEventListener('mouseenter', (e) => {
      const tip = document.createElement('div');
      tip.className = 'tooltip'; tip.textContent = e.target.dataset.tooltip;
      document.body.appendChild(tip);
      const rect = e.target.getBoundingClientRect();
      tip.style.cssText = `position:fixed;top:${rect.top - 40}px;left:${rect.left + rect.width / 2}px;transform:translateX(-50%);z-index:99999;`;
    });
    el.addEventListener('mouseleave', () => document.querySelector('.tooltip')?.remove());
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mobileMenu?.classList.contains('active')) {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
  if (e.key === 'ArrowDown' && e.ctrlKey) { e.preventDefault(); window.scrollBy({ top:  window.innerHeight, behavior: 'smooth' }); }
  if (e.key === 'ArrowUp'   && e.ctrlKey) { e.preventDefault(); window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' }); }
});