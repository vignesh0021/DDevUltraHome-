/**
 * DDevUltraHome — Projects Management Screen
 */

import { BusinessApi } from '../businessApi.js';

export const ProjectsScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Projects Directory</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Active sites & contract deliverables</div>
          </div>
          <button id="btn-add-project" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px;">
            + Add Project
          </button>
        </div>

        <div id="projects-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading projects...</div>
        </div>
      </div>

      <!-- Add Project Modal -->
      <div id="modal-new-project" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Create Construction Project</h3>
          <form id="form-create-project">
            <div class="form-group">
              <label class="form-label">Project Name *</label>
              <input type="text" id="inp-prj-name" class="form-control" required placeholder="e.g. Guindy Luxury Villa">
            </div>
            <div class="form-group">
              <label class="form-label">Client *</label>
              <select id="sel-prj-client" class="form-control" required></select>
            </div>
            <div class="form-group">
              <label class="form-label">Site Address *</label>
              <textarea id="inp-prj-address" class="form-control" rows="2" required placeholder="Full site street address & landmarks"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">District</label>
                <input type="text" id="inp-prj-district" class="form-control" value="Chennai">
              </div>
              <div class="form-group">
                <label class="form-label">Project Code</label>
                <input type="text" id="inp-prj-code" class="form-control" placeholder="PRJ-GND-01">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Contract Value (₹)</label>
                <input type="number" id="inp-prj-contract" class="form-control" step="1000" placeholder="e.g. 8500000">
              </div>
              <div class="form-group">
                <label class="form-label">Budgeted Cost (₹)</label>
                <input type="number" id="inp-prj-budget" class="form-control" step="1000" placeholder="e.g. 6800000">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-prj" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Save Project</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Load projects and clients
    await this.loadProjects(container);

    // Modal controls
    const modal = container.querySelector('#modal-new-project');
    container.querySelector('#btn-add-project')?.addEventListener('click', async () => {
      await this.populateClientDropdown(container);
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-prj')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    container.querySelector('#form-create-project')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: container.querySelector('#inp-prj-name').value.trim(),
        client_id: container.querySelector('#sel-prj-client').value,
        site_address: container.querySelector('#inp-prj-address').value.trim(),
        district: container.querySelector('#inp-prj-district').value.trim(),
        project_code: container.querySelector('#inp-prj-code').value.trim() || undefined,
        contract_value: parseFloat(container.querySelector('#inp-prj-contract').value) || 0,
        budgeted_cost: parseFloat(container.querySelector('#inp-prj-budget').value) || 0
      };

      try {
        await BusinessApi.request('/projects', 'POST', payload);
        modal.style.display = 'none';
        await this.loadProjects(container);
      } catch (err) {
        alert('Failed to save project: ' + err.message);
      }
    });
  },

  async loadProjects(container) {
    const listEl = container.querySelector('#projects-list-container');
    try {
      const res = await BusinessApi.request('/projects');
      const projects = res.projects || [];

      if (projects.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No projects registered yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ Add Project" to register your first site.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${projects.map(p => `
            <div class="project-card" data-id="${p.id}" style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm); cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--brand-gold-600); background: var(--brand-gold-50); padding: 2px 6px; border-radius: 4px;">
                    ${p.project_code || 'PRJ'}
                  </span>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;">
                    ${p.name}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Client: <strong>${p.client_name || 'Assigned Client'}</strong> • ${p.district || 'Chennai'}
                  </div>
                </div>
                <span class="badge-status badge-${(p.status || 'ACTIVE').toLowerCase()}">
                  ${p.status || 'ACTIVE'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 12px;">
                <div>
                  <span style="color: var(--text-muted);">Contract:</span>
                  <strong style="color: var(--brand-navy-900); margin-left: 4px;">₹${(p.contract_value || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span style="color: var(--brand-navy-700); font-weight: 700;">View Financials →</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      listEl.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => {
          const prjId = card.getAttribute('data-id');
          this.viewProjectDetails(prjId);
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load projects: ${e.message}</div>`;
    }
  },

  async populateClientDropdown(container) {
    const sel = container.querySelector('#sel-prj-client');
    try {
      const res = await BusinessApi.request('/clients');
      const clients = res.clients || [];
      sel.innerHTML = clients.map(c => `<option value="${c.id}">${c.name} (${c.phone})</option>`).join('');
    } catch (e) {
      sel.innerHTML = `<option value="">Failed to load clients</option>`;
    }
  },

  async viewProjectDetails(prjId) {
    try {
      const res = await BusinessApi.request(`/projects/${prjId}`);
      const { project, financials } = res;
      alert(`Project: ${project.name} (${project.project_code})\nClient: ${project.client_name}\nContract Value: ₹${(project.contract_value || 0).toLocaleString('en-IN')}\nEarned Revenue: ₹${(financials.earnedRevenue || 0).toLocaleString('en-IN')}\nUnearned Advance: ₹${(financials.unearnedAdvanceLiability || 0).toLocaleString('en-IN')}\nOperating Profit: ₹${(financials.operatingProfit || 0).toLocaleString('en-IN')}`);
    } catch (err) {
      alert('Error fetching project: ' + err.message);
    }
  }
};
