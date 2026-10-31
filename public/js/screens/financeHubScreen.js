/**
 * DDevUltraHome — Finance Hub Screen (Zero Horizontal Scrolling)
 * 
 * Unifies Receipts (Advances), Expenses, Labour (Attendance, Wages, Ledger),
 * and Suppliers (Accounts Payable & Settle Dues) into a single ergonomic, mobile-first segmented hub.
 */

import { IncomeScreen } from './incomeScreen.js';
import { ExpensesScreen } from './expensesScreen.js';
import { LabourScreen } from './labourScreen.js';
import { SuppliersScreen } from './suppliersScreen.js';
import { i18n } from '../i18n.js';

export const FinanceHubScreen = {
  currentTab: 'receipts', // 'receipts' | 'expenses' | 'labour' | 'suppliers'

  setTab(tab) {
    if (tab === 'income' || tab === 'receipts') this.currentTab = 'receipts';
    else if (tab === 'expenses') this.currentTab = 'expenses';
    else if (tab === 'labour' || tab === 'attendance') this.currentTab = 'labour';
    else if (tab === 'suppliers') this.currentTab = 'suppliers';
  },

  async render(container) {
    const isTa = i18n.lang === 'ta';
    const receiptsLabel = isTa ? '💰 வரவு' : '💰 Receipts';
    const expensesLabel = isTa ? '💳 செலவு' : '💳 Expenses';
    const labourLabel = isTa ? '👷 கூலி' : '👷 Labour';
    const suppliersLabel = isTa ? '🏭 சப்ளையர்' : '🏭 Suppliers';

    container.innerHTML = `
      <div style="padding: 12px 14px 20px;">
        <!-- Clean Full-Width Segmented Tab Control (Zero Horizontal Scroll, 4 equal tabs) -->
        <div style="background: #E2E8F0; padding: 4px; border-radius: var(--radius-md); display: flex; gap: 4px; margin-bottom: 14px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
          <button id="seg-btn-receipts" class="finance-seg-btn ${this.currentTab === 'receipts' ? 'active' : ''}" type="button" style="flex: 1; min-height: 40px; border: none; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'receipts' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${receiptsLabel}
          </button>
          <button id="seg-btn-expenses" class="finance-seg-btn ${this.currentTab === 'expenses' ? 'active' : ''}" type="button" style="flex: 1; min-height: 40px; border: none; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'expenses' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${expensesLabel}
          </button>
          <button id="seg-btn-labour" class="finance-seg-btn ${this.currentTab === 'labour' ? 'active' : ''}" type="button" style="flex: 1; min-height: 40px; border: none; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'labour' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${labourLabel}
          </button>
          <button id="seg-btn-suppliers" class="finance-seg-btn ${this.currentTab === 'suppliers' ? 'active' : ''}" type="button" style="flex: 1; min-height: 40px; border: none; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'suppliers' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${suppliersLabel}
          </button>
        </div>

        <!-- Sub-Mount for Selected Financial Screen -->
        <div id="finance-sub-mount"></div>
      </div>
    `;

    const subMount = container.querySelector('#finance-sub-mount');
    const receiptsBtn = container.querySelector('#seg-btn-receipts');
    const expensesBtn = container.querySelector('#seg-btn-expenses');
    const labourBtn = container.querySelector('#seg-btn-labour');
    const suppliersBtn = container.querySelector('#seg-btn-suppliers');

    const updateActiveButton = (activeTab) => {
      this.currentTab = activeTab;
      [receiptsBtn, expensesBtn, labourBtn, suppliersBtn].forEach(btn => {
        if (!btn) return;
        btn.style.background = 'transparent';
        btn.style.color = '#1E293B';
        btn.style.boxShadow = 'none';
      });
      const activeBtn = activeTab === 'receipts' ? receiptsBtn
        : activeTab === 'expenses' ? expensesBtn
        : activeTab === 'labour' ? labourBtn
        : suppliersBtn;

      if (activeBtn) {
        activeBtn.style.background = '#0B192C';
        activeBtn.style.color = '#ffffff';
        activeBtn.style.boxShadow = 'var(--shadow-sm)';
      }
    };

    const renderActiveSubScreen = async () => {
      if (this.currentTab === 'receipts') {
        await IncomeScreen.render(subMount);
      } else if (this.currentTab === 'expenses') {
        await ExpensesScreen.render(subMount);
      } else if (this.currentTab === 'labour') {
        await LabourScreen.render(subMount);
      } else if (this.currentTab === 'suppliers') {
        await SuppliersScreen.render(subMount);
      }
    };

    receiptsBtn?.addEventListener('click', async () => {
      updateActiveButton('receipts');
      await renderActiveSubScreen();
    });

    expensesBtn?.addEventListener('click', async () => {
      updateActiveButton('expenses');
      await renderActiveSubScreen();
    });

    labourBtn?.addEventListener('click', async () => {
      updateActiveButton('labour');
      await renderActiveSubScreen();
    });

    suppliersBtn?.addEventListener('click', async () => {
      updateActiveButton('suppliers');
      await renderActiveSubScreen();
    });

    // Render initial sub-screen
    await renderActiveSubScreen();
  }
};
