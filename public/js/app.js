/**
 * DDevUltraHome Client Controller
 * Tamil Nadu Civil Engineering, Material Intelligence & Scrap Management
 */

// Global State
const state = {
  currentLang: 'en',
  currentDistrict: 'Chennai',
  activeTab: 'tab-calc',
  activeSubtab: 'sub-concrete',
  rates: [],
  scrapRates: [],
  lastScrapCalculation: null
};

// Initial Sample BOQ
const sampleBoqItems = [
  { itemCode: 'ITEM-01', description: 'Earthwork excavation in foundation trenches and pits up to 1.5m depth', quantity: 45.0, unit: 'm³', materialRate: 0, labourRate: 350 },
  { itemCode: 'ITEM-02', description: 'Plain Cement Concrete (PCC 1:4:8) under footings and plinth beams', quantity: 8.5, unit: 'm³', materialRate: 3400, labourRate: 750 },
  { itemCode: 'ITEM-03', description: 'Reinforced Cement Concrete (RCC M20) in footings, columns, beams, and roof slabs', quantity: 28.0, unit: 'm³', materialRate: 4600, labourRate: 1400 },
  { itemCode: 'ITEM-04', description: 'Fe550D TMT Reinforcement Steel cutting, bending, and placing in RCC works', quantity: 2240, unit: 'kg', materialRate: 64.5, labourRate: 11.0 },
  { itemCode: 'ITEM-05', description: 'Traditional Wire-Cut Red Country Brick masonry in cement mortar 1:5 (9-inch outer wall)', quantity: 32.0, unit: 'm³', materialRate: 4800, labourRate: 1550 },
  { itemCode: 'ITEM-06', description: 'Internal ceiling and wall plastering 12mm thick in cement mortar 1:5', quantity: 240.0, unit: 'm²', materialRate: 75, labourRate: 145 },
  { itemCode: 'ITEM-07', description: 'Vitrified floor tiles 600x600mm laid on 20mm cement mortar bed with neat slurry', quantity: 85.0, unit: 'm²', materialRate: 450, labourRate: 180 },
  { itemCode: 'ITEM-08', description: 'Interior painting with 2 coats wall putty, 1 coat primer, and 2 coats acrylic emulsion', quantity: 240.0, unit: 'm²', materialRate: 60, labourRate: 90 }
];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSubtabs();
  initLanguageToggle();
  initDistrictSelector();
  initCalculators();
  initScrapCalculator();
  initBoq();
  initAiAssistant();
  loadMaterialRates();

  // Register Service Worker for Offline PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration:', err));
  }

  // Print timestamp setup
  const timeElem = document.getElementById('print-timestamp');
  if (timeElem) {
    timeElem.textContent = `Generated on: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`;
  }
});

// --- Tab Navigation ---
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
      state.activeTab = targetId;
    });
  });
}

function initSubtabs() {
  const subtabs = document.querySelectorAll('.subtab-btn');
  subtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      subtabs.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.calc-section').forEach(s => s.style.display = 'none');

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-subtab');
      const targetSec = document.getElementById(targetId);
      if (targetSec) targetSec.style.display = 'block';
      state.activeSubtab = targetId;
    });
  });
}

// --- Language Toggle ---
function initLanguageToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  btn.addEventListener('click', async () => {
    state.currentLang = state.currentLang === 'en' ? 'ta' : 'en';
    btn.textContent = state.currentLang === 'en' ? 'தமிழ் (TA)' : 'English (EN)';

    try {
      const res = await fetch(`/api/i18n?lang=${state.currentLang}`);
      if (res.ok) {
        const i18n = await res.json();
        applyTranslations(i18n);
      }
    } catch (e) {
      console.error('Translation load error:', e);
    }
  });
}

function applyTranslations(i18n) {
  document.getElementById('app-title-text').textContent = i18n.appTitle;
  document.getElementById('nav-calc').textContent = `📐 ${i18n.nav.calculations}`;
  document.getElementById('nav-rates').textContent = `📊 ${i18n.nav.materialRates}`;
  document.getElementById('nav-scrap').textContent = `⚖️ ${i18n.nav.scrapRates}`;
  document.getElementById('nav-boq').textContent = `📋 ${i18n.nav.boq}`;
  document.getElementById('nav-ai').textContent = `🤖 ${i18n.nav.aiAssistant}`;
  document.getElementById('nav-projects').textContent = `📁 ${i18n.nav.projects}`;
}

