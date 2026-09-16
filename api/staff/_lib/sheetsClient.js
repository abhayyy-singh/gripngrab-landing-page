/* ============================================================================
   api/staff/_lib/sheetsClient.js
   Read-only access to both attendance sources using the same service
   account as Firebase Admin SDK (shared as Viewer — never written to).

   Saket's sheet is a native Google Sheet -> read via Sheets API.
   Lajpat's sheet is an uploaded .xlsx file living in Drive, NOT converted
   to native Sheets format -> Sheets API v4 rejects it ("must not be an
   Office file"), so it's downloaded as raw bytes via Drive API and parsed
   with the xlsx library instead. listTabs/readTab auto-detect which path
   to use per fileId, so callers never need to care which kind of file
   they're pointed at.
   ============================================================================ */

const { google } = require('googleapis');
const XLSX = require('xlsx');
const { getServiceAccount } = require('./firebaseAdmin');

let cachedAuth = null;
const workbookCache = new Map(); // fileId -> parsed XLSX.WorkBook (per warm invocation)
const nativeCheckCache = new Map(); // fileId -> boolean — a file's type never changes mid-sync, so the
                                     // Drive metadata lookup is only worth doing once per fileId, not
                                     // once per tab read (a sync reads a dozen+ tabs per sheet).

function getAuth() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = new google.auth.GoogleAuth({
    credentials: getServiceAccount(),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
  return cachedAuth;
}

async function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

async function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

async function isNativeGoogleSheet(fileId) {
  if (nativeCheckCache.has(fileId)) return nativeCheckCache.get(fileId);
  const drive = await getDriveClient();
  const meta = await drive.files.get({ fileId, fields: 'mimeType' });
  const isNative = meta.data.mimeType === 'application/vnd.google-apps.spreadsheet';
  nativeCheckCache.set(fileId, isNative);
  return isNative;
}

async function getWorkbook(fileId) {
  if (workbookCache.has(fileId)) return workbookCache.get(fileId);
  const drive = await getDriveClient();
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  const wb = XLSX.read(Buffer.from(res.data), { type: 'buffer', cellDates: false });
  workbookCache.set(fileId, wb);
  return wb;
}

/** Returns the tab (sheet) titles for a file, in sheet order — works for
 *  both native Google Sheets and uploaded .xlsx files. */
async function listTabs(fileId) {
  if (await isNativeGoogleSheet(fileId)) {
    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: fileId, fields: 'sheets.properties' });
    return (meta.data.sheets || []).map(s => s.properties.title);
  }
  const wb = await getWorkbook(fileId);
  return wb.SheetNames;
}

/** Returns raw 2D array of cell values for one tab — works for both file kinds. */
async function readTab(fileId, tabName) {
  if (await isNativeGoogleSheet(fileId)) {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${tabName.replace(/'/g, "''")}'`,
    });
    return res.data.values || [];
  }
  const wb = await getWorkbook(fileId);
  const sheet = wb.Sheets[tabName];
  if (!sheet) return [];
  // raw:false -> formatted strings (dates render like "13-06-26", matching
  // how they'd read via Sheets API), matching what parseSheets.js expects.
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
}

module.exports = { listTabs, readTab };
