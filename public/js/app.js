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
  initApkInstallPrompt();

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

// --- Android APK & PWA Native Install Prompt ---
function initApkInstallPrompt() {
  let deferredPrompt;
  const installBtn = document.getElementById('install-apk-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.style.display = 'inline-block';
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

  // 10. Geotech SBC & Footing Sizer
  const geoForm = document.getElementById('form-geotech');
  if (geoForm) {
    geoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const colSize = parseFloat(document.getElementById('geo-col-size').value) || 300;
      const payload = {
        columnAxialLoadKn: parseFloat(document.getElementById('geo-load').value),
        sbcKnm2: parseFloat(document.getElementById('geo-soil').value),
        columnWidthMm: colSize,
        columnDepthMm: colSize,
        concreteGrade: document.getElementById('geo-grade').value
      };

      try {
        const res = await fetch('/api/calculate/sbc-footing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderGeotechOutput(data);
      } catch (err) {
        alert(`Geotech calculation error: ${err.message}`);
      }
    });
  }

  // 11. Concrete QC Cube Test
  const qcForm = document.getElementById('form-qc');
  if (qcForm) {
    qcForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        grade: document.getElementById('qc-grade').value,
        testAgeDays: parseInt(document.getElementById('qc-age').value, 10),
        elementName: document.getElementById('qc-element').value,
        breakingLoadsKn: [
          parseFloat(document.getElementById('qc-c1').value),
          parseFloat(document.getElementById('qc-c2').value),
          parseFloat(document.getElementById('qc-c3').value)
        ]
      };

      try {
        const res = await fetch('/api/qc/cube-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderQcOutput(data);
      } catch (err) {
        alert(`QC test evaluation error: ${err.message}`);
      }
    });
  }

  // 12. Anti-Termite Treatment
  const antiForm = document.getElementById('form-antitermite');
  if (antiForm) {
    antiForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        plinthAreaM2: parseFloat(document.getElementById('anti-plinth').value),
        chemical: document.getElementById('anti-chem').value,
        perimeterM: parseFloat(document.getElementById('anti-perim').value),
        trenchAreaM2: parseFloat(document.getElementById('anti-trench').value)
      };

      try {
        const res = await fetch('/api/calculate/antitermite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderAntiTermiteOutput(data);
      } catch (err) {
        alert(`Anti-termite estimation error: ${err.message}`);
      }
    });
  }

  // 13. TNCDBR 2019 Rule Checker
  const tnForm = document.getElementById('form-tncdbr');
  if (tnForm) {
    tnForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        plotAreaSqft: parseFloat(document.getElementById('tn-plot').value),
        roadWidthM: parseFloat(document.getElementById('tn-road').value),
        proposedGroundFloorSqft: parseFloat(document.getElementById('tn-gf').value),
        proposedTotalBuiltupSqft: parseFloat(document.getElementById('tn-tot').value),
        buildingHeightM: parseFloat(document.getElementById('tn-height').value) || 7.0,
        frontSetbackM: parseFloat(document.getElementById('tn-front').value) || 1.5,
        rearSetbackM: parseFloat(document.getElementById('tn-rear').value) || 1.5,
        side1SetbackM: parseFloat(document.getElementById('tn-sides').value) || 1.0,
        side2SetbackM: parseFloat(document.getElementById('tn-sides').value) || 1.0
      };

      try {
        const res = await fetch('/api/planning/tncdbr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderTncdbrOutput(data);
      } catch (err) {
        alert(`TNCDBR validation error: ${err.message}`);
      }
    });
  }

  // 14. M-Book Quantity Measurement
  const mbForm = document.getElementById('form-mbook');
  if (mbForm) {
    mbForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        entries: [
          {
            location: document.getElementById('mb-loc').value,
            nos: parseFloat(document.getElementById('mb-nos').value) || 1,
            lengthM: parseFloat(document.getElementById('mb-l').value) || 0,
            breadthM: parseFloat(document.getElementById('mb-b').value) || 0,
            depthM: parseFloat(document.getElementById('mb-d').value) || 0
          }
        ]
      };

      try {
        const res = await fetch('/api/mbook/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderMBookOutput(data, document.getElementById('mb-desc').value);
      } catch (err) {
        alert(`M-Book calculation error: ${err.message}`);
      }
    });
  }

  // 15. Rainwater Harvesting (RWH) Sizer
  const rwhForm = document.getElementById('form-rwh');
  if (rwhForm) {
    rwhForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        roofAreaSqft: parseFloat(document.getElementById('rwh-roof').value),
        pavedAreaSqft: parseFloat(document.getElementById('rwh-paved').value) || 0,
        soilPercolation: document.getElementById('rwh-soil').value
      };

      try {
        const res = await fetch('/api/calculate/rwh', {
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

  // 16. Coastal Durability & Exposure Controller
  const durForm = document.getElementById('form-durability');
  if (durForm) {
    durForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        exposureCondition: document.getElementById('dur-exp').value,
        proposedGrade: document.getElementById('dur-grade').value,
        elementType: document.getElementById('dur-elem').value,
        proposedCoverMm: parseFloat(document.getElementById('dur-cover').value),
        waterCementRatio: parseFloat(document.getElementById('dur-wc').value)
      };

      try {
        const res = await fetch('/api/durability/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderDurabilityOutput(data);
      } catch (err) {
        alert(`Durability evaluation error: ${err.message}`);
      }
    });
  }

  // 17. CMDA & GCC Permit Fees
  const feeForm = document.getElementById('form-cmdafee');
  if (feeForm) {
    feeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        plotAreaSqft: parseFloat(document.getElementById('fee-plot').value),
        totalBuiltupSqft: parseFloat(document.getElementById('fee-built').value),
        locationZone: document.getElementById('fee-zone').value,
        estimatedCostPerSqft: parseFloat(document.getElementById('fee-cost').value) || 2400
      };

      try {
        const res = await fetch('/api/planning/cmda-fee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        renderCmdaFeeOutput(data);
      } catch (err) {
        alert(`Permit fee estimation error: ${err.message}`);
      }
    });
  }

  // 18. Flood Plinth & DPC Waterproofing
  const plinthForm = document.getElementById('form-plinth');
  if (plinthForm) {
    plinthForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        plinthAreaSqft: parseFloat(document.getElementById('plinth-area').value),
        plinthHeightAboveRoadMm: parseFloat(document.getElementById('plinth-height').value),
        plinthWallPerimeterM: parseFloat(document.getElementById('plinth-perim').value)
      };

      try {
        const res = await fetch('/api/calculate/plinth', {
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

  // 19. Under-Reamed Pile Sizing
  const pileForm = document.getElementById('form-pile');
  if (pileForm) {
    pileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        columnLoadKn: parseFloat(document.getElementById('pile-load').value),
        pileDiameterMm: parseInt(document.getElementById('pile-dia').value, 10),
        pileLengthM: parseFloat(document.getElementById('pile-depth').value),
        numberOfBulbs: parseInt(document.getElementById('pile-bulbs').value, 10),
        cohesionCpkN: parseFloat(document.getElementById('pile-cohesion').value)
      };

      try {
        const res = await fetch('/api/calculate/pile', {
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

function renderRwhOutput(data) {
  const box = document.getElementById('output-rwh');
  if (!box) return;
  box.style.display = 'block';

  document.getElementById('rwh-out-annual').textContent = `${data.annualPotentialLitres.toLocaleString('en-IN')} Litres/Year`;

  const tbody = document.getElementById('rwh-out-tbody');
  tbody.innerHTML = `
    <tr><td>Rooftop Catchment Yield:</td><td><strong>${data.annualRoofLitres.toLocaleString('en-IN')} L/year</strong> (85% runoff)</td></tr>
    <tr><td>Paved Driveway Yield:</td><td><strong>${data.annualPavedLitres.toLocaleString('en-IN')} L/year</strong> (60% runoff)</td></tr>
    <tr><td>Single Storm (25mm) Recharge:</td><td><strong>${data.peakStormLitres.toLocaleString('en-IN')} Litres</strong></td></tr>
    <tr><td>First-Flush Separator:</td><td><strong>${data.firstFlushLitres} Litres</strong></td></tr>
    <tr><td>Percolation Pits Required:</td><td><strong style="color:#1e40af; font-size:1.1rem;">${data.percolationSystem.numberOfPits} No(s)</strong> (${data.percolationSystem.pitDimensions.lengthM}m × ${data.percolationSystem.pitDimensions.widthM}m × ${data.percolationSystem.pitDimensions.depthM}m)</td></tr>
    <tr><td>Recharge Bore Details:</td><td><strong>${data.percolationSystem.rechargeBore.depthM}m depth</strong> (${data.percolationSystem.rechargeBore.casingType})</td></tr>
    <tr><td>Filter Packing Per Pit:</td><td>40mm Aggregate: ${data.percolationSystem.filterMediaPerPit.blueMetal40mmM3} m³, Coarse Gravel: ${data.percolationSystem.filterMediaPerPit.gravelCoarseM3} m³, Sand: ${data.percolationSystem.filterMediaPerPit.coarseSandM3} m³</td></tr>
    <tr><td>Recommended Storage Sump:</td><td><strong>${data.recommendedStorageSumpLitres.toLocaleString('en-IN')} Litres</strong></td></tr>
  `;

  const ol = document.getElementById('rwh-out-steps');
  if (ol) ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderDurabilityOutput(data) {
  const box = document.getElementById('output-durability');
  if (!box) return;
  box.style.display = 'block';

  const badge = document.getElementById('dur-out-badge');
  if (badge) {
    badge.textContent = data.complianceStatus === 'DURABILITY_COMPLIANT' ? 'IS 456 COMPLIANT' : 'CORROSION RISK DEFICIT';
    badge.className = `badge ${data.complianceStatus === 'DURABILITY_COMPLIANT' ? 'badge-green' : 'badge-red'}`;
  }

  document.getElementById('dur-out-verdict').textContent = data.verdict;

  const s = data.specifications;
  const tbody = document.getElementById('dur-out-tbody');
  tbody.innerHTML = `
    <tr><td>Exposure Environment:</td><td><strong>${data.exposureCategory}</strong></td></tr>
    <tr><td>Concrete Grade:</td><td>Proposed: <strong>${s.proposedConcreteGrade}</strong> (Mandatory Minimum: <strong>${s.minimumConcreteGrade}</strong>)</td></tr>
    <tr><td>Nominal Clear Cover:</td><td>Proposed: <strong>${s.proposedNominalCoverMm} mm</strong> (Mandatory Minimum: <strong>${s.mandatoryNominalCoverMm} mm</strong>)</td></tr>
    <tr><td>Max Water-Cement Ratio:</td><td>Proposed: <strong>${s.proposedWaterCementRatio}</strong> (Max Limit: <strong>${s.maximumWaterCementRatio}</strong>)</td></tr>
    <tr><td>Minimum Cement Content:</td><td><strong>${s.minimumCementContentKgM3} kg/m³</strong></td></tr>
    <tr><td>Recommended Rebar Metallurgy:</td><td><strong style="color:#1e40af;">${s.rebarSpecification}</strong></td></tr>
  `;

  const warnBox = document.getElementById('dur-warnings-box');
  const warnList = document.getElementById('dur-warnings-list');
  if (data.warnings && data.warnings.length > 0) {
    if (warnBox) warnBox.style.display = 'block';
    if (warnList) warnList.innerHTML = data.warnings.map(w => `<li>${w}</li>`).join('');
  } else {
    if (warnBox) warnBox.style.display = 'none';
  }
}

function renderCmdaFeeOutput(data) {
  const box = document.getElementById('output-cmdafee');
  if (!box) return;
  box.style.display = 'block';

  document.getElementById('fee-out-total').textContent = data.formattedTotalStatutoryAmount;

  const b = data.feeBreakdown;
  const tbody = document.getElementById('fee-out-tbody');
  tbody.innerHTML = `
    <tr><td>Jurisdiction:</td><td><strong>${data.jurisdiction}</strong></td></tr>
    <tr><td>1. Scrutiny Fee:</td><td><strong>${b.scrutinyFee.formatted}</strong></td></tr>
    <tr><td>2. Development Charges:</td><td><strong>${b.developmentCharges.formatted}</strong> (Land: ₹${b.developmentCharges.landComponent.toLocaleString('en-IN')}, Building: ₹${b.developmentCharges.buildingComponent.toLocaleString('en-IN')})</td></tr>
    <tr><td>3. I&A Amenities Charges:</td><td><strong>${b.iaCharges.formatted}</strong></td></tr>
    <tr><td>4. 1% BOCW Workers Welfare Cess:</td><td><strong style="color:#1e40af;">${b.labourWelfareCess1Pct.formatted}</strong> (on ₹${b.labourWelfareCess1Pct.estimatedBuildingCost.toLocaleString('en-IN')} estimated construction)</td></tr>
    <tr><td>5. Local Body License & Debris:</td><td><strong>${b.localBodyLicenseAndDebris.formatted}</strong> (License: ₹${b.localBodyLicenseAndDebris.licenseFee}, Debris: ₹${b.localBodyLicenseAndDebris.debrisRemoval}, RWH Refundable: ₹${b.localBodyLicenseAndDebris.rwhRefundableDeposit})</td></tr>
  `;

  const ol = document.getElementById('fee-out-steps');
  if (ol) ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderPlinthOutput(data) {
  const box = document.getElementById('output-plinth');
  if (!box) return;
  box.style.display = 'block';

  const badge = document.getElementById('plinth-out-badge');
  if (badge) {
    badge.textContent = data.plinthLevelStatus === 'COMPLIANT_POST_MICHAUNG_STANDARD' ? 'POST-MICHAUNG SAFE' : 'FLOOD RISK DETECTED';
    badge.className = `badge ${data.plinthLevelStatus === 'COMPLIANT_POST_MICHAUNG_STANDARD' ? 'badge-green' : 'badge-red'}`;
  }

  document.getElementById('plinth-out-moorum').textContent = `${data.fillMaterials.looseMoorumM3} m³ (${data.fillMaterials.moorumTnUnits} TN Units)`;

  const f = data.fillMaterials;
  const d = data.dpc;
  const tbody = document.getElementById('plinth-out-tbody');
  tbody.innerHTML = `
    <tr><td>Plinth Height Above Road Crown:</td><td><strong>+${data.plinthHeightMm} mm</strong> (${(data.plinthHeightMm / 304.8).toFixed(2)} ft — Min Norm: +${data.minRecommendedHeightMm} mm)</td></tr>
    <tr><td>Compacted Moorum Fill:</td><td>Net: <strong>${f.compactedMoorumM3} m³</strong> => Loose Quarry Moorum Required: <strong>${f.looseMoorumM3} m³ (${f.moorumCft} cft / ${f.moorumTnUnits} Units)</strong></td></tr>
    <tr><td>Sand Cushion Bedding (100mm):</td><td><strong>${f.sandCushionM3} m³ (${f.sandCft} cft / ${f.sandTnUnits} Units)</strong></td></tr>
    <tr><td>DPC 50mm (1:2:4 Bed):</td><td>Area: <strong>${d.surfaceAreaM2} m²</strong> (${d.linearLengthM}m linear run)</td></tr>
    <tr><td>DPC Cement & Admixture:</td><td><strong>${d.cementBags} Bags Cement</strong> + <strong style="color:#1e40af;">${d.waterproofingAdmixtureLitres} Litres Waterproofing Compound</strong> (200ml/bag)</td></tr>
    <tr><td>DPC Sand & 12mm Blue Metal:</td><td>Sand: <strong>${d.sandCft} cft</strong>, 12mm Aggregate: <strong>${d.blueMetal12mmCft} cft</strong></td></tr>
    <tr><td>Hot Bitumen Sealing Coat:</td><td><strong>${d.bitumenSealerKg} kg Bitumen (85/25 Grade)</strong></td></tr>
  `;

  const warnBox = document.getElementById('plinth-warnings-box');
  const warnList = document.getElementById('plinth-warnings-list');
  if (data.warnings && data.warnings.length > 0) {
    if (warnBox) warnBox.style.display = 'block';
    if (warnList) warnList.innerHTML = data.warnings.map(w => `<li>${w}</li>`).join('');
  } else {
    if (warnBox) warnBox.style.display = 'none';
  }

  const ol = document.getElementById('plinth-out-steps');
  if (ol) ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderPileOutput(data) {
  const box = document.getElementById('output-pile');
  if (!box) return;
  box.style.display = 'block';

  document.getElementById('pile-out-safe').textContent = `${data.capacity.safeWorkingCapacityKn} kN`;

  const p = data.pileDimensions;
  const g = data.pileGroup;
  const m = data.materialPerPile;
  const tbody = document.getElementById('pile-out-tbody');
  tbody.innerHTML = `
    <tr><td>Service Column Axial Load:</td><td><strong>${data.serviceLoadKn} kN</strong></td></tr>
    <tr><td>Pile Dimensions:</td><td>Shaft Dia: <strong>${p.shaftDiameterMm} mm</strong>, Bulb Dia: <strong>${p.bulbDiameterMm} mm</strong> (2.5D), Embedment: <strong>${p.depthM} m</strong></td></tr>
    <tr><td>Safe Capacity per Pile (FOS 2.5):</td><td><strong style="color:#16a34a; font-size:1.1rem;">${data.capacity.safeWorkingCapacityKn} kN</strong> (Ultimate: ${data.capacity.ultimateCapacityKn} kN)</td></tr>
    <tr><td>Piles Required per Column:</td><td><strong style="color:#1e40af; font-size:1.1rem;">${g.pilesRequiredCount} No(s)</strong> (${g.pileCapType} — Total Safe Capacity: ${g.totalGroupSafeCapacityKn} kN)</td></tr>
    <tr><td>Concrete Volume per Pile:</td><td><strong>${m.concreteVolumeM3} m³</strong></td></tr>
    <tr><td>Rebar Cage per Pile:</td><td>Main: <strong>${m.mainRebar}</strong>, Rings: <strong>${m.lateralTies}</strong> (${m.steelWeightKg} kg steel)</td></tr>
  `;

  const ol = document.getElementById('pile-out-steps');
  if (ol) ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderGeotechOutput(data) {
  const box = document.getElementById('output-geotech');
  if (!box) return;
  box.style.display = 'block';

  document.getElementById('geo-out-dims').textContent = `${data.footingDimensions.lengthM}m × ${data.footingDimensions.widthM}m × ${data.footingDimensions.overallDepthMm}mm`;

  const tbody = document.getElementById('geo-out-tbody');
  tbody.innerHTML = `
    <tr><td>Service Column Axial Load:</td><td><strong>${data.serviceLoadKn} kN</strong> (Design base load: ${(data.serviceLoadKn * 1.1).toFixed(1)} kN incl. 10% self-wt)</td></tr>
    <tr><td>Soil Safe Bearing Capacity (SBC):</td><td><strong>${data.sbcKnm2} kN/m²</strong></td></tr>
    <tr><td>Footing Plan Dimensions:</td><td><strong>${data.footingDimensions.lengthM}m × ${data.footingDimensions.widthM}m</strong> (${data.footingDimensions.footingAreaM2} m² / ${(data.footingDimensions.footingAreaM2 * 10.7639).toFixed(1)} sq.ft)</td></tr>
    <tr><td>Actual Service Soil Pressure:</td><td><strong>${data.pressures.servicePressureKnm2} kN/m²</strong> (${data.isSafe ? '✅ SAFE <= SBC' : '❌ UNSAFE > SBC'})</td></tr>
    <tr><td>Overall Footing Depth (D):</td><td><strong>${data.footingDimensions.overallDepthMm} mm</strong> (Effective depth d = ${data.footingDimensions.effectiveDepthMm}mm, Cover = ${data.footingDimensions.clearCoverMm}mm)</td></tr>
    <tr><td>Critical Bending Moment (Mu):</td><td><strong>${data.bendingMomentKnM} kN·m</strong></td></tr>
    <tr><td>Bottom Reinforcement Mesh:</td><td><strong style="color:#1e40af;">${data.reinforcement.description}</strong> (Ast: ${data.reinforcement.astRequiredMm2} mm²)</td></tr>
    <tr><td>Concrete Volume:</td><td><strong>${data.concreteVolumeM3} m³</strong></td></tr>
  `;

  const ol = document.getElementById('geo-out-steps');
  if (ol) ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
  const disc = document.getElementById('geo-out-disclaimer');
  if (disc) disc.textContent = data.disclaimer;
}

function renderQcOutput(data) {
  const box = document.getElementById('output-qc');
  if (!box) return;
  box.style.display = 'block';

  const badge = document.getElementById('qc-out-badge');
  if (badge) {
    badge.textContent = data.resultStatus;
    badge.className = `badge ${data.resultStatus === 'PASS' ? 'badge-green' : (data.resultStatus === 'MARGINAL_VARIATION' ? 'badge-yellow' : 'badge-red')}`;
  }

  document.getElementById('qc-out-avg').textContent = `${data.averageStrengthNmm2} N/mm²`;

  const tbody = document.getElementById('qc-out-tbody');
  tbody.innerHTML = `
    <tr><td>Tested Member:</td><td><strong>${data.elementTested}</strong> (${data.grade} Grade, ${data.testAgeDays}-Day Test)</td></tr>
    <tr><td>Target Threshold Strength:</td><td><strong>${data.targetStrengthNmm2} N/mm²</strong> (${data.testAgeDays === 7 ? '67% of fck' : '100% of fck'})</td></tr>
    <tr><td>Average Compressive Strength:</td><td><strong style="color:${data.isStrengthAchieved ? '#16a34a' : '#dc2626'};">${data.averageStrengthNmm2} N/mm²</strong> (${data.percentOfFckAchieved}% of ${data.characteristicStrengthFck} N/mm²)</td></tr>
    <tr><td>Statistical Cube Variation (±15% limit):</td><td><strong>${data.isVariationWithin15Percent ? '✅ Compliant (All cubes within ±15%)' : '⚠️ Non-compliant (Variation exceeds ±15%)'}</strong></td></tr>
    <tr><td>Cube #1:</td><td>Breaking Load: ${data.specimens[0].breakingLoadKn} kN => Strength: <strong>${data.specimens[0].compressiveStrengthNmm2} N/mm²</strong> (Dev: ${data.specimens[0].percentageDeviation}%)</td></tr>
    <tr><td>Cube #2:</td><td>Breaking Load: ${data.specimens[1].breakingLoadKn} kN => Strength: <strong>${data.specimens[1].compressiveStrengthNmm2} N/mm²</strong> (Dev: ${data.specimens[1].percentageDeviation}%)</td></tr>
    <tr><td>Cube #3:</td><td>Breaking Load: ${data.specimens[2].breakingLoadKn} kN => Strength: <strong>${data.specimens[2].compressiveStrengthNmm2} N/mm²</strong> (Dev: ${data.specimens[2].percentageDeviation}%)</td></tr>
    <tr><td>IS 456 Acceptance Remarks:</td><td><em>${data.remarks}</em></td></tr>
  `;

  const ol = document.getElementById('qc-out-steps');
  if (ol) ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderAntiTermiteOutput(data) {
  const box = document.getElementById('output-antitermite');
  if (!box) return;
  box.style.display = 'block';

  document.getElementById('anti-out-litres').textContent = `${data.totalEmulsionLitres} Litres`;

  const tbody = document.getElementById('anti-out-tbody');
  tbody.innerHTML = `
    <tr><td>Chemical Spec:</td><td><strong>${data.chemicalName}</strong></td></tr>
    <tr><td>Concentrated Chemical Required:</td><td><strong style="color:#1e40af; font-size:1.1rem;">${data.concentratedChemicalLitres} Litres</strong> (~<strong>${data.cans5LitreRequired} Cans</strong> of 5 Litre pack)</td></tr>
    <tr><td>Water for Dilution:</td><td><strong>${data.waterLitresRequired} Litres</strong></td></tr>
    <tr><td>Stage 1 (Trench Bed & Sides):</td><td>${data.stagesLitres.stage1Trench} Litres (5.0 L/m²)</td></tr>
    <tr><td>Stage 2 (Refilled Backfill Soil):</td><td>${data.stagesLitres.stage2Backfill} Litres (7.5 L/m²)</td></tr>
    <tr><td>Stage 3 (Plinth Floor Sub-base):</td><td>${data.stagesLitres.stage3PlinthBed} Litres (5.0 L/m²)</td></tr>
    <tr><td>Stage 4 (External Perimeter Barrier):</td><td>${data.stagesLitres.stage4Perimeter} Litres (7.5 L/linear meter)</td></tr>
  `;

  const ol = document.getElementById('anti-out-steps');
  if (ol) ol.innerHTML = (data.calculationSteps || []).map(s => `<li>${s}</li>`).join('');
}

function renderTncdbrOutput(data) {
  const box = document.getElementById('output-tncdbr');
  if (!box) return;
  box.style.display = 'block';

  const badge = document.getElementById('tn-out-badge');
  if (badge) {
    badge.textContent = data.isCompliant ? 'APPROVED COMPLIANT' : 'PLAN VIOLATIONS DETECTED';
    badge.className = `badge ${data.isCompliant ? 'badge-green' : 'badge-red'}`;
  }

  const m = data.metrics;
  const tbody = document.getElementById('tn-out-tbody');
  tbody.innerHTML = `
    <tr><td>Verdict:</td><td><strong>${data.verdict}</strong></td></tr>
    <tr><td>Plot Area & Road Width:</td><td><strong>${m.plotAreaSqft} sq.ft</strong> (${(m.plotAreaSqft / 2400).toFixed(2)} Grounds) on <strong>${m.roadWidthM}m Street</strong></td></tr>
    <tr><td>Plot Coverage (Max 70%):</td><td>Proposed: <strong>${m.plotCoverage.proposedPct}%</strong> (${m.plotCoverage.isPass ? '✅ PASS' : '❌ VIOLATION > 70%'})</td></tr>
    <tr><td>Floor Space Index (FSI):</td><td>Permissible: <strong>${m.fsi.permissibleFsi}</strong> | Proposed: <strong>${m.fsi.proposedFsi}</strong> (${m.fsi.isPass ? '✅ PASS' : '❌ EXCEEDED'})</td></tr>
    <tr><td>Front Setback:</td><td>Min Req: ${m.setbacks.front.requiredM}m | Proposed: <strong>${m.setbacks.front.proposedM}m</strong> (${m.setbacks.front.isPass ? '✅ PASS' : '❌ VIOLATION'})</td></tr>
    <tr><td>Rear Setback:</td><td>Min Req: ${m.setbacks.rear.requiredM}m | Proposed: <strong>${m.setbacks.rear.proposedM}m</strong> (${m.setbacks.rear.isPass ? '✅ PASS' : '❌ VIOLATION'})</td></tr>
    <tr><td>Side Setbacks (Sides 1 & 2):</td><td>Min Req: ${m.setbacks.side1.requiredM}m | Proposed: <strong>${m.setbacks.side1.proposedM}m & ${m.setbacks.side2.proposedM}m</strong> (${(m.setbacks.side1.isPass && m.setbacks.side2.isPass) ? '✅ PASS' : '❌ VIOLATION'})</td></tr>
  `;

  const violBox = document.getElementById('tn-violations-box');
  const violList = document.getElementById('tn-violations-list');
  if (data.violations && data.violations.length > 0) {
    if (violBox) violBox.style.display = 'block';
    if (violList) violList.innerHTML = data.violations.map(v => `<li>${v}</li>`).join('');
  } else {
    if (violBox) violBox.style.display = 'none';
  }
}

function renderMBookOutput(data, desc) {
  const box = document.getElementById('output-mbook');
  if (!box) return;
  box.style.display = 'block';

  document.getElementById('mb-out-qty').textContent = `${data.totalQuantity} m³`;

  const tbody = document.getElementById('mb-out-tbody');
  tbody.innerHTML = `
    <tr><td>Item Description:</td><td><strong>${desc || 'Measured Item'}</strong></td></tr>
    <tr><td>Location:</td><td>${data.entries[0]?.location || '—'}</td></tr>
    <tr><td>Measurement Formula:</td><td>Nos (${data.entries[0]?.nos}) × L (${data.entries[0]?.lengthM}m) × B (${data.entries[0]?.breadthM}m) × D (${data.entries[0]?.depthM}m)</td></tr>
    <tr><td>Total Measured Volume:</td><td><strong style="color:#1e40af; font-size:1.1rem;">${data.totalQuantity} m³</strong></td></tr>
  `;
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
