/**
 * DDevUltraHome — Documents, Watermarking & Human OCR Review Gate Screen
 * 
 * Enforces rule: Raw OCR extraction is provisional and requires human verification
 * before any financial record is generated.
 */

import { BusinessApi } from '../businessApi.js';

export const DocumentsScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Documents & OCR Gate</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Digital Vault, Watermarking & Human-Verified Bill Scanning</div>
          </div>
          <button id="btn-upload-bill" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px;">
            📷 Scan Bill
          </button>
        </div>

        <!-- Pending Human Verification Reviews Banner -->
        <div id="ocr-pending-banner" style="display: none; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 18px;">⚠️</span>
              <div>
                <strong style="color: #92400E; font-size: 13px;">Unverified OCR Invoices Pending</strong>
                <div style="font-size: 11px; color: #78350F;">Human verification gate requires Accountant or Owner sign-off before posting to ledger.</div>
              </div>
            </div>
            <button id="btn-review-ocr-pending" class="btn-gold" style="min-height: 34px; padding: 0 12px; font-size: 12px;">
              Review Now
            </button>
          </div>
        </div>

        <!-- Section: Watermark Preview Demo -->
        <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 700; color: var(--brand-navy-900);">Document Watermark Protection</span>
            <button id="btn-preview-watermark" class="btn-outline" style="min-height: 32px; font-size: 11px; padding: 0 10px;">
              Generate Watermark
            </button>
          </div>
          <div id="watermark-svg-container" style="margin-top: 10px; display: none; background: #F8FAFC; border: 1px dashed var(--border-medium); border-radius: 6px; padding: 10px; text-align: center;">
          </div>
        </div>

        <!-- Document Vault List -->
        <div>
          <h3 style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin: 0 0 10px;">Corporate Document Vault</h3>
          <div id="documents-list-container">
            <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading vault...</div>
          </div>
        </div>
      </div>

      <!-- Human OCR Verification Review Modal -->
      <div id="modal-ocr-verify" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 300; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Human OCR Verification Gate</h3>
            <span class="badge-status badge-pending">Provisional</span>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 16px;">
            Inspect OCR extracted figures against physical receipt before authorizing double-entry posting.
          </p>

          <form id="form-ocr-verify">
            <input type="hidden" id="inp-ocr-review-id">
            <div class="form-group">
              <label class="form-label">Invoice / Bill Number *</label>
              <input type="text" id="inp-ocr-inv" class="form-control" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Total Amount (₹) *</label>
                <input type="number" id="inp-ocr-amount" class="form-control" step="0.01" required>
              </div>
              <div class="form-group">
                <label class="form-label">Bill Date *</label>
                <input type="date" id="inp-ocr-date" class="form-control" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Assign Supplier</label>
              <select id="sel-ocr-supplier" class="form-control"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Assign Project</label>
              <select id="sel-ocr-project" class="form-control"></select>
            </div>
            <div class="form-group">
              <label class="form-label">Verification Notes</label>
              <input type="text" id="inp-ocr-notes" class="form-control" placeholder="e.g. Verified with weighbridge slip">
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
              <button type="button" id="btn-reject-ocr" class="btn-outline" style="color: var(--color-danger); border-color: var(--color-danger);">
                Reject Bill
              </button>
              <div style="display: flex; gap: 10px;">
                <button type="button" id="btn-cancel-ocr" class="btn-outline">Cancel</button>
                <button type="submit" class="btn-primary">Confirm & Post</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadVault(container);
    await this.checkPendingOcr(container);

    // Watermark preview toggle
    const wmBtn = container.querySelector('#btn-preview-watermark');
    const wmBox = container.querySelector('#watermark-svg-container');
    wmBtn?.addEventListener('click', async () => {
      try {
        const res = await BusinessApi.request('/documents/watermark-svg');
        wmBox.innerHTML = res.svg || '';
        wmBox.style.display = wmBox.style.display === 'none' ? 'block' : 'none';
      } catch (e) {
        alert('Watermark preview error: ' + e.message);
      }
    });

    // Modal controls
    const verifyModal = container.querySelector('#modal-ocr-verify');
    container.querySelector('#btn-cancel-ocr')?.addEventListener('click', () => {
      verifyModal.style.display = 'none';
    });

    container.querySelector('#btn-review-ocr-pending')?.addEventListener('click', async () => {
      await this.openFirstPendingReview(container);
    });

    // Confirm handler
    container.querySelector('#form-ocr-verify')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = BusinessApi.getActiveUser();

      const reviewId = container.querySelector('#inp-ocr-review-id').value;
      const verifiedFields = {
        invoiceNumber: container.querySelector('#inp-ocr-inv').value.trim(),
        totalAmount: parseFloat(container.querySelector('#inp-ocr-amount').value),
        date: container.querySelector('#inp-ocr-date').value,
        supplierId: container.querySelector('#sel-ocr-supplier').value || undefined,
        projectId: container.querySelector('#sel-ocr-project').value || undefined
      };
      const notes = container.querySelector('#inp-ocr-notes').value.trim();

      try {
        await BusinessApi.request('/ocr/verify', 'POST', {
          reviewId,
          userId: user.id,
          userRole: user.role,
          action: 'CONFIRMED',
          verifiedFields,
          notes,
          financialAction: 'SUPPLIER_INVOICE'
        });

        alert('✅ Bill verified! Supplier invoice posted to Accounts Payable.');
        verifyModal.style.display = 'none';
        await this.loadVault(container);
        await this.checkPendingOcr(container);
      } catch (err) {
        alert('Verification failed: ' + err.message);
      }
    });

    // Reject handler
    container.querySelector('#btn-reject-ocr')?.addEventListener('click', async () => {
      const user = BusinessApi.getActiveUser();
      const reviewId = container.querySelector('#inp-ocr-review-id').value;
      const notes = container.querySelector('#inp-ocr-notes').value.trim() || 'Rejected during human review';

      try {
        await BusinessApi.request('/ocr/verify', 'POST', {
          reviewId,
          userId: user.id,
          userRole: user.role,
          action: 'REJECTED',
          notes
        });

        alert('Bill rejected and archived.');
        verifyModal.style.display = 'none';
        await this.loadVault(container);
        await this.checkPendingOcr(container);
      } catch (err) {
        alert('Rejection failed: ' + err.message);
      }
    });
  },

  async loadVault(container) {
    const listEl = container.querySelector('#documents-list-container');
    try {
      const res = await BusinessApi.request('/documents');
      const docs = res.documents || [];

      if (docs.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No documents archived</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Drawings, contracts and vendor bills have cryptographic SHA-256 hashes.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${docs.map(d => `
            <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 14px; box-shadow: var(--shadow-sm);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900);">
                    📄 ${d.file_name}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                    Type: <strong>${d.document_type}</strong> • ${d.file_size ? `${Math.round(d.file_size / 1024)} KB` : 'Archived'}
                  </div>
                </div>
                <span class="badge-status badge-${d.ocr_status === 'HUMAN_VERIFIED' ? 'verified' : 'pending'}">
                  ${d.ocr_status}
                </span>
              </div>
              <div style="margin-top: 8px; font-family: monospace; font-size: 10px; color: var(--text-muted); background: var(--bg-card-subtle); padding: 4px 8px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                SHA256: ${d.sha256_hash || 'SHA-256 Calculated'}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load vault: ${e.message}</div>`;
    }
  },

  async checkPendingOcr(container) {
    const banner = container.querySelector('#ocr-pending-banner');
    try {
      const res = await BusinessApi.request('/ocr/reviews', 'GET', null);
      const reviews = (res.reviews || []).filter(r => r.verification_status === 'UNVERIFIED');
      banner.style.display = reviews.length > 0 ? 'block' : 'none';
    } catch (e) {
      banner.style.display = 'none';
    }
  },

  async openFirstPendingReview(container) {
    const modal = container.querySelector('#modal-ocr-verify');
    try {
      const res = await BusinessApi.request('/ocr/reviews');
      const pending = (res.reviews || []).find(r => r.verification_status === 'UNVERIFIED');
      if (!pending) {
        alert('No pending OCR reviews found.');
        return;
      }

      const f = pending.extractedFields || {};
      container.querySelector('#inp-ocr-review-id').value = pending.id;
      container.querySelector('#inp-ocr-inv').value = f.invoiceNumber || '';
      container.querySelector('#inp-ocr-amount').value = f.totalAmount || '';
      container.querySelector('#inp-ocr-date').value = f.date || new Date().toISOString().split('T')[0];

      // Populate dropdowns
      const selSup = container.querySelector('#sel-ocr-supplier');
      const selPrj = container.querySelector('#sel-ocr-project');

      const supRes = await BusinessApi.request('/suppliers');
      const prjRes = await BusinessApi.request('/projects');

      selSup.innerHTML = (supRes.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      selPrj.innerHTML = (prjRes.projects || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');

      modal.style.display = 'flex';
    } catch (err) {
      alert('Error opening review: ' + err.message);
    }
  }
};
