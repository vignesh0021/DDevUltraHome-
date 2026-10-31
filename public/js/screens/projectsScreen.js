/**
 * DDevUltraHome — Projects Management Screen
 * Complete project directory with real contract breakdown, Schedule A specifications,
 * milestone progress, project transactions, and financial P&L inspection.
 */

import { BusinessApi } from '../businessApi.js';
import { AppDialog } from '../components/appDialog.js';

export const ProjectsScreen = {
  currentProject: null,

  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Projects Directory</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Active sites, client contracts, deliverables & financial summaries</div>
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
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Create Construction Project</h3>
          <form id="form-create-project">
            <div class="form-group">
              <label class="form-label">Project Name *</label>
              <input type="text" id="inp-prj-name" class="form-control" required placeholder="e.g. Kundrathur Residence">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Client *</label>
                <select id="sel-prj-client" class="form-control" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">Client Contact Phone / Email</label>
                <input type="text" id="inp-prj-contact" class="form-control" placeholder="+91 98400 12345">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Site Address *</label>
              <textarea id="inp-prj-address" class="form-control" rows="2" required placeholder="Full site street address & landmarks"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Project Description / Scope</label>
              <textarea id="inp-prj-description" class="form-control" rows="2" placeholder="e.g. G+1 Villa RCC framed residential construction"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">District</label>
                <input type="text" id="inp-prj-district" class="form-control" value="Chennai">
              </div>
              <div class="form-group">
                <label class="form-label">Project Code</label>
                <input type="text" id="inp-prj-code" class="form-control" placeholder="PRJ-KUN-2026">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Start Date</label>
                <input type="date" id="inp-prj-start-date" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Expected Completion Date</label>
                <input type="date" id="inp-prj-end-date" class="form-control">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Contract Value (₹)</label>
                <input type="number" id="inp-prj-contract" class="form-control" step="1000" placeholder="e.g. 4227400">
              </div>
              <div class="form-group">
                <label class="form-label">Budgeted Cost (₹)</label>
                <input type="number" id="inp-prj-budget" class="form-control" step="1000" placeholder="e.g. 3400000">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-prj" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Save Project</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Comprehensive Project Details Modal -->
      <div id="modal-project-details" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 300; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 24px; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-light); padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span id="dtl-prj-code" style="font-size: 11px; font-weight: 800; color: var(--brand-gold-600); background: var(--brand-gold-50); padding: 2px 8px; border-radius: 4px;"></span>
                <span id="dtl-prj-stage" class="badge-status badge-active"></span>
              </div>
              <h3 id="dtl-prj-name" style="margin: 6px 0 2px; font-size: 18px; font-weight: 800; color: var(--brand-navy-900);"></h3>
              <div id="dtl-prj-client" style="font-size: 12px; color: var(--text-muted);"></div>
              <div id="dtl-prj-dates" style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;"></div>
              <div id="dtl-prj-desc" style="font-size: 12px; color: var(--brand-navy-800); margin-top: 4px; font-style: italic;"></div>
            </div>
            <button id="btn-close-details" class="btn-outline" style="min-height: 32px; width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;" type="button">✕</button>
          </div>

          <!-- Financial Health KPI Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 18px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">CONTRACT VALUE</div>
              <div id="dtl-val-contract" style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 2px;">₹0</div>
            </div>
            <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 11px; color: #1E40AF; font-weight: 700;">TOTAL INCOME</div>
              <div id="dtl-val-income" style="font-size: 15px; font-weight: 800; color: #1E3A8A; margin-top: 2px;">₹0</div>
            </div>
            <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 11px; color: #991B1B; font-weight: 700;">TOTAL EXPENSES</div>
              <div id="dtl-val-expenses" style="font-size: 15px; font-weight: 800; color: #DC2626; margin-top: 2px;">₹0</div>
            </div>
            <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--radius-md); padding: 10px;">
              <div style="font-size: 11px; color: #166534; font-weight: 700;">OUTSTANDING DUE</div>
              <div id="dtl-val-balance-due" style="font-size: 15px; font-weight: 800; color: #15803D; margin-top: 2px;">₹0</div>
            </div>
          </div>

          <!-- Milestones Schedule (Schedule B) -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Contract Payment Milestones</h4>
              <span id="dtl-milestone-count" style="font-size: 11px; color: var(--text-muted);">0 Stages</span>
            </div>
            <div id="dtl-milestones-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; padding-right: 4px;">
            </div>
          </div>

          <!-- Schedule A Specifications & Scope -->
          <div style="background: #F8FAFC; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; margin-bottom: 18px;">
            <div style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 6px;">
              📋 Schedule A Engineering Specifications
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
              • <strong>RCC Framed Structure:</strong> 5" slab, 5" cut lintel, 2" sunshade<br>
              • <strong>Masonry:</strong> 9" flyash bricks (CM 1:5) in external walls; 4.5" partition walls (CM 1:4)<br>
              • <strong>Approved Cement:</strong> Dalmia, Coromandel, UltraTech, Ramco (HDPE/paper bags)<br>
              • <strong>Reinforcement:</strong> ISI 550D TMT bars<br>
              • <strong>Flooring & Wall:</strong> 4'×2' Vitrified tiles (Kag/Anuj @ ₹50/sqft base); 1'×1' toilet tiles to 7ft<br>
              • <strong>Joinery & Woodwork:</strong> First quality teak wood main door (3'6"×7'), UPVC sliding windows<br>
              • <strong>Electrical & Plumbing:</strong> Orbit 3-phase wiring, Parryware sanitary fittings
            </div>
          </div>

          <!-- Recent Project Transactions -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Recent Transactions</h4>
              <span id="dtl-txns-count" style="font-size: 11px; color: var(--text-muted);">0 Records</span>
            </div>
            <div id="dtl-project-txns" style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto; padding-right: 4px;">
              <div style="font-size: 12px; color: var(--text-muted); padding: 8px;">Loading transactions...</div>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
            <button id="btn-dtl-view-report" class="btn-primary" style="flex: 1 1 100%; min-height: 42px; font-size: 13px; font-weight: 800; background: #0284C7; border-color: #0284C7;">
              📊 View Full Project Financial Report &amp; PDF
            </button>
            <button id="btn-dtl-edit-project" class="btn-outline" style="flex: 1; min-height: 38px; font-size: 12px; font-weight: 700;">
              ✏️ Edit Project
            </button>
            <button id="btn-dtl-archive-project" class="btn-outline" style="min-height: 38px; font-size: 12px; font-weight: 700; color: #DC2626; border-color: #FCA5A5;">
              📦 Archive Project
            </button>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="btn-dtl-record-receipt" class="btn-primary" style="flex: 1; min-height: 42px; font-size: 13px;">
              💰 Record Receipt / Advance
            </button>
            <button id="btn-dtl-record-expense" class="btn-outline" style="flex: 1; min-height: 42px; font-size: 13px;">
              💳 Record Expense
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Project Modal -->
      <div id="modal-edit-project" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 350; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Edit Project Details</h3>
          <form id="form-edit-project">
            <input type="hidden" id="edit-prj-id">
            <div class="form-group">
              <label class="form-label">Project Name *</label>
              <input type="text" id="edit-prj-name" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Client Contact Phone / Email</label>
              <input type="text" id="edit-prj-contact" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Site Address *</label>
              <textarea id="edit-prj-address" class="form-control" rows="2" required></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Project Description / Scope</label>
              <textarea id="edit-prj-description" class="form-control" rows="2"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">District</label>
                <input type="text" id="edit-prj-district" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Current Stage</label>
                <select id="edit-prj-stage" class="form-control">
                  <option value="FOUNDATION">Foundation</option>
                  <option value="PLINTH">Plinth</option>
                  <option value="RCC_FRAMING">RCC Framing / Slabs</option>
                  <option value="BRICKWORK">Brickwork & Masonry</option>
                  <option value="PLASTERING">Plastering</option>
                  <option value="FLOORING_TILING">Flooring & Tiling</option>
                  <option value="PAINTING_FINISHING">Painting & Finishing</option>
                  <option value="COMPLETED">Completed / Handed Over</option>
                </select>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Start Date</label>
                <input type="date" id="edit-prj-start-date" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Expected Completion Date</label>
                <input type="date" id="edit-prj-end-date" class="form-control">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Status</label>
                <select id="edit-prj-status" class="form-control">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Contract Value (₹)</label>
                <input type="number" id="edit-prj-contract" class="form-control" step="1000">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Budgeted Cost (₹)</label>
              <input type="number" id="edit-prj-budget" class="form-control" step="1000">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-edit-prj" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Update Project</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Load projects and clients
    await this.loadProjects(container);

    // Modal controls
    const modal = container.querySelector('#modal-new-project');
    const detailsModal = container.querySelector('#modal-project-details');

    container.querySelector('#btn-add-project')?.addEventListener('click', async () => {
      await this.populateClientDropdown(container);
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-prj')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    container.querySelector('#btn-close-details')?.addEventListener('click', () => {
      detailsModal.style.display = 'none';
    });

    container.querySelector('#form-create-project')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: container.querySelector('#inp-prj-name').value.trim(),
        client_id: container.querySelector('#sel-prj-client').value,
        client_contact: container.querySelector('#inp-prj-contact').value.trim(),
        site_address: container.querySelector('#inp-prj-address').value.trim(),
        description: container.querySelector('#inp-prj-description').value.trim(),
        district: container.querySelector('#inp-prj-district').value.trim(),
        project_code: container.querySelector('#inp-prj-code').value.trim() || undefined,
        start_date: container.querySelector('#inp-prj-start-date').value || undefined,
        expected_completion_date: container.querySelector('#inp-prj-end-date').value || undefined,
        contract_value: parseFloat(container.querySelector('#inp-prj-contract').value) || 0,
        budgeted_cost: parseFloat(container.querySelector('#inp-prj-budget').value) || 0
      };

      try {
        await BusinessApi.request('/projects', 'POST', payload);
        modal.style.display = 'none';
        await this.loadProjects(container);
      } catch (err) {
        await AppDialog.alert({ title: 'Save Failed', message: 'Failed to save project: ' + err.message });
      }
    });

    // Close modals on outside backdrop click
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    detailsModal.onclick = (e) => { if (e.target === detailsModal) detailsModal.style.display = 'none'; };

    // Edit & Archive Project controls
    const editModal = container.querySelector('#modal-edit-project');
    if (editModal) {
      editModal.onclick = (e) => { if (e.target === editModal) editModal.style.display = 'none'; };
    }

    container.querySelector('#btn-dtl-edit-project')?.addEventListener('click', () => {
      if (!this.currentProject) return;
      const p = this.currentProject;
      container.querySelector('#edit-prj-id').value = p.id;
      container.querySelector('#edit-prj-name').value = p.name || '';
      container.querySelector('#edit-prj-contact').value = p.client_contact || '';
      container.querySelector('#edit-prj-address').value = p.site_address || '';
      container.querySelector('#edit-prj-description').value = p.description || '';
      container.querySelector('#edit-prj-district').value = p.district || 'Chennai';
      container.querySelector('#edit-prj-stage').value = p.current_stage || 'FOUNDATION';
      container.querySelector('#edit-prj-status').value = p.status || 'ACTIVE';
      container.querySelector('#edit-prj-start-date').value = p.start_date || '';
      container.querySelector('#edit-prj-end-date').value = p.expected_completion_date || '';
      container.querySelector('#edit-prj-contract').value = p.contract_value || 0;
      container.querySelector('#edit-prj-budget').value = p.budgeted_cost || 0;
      editModal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-edit-prj')?.addEventListener('click', () => {
      editModal.style.display = 'none';
    });

    container.querySelector('#form-edit-project')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const prjId = container.querySelector('#edit-prj-id').value;
      const payload = {
        name: container.querySelector('#edit-prj-name').value.trim(),
        client_contact: container.querySelector('#edit-prj-contact').value.trim(),
        site_address: container.querySelector('#edit-prj-address').value.trim(),
        description: container.querySelector('#edit-prj-description').value.trim(),
        district: container.querySelector('#edit-prj-district').value.trim(),
        current_stage: container.querySelector('#edit-prj-stage').value,
        status: container.querySelector('#edit-prj-status').value,
        start_date: container.querySelector('#edit-prj-start-date').value || undefined,
        expected_completion_date: container.querySelector('#edit-prj-end-date').value || undefined,
        contract_value: parseFloat(container.querySelector('#edit-prj-contract').value) || 0,
        budgeted_cost: parseFloat(container.querySelector('#edit-prj-budget').value) || 0
      };

      try {
        await BusinessApi.request(`/projects/${prjId}`, 'PUT', payload);
        await AppDialog.alert({ title: 'Project Updated', message: '✅ Project updated successfully!' });
        editModal.style.display = 'none';
        detailsModal.style.display = 'none';
        await this.loadProjects(container);
      } catch (err) {
        await AppDialog.alert({ title: 'Update Failed', message: 'Failed to update project: ' + err.message });
      }
    });

    container.querySelector('#btn-dtl-archive-project')?.addEventListener('click', async () => {
      if (!this.currentProject) return;
      const confirmArchive = await AppDialog.confirm({
        title: 'Archive Project',
        message: `Archive project "${this.currentProject.name}"?\nAll financial audit ledgers and progress history will remain preserved.`,
        confirmText: 'Archive Project',
        isDestructive: true
      });
      if (!confirmArchive) return;

      try {
        await BusinessApi.request(`/projects/${this.currentProject.id}`, 'DELETE');
        await AppDialog.alert({ title: 'Archived', message: '📦 Project archived successfully.' });
        detailsModal.style.display = 'none';
        await this.loadProjects(container);
      } catch (err) {
        await AppDialog.alert({ title: 'Archive Failed', message: 'Failed to archive project: ' + err.message });
      }
    });

    // View Full Financial Report navigation
    container.querySelector('#btn-dtl-view-report')?.addEventListener('click', () => {
      if (!this.currentProject) return;
      detailsModal.style.display = 'none';
      window._selectedReportProjectId = this.currentProject.id;
      if (typeof window.appNavigate === 'function') {
        window.appNavigate('reports');
      }
    });

    // Quick action navigators from details modal
    container.querySelector('#btn-dtl-record-receipt')?.addEventListener('click', () => {
      detailsModal.style.display = 'none';
      if (typeof window.appNavigate === 'function') {
        window.appNavigate('income');
      }
    });

    container.querySelector('#btn-dtl-record-expense')?.addEventListener('click', () => {
      detailsModal.style.display = 'none';
      if (typeof window.appNavigate === 'function') {
        window.appNavigate('expenses');
      }
    });
  },

  async loadProjects(container) {
    const listEl = container.querySelector('#projects-list-container');
    try {
      const res = await BusinessApi.request('/projects');
      const projects = (res.projects || []).filter(p => p.id !== 'prj-business-overhead');

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
            <div class="project-card" data-id="${p.id}" style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; font-weight: 800; color: var(--brand-gold-600); background: var(--brand-gold-50); padding: 2px 6px; border-radius: 4px;">
                      ${p.project_code || 'PRJ'}
                    </span>
                    <span style="font-size: 10px; font-weight: 700; color: var(--brand-navy-700); background: #F1F5F9; padding: 2px 5px; border-radius: 4px;">
                      ${p.current_stage || 'FOUNDATION'}
                    </span>
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 6px;">
                    ${p.name}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Client: <strong>${p.client_name || 'Assigned Client'}</strong> • ${p.district || 'Chennai'}
                  </div>
                  ${p.description ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px; font-style: italic;">${p.description}</div>` : ''}
                </div>
                <span class="badge-status badge-${(p.status || 'ACTIVE').toLowerCase()}">
                  ${p.status || 'ACTIVE'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 12px;">
                <div>
                  <span style="color: var(--text-muted);">Contract Value:</span>
                  <strong style="color: var(--brand-navy-900); margin-left: 4px;">₹${(p.contract_value || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span style="color: var(--brand-gold-600); font-weight: 800;">Inspect Contract &amp; History →</span>
                </div>
              </div>

              <!-- Quick Action Bar -->
              <div style="display: flex; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border-light); justify-content: flex-end;">
                <button class="btn-card-edit-prj btn-outline" data-id="${p.id}" style="min-height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700;">
                  ✏️ Edit
                </button>
                <button class="btn-card-del-prj btn-outline" data-id="${p.id}" data-name="${p.name}" style="min-height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700; color: #DC2626; border-color: #FCA5A5;">
                  🗑️ Delete / Archive
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      listEl.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => {
          const prjId = card.getAttribute('data-id');
          this.viewProjectDetails(container, prjId);
        });
      });

      // Direct Edit buttons on cards
      listEl.querySelectorAll('.btn-card-edit-prj').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const prjId = e.currentTarget.dataset.id;
          const p = (projects || []).find(x => x.id === prjId);
          if (!p) return;
          this.currentProject = p;
          container.querySelector('#edit-prj-id').value = p.id;
          container.querySelector('#edit-prj-name').value = p.name || '';
          container.querySelector('#edit-prj-contact').value = p.client_contact || '';
          container.querySelector('#edit-prj-address').value = p.site_address || '';
          container.querySelector('#edit-prj-description').value = p.description || '';
          container.querySelector('#edit-prj-district').value = p.district || 'Chennai';
          container.querySelector('#edit-prj-stage').value = p.current_stage || 'FOUNDATION';
          container.querySelector('#edit-prj-status').value = p.status || 'ACTIVE';
          container.querySelector('#edit-prj-start-date').value = p.start_date || '';
          container.querySelector('#edit-prj-end-date').value = p.expected_completion_date || '';
          container.querySelector('#edit-prj-contract').value = p.contract_value || 0;
          container.querySelector('#edit-prj-budget').value = p.budgeted_cost || 0;
          editModal.style.display = 'flex';
        });
      });

      // Direct Delete / Archive buttons on cards
      listEl.querySelectorAll('.btn-card-del-prj').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const prjId = e.currentTarget.dataset.id;
          const prjName = e.currentTarget.dataset.name;
          const confirmed = await AppDialog.confirm({
            title: 'Delete / Archive Project',
            message: `Are you sure you want to delete / archive project "${prjName}"?\nAll financial audit ledgers and transaction history will remain safely preserved.`,
            confirmText: 'Archive Project',
            isDestructive: true
          });
          if (!confirmed) return;

          try {
            await BusinessApi.request(`/projects/${prjId}`, 'DELETE');
            await AppDialog.alert({ title: 'Archived', message: '📦 Project archived / deleted successfully.' });
            await this.loadProjects(container);
          } catch (err) {
            await AppDialog.alert({ title: 'Delete Failed', message: 'Failed to delete project: ' + err.message });
          }
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

  async viewProjectDetails(container, prjId) {
    const detailsModal = container.querySelector('#modal-project-details');
    try {
      const [resPrj, resReport] = await Promise.all([
        BusinessApi.request(`/projects/${prjId}`),
        BusinessApi.request(`/projects/${prjId}/report`).catch(() => ({ report: {} }))
      ]);

      const { project, milestones = [] } = resPrj;
      const report = resReport.report || {};
      const financials = report.financials || {};
      const txns = report.transactionHistory || [];
      this.currentProject = project;

      container.querySelector('#dtl-prj-code').textContent = project.project_code || 'PRJ';
      container.querySelector('#dtl-prj-stage').textContent = project.current_stage || 'ACTIVE';
      container.querySelector('#dtl-prj-name').textContent = project.name;
      
      const clientInfo = `Client: ${project.client_name || 'N/A'}` + 
        (project.client_contact || project.client_phone ? ` (${project.client_contact || project.client_phone})` : '') + 
        ` • Site: ${project.site_address}`;
      container.querySelector('#dtl-prj-client').textContent = clientInfo;

      const datesText = (project.start_date ? `Start: ${project.start_date}` : '') + 
        (project.expected_completion_date ? ` • Expected Completion: ${project.expected_completion_date}` : '');
      container.querySelector('#dtl-prj-dates').textContent = datesText;
      container.querySelector('#dtl-prj-desc').textContent = project.description || '';

      const contractVal = project.contract_value || financials.contractValue || 0;
      const incomeReceived = financials.totalIncome ?? 0;
      const expensesIncurred = financials.totalExpenses ?? 0;
      const balanceDue = financials.clientBalanceDue ?? Math.max(0, contractVal - incomeReceived);

      container.querySelector('#dtl-val-contract').textContent = `₹${contractVal.toLocaleString('en-IN')}`;
      container.querySelector('#dtl-val-income').textContent = `₹${incomeReceived.toLocaleString('en-IN')}`;
      container.querySelector('#dtl-val-expenses').textContent = `₹${expensesIncurred.toLocaleString('en-IN')}`;
      container.querySelector('#dtl-val-balance-due').textContent = `₹${balanceDue.toLocaleString('en-IN')}`;

      container.querySelector('#dtl-milestone-count').textContent = `${milestones.length} Stages`;

      const mListEl = container.querySelector('#dtl-milestones-list');
      if (milestones.length === 0) {
        mListEl.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 10px;">No milestones created yet.</div>`;
      } else {
        mListEl.innerHTML = milestones.map(m => `
          <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1; padding-right: 10px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 11px; font-weight: 800; color: var(--brand-navy-900);">${m.milestone_code || 'MS'}</span>
                <span style="font-size: 12px; font-weight: 700; color: var(--brand-navy-800);">${m.title}</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ${m.description ? m.description.substring(0, 75) + '...' : ''}
              </div>
            </div>
            <div style="text-align: right; min-width: 90px;">
              <strong style="font-size: 12px; color: var(--brand-navy-900);">₹${(m.invoice_amount || 0).toLocaleString('en-IN')}</strong>
              <div style="font-size: 10px; margin-top: 2px;">
                <span class="badge-status badge-${(m.status || 'not_started').toLowerCase()}">${m.status}</span>
              </div>
            </div>
          </div>
        `).join('');
      }

      // Render Recent Transactions
      container.querySelector('#dtl-txns-count').textContent = `${txns.length} Records`;
      const txListEl = container.querySelector('#dtl-project-txns');
      if (txns.length === 0) {
        txListEl.innerHTML = `<div style="font-size: 12px; color: var(--text-muted); padding: 8px;">No transactions recorded for this project yet.</div>`;
      } else {
        txListEl.innerHTML = txns.slice(0, 10).map(t => {
          const isIncome = t.type === 'INCOME';
          const isLabour = t.type === 'LABOUR_PAYMENT' || t.type === 'LABOUR';
          const badgeBg = isIncome ? '#ECFDF5' : (isLabour ? '#EEF2FF' : '#FEF2F2');
          const badgeColor = isIncome ? '#059669' : (isLabour ? '#4F46E5' : '#DC2626');
          const sign = isIncome ? '+' : '-';
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 12px;">
              <div style="flex: 1; min-width: 0; padding-right: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 10px; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; padding: 1px 5px; border-radius: 4px;">
                    ${t.type}
                  </span>
                  <span style="font-size: 11px; color: var(--text-muted);">${t.date || ''}</span>
                </div>
                <div style="font-weight: 600; color: var(--brand-navy-900); margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${t.description || t.category || 'Transaction'}
                </div>
              </div>
              <div style="font-weight: 800; color: ${isIncome ? '#059669' : '#DC2626'}; text-align: right; white-space: nowrap;">
                ${sign}₹${(t.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          `;
        }).join('');
      }

      detailsModal.style.display = 'flex';
    } catch (err) {
      await AppDialog.alert({ title: 'Error', message: 'Error fetching project details: ' + err.message });
    }
  }
};
