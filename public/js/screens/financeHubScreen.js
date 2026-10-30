/**
 * DDevUltraHome — Finance Hub Screen (Zero Horizontal Scrolling)
 * 
 * Unifies Receipts (Advances), Expenses, and Suppliers (Accounts Payable & Settle Dues)
 * into a single ergonomic, mobile-first segmented hub.
 */

import { IncomeScreen } from './incomeScreen.js';
import { ExpensesScreen } from './expensesScreen.js';
import { SuppliersScreen } from './suppliersScreen.js';
import { i18n } from '../i18n.js';

export const FinanceHubScreen = {
  currentTab: 'receipts', // 'receipts' | 'expenses' | 'suppliers'

  setTab(tab) {
    if (tab === 'income' || tab === 'receipts') this.currentTab = 'receipts';
    else if (tab === 'expenses') this.currentTab = 'expenses';
    else if (tab === 'suppliers') this.currentTab = 'suppliers';
  },

  async render(container) {
    const isTa = i18n.lang === 'ta';
    const receiptsLabel = isTa ? '💰 வரவுகள் (Receipts)' : '💰 Receipts';
    const expensesLabel = isTa ? '💳 செலவுகள் (Expenses)' : '💳 Expenses';
    const suppliersLabel = isTa ? '🏭 சப்ளையர்கள் (Suppliers)' : '🏭 Suppliers & Dues';

    container.innerHTML = `
      <div style="padding: 12px 14px 20px;">
        <!-- Clean Full-Width Segmented Tab Control (Zero Horizontal Scroll) -->
        <div style="background: #E2E8F0; padding: 4px; border-radius: var(--radius-md); display: flex; gap: 4px; margin-bottom: 14px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
          <button id="seg-btn-receipts" class="finance-seg-btn ${this.currentTab === 'receipts' ? 'active' : ''}" type="button" style="flex: 1; min-height: 42px; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'receipts' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${receiptsLabel}
          </button>
          <button id="seg-btn-expenses" class="finance-seg-btn ${this.currentTab === 'expenses' ? 'active' : ''}" type="button" style="flex: 1; min-height: 42px; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'expenses' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${expensesLabel}
          </button>
          <button id="seg-btn-suppliers" class="finance-seg-btn ${this.currentTab === 'suppliers' ? 'active' : ''}" type="button" style="flex: 1; min-height: 42px; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'suppliers' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
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
    const suppliersBtn = container.querySelector('#seg-btn-suppliers');

    const updateActiveButton = (activeTab) => {
      this.currentTab = activeTab;
      [receiptsBtn, expensesBtn, suppliersBtn].forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#1E293B';
        btn.style.boxShadow = 'none';
      });
      if (activeTab === 'receipts') {
        receiptsBtn.style.background = '#0B192C';
        receiptsBtn.style.color = '#ffffff';
        receiptsBtn.style.boxShadow = 'var(--shadow-sm)';
      } else if (activeTab === 'expenses') {
        expensesBtn.style.background = '#0B192C';
        expensesBtn.style.color = '#ffffff';
        expensesBtn.style.boxShadow = 'var(--shadow-sm)';
      } else if (activeTab === 'suppliers') {
        suppliersBtn.style.background = '#0B192C';
        suppliersBtn.style.color = '#ffffff';
        suppliersBtn.style.boxShadow = 'var(--shadow-sm)';
      }
    };

    const renderActiveSubScreen = async () => {
      if (this.currentTab === 'receipts') {
        await IncomeScreen.render(subMount);
      } else if (this.currentTab === 'expenses') {
        await ExpensesScreen.render(subMount);
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

    suppliersBtn?.addEventListener('click', async () => {
      updateActiveButton('suppliers');
      await renderActiveSubScreen();
    });

    // Render initial sub-screen
    await renderActiveSubScreen();
  }
};
