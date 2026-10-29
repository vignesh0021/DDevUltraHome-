/**
 * DDevUltraHome — Executive Dashboard Screen
 */

import { BusinessApi } from '../businessApi.js';

export const DashboardScreen = {
  async render(container) {
    container.innerHTML = `
      <div class="screen-loading" style="padding: 40px; text-align: center; color: var(--text-muted);">
        Loading Executive Dashboard...
      </div>
    `;

    try {
      const res = await BusinessApi.request('/dashboard/summary');
      const d = res.dashboard || {};

      const formatInr = (amt) => {
        return '₹' + (amt || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      };

      container.innerHTML = `
        <div class="screen-dashboard">
          <!-- Top Banner -->
          <div style="background: linear-gradient(135deg, var(--brand-navy-900), var(--brand-navy-700)); color: white; padding: 20px; border-radius: var(--radius-lg); margin: 16px; box-shadow: var(--shadow-md);">
            <div style="font-size: 12px; font-weight: 700; color: var(--brand-gold-400); text-transform: uppercase; letter-spacing: 0.05em;">
              Executive Overview
            </div>
            <div style="font-size: 22px; font-weight: 800; margin-top: 4px;">
              ${d.companyName || 'D DEV ULTRA HOMES'}
            </div>
            <div style="font-size: 13px; color: #CBD5E1; margin-top: 2px;">
              ${d.tagline || 'Building your dreams'}
            </div>
          </div>

          <!-- 4 Core Financial Control KPIs -->
          <div class="kpi-grid">
            <div class="kpi-card kpi-cash">
              <span class="kpi-title">Liquid Cash & Bank</span>
              <span class="kpi-amount" style="color: var(--color-success);">${formatInr(d.liquidCash || d.totalLiquidFunds)}</span>
              <span class="kpi-subtext">Verified Bank + Petty Cash</span>
            </div>

            <div class="kpi-card kpi-payable">
              <span class="kpi-title">Accounts Payable</span>
              <span class="kpi-amount" style="color: var(--color-danger);">${formatInr(d.accountsPayable)}</span>
              <span class="kpi-subtext">Unpaid Supplier Dues</span>
            </div>

            <div class="kpi-card kpi-advance">
              <span class="kpi-title">Unearned Advances</span>
              <span class="kpi-amount" style="color: #6366F1;">${formatInr(d.unearnedAdvanceLiabilities)}</span>
              <span class="kpi-subtext">Client Deposit Liability</span>
            </div>

            <div class="kpi-card kpi-net">
              <span class="kpi-title">Net Operating Cash</span>
              <span class="kpi-amount" style="color: var(--brand-navy-900);">${formatInr(d.netOperatingCashflow)}</span>
              <span class="kpi-subtext">Earned Revenue - Expenses</span>
            </div>
          </div>

          <!-- Project & Operations Metric Highlights -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 16px 16px;">
            <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: var(--brand-navy-900);">${d.activeProjects || 0}</div>
              <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-top: 2px;">Active Sites</div>
            </div>
            <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: var(--brand-navy-900);">${d.totalClients || 0}</div>
              <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-top: 2px;">Total Clients</div>
            </div>
            <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: ${d.pendingOcrCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">${d.pendingOcrCount || 0}</div>
              <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-top: 2px;">Pending Bills</div>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div style="padding: 0 16px 20px;">
            <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase;">
              Quick Actions
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
              <button id="btn-quick-new-project" class="btn-outline" style="min-height: 44px; font-size: 13px;">
                + New Project
              </button>
              <button id="btn-quick-record-receipt" class="btn-outline" style="min-height: 44px; font-size: 13px;">
                + Client Advance
              </button>
              <button id="btn-quick-record-expense" class="btn-outline" style="min-height: 44px; font-size: 13px;">
                + Site Expense
              </button>
              <button id="btn-quick-scan-bill" class="btn-outline" style="min-height: 44px; font-size: 13px;">
                📷 Scan Bill (OCR)
              </button>
            </div>
          </div>
        </div>
      `;

      // Event listeners
      container.querySelector('#btn-quick-new-project')?.addEventListener('click', () => {
        window.appNavigate?.('projects');
      });
      container.querySelector('#btn-quick-record-receipt')?.addEventListener('click', () => {
        window.appNavigate?.('income');
      });
      container.querySelector('#btn-quick-record-expense')?.addEventListener('click', () => {
        window.appNavigate?.('expenses');
      });
      container.querySelector('#btn-quick-scan-bill')?.addEventListener('click', () => {
        window.appNavigate?.('documents');
      });
    } catch (e) {
      container.innerHTML = `<div style="padding: 20px; color: var(--color-danger);">Failed to load dashboard: ${e.message}</div>`;
    }
  }
};
