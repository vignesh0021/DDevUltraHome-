/**
 * DDevUltraHome Mobile-First Client Controller
 * Tamil Nadu Civil Engineering, PWD Material Intelligence & Scrap Management
 */

import { i18n, I18N_DATA } from './i18n.js';
import { apiClient } from './apiClient.js';
import { PlanBudgetController } from './planBudget.js';
import { ScreenRouter } from './screens/index.js';
import { BusinessApi } from './businessApi.js';

// Global Application State
export const state = {
  currentLang: i18n.lang, // Default 'ta' (Tamil)
  currentDistrict: 'Chennai',
  activeTab: 'tab-home',
  activeSubtab: 'sub-concrete',
  activeCalcCategory: 'all',
  rates: [],
  scrapRates: [],
  lastScrapCalculation: null
};

// Initial Sample BOQ
const sampleBoqItems = [
  { itemCode: 'ITEM-01', description: 'Earthwork excavation in foundation trenches up to 1.5m depth', quantity: 45.0, unit: 'm³', materialRate: 0, labourRate: 350 },
  { itemCode: 'ITEM-02', description: 'Plain Cement Concrete (PCC 1:4:8) under footings and plinth beams', quantity: 8.5, unit: 'm³', materialRate: 3400, labourRate: 750 },
  { itemCode: 'ITEM-03', description: 'Reinforced Cement Concrete (RCC M20) in footings, beams, and slabs', quantity: 28.0, unit: 'm³', materialRate: 4600, labourRate: 1400 },
  { itemCode: 'ITEM-04', description: 'Fe550D TMT Reinforcement Steel cutting, bending, and placing', quantity: 2240, unit: 'kg', materialRate: 64.5, labourRate: 11.0 },
  { itemCode: 'ITEM-05', description: 'Traditional Red Country Brick masonry in cement mortar 1:5 (9-inch wall)', quantity: 32.0, unit: 'm³', materialRate: 4800, labourRate: 1550 },
  { itemCode: 'ITEM-06', description: 'Internal wall and ceiling plastering 12mm thick in CM 1:5', quantity: 240.0, unit: 'm²', materialRate: 75, labourRate: 145 },
  { itemCode: 'ITEM-07', description: 'Vitrified floor tiles 600x600mm laid on 20mm mortar bed', quantity: 85.0, unit: 'm²', materialRate: 450, labourRate: 180 },
  { itemCode: 'ITEM-08', description: 'Interior painting with 2 coats wall putty, primer, and acrylic emulsion', quantity: 240.0, unit: 'm²', materialRate: 60, labourRate: 90 }
];

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Core Systems
  initTheme();
  initLocalization();
  initConnectionStatus();
  initMobileNavigation();
  initMoreSubNavigation();
  initDistrictSelector();
  initCalculatorsHub();
  initCalculators();
  initMaterialRatesScreen();
  initScrapCalculator();
  initBoq();
  initAiAssistant();
  initDataSourcesSettings();
  initProjectProfile();
  initApkInstallPrompt();
  initBusinessPlatform();

  // Initialize Plan to Budget Module
  const planBudgetController = new PlanBudgetController();
  planBudgetController.init();

  // Load Real Data from Backend
  loadMaterialRates();
  loadProjectProfile();

  // Register Offline Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration:', err));
  }

  // Print timestamp setup
  const timeElem = document.getElementById('print-timestamp');
  if (timeElem) {
    timeElem.textContent = `Generated on: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`;
  }
});

// --- Construction Business Management Platform Controller ---
function initBusinessPlatform() {
  const mountEl = document.getElementById('business-screen-mount');
  if (!mountEl) return;

  const router = new ScreenRouter(mountEl);
  const activeUser = BusinessApi.getActiveUser();
  const roleDisplay = document.getElementById('active-role-display');
  if (roleDisplay && activeUser) {
    const roleEmoji = {
      OWNER: '👑 OWNER',
      ACCOUNTANT: '📊 ACCOUNTANT',
      SITE_MANAGER: '👷 SITE MANAGER',
      ENGINEER: '📐 ENGINEER',
      CLIENT: '🏠 CLIENT'
    };
    roleDisplay.textContent = roleEmoji[activeUser.role] || activeUser.role;
  }

  window.appNavigate = (screenKey) => {
    document.querySelectorAll('.business-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-screen') === screenKey);
    });
    router.navigate(screenKey);
  };

  document.querySelectorAll('.business-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.getAttribute('data-screen');
      window.appNavigate(screen);
    });
  });

  const headerRoleBtn = document.getElementById('btn-header-role');
  if (headerRoleBtn) {
    headerRoleBtn.addEventListener('click', () => {
      window.appNavigate('settings');
    });
  }

  // Initial screen mount
  router.navigate('dashboard');
}

// --- Theme Management (Light & Dark) ---
function initTheme() {
  const savedTheme = localStorage.getItem('ddev_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ddev_theme', next);
      updateThemeButton(next);
    });
  }
}

function updateThemeButton(theme) {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    toggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to Light Theme' : 'டார்க் மோடுக்கு மாறவும்');
  }
}

// --- Connection Status Management (Online / Offline) ---
function initConnectionStatus() {
  const pill = document.getElementById('connection-status');
  const text = document.getElementById('connection-status-text');

  function updateStatus() {
    const isOnline = navigator.onLine;
    if (pill && text) {
      if (isOnline) {
        pill.className = 'status-pill';
        pill.innerHTML = `<span>🟢</span><span>${i18n.t('statusOnline')}</span>`;
      } else {
        pill.className = 'status-pill offline';
        pill.innerHTML = `<span>📴</span><span>${i18n.t('statusOffline')}</span>`;
      }
    }
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// --- Bilingual Localization (தமிழ் & English) ---
function initLocalization() {
  i18n.applyTranslations();

  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const nextLang = i18n.lang === 'ta' ? 'en' : 'ta';
      i18n.lang = nextLang;
      state.currentLang = nextLang;
      initConnectionStatus();
      updateDistrictLabel();
    });
  }
}

function updateDistrictLabel() {
  const label = document.getElementById('rates-current-district-label');
  const badge = document.getElementById('home-district-badge');
  const districtName = state.currentDistrict;
  const prefix = state.currentLang === 'ta' ? 'மாவட்டம்:' : 'District:';
  
  if (label) label.textContent = `${prefix} ${districtName}`;
  if (badge) badge.textContent = `${districtName}`;
}

// --- Mobile Bottom Navigation Bar (5 Primary Destinations) ---
function initMobileNavigation() {
  const navBtns = document.querySelectorAll('.nav-item-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchPrimaryTab(targetTab);
    });
  });

  // Home Dashboard quick action jumps
  document.querySelectorAll('[data-jump-subtab]').forEach(el => {
    el.addEventListener('click', () => {
      const subtabId = el.getAttribute('data-jump-subtab');
      switchPrimaryTab('tab-calc');
      switchCalculatorSubtab(subtabId);
    });
  });

  document.querySelectorAll('[data-jump-tab]').forEach(el => {
    el.addEventListener('click', () => {
      const tabId = el.getAttribute('data-jump-tab');
      if (tabId === 'tab-boq') {
        switchPrimaryTab('tab-more');
        openMoreSubView('view-boq');
      } else {
        switchPrimaryTab(tabId);
      }
    });
  });

  const viewAllRatesBtn = document.getElementById('home-view-all-rates-btn');
  if (viewAllRatesBtn) {
    viewAllRatesBtn.addEventListener('click', () => switchPrimaryTab('tab-rates'));
  }

  const viewAllScrapBtn = document.getElementById('home-view-all-scrap-btn');
  if (viewAllScrapBtn) {
    viewAllScrapBtn.addEventListener('click', () => switchPrimaryTab('tab-scrap'));
  }

  const createProjBtn = document.getElementById('home-create-project-btn');
  if (createProjBtn) {
    createProjBtn.addEventListener('click', () => {
      switchPrimaryTab('tab-more');
      openMoreSubView('view-projects');
    });
  }
}

export function switchPrimaryTab(targetTabId) {
  // Update nav buttons
  document.querySelectorAll('.nav-item-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === targetTabId);
  });

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.remove('active');
  });

  const targetPane = document.getElementById(targetTabId);
  if (targetPane) {
    targetPane.classList.add('active');
    state.activeTab = targetTabId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// --- "More" Screen Sub-Navigation ---
function initMoreSubNavigation() {
  document.querySelectorAll('.more-menu-card').forEach(card => {
    card.addEventListener('click', () => {
      const targetView = card.getAttribute('data-more-target');
      if (targetView === 'jump-tab-plan') {
        switchPrimaryTab('tab-plan-budget');
        return;
      }
      openMoreSubView(targetView);
    });
  });

  document.querySelectorAll('.more-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.more-subview').forEach(v => v.style.display = 'none');
      const menuContainer = document.getElementById('more-menu-container');
      if (menuContainer) menuContainer.style.display = 'block';
    });
  });
}

