/**
 * DDevUltraHome — Construction Progress & Site Tracking Screen
 * Civil Engineering Daily Progress Reports (DPR), Milestone Stage Certifications & Site Diary
 */

import { BusinessApi } from '../businessApi.js';
import { AppDialog } from '../components/appDialog.js';

export const ProgressScreen = {
  currentProjectId: null,

  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Site Diary & Milestones</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Daily logs (DPR), workforce counts & stage certifications</div>
          </div>
          <button id="btn-log-progress" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px; font-weight: 700;">
            + Log Site Entry
          </button>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Active Construction Site</label>
          <select id="sel-progress-prj" class="form-control" style="font-weight: 600;"></select>
        </div>

        <div id="progress-data-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Select a project to inspect progress...</div>
        </div>
      </div>

      <!-- Daily Progress Entry Modal (DPR) -->
      <div id="modal-new-dpr" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 300; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto; padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border-light); padding-bottom: 8px;">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Daily Site Progress Report (DPR)</h3>
              <div style="font-size: 11px; color: var(--text-muted);">Log workforce heads, weather, and work executed</div>
            </div>
            <button type="button" id="btn-close-dpr-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <form id="form-create-dpr">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Report Date *</label>
                <input type="date" id="inp-dpr-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label class="form-label">Stage Completion (%) *</label>
                <input type="number" id="inp-dpr-pct" class="form-control" min="0" max="100" step="0.5" required placeholder="e.g. 35">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Linked Contract Milestone</label>
              <select id="sel-dpr-milestone" class="form-control">
                <option value="">-- General Site Work (No Specific Milestone) --</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Total Workforce (Heads) *</label>
                <input type="number" id="inp-dpr-workforce" class="form-control" min="0" required placeholder="e.g. 14">
              </div>
              <div class="form-group">
                <label class="form-label">Weather Condition</label>
                <select id="sel-dpr-weather" class="form-control">
                  <option value="Sunny / Dry (Clear Sky)">Sunny / Dry</option>
                  <option value="Overcast / Moderate">Overcast / Moderate</option>
                  <option value="Heavy Rain / Monsoon Delay">Heavy Rain Delay</option>
                  <option value="Extreme Heat (>38°C)">Extreme Heat</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Work Executed Today (Civil Site Diary) *</label>
              <textarea id="inp-dpr-notes" class="form-control" rows="3" required placeholder="e.g. 1st floor roof beam shuttering completed, 12mm & 16mm Fe550D rebar binding 85% done, concrete cover blocks placed."></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Delay Reasons / Bottlenecks (Optional)</label>
              <input type="text" id="inp-dpr-delay" class="form-control" placeholder="e.g. Awaiting Dalmia cement 50 bags delivery / EB power cut">
            </div>

            <!-- Site Camera & Photo Attachment -->
            <div class="form-group" style="background: #F8FAFC; border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 12px;">
              <label class="form-label" style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                📸 Capture Site Inspection Photo
              </label>
              <input type="file" id="inp-dpr-camera" accept="image/*" capture="environment" class="form-control" style="font-size: 12px; padding: 6px;">
              <div id="dpr-photo-preview" style="display: none; margin-top: 8px;">
                <img id="img-dpr-preview" src="" alt="Site Photo" style="max-height: 120px; border-radius: 6px; object-fit: cover; border: 1px solid var(--border-light);">
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
              <button type="button" id="btn-cancel-dpr" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary" style="font-weight: 700;">Save Daily Site Log</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Milestone Certification Gate Modal -->
      <div id="modal-certify-milestone" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 300; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 460px; padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-light); padding-bottom: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Certify Contract Milestone</h3>
            <button type="button" id="btn-close-cert-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <form id="form-certify-milestone">
            <input type="hidden" id="inp-cert-milestone-id">
            <div class="form-group">
              <label class="form-label">Milestone Title</label>
              <input type="text" id="inp-cert-title" class="form-control" readonly style="background: #F8FAFC; font-weight: 700;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Certification Status *</label>
                <select id="sel-cert-status" class="form-control" required>
                  <option value="NOT_STARTED">NOT_STARTED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="INSPECTED">INSPECTED</option>
                  <option value="COMPLETED">COMPLETED (Stage Certified)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Certification Date</label>
                <input type="date" id="inp-cert-date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Inspection & Quality Certification Notes</label>
              <textarea id="inp-cert-notes" class="form-control" rows="2" placeholder="e.g. Concrete cube strength 28-day 25.4 N/mm2 certified by Er. Vignesh"></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
              <button type="button" id="btn-cancel-cert" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary" style="font-weight: 700;">Confirm Certification</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const selPrj = container.querySelector('#sel-progress-prj');
    try {
      const prjRes = await BusinessApi.request('/projects');
      const projects = prjRes.projects || [];
      selPrj.innerHTML = projects.map(p => `<option value="${p.id}">${p.name} (${p.project_code})</option>`).join('');

      if (projects.length > 0) {
        this.currentProjectId = projects[0].id;
        await this.loadProjectProgress(container, projects[0].id);
      }

      selPrj.addEventListener('change', async () => {
        this.currentProjectId = selPrj.value;
        await this.loadProjectProgress(container, selPrj.value);
      });
    } catch (e) {
      selPrj.innerHTML = '<option value="">No projects</option>';
    }

    this.initModals(container);
  },

  initModals(container) {
    const dprModal = container.querySelector('#modal-new-dpr');
    const certModal = container.querySelector('#modal-certify-milestone');

    // Backdrop dismissal
    if (dprModal) dprModal.onclick = (e) => { if (e.target === dprModal) dprModal.style.display = 'none'; };
    if (certModal) certModal.onclick = (e) => { if (e.target === certModal) certModal.style.display = 'none'; };

    container.querySelector('#btn-log-progress')?.addEventListener('click', async () => {
      await this.populateMilestoneDropdown(container);
      dprModal.style.display = 'flex';
    });

    container.querySelector('#btn-close-dpr-modal')?.addEventListener('click', () => {
      dprModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-dpr')?.addEventListener('click', () => {
      dprModal.style.display = 'none';
    });

    container.querySelector('#btn-close-cert-modal')?.addEventListener('click', () => {
      certModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-cert')?.addEventListener('click', () => {
      certModal.style.display = 'none';
    });

    // Camera preview
    const camInp = container.querySelector('#inp-dpr-camera');
    const prevContainer = container.querySelector('#dpr-photo-preview');
    const prevImg = container.querySelector('#img-dpr-preview');
    camInp?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          prevImg.src = re.target.result;
          prevContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });

    // Submit DPR
    container.querySelector('#form-create-dpr')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.currentProjectId) {
        await AppDialog.alert({ title: 'Project Required', message: 'Please select an active project first.' });
        return;
      }

      const payload = {
        projectId: this.currentProjectId,
        milestoneId: container.querySelector('#sel-dpr-milestone').value || null,
        reportDate: container.querySelector('#inp-dpr-date').value,
        completionPercentage: parseFloat(container.querySelector('#inp-dpr-pct').value) || 0,
        workforceCount: parseInt(container.querySelector('#inp-dpr-workforce').value, 10) || 0,
        weatherCondition: container.querySelector('#sel-dpr-weather').value,
        siteNotes: container.querySelector('#inp-dpr-notes').value.trim(),
        delayReason: container.querySelector('#inp-dpr-delay').value.trim() || undefined
      };

      try {
        await BusinessApi.request('/progress', 'POST', payload);
        await AppDialog.alert({ title: 'DPR Saved', message: '✅ Daily Site Progress Entry (DPR) saved successfully!' });
        dprModal.style.display = 'none';
        container.querySelector('#form-create-dpr').reset();
        prevContainer.style.display = 'none';
        await this.loadProjectProgress(container, this.currentProjectId);
      } catch (err) {
        await AppDialog.alert({ title: 'Save Failed', message: 'Failed to save daily log: ' + err.message });
      }
    });

    // Submit Milestone Certification
    container.querySelector('#form-certify-milestone')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mId = container.querySelector('#inp-cert-milestone-id').value;
      const payload = {
        status: container.querySelector('#sel-cert-status').value,
        actual_end_date: container.querySelector('#inp-cert-date').value,
        notes: container.querySelector('#inp-cert-notes').value.trim()
      };

      try {
        await BusinessApi.request(`/milestones/${mId}`, 'PATCH', payload);
        await AppDialog.alert({ title: 'Milestone Updated', message: '✅ Milestone stage status updated!' });
        certModal.style.display = 'none';
        await this.loadProjectProgress(container, this.currentProjectId);
      } catch (err) {
        await AppDialog.alert({ title: 'Update Failed', message: 'Failed to update milestone: ' + err.message });
      }
    });
  },

  async populateMilestoneDropdown(container) {
    const sel = container.querySelector('#sel-dpr-milestone');
    if (!this.currentProjectId) return;
    try {
      const prjRes = await BusinessApi.request(`/projects/${this.currentProjectId}`);
      const milestones = prjRes.milestones || [];
      sel.innerHTML = '<option value="">-- General Site Work (No Specific Milestone) --</option>' +
        milestones.map(m => `<option value="${m.id}">${m.milestone_code || 'MS'}: ${m.title} (${m.status})</option>`).join('');
    } catch (e) {
      sel.innerHTML = '<option value="">-- General Site Work --</option>';
    }
  },

  async loadProjectProgress(container, prjId) {
    const dataContainer = container.querySelector('#progress-data-container');
    try {
      const prjRes = await BusinessApi.request(`/projects/${prjId}`);
      const { project, milestones, recentProgress } = prjRes;

      dataContainer.innerHTML = `
        <!-- Milestones Checklist & Certification Gate -->
        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900);">
              Contract Payment Milestones (${(milestones || []).length} Stages)
            </div>
            <span style="font-size: 11px; color: var(--brand-gold-600); font-weight: 700;">Schedule B Controls</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${(milestones || []).length === 0 ? `
              <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 16px; font-size: 12px; color: var(--text-muted); text-align: center;">
                No milestones defined for this contract yet.
              </div>
            ` : milestones.map(m => `
              <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 11px; font-weight: 800; color: var(--brand-navy-900); background: #F1F5F9; padding: 2px 6px; border-radius: 4px;">
                        ${m.milestone_code || 'MS'}
                      </span>
                      <div style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900);">${m.title}</div>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                      Target: <strong>${m.target_percentage}%</strong> • Billable: <strong style="color: var(--brand-navy-900);">₹${(m.invoice_amount || 0).toLocaleString('en-IN')}</strong> (${m.invoice_percentage || 0}%)
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <span class="badge-status badge-${(m.status || 'NOT_STARTED').toLowerCase()}">${m.status}</span>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-light);">
                  <div style="font-size: 11px; color: var(--text-secondary);">
                    ${m.actual_end_date ? `Completed: ${m.actual_end_date}` : 'Status pending certification'}
                  </div>
                  <button type="button" class="btn-certify-milestone btn-outline" data-id="${m.id}" data-title="${m.title}" data-status="${m.status}" style="min-height: 30px; font-size: 11px; padding: 0 10px; font-weight: 700;">
                    ⚙️ Certify Stage
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Daily Site Logs (DPR) -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900);">
              Daily Site Diary & Workforce Logs
            </div>
            <span style="font-size: 11px; color: var(--text-muted);">${(recentProgress || []).length} Recorded Entries</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${(recentProgress || []).length === 0 ? `
              <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 20px; font-size: 12px; color: var(--text-muted); text-align: center;">
                No daily logs recorded yet. Click "+ Log Site Entry" to log workforce counts, weather, and civil works executed.
              </div>
            ` : recentProgress.map(u => `
              <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700;">
                  <span style="color: var(--brand-navy-900); font-size: 13px;">📅 ${u.report_date}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: var(--color-success); background: #F0FDF4; padding: 2px 8px; border-radius: 4px; font-weight: 800;">
                      ${u.completion_percentage}% Completion
                    </span>
                    <button type="button" class="btn-delete-prog" data-id="${u.id}" title="Delete log" style="background: none; border: none; font-size: 14px; cursor: pointer; color: var(--text-muted); padding: 0 4px;">
                      🗑️
                    </button>
                  </div>
                </div>
                <div style="font-size: 13px; color: var(--brand-navy-900); margin-top: 6px; line-height: 1.4;">
                  ${u.site_notes}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 8px; padding-top: 6px; border-top: 1px solid #F1F5F9; flex-wrap: wrap; gap: 6px;">
                  <span>👷 Workforce: <strong>${u.workforce_count || 0} heads</strong></span>
                  <span>☀️ ${u.weather_condition || 'Clear'}</span>
                  ${u.delay_reason ? `<span style="color: #DC2626;">⚠️ ${u.delay_reason}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // Wire Certify buttons
      dataContainer.querySelectorAll('.btn-certify-milestone').forEach(btn => {
        btn.addEventListener('click', () => {
          const mId = btn.dataset.id;
          const title = btn.dataset.title;
          const status = btn.dataset.status;

          const certModal = container.querySelector('#modal-certify-milestone');
          container.querySelector('#inp-cert-milestone-id').value = mId;
          container.querySelector('#inp-cert-title').value = title;
          container.querySelector('#sel-cert-status').value = status || 'IN_PROGRESS';
          certModal.style.display = 'flex';
        });
      });

      // Wire Delete Progress buttons
      dataContainer.querySelectorAll('.btn-delete-prog').forEach(btn => {
        btn.addEventListener('click', async () => {
          const progId = btn.dataset.id;
          const confirmed = await AppDialog.confirm({
            title: 'Delete Progress Entry',
            message: 'Delete this site diary entry?\n(This action cannot be undone)',
            confirmText: 'Delete Entry',
            isDestructive: true
          });
          if (confirmed) {
            try {
              await BusinessApi.request(`/progress/${progId}`, 'DELETE');
              await AppDialog.alert({ title: 'Entry Deleted', message: '🗑️ Site diary entry deleted.' });
              await this.loadProjectProgress(container, prjId);
            } catch (err) {
              await AppDialog.alert({ title: 'Delete Failed', message: 'Failed to delete log: ' + err.message });
            }
          }
        });
      });

    } catch (e) {
      dataContainer.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load progress: ${e.message}</div>`;
    }
  }
};
