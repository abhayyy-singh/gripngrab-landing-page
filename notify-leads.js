/* ============================================================================
   notify-leads.js — Grip & Grab
   Notify Me lead capture — Firebase Firestore + admin email
   ============================================================================ */
import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore,
         collection,
         addDoc,
         serverTimestamp }  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB8hiRT58l-n5f5nbaqtuViCJeOqEMp-_k',
  authDomain:        'gripngrab.firebaseapp.com',
  projectId:         'gripngrab',
  storageBucket:     'gripngrab.firebasestorage.app',
  messagingSenderId: '568040807328',
  appId:             '1:568040807328:web:e9ee4f1328064a3d69e2c5',
};

const app = initializeApp(FIREBASE_CONFIG, 'gng-notify');
const db  = getFirestore(app);

/* ── inject shared styles once ── */
if (!document.getElementById('nl-styles')) {
  const s = document.createElement('style');
  s.id = 'nl-styles';
  s.textContent = `
    .nl-intro{font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 12px;text-align:center;}
    .nl-fields{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;}
    .nl-input{width:100%;padding:11px 14px;border:1.5px solid rgba(255,255,255,0.12);border-radius:10px;
      background:rgba(255,255,255,0.05);color:#f0f0f0;font-size:14px;font-family:'Poppins',sans-serif;
      box-sizing:border-box;transition:border-color .2s;}
    .nl-input::placeholder{color:rgba(255,255,255,0.25);}
    .nl-input:focus{outline:none;border-color:#ff6b6b;}
    .nl-err{font-size:11px;color:#ff6b6b;min-height:14px;line-height:1.4;}
    .nl-submit{display:block;width:100%;padding:13px;background:linear-gradient(135deg,#ff6b6b,#f7d794);
      color:#000;font-size:14px;font-weight:700;font-family:'Poppins',sans-serif;border:none;
      border-radius:12px;cursor:pointer;transition:opacity .2s;margin-bottom:8px;box-sizing:border-box;}
    .nl-submit:hover{opacity:.9;}
    .nl-submit:disabled{opacity:.5;cursor:not-allowed;}
    .nl-success{background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:10px;
      padding:12px;font-size:13px;color:#4ade80;text-align:center;font-weight:600;}
  `;
  document.head.appendChild(s);
}

/* ── render a fresh form into containerId ── */
function render(containerId, program, center) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <p class="nl-intro">Get notified when slots open up:</p>
    <div class="nl-fields">
      <input type="text"  class="nl-input" id="${containerId}-name"  placeholder="Your name"     autocomplete="name">
      <div   class="nl-err"               id="${containerId}-name-err"></div>
      <input type="tel"   class="nl-input" id="${containerId}-phone" placeholder="Phone number"  autocomplete="tel">
      <div   class="nl-err"               id="${containerId}-phone-err"></div>
      <input type="email" class="nl-input" id="${containerId}-email" placeholder="Email address" autocomplete="email">
      <div   class="nl-err"               id="${containerId}-email-err"></div>
    </div>
    <button class="nl-submit" id="${containerId}-btn" type="button">
      <span class="nl-btn-text">🔔 Notify Me When Slots Open</span>
      <span class="nl-btn-loader" style="display:none">Saving…</span>
    </button>
    <div class="nl-success" id="${containerId}-success" style="display:none">
      ✓ You're on the list! We'll reach out when slots open.
    </div>
  `;

  document.getElementById(containerId + '-btn').addEventListener('click', () => {
    submit(containerId, program, center);
  });
}

function submit(containerId, program, center) {
  const nameEl  = document.getElementById(containerId + '-name');
  const phoneEl = document.getElementById(containerId + '-phone');
  const emailEl = document.getElementById(containerId + '-email');
  const btn     = document.getElementById(containerId + '-btn');

  ['name', 'phone', 'email'].forEach(f => {
    const errEl   = document.getElementById(containerId + '-' + f + '-err');
    const inputEl = document.getElementById(containerId + '-' + f);
    if (errEl)   errEl.textContent = '';
    if (inputEl) inputEl.style.borderColor = '';
  });

  let valid = true;

  if (!nameEl.value.trim() || nameEl.value.trim().length < 2) {
    fieldErr(containerId, 'name', 'Please enter your name');
    valid = false;
  }
  if (!/^[6-9][0-9]{9}$/.test(phoneEl.value.trim())) {
    fieldErr(containerId, 'phone', 'Enter a valid 10-digit mobile number');
    valid = false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
    fieldErr(containerId, 'email', 'Enter a valid email address');
    valid = false;
  }

  if (!valid) return;

  const text   = btn.querySelector('.nl-btn-text');
  const loader = btn.querySelector('.nl-btn-loader');
  btn.disabled = true;
  text.style.display   = 'none';
  loader.style.display = 'block';

  const lead = { name: nameEl.value.trim(), phone: phoneEl.value.trim(),
                 email: emailEl.value.trim(), program, center };

  addDoc(collection(db, 'notify-leads'), { ...lead, timestamp: serverTimestamp(), status: 'new' })
    .then(() => {
      btn.style.display = 'none';
      document.getElementById(containerId + '-success').style.display = 'block';
      fetch('/api/notify-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lead),
      }).catch(() => {});
    })
    .catch(err => {
      console.error('Lead save failed', err);
      btn.disabled = false;
      text.style.display   = 'block';
      loader.style.display = 'none';
      alert('Something went wrong. Please try again.');
    });
}

function fieldErr(containerId, field, msg) {
  const errEl   = document.getElementById(containerId + '-' + field + '-err');
  const inputEl = document.getElementById(containerId + '-' + field);
  if (errEl)   errEl.textContent = msg;
  if (inputEl) inputEl.style.borderColor = '#ff4444';
}

window.NotifyLeads = { render };