function openMoreSubView(viewId) {
  const menuContainer = document.getElementById('more-menu-container');
  if (menuContainer) menuContainer.style.display = 'none';

  document.querySelectorAll('.more-subview').forEach(v => v.style.display = 'none');
  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// --- Calculations Hub (Categorized Chips & Search) ---
function initCalculatorsHub() {
  // Category Chips
  const chips = document.querySelectorAll('[data-calc-category]');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.getAttribute('data-calc-category');
      state.activeCalcCategory = cat;
      filterCalculators();
    });
  });

  // Instant Search Filter
  const searchInput = document.getElementById('calc-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterCalculators();
    });
  }

  // Mobile Calculator Dropdown Selector
  const dropdown = document.getElementById('calc-dropdown');
  if (dropdown) {
    dropdown.addEventListener('change', () => {
      switchCalculatorSubtab(dropdown.value);
    });
  }
}

function filterCalculators() {
  const cat = state.activeCalcCategory;
  const query = (document.getElementById('calc-search-input')?.value || '').toLowerCase().trim();
  const dropdown = document.getElementById('calc-dropdown');

  if (dropdown) {
    Array.from(dropdown.options).forEach(opt => {
      const text = opt.text.toLowerCase();
      const val = opt.value;
      const section = document.getElementById(val);
      const group = section ? section.getAttribute('data-calc-group') : 'structural';

      const matchesCat = (cat === 'all' || group === cat);
      const matchesQuery = (!query || text.includes(query) || val.includes(query));

      opt.hidden = !(matchesCat && matchesQuery);
    });

    // Auto-select first visible option if current is hidden
    const selectedOpt = dropdown.options[dropdown.selectedIndex];
    if (selectedOpt && selectedOpt.hidden) {
      const firstVisible = Array.from(dropdown.options).find(o => !o.hidden);
      if (firstVisible) {
        dropdown.value = firstVisible.value;
        switchCalculatorSubtab(firstVisible.value);
      }
    }
  }
}

export function switchCalculatorSubtab(subtabId) {
  document.querySelectorAll('.calc-section').forEach(s => s.style.display = 'none');
  const target = document.getElementById(subtabId);
  if (target) {
    target.style.display = 'block';
    state.activeSubtab = subtabId;
  }

  const dropdown = document.getElementById('calc-dropdown');
  if (dropdown && dropdown.value !== subtabId) {
    dropdown.value = subtabId;
  }
}

// --- District Selector ---
function initDistrictSelector() {
  const select = document.getElementById('district-select');
  if (select) {
    select.addEventListener('change', () => {
      state.currentDistrict = select.value;
      loadMaterialRates();
      updateDistrictLabel();
    });
  }
}

// --- Material Rates Screen & Loader ---
function initMaterialRatesScreen() {
  // Category Chips for Rates
  document.querySelectorAll('[data-rate-cat]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-rate-cat]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterMaterialRates();
    });
  });

  // Rates Search Input
  const search = document.getElementById('rates-search-input');
  if (search) {
    search.addEventListener('input', () => filterMaterialRates());
  }

  // Refresh Button
  const refreshBtn = document.getElementById('rates-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadMaterialRates());
  }
}

async function loadMaterialRates() {
  try {
    const res = await apiClient.request(`/api/rates?district=${encodeURIComponent(state.currentDistrict)}`);
    if (!res.ok) throw new Error('Failed to load rates');
    const data = await res.json();
    state.rates = data.rates || [];
    renderMaterialRates(state.rates);
    updateHomeMaterialsSnapshot(state.rates);
  } catch (err) {
    console.error('Error fetching rates:', err);
  }
}

function filterMaterialRates() {
  const activeChip = document.querySelector('[data-rate-cat].active');
  const cat = activeChip ? activeChip.getAttribute('data-rate-cat') : 'all';
  const query = (document.getElementById('rates-search-input')?.value || '').toLowerCase().trim();

  const filtered = state.rates.filter(item => {
    const matchesCat = (cat === 'all' || item.category === cat);
    const matchesQuery = (!query || item.standardName.toLowerCase().includes(query) || (item.spec && item.spec.toLowerCase().includes(query)));
    return matchesCat && matchesQuery;
  });

  renderMaterialRates(filtered);
}

