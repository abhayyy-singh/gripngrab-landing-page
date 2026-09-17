/* ============================================================================
   api/staff/_lib/parseSheets.js
   Normalizes raw rows from the Saket / Lajpat Nagar attendance sheets into
   member + payment records, or queues them to migration-review when
   anything is ambiguous. Rules validated against real sheet data during
   planning — see /Users/abhaysingh/.claude/plans/golden-scribbling-parnas.md

   Every review entry carries a `dedupeKey`:
   - member-level issues (missing plan/duration, ambiguous date, duplicate
     name) key on (type, center, name) — so the SAME underlying issue for
     the same person doesn't create a fresh review item every month it
     reappears in a later tab.
   - payment-level issues (unrecognized channel on one specific payment,
     one unmatched bank-receipt row) key on the sheet row reference — each
     occurrence is a distinct real event and should stay distinct.
   ============================================================================ */

const PLAN_CODE_MAP = { Y: 'yearly', HY: 'half-yearly', QTR: 'quarterly' };

const CHANNEL_RULES = [
  [/ANKIT/i,               'ankit'],
  [/ABHAY/i,               'abhay'],
  [/ARYAN/i,               'aryan'],
  [/HS\s*(BANK|CARD|SMS|UPI)/i, 'hs-bank'],
  [/HS\s*RAZOR|RAZOR|RZP|RZR/i, 'hs-razorpay'],
  [/HARISH/i,              'harish'],
  [/^CASH$/i,              'cash'],
  [/^CARD$/i,              'hs-bank'], // company card machine — company revenue, same bucket as HS Bank
];

function mapChannel(remarkText) {
  const t = (remarkText || '').toUpperCase();
  for (const [re, channel] of CHANNEL_RULES) {
    if (re.test(t)) return channel;
  }
  return null; // unrecognized — payment still created, but flagged for review
}

/* ---------- date parsing ---------- */

