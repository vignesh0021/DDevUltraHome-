/**
 * DDevUltraHome — Suppliers & Accounts Payable Screen
 * 
 * Enforces rule: Unpaid invoices are accounts payable, NEVER treated as cash payments.
 */

import { BusinessApi } from '../businessApi.js';

export const SuppliersScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Suppliers & Accounts Payable</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Vendors, Invoices & Supplier Disbursals</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-add-supplier" class="btn-outline" style="min-height: 40px; padding: 0 12px; font-size: 13px;">
              + Vendor
            </button>
            <button id="btn-add-invoice" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px;">
              + Log Bill
            </button>
          </div>
        </div>

        <div id="suppliers-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading suppliers...</div>
        </div>
      </div>

      <!-- Add Supplier Modal -->
      <div id="modal-new-supplier" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Add Material Supplier</h3>
          <form id="form-create-supplier">
            <div class="form-group">
              <label class="form-label">Vendor Name *</label>
              <input type="text" id="inp-sup-name" class="form-control" required placeholder="e.g. UltraTech RMC Velachery">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Category</label>
                <select id="sel-sup-category" class="form-control">
                  <option value="STEEL">Steel / TMT Rebars</option>
                  <option value="CEMENT">Cement</option>
                  <option value="RMC_CONCRETE">Ready-Mix Concrete (RMC)</option>
                  <option value="AGGREGATES">Sand & Blue Metal</option>
                  <option value="BRICKS_BLOCKS">Red Bricks / AAC Blocks</option>
                  <option value="ELECTRICAL_PLUMBING">Electrical & Plumbing</option>
                  <option value="TILES_SANITARY">Tiles & Sanitaryware</option>
                  <option value="GENERAL">General Hardware</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Contact Person</label>
                <input type="text" id="inp-sup-contact" class="form-control" placeholder="e.g. Mr. Balan">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Phone *</label>
                <input type="tel" id="inp-sup-phone" class="form-control" required placeholder="+91 94440 12345">
              </div>
              <div class="form-group">
                <label class="form-label">GSTIN</label>
                <input type="text" id="inp-sup-gstin" class="form-control" placeholder="33AAAAA0000A1Z5">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-sup" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Save Vendor</button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadSuppliers(container);

    const modal = container.querySelector('#modal-new-supplier');
    container.querySelector('#btn-add-supplier')?.addEventListener('click', () => {
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-sup')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    container.querySelector('#form-create-supplier')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: container.querySelector('#inp-sup-name').value.trim(),
        category: container.querySelector('#sel-sup-category').value,
        contact_person: container.querySelector('#inp-sup-contact').value.trim() || null,
        phone: container.querySelector('#inp-sup-phone').value.trim(),
        gstin: container.querySelector('#inp-sup-gstin').value.trim() || null
      };

      try {
        await BusinessApi.request('/suppliers', 'POST', payload);
        modal.style.display = 'none';
        await this.loadSuppliers(container);
      } catch (err) {
        alert('Failed to save supplier: ' + err.message);
      }
    });
  },

  async loadSuppliers(container) {
    const listEl = container.querySelector('#suppliers-list-container');
    try {
      const res = await BusinessApi.request('/suppliers');
      const suppliers = res.suppliers || [];

      if (suppliers.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No suppliers registered yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ Vendor" to add materials suppliers.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${suppliers.map(s => `
            <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--brand-navy-700); background: var(--bg-card-subtle); padding: 2px 6px; border-radius: 4px;">
                    ${s.category}
                  </span>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;">
                    ${s.name}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Contact: ${s.contact_person || 'N/A'} • 📞 ${s.phone}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Outstanding Dues</div>
                  <div style="font-size: 16px; font-weight: 800; color: ${s.outstanding_dues > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
                    ₹${(s.outstanding_dues || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load suppliers: ${e.message}</div>`;
    }
  }
};
