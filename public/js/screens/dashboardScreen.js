/**
 * DDevUltraHome — Executive Dashboard Screen
 * Interactive, high-contrast, clickable KPIs, Construction Lifecycle Flowchart View,
 * Labour Attendance & Wages Summaries, and Real-Time Recent Transactions.
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
      const [summaryRes, receiptsRes, expensesRes, labourPaymentsRes] = await Promise.all([
        BusinessApi.request('/dashboard/summary'),
        BusinessApi.request('/income/receipts'),
        BusinessApi.request('/expenses'),
        BusinessApi.request('/labour/payments').catch(() => ({ payments: [] }))
      ]);
      const d = summaryRes.dashboard || {};
      const receipts = receiptsRes.receipts || [];
      const expenses = expensesRes.expenses || [];
      const labourPayments = labourPaymentsRes.payments || [];

      // Combine recent transactions
      const recentTxns = [
        ...receipts.map(r => ({
          id: r.id,
          date: r.receipt_date,
          type: 'INCOME',
          category: r.is_advance ? 'Advance' : 'Milestone',
          description: r.notes || `Receipt from ${r.client_name || 'Client'}`,
          amount: parseFloat(r.amount) || 0
        })),
        ...expenses.map(e => ({
          id: e.id,
          date: e.expense_date,
          type: 'EXPENSE',
          category: e.category || 'Expense',
          description: e.notes || e.paid_to || 'Site Expense',
          amount: parseFloat(e.amount) || 0
        })),
        ...labourPayments.map(p => ({
          id: p.id,
          date: p.payment_date,
          type: 'WAGES',
          category: 'Labour Wages',
          description: `Disbursement (${p.payment_type || 'WAGE'})`,
          amount: parseFloat(p.amount) || 0
        }))
      ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const formatInr = (amt) => {
        return '₹' + (amt || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
      };

      const att = d.todayAttendance || { present: 0, total: 0 };
      const labourDue = d.labourWagesPayable || 0;

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

          <!-- Interactive Cash Flow Ring Breakdown (Under KPI Grid) -->
          <div id="dashboard-cash-ring-card" style="margin: 0 16px 14px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900);">
                  💫 Cash Flow Ring
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">
                  Real receipts vs. expenses &amp; category breakdown
                </div>
              </div>
              
              <!-- Timeframe switchers: Day, Month, Year -->
              <div style="display: flex; gap: 4px; background: var(--bg-card-subtle); padding: 3px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <button type="button" class="btn-timeframe" data-period="DAY" style="border: none; background: transparent; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 4px; cursor: pointer; color: var(--text-secondary);">Day</button>
                <button type="button" class="btn-timeframe active" data-period="MONTH" style="border: none; background: #ea580c; color: #ffffff; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 4px; cursor: pointer;">Month</button>
                <button type="button" class="btn-timeframe" data-period="YEAR" style="border: none; background: transparent; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 4px; cursor: pointer; color: var(--text-secondary);">Year</button>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-around; gap: 16px; flex-wrap: wrap;">
              <!-- SVG Donut Cash Ring -->
              <div style="position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;">
                <svg id="svg-cash-ring" width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="50" fill="none" stroke="var(--border-light)" stroke-width="14" />
                </svg>
                <div style="position: absolute; text-align: center; pointer-events: none;">
                  <div style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Net Cash</div>
                  <div id="ring-center-val" style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900);">₹0</div>
                </div>
              </div>

              <!-- Metrics & Category Breakdown -->
              <div style="flex: 1 1 160px; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border-light);">
                  <span style="font-size: 12px; font-weight: 700; color: #10B981; display: flex; align-items: center; gap: 5px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span> Received
                  </span>
                  <strong id="ring-total-received" style="font-size: 13px; color: var(--brand-navy-900);">₹0.00</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid var(--border-light);">
                  <span style="font-size: 12px; font-weight: 700; color: #EF4444; display: flex; align-items: center; gap: 5px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444; display: inline-block;"></span> Spent
                  </span>
                  <strong id="ring-total-spent" style="font-size: 13px; color: var(--brand-navy-900);">₹0.00</strong>
                </div>

                <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">
                  Expense Category Share:
                </div>
                <div id="ring-category-list" style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                  <div style="color: var(--text-muted); padding: 4px 0;">Loading transactions...</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Interactive Metric Targets: Sites, Clients, Pending Bills, Labour Wages, Today Attendance -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 8px; margin: 0 16px 16px;">
            <button type="button" id="btn-stat-sites" class="stat-metric-card" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px 8px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); width: 100%; touch-action: manipulation;" title="Tap to open Projects">
              <div style="font-size: 20px; font-weight: 800; color: var(--brand-navy-900); font-variant-numeric: tabular-nums;">${d.activeProjects || 0}</div>
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Active Sites ↗</div>
            </button>

            <button type="button" id="btn-stat-clients" class="stat-metric-card" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px 8px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); width: 100%; touch-action: manipulation;" title="Tap to open Clients Directory">
              <div style="font-size: 20px; font-weight: 800; color: var(--brand-navy-900); font-variant-numeric: tabular-nums;">${d.totalClients || 0}</div>
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Total Clients ↗</div>
            </button>

            <button type="button" id="btn-stat-bills" class="stat-metric-card" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px 8px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); width: 100%; touch-action: manipulation;" title="Tap to view Pending Bills & Invoices">
              <div style="font-size: 20px; font-weight: 800; color: ${(d.pendingOcrCount || 0) > 0 ? '#F59E0B' : '#10B981'}; font-variant-numeric: tabular-nums;">${d.pendingOcrCount || 0}</div>
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Pending Bills ↗</div>
            </button>

            <button type="button" id="btn-stat-labour-due" class="stat-metric-card" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px 8px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); width: 100%; touch-action: manipulation;" title="Tap to view Labour Wages">
              <div style="font-size: 15px; font-weight: 800; color: ${labourDue > 0 ? '#DC2626' : '#10B981'}; line-height: 1.3; font-variant-numeric: tabular-nums;">₹${Math.round(labourDue).toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Labour Due ↗</div>
            </button>

            <button type="button" id="btn-stat-today-att" class="stat-metric-card" style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 10px 8px; text-align: center; cursor: pointer; box-shadow: var(--shadow-sm); width: 100%; touch-action: manipulation;" title="Tap to record Daily Attendance">
              <div style="font-size: 16px; font-weight: 800; color: #0284C7; line-height: 1.3; font-variant-numeric: tabular-nums;">${att.present || 0}/${att.total || 0}</div>
              <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); margin-top: 2px;">Attendance ↗</div>
            </button>
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

          <!-- Recent Transactions Feed -->
          <div style="margin: 0 16px 16px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <h3 style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">
                  📑 Recent Transactions
                </h3>
                <div style="font-size: 11px; color: var(--text-muted);">
                  Latest receipts, site expenses &amp; wage payouts
                </div>
              </div>
              <button id="btn-view-all-txns" class="btn-outline" style="min-height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700;">
                All Ledgers →
              </button>
            </div>

            <div id="dashboard-txns-list" style="display: flex; flex-direction: column; gap: 6px;">
              ${recentTxns.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); padding: 12px; text-align: center;">No transactions recorded yet.</div>
              ` : recentTxns.slice(0, 6).map(t => {
                const isIncome = t.type === 'INCOME';
                const isLabour = t.type === 'WAGES';
                const badgeBg = isIncome ? '#ECFDF5' : (isLabour ? '#EEF2FF' : '#FEF2F2');
                const badgeColor = isIncome ? '#059669' : (isLabour ? '#4F46E5' : '#DC2626');
                const sign = isIncome ? '+' : '-';
                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; background: var(--bg-card-subtle); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 12px;">
                    <div style="flex: 1; min-width: 0; padding-right: 8px;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 10px; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; padding: 1px 5px; border-radius: 4px;">
                          ${t.type}
                        </span>
                        <span style="font-size: 11px; color: var(--text-muted);">${t.date || ''}</span>
                      </div>
                      <div style="font-weight: 600; color: var(--brand-navy-900); margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        ${t.description}
                      </div>
                    </div>
                    <div style="font-weight: 800; color: ${isIncome ? '#059669' : '#DC2626'}; text-align: right; white-space: nowrap;">
                      ${sign}₹${t.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                `;
              }).join('')}
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
              <button id="btn-quick-record-attendance" class="btn-outline quick-action-btn" style="min-height: 44px; font-size: 13px; font-weight: 700; border-color: #0284C7; color: #0284C7;">
                👷 Daily Attendance
              </button>
              <button id="btn-quick-scan-bill" class="btn-outline quick-action-btn" style="grid-column: span 2; min-height: 44px; font-size: 13px; font-weight: 700; background: var(--brand-gold-50); border-color: var(--brand-gold-500); color: var(--brand-gold-700);">
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
        window.appNavigate?.('documents');
      });
      container.querySelector('#btn-stat-labour-due')?.addEventListener('click', () => {
        window.appNavigate?.('labour');
      });
      container.querySelector('#btn-stat-today-att')?.addEventListener('click', () => {
        window.appNavigate?.('labour');
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
      container.querySelector('#btn-quick-record-attendance')?.addEventListener('click', () => {
        window.appNavigate?.('labour');
      });
      container.querySelector('#btn-view-all-txns')?.addEventListener('click', () => {
        window.appNavigate?.('reports');
      });

      // 5. Native Camera Scan Bill Trigger
      container.querySelector('#btn-quick-scan-bill')?.addEventListener('click', async () => {
        try {
          const photo = await CameraHelper.capturePhoto({ source: 'CAMERA' });
          if (photo) {
            window._pendingScannedPhoto = photo;
            window.appNavigate?.('documents');
          }
        } catch (e) {
          console.warn('Camera capture fallback:', e);
        }
      });

      // 6. Initialize Interactive Cash Flow Ring
      this.initCashRing(container, receipts, expenses);

    } catch (e) {
      container.innerHTML = `<div style="padding: 20px; color: var(--color-danger);">Failed to load dashboard: ${e.message}</div>`;
    }
  },

  initCashRing(container, receipts = [], expenses = []) {
    let currentPeriod = 'MONTH';

    const getPeriodDates = () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      return {
        today: `${yyyy}-${mm}-${dd}`,
        monthPrefix: `${yyyy}-${mm}`,
        yearPrefix: `${yyyy}`
      };
    };

    const updateRing = (period) => {
      currentPeriod = period;
      const { today, monthPrefix, yearPrefix } = getPeriodDates();

      // Filter transactions by period
      const periodReceipts = receipts.filter(r => {
        const d = r.receipt_date || '';
        if (period === 'DAY') return d === today;
        if (period === 'MONTH') return d.startsWith(monthPrefix);
        if (period === 'YEAR') return d.startsWith(yearPrefix);
        return true;
      });

      const periodExpenses = expenses.filter(e => {
        const d = e.expense_date || '';
        if (period === 'DAY') return d === today;
        if (period === 'MONTH') return d.startsWith(monthPrefix);
        if (period === 'YEAR') return d.startsWith(yearPrefix);
        return true;
      });

      const totalReceived = periodReceipts.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      const totalSpent = periodExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const netCash = totalReceived - totalSpent;

      // Group expenses by category
      const catTotals = {};
      for (const e of periodExpenses) {
        const cat = e.category || 'OTHER';
        catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(e.amount) || 0);
      }

      // Update Center text and numbers
      const centerVal = container.querySelector('#ring-center-val');
      const recVal = container.querySelector('#ring-total-received');
      const spentVal = container.querySelector('#ring-total-spent');
      const svg = container.querySelector('#svg-cash-ring');
      const catList = container.querySelector('#ring-category-list');

      if (centerVal) {
        const sign = netCash < 0 ? '-' : '';
        centerVal.textContent = `${sign}₹${Math.abs(Math.round(netCash)).toLocaleString('en-IN')}`;
        centerVal.style.color = netCash >= 0 ? 'var(--brand-navy-900)' : '#EF4444';
      }
      if (recVal) recVal.textContent = '₹' + totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (spentVal) spentVal.textContent = '₹' + totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Draw SVG Ring
      const r = 50;
      const C = 2 * Math.PI * r;
      const totalFlow = totalReceived + totalSpent;

      const categoryColors = {
        MATERIALS: '#F59E0B',
        TRANSPORT: '#06B6D4',
        EQUIPMENT: '#8B5CF6',
        RENT: '#EC4899',
        LABOUR: '#3B82F6',
        ELECTRICITY: '#EAB308',
        FOOD: '#10B981',
        MISCELLANEOUS: '#64748B',
        OTHER: '#64748B'
      };

      if (totalFlow === 0) {
        // Empty Ring
        svg.innerHTML = `
          <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--border-light)" stroke-width="14" />
        `;
        if (catList) catList.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 4px 0;">No cash flow in this period (₹0).</div>';
      } else {
        // Multi-segment donut
        let currentOffset = 0;
        let pathsHtml = `
          <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--border-light)" stroke-width="14" opacity="0.3" />
        `;

        // 1. Received Arc (Green)
        if (totalReceived > 0) {
          const recDash = (totalReceived / totalFlow) * C;
          pathsHtml += `
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="#10B981" stroke-width="14"
              stroke-dasharray="${recDash} ${C}" stroke-dashoffset="${-currentOffset}"
              transform="rotate(-90 70 70)" stroke-linecap="butt" />
          `;
          currentOffset += recDash;
        }

        // 2. Expense Category Arcs
        const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
        for (const [cat, amt] of sortedCats) {
          const catDash = (amt / totalFlow) * C;
          const color = categoryColors[cat] || '#64748B';
          pathsHtml += `
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="14"
              stroke-dasharray="${catDash} ${C}" stroke-dashoffset="${-currentOffset}"
              transform="rotate(-90 70 70)" stroke-linecap="butt" />
          `;
          currentOffset += catDash;
        }

        svg.innerHTML = pathsHtml;

        // Render Category breakdown list
        if (sortedCats.length === 0) {
          if (catList) catList.innerHTML = '<div style="color: var(--text-muted); font-size: 11px;">Zero expenses recorded.</div>';
        } else {
          if (catList) {
            catList.innerHTML = sortedCats.map(([cat, amt]) => {
              const share = totalSpent > 0 ? Math.round((amt / totalSpent) * 100) : 0;
              const col = categoryColors[cat] || '#64748B';
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                  <span style="display: flex; align-items: center; gap: 4px; color: var(--text-secondary);">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: ${col}; display: inline-block;"></span>
                    ${cat}
                  </span>
                  <span style="font-weight: 700; color: var(--brand-navy-900);">
                    ₹${amt.toLocaleString('en-IN')} <span style="font-size: 10px; color: var(--text-muted);">(${share}%)</span>
                  </span>
                </div>
              `;
            }).join('');
          }
        }
      }

      // Update button active states
      container.querySelectorAll('.btn-timeframe').forEach(b => {
        const isCurrent = b.dataset.period === period;
        b.style.background = isCurrent ? '#ea580c' : 'transparent';
        b.style.color = isCurrent ? '#ffffff' : 'var(--text-secondary)';
      });
    };

    container.querySelectorAll('.btn-timeframe').forEach(b => {
      b.addEventListener('click', () => {
        updateRing(b.dataset.period);
      });
    });

    updateRing(currentPeriod);
  }
};