// --- District Selector ---
function initDistrictSelector() {
  const select = document.getElementById('district-select');
  select.addEventListener('change', () => {
    state.currentDistrict = select.value;
    loadMaterialRates();
    const lbl = document.getElementById('rates-current-district-label');
    if (lbl) lbl.textContent = `District: ${state.currentDistrict}`;
  });
}

// --- Material Rates Loader ---
async function loadMaterialRates() {
  try {
    const res = await fetch(`/api/rates?district=${encodeURIComponent(state.currentDistrict)}`);
    if (!res.ok) throw new Error('Failed to load rates');
    const data = await res.json();
    state.rates = data.rates || [];
    renderMaterialRates(state.rates);
  } catch (err) {
    console.error('Error fetching rates:', err);
  }
}

function renderMaterialRates(rates) {
  const tbody = document.getElementById('rates-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  rates.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${r.standardName}</strong>
        <div style="font-size:0.75rem; color:#64748b;">${r.spec}</div>
      </td>
      <td>${r.unit}</td>
      <td><strong style="color:#1e40af;">${r.formattedMarketPrice}</strong></td>
      <td>${r.formattedSorPrice}</td>
      <td>
        <span class="badge ${r.freshness.code === 'VERIFIED_RECENTLY' ? 'badge-green' : 'badge-yellow'}">
          ${r.freshness.label}
        </span>
        <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">
          <a href="${r.sorSourceUrl}" target="_blank" style="color:#0284c7; text-decoration:none;">${r.sorSource}</a>
        </div>
      </td>
      <td>
        <div style="font-size:0.8rem;">${r.taxStatus}</div>
        <div style="font-size:0.75rem; color:#64748b;">${r.transportStatus}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Civil Engineering Calculators ---
function initCalculators() {
  // 1. Concrete Calculator
  const concForm = document.getElementById('form-concrete');
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
      const res = await fetch('/api/calculate/concrete', {
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

  // 2. RCC Calculator
  const rccForm = document.getElementById('form-rcc');
  rccForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const elemType = document.getElementById('rcc-type').value;
    const payload = {
      elementType: elemType,
      mixGrade: document.getElementById('rcc-grade').value,
      steelPercentage: parseFloat(document.getElementById('rcc-steel-pct').value) || 0.8,
      count: parseInt(document.getElementById('rcc-count').value, 10) || 1
    };

    if (elemType === 'SLAB') {
      payload.length = parseFloat(document.getElementById('rcc-dim-l').value);
      payload.width = parseFloat(document.getElementById('rcc-dim-w').value);
      payload.thickness = parseFloat(document.getElementById('rcc-dim-d').value);
      payload.thicknessUnit = 'mm';
    } else if (elemType === 'BEAM') {
      payload.span = parseFloat(document.getElementById('rcc-dim-l').value);
      payload.width = parseFloat(document.getElementById('rcc-dim-w').value) * 1000;
      payload.depth = parseFloat(document.getElementById('rcc-dim-d').value);
      payload.dimensionUnit = 'mm';
    } else if (elemType === 'COLUMN') {
      payload.height = parseFloat(document.getElementById('rcc-dim-l').value);
      payload.width = parseFloat(document.getElementById('rcc-dim-w').value) * 1000;
      payload.depth = parseFloat(document.getElementById('rcc-dim-d').value);
    } else if (elemType === 'FOOTING') {
      payload.length = parseFloat(document.getElementById('rcc-dim-l').value);
      payload.width = parseFloat(document.getElementById('rcc-dim-w').value);
      payload.depth = parseFloat(document.getElementById('rcc-dim-d').value);
    } else if (elemType === 'STAIRCASE') {
      payload.flightLengthM = parseFloat(document.getElementById('rcc-dim-l').value);
      payload.stairWidthM = parseFloat(document.getElementById('rcc-dim-w').value);
      payload.waistSlabThicknessMm = parseFloat(document.getElementById('rcc-dim-d').value);
      payload.riserMm = 150;
      payload.treadMm = 250;
      payload.numberOfSteps = 10;
    }

    try {
      const res = await fetch('/api/calculate/rcc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      renderRccOutput(data);
    } catch (err) {
      alert(`Calculation error: ${err.message}`);
    }
  });

  // 3. Masonry Calculator
  const masForm = document.getElementById('form-masonry');
  masForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const deduct = parseFloat(document.getElementById('mas-deduct').value) || 0;
    const payload = {
      brickType: document.getElementById('mas-type').value,
      wallLength: parseFloat(document.getElementById('mas-len').value),
      wallHeight: parseFloat(document.getElementById('mas-height').value),
      wallThicknessMm: parseInt(document.getElementById('mas-thick').value, 10),
      mortarMix: document.getElementById('mas-mortar').value,
      deductions: deduct > 0 ? [{ width: deduct, height: 1.0, count: 1 }] : []
    };

    try {
      const res = await fetch('/api/calculate/masonry', {
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

  // 4. Finishing Calculator
  const finForm = document.getElementById('form-finishing');
  finForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('fin-type').value;
    const area = parseFloat(document.getElementById('fin-area').value);
    let payload = { finishingType: type };

    if (type === 'PLASTER') {
      payload.areaM2 = area;
      payload.spec = document.getElementById('fin-spec').value;
    } else if (type === 'PAINT') {
      payload.wallAreaM2 = area;
      payload.includePutty = true;
      payload.includePrimer = true;
      payload.includeEmulsion = true;
    } else if (type === 'FLOORING') {
      payload.floorAreaM2 = area;
      payload.perimeterM = Math.sqrt(area) * 4;
      payload.tileType = 'VITRIFIED_2X2';
    }

    try {
      const res = await fetch('/api/calculate/finishing', {
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

  // 5. Earthwork Calculator
  const earthForm = document.getElementById('form-earthwork');
  earthForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      length: parseFloat(document.getElementById('earth-l').value),
      width: parseFloat(document.getElementById('earth-w').value),
      depth: parseFloat(document.getElementById('earth-d').value),
      count: parseInt(document.getElementById('earth-count').value, 10) || 1,
      structureVolumeM3: parseFloat(document.getElementById('earth-struct-vol').value) || 0
    };

    try {
      const res = await fetch('/api/calculate/earthwork', {
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

  // 6. Stirrup BBS Calculator
  const stirForm = document.getElementById('form-stirrup');
  stirForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: 'STIRRUP',
      memberWidthMm: parseFloat(document.getElementById('stir-w').value),
      memberDepthMm: parseFloat(document.getElementById('stir-d').value),
      barDiameterMm: parseInt(document.getElementById('stir-dia').value, 10),
      clearCoverMm: parseFloat(document.getElementById('stir-cover').value),
      hookAngle: parseInt(document.getElementById('stir-hook').value, 10)
    };

    try {
      const res = await fetch('/api/calculate/bbs', {
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

  // 7. Water Tank Calculator
  const tankForm = document.getElementById('form-watertank');
  tankForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      shape: document.getElementById('tank-shape').value,
      lengthM: parseFloat(document.getElementById('tank-l').value),
      widthM: parseFloat(document.getElementById('tank-w').value),
      heightM: parseFloat(document.getElementById('tank-h').value),
      freeboardM: parseFloat(document.getElementById('tank-fb').value)
    };

    try {
      const res = await fetch('/api/calculate/watertank', {
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

  // 8. Labour Calculator
  const labourForm = document.getElementById('form-labour');
  labourForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      activityKey: document.getElementById('labour-act').value,
      quantity: parseFloat(document.getElementById('labour-qty').value)
    };

    try {
      const res = await fetch('/api/calculate/labour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      renderLabourOutput(data);
    } catch (err) {
      alert(`Labour estimation error: ${err.message}`);
    }
  });

  // 9. Septic Tank Calculator
  const septicForm = document.getElementById('form-septictank');
  if (septicForm) {
    septicForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        users: parseInt(document.getElementById('septic-users').value, 10),
        sewageFlowLpcd: parseFloat(document.getElementById('septic-lpcd').value) || 90,
        detentionHours: parseFloat(document.getElementById('septic-detention').value) || 24,
        cleaningIntervalYears: parseFloat(document.getElementById('septic-cleaning').value) || 2,
        percolationRateMin: parseFloat(document.getElementById('septic-percolation').value) || 15
      };

      try {
        const res = await fetch('/api/calculate/septictank', {
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
}

function renderSepticOutput(data) {
  const box = document.getElementById('output-septictank');
  box.style.display = 'block';

  document.getElementById('septic-out-capacity').textContent = `${data.liquidCapacityLitres.toLocaleString('en-IN')} Litres`;

  const tbody = document.getElementById('septic-out-tbody');
  tbody.innerHTML = `
    <tr><td>Occupancy:</td><td><strong>${data.occupancy} Users</strong> (${data.dailySewageLitres} L/day)</td></tr>
    <tr><td>Tank Dimensions (L × W × H):</td><td><strong>${data.dimensions.lengthM}m × ${data.dimensions.widthM}m × ${data.dimensions.totalDepthM}m</strong></td></tr>
    <tr><td>Liquid Depth & Freeboard:</td><td>Depth: ${data.dimensions.liquidDepthM}m + Freeboard: ${data.dimensions.freeboardM}m</td></tr>
    <tr><td>Total Gross Tank Volume:</td><td><strong>${data.dimensions.grossVolumeM3} m³</strong></td></tr>
    <tr><td>Soak Pit Sizing:</td><td><strong>Dia: ${data.soakPit.diameterM}m, Depth: ${data.soakPit.depthM}m</strong> (${data.soakPit.sideAreaM2} m² area)</td></tr>
  `;

  const ol = document.getElementById('septic-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
  document.getElementById('septic-out-disclaimer').textContent = data.disclaimer;
}

// --- Render Helper Functions for Calculations ---
function renderConcreteOutput(data) {
  const box = document.getElementById('output-concrete');
  box.style.display = 'block';

  document.getElementById('conc-out-wetvol').textContent = `${data.wetVolumeM3} m³ (${data.wetVolumeCft} cft)`;

  const tbody = document.getElementById('conc-out-table');
  tbody.innerHTML = `
    <tr><td><strong>Cement</strong></td><td>${data.materials.cement.weightKg} kg</td><td><strong>${data.materials.cement.bagsRounded} Bags</strong> (50kg)</td></tr>
    <tr><td><strong>Sand (M-Sand)</strong></td><td>${data.materials.sand.volumeM3} m³ (${data.materials.sand.volumeCft} cft)</td><td><strong>${data.materials.sand.tnUnits} Units</strong></td></tr>
    <tr><td><strong>Aggregate (20mm)</strong></td><td>${data.materials.aggregate.volumeM3} m³ (${data.materials.aggregate.volumeCft} cft)</td><td><strong>${data.materials.aggregate.tnUnits} Units</strong></td></tr>
    <tr><td><strong>Water</strong></td><td>${data.materials.water.quantityLitres} Litres</td><td>—</td></tr>
  `;

  const ol = document.getElementById('conc-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
  document.getElementById('conc-out-disclaimer').textContent = data.disclaimer;
}

function renderRccOutput(data) {
  const box = document.getElementById('output-rcc');
  box.style.display = 'block';
  document.getElementById('rcc-out-title').textContent = `${data.element} Quantity Take-off`;

  const tbody = document.getElementById('rcc-out-tbody');
  tbody.innerHTML = `
    <tr><td>Concrete Volume:</td><td><strong>${data.concreteVolumeM3 || data.rccVolumeM3} m³</strong></td></tr>
    <tr><td>Shuttering Contact Area:</td><td><strong>${data.shutteringAreaM2} m² (${data.shutteringAreaSqft || (data.shutteringAreaM2 * 10.76).toFixed(1)} sq.ft)</strong></td></tr>
    <tr><td>Reinforcement Steel:</td><td><strong>${data.steel.weightKg} kg (${data.steel.weightTonnes} Tonnes)</strong></td></tr>
    <tr><td>Cement Bags:</td><td>${data.concreteMaterials?.cement?.bagsRounded || data.rccMaterials?.cement?.bagsRounded || '—'} Bags</td></tr>
  `;

  const ol = document.getElementById('rcc-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
  document.getElementById('rcc-out-disclaimer').textContent = data.disclaimer;
}

function renderMasonryOutput(data) {
  const box = document.getElementById('output-masonry');
  box.style.display = 'block';

  const tbody = document.getElementById('mas-out-tbody');
  tbody.innerHTML = `
    <tr><td>Net Masonry Volume:</td><td><strong>${data.netVolumeM3} m³ (${data.netVolumeCft} cft)</strong></td></tr>
    <tr><td>Bricks / Blocks Required:</td><td><strong style="color:#1e40af; font-size:1.1rem;">${data.materials.bricks.countRequired} Nos</strong> (${data.materials.bricks.wastagePercent}% wastage)</td></tr>
    <tr><td>Cement Required:</td><td><strong>${data.materials.cement.bagsRounded} Bags</strong> (50kg)</td></tr>
    <tr><td>Sand Required:</td><td><strong>${data.materials.sand.volumeCft} cft</strong> (${data.materials.sand.tnUnits} TN Units)</td></tr>
  `;

  const ol = document.getElementById('mas-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderFinishingOutput(data) {
  const box = document.getElementById('output-finishing');
  box.style.display = 'block';

  const tbody = document.getElementById('fin-out-tbody');
  let html = `<tr><td>Surface Area:</td><td><strong>${data.areaM2 || data.areas?.totalAreaM2} m²</strong></td></tr>`;

  if (data.workType === 'Plastering') {
    html += `
      <tr><td>Cement Bags:</td><td><strong>${data.materials.cement.bagsRounded} Bags</strong></td></tr>
      <tr><td>Plastering Sand (P-Sand):</td><td><strong>${data.materials.sand.volumeCft} cft</strong> (${data.materials.sand.tnUnits} TN Units)</td></tr>
    `;
  } else if (data.workType.includes('Painting')) {
    html += `
      <tr><td>Wall Putty:</td><td><strong>${data.materials.putty?.weightKg || 0} kg</strong> (~${data.materials.putty?.bags40Kg || 0} bags)</td></tr>
      <tr><td>Primer:</td><td><strong>${data.materials.primer?.litresRounded || 0} Litres</strong></td></tr>
      <tr><td>Emulsion Paint:</td><td><strong>${data.materials.paint?.litresRounded || 0} Litres</strong></td></tr>
    `;
  } else if (data.workType.includes('Flooring')) {
    html += `
      <tr><td>Tiles Required:</td><td><strong>${data.tiles.countRequired} Tiles</strong> (${data.tiles.boxesRequired} Boxes)</td></tr>
      <tr><td>Bedding Cement:</td><td><strong>${data.beddingMaterials.cement.totalBagsRounded} Bags</strong></td></tr>
      <tr><td>Bedding Sand:</td><td><strong>${data.beddingMaterials.sand.volumeCft} cft</strong></td></tr>
      <tr><td>Tile Grout:</td><td><strong>${data.beddingMaterials.groutKg} kg</strong></td></tr>
    `;
  }
  tbody.innerHTML = html;

  const ol = document.getElementById('fin-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderEarthworkOutput(data) {
  const box = document.getElementById('output-earthwork');
  box.style.display = 'block';

  const tbody = document.getElementById('earth-out-tbody');
  tbody.innerHTML = `
    <tr><td>In-situ Bank Excavation:</td><td><strong>${data.inSituExcavationM3} m³ (${data.inSituExcavationCft} cft)</strong></td></tr>
    <tr><td>Loose Soil Volume (Swell 1.25):</td><td><strong>${data.looseExcavatedM3} m³</strong></td></tr>
    <tr><td>Net Pit Backfilling:</td><td><strong>${data.backfill.pitBackfillM3} m³</strong></td></tr>
    <tr><td>Surplus Soil to Cart Away:</td><td><strong>${data.surplusDisposalM3} m³</strong></td></tr>
  `;

  const ol = document.getElementById('earth-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderStirrupOutput(data) {
  const box = document.getElementById('output-stirrup');
  box.style.display = 'block';
  document.getElementById('stir-out-cutlen').textContent = `${data.cuttingLengthM} m (${data.cuttingLengthMm} mm)`;

  const ol = document.getElementById('stir-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderWaterTankOutput(data) {
  const box = document.getElementById('output-watertank');
  box.style.display = 'block';
  document.getElementById('tank-out-litres').textContent = `${data.netCapacityLitres.toLocaleString('en-IN')} Litres`;

  const ol = document.getElementById('tank-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderLabourOutput(data) {
  const box = document.getElementById('output-labour');
  box.style.display = 'block';
  document.getElementById('labour-out-cost').textContent = `₹ ${data.totalLabourCost.toLocaleString('en-IN')}`;

  const tbody = document.getElementById('labour-out-tbody');
  tbody.innerHTML = (data.breakdown || []).map(b => `
    <tr>
      <td>${b.tradeName}</td>
      <td>${b.manDays} days</td>
      <td>₹ ${b.ratePerDay}</td>
      <td><strong>₹ ${b.totalCost.toLocaleString('en-IN')}</strong></td>
    </tr>
  `).join('');
}

// --- Scrap Settlement Calculator ---
function initScrapCalculator() {
  const select = document.getElementById('scrap-select');
  const rateInput = document.getElementById('scrap-rate');

  select.addEventListener('change', () => {
    const val = select.value;
    if (val === 'SCRAP-COP-DC') rateInput.value = 950;
    else if (val === 'SCRAP-COP-OC') rateInput.value = 850;
    else if (val === 'SCRAP-BRASS-HONEY') rateInput.value = 700;
    else if (val === 'SCRAP-ALUM-SECTION') rateInput.value = 350;
    else if (val === 'SCRAP-ALUM-UTENSIL') rateInput.value = 153.40;
    else if (val === 'SCRAP-SS-304') rateInput.value = 140;
    else if (val === 'SCRAP-CABLE-ELEC') { rateInput.value = 170; document.getElementById('scrap-insul').value = 45; }
    else if (val === 'SCRAP-BAT-CAR') rateInput.value = 66.66;
    else rateInput.value = 41; // HMS
  });

  const form = document.getElementById('form-scrap');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      materialName: select.options[select.selectedIndex].text.split('—')[0].trim(),
      grossWeight: parseFloat(document.getElementById('scrap-gross').value),
      tareWeight: parseFloat(document.getElementById('scrap-tare').value) || 0,
      unitRate: parseFloat(document.getElementById('scrap-rate').value),
      moisturePercent: parseFloat(document.getElementById('scrap-moist').value) || 0,
      impurityPercent: parseFloat(document.getElementById('scrap-impur').value) || 0,
      insulationDeductionPercent: parseFloat(document.getElementById('scrap-insul').value) || 0,
      transportCost: parseFloat(document.getElementById('scrap-trans').value) || 0,
      labourHandlingCost: parseFloat(document.getElementById('scrap-labour').value) || 0
    };

    try {
      const res = await fetch('/api/scrap/calculate', {
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

  // Save Settlement button
  document.getElementById('scrap-save-btn').addEventListener('click', async () => {
    if (!state.lastScrapCalculation) return;
    try {
      const res = await fetch('/api/scrap/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_name: state.lastScrapCalculation.materialName,
          weights: state.lastScrapCalculation.weights,
          pricing: state.lastScrapCalculation.pricing,
          gross_value: state.lastScrapCalculation.pricing.grossValue,
          net_payout: state.lastScrapCalculation.pricing.netPayout
        })
      });
      if (res.ok) {
        alert('Scrap transaction saved successfully to local database!');
      }
    } catch (e) {
      alert('Error saving scrap settlement');
    }
  });
}

function renderScrapOutput(data) {
  const box = document.getElementById('output-scrap');
  box.style.display = 'block';

  document.getElementById('scrap-out-payout').textContent = data.pricing.formattedNetPayout;

  const tbody = document.getElementById('scrap-out-tbody');
  tbody.innerHTML = `
    <tr><td>Gross Weighbridge Weight:</td><td><strong>${data.weights.grossWeight} kg</strong></td></tr>
    <tr><td>Tare Weight:</td><td>${data.weights.tareWeight} kg</td></tr>
    <tr><td>Net Scale Weight:</td><td>${data.weights.netScaleWeightKg} kg</td></tr>
    <tr><td>Total Weight Deductions:</td><td style="color:#dc2626;">-${data.weights.deductionsKg.totalDeductionsKg} kg</td></tr>
    <tr><td>Net Accepted Material:</td><td><strong style="color:#16a34a; font-size:1.05rem;">${data.weights.netAcceptedWeightKg} kg</strong></td></tr>
    <tr><td>Gross Material Value:</td><td>${data.pricing.formattedGrossValue}</td></tr>
    <tr><td>Expenses (Transport + Handling):</td><td style="color:#dc2626;">-₹ ${data.pricing.expenses.totalExpenses}</td></tr>
  `;

  const ol = document.getElementById('scrap-out-steps');
  ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
  document.getElementById('scrap-out-disclaimer').textContent = data.disclaimer;
}

// --- BOQ Engine UI ---
async function initBoq() {
  try {
    const res = await fetch('/api/calculate/boq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: sampleBoqItems,
        contractorProfitPercent: 10,
        overheadPercent: 5,
        contingencyPercent: 3,
        gstPercent: 18
      })
    });
    if (res.ok) {
      const data = await res.json();
      renderBoq(data);
    }
  } catch (err) {
    console.error('BOQ calculation error:', err);
  }

  document.getElementById('boq-print-btn').addEventListener('click', () => {
    window.print();
  });

  const csvBtn = document.getElementById('boq-csv-btn');
  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/boq/export-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: sampleBoqItems,
            contractorProfitPercent: 10,
            overheadPercent: 5,
            contingencyPercent: 3,
            gstPercent: 18
          })
        });
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DDevUltraHome_BOQ_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        alert('CSV Export failed');
      }
    });
  }
}

function renderBoq(data) {
  const tbody = document.getElementById('boq-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  data.items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${item.description}</strong></td>
      <td>${item.quantity.toLocaleString('en-IN')}</td>
      <td>${item.unit}</td>
      <td>₹ ${item.materialRate.toFixed(2)}</td>
      <td>₹ ${item.labourRate.toFixed(2)}</td>
      <td>₹ ${item.unitRate.toFixed(2)}</td>
      <td><strong>₹ ${item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  const fin = data.financials;
  document.getElementById('boq-subtotal').textContent = `₹ ${fin.directCostSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('boq-overhead').textContent = `₹ ${fin.overhead.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('boq-profit').textContent = `₹ ${fin.contractorProfit.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('boq-cont').textContent = `₹ ${fin.contingency.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('boq-gst').textContent = `₹ ${fin.gst.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('boq-grand-total').textContent = fin.formattedGrandTotal;

  // Render Contractor Payment Milestones
  fetch('/api/calculate/milestones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalContractAmount: fin.grandTotal })
  }).then(r => r.json()).then(m => {
    const mTbody = document.getElementById('milestones-table-body');
    if (mTbody && m.schedule) {
      mTbody.innerHTML = m.schedule.map(s => `
        <tr>
          <td><strong>Stage ${s.stage}</strong></td>
          <td>
            <strong>${s.name}</strong>
            <div style="font-size:0.75rem; color:#64748b;">${s.deliverables}</div>
          </td>
          <td><span class="badge badge-blue">${s.percentage}%</span></td>
          <td><strong style="color:#1e40af;">${s.formattedAmount}</strong></td>
          <td><strong>${s.formattedCumulativeAmount}</strong> (${s.cumulativePercentage}%)</td>
        </tr>
      `).join('');
    }
  }).catch(e => console.error('Milestones render error:', e));
}

// --- Civil AI Assistant UI ---
function initAiAssistant() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const win = document.getElementById('chat-messages');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    // Add user bubble
    appendMessage(win, 'user', query);
    input.value = '';

    // Add loading indicator
    const loadingBubble = appendMessage(win, 'ai', 'Thinking... (Consulting IS Codes & PWD Data)');

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query })
      });
      const data = await res.json();

      let ansHtml = `<strong>${data.provider}:</strong><br>${escapeHtml(data.answer).replace(/\n/g, '<br>')}`;
      if (data.notice) {
        ansHtml += `<br><small style="color:#d97706;"><em>${data.notice}</em></small>`;
      }
      loadingBubble.innerHTML = ansHtml;
    } catch (err) {
      loadingBubble.textContent = `Error: ${err.message}`;
    }
  });

  // Quick prompt buttons
  document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.textContent;
      form.dispatchEvent(new Event('submit'));
    });
  });
}

function appendMessage(container, role, text) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
