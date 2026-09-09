// ═══════════════════════════════════════════════════
// SBR ERP — SHARED CORE
// Google Sheets DB + Auth + Common Functions
// ═══════════════════════════════════════════════════

const SHEET_URL = '/.netlify/functions/sheet'; // Proxy to avoid CORS
const APP_VERSION = 'v2026-cloud-1.0';

// ── AUTH ──────────────────────────────────────────
const USERS = [
  { username: 'bilal',    password: 'SBR@Admin2026', name: 'Bilal Ashraf',  role: 'Admin' },
  { username: 'admin',    password: 'SBR@Admin2026', name: 'Administrator', role: 'Admin' },
];

function checkAuth() {
  const sess = sessionStorage.getItem('sbr_user');
  if (!sess) { window.location.href = 'index.html'; return null; }
  return JSON.parse(sess);
}

function login(username, password) {
  const user = USERS.find(u => u.username === username.toLowerCase() && u.password === password);
  if (!user) return false;
  sessionStorage.setItem('sbr_user', JSON.stringify(user));
  return true;
}

function logout() {
  sessionStorage.removeItem('sbr_user');
  window.location.href = 'index.html';
}

function getCurrentUser() {
  const sess = sessionStorage.getItem('sbr_user');
  return sess ? JSON.parse(sess) : null;
}

// ── DATA STORE ────────────────────────────────────
// All data lives here, synced from/to Google Sheets
window.SBR = window.SBR || {
  clients: [], cIdCtr: 1,
  invoices: [], iIdCtr: 90,
  receipts: [], recIdCtr: 90,
  deliveryNotes: [], dIdCtr: 90,
  savedQuotations: [], qtIdCtr: 90, quotGroupCtr: 1,
  projects: [], projIdCtr: 1,
  productDB: [], pIdCtr: 1,
  services: [], svcIdCtr: 1,
  suppliers: [], supplierIdCtr: 1,
  inventory: [], stkIdCtr: 1,
  staff: [], hrIdCtr: 1,
  appointments: [], apptIdCtr: 1,
  lpos: [], lpoIdCtr: 90,
  amcQuotations: [], amcQIdCtr: 90,
  amcContracts: [], amcIdCtr: 1,
  amcVisits: [], visitIdCtr: 1,
  cats: {
    client:['Residential','Commercial','Developer','Government','Consultant'],
    proj:['New Installation','Retrofit','Upgrade','Maintenance','Consultation'],
    terms:['100% Advance','50% Advance · 50% on Completion','30/40/30','As per LPO','Monthly'],
    deliv:['Hand Delivery','Courier','On Site'],
    qtStatus:['Estimate','Sent','Under Discussion','Approved','Rejected','On Hold'],
    invStatus:['Draft','Sent','Paid','Overdue','Cancelled'],
    dnStatus:['Draft','Delivered','Partial','Returned'],
    recStatus:['Received','Pending','Cancelled'],
  },
  companyInfo: {
    name:'SBR System LLC',
    addr:'Office AB0910, JAFZA One, Dubai, UAE',
    phone:'+971 4 2293610',
    email:'info@sbrsystem.ae',
    trn:'104122809700003',
    bank:'Emirates NBD',
    acname:'SBR System LLC',
    acnum:'1304766692000 1',
    iban:'AE090030013047666920001',
    swift:'EBILAEAD',
  },
  SBR_KEY_TERMS: [
    'VAT @ 5% as per UAE Federal Tax Authority.',
    'Prices are valid for 7 days from the date of this quotation.',
    'Supply only — installation not included unless stated.',
    'Delivery charges may apply depending on location.',
    'Warranty as per manufacturer\'s terms.',
    'No civil work included.',
  ],
  SBR_TNC: [],
  lastSaved: null,
};

// ── GOOGLE SHEETS SYNC ────────────────────────────
let _syncTimer = null;
let _syncStatus = 'idle'; // idle | saving | saved | error

function collectData() {
  return {
    clients: SBR.clients, cIdCtr: SBR.cIdCtr,
    invoices: SBR.invoices, iIdCtr: SBR.iIdCtr,
    receipts: SBR.receipts, recIdCtr: SBR.recIdCtr,
    deliveryNotes: SBR.deliveryNotes, dIdCtr: SBR.dIdCtr,
    savedQuotations: SBR.savedQuotations, qtIdCtr: SBR.qtIdCtr, quotGroupCtr: SBR.quotGroupCtr,
    projects: SBR.projects, projIdCtr: SBR.projIdCtr,
    productDB: SBR.productDB, pIdCtr: SBR.pIdCtr,
    services: SBR.services, svcIdCtr: SBR.svcIdCtr,
    suppliers: SBR.suppliers, supplierIdCtr: SBR.supplierIdCtr,
    inventory: SBR.inventory, stkIdCtr: SBR.stkIdCtr,
    staff: SBR.staff, hrIdCtr: SBR.hrIdCtr,
    appointments: SBR.appointments, apptIdCtr: SBR.apptIdCtr,
    lpos: SBR.lpos, lpoIdCtr: SBR.lpoIdCtr,
    amcQuotations: SBR.amcQuotations, amcQIdCtr: SBR.amcQIdCtr,
    amcContracts: SBR.amcContracts, amcIdCtr: SBR.amcIdCtr,
    amcVisits: SBR.amcVisits, visitIdCtr: SBR.visitIdCtr,
    cats: SBR.cats,
    companyInfo: SBR.companyInfo,
    keyTerms: SBR.SBR_KEY_TERMS,
    tnc: SBR.SBR_TNC,
    savedAt: new Date().toISOString(),
  };
}

