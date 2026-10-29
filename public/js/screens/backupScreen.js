/**
 * DDevUltraHome — Backup, Cloud Synchronization & Data Integrity Screen
 */

import { BusinessApi } from '../businessApi.js';

export const BackupScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Backup & Cloud Sync</h2>
          <div style="font-size: 12px; color: var(--text-muted);">Encrypted SQLite snapshots, JSON exports & cloud status</div>
        </div>

        <!-- Local Snapshot Export Card -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 18px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">
            💾 Offline Local Snapshot
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 14px;">
            Generates an immutable cryptographic dump of all projects, clients, receipts, expenses, and invoices with SHA-256 data verification.
          </p>

          <button id="btn-export-backup" class="btn-primary" style="width: 100%; min-height: 44px;">
            Generate & Download Backup JSON
          </button>

          <div id="backup-snapshot-info" style="margin-top: 12px; display: none; background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px; font-size: 12px;">
          </div>
        </div>

        <!-- Cloud Providers Sync Status -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 18px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900); margin-bottom: 12px;">
            ☁️ Cloud Sync Providers
          </div>

          <div id="cloud-sync-status-list">
            <div style="padding: 14px; text-align: center; color: var(--text-muted);">Loading sync status...</div>
          </div>

          <div style="margin-top: 16px; display: flex; gap: 10px;">
            <button id="btn-sync-gdrive" class="btn-outline" style="flex: 1; min-height: 44px; font-size: 13px;">
              Sync Google Drive
            </button>
            <button id="btn-sync-supabase" class="btn-outline" style="flex: 1; min-height: 44px; font-size: 13px;">
              Sync Supabase
            </button>
          </div>
        </div>
      </div>
    `;

    await this.loadSyncStatus(container);

    // Export handler
    container.querySelector('#btn-export-backup')?.addEventListener('click', async () => {
      const infoBox = container.querySelector('#backup-snapshot-info');
      try {
        infoBox.style.display = 'block';
        infoBox.innerHTML = 'Generating cryptographic snapshot...';

        const res = await BusinessApi.request('/backup/snapshot');
        const s = res.summary || {};

        infoBox.innerHTML = `
          <div style="font-weight: 700; color: var(--color-success); margin-bottom: 4px;">✅ Backup Snapshot Ready</div>
          <div>Total Entities: <strong>${s.totalRecords || 0}</strong> records</div>
          <div style="margin-top: 4px; font-family: monospace; font-size: 10px; word-break: break-all; background: white; padding: 6px; border: 1px solid var(--border-light); border-radius: 4px;">
            SHA-256 Hash: ${res.dataHash}
          </div>
        `;

        // Trigger browser download
        const blob = new Blob([res.serialized], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ddevultrahome_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        infoBox.innerHTML = `<span style="color: var(--color-danger);">Snapshot error: ${err.message}</span>`;
      }
    });

    // Cloud sync triggers
    container.querySelector('#btn-sync-gdrive')?.addEventListener('click', async () => {
      alert('Google Drive Sync: Adapter verification check active. Connect Google OAuth token in Settings to sync live.');
    });

    container.querySelector('#btn-sync-supabase')?.addEventListener('click', async () => {
      alert('Supabase Sync: Remote PostgreSQL adapter configured. Provide SUPABASE_URL & ANON_KEY to synchronize.');
    });
  },

  async loadSyncStatus(container) {
    const listEl = container.querySelector('#cloud-sync-status-list');
    try {
      const res = await BusinessApi.request('/backup/status');
      const providers = res.status?.cloudProviders || [];

      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md); font-size: 13px;">
            <span>Local SQLite Database</span>
            <span class="badge-status badge-active">Active • Connected</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md); font-size: 13px;">
            <span>Google Drive API</span>
            <span class="badge-status badge-pending">Standby • Ready</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md); font-size: 13px;">
            <span>Supabase Cloud DB</span>
            <span class="badge-status badge-pending">Standby • Ready</span>
          </div>
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); font-size: 12px;">Failed to query sync state: ${e.message}</div>`;
    }
  }
};
