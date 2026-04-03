const state = {
  session: null,
  dashboard: null,
  fineTypes: [],
  offenses: [],
  transactions: [],
  evidence: [],
  citizens: [],
  vehicles: [],
  officers: [],
  notifications: [],
  settings: {},
  analytics: {},
  paymentSummary: {},
  profile: null,
  adminOverview: null,
  adminAccounts: [],
  adminAudit: [],
  selectedOffenseId: null,
  notificationChannel: 'SMS',
  lastDetectedPlate: '',
  citizenPortal: {
    lookup: null,
    selectedOffenseCode: '',
    receipt: null,
  },
};

function applyTheme(theme) {
  const isLight = theme === 'light';
  document.body.classList.toggle('light-mode', isLight);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = isLight ? 'Dark Mode' : 'Light Mode';
  }

  localStorage.setItem('rtsa_theme', isLight ? 'light' : 'dark');
}

window.toggleTheme = function toggleTheme() {
  const nextTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
  applyTheme(nextTheme);
};

async function api(action, options = {}) {
  const requestOptions = { ...options };
  const query = requestOptions.query ? new URLSearchParams(requestOptions.query).toString() : '';
  delete requestOptions.query;
  const url = `api/index.php?action=${encodeURIComponent(action)}${query ? `&${query}` : ''}`;
  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...requestOptions,
    });
  } catch (error) {
    throw new Error('Cannot reach the PHP backend. Start the app with the PHP server, not by opening the file directly.');
  }

  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error('The backend did not return valid JSON. Check that PHP is running and the database connection is working.');
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || 'Request failed.');
  }
  return payload;
}

function roleLabel(role) {
  const labels = {
    admin: 'SYSTEM ADMINISTRATOR',
    officer: 'ENFORCEMENT OFFICER',
    citizen: 'CITIZEN USER',
  };
  return labels[role] || String(role || '').toUpperCase();
}

function initials(user) {
  return `${(user.first_name || 'U')[0] || 'U'}${(user.last_name || 'S')[0] || 'S'}`.toUpperCase();
}