function applyData(data) {
  if (!data) return;
  // Normalize clients — old ERP uses phones[] and persons[] arrays
  if (data.clients) {
    data.clients = data.clients.map(c => {
      // Extract primary phone from phones array if exists
      if (!c.phone && c.phones && c.phones.length) c.phone = c.phones[0].number || '';
      // Extract primary email from persons if not set
      if (!c.email && c.persons && c.persons.length) c.email = c.persons[0].email || '';
      // Extract contact person name
      if (!c.contact && c.persons && c.persons.length) c.contact = c.persons[0].name || '';
      return c;
    });
  }
  // Normalize suppliers
  if (data.suppliers) {
    data.suppliers = data.suppliers.map(s => {
      if (!s.phone && s.phones && s.phones.length) s.phone = s.phones[0].number || '';
      return s;
    });
  }
  Object.assign(SBR, {
    clients: data.clients || [],
    cIdCtr: Math.max(data.cIdCtr || 1, 1),
    invoices: data.invoices || [],
    iIdCtr: Math.max(data.iIdCtr || 90, 90),
    receipts: data.receipts || [],
    recIdCtr: Math.max(data.recIdCtr || 90, 90),
    deliveryNotes: data.deliveryNotes || [],
    dIdCtr: Math.max(data.dIdCtr || 90, 90),
    savedQuotations: data.savedQuotations || [],
    qtIdCtr: Math.max(data.qtIdCtr || 90, 90),
    quotGroupCtr: data.quotGroupCtr || 1,
    projects: data.projects || [],
    projIdCtr: Math.max(data.projIdCtr || 1, 1),
    productDB: data.productDB || [],
    pIdCtr: Math.max(data.pIdCtr || 1, 1),
    services: data.services || [],
    svcIdCtr: Math.max(data.svcIdCtr || 1, 1),
    suppliers: data.suppliers || [],
    supplierIdCtr: Math.max(data.supplierIdCtr || 1, 1),
    inventory: data.inventory || [],
    stkIdCtr: Math.max(data.stkIdCtr || 1, 1),
    staff: data.staff || [],
    hrIdCtr: Math.max(data.hrIdCtr || 1, 1),
    appointments: data.appointments || [],
    apptIdCtr: Math.max(data.apptIdCtr || 1, 1),
    lpos: data.lpos || [],
    lpoIdCtr: Math.max(data.lpoIdCtr || 90, 90),
    amcQuotations: data.amcQuotations || [],
    amcQIdCtr: Math.max(data.amcQIdCtr || 90, 90),
    amcContracts: data.amcContracts || [],
    amcIdCtr: Math.max(data.amcIdCtr || 1, 1),
    amcVisits: data.amcVisits || [],
    visitIdCtr: Math.max(data.visitIdCtr || 1, 1),
  });
  if (data.cats) Object.assign(SBR.cats, data.cats);
  if (data.companyInfo) Object.assign(SBR.companyInfo, data.companyInfo);
  if (data.keyTerms) SBR.SBR_KEY_TERMS = data.keyTerms;
  if (data.tnc) SBR.SBR_TNC = data.tnc;
  SBR.lastSaved = data.savedAt || null;
}

function saveAllData() {
  // Debounce — save 1.5s after last change
  clearTimeout(_syncTimer);
  setSyncStatus('saving');
  _syncTimer = setTimeout(_pushToSheet, 1500);
}

function setSyncStatus(status, msg) {
  _syncStatus = status;
  const el = document.getElementById('sync-status');
  if (!el) return;
  const labels = {
    saving: '⏳ Saving...',
    saved: '✅ Synced',
    error: '❌ Sync Error',
    loading: '📥 Loading...',
    idle: '☁️ Cloud ERP',
  };
  el.textContent = msg || labels[status] || status;
  el.className = 'sync-badge sync-' + status;
}

async function _pushToSheet() {
  const data = collectData();
  const json = JSON.stringify(data);
  try {
    // no-cors POST — Google receives it but we can't read the response
    await fetch(SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'save', data: json }),
    });
    setSyncStatus('saved', '✅ Saved ' + new Date().toLocaleTimeString('en-AE', {hour:'2-digit',minute:'2-digit'}));
  } catch (e) {
    setSyncStatus('error', '❌ Save failed');
    console.error(e);
  }
}

async function loadFromSheet() {
  setSyncStatus('loading');
  try {
    const res = await fetch(SHEET_URL + '?action=load&t=' + Date.now());
    const json = await res.json();
    if (json.status === 'ok' && json.data) {
      const d = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
      applyData(d);
      setSyncStatus('saved', '✅ Synced');
      return true;
    }
    setSyncStatus('idle', '☁️ Ready');
    return false;
  } catch(e) {
    setSyncStatus('error', '❌ ' + e.message);
    return false;
  }
}

