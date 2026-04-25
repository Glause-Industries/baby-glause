/**
 * Baby Glause — Google Apps Script Backend
 * Deploy as Web App: Execute as Me, Anyone can access
 *
 * Sheet structure:
 *   Sheet1 "config"   → key | value
 *   Sheet2 "journal"  → id | date | title | body | imageData
 *   Sheet3 "events"   → raw (single cell A1 with pasted event text)
 *   Sheet4 "brief"    → key | value  (for custom brief override text)
 */

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const ADMIN_PASSWORD = 'babyglause2026'; // ← Change this!

// ─────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────

function doGet(e) {
  const action  = e.parameter.action  || 'read';
  const pass    = e.parameter.pass    || '';
  const payload = e.parameter.payload || '{}';

  // Public read — no auth needed
  if (action === 'read') {
    return jsonResponse(readAll());
  }

  // Write actions via GET (avoids CORS preflight issues)
  let body;
  try { body = JSON.parse(payload); } catch { return jsonResponse({ error: 'Invalid payload' }); }

  if (pass !== ADMIN_PASSWORD) return jsonResponse({ error: 'Unauthorized' });

  if (action === 'saveJournal') return jsonResponse(saveJournal(body.entries));
  if (action === 'saveEvents')  return jsonResponse(saveEvents(body.raw));
  if (action === 'saveConfig')  return jsonResponse(saveConfig(body.config));

  return jsonResponse({ error: 'Unknown action' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' });
  }

  // Auth check for all writes
  if (body.pass !== ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Unauthorized' });
  }

  const action = body.action || '';

  if (action === 'saveJournal')  return jsonResponse(saveJournal(body.entries));
  if (action === 'saveEvents')   return jsonResponse(saveEvents(body.raw));
  if (action === 'saveConfig')   return jsonResponse(saveConfig(body.config));
  if (action === 'uploadImage')  return jsonResponse(uploadImage(body.imageData, body.filename));

  return jsonResponse({ error: 'Unknown action' });
}

// ─────────────────────────────────────────
// READ ALL (public)
// ─────────────────────────────────────────

function readAll() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Config
  const configSheet = getOrCreate(ss, 'config');
  const config = sheetToMap(configSheet);

  // Journal
  const journalSheet = getOrCreate(ss, 'journal');
  const journalRows  = journalSheet.getDataRange().getValues();
  const journal = [];
  for (let i = 1; i < journalRows.length; i++) {
    const [id, rawDate, title, body, imageData] = journalRows[i];
    if (!title) continue;
    // Normalize date: if Sheets returned a Date object, format as YYYY-MM-DD
    let date = rawDate;
    if (rawDate instanceof Date) {
      const y = rawDate.getFullYear();
      const m = String(rawDate.getMonth() + 1).padStart(2, '0');
      const d = String(rawDate.getDate()).padStart(2, '0');
      date = y + '-' + m + '-' + d;
    } else if (typeof rawDate === 'string') {
      // Strip any trailing time component (T...) if present
      date = rawDate.replace(/T.*$/, '').trim();
    }
    journal.push({ id, date, title, body, imageData: imageData || '' });
  }

  // Events raw text
  const eventsSheet = getOrCreate(ss, 'events');
  const eventsRaw = eventsSheet.getRange('A1').getValue() || '';

  return { config, journal, eventsRaw, ok: true };
}

// ─────────────────────────────────────────
// WRITE JOURNAL
// ─────────────────────────────────────────

function saveJournal(entries) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate(ss, 'journal');
  sheet.clearContents();
  sheet.appendRow(['id', 'date', 'title', 'body', 'imageData']);
  entries.forEach((e, i) => {
    sheet.appendRow([e.id || (i + 1), e.date, e.title, e.body, e.imageData || '']);
  });
  return { ok: true };
}

// ─────────────────────────────────────────
// UPLOAD IMAGE TO DRIVE
// ─────────────────────────────────────────

function uploadImage(dataUrl, filename) {
  try {
    // Parse the data URL: data:image/jpeg;base64,/9j/...
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return { error: 'Invalid image data' };
    const mimeType = match[1];
    const base64   = match[2];
    const blob     = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, filename || 'ultrasound.jpg');

    // Save to a Baby Glause folder in Drive
    let folder;
    const folders = DriveApp.getFoldersByName('Baby Glause Images');
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder('Baby Glause Images');
    }

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Return a direct image URL (works for <img> tags)
    const fileId = file.getId();
    const url = 'https://lh3.googleusercontent.com/d/' + fileId;
    return { ok: true, url, fileId };
  } catch(err) {
    return { error: err.toString() };
  }
}

// ─────────────────────────────────────────
// WRITE EVENTS RAW TEXT
// ─────────────────────────────────────────

function saveEvents(raw) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate(ss, 'events');
  sheet.getRange('A1').setValue(raw || '');
  return { ok: true };
}

// ─────────────────────────────────────────
// WRITE CONFIG
// ─────────────────────────────────────────

function saveConfig(config) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate(ss, 'config');
  sheet.clearContents();
  sheet.appendRow(['key', 'value']);
  Object.entries(config).forEach(([k, v]) => sheet.appendRow([k, v]));
  return { ok: true };
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function getOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function sheetToMap(sheet) {
  const rows = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) map[rows[i][0]] = rows[i][1];
  }
  return map;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────
// ONE-TIME SETUP (run manually once)
// ─────────────────────────────────────────

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreate(ss, 'config').appendRow(['key', 'value']);
  getOrCreate(ss, 'journal').appendRow(['id', 'date', 'title', 'body', 'imageData']);
  getOrCreate(ss, 'events');
  Logger.log('Setup complete!');
}