function xlSerialToDate(serial) {
  const n = parseFloat(serial);
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null;
  const ms = (n - 25569) * 86400 * 1000; // Excel epoch (1899-12-30) -> Unix epoch
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function parseDdMmYy(str) {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec((str || '').trim());
  if (!m) return null;
  let [, d, mo, y] = m;
  d = +d; mo = +mo; y = +y;
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function parseAnyDate(str) {
  return parseDdMmYy(str) || xlSerialToDate(str);
}

const PLAN_MONTHS = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 };

/** startDate + plan length -> due date. Used where the sheet has no
 *  explicit due-date column of its own (Saket) — Lajpat's own Due Date
 *  column is trusted as-is instead, since it may already reflect manual
 *  freeze/pause adjustments the sheet-keeper made. */
function computeDueDate(startDate, plan, customMonths) {
  if (!startDate) return null;
  const months = plan === 'custom' ? customMonths : PLAN_MONTHS[plan];
  if (!months) return null;
  const [y, mo, d] = startDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, mo - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

/* ---------- name normalization ---------- */

function normalizeName(raw) {
  return (raw || '')
    .toString()
    .toUpperCase()
    .replace(/\s+/g, ' ')   // collapse double spaces (seen in real data: "NAVJOT SINGH  (PERSONAL)")
    .trim();
}

/* ---------- row classification helpers ---------- */

function isFooterRow(name) {
  // "TOTAL", "G TOTAL", "CASH BILL TOTAL", etc. — any row that is purely a
  // summary label, not a person's name.
  return /\bTOTAL\b/i.test((name || '').trim());
}

function isPersonalTraining(name) {
  return /PERSONAL/i.test(name || '');
}

function isKid(name) {
  return /\bKID\b/i.test(name || '');
}

function isLowConfidenceName(name) {
  // "TRAIL"/"TRIAL" rows, parenthetical notes, etc. — not enough to classify
  // automatically, route to review rather than guess.
  return /TRAIL|TRIAL/i.test(name || '');
}

/* ---------- header detection ---------- */

function findHeaderRow(rows, requiredCol = 'NAME') {
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const row = rows[i] || [];
    if (row.some(c => (c || '').trim().toUpperCase() === requiredCol)) return i;
  }
  return -1;
}

function buildHeaderMap(headerRow) {
  const H = {};
  headerRow.forEach((c, i) => {
    const key = (c || '').trim().toUpperCase();
    if (key && !(key in H)) H[key] = i;
  });
  return H;
}

function get(row, idx) {
  if (idx == null || idx >= row.length) return '';
  return (row[idx] || '').toString().trim();
}

/** parseFloat("8,000.00") silently stops at the comma and returns 8 — every
 *  amount cell in these sheets uses thousands separators, so this bug
 *  quietly truncated real payments (8000 -> 8) until amounts are parsed
 *  through here instead of raw parseFloat(). */
function toNumber(str) {
  return parseFloat(String(str ?? '').replace(/,/g, '')) || 0;
}

const DAY_NAMES = /^(MON|TUE|WED|THU|THUR|FRI|SAT|SUN|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/i;

function isDecorativeRow(row, H) {
  const nameCell = get(row, H['NAME']);
  if (nameCell) return false;
  // a row with no name but several day-abbreviation cells is a decorative label row
  const dayLike = row.filter(c => DAY_NAMES.test((c || '').trim())).length;
  return dayLike >= 2;
}

function safeKey(...parts) {
  return parts.join('__').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 140);
}

/* ---------- attendance ("P" mark) columns ----------
   Both sheets carry one column per calendar day (header e.g. "01/09/2026"
   or "01-09-26") with "P" marked for a present day. This is the same
   attendance data used to decide who's still actively coming — no
   separate sheet needed, it just wasn't being read before. */
const DATE_COL_RE = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/;

function findAttendanceColumns(headerRow) {
  const cols = [];
  headerRow.forEach((c, i) => {
    const m = DATE_COL_RE.exec((c || '').trim());
    if (!m) return;
    let [, d, mo, y] = m; d = +d; mo = +mo; y = +y; if (y < 100) y += 2000;
    const iso = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cols.push({ index: i, date: iso });
  });
  return cols;
}

/** Returns { presentCount, lastAttendedDate } for one member's row. */
function parseAttendance(row, attendanceCols) {
  let presentCount = 0, lastAttendedDate = null;
  for (const { index, date } of attendanceCols) {
    const v = get(row, index).toUpperCase();
    if (v === 'P') {
      presentCount++;
      if (!lastAttendedDate || date > lastAttendedDate) lastAttendedDate = date;
    }
  }
  return { presentCount, lastAttendedDate };
}

/* ============================================================================
   SAKET — "START DATE" cell mixes date + plan code, e.g. "13-06-26 Y"
   ============================================================================ */
function parseSaketTab(rows, { sheet = 'saket', tab = '' } = {}) {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) {
    return { members: [], review: [{ type: 'unclassified-row', sheet, tab, dedupeKey: safeKey('no-header', sheet, tab), rawData: { note: 'no header row found' }, status: 'pending' }] };
  }

  const H = buildHeaderMap(rows[headerIdx]);
  const attendanceCols = findAttendanceColumns(rows[headerIdx]);
  const members = [];
  const review = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (isDecorativeRow(row, H)) continue;
    const rawName = get(row, H['NAME']);
    if (!rawName) continue;
    if (isFooterRow(rawName)) continue;

    const name = normalizeName(rawName);
    const rawStart = get(row, H['START DATE']);
    const remark   = get(row, H['REMARK']);
    const cash     = get(row, H['CASH']);
    const bank     = get(row, H['BANK']);
    const email    = get(row, H['EMAIL']) || get(row, H['MAIL']);
    const mobile   = get(row, H['MOB']) || get(row, H['MOBILE']);

    const rowRef = `${tab}!row${i + 1}`;
    const base = { center: 'saket', name, email, mobile, sourceSheetRowRef: rowRef };

    if (isLowConfidenceName(name)) {
      review.push({ type: 'unclassified-row', sheet, tab, dedupeKey: safeKey('low-confidence', sheet, name), rawData: { name, row }, status: 'pending' });
      continue;
    }

    const memberType = isPersonalTraining(name) ? 'personal-training' : isKid(name) ? 'kids' : 'general';

    const m = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*([A-Za-z]*)\s*$/.exec(rawStart);
    let startDate = null, planCode = '';
    if (m) {
      startDate = parseDdMmYy(m[1]);
      planCode = m[2].toUpperCase();
    } else if (/^NA$/i.test(rawStart)) {
      startDate = null; // valid "no start date yet" state, not an error
    } else if (rawStart) {
      startDate = xlSerialToDate(rawStart);
    }

    let plan = null;
    if (planCode === '') {
      review.push({ type: 'missing-plan', sheet, tab, dedupeKey: safeKey('missing-plan', sheet, name), rawData: { name, rawStart }, status: 'pending' });
    } else {
      plan = PLAN_CODE_MAP[planCode] || null;
      if (!plan) {
        review.push({ type: 'unclassified-row', sheet, tab, dedupeKey: safeKey('bad-plan-code', sheet, name), rawData: { name, planCode }, status: 'pending' });
      }
    }

    if (startDate === null && rawStart && !/^NA$/i.test(rawStart)) {
      review.push({ type: 'ambiguous-date', sheet, tab, dedupeKey: safeKey('ambiguous-date', sheet, name), rawData: { name, rawStart }, status: 'pending' });
    }

    const { presentCount, lastAttendedDate } = parseAttendance(row, attendanceCols);

    members.push({
      ...base,
      memberType,
      plan,
      startDate,
      // dueDate is NOT computed here — it's computed once, at the very end
      // of sync-sheets.js, from the fully-merged startDate/plan/lastPaymentDate.
      // Computing it per-tab here caused a real bug: a later tab with a blank
      // plan code would fail to recompute, and the coalesce-merge would keep
      // whatever stale dueDate an earlier tab had set — even after startDate
      // itself had since changed (e.g. on a rejoin).
      firstJoinedDate: startDate,
      remarkRaw: remark,
      __presentCount: presentCount,
      lastAttendedDate,
    });

    // The CASH / BANK columns are themselves the channel signal for the cash
    // portion (unambiguous), and for a bank portion the REMARK says which
    // recipient (Harish/Ankit/HS Bank/...) it went to. Both can be filled at
    // once (a split cash+bank payment) — both legs are kept, not just one.
    const legs = [];
    if (cash) {
      legs.push({ channel: 'cash', amount: toNumber(cash), centerCredit: 'saket' });
    }
    if (bank) {
      const channel = mapChannel(remark);
      legs.push({ channel: channel || 'unknown', amount: toNumber(bank), centerCredit: 'saket' });
      if (!channel) {
        review.push({ type: 'unmapped-payment-channel', sheet, tab, dedupeKey: safeKey('unmapped-channel', sheet, rowRef), rawData: { name, remark, bank }, status: 'pending' });
      }
    }
    if (legs.length) {
      // Saket's sheet has no per-payment date column at all — the tab name
      // (which month it was recorded in) is the closest we have.
      members[members.length - 1].__pendingPayment = {
        totalAmount: legs.reduce((s, l) => s + l.amount, 0), legs, remarkRaw: remark, source: 'migration',
        date: null, paymentTab: tab,
      };
    }
  }

  return { members, review };
}