function money(value) {
  return `ZMW ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortMoney(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (match) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[match]));
}

function showCitizenPortal() {
  const landing = document.getElementById('landing');
  const app = document.getElementById('app');
  const portal = document.getElementById('citizenPortal');
  if (landing) landing.style.display = 'none';
  if (app) app.classList.remove('active');
  if (portal) portal.style.display = 'block';
}

function showMainLanding() {
  const landing = document.getElementById('landing');
  const app = document.getElementById('app');
  const portal = document.getElementById('citizenPortal');
  if (portal) portal.style.display = 'none';
  if (app) app.classList.remove('active');
  if (landing) landing.style.display = 'flex';
}

function setCitizenStatus(message, tone = 'muted') {
  const element = document.getElementById('citizenLookupStatus');
  if (!element) return;
  const colors = {
    muted: 'var(--text-dim)',
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
  };
  element.style.color = colors[tone] || colors.muted;
  element.textContent = message;
}

function citizenEvidenceMarkup(files) {
  if (!files.length) {
    return '<div style="font-size:12px;color:var(--text-dim)">No evidence uploaded for this offense.</div>';
  }

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:10px">
      ${files.map((file) => {
        const fileUrl = `api/index.php?action=citizen_evidence_file&file=${encodeURIComponent(file.stored_name)}`;
        if (file.mime_type.startsWith('image/')) {
          return `
            <div style="border:1px solid var(--border);border-radius:6px;padding:10px;background:rgba(0,180,255,0.04)">
              <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">${escapeHtml(file.original_name)}</div>
              <img src="${fileUrl}" alt="${escapeHtml(file.original_name)}" style="width:100%;height:160px;object-fit:cover;border-radius:4px">
            </div>
          `;
        }
        if (file.mime_type.startsWith('video/')) {
          return `
            <div style="border:1px solid var(--border);border-radius:6px;padding:10px;background:rgba(0,180,255,0.04)">
              <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">${escapeHtml(file.original_name)}</div>
              <video controls style="width:100%;max-height:180px;border-radius:4px">
                <source src="${fileUrl}" type="${escapeHtml(file.mime_type)}">
              </video>
            </div>
          `;
        }
        return `
          <div style="border:1px solid var(--border);border-radius:6px;padding:10px;background:rgba(0,180,255,0.04)">
            <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">${escapeHtml(file.original_name)}</div>
            <a href="${fileUrl}" target="_blank" class="text-accent">Open file</a>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function citizenTransactionMarkup(rows) {
  if (!rows.length) {
    return '<div style="font-size:12px;color:var(--text-dim);margin-top:10px">No payment has been recorded yet.</div>';
  }

  return `
    <table class="data-table" style="margin-top:10px">
      <thead>
        <tr><th>Transaction</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th></tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td class="mono text-accent">${escapeHtml(row.transaction_code)}</td>
            <td>${escapeHtml(row.method)}</td>
            <td>${money(row.amount)}</td>
            <td>${statusBadge(row.status)}</td>
            <td>${escapeHtml(formatDate(row.processed_at))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderCitizenLookup(data) {
  state.citizenPortal.lookup = data;
  state.citizenPortal.receipt = null;

  document.getElementById('citizenLookupResults').style.display = 'block';
  document.getElementById('citizenReceiptCard').style.display = 'none';
  document.getElementById('citizenReceiptBody').innerHTML = '';

  document.getElementById('citizenProfileSummary').innerHTML = `
    <table class="data-table">
      <tbody>
        <tr><th>Full Name</th><td>${escapeHtml(data.citizen.full_name)}</td></tr>
        <tr><th>NRC</th><td>${escapeHtml(data.citizen.nrc)}</td></tr>
        <tr><th>Phone</th><td>${escapeHtml(data.citizen.phone || '-')}</td></tr>
        <tr><th>Email</th><td>${escapeHtml(data.citizen.email || '-')}</td></tr>
        <tr><th>License</th><td>${escapeHtml(data.citizen.license_number || '-')}</td></tr>
        <tr><th>Class</th><td>${escapeHtml(data.citizen.license_class || '-')}</td></tr>
        <tr><th>Province</th><td>${escapeHtml(data.citizen.province || '-')}</td></tr>
        <tr><th>Status</th><td>${statusBadge(data.citizen.status)}</td></tr>
      </tbody>
    </table>
  `;

  document.getElementById('citizenVehicleSummary').innerHTML = `
    <table class="data-table">
      <tbody>
        <tr><th>Plate Number</th><td class="mono text-accent">${escapeHtml(data.vehicle.plate_number)}</td></tr>
        <tr><th>Make / Model</th><td>${escapeHtml(data.vehicle.make || '-')} ${escapeHtml(data.vehicle.model || '')}</td></tr>
        <tr><th>Year</th><td>${escapeHtml(data.vehicle.vehicle_year || '-')}</td></tr>
        <tr><th>Colour</th><td>${escapeHtml(data.vehicle.colour || '-')}</td></tr>
        <tr><th>Roadworthy</th><td>${escapeHtml(data.vehicle.roadworthy_expiry || '-')}</td></tr>
        <tr><th>Insurance</th><td>${escapeHtml(data.vehicle.insurance_status || '-')}</td></tr>
        <tr><th>Status</th><td>${statusBadge(data.vehicle.status)}</td></tr>
      </tbody>
    </table>
  `;

  document.getElementById('citizenTotalDue').textContent = `Outstanding fines: ${money(data.total_due || 0)}`;

  document.getElementById('citizenOffenseList').innerHTML = data.offenses.length
    ? data.offenses.map((offense) => `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;background:rgba(255,255,255,0.02)">
        <div class="flex items-center justify-between" style="gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <div>
            <div class="mono text-accent" style="font-size:14px">${escapeHtml(offense.offense_code)}</div>
            <div style="font-size:12px;color:var(--text-dim)">${escapeHtml(offense.offense_type)} recorded on ${escapeHtml(formatDate(offense.occurred_at))}</div>
          </div>
          <div class="flex gap-2" style="align-items:center;flex-wrap:wrap">
            ${statusBadge(offense.status)}
            <button class="btn btn-accent btn-sm" type="button" onclick="prepareCitizenPayment('${escapeHtml(offense.offense_code)}')">Pay This Fine</button>
          </div>
        </div>

        <table class="data-table">
          <tbody>
            <tr><th>Location</th><td>${escapeHtml(offense.location || '-')}</td><th>Fine</th><td>${money(offense.fine_amount)}</td></tr>
            <tr><th>Officer</th><td>${escapeHtml(offense.officer_name || 'Unassigned')}</td><th>Service No.</th><td>${escapeHtml(offense.service_number || '-')}</td></tr>
            <tr><th>Time Recorded</th><td>${escapeHtml(formatDate(offense.occurred_at))}</td><th>Balance Due</th><td>${money(offense.balance_due)}</td></tr>
            <tr><th>Notes</th><td colspan="3">${escapeHtml(offense.notes || 'No extra notes')}</td></tr>
          </tbody>
        </table>

        <div class="section-sub" style="margin:12px 0 6px">Evidence Files</div>
        ${citizenEvidenceMarkup(offense.evidence || [])}

        <div class="section-sub" style="margin:12px 0 6px">Payment History</div>
        ${citizenTransactionMarkup(offense.transactions || [])}
      </div>
    `).join('')
    : '<div style="font-size:13px;color:var(--text-dim)">No offenses were found for this vehicle.</div>';

  setCitizenStatus(`Found ${data.offenses.length} offense record(s) for ${data.vehicle.plate_number}.`, data.offenses.length ? 'success' : 'warning');
}

function renderCitizenReceipt(receipt) {
  state.citizenPortal.receipt = receipt;
  document.getElementById('citizenReceiptCard').style.display = 'block';
  document.getElementById('citizenReceiptBody').innerHTML = `
    <table class="data-table">
      <tbody>
        <tr><th>Transaction Code</th><td class="mono text-accent">${escapeHtml(receipt.transaction_code)}</td></tr>
        <tr><th>Status</th><td>${statusBadge(receipt.status)}</td></tr>
        <tr><th>Citizen</th><td>${escapeHtml(receipt.citizen_name)}</td></tr>
        <tr><th>NRC</th><td>${escapeHtml(receipt.nrc)}</td></tr>
        <tr><th>Plate Number</th><td>${escapeHtml(receipt.plate_number)}</td></tr>
        <tr><th>Offense</th><td>${escapeHtml(receipt.offense_code)} - ${escapeHtml(receipt.offense_type)}</td></tr>
        <tr><th>Payment Method</th><td>${escapeHtml(receipt.method)}</td></tr>
        <tr><th>Account Reference</th><td>${escapeHtml(receipt.account_reference)}</td></tr>
        <tr><th>Amount Paid</th><td>${money(receipt.amount)}</td></tr>
        <tr><th>Original Fine</th><td>${money(receipt.fine_amount)}</td></tr>
        <tr><th>Balance Remaining</th><td>${money(receipt.balance_due)}</td></tr>
        <tr><th>Paid At</th><td>${escapeHtml(formatDate(receipt.processed_at))}</td></tr>
      </tbody>
    </table>
  `;
}

function currentFilters() {
  return {
    search: document.getElementById('globalSearchInput')?.value.trim() || '',
    offense: document.getElementById('offenseTypeFilter')?.value || '',
    status: document.getElementById('offenseStatusFilter')?.value || '',
  };
}

function citizenFilterValue() {
  return document.getElementById('citizenSearchInput')?.value.trim().toLowerCase() || '';
}

function buildReportUrl(endpoint) {
  const params = new URLSearchParams();
  const selectedId = state.selectedOffenseId || state.offenses[0]?.offense_code || '';
  const filters = currentFilters();
  if (selectedId) {
    params.set('id', selectedId);
  }
  if (filters.search) params.set('search', filters.search);
  if (filters.offense && filters.offense !== 'All Types') params.set('offense', filters.offense);
  if (filters.status && filters.status !== 'All Status') params.set('status', filters.status);
  return `${endpoint}?${params.toString()}`;
}

function fillFineSelects() {
  const recordSelect = document.getElementById('recordOffenseType');
  const filterSelect = document.getElementById('offenseTypeFilter');

  if (recordSelect) {
    recordSelect.innerHTML = state.fineTypes.map((item) => `<option>${escapeHtml(item.name)}</option>`).join('');
  }

  if (filterSelect) {
    const current = filterSelect.value || 'All Types';
    filterSelect.innerHTML = `<option>All Types</option>${state.fineTypes.map((item) => `<option>${escapeHtml(item.name)}</option>`).join('')}`;
    filterSelect.value = [...filterSelect.options].some((option) => option.value === current) ? current : 'All Types';
  }
}

function fineByName(name) {
  return state.fineTypes.find((item) => item.name === name);
}

window.updateFineAmount = function updateFineAmount() {
  const selected = fineByName(document.getElementById('recordOffenseType')?.value);
  if (selected) {
    document.getElementById('recordFineAmount').value = Number(selected.amount || 0);
  }
};

function renderDashboard() {
  const totals = state.dashboard?.totals || {};
  const totalOffenses = document.getElementById('dashTotalOffenses');
  const pendingFines = document.getElementById('dashPendingFines');
  const revenue = document.getElementById('dashRevenue');
  const activeOfficers = document.getElementById('dashActiveOfficers');

  if (totalOffenses) totalOffenses.textContent = shortMoney(totals.offenses_today || 0);
  if (pendingFines) pendingFines.textContent = shortMoney(totals.pending_fines || 0);
  if (revenue) revenue.textContent = shortMoney(totals.revenue || 0);
  if (activeOfficers) activeOfficers.textContent = shortMoney(totals.active_officers || 0);

  const recentBody = document.getElementById('dashboardRecentOffenses');
  if (recentBody) {
    recentBody.innerHTML = (state.dashboard?.recent_offenses || []).map((row) => `
      <tr onclick="viewOffense('${escapeHtml(row.offense_code)}')" style="cursor:pointer">
        <td class="mono text-accent">${escapeHtml(row.offense_code)}</td>
        <td>${escapeHtml(row.vehicle_plate)}</td>
        <td>${escapeHtml(row.offense_type)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${money(row.fine_amount)}</td>
      </tr>
    `).join('');
  }

  const provinceBody = document.getElementById('dashboardProvinceSummary');
  if (provinceBody) {
    provinceBody.innerHTML = (state.dashboard?.province_summary || []).map((row) => `
      <tr>
        <td>${escapeHtml(row.province)}</td>
        <td class="text-danger">${escapeHtml(row.offense_count)}</td>
        <td class="text-success">${money(row.collected)}</td>
      </tr>
    `).join('');
  }
}

function renderOffenses() {
  const offenseBadge = document.getElementById('offenseBadge');
  if (offenseBadge) {
    offenseBadge.textContent = String(state.offenses.length || 0);
  }

  const body = document.getElementById('offenseTableBody');
  if (body) {
    body.innerHTML = state.offenses.map((row) => `
      <tr>
        <td class="mono text-accent">${escapeHtml(row.offense_code)}</td>
        <td class="mono text-xs">${escapeHtml(formatDate(row.occurred_at))}</td>
        <td>${escapeHtml(row.vehicle_plate)}</td>
        <td>${escapeHtml(row.driver_name)}</td>
        <td>${escapeHtml(row.offense_type)}</td>
        <td>${escapeHtml(row.location)}</td>
        <td>${escapeHtml(row.officer_name || 'Unassigned')}</td>
        <td class="mono">${money(row.fine_amount)}</td>
        <td>${statusBadge(row.status)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" onclick="viewOffense('${escapeHtml(row.offense_code)}')">View</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  const summary = document.getElementById('offenseFilterSummary');
  if (summary) {
    const filters = currentFilters();
    const parts = [
      `${state.offenses.length} record(s) found`,
      filters.offense && filters.offense !== 'All Types' ? `Offense: ${filters.offense}` : null,
      filters.status && filters.status !== 'All Status' ? `Status: ${filters.status}` : null,
      filters.search ? `Search: "${filters.search}"` : null,
    ].filter(Boolean);
    summary.textContent = parts.join(' | ');
  }
}

function renderTransactions() {
  const summary = state.paymentSummary || {};
  const todayCollected = document.getElementById('paymentTodayCollected');
  const pendingAmount = document.getElementById('paymentPendingAmount');
  const monthlyTotal = document.getElementById('paymentMonthlyTotal');
  const successRate = document.getElementById('paymentSuccessRate');
  const successRateMeta = document.getElementById('paymentSuccessRateMeta');

  if (todayCollected) todayCollected.textContent = money(summary.today_collected || 0);
  if (pendingAmount) pendingAmount.textContent = money(summary.pending_amount || 0);
  if (monthlyTotal) monthlyTotal.textContent = money(summary.monthly_total || 0);
  if (successRate) successRate.textContent = `${Number(summary.success_rate || 0).toFixed(1)}%`;
  if (successRateMeta) successRateMeta.textContent = `${Number(summary.transaction_count || 0)} recorded transaction(s) in the system`;

  const body = document.getElementById('transactionTableBody');
  if (!body) return;
  body.innerHTML = state.transactions.map((row) => `
    <tr>
      <td class="mono text-xs">${escapeHtml(row.transaction_code)}</td>
      <td class="mono text-accent">${escapeHtml(row.offense_code)}</td>
      <td>${escapeHtml(row.method)}</td>
      <td>${escapeHtml(row.account_reference || '-')}</td>
      <td class="text-success">${money(row.amount)}</td>
      <td>${statusBadge(row.status === 'Success' ? 'Paid' : row.status)}</td>
      <td class="mono text-xs">${escapeHtml(formatDate(row.processed_at))}</td>
    </tr>
  `).join('');
}

function renderEvidence() {
  const body = document.getElementById('evidenceTableBody');
  if (body) {
    body.innerHTML = state.evidence.map((row) => `
      <tr>
        <td class="mono text-accent">${escapeHtml(row.offense_code)}</td>
        <td>${escapeHtml(row.mime_type.startsWith('video') ? 'Video' : 'Photo')} - ${escapeHtml(row.offense_type)}</td>
        <td>${escapeHtml(row.original_name)}</td>
        <td>${escapeHtml(row.uploaded_by || 'System')}</td>
        <td class="mono text-xs">${escapeHtml(formatDate(row.uploaded_at))}</td>
        <td class="text-success">Verified</td>
      </tr>
    `).join('');
  }

  const grid = document.getElementById('evidenceGrid');
  if (grid) {
    grid.innerHTML = state.evidence.slice(0, 6).map((row) => `
      <div style="background:rgba(0,180,255,0.08);border:1px solid var(--border);border-radius:6px;padding:24px 18px;text-align:center;cursor:pointer" onclick="previewReportFor('${escapeHtml(row.offense_code)}')">
        <div style="font-size:32px;margin-bottom:8px">${row.mime_type.startsWith('video') ? '🎥' : '📷'}</div>
        <div style="font-size:12px;color:var(--text-dim)">${escapeHtml(row.offense_code)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${escapeHtml(row.original_name)}</div>
      </div>
    `).join('');
  }
}

function fineBadge(category) {
  const map = { Low: 'badge-neutral', Medium: 'badge-warning', High: 'badge-danger', Critical: 'badge-danger' };
  return `<span class="badge ${map[category] || 'badge-neutral'}">${escapeHtml(category)}</span>`;
}

function renderFineTypes() {
  fillFineSelects();
  const body = document.getElementById('fineTableBody');
  if (!body) return;

  body.innerHTML = state.fineTypes.map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${fineBadge(row.category)}</td>
      <td class="mono">${shortMoney(row.amount)}</td>
      <td>${escapeHtml(row.demerit_points)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="openFineEditor(${row.id})">Edit</button></td>
    </tr>
  `).join('');
};

function renderCitizens() {
  const body = document.getElementById('citizenTableBody');
  if (!body) return;

  const filter = citizenFilterValue();
  const rows = state.citizens.filter((row) => {
    if (!filter) return true;
    return [row.nrc, row.full_name, row.phone, row.license_number, row.plates]
      .some((value) => String(value || '').toLowerCase().includes(filter));
  });

  body.innerHTML = rows.map((row) => `
    <tr>
      <td class="mono text-xs">${escapeHtml(row.nrc)}</td>
      <td>${escapeHtml(row.full_name)}</td>
      <td class="mono text-xs">${escapeHtml(row.phone)}</td>
      <td class="mono text-xs">${escapeHtml(row.license_number)}</td>
      <td>${escapeHtml(row.plates)}</td>
      <td class="${Number(row.total_fines || 0) > 0 ? 'text-warning' : 'text-success'}">${money(row.total_fines)}</td>
      <td>${statusBadge(row.status)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showToast('Citizen profile is loaded from the live registry.','info')">View Profile</button></td>
    </tr>
  `).join('');
}

function renderVehicles() {
  const body = document.getElementById('vehicleTableBody');
  if (!body) return;

  body.innerHTML = state.vehicles.map((row) => `
    <tr>
      <td class="mono text-accent">${escapeHtml(row.plate_number)}</td>
      <td>${escapeHtml(`${row.make} ${row.model}`)}</td>
      <td>${escapeHtml(row.colour || '-')}</td>
      <td>${escapeHtml(row.owner_name)}</td>
      <td class="${row.roadworthy_expiry ? 'text-success' : 'text-warning'}">${escapeHtml(row.roadworthy_expiry || 'Not set')}</td>
      <td class="${String(row.insurance_status).toLowerCase() === 'expired' ? 'text-danger' : 'text-success'}">${escapeHtml(row.insurance_status)}</td>
      <td class="${Number(row.offense_count || 0) > 2 ? 'text-danger' : 'text-accent'}">${escapeHtml(row.offense_count)}</td>
      <td>${statusBadge(row.status)}</td>
    </tr>
  `).join('');
}

function renderOfficers() {
  const body = document.getElementById('officerTableBody');
  if (body) {
    body.innerHTML = state.officers.map((row) => `
      <tr>
        <td class="mono text-accent">${escapeHtml(row.service_number)}</td>
        <td>${escapeHtml(row.full_name)}</td>
        <td>${escapeHtml(row.rank_title)}</td>
        <td>${escapeHtml(row.province)}</td>
        <td>${escapeHtml(row.checkpoint)}</td>
        <td>${statusBadge(row.duty_status)}</td>
        <td class="${Number(row.offenses_today || 0) > 8 ? 'text-success' : 'text-accent'}">${escapeHtml(row.offenses_today)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" onclick="showToast('Officer data loaded from the database.','info')">View</button>
            <button class="btn btn-outline btn-sm" onclick="showPage('gps',document.querySelector('[onclick*=gps]'))">Track</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  const officerList = document.getElementById('officerList');
  if (officerList) {
    officerList.innerHTML = state.officers.slice(0, 6).map((row) => `
      <div class="feed-item">
        <div class="feed-icon ${row.duty_status === 'On Duty' ? 'success' : 'info'}">Unit</div>
        <div class="feed-body">
          <div class="feed-title">${escapeHtml(row.full_name)}</div>
          <div class="feed-meta">${escapeHtml(row.checkpoint)}</div>
        </div>
        <span class="badge ${row.duty_status === 'On Duty' ? 'badge-success' : 'badge-neutral'}">${escapeHtml(row.duty_status)}</span>
      </div>
    `).join('');
  }

  const total = state.officers.length;
  const onDuty = state.officers.filter((row) => row.duty_status === 'On Duty').length;
  const offDuty = state.officers.filter((row) => row.duty_status !== 'On Duty' && row.duty_status !== 'Suspended').length;
  const suspended = state.officers.filter((row) => row.duty_status === 'Suspended').length;

  if (document.getElementById('officerTotalCount')) document.getElementById('officerTotalCount').textContent = total;
  if (document.getElementById('officerOnDutyCount')) document.getElementById('officerOnDutyCount').textContent = onDuty;
  if (document.getElementById('officerOffDutyCount')) document.getElementById('officerOffDutyCount').textContent = offDuty;
  if (document.getElementById('officerSuspendedCount')) document.getElementById('officerSuspendedCount').textContent = suspended;
}

function renderNotifications() {
  const list = document.getElementById('notificationList');
  if (!list) return;

  list.innerHTML = state.notifications.map((row) => `
    <div class="feed-item">
      <div class="feed-icon ${row.channel === 'SMS' ? 'warning' : row.channel === 'Email' ? 'success' : 'info'}">${escapeHtml(row.channel)}</div>
      <div class="feed-body">
        <div class="feed-title">${escapeHtml(row.recipient_type)}</div>
        <div class="feed-meta">${escapeHtml(row.message)}${row.recipient_reference ? ` | ${escapeHtml(row.recipient_reference)}` : ''}</div>
      </div>
      <div class="feed-time">${escapeHtml(formatDate(row.sent_at))}</div>
    </div>
  `).join('');
}

function renderSettings() {
  if (document.getElementById('settingsOrganizationName')) document.getElementById('settingsOrganizationName').value = state.settings.organization_name || '';
  if (document.getElementById('settingsDefaultProvince')) document.getElementById('settingsDefaultProvince').value = state.settings.default_province || 'Lusaka Province';
  if (document.getElementById('settingsCurrency')) document.getElementById('settingsCurrency').value = state.settings.currency || '';
  if (document.getElementById('settingsDateFormat')) document.getElementById('settingsDateFormat').value = state.settings.date_format || '';
}

function renderProfile() {
  const profile = state.profile;
  if (!profile) return;

  const accountStatus = document.getElementById('profileAccountStatus');
  const dutyStatus = document.getElementById('profileDutyStatus');
  const offensesToday = document.getElementById('profileOffensesToday');
  const performance = document.getElementById('profilePerformanceRating');
  const detailsTable = document.getElementById('profileDetailsTable');
  const performanceTable = document.getElementById('profilePerformanceTable');

  if (accountStatus) accountStatus.textContent = profile.account_status || '-';
  if (dutyStatus) dutyStatus.textContent = profile.duty_status || '-';
  if (offensesToday) offensesToday.textContent = shortMoney(profile.offenses_today || 0);
  if (performance) performance.textContent = profile.performance_rating || '-';

  if (detailsTable) {
    detailsTable.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr><th>Full Name</th><td>${escapeHtml(profile.full_name)}</td></tr>
          <tr><th>Service Number</th><td class="mono text-accent">${escapeHtml(profile.service_number || '-')}</td></tr>
          <tr><th>Rank</th><td>${escapeHtml(profile.rank_title || '-')}</td></tr>
          <tr><th>Role</th><td>${escapeHtml(roleLabel(profile.role || ''))}</td></tr>
          <tr><th>NRC</th><td>${escapeHtml(profile.nrc || '-')}</td></tr>
          <tr><th>Phone</th><td>${escapeHtml(profile.phone || '-')}</td></tr>
          <tr><th>Email</th><td>${escapeHtml(profile.email || '-')}</td></tr>
          <tr><th>Province</th><td>${escapeHtml(profile.province || '-')}</td></tr>
          <tr><th>Station</th><td>${escapeHtml(profile.station || '-')}</td></tr>
          <tr><th>Checkpoint</th><td>${escapeHtml(profile.checkpoint || '-')}</td></tr>
          <tr><th>Last Login</th><td>${escapeHtml(formatDate(profile.last_login_at))}</td></tr>
        </tbody>
      </table>
    `;
  }

  if (performanceTable) {
    performanceTable.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr><th>Total Recorded Offenses</th><td>${escapeHtml(profile.total_offenses)}</td></tr>
          <tr><th>Offenses Today</th><td>${escapeHtml(profile.offenses_today)}</td></tr>
          <tr><th>Offenses This Month</th><td>${escapeHtml(profile.offenses_this_month)}</td></tr>
          <tr><th>Collected Amount</th><td>${money(profile.collected_amount)}</td></tr>
          <tr><th>Duty Status</th><td>${statusBadge(profile.duty_status)}</td></tr>
          <tr><th>Performance Rating</th><td>${analyticsRatingBadge(profile.performance_rating)}</td></tr>
        </tbody>
      </table>
    `;
  }
}

function toggleAdminFeatures() {
  const adminSection = document.getElementById('adminNavSection');
  if (adminSection) {
    adminSection.style.display = state.session?.role === 'admin' ? '' : 'none';
  }
}

function renderAdminCenter() {
  if (state.session?.role !== 'admin') return;

  const overview = state.adminOverview || {};
  const totals = overview.totals || {};
  const citizenSummary = overview.citizen_summary || {};

  if (document.getElementById('adminTotalOfficers')) document.getElementById('adminTotalOfficers').textContent = shortMoney(totals.total_officers || 0);
  if (document.getElementById('adminActiveOfficers')) document.getElementById('adminActiveOfficers').textContent = shortMoney(totals.active_officers || 0);
  if (document.getElementById('adminCitizenCount')) document.getElementById('adminCitizenCount').textContent = shortMoney(totals.citizens || 0);
  if (document.getElementById('adminRevenueTotal')) document.getElementById('adminRevenueTotal').textContent = money(totals.revenue || 0);

  const officerBody = document.getElementById('adminOfficerActivityBody');
  if (officerBody) {
    officerBody.innerHTML = (overview.officer_activity || []).map((row) => `
      <tr>
        <td>${escapeHtml(row.full_name)}</td>
        <td>${escapeHtml(row.checkpoint)}</td>
        <td>${statusBadge(row.duty_status)}</td>
        <td>${escapeHtml(row.offenses_today)}</td>
        <td>${escapeHtml(formatDate(row.last_login_at))}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">No officer activity available.</td></tr>';
  }

  const citizenBody = document.getElementById('adminCitizenSummaryBody');
  if (citizenBody) {
    citizenBody.innerHTML = `
      <tr><th>Total Citizens</th><td>${escapeHtml(citizenSummary.total_citizens || 0)}</td></tr>
      <tr><th>Active Citizens</th><td>${escapeHtml(citizenSummary.active_citizens || 0)}</td></tr>
      <tr><th>Flagged / Non-Active</th><td>${escapeHtml(citizenSummary.flagged_citizens || 0)}</td></tr>
      <tr><th>Total Vehicles</th><td>${escapeHtml(totals.vehicles || 0)}</td></tr>
      <tr><th>Total Offenses</th><td>${escapeHtml(totals.offenses || 0)}</td></tr>
      <tr><th>Unpaid Fines</th><td>${money(totals.unpaid_fines || 0)}</td></tr>
      <tr><th>Pending User Accounts</th><td>${escapeHtml(totals.pending_accounts || 0)}</td></tr>
    `;
  }

  const accountsBody = document.getElementById('adminAccountsBody');
  if (accountsBody) {
    accountsBody.innerHTML = state.adminAccounts.map((row) => `
      <tr>
        <td>${escapeHtml(row.full_name)}</td>
        <td>${escapeHtml(roleLabel(row.role))}</td>
        <td>${escapeHtml(row.province)}</td>
        <td>${statusBadge(row.account_status)}</td>
        <td>${escapeHtml(formatDate(row.last_login_at))}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" onclick="setAdminUserStatus(${Number(row.id)}, 'ACTIVE')">Activate</button>
            <button class="btn btn-outline btn-sm" onclick="setAdminUserStatus(${Number(row.id)}, 'DISABLED')">Disable</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6">No user accounts available.</td></tr>';
  }

  const auditList = document.getElementById('adminAuditTrailList');
  if (auditList) {
    auditList.innerHTML = state.adminAudit.map((row) => `
      <div class="feed-item">
        <div class="feed-icon info">${escapeHtml(String(row.actor_role || 'SYS').toUpperCase().slice(0, 3))}</div>
        <div class="feed-body">
          <div class="feed-title">${escapeHtml(row.actor_name)} - ${escapeHtml(row.action_key)}</div>
          <div class="feed-meta">${escapeHtml(row.entity_type)}: ${escapeHtml(row.entity_reference)}${row.details ? ` | ${escapeHtml(row.details)}` : ''}</div>
        </div>
        <div class="feed-time">${escapeHtml(formatDate(row.created_at))}</div>
      </div>
    `).join('') || '<div class="feed-item"><div class="feed-body"><div class="feed-meta">No audit trail entries yet.</div></div></div>';
  }
}

function analyticsRatingBadge(rating) {
  const map = {
    Excellent: 'badge-success',
    Good: 'badge-info',
    Average: 'badge-warning',
    Idle: 'badge-neutral',
  };
  return `<span class="badge ${map[rating] || 'badge-neutral'}">${escapeHtml(rating)}</span>`;
}

function renderAnalytics() {
  const summary = state.analytics.summary || {};
  const ytdOffenses = document.getElementById('analyticsYtdOffenses');
  const ytdRevenue = document.getElementById('analyticsYtdRevenue');
  const avgResolution = document.getElementById('analyticsAvgResolution');
  const complianceRate = document.getElementById('analyticsComplianceRate');
  const complianceMeta = document.getElementById('analyticsComplianceRateMeta');

  if (ytdOffenses) ytdOffenses.textContent = shortMoney(summary.ytd_offenses || 0);
  if (ytdRevenue) ytdRevenue.textContent = money(summary.ytd_revenue || 0);
  if (avgResolution) avgResolution.textContent = `${Number(summary.avg_resolution_days || 0).toFixed(1)} days`;
  if (complianceRate) complianceRate.textContent = `${Number(summary.compliance_rate || 0).toFixed(1)}%`;
  if (complianceMeta) complianceMeta.textContent = `${shortMoney(summary.paid_offenses || 0)} paid out of ${shortMoney(summary.total_offenses || 0)} recorded offenses`;

  const locationBody = document.getElementById('analyticsLocationTableBody');
  if (locationBody) {
    locationBody.innerHTML = (state.analytics.locations || []).map((row, index) => `
      <tr>
        <td>${escapeHtml(row.location || 'Unspecified')}</td>
        <td class="${index < 2 ? 'text-danger' : 'text-accent'}">${escapeHtml(row.total)}</td>
      </tr>
    `).join('') || '<tr><td colspan="2">No offense location data available.</td></tr>';
  }

  const performanceBody = document.getElementById('analyticsPerformanceTableBody');
  if (performanceBody) {
    performanceBody.innerHTML = (state.analytics.performance || []).map((row) => `
      <tr>
        <td>${escapeHtml(row.officer_name || 'Unassigned')}</td>
        <td>${escapeHtml(row.offenses)}</td>
        <td>${analyticsRatingBadge(row.rating)}</td>
      </tr>
    `).join('') || '<tr><td colspan="3">No officer performance data available.</td></tr>';
  }

  const hourBars = document.getElementById('hourBars');
  if (hourBars) {
    const hours = state.analytics.hours || [];
    const maxHour = Math.max(...hours.map((item) => Number(item.total || 0)), 1);
    hourBars.innerHTML = hours.map((item) => `
      <div style="margin-bottom:10px">
        <div class="flex justify-between" style="font-size:12px;margin-bottom:4px">
          <span style="color:var(--text-dim)">${escapeHtml(item.label)}</span>
          <span class="mono text-accent">${escapeHtml(item.total)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round((Number(item.total || 0) / maxHour) * 100)}%;background:var(--accent)"></div></div>
      </div>
    `).join('') || '<div style="font-size:12px;color:var(--text-dim)">No hourly offense data available.</div>';
  }

  const monthlyChart = document.getElementById('monthlyChart');
  if (monthlyChart && typeof drawBarChart === 'function') {
    monthlyChart.width = monthlyChart.parentElement.offsetWidth - 40;
    const ctx = monthlyChart.getContext('2d');
    const monthlyRows = state.analytics.monthly || [];
    if (monthlyRows.length) {
      drawBarChart(
        ctx,
        monthlyChart.width,
        200,
        monthlyRows.map((row) => Number(row.total || 0)),
        monthlyRows.map((row) => row.label),
        '#00b4ff',
      );
    } else {
      ctx.clearRect(0, 0, monthlyChart.width, 200);
      ctx.fillStyle = 'rgba(122,155,181,0.8)';
      ctx.font = '13px DM Sans';
      ctx.fillText('No monthly offense data available.', 20, 40);
    }
  }

  const provinceChart = document.getElementById('provinceChart');
  if (provinceChart && typeof drawBarChart === 'function') {
    provinceChart.width = provinceChart.parentElement.offsetWidth - 40;
    const ctx = provinceChart.getContext('2d');
    const provinceRows = state.analytics.province_revenue || [];
    if (provinceRows.length) {
      drawBarChart(
        ctx,
        provinceChart.width,
        200,
        provinceRows.map((row) => Number(row.total || 0)),
        provinceRows.map((row) => row.province),
        '#00ffb3',
      );
    } else {
      ctx.clearRect(0, 0, provinceChart.width, 200);
      ctx.fillStyle = 'rgba(122,155,181,0.8)';
      ctx.font = '13px DM Sans';
      ctx.fillText('No province revenue data available.', 20, 40);
    }
  }
}

window.initAnalyticsCharts = function initAnalyticsCharts() {
  renderAnalytics();
};

function renderAnalytics() {
  const summary = state.analytics.summary || {};
  const ytdOffenses = document.getElementById('analyticsYtdOffenses');
  const ytdRevenue = document.getElementById('analyticsYtdRevenue');
  const avgResolution = document.getElementById('analyticsAvgResolution');
  const complianceRate = document.getElementById('analyticsComplianceRate');
  const complianceMeta = document.getElementById('analyticsComplianceRateMeta');

  if (ytdOffenses) ytdOffenses.textContent = shortMoney(summary.ytd_offenses || 0);
  if (ytdRevenue) ytdRevenue.textContent = money(summary.ytd_revenue || 0);
  if (avgResolution) avgResolution.textContent = `${Number(summary.avg_resolution_days || 0).toFixed(1)} days`;
  if (complianceRate) complianceRate.textContent = `${Number(summary.compliance_rate || 0).toFixed(1)}%`;
  if (complianceMeta) complianceMeta.textContent = `${shortMoney(summary.paid_offenses || 0)} paid out of ${shortMoney(summary.total_offenses || 0)} recorded offenses`;

  const locationBody = document.getElementById('analyticsLocationTableBody');
  if (locationBody) {
    locationBody.innerHTML = (state.analytics.locations || []).map((row, index) => `
      <tr>
        <td>${escapeHtml(row.location || 'Unspecified')}</td>
        <td class="${index < 2 ? 'text-danger' : 'text-accent'}">${escapeHtml(row.total)}</td>
      </tr>
    `).join('') || '<tr><td colspan="2">No offense location data available.</td></tr>';
  }

  const performanceBody = document.getElementById('analyticsPerformanceTableBody');
  if (performanceBody) {
    performanceBody.innerHTML = (state.analytics.performance || []).map((row) => `
      <tr>
        <td>${escapeHtml(row.officer_name || 'Unassigned')}</td>
        <td>${escapeHtml(row.offenses)}</td>
        <td>${statusBadge(row.rating)}</td>
      </tr>
    `).join('') || '<tr><td colspan="3">No officer performance data available.</td></tr>';
  }

  const hourBars = document.getElementById('hourBars');
  if (hourBars) {
    const hours = state.analytics.hours || [];
    const maxHour = Math.max(...hours.map((item) => Number(item.total || 0)), 1);
    hourBars.innerHTML = hours.map((item) => `
      <div style="margin-bottom:10px">
        <div class="flex justify-between" style="font-size:12px;margin-bottom:4px">
          <span style="color:var(--text-dim)">${escapeHtml(item.label)}</span>
          <span class="mono text-accent">${escapeHtml(item.total)}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round((Number(item.total || 0) / maxHour) * 100)}%;background:var(--accent)"></div></div>
      </div>
    `).join('') || '<div style="font-size:12px;color:var(--text-dim)">No hourly offense data available.</div>';
  }

  const monthlyChart = document.getElementById('monthlyChart');
  if (monthlyChart && typeof drawBarChart === 'function') {
    monthlyChart.width = monthlyChart.parentElement.offsetWidth - 40;
    const ctx = monthlyChart.getContext('2d');
    drawBarChart(
      ctx,
      monthlyChart.width,
      200,
      (state.analytics.monthly || []).map((row) => Number(row.total || 0)),
      (state.analytics.monthly || []).map((row) => row.label),
      '#00b4ff',
    );
  }

  const provinceChart = document.getElementById('provinceChart');
  if (provinceChart && typeof drawBarChart === 'function') {
    provinceChart.width = provinceChart.parentElement.offsetWidth - 40;
    const ctx = provinceChart.getContext('2d');
    drawBarChart(
      ctx,
      provinceChart.width,
      200,
      (state.analytics.province_revenue || []).map((row) => Number(row.total || 0)),
      (state.analytics.province_revenue || []).map((row) => row.province),
      '#00ffb3',
    );
  }
}

window.populateTables = function populateTables() {
  refreshAllData();
};

async function loadDashboard() {
  const payload = await api('dashboard');
  state.dashboard = payload.data;
  renderDashboard();
}

async function loadFineTypes() {
  const payload = await api('fine_types');
  state.fineTypes = payload.data;
  renderFineTypes();
  updateFineAmount();
}

async function loadOffenses() {
  const params = new URLSearchParams(currentFilters());
  const payload = await api('offenses', { query: Object.fromEntries(params.entries()) });
  state.offenses = payload.data;
  if (!state.selectedOffenseId && state.offenses[0]) state.selectedOffenseId = state.offenses[0].offense_code;
  renderOffenses();
}

async function loadTransactions() {
  const payload = await api('transactions');
  state.transactions = payload.data;
  state.paymentSummary = payload.summary || {};
  renderTransactions();
}

async function loadEvidence() {
  const payload = await api('evidence');
  state.evidence = payload.data;
  renderEvidence();
}

async function loadCitizens() {
  const payload = await api('citizens');
  state.citizens = payload.data;
  renderCitizens();
}

async function loadVehicles() {
  const payload = await api('vehicles');
  state.vehicles = payload.data;
  renderVehicles();
}

async function loadOfficers() {
  const payload = await api('officers');
  state.officers = payload.data;
  renderOfficers();
}

async function loadNotifications() {
  const payload = await api('notifications');
  state.notifications = payload.data;
  renderNotifications();
}

async function loadSettings() {
  const payload = await api('settings');
  state.settings = payload.data || {};
  renderSettings();
}

async function loadProfile() {
  const payload = await api('my_profile');
  state.profile = payload.data || null;
  renderProfile();
}

async function loadAnalytics() {
  const payload = await api('analytics');
  state.analytics = payload.data || {};
  renderAnalytics();
}

async function loadAdminOverview() {
  if (state.session?.role !== 'admin') return;
  const payload = await api('admin_overview');
  state.adminOverview = payload.data || null;
  renderAdminCenter();
}

async function loadAdminAccounts() {
  if (state.session?.role !== 'admin') return;
  const payload = await api('admin_accounts');
  state.adminAccounts = payload.data || [];
  renderAdminCenter();
}

async function loadAdminAudit() {
  if (state.session?.role !== 'admin') return;
  const payload = await api('admin_audit');
  state.adminAudit = payload.data || [];
  renderAdminCenter();
}

async function refreshAllData() {
  try {
    await Promise.all([
      loadDashboard(),
      loadFineTypes(),
      loadOffenses(),
      loadTransactions(),
      loadEvidence(),
      loadCitizens(),
      loadVehicles(),
      loadOfficers(),
      loadNotifications(),
      loadSettings(),
      loadAnalytics(),
      loadProfile(),
      loadAdminOverview(),
      loadAdminAccounts(),
      loadAdminAudit(),
    ]);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function applyAuthenticatedUser(user) {
  state.session = user;
  toggleAdminFeatures();
  const fullName = `${user.first_name} ${user.last_name}`;
  sessionStorage.setItem('rtsa_session', JSON.stringify({
    role: user.role,
    name: fullName,
    roleLbl: roleLabel(user.role),
    avatar: initials(user),
  }));
  if (user.role === 'citizen') {
    showCitizenPortal();
    document.getElementById('citizenLookupNrc').value = user.nrc || '';
    setCitizenStatus('Enter your vehicle number plate to continue.', 'muted');
    return;
  }
  applySession(user.role, fullName, roleLabel(user.role), initials(user));
  refreshAllData();
  if (user.role === 'admin') {
    setTimeout(() => showPage('admin', document.querySelector('#adminNavSection .nav-item')), 150);
  }
}

async function initSession() {
  try {
    const payload = await api('me');
    if (payload.user) {
      applyAuthenticatedUser(payload.user);
    } else {
      sessionStorage.removeItem('rtsa_session');
      document.getElementById('landing').style.display = 'flex';
      document.getElementById('app').classList.remove('active');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

window.doLogin = async function doLogin() {
  try {
    const identifier = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPw').value;
    const activeRole = window.currentRole || 'officer';

    if (activeRole === 'citizen') {
      showCitizenPortal();
      setCitizenStatus('Enter your NRC and vehicle number plate to continue.', 'muted');
      return;
    }

    if (!identifier || !password) {
      showToast('Enter your service number and password first.', 'warning');
      return;
    }

    const payload = await api('login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier,
        password,
        role: activeRole,
        province: document.getElementById('loginProvince')?.value || '',
      }),
    });

    applyAuthenticatedUser(payload.user);
    showToast('Welcome back. Live records loaded successfully.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.setRole = function setRole(role, btn) {
  window.currentRole = role;
  document.querySelectorAll('#landing .role-select .role-btn').forEach((button) => button.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (role === 'citizen') {
    showCitizenPortal();
    setCitizenStatus('Enter your NRC and vehicle number plate to continue.', 'muted');
  } else if (document.getElementById('citizenPortal')?.style.display === 'block') {
    showMainLanding();
  }
};

window.backToMainLogin = function backToMainLogin() {
  showMainLanding();
  resetCitizenPortal();
  const officerButton = document.querySelector(".role-btn[onclick*=\"officer\"]");
  document.querySelectorAll('#landing .role-select .role-btn').forEach((button) => button.classList.remove('active'));
  if (officerButton) officerButton.classList.add('active');
  window.currentRole = 'officer';
};

window.openProfilePage = async function openProfilePage() {
  if (!state.session) {
    showToast('Sign in first to view your profile.', 'warning');
    return;
  }

  try {
    await loadProfile();
    showPage('profile');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.setAdminUserStatus = async function setAdminUserStatus(userId, accountStatus) {
  if (state.session?.role !== 'admin') {
    showToast('Administrator access required.', 'error');
    return;
  }

  try {
    await api('admin_set_user_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        account_status: accountStatus,
      }),
    });
    showToast(`User account status changed to ${accountStatus}.`, 'success');
    await Promise.all([loadAdminAccounts(), loadAdminAudit()]);
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.refreshAdminCenter = async function refreshAdminCenter() {
  try {
    await Promise.all([loadAdminOverview(), loadAdminAccounts(), loadAdminAudit()]);
    showToast('Admin center refreshed with live system data.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.resetCitizenPortal = function resetCitizenPortal() {
  state.citizenPortal.lookup = null;
  state.citizenPortal.selectedOffenseCode = '';
  state.citizenPortal.receipt = null;
  document.getElementById('citizenLookupResults').style.display = 'none';
  document.getElementById('citizenLookupNrc').value = '';
  document.getElementById('citizenLookupPlate').value = '';
  document.getElementById('citizenPaymentOffenseCode').value = '';
  document.getElementById('citizenPaymentOffenseLabel').value = '';
  document.getElementById('citizenPaymentReference').value = '';
  document.getElementById('citizenPaymentAmount').value = '';
  document.getElementById('citizenReceiptCard').style.display = 'none';
  document.getElementById('citizenReceiptBody').innerHTML = '';
  setCitizenStatus('Use the citizen role to quickly check fines and evidence tied to your vehicle.', 'muted');
};

window.lookupCitizenRecords = async function lookupCitizenRecords() {
  const nrc = document.getElementById('citizenLookupNrc').value.trim();
  const plate = document.getElementById('citizenLookupPlate').value.trim();

  if (!nrc || !plate) {
    setCitizenStatus('Enter both NRC and vehicle plate number first.', 'warning');
    return;
  }

  try {
    setCitizenStatus('Searching live records...', 'muted');
    const payload = await api('citizen_lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nrc, plate }),
    });
    renderCitizenLookup(payload.data);
  } catch (error) {
    document.getElementById('citizenLookupResults').style.display = 'none';
    setCitizenStatus(error.message, 'error');
  }
};

window.prepareCitizenPayment = function prepareCitizenPayment(offenseCode) {
  const offenses = state.citizenPortal.lookup?.offenses || [];
  const offense = offenses.find((item) => item.offense_code === offenseCode);
  if (!offense) {
    showToast('Offense record not found for payment.', 'warning');
    return;
  }

  state.citizenPortal.selectedOffenseCode = offenseCode;
  document.getElementById('citizenPaymentOffenseCode').value = offense.offense_code;
  document.getElementById('citizenPaymentOffenseLabel').value = `${offense.offense_code} - ${offense.offense_type}`;
  document.getElementById('citizenPaymentAmount').value = Number(offense.balance_due || offense.fine_amount || 0).toFixed(2);
  document.getElementById('citizenPaymentReference').focus();
};

window.citizenPaySelectedOffense = async function citizenPaySelectedOffense() {
  const nrc = document.getElementById('citizenLookupNrc').value.trim();
  const plate = document.getElementById('citizenLookupPlate').value.trim();
  const offenseCode = document.getElementById('citizenPaymentOffenseCode').value.trim();

  if (!offenseCode) {
    showToast('Select an offense payment button first.', 'warning');
    return;
  }

  try {
    const payload = await api('citizen_pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nrc,
        plate,
        offense_code: offenseCode,
        method: document.getElementById('citizenPaymentMethod').value,
        account_reference: document.getElementById('citizenPaymentReference').value.trim(),
        amount: document.getElementById('citizenPaymentAmount').value,
      }),
    });

    const refreshed = await api('citizen_lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nrc, plate }),
    });
    renderCitizenLookup(refreshed.data);
    renderCitizenReceipt(payload.receipt);
    showToast('Citizen payment recorded successfully.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.printCitizenReceipt = function printCitizenReceipt() {
  const receipt = state.citizenPortal.receipt;
  if (!receipt) {
    showToast('No receipt is ready to print yet.', 'warning');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=760,height=900');
  if (!printWindow) {
    showToast('Allow pop-ups to print the receipt.', 'warning');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Citizen Payment Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
          th { width: 34%; background: #f5f5f5; }
          .meta { color: #555; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <h1>ZP - TOMS Citizen Payment Receipt</h1>
        <div class="meta">Generated on ${escapeHtml(formatDate(receipt.processed_at))}</div>
        <table>
          <tr><th>Transaction Code</th><td>${escapeHtml(receipt.transaction_code)}</td></tr>
          <tr><th>Status</th><td>${escapeHtml(receipt.status)}</td></tr>
          <tr><th>Citizen</th><td>${escapeHtml(receipt.citizen_name)}</td></tr>
          <tr><th>NRC</th><td>${escapeHtml(receipt.nrc)}</td></tr>
          <tr><th>Plate Number</th><td>${escapeHtml(receipt.plate_number)}</td></tr>
          <tr><th>Offense</th><td>${escapeHtml(receipt.offense_code)} - ${escapeHtml(receipt.offense_type)}</td></tr>
          <tr><th>Method</th><td>${escapeHtml(receipt.method)}</td></tr>
          <tr><th>Account Reference</th><td>${escapeHtml(receipt.account_reference)}</td></tr>
          <tr><th>Amount Paid</th><td>${escapeHtml(money(receipt.amount))}</td></tr>
          <tr><th>Original Fine</th><td>${escapeHtml(money(receipt.fine_amount))}</td></tr>
          <tr><th>Balance Remaining</th><td>${escapeHtml(money(receipt.balance_due))}</td></tr>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

window.doLogout = async function doLogout() {
  try {
    await api('logout', { method: 'POST' });
  } catch (error) {
    // Ignore logout API errors and clear the session locally.
  }
  sessionStorage.removeItem('rtsa_session');
  state.session = null;
  toggleAdminFeatures();
  document.getElementById('app').classList.remove('active');
  document.getElementById('landing').style.display = 'flex';
};

window.submitRegistration = async function submitRegistration() {
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  try {
    await api('register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: document.getElementById('registerFirstName').value.trim(),
        last_name: document.getElementById('registerLastName').value.trim(),
        nrc: document.getElementById('registerNrc').value.trim(),
        dob: document.getElementById('registerDob').value,
        phone: document.getElementById('registerPhone').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        role: document.getElementById('registerRole').value.toLowerCase().includes('citizen') ? 'citizen' : 'officer',
        province: document.getElementById('registerProvince').value,
        station: document.getElementById('registerStation').value.trim(),
        service_number: document.getElementById('registerServiceNumber').value.trim(),
        password,
        supervisor: document.getElementById('registerSupervisor').value.trim(),
      }),
    });

    closeModal('register');
    showToast('Registration submitted. The account will be activated after review.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.submitOffense = async function submitOffense() {
  const form = new FormData();
  form.append('offense_code', document.getElementById('recordOffenseId').value);
  form.append('vehicle_plate', document.getElementById('recordPlate').value.trim());
  form.append('driver_name', document.getElementById('recordDriverName').value.trim());
  form.append('offense_type', document.getElementById('recordOffenseType').value);
  form.append('location', document.getElementById('recordLocation').value.trim());
  form.append('speed_recorded', document.getElementById('recordSpeed').value);
  form.append('occurred_at', document.getElementById('recordOccurredAt').value);
  form.append('fine_amount', document.getElementById('recordFineAmount').value);
  form.append('status', document.getElementById('recordStatus').value);
  form.append('notes', document.getElementById('recordNotes').value.trim());

  const evidence = document.getElementById('recordEvidence').files;
  [...evidence].forEach((file) => form.append('evidence[]', file));

  try {
    const response = await fetch('api/index.php?action=save_offense', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (error) {
      throw new Error('The offense save API returned invalid output. Check the PHP error log or database connection.');
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || 'Unable to save offense.');
    }

    state.selectedOffenseId = payload.offense_code;
    closeModal('recordOffense');
    resetOffenseForm();
    showToast('Offense saved and evidence uploaded successfully.', 'success');
    await refreshAllData();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function resetOffenseForm() {
  document.getElementById('recordOffenseId').value = '';
  document.getElementById('recordPlate').value = '';
  document.getElementById('recordDriverName').value = '';
  document.getElementById('recordLocation').value = '';
  document.getElementById('recordSpeed').value = '';
  document.getElementById('recordOccurredAt').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('recordNotes').value = '';
  document.getElementById('recordEvidence').value = '';
  document.getElementById('recordEvidenceSummary').textContent = 'No files selected.';
  updateFineAmount();
}

window.editOffense = async function editOffense(code) {
  try {
    const payload = await api('offense_detail', { query: { id: code } });
    const detail = payload.data;
    state.selectedOffenseId = detail.offense_code;
    document.getElementById('recordOffenseId').value = detail.offense_code;
    document.getElementById('recordPlate').value = detail.vehicle_plate || '';
    document.getElementById('recordDriverName').value = detail.driver_name || '';
    document.getElementById('recordOffenseType').value = detail.offense_type || '';
    document.getElementById('recordStatus').value = detail.status || 'Pending';
    document.getElementById('recordLocation').value = detail.location || '';
    document.getElementById('recordSpeed').value = detail.speed_recorded || '';
    document.getElementById('recordOccurredAt').value = String(detail.occurred_at || '').replace(' ', 'T').slice(0, 16);
    document.getElementById('recordFineAmount').value = Number(detail.fine_amount || 0);
    document.getElementById('recordNotes').value = detail.notes || '';
    document.getElementById('recordEvidenceSummary').textContent = `${detail.evidence.length} existing evidence file(s).`;
    openModal('recordOffense');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.viewOffense = async function viewOffense(code) {
  await previewReportFor(code);
};

window.previewReportFor = async function previewReportFor(code) {
  try {
    const payload = await api('offense_detail', { query: { id: code } });
    const detail = payload.data;
    state.selectedOffenseId = detail.offense_code;
    document.getElementById('reportPreviewBody').innerHTML = `
      <div class="grid-2" style="gap:12px">
        <div class="stat-card"><div class="sc-label">OFFENSE ID</div><div class="sc-value text-accent" style="font-size:24px">${escapeHtml(detail.offense_code)}</div></div>
        <div class="stat-card"><div class="sc-label">STATUS</div><div class="sc-value text-warning" style="font-size:24px">${escapeHtml(detail.status)}</div></div>
      </div>
      <table class="data-table" style="margin-top:16px">
        <tbody>
          <tr><th>Driver</th><td>${escapeHtml(detail.driver_name)}</td><th>Plate</th><td>${escapeHtml(detail.vehicle_plate)}</td></tr>
          <tr><th>Offense</th><td>${escapeHtml(detail.offense_type)}</td><th>Fine</th><td>${money(detail.fine_amount)}</td></tr>
          <tr><th>Location</th><td>${escapeHtml(detail.location)}</td><th>Officer</th><td>${escapeHtml(detail.officer_name || 'Unassigned')}</td></tr>
          <tr><th>Occurred</th><td>${escapeHtml(formatDate(detail.occurred_at))}</td><th>Demerit Points</th><td>${escapeHtml(detail.demerit_points)}</td></tr>
          <tr><th>Notes</th><td colspan="3">${escapeHtml(detail.notes || 'No notes recorded.')}</td></tr>
        </tbody>
      </table>
      <div class="section-sub" style="margin:16px 0 8px">Evidence Files</div>
      <div>
        ${
          detail.evidence.length
            ? detail.evidence.map((item) => {
                const fileUrl = `api/index.php?action=evidence_file&file=${encodeURIComponent(item.stored_name)}`;

                if (item.mime_type.startsWith('image/')) {
                  return `
                    <div class="card" style="margin-bottom:12px;padding:12px">
                      <div style="margin-bottom:8px;font-size:12px;color:var(--text-dim)">${escapeHtml(item.original_name)}</div>
                      <img src="${fileUrl}" alt="${escapeHtml(item.original_name)}" style="width:100%;max-height:320px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
                    </div>
                  `;
                }

                if (item.mime_type.startsWith('video/')) {
                  return `
                    <div class="card" style="margin-bottom:12px;padding:12px">
                      <div style="margin-bottom:8px;font-size:12px;color:var(--text-dim)">${escapeHtml(item.original_name)}</div>
                      <video controls style="width:100%;max-height:320px;border-radius:6px;border:1px solid var(--border)">
                        <source src="${fileUrl}" type="${escapeHtml(item.mime_type)}">
                        Your browser does not support video preview.
                      </video>
                    </div>
                  `;
                }

                return `
                  <div class="feed-item">
                    <div class="feed-icon info">File</div>
                    <div class="feed-body">
                      <div class="feed-title">${escapeHtml(item.original_name)}</div>
                      <div class="feed-meta"><a href="${fileUrl}" target="_blank">Open file</a></div>
                    </div>
                  </div>
                `;
              }).join('')
            : 'No evidence uploaded yet.'
        }
      </div>

      <div class="section-sub" style="margin:16px 0 8px">Transactions</div>
      <div>${detail.transactions.length ? detail.transactions.map((item) => `<div class="feed-item"><div class="feed-icon success">💳</div><div class="feed-body"><div class="feed-title">${escapeHtml(item.transaction_code)} - ${money(item.amount)}</div><div class="feed-meta">${escapeHtml(item.method)} | ${escapeHtml(item.status)} | ${escapeHtml(formatDate(item.processed_at))}</div></div></div>`).join('') : 'No transactions recorded yet.'}</div>
    `;
    openModal('reportPreview');
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.openSelectedReportPreview = function openSelectedReportPreview(openWindow = false) {
  if (!state.selectedOffenseId && !state.offenses[0]) {
    showToast('Select a report first by opening an offense record.', 'warning');
    return;
  }
  if (openWindow) {
    window.open(buildReportUrl('api/report_preview.php'), '_blank');
    return;
  }
  previewReportFor(state.selectedOffenseId || state.offenses[0].offense_code);
};

window.downloadSelectedReportPdf = function downloadSelectedReportPdf() {
  window.open(buildReportUrl('api/export_pdf.php'), '_blank');
};

window.downloadSelectedReportCsv = function downloadSelectedReportCsv() {
  window.open(buildReportUrl('api/export_csv.php'), '_blank');
};

window.exportOffensesCsv = function exportOffensesCsv() {
  window.open(buildReportUrl('api/export_csv.php'), '_blank');
};

window.exportDashboardCsv = function exportDashboardCsv() {
  window.open('api/export_csv.php', '_blank');
};

window.refreshDashboard = function refreshDashboard() {
  refreshAllData();
};

window.submitTransaction = async function submitTransaction() {
  try {
    const payload = await api('save_transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offense_code: document.getElementById('paymentOffenseId').value.trim(),
        method: document.getElementById('paymentMethod').value,
        account_reference: document.getElementById('paymentAccount').value.trim(),
        amount: document.getElementById('paymentAmount').value,
      }),
    });
    document.getElementById('receiptTransactionId').value = payload.transaction_code;
    showToast('Transaction stored and dashboard totals updated.', 'success');
    await refreshAllData();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.submitCitizen = async function submitCitizen() {
  try {
    await api('save_citizen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: document.getElementById('citizenFirstName').value.trim(),
        last_name: document.getElementById('citizenLastName').value.trim(),
        nrc: document.getElementById('citizenNrc').value.trim(),
        phone: document.getElementById('citizenPhone').value.trim(),
        email: document.getElementById('citizenEmail').value.trim(),
        license_number: document.getElementById('citizenLicenseNumber').value.trim(),
        license_class: document.getElementById('citizenLicenseClass').value,
        province: document.getElementById('citizenProvince').value.trim(),
      }),
    });

    closeModal('addCitizen');
    showToast('Driver record created successfully.', 'success');
    await loadCitizens();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.submitVehicle = async function submitVehicle() {
  try {
    await api('save_vehicle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plate_number: document.getElementById('vehiclePlateNumber').value.trim(),
        owner_identifier: document.getElementById('vehicleOwnerIdentifier').value.trim(),
        make: document.getElementById('vehicleMake').value.trim(),
        model: document.getElementById('vehicleModel').value.trim(),
        vehicle_year: document.getElementById('vehicleYear').value,
        colour: document.getElementById('vehicleColour').value.trim(),
        chassis_number: document.getElementById('vehicleChassisNumber').value.trim(),
        roadworthy_expiry: document.getElementById('vehicleRoadworthyExpiry').value,
        insurance_status: document.getElementById('vehicleInsuranceStatus').value,
      }),
    });

    closeModal('addVehicle');
    showToast('Vehicle registered successfully.', 'success');
    await loadVehicles();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

function renderVehicleLookupResult(payload) {
  const resultCard = document.getElementById('vehicleAiResultCard');
  const resultBody = document.getElementById('vehicleAiResult');
  const vehicle = payload.data;

  if (!resultCard || !resultBody) return;

  resultCard.style.display = 'block';

  if (!vehicle) {
    resultBody.innerHTML = `
      <div class="section-sub">Detected / searched plate: <span class="mono text-accent">${escapeHtml(payload.plate_number)}</span></div>
      <div>No registered vehicle was found in the database.</div>
    `;
    return;
  }

  resultBody.innerHTML = `
    <div class="grid-2" style="gap:12px">
      <div class="stat-card">
        <div class="sc-label">PLATE</div>
        <div class="sc-value text-accent" style="font-size:22px">${escapeHtml(vehicle.plate_number)}</div>
      </div>
      <div class="stat-card">
        <div class="sc-label">OWNER</div>
        <div class="sc-value" style="font-size:22px">${escapeHtml(vehicle.owner_name || 'Unknown')}</div>
      </div>
    </div>

    <table class="data-table" style="margin-top:16px">
      <tbody>
        <tr><th>Make / Model</th><td>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</td></tr>
        <tr><th>Colour</th><td>${escapeHtml(vehicle.colour || '-')}</td></tr>
        <tr><th>Owner NRC</th><td>${escapeHtml(vehicle.nrc || '-')}</td></tr>
        <tr><th>Phone</th><td>${escapeHtml(vehicle.owner_phone || '-')}</td></tr>
        <tr><th>License No.</th><td>${escapeHtml(vehicle.license_number || '-')}</td></tr>
        <tr><th>Vehicle Status</th><td>${escapeHtml(vehicle.status || '-')}</td></tr>
      </tbody>
    </table>

    <div class="section-sub" style="margin:16px 0 8px">Past and Current Offense History</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Offense ID</th>
          <th>Type</th>
          <th>Location</th>
          <th>Date</th>
          <th>Fine</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${
          (vehicle.offense_history || []).length
            ? vehicle.offense_history.map((item) => `
              <tr>
                <td class="mono text-accent">${escapeHtml(item.offense_code)}</td>
                <td>${escapeHtml(item.offense_type)}</td>
                <td>${escapeHtml(item.location)}</td>
                <td>${escapeHtml(formatDate(item.occurred_at))}</td>
                <td>${money(item.fine_amount)}</td>
                <td>${statusBadge(item.status)}</td>
              </tr>
            `).join('')
            : '<tr><td colspan="6">No offense history found for this vehicle.</td></tr>'
        }
      </tbody>
    </table>
  `;
}

window.detectVehicleFromPlateImage = async function detectVehicleFromPlateImage() {
  const fileInput = document.getElementById('plateImageInput');
  const file = fileInput?.files?.[0];

  if (!file) {
    showToast('Select or capture a number plate image first.', 'warning');
    return;
  }

  const form = new FormData();
  form.append('plate_image', file);

  try {
    const response = await fetch('api/index.php?action=detect_vehicle_by_plate_image', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    });

    const raw = await response.text();
    let payload;

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (error) {
      throw new Error('The AI plate detection API returned invalid JSON.');
    }

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || 'Plate scan failed.');
    }

    state.lastDetectedPlate = payload.plate_number || '';
    const manualPlateSearch = document.getElementById('manualPlateSearch');
    if (manualPlateSearch && state.lastDetectedPlate) {
      manualPlateSearch.value = state.lastDetectedPlate;
    }

    await verifyDetectedPlate(true);
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.verifyDetectedPlate = async function verifyDetectedPlate(fromAiScan = false) {
  const plateField = document.getElementById('manualPlateSearch');
  const plate = plateField?.value.trim() || state.lastDetectedPlate;

  if (!plate) {
    showToast('Scan a plate image first or type a plate number to verify.', 'warning');
    return;
  }

  try {
    const payload = await api('vehicle_lookup', {
      query: { plate },
    });

    state.lastDetectedPlate = payload.plate_number || plate;
    if (plateField) {
      plateField.value = state.lastDetectedPlate;
    }

    renderVehicleLookupResult(payload);
    showToast(
      fromAiScan
        ? `Plate detected and verified: ${payload.plate_number}`
        : `MVIC verification completed for ${payload.plate_number}.`,
      'success'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.searchVehicleByPlate = async function searchVehicleByPlate() {
  const plate = document.getElementById('manualPlateSearch')?.value.trim();

  if (!plate) {
    showToast('Enter a plate number first.', 'warning');
    return;
  }

  state.lastDetectedPlate = plate;
  await verifyDetectedPlate(false);
};


window.submitNotification = async function submitNotification() {
  try {
    await api('save_notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_type: document.getElementById('notificationRecipientType').value,
        recipient_reference: document.getElementById('notificationRecipientReference').value.trim(),
        channel: state.notificationChannel,
        message: document.getElementById('notificationMessage').value.trim(),
      }),
    });

    document.getElementById('notificationRecipientReference').value = '';
    document.getElementById('notificationMessage').value = '';
    showToast('Notification sent successfully.', 'success');
    await loadNotifications();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.saveSettings = async function saveSettings() {
  try {
    await api('save_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_name: document.getElementById('settingsOrganizationName').value.trim(),
        default_province: document.getElementById('settingsDefaultProvince').value,
        currency: document.getElementById('settingsCurrency').value.trim(),
        date_format: document.getElementById('settingsDateFormat').value.trim(),
      }),
    });

    showToast('Settings saved successfully.', 'success');
    await loadSettings();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.generateReceiptPreview = function generateReceiptPreview() {
  const transactionCode = document.getElementById('receiptTransactionId').value.trim();
  const transaction = state.transactions.find((item) => item.transaction_code === transactionCode);
  if (!transaction) {
    showToast('Transaction not found in the recent list.', 'warning');
    return;
  }
  state.selectedOffenseId = transaction.offense_code;
  previewReportFor(transaction.offense_code);
};

window.openFineEditor = function openFineEditor(id = null) {
  const fine = state.fineTypes.find((item) => Number(item.id) === Number(id));
  document.getElementById('fineTypeId').value = fine?.id || '';
  document.getElementById('fineName').value = fine?.name || '';
  document.getElementById('fineCategory').value = fine?.category || 'Medium';
  document.getElementById('fineAmount').value = fine?.amount || '';
  document.getElementById('finePoints').value = fine?.demerit_points || '';
  document.getElementById('fineDescription').value = fine?.description || '';
  openModal('fineEditor');
};

window.saveFineType = async function saveFineType() {
  try {
    await api('save_fine_type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: document.getElementById('fineTypeId').value,
        name: document.getElementById('fineName').value.trim(),
        category: document.getElementById('fineCategory').value,
        amount: document.getElementById('fineAmount').value,
        demerit_points: document.getElementById('finePoints').value,
        description: document.getElementById('fineDescription').value.trim(),
      }),
    });
    closeModal('fineEditor');
    showToast('Fine schedule updated successfully.', 'success');
    await loadFineTypes();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

let filterTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('recordEvidence');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const count = fileInput.files.length;
      document.getElementById('recordEvidenceSummary').textContent = count ? `${count} file(s) selected for upload.` : 'No files selected.';
    });
  }

  ['globalSearchInput', 'offenseTypeFilter', 'offenseStatusFilter'].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('input', () => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => {
        if (state.session) loadOffenses().catch((error) => showToast(error.message, 'error'));
      }, 300);
    });
    element.addEventListener('change', () => {
      if (state.session) loadOffenses().catch((error) => showToast(error.message, 'error'));
    });
  });

  const citizenSearch = document.getElementById('citizenSearchInput');
  if (citizenSearch) {
    citizenSearch.addEventListener('input', () => renderCitizens());
  }

  const channelButtons = document.querySelectorAll('#notificationChannelSelector .role-btn');
  channelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      channelButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      state.notificationChannel = button.dataset.channel || 'SMS';
    });
  });

   resetOffenseForm();

  const savedTheme = localStorage.getItem('rtsa_theme') || 'dark';
  applyTheme(savedTheme);

  ['citizenLookupNrc', 'citizenLookupPlate'].forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        lookupCitizenRecords();
      }
    });
  });

  initSession();
});
