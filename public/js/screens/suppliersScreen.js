/**
 * DDevUltraHome — Suppliers & Accounts Payable Screen
 * 
 * Enforces business & accounting rules:
 * 1. Unpaid invoices create Accounts Payable, NEVER treated as cash payments.
 * 2. Supplier payments deduct from bank accounts and reduce outstanding dues.
 * 3. Payment amounts are allocated to specific invoices or on-account balances.
 * 4. Insufficient account balances block payments.
 */

import { BusinessApi } from '../businessApi.js';

export const SuppliersScreen = {
  expandedSupplierId: null,

  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Suppliers & Accounts Payable</h2>
            <div style="font-size: 12px; color: var(--text-muted);">Vendors, Material Invoices & Settlement Disbursals</div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-add-supplier" class="btn-outline" style="min-height: 40px; padding: 0 12px; font-size: 13px;">
              + Vendor
            </button>
            <button id="btn-add-invoice" class="btn-outline" style="min-height: 40px; padding: 0 12px; font-size: 13px;">
              + Log Bill
            </button>
            <button id="btn-settle-dues" class="btn-primary" style="min-height: 40px; padding: 0 14px; font-size: 13px; font-weight: 700;">
              💳 Settle Dues
            </button>
          </div>
        </div>

        <!-- Accounts Payable KPI Summary Bar -->
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 16px;">
          <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; box-shadow: var(--shadow-sm);">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Vendors</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;" id="kpi-sup-count">0</div>
          </div>
          <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; box-shadow: var(--shadow-sm);">
            <div style="font-size: 11px; color: #DC2626; font-weight: 700; text-transform: uppercase;">Accounts Payable</div>
            <div style="font-size: 18px; font-weight: 800; color: #DC2626; margin-top: 4px;" id="kpi-sup-dues">₹0</div>
          </div>
          <div style="background: white; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px; box-shadow: var(--shadow-sm);">
            <div style="font-size: 11px; color: #059669; font-weight: 700; text-transform: uppercase;">Total Invoiced</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;" id="kpi-sup-invoiced">₹0</div>
          </div>
        </div>

        <!-- Suppliers List Container -->
        <div id="suppliers-list-container">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading suppliers...</div>
        </div>
      </div>

      <!-- Add Supplier Modal -->
      <div id="modal-new-supplier" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Add Material Supplier</h3>
            <button type="button" id="btn-close-sup-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <form id="form-create-supplier">
            <div class="form-group">
              <label class="form-label">Vendor / Firm Name *</label>
              <input type="text" id="inp-sup-name" class="form-control" required placeholder="e.g. UltraTech RMC Velachery">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Category *</label>
                <select id="sel-sup-category" class="form-control" required>
                  <option value="STEEL">Steel / TMT Rebars</option>
                  <option value="CEMENT">Cement</option>
                  <option value="RMC_CONCRETE">Ready-Mix Concrete (RMC)</option>
                  <option value="AGGREGATES">Sand &amp; Blue Metal</option>
                  <option value="BRICKS_BLOCKS">Red Bricks / AAC Blocks</option>
                  <option value="ELECTRICAL_PLUMBING">Electrical &amp; Plumbing</option>
                  <option value="TILES_SANITARY">Tiles &amp; Sanitaryware</option>
                  <option value="GENERAL">General Hardware</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Contact Person</label>
                <input type="text" id="inp-sup-contact" class="form-control" placeholder="e.g. Mr. Balan">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Phone *</label>
                <input type="tel" id="inp-sup-phone" class="form-control" required placeholder="+91 94440 12345">
              </div>
              <div class="form-group">
                <label class="form-label">GSTIN</label>
                <input type="text" id="inp-sup-gstin" class="form-control" placeholder="33AAAAA0000A1Z5">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-sup" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Save Vendor</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Log Bill / Supplier Invoice Modal -->
      <div id="modal-log-invoice" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 220; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Log Supplier Bill / Invoice</h3>
            <button type="button" id="btn-close-inv-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 14px;">
            Creates Accounts Payable without deducting cash until paid.
          </p>
          <form id="form-log-invoice">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Supplier / Vendor *</label>
                <select id="sel-inv-supplier" class="form-control" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">Project *</label>
                <select id="sel-inv-project" class="form-control" required></select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Invoice / Bill Number *</label>
              <input type="text" id="inp-inv-number" class="form-control" required placeholder="e.g. INV-TMT-9921">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Invoice Date *</label>
                <input type="date" id="inp-inv-date" class="form-control" required>
              </div>
              <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" id="inp-inv-due-date" class="form-control">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Subtotal (₹) *</label>
                <input type="number" id="inp-inv-subtotal" class="form-control" step="0.01" required placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">GST / Tax Amount (₹)</label>
                <input type="number" id="inp-inv-tax" class="form-control" step="0.01" value="0.00" placeholder="0.00">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Total Amount (₹) *</label>
              <input type="number" id="inp-inv-total" class="form-control" step="0.01" required placeholder="0.00" style="font-weight: 700; color: var(--brand-navy-900);">
            </div>
            <div class="form-group">
              <label class="form-label">Notes / Description</label>
              <input type="text" id="inp-inv-notes" class="form-control" placeholder="e.g. 2.5 Tons Fe550D TMT Steel 16mm">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-inv" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary">Post to Payables</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Settle Dues / Supplier Payment Wizard Modal -->
      <div id="modal-settle-dues" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 250; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: white; border-radius: var(--radius-lg); width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">💳</span>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Supplier Payment Settlement Wizard</h3>
            </div>
            <button type="button" id="btn-close-settle-modal" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 14px;">
            Dispatches payment from selected bank account, reduces supplier payable dues, and reconciles invoice.
          </p>

          <form id="form-settle-dues">
            <!-- Supplier Picker -->
            <div class="form-group">
              <label class="form-label">Select Supplier *</label>
              <select id="sel-settle-supplier" class="form-control" required></select>
            </div>

            <!-- Supplier Dues Live Display -->
            <div id="box-supplier-dues-info" style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; color: #991B1B; font-weight: 700;">Outstanding Payable Dues:</span>
              <span style="font-size: 16px; color: #DC2626; font-weight: 800;" id="lbl-settle-dues-amount">₹0.00</span>
            </div>

            <!-- Project & Invoice Picker -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Project *</label>
                <select id="sel-settle-project" class="form-control" required></select>
              </div>
              <div class="form-group">
                <label class="form-label">Target Invoice (Optional)</label>
                <select id="sel-settle-invoice" class="form-control">
                  <option value="">General On-Account Advance</option>
                </select>
              </div>
            </div>

            <!-- Paying Bank Account -->
            <div class="form-group">
              <label class="form-label">Pay From Financial Account *</label>
              <select id="sel-settle-account" class="form-control" required></select>
            </div>

            <!-- Payment Mode & Amount -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Payment Mode *</label>
                <select id="sel-settle-mode" class="form-control" required>
                  <option value="BANK_TRANSFER" selected>NEFT / RTGS / IMPS</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Amount (₹) *</label>
                <input type="number" id="inp-settle-amount" class="form-control" step="0.01" required placeholder="0.00" style="font-weight: 700;">
              </div>
            </div>

            <!-- Reference & Date -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Reference / UTR Number</label>
                <input type="text" id="inp-settle-ref" class="form-control" placeholder="e.g. UTR-HDFC-998811">
              </div>
              <div class="form-group">
                <label class="form-label">Payment Date *</label>
                <input type="date" id="inp-settle-date" class="form-control" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes</label>
              <input type="text" id="inp-settle-notes" class="form-control" placeholder="e.g. Paid in full for TMT steel delivery">
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button type="button" id="btn-cancel-settle" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary" style="font-weight: 700;">
                Disburse &amp; Settle
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.initModals(container);
    await this.loadSuppliers(container);
  },

  async initModals(container) {
    const supModal = container.querySelector('#modal-new-supplier');
    const invModal = container.querySelector('#modal-log-invoice');
    const settleModal = container.querySelector('#modal-settle-dues');

    // Open Add Supplier
    container.querySelector('#btn-add-supplier')?.addEventListener('click', () => {
      supModal.style.display = 'flex';
    });
    container.querySelector('#btn-close-sup-modal')?.addEventListener('click', () => {
      supModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-sup')?.addEventListener('click', () => {
      supModal.style.display = 'none';
    });

    // Open Log Bill
    container.querySelector('#btn-add-invoice')?.addEventListener('click', async () => {
      await this.populateInvoiceModal(container);
      invModal.style.display = 'flex';
    });
    container.querySelector('#btn-close-inv-modal')?.addEventListener('click', () => {
      invModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-inv')?.addEventListener('click', () => {
      invModal.style.display = 'none';
    });

    // Open Settle Dues
    container.querySelector('#btn-settle-dues')?.addEventListener('click', async () => {
      await this.openSettleModal(container);
    });
    container.querySelector('#btn-close-settle-modal')?.addEventListener('click', () => {
      settleModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-settle')?.addEventListener('click', () => {
      settleModal.style.display = 'none';
    });

    // Auto-calculate Total in Log Bill modal
    const subInp = container.querySelector('#inp-inv-subtotal');
    const taxInp = container.querySelector('#inp-inv-tax');
    const totInp = container.querySelector('#inp-inv-total');
    const calcTotal = () => {
      const sub = parseFloat(subInp.value) || 0;
      const tax = parseFloat(taxInp.value) || 0;
      totInp.value = (sub + tax).toFixed(2);
    };
    subInp?.addEventListener('input', calcTotal);
    taxInp?.addEventListener('input', calcTotal);

    // Save Vendor Form
    container.querySelector('#form-create-supplier')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: container.querySelector('#inp-sup-name').value.trim(),
        category: container.querySelector('#sel-sup-category').value,
        contact_person: container.querySelector('#inp-sup-contact').value.trim() || null,
        phone: container.querySelector('#inp-sup-phone').value.trim(),
        gstin: container.querySelector('#inp-sup-gstin').value.trim() || null
      };

      try {
        await BusinessApi.request('/suppliers', 'POST', payload);
        alert('✅ Supplier registered successfully!');
        supModal.style.display = 'none';
        container.querySelector('#form-create-supplier').reset();
        await this.loadSuppliers(container);
      } catch (err) {
        alert('Failed to save supplier: ' + err.message);
      }
    });

    // Log Bill Form
    container.querySelector('#form-log-invoice')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        supplierId: container.querySelector('#sel-inv-supplier').value,
        projectId: container.querySelector('#sel-inv-project').value,
        invoiceNumber: container.querySelector('#inp-inv-number').value.trim(),
        invoiceDate: container.querySelector('#inp-inv-date').value,
        dueDate: container.querySelector('#inp-inv-due-date').value || container.querySelector('#inp-inv-date').value,
        subtotal: parseFloat(container.querySelector('#inp-inv-subtotal').value),
        taxAmount: parseFloat(container.querySelector('#inp-inv-tax').value) || 0,
        totalAmount: parseFloat(container.querySelector('#inp-inv-total').value),
        notes: container.querySelector('#inp-inv-notes').value.trim()
      };

      try {
        await BusinessApi.request('/suppliers/invoices', 'POST', payload);
        alert('✅ Supplier invoice logged! Accounts Payable updated.');
        invModal.style.display = 'none';
        container.querySelector('#form-log-invoice').reset();
        await this.loadSuppliers(container);
      } catch (err) {
        alert('Failed to log invoice: ' + err.message);
      }
    });

    // Settle Dues Form
    container.querySelector('#form-settle-dues')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = BusinessApi.getActiveUser();
      const payload = {
        supplierId: container.querySelector('#sel-settle-supplier').value,
        projectId: container.querySelector('#sel-settle-project').value,
        accountId: container.querySelector('#sel-settle-account').value,
        invoiceId: container.querySelector('#sel-settle-invoice').value || null,
        paymentMode: container.querySelector('#sel-settle-mode').value,
        amount: parseFloat(container.querySelector('#inp-settle-amount').value),
        referenceNumber: container.querySelector('#inp-settle-ref').value.trim(),
        paymentDate: container.querySelector('#inp-settle-date').value,
        notes: container.querySelector('#inp-settle-notes').value.trim(),
        createdBy: user?.id || 'usr-owner-1'
      };

      try {
        await BusinessApi.request('/suppliers/payments', 'POST', payload);
        alert('✅ Payment disbursed and supplier dues settled successfully!');
        settleModal.style.display = 'none';
        container.querySelector('#form-settle-dues').reset();
        await this.loadSuppliers(container);
      } catch (err) {
        alert('Payment settlement failed: ' + err.message);
      }
    });
  },

  async populateInvoiceModal(container) {
    const selSup = container.querySelector('#sel-inv-supplier');
    const selPrj = container.querySelector('#sel-inv-project');
    const inpDate = container.querySelector('#inp-inv-date');
    const inpDueDate = container.querySelector('#inp-inv-due-date');

    inpDate.value = new Date().toISOString().split('T')[0];
    const due = new Date();
    due.setDate(due.getDate() + 15);
    inpDueDate.value = due.toISOString().split('T')[0];

    try {
      const supRes = await BusinessApi.request('/suppliers');
      const prjRes = await BusinessApi.request('/projects');

      selSup.innerHTML = (supRes.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      selPrj.innerHTML = (prjRes.projects || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch (e) {
      selSup.innerHTML = '<option value="sup-1">Chennai TMT Traders</option>';
      selPrj.innerHTML = '<option value="prj-kun-01">Kundrathur Residence</option>';
    }
  },

  async openSettleModal(container, preselectedSupplierId = null) {
    const modal = container.querySelector('#modal-settle-dues');
    const selSup = container.querySelector('#sel-settle-supplier');
    const selPrj = container.querySelector('#sel-settle-project');
    const selAcc = container.querySelector('#sel-settle-account');
    const selInv = container.querySelector('#sel-settle-invoice');
    const inpAmount = container.querySelector('#inp-settle-amount');
    const inpDate = container.querySelector('#inp-settle-date');
    const duesLabel = container.querySelector('#lbl-settle-dues-amount');

    inpDate.value = new Date().toISOString().split('T')[0];

    try {
      const supRes = await BusinessApi.request('/suppliers');
      const prjRes = await BusinessApi.request('/projects');
      const settingsRes = await BusinessApi.request('/settings/company');

      const suppliers = supRes.suppliers || [];
      const projects = prjRes.projects || [];
      const accounts = settingsRes.accounts || [];

      selSup.innerHTML = suppliers.map(s => `
        <option value="${s.id}" data-dues="${s.outstanding_dues || 0}">${s.name} (Dues: ₹${(s.outstanding_dues || 0).toLocaleString('en-IN')})</option>
      `).join('');

      selPrj.innerHTML = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

      selAcc.innerHTML = accounts.map(a => `
        <option value="${a.id}">${a.account_name} — Available: ₹${(a.current_balance || 0).toLocaleString('en-IN')}</option>
      `).join('');

      if (preselectedSupplierId) {
        selSup.value = preselectedSupplierId;
      }

      // Handler when supplier selection changes
      const updateSupplierDues = async () => {
        const selectedOpt = selSup.selectedOptions[0];
        const dues = parseFloat(selectedOpt?.dataset?.dues || 0);
        duesLabel.textContent = `₹${dues.toLocaleString('en-IN')}`;
        inpAmount.value = dues > 0 ? dues : '';

        // Load invoices for this supplier
        try {
          const invRes = await BusinessApi.request(`/suppliers/invoices?supplierId=${selSup.value}`);
          const invoices = (invRes.invoices || []).filter(i => i.payment_status !== 'PAID');

          selInv.innerHTML = '<option value="">General On-Account Payment</option>' + invoices.map(i => `
            <option value="${i.id}" data-bal="${i.balance_amount}">${i.invoice_number} — Bal: ₹${(i.balance_amount || 0).toLocaleString('en-IN')}</option>
          `).join('');
        } catch (e) {
          selInv.innerHTML = '<option value="">General On-Account Payment</option>';
        }
      };

      selSup.onchange = updateSupplierDues;
      selInv.onchange = () => {
        const invOpt = selInv.selectedOptions[0];
        if (invOpt && invOpt.dataset.bal) {
          inpAmount.value = parseFloat(invOpt.dataset.bal);
        }
      };

      await updateSupplierDues();
      modal.style.display = 'flex';
    } catch (err) {
      alert('Failed to initialize settlement wizard: ' + err.message);
    }
  },

  async loadSuppliers(container) {
    const listEl = container.querySelector('#suppliers-list-container');
    try {
      const res = await BusinessApi.request('/suppliers');
      const suppliers = res.suppliers || [];

      // Update KPI Bar
      const totalDues = suppliers.reduce((sum, s) => sum + (parseFloat(s.outstanding_dues) || 0), 0);
      const totalInvoiced = suppliers.reduce((sum, s) => sum + (parseFloat(s.total_invoiced) || parseFloat(s.outstanding_dues) || 0), 0);

      container.querySelector('#kpi-sup-count').textContent = suppliers.length;
      container.querySelector('#kpi-sup-dues').textContent = `₹${totalDues.toLocaleString('en-IN')}`;
      container.querySelector('#kpi-sup-invoiced').textContent = `₹${totalInvoiced.toLocaleString('en-IN')}`;

      if (suppliers.length === 0) {
        listEl.innerHTML = `
          <div style="background: white; border: 1px dashed var(--border-medium); border-radius: var(--radius-lg); padding: 30px; text-align: center;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-secondary);">No suppliers registered yet</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click "+ Vendor" to add materials suppliers.</div>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${suppliers.map(s => {
            const dues = parseFloat(s.outstanding_dues) || 0;
            const hasDues = dues > 0;

            return `
              <div style="background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <span style="font-size: 11px; font-weight: 700; color: var(--brand-navy-700); background: var(--bg-card-subtle); padding: 2px 8px; border-radius: 4px;">
                      ${s.category}
                    </span>
                    <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-top: 4px;">
                      ${s.name}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                      Contact: <strong>${s.contact_person || 'N/A'}</strong> • 📞 ${s.phone} ${s.gstin ? `• GSTIN: ${s.gstin}` : ''}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Outstanding Dues</div>
                    <div style="font-size: 18px; font-weight: 800; color: ${hasDues ? '#DC2626' : '#059669'};">
                      ₹${dues.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <!-- Action Controls -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-light); flex-wrap: wrap; gap: 8px;">
                  <button class="btn-toggle-invoices btn-outline" data-id="${s.id}" style="min-height: 32px; padding: 0 10px; font-size: 11px; font-weight: 600;">
                    📄 View Invoices
                  </button>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn-card-log-bill btn-outline" data-id="${s.id}" data-name="${s.name}" style="min-height: 32px; padding: 0 10px; font-size: 11px;">
                      + Bill
                    </button>
                    ${hasDues ? `
                      <button class="btn-card-settle btn-primary" data-id="${s.id}" style="min-height: 32px; padding: 0 12px; font-size: 11px; font-weight: 700;">
                        💳 Settle Dues
                      </button>
                    ` : ''}
                  </div>
                </div>

                <!-- Expandable Invoices Container -->
                <div id="invoices-box-${s.id}" style="display: none; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-light);">
                  <div style="font-size: 12px; font-weight: 700; color: var(--brand-navy-900); margin-bottom: 8px;">Itemized Bills &amp; Invoices</div>
                  <div id="invoices-content-${s.id}" style="font-size: 11px; color: var(--text-muted);">Loading invoices...</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Wire Settle Buttons on cards
      listEl.querySelectorAll('.btn-card-settle').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const supId = e.currentTarget.dataset.id;
          await this.openSettleModal(container, supId);
        });
      });

      // Wire Log Bill on cards
      listEl.querySelectorAll('.btn-card-log-bill').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const supId = e.currentTarget.dataset.id;
          await this.populateInvoiceModal(container);
          container.querySelector('#sel-inv-supplier').value = supId;
          container.querySelector('#modal-log-invoice').style.display = 'flex';
        });
      });

      // Wire Toggle Invoices on cards
      listEl.querySelectorAll('.btn-toggle-invoices').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const supId = e.currentTarget.dataset.id;
          const box = container.querySelector(`#invoices-box-${supId}`);
          const content = container.querySelector(`#invoices-content-${supId}`);

          if (box.style.display === 'block') {
            box.style.display = 'none';
            e.currentTarget.textContent = '📄 View Invoices';
          } else {
            box.style.display = 'block';
            e.currentTarget.textContent = '▲ Hide Invoices';
            await this.loadSupplierInvoices(supId, content);
          }
        });
      });

    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); padding: 20px;">Failed to load suppliers: ${e.message}</div>`;
    }
  },

  async loadSupplierInvoices(supplierId, targetElement) {
    try {
      const res = await BusinessApi.request(`/suppliers/invoices?supplierId=${supplierId}`);
      const invoices = res.invoices || [];

      if (invoices.length === 0) {
        targetElement.innerHTML = '<div style="font-style: italic; padding: 6px 0;">No invoices recorded for this vendor.</div>';
        return;
      }

      targetElement.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${invoices.map(inv => {
            const statusClass = inv.payment_status === 'PAID' ? 'badge-verified' : (inv.payment_status === 'PARTIALLY_PAID' ? 'badge-pending' : 'badge-danger');
            return `
              <div style="background: var(--bg-card-subtle); padding: 8px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                <div>
                  <strong style="color: var(--brand-navy-900);">${inv.invoice_number}</strong>
                  <span style="color: var(--text-muted); margin-left: 6px;">${inv.invoice_date}</span>
                  ${inv.project_name ? `<div style="color: var(--text-muted); font-size: 10px;">${inv.project_name}</div>` : ''}
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 8px;">
                  <div>
                    <div style="font-weight: 700; color: var(--brand-navy-900);">₹${(inv.total_amount || 0).toLocaleString('en-IN')}</div>
                    <div style="font-size: 10px; color: ${inv.balance_amount > 0 ? '#DC2626' : '#059669'};">
                      Bal: ₹${(inv.balance_amount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <span class="badge-status ${statusClass}" style="font-size: 10px; padding: 2px 6px;">
                    ${inv.payment_status}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (e) {
      targetElement.innerHTML = `<div style="color: var(--color-danger);">Failed to load invoices: ${e.message}</div>`;
    }
  }
};