/* ============================================================================
   LAJPAT — clean DURATION / Due Date / FREEZE columns
   ============================================================================ */
const DURATION_TO_PLAN = { '1': 'monthly', '3': 'quarterly', '6': 'half-yearly', '12': 'yearly' };

function parseLajpatTab(rows, { sheet = 'lajpat', tab = '' } = {}) {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) {
    return { members: [], review: [{ type: 'unclassified-row', sheet, tab, dedupeKey: safeKey('no-header', sheet, tab), rawData: { note: 'no header row found' }, status: 'pending' }] };
  }

  const H = buildHeaderMap(rows[headerIdx]);
  const attendanceCols = findAttendanceColumns(rows[headerIdx]);
  const members = [];
  const review = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const rawName = get(row, H['NAME']);
    if (!rawName) continue;
    if (isFooterRow(rawName)) continue;

    const name = normalizeName(rawName);
    const rawJoin   = get(row, H['JOINING DATE']);
    const rawDue    = get(row, H['DUE DATE']);
    const rawPayRec = get(row, H['PAY- REC -DATE']);
    const duration  = get(row, H['DURATION']);
    const freeze    = get(row, H['FREEZE']);
    const amount    = get(row, H['AMOUNT']);
    const pmode     = get(row, H['PAYMENT MODE']);
    const remark    = get(row, H['REMARK']);
    const email     = get(row, H['MAIL']) || get(row, H['EMAIL']);
    const mobile    = get(row, H['MOBILE']) || get(row, H['MOB']);

    const rowRef = `${tab}!row${i + 1}`;
    const base = { center: 'lajpat', name, email, mobile, sourceSheetRowRef: rowRef };

    if (isLowConfidenceName(name)) {
      review.push({ type: 'unclassified-row', sheet, tab, dedupeKey: safeKey('low-confidence', sheet, name), rawData: { name, row }, status: 'pending' });
      continue;
    }

    const memberType = isPersonalTraining(name) ? 'personal-training' : isKid(name) ? 'kids' : 'general';
    const startDate = parseAnyDate(rawJoin);
    const dueDate = parseAnyDate(rawDue);

    let plan = null;
    if (!duration) {
      review.push({ type: 'missing-plan', sheet, tab, dedupeKey: safeKey('missing-plan', sheet, name), rawData: { name, note: 'missing duration' }, status: 'pending' });
    } else {
      const durKey = String(toNumber(duration));
      plan = DURATION_TO_PLAN[durKey] || 'custom'; // any non-standard duration (2, 4, 1.5 months...) is a legitimate custom plan, not an error
    }

    if (startDate === null && rawJoin) {
      review.push({ type: 'ambiguous-date', sheet, tab, dedupeKey: safeKey('ambiguous-date', sheet, name), rawData: { name, rawJoin, rawDue, duration }, status: 'pending' });
    }

    const { presentCount, lastAttendedDate } = parseAttendance(row, attendanceCols);

    members.push({
      ...base,
      memberType,
      plan,
      customDurationMonths: plan === 'custom' ? toNumber(duration) : null,
      startDate,
      // sheetDueDate is kept for reference only — the live dueDate used for
      // status is computed once at the end of sync (same formula as Saket),
      // since the sheet's own Due Date can go stale the same way a
      // per-tab-computed one did (see the note in parseSaketTab above).
      sheetDueDate: dueDate,
      firstJoinedDate: startDate,
      pauseDaysTotal: freeze ? (parseFloat(freeze) || 0) : 0,
      remarkRaw: remark,
      __presentCount: presentCount,
      lastAttendedDate,
    });

    if (amount) {
      const channel = mapChannel(pmode) || mapChannel(remark);
      const leg = { channel: channel || 'unknown', amount: toNumber(amount), centerCredit: 'lajpat' };
      if (!channel) {
        review.push({ type: 'unmapped-payment-channel', sheet, tab, dedupeKey: safeKey('unmapped-channel', sheet, rowRef), rawData: { name, pmode, remark, amount }, status: 'pending' });
      }
      members[members.length - 1].__pendingPayment = {
        totalAmount: leg.amount, legs: [leg], remarkRaw: remark, source: 'migration',
        date: parseAnyDate(rawPayRec), paymentTab: tab,
      };
    }
  }

  return { members, review };
}

