/**
 * DDevUltraHome — Plan to Budget Client Controller
 * Handles Plan PDF/Image uploads, classification, scale calibration,
 * takeoff dimension editing, draft BOQ generation, BOM procurement,
 * and multi-format export (Excel XML, PDF Print, CSV).
 */

import { apiClient } from './apiClient.js';
import { PlanStudio3D, ReviewState, DimensionProvenance } from './plan/planStudio3D.js';

export class PlanBudgetController {
  constructor() {
    this.sheets = [];
    this.rooms = [];
    this.schedules = [];
    this.currentBoq = null;
    this.currentMaterials = null;
    this.scale = {
      pixelLength: 100,
      realLengthMeters: 1.0,
      pixelsPerMeter: 100.0,
      unit: 'm'
    };
    this.studio3D = new PlanStudio3D();
  }

  init() {
    this.bindUploadEvents();
    this.bindScaleEvents();
    this.bindRoomTableEvents();
    this.bindStudio3DEvents();
    this.bindBoqGenerationEvents();
    this.bindExportEvents();
    this.loadInitialDefaultRooms();

    const canvasEl = document.getElementById('canvas-3d-studio');
    if (canvasEl) {
      this.studio3D.attachCanvas(canvasEl);
      this.studio3D.buildModelFrom2DPlan(this.rooms);
      this.studio3D.render();
    }
  }

  loadInitialDefaultRooms() {
    // Provide baseline standard Tamil Nadu residential 2BHK room layout
    this.rooms = [
      { id: 'rm-1', name: 'Living & Dining Room (வரவேற்பறை)', length: 4.88, width: 3.66, areaM2: 17.86, areaSqft: 192.2, perimeter: 17.08, deductions: 0, status: 'Draft Baseline' },
      { id: 'rm-2', name: 'Master Bedroom (முக்கிய படுக்கையறை)', length: 3.66, width: 3.66, areaM2: 13.40, areaSqft: 144.2, perimeter: 14.64, deductions: 0, status: 'Draft Baseline' },
      { id: 'rm-3', name: 'Bedroom 2 (இரண்டாம் படுக்கையறை)', length: 3.66, width: 3.05, areaM2: 11.16, areaSqft: 120.1, perimeter: 13.42, deductions: 0, status: 'Draft Baseline' },
      { id: 'rm-4', name: 'Kitchen (சமையலறை)', length: 3.05, width: 2.44, areaM2: 7.44, areaSqft: 80.1, perimeter: 10.98, deductions: 0, status: 'Draft Baseline' },
      { id: 'rm-5', name: 'Attached Toilet (கழிப்பறை 1)', length: 2.13, width: 1.52, areaM2: 3.24, areaSqft: 34.9, perimeter: 7.30, deductions: 0, status: 'Draft Baseline' },
      { id: 'rm-6', name: 'Common Toilet (பொது கழிப்பறை 2)', length: 2.13, width: 1.37, areaM2: 2.92, areaSqft: 31.4, perimeter: 7.00, deductions: 0, status: 'Draft Baseline' },
      { id: 'rm-7', name: 'Verandah / Foyer (முகப்பு தாழ்வாரம்)', length: 3.05, width: 1.83, areaM2: 5.58, areaSqft: 60.1, perimeter: 9.76, deductions: 0, status: 'Draft Baseline' },
      { id: 'rm-8', name: 'Staircase Area (மாடிப்படி பகுதி)', length: 4.27, width: 2.13, areaM2: 9.10, areaSqft: 98.0, perimeter: 12.80, deductions: 0, status: 'Draft Baseline' }
    ];
    this.renderRoomsTable();
    this.updateAreaTotals();
  }

