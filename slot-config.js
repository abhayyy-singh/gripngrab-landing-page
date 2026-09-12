/* ============================================================================
   slot-config.js — Grip & Grab
   Reads slot availability via Firestore REST API (no auth needed).
   Patches window.HARISH_CONFIG and window.CENTER_CONFIG so slots can be
   toggled from the admin panel without any code changes.
   ============================================================================ */

const API_KEY   = 'AIzaSyB8hiRT58l-n5f5nbaqtuViCJeOqEMp-_k';
const BASE      = `https://firestore.googleapis.com/v1/projects/gripngrab/databases/(default)/documents`;

async function getDocRest(path) {
  const r = await fetch(`${BASE}/${path}?key=${API_KEY}`);
  if (!r.ok) return null;
  const json = await r.json();
  if (!json.fields) return null;
  /* Convert Firestore field format → plain object */
  const out = {};
  for (const [k, v] of Object.entries(json.fields)) {
    if      ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('integerValue'  in v) out[k] = Number(v.integerValue);
    else if ('doubleValue'   in v) out[k] = v.doubleValue;
    else if ('stringValue'   in v) out[k] = v.stringValue;
  }
  return out;
}

async function loadSlotConfig() {
  try {
    const [hm, saket, lajpat, pricing, sundayHiit] = await Promise.all([
      getDocRest('slot-config/haristhenics'),
      getDocRest('slot-config/saket'),
      getDocRest('slot-config/lajpat'),
      getDocRest('pricing-config/trial'),
      getDocRest('slot-config/sunday-hiit'),
    ]);

    /* Trial price */
    if (pricing && pricing.amountPaise) {
      window.GNG_PRICING = { trialAmountPaise: pricing.amountPaise };
    }

    /* Haristhenics */
    if (hm && window.HARISH_CONFIG && typeof hm.available === 'boolean') {
      window.HARISH_CONFIG.available = hm.available;
    }

    /* Sunday HIIT */
    if (sundayHiit && window.SUNDAY_HIIT_CONFIG && typeof sundayHiit.available === 'boolean') {
      window.SUNDAY_HIIT_CONFIG.available = sundayHiit.available;
    }
    if (typeof window.onSundayHiitConfigLoaded === 'function') {
      window.onSundayHiitConfigLoaded();
    }

    const CC = window.CENTER_CONFIG;

    /* Saket */
    if (saket && CC && CC['Grip&Grab Saket']) {
      if (typeof saket.membership === 'boolean') CC['Grip&Grab Saket'].available        = saket.membership;
      if (typeof saket.trial      === 'boolean') CC['Grip&Grab Saket'].trialAvailable   = saket.trial;
      if (typeof saket.daypass    === 'boolean') CC['Grip&Grab Saket'].daypassAvailable = saket.daypass;
    }

    /* Lajpat Nagar */
    if (lajpat && CC && CC['Grip&Grab Lajpat Nagar']) {
      if (typeof lajpat.membership === 'boolean') CC['Grip&Grab Lajpat Nagar'].available        = lajpat.membership;
      if (typeof lajpat.trial      === 'boolean') CC['Grip&Grab Lajpat Nagar'].trialAvailable   = lajpat.trial;
      if (typeof lajpat.daypass    === 'boolean') CC['Grip&Grab Lajpat Nagar'].daypassAvailable = lajpat.daypass;
    }

  } catch (e) {
    console.warn('[slot-config] REST read failed, using defaults:', e.message);
    if (typeof window.onSundayHiitConfigLoaded === 'function') {
      window.onSundayHiitConfigLoaded();
    }
  }
}

loadSlotConfig();
