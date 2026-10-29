/**
 * DDevUltraHome — Financial Reports & Statements Screen
 */

import { BusinessApi } from '../businessApi.js';

export const ReportsScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Financial Reports & P&L</h2>
          <div style="font-size: 12px; color: var(--text-muted);">Executive Statements, Cashflow & Accounts Payable Aging</div>
        </div>

        <div class="form-group">
          <label class="form-label">Inspect Project P&L</label>
          <select id="sel-report-project" class="form-control"></select>
        </div>

        <div id="report-output-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading project statement...</div>
        </div>
      </div>
    `;

    const sel = container.querySelector('#sel-report-project');
    try {
      const res = await BusinessApi.request('/projects');
      const projects = res.projects || [];
      sel.innerHTML = projects.map(p => `<option value="${p.id}">${p.name} (${p.project_code})</option>`).join('');

      if (projects.length > 0) {
        await this.loadPnl(container, projects[0].id);
      }

      sel.addEventListener('change', async () => {
        await this.loadPnl(container, sel.value);
      });
    } catch (e) {
      sel.innerHTML = '<option value="">No projects found</option>';
    }
  },

  async loadPnl(container, prjId) {
    const out = container.querySelector('#report-output-container');
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
              Project Profit & Loss Statement
            </div>
            <div style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900);">
              ${pnl.projectName}
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
