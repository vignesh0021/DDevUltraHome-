/**
 * DDevUltraHome — Income, Receipts & Advance Allocations Screen
 * 
 * Enforces rule: Client advance is an unearned liability until allocated to certified milestone.
 * Includes Quick Financial Calculator, receipt editing, voiding, and client balance tracking.
 */

import { BusinessApi } from '../businessApi.js';
import { AppDialog } from '../components/appDialog.js';
import { openQuickCalculator } from '../components/quickCalculator.js';

export const IncomeScreen = {
  projectsList: [],
  clientsList: [],

  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Income & Client Receipts</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Advances, Milestone Billings & Revenue Recognition</div>
          </div>
          <button id="btn-add-receipt" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px; background: #0B192C; color: white;">
            + Record Receipt
          </button>
        </div>

        <!-- Financial Control Rule Notice -->
        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px; font-size: 12px; color: #1E40AF; display: flex; gap: 8px;">
          <span style="font-size: 16px;">ℹ️</span>
          <div>
            <strong>Revenue Recognition Rule:</strong> Client mobilization advances are treated as unearned liabilities and credited to bank accounts, but are NOT recognized as profit until allocated to certified completed project milestones.
          </div>
        </div>

        <div id="receipts-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading receipts...</div>
        </div>
      </div>

      <!-- Add Receipt Modal -->
      <div id="modal-new-receipt" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Record Client Inflow</h3>
          <form id="form-create-receipt">
            <div class="form-group">
              <label class="form-label">Project Site</label>
              <select id="sel-rec-project" class="form-control">
                <option value="">General Overhead / Direct Receipt</option>
              </select>
              <div id="rec-project-balance-badge" style="font-size: 11px; color: #047857; margin-top: 4px; font-weight: 700;"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Client *</label>
              <select id="sel-rec-client" class="form-control" required></select>
            </div>
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Amount (₹) *</label>
                <div style="display: flex; gap: 4px;">
                  <input type="number" id="inp-rec-amount" class="form-control" step="any" min="0" required placeholder="500000" style="flex: 1;">
                  <button type="button" id="btn-rec-calc" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; border-radius: 8px; padding: 0 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                    🧮 Calc
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Receipt Date *</label>
                <input type="date" id="inp-rec-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Deposit Account *</label>
                <select id="sel-rec-account" class="form-control" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode</label>
                <select id="sel-rec-mode" class="form-control">
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI / GPay</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reference / UTR / Cheque No.</label>
              <input type="text" id="inp-rec-ref" class="form-control" placeholder="e.g. UTR-9988221">
            </div>
            <div class="form-group">
              <label class="form-label">Notes / Description</label>
              <input type="text" id="inp-rec-notes" class="form-control" placeholder="e.g. Stage 1 Foundation billing advance">
            </div>
            <div class="form-group" style="background: var(--bg-card-subtle); padding: 12px; border-radius: var(--radius-md);">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
                <input type="checkbox" id="chk-rec-advance" checked style="width: 18px; height: 18px;">
                Treat as Mobilization Advance (Unearned Deposit)
              </label>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; margin-left: 26px;">
                Keeps funds in liability until allocated to certified milestone.
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-rec" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary" style="background: #0B192C; color: white;">Record Inflow</button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadReceipts(container);

    const modal = container.querySelector('#modal-new-receipt');
    container.querySelector('#btn-add-receipt')?.addEventListener('click', async () => {
      await this.populateDropdowns(container);
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-rec')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Quick Calculator trigger
    container.querySelector('#btn-rec-calc')?.addEventListener('click', () => {
      const amtInput = container.querySelector('#inp-rec-amount');
      openQuickCalculator({
        targetInput: amtInput,
        title: 'Calculate Receipt Amount',
        initialValue: parseFloat(amtInput.value) || 0
      });
    });

    container.querySelector('#form-create-receipt')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        projectId: container.querySelector('#sel-rec-project').value || null,
        clientId: container.querySelector('#sel-rec-client').value,
        amount: parseFloat(container.querySelector('#inp-rec-amount').value),
        receiptDate: container.querySelector('#inp-rec-date').value,
        accountId: container.querySelector('#sel-rec-account').value,
        paymentMode: container.querySelector('#sel-rec-mode').value,
        referenceNumber: container.querySelector('#inp-rec-ref').value.trim() || undefined,
        notes: container.querySelector('#inp-rec-notes').value.trim() || undefined,
        isAdvance: container.querySelector('#chk-rec-advance').checked ? 1 : 0
      };

      try {
        await BusinessApi.request('/income/receipts', 'POST', payload);
        modal.style.display = 'none';
        await this.loadReceipts(container);
      } catch (err) {
        await AppDialog.alert({ title: 'Failed to record receipt', message: err.message });
      }
    });
  },

  async populateDropdowns(container) {
    const selPrj = container.querySelector('#sel-rec-project');
    const selCli = container.querySelector('#sel-rec-client');
    const badgeEl = container.querySelector('#rec-project-balance-badge');

    const [prjRes, cliRes, settingsRes] = await Promise.all([
      BusinessApi.request('/projects'),
      BusinessApi.request('/clients'),
      BusinessApi.request('/settings/company')
    ]);

    this.projectsList = (prjRes.projects || []).filter(p => p.id !== 'prj-business-overhead');
    this.clientsList = cliRes.clients || [];

    selPrj.innerHTML = '<option value="">-- General / Direct Business Receipt --</option>' +
      this.projectsList.map(p => `<option value="${p.id}">${p.name} (Contract: ₹${(p.contract_value || 0).toLocaleString('en-IN')})</option>`).join('');

    selCli.innerHTML = (this.clientsList || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Dynamic accounts
    const selAcc = container.querySelector('#sel-rec-account');
    const accounts = settingsRes.accounts || [];
    if (accounts.length > 0) {
      selAcc.innerHTML = accounts.map(a => `<option value="${a.id}">${a.account_name} (₹${(a.current_balance || 0).toLocaleString('en-IN')})</option>`).join('');
    } else {
      selAcc.innerHTML = '<option value="acc-hdfc-current">HDFC Bank Current</option>';
    }

    selPrj.onchange = () => {
      const p = this.projectsList.find(item => item.id === selPrj.value);
      if (p) {
        badgeEl.textContent = `Project: ${p.name} • Contract: ₹${(p.contract_value || 0).toLocaleString('en-IN')}`;
        if (p.client_id) selCli.value = p.client_id;
      } else {
        badgeEl.textContent = '';
      }
    };
  },

  async loadReceipts(container) {
    const listEl = container.querySelector('#receipts-list-container');
    try {
      const res = await BusinessApi.request('/income/receipts');
      const receipts = res.receipts || [];

      if (receipts.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No receipts recorded yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ Record Receipt" to record client advance or milestone billing.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${receipts.map(r => `
            <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--brand-navy-700); background: var(--bg-card-subtle); padding: 2px 6px; border-radius: 4px;">
                    ${r.receipt_number}
                  </span>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;">
                    ${r.project_name || 'General Business'}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Client: <strong>${r.client_name || 'Direct Client'}</strong> • ${r.receipt_date}
                  </div>
                  ${r.notes ? `<div style="font-size: 11px; color: #475569; margin-top: 3px; font-style: italic;">"${r.notes}"</div>` : ''}
                </div>
                <span class="badge-status ${r.is_advance ? 'badge-advance' : 'badge-paid'}">
                  ${r.is_advance ? 'Advance Liability' : 'Earned Revenue'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 13px; flex-wrap: wrap; gap: 8px;">
                <div>
                  <span style="color: var(--text-muted);">Deposited into:</span>
                  <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-left: 4px;">${r.account_name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="color: var(--color-success); font-size: 15px;">+₹${(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  <button class="btn-void-receipt btn-outline" data-id="${r.id}" data-number="${r.receipt_number}" data-amount="${r.amount}" style="min-height: 28px; padding: 0 8px; font-size: 11px; font-weight: 600; color: #DC2626; border-color: #FCA5A5;">
                    🚫 Void / Delete
                  </button>
                </div>
              </div>
              ${r.is_advance ? `
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px; background: #FAF5FF; padding: 6px 10px; border-radius: 6px;">
                  <span>Unallocated Liability: ₹${(parseFloat(r.unallocated_balance) || 0).toLocaleString('en-IN')}</span>
                  <span>Allocated to Milestones: ₹${(parseFloat(r.allocated_amount) || 0).toLocaleString('en-IN')}</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;

      // Wire Void Receipt buttons
      listEl.querySelectorAll('.btn-void-receipt').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const rId = e.currentTarget.dataset.id;
          const rNum = e.currentTarget.dataset.number;
          const amount = e.currentTarget.dataset.amount;

          const reason = await AppDialog.prompt({
            title: '🚫 Void Client Receipt',
            message: `Reason for VOIDING receipt "${rNum}" of ₹${parseFloat(amount).toLocaleString('en-IN')}?\n(Reversing entry will adjust account balance)`,
            placeholder: 'e.g. Cheque bounced / Payment reversed / Entry error'
          });
          if (!reason || !reason.trim()) return;

          try {
            await BusinessApi.request(`/income/receipts/${rId}/void`, 'POST', { reason: reason.trim() });
            await AppDialog.alert({
              title: 'Receipt Voided',
              message: '✅ Receipt voided successfully. Reversing entry posted and bank balance adjusted.'
            });
            await this.loadReceipts(container);
          } catch (err) {
            await AppDialog.alert({
              title: 'Voiding Failed',
              message: err.message
            });
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load receipts: ${e.message}</div>`;
    }
  }
};
