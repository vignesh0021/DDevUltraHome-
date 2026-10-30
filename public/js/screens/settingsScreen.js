/**
 * DDevUltraHome — Settings, Company Profile & Role Switcher Screen
 */

import { BusinessApi } from '../businessApi.js';
import { i18n } from '../i18n.js';

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
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
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
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
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

        <!-- Company Profile Information -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <img src="/assets/ddevultrahome-logo-transparent.png" alt="D DEV ULTRA HOMES" style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--border-light); object-fit: contain;">
            <div>
              <div style="font-size: 16px; font-weight: 800; color: var(--brand-navy-900);">D DEV ULTRA HOMES</div>
              <div style="font-size: 12px; font-weight: 600; color: var(--brand-gold-600);">Building your dreams</div>
            </div>
          </div>

          <div style="font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 6px;">
            <div>📍 6a MGR Nagar, 2nd Cross Street, Velachery, Chennai - 600042</div>
            <div>📞 +91 98414 24271 • ✉️ info@ddevultrahomes.com</div>
            <div>🏛️ GSTIN: 33AABCD1234E1Z5 • PAN: AABCD1234E</div>
          </div>
        </div>

        <!-- Registered Financial Accounts -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 14px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 10px;">
            🏦 ${isTa ? 'பதிவுசெய்யப்பட்ட வங்கிக் கணக்குகள்' : 'Registered Financial Accounts'}
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md);">
              <div>
                <strong style="color: var(--brand-navy-900);">HDFC Bank Current A/c</strong>
                <div style="font-size: 11px; color: var(--text-muted);">A/c: •••• 5678 (Operating A/c)</div>
              </div>
              <span class="badge-status badge-active">Bank</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md);">
              <div>
                <strong style="color: var(--brand-navy-900);">ICICI Project Escrow A/c</strong>
                <div style="font-size: 11px; color: var(--text-muted);">A/c: •••• 4321 (Client Milestones)</div>
              </div>
              <span class="badge-status badge-active">Escrow</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md);">
              <div>
                <strong style="color: var(--brand-navy-900);">Site Office Petty Cash</strong>
                <div style="font-size: 11px; color: var(--text-muted);">Kundrathur Site Desk</div>
              </div>
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
          alert(`Switched active role to: ${selectedRole} (${res.user.fullName || res.user.name})`);
          if (window.appNavigate) {
            window.appNavigate(selectedRole === 'CLIENT' ? 'clients' : 'dashboard');
          } else {
            window.location.reload();
          }
        }
      } catch (err) {
        alert('Failed to switch role: ' + err.message);
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