/**
 * Lightweight suggestion for a near-miss name match: shares its first token
 * (first name) with a known member, or one name is fully contained in the
 * other after whitespace normalization. Not auto-applied — just a hint
 * shown to whoever resolves the review queue.
 */
function suggestMatch(name, knownNames) {
  const firstToken = name.split(' ')[0];
  let best = null;
  for (const known of knownNames) {
    if (known === name) continue;
    if (known.includes(name) || name.includes(known)) return known; // strong hint, return immediately
    if (known.split(' ')[0] === firstToken && firstToken.length > 2) best = best || known;
  }
  return best;
}

/**
 * Matches Lajpat's separate "BANK RECEIPTS" tab (NAME, DATE, AMT, LN, SAKET, MODE)
 * against already-parsed members by exact uppercased name. `members` should
 * be the COMBINED Saket + Lajpat directory — this ledger is a shared company
 * bank account, so Saket members' payments show up here too (confirmed
 * against real data: e.g. "RAJSHREE SHEKHAWAT" is a Saket member whose
 * payment is only recorded in this Lajpat-hosted tab). The LN/SAKET amount
 * columns on each row already say which center's books the money credits,
 * independent of which center the member is physically registered at.
 * Anything not an exact name match is queued for manual confirmation (with
 * a best-effort suggestion) rather than fuzzy-auto-matched.
 */
