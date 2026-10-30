/**
 * DDevUltraHome — Quotations & Estimates Screen
 * Complete quotation engine with line-item builder, Schedule A specifications,
 * Schedule B built-up area & extra work templates, revision versioning,
 * and client-ready watermarked PDF/Print generation.
 */

import { BusinessApi } from '../businessApi.js';
import { deliverPdf, buildQuotationPdf } from '../printDoc.js';

export const QuotationsScreen = {
  cachedClients: [],
  cachedQuotations: [],
  activeQuotation: null,
  currentPrintHtml: '',

  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Quotations & Estimates</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Itemized cost proposals, revisions & watermarked PDF generator</div>
          </div>
          <button id="btn-add-quote" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px;">
            + New Quote
          </button>
        </div>

        <div id="quotations-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading quotations...</div>
        </div>
      </div>

      <!-- Add New Quotation Modal -->
      <div id="modal-new-quotation" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 300; align-items: center; justify-content: center; padding: 12px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 680px; max-height: 92vh; overflow-y: auto; padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border-light); padding-bottom: 10px;">
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--brand-navy-900);">Create Construction Quotation</h3>
              <div style="font-size: 11px; color: var(--text-muted);">Detailed civil cost proposal with Schedule A & B terms</div>
            </div>
            <button id="btn-cancel-quote" class="btn-outline" style="min-height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;" type="button">✕</button>
          </div>

          <!-- Template Quick-Fill Banner -->
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong style="color: #1E40AF; font-size: 12px;">Quick Template: Kundrathur Residence</strong>
              <div style="font-size: 11px; color: #1E3A8A;">Load G+1 Villa (1,531 sqft) + 12 Extra Work line items (₹42,27,400)</div>
            </div>
            <button type="button" id="btn-load-kundrathur-template" class="btn-gold" style="min-height: 32px; padding: 0 12px; font-size: 11px;">
              ⚡ Load Template
            </button>
          </div>

          <form id="form-create-quotation">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Client *</label>
                <select id="sel-quote-client" class="form-control" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">Project (Optional)</label>
                <select id="sel-quote-project" class="form-control"></select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Quotation Title *</label>
              <input type="text" id="inp-quote-title" class="form-control" required placeholder="e.g. Residential Villa Construction — Kundrathur (G+1)">
            </div>

            <!-- Line Items Builder: Stacked Cards (Mobile Friendly, No Table Overflow) -->
            <div style="margin-top: 14px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                  <label class="form-label" style="margin: 0; font-size: 13px; font-weight: 700; color: var(--brand-navy-900);">Itemized Scope of Work</label>
                  <div style="font-size: 11px; color: var(--text-muted);">Stacked line item cards (description, category, unit, qty, rate, amount)</div>
                </div>
                <button type="button" id="btn-add-line-item" class="btn-outline" style="min-height: 30px; font-size: 11px; padding: 0 10px;">
                  + Add Item
                </button>
              </div>

              <div id="quote-items-cards-container" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Populated dynamically with stacked item cards -->
              </div>
            </div>

            <!-- Totals & Taxes Summary -->
            <div style="background: #F8FAFC; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                <span style="color: var(--text-secondary);">Subtotal:</span>
                <strong id="quote-calc-subtotal" style="color: var(--brand-navy-900);">₹0.00</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 6px;">
                <span style="color: var(--text-secondary);">GST / Tax (%):</span>
                <input type="number" id="inp-quote-taxrate" style="width: 70px; padding: 4px 8px; border: 1px solid var(--border-medium); border-radius: 4px; text-align: right;" value="0" min="0" max="28" step="0.5">
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: var(--brand-navy-900); border-top: 1px solid var(--border-medium); padding-top: 6px;">
                <span>Total Quotation:</span>
                <span id="quote-calc-total" style="color: var(--brand-gold-600);">₹0.00</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Terms & Conditions</label>
              <textarea id="inp-quote-terms" class="form-control" rows="3">1. 8-Stage milestone payment schedule as per Schedule B terms.
