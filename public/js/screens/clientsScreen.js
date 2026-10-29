/**
 * DDevUltraHome — Clients Management Screen
 */

import { BusinessApi } from '../businessApi.js';

export const ClientsScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Client Directory</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Owners, developers & contract parties</div>
          </div>
          <button id="btn-add-client" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px;">
            + Add Client
          </button>
        </div>

        <div id="clients-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading clients...</div>
        </div>
      </div>

      <!-- Add Client Modal -->
      <div id="modal-new-client" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Add Client Account</h3>
          <form id="form-create-client">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="inp-cli-name" class="form-control" required placeholder="e.g. Mr. JAS Guindy">
            </div>
            <div class="form-group">
              <label class="form-label">Company / Entity Name</label>
              <input type="text" id="inp-cli-company" class="form-control" placeholder="Optional business name">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Mobile Phone *</label>
                <input type="tel" id="inp-cli-phone" class="form-control" required placeholder="+91 98400 12345">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="inp-cli-email" class="form-control" placeholder="client@example.com">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Billing Address</label>
              <textarea id="inp-cli-address" class="form-control" rows="2" placeholder="Full postal address for invoicing"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">GSTIN</label>
                <input type="text" id="inp-cli-gstin" class="form-control" placeholder="33AAAAA0000A1Z5">
              </div>
              <div class="form-group">
                <label class="form-label">PAN</label>
                <input type="text" id="inp-cli-pan" class="form-control" placeholder="AAAAA0000A">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-cli" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Save Client</button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadClients(container);

    const modal = container.querySelector('#modal-new-client');
    container.querySelector('#btn-add-client')?.addEventListener('click', () => {
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-cli')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    container.querySelector('#form-create-client')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: container.querySelector('#inp-cli-name').value.trim(),
        company_name: container.querySelector('#inp-cli-company').value.trim() || null,
        phone: container.querySelector('#inp-cli-phone').value.trim(),
        email: container.querySelector('#inp-cli-email').value.trim() || null,
        billing_address: container.querySelector('#inp-cli-address').value.trim() || null,
        gstin: container.querySelector('#inp-cli-gstin').value.trim() || null,
        pan: container.querySelector('#inp-cli-pan').value.trim() || null
      };

      try {
        await BusinessApi.request('/clients', 'POST', payload);
        modal.style.display = 'none';
        await this.loadClients(container);
      } catch (err) {
        alert('Failed to save client: ' + err.message);
      }
    });
  },

  async loadClients(container) {
    const listEl = container.querySelector('#clients-list-container');
    try {
      const res = await BusinessApi.request('/clients');
      const clients = res.clients || [];

      if (clients.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No clients registered yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ Add Client" to create your first client record.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${clients.map(c => `
            <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">
                    ${c.name}
                  </div>
                  ${c.company_name ? `<div style="font-size: 12px; color: var(--brand-gold-600); font-weight: 600;">${c.company_name}</div>` : ''}
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    📞 ${c.phone} ${c.email ? `• ✉️ ${c.email}` : ''}
                  </div>
                </div>
                <span class="badge-status badge-active">Active</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 12px;">
                <span style="color: var(--text-secondary);">Projects: <strong>${c.project_count || 0}</strong></span>
                <span style="color: var(--text-secondary);">Total Value: <strong style="color: var(--brand-navy-900);">₹${(c.total_contract_value || 0).toLocaleString('en-IN')}</strong></span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load clients: ${e.message}</div>`;
    }
  }
};
