/**
 * DDevUltraHome — Expenses & Site Purchases Screen
 */

import { BusinessApi } from '../businessApi.js';

export const ExpensesScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Expenses & Site Purchases</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Labour payouts, material purchases & petty cash</div>
          </div>
          <button id="btn-add-expense" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px;">
            + Log Expense
          </button>
        </div>

        <div id="expenses-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading expenses...</div>
        </div>
      </div>

      <!-- Add Expense Modal -->
      <div id="modal-new-expense" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Log Project Expense</h3>
          <form id="form-create-expense">
            <div class="form-group">
              <label class="form-label">Project *</label>
              <select id="sel-exp-project" class="form-control" required></select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Category *</label>
                <select id="sel-exp-category" class="form-control" required>
                  <option value="LABOUR">Labour Payout</option>
                  <option value="MATERIAL_PURCHASE">Material Purchase</option>
                  <option value="EQUIPMENT_RENTAL">Equipment & Machinery</option>
                  <option value="TRANSPORT">Transport & Freight</option>
                  <option value="SITE_PURCHASES">Site Petty Cash Purchase</option>
                  <option value="STATUTORY_FEES">Govt / CMDA / EB Fee</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Amount (₹) *</label>
                <input type="number" id="inp-exp-amount" class="form-control" step="0.01" required placeholder="25000">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Paid To / Vendor *</label>
                <input type="text" id="inp-exp-vendor" class="form-control" required placeholder="e.g. Site Masons Guild">
              </div>
              <div class="form-group">
                <label class="form-label">Expense Date *</label>
                <input type="date" id="inp-exp-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Deduct From Account *</label>
                <select id="sel-exp-account" class="form-control" required>
                  <option value="acc-hdfc-current">HDFC Bank Current</option>
                  <option value="acc-petty-cash">Site Petty Cash</option>
                  <option value="acc-icici-escrow">ICICI Project Escrow</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode</label>
                <select id="sel-exp-mode" class="form-control">
                  <option value="BANK_TRANSFER">Bank Transfer / UPI</option>
                  <option value="PETTY_CASH">Petty Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes / Bill Reference</label>
              <input type="text" id="inp-exp-notes" class="form-control" placeholder="e.g. Masonry labour week 42">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-exp" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Post Expense</button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadExpenses(container);

    const modal = container.querySelector('#modal-new-expense');
    container.querySelector('#btn-add-expense')?.addEventListener('click', async () => {
      await this.populateProjectDropdown(container);
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-exp')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    container.querySelector('#form-create-expense')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        projectId: container.querySelector('#sel-exp-project').value,
        category: container.querySelector('#sel-exp-category').value,
        amount: parseFloat(container.querySelector('#inp-exp-amount').value),
        paidTo: container.querySelector('#inp-exp-vendor').value.trim(),
        expenseDate: container.querySelector('#inp-exp-date').value,
        accountId: container.querySelector('#sel-exp-account').value,
        paymentMode: container.querySelector('#sel-exp-mode').value,
        notes: container.querySelector('#inp-exp-notes').value.trim() || undefined
      };

      try {
        await BusinessApi.request('/expenses', 'POST', payload);
        modal.style.display = 'none';
        await this.loadExpenses(container);
      } catch (err) {
        alert('Failed to record expense: ' + err.message);
      }
    });
  },

  async populateProjectDropdown(container) {
    const selPrj = container.querySelector('#sel-exp-project');
    const prjRes = await BusinessApi.request('/projects');
    selPrj.innerHTML = (prjRes.projects || []).map(p => `<option value="${p.id}">${p.name} (${p.project_code})</option>`).join('');
  },

  async loadExpenses(container) {
    const listEl = container.querySelector('#expenses-list-container');
    try {
      const res = await BusinessApi.request('/expenses');
      const expenses = res.expenses || [];

      if (expenses.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No expenses recorded yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ Log Expense" to post direct construction outflows.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${expenses.map(e => `
            <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--brand-gold-600); background: var(--brand-gold-50); padding: 2px 6px; border-radius: 4px;">
                    ${e.category}
                  </span>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;">
                    ${e.paid_to}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Project: <strong>${e.project_name || 'General Site'}</strong> • ${e.expense_date}
                  </div>
                </div>
                <strong style="color: var(--color-danger); font-size: 15px;">-₹${(e.amount || 0).toLocaleString('en-IN')}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-light); font-size: 12px; color: var(--text-secondary);">
                <span>Account: ${e.account_name}</span>
                <span>Mode: ${e.payment_mode}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load expenses: ${e.message}</div>`;
    }
  }
};