function renderMaterialRates(rates) {
  const tbody = document.getElementById('rates-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (rates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">பொருட்கள் எதுவும் கிடைக்கவில்லை (No matching materials found)</td></tr>`;
    return;
  }

  rates.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${r.standardName}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${r.spec || ''}</div>
      </td>
      <td>${r.unit}</td>
      <td><strong style="color:var(--accent); font-size:1rem;">${r.formattedMarketPrice}</strong></td>
      <td><strong>${r.formattedSorPrice || '—'}</strong></td>
      <td>
        <span class="badge ${r.freshness && !r.freshness.isStale ? 'badge-green' : 'badge-yellow'}">
          ${r.freshness?.label || 'Verified'}
        </span>
        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${r.sorSource || ''}</div>
      </td>
      <td style="font-size:0.75rem; color:var(--text-secondary);">${r.taxStatus || ''} • ${r.transportStatus || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateHomeMaterialsSnapshot(rates) {
  const container = document.getElementById('home-materials-grid');
  if (!container || !rates.length) return;

  const targetIds = ['MAT-CEM-OPC53', 'MAT-STL-12MM', 'MAT-SND-MSAND', 'MAT-AGG-20MM'];
  const items = targetIds.map(id => rates.find(r => r.id === id)).filter(Boolean);

  if (items.length > 0) {
    container.innerHTML = items.map(item => `
      <div class="metric-card">
        <div class="metric-title">${item.standardName}</div>
        <div class="metric-value">${item.formattedMarketPrice}</div>
        <div class="metric-unit">${item.unit} • ${item.spec?.split('(')[0] || ''}</div>
        <div class="metric-badge">
          <span class="badge ${item.freshness && !item.freshness.isStale ? 'badge-green' : 'badge-blue'}">
            ${item.freshness?.label || 'Verified Live'}
          </span>
        </div>
      </div>
    `).join('');
  }
}

// --- All 19 Calculation Handlers & Form Bindings ---
function initCalculators() {
  // 1. Concrete Calculator
  const concForm = document.getElementById('form-concrete');
  if (concForm) {
    concForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        mixGrade: document.getElementById('conc-grade').value,
        dimensionUnit: document.getElementById('conc-unit').value,
        length: parseFloat(document.getElementById('conc-length').value),
        width: parseFloat(document.getElementById('conc-width').value),
        depth: parseFloat(document.getElementById('conc-depth').value),
        wastagePercent: parseFloat(document.getElementById('conc-wastage').value) || 0
      };

      try {
        const res = await apiClient.request('/api/calculate/concrete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderConcreteOutput(data);
      } catch (err) {
        alert(`Calculation error: ${err.message}`);
      }
    });
  }

  // 2. RCC Calculator
  const rccForm = document.getElementById('form-rcc');
  const rccTypeSelect = document.getElementById('rcc-type');
  if (rccTypeSelect) {
    const updateRccLabels = () => {
      const type = rccTypeSelect.value;
      const dimL = document.getElementById('rcc-dim-l');
      const dimW = document.getElementById('rcc-dim-w');
      const dimD = document.getElementById('rcc-dim-d');
      const steelPct = document.getElementById('rcc-steel-pct');
      const lblL = dimL?.closest('.form-group')?.querySelector('label');
      const lblW = dimW?.closest('.form-group')?.querySelector('label');
      const lblD = dimD?.closest('.form-group')?.querySelector('label');

      if (type === 'SLAB') {
        if (lblL) lblL.innerHTML = 'நீளம் (Length) <span class="label-unit">m</span>';
        if (lblW) lblW.innerHTML = 'அகலம் (Width) <span class="label-unit">m</span>';
        if (lblD) lblD.innerHTML = 'தடிமன் (Thickness) <span class="label-unit">mm</span>';
        if (dimL && !dimL.dataset.userEdited) dimL.value = '5.0';
        if (dimW && !dimW.dataset.userEdited) dimW.value = '4.0';
        if (dimD && !dimD.dataset.userEdited) dimD.value = '125';
        if (steelPct && !steelPct.dataset.userEdited) steelPct.value = '0.8';
      } else if (type === 'BEAM') {
        if (lblL) lblL.innerHTML = 'நீளம் (Span) <span class="label-unit">m</span>';
        if (lblW) lblW.innerHTML = 'அகலம் (Width) <span class="label-unit">mm</span>';
        if (lblD) lblD.innerHTML = 'ஆழம் (Depth) <span class="label-unit">mm</span>';
        if (dimL && !dimL.dataset.userEdited) dimL.value = '4.0';
        if (dimW && !dimW.dataset.userEdited) dimW.value = '230';
        if (dimD && !dimD.dataset.userEdited) dimD.value = '450';
        if (steelPct && !steelPct.dataset.userEdited) steelPct.value = '1.5';
      } else if (type === 'COLUMN') {
        if (lblL) lblL.innerHTML = 'உயரம் (Height) <span class="label-unit">m</span>';
        if (lblW) lblW.innerHTML = 'அகலம் (Width) <span class="label-unit">mm</span>';
        if (lblD) lblD.innerHTML = 'ஆழம் (Depth) <span class="label-unit">mm</span>';
        if (dimL && !dimL.dataset.userEdited) dimL.value = '3.0';
        if (dimW && !dimW.dataset.userEdited) dimW.value = '230';
        if (dimD && !dimD.dataset.userEdited) dimD.value = '450';
        if (steelPct && !steelPct.dataset.userEdited) steelPct.value = '2.0';
      } else if (type === 'FOOTING') {
        if (lblL) lblL.innerHTML = 'நீளம் (Length) <span class="label-unit">m</span>';
        if (lblW) lblW.innerHTML = 'அகலம் (Width) <span class="label-unit">m</span>';
        if (lblD) lblD.innerHTML = 'ஆழம் (Depth) <span class="label-unit">mm</span>';
        if (dimL && !dimL.dataset.userEdited) dimL.value = '1.5';
        if (dimW && !dimW.dataset.userEdited) dimW.value = '1.5';
        if (dimD && !dimD.dataset.userEdited) dimD.value = '450';
        if (steelPct && !steelPct.dataset.userEdited) steelPct.value = '0.8';
      }
    };
    rccTypeSelect.addEventListener('change', updateRccLabels);
    ['rcc-dim-l', 'rcc-dim-w', 'rcc-dim-d', 'rcc-steel-pct'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => { el.dataset.userEdited = 'true'; });
    });
  }

  if (rccForm) {
    rccForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const elemType = document.getElementById('rcc-type').value;
      const countVal = parseInt(document.getElementById('rcc-count').value, 10) || 1;
      const steelVal = parseFloat(document.getElementById('rcc-steel-pct').value) || 0.8;
      const gradeVal = document.getElementById('rcc-grade').value;

      const rawL = parseFloat(document.getElementById('rcc-dim-l').value);
      const rawW = parseFloat(document.getElementById('rcc-dim-w').value);
      const rawD = parseFloat(document.getElementById('rcc-dim-d').value);

      const payload = {
        elementType: elemType,
        mixGrade: gradeVal,
        steelPercentage: steelVal,
        count: countVal
      };

      if (elemType === 'SLAB') {
        payload.length = rawL;
        payload.width = rawW;
        payload.thickness = rawD;
        payload.thicknessUnit = 'mm';
      } else if (elemType === 'BEAM') {
        payload.span = rawL;
        // If entered as meters (< 5), convert to mm, else already mm
        payload.width = rawW < 5 ? rawW * 1000 : rawW;
        payload.depth = rawD < 5 ? rawD * 1000 : rawD;
        payload.dimensionUnit = 'mm';
      } else if (elemType === 'COLUMN') {
        payload.height = rawL;
        payload.width = rawW < 5 ? rawW * 1000 : rawW;
        payload.depth = rawD < 5 ? rawD * 1000 : rawD;
        payload.dimensionUnit = 'mm';
      } else if (elemType === 'FOOTING') {
        payload.length = rawL;
        payload.width = rawW;
        payload.depth = rawD > 10 ? rawD / 1000 : rawD; // in meters
      }

      try {
        const res = await apiClient.request('/api/calculate/rcc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderRccOutput(data);
      } catch (err) {
        alert(`RCC calculation error: ${err.message}`);
      }
    });
  }

  // 3. Masonry Calculator
  const masForm = document.getElementById('form-masonry');
  if (masForm) {
    masForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        brickType: document.getElementById('mas-type').value,
        wallThicknessMm: parseInt(document.getElementById('mas-thick').value, 10),
        length: parseFloat(document.getElementById('mas-length').value),
        height: parseFloat(document.getElementById('mas-height').value),
        mortarRatio: document.getElementById('mas-mortar').value,
        openingsDeductionAreaM2: parseFloat(document.getElementById('mas-deduct').value) || 0,
        wastagePercent: parseFloat(document.getElementById('mas-wastage').value) || 0
      };

      try {
        const res = await apiClient.request('/api/calculate/masonry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderMasonryOutput(data);
      } catch (err) {
        alert(`Masonry calculation error: ${err.message}`);
      }
    });
  }

  // 4. Finishing Works
  const finForm = document.getElementById('form-finishing');
  if (finForm) {
    finForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        type: document.getElementById('fin-type').value,
        areaM2: parseFloat(document.getElementById('fin-area').value),
        thicknessMm: parseInt(document.getElementById('fin-thick').value, 10) || 12,
        wastagePercent: parseFloat(document.getElementById('fin-wastage').value) || 0
      };

      try {
        const res = await apiClient.request('/api/calculate/finishing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderFinishingOutput(data);
      } catch (err) {
        alert(`Finishing calculation error: ${err.message}`);
      }
    });
  }

  // 5. Earthwork Calculator
  const ewForm = document.getElementById('form-earthwork');
  if (ewForm) {
    ewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        length: parseFloat(document.getElementById('ew-length').value),
        width: parseFloat(document.getElementById('ew-width').value),
        depth: parseFloat(document.getElementById('ew-depth').value),
        soilType: document.getElementById('ew-soil').value,
        swellingFactor: parseFloat(document.getElementById('ew-swell').value) || 1.25
      };

      try {
        const res = await apiClient.request('/api/calculate/earthwork', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderEarthworkOutput(data);
      } catch (err) {
        alert(`Earthwork error: ${err.message}`);
      }
    });
  }

  // 6. Stirrup / BBS Calculator
  const bbsForm = document.getElementById('form-stirrup');
  if (bbsForm) {
    bbsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        type: 'STIRRUP',
        beamWidthMm: parseFloat(document.getElementById('bbs-beam-w').value),
        beamDepthMm: parseFloat(document.getElementById('bbs-beam-d').value),
        coverMm: parseFloat(document.getElementById('bbs-cover').value),
        stirrupBarDiaMm: parseInt(document.getElementById('bbs-dia').value, 10),
        hookAngleDeg: parseInt(document.getElementById('bbs-hook').value, 10)
      };

      try {
        const res = await apiClient.request('/api/calculate/bbs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderStirrupOutput(data);
      } catch (err) {
        alert(`BBS error: ${err.message}`);
      }
    });
  }

  // 7. Water Tank Calculator
  const wtForm = document.getElementById('form-watertank');
  if (wtForm) {
    wtForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        tankType: document.getElementById('wt-type').value,
        personsCount: parseInt(document.getElementById('wt-persons').value, 10),
        lengthM: parseFloat(document.getElementById('wt-length').value),
        widthM: parseFloat(document.getElementById('wt-width').value),
        waterDepthM: parseFloat(document.getElementById('wt-depth').value)
      };

      try {
        const res = await apiClient.request('/api/calculate/watertank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderWaterTankOutput(data);
      } catch (err) {
        alert(`Water tank error: ${err.message}`);
      }
    });
  }

  // 8. Septic Tank (IS 2470)
  const septicForm = document.getElementById('form-septictank');
  if (septicForm) {
    septicForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        usersCount: parseInt(document.getElementById('septic-users').value, 10),
        cleaningIntervalYears: parseInt(document.getElementById('septic-interval').value, 10),
        wasteStream: document.getElementById('septic-stream').value,
        soilPercolationType: document.getElementById('septic-soil').value
      };

      try {
        const res = await apiClient.request('/api/calculate/septictank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderSepticOutput(data);
      } catch (err) {
        alert(`Septic tank error: ${err.message}`);
      }
    });
  }

  // 9. Geotech SBC Footing
  const geoForm = document.getElementById('form-geotech');
  if (geoForm) {
    geoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        columnLoadKn: parseFloat(document.getElementById('geo-load').value),
        safeBearingCapacityKnM2: parseFloat(document.getElementById('geo-sbc').value),
        soilType: document.getElementById('geo-soil').value,
        columnSizeMm: parseFloat(document.getElementById('geo-col-size').value) || 300
      };

      try {
        const res = await apiClient.request('/api/calculate/sbc-footing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderGeotechOutput(data);
      } catch (err) {
        alert(`Geotech error: ${err.message}`);
      }
    });
  }

  // 10. QC Cube Strength Test
  const qcForm = document.getElementById('form-qc');
  if (qcForm) {
    qcForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        mixGrade: document.getElementById('qc-grade').value,
        testingAgeDays: parseInt(document.getElementById('qc-age').value, 10),
        cubeFailureLoadsKn: [
          parseFloat(document.getElementById('qc-cube1').value),
          parseFloat(document.getElementById('qc-cube2').value),
          parseFloat(document.getElementById('qc-cube3').value)
        ]
      };

      try {
        const res = await apiClient.request('/api/qc/cube-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderQcOutput(data);
      } catch (err) {
        alert(`QC test error: ${err.message}`);
      }
    });
  }

  // 11. Anti-Termite Treatment
  const termForm = document.getElementById('form-antitermite');
  if (termForm) {
    termForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        plinthAreaSqft: parseFloat(document.getElementById('term-plinth').value),
        perimeterLengthM: parseFloat(document.getElementById('term-perim').value),
        chemicalType: document.getElementById('term-chemical').value
      };

      try {
        const res = await apiClient.request('/api/calculate/antitermite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderAntiTermiteOutput(data);
      } catch (err) {
        alert(`Anti-termite error: ${err.message}`);
      }
    });
  }

  // 12. TNCDBR 2019 Rules
  const tnForm = document.getElementById('form-tncdbr');
  if (tnForm) {
    tnForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        plotAreaSqft: parseFloat(document.getElementById('tn-plot-sqft').value),
        roadWidthM: parseFloat(document.getElementById('tn-road-w').value),
        buildingHeightM: parseFloat(document.getElementById('tn-height').value),
        category: document.getElementById('tn-category').value
      };

      try {
        const res = await apiClient.request('/api/planning/tncdbr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderTncdbrOutput(data);
      } catch (err) {
        alert(`TNCDBR validator error: ${err.message}`);
      }
    });
  }

  // 13. M-Book Sizing
  const mbForm = document.getElementById('form-mbook');
  if (mbForm) {
    mbForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        items: [{
          description: document.getElementById('mb-desc').value,
          count: parseInt(document.getElementById('mb-no').value, 10),
          length: parseFloat(document.getElementById('mb-l').value),
          breadth: parseFloat(document.getElementById('mb-b').value),
          depth: parseFloat(document.getElementById('mb-d').value),
          unitRate: parseFloat(document.getElementById('mb-rate').value)
        }]
      };

      try {
        const res = await apiClient.request('/api/mbook/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderMBookOutput(data, payload.items[0].description);
      } catch (err) {
        alert(`M-Book error: ${err.message}`);
      }
    });
  }

  // 14. Labour Norms
  const labForm = document.getElementById('form-labour');
  if (labForm) {
    labForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        activity: document.getElementById('lab-activity').value,
        quantity: parseFloat(document.getElementById('lab-qty').value)
      };

      try {
        const res = await apiClient.request('/api/calculate/labour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderLabourOutput(data);
      } catch (err) {
        alert(`Labour calculation error: ${err.message}`);
      }
    });
  }

  // 15. Rainwater Harvesting (RWH)
  const rwhForm = document.getElementById('form-rwh');
  if (rwhForm) {
    rwhForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        roofAreaSqft: parseFloat(document.getElementById('rwh-roof').value),
        openPlotAreaSqft: parseFloat(document.getElementById('rwh-plot').value) || 0,
        structureType: document.getElementById('rwh-type').value
      };

      try {
        const res = await apiClient.request('/api/calculate/rwh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderRwhOutput(data);
      } catch (err) {
        alert(`RWH calculation error: ${err.message}`);
      }
    });
  }

  // 16. Coastal Durability
  const durForm = document.getElementById('form-durability');
  if (durForm) {
    durForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        coastalDistance: document.getElementById('dur-distance').value,
        structuralElement: document.getElementById('dur-element').value
      };

      try {
        const res = await apiClient.request('/api/durability/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderDurabilityOutput(data);
      } catch (err) {
        alert(`Durability check error: ${err.message}`);
      }
    });
  }

  // 17. CMDA Fees
  const cmdaForm = document.getElementById('form-cmdafee');
  if (cmdaForm) {
    cmdaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        builtupAreaSqft: parseFloat(document.getElementById('cmda-builtup').value),
        authority: document.getElementById('cmda-auth').value
      };

      try {
        const res = await apiClient.request('/api/planning/cmda-fee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderCmdaFeeOutput(data);
      } catch (err) {
        alert(`CMDA fee calculation error: ${err.message}`);
      }
    });
  }

  // 18. Flood Plinth Height
  const plinthForm = document.getElementById('form-plinth');
  if (plinthForm) {
    plinthForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        roadLevelMm: parseFloat(document.getElementById('plinth-road').value),
        floodRiskZone: document.getElementById('plinth-zone').value
      };

      try {
        const res = await apiClient.request('/api/calculate/plinth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderPlinthOutput(data);
      } catch (err) {
        alert(`Plinth calculation error: ${err.message}`);
      }
    });
  }

  // 19. Under-Reamed Piles
  const pileForm = document.getElementById('form-pile');
  if (pileForm) {
    pileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        columnLoadKn: parseFloat(document.getElementById('pile-load').value),
        shaftDiameterMm: parseFloat(document.getElementById('pile-dia').value),
        numberOfBulbs: parseInt(document.getElementById('pile-bulbs').value, 10),
        pileLengthM: parseFloat(document.getElementById('pile-depth').value)
      };

      try {
        const res = await apiClient.request('/api/calculate/pile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderPileOutput(data);
      } catch (err) {
        alert(`Pile calculation error: ${err.message}`);
      }
    });
  }
}

