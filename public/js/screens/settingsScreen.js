/**
 * DDevUltraHome — Settings, Company Profile & Role Switcher Screen
 */

import { BusinessApi } from '../businessApi.js';

export const SettingsScreen = {
  async render(container) {
    const currentUser = BusinessApi.getActiveUser();

    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Settings & Governance</h2>
          <div style="font-size: 12px; color: var(--text-muted);">Company Profile, RBAC Role Simulator & Bank Accounts</div>
        </div>

        <!-- Role Simulator -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 4px;">
            👤 Active Role Switcher (RBAC)
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
            Simulate views and security permissions across 5 authorized construction roles:
          </div>

          <div class="form-group">
            <select id="sel-active-role" class="form-control" style="font-weight: 700;">
              <option value="OWNER" ${currentUser.role === 'OWNER' ? 'selected' : ''}>👑 Owner (Full Executive Authority)</option>
              <option value="ACCOUNTANT" ${currentUser.role === 'ACCOUNTANT' ? 'selected' : ''}>📊 Accountant (Financials & Invoicing)</option>
              <option value="SITE_MANAGER" ${currentUser.role === 'SITE_MANAGER' ? 'selected' : ''}>👷 Site Manager (Site Logs & Labour Payouts)</option>
              <option value="ENGINEER" ${currentUser.role === 'ENGINEER' ? 'selected' : ''}>📐 Engineer (Drawings & Calculations)</option>
              <option value="CLIENT" ${currentUser.role === 'CLIENT' ? 'selected' : ''}>🏠 Client (Assigned Project Progress & Receipts)</option>
            </select>
          </div>

          <button id="btn-apply-role" class="btn-primary" style="width: 100%; min-height: 40px; font-size: 13px;">
            Switch Active Role
          </button>
        </div>

        <!-- Company Profile Information -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
            <img src="/assets/ddevultrahome-logo.png" style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--border-light); object-fit: contain;">
            <div>
              <div style="font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">D DEV ULTRA HOMES</div>
              <div style="font-size: 12px; font-weight: 600; color: var(--brand-gold-600);">Building your dreams</div>
            </div>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
            <div>📍 Plot No. 54, Anna Nagar 2nd St, Velachery, Chennai - 600042</div>
            <div>📞 +91 98414 24267 • ✉️ admin@ddevultrahomes.com</div>
            <div>🏛️ GSTIN: 33AABCD1234E1Z5 • PAN: AABCD1234E</div>
          </div>
        </div>

        <!-- Financial Accounts -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 10px;">
            🏦 Registered Financial Accounts
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md);">
              <span>HDFC Current A/c (•••• 4267)</span>
              <span class="badge-status badge-active">Bank</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md);">
              <span>ICICI Escrow A/c (•••• 8821)</span>
              <span class="badge-status badge-active">Escrow</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md);">
              <span>Site Petty Cash (Chennai Sites)</span>
              <span class="badge-status badge-active">Cash</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Role switcher logic
    container.querySelector('#btn-apply-role')?.addEventListener('click', async () => {
      const selectedRole = container.querySelector('#sel-active-role').value;
      try {
        const res = await BusinessApi.request('/auth/switch-role', 'POST', { role: selectedRole });
        if (res.user) {
          BusinessApi.setActiveUser(res.user);
          alert(`Switched active role to: ${selectedRole} (${res.user.fullName})`);
          window.location.reload();
        }
      } catch (err) {
        alert('Failed to switch role: ' + err.message);
      }
    });
  }
};
