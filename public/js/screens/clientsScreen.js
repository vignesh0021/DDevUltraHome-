/**
 * DDevUltraHome — Clients Management Screen & Project-Scoped Client Portal
 * 
 * Enforces business & security rules:
 * 1. Clients have access ONLY to their assigned project portal.
 * 2. Clients NEVER see internal company profit margins, bank balances, or supplier payables.
 * 3. Builders/Admins have access to full client directory and can preview the client view.
 */

import { BusinessApi } from '../businessApi.js';

export const ClientsScreen = {
  viewingPortalClientId: null,

  async render(container) {
    const activeUser = BusinessApi.getActiveUser();
    const isClientRole = activeUser?.role === 'CLIENT';

    // If active user is a CLIENT, directly render the dedicated Client Portal
    if (isClientRole || this.viewingPortalClientId) {
      await this.renderClientPortal(container, isClientRole);
      return;
    }

    // Otherwise render Builder/Admin Client Directory
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Client Directory</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Owners, developers &amp; contract parties</div>
          </div>
          <button id="btn-add-client" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px; font-weight: 700;">
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Add Client Account</h3>
            <button type="button" id="btn-close-cli-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <form id="form-create-client">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="inp-cli-name" class="form-control" required placeholder="e.g. Mr. Thiumani P.">
            </div>
            <div class="form-group">
              <label class="form-label">Company / Entity Name</label>
              <input type="text" id="inp-cli-company" class="form-control" placeholder="Optional business or family trust name">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Mobile Phone *</label>
                <input type="tel" id="inp-cli-phone" class="form-control" required placeholder="+91 98400 99887">
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

      <!-- Edit Client Modal -->
      <div id="modal-edit-client" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 210; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Edit Client Account</h3>
            <button type="button" id="btn-close-edit-cli" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <form id="form-edit-client">
            <input type="hidden" id="edit-cli-id">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="edit-cli-name" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Company / Entity Name</label>
              <input type="text" id="edit-cli-company" class="form-control">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Mobile Phone *</label>
                <input type="tel" id="edit-cli-phone" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="edit-cli-email" class="form-control">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Billing Address</label>
              <textarea id="edit-cli-address" class="form-control" rows="2"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">GSTIN</label>
                <input type="text" id="edit-cli-gstin" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">PAN</label>
                <input type="text" id="edit-cli-pan" class="form-control">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-edit-cli" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Update Client</button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadClients(container);

    const modal = container.querySelector('#modal-new-client');
    const editModal = container.querySelector('#modal-edit-client');

    container.querySelector('#btn-add-client')?.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
    container.querySelector('#btn-close-cli-modal')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-cli')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    container.querySelector('#btn-close-edit-cli')?.addEventListener('click', () => {
      editModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-edit-cli')?.addEventListener('click', () => {
      editModal.style.display = 'none';
    });

    container.querySelector('#form-edit-client')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cliId = container.querySelector('#edit-cli-id').value;
      const payload = {
        name: container.querySelector('#edit-cli-name').value.trim(),
        company_name: container.querySelector('#edit-cli-company').value.trim() || null,
        phone: container.querySelector('#edit-cli-phone').value.trim(),
        email: container.querySelector('#edit-cli-email').value.trim() || null,
        billing_address: container.querySelector('#edit-cli-address').value.trim() || null,
        gstin: container.querySelector('#edit-cli-gstin').value.trim() || null,
        pan: container.querySelector('#edit-cli-pan').value.trim() || null
      };

      try {
        await BusinessApi.request(`/clients/${cliId}`, 'PUT', payload);
        alert('✅ Client updated successfully!');
        editModal.style.display = 'none';
        await this.loadClients(container);
      } catch (err) {
        alert('Failed to update client: ' + err.message);
      }
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
        alert('✅ Client registered successfully!');
        modal.style.display = 'none';
        container.querySelector('#form-create-client').reset();
        await this.loadClients(container);
      } catch (err) {
        alert('Failed to save client: ' + err.message);
      }
    });
  },

  async renderClientPortal(container, isRealClientRole) {
    let client = null;
    let clientProjects = [];
    let milestones = [];

    try {
      const [cliRes, prjRes] = await Promise.all([
        BusinessApi.request('/clients').catch(() => ({ clients: [] })),
        BusinessApi.request('/projects').catch(() => ({ projects: [] }))
      ]);
      const clients = cliRes.clients || [];
      const projects = prjRes.projects || [];

      if (this.viewingPortalClientId) {
        client = clients.find(c => c.id === this.viewingPortalClientId) || null;
      } else {
        const activeUser = BusinessApi.getActiveUser();
        client = clients.find(c => c.id === activeUser?.client_id) || clients[0] || null;
      }

      if (client) {
        clientProjects = projects.filter(p => p.client_id === client.id);
        const primaryProjectId = clientProjects[0]?.id;
        if (primaryProjectId) {
          const mRes = await BusinessApi.request(`/milestones?project_id=${primaryProjectId}`).catch(() => ({ milestones: [] }));
          milestones = mRes.milestones || [];
        }
      }
    } catch (err) {
      console.warn('Could not load client portal data', err);
    }

    if (!client) {
      container.innerHTML = `
        <div style="padding: 24px; text-align: center;">
          <h3 style="color: var(--brand-navy-900); margin-bottom: 8px;">No Client Selected</h3>
          <p style="color: var(--text-muted); font-size: 13px;">There are no active client accounts to display.</p>
          ${!isRealClientRole ? `
            <button id="btn-exit-portal-preview" class="btn-primary" style="margin-top: 12px; padding: 6px 14px; font-size: 12px;">
              ← Back to Client Directory
            </button>
          ` : ''}
        </div>
      `;
      container.querySelector('#btn-exit-portal-preview')?.addEventListener('click', () => {
        this.viewingPortalClientId = null;
        this.render(container);
      });
      return;
    }

    const primaryPrj = clientProjects[0] || null;
    const totalContract = clientProjects.reduce((sum, p) => sum + (parseFloat(p.contract_value) || 0), 0) || (parseFloat(client.total_contract_value) || 0);
    const completedMilestones = milestones.filter(m => m.status === 'COMPLETED' || m.status === 'PAID');
    const progressPct = milestones.length > 0 ? Math.round((completedMilestones.length / milestones.length) * 100) : 0;

    container.innerHTML = `
      <div style="padding: 16px;">
        <!-- Client Portal Navigation Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge-status badge-verified" style="font-size: 11px;">Verified Client Portal</span>
              <span style="font-size: 12px; color: var(--text-muted);">Confidential Access</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 800; color: var(--brand-navy-900); margin: 4px 0 0;">
              ${primaryPrj ? primaryPrj.name : client.name}
            </h2>
          </div>
          ${!isRealClientRole ? `
            <button id="btn-exit-portal-preview" class="btn-outline" style="min-height: 36px; padding: 0 12px; font-size: 12px;">
              ← Back to Client Directory
            </button>
          ` : ''}
        </div>

        <!-- Project Hero Card -->
        <div style="background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%); color: white; border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow-md);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 12px; color: #F59E0B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                Owner / Client Account
              </div>
              <div style="font-size: 18px; font-weight: 800; margin-top: 2px;">
                ${client.name}
              </div>
              <div style="font-size: 12px; opacity: 0.85; margin-top: 4px;">
                ${client.billing_address ? `📍 ${client.billing_address}` : ''} ${primaryPrj ? `• Site: ${primaryPrj.location || primaryPrj.name}` : ''}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; opacity: 0.75; text-transform: uppercase;">Total Contract Value</div>
              <div style="font-size: 22px; font-weight: 800; color: #F59E0B; margin-top: 2px;">
                ₹${totalContract.toLocaleString('en-IN')}
              </div>
              <div style="font-size: 10px; opacity: 0.85; margin-top: 2px;">${primaryPrj?.code || client.id || '-'}</div>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display: flex; gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.15); flex-wrap: wrap;">
            <button id="btn-view-client-quote" class="btn-gold" style="min-height: 36px; padding: 0 14px; font-size: 12px; font-weight: 700;">
              📄 Official Estimate &amp; Quotation
            </button>
            <button id="btn-view-client-drawings" class="btn-outline" style="min-height: 36px; padding: 0 14px; font-size: 12px; color: white; border-color: rgba(255,255,255,0.4);">
              📐 Architectural Drawings
            </button>
          </div>
        </div>

        <!-- Milestone Progress Tracker -->
        <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">
                Construction Milestone Schedule
              </h3>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Official contract payment stages
              </div>
            </div>
            <span class="badge-status badge-active">${completedMilestones.length} of ${milestones.length} Stages Completed (${progressPct}%)</span>
          </div>

          <!-- Milestone Progress Bar -->
          <div style="background: #E2E8F0; border-radius: 6px; height: 10px; overflow: hidden; margin-bottom: 14px;">
            <div style="background: var(--brand-gold-600); width: ${progressPct}%; height: 100%; border-radius: 6px; transition: width 0.3s ease;"></div>
          </div>

          <!-- Milestones Items List -->
          <div id="client-milestones-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${milestones.length === 0 ? `
              <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">
                No milestone schedule created for this project yet.
              </div>
            ` : milestones.map((m, idx) => `
              <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-${String(idx + 1).padStart(2, '0')}: ${m.title || m.name || 'Stage'}</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">${m.description || ''}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹${(parseFloat(m.amount || m.target_amount) || 0).toLocaleString('en-IN')}</div>
                  <span class="badge-status ${m.status === 'COMPLETED' || m.status === 'PAID' ? 'badge-verified' : m.status === 'IN_PROGRESS' ? 'badge-pending' : 'badge-neutral'}" style="font-size: 10px;">
                    ${m.status || 'Scheduled'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Schedule A Engineering Specifications Accordion -->
        <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <h3 style="margin: 0 0 10px; font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">
            Schedule A — Certified Building Specifications
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; font-size: 12px;">
            <div style="background: #F8FAFC; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 700; color: var(--brand-navy-900);">🧱 Structure &amp; Masonry</span>
              <div style="color: var(--text-muted); margin-top: 2px;">RCC Framed structure, 9" exterior chamber brickwork, 4.5" partitions</div>
            </div>
            <div style="background: #F8FAFC; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 700; color: var(--brand-navy-900);">🏗️ Steel &amp; Cement</span>
              <div style="color: var(--text-muted); margin-top: 2px;">Fe550D TMT ISI Grade Steel, UltraTech / Dalmia 53 Grade OPC Cement</div>
            </div>
            <div style="background: #F8FAFC; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 700; color: var(--brand-navy-900);">🪵 Flooring &amp; Tiles</span>
              <div style="color: var(--text-muted); margin-top: 2px;">4' x 2' Premium Double Charged Vitrified Tiles in living &amp; bedrooms</div>
            </div>
            <div style="background: #F8FAFC; padding: 10px; border-radius: 6px;">
              <span style="font-weight: 700; color: var(--brand-navy-900);">⚡ Electrical &amp; Plumbing</span>
              <div style="color: var(--text-muted); margin-top: 2px;">Orbit FR 3-phase wiring, Legrand modular switches, Parryware sanitary fittings</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Exit preview handler for builders
    container.querySelector('#btn-exit-portal-preview')?.addEventListener('click', () => {
      this.viewingPortalClientId = null;
      this.render(container);
    });

    // View Official Quotation
    container.querySelector('#btn-view-client-quote')?.addEventListener('click', () => {
      if (window.appNavigate) {
        window.appNavigate('quotations');
      }
    });

    // View Drawings
    container.querySelector('#btn-view-client-drawings')?.addEventListener('click', () => {
      if (window.appNavigate) {
        window.appNavigate('documents');
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

      this.cachedClients = clients;

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${clients.map(c => `
            <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                <div>
                  <div style="font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">
                    ${c.name}
                  </div>
                  ${c.company_name ? `<div style="font-size: 12px; color: var(--brand-gold-600); font-weight: 600;">${c.company_name}</div>` : ''}
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                    📞 ${c.phone} ${c.email ? `• ✉️ ${c.email}` : ''}
                  </div>
                  ${c.billing_address ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">📍 ${c.billing_address}</div>` : ''}
                </div>
                <div style="text-align: right;">
                  <span class="badge-status badge-active">Active</span>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Total Contract</div>
                  <div style="font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">
                    ₹${(parseFloat(c.total_contract_value) || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-light); flex-wrap: wrap; gap: 8px;">
                <span style="font-size: 12px; color: var(--text-secondary);">Projects: <strong>${c.project_count !== undefined ? c.project_count : 0}</strong></span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button class="btn-preview-portal btn-gold" data-id="${c.id}" style="min-height: 32px; padding: 0 10px; font-size: 11px; font-weight: 700;">
                    🔍 Portal
                  </button>
                  <button class="btn-edit-client btn-outline" data-id="${c.id}" style="min-height: 32px; padding: 0 10px; font-size: 11px; font-weight: 600;">
                    ✏️ Edit
                  </button>
                  <button class="btn-archive-client btn-outline" data-id="${c.id}" data-name="${c.name}" style="min-height: 32px; padding: 0 8px; font-size: 11px; font-weight: 600; color: #DC2626; border-color: #FCA5A5;">
                    📦 Archive
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Wire Client Portal preview buttons
      listEl.querySelectorAll('.btn-preview-portal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.viewingPortalClientId = e.currentTarget.dataset.id;
          this.render(container);
        });
      });

      // Wire Edit Client buttons
      listEl.querySelectorAll('.btn-edit-client').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const cliId = e.currentTarget.dataset.id;
          const client = (this.cachedClients || []).find(c => c.id === cliId);
          if (!client) return;

          container.querySelector('#edit-cli-id').value = client.id;
          container.querySelector('#edit-cli-name').value = client.name || '';
          container.querySelector('#edit-cli-company').value = client.company_name || '';
          container.querySelector('#edit-cli-phone').value = client.phone || '';
          container.querySelector('#edit-cli-email').value = client.email || '';
          container.querySelector('#edit-cli-address').value = client.billing_address || '';
          container.querySelector('#edit-cli-gstin').value = client.gstin || '';
          container.querySelector('#edit-cli-pan').value = client.pan || '';

          container.querySelector('#modal-edit-client').style.display = 'flex';
        });
      });

      // Wire Archive Client buttons
      listEl.querySelectorAll('.btn-archive-client').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const cliId = e.currentTarget.dataset.id;
          const cliName = e.currentTarget.dataset.name;
          const confirmed = confirm(`Archive client "${cliName}"?\nAll linked contracts, receipts, and historical data will remain intact.`);
          if (!confirmed) return;

          try {
            await BusinessApi.request(`/clients/${cliId}`, 'DELETE');
            alert('📦 Client archived successfully.');
            await this.loadClients(container);
          } catch (err) {
            alert('Failed to archive client: ' + err.message);
          }
        });
      });

    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load clients: ${e.message}</div>`;
    }
  }
};