// --- Render Helper Functions for Calculations ---
function renderConcreteOutput(data) {
  const box = document.getElementById('output-concrete');
  if (!box) return;
  box.style.display = 'block';

  document.getElementById('conc-out-wetvol').textContent = `${data.wetVolumeM3} m³ (${data.wetVolumeCft} cft)`;

  const tbody = document.getElementById('conc-out-table');
  tbody.innerHTML = `
    <tr><td><strong>சிமெண்ட் (Cement)</strong></td><td>${data.materials.cement.weightKg} kg</td><td><strong>${data.materials.cement.bagsRounded} Bags</strong> (50kg)</td></tr>
    <tr><td><strong>மணல் (M-Sand)</strong></td><td>${data.materials.sand.volumeM3} m³ (${data.materials.sand.volumeCft} cft)</td><td><strong>${data.materials.sand.tnUnits} Units</strong></td></tr>
    <tr><td><strong>ஜல்லி (20mm Aggregate)</strong></td><td>${data.materials.aggregate.volumeM3} m³ (${data.materials.aggregate.volumeCft} cft)</td><td><strong>${data.materials.aggregate.tnUnits} Units</strong></td></tr>
    <tr><td><strong>தண்ணீர் (Water)</strong></td><td>${data.materials.water.quantityLitres} Litres</td><td>—</td></tr>
  `;

  const ol = document.getElementById('conc-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
  document.getElementById('conc-out-disclaimer').textContent = data.disclaimer;
}

function renderRccOutput(data) {
  const box = document.getElementById('output-rcc');
  if (!box) return;
  box.style.display = 'block';
  document.getElementById('rcc-out-title').textContent = `${data.element} Quantity Take-off`;

  const tbody = document.getElementById('rcc-out-tbody');
  tbody.innerHTML = `
    <tr><td>கான்கிரீட் பருமன் (Volume):</td><td><strong>${data.concreteVolumeM3 || data.rccVolumeM3} m³</strong></td></tr>
    <tr><td>சென்டரிங் பரப்பு (Shuttering Area):</td><td><strong>${data.shutteringAreaM2} m² (${data.shutteringAreaSqft || (data.shutteringAreaM2 * 10.76).toFixed(1)} sq.ft)</strong></td></tr>
    <tr><td>கம்பி எடை (Reinforcement Steel):</td><td><strong>${data.steel.weightKg} kg (${data.steel.weightTonnes} Tonnes)</strong></td></tr>
    <tr><td>சிமெண்ட் மூட்டைகள்:</td><td>${data.concreteMaterials?.cement?.bagsRounded || data.rccMaterials?.cement?.bagsRounded || '—'} Bags</td></tr>
  `;

  const ol = document.getElementById('rcc-out-steps');
  ol.innerHTML = (data.steps || []).map(s => `<li>${s}</li>`).join('');
}

function renderMasonryOutput(data) {
  const box = document.getElementById('output-masonry');
  if (!box) return;
  box.style.display = 'block';
  document.getElementById('mas-out-bricks').textContent = `${data.materials.bricks.countRounded} Nos`;

  const tbody = document.getElementById('mas-out-tbody');
  tbody.innerHTML = `
    <tr><td>செங்கல் தேவை (Bricks):</td><td><strong>${data.materials.bricks.countRounded} Nos</strong> (விரயம் உட்பட)</td></tr>
    <tr><td>சிமெண்ட் காரை (Mortar Cement):</td><td><strong>${data.materials.mortar.cementBags} Bags</strong> (50kg)</td></tr>
    <tr><td>மணல் தேவை (Sand):</td><td><strong>${data.materials.mortar.sandM3} m³ (${data.materials.mortar.sandTnUnits} Units)</strong></td></tr>
    <tr><td>நிகர சுவர் பருமன்:</td><td>${data.netWallVolumeM3} m³</td></tr>
  `;

  const ol = document.getElementById('mas-out-steps');
  ol.innerHTML = (data.steps || []).map(s => `<li>${s}</li>`).join('');
}

function renderFinishingOutput(data) {
  const box = document.getElementById('output-finishing');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('fin-out-tbody');
  const m = data.materials || {};
  let rows = '';

  const typeCode = (data.workTypeCode || data.workType || '').toUpperCase();

  if (typeCode.includes('PLASTER')) {
    const cementBags = m.cementBags ?? data.cementBags ?? '—';
    const sandM3 = m.sandM3 ?? data.sandM3 ?? '—';
    const sandUnits = m.sandTnUnits ?? data.sandTnUnits ?? '—';
    rows = `
      <tr><td>சிமெண்ட் (Cement):</td><td><strong>${cementBags} Bags</strong></td></tr>
      <tr><td>மணல் (Sand):</td><td><strong>${sandM3} m³ (${sandUnits} Units)</strong></td></tr>
      <tr><td>பூச்சு தடிமன்:</td><td>${data.thicknessMm || 12} mm</td></tr>
    `;
  } else if (typeCode.includes('PAINT')) {
    const puttyKg = m.puttyKg ?? data.puttyKg ?? '—';
    const primerL = m.primerLitres ?? data.primerLitres ?? '—';
    const paintL = m.emulsionPaintLitres ?? data.emulsionPaintLitres ?? '—';
    rows = `
      <tr><td>வால் புட்டி (Putty 2 Coats):</td><td><strong>${puttyKg} kg</strong></td></tr>
      <tr><td>பிரைமர் (Primer 1 Coat):</td><td><strong>${primerL} Litres</strong></td></tr>
      <tr><td>எமல்ஷன் பெயிண்ட் (2 Coats):</td><td><strong>${paintL} Litres</strong></td></tr>
    `;
  } else if (typeCode.includes('TILE') || typeCode.includes('FLOOR')) {
    const tiles = m.tilesCount ?? data.tilesCount ?? '—';
    const area = m.netTileAreaM2 ?? data.netTileAreaM2 ?? '—';
    const bedBags = m.beddingCementBags ?? data.beddingCementBags ?? '—';
    const bedSand = m.beddingSandTnUnits ?? data.beddingSandTnUnits ?? '—';
    rows = `
      <tr><td>டைல்ஸ் (Tiles 600x600mm):</td><td><strong>${tiles} Boxes (${area} m²)</strong></td></tr>
      <tr><td>பெட்டிங் சிமெண்ட்:</td><td><strong>${bedBags} Bags</strong></td></tr>
      <tr><td>பெட்டிங் மணல்:</td><td><strong>${bedSand} Units</strong></td></tr>
    `;
  }

  tbody.innerHTML = rows;
  const ol = document.getElementById('fin-out-steps');
  if (ol) ol.innerHTML = (data.steps || data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderEarthworkOutput(data) {
  const box = document.getElementById('output-earthwork');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('ew-out-tbody');
  tbody.innerHTML = `
    <tr><td>தோண்டிய மண் அளவு (Excavation):</td><td><strong>${data.excavationVolumeM3} m³ (${data.excavationVolumeCft} cft)</strong></td></tr>
    <tr><td>வீக்கமடைந்த மண் (Loose Volume):</td><td><strong>${data.looseVolumeM3} m³</strong></td></tr>
    <tr><td>மண் அப்புறப்படுத்த லாரிகள்:</td><td><strong>${data.lorryLoads10Ton} லாரிகள் (10-Ton Loads)</strong></td></tr>
    <tr><td>மண் வகை:</td><td>${data.soilType}</td></tr>
  `;
}

function renderStirrupOutput(data) {
  const box = document.getElementById('output-stirrup');
  if (!box) return;
  box.style.display = 'block';
  document.getElementById('bbs-out-length').textContent = `${data.cuttingLengthMm} mm (${(data.cuttingLengthMm / 1000).toFixed(2)} m)`;

  const tbody = document.getElementById('bbs-out-tbody');
  tbody.innerHTML = `
    <tr><td>ஒரு வளையத்தின் கட்டிங் நீளம்:</td><td><strong>${data.cuttingLengthMm} mm</strong></td></tr>
    <tr><td>ஒரு வளையத்தின் எடை:</td><td><strong>${data.weightPerStirrupKg} kg</strong></td></tr>
    <tr><td>ஹூக் நீட்டிப்பு:</td><td>${data.hookExtensionMm} mm (2 Nos)</td></tr>
    <tr><td>வளைவு கழிவு:</td><td>${data.bendDeductionsMm} mm (IS 2502)</td></tr>
  `;
}

function renderWaterTankOutput(data) {
  const box = document.getElementById('output-watertank');
  if (!box) return;
  box.style.display = 'block';
  document.getElementById('wt-out-litres').textContent = `${data.actualCapacityLitres?.toLocaleString() || data.capacityLitres?.toLocaleString()} Litres`;

  const tbody = document.getElementById('wt-out-tbody');
  tbody.innerHTML = `
    <tr><td>மொத்த கொள்ளளவு (Capacity):</td><td><strong>${data.actualCapacityLitres || data.capacityLitres} Litres</strong></td></tr>
    <tr><td>பரிந்துரைக்கப்படும் குடும்ப தேவை:</td><td>${data.estimatedDemandLitres} Litres (${data.demandDays} Days)</td></tr>
    <tr><td>உட்புற அளவு:</td><td>${data.internalLengthM}m × ${data.internalWidthM}m × ${data.waterDepthM}m</td></tr>
    <tr><td>கான்கிரீட் தரம்:</td><td>${data.recommendedMixGrade} (Waterproofing)</td></tr>
  `;
}

function renderSepticOutput(data) {
  const box = document.getElementById('output-septictank');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('septic-out-tbody');
  tbody.innerHTML = `
    <tr><td>தொட்டி உட்புற நீளம் (Length):</td><td><strong>${data.recommendedLengthM} m</strong></td></tr>
    <tr><td>தொட்டி உட்புற அகலம் (Width):</td><td><strong>${data.recommendedWidthM} m</strong></td></tr>
    <tr><td>நீர் மட்ட ஆழம் (Liquid Depth):</td><td><strong>${data.recommendedLiquidDepthM} m (+ 0.3m Freeboard)</strong></td></tr>
    <tr><td>சுத்திகரிப்பு கொள்ளளவு:</td><td><strong>${data.totalVolumeM3} m³ (${data.totalCapacityLitres} Litres)</strong></td></tr>
    <tr><td>சோக் பிட் விட்டம் & ஆழம்:</td><td>${data.soakPit?.recommendedDiameterM || 1.2}m விட்டம் × ${data.soakPit?.recommendedDepthM || 2.0}m ஆழம்</td></tr>
  `;

  const ol = document.getElementById('septic-out-steps');
  ol.innerHTML = (data.steps || []).map(s => `<li>${s}</li>`).join('');
}

function renderGeotechOutput(data) {
  const box = document.getElementById('output-geotech');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('geo-out-tbody');
  tbody.innerHTML = `
    <tr><td>தேவையான புட்டிங் பரப்பு:</td><td><strong>${data.requiredAreaM2} m²</strong></td></tr>
    <tr><td>புட்டிங் அளவு (L × B):</td><td><strong>${data.footingLengthM}m × ${data.footingWidthM}m</strong></td></tr>
    <tr><td>புட்டிங் தடிமன் (Thickness):</td><td><strong>${data.footingThicknessMm} mm</strong></td></tr>
    <tr><td>மண் வகை & தாங்கு திறன்:</td><td>${data.soilType} (${data.safeBearingCapacityKnM2} kN/m²)</td></tr>
  `;

  const ol = document.getElementById('geo-out-steps');
  ol.innerHTML = (data.steps || []).map(s => `<li>${s}</li>`).join('');
}

function renderQcOutput(data) {
  const box = document.getElementById('output-qc');
  if (!box) return;
  box.style.display = 'block';

  const isPassed = data.isCompliant || data.passed;
  document.getElementById('qc-out-avg').textContent = `${data.averageStrengthNmm2} N/mm²`;
  document.getElementById('qc-out-status').textContent = isPassed ? 'வெற்றிகரமாக தேர்ச்சி (Batch Accepted)' : 'பரிசோதனை தோல்வி (Strength Below Target)';

  const badge = document.getElementById('qc-badge-status');
  badge.className = `badge ${isPassed ? 'badge-green' : 'badge-red'}`;
  badge.textContent = isPassed ? 'PASSED' : 'FAILED';

  const heroBox = document.getElementById('qc-hero-box');
  heroBox.style.background = isPassed ? 'var(--bg-accent-soft)' : 'var(--danger-soft)';

  const strengths = data.cubeStrengthsNmm2 || data.specimens?.map(s => s.compressiveStrengthNmm2) || [];
  const tbody = document.getElementById('qc-out-tbody');
  tbody.innerHTML = `
    <tr><td>இலக்கு பலம் (Target Strength):</td><td><strong>${data.targetStrengthNmm2} N/mm²</strong></td></tr>
    <tr><td>கிடைத்த சராசரி பலம்:</td><td><strong>${data.averageStrengthNmm2} N/mm²</strong></td></tr>
    <tr><td>கியூப் 1 அழுத்தம்:</td><td>${strengths[0] ?? '—'} N/mm²</td></tr>
    <tr><td>கியூப் 2 அழுத்தம்:</td><td>${strengths[1] ?? '—'} N/mm²</td></tr>
    <tr><td>கியூப் 3 அழுத்தம்:</td><td>${strengths[2] ?? '—'} N/mm²</td></tr>
  `;
}

function renderAntiTermiteOutput(data) {
  const box = document.getElementById('output-antitermite');
  if (!box) return;
  box.style.display = 'block';

  const conc = data.chemicalConcentrateLitres || data.concentratedChemicalLitres || '—';
  const tbody = document.getElementById('term-out-tbody');
  tbody.innerHTML = `
    <tr><td>தேவையான மருந்து (Chemical):</td><td><strong>${conc} Litres</strong></td></tr>
    <tr><td>மருந்து கலவை நீர் (Emulsion):</td><td><strong>${data.totalEmulsionLitres} Litres</strong></td></tr>
    <tr><td>மருந்து வகை:</td><td>${data.chemicalType || data.chemicalName || '—'}</td></tr>
    <tr><td>அஸ்திவாரம் மற்றும் தரை பரப்பு:</td><td>${data.plinthAreaSqft || (data.areas?.plinthAreaM2 ? (data.areas.plinthAreaM2 * 10.7639).toFixed(1) : '—')} sq.ft</td></tr>
  `;
}

function renderTncdbrOutput(data) {
  const box = document.getElementById('output-tncdbr');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('tn-out-tbody');
  tbody.innerHTML = `
    <tr><td>முன் செட்பேக் (Front Setback):</td><td><strong>${data.setbacks?.frontM || 1.5} m</strong></td></tr>
    <tr><td>பின் செட்பேக் (Rear Setback):</td><td><strong>${data.setbacks?.rearM || 1.0} m</strong></td></tr>
    <tr><td>பக்கவாட்டு செட்பேக் 1 & 2:</td><td><strong>${data.setbacks?.side1M || 1.0} m / ${data.setbacks?.side2M || 1.0} m</strong></td></tr>
    <tr><td>அனுமதிக்கப்படும் அதிகபட்ச FSI:</td><td><strong>${data.permissibleFsi || 1.5}</strong></td></tr>
    <tr><td>அனுமதிக்கப்படும் மொத்த கட்டிட பரப்பு:</td><td><strong>${data.maxBuiltupAreaSqft || (data.plotAreaSqft * 1.5).toFixed(0)} sq.ft</strong></td></tr>
  `;
}

function renderMBookOutput(data, desc) {
  const box = document.getElementById('output-mbook');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('mb-out-tbody');
  tbody.innerHTML = `
    <tr><td>பணி விளக்கம் (Item):</td><td><strong>${desc}</strong></td></tr>
    <tr><td>மொத்த அளவு (Quantity):</td><td><strong>${data.totalQuantity} m³</strong></td></tr>
    <tr><td>தொகை (Total Amount):</td><td><strong style="color:var(--accent); font-size:1.1rem;">₹ ${data.totalAmount?.toLocaleString('en-IN') || '0'}</strong></td></tr>
  `;
}

function renderLabourOutput(data) {
  const box = document.getElementById('output-labour');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('lab-out-tbody');
  tbody.innerHTML = `
    <tr><td>கொத்தனார் தேவை (Mason Man-days):</td><td><strong>${data.masonDays} Days</strong></td></tr>
    <tr><td>ஆண் ஆட்கள் (Male Mazdoor):</td><td><strong>${data.mazdoorDays} Days</strong></td></tr>
    <tr><td>பெண் ஆட்கள் (Female Helper):</td><td><strong>${data.helperDays} Days</strong></td></tr>
    <tr><td>தோராயமான மொத்த கூலி:</td><td><strong style="color:var(--accent); font-size:1.1rem;">₹ ${data.totalLabourCost?.toLocaleString('en-IN')}</strong></td></tr>
  `;
}

function renderRwhOutput(data) {
  const box = document.getElementById('output-rwh');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('rwh-out-tbody');
  tbody.innerHTML = `
    <tr><td>ஆண்டு மழைநீர் சேகரிப்பு திறன்:</td><td><strong>${data.annualRainfallYieldLitres?.toLocaleString()} Litres</strong></td></tr>
    <tr><td>பரிந்துரைக்கப்படும் ரீசார்ஜ் கிணறு:</td><td><strong>${data.recommendedWellDiameterM || 1.0}m விட்டம் × ${data.recommendedWellDepthM || 3.0}m ஆழம்</strong></td></tr>
    <tr><td>கூரை பரப்பளவு:</td><td>${data.roofAreaSqft} sq.ft</td></tr>
    <tr><td>CMDA/GCC விதிமுறை:</td><td>கட்டாய மழைநீர் சேகரிப்பு அமைப்பு அங்கீகரிக்கப்பட்டது</td></tr>
  `;
}

function renderDurabilityOutput(data) {
  const box = document.getElementById('output-durability');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('dur-out-tbody');
  tbody.innerHTML = `
    <tr><td>சுற்றுச்சூழல் உவர் வகை:</td><td><strong>${data.exposureCondition}</strong></td></tr>
    <tr><td>குறைந்தபட்ச கான்கிரீட் தரம்:</td><td><strong>${data.minConcreteGrade} (IS 456 Table 5)</strong></td></tr>
    <tr><td>குறைந்தபட்ச கம்பி கவர் (Nominal Cover):</td><td><strong>${data.minNominalCoverMm} mm</strong></td></tr>
    <tr><td>அதிகபட்ச நீர்-சிமெண்ட் விகிதம்:</td><td>${data.maxWaterCementRatio}</td></tr>
  `;
}

function renderCmdaFeeOutput(data) {
  const box = document.getElementById('output-cmdafee');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('cmda-out-tbody');
  tbody.innerHTML = `
    <tr><td>ஆய்வுக் கட்டணம் (Scrutiny Fee):</td><td>₹ ${data.scrutinyFee?.toLocaleString('en-IN')}</td></tr>
    <tr><td>உள்கட்டமைப்பு & மேம்பாட்டு கட்டணம்:</td><td>₹ ${data.developmentCharge?.toLocaleString('en-IN')}</td></tr>
    <tr><td>கட்டிட அனுமதி கட்டணம் (Building Permit):</td><td>₹ ${data.permitFee?.toLocaleString('en-IN')}</td></tr>
    <tr style="background:var(--bg-accent-soft); font-weight:800; font-size:1.05rem;">
      <td>தோராயமான மொத்த கட்டணம்:</td>
      <td><strong style="color:var(--accent);">₹ ${data.totalEstimatedFee?.toLocaleString('en-IN')}</strong></td>
    </tr>
  `;
}

function renderPlinthOutput(data) {
  const box = document.getElementById('output-plinth');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('plinth-out-tbody');
  tbody.innerHTML = `
    <tr><td>பரிந்துரைக்கப்படும் காரைமட்டம்:</td><td><strong>${data.recommendedPlinthHeightMm} mm (${(data.recommendedPlinthHeightMm / 304.8).toFixed(1)} அடி)</strong></td></tr>
    <tr><td>சாலை மட்டத்திலிருந்து உயர்வு:</td><td>${data.heightAboveRoadMm} mm</td></tr>
    <tr><td>DPC தடிமன் & கலவை:</td><td>${data.dpcThicknessMm || 50}mm CM 1:2 + Dr.Fixit வாட்டர்ப்ரூப்</td></tr>
    <tr><td>வெள்ள மண்டல குறிப்பு:</td><td>${data.riskLevelText || 'வெள்ள நீர் புகா வண்ணம் அமைக்கவும்'}</td></tr>
  `;
}

function renderPileOutput(data) {
  const box = document.getElementById('output-pile');
  if (!box) return;
  box.style.display = 'block';

  const tbody = document.getElementById('pile-out-tbody');
  tbody.innerHTML = `
    <tr><td>ஒரு பைல் பாதுகாப்பான தாங்கு திறன்:</td><td><strong>${data.safeLoadCapacityKn} kN</strong></td></tr>
    <tr><td>தேவையான பைல்கள் எண்ணிக்கை:</td><td><strong>${data.pilesCountRequired || 1} Nos</strong></td></tr>
    <tr><td>பல்பு விட்டம் (Bulb Diameter):</td><td>${data.bulbDiameterMm} mm (2.5 × Shaft Dia)</td></tr>
    <tr><td>IS குறியீடு:</td><td>IS 2911 Part 3 கறுப்பு பருத்தி மண் அடித்தளம்</td></tr>
  `;
}

// --- Scrap Valuation & Settlement Engine ---
function initScrapCalculator() {
  const form = document.getElementById('form-scrap');
  if (!form) return;

  const select = document.getElementById('scrap-select');
  if (select) {
    select.addEventListener('change', () => {
      const ratesMap = {
        'SCRAP-IRON-HMS': 41,
        'SCRAP-COP-DC': 950,
        'SCRAP-COP-OC': 850,
        'SCRAP-BRASS-HONEY': 700,
        'SCRAP-ALUM-SECTION': 350,
        'SCRAP-ALUM-UTENSIL': 153.4,
        'SCRAP-SS-304': 140,
        'SCRAP-CABLE-ELEC': 170,
        'SCRAP-BAT-CAR': 66.66
      };
      const rateInput = document.getElementById('scrap-rate');
      if (rateInput && ratesMap[select.value]) {
        rateInput.value = ratesMap[select.value];
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      scrapId: document.getElementById('scrap-select').value,
      grossWeight: parseFloat(document.getElementById('scrap-gross').value),
      tareWeight: parseFloat(document.getElementById('scrap-tare').value) || 0,
      weightUnit: 'kg',
      unitRate: parseFloat(document.getElementById('scrap-rate').value),
      moisturePercent: parseFloat(document.getElementById('scrap-moist').value) || 0,
      impurityPercent: parseFloat(document.getElementById('scrap-impur').value) || 0,
      insulationDeductionPercent: parseFloat(document.getElementById('scrap-insul').value) || 0,
      transportCost: parseFloat(document.getElementById('scrap-trans').value) || 0,
      labourHandlingCost: parseFloat(document.getElementById('scrap-labour').value) || 0
    };

    try {
      const res = await apiClient.request('/api/scrap/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      state.lastScrapCalculation = data;
      renderScrapOutput(data);
    } catch (err) {
      alert(`Scrap calculation error: ${err.message}`);
    }
  });

  const saveBtn = document.getElementById('scrap-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      if (!state.lastScrapCalculation) return;
      try {
        const payload = {
          clientName: 'Walk-in Seller',
          materialName: state.lastScrapCalculation.materialName || 'Scrap Metal',
          grossWeightKg: state.lastScrapCalculation.weights?.grossWeight ?? state.lastScrapCalculation.scaleWeight?.grossWeightKg,
          netWeightKg: state.lastScrapCalculation.weights?.netAcceptedWeightKg ?? state.lastScrapCalculation.scaleWeight?.netAcceptedWeightKg,
          unitRate: state.lastScrapCalculation.pricing?.unitRate ?? state.lastScrapCalculation.unitPrice,
          totalPayout: state.lastScrapCalculation.pricing?.netPayout ?? state.lastScrapCalculation.netPayout
        };
        const res = await apiClient.request('/api/scrap/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('Scrap transaction saved successfully!');
        }
      } catch (err) {
        alert('Failed to save scrap transaction.');
      }
    });
  }
}

function renderScrapOutput(data) {
  const box = document.getElementById('output-scrap');
  if (!box) return;
  box.style.display = 'block';

  const w = data.weights || data.scaleWeight || {};
  const p = data.pricing || {};
  const formattedPayout = p.formattedNetPayout || data.formattedNetPayout || `₹ ${(p.netPayout || 0).toLocaleString('en-IN')}`;
  const formattedGross = p.formattedGrossValue || data.formattedGrossValue || `₹ ${(p.grossValue || 0).toLocaleString('en-IN')}`;
  const totalDeductions = p.expenses?.totalExpenses ?? data.commercialDeductions?.totalCommercialDeductions ?? 0;
  const netScale = w.netScaleWeightKg ?? 0;
  const netAccepted = w.netAcceptedWeightKg ?? 0;

  const payoutEl = document.getElementById('scrap-out-payout');
  if (payoutEl) payoutEl.textContent = formattedPayout;

  const tbody = document.getElementById('scrap-out-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>எடைமேடை நிகர எடை (Net Scale Weight):</td><td><strong>${netScale} kg</strong></td></tr>
      <tr><td>கழிவுகள் நீங்கிய எடை (Accepted Weight):</td><td><strong>${netAccepted} kg</strong></td></tr>
      <tr><td>அடிப்படை ஸ்கிராப் மதிப்பு (Gross Value):</td><td>${formattedGross}</td></tr>
      <tr><td>போக்குவரத்து மற்றும் வெட்டு கூலி கழிவு:</td><td>- ₹ ${totalDeductions.toLocaleString('en-IN')}</td></tr>
      <tr style="background:var(--bg-accent-soft); font-weight:800; font-size:1.05rem;">
        <td>நிகர பட்டுவாடா தொகை:</td>
        <td><strong style="color:var(--accent);">${formattedPayout}</strong></td>
      </tr>
    `;
  }

  const steps = data.calculationSteps || data.steps || [];
  const ol = document.getElementById('scrap-out-steps');
  if (ol) ol.innerHTML = steps.map(s => `<li>${s}</li>`).join('');
  const disc = document.getElementById('scrap-out-disclaimer');
  if (disc) disc.textContent = data.disclaimer || (data.assumptions?.join(' • ') || '');
}

// --- BOQ & Payment Milestones ---
function initBoq() {
  calculateBoq(sampleBoqItems);

  const csvBtn = document.getElementById('boq-csv-btn');
  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      try {
        const res = await apiClient.request('/api/boq/export-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: sampleBoqItems })
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DDevUltraHome_BOQ_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
      } catch (err) {
        alert('CSV Export failed.');
      }
    });
  }

  const printBtn = document.getElementById('boq-print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }
}

async function calculateBoq(items) {
  try {
    const res = await apiClient.request('/api/calculate/boq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    if (!res.ok) throw new Error('BOQ Calculation error');
    const data = await res.json();
    renderBoq(data);
    const fin = data.financials || data;
    calculateMilestones(fin.grandTotal);
  } catch (err) {
    console.error('BOQ Error:', err);
  }
}

function renderBoq(data) {
  const tbody = document.getElementById('boq-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const fin = data.financials || data;
  const items = data.items || [];

  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const unitRate = item.unitRate ?? item.compositeRate ?? ((item.materialRate || 0) + (item.labourRate || 0));
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${item.description}</strong></td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>₹ ${item.materialRate}</td>
      <td>₹ ${item.labourRate}</td>
      <td>₹ ${unitRate}</td>
      <td><strong>₹ ${(item.totalAmount || 0).toLocaleString('en-IN')}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  const directCost = fin.directCostSubtotal || 0;
  const overhead = fin.overhead?.amount ?? fin.overheadAmount ?? 0;
  const profit = fin.contractorProfit?.amount ?? fin.contractorProfitAmount ?? 0;
  const cont = fin.contingency?.amount ?? fin.contingencyAmount ?? 0;
  const gst = fin.gst?.amount ?? fin.gstAmount ?? 0;
  const grandTotal = fin.grandTotal || 0;
  const formattedGrand = fin.formattedGrandTotal || `₹ ${grandTotal.toLocaleString('en-IN')}`;

  const subEl = document.getElementById('boq-subtotal');
  if (subEl) subEl.textContent = `₹ ${directCost.toLocaleString('en-IN')}`;
  const overEl = document.getElementById('boq-overhead');
  if (overEl) overEl.textContent = `₹ ${overhead.toLocaleString('en-IN')}`;
  const profEl = document.getElementById('boq-profit');
  if (profEl) profEl.textContent = `₹ ${profit.toLocaleString('en-IN')}`;
  const contEl = document.getElementById('boq-cont');
  if (contEl) contEl.textContent = `₹ ${cont.toLocaleString('en-IN')}`;
  const gstEl = document.getElementById('boq-gst');
  if (gstEl) gstEl.textContent = `₹ ${gst.toLocaleString('en-IN')}`;
  const grandEl = document.getElementById('boq-grand-total');
  if (grandEl) grandEl.textContent = formattedGrand;
}

function calculateMilestones(totalContractAmount) {
  apiClient.request('/api/calculate/milestones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalContractAmount: totalContractAmount || 0 })
  })
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById('milestones-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      (data.schedule || []).forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>Stage ${m.stage}</strong></td>
          <td><strong>${m.name}</strong><div style="font-size:0.75rem; color:var(--text-muted);">${m.description}</div></td>
          <td><span class="badge badge-teal">${m.percentage}%</span></td>
          <td><strong style="color:var(--accent);">₹ ${m.milestoneAmount.toLocaleString('en-IN')}</strong></td>
          <td>₹ ${m.cumulativeAmount.toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error('Milestones Error:', err));
}

// --- Civil AI & Expert Assistant ---
function initAiAssistant() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const container = document.getElementById('chat-messages');

  // AI Settings Drawer Controls
  const toggleBtn = document.getElementById('ai-settings-toggle');
  const panel = document.getElementById('ai-settings-panel');
  const provSelect = document.getElementById('ai-provider-select');
  const keyGroup = document.getElementById('ai-key-group');
  const apiKeyInput = document.getElementById('ai-api-key');
  const advGroup = document.getElementById('ai-advanced-group');
  const modelInput = document.getElementById('ai-model-name');
  const urlGroup = document.getElementById('ai-url-group');
  const urlInput = document.getElementById('ai-base-url');
  const saveBtn = document.getElementById('ai-save-cfg-btn');
  const testBtn = document.getElementById('ai-test-cfg-btn');
  const resetBtn = document.getElementById('ai-reset-cfg-btn');
  const feedback = document.getElementById('ai-cfg-feedback');
  const provBadge = document.getElementById('ai-current-prov-badge');
  const statusBadge = document.getElementById('ai-status-badge');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  const updateAiFieldVisibility = (prov) => {
    if (prov === 'offline') {
      if (keyGroup) keyGroup.style.display = 'none';
      if (advGroup) advGroup.style.display = 'none';
      if (provBadge) provBadge.textContent = 'Offline Civil Expert';
      if (statusBadge) statusBadge.textContent = 'Offline Civil Expert Active';
    } else {
      if (keyGroup) keyGroup.style.display = 'block';
      if (advGroup) advGroup.style.display = 'block';
      if (urlGroup) urlGroup.style.display = prov === 'custom' ? 'block' : 'none';
      if (prov === 'gemini') {
        if (modelInput) modelInput.placeholder = 'gemini-1.5-flash';
        if (provBadge) provBadge.textContent = 'Google Gemini';
        if (statusBadge) statusBadge.textContent = 'Google Gemini Active';
      } else if (prov === 'groq') {
        if (modelInput) modelInput.placeholder = 'llama-3.3-70b-versatile';
        if (provBadge) provBadge.textContent = 'Groq Cloud';
        if (statusBadge) statusBadge.textContent = 'Groq Cloud Active';
      } else if (prov === 'openrouter') {
        if (modelInput) modelInput.placeholder = 'meta-llama/llama-3.2-3b-instruct:free';
        if (provBadge) provBadge.textContent = 'OpenRouter';
        if (statusBadge) statusBadge.textContent = 'OpenRouter Active';
      } else if (prov === 'custom') {
        if (modelInput) modelInput.placeholder = 'llama3';
        if (provBadge) provBadge.textContent = 'Custom Endpoint';
        if (statusBadge) statusBadge.textContent = 'Custom Endpoint Active';
      }
    }
  };

  if (provSelect) {
    provSelect.addEventListener('change', () => updateAiFieldVisibility(provSelect.value));
  }

  // Load saved config
  try {
    const saved = localStorage.getItem('ddev_ai_config');
    if (saved) {
      const cfg = JSON.parse(saved);
      if (provSelect && cfg.provider) provSelect.value = cfg.provider;
      if (apiKeyInput && cfg.apiKey) apiKeyInput.value = cfg.apiKey;
      if (modelInput && cfg.model) modelInput.value = cfg.model;
      if (urlInput && cfg.baseUrl) urlInput.value = cfg.baseUrl;
      updateAiFieldVisibility(cfg.provider || 'offline');
    }
  } catch {}

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const prov = provSelect ? provSelect.value : 'offline';
      const key = apiKeyInput ? apiKeyInput.value : '';
      const model = modelInput ? modelInput.value : '';
      const baseUrl = urlInput ? urlInput.value : '';
      const payload = { provider: prov, apiKey: key, model, baseUrl, disabled: prov === 'offline' };

      try {
        await apiClient.request('/api/ai/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        localStorage.setItem('ddev_ai_config', JSON.stringify(payload));
        if (feedback) feedback.innerHTML = '<span style="color:var(--accent);">✓ அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன (Saved)</span>';
        updateAiFieldVisibility(prov);
      } catch (err) {
        if (feedback) feedback.innerHTML = `<span style="color:var(--danger);">சேமிப்பதில் பிழை: ${err.message}</span>`;
      }
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      if (feedback) feedback.innerHTML = 'இணைப்பு சோதிக்கப்படுகிறது (Testing connection)...';
      try {
        const res = await apiClient.request('/api/ai/test', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          if (feedback) feedback.innerHTML = `<span style="color:var(--accent);">✓ இணைப்பு வெற்றி: ${data.message} (${data.latencyMs}ms)</span>`;
        } else {
          if (feedback) feedback.innerHTML = `<span style="color:var(--danger);">⚠️ இணைப்பு தோல்வி: ${data.message}</span>`;
        }
      } catch (err) {
        if (feedback) feedback.innerHTML = `<span style="color:var(--danger);">பிழை: ${err.message}</span>`;
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (provSelect) provSelect.value = 'offline';
      if (apiKeyInput) apiKeyInput.value = '';
      if (modelInput) modelInput.value = '';
      if (urlInput) urlInput.value = '';
      localStorage.removeItem('ddev_ai_config');
      await apiClient.request('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'offline', disabled: true })
      });
      updateAiFieldVisibility('offline');
      if (feedback) feedback.innerHTML = '<span style="color:var(--accent);">ஆஃப்லைன் சிவில் நிபுணர் நிலைக்கு மீட்டமைக்கப்பட்டது.</span>';
    });
  }

  if (form && input && container) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = input.value.trim();
      if (!question) return;

      appendChatMessage('user', question);
      input.value = '';

      const loadingBubble = appendChatMessage('ai', 'சிவில் என்ஜின் யோசிக்கிறது... (Analyzing IS Codes)...');

      try {
        const res = await apiClient.request('/api/ai/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: question })
        });
        const data = await res.json();
        const header = data.provider || 'DDevUltraHome Civil Knowledge Engine';
        loadingBubble.innerHTML = `<strong>${header}:</strong><br>${data.answer.replace(/\n/g, '<br>')}`;
      } catch (err) {
        loadingBubble.textContent = 'கேள்விக்கு பதிலளிப்பதில் பிழை ஏற்பட்டது.';
      }
    });
  }

  document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (input) {
        input.value = btn.textContent;
        input.focus();
      }
    });
  });
}

// --- Data Sources / Price Provider Settings ---
function initDataSourcesSettings() {
  const provSelect = document.getElementById('ds-provider-select');
  const customUrlGroup = document.getElementById('ds-custom-url-group');
  const customUrlInput = document.getElementById('ds-custom-url');
  const testBtn = document.getElementById('ds-test-btn');
  const flushBtn = document.getElementById('ds-flush-btn');
  const statusMsg = document.getElementById('ds-status-msg');
  const badge = document.getElementById('ds-active-badge');
  const exportBtn = document.getElementById('ds-export-btn');
  const importBtn = document.getElementById('ds-import-btn');
  const fileInput = document.getElementById('ds-file-input');
  const importStatus = document.getElementById('ds-import-status');

  if (provSelect) {
    provSelect.addEventListener('change', async () => {
      const val = provSelect.value;
      if (customUrlGroup) customUrlGroup.style.display = val === 'public_api' ? 'block' : 'none';
      if (badge) {
        const badgeMap = {
          dealer_quote: 'Dealer Quotes Active',
          pwd_sor: 'TN PWD SOR Active',
          public_api: 'Public/Custom API Active',
          offline_reference: 'Offline Baseline Active'
        };
        badge.textContent = badgeMap[val] || val;
      }
      try {
        await apiClient.request('/api/providers/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId: val, customUrl: customUrlInput?.value || '' })
        });
        localStorage.setItem('ddev_active_provider', val);
        if (statusMsg) statusMsg.innerHTML = '<span style="color:var(--accent);">✓ விலை மூலம் வெற்றிகரமாக மாற்றப்பட்டது.</span>';
        loadMaterialRates();
      } catch (err) {
        if (statusMsg) statusMsg.textContent = `பிழை: ${err.message}`;
      }
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      if (statusMsg) statusMsg.textContent = 'இணைப்பு சோதிக்கப்படுகிறது...';
      try {
        const res = await apiClient.request('/api/providers/test', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          if (statusMsg) statusMsg.innerHTML = `<span style="color:var(--accent);">✓ ${data.message} (${data.latencyMs}ms)</span>`;
        } else {
          if (statusMsg) statusMsg.innerHTML = `<span style="color:var(--danger);">⚠️ ${data.message}</span>`;
        }
      } catch (err) {
        if (statusMsg) statusMsg.innerHTML = `<span style="color:var(--danger);">பிழை: ${err.message}</span>`;
      }
    });
  }

  if (flushBtn) {
    flushBtn.addEventListener('click', async () => {
      try {
        await apiClient.request('/api/providers/flush-cache', { method: 'POST' });
        if (statusMsg) statusMsg.innerHTML = '<span style="color:var(--accent);">✓ உள்ளூர் நினைவகம் அழிக்கப்பட்டு புதுப்பிக்கப்பட்டது.</span>';
        loadMaterialRates();
      } catch (err) {
        if (statusMsg) statusMsg.textContent = `பிழை: ${err.message}`;
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      try {
        const raw = localStorage.getItem('ddev_custom_rates') || '{}';
        const blob = new Blob([raw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DDevUltraHome_Custom_Rates_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Export failed: ${err.message}`);
      }
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target.result);
          localStorage.setItem('ddev_custom_rates', JSON.stringify(content));
          if (importStatus) importStatus.innerHTML = '<span style="color:var(--accent);">✓ தனிப்பயன் விலைகள் வெற்றிகரமாக இறக்குமதி செய்யப்பட்டன.</span>';
          loadMaterialRates();
        } catch (err) {
          if (importStatus) importStatus.innerHTML = `<span style="color:var(--danger);">JSON வடிவப் பிழை: ${err.message}</span>`;
        }
      };
      reader.readAsText(file);
    });
  }
}

