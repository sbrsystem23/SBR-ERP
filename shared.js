// ═══════════════════════════════════════════════════
// SBR ERP — SHARED CORE
// Google Sheets DB + Auth + Common Functions
// ═══════════════════════════════════════════════════

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwF01VM_NXs7WiBznpfkZoTDUzwQihm9gZQH7qkavY1SPPA9CykIrXO-7ZyR68uQZ1_/exec';
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
  
  // Method: fetch with no-cors won't work for reading
  // Use a hidden form POST to load data via iframe
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = '_sbr_frame_' + Date.now();
    document.body.appendChild(iframe);
    
    const cbName = '_sbrCb_' + Date.now();
    
    // Try direct fetch first
    fetch(SHEET_URL + '?action=load&t=' + Date.now(), {
      method: 'GET',
      mode: 'cors',
    })
    .then(r => r.json())
    .then(json => {
      iframe.remove();
      if (json && json.status === 'ok' && json.data) {
        const d = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
        applyData(d);
        setSyncStatus('saved', '✅ Synced');
        resolve(true);
      } else {
        setSyncStatus('idle', '☁️ Ready');
        resolve(false);
      }
    })
    .catch(err => {
      iframe.remove();
      console.warn('Direct fetch failed, trying JSONP...', err.message);
      
      // JSONP fallback
      window[cbName] = function(json) {
        delete window[cbName];
        const s = document.getElementById('_sbr_jsonp_');
        if (s) s.remove();
        if (json && json.status === 'ok' && json.data) {
          const d = typeof json.data === 'string' ? JSON.parse(json.data) : json.data;
          applyData(d);
          setSyncStatus('saved', '✅ Synced');
          resolve(true);
        } else {
          setSyncStatus('idle', '☁️ Ready');
          resolve(false);
        }
      };
      
      const script = document.createElement('script');
      script.id = '_sbr_jsonp_';
      script.src = SHEET_URL + '?action=load&callback=' + cbName + '&t=' + Date.now();
      script.onerror = () => {
        delete window[cbName];
        script.remove();
        setSyncStatus('error', '❌ Cannot reach server');
        resolve(false);
      };
      
      setTimeout(() => {
        if (window[cbName]) {
          delete window[cbName];
          const s = document.getElementById('_sbr_jsonp_');
          if (s) s.remove();
          setSyncStatus('error', '❌ Timeout');
          resolve(false);
        }
      }, 20000);
      
      document.head.appendChild(script);
    });
  });
}

