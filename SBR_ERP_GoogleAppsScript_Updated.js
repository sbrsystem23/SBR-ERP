// ═══════════════════════════════════════════════════════════════
// SBR SYSTEM ERP — Google Apps Script v5
// Updated: CORS + JSONP support for cloud/Netlify access
// Deploy → Web App → Execute as Me → Access: Anyone
// ═══════════════════════════════════════════════════════════════

var SHEET_ID   = '1ulAYaxfrmOb_bj9BJwkiIC5CNGKeirIaQFBLtZfgkjU';
var SHEET_NAME = 'ERP_Data';
var GEMINI_KEY = 'AIzaSyAhM4-R2kVGSKfaOnFB2q3GrkZePvOueeI';
var GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';

// ── GET ──
function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  var action   = p.action   || 'load';
  var callback = p.callback || '';   // JSONP support

  var result;
  if (action === 'load')  result = handleLoad();
  else if (action === 'ping') result = {status:'ok', message:'SBR ERP v5 running'};
  else if (action === 'ai')   result = handleAI(p.prompt || '');
  else result = {status:'error', error:'Unknown action'};

  // If callback provided → JSONP response (bypasses CORS)
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return out(result);
}

// ── POST ──
function doPost(e) {
  try {
    var body = e.postData.contents;
    var p = JSON.parse(body);
    if (p.action === 'save') return out(handleSave(p.data));
    if (p.action === 'ai')   return out(handleAI(p.prompt || ''));
    return out({status:'error', error:'Unknown POST action'});
  } catch(err) {
    return out({status:'error', error: err.message});
  }
}

// ── AI proxy ──
function handleAI(prompt) {
  if (!prompt || prompt.trim() === '') return {status:'error', error:'Empty prompt'};
  try {
    var resp = UrlFetchApp.fetch(GEMINI_URL + GEMINI_KEY, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{parts: [{text: prompt}]}],
        generationConfig: {temperature: 0.2, maxOutputTokens: 600}
      }),
      muteHttpExceptions: true
    });
    var result = JSON.parse(resp.getContentText());
    var text = result.candidates &&
               result.candidates[0] &&
               result.candidates[0].content &&
               result.candidates[0].content.parts &&
               result.candidates[0].content.parts[0] &&
               result.candidates[0].content.parts[0].text;
    if (text) return {status:'ok', text: text.trim()};
    return {status:'error', error:'No text from Gemini'};
  } catch(err) {
    return {status:'error', error: err.message};
  }
}

// ── Save ──
function handleSave(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    var json  = typeof data === 'string' ? data : JSON.stringify(data);
    sheet.getRange('A1').setValue(json);
    sheet.getRange('B1').setValue(new Date().toLocaleString('en-GB'));
    sheet.getRange('C1').setValue('SBR ERP Cloud v5');
    var parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return {status:'ok', savedAt: parsed.savedAt || new Date().toISOString()};
  } catch(err) {
    return {status:'error', error: err.message};
  }
}

// ── Load ──
function handleLoad() {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return {status:'ok', data: null};
    var raw = sheet.getRange('A1').getValue();
    if (!raw) return {status:'ok', data: null};
    return {status:'ok', data: JSON.parse(raw)};
  } catch(err) {
    return {status:'error', error: err.message};
  }
}

// ── Auth test ──
function authorizeMe() {
  UrlFetchApp.fetch('https://www.google.com');
  SpreadsheetApp.openById(SHEET_ID);
  Logger.log('Authorization complete!');
}

// ── Output helper ──
function out(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
