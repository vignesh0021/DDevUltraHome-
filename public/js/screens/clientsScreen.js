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
    `;

    await this.loadClients(container);

    const modal = container.querySelector('#modal-new-client');
    container.querySelector('#btn-add-client')?.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
    container.querySelector('#btn-close-cli-modal')?.addEventListener('click', () => {
      modal.style.display = 'none';
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
              Kundrathur Residence (G+1 Villa)
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
                Mr. Thiumani P.
              </div>
              <div style="font-size: 12px; opacity: 0.85; margin-top: 4px;">
                📍 Anakaputhur, Chennai - 600070 • Site: Kundrathur (G+1 Villa)
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; opacity: 0.75; text-transform: uppercase;">Total Contract Value</div>
              <div style="font-size: 22px; font-weight: 800; color: #F59E0B; margin-top: 2px;">
                ₹42,27,400
              </div>
              <div style="font-size: 10px; opacity: 0.85; margin-top: 2px;">CTR-KUN-2026-001 (04/04/2026)</div>
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

        <!-- 8-Stage Milestone Progress Tracker -->
        <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 18px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">
                8-Stage Construction Milestone Schedule
              </h3>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Official contract payment stages (Schedule B)
              </div>
            </div>
            <span class="badge-status badge-active">Stage 3 of 8 In Progress</span>
          </div>

          <!-- Milestone Progress Bar -->
          <div style="background: #E2E8F0; border-radius: 6px; height: 10px; overflow: hidden; margin-bottom: 14px;">
            <div style="background: var(--brand-gold-600); width: 33.11%; height: 100%; border-radius: 6px;"></div>
          </div>

          <!-- Milestones Items List -->
          <div id="client-milestones-list" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-01: Mobilization Advance</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Agreement signing &amp; site preparation (18.92%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹8,00,000</div>
                <span class="badge-status badge-verified" style="font-size: 10px;">Billed / Certified</span>
              </div>
            </div>

            <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-02: GF Roof Level Brickwork</strong>
                <div style="font-size: 11px; color: var(--text-muted);">9" flyash chamber brick masonry &amp; lintels (14.19%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹6,00,000</div>
                <span class="badge-status badge-verified" style="font-size: 10px;">Completed</span>
              </div>
            </div>

            <div style="padding: 10px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #92400E; font-size: 12px;">MS-03: GF Roof Slab Concrete</strong>
                <div style="font-size: 11px; color: #78350F;">5" RCC slab M20 concrete casting &amp; curing (16.56%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: #92400E;">₹7,00,000</div>
                <span class="badge-status badge-pending" style="font-size: 10px;">In Progress</span>
              </div>
            </div>

            <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; opacity: 0.7;">
              <div>
                <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-04: FF Roof Level Brickwork</strong>
                <div style="font-size: 11px; color: var(--text-muted);">First floor brick masonry up to roof level (14.19%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹6,00,000</div>
                <span class="badge-status badge-neutral" style="font-size: 10px;">Not Started</span>
              </div>
            </div>

            <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; opacity: 0.7;">
              <div>
                <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-05: FF Roof Slab Concrete</strong>
                <div style="font-size: 11px; color: var(--text-muted);">First floor roof slab &amp; staircase headroom (16.56%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹7,00,000</div>
                <span class="badge-status badge-neutral" style="font-size: 10px;">Not Started</span>
              </div>
            </div>

            <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; opacity: 0.7;">
              <div>
                <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-06: Outer &amp; Inner Plastering</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Internal CM 1:4 and external CM 1:5 plastering (11.83%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹5,00,000</div>
                <span class="badge-status badge-neutral" style="font-size: 10px;">Not Started</span>
              </div>
            </div>

            <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; opacity: 0.7;">
              <div>
                <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-07: Plumbing, Painting &amp; Electrical</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Orbit 3-phase wiring, Parryware &amp; Asian Paints (7.10%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹3,00,000</div>
                <span class="badge-status badge-neutral" style="font-size: 10px;">Not Started</span>
              </div>
            </div>

            <div style="padding: 10px; background: #F8FAFC; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; opacity: 0.7;">
              <div>
                <strong style="color: var(--brand-navy-900); font-size: 12px;">MS-08: Handover &amp; Final Settlement</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Final snag clearance &amp; keys handover (0.65%)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">₹27,400</div>
                <span class="badge-status badge-neutral" style="font-size: 10px;">Not Started</span>
              </div>
            </div>
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
                    ₹${(c.total_contract_value || 4227400.00).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-light); flex-wrap: wrap; gap: 8px;">
                <span style="font-size: 12px; color: var(--text-secondary);">Projects: <strong>${c.project_count || 1}</strong></span>
                <button class="btn-preview-portal btn-gold" data-id="${c.id}" style="min-height: 32px; padding: 0 12px; font-size: 11px; font-weight: 700;">
                  🔍 View Client Portal
                </button>
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

    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load clients: ${e.message}</div>`;
    }
  }
};
