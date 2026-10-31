/**
 * DDevUltraHome — Settings, Company Profile & Role Switcher Screen
 * Fully dynamic with real database-backed company profile editing and account management.
 */

import { BusinessApi } from '../businessApi.js';
import { i18n } from '../i18n.js';
import { AppDialog } from '../components/appDialog.js';

export const SettingsScreen = {
  async render(container) {
    const currentUser = BusinessApi.getActiveUser();
    const isTa = i18n.lang === 'ta';

    container.innerHTML = `
      <div style="padding: 14px 16px 24px;">
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">
            ${isTa ? 'அமைப்புகள் & நிர்வாகம்' : 'Settings & Governance'}
          </h2>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            ${isTa ? 'நிறுவன விவரங்கள், RBAC பங்கு தேர்வு மற்றும் வங்கி கணக்குகள்' : 'Company Profile, RBAC Role Simulator & Bank Accounts'}
          </div>
        </div>

        <!-- Role Simulator -->
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 4px;">
            👤 ${isTa ? 'செயலில் உள்ள பங்கு (RBAC Switcher)' : 'Active Role Switcher (RBAC)'}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
            ${isTa ? '5 கட்டுமான பொறுப்புகளின் பார்வைகளை உருவகப்படுத்துங்கள்:' : 'Simulate views and security permissions across 5 authorized construction roles:'}
          </div>

          <div class="form-group" style="margin-bottom: 10px;">
            <select id="sel-active-role" class="form-control" style="font-weight: 700;">
              <option value="OWNER" ${currentUser.role === 'OWNER' ? 'selected' : ''}>👑 Owner (Full Executive Authority)</option>
              <option value="ACCOUNTANT" ${currentUser.role === 'ACCOUNTANT' ? 'selected' : ''}>📊 Accountant (Financials & Invoicing)</option>
              <option value="SITE_MANAGER" ${currentUser.role === 'SITE_MANAGER' ? 'selected' : ''}>👷 Site Manager (Site Logs & Labour Payouts)</option>
              <option value="ENGINEER" ${currentUser.role === 'ENGINEER' ? 'selected' : ''}>📐 Engineer (Drawings & Calculations)</option>
              <option value="CLIENT" ${currentUser.role === 'CLIENT' ? 'selected' : ''}>🏠 Client (Assigned Project Progress & Receipts)</option>
            </select>
          </div>

          <button id="btn-apply-role" class="btn-primary" style="width: 100%; min-height: 42px; font-size: 13px; font-weight: 700;">
            ${isTa ? 'பங்கை மாற்றவும்' : 'Switch Active Role'}
          </button>
        </div>

        <!-- Fast Enterprise Navigation Shortcuts (Zero Horizontal Scrolling) -->
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 10px;">
            ⚡ ${isTa ? 'விரைவு தொகுதிகள்' : 'Enterprise Modules'}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <button id="btn-menu-clients" class="btn-outline" style="min-height: 44px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>👥</span> ${isTa ? 'வாடிக்கையாளர்கள்' : 'Clients Directory'}
            </button>
            <button id="btn-menu-reports" class="btn-outline" style="min-height: 44px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>📊</span> ${isTa ? 'லாப-நஷ்ட அறிக்கை' : 'P&L Reports'}
            </button>
            <button id="btn-menu-backup" class="btn-outline" style="min-height: 44px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>💾</span> ${isTa ? 'கிளவுட் காப்பு' : 'Cloud Backup'}
            </button>
            <button id="btn-menu-portal" class="btn-gold" style="min-height: 44px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>🏠</span> ${isTa ? 'வாடிக்கையாளர் போர்டல்' : 'Client Portal'}
            </button>
          </div>
        </div>

        <!-- Dynamic Company Profile Information Card -->
        <div id="box-company-profile-card" style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="/assets/ddevultrahome-logo-transparent.png" alt="D DEV ULTRA HOMES" style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--border-light); object-fit: contain; background: white; padding: 2px;">
              <div>
                <div id="disp-company-name" style="font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">D DEV ULTRA HOMES</div>
                <div id="disp-company-tagline" style="font-size: 12px; font-weight: 700; color: var(--brand-gold-600);">Building your dreams</div>
              </div>
            </div>
            <button id="btn-edit-company-profile" class="btn-outline" style="min-height: 34px; padding: 0 10px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
              ✏️ Edit
            </button>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
            <div id="disp-company-address">📍 6a MGR Nagar, 2nd Cross Street, Velachery, Chennai - 600042</div>
            <div id="disp-company-contact">📞 +91 98414 24271 • ✉️ info@ddevultrahomes.com</div>
            <div id="disp-company-tax">🏛️ GSTIN: 33AABCD1234E1Z5 • PAN: AABCD1234E</div>
          </div>
        </div>

        <!-- Registered Financial Accounts -->
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px;">
            <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900);">
              🏦 ${isTa ? 'பதிவுசெய்யப்பட்ட வங்கிக் கணக்குகள்' : 'Registered Financial Accounts'}
            </div>
            <button type="button" id="btn-add-account" class="btn-primary" style="min-height: 34px; padding: 0 12px; font-size: 12px; font-weight: 700; white-space: nowrap;">
              ${isTa ? '+ வங்கி சேர்' : '+ Add Bank'}
            </button>
          </div>
          <div id="settings-accounts-list" style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
            <div style="padding: 10px; text-align: center; color: var(--text-muted);">Loading accounts...</div>
          </div>
        </div>
      </div>

      <!-- Edit Company Profile Modal -->
      <div id="modal-edit-company" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 350; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Edit Company Details</h3>
            <button type="button" id="btn-close-edit-company" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>

          <form id="form-edit-company">
            <div class="form-group">
              <label class="form-label">Company Name *</label>
              <input type="text" id="inp-comp-name" class="form-control" required placeholder="D DEV ULTRA HOMES">
            </div>

            <div class="form-group">
              <label class="form-label">Company Tagline *</label>
              <input type="text" id="inp-comp-tagline" class="form-control" required placeholder="Building your dreams">
            </div>

            <div class="form-group">
              <label class="form-label">Office / Site Address *</label>
              <textarea id="inp-comp-address" class="form-control" rows="2" required placeholder="Full registered address..."></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Contact Phone *</label>
                <input type="tel" id="inp-comp-phone" class="form-control" required placeholder="+91 98414 24271">
              </div>
              <div class="form-group">
                <label class="form-label">Official Email *</label>
                <input type="email" id="inp-comp-email" class="form-control" required placeholder="info@ddevultrahomes.com">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">GSTIN (Optional)</label>
                <input type="text" id="inp-comp-gstin" class="form-control" placeholder="33AABCD1234E1Z5">
              </div>
              <div class="form-group">
                <label class="form-label">PAN (Optional)</label>
                <input type="text" id="inp-comp-pan" class="form-control" placeholder="AABCD1234E">
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
              <button type="button" id="btn-cancel-edit-company" class="btn-outline">Cancel</button>
              <button type="submit" class="btn-primary" style="font-weight: 700;">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Edit Financial Account Details Modal -->
      <div id="modal-edit-account" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 350; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: var(--shadow-lg);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 id="edit-acc-heading" style="margin: 0; font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">Edit Financial Account</h3>
            <button type="button" id="btn-close-edit-account" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>

          <form id="form-edit-account">
            <input type="hidden" id="inp-edit-acc-id">

            <div class="form-group">
              <label class="form-label">Account Name *</label>
              <input type="text" id="inp-edit-acc-name" class="form-control" required placeholder="e.g. HDFC Construction Main Current A/C">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Account Type *</label>
                <select id="sel-edit-acc-type" class="form-control">
                  <option value="BANK">BANK</option>
                  <option value="CASH">CASH</option>
                  <option value="PETTY_CASH">PETTY_CASH</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Bank Name</label>
                <input type="text" id="inp-edit-acc-bank" class="form-control" placeholder="e.g. HDFC Bank">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Account Number</label>
                <input type="text" id="inp-edit-acc-number" class="form-control" placeholder="e.g. 50200012345678">
              </div>
              <div class="form-group">
                <label class="form-label">Branch IFSC</label>
                <input type="text" id="inp-edit-acc-ifsc" class="form-control" placeholder="e.g. HDFC0001234" maxlength="11" style="text-transform: uppercase;">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Current Balance (₹) *</label>
              <input type="number" id="inp-edit-acc-balance" class="form-control" required step="0.01" min="0" placeholder="0.00">
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;">
              <button type="button" id="btn-cancel-edit-account" class="btn-outline">Cancel</button>
              <button type="submit" id="btn-save-account" class="btn-primary" style="font-weight: 700;">
                Save Account
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Load dynamic company data and accounts
    let companyData = {};
    let accountsData = [];
    try {
      const res = await BusinessApi.request('/settings/company');
      companyData = res.company || {};
      const accounts = res.accounts || [];
      accountsData = accounts;

      if (companyData.company_name) {
        container.querySelector('#disp-company-name').textContent = companyData.company_name;
      }
      if (companyData.tagline) {
        container.querySelector('#disp-company-tagline').textContent = companyData.tagline;
      }
      if (companyData.address) {
        container.querySelector('#disp-company-address').textContent = `📍 ${companyData.address}`;
      }
      if (companyData.phone || companyData.email) {
        container.querySelector('#disp-company-contact').textContent = `📞 ${companyData.phone || '+91 98414 24271'} • ✉️ ${companyData.email || 'info@ddevultrahomes.com'}`;
      }
      if (companyData.gstin || companyData.pan) {
        container.querySelector('#disp-company-tax').textContent = `🏛️ GSTIN: ${companyData.gstin || 'N/A'} • PAN: ${companyData.pan || 'N/A'}`;
      }

      // Populate accounts list
      const accList = container.querySelector('#settings-accounts-list');
      if (accounts.length === 0) {
        accList.innerHTML = '<div style="color: var(--text-muted); padding: 8px 0;">No active financial accounts found.</div>';
      } else {
        accList.innerHTML = accounts.map(a => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-card-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-light); margin-bottom: 6px;">
            <div style="flex: 1; padding-right: 10px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <strong style="color: var(--brand-navy-900); font-size: 13px;">${a.account_name}</strong>
                <span class="badge-status badge-active" style="font-size: 10px;">${a.account_type}</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                ${a.bank_name ? `${a.bank_name} • ` : ''}Acc: ${a.account_number || 'N/A'} • IFSC: ${a.branch_ifsc || 'N/A'}
              </div>
              <div style="font-size: 12px; font-weight: 800; color: #10B981; margin-top: 3px;">
                Balance: ₹${(parseFloat(a.current_balance) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button type="button" class="btn-edit-account btn-outline" data-id="${a.id}" style="min-height: 32px; padding: 0 12px; font-size: 11px; font-weight: 700; white-space: nowrap;">
              ✏️ Edit
            </button>
          </div>
        `).join('');

        // Wire account edit buttons
        accList.querySelectorAll('.btn-edit-account').forEach(btn => {
          btn.addEventListener('click', () => {
            const accId = btn.getAttribute('data-id');
            const acc = accountsData.find(a => a.id === accId);
            if (!acc) return;

            container.querySelector('#inp-edit-acc-id').value = acc.id;
            container.querySelector('#inp-edit-acc-name').value = acc.account_name || '';
            container.querySelector('#sel-edit-acc-type').value = acc.account_type || 'BANK';
            container.querySelector('#inp-edit-acc-bank').value = acc.bank_name || '';
            container.querySelector('#inp-edit-acc-number').value = acc.account_number || '';
            container.querySelector('#inp-edit-acc-ifsc').value = acc.branch_ifsc || '';
            container.querySelector('#inp-edit-acc-balance').value = acc.current_balance !== undefined ? acc.current_balance : 0;

            container.querySelector('#edit-acc-heading').textContent = 'Edit Financial Account';
            container.querySelector('#btn-save-account').textContent = 'Save Account';
            const accModal = container.querySelector('#modal-edit-account');
            accModal.style.display = 'flex';
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load company settings from API:', e);
    }

    // Modal Edit Controls
    const editModal = container.querySelector('#modal-edit-company');
    container.querySelector('#btn-edit-company-profile')?.addEventListener('click', () => {
      container.querySelector('#inp-comp-name').value = companyData.company_name || 'D DEV ULTRA HOMES';
      container.querySelector('#inp-comp-tagline').value = companyData.tagline || 'Building your dreams';
      container.querySelector('#inp-comp-address').value = companyData.address || '6a MGR Nagar, 2nd Cross Street, Velachery, Chennai - 600042';
      container.querySelector('#inp-comp-phone').value = companyData.phone || '+91 98414 24271';
      container.querySelector('#inp-comp-email').value = companyData.email || 'info@ddevultrahomes.com';
      container.querySelector('#inp-comp-gstin').value = companyData.gstin || '33AABCD1234E1Z5';
      container.querySelector('#inp-comp-pan').value = companyData.pan || 'AABCD1234E';
      editModal.style.display = 'flex';
    });

    // Close modals on outside backdrop click
    editModal.onclick = (e) => { if (e.target === editModal) editModal.style.display = 'none'; };

    container.querySelector('#btn-close-edit-company')?.addEventListener('click', () => {
      editModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-edit-company')?.addEventListener('click', () => {
      editModal.style.display = 'none';
    });

    container.querySelector('#form-edit-company')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        company_name: container.querySelector('#inp-comp-name').value.trim(),
        tagline: container.querySelector('#inp-comp-tagline').value.trim(),
        address: container.querySelector('#inp-comp-address').value.trim(),
        phone: container.querySelector('#inp-comp-phone').value.trim(),
        email: container.querySelector('#inp-comp-email').value.trim(),
        gstin: container.querySelector('#inp-comp-gstin').value.trim(),
        pan: container.querySelector('#inp-comp-pan').value.trim()
      };

      try {
        await BusinessApi.request('/settings/company', 'PUT', payload);
        await AppDialog.alert({ title: 'Company Saved', message: '✅ Company profile saved successfully!' });
        editModal.style.display = 'none';
        this.render(container);
      } catch (err) {
        await AppDialog.alert({ title: 'Save Failed', message: 'Failed to update company profile: ' + err.message });
      }
    });

    // Account Modal Controls
    const accModal = container.querySelector('#modal-edit-account');
    if (accModal) {
      accModal.onclick = (e) => { if (e.target === accModal) accModal.style.display = 'none'; };
    }

    container.querySelector('#btn-close-edit-account')?.addEventListener('click', () => {
      accModal.style.display = 'none';
    });
    container.querySelector('#btn-cancel-edit-account')?.addEventListener('click', () => {
      accModal.style.display = 'none';
    });

    container.querySelector('#btn-add-account')?.addEventListener('click', () => {
      container.querySelector('#inp-edit-acc-id').value = '';
      container.querySelector('#inp-edit-acc-name').value = '';
      container.querySelector('#sel-edit-acc-type').value = 'BANK';
      container.querySelector('#inp-edit-acc-bank').value = '';
      container.querySelector('#inp-edit-acc-number').value = '';
      container.querySelector('#inp-edit-acc-ifsc').value = '';
      container.querySelector('#inp-edit-acc-balance').value = '0';
      container.querySelector('#edit-acc-heading').textContent = isTa ? 'புதிய வங்கிக் கணக்கு' : 'Add Bank Account';
      container.querySelector('#btn-save-account').textContent = isTa ? 'கணக்கைச் சேர்' : 'Add Account';
      accModal.style.display = 'flex';
    });

    container.querySelector('#form-edit-account')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const accId = container.querySelector('#inp-edit-acc-id').value;
      const name = container.querySelector('#inp-edit-acc-name').value.trim();
      const type = container.querySelector('#sel-edit-acc-type').value;
      const bank = container.querySelector('#inp-edit-acc-bank').value.trim();
      const number = container.querySelector('#inp-edit-acc-number').value.trim();
      const ifsc = container.querySelector('#inp-edit-acc-ifsc').value.trim().toUpperCase();
      const balanceStr = container.querySelector('#inp-edit-acc-balance').value;
      const balance = parseFloat(balanceStr);

      if (!name) {
        await AppDialog.alert({ title: 'Validation', message: 'Account name cannot be blank.' });
        return;
      }
      if (isNaN(balance) || balance < 0) {
        await AppDialog.alert({ title: 'Validation', message: 'Current balance must be a non-negative number.' });
        return;
      }
      if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        await AppDialog.alert({ title: 'Validation', message: 'Invalid IFSC code format! Must match ^[A-Z]{4}0[A-Z0-9]{6}$ (e.g. HDFC0001234)' });
        return;
      }

      const payload = {
        account_name: name,
        account_type: type,
        bank_name: bank,
        account_number: number,
        branch_ifsc: ifsc,
        current_balance: balance
      };

      try {
        if (!accId) {
          await BusinessApi.request('/settings/accounts', 'POST', payload);
          await AppDialog.alert({ title: 'Account Added', message: '✅ Bank account added. It will appear when you record a receipt or expense.' });
        } else {
          await BusinessApi.request(`/settings/accounts/${accId}`, 'PUT', payload);
          await AppDialog.alert({ title: 'Account Saved', message: '✅ Account updated successfully!' });
        }
        accModal.style.display = 'none';
        this.render(container);
      } catch (err) {
        await AppDialog.alert({ title: 'Save Failed', message: 'Failed to save account: ' + err.message });
      }
    });

    // Role switcher logic
    container.querySelector('#btn-apply-role')?.addEventListener('click', async () => {
      const selectedRole = container.querySelector('#sel-active-role').value;
      try {
        const res = await BusinessApi.request('/auth/switch-role', 'POST', { role: selectedRole });
        if (res.user) {
          BusinessApi.setActiveUser(res.user);
          await AppDialog.alert({ title: 'Role Switched', message: `Switched active role to: ${selectedRole} (${res.user.fullName || res.user.name})` });
          if (window.appNavigate) {
            window.appNavigate(selectedRole === 'CLIENT' ? 'clients' : 'dashboard');
          } else {
            window.location.reload();
          }
        }
      } catch (err) {
        await AppDialog.alert({ title: 'Switch Failed', message: 'Failed to switch role: ' + err.message });
      }
    });

    // Sub-module shortcuts
    container.querySelector('#btn-menu-clients')?.addEventListener('click', () => {
      if (window.appNavigate) window.appNavigate('clients');
    });
    container.querySelector('#btn-menu-reports')?.addEventListener('click', () => {
      if (window.appNavigate) window.appNavigate('reports');
    });
    container.querySelector('#btn-menu-backup')?.addEventListener('click', () => {
      if (window.appNavigate) window.appNavigate('backup');
    });
    container.querySelector('#btn-menu-portal')?.addEventListener('click', () => {
      if (window.appNavigate) window.appNavigate('clients');
    });
  }
};