function appendChatMessage(sender, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return null;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

// --- Project Profile & Database Sync ---
function initProjectProfile() {
  const form = document.getElementById('form-project');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('proj-name').value,
      client: document.getElementById('proj-client').value,
      plotAreaSqft: parseFloat(document.getElementById('proj-plot').value) || 0,
      builtupAreaSqft: parseFloat(document.getElementById('proj-builtup').value) || 0,
      location: document.getElementById('proj-location').value,
      district: state.currentDistrict
    };

    try {
      const res = await apiClient.request('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Project Profile saved successfully!');
        loadProjectProfile();
      }
    } catch (err) {
      alert('Failed to save project.');
    }
  });
}

async function loadProjectProfile() {
  try {
    const res = await apiClient.request('/api/projects');
    if (res.ok) {
      const data = await res.json();
      const projects = Array.isArray(data) ? data : (data.projects || []);
      if (projects.length > 0) {
        const p = projects[0];
        const nameEl = document.getElementById('home-proj-name');
        const clientEl = document.getElementById('home-proj-client');
        const locEl = document.getElementById('home-proj-location');
        if (nameEl) nameEl.textContent = p.name;
        if (clientEl) clientEl.textContent = p.client || '—';
        if (locEl) locEl.textContent = `${p.location || ''}, ${p.district || ''}`;
      }
    }
  } catch (err) {
    // Offline mode safe
  }
}

// --- Android APK & PWA Native Install Prompt ---
function initApkInstallPrompt() {
  let deferredPrompt;
  const installBtn = document.getElementById('install-apk-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
      installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`User response to APK install: ${outcome}`);
          deferredPrompt = null;
          installBtn.style.display = 'none';
        }
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    console.log('DDevUltraHome APK installed successfully!');
  });
}
