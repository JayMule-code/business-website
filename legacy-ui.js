// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  DATA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const offenses = [
  { id:'OFF-2025-0847', date:'25/03/25 09:41', plate:'ABJ 4521 ZM', driver:'John Mwale', type:'Speeding', location:'Great East Rd', officer:'Mwale K.', fine:500, status:'Unpaid' },
  { id:'OFF-2025-0846', date:'25/03/25 09:25', plate:'GHK 9873 ZM', driver:'Grace Phiri', type:'Red Light', location:'Cairo Rd', officer:'Banda J.', fine:300, status:'Paid' },
  { id:'OFF-2025-0845', date:'25/03/25 09:10', plate:'LKZ 2210 ZM', driver:'Peter Tembo', type:'No Seatbelt', location:'Kafue Rd', officer:'Tembo S.', fine:150, status:'Pending' },
  { id:'OFF-2025-0844', date:'25/03/25 08:55', plate:'MNP 5540 ZM', driver:'Robert Phiri', type:'DUI', location:'Independence Ave', officer:'Phiri R.', fine:2000, status:'Unpaid' },
  { id:'OFF-2025-0843', date:'25/03/25 08:30', plate:'XYZ 1190 ZM', driver:'Agnes Mulenga', type:'Overloading', location:'Mumbwa Rd', officer:'Mulenga A.', fine:800, status:'Paid' },
  { id:'OFF-2025-0842', date:'25/03/25 08:12', plate:'DEF 3320 ZM', driver:'Charles Banda', type:'Using Phone', location:'Lumumba Rd', officer:'Mwale K.', fine:400, status:'Pending' },
  { id:'OFF-2025-0841', date:'25/03/25 07:45', plate:'JKL 8810 ZM', driver:'Sarah Chanda', type:'Speeding', location:'Great North Rd', officer:'Banda J.', fine:500, status:'Paid' },
  { id:'OFF-2025-0840', date:'24/03/25 17:30', plate:'QRS 4490 ZM', driver:'Frank Mutale', type:'No License', location:'Kafue Rd', officer:'Tembo S.', fine:1500, status:'Disputed' },
];

const citizens = [
  { nrc:'124578/90/1', name:'John Mwale', phone:'+260 977 123 456', license:'ZR-2019-00821', plates:'ABJ 4521 ZM', fines:'K 2,500', status:'Active' },
  { nrc:'234890/10/2', name:'Grace Phiri', phone:'+260 966 234 567', license:'ZR-2020-01234', plates:'GHK 9873 ZM', fines:'K 0', status:'Clear' },
  { nrc:'345901/11/3', name:'Peter Tembo', phone:'+260 955 345 678', license:'ZR-2018-00512', plates:'LKZ 2210 ZM', fines:'K 150', status:'Pending' },
  { nrc:'456012/12/4', name:'Robert Phiri', phone:'+260 976 456 789', license:'ZR-2021-02001', plates:'MNP 5540 ZM', fines:'K 2,000', status:'Flagged' },
  { nrc:'567123/13/5', name:'Agnes Mulenga', phone:'+260 965 567 890', license:'ZR-2017-00398', plates:'XYZ 1190 ZM', fines:'K 0', status:'Clear' },
];

const vehicles = [
  { plate:'ABJ 4521 ZM', make:'Toyota Corolla', colour:'Silver', owner:'John Mwale', roadworthy:'Exp 2025-06', insurance:'Valid', offenses:3, status:'Flagged' },
  { plate:'GHK 9873 ZM', make:'Honda Fit', colour:'White', owner:'Grace Phiri', roadworthy:'Valid', insurance:'Valid', offenses:1, status:'Clear' },
  { plate:'LKZ 2210 ZM', make:'Nissan Navara', colour:'Blue', owner:'Peter Tembo', roadworthy:'Valid', insurance:'Valid', offenses:2, status:'Active' },
  { plate:'MNP 5540 ZM', make:'Mercedes C200', colour:'Black', owner:'Robert Phiri', roadworthy:'Expired', insurance:'Expired', offenses:5, status:'Impounded' },
  { plate:'XYZ 1190 ZM', make:'Isuzu Truck', colour:'Red', owner:'Agnes Mulenga', roadworthy:'Valid', insurance:'Valid', offenses:0, status:'Clear' },
];

