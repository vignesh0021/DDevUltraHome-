/**
 * DDevUltraHome — Labour Attendance, Wages & Ledger Screen
 * 
 * Tamil Nadu Construction Labour & Daily Wage Settlement System.
 * Zero horizontal scrolling, high-contrast, touch-optimized.
 */

import { BusinessApi } from '../businessApi.js';
import { AppDialog } from '../components/appDialog.js';
import { openQuickCalculator } from '../components/quickCalculator.js';
import { deliverPdf } from '../printDoc.js';
import { i18n } from '../i18n.js';

export const LabourScreen = {
  activeSubTab: 'attendance', // 'attendance' | 'workers' | 'payouts' | 'statement'
  selectedDate: new Date().toISOString().split('T')[0],
  selectedProjectId: '',
  selectedWorkerId: '',

  async render(container) {
    this.container = container;
    const isTa = i18n.lang === 'ta';

    const [workersRes, projectsRes, accountsRes] = await Promise.all([
      BusinessApi.request('/labour/workers'),
      BusinessApi.request('/projects'),
      BusinessApi.request('/settings/company')
    ]);

    this.workers = workersRes?.workers || [];
    this.projects = (projectsRes?.projects || []).filter(p => p.status === 'ACTIVE');
    this.accounts = accountsRes?.accounts || [];

    if (!this.selectedWorkerId && this.workers.length > 0) {
      this.selectedWorkerId = this.workers[0].id;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Labour Sub-Navigation Tabs -->
        <div style="display: flex; background: var(--bg-surface, #F1F5F9); padding: 4px; border-radius: 10px; gap: 4px; border: 1px solid var(--border-light, #E2E8F0);">
          <button id="lsub-att" style="flex: 1; min-height: 38px; border-radius: 7px; border: none; font-size: 11px; font-weight: 700; cursor: pointer; ${this.activeSubTab === 'attendance' ? 'background: #0B192C; color: #FFF;' : 'background: transparent; color: #475569;'}">
            📋 ${isTa ? 'வருகை' : 'Daily Attendance'}
          </button>
          <button id="lsub-workers" style="flex: 1; min-height: 38px; border-radius: 7px; border: none; font-size: 11px; font-weight: 700; cursor: pointer; ${this.activeSubTab === 'workers' ? 'background: #0B192C; color: #FFF;' : 'background: transparent; color: #475569;'}">
            👷 ${isTa ? 'ஆட்கள்' : 'Workers'}
          </button>
          <button id="lsub-payouts" style="flex: 1; min-height: 38px; border-radius: 7px; border: none; font-size: 11px; font-weight: 700; cursor: pointer; ${this.activeSubTab === 'payouts' ? 'background: #0B192C; color: #FFF;' : 'background: transparent; color: #475569;'}">
            💵 ${isTa ? 'பட்டுவாடா' : 'Payouts & Adv'}
          </button>
          <button id="lsub-statement" style="flex: 1; min-height: 38px; border-radius: 7px; border: none; font-size: 11px; font-weight: 700; cursor: pointer; ${this.activeSubTab === 'statement' ? 'background: #0B192C; color: #FFF;' : 'background: transparent; color: #475569;'}">
            📄 ${isTa ? 'கணக்கு' : 'Ledger & PDF'}
          </button>
        </div>

        <!-- Mount for Active Labour Sub-Tab -->
        <div id="labour-tab-content"></div>
      </div>
    `;

    this.bindTabButtons();
    await this.renderActiveTab();
  },

  bindTabButtons() {
    const attBtn = this.container.querySelector('#lsub-att');
    const wrkBtn = this.container.querySelector('#lsub-workers');
    const payBtn = this.container.querySelector('#lsub-payouts');
    const stmBtn = this.container.querySelector('#lsub-statement');

    attBtn?.addEventListener('click', async () => {
      this.activeSubTab = 'attendance';
      this.updateSubTabButtons();
      await this.renderActiveTab();
    });
    wrkBtn?.addEventListener('click', async () => {
      this.activeSubTab = 'workers';
      this.updateSubTabButtons();
      await this.renderActiveTab();
    });
    payBtn?.addEventListener('click', async () => {
      this.activeSubTab = 'payouts';
      this.updateSubTabButtons();
      await this.renderActiveTab();
    });
    stmBtn?.addEventListener('click', async () => {
      this.activeSubTab = 'statement';
      this.updateSubTabButtons();
      await this.renderActiveTab();
    });
  },

  updateSubTabButtons() {
    ['att', 'workers', 'payouts', 'statement'].forEach(id => {
      const btn = this.container.querySelector(`#lsub-${id}`);
      if (!btn) return;
      const key = id === 'att' ? 'attendance' : id;
      if (this.activeSubTab === key) {
        btn.style.background = '#0B192C';
        btn.style.color = '#FFFFFF';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = '#475569';
      }
    });
  },

  async renderActiveTab() {
    const mount = this.container.querySelector('#labour-tab-content');
    if (!mount) return;

    if (this.activeSubTab === 'attendance') {
      await this.renderAttendanceTab(mount);
    } else if (this.activeSubTab === 'workers') {
      await this.renderWorkersTab(mount);
    } else if (this.activeSubTab === 'payouts') {
      await this.renderPayoutsTab(mount);
    } else if (this.activeSubTab === 'statement') {
      await this.renderStatementTab(mount);
    }
  },

  /**
   * 1. DAILY ATTENDANCE TAB
   */
  async renderAttendanceTab(mount) {
    const isTa = i18n.lang === 'ta';
    const attRes = await BusinessApi.request(`/labour/attendance?date=${this.selectedDate}${this.selectedProjectId ? `&projectId=${this.selectedProjectId}` : ''}`);
    const todayRecords = attRes?.attendance || [];

    const presentCount = todayRecords.filter(r => r.status === 'PRESENT').length;
    const halfCount = todayRecords.filter(r => r.status === 'HALF_DAY').length;
    const absentCount = todayRecords.filter(r => r.status === 'ABSENT').length;
    const totalUnits = todayRecords.reduce((s, r) => s + (parseFloat(r.units) || 0), 0);
    const totalDailyEarned = todayRecords.reduce((s, r) => s + (parseFloat(r.earned_amount) || 0) + (parseFloat(r.overtime_amount) || 0), 0);

    mount.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- Filter Controls -->
        <div style="background: var(--bg-card, #FFF); padding: 12px; border-radius: 12px; border: 1px solid var(--border-light, #E2E8F0); display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; gap: 8px;">
            <div style="flex: 1;">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">
                ${isTa ? 'தேதி' : 'Attendance Date'}
              </label>
              <input type="date" id="att-date-picker" class="form-control" value="${this.selectedDate}" style="width: 100%; font-size: 13px;">
            </div>
            <div style="flex: 1.2;">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">
                ${isTa ? 'தளம் / திட்டம்' : 'Project Site'}
              </label>
              <select id="att-project-picker" class="form-control" style="width: 100%; font-size: 13px;">
                <option value="">-- ${isTa ? 'அனைத்து திட்டங்கள்' : 'General / All Sites'} --</option>
                ${this.projects.map(p => `<option value="${p.id}" ${p.id === this.selectedProjectId ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Summary Metric Cards -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding-top: 6px; border-top: 1px solid var(--border-light, #E2E8F0);">
            <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 6px 8px; text-align: center;">
              <div style="font-size: 10px; font-weight: 700; color: #15803D;">PRESENT</div>
              <div style="font-size: 15px; font-weight: 900; color: #166534;">${presentCount} <span style="font-size: 11px; font-weight: 500;">(${halfCount} half)</span></div>
            </div>
            <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 6px 8px; text-align: center;">
              <div style="font-size: 10px; font-weight: 700; color: #1D4ED8;">TOTAL UNITS</div>
              <div style="font-size: 15px; font-weight: 900; color: #1E40AF;">${totalUnits}</div>
            </div>
            <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 6px 8px; text-align: center;">
              <div style="font-size: 10px; font-weight: 700; color: #B45309;">EARNED WAGES</div>
              <div style="font-size: 15px; font-weight: 900; color: #92400E;">₹${totalDailyEarned.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

        <!-- Worker Roster List -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
            ${isTa ? 'ஆட்கள் வருகை பட்டியல்' : 'Worker Daily Roster'} (${this.workers.length})
          </span>
          <button id="btn-quick-mark-all" style="background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; color: #334155; cursor: pointer;">
            ✓ Mark All Present
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${this.workers.length === 0 ? `
            <div style="text-align: center; padding: 30px; background: var(--bg-card, #FFF); border-radius: 12px; border: 1px dashed #CBD5E1;">
              <p style="color: #64748B; font-size: 13px; margin: 0 0 10px;">No labour profiles registered yet.</p>
              <button id="btn-empty-add-worker" class="btn-primary" style="padding: 6px 14px; font-size: 12px;">+ Add First Worker</button>
            </div>
          ` : this.workers.map(w => {
            const rec = todayRecords.find(r => r.worker_id === w.id);
            const status = rec ? rec.status : null;
            return `
              <div class="worker-roster-row" data-worker-id="${w.id}" style="background: var(--bg-card, #FFF); border: 1px solid ${status ? (status === 'PRESENT' ? '#86EFAC' : (status === 'HALF_DAY' ? '#FDE047' : '#FECACA')) : 'var(--border-light, #E2E8F0)'}; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">${w.name}</span>
                    <span style="font-size: 10px; font-weight: 700; background: #EEF2FF; color: #4338CA; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${w.trade}</span>
                  </div>
                  <div style="font-size: 12px; font-weight: 800; color: #047857; font-family: monospace;">
                    ₹${w.daily_wage || 0}/day
                  </div>
                </div>

                <!-- Status Buttons -->
                <div style="display: flex; gap: 4px;">
                  <button class="btn-att-status" data-worker-id="${w.id}" data-status="PRESENT" style="flex: 1; min-height: 32px; border-radius: 6px; border: 1px solid #86EFAC; font-size: 11px; font-weight: 700; cursor: pointer; ${status === 'PRESENT' ? 'background: #16A34A; color: white;' : 'background: #F0FDF4; color: #166534;'}">
                    Full (1.0)
                  </button>
                  <button class="btn-att-status" data-worker-id="${w.id}" data-status="HALF_DAY" style="flex: 1; min-height: 32px; border-radius: 6px; border: 1px solid #FDE047; font-size: 11px; font-weight: 700; cursor: pointer; ${status === 'HALF_DAY' ? 'background: #CA8A04; color: white;' : 'background: #FEFCE8; color: #854D0E;'}">
                    Half (0.5)
                  </button>
                  <button class="btn-att-status" data-worker-id="${w.id}" data-status="ABSENT" style="flex: 1; min-height: 32px; border-radius: 6px; border: 1px solid #FECACA; font-size: 11px; font-weight: 700; cursor: pointer; ${status === 'ABSENT' ? 'background: #DC2626; color: white;' : 'background: #FEF2F2; color: #991B1B;'}">
                    Absent (0)
                  </button>
                  <button class="btn-att-status" data-worker-id="${w.id}" data-status="LEAVE" style="flex: 1; min-height: 32px; border-radius: 6px; border: 1px solid #E2E8F0; font-size: 11px; font-weight: 700; cursor: pointer; ${status === 'LEAVE' ? 'background: #64748B; color: white;' : 'background: #F8FAFC; color: #475569;'}">
                    Leave
                  </button>
                </div>

                ${rec && (rec.earned_amount > 0 || rec.overtime_hours > 0) ? `
                  <div style="font-size: 11px; color: #64748B; display: flex; justify-content: space-between; border-top: 1px dashed #E2E8F0; padding-top: 4px;">
                    <span>Earned: <strong>₹${rec.earned_amount}</strong>${rec.overtime_amount > 0 ? ` + OT ₹${rec.overtime_amount}` : ''}</span>
                    <span style="color: #15803D;">✓ Recorded</span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bindings
    const datePicker = mount.querySelector('#att-date-picker');
    datePicker?.addEventListener('change', async (e) => {
      this.selectedDate = e.target.value;
      await this.renderAttendanceTab(mount);
    });

    const prjPicker = mount.querySelector('#att-project-picker');
    prjPicker?.addEventListener('change', async (e) => {
      this.selectedProjectId = e.target.value;
      await this.renderAttendanceTab(mount);
    });

    mount.querySelector('#btn-empty-add-worker')?.addEventListener('click', () => {
      this.openWorkerModal();
    });

    mount.querySelector('#btn-quick-mark-all')?.addEventListener('click', async () => {
      const confirm = await AppDialog.confirm({
        title: 'Mark All Present',
        message: `Record Present (1.0 day) for all ${this.workers.length} active workers on ${this.selectedDate}?`
      });
      if (!confirm) return;

      for (const w of this.workers) {
        await BusinessApi.request('/labour/attendance', 'POST', {
          workerId: w.id,
          projectId: this.selectedProjectId || null,
          attendanceDate: this.selectedDate,
          status: 'PRESENT',
          allowOverwrite: true
        });
      }
      await this.renderAttendanceTab(mount);
    });

    mount.querySelectorAll('.btn-att-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const workerId = btn.dataset.workerId;
        const status = btn.dataset.status;

        try {
          await BusinessApi.request('/labour/attendance', 'POST', {
            workerId,
            projectId: this.selectedProjectId || null,
            attendanceDate: this.selectedDate,
            status,
            allowOverwrite: true
          });
          await this.renderAttendanceTab(mount);
        } catch (err) {
          await AppDialog.alert({ title: 'Attendance Error', message: err.message });
        }
      });
    });
  },

  /**
   * 2. WORKERS DIRECTORY TAB
   */
  async renderWorkersTab(mount) {
    const isTa = i18n.lang === 'ta';
    const workersRes = await BusinessApi.request('/labour/workers');
    this.workers = workersRes?.workers || [];

    mount.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- Header Actions -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
            ${isTa ? 'பணியாளர் சுயவிவரங்கள்' : 'Labour Directory'} (${this.workers.length})
          </span>
          <button id="btn-add-worker" class="btn-primary" style="padding: 6px 14px; font-size: 12px; font-weight: 700; background: #2563EB; color: white;">
            + ${isTa ? 'புதிய ஆள்' : 'Add Worker'}
          </button>
        </div>

        <!-- Worker Cards -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${this.workers.length === 0 ? `
            <div style="text-align: center; padding: 40px; background: var(--bg-card, #FFF); border-radius: 12px; border: 1px dashed #CBD5E1;">
              <p style="color: #64748B; font-size: 13px;">No workers registered yet. Tap "+ Add Worker" to begin.</p>
            </div>
          ` : this.workers.map(w => {
            const stats = w.stats || {};
            const bal = parseFloat(stats.balancePayable) || 0;
            return `
              <div style="background: var(--bg-card, #FFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">${w.name}</span>
                      <span style="font-size: 10px; font-weight: 700; background: #EEF2FF; color: #4338CA; padding: 2px 6px; border-radius: 4px;">${w.trade}</span>
                    </div>
                    <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
                      ${w.worker_code} • ${w.phone || 'No phone'} • Joined: ${w.joining_date || 'N/A'}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 13px; font-weight: 800; color: #047857;">₹${w.daily_wage || 0}/day</div>
                    <div style="font-size: 10px; color: #64748B;">${w.wage_type || 'DAILY'}</div>
                  </div>
                </div>

                <!-- Metrics Strip -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); background: var(--bg-surface, #F8FAFC); padding: 8px; border-radius: 8px; border: 1px solid var(--border-light, #E2E8F0); gap: 4px; text-align: center;">
                  <div>
                    <div style="font-size: 10px; color: #64748B;">Earned</div>
                    <div style="font-size: 12px; font-weight: 800; color: #0F172A;">₹${(stats.totalEarned || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: #64748B;">Paid</div>
                    <div style="font-size: 12px; font-weight: 800; color: #1D4ED8;">₹${(stats.totalPaid || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: #64748B;">Balance Due</div>
                    <div style="font-size: 12px; font-weight: 900; color: ${bal > 0 ? '#DC2626' : '#15803D'};">
                      ₹${bal.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <!-- Card Actions -->
                <div style="display: flex; gap: 6px; border-top: 1px solid var(--border-light, #E2E8F0); padding-top: 8px;">
                  <button class="btn-pay-worker btn-outline" data-id="${w.id}" data-name="${w.name}" data-balance="${bal}" style="flex: 1; padding: 6px; font-size: 11px; font-weight: 700; color: #15803D; border-color: #86EFAC;">
                    💵 Pay Advance / Wage
                  </button>
                  <button class="btn-view-ledger btn-outline" data-id="${w.id}" style="padding: 6px 12px; font-size: 11px; font-weight: 700;">
                    📄 Ledger
                  </button>
                  <button class="btn-edit-worker btn-outline" data-id="${w.id}" style="padding: 6px 10px; font-size: 11px;">
                    ✏️
                  </button>
                  <button class="btn-del-worker btn-outline" data-id="${w.id}" style="padding: 6px 10px; font-size: 11px; color: #DC2626; border-color: #FECACA;">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    mount.querySelector('#btn-add-worker')?.addEventListener('click', () => {
      this.openWorkerModal();
    });

    mount.querySelectorAll('.btn-edit-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        const worker = this.workers.find(w => w.id === btn.dataset.id);
        if (worker) this.openWorkerModal(worker);
      });
    });

    mount.querySelectorAll('.btn-del-worker').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirm = await AppDialog.confirm({
          title: 'Archive Worker',
          message: 'Are you sure you want to deactivate and archive this labour profile?',
          isDestructive: true
        });
        if (!confirm) return;
        await BusinessApi.request(`/labour/workers/${btn.dataset.id}`, 'DELETE');
        await this.renderWorkersTab(mount);
      });
    });

    mount.querySelectorAll('.btn-pay-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openPaymentModal({
          workerId: btn.dataset.id,
          workerName: btn.dataset.name,
          balance: btn.dataset.balance
        });
      });
    });

    mount.querySelectorAll('.btn-view-ledger').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.selectedWorkerId = btn.dataset.id;
        this.activeSubTab = 'statement';
        this.updateSubTabButtons();
        await this.renderActiveTab();
      });
    });
  },

  /**
   * 3. PAYOUTS & ADVANCES TAB
   */
  async renderPayoutsTab(mount) {
    const isTa = i18n.lang === 'ta';
    const payRes = await BusinessApi.request('/labour/payments');
    const payments = payRes?.payments || [];

    mount.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
            ${isTa ? 'பட்டுவாடா & முன்பணம்' : 'Wage Disbursements & Advances'} (${payments.length})
          </span>
          <button id="btn-record-disbursement" class="btn-primary" style="padding: 6px 14px; font-size: 12px; font-weight: 700; background: #16A34A; color: white;">
            + ${isTa ? 'புதிய பட்டுவாடா' : 'Record Payment'}
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${payments.length === 0 ? `
            <div style="text-align: center; padding: 40px; background: var(--bg-card, #FFF); border-radius: 12px; border: 1px dashed #CBD5E1;">
              <p style="color: #64748B; font-size: 13px;">No wage payments or advances recorded yet.</p>
            </div>
          ` : payments.map(p => `
            <div style="background: var(--bg-card, #FFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">${p.worker_name}</span>
                  <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; ${p.payment_type === 'ADVANCE' ? 'background: #FEF3C7; color: #92400E;' : 'background: #DCFCE7; color: #166534;'}">
                    ${p.payment_type}
                  </span>
                </div>
                <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
                  ${p.payment_date} • Mode: ${p.payment_mode} • ${p.project_name || 'General Site'}
                </div>
                ${p.notes ? `<div style="font-size: 11px; color: #475569; margin-top: 2px; font-style: italic;">"${p.notes}"</div>` : ''}
              </div>
              <div style="text-align: right;">
                <div style="font-size: 15px; font-weight: 900; color: #16A34A; font-family: monospace;">
                  ₹${(parseFloat(p.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <button class="btn-void-payment" data-id="${p.id}" style="background: transparent; border: none; color: #DC2626; font-size: 11px; font-weight: 700; cursor: pointer; padding: 2px 4px; margin-top: 4px;">
                  Void ✕
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    mount.querySelector('#btn-record-disbursement')?.addEventListener('click', () => {
      this.openPaymentModal();
    });

    mount.querySelectorAll('.btn-void-payment').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirm = await AppDialog.confirm({
          title: 'Void Labour Payment',
          message: 'Void this disbursement and restore financial account balance?',
          isDestructive: true
        });
        if (!confirm) return;
        await BusinessApi.request(`/labour/payments/${btn.dataset.id}`, 'DELETE');
        await this.renderPayoutsTab(mount);
      });
    });
  },

  /**
   * 4. WORKER LEDGER & WAGE STATEMENT TAB
   */
  async renderStatementTab(mount) {
    const isTa = i18n.lang === 'ta';
    if (!this.selectedWorkerId && this.workers.length > 0) {
      this.selectedWorkerId = this.workers[0].id;
    }

    const [statementRes, ledgerRes] = await Promise.all([
      this.selectedWorkerId ? BusinessApi.request(`/labour/statement/${this.selectedWorkerId}`) : null,
      this.selectedWorkerId ? BusinessApi.request(`/labour/ledger/${this.selectedWorkerId}`) : null
    ]);

    const statement = statementRes?.statement;
    const ledger = ledgerRes?.ledger || [];
    const worker = statement?.worker || this.workers.find(w => w.id === this.selectedWorkerId);
    const summary = statement?.summary || {};

    mount.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- Worker Picker Bar -->
        <div style="background: var(--bg-card, #FFF); padding: 12px; border-radius: 12px; border: 1px solid var(--border-light, #E2E8F0); display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 11px; font-weight: 700; color: #64748B;">Select Worker</label>
          <select id="sel-statement-worker" class="form-control" style="width: 100%; font-size: 13px;">
            ${this.workers.map(w => `<option value="${w.id}" ${w.id === this.selectedWorkerId ? 'selected' : ''}>${w.name} (${w.trade} - ${w.worker_code})</option>`).join('')}
          </select>
        </div>

        ${worker ? `
          <!-- Summary Statement Card -->
          <div style="background: var(--bg-card, #FFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-light, #E2E8F0); padding-bottom: 10px;">
              <div>
                <span style="font-size: 16px; font-weight: 900; color: var(--brand-navy-900, #0B192C);">${worker.name}</span>
                <span style="font-size: 10px; font-weight: 700; background: #EEF2FF; color: #4338CA; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${worker.trade}</span>
                <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Rate: ₹${worker.dailyWage || worker.daily_wage || 0}/day</div>
              </div>
              <button id="btn-export-wage-pdf" class="btn-primary" style="padding: 6px 12px; font-size: 12px; font-weight: 700; background: #0B192C; color: white; display: flex; align-items: center; gap: 4px;">
                <span>📄 Share PDF</span>
              </button>
            </div>

            <!-- Breakdown Grid -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <div style="background: var(--bg-surface, #F8FAFC); padding: 8px; border-radius: 8px; border: 1px solid var(--border-light, #E2E8F0);">
                <div style="font-size: 11px; color: #64748B;">Days Worked</div>
                <div style="font-size: 14px; font-weight: 800; color: #0F172A;">${summary.totalDaysWorked || 0} days</div>
                <div style="font-size: 10px; color: #94A3B8;">(${summary.presentDays || 0} full, ${summary.halfDays || 0} half)</div>
              </div>
              <div style="background: #F0FDF4; padding: 8px; border-radius: 8px; border: 1px solid #BBF7D0;">
                <div style="font-size: 11px; color: #166534;">Gross Wages Earned</div>
                <div style="font-size: 14px; font-weight: 900; color: #15803D;">₹${(summary.grossEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div style="background: #FFFBEB; padding: 8px; border-radius: 8px; border: 1px solid #FDE68A;">
                <div style="font-size: 11px; color: #92400E;">Advances Paid</div>
                <div style="font-size: 14px; font-weight: 800; color: #B45309;">₹${(summary.advancesPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div style="background: #EFF6FF; padding: 8px; border-radius: 8px; border: 1px solid #BFDBFE;">
                <div style="font-size: 11px; color: #1E40AF;">Wages Settled</div>
                <div style="font-size: 14px; font-weight: 800; color: #1D4ED8;">₹${(summary.wagesPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            <!-- Net Payable Banner -->
            <div style="background: #F8FAFC; border: 2px solid ${summary.netPayable > 0 ? '#EF4444' : '#10B981'}; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 12px; font-weight: 700; color: #475569;">Outstanding Balance:</span>
                <div style="font-size: 10px; color: #94A3B8;">Earned − Disbursed</div>
              </div>
              <div style="font-size: 18px; font-weight: 900; color: ${summary.netPayable > 0 ? '#DC2626' : '#16A34A'}; font-family: monospace;">
                ₹${(summary.netPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <!-- Chronological Ledger -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
              Chronological Audit Ledger (${ledger.length} entries)
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${ledger.length === 0 ? `
              <div style="text-align: center; padding: 20px; color: #94A3B8; font-size: 12px;">No activity recorded for this worker yet.</div>
            ` : ledger.map(entry => `
              <div style="background: var(--bg-card, #FFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900, #0B192C);">${entry.description}</div>
                  <div style="font-size: 10px; color: #64748B;">${entry.date} ${entry.project_name ? `• ${entry.project_name}` : ''}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 12px; font-weight: 800; ${entry.credit_amount > 0 ? 'color: #16A34A;' : 'color: #DC2626;'}">
                    ${entry.credit_amount > 0 ? `+₹${entry.credit_amount.toLocaleString('en-IN')}` : `−₹${entry.debit_amount.toLocaleString('en-IN')}`}
                  </div>
                  <div style="font-size: 10px; color: #94A3B8;">Bal: ₹${(entry.balance || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    mount.querySelector('#sel-statement-worker')?.addEventListener('change', async (e) => {
      this.selectedWorkerId = e.target.value;
      await this.renderStatementTab(mount);
    });

    mount.querySelector('#btn-export-wage-pdf')?.addEventListener('click', async () => {
      await this.exportWagePdf(worker, summary, ledger);
    });
  },

  /**
   * PDF Generation for Wage Statement using deliverPdf
   */
  async exportWagePdf(worker, summary, ledger) {
    const filename = `Wage_Statement_${worker.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Build PDF content lines
    const pdfLines = [
      'D DEV ULTRA HOMES - LABOUR WAGE STATEMENT',
      '==================================================',
      `Worker Name : ${worker.name}`,
      `Worker Code : ${worker.code || worker.worker_code || 'N/A'}`,
      `Trade       : ${worker.trade}`,
      `Daily Rate  : INR ${(worker.dailyWage || worker.daily_wage || 0).toLocaleString('en-IN')}`,
      `Period      : All Time (To ${new Date().toISOString().split('T')[0]})`,
      '--------------------------------------------------',
      'SUMMARY OF WAGES & ATTENDANCE:',
      `  Total Days Worked     : ${summary.totalDaysWorked || 0} days`,
      `  Gross Wages Earned    : INR ${(summary.grossEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `  Total Advances Paid   : INR ${(summary.advancesPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `  Total Wages Settled   : INR ${(summary.wagesPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `  Total Disbursed       : INR ${(summary.totalDisbursed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `  OUTSTANDING PAYABLE   : INR ${(summary.netPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      '--------------------------------------------------',
      'TRANSACTION AUDIT LEDGER:',
      ...ledger.slice(-20).map(e => 
        `  ${e.date} | ${e.description.padEnd(28).slice(0, 28)} | ${e.credit_amount > 0 ? `+${e.credit_amount}` : `-${e.debit_amount}`}`
      ),
      '==================================================',
      'Generated automatically by DDevUltraHome App',
      `Date: ${new Date().toLocaleString()}`
    ];

    try {
      await deliverPdf({ filename, lines: pdfLines });
    } catch (err) {
      await AppDialog.alert({ title: 'PDF Export Notice', message: err.message });
    }
  },

  /**
   * Modal: Add or Edit Worker
   */
  openWorkerModal(existing = null) {
    const isEdit = !!existing;
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 10000;
      display: flex; align-items: center; justify-content: center; padding: 14px;
      backdrop-filter: blur(2px);
    `;

    overlay.innerHTML = `
      <div style="background: var(--bg-card, #FFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px; width: 100%; max-width: 420px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
          ${isEdit ? 'Edit Labour Profile' : 'Add New Labour Worker'}
        </h3>

        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Worker Full Name *</label>
          <input type="text" id="m-wrk-name" class="form-control" placeholder="e.g. Murugan M" value="${existing?.name || ''}" style="width: 100%; font-size: 13px;">
        </div>

        <div style="display: flex; gap: 8px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Trade / Skill *</label>
            <select id="m-wrk-trade" class="form-control" style="width: 100%; font-size: 13px;">
              ${['MASON', 'CARPENTER', 'PAINTER', 'HELPER', 'BAR_BENDER', 'ELECTRICIAN', 'PLUMBER', 'WELDER', 'OTHER'].map(t => `
                <option value="${t}" ${existing?.trade === t ? 'selected' : ''}>${t}</option>
              `).join('')}
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Daily Wage Rate (₹) *</label>
            <input type="number" id="m-wrk-wage" class="form-control" placeholder="e.g. 950" value="${existing?.daily_wage || existing?.dailyWage || ''}" style="width: 100%; font-size: 13px;">
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Phone Number</label>
            <input type="tel" id="m-wrk-phone" class="form-control" placeholder="10-digit mobile" value="${existing?.phone || ''}" style="width: 100%; font-size: 13px;">
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Wage Arrangement</label>
            <select id="m-wrk-type" class="form-control" style="width: 100%; font-size: 13px;">
              <option value="DAILY" ${existing?.wage_type === 'DAILY' ? 'selected' : ''}>Daily</option>
              <option value="WEEKLY" ${existing?.wage_type === 'WEEKLY' ? 'selected' : ''}>Weekly</option>
              <option value="MONTHLY" ${existing?.wage_type === 'MONTHLY' ? 'selected' : ''}>Monthly</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Joining Date</label>
          <input type="date" id="m-wrk-joindate" class="form-control" value="${existing?.joining_date || new Date().toISOString().split('T')[0]}" style="width: 100%; font-size: 13px;">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button id="m-btn-cancel" class="btn-outline" style="min-height: 38px; padding: 0 16px; font-size: 13px;">Cancel</button>
          <button id="m-btn-save" class="btn-primary" style="min-height: 38px; padding: 0 18px; font-size: 13px; font-weight: 700; background: #2563EB; color: white;">Save Worker</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#m-btn-cancel').onclick = () => overlay.remove();

    overlay.querySelector('#m-btn-save').onclick = async () => {
      const name = overlay.querySelector('#m-wrk-name').value.trim();
      const trade = overlay.querySelector('#m-wrk-trade').value;
      const dailyWage = parseFloat(overlay.querySelector('#m-wrk-wage').value) || 0;
      const phone = overlay.querySelector('#m-wrk-phone').value.trim();
      const wageType = overlay.querySelector('#m-wrk-type').value;
      const joiningDate = overlay.querySelector('#m-wrk-joindate').value;

      if (!name) {
        await AppDialog.alert({ title: 'Validation', message: 'Worker name is required.' });
        return;
      }

      try {
        if (isEdit) {
          await BusinessApi.request(`/labour/workers/${existing.id}`, 'PUT', {
            name, trade, dailyWage, phone, wageType, joiningDate
          });
        } else {
          await BusinessApi.request('/labour/workers', 'POST', {
            name, trade, dailyWage, phone, wageType, joiningDate
          });
        }
        overlay.remove();
        await this.render(this.container);
      } catch (err) {
        await AppDialog.alert({ title: 'Save Failed', message: err.message });
      }
    };
  },

  /**
   * Modal: Record Payment or Advance with Quick Calculator Integration
   */
  openPaymentModal(preset = {}) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 10000;
      display: flex; align-items: center; justify-content: center; padding: 14px;
      backdrop-filter: blur(2px);
    `;

    overlay.innerHTML = `
      <div style="background: var(--bg-card, #FFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 14px; width: 100%; max-width: 440px; padding: 18px; display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900, #0B192C);">
          Disburse Wages / Advance
        </h3>

        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Worker *</label>
          <select id="pay-wrk-id" class="form-control" style="width: 100%; font-size: 13px;">
            ${this.workers.map(w => `<option value="${w.id}" ${w.id === (preset.workerId || this.selectedWorkerId) ? 'selected' : ''}>${w.name} (${w.trade})</option>`).join('')}
          </select>
        </div>

        <div style="display: flex; gap: 8px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Payment Type</label>
            <select id="pay-type" class="form-control" style="width: 100%; font-size: 13px;">
              <option value="ADVANCE">Advance (முன்பணம்)</option>
              <option value="WAGE_PAYMENT" selected>Wage Payment (கூலி)</option>
              <option value="SETTLEMENT">Full Settlement</option>
              <option value="BONUS">Bonus</option>
            </select>
          </div>
          <div style="flex: 1.2;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Site / Project</label>
            <select id="pay-prj-id" class="form-control" style="width: 100%; font-size: 13px;">
              <option value="">General Overhead</option>
              ${this.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Amount with Quick Calculator Button -->
        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Amount (₹) *</label>
          <div style="display: flex; gap: 6px;">
            <input type="number" id="pay-amount" class="form-control" placeholder="0.00" style="flex: 1; font-size: 15px; font-weight: 700;" step="any" min="1">
            <button id="btn-pay-calc" type="button" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; border-radius: 8px; padding: 0 12px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              🧮 Calc
            </button>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Disbursement Mode</label>
            <select id="pay-mode" class="form-control" style="width: 100%; font-size: 12px;">
              <option value="CASH">Cash in Hand</option>
              <option value="UPI">UPI / GPay</option>
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Disburse From A/C</label>
            <select id="pay-acc-id" class="form-control" style="width: 100%; font-size: 12px;">
              <option value="">None / External</option>
              ${this.accounts.map(a => `<option value="${a.id}">${a.account_name} (₹${a.current_balance})</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Notes</label>
          <input type="text" id="pay-notes" class="form-control" placeholder="e.g. Weekly settlement week 43" style="width: 100%; font-size: 13px;">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button id="pay-btn-cancel" class="btn-outline" style="min-height: 38px; padding: 0 16px; font-size: 13px;">Cancel</button>
          <button id="pay-btn-submit" class="btn-primary" style="min-height: 38px; padding: 0 18px; font-size: 13px; font-weight: 700; background: #16A34A; color: white;">Disburse ₹</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#pay-btn-cancel').onclick = () => overlay.remove();

    // Hook Quick Calculator
    const amtInput = overlay.querySelector('#pay-amount');
    overlay.querySelector('#btn-pay-calc')?.addEventListener('click', () => {
      openQuickCalculator({
        targetInput: amtInput,
        title: 'Calculate Wages / Payout',
        initialValue: parseFloat(amtInput.value) || 0
      });
    });

    overlay.querySelector('#pay-btn-submit').onclick = async () => {
      const workerId = overlay.querySelector('#pay-wrk-id').value;
      const paymentType = overlay.querySelector('#pay-type').value;
      const projectId = overlay.querySelector('#pay-prj-id').value || null;
      const amount = parseFloat(amtInput.value) || 0;
      const paymentMode = overlay.querySelector('#pay-mode').value;
      const accountId = overlay.querySelector('#pay-acc-id').value || null;
      const notes = overlay.querySelector('#pay-notes').value.trim();

      if (!workerId || amount <= 0) {
        await AppDialog.alert({ title: 'Validation', message: 'Worker and positive payment amount are required.' });
        return;
      }

      try {
        await BusinessApi.request('/labour/payments', 'POST', {
          workerId,
          paymentType,
          projectId,
          amount,
          paymentMode,
          accountId,
          notes,
          paymentDate: new Date().toISOString().split('T')[0]
        });
        overlay.remove();
        await this.render(this.container);
      } catch (err) {
        await AppDialog.alert({ title: 'Payment Failed', message: err.message });
      }
    };
  }
};