function escH(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n) { return Number(n||0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function td() { return new Date().toISOString().split('T')[0]; }
function gv(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function sv(id, v) { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
function showToast(msg, type='success') {
  let t = document.getElementById('sbr-toast');
  if (!t) { t = document.createElement('div'); t.id = 'sbr-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'sbr-toast toast-' + type + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function badgeHTML(status) {
  const colors = {
    'Approved': '#16a34a', 'Paid': '#16a34a', 'Delivered': '#16a34a',
    'Sent': '#2563eb', 'In Progress': '#2563eb',
    'Draft': '#6b7280', 'Estimate': '#6b7280',
    'Overdue': '#dc2626', 'Rejected': '#dc2626', 'Cancelled': '#dc2626',
    'Under Discussion': '#d97706', 'On Hold': '#d97706', 'Partial': '#d97706',
  };
  const bg = colors[status] || '#6b7280';
  return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;white-space:nowrap">${escH(status || '—')}</span>`;
}

// ── NAVIGATION ────────────────────────────────────
const PAGES = {
  dashboard:     'dashboard.html',
  appointments:  'appointments.html',
  clients:       'clients.html',
  quotations:    'quotations.html',
  amc:           'amc.html',
  invoices:      'invoices.html',
  receipts:      'receipts.html',
  delivery:      'delivery.html',
  purchases:     'purchases.html',
  projects:      'projects.html',
  suppliers:     'suppliers.html',
  products:      'products.html',
  services:      'services.html',
  inventory:     'inventory.html',
  hr:            'hr.html',
  'amc-contracts':'amc-contracts.html',
  'cover-letter':'cover-letter.html',
  tnc:           'tnc.html',
  settings:      'settings.html',
};

function navTo(page) {
  window.location.href = PAGES[page] || page;
}

// ── SIDEBAR BUILDER ──────────────────────────────
function buildSidebar(activePage) {
  const user = getCurrentUser();
  const menu = [
    { id: 'dashboard',    label: 'Dashboard',             icon: '📊' },
    { id: 'appointments', label: 'Appointments',           icon: '📅' },
    { id: 'clients',      label: 'Clients',                icon: '👥' },
    { id: 'quotations',   label: 'Quotations',             icon: '📄' },
    { id: 'amc',          label: 'AMC Quotation',          icon: '🔄' },
    { id: 'invoices',     label: 'Invoices',               icon: '🧾' },
    { id: 'receipts',     label: 'Receipts',               icon: '💰' },
    { id: 'delivery',     label: 'Delivery Notes',         icon: '📦' },
    { id: 'purchases',    label: 'Purchase Orders',        icon: '🛒' },
    { id: 'projects',     label: 'Projects',               icon: '🏗️' },
    { id: 'suppliers',    label: 'Suppliers',              icon: '🏭' },
    { id: 'products',     label: 'Products',               icon: '📦' },
    { id: 'services',     label: 'Services',               icon: '🔧' },
    { id: 'inventory',    label: 'Inventory',              icon: '🗃️' },
    { id: 'hr',           label: 'HR & Staff',             icon: '👤' },
    { id: 'amc-contracts',label: 'AMC Contracts',          icon: '📋' },
    { id: 'cover-letter', label: 'Cover Letter',           icon: '✉️' },
    { id: 'tnc',          label: 'Terms & Conditions',     icon: '📜' },
    { id: 'settings',     label: 'Settings & Categories',  icon: '⚙️' },
  ];

  let html = `
    <div class="sidebar">
      <div class="sb-logo">
        <img src="assets/logo.png" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="height:40px;max-width:136px;width:100%;display:block;object-fit:contain;margin:0 auto">
        <div style="display:none;align-items:center;gap:8px;font-size:16px;font-weight:800;color:#0F4C81">⚡ SBR System</div>
        <div class="sb-sub" style="text-align:center">ERP Platform · Dubai</div>
      </div>
      <nav class="sb-nav">`;

  menu.forEach(item => {
    if (item.section) {
      html += `<div class="sb-section">${item.section}</div>`;
    } else {
      const active = item.id === activePage ? ' active' : '';
      html += `<button class="sb-item${active}" onclick="navTo('${item.id}')">${item.icon} ${item.label}</button>`;
    }
  });

  html += `</nav>
      <div class="sb-foot">
        <div style="font-weight:600;font-size:12px;color:#374151">${user ? escH(user.name) : '—'}</div>
        <div style="font-size:10px;color:#6b7280">${user ? user.role : ''}</div>
        <button onclick="logout()" style="margin-top:6px;font-size:10px;padding:3px 10px;border:.5px solid #e2e8f0;border-radius:4px;background:#f8fafc;cursor:pointer;color:#374151">Sign Out</button>
      </div>
    </div>`;

  const el = document.getElementById('sidebar-wrap');
  if (el) el.innerHTML = html;
}

// ── TOPBAR ────────────────────────────────────────
function toggleSidebar() {
  document.body.classList.toggle('sb-collapsed');
  const btn = document.getElementById('sb-toggle-btn');
  if (btn) btn.textContent = document.body.classList.contains('sb-collapsed') ? '☰' : '✕';
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('collapsed');
  localStorage.setItem('sbr_sb_collapsed', document.body.classList.contains('sb-collapsed') ? '1' : '0');
}

function applySavedSidebarState() {
  if (localStorage.getItem('sbr_sb_collapsed') === '1') {
    document.body.classList.add('sb-collapsed');
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.add('collapsed');
    const btn = document.getElementById('sb-toggle-btn');
    if (btn) btn.textContent = '☰';
  }
}

function buildTopbar(title) {
  const el = document.getElementById('topbar-wrap');
  if (!el) return;
  const today = new Date().toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
  el.innerHTML = `
    <button id="sb-toggle-btn" class="sb-toggle" onclick="toggleSidebar()" title="Toggle Sidebar">✕</button>
    <div class="topbar" style="padding-left:52px">
      <div style="font-size:14px;font-weight:700;color:#0F4C81">${escH(title)}</div>
      <div style="display:flex;align-items:center;gap:12px">
        <span id="sync-status" class="sync-badge sync-idle">☁️ Cloud ERP</span>
        <button onclick="exportData()" style="font-size:10px;padding:3px 10px;border:.5px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;color:#374151;font-weight:600">⬇️ Export</button>
        <button onclick="openImport()" style="font-size:10px;padding:3px 10px;border:.5px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;color:#374151;font-weight:600">⬆️ Import</button>
        <span style="font-size:11px;color:#6b7280">${today}</span>
        <span style="font-size:11px;font-weight:700;color:#0F4C81;background:#e0eeff;padding:3px 10px;border-radius:10px">${APP_VERSION}</span>
      </div>
    </div>`;
}

// ── PAGE INIT ─────────────────────────────────────
async function initPage(pageId, title) {
  const user = checkAuth();
  if (!user) return false;
  buildTopbar(title);
  buildSidebar(pageId);
  setTimeout(applySavedSidebarState, 50);
  setSyncStatus('loading');
  await loadFromSheet();
  return true;
}

// ── EXPORT / IMPORT ──────────────────────────────
function exportData() {
  const data = collectData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SBR_ERP_Backup_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Data exported successfully!');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || (!data.clients && !data.savedQuotations)) {
        showToast('❌ Invalid file — not an SBR ERP backup', 'error');
        return;
      }
      if (!confirm('Import this data? This will REPLACE all current data.\n\nClients: ' + (data.clients||[]).length + '\nQuotations: ' + (data.savedQuotations||[]).length + '\nInvoices: ' + (data.invoices||[]).length)) return;
      applyData(data);
      saveAllData();
      showToast('✅ Data imported! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch(err) {
      showToast('❌ Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function openImport() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = e => importData(e.target.files[0]);
  inp.click();
}
