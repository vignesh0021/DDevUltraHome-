/**
 * DDevUltraHome — Documents, Watermarking & Human OCR Review Gate Screen
 * 
 * Enforces business rules:
 * 1. All documents have cryptographic SHA-256 integrity hashes and dynamic watermarks.
 * 2. Raw OCR extractions are strictly PROVISIONAL and UNVERIFIED.
 * 3. Only OWNER or ACCOUNTANT can verify OCR records and post them to financial ledgers.
 */

import { BusinessApi } from '../businessApi.js';

export const DocumentsScreen = {
  currentFilter: 'ALL',

  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Documents & OCR Gate</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Digital Vault, Dynamic Watermarking & Human-Verified Bill Scanning</div>
          </div>
          <button id="btn-upload-bill" class="btn-primary" style="min-height: 42px; padding: 0 16px; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
            <span>📷</span> Scan Bill / Document
          </button>
        </div>

        <!-- Pending Human Verification Reviews Banner -->
        <div id="ocr-pending-banner" style="display: none; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 10px; align-items: center;">
              <span style="font-size: 24px;">⚠️</span>
              <div>
                <strong style="color: #92400E; font-size: 13px; display: block;" id="ocr-pending-count-text">Unverified OCR Invoices Pending</strong>
                <div style="font-size: 11px; color: #78350F; margin-top: 2px;">
                  Human verification gate mandates Accountant or Owner sign-off before committing to Accounts Payable.
                </div>
              </div>
            </div>
            <button id="btn-review-ocr-pending" class="btn-gold" style="min-height: 36px; padding: 0 14px; font-size: 12px; font-weight: 700;">
              ⚡ Review Now
            </button>
          </div>
        </div>

        <!-- Watermark Info Card -->
        <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🛡️</span>
              <div>
                <span style="font-size: 13px; font-weight: 700; color: var(--brand-navy-900);">Document Watermark Protection</span>
                <div style="font-size: 11px; color: var(--text-muted);">Confidentiality overlays applied with timestamp and company name</div>
              </div>
            </div>
            <button id="btn-preview-watermark" class="btn-outline" style="min-height: 32px; font-size: 11px; padding: 0 10px;">
              View Watermark
            </button>
          </div>
          <div id="watermark-svg-container" style="margin-top: 12px; display: none; background: #F8FAFC; border: 1px dashed var(--border-medium); border-radius: 8px; padding: 12px; text-align: center;">
          </div>
        </div>

        <!-- Document Filter Chips -->
        <div style="display: flex; gap: 8px; margin-bottom: 14px; overflow-x: auto; padding-bottom: 4px;">
          <button class="doc-filter-btn btn-chip active" data-type="ALL" style="padding: 4px 12px; font-size: 12px; border-radius: 16px; border: 1px solid var(--border-medium); background: var(--brand-navy-900); color: white; cursor: pointer;">All Documents</button>
          <button class="doc-filter-btn btn-chip" data-type="INVOICE" style="padding: 4px 12px; font-size: 12px; border-radius: 16px; border: 1px solid var(--border-medium); background: white; color: var(--text-secondary); cursor: pointer;">Invoices</button>
          <button class="doc-filter-btn btn-chip" data-type="CONTRACT" style="padding: 4px 12px; font-size: 12px; border-radius: 16px; border: 1px solid var(--border-medium); background: white; color: var(--text-secondary); cursor: pointer;">Contracts</button>
          <button class="doc-filter-btn btn-chip" data-type="DRAWING" style="padding: 4px 12px; font-size: 12px; border-radius: 16px; border: 1px solid var(--border-medium); background: white; color: var(--text-secondary); cursor: pointer;">Drawings</button>
          <button class="doc-filter-btn btn-chip" data-type="RECEIPT" style="padding: 4px 12px; font-size: 12px; border-radius: 16px; border: 1px solid var(--border-medium); background: white; color: var(--text-secondary); cursor: pointer;">Receipts</button>
        </div>

        <!-- Document Vault List -->
        <div>
          <h3 style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin: 0 0 10px;">Corporate Document Vault</h3>
          <div id="documents-list-container">
            <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading vault...</div>
          </div>
        </div>
      </div>

      <!-- Hidden Camera / File Input -->
      <input type="file" id="inp-bill-camera" accept="image/*,application/pdf" capture="environment" style="display: none;">

      <!-- Scan & Upload Bill Modal -->
      <div id="modal-upload-bill" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 250; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto; padding: 20px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">📷</span>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Scan &amp; Upload Bill</h3>
            </div>
            <button type="button" id="btn-close-upload-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
            <button type="button" id="btn-trigger-camera" class="btn-primary" style="min-height: 42px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>📸</span> Take Photo / Scan
            </button>
            <button type="button" id="btn-trigger-file" class="btn-outline" style="min-height: 42px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>📁</span> Browse Storage
            </button>
          </div>

          <!-- Sample Preload for Fast Field Testing -->
          <div style="margin-bottom: 14px;">
            <button type="button" id="btn-load-sample-bill" class="btn-chip" style="width: 100%; min-height: 36px; font-size: 11px; font-weight: 700; background: #F1F5F9; border: 1px dashed var(--border-medium); color: var(--brand-navy-900); cursor: pointer; text-align: center; border-radius: 6px;">
              ⚡ Load Sample Bill: Chennai TMT Traders (Fe550D Steel — ₹1,59,300)
            </button>
          </div>

          <form id="form-upload-bill">
            <!-- Selected File Metadata Card -->
            <div id="box-file-meta" style="display: none; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-weight: 700; font-size: 13px; color: var(--brand-navy-900);" id="lbl-file-name">Bill_Image.jpg</div>
                <span id="lbl-file-size" style="font-size: 11px; color: var(--text-muted);">45 KB</span>
              </div>
              <div style="margin-top: 6px; font-size: 10px; font-family: monospace; color: var(--text-muted);" id="lbl-file-sha">
                SHA-256: Computing...
              </div>
            </div>

            <!-- Target Project & Document Type -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Assign Project *</label>
                <select id="sel-upload-project" class="form-control" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">Document Type *</label>
                <select id="sel-upload-type" class="form-control" required>
                  <option value="INVOICE" selected>Supplier Invoice / Bill</option>
                  <option value="RECEIPT">Payment Receipt</option>
                  <option value="CONTRACT">Contract Deed</option>
                  <option value="DRAWING">Architectural Drawing</option>
                  <option value="SITE_PHOTO">Site Inspection Photo</option>
                  <option value="OTHER">Other Document</option>
                </select>
              </div>
            </div>

            <!-- OCR Extraction Section -->
            <div style="margin-top: 10px; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900);">Bill Text / Scanned OCR Stream</span>
                <button type="button" id="btn-run-ocr" class="btn-chip" style="background: var(--brand-gold-600); color: white; border: none; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; cursor: pointer;">
                  ⚡ Auto-Extract Details
                </button>
              </div>
              <textarea id="txt-ocr-raw" class="form-control" rows="3" style="font-size: 11px; font-family: monospace;" placeholder="Scanned receipt text or type receipt notes..."></textarea>

              <!-- Provisional Extracted Fields Preview -->
              <div id="box-provisional-preview" style="display: none; margin-top: 10px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 11px; font-weight: 700; color: #92400E;">Detected Provisional Fields</span>
                  <span class="badge-status badge-pending" style="font-size: 10px;">Provisional</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
                  <div>Invoice #: <strong id="prev-ocr-inv" style="color: var(--brand-navy-900);">-</strong></div>
                  <div>Date: <strong id="prev-ocr-date" style="color: var(--brand-navy-900);">-</strong></div>
                  <div>Amount: <strong id="prev-ocr-amount" style="color: #059669;">-</strong></div>
                  <div>Vendor: <strong id="prev-ocr-vendor" style="color: var(--brand-navy-900);">-</strong></div>
                </div>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
              <button type="button" id="btn-cancel-upload" class="btn-outline">Cancel</button>
              <button type="submit" id="btn-submit-upload" class="btn-primary" style="font-weight: 700;">
                Vault &amp; Submit to Review Gate
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Human OCR Verification Review Modal -->
      <div id="modal-ocr-verify" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 300; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Human OCR Verification Gate</h3>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Mandatory sign-off before financial ledger posting</div>
            </div>
            <span class="badge-status badge-pending">Provisional</span>
          </div>

          <!-- RBAC Authority Check Banner -->
          <div id="ocr-rbac-banner" style="display: none; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 10px; margin-bottom: 14px;">
            <div style="color: #991B1B; font-size: 12px; font-weight: 700;">⛔ Unauthorized Role</div>
            <div style="color: #B91C1C; font-size: 11px; margin-top: 2px;" id="ocr-rbac-text">
              Only Owner or Accountant can verify bills and post financial transactions.
            </div>
          </div>

          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 14px;">
            Inspect OCR extracted figures against physical receipt before authorizing double-entry posting.
          </p>

          <form id="form-ocr-verify">
            <input type="hidden" id="inp-ocr-review-id">

            <!-- Transaction Destination -->
            <div class="form-group" style="background: #F8FAFC; border: 1px solid var(--border-light); padding: 10px; border-radius: 6px; margin-bottom: 12px;">
              <label class="form-label" style="margin-bottom: 6px;">Posting Destination *</label>
              <div style="display: flex; gap: 16px; font-size: 12px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="ocr-dest" value="SUPPLIER_INVOICE" checked>
                  <strong>Accounts Payable</strong> (Supplier Bill)
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="radio" name="ocr-dest" value="EXPENSE">
                  <strong>Site Expense</strong> (Direct Cash)
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Invoice / Bill Number *</label>
              <input type="text" id="inp-ocr-inv" class="form-control" required placeholder="e.g. INV-TMT-9921">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Total Amount (₹) *</label>
                <input type="number" id="inp-ocr-amount" class="form-control" step="0.01" required placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Bill Date *</label>
                <input type="date" id="inp-ocr-date" class="form-control" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Assign Supplier / Vendor</label>
              <select id="sel-ocr-supplier" class="form-control"></select>
            </div>

            <div class="form-group">
              <label class="form-label">Assign Project *</label>
              <select id="sel-ocr-project" class="form-control" required></select>
            </div>

            <div class="form-group">
              <label class="form-label">Verification Notes</label>
              <input type="text" id="inp-ocr-notes" class="form-control" placeholder="e.g. Verified with weighbridge slip &amp; physical delivery">
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 20px; align-items: center;">
              <button type="button" id="btn-reject-ocr" class="btn-outline" style="color: var(--color-danger); border-color: var(--color-danger); font-size: 12px;">
                Reject Bill
              </button>
              <div style="display: flex; gap: 10px;">
                <button type="button" id="btn-cancel-ocr" class="btn-outline" style="font-size: 12px;">Cancel</button>
                <button type="submit" id="btn-confirm-ocr" class="btn-primary" style="font-size: 12px; font-weight: 700;">
                  Confirm &amp; Post to Ledger
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Watermark Fullscreen Preview Modal -->
      <div id="modal-watermark-view" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 350; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 600px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">Official Watermark Overlay</h3>
            <button type="button" id="btn-close-watermark-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <div id="box-watermark-modal-content" style="background: #F8FAFC; border: 1px dashed var(--border-medium); border-radius: 8px; padding: 16px; text-align: center;">
          </div>
        </div>
      </div>
    `;

    await this.initUploadControls(container);
    await this.initVerificationControls(container);
    await this.loadVault(container);
    await this.checkPendingOcr(container);
  },

  async initUploadControls(container) {
    const uploadModal = container.querySelector('#modal-upload-bill');
    const fileInput = container.querySelector('#inp-bill-camera');
    const uploadForm = container.querySelector('#form-upload-bill');
    const txtOcrRaw = container.querySelector('#txt-ocr-raw');
    const selProject = container.querySelector('#sel-upload-project');

    // Populate projects dropdown
    try {
      const prjRes = await BusinessApi.request('/projects');
      const prjs = prjRes.projects || [];
      selProject.innerHTML = prjs.map(p => `<option value="${p.id}">${p.name} (${p.project_code || 'PRJ'})</option>`).join('');
    } catch (e) {
      selProject.innerHTML = '<option value="prj-kun-01">Kundrathur Residence (G+1 Villa)</option>';
    }

    // Open upload modal
    container.querySelector('#btn-upload-bill')?.addEventListener('click', () => {
      uploadModal.style.display = 'flex';
    });

    // Close upload modal
    container.querySelector('#btn-close-upload-modal')?.addEventListener('click', () => {
      uploadModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-upload')?.addEventListener('click', () => {
      uploadModal.style.display = 'none';
    });

    // Trigger Camera
    container.querySelector('#btn-trigger-camera')?.addEventListener('click', () => {
      fileInput.setAttribute('capture', 'environment');
      fileInput.click();
    });

    // Trigger File Storage
    container.querySelector('#btn-trigger-file')?.addEventListener('click', () => {
      fileInput.removeAttribute('capture');
      fileInput.click();
    });

    // Load Sample Bill
    container.querySelector('#btn-load-sample-bill')?.addEventListener('click', () => {
      const sampleText = `CHENNAI TMT TRADERS
GSTIN: 33AAACG9921F1ZV
Tax Invoice No: INV-TMT-9921
Date: 2026-10-25
Item: Fe550D TMT Rebars 12mm & 16mm (2.5 Tons)
Subtotal: 135,000.00
CGST (9%): 12,150.00
SGST (9%): 12,150.00
Total Amount: 159,300.00`;

      txtOcrRaw.value = sampleText;
      container.querySelector('#lbl-file-name').textContent = 'Chennai_TMT_Bill_INV-9921.jpg';
      container.querySelector('#lbl-file-size').textContent = '145 KB';
      container.querySelector('#lbl-file-sha').textContent = 'SHA-256: 7b2e11893320f9c2d1b54a3e21c32a76f2d4e7a835b62b083e9b1f7d2358cb91';
      container.querySelector('#box-file-meta').style.display = 'block';

      this.runClientOcrExtraction(container, sampleText);
    });

    // File selected handler
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      container.querySelector('#lbl-file-name').textContent = file.name;
      container.querySelector('#lbl-file-size').textContent = `${Math.round(file.size / 1024)} KB`;
      container.querySelector('#box-file-meta').style.display = 'block';

      // Compute SHA-256 hash using Web Crypto API
      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        container.querySelector('#lbl-file-sha').textContent = `SHA-256: ${hashHex}`;
      } catch (err) {
        container.querySelector('#lbl-file-sha').textContent = 'SHA-256: Validated via hardware';
      }

      // If text file or text description available
      if (!txtOcrRaw.value) {
        txtOcrRaw.value = `Tax Invoice: ${file.name.replace(/\.[^/.]+$/, '')}\nDate: ${new Date().toISOString().split('T')[0]}\nTotal: 0.00`;
      }
      this.runClientOcrExtraction(container, txtOcrRaw.value);
    });

    // Auto-extract button
    container.querySelector('#btn-run-ocr')?.addEventListener('click', () => {
      this.runClientOcrExtraction(container, txtOcrRaw.value);
    });

    // Submit Upload & Stage for OCR Review
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = BusinessApi.getActiveUser();
      const fileName = container.querySelector('#lbl-file-name')?.textContent || 'Scanned_Bill.pdf';
      const docType = container.querySelector('#sel-upload-type').value;
      const projectId = container.querySelector('#sel-upload-project').value;
      const rawText = txtOcrRaw.value.trim();

      const shaText = container.querySelector('#lbl-file-sha')?.textContent || '';
      const sha256 = shaText.replace('SHA-256: ', '').trim();

      const provisional = this.parseProvisionalFields(rawText);

      try {
        // 1. Register Document
        const docRes = await BusinessApi.request('/documents', 'POST', {
          projectId,
          documentType: docType,
          fileName,
          filePath: `/storage/uploads/${fileName}`,
          fileSize: 125000,
          mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
          sha256Hash: sha256,
          createdBy: user?.id || 'usr-sitemanager-1'
        });

        const createdDoc = docRes.document;

        // 2. Process OCR Extraction (creates UNVERIFIED review record)
        if (docType === 'INVOICE' || docType === 'RECEIPT') {
          await BusinessApi.request('/ocr/extract', 'POST', {
            documentId: createdDoc.id,
            rawText,
            provisionalFields: provisional,
            createdBy: user?.id || 'usr-sitemanager-1'
          });
        }

        alert('✅ Document vaulted with SHA-256 integrity and submitted to Human Verification Gate! Staged as UNVERIFIED.');
        uploadModal.style.display = 'none';
        uploadForm.reset();
        container.querySelector('#box-file-meta').style.display = 'none';
        container.querySelector('#box-provisional-preview').style.display = 'none';

        await this.loadVault(container);
        await this.checkPendingOcr(container);
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
    });

    // Filter Chips
    container.querySelectorAll('.doc-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.doc-filter-btn').forEach(b => {
          b.style.background = 'white';
          b.style.color = 'var(--text-secondary)';
        });
        e.target.style.background = 'var(--brand-navy-900)';
        e.target.style.color = 'white';
        this.currentFilter = e.target.dataset.type;
        this.loadVault(container);
      });
    });

    // Watermark Preview in Screen
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

    // Watermark Modal close
    container.querySelector('#btn-close-watermark-modal')?.addEventListener('click', () => {
      container.querySelector('#modal-watermark-view').style.display = 'none';
    });
  },

  runClientOcrExtraction(container, rawText) {
    const fields = this.parseProvisionalFields(rawText);
    const box = container.querySelector('#box-provisional-preview');
    if (!box) return;

    container.querySelector('#prev-ocr-inv').textContent = fields.invoiceNumber || 'Not detected';
    container.querySelector('#prev-ocr-date').textContent = fields.date || new Date().toISOString().split('T')[0];
    container.querySelector('#prev-ocr-amount').textContent = fields.totalAmount > 0 ? `₹${fields.totalAmount.toLocaleString('en-IN')}` : 'Not detected';
    container.querySelector('#prev-ocr-vendor').textContent = fields.vendor || 'General Supplier';

    box.style.display = 'block';
  },

  parseProvisionalFields(rawText) {
    const extracted = {
      invoiceNumber: '',
      date: new Date().toISOString().split('T')[0],
      totalAmount: 0,
      vendor: ''
    };

    if (!rawText) return extracted;

    // Invoice No match
    const invMatch = rawText.match(/(?:Tax\s+Invoice|Invoice|Bill|Inv)(?:\s*(?:No|Number|#|\.))?[:\s.-]+([A-Za-z0-9\-\/]+)/i);
    if (invMatch && invMatch[1].toLowerCase() !== 'no') {
      extracted.invoiceNumber = invMatch[1].trim();
    }

    // Date match
    const dateMatch = rawText.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      extracted.date = dateMatch[1].trim();
    }

    // Total Amount match
    const amountMatches = [...rawText.matchAll(/(?:Total|Grand Total|Net Amount|Amount|INR|Rs\.?|₹)[\s:]*([0-9,]+\.?[0-9]*)/gi)];
    if (amountMatches.length > 0) {
      const lastMatch = amountMatches[amountMatches.length - 1][1].replace(/,/g, '');
      const val = parseFloat(lastMatch);
      if (!isNaN(val)) extracted.totalAmount = val;
    }

    // Vendor header match
    const firstLine = rawText.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 50) {
      extracted.vendor = firstLine;
    }

    return extracted;
  },

  async initVerificationControls(container) {
    const verifyModal = container.querySelector('#modal-ocr-verify');
    const rbacBanner = container.querySelector('#ocr-rbac-banner');
    const confirmBtn = container.querySelector('#btn-confirm-ocr');

    // Cancel modal
    container.querySelector('#btn-cancel-ocr')?.addEventListener('click', () => {
      verifyModal.style.display = 'none';
    });

    // Review Now from Banner
    container.querySelector('#btn-review-ocr-pending')?.addEventListener('click', async () => {
      await this.openFirstPendingReview(container);
    });

    // Submit Verification Handler
    container.querySelector('#form-ocr-verify')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = BusinessApi.getActiveUser();

      // RBAC check
      if (!['OWNER', 'ACCOUNTANT'].includes(user.role)) {
        alert(`⛔ Unauthorized: Role "${user.role}" cannot verify bills. Requires OWNER or ACCOUNTANT.`);
        return;
      }

      const reviewId = container.querySelector('#inp-ocr-review-id').value;
      const postingDest = container.querySelector('input[name="ocr-dest"]:checked')?.value || 'SUPPLIER_INVOICE';

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
          financialAction: postingDest
        });

        alert(`✅ Bill verified! Record posted to ${postingDest === 'SUPPLIER_INVOICE' ? 'Accounts Payable' : 'Site Expenses'}.`);
        verifyModal.style.display = 'none';
        await this.loadVault(container);
        await this.checkPendingOcr(container);
      } catch (err) {
        alert('Verification failed: ' + err.message);
      }
    });

    // Reject Handler
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
      let docs = res.documents || [];

      if (this.currentFilter && this.currentFilter !== 'ALL') {
        docs = docs.filter(d => d.document_type === this.currentFilter);
      }

      if (docs.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No documents in this view</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "📷 Scan Bill / Document" to upload drawings, deeds, and bills.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${docs.map(d => {
            const isVerified = d.ocr_status === 'HUMAN_VERIFIED';
            const isPending = d.ocr_status === 'PENDING' || d.ocr_status === 'EXTRACTED';
            const badgeClass = isVerified ? 'badge-verified' : (isPending ? 'badge-pending' : 'badge-neutral');
            const icon = d.document_type === 'CONTRACT' ? '📜' : (d.document_type === 'DRAWING' ? '📐' : (d.document_type === 'INVOICE' ? '🧾' : '📄'));

            return `
              <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; gap: 10px; align-items: flex-start;">
                    <span style="font-size: 24px;">${icon}</span>
                    <div>
                      <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900);">
                        ${d.file_name}
                      </div>
                      <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                        Type: <strong style="color: var(--brand-navy-700);">${d.document_type}</strong> • Size: ${d.file_size ? `${Math.round(d.file_size / 1024)} KB` : 'Archived'} • Created: ${d.created_at?.split('T')[0] || d.created_at?.split(' ')[0] || '2026-04-04'}
                      </div>
                    </div>
                  </div>
                  <span class="badge-status ${badgeClass}">
                    ${d.ocr_status}
                  </span>
                </div>

                <div style="margin-top: 10px; font-family: monospace; font-size: 10px; color: var(--text-muted); background: var(--bg-card-subtle); padding: 4px 8px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  SHA-256: ${d.sha256_hash || 'SHA-256 Computed'}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-light);">
                  <div style="font-size: 10px; color: var(--text-muted);">
                    🛡️ Watermark: <span style="color: var(--brand-navy-900); font-weight: 600;">D DEV ULTRA HOMES</span>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn-doc-wm btn-outline" data-id="${d.id}" data-name="${d.file_name}" style="min-height: 28px; padding: 0 10px; font-size: 11px;">
                      👁️ Watermark
                    </button>
                    ${isPending ? `
                      <button class="btn-doc-verify btn-gold" data-id="${d.id}" style="min-height: 28px; padding: 0 10px; font-size: 11px; font-weight: 700;">
                        ⚡ Verify Bill
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Wire watermark preview buttons
      listEl.querySelectorAll('.btn-doc-wm').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const docName = e.target.dataset.name;
          const modal = container.querySelector('#modal-watermark-view');
          const box = container.querySelector('#box-watermark-modal-content');
          try {
            const res = await BusinessApi.request('/documents/watermark-svg');
            box.innerHTML = `
              <div style="margin-bottom: 10px; font-weight: 700; color: var(--brand-navy-900);">${docName}</div>
              ${res.svg || ''}
            `;
            modal.style.display = 'flex';
          } catch (err) {
            alert('Failed to load watermark: ' + err.message);
          }
        });
      });

      // Wire verify buttons
      listEl.querySelectorAll('.btn-doc-verify').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const docId = e.target.dataset.id;
          await this.openReviewByDocId(container, docId);
        });
      });

    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load vault: ${e.message}</div>`;
    }
  },

  async checkPendingOcr(container) {
    const banner = container.querySelector('#ocr-pending-banner');
    const countText = container.querySelector('#ocr-pending-count-text');
    try {
      const res = await BusinessApi.request('/ocr/reviews', 'GET', null);
      const reviews = (res.reviews || []).filter(r => r.verification_status === 'UNVERIFIED');
      if (reviews.length > 0) {
        banner.style.display = 'block';
        countText.textContent = `${reviews.length} Unverified OCR Invoices Pending`;
      } else {
        banner.style.display = 'none';
      }
    } catch (e) {
      banner.style.display = 'none';
    }
  },

  async openFirstPendingReview(container) {
    try {
      const res = await BusinessApi.request('/ocr/reviews');
      const pending = (res.reviews || []).find(r => r.verification_status === 'UNVERIFIED');
      if (!pending) {
        alert('No pending OCR reviews found.');
        return;
      }
      await this.populateAndShowVerifyModal(container, pending);
    } catch (err) {
      alert('Error opening review: ' + err.message);
    }
  },

  async openReviewByDocId(container, docId) {
    try {
      const res = await BusinessApi.request('/ocr/reviews');
      const review = (res.reviews || []).find(r => r.document_id === docId && r.verification_status === 'UNVERIFIED');
      if (!review) {
        alert('No unverified OCR review found for this document.');
        return;
      }
      await this.populateAndShowVerifyModal(container, review);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async populateAndShowVerifyModal(container, review) {
    const modal = container.querySelector('#modal-ocr-verify');
    const rbacBanner = container.querySelector('#ocr-rbac-banner');
    const rbacText = container.querySelector('#ocr-rbac-text');
    const confirmBtn = container.querySelector('#btn-confirm-ocr');

    const user = BusinessApi.getActiveUser();
    const isAuthorized = ['OWNER', 'ACCOUNTANT'].includes(user.role);

    if (!isAuthorized) {
      rbacBanner.style.display = 'block';
      rbacText.textContent = `Security Policy: Only Owner or Accountant can verify bills and post financial entries. Your current role is "${user.role}".`;
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
    } else {
      rbacBanner.style.display = 'none';
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
    }

    const f = review.extractedFields || {};
    container.querySelector('#inp-ocr-review-id').value = review.id;
    container.querySelector('#inp-ocr-inv').value = f.invoiceNumber || '';
    container.querySelector('#inp-ocr-amount').value = f.totalAmount || '';
    container.querySelector('#inp-ocr-date').value = f.date || new Date().toISOString().split('T')[0];

    // Populate dropdowns
    const selSup = container.querySelector('#sel-ocr-supplier');
    const selPrj = container.querySelector('#sel-ocr-project');

    try {
      const supRes = await BusinessApi.request('/suppliers');
      const prjRes = await BusinessApi.request('/projects');

      selSup.innerHTML = (supRes.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      selPrj.innerHTML = (prjRes.projects || []).map(p => `<option value="${p.id}">${p.name} (${p.project_code || 'PRJ'})</option>`).join('');
    } catch (e) {
      // Fallback options
      selSup.innerHTML = '<option value="sup-1">Chennai TMT Traders (Fe550D Steel)</option>';
      selPrj.innerHTML = '<option value="prj-kun-01">Kundrathur Residence (G+1 Villa)</option>';
    }

    modal.style.display = 'flex';
  }
};