function matchBankReceipts(rows, members, { sheet = 'lajpat', tab = 'BANK RECEIPTS', dateFrom = null, dateTo = null } = {}) {
  // This tab has no literal "NAME" header — its first column holds a
  // month-label like "JUN -26" instead. Detect the header by "DATE" instead,
  // and always treat column 0 as the name column.
  const headerIdx = findHeaderRow(rows, 'DATE');
  if (headerIdx === -1) return { payments: [], review: [] };
  const H = buildHeaderMap(rows[headerIdx]);
  H['NAME'] = 0;
  const knownNames = members.map(m => m.name);
  const byName = new Map(members.map(m => [m.name, m]));
  const payments = [];
  const review = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const rawName = get(row, H['NAME']);
    const amtCheck = get(row, H['AMT']);
    // section-divider rows (e.g. "JUL -26" marking a new month's block) have
    // a name-like cell but no amount — skip them without treating as data
    if (!rawName || !amtCheck) continue;
    if (isFooterRow(rawName)) continue;

    const name = normalizeName(rawName);
    const date = get(row, H['DATE']);
    const amt  = get(row, H['AMT']);
    const ln   = get(row, H['LN']);
    const saket = get(row, H['SAKET']);
    const mode = get(row, H['MODE']);
    if (!amt) continue;

    const parsedDate = parseAnyDate(date);
    if (dateFrom && parsedDate && parsedDate < dateFrom) continue; // out of migration scope, not a data issue
    if (dateTo && parsedDate && parsedDate > dateTo) continue;

    const member = byName.get(name);
    const rowRef = `${tab}!row${i + 1}`;

    if (!member) {
      review.push({
        type: 'name-mismatch', sheet, tab,
        dedupeKey: safeKey('name-mismatch', sheet, rowRef),
        rawData: { name, date, amt, mode },
        suggestedMatch: suggestMatch(name, knownNames),
        status: 'pending',
      });
      continue;
    }

    const legs = [];
    if (toNumber(ln))    legs.push({ channel: mapChannel(mode) || 'unknown', amount: toNumber(ln), centerCredit: 'lajpat' });
    if (toNumber(saket)) legs.push({ channel: mapChannel(mode) || 'unknown', amount: toNumber(saket), centerCredit: 'saket' });
    if (!legs.length) legs.push({ channel: mapChannel(mode) || 'unknown', amount: toNumber(amt), centerCredit: 'lajpat' });

    payments.push({
      memberName: name,
      totalAmount: toNumber(amt),
      date: parsedDate,
      legs,
      remarkRaw: mode,
      source: 'migration',
      sourceSheetRowRef: rowRef,
    });

    if (legs.some(l => l.channel === 'unknown')) {
      review.push({ type: 'unmapped-payment-channel', sheet, tab, dedupeKey: safeKey('unmapped-channel', sheet, rowRef), rawData: { name, mode, amt }, status: 'pending' });
    }
  }

  return { payments, review };
}

/**
 * Lightweight check used for the long-cycle-plan payment lookback: does
 * this ONE member's row in this ONE tab show any payment amount? Doesn't
 * parse the whole tab into members/review items — just answers "was a
 * payment recorded here", so scanning many months of old tabs for a
 * handful of long-cycle members stays cheap and never creates new member
 * or review records from historical data.
 */
/** Returns the payment amount found for this member in this tab (0 if
 *  none) — used by the long-cycle lookback both to check presence (amount
 *  truthy) and, since the lookback tabs are already being read anyway, to
 *  recover a lastPaymentAmount for members whose only known payment lives
 *  outside the current sync's 3-month window (real case: a member found
 *  only via lookback never gets a payment doc rewritten in the current
 *  run, so without this the amount would never surface for plan-guessing). */
function checkPaymentPresence(rows, name, center) {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx === -1) return 0;
  const H = buildHeaderMap(rows[headerIdx]);
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const rowName = normalizeName(get(row, H['NAME']));
    if (rowName !== name) continue;
    if (center === 'saket') {
      return toNumber(get(row, H['CASH'])) + toNumber(get(row, H['BANK']));
    }
    return toNumber(get(row, H['AMOUNT']));
  }
  return 0;
}

module.exports = {
  parseSaketTab, parseLajpatTab, matchBankReceipts,
  parseAnyDate, parseDdMmYy, xlSerialToDate, normalizeName,
  mapChannel, findHeaderRow, buildHeaderMap,
  findAttendanceColumns, parseAttendance, computeDueDate, toNumber,
  checkPaymentPresence,
};
