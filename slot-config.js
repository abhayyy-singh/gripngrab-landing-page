/* ============================================================================
   slot-config.js — Grip & Grab
   Reads slot availability from Firestore and patches window.HARISH_CONFIG
   and window.CENTER_CONFIG so slots can be toggled from the admin panel
   without any code changes.
   ============================================================================ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyB8hiRT58l-n5f5nbaqtuViCJeOqEMp-_k',
  authDomain:        'gripngrab.firebaseapp.com',
  projectId:         'gripngrab',
  storageBucket:     'gripngrab.firebasestorage.app',
  messagingSenderId: '568040807328',
  appId:             '1:568040807328:web:e9ee4f1328064a3d69e2c5',
};

const app = initializeApp(FIREBASE_CONFIG, 'gng-slots');
const db  = getFirestore(app);

async function loadSlotConfig() {
  try {
    const [hmSnap, saketSnap, lajpatSnap] = await Promise.all([
      getDoc(doc(db, 'slot-config', 'haristhenics')),
      getDoc(doc(db, 'slot-config', 'saket')),
      getDoc(doc(db, 'slot-config', 'lajpat')),
    ]);

    /* Haristhenics */
    if (hmSnap.exists() && window.HARISH_CONFIG) {
      const d = hmSnap.data();
      if (typeof d.available === 'boolean') window.HARISH_CONFIG.available = d.available;
    }

    const CC = window.CENTER_CONFIG;

    /* Saket */
    if (saketSnap.exists() && CC && CC['Grip&Grab Saket']) {
      const d = saketSnap.data();
      if (typeof d.membership === 'boolean') CC['Grip&Grab Saket'].available        = d.membership;
      if (typeof d.trial      === 'boolean') CC['Grip&Grab Saket'].trialAvailable   = d.trial;
      if (typeof d.daypass    === 'boolean') CC['Grip&Grab Saket'].daypassAvailable = d.daypass;
    }

    /* Lajpat Nagar */
    if (lajpatSnap.exists() && CC && CC['Grip&Grab Lajpat Nagar']) {
      const d = lajpatSnap.data();
      if (typeof d.membership === 'boolean') CC['Grip&Grab Lajpat Nagar'].available        = d.membership;
      if (typeof d.trial      === 'boolean') CC['Grip&Grab Lajpat Nagar'].trialAvailable   = d.trial;
      if (typeof d.daypass    === 'boolean') CC['Grip&Grab Lajpat Nagar'].daypassAvailable = d.daypass;
    }

  } catch (e) {
    /* On failure, hardcoded defaults in script.js remain active */
    console.warn('[slot-config] Using hardcoded defaults:', e.message);
  }
}

loadSlotConfig();
