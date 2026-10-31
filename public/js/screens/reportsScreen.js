/**
 * DDevUltraHome — Financial Reports & Statements Screen
 * Comprehensive Project-Wise Financial Statements, Expense Breakdown,
 * Labour Cost Summaries, Date Filtering, and Client-Ready PDF Export.
 */

import { BusinessApi } from '../businessApi.js';
import { deliverPdf } from '../printDoc.js';

export const ReportsScreen = {
  currentTab: 'project_report', // 'project_report' | 'company_pnl'
  selectedProjectId: null,
  selectedRange: 'ALL', // 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'
  customStartDate: '',
  customEndDate: '',
  cachedReportData: null,

  async render(container) {
    // If incoming from another screen with pre-selected project
    if (window._selectedReportProjectId) {
      this.selectedProjectId = window._selectedReportProjectId;
      window._selectedReportProjectId = null;
    }

    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="margin-bottom: 14px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Financial Reports &amp; Statements</h2>
          <div style="font-size: 12px; color: var(--text-muted);">Site audit statements, cashflow reconciliation &amp; executive P&amp;L</div>
        </div>

        <!-- View Tabs -->
        <div style="display: flex; gap: 6px; margin-bottom: 14px; background: var(--bg-card-subtle); padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
          <button id="tab-btn-project-report" class="btn-report-tab" data-tab="project_report" style="flex: 1; min-height: 36px; font-size: 12px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease;">
            🏗️ Project Financial Report
          </button>
          <button id="tab-btn-company-pnl" class="btn-report-tab" data-tab="company_pnl" style="flex: 1; min-height: 36px; font-size: 12px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.15s ease;">
            📈 Executive P&amp;L
          </button>
        </div>

        <!-- Main View Host -->
        <div id="reports-view-host">
          <div style="padding: 24px; text-align: center; color: var(--text-muted);">Loading statements...</div>
        </div>
      </div>
    `;

    // Wire view tabs
    const updateTabStyles = () => {
      container.querySelectorAll('.btn-report-tab').forEach(b => {
        const isCurrent = b.dataset.tab === this.currentTab;
        b.style.background = isCurrent ? '#0B192C' : 'transparent';
        b.style.color = isCurrent ? '#FFFFFF' : 'var(--text-secondary)';
      });
    };

    container.querySelectorAll('.btn-report-tab').forEach(b => {
      b.addEventListener('click', async () => {
        this.currentTab = b.dataset.tab;
        updateTabStyles();
        if (this.currentTab === 'project_report') {
          await this.renderProjectReport(container);
        } else {
          await this.renderCompanyPnl(container);
        }
      });
    });

    updateTabStyles();
    if (this.currentTab === 'project_report') {
      await this.renderProjectReport(container);
    } else {
      await this.renderCompanyPnl(container);
    }
  },

  /**
   * Project-Wise Financial Statement View
   */
  async renderProjectReport(container) {
    const host = container.querySelector('#reports-view-host');
    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- Project Selector & Filters -->
        <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 14px; box-shadow: var(--shadow-sm);">
          <div class="form-group" style="margin-bottom: 10px;">
            <label class="form-label" style="font-weight: 800;">Select Project *</label>
            <select id="sel-report-project" class="form-control"></select>
          </div>

          <!-- Date Filters -->
          <div>
            <label class="form-label" style="font-weight: 700; margin-bottom: 6px;">Date Filter Period</label>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="btn-filter-range" data-range="ALL" style="padding: 5px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-light); cursor: pointer;">All Time</button>
              <button type="button" class="btn-filter-range" data-range="TODAY" style="padding: 5px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-light); cursor: pointer;">Today</button>
              <button type="button" class="btn-filter-range" data-range="THIS_WEEK" style="padding: 5px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-light); cursor: pointer;">This Week</button>
              <button type="button" class="btn-filter-range" data-range="THIS_MONTH" style="padding: 5px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-light); cursor: pointer;">This Month</button>
              <button type="button" class="btn-filter-range" data-range="CUSTOM" style="padding: 5px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; border: 1px solid var(--border-light); cursor: pointer;">Custom</button>
            </div>
            <div id="custom-date-box" style="display: ${this.selectedRange === 'CUSTOM' ? 'flex' : 'none'}; gap: 8px; margin-top: 10px; align-items: center;">
              <input type="date" id="inp-custom-start" class="form-control" style="font-size: 12px;" value="${this.customStartDate}">
              <span style="font-size: 12px; color: var(--text-muted);">to</span>
              <input type="date" id="inp-custom-end" class="form-control" style="font-size: 12px;" value="${this.customEndDate}">
              <button id="btn-apply-custom-date" class="btn-primary" style="min-height: 36px; padding: 0 12px; font-size: 11px; white-space: nowrap;">Apply</button>
            </div>
          </div>
        </div>

        <!-- Statement Output Container -->
        <div id="project-statement-output">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading project statement...</div>
        </div>
      </div>
    `;

    // Populate projects dropdown
    const sel = host.querySelector('#sel-report-project');
    try {
      const res = await BusinessApi.request('/projects');
      const projects = (res.projects || []).filter(p => p.id !== 'prj-business-overhead');

      if (projects.length === 0) {
        sel.innerHTML = '<option value="">No projects registered</option>';
        host.querySelector('#project-statement-output').innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-muted); background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-medium);">
            No projects available to generate report.
          </div>
        `;
        return;
      }

      sel.innerHTML = projects.map(p => `
        <option value="${p.id}" ${p.id === this.selectedProjectId ? 'selected' : ''}>
          ${p.name} (${p.project_code || 'PRJ'})
        </option>
      `).join('');

      if (!this.selectedProjectId || !projects.some(p => p.id === this.selectedProjectId)) {
        this.selectedProjectId = projects[0].id;
      }

      sel.value = this.selectedProjectId;

      // Filter Range buttons
      const updateRangeButtons = () => {
        host.querySelectorAll('.btn-filter-range').forEach(b => {
          const isAct = b.dataset.range === this.selectedRange;
          b.style.background = isAct ? '#0284C7' : 'white';
          b.style.color = isAct ? 'white' : 'var(--text-secondary)';
          b.style.borderColor = isAct ? '#0284C7' : 'var(--border-light)';
        });
      };
      updateRangeButtons();

      host.querySelectorAll('.btn-filter-range').forEach(b => {
        b.addEventListener('click', async () => {
          this.selectedRange = b.dataset.range;
          updateRangeButtons();
          const customBox = host.querySelector('#custom-date-box');
          if (this.selectedRange === 'CUSTOM') {
            customBox.style.display = 'flex';
          } else {
            customBox.style.display = 'none';
            await this.loadProjectReportData(host, sel.value);
          }
        });
      });

      host.querySelector('#btn-apply-custom-date')?.addEventListener('click', async () => {
        this.customStartDate = host.querySelector('#inp-custom-start').value;
        this.customEndDate = host.querySelector('#inp-custom-end').value;
        await this.loadProjectReportData(host, sel.value);
      });

      sel.addEventListener('change', async () => {
        this.selectedProjectId = sel.value;
        await this.loadProjectReportData(host, sel.value);
      });

      // Load initial report
      await this.loadProjectReportData(host, this.selectedProjectId);

    } catch (e) {
      sel.innerHTML = '<option value="">Error loading projects</option>';
      host.querySelector('#project-statement-output').innerHTML = `<div style="color: var(--color-danger); padding: 16px;">Failed to load projects: ${e.message}</div>`;
    }
  },

  async loadProjectReportData(host, prjId) {
    const out = host.querySelector('#project-statement-output');
    out.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Generating statement...</div>`;

    let url = `/projects/${prjId}/report?dateRange=${this.selectedRange}`;
    if (this.selectedRange === 'CUSTOM') {
      if (this.customStartDate) url += `&startDate=${encodeURIComponent(this.customStartDate)}`;
      if (this.customEndDate) url += `&endDate=${encodeURIComponent(this.customEndDate)}`;
    }

    try {
      const res = await BusinessApi.request(url);
      const report = res.report || {};
      this.cachedReportData = report;
      this.renderStatementContent(out, report);
    } catch (err) {
      out.innerHTML = `<div style="color: var(--color-danger); padding: 16px;">Failed to load project report: ${err.message}</div>`;
    }
  },

  renderStatementContent(container, report) {
    const p = report.project || {};
    const f = report.financials || {};
    const lab = report.labourSummary || {};
    const categories = report.categoryBreakdown || [];
    const txns = report.transactionHistory || [];

    const inr = (n) => '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    const contractVal = f.contractValue || p.contract_value || 0;
    const totalIncome = f.totalIncome || 0;
    const totalExpenses = f.totalExpenses || 0;
    const clientDue = f.clientBalanceDue ?? Math.max(0, contractVal - totalIncome);
    const netCashflow = f.netCashflow ?? (totalIncome - totalExpenses);

    container.innerHTML = `
      <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 18px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Statement Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--brand-gold-500); padding-bottom: 12px;">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: var(--brand-gold-600); text-transform: uppercase; letter-spacing: 0.05em;">
              PROJECT FINANCIAL STATEMENT • ${this.selectedRange}
            </div>
            <div style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin-top: 2px;">
              ${p.name || 'Site Project'}
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Client: <strong>${p.client_name || 'Client'}</strong> • Code: <strong>${p.project_code || 'PRJ'}</strong>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              Site Address: ${p.site_address || 'Site Location'}
            </div>
          </div>
          <button id="btn-export-statement-pdf" class="btn-primary" style="min-height: 38px; padding: 0 14px; font-size: 12px; font-weight: 700; background: #059669; border-color: #059669; white-space: nowrap;">
            📄 Export / Share PDF
          </button>
        </div>

        <!-- 4 Primary Financial Health Metrics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
          <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px;">
            <div style="font-size: 10px; color: var(--text-muted); font-weight: 700;">CONTRACT VALUE</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--brand-navy-900); margin-top: 2px;">${inr(contractVal)}</div>
          </div>
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 10px;">
            <div style="font-size: 10px; color: #1E40AF; font-weight: 700;">TOTAL CASH INFLOW</div>
            <div style="font-size: 16px; font-weight: 800; color: #1E3A8A; margin-top: 2px;">${inr(totalIncome)}</div>
          </div>
          <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--radius-md); padding: 10px;">
            <div style="font-size: 10px; color: #991B1B; font-weight: 700;">TOTAL SITE EXPENSES</div>
            <div style="font-size: 16px; font-weight: 800; color: #DC2626; margin-top: 2px;">${inr(totalExpenses)}</div>
          </div>
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius-md); padding: 10px;">
            <div style="font-size: 10px; color: #92400E; font-weight: 700;">CLIENT BALANCE DUE</div>
            <div style="font-size: 16px; font-weight: 800; color: #B45309; margin-top: 2px;">${inr(clientDue)}</div>
          </div>
        </div>

        <!-- Net Cashflow Banner -->
        <div style="background: ${netCashflow >= 0 ? '#F0FDF4' : '#FEF2F2'}; border: 1px solid ${netCashflow >= 0 ? '#BBF7D0' : '#FECACA'}; border-radius: var(--radius-md); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">NET SITE OPERATING CASHFLOW</div>
            <div style="font-size: 11px; color: var(--text-muted);">(Cash Collected - Expenses Disbursed)</div>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: ${netCashflow >= 0 ? '#15803D' : '#DC2626'};">
            ${inr(netCashflow)}
          </div>
        </div>

        <!-- Labour Expense Summary -->
        <div style="background: #F8FAFC; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px;">
          <div style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 8px;">
            👷 Labour Wages &amp; Disbursement Summary
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px;">
            <div>
              <span style="color: var(--text-muted);">Wages Earned:</span>
              <strong style="display: block; color: var(--brand-navy-900); font-size: 13px; margin-top: 2px;">${inr(lab.wagesEarned)}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted);">Disbursed (Paid):</span>
              <strong style="display: block; color: #059669; font-size: 13px; margin-top: 2px;">${inr(lab.totalDisbursed || lab.wagesPaid)}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted);">Outstanding Payable:</span>
              <strong style="display: block; color: #DC2626; font-size: 13px; margin-top: 2px;">${inr(lab.wagesOutstanding)}</strong>
            </div>
          </div>
        </div>

        <!-- Category Breakdown -->
        <div>
          <div style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 8px;">
            📊 Category-Wise Expense Breakdown
          </div>
          ${categories.length === 0 ? `
            <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0;">No expense category records in this period.</div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${categories.map(c => `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
                    <span style="font-weight: 700; color: var(--brand-navy-800);">${c.category}</span>
                    <span style="font-weight: 800; color: var(--brand-navy-900);">${inr(c.totalAmount)} (${c.percentage || 0}%)</span>
                  </div>
                  <div style="background: #E2E8F0; height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="background: #0284C7; width: ${Math.min(100, Math.max(0, c.percentage || 0))}%; height: 100%;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Transaction History -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 800; color: var(--brand-navy-900);">
              📑 Transaction History (${txns.length})
            </div>
          </div>
          ${txns.length === 0 ? `
            <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0;">No transactions found for the selected period.</div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto;">
              ${txns.map(t => {
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
                      ${sign}${inr(t.amount)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;

    // Export PDF Listener
    container.querySelector('#btn-export-statement-pdf')?.addEventListener('click', async () => {
      await this.exportProjectPdf(report);
    });
  },

  /**
   * Generates and delivers PDF report using deliverPdf
   */
  async exportProjectPdf(report) {
    const p = report.project || {};
    const f = report.financials || {};
    const lab = report.labourSummary || {};
    const categories = report.categoryBreakdown || [];
    const txns = report.transactionHistory || [];

    const inr = (n) => 'Rs ' + (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const filename = `Project_Report_${(p.name || 'Site').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    const lines = [
      '================================================================',
      '                     D DEV ULTRA HOMES                          ',
      '              CONSTRUCTION PROJECT FINANCIAL REPORT              ',
      '================================================================',
      '',
      `Project Name:   ${p.name || 'Site Project'}`,
      `Project Code:   ${p.project_code || 'PRJ'}`,
      `Client:         ${p.client_name || 'Client'}`,
      `Site Address:   ${p.site_address || 'N/A'}`,
      `Generated Date: ${new Date().toLocaleDateString('en-IN')}`,
      `Period Filter:  ${this.selectedRange}`,
      '----------------------------------------------------------------',
      'FINANCIAL SUMMARY:',
      `  Contract Value:              ${inr(f.contractValue || p.contract_value)}`,
      `  Total Income Received:       ${inr(f.totalIncome)}`,
      `  Total Expenses Incurred:     ${inr(f.totalExpenses)}`,
      `  Client Outstanding Balance:  ${inr(f.clientBalanceDue)}`,
      `  Net Operating Cashflow:      ${inr(f.netCashflow)}`,
      '----------------------------------------------------------------',
      'LABOUR WAGES SUMMARY:',
      `  Wages Earned (Attendance):   ${inr(lab.wagesEarned)}`,
      `  Total Wages & Advances Paid: ${inr(lab.totalDisbursed || lab.wagesPaid)}`,
      `  Labour Outstanding Balance:  ${inr(lab.wagesOutstanding)}`,
      '----------------------------------------------------------------',
      'EXPENSE CATEGORY BREAKDOWN:'
    ];

    if (categories.length === 0) {
      lines.push('  No categorized expenses recorded.');
    } else {
      categories.forEach(c => {
        lines.push(`  • ${c.category.padEnd(20, ' ')} : ${inr(c.totalAmount)} (${c.percentage || 0}%)`);
      });
    }

    lines.push('----------------------------------------------------------------');
    lines.push(`TRANSACTION AUDIT LOG (${txns.length} records):`);
    lines.push('DATE       | TYPE        | AMOUNT          | DESCRIPTION');
    lines.push('-----------+-------------+-----------------+---------------------------');

    txns.slice(0, 50).forEach(t => {
      const dt = (t.date || '').padEnd(10, ' ').substring(0, 10);
      const tp = (t.type || '').padEnd(11, ' ').substring(0, 11);
      const amt = inr(t.amount).padStart(15, ' ').substring(0, 15);
      const desc = (t.description || t.category || '').substring(0, 30);
      lines.push(`${dt} | ${tp} | ${amt} | ${desc}`);
    });

    lines.push('================================================================');
    lines.push('   Generated automatically by DDevUltraHome Civil App Engine   ');
    lines.push('================================================================');

    try {
      await deliverPdf(filename, lines);
    } catch (e) {
      alert('PDF export notification: ' + e.message);
    }
  },

  /**
   * Company Executive P&L View
   */
  async renderCompanyPnl(container) {
    const host = container.querySelector('#reports-view-host');
    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div class="form-group" style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 14px; box-shadow: var(--shadow-sm); margin-bottom: 0;">
          <label class="form-label" style="font-weight: 800;">Company Project P&amp;L</label>
          <select id="sel-pnl-project" class="form-control"></select>
        </div>
        <div id="pnl-statement-output">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading company P&amp;L...</div>
        </div>
      </div>
    `;

    const sel = host.querySelector('#sel-pnl-project');
    try {
      const res = await BusinessApi.request('/projects');
      const projects = res.projects || [];
      sel.innerHTML = projects.map(p => `<option value="${p.id}">${p.name} (${p.project_code || 'PRJ'})</option>`).join('');

      if (projects.length > 0) {
        await this.loadPnl(host, projects[0].id);
      }

      sel.addEventListener('change', async () => {
        await this.loadPnl(host, sel.value);
      });
    } catch (e) {
      sel.innerHTML = '<option value="">No projects found</option>';
    }
  },

  async loadPnl(host, prjId) {
    const out = host.querySelector('#pnl-statement-output');
    try {
      const res = await BusinessApi.request(`/reports/pnl?projectId=${prjId}`);
      const pnl = res.pnl || {};
      const f = pnl.financials || {};
      const b = f.breakdown || {};

      const inr = (n) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

      out.innerHTML = `
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 20px; box-shadow: var(--shadow-sm);">
          <div style="border-bottom: 2px solid var(--brand-gold-500); padding-bottom: 10px; margin-bottom: 16px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--brand-gold-600); text-transform: uppercase;">
              Project Profit &amp; Loss Statement
            </div>
            <div style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900);">
              ${pnl.projectName || 'Site Project'}
            </div>
          </div>

          <!-- P&L Table -->
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Contract Value:</span>
              <strong>${inr(pnl.contractValue)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px dashed var(--border-light);">
              <span style="color: var(--text-secondary);">Total Cash Collected:</span>
              <strong style="color: var(--color-success);">${inr(f.totalCashReceived)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">&nbsp;&nbsp;↳ Earned Revenue (Certified Milestones):</span>
              <strong style="color: var(--color-success);">${inr(f.earnedRevenue)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">&nbsp;&nbsp;↳ Unearned Advance (Liability Held):</span>
              <strong style="color: #6366F1;">${inr(f.unearnedAdvanceLiability)}</strong>
            </div>

            <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-light);">
              <span style="color: var(--text-secondary);">Total Direct Cost Incurred:</span>
              <strong style="color: var(--color-danger);">${inr(f.totalIncurredCost)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
              <span>&nbsp;&nbsp;↳ Direct Site Expenses:</span>
              <span>${inr(b.directExpenses)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
              <span>&nbsp;&nbsp;↳ Supplier Material Invoices:</span>
              <span>${inr(b.supplierInvoices)}</span>
            </div>

            <!-- Net Result -->
            <div style="background: var(--bg-card-subtle); padding: 12px; border-radius: var(--radius-md); margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">OPERATING PROFIT</div>
                <div style="font-size: 11px; color: var(--text-muted);">(Earned Revenue - Incurred Cost)</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 18px; font-weight: 800; color: ${f.operatingProfit >= 0 ? 'var(--brand-navy-900)' : 'var(--color-danger)'};">
                  ${inr(f.operatingProfit)}
                </div>
                <div style="font-size: 11px; font-weight: 700; color: var(--brand-gold-600);">
                  Margin: ${f.profitMarginPercentage || 0}%
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      out.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to generate P&L: ${e.message}</div>`;
    }
  }
};