2. Advance amount is an unearned liability deposit until stage certification.
3. Electricity connection & water charges to be borne by client.
4. Quotation valid for 30 days from date of issue.</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
              <button type="button" id="btn-cancel-quote-2" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Save Quotation</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Printable Document Preview Modal -->
      <div id="modal-quotation-print" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 350; align-items: center; justify-content: center; padding: 12px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 850px; height: 92vh; display: flex; flex-direction: column; overflow: hidden;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: #0B192C; padding: 12px 18px; color: white;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📑</span>
              <strong style="font-size: 14px;">Quotation Document Viewer</strong>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button type="button" id="btn-share-quote" class="btn-primary" style="min-height: 32px; padding: 0 12px; font-size: 12px; font-weight: 700;">
                📤 Share
              </button>
              <button type="button" id="btn-print-frame" class="btn-gold" style="min-height: 32px; padding: 0 12px; font-size: 12px;">
                🖨️ Print / PDF
              </button>
              <button type="button" id="btn-close-print" class="btn-outline" style="min-height: 32px; width: 32px; padding: 0; color: white; border-color: #64748B;">
                ✕
              </button>
            </div>
          </div>
          <iframe id="iframe-quotation-print" style="flex: 1; border: none; width: 100%; height: 100%; background: white;"></iframe>
        </div>
      </div>
    `;

    // Initialize Quotations List and Listeners
    await this.loadQuotations(container);
    this.initModalControls(container);
  },

  async loadQuotations(container) {
    const listEl = container.querySelector('#quotations-list-container');
    try {
      const res = await BusinessApi.request('/quotations');
      const quotations = res.quotations || [];

      if (quotations.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No quotations generated yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ New Quote" to prepare itemized cost proposals.</div>
          </div>
        `;
        return;
      }

      this.cachedQuotations = quotations;

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${quotations.map(q => `
            <div class="quotation-card" data-id="${q.id}" style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; font-weight: 800; color: var(--brand-gold-600); background: var(--brand-gold-50); padding: 2px 6px; border-radius: 4px;">
                      ${q.quotation_number} (Rev ${q.revision_number})
                    </span>
                    <span class="badge-status badge-${(q.status || 'DRAFT').toLowerCase()}">
                      ${q.status}
                    </span>
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 6px;">
                    ${q.title || q.project_name || 'Construction Quotation'}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Client: <strong>${q.client_name || 'Direct Client'}</strong> • ${q.project_name ? `Project: <strong>${q.project_name}</strong>` : 'General Estimate'}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 11px; color: var(--text-muted);">Total Estimate</div>
                  <strong style="font-size: 16px; color: var(--brand-navy-900);">₹${(q.total_amount || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <!-- Action Bar -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-light); gap: 8px; flex-wrap: wrap;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button type="button" class="btn-print-quote btn-outline" data-id="${q.id}" style="min-height: 32px; font-size: 11px; padding: 0 10px;">
                    🖨️ Print / PDF
                  </button>
                  <button type="button" class="btn-revise-quote btn-outline" data-id="${q.id}" style="min-height: 32px; font-size: 11px; padding: 0 10px;">
                    📋 Revise
                  </button>
                  ${q.status === 'DRAFT' ? `
                    <button type="button" class="btn-delete-quote btn-outline" data-id="${q.id}" data-number="${q.quotation_number}" style="min-height: 32px; font-size: 11px; padding: 0 8px; color: #DC2626; border-color: #FCA5A5;">
                      🗑️ Delete Draft
                    </button>
                  ` : ''}
                </div>
                <div>
                  ${q.status === 'DRAFT' ? `
                    <button type="button" class="btn-approve-quote btn-primary" data-id="${q.id}" style="min-height: 32px; font-size: 11px; padding: 0 12px; background: #059669;">
                      ✓ Approve Quote
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Attach card actions
      listEl.querySelectorAll('.btn-print-quote').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const qId = btn.getAttribute('data-id');
          this.openPrintPreview(container, qId);
        });
      });

      listEl.querySelectorAll('.btn-delete-quote').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const qId = btn.getAttribute('data-id');
          const qNum = btn.getAttribute('data-number');
          if (confirm(`Delete draft quotation ${qNum}?`)) {
            try {
              await BusinessApi.request(`/quotations/${qId}`, 'DELETE');
              alert('🗑️ Draft quotation deleted.');
              await this.loadQuotations(container);
            } catch (err) {
              alert('Delete failed: ' + err.message);
            }
          }
        });
      });

      listEl.querySelectorAll('.btn-revise-quote').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const qId = btn.getAttribute('data-id');
          if (confirm('Create a new revision for this quotation?')) {
            try {
              await BusinessApi.request(`/quotations/${qId}/revision`, 'POST');
              await this.loadQuotations(container);
            } catch (err) {
              alert('Revision error: ' + err.message);
            }
          }
        });
      });

      listEl.querySelectorAll('.btn-approve-quote').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const qId = btn.getAttribute('data-id');
          try {
            await BusinessApi.request(`/quotations/${qId}/status`, 'POST', { status: 'APPROVED' });
            await this.loadQuotations(container);
          } catch (err) {
            alert('Approval error: ' + err.message);
          }
        });
      });

    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load quotations: ${e.message}</div>`;
    }
  },

  initModalControls(container) {
    const modal = container.querySelector('#modal-new-quotation');
    const printModal = container.querySelector('#modal-quotation-print');
    const cardsContainer = container.querySelector('#quote-items-cards-container');

    // Open Add Quote Modal
    container.querySelector('#btn-add-quote')?.addEventListener('click', async () => {
      await this.populateDropdowns(container);
      cardsContainer.innerHTML = '';
      this.addLineItem(cardsContainer, {
        description: '',
        category: 'CIVIL',
        unit: 'sqft',
        quantity: 1,
        unitRate: 0,
        totalPrice: 0
      });
      this.recalculateTotals(container);
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-quote')?.addEventListener('click', () => { modal.style.display = 'none'; });
    container.querySelector('#btn-cancel-quote-2')?.addEventListener('click', () => { modal.style.display = 'none'; });

    // Print & Share Modal Controls (Never calls window.print() for quotations)
    container.querySelector('#btn-close-print')?.addEventListener('click', () => { printModal.style.display = 'none'; });

    const handleDeliverQuotationPdf = async () => {
      const quote = this.activeQuotation;
      if (!quote) return;

      try {
        const filename = `${quote.quotation_number || 'Quotation'}.pdf`;
        const pdf = buildQuotationPdf(quote);
        await deliverPdf(filename, pdf, {
          title: `${quote.quotation_number || 'Quotation'} - D DEV ULTRA HOMES`,
          text: `Construction quotation for ${quote.client_name || 'Client'}`,
          dialogTitle: 'Share Quotation PDF'
        });
      } catch (err) {
        alert('Failed to deliver PDF: ' + err.message);
      }
    };

    container.querySelector('#btn-print-frame')?.addEventListener('click', handleDeliverQuotationPdf);
    container.querySelector('#btn-share-quote')?.addEventListener('click', handleDeliverQuotationPdf);

    // Add Line Item Button (Stacked Card)
    container.querySelector('#btn-add-line-item')?.addEventListener('click', () => {
      this.addLineItem(cardsContainer);
      this.recalculateTotals(container);
    });

    // Tax rate change
    container.querySelector('#inp-quote-taxrate')?.addEventListener('input', () => {
      this.recalculateTotals(container);
    });

    // Template Loader: Kundrathur Residence
    container.querySelector('#btn-load-kundrathur-template')?.addEventListener('click', () => {
      container.querySelector('#inp-quote-title').value = 'Residential Building Construction — Kundrathur (G+1 Villa + Headroom)';
      cardsContainer.innerHTML = '';

      const kundrathurItems = [
        { description: 'Ground Floor Built-up Area (723 sqft @ ₹2300/sqft)', category: 'CIVIL', unit: 'sqft', quantity: 723, unitRate: 2300, totalPrice: 1662900 },
        { description: 'First Floor Built-up Area (723 sqft @ ₹2300/sqft)', category: 'CIVIL', unit: 'sqft', quantity: 723, unitRate: 2300, totalPrice: 1662900 },
        { description: 'Headroom Area (85 sqft @ ₹2000/sqft, height 8ft)', category: 'CIVIL', unit: 'sqft', quantity: 85, unitRate: 2000, totalPrice: 170000 },
        { description: 'Septic Tank (10,000 Liters @ ₹20/L)', category: 'CIVIL', unit: 'liters', quantity: 10000, unitRate: 20, totalPrice: 200000 },
        { description: 'Underground Sump (5,000 Liters @ ₹35/L)', category: 'CIVIL', unit: 'liters', quantity: 5000, unitRate: 35, totalPrice: 175000 },
        { description: 'Basement 1ft Extra Height Construction', category: 'CIVIL', unit: 'lumpsum', quantity: 1, unitRate: 70000, totalPrice: 70000 },
        { description: 'Overhead PVC Water Tank 1000 Liters', category: 'PLUMBING', unit: 'nos', quantity: 1, unitRate: 8000, totalPrice: 8000 },
        { description: 'Weathering Course Cooling Tiles (Anuj, 638 sqft @ ₹200)', category: 'FINISHING', unit: 'sqft', quantity: 638, unitRate: 200, totalPrice: 127600 },
        { description: 'Safety Gate & Main Gate Fabrication', category: 'OTHER', unit: 'nos', quantity: 1, unitRate: 60000, totalPrice: 60000 },
        { description: 'Elevation Architectural Glass & Tiles', category: 'FINISHING', unit: 'lumpsum', quantity: 1, unitRate: 40000, totalPrice: 40000 },
        { description: 'Kitchen & Bathroom Waste Chamber Urai', category: 'PLUMBING', unit: 'nos', quantity: 1, unitRate: 15000, totalPrice: 15000 },
        { description: 'Extra UPVC Window East Side', category: 'OTHER', unit: 'nos', quantity: 1, unitRate: 10000, totalPrice: 10000 },
        { description: 'Toilet WPC Door Fixing & Painting (1st Floor 2 doors)', category: 'OTHER', unit: 'nos', quantity: 2, unitRate: 4000, totalPrice: 8000 },
        { description: 'Washing Machine Provision Headroom Plumbing & SS Handrail', category: 'PLUMBING', unit: 'lumpsum', quantity: 1, unitRate: 7000, totalPrice: 7000 },
        { description: 'Bay Window Additional UPVC Material Sqft Cost', category: 'OTHER', unit: 'lumpsum', quantity: 1, unitRate: 11000, totalPrice: 11000 }
      ];

      for (const itm of kundrathurItems) {
        this.addLineItem(cardsContainer, itm);
      }
      this.recalculateTotals(container);
    });

    // Form submit
    container.querySelector('#form-create-quotation')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cards = cardsContainer.querySelectorAll('.quote-item-card');
      const items = [];

      cards.forEach((card, i) => {
        const desc = card.querySelector('.inp-item-desc').value.trim();
        const cat = card.querySelector('.sel-item-cat').value;
        const qty = parseFloat(card.querySelector('.inp-item-qty').value) || 0;
        const unit = card.querySelector('.inp-item-unit').value.trim() || 'sqft';
        const rate = parseFloat(card.querySelector('.inp-item-rate').value) || 0;
        const total = parseFloat(card.querySelector('.inp-item-total').value) || (qty * rate);

        if (desc) {
          items.push({
            itemCode: `ITM-${(i + 1).toString().padStart(2, '0')}`,
            description: desc,
            category: cat,
            quantity: qty,
            unit,
            unitRate: rate,
            totalPrice: total
          });
        }
      });

      if (items.length === 0) {
        alert('Please add at least one line item to the quotation.');
        return;
      }

      const cliSelect = container.querySelector('#sel-quote-client');
      const selectedOption = cliSelect.selectedOptions ? cliSelect.selectedOptions[0] : null;
      let clientName = 'Direct Client';
      if (selectedOption) {
        const text = selectedOption.textContent || '';
        clientName = text.includes(' (') ? text.split(' (')[0].trim() : text.trim();
      }
      if ((!clientName || clientName === 'Direct Client') && this.cachedClients) {
        const matched = this.cachedClients.find(c => c.id === cliSelect.value);
        if (matched) clientName = matched.name;
      }

      const payload = {
        clientId: cliSelect.value,
        client_name: clientName,
        clientName: clientName,
        projectId: container.querySelector('#sel-quote-project').value || null,
        title: container.querySelector('#inp-quote-title').value.trim(),
        taxRate: parseFloat(container.querySelector('#inp-quote-taxrate').value) || 0,
        termsConditions: container.querySelector('#inp-quote-terms').value.trim(),
        items
      };

      try {
        await BusinessApi.request('/quotations', 'POST', payload);
        modal.style.display = 'none';
        await this.loadQuotations(container);
      } catch (err) {
        alert('Failed to save quotation: ' + err.message);
      }
    });
  },

  addLineItem(container, data = {}) {
    const card = document.createElement('div');
    card.className = 'quote-item-card';
    card.style.cssText = 'background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px; box-shadow: var(--shadow-xs);';

    const qty = data.quantity !== undefined ? data.quantity : 1;
    const rate = data.unitRate !== undefined ? data.unitRate : (data.unit_rate !== undefined ? data.unit_rate : 0);
    const total = data.totalPrice !== undefined ? data.totalPrice : (data.total_price !== undefined ? data.total_price : (qty * rate));

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="item-card-index" style="font-size: 11px; font-weight: 700; color: var(--brand-navy-900); background: #E2E8F0; padding: 2px 8px; border-radius: 4px;">Item</span>
        <button type="button" class="btn-del-item" style="border: none; background: transparent; color: #DC2626; font-size: 12px; font-weight: 700; cursor: pointer; padding: 2px 6px;">✕ Remove</button>
      </div>

      <div class="form-group" style="margin-bottom: 8px;">
        <label class="form-label" style="font-size: 11px; margin-bottom: 2px; font-weight: 600;">Description *</label>
        <input type="text" class="inp-item-desc form-control" style="font-size: 12px;" required placeholder="e.g. Ground Floor Built-up Area" value="${data.description || ''}">
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 11px; margin-bottom: 2px; font-weight: 600;">Category</label>
          <select class="sel-item-cat form-control" style="font-size: 12px;">
            <option value="CIVIL" ${data.category === 'CIVIL' ? 'selected' : ''}>CIVIL</option>
            <option value="ELECTRICAL" ${data.category === 'ELECTRICAL' ? 'selected' : ''}>ELECTRICAL</option>
            <option value="PLUMBING" ${data.category === 'PLUMBING' ? 'selected' : ''}>PLUMBING</option>
            <option value="FINISHING" ${data.category === 'FINISHING' ? 'selected' : ''}>FINISHING</option>
            <option value="LABOUR" ${data.category === 'LABOUR' ? 'selected' : ''}>LABOUR</option>
            <option value="OTHER" ${data.category === 'OTHER' ? 'selected' : ''}>OTHER</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 11px; margin-bottom: 2px; font-weight: 600;">Unit</label>
          <input type="text" class="inp-item-unit form-control" style="font-size: 12px;" placeholder="sqft / nos / liters" value="${data.unit || 'sqft'}">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: flex-end;">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 11px; margin-bottom: 2px; font-weight: 600;">Qty</label>
          <input type="number" class="inp-item-qty form-control" style="font-size: 12px; text-align: right;" step="0.01" value="${qty}">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 11px; margin-bottom: 2px; font-weight: 600;">Rate (₹)</label>
          <input type="number" class="inp-item-rate form-control" style="font-size: 12px; text-align: right;" step="0.01" value="${rate}">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label" style="font-size: 11px; margin-bottom: 2px; font-weight: 600;">Amount (₹)</label>
          <input type="number" class="inp-item-total form-control" style="font-size: 12px; font-weight: 700; text-align: right; background: #F1F5F9;" step="0.01" value="${total}">
        </div>
      </div>
    `;

    const qtyInp = card.querySelector('.inp-item-qty');
    const rateInp = card.querySelector('.inp-item-rate');
    const totalInp = card.querySelector('.inp-item-total');

    const updateLineTotal = () => {
      const q = parseFloat(qtyInp.value) || 0;
      const r = parseFloat(rateInp.value) || 0;
      totalInp.value = Math.round(q * r * 100) / 100;
      const root = container.closest('#modal-new-quotation') || document;
      this.recalculateTotals(root);
    };

    qtyInp.addEventListener('input', updateLineTotal);
    rateInp.addEventListener('input', updateLineTotal);
    totalInp.addEventListener('input', () => {
      const root = container.closest('#modal-new-quotation') || document;
      this.recalculateTotals(root);
    });

    card.querySelector('.btn-del-item').addEventListener('click', () => {
      card.remove();
      this.renumberItemCards(container);
      const root = container.closest('#modal-new-quotation') || document;
      this.recalculateTotals(root);
    });

    container.appendChild(card);
    this.renumberItemCards(container);
  },

  renumberItemCards(container) {
    const cards = container.querySelectorAll('.quote-item-card');
    cards.forEach((card, idx) => {
      const badge = card.querySelector('.item-card-index');
      if (badge) badge.textContent = `Item #${idx + 1}`;
    });
  },

  recalculateTotals(container) {
    const totals = container.querySelectorAll('.inp-item-total');
    let subtotal = 0;
    totals.forEach(t => {
      subtotal += parseFloat(t.value) || 0;
    });

    const taxRate = parseFloat(container.querySelector('#inp-quote-taxrate')?.value) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    const subEl = container.querySelector('#quote-calc-subtotal');
    const totEl = container.querySelector('#quote-calc-total');

    if (subEl) subEl.textContent = `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totEl) totEl.textContent = `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  async populateDropdowns(container) {
    const cliSel = container.querySelector('#sel-quote-client');
    const prjSel = container.querySelector('#sel-quote-project');

    try {
      const [cRes, pRes] = await Promise.all([
        BusinessApi.request('/clients'),
        BusinessApi.request('/projects')
      ]);

      const clients = cRes.clients || [];
      const projects = pRes.projects || [];
      this.cachedClients = clients;

      cliSel.innerHTML = clients.map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join('');
      prjSel.innerHTML = '<option value="">-- No Linked Project (Draft Estimate) --</option>' + 
        projects.map(p => `<option value="${p.id}">${p.name} (${p.project_code || 'PRJ'})</option>`).join('');

      if (clients.length > 0) cliSel.value = clients[0].id;
      if (projects.length > 0) prjSel.value = projects[0].id;
    } catch (e) {
      console.warn('Dropdown populate error:', e.message);
    }
  },

  async openPrintPreview(container, qId) {
    const printModal = container.querySelector('#modal-quotation-print');
    const iframe = container.querySelector('#iframe-quotation-print');

    try {
      const [quoteRes, htmlRes] = await Promise.all([
        BusinessApi.request(`/quotations/${qId}`).catch(() => ({ quotation: (this.cachedQuotations || []).find(q => q.id === qId) })),
        BusinessApi.request(`/quotations/${qId}/html`).catch(() => ({ html: '' }))
      ]);

      const quote = quoteRes.quotation || (this.cachedQuotations || []).find(q => q.id === qId);
      this.activeQuotation = quote;

      let html = htmlRes.html || '';
      // Remove any onclick="window.print()" inside preview HTML so window.print is never invoked
      html = html.replace(/onclick="window\.print\(\)"/g, 'style="display:none;"');

      this.currentPrintHtml = html;
      iframe.srcdoc = html;
      printModal.style.display = 'flex';
    } catch (err) {
      alert('Error loading quotation preview: ' + err.message);
    }
  }
};