const officers = [
  { service:'RTZ-20240001', name:'Mwale Kabwe', rank:'Sergeant', province:'Lusaka', checkpoint:'Great East Rd', status:'On Duty', offenses:12 },
  { service:'RTZ-20240002', name:'Banda James', rank:'Constable', province:'Lusaka', checkpoint:'Cairo Rd', status:'On Duty', offenses:9 },
  { service:'RTZ-20240003', name:'Tembo Solomon', rank:'Corporal', province:'Copperbelt', checkpoint:'Central Police', status:'On Duty', offenses:7 },
  { service:'RTZ-20240004', name:'Phiri Richard', rank:'Constable', province:'Lusaka', checkpoint:'Kafue Rd', status:'Off Duty', offenses:4 },
  { service:'RTZ-20240005', name:'Mulenga Agnes', rank:'Sergeant', province:'Southern', checkpoint:'Livingstone Gate', status:'On Duty', offenses:10 },
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  AUTH
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.currentRole = 'officer';
function setRole(r, btn) {
  window.currentRole = r;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function applySession(role, name, roleLbl, avatar) {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('app').classList.add('active');
  document.getElementById('userName').textContent = name;
  document.getElementById('userRoleLbl').textContent = roleLbl;
  document.getElementById('userAvatar').textContent = avatar;
  initCharts();
  populateTables();
  startClock();
}

function doLogin() {
  const id = document.getElementById('loginId').value;
  if (!id) { showToast('Please enter your Service ID','error'); return; }
  const roles    = { officer:'Officer A. Kamanga', admin:'Admin User', citizen:'Citizen Portal' };
  const roleLbls = { officer:'ENFORCEMENT OFFICER', admin:'SYSTEM ADMINISTRATOR', citizen:'CITIZEN USER' };
  const activeRole = window.currentRole || 'officer';
  const name    = roles[activeRole];
  const roleLbl = roleLbls[activeRole];
  const avatar  = name.split(' ').map(w=>w[0]).join('').slice(0,2);
  // Persist session so page refresh keeps user logged in
  sessionStorage.setItem('rtsa_session', JSON.stringify({ role: activeRole, name, roleLbl, avatar }));
  applySession(activeRole, name, roleLbl, avatar);
  showToast('Welcome back! System is fully operational.','success');
}

function doLogout() {
  sessionStorage.removeItem('rtsa_session');
  document.getElementById('app').classList.remove('active');
  document.getElementById('landing').style.display = 'flex';
}

// Restore session on page load / refresh
window.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('rtsa_session');
  if (saved) {
    const s = JSON.parse(saved);
    applySession(s.role, s.name, s.roleLbl, s.avatar);
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  NAVIGATION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showPage(page, el) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (el) el.classList.add('active');
  const titles = { dashboard:'Dashboard', offenses:'Offense Records', gps:'GPS Tracking',
      evidence:'Evidence Management', payments:'Payment Management', fines:'Fine Management',
      citizens:'Citizens & Drivers', officers:'Officer Management', vehicles:'Vehicle Registry',
      analytics:'Analytics & Reports', notifications:'Notifications', settings:'Settings', profile:'My Profile', admin:'Admin Center' };
  document.getElementById('topbarTitle').textContent = titles[page] || page;
  closeSidebar();
  if (page === 'analytics') setTimeout(initAnalyticsCharts, 100);
  if (page === 'gps') setTimeout(startRealtimeGpsTracking, 100);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  SIDEBAR (mobile)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  MODALS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openModal(id) { document.getElementById('modal-' + id).classList.add('open'); }
function closeModal(id) { document.getElementById('modal-' + id).classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

function submitOffense() {
  closeModal('recordOffense');
  showToast('Offense recorded! Ticket generated & sent via SMS','success');
  document.getElementById('offenseBadge').textContent = '13';
}

function submitRegistration() {
  closeModal('register');
  showToast('Registration submitted! An administrator will review and activate your account.','success');
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  TOAST
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showToast(msg, type = 'info') {
  const icons = { success:'âœ…', error:'âŒ', info:'â„¹ï¸', warning:'âš ï¸' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(40px)'; el.style.transition='all 0.3s'; setTimeout(()=>el.remove(),300); }, 4000);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  CLOCK
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function startClock() {
  const el = document.getElementById('dashClock');
  const tick = () => { if(el) el.textContent = new Date().toLocaleString('en-ZM',{dateStyle:'medium',timeStyle:'medium'}); };
  tick(); setInterval(tick, 1000);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  POPULATE TABLES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function populateTables() {
  // Offenses
  const ob = document.getElementById('offenseTableBody');
  if (ob) ob.innerHTML = offenses.map(o => `
    <tr>
      <td class="mono text-accent">${o.id}</td>
      <td class="mono text-xs">${o.date}</td>
      <td>${o.plate}</td>
      <td>${o.driver}</td>
      <td>${o.type}</td>
      <td>${o.location}</td>
      <td>${o.officer}</td>
      <td class="mono">K ${o.fine.toLocaleString()}</td>
      <td>${statusBadge(o.status)}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onclick="showToast('Viewing ${o.id}','info')">View</button>
          <button class="btn btn-success btn-sm" onclick="showToast('Receipt generated','success')">ðŸ§¾</button>
        </div>
      </td>
    </tr>`).join('');

  // Citizens
  const cb = document.getElementById('citizenTableBody');
  if (cb) cb.innerHTML = citizens.map(c => `
    <tr>
      <td class="mono text-xs">${c.nrc}</td>
      <td>${c.name}</td>
      <td class="mono text-xs">${c.phone}</td>
      <td class="mono text-xs">${c.license}</td>
      <td>${c.plates}</td>
      <td class="${c.fines==='K 0'?'text-success':'text-warning'}">${c.fines}</td>
      <td>${statusBadge(c.status)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showToast('Profile opened','info')">View Profile</button></td>
    </tr>`).join('');

  // Vehicles
  const vb = document.getElementById('vehicleTableBody');
  if (vb) vb.innerHTML = vehicles.map(v => `
    <tr>
      <td class="mono text-accent">${v.plate}</td>
      <td>${v.make}</td>
      <td>${v.colour}</td>
      <td>${v.owner}</td>
      <td class="${v.roadworthy==='Expired'?'text-danger':'text-success'}">${v.roadworthy}</td>
      <td class="${v.insurance==='Expired'?'text-danger':'text-success'}">${v.insurance}</td>
      <td class="${v.offenses>2?'text-danger':'text-accent'}">${v.offenses}</td>
      <td>${statusBadge(v.status)}</td>
    </tr>`).join('');

  // Officers
  const offb = document.getElementById('officerTableBody');
  if (offb) offb.innerHTML = officers.map(o => `
    <tr>
      <td class="mono text-accent">${o.service}</td>
      <td>${o.name}</td>
      <td>${o.rank}</td>
      <td>${o.province}</td>
      <td>${o.checkpoint}</td>
      <td>${statusBadge(o.status)}</td>
      <td class="${o.offenses>8?'text-success':'text-accent'}">${o.offenses}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" onclick="showToast('Officer profile opened','info')">View</button>
          <button class="btn btn-outline btn-sm" onclick="showToast('Location tracked','info')">ðŸ“¡</button>
        </div>
      </td>
    </tr>`).join('');

  // Officer list in GPS page
  const ol = document.getElementById('officerList');
  if (ol) ol.innerHTML = officers.map(o => `
    <div class="feed-item">
      <div class="feed-icon ${o.status==='On Duty'?'success':'info'}">ðŸš”</div>
      <div class="feed-body">
        <div class="feed-title">${o.name}</div>
        <div class="feed-meta">${o.checkpoint}</div>
      </div>
      <span class="badge ${o.status==='On Duty'?'badge-success':'badge-neutral'}">${o.status}</span>
    </div>`).join('');

  // Evidence grid
  const eg = document.getElementById('evidenceGrid');
  if (eg) {
    const colors = ['rgba(255,59,92,0.15)','rgba(0,180,255,0.15)','rgba(0,230,118,0.1)','rgba(255,180,0,0.1)'];
    const emojis = ['ðŸ“·','ðŸŽ¥','ðŸ“·','ðŸ“·','ðŸŽ¥','ðŸ“·'];
    eg.innerHTML = Array.from({length:6},(_,i)=>`
      <div style="background:${colors[i%4]};border:1px solid var(--border);border-radius:6px;padding:30px 20px;text-align:center;cursor:pointer" onclick="showToast('Opening evidence ${i+1}','info')">
        <div style="font-size:32px;margin-bottom:8px">${emojis[i]}</div>
        <div style="font-size:12px;color:var(--text-dim)">OFF-2025-084${7-i}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Officer evidence</div>
      </div>`).join('');
  }

  // Offense type bars
  const otb = document.getElementById('offenseTypeBars');
  if (otb) {
    const types = [{l:'Speeding',v:342,c:'var(--danger)'},{l:'No Seatbelt',v:218,c:'var(--warning)'},{l:'Red Light',v:189,c:'var(--accent)'},{l:'DUI',v:97,c:'var(--accent3)'},{l:'Phone Use',v:74,c:'var(--accent2)'}];
    otb.innerHTML = types.map(t=>`
      <div style="margin-bottom:12px">
        <div class="flex justify-between" style="font-size:12px;margin-bottom:4px"><span style="color:var(--text-dim)">${t.l}</span><span class="mono" style="color:${t.c}">${t.v}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(t.v/342*100)}%;background:${t.c}"></div></div>
      </div>`).join('');
  }

  // Hour bars
  const hb = document.getElementById('hourBars');
  if (hb) {
    const hrs = [{h:'06-09',v:45},{h:'09-12',v:89},{h:'12-15',v:62},{h:'15-18',v:98},{h:'18-21',v:74},{h:'21-00',v:31}];
    hb.innerHTML = hrs.map(t=>`
      <div style="margin-bottom:10px">
        <div class="flex justify-between" style="font-size:12px;margin-bottom:4px"><span style="color:var(--text-dim)">${t.h}</span><span class="mono text-accent">${t.v}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(t.v/98*100)}%;background:var(--accent)"></div></div>
      </div>`).join('');
  }
}

function statusBadge(s) {
  const m = { Unpaid:'badge-danger', Paid:'badge-success', Pending:'badge-warning', Disputed:'badge-neutral',
    Active:'badge-success', ACTIVE:'badge-success', PENDING:'badge-warning', DISABLED:'badge-danger',
    Clear:'badge-success', Flagged:'badge-danger', Impounded:'badge-danger',
    'On Duty':'badge-success', 'Off Duty':'badge-neutral', Suspended:'badge-danger' };
  return `<span class="badge ${m[s]||'badge-neutral'}">${s}</span>`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  CHARTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initCharts() {
  // Trend chart
  const tc = document.getElementById('trendChart');
  if (!tc) return;
  const ctx = tc.getContext('2d');
  tc.width = tc.parentElement.offsetWidth - 40;
  const data = [189,210,175,240,220,195,247];
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Today'];
  drawLineChart(ctx, tc.width, 200, data, labels, '#00b4ff');

  // Payment pie
  const pc = document.getElementById('paymentPieChart');
  if (pc) {
    const pctx = pc.getContext('2d');
    pc.width = pc.parentElement.offsetWidth - 40;
    drawPieChart(pctx, pc.width, 160, [
      {v:45,c:'#00b4ff',l:'MTN MoMo'},{v:30,c:'#00ffb3',l:'Airtel'},{v:15,c:'#ff6b35',l:'Card'},{v:10,c:'#ffb400',l:'Bank'}
    ]);
  }
}

function initAnalyticsCharts() {
  const mc = document.getElementById('monthlyChart');
  if (mc && !mc.drawn) {
    mc.drawn = true;
    mc.width = mc.parentElement.offsetWidth - 40;
    const ctx = mc.getContext('2d');
    drawBarChart(ctx, mc.width, 200, [1240,1380,1190,1520,1620,1480,1750,1920,1810,2040,1930,2180], ['J','F','M','A','M','J','J','A','S','O','N','D'], '#00b4ff');
  }
  const prc = document.getElementById('provinceChart');
  if (prc && !prc.drawn) {
    prc.drawn = true;
    prc.width = prc.parentElement.offsetWidth - 40;
    const ctx = prc.getContext('2d');
    drawBarChart(ctx, prc.width, 200, [65200,28100,18900,16250,8400,4100], ['Lusaka','Copperbelt','Southern','Eastern','Central','Western'], '#00ffb3');
  }
}

function drawLineChart(ctx, w, h, data, labels, color) {
  const pad = {t:20,r:20,b:30,l:40};
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const max = Math.max(...data) * 1.15;
  ctx.clearRect(0,0,w,h);

  // Grid lines
  ctx.strokeStyle = 'rgba(0,180,255,0.07)';
  ctx.lineWidth = 1;
  for (let i=0;i<=4;i++) {
    const y = pad.t + ch - (i/4)*ch;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y); ctx.stroke();
    ctx.fillStyle = 'rgba(122,155,181,0.7)';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText(Math.round(max*i/4), 0, y+4);
  }

  // Area fill
  ctx.beginPath();
  data.forEach((v,i) => {
    const x = pad.l + (i/(data.length-1))*cw;
    const y = pad.t + ch - (v/max)*ch;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.lineTo(pad.l+cw, pad.t+ch); ctx.lineTo(pad.l, pad.t+ch); ctx.closePath();
  const grad = ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0, color.replace(')',',0.2)').replace('rgb','rgba'));
  grad.addColorStop(1, color.replace(')',',0)').replace('rgb','rgba'));
  if (color.startsWith('#')) {
    grad.addColorStop(0, color+'33');
    grad.addColorStop(1, color+'00');
  }
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  data.forEach((v,i) => {
    const x = pad.l + (i/(data.length-1))*cw;
    const y = pad.t + ch - (v/max)*ch;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();

  // Dots + labels
  data.forEach((v,i) => {
    const x = pad.l + (i/(data.length-1))*cw;
    const y = pad.t + ch - (v/max)*ch;
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle='rgba(122,155,181,0.9)'; ctx.font='10px DM Sans';
    ctx.fillText(labels[i], x - ctx.measureText(labels[i]).width/2, pad.t+ch+18);
  });
}

function drawBarChart(ctx, w, h, data, labels, color) {
  const pad = {t:10,r:10,b:36,l:50};
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const max = Math.max(...data)*1.15;
  const bw = cw/data.length*0.6;
  const gap = cw/data.length;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(0,180,255,0.07)'; ctx.lineWidth=1;
  for (let i=0;i<=4;i++) {
    const y = pad.t + ch - (i/4)*ch;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y); ctx.stroke();
    ctx.fillStyle='rgba(122,155,181,0.7)'; ctx.font='10px JetBrains Mono';
    const lbl = max*i/4 > 1000 ? `${Math.round(max*i/4/1000)}k` : Math.round(max*i/4);
    ctx.fillText(lbl, 0, y+4);
  }
  data.forEach((v,i) => {
    const x = pad.l + gap*i + gap*0.2;
    const bh = (v/max)*ch;
    const y = pad.t + ch - bh;
    const g = ctx.createLinearGradient(0,y,0,y+bh);
    g.addColorStop(0, color); g.addColorStop(1, color+'55');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,bw,bh,3) : ctx.rect(x,y,bw,bh);
    ctx.fill();
    ctx.fillStyle='rgba(122,155,181,0.8)'; ctx.font='10px DM Sans';
    const lbl = labels[i];
    ctx.fillText(lbl, x + bw/2 - ctx.measureText(lbl).width/2, pad.t+ch+16);
  });
}

function drawPieChart(ctx, w, h, segments) {
  const cx = w/2, cy = h/2 - 10, r = Math.min(w,h)/2 - 30;
  let angle = -Math.PI/2;
  const total = segments.reduce((s,d)=>s+d.v,0);
  ctx.clearRect(0,0,w,h);
  segments.forEach(s => {
    const slice = (s.v/total)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+slice);
    ctx.closePath(); ctx.fillStyle=s.c; ctx.fill();
    ctx.strokeStyle=ctx.fillStyle; ctx.lineWidth=0;
    // Label
    const mid = angle + slice/2;
    const lx = cx + Math.cos(mid)*(r+18);
    const ly = cy + Math.sin(mid)*(r+18);
    ctx.fillStyle='rgba(122,155,181,0.9)'; ctx.font='10px DM Sans';
    ctx.fillText(`${s.l} ${s.v}%`, lx - ctx.measureText(`${s.l} ${s.v}%`).width/2, ly+4);
    angle += slice;
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  GPS MAP
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const gpsTrackingState = {
  watchId: null,
  lastPosition: null,
  lastError: null,
  officerPins: [
    {x:0.22,y:0.22,c:'#00e676',n:'Checkpoint A'},
    {x:0.76,y:0.26,c:'#00b4ff',n:'Checkpoint B'},
    {x:0.31,y:0.71,c:'#ffb400',n:'Unit 12'},
    {x:0.68,y:0.62,c:'#00e676',n:'Patrol 5'}
  ]
};

function setGpsMeta(status, coords = '--, --', accuracy = '--', updated = '--') {
  const statusEl = document.getElementById('gpsStatusText');
  const coordsEl = document.getElementById('gpsCoordsText');
  const accuracyEl = document.getElementById('gpsAccuracyText');
  const updatedEl = document.getElementById('gpsUpdatedText');

  if (statusEl) statusEl.textContent = status;
  if (coordsEl) coordsEl.textContent = coords;
  if (accuracyEl) accuracyEl.textContent = accuracy;
  if (updatedEl) updatedEl.textContent = updated;
}

function projectGpsPoint(lat, lon, width, height) {
  const minLat = -18.1;
  const maxLat = -8.1;
  const minLon = 21.8;
  const maxLon = 33.8;

  const normalizedX = Math.min(1, Math.max(0, (lon - minLon) / (maxLon - minLon)));
  const normalizedY = Math.min(1, Math.max(0, (maxLat - lat) / (maxLat - minLat)));

  return {
    x: 26 + normalizedX * (width - 52),
    y: 26 + normalizedY * (height - 52),
  };
}

function paintGpsBase(ctx, width, height) {
  ctx.fillStyle = '#0a1520';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(0,180,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0,180,255,0.25)';
  ctx.lineWidth = 3;
  [[0.08,0.34,0.9,0.38],[0.52,0.07,0.52,0.92],[0.18,0.77,0.82,0.58],[0.36,0.1,0.2,0.88]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1 * width, y1 * height);
    ctx.lineTo(x2 * width, y2 * height);
    ctx.stroke();
  });

  ctx.fillStyle = 'rgba(0,180,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(width * 0.14, height * 0.16);
  ctx.lineTo(width * 0.84, height * 0.13);
  ctx.lineTo(width * 0.89, height * 0.82);
  ctx.lineTo(width * 0.18, height * 0.86);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,180,255,0.18)';
  ctx.stroke();
}

function paintOfficerPins(ctx, width, height) {
  gpsTrackingState.officerPins.forEach(pin => {
    const x = pin.x * width;
    const y = pin.y * height;

    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = pin.c + '33';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = pin.c;
    ctx.fill();

    ctx.fillStyle = 'rgba(232,244,253,0.85)';
    ctx.font = '11px DM Sans';
    ctx.fillText(pin.n, x + 11, y + 4);
  });
}

function paintLiveGpsMarker(ctx, width, height, position) {
  if (!position) {
    ctx.fillStyle = 'rgba(122,155,181,0.75)';
    ctx.font = '14px DM Sans';
    ctx.fillText('Allow location access to start real-time GPS tracking.', 22, 28);
    return;
  }

  const coords = projectGpsPoint(position.coords.latitude, position.coords.longitude, width, height);

  ctx.beginPath();
  ctx.arc(coords.x, coords.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,59,92,0.14)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(coords.x, coords.y, 11, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,59,92,0.28)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(coords.x, coords.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff3b5c';
  ctx.fill();

  ctx.fillStyle = 'rgba(232,244,253,0.92)';
  ctx.font = '12px DM Sans';
  ctx.fillText('LIVE DEVICE', coords.x + 14, coords.y - 10);
  ctx.fillStyle = 'rgba(122,155,181,0.85)';
  ctx.fillText(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`, coords.x + 14, coords.y + 8);
}

function drawGpsMap() {
  const canvas = document.getElementById('gpsCanvas');
  if (!canvas) return;

  canvas.width = Math.max(320, canvas.parentElement.offsetWidth - 40);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  paintGpsBase(ctx, w, h);
  paintOfficerPins(ctx, w, h);
  paintLiveGpsMarker(ctx, w, h, gpsTrackingState.lastPosition);

  ctx.fillStyle='rgba(122,155,181,0.72)';
  ctx.font='11px JetBrains Mono';
  ctx.fillText('LIVE DEVICE   ACTIVE UNITS   COVERAGE AREA', 10, h-10);
}

function handleGpsSuccess(position) {
  gpsTrackingState.lastPosition = position;
  gpsTrackingState.lastError = null;

  setGpsMeta(
    'Tracking live',
    `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
    `${Math.round(position.coords.accuracy || 0)} m`,
    new Date(position.timestamp).toLocaleString('en-ZM', { dateStyle: 'medium', timeStyle: 'medium' })
  );

  drawGpsMap();
}

function handleGpsError(error) {
  gpsTrackingState.lastError = error;

  const messages = {
    1: 'Location permission denied.',
    2: 'Location signal unavailable.',
    3: 'Location request timed out.',
  };

  setGpsMeta(messages[error.code] || 'Unable to read live GPS location.');
  drawGpsMap();
}

function startRealtimeGpsTracking() {
  if (!document.getElementById('gpsCanvas')) return;

  if (!navigator.geolocation) {
    setGpsMeta('This browser does not support live GPS tracking.');
    drawGpsMap();
    return;
  }

  if (gpsTrackingState.watchId !== null) {
    drawGpsMap();
    return;
  }

  setGpsMeta('Requesting GPS access...');
  gpsTrackingState.watchId = navigator.geolocation.watchPosition(
    handleGpsSuccess,
    handleGpsError,
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    }
  );

  drawGpsMap();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  INIT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.addEventListener('resize', () => {
  if (document.getElementById('app').classList.contains('active')) {
    const active = document.querySelector('.page-content.active');
    if (active && active.id === 'page-dashboard') initCharts();
    if (active && active.id === 'page-gps') drawGpsMap();
  }
});

window.addEventListener('beforeunload', () => {
  if (gpsTrackingState.watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(gpsTrackingState.watchId);
  }
});
