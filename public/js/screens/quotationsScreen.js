/**
 * DDevUltraHome — Quotations & Estimates Screen
 */

import { BusinessApi } from '../businessApi.js';

export const QuotationsScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Quotations & Estimates</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Itemized cost proposals & revision records</div>
          </div>
          <button id="btn-add-quote" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px;">
            + New Quote
          </button>
        </div>

        <div id="quotations-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading quotations...</div>
        </div>
      </div>
    `;

    await this.loadQuotations(container);
  },

  async loadQuotations(container) {
    const listEl = container.querySelector('#quotations-list-container');
    try {
      const res = await BusinessApi.request('/quotations');
      const quotations = res.quotations || [];

      if (quotations.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No quotations generated yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Itemized estimates are tracked with versioning & client approval status.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${quotations.map(q => `
            <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--brand-gold-600); background: var(--brand-gold-50); padding: 2px 6px; border-radius: 4px;">
                    ${q.quotation_number} (Rev ${q.revision_number})
                  </span>
                  <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;">
                    ${q.project_name}
                  </div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Client: <strong>${q.client_name}</strong>
                  </div>
                </div>
                <span class="badge-status badge-${(q.status || 'DRAFT').toLowerCase()}">
                  ${q.status}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-light); font-size: 13px;">
                <span style="color: var(--text-secondary);">Estimate Total:</span>
                <strong style="color: var(--brand-navy-900);">₹${(q.total_amount || 0).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load quotations: ${e.message}</div>`;
    }
  }
};
