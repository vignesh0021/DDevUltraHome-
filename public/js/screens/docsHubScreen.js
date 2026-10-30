/**
 * DDevUltraHome — Documents & Quotations Hub Screen (Zero Horizontal Scrolling)
 * 
 * Unifies Quotations Builder (Watermarked A4 Proposals) and Document Vault & OCR Scanner
 * into a single ergonomic, mobile-first segmented hub.
 */

import { QuotationsScreen } from './quotationsScreen.js';
import { DocumentsScreen } from './documentsScreen.js';
import { i18n } from '../i18n.js';

export const DocsHubScreen = {
  currentTab: 'quotes', // 'quotes' | 'vault'

  setTab(tab) {
    if (tab === 'quotes' || tab === 'quotations') this.currentTab = 'quotes';
    else if (tab === 'vault' || tab === 'documents') this.currentTab = 'vault';
  },

  async render(container) {
    const isTa = i18n.lang === 'ta';
    const quotesLabel = isTa ? '📑 விலைப்புள்ளி (Quotations)' : '📑 Quotation Builder';
    const vaultLabel = isTa ? '📁 ஆவணங்கள் & OCR (Vault)' : '📁 Document Vault & OCR';

    container.innerHTML = `
      <div style="padding: 12px 14px 20px;">
        <!-- Clean Full-Width Segmented Tab Control (Zero Horizontal Scroll) -->
        <div style="background: #E2E8F0; padding: 4px; border-radius: var(--radius-md); display: flex; gap: 4px; margin-bottom: 14px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
          <button id="seg-btn-quotes" class="docs-seg-btn ${this.currentTab === 'quotes' ? 'active' : ''}" type="button" style="flex: 1; min-height: 42px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'quotes' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${quotesLabel}
          </button>
          <button id="seg-btn-vault" class="docs-seg-btn ${this.currentTab === 'vault' ? 'active' : ''}" type="button" style="flex: 1; min-height: 42px; border: none; border-radius: var(--radius-sm); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; ${this.currentTab === 'vault' ? 'background: #0B192C; color: #ffffff; box-shadow: var(--shadow-sm);' : 'background: transparent; color: #1E293B;'}">
            ${vaultLabel}
          </button>
        </div>

        <!-- Sub-Mount for Selected Document Screen -->
        <div id="docs-sub-mount"></div>
      </div>
    `;

    const subMount = container.querySelector('#docs-sub-mount');
    const quotesBtn = container.querySelector('#seg-btn-quotes');
    const vaultBtn = container.querySelector('#seg-btn-vault');

    const updateActiveButton = (activeTab) => {
      this.currentTab = activeTab;
      [quotesBtn, vaultBtn].forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#1E293B';
        btn.style.boxShadow = 'none';
      });
      if (activeTab === 'quotes') {
        quotesBtn.style.background = '#0B192C';
        quotesBtn.style.color = '#ffffff';
        quotesBtn.style.boxShadow = 'var(--shadow-sm)';
      } else if (activeTab === 'vault') {
        vaultBtn.style.background = '#0B192C';
        vaultBtn.style.color = '#ffffff';
        vaultBtn.style.boxShadow = 'var(--shadow-sm)';
      }
    };

    const renderActiveSubScreen = async () => {
      if (this.currentTab === 'quotes') {
        await QuotationsScreen.render(subMount);
      } else if (this.currentTab === 'vault') {
        await DocumentsScreen.render(subMount);
      }
    };

    quotesBtn?.addEventListener('click', async () => {
      updateActiveButton('quotes');
      await renderActiveSubScreen();
    });

    vaultBtn?.addEventListener('click', async () => {
      updateActiveButton('vault');
      await renderActiveSubScreen();
    });

    // Render initial sub-screen
    await renderActiveSubScreen();
  }
};