  bindUploadEvents() {
    const dropZone = document.getElementById('plan-drop-zone');
    const fileInput = document.getElementById('plan-file-input');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFiles(e.target.files);
      }
    });
  }

  async handleFiles(fileList) {
    const progressContainer = document.getElementById('plan-parsing-progress');
    const progressBar = document.getElementById('plan-progress-bar');
    const progressText = document.getElementById('plan-progress-text');
    const progressPercent = document.getElementById('plan-progress-percent');

    if (progressContainer) progressContainer.style.display = 'block';

    const files = Array.from(fileList);
    let completed = 0;

    for (const file of files) {
      if (progressText) progressText.textContent = `ஆய்வு செய்கிறது: ${file.name}...`;
      
      try {
        const base64Data = await this.readFileAsBase64(file);
        
        // Post to plan parsing API (dispatches in-process if offline/Capacitor)
        const response = await apiClient.request('/api/plan-budget/parse-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            fileBase64: base64Data
          })
        });

        const result = await response.json();
        if (result.success) {
          const detectedSheets = result.sheets || [];
          if (detectedSheets.length > 0) {
            this.sheets.push(...detectedSheets);
          } else {
            this.sheets.push({
              sheetId: `sheet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              classification: result.classification || 'Floor Plan / தரைத்தள வரைபடம்',
              extractedTextCount: result.rawTextCount || 0,
              confidence: result.classificationConfidence || 'Medium'
            });
          }

          // If structural schedules were found, save them
          if (Array.isArray(result.schedules) && result.schedules.length > 0) {
            this.schedules.push(...result.schedules);
            const colCountInput = document.getElementById('plan-columns-count');
            if (colCountInput && result.schedules.length >= 4) {
              colCountInput.value = result.schedules.length;
            }
          }

          // Load extracted rooms if found
          if (Array.isArray(result.rooms) && result.rooms.length > 0) {
            this.rooms = result.rooms;
            this.renderRoomsTable();
            this.updateAreaTotals();
            this.studio3D.buildModelFrom2DPlan(this.rooms);
            this.studio3D.render();
          }

          // Update Project Name and Floors Count if extracted
          if (result.projectName) {
            const projNameInput = document.getElementById('plan-proj-name');
            if (projNameInput) projNameInput.value = result.projectName;
          }
          if (result.totalPages > 1) {
            const floorsInput = document.getElementById('plan-floors-count');
            if (floorsInput) floorsInput.value = Math.min(3, result.totalPages);
          }

          // Display Inspection Panel & CAD Restrictions
          const inspPanel = document.getElementById('plan-inspection-panel');
          if (inspPanel) inspPanel.style.display = 'block';

          const sheetTitleEl = document.getElementById('inspected-sheet-title');
          if (sheetTitleEl) {
            sheetTitleEl.textContent = result.sheets?.[0]?.sheetTitle || result.fileName || file.name;
          }

          const cadConfidenceBadge = document.getElementById('cad-confidence-badge');
          if (cadConfidenceBadge) {
            cadConfidenceBadge.textContent = result.hasSelectableText
              ? 'கண்டறிதல் உறுதி: 98% (Native CAD Vector Text)'
              : 'கண்டறிதல்: OCR / Scanned Detection';
          }

          const cadAlert = document.getElementById('cad-restrictions-alert');
          if (cadAlert) {
            if (result.scaleRestrictions?.doNotScale) {
              cadAlert.style.display = 'block';
              this.updateReviewGate(ReviewState.NEEDS_INPUT);
            } else {
              cadAlert.style.display = 'none';
            }
          }

          const archBox = document.getElementById('architect-details-box');
          if (archBox && (result.architectDetails || result.projectName)) {
            archBox.innerHTML = `<strong>Architect:</strong> ${result.architectDetails || 'J-angle studio, Chennai'}<br><strong>Project:</strong> ${result.projectName || file.name}`;
          }

          const cadNotesList = document.getElementById('cad-notes-list');
          if (cadNotesList && Array.isArray(result.cadNotes) && result.cadNotes.length > 0) {
            cadNotesList.innerHTML = result.cadNotes.map(n => `<div style="margin-bottom: 4px;">• ${n}</div>`).join('');
          }

          const schematicBox = document.getElementById('plan-schematic-preview');
          if (schematicBox && Array.isArray(result.rooms)) {
            schematicBox.innerHTML = result.rooms.map(r => `
              <div style="background: var(--bg-surface); padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                <span><strong>${r.name}</strong> ${r.floor ? `(${r.floor})` : ''}</span>
                <span style="color: var(--accent); font-weight: 700;">${r.length}m × ${r.width}m (${r.areaSqft} sqft)</span>
              </div>
            `).join('');
          }
        }
      } catch (err) {
        console.warn('Backend parsing fallback to local preview:', err);
        this.sheets.push({
          sheetId: `sheet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          classification: file.name.toLowerCase().includes('struct') ? 'Structural Schedule' : 'Floor Plan',
          extractedTextCount: 0,
          confidence: 'Local Preview'
        });
      }

      completed++;
      const pct = Math.round((completed / files.length) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPercent) progressPercent.textContent = `${pct}%`;
    }

    if (progressContainer) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
      }, 1000);
    }

    this.renderSheetsList();
  }

  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result;
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  renderSheetsList() {
    const container = document.getElementById('plan-sheet-list-container');
    const wrapper = document.getElementById('plan-sheets-wrapper');
    if (!container || !wrapper) return;

    if (this.sheets.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    wrapper.innerHTML = this.sheets.map((sheet, idx) => `
      <div class="plan-sheet-card" data-sheet-id="${sheet.sheetId || idx}">
        <div class="plan-sheet-info">
          <div class="plan-sheet-icon">📄</div>
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${sheet.name || `Sheet ${idx + 1}`}</div>
            <div class="plan-sheet-meta">பக்கம்: ${sheet.pageNumber || 1} • கண்டறிதல்: <span class="badge badge-teal">${sheet.confidence || 'Detected'}</span></div>
          </div>
        </div>
        <div class="plan-sheet-controls">
          <select class="form-control sheet-type-select" style="max-width: 220px; font-size: 0.82rem;" data-sheet-idx="${idx}">
            <option value="Floor Plan" ${sheet.classification?.includes('Floor') ? 'selected' : ''}>தரைத்தள வரைபடம் (Floor Plan)</option>
            <option value="Structural Foundation" ${sheet.classification?.includes('Foundation') ? 'selected' : ''}>அடித்தள கட்டமைப்பு (Foundation)</option>
            <option value="Column / Beam Schedule" ${sheet.classification?.includes('Column') || sheet.classification?.includes('Beam') ? 'selected' : ''}>தூண் / பீம் அட்டவணை (Schedule)</option>
            <option value="Elevation & Section" ${sheet.classification?.includes('Elevation') ? 'selected' : ''}>முகப்பு தோற்றம் (Elevation)</option>
            <option value="Site Plan" ${sheet.classification?.includes('Site') ? 'selected' : ''}>மனை வரைபடம் (Site Plan)</option>
          </select>
          <button type="button" class="btn btn-secondary btn-sm remove-sheet-btn" data-sheet-idx="${idx}" title="Remove Sheet">✕</button>
        </div>
      </div>
    `).join('');

    wrapper.querySelectorAll('.sheet-type-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-sheet-idx'));
        if (this.sheets[idx]) this.sheets[idx].classification = e.target.value;
      });
    });

    wrapper.querySelectorAll('.remove-sheet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.getAttribute('data-sheet-idx'));
        this.sheets.splice(idx, 1);
        this.renderSheetsList();
      });
    });
  }

  bindScaleEvents() {
    const presetSelect = document.getElementById('scale-preset-select');
    const realLenInput = document.getElementById('scale-real-len');
    const realUnitSelect = document.getElementById('scale-real-unit');
    const displayEl = document.getElementById('scale-display-text');

    const updateScale = () => {
      const realLen = parseFloat(realLenInput?.value) || 0.90;
      const unit = realUnitSelect?.value || 'm';
      const realMeters = unit === 'ft' ? realLen * 0.3048 : realLen;
      
      // Standard calibrated pixels (assume ~90 pixels for standard door opening)
      const pixelLength = presetSelect?.value === 'grid' ? 300 : 90;
      const pxPerM = Math.round((pixelLength / realMeters) * 100) / 100;
      const pxPerFt = Math.round((pxPerM * 0.3048) * 100) / 100;

      this.scale = { pixelLength, realLengthMeters: realMeters, pixelsPerMeter: pxPerM, unit };
      if (displayEl) {
        displayEl.textContent = `${pxPerM} px / m (${pxPerFt} px / ft)`;
      }
    };

    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        if (e.target.value === 'door') {
          if (realLenInput) realLenInput.value = '0.90';
          if (realUnitSelect) realUnitSelect.value = 'm';
        } else if (e.target.value === 'grid') {
          if (realLenInput) realLenInput.value = '3.00';
          if (realUnitSelect) realUnitSelect.value = 'm';
        }
        updateScale();
      });
    }

    if (realLenInput) realLenInput.addEventListener('input', updateScale);
    if (realUnitSelect) realUnitSelect.addEventListener('change', updateScale);
  }

  bindRoomTableEvents() {
    const addRoomBtn = document.getElementById('btn-add-custom-room');
    if (addRoomBtn) {
      addRoomBtn.addEventListener('click', () => {
        const newId = `rm-${Date.now()}`;
        this.rooms.push({
          id: newId,
          name: 'புதிய அறை / Space',
          length: 3.00,
          width: 3.00,
          areaM2: 9.00,
          areaSqft: 96.9,
          perimeter: 12.00,
          deductions: 0,
          status: 'Manual'
        });
        this.renderRoomsTable();
        this.updateAreaTotals();
        this.studio3D.buildModelFrom2DPlan(this.rooms);
        this.studio3D.render();
      });
    }
  }

  renderRoomsTable() {
    const tbody = document.getElementById('takeoff-rooms-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.rooms.map((rm, idx) => `
      <tr data-room-id="${rm.id || idx}">
        <td>
          <input type="text" class="form-control rm-name-input" value="${rm.name}" data-idx="${idx}" style="min-width: 170px; font-size: 0.85rem;">
        </td>
        <td>
          <input type="number" step="0.01" class="form-control rm-len-input" value="${rm.length}" data-idx="${idx}" style="max-width: 85px; font-size: 0.85rem;">
        </td>
        <td>
          <input type="number" step="0.01" class="form-control rm-width-input" value="${rm.width}" data-idx="${idx}" style="max-width: 85px; font-size: 0.85rem;">
        </td>
        <td class="rm-area-m2" style="font-weight: 700; color: var(--accent);">${rm.areaM2}</td>
        <td class="rm-area-sqft">${rm.areaSqft}</td>
        <td class="rm-perim">${rm.perimeter}</td>
        <td>
          <input type="number" step="0.01" class="form-control rm-deduct-input" value="${rm.deductions || 0}" data-idx="${idx}" style="max-width: 80px; font-size: 0.85rem;">
        </td>
        <td>
          <span class="badge badge-teal">${rm.status || 'Extracted'}</span>
        </td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm delete-room-btn" data-idx="${idx}" title="Delete Room">🗑️</button>
        </td>
      </tr>
    `).join('');

    // Attach row input listeners
    tbody.querySelectorAll('.rm-name-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (this.rooms[idx]) this.rooms[idx].name = e.target.value;
      });
    });

    const updateRowCalc = (idx) => {
      const r = this.rooms[idx];
      if (!r) return;
      const l = Math.max(0, parseFloat(r.length) || 0);
      const w = Math.max(0, parseFloat(r.width) || 0);
      const d = Math.max(0, parseFloat(r.deductions) || 0);

      r.areaM2 = Math.round(Math.max(0, (l * w) - d) * 100) / 100;
      r.areaSqft = Math.round(r.areaM2 * 10.7639 * 10) / 10;
      r.perimeter = Math.round((2 * (l + w)) * 100) / 100;

      const tr = tbody.querySelector(`tr[data-room-id="${r.id || idx}"]`);
      if (tr) {
        const m2Cell = tr.querySelector('.rm-area-m2');
        const sqftCell = tr.querySelector('.rm-area-sqft');
        const perimCell = tr.querySelector('.rm-perim');
        if (m2Cell) m2Cell.textContent = r.areaM2;
        if (sqftCell) sqftCell.textContent = r.areaSqft;
        if (perimCell) perimCell.textContent = r.perimeter;
      }
      this.updateAreaTotals();
      this.studio3D.buildModelFrom2DPlan(this.rooms);
      this.studio3D.render();
    };

    tbody.querySelectorAll('.rm-len-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (this.rooms[idx]) {
          this.rooms[idx].length = parseFloat(e.target.value) || 0;
          this.rooms[idx].status = 'Adjusted';
          updateRowCalc(idx);
        }
      });
    });

    tbody.querySelectorAll('.rm-width-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (this.rooms[idx]) {
          this.rooms[idx].width = parseFloat(e.target.value) || 0;
          this.rooms[idx].status = 'Adjusted';
          updateRowCalc(idx);
        }
      });
    });

    tbody.querySelectorAll('.rm-deduct-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (this.rooms[idx]) {
          this.rooms[idx].deductions = parseFloat(e.target.value) || 0;
          updateRowCalc(idx);
        }
      });
    });

    tbody.querySelectorAll('.delete-room-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.getAttribute('data-idx'));
        this.rooms.splice(idx, 1);
        this.renderRoomsTable();
        this.updateAreaTotals();
        this.studio3D.buildModelFrom2DPlan(this.rooms);
        this.studio3D.render();
      });
    });
  }

  updateAreaTotals() {
    let totalSqft = 0;
    let totalM2 = 0;
    for (const rm of this.rooms) {
      totalSqft += Number(rm.areaSqft) || 0;
      totalM2 += Number(rm.areaM2) || 0;
    }

    totalSqft = Math.round(totalSqft * 10) / 10;
    totalM2 = Math.round(totalM2 * 100) / 100;

    const builtupSqft = Math.round(totalSqft * 1.20 * 10) / 10;
    const builtupM2 = Math.round(totalM2 * 1.20 * 100) / 100;

    const carpetSqftEl = document.getElementById('total-carpet-sqft');
    const carpetM2El = document.getElementById('total-carpet-m2');
    const builtupSqftEl = document.getElementById('total-builtup-sqft');
    const builtupM2El = document.getElementById('total-builtup-m2');

    if (carpetSqftEl) carpetSqftEl.textContent = totalSqft.toLocaleString('en-IN');
    if (carpetM2El) carpetM2El.textContent = totalM2.toLocaleString('en-IN');
    if (builtupSqftEl) builtupSqftEl.textContent = builtupSqft.toLocaleString('en-IN');
    if (builtupM2El) builtupM2El.textContent = builtupM2.toLocaleString('en-IN');
  }

  updateReviewGate(newState) {
    this.studio3D.setReviewGate(newState, 'User/System Gate Update');
    const gateSelect = document.getElementById('select-review-gate');
    if (gateSelect) gateSelect.value = newState;
    const badge = document.getElementById('review-gate-badge');
    if (badge) {
      badge.textContent = `Gate: ${newState}`;
      if (newState === ReviewState.APPROVED_FOR_ESTIMATION) {
        badge.style.background = '#22c55e';
        badge.style.color = '#fff';
      } else if (newState === ReviewState.NEEDS_INPUT) {
        badge.style.background = '#ef4444';
        badge.style.color = '#fff';
      } else {
        badge.style.background = '#f59e0b';
        badge.style.color = '#000';
      }
    }
    const boqReviewBadge = document.getElementById('boq-review-badge');
    if (boqReviewBadge) {
      boqReviewBadge.textContent = newState === ReviewState.APPROVED_FOR_ESTIMATION
        ? 'Approved for Budget'
        : (newState === ReviewState.NEEDS_INPUT ? 'Needs Manual Input' : 'Draft — Requires Review');
    }
  }

  bindStudio3DEvents() {
    // 1. View Mode Switchers: Dollhouse, 2D Plan, Walkthrough
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-mode') || e.target.getAttribute('data-mode');
        if (mode) {
          this.studio3D.setViewMode(mode);
          document.querySelectorAll('.view-mode-btn').forEach(b => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-secondary');
          });
          e.currentTarget.classList.remove('btn-secondary');
          e.currentTarget.classList.add('btn-primary');
        }
      });
    });

    // 2. Fit to Model
    const fitBtn = document.getElementById('btn-3d-fit');
    if (fitBtn) {
      fitBtn.addEventListener('click', () => {
        this.studio3D.fitToModel();
      });
    }

    const resetBtn = document.getElementById('btn-3d-reset-view');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.studio3D.resetView();
        const slider = document.getElementById('exploded-slider');
        const txt = document.getElementById('exploded-val-text');
        if (slider) slider.value = 0;
        if (txt) txt.textContent = '0.0m';
        document.querySelectorAll('.view-mode-btn').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        const dollhouseBtn = document.getElementById('btn-3d-dollhouse');
        if (dollhouseBtn) {
          dollhouseBtn.classList.remove('btn-secondary');
          dollhouseBtn.classList.add('btn-primary');
        }
        this.studio3D.render();
      });
    }

    const wireBtn = document.getElementById('btn-3d-wireframe');
    if (wireBtn) {
      wireBtn.addEventListener('click', () => {
        this.studio3D.toggleWireframe();
        this.studio3D.render();
      });
    }

    document.querySelectorAll('.active-floor-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const floor = e.target.getAttribute('data-floor');
        this.studio3D.setActiveFloor(floor);
        document.querySelectorAll('.active-floor-btn').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        e.target.classList.remove('btn-secondary');
        e.target.classList.add('btn-primary');
        this.studio3D.render();
      });
    });

    const slider = document.getElementById('exploded-slider');
    const sliderTxt = document.getElementById('exploded-val-text');
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        if (sliderTxt) sliderTxt.textContent = `${val.toFixed(1)}m`;
        this.studio3D.setExplodedView(val);
        this.studio3D.render();
      });
    }

    const gateSelect = document.getElementById('select-review-gate');
    if (gateSelect) {
      gateSelect.addEventListener('change', (e) => {
        this.updateReviewGate(e.target.value);
      });
    }

    const confirmBtn = document.getElementById('btn-confirm-all-dimensions');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.rooms.forEach(r => {
          r.status = 'Confirmed';
          r.provenance = DimensionProvenance.USER_CONFIRMED;
        });
        this.renderRoomsTable();
        this.studio3D.buildModelFrom2DPlan(this.rooms);
        this.updateReviewGate(ReviewState.APPROVED_FOR_ESTIMATION);
        const cadAlert = document.getElementById('cad-restrictions-alert');
        if (cadAlert) {
          cadAlert.style.background = 'rgba(34, 197, 94, 0.1)';
          cadAlert.style.borderLeftColor = '#22c55e';
          cadAlert.innerHTML = '✅ <strong>அனைத்து அளவீடுகளும் சரிபார்க்கப்பட்டு உறுதிப்படுத்தப்பட்டன (All Dimensions Confirmed).</strong>';
        }
        this.studio3D.render();
      });
    }

    const editBtn = document.getElementById('btn-edit-dimensions');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const tbl = document.getElementById('takeoff-rooms-table');
        tbl?.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Close Inspector Card
    const closeInspBtn = document.getElementById('btn-close-inspector');
    if (closeInspBtn) {
      closeInspBtn.addEventListener('click', () => {
        const card = document.getElementById('element-inspector-card');
        if (card) card.style.display = 'none';
      });
    }

    // Attach 3D Raycasting selection listener
    this.studio3D.onElementSelected = (elem) => {
      this.showElementInspector(elem);
    };
  }

  showElementInspector(elem) {
    const card = document.getElementById('element-inspector-card');
    if (!card || !elem) return;

    const badge = document.getElementById('inspector-badge');
    const title = document.getElementById('inspector-title');
    const desc = document.getElementById('inspector-desc');
    const prov = document.getElementById('inspector-provenance');

    if (elem.thicknessM !== undefined) {
      // Wall element
      if (badge) badge.textContent = elem.isExternal ? 'வெளிப்புற சுவர் (External Wall)' : 'உட்புற சுவர் (Internal Partition)';
      if (title) title.textContent = elem.id || 'Wall Element';
      if (desc) desc.textContent = `நீளம்: ${elem.lengthM?.toFixed(2)}m • உயரம்: ${elem.heightM?.toFixed(2)}m • தடிமன்: ${(elem.thicknessM * 1000)?.toFixed(0)}mm • தளம்: ${elem.floor || 'Ground'}`;
      if (prov) prov.textContent = elem.isExternal ? 'Exterior 230mm Masonry' : 'Interior 115mm Partition';
    } else if (elem.areaM2 !== undefined) {
      // Room slab element
      if (badge) badge.textContent = 'அறை தளம் (Room Slab)';
      if (title) title.textContent = elem.name || elem.id || 'Room Area';
      if (desc) desc.textContent = `அளவு: ${elem.lengthM?.toFixed(2)}m x ${elem.widthM?.toFixed(2)}m • பரப்பு: ${elem.areaM2?.toFixed(2)} m² (${elem.areaSqft?.toFixed(1)} sqft)`;
      if (prov) prov.textContent = elem.provenance || 'Architectural CAD Schedule';
    } else {
      if (badge) badge.textContent = 'மாதிரி உறுப்பு (Model Element)';
      if (title) title.textContent = elem.name || elem.id || 'Selected Element';
      if (desc) desc.textContent = `Type: ${elem.type || 'Structure'} • Floor: ${elem.floor || 'Ground'}`;
      if (prov) prov.textContent = 'OpenPlan3D BIM Model';
    }

    card.style.display = 'block';
  }

  bindBoqGenerationEvents() {
    const genBtn = document.getElementById('btn-generate-plan-boq');
    if (!genBtn) return;

    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      genBtn.textContent = '⏳ கணக்கிடுகிறது (Generating BOQ & BOM)...';

      const projName = document.getElementById('plan-proj-name')?.value || 'சென்னை குடியிருப்பு இல்லம்';
      const floorsCount = Number(document.getElementById('plan-floors-count')?.value) || 1;
      const columnsCount = Number(document.getElementById('plan-columns-count')?.value) || 12;
      const footingsCount = Number(document.getElementById('plan-footings-count')?.value) || 12;
      const district = document.getElementById('district-select')?.value || 'Chennai';

      try {
        // 1. Call /api/plan-budget/generate-boq via unified offline dispatcher
        const quantities3D = this.studio3D.computeQuantities();
        const response = await apiClient.request('/api/plan-budget/generate-boq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectName: projName,
            district,
            floorsCount,
            columnsCount,
            footingsCount,
            rooms: this.rooms,
            schedules: this.schedules,
            quantities3D,
            reviewState: this.studio3D.reviewState
          })
        });

        const data = await response.json();
        if (data.success && data.boq) {
          this.currentBoq = data.boq;
          this.renderBoqTable(data.boq);

          // 2. Fetch Procurement BOM via unified offline dispatcher
          const procRes = await apiClient.request('/api/plan-budget/procurement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boqItems: data.boq.items })
          });
          const procData = await procRes.json();
          if (procData.success && procData.materials) {
            this.currentMaterials = procData.materials;
            this.renderProcurementTable(procData.materials);
          }

          // Unhide all result sections
          const boqSection = document.getElementById('boq-results-section');
          const procSection = document.getElementById('procurement-results-section');
          const expSection = document.getElementById('export-actions-section');
          if (boqSection) boqSection.style.display = 'block';
          if (procSection) procSection.style.display = 'block';
          if (expSection) expSection.style.display = 'block';

          // Scroll to BOQ section smoothly
          boqSection?.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) {
        console.error('BOQ Generation Error:', err);
        alert('BOQ கணக்கீட்டில் பிழை ஏற்பட்டது: ' + err.message);
      } finally {
        genBtn.disabled = false;
        genBtn.textContent = '🚀 BOQ & மதிப்பீட்டை உருவாக்கு (Generate Draft BOQ)';
      }
    });
  }

  renderBoqTable(boq) {
    const tbody = document.getElementById('plan-boq-tbody');
    if (!tbody || !boq || !Array.isArray(boq.items)) return;

    tbody.innerHTML = boq.items.map(itm => `
      <tr>
        <td style="font-weight: 700; color: var(--text-secondary);">${itm.itemCode}</td>
        <td><span class="badge badge-teal">${itm.trade}</span></td>
        <td>
          <strong>${itm.description}</strong>
          <div style="font-size: 0.76rem; color: var(--text-muted);">${itm.isCode || ''} • Rate: ₹${itm.unitRate?.toLocaleString('en-IN')}/${itm.unit}</div>
        </td>
        <td style="text-align: center;">${itm.unit}</td>
        <td style="text-align: right; font-weight: 700;">${itm.netQuantity?.toLocaleString('en-IN')}</td>
        <td style="text-align: right;">₹${itm.materialRate?.toLocaleString('en-IN')}</td>
        <td style="text-align: right;">₹${itm.labourRate?.toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-weight: 600;">₹${itm.unitRate?.toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-weight: 700; color: var(--accent);">₹${itm.totalAmount?.toLocaleString('en-IN')}</td>
        <td><span class="draft-review-badge">${itm.reviewStatus || 'Draft'}</span></td>
      </tr>
    `).join('');

    // Update Financials
    const fin = boq.financials || {};
    const dirCostEl = document.getElementById('fin-direct-cost');
    const ovhEl = document.getElementById('fin-overhead');
    const profEl = document.getElementById('fin-profit');
    const contEl = document.getElementById('fin-contingency');
    const preTaxEl = document.getElementById('fin-pretax');
    const gstEl = document.getElementById('fin-gst');
    const grandEl = document.getElementById('fin-grand-total');
    const rateSqftEl = document.getElementById('fin-rate-sqft');
    const rateM2El = document.getElementById('fin-rate-m2');

    if (dirCostEl) dirCostEl.textContent = `₹${(fin.directCostSubtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (ovhEl) ovhEl.textContent = `₹${(fin.overhead?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (profEl) profEl.textContent = `₹${(fin.contractorProfit?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (contEl) contEl.textContent = `₹${(fin.contingency?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (preTaxEl) preTaxEl.textContent = `₹${(fin.preTaxTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (gstEl) gstEl.textContent = `₹${(fin.gst?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (grandEl) grandEl.textContent = `₹${(fin.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (rateSqftEl) rateSqftEl.textContent = `₹${(fin.costPerSqft || 0).toLocaleString('en-IN')}`;
    if (rateM2El) rateM2El.textContent = `₹${(fin.costPerM2 || 0).toLocaleString('en-IN')}`;
  }

  renderProcurementTable(materials) {
    const tbody = document.getElementById('plan-procurement-tbody');
    if (!tbody || !Array.isArray(materials)) return;

    tbody.innerHTML = materials.map(m => `
      <tr>
        <td style="font-weight: 700; color: var(--text-secondary);">${m.materialCode}</td>
        <td><strong>${m.name}</strong></td>
        <td><span class="badge badge-teal">${m.category}</span></td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${m.specification}</td>
        <td style="text-align: right;">${m.theoreticalQuantity?.toLocaleString('en-IN')}</td>
        <td style="text-align: right; color: #b45309; font-weight: 600;">+${m.wastagePercent}%</td>
        <td style="text-align: right; font-weight: 700; color: var(--accent);">${m.orderQuantity?.toLocaleString('en-IN')} ${m.unit}</td>
        <td style="font-size: 0.82rem;">${m.standardPackSize}</td>
        <td style="text-align: right;">₹${m.estimatedRateInr?.toLocaleString('en-IN')}</td>
        <td style="text-align: right; font-weight: 700;">₹${m.totalCostInr?.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');
  }

  bindExportEvents() {
    // 1. Export Multi-Sheet Excel Workbook (.xls XML Spreadsheet)
    const exportExcelBtn = document.getElementById('btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', async () => {
        if (!this.currentBoq) {
          alert('முதலில் BOQ மதிப்பீட்டை உருவாக்கவும் (Please generate BOQ first).');
          return;
        }

        try {
          const res = await apiClient.request('/api/plan-budget/export-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boq: {
                ...this.currentBoq,
                reviewState: this.studio3D.reviewState,
                quantities3D: this.studio3D.computeQuantities()
              },
              materials: this.currentMaterials
            })
          });

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `DDevUltraHome_BOQ_${Date.now()}.xls`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Excel Export Error:', err);
          alert('Excel ஏற்றுமதியில் பிழை ஏற்பட்டது: ' + err.message);
        }
      });
    }

    // 2. Branded PDF Print Report
    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        if (!this.currentBoq) {
          alert('முதலில் BOQ மதிப்பீட்டை உருவாக்கவும் (Please generate BOQ first).');
          return;
        }
        const timeStampEl = document.getElementById('print-timestamp');
        const kolkataTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        if (timeStampEl) {
          timeStampEl.textContent = `அறிக்கை உருவாக்கப்பட்ட தேதி: ${kolkataTime} IST | Review Gate: ${this.studio3D.reviewState} | DDevUltraHome Brand Certification`;
        }
        window.print();
      });
    }

    // 3. Export CSV Procurement List
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', async () => {
        if (!this.currentMaterials || this.currentMaterials.length === 0) {
          alert('முதலில் பொருட்களை உருவாக்கவும் (Please generate procurement list first).');
          return;
        }

        try {
          const res = await apiClient.request('/api/plan-budget/export-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ materials: this.currentMaterials })
          });

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `DDevUltraHome_Material_Procurement_${Date.now()}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('CSV Export Error:', err);
          alert('CSV ஏற்றுமதியில் பிழை ஏற்பட்டது: ' + err.message);
        }
      });
    }

    // 4. Save to Projects DB
    const saveProjBtn = document.getElementById('btn-save-project-plan');
    const saveStatusEl = document.getElementById('plan-save-status');
    if (saveProjBtn) {
      saveProjBtn.addEventListener('click', async () => {
        if (!this.currentBoq) {
          alert('முதலில் BOQ மதிப்பீட்டை உருவாக்கவும்.');
          return;
        }

        try {
          saveProjBtn.disabled = true;
          saveProjBtn.textContent = '💾 சேமிக்கிறது...';

          const projName = document.getElementById('plan-proj-name')?.value || 'சென்னை குடியிருப்பு இல்லம்';
          const district = document.getElementById('district-select')?.value || 'Chennai';

          const response = await apiClient.request('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: projName,
              client_name: 'Plan-to-Budget Client',
              location: `${district}, Tamil Nadu`,
              district,
              builtup_area_sqft: this.currentBoq.buildingProfile?.totalBuiltupAreaSqft || 1200,
              notes: `Generated via DDevUltraHome Plan-to-Budget Engine on ${new Date().toISOString()}`
            })
          });

          const result = await response.json();
          if (result && result.id) {
            // Also save estimate record
            await apiClient.request('/api/estimates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                project_id: result.id,
                module: 'PlanToBudget',
                inputs_json: JSON.stringify({ rooms: this.rooms, schedules: this.schedules }),
                results_json: JSON.stringify(this.currentBoq),
                notes: `Grand Total: ${this.currentBoq.financials?.formattedGrandTotal}`
              })
            });

            if (saveStatusEl) {
              saveStatusEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✅ திட்டம் SQLite தரவுத்தளத்தில் வெற்றிகரமாக சேமிக்கப்பட்டது! (Project ID: ${result.id})</span>`;
            }
          }
        } catch (err) {
          console.error('Project Save Error:', err);
          if (saveStatusEl) {
            saveStatusEl.innerHTML = `<span style="color: var(--danger);">சேமிப்பதில் பிழை: ${err.message}</span>`;
          }
        } finally {
          saveProjBtn.disabled = false;
          saveProjBtn.textContent = '💾 திட்டமாக சேமி (Save to Projects DB)';
        }
      });
    }
  }
}
