/**
 * DDevUltraHome — Expenses & Site Purchases Screen
 * 
 * Supports Direct Project & Business-level expenses, categories (Materials, Transport,
 * Equipment, Rent, Labour, Electricity, Food, Misc), Quick Financial Calculator,
 * date/category filtering, and audit voiding.
 */

import { BusinessApi } from '../businessApi.js';
import { AppDialog } from '../components/appDialog.js';
import { openQuickCalculator } from '../components/quickCalculator.js';

export const ExpensesScreen = {
  currentCategoryFilter: '',
  currentDateFilter: '',

  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Expenses & Site Purchases</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Labour payouts, material purchases & petty cash</div>
          </div>
          <button id="btn-add-expense" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px; background: #0B192C; color: white;">
            + Log Expense
          </button>
        </div>

        <!-- Filter Bar -->
        <div style="background: var(--bg-card, #FFF); border: 1px solid var(--border-light, #E2E8F0); border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; display: flex; gap: 8px;">
          <div style="flex: 1.2;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Filter Category</label>
            <select id="filter-exp-category" class="form-control" style="width: 100%; font-size: 12px;">
              <option value="">All Categories</option>
              <option value="MATERIALS">Materials</option>
              <option value="TRANSPORT">Transport</option>
              <option value="EQUIPMENT">Equipment</option>
              <option value="RENT">Rent</option>
              <option value="LABOUR">Labour</option>
              <option value="ELECTRICITY">Electricity</option>
              <option value="FOOD">Food & Meals</option>
              <option value="MISCELLANEOUS">Miscellaneous</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">Filter Date</label>
            <input type="date" id="filter-exp-date" class="form-control" style="width: 100%; font-size: 12px;">
          </div>
        </div>

        <div id="expenses-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading expenses...</div>
        </div>
      </div>

      <!-- Add Expense Modal -->
      <div id="modal-new-expense" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Log Expense / Purchase</h3>
          <form id="form-create-expense">
            <div class="form-group">
              <label class="form-label">Project Site</label>
              <select id="sel-exp-project" class="form-control">
                <option value="">General Business / HQ Overhead</option>
              </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Category *</label>
                <select id="sel-exp-category" class="form-control" required>
                  <option value="MATERIALS">Materials</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="EQUIPMENT">Equipment</option>
                  <option value="RENT">Rent</option>
                  <option value="LABOUR">Labour</option>
                  <option value="ELECTRICITY">Electricity</option>
                  <option value="FOOD">Food & Meals</option>
                  <option value="MISCELLANEOUS" selected>Miscellaneous</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Amount (₹) *</label>
                <div style="display: flex; gap: 4px;">
                  <input type="number" id="inp-exp-amount" class="form-control" step="any" min="0" required placeholder="25000" style="flex: 1;">
                  <button type="button" id="btn-exp-calc" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; border-radius: 8px; padding: 0 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                    🧮 Calc
                  </button>
                </div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Paid To / Vendor *</label>
                <input type="text" id="inp-exp-vendor" class="form-control" required placeholder="e.g. Sri Balaji Hardware">
              </div>
              <div class="form-group">
                <label class="form-label">Expense Date *</label>
                <input type="date" id="inp-exp-date" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Deduct From Account *</label>
                <select id="sel-exp-account" class="form-control" required></select>
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
              <input type="text" id="inp-exp-notes" class="form-control" placeholder="e.g. 50 bags OPC 53 Grade cement">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-exp" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary" style="background: #0B192C; color: white;">Post Expense</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit Expense Modal -->
      <div id="modal-edit-expense" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 220; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Edit Expense Details</h3>
          <form id="form-edit-expense">
            <input type="hidden" id="edit-exp-id">
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select id="edit-exp-category" class="form-control" required>
                <option value="MATERIALS">Materials</option>
                <option value="TRANSPORT">Transport</option>
                <option value="EQUIPMENT">Equipment</option>
                <option value="RENT">Rent</option>
                <option value="LABOUR">Labour</option>
                <option value="ELECTRICITY">Electricity</option>
                <option value="FOOD">Food & Meals</option>
                <option value="MISCELLANEOUS">Miscellaneous</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Paid To / Vendor *</label>
              <input type="text" id="edit-exp-vendor" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Expense Date *</label>
              <input type="date" id="edit-exp-date" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Amount (₹) *</label>
              <div style="display: flex; gap: 4px;">
                <input type="number" id="edit-exp-amount" class="form-control" step="any" min="0.01" required style="flex: 1;">
                <button type="button" id="btn-edit-exp-calc" style="background: #EEF2FF; color: #4338CA; border: 1px solid #C7D2FE; border-radius: 8px; padding: 0 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                  🧮 Calc
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes / Description</label>
              <input type="text" id="edit-exp-notes" class="form-control">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-edit-exp" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary" style="background: #0B192C; color: white;">Update Expense</button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadExpenses(container);

    const modal = container.querySelector('#modal-new-expense');
    const editModal = container.querySelector('#modal-edit-expense');

    container.querySelector('#btn-add-expense')?.addEventListener('click', async () => {
      await this.populateProjectDropdown(container);
      modal.style.display = 'flex';
    });

    container.querySelector('#btn-cancel-exp')?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    container.querySelector('#btn-cancel-edit-exp')?.addEventListener('click', () => {
      editModal.style.display = 'none';
    });

    // Quick Calculator triggers
    container.querySelector('#btn-exp-calc')?.addEventListener('click', () => {
      const amtInput = container.querySelector('#inp-exp-amount');
      openQuickCalculator({
        targetInput: amtInput,
        title: 'Calculate Expense Amount',
        initialValue: parseFloat(amtInput?.value) || 0
      });
    });

    container.querySelector('#btn-edit-exp-calc')?.addEventListener('click', () => {
      const amtInput = container.querySelector('#edit-exp-amount');
      openQuickCalculator({
        targetInput: amtInput,
        title: 'Calculate Expense Amount',
        initialValue: parseFloat(amtInput?.value) || 0
      });
    });

    // Filter bindings
    container.querySelector('#filter-exp-category')?.addEventListener('change', (e) => {
      this.currentCategoryFilter = e.target.value;
      this.renderFilteredList(container);
    });

    container.querySelector('#filter-exp-date')?.addEventListener('change', (e) => {
      this.currentDateFilter = e.target.value;
      this.renderFilteredList(container);
    });

    container.querySelector('#form-edit-expense')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const expId = container.querySelector('#edit-exp-id').value;
      const payload = {
        category: container.querySelector('#edit-exp-category').value,
        paid_to: container.querySelector('#edit-exp-vendor').value.trim(),
        expense_date: container.querySelector('#edit-exp-date').value,
        notes: container.querySelector('#edit-exp-notes').value.trim(),
        amount: parseFloat(container.querySelector('#edit-exp-amount').value) || 0
      };

      try {
        await BusinessApi.request(`/expenses/${expId}`, 'PUT', payload);
        editModal.style.display = 'none';
        await this.loadExpenses(container);
      } catch (err) {
        await AppDialog.alert({ title: 'Update Failed', message: err.message });
      }
    });

    container.querySelector('#form-create-expense')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        projectId: container.querySelector('#sel-exp-project').value || null,
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
        await AppDialog.alert({ title: 'Failed to record expense', message: err.message });
      }
    });
  },

  async populateProjectDropdown(container) {
    const selPrj = container.querySelector('#sel-exp-project');
    const [prjRes, settingsRes] = await Promise.all([
      BusinessApi.request('/projects'),
      BusinessApi.request('/settings/company')
    ]);
    const projects = (prjRes.projects || []).filter(p => p.id !== 'prj-business-overhead');
    selPrj.innerHTML = '<option value="">-- General Business / HQ Overhead --</option>' +
      projects.map(p => `<option value="${p.id}">${p.name} (${p.project_code || 'PRJ'})</option>`).join('');

    const selAcc = container.querySelector('#sel-exp-account');
    const accounts = settingsRes.accounts || [];
    if (accounts.length > 0) {
      selAcc.innerHTML = accounts.map(a => `<option value="${a.id}">${a.account_name} (₹${(a.current_balance || 0).toLocaleString('en-IN')})</option>`).join('');
    } else {
      selAcc.innerHTML = '<option value="acc-hdfc-current">HDFC Bank Current</option>';
    }
  },

  async loadExpenses(container) {
    try {
      const res = await BusinessApi.request('/expenses');
      this.cachedExpenses = res.expenses || [];
      this.renderFilteredList(container);
    } catch (e) {
      const listEl = container.querySelector('#expenses-list-container');
      if (listEl) listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load expenses: ${e.message}</div>`;
    }
  },

  renderFilteredList(container) {
    const listEl = container.querySelector('#expenses-list-container');
    if (!listEl) return;

    let filtered = this.cachedExpenses || [];
    if (this.currentCategoryFilter) {
      filtered = filtered.filter(e => (e.category || '').toUpperCase() === this.currentCategoryFilter.toUpperCase());
    }
    if (this.currentDateFilter) {
      filtered = filtered.filter(e => e.expense_date === this.currentDateFilter);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
          <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No matching expenses found</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ Log Expense" or adjust filter criteria.</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${filtered.map(e => `
          <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 14px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span style="font-size: 11px; font-weight: 700; color: #1E40AF; background: #DBEAFE; padding: 2px 6px; border-radius: 4px;">
                  ${e.category}
                </span>
                <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;">
                  ${e.paid_to}
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  Project: <strong>${e.project_name || 'General Business'}</strong> • ${e.expense_date}
                </div>
                ${e.notes ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">"${e.notes}"</div>` : ''}
              </div>
              <strong style="color: var(--color-danger); font-size: 15px;">-₹${(parseFloat(e.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-light); font-size: 12px; color: var(--text-secondary); flex-wrap: wrap; gap: 6px;">
              <span>Account: <strong>${e.account_name}</strong> (${e.payment_mode})</span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-edit-exp btn-outline" data-id="${e.id}" style="min-height: 28px; padding: 0 10px; font-size: 11px; font-weight: 600;">
                  ✏️ Edit
                </button>
                <button class="btn-void-exp btn-outline" data-id="${e.id}" data-amount="${e.amount}" data-vendor="${e.paid_to}" style="min-height: 28px; padding: 0 8px; font-size: 11px; font-weight: 600; color: #DC2626; border-color: #FCA5A5;">
                  🚫 Void / Delete
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire Edit Expense buttons
    listEl.querySelectorAll('.btn-edit-exp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const expId = e.currentTarget.dataset.id;
        const exp = (this.cachedExpenses || []).find(x => x.id === expId);
        if (!exp) return;

        container.querySelector('#edit-exp-id').value = exp.id;
        container.querySelector('#edit-exp-category').value = exp.category;
        container.querySelector('#edit-exp-vendor').value = exp.paid_to;
        container.querySelector('#edit-exp-date').value = exp.expense_date;
        container.querySelector('#edit-exp-notes').value = exp.notes || '';
        container.querySelector('#edit-exp-amount').value = exp.amount || '';

        container.querySelector('#modal-edit-expense').style.display = 'flex';
      });
    });

    // Wire Void Expense buttons
    listEl.querySelectorAll('.btn-void-exp').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const expId = e.currentTarget.dataset.id;
        const amount = e.currentTarget.dataset.amount;
        const vendor = e.currentTarget.dataset.vendor;

        const reason = await AppDialog.prompt({
          title: '🚫 Void Project Expense',
          message: `Reason for VOIDING expense of ₹${parseFloat(amount).toLocaleString('en-IN')} paid to "${vendor}"?\n(Double-entry ledger credit will reverse this deduction and refund your bank balance)`,
          placeholder: 'e.g. Cancelled delivery / Refunded payment'
        });
        if (!reason || !reason.trim()) return;

        try {
          await BusinessApi.request(`/expenses/${expId}/void`, 'POST', { reason: reason.trim() });
          await AppDialog.alert({
            title: 'Expense Voided',
            message: '✅ Expense voided successfully. Reversing ledger credit posted and account balance refunded.'
          });
          await this.loadExpenses(container);
        } catch (err) {
          await AppDialog.alert({
            title: 'Voiding Failed',
            message: err.message
          });
        }
      });
    });
  }
};
