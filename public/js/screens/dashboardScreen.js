/**
 * DDevUltraHome — Executive Dashboard Screen
 * Interactive, high-contrast, clickable KPIs and Construction Lifecycle Flowchart View.
 */

import { BusinessApi } from '../businessApi.js';
import { CameraHelper } from '../cameraHelper.js';

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
        <div class="screen-dashboard" style="padding-bottom: 24px;">
          <!-- Top Executive Banner -->
          <div style="background: linear-gradient(135deg, #0B192C 0%, #1E3E62 100%); color: white; padding: 18px 20px; border-radius: var(--radius-lg); margin: 16px 16px 12px; box-shadow: var(--shadow-md); border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 11px; font-weight: 800; color: #F59E0B; text-transform: uppercase; letter-spacing: 0.08em;">
              EXECUTIVE OVERVIEW
            </div>
            <div style="font-size: 22px; font-weight: 800; margin-top: 4px; color: #FFFFFF;">
              ${d.companyName || 'D DEV ULTRA HOMES'}
            </div>
            <div style="font-size: 12px; color: #CBD5E1; margin-top: 2px;">
              ${d.tagline || 'Building your dreams'}
            </div>
          </div>

          <!-- 4 Core Financial Control KPIs (Interactive Touch Cards) -->
          <div class="kpi-grid" style="margin-bottom: 12px;">
            <div id="card-kpi-liquid" class="kpi-card kpi-cash" style="cursor: pointer; transition: transform 0.15s ease;" title="Tap to view Cash & Bank Ledger">
              <span class="kpi-title" style="display: flex; justify-content: space-between; align-items: center;">
                LIQUID CASH &amp; BANK <span style="font-size: 10px; color: var(--text-muted);">View →</span>
              </span>
              <span class="kpi-amount" style="color: #10B981;">${formatInr(d.liquidCash || d.totalLiquidFunds)}</span>
              <span class="kpi-subtext">Verified Bank + Petty Cash</span>
            </div>

            <div id="card-kpi-payable" class="kpi-card kpi-payable" style="cursor: pointer; transition: transform 0.15s ease;" title="Tap to view Supplier Payables">
              <span class="kpi-title" style="display: flex; justify-content: space-between; align-items: center;">
                ACCOUNTS PAYABLE <span style="font-size: 10px; color: var(--text-muted);">View →</span>
              </span>
              <span class="kpi-amount" style="color: #EF4444;">${formatInr(d.accountsPayable)}</span>
              <span class="kpi-subtext">Unpaid Supplier Dues</span>
            </div>

            <div id="card-kpi-advance" class="kpi-card kpi-advance" style="cursor: pointer; transition: transform 0.15s ease;" title="Tap to view Client Advances">
              <span class="kpi-title" style="display: flex; justify-content: space-between; align-items: center;">
                UNEARNED ADVANCES <span style="font-size: 10px; color: var(--text-muted);">View →</span>
              </span>
              <span class="kpi-amount" style="color: #6366F1;">${formatInr(d.unearnedAdvanceLiabilities)}</span>
              <span class="kpi-subtext">Client Deposit Liability</span>
            </div>

            <div id="card-kpi-net" class="kpi-card kpi-net" style="cursor: pointer; transition: transform 0.15s ease;" title="Tap to view P&L Cashflow Report">
              <span class="kpi-title" style="display: flex; justify-content: space-between; align-items: center;">
                NET OPERATING CASH <span style="font-size: 10px; color: var(--text-muted);">View →</span>
              </span>
              <span class="kpi-amount" style="color: var(--brand-navy-900);">${formatInr(d.netOperatingCashflow)}</span>
              <span class="kpi-subtext">Earned Revenue - Expenses</span>
            </div>
          </div>

          <!-- 3 Interactive Metric Targets: Active Sites, Total Clients, Pending Bills -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 16px 16px;">
            <div id="btn-stat-sites" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 10px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); transition: transform 0.12s, border-color 0.12s;" title="Tap to open Projects">
              <div style="font-size: 22px; font-weight: 800; color: var(--brand-navy-900);">${d.activeProjects || 0}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Active Sites ↗</div>
            </div>

            <div id="btn-stat-clients" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 10px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); transition: transform 0.12s, border-color 0.12s;" title="Tap to open Clients Directory">
              <div style="font-size: 22px; font-weight: 800; color: var(--brand-navy-900);">${d.totalClients || 0}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Total Clients ↗</div>
            </div>

            <div id="btn-stat-bills" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 10px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); transition: transform 0.12s, border-color 0.12s;" title="Tap to view Pending Bills & Invoices">
              <div style="font-size: 22px; font-weight: 800; color: ${d.pendingOcrCount > 0 ? '#F59E0B' : '#10B981'};">${d.pendingOcrCount || 0}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Pending Bills ↗</div>
            </div>
          </div>

          <!-- Construction Business Lifecycle Flowchart View -->
          <div style="margin: 0 16px 16px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <h3 style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">
                  🏗️ Construction Lifecycle Flowchart
                </h3>
                <div style="font-size: 11px; color: var(--text-muted);">
                  Interactive end-to-end project workflow pipeline
                </div>
              </div>
              <span class="badge-status badge-active" style="font-size: 10px;">8 STAGES</span>
            </div>

            <!-- Flowchart Nodes Sequence -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <!-- Stage 1 & 2 -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div id="flow-node-quotes" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #D97706;">STAGE 1</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">📋 BOQ &amp; Quotation</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Estimates &amp; SOR Rates</div>
                </div>

                <div id="flow-node-contract" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #D97706;">STAGE 2</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">📜 Client Contract</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Schedule A &amp; B Signed</div>
                </div>
              </div>

              <!-- Connecting Arrow -->
              <div style="text-align: center; color: var(--brand-gold-500); font-weight: 800; font-size: 12px; line-height: 1;">↓</div>

              <!-- Stage 3 & 4 -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div id="flow-node-advance" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #2563EB;">STAGE 3</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">💰 Advance Deposit</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Unearned Liability</div>
                </div>

                <div id="flow-node-sites" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #16A34A;">STAGE 4</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">🏗️ Site Project</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">G+1 Villa Active</div>
                </div>
              </div>

              <!-- Connecting Arrow -->
              <div style="text-align: center; color: var(--brand-gold-500); font-weight: 800; font-size: 12px; line-height: 1;">↓</div>

              <!-- Stage 5 & 6 -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div id="flow-node-dpr" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #D97706;">STAGE 5</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">👷 Daily Site DPR</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Labour, Masons, Photos</div>
                </div>

                <div id="flow-node-bills" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #DC2626;">STAGE 6</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">🚚 Material Bills</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">TMT, Cement, Payables</div>
                </div>
              </div>

              <!-- Connecting Arrow -->
              <div style="text-align: center; color: var(--brand-gold-500); font-weight: 800; font-size: 12px; line-height: 1;">↓</div>

              <!-- Stage 7 & 8 -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div id="flow-node-billing" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #16A34A;">STAGE 7</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">📊 Milestone Billing</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Stage Certification</div>
                </div>

                <div id="flow-node-handover" style="background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform 0.15s;">
                  <div style="font-size: 10px; font-weight: 800; color: #059669;">STAGE 8</div>
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-top: 2px;">🏁 Handover &amp; Profit</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Operating Margin</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div style="padding: 0 16px 20px;">
            <div style="font-size: 12px; font-weight: 800; color: var(--text-secondary); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;">
              Quick Actions
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
              <button id="btn-quick-new-project" class="btn-outline quick-action-btn" style="min-height: 44px; font-size: 13px; font-weight: 700;">
                + New Project
              </button>
              <button id="btn-quick-record-receipt" class="btn-outline quick-action-btn" style="min-height: 44px; font-size: 13px; font-weight: 700;">
                + Client Advance
              </button>
              <button id="btn-quick-record-expense" class="btn-outline quick-action-btn" style="min-height: 44px; font-size: 13px; font-weight: 700;">
                + Site Expense
              </button>
              <button id="btn-quick-scan-bill" class="btn-outline quick-action-btn" style="min-height: 44px; font-size: 13px; font-weight: 700; background: var(--brand-gold-50); border-color: var(--brand-gold-500); color: var(--brand-gold-700);">
                📷 Scan Bill (OCR)
              </button>
            </div>
          </div>
        </div>
      `;

      // 1. KPI Card Navigation
      container.querySelector('#card-kpi-liquid')?.addEventListener('click', () => {
        window.appNavigate?.('settings');
      });
      container.querySelector('#card-kpi-payable')?.addEventListener('click', () => {
        window.appNavigate?.('suppliers');
      });
      container.querySelector('#card-kpi-advance')?.addEventListener('click', () => {
        window.appNavigate?.('income');
      });
      container.querySelector('#card-kpi-net')?.addEventListener('click', () => {
        window.appNavigate?.('reports');
      });

      // 2. Metric Highlight Navigation
      container.querySelector('#btn-stat-sites')?.addEventListener('click', () => {
        window.appNavigate?.('projects');
      });
      container.querySelector('#btn-stat-clients')?.addEventListener('click', () => {
        window.appNavigate?.('clients');
      });
      container.querySelector('#btn-stat-bills')?.addEventListener('click', () => {
        window.appNavigate?.('suppliers');
      });

      // 3. Flowchart Node Navigation
      container.querySelector('#flow-node-quotes')?.addEventListener('click', () => {
        window.appNavigate?.('quotations');
      });
      container.querySelector('#flow-node-contract')?.addEventListener('click', () => {
        window.appNavigate?.('projects');
      });
      container.querySelector('#flow-node-advance')?.addEventListener('click', () => {
        window.appNavigate?.('income');
      });
      container.querySelector('#flow-node-sites')?.addEventListener('click', () => {
        window.appNavigate?.('projects');
      });
      container.querySelector('#flow-node-dpr')?.addEventListener('click', () => {
        window.appNavigate?.('progress');
      });
      container.querySelector('#flow-node-bills')?.addEventListener('click', () => {
        window.appNavigate?.('suppliers');
      });
      container.querySelector('#flow-node-billing')?.addEventListener('click', () => {
        window.appNavigate?.('projects');
      });
      container.querySelector('#flow-node-handover')?.addEventListener('click', () => {
        window.appNavigate?.('reports');
      });

      // 4. Quick Action Buttons
      container.querySelector('#btn-quick-new-project')?.addEventListener('click', () => {
        window.appNavigate?.('projects');
      });
      container.querySelector('#btn-quick-record-receipt')?.addEventListener('click', () => {
        window.appNavigate?.('income');
      });
      container.querySelector('#btn-quick-record-expense')?.addEventListener('click', () => {
        window.appNavigate?.('expenses');
      });

      // 5. Native Camera Scan Bill Trigger
      container.querySelector('#btn-quick-scan-bill')?.addEventListener('click', async () => {
        try {
          const photo = await CameraHelper.capturePhoto({ source: 'CAMERA' });
          if (photo) {
            window._pendingScannedPhoto = photo;
          }
        } catch (e) {
          console.warn('Camera capture fallback:', e);
        }
        window.appNavigate?.('documents');
      });

    } catch (e) {
      container.innerHTML = `<div style="padding: 20px; color: var(--color-danger);">Failed to load dashboard: ${e.message}</div>`;
    }
  }
};
