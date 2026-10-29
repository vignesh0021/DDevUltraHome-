/**
 * DDevUltraHome — Construction Progress & Site Tracking Screen
 */

import { BusinessApi } from '../businessApi.js';

export const ProgressScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Site Progress & Milestones</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Stage certifications, daily logs & weather reports</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Select Project</label>
          <select id="sel-progress-prj" class="form-control"></select>
        </div>

        <div id="progress-data-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Select a project to inspect progress...</div>
        </div>
      </div>
    `;

    const selPrj = container.querySelector('#sel-progress-prj');
    try {
      const prjRes = await BusinessApi.request('/projects');
      const projects = prjRes.projects || [];
      selPrj.innerHTML = projects.map(p => `<option value="${p.id}">${p.name} (${p.project_code})</option>`).join('');

      if (projects.length > 0) {
        await this.loadProjectProgress(container, projects[0].id);
      }

      selPrj.addEventListener('change', async () => {
        await this.loadProjectProgress(container, selPrj.value);
      });
    } catch (e) {
      selPrj.innerHTML = '<option value="">No projects</option>';
    }
  },

  async loadProjectProgress(container, prjId) {
    const dataContainer = container.querySelector('#progress-data-container');
    try {
      const prjRes = await BusinessApi.request(`/projects/${prjId}`);
      const { project, milestones, recentProgress } = prjRes;

      dataContainer.innerHTML = `
        <!-- Milestones Checklist -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 10px;">
            Contract Payment Milestones
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${(milestones || []).length === 0 ? `
              <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 16px; font-size: 12px; color: var(--text-muted);">
                No milestones defined for this contract yet.
              </div>
            ` : milestones.map(m => `
              <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 13px; font-weight: 700; color: var(--brand-navy-900);">${m.title}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Target: ${m.target_percentage}% • Billable: ₹${(m.invoice_amount || 0).toLocaleString('en-IN')} (${m.invoice_percentage}%)</div>
                </div>
                <span class="badge-status badge-${(m.status || 'NOT_STARTED').toLowerCase()}">${m.status}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Daily Site Logs -->
        <div>
          <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 10px;">
            Recent Daily Site Logs
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${(recentProgress || []).length === 0 ? `
              <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 16px; font-size: 12px; color: var(--text-muted);">
                No daily logs recorded yet. Site managers can log workforce counts and weather reports.
              </div>
            ` : recentProgress.map(u => `
              <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;">
                  <span style="color: var(--brand-navy-900);">${u.report_date}</span>
                  <span style="color: var(--color-success);">${u.completion_percentage}% Stage Completion</span>
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">${u.site_notes}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
                  👷 Workforce: ${u.workforce_count || 0} heads • ☀️ Weather: ${u.weather_condition || 'Clear'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (e) {
      dataContainer.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load progress: ${e.message}</div>`;
    }
  }
};
