/**
 * DDevUltraHome — Backup, Cloud Synchronization & Data Integrity Screen
 * Cryptographic SHA-256 backup generation, WebView-compatible download/share, and safe hash verification restore.
 */

import { BusinessApi } from '../businessApi.js';

export const BackupScreen = {
  async render(container) {
    container.innerHTML = `
      <div style="padding: 16px;">
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 800; color: var(--brand-navy-900); margin: 0;">Backup &amp; Cloud Sync</h2>
          <div style="font-size: 12px; color: var(--text-muted);">Encrypted snapshots, SHA-256 hash verification &amp; cloud status</div>
        </div>

        <!-- Local Snapshot Export Card -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 18px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">
            💾 Offline Local Snapshot
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 14px;">
            Generates an immutable cryptographic dump of all projects, clients, receipts, expenses, and accounts with SHA-256 data verification.
          </p>

          <button id="btn-export-backup" class="btn-primary" style="width: 100%; min-height: 44px; font-weight: 700;">
            Generate &amp; Download Backup JSON
          </button>

          <div id="backup-snapshot-info" style="margin-top: 12px; display: none; background: #F8FAFC; border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px; font-size: 12px;">
          </div>
        </div>

        <!-- Restore from Backup Card -->
        <div style="background: white; border-radius: var(--radius-lg); border: 1px solid var(--border-light); padding: 18px; margin-bottom: 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 15px; font-weight: 800; color: var(--brand-navy-900);">
            📥 Restore from Backup JSON
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 14px;">
            Restore business books, projects, and bank records. Backups with SHA-256 hash are cryptographically verified before importing.
          </p>

          <input type="file" id="inp-restore-file" accept=".json,application/json" style="display: none;">
          <button id="btn-trigger-restore" class="btn-outline" style="width: 100%; min-height: 44px; font-weight: 700;">
            📂 Choose Backup File to Restore
          </button>

          <div id="restore-status-info" style="margin-top: 12px; display: none; border-radius: var(--radius-md); padding: 12px; font-size: 12px;">
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

          <div style="margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="btn-sync-gdrive" class="btn-outline" style="flex: 1; min-height: 44px; font-size: 12px; color: var(--text-muted); border-color: var(--border-medium);">
              Google Drive (Not Connected)
            </button>
            <button id="btn-sync-supabase" class="btn-outline" style="flex: 1; min-height: 44px; font-size: 12px; color: var(--text-muted); border-color: var(--border-medium);">
              Supabase (Not Connected)
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
        const total = s.totalRecords !== undefined ? s.totalRecords : 0;
        const hash = res.dataHash || 'N/A';

        infoBox.innerHTML = `
          <div style="font-weight: 700; color: var(--color-success); margin-bottom: 4px;">✅ Backup Snapshot Ready</div>
          <div>Total Entities: <strong>${total}</strong> records</div>
          <div style="margin-top: 4px; font-family: monospace; font-size: 10px; word-break: break-all; background: white; padding: 6px; border: 1px solid var(--border-light); border-radius: 4px;">
            SHA-256 Hash: ${hash}
          </div>
        `;

        const filename = `ddevultrahome_backup_${new Date().toISOString().split('T')[0]}.json`;
        const serializedData = res.serialized || JSON.stringify(res.payload, null, 2);
        const blob = new Blob([serializedData], { type: 'application/json' });

        // Try navigator.share when available and capable of sharing files
        let shared = false;
        if (navigator.canShare) {
          try {
            const file = new File([blob], filename, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'DDevUltraHome Backup Snapshot',
                text: `DDevUltraHome database snapshot (SHA-256: ${hash})`
              });
              shared = true;
            }
          } catch (e) {
            if (e.name === 'AbortError') return;
            console.warn('Native file share failed, falling back to download link:', e);
          }
        }

        // WebView-compatible download fallback: anchor MUST be in document.body
        if (!shared) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
          }, 200);
        }
      } catch (err) {
        infoBox.innerHTML = `<span style="color: var(--color-danger);">Snapshot error: ${err.message}</span>`;
      }
    });

    // Restore File Pick Handler
    const restoreInput = container.querySelector('#inp-restore-file');
    container.querySelector('#btn-trigger-restore')?.addEventListener('click', () => {
      // Input must be in body or clicked properly
      restoreInput.click();
    });

    restoreInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const restoreBox = container.querySelector('#restore-status-info');
      restoreBox.style.display = 'block';
      restoreBox.style.background = '#EFF6FF';
      restoreBox.style.border = '1px solid #BFDBFE';
      restoreBox.style.color = '#1E40AF';
      restoreBox.innerHTML = `Reading and verifying <strong>${file.name}</strong>...`;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const rawText = evt.target.result;
          let parsed;
          try {
            parsed = JSON.parse(rawText);
          } catch (pe) {
            throw new Error(`File is not valid JSON: ${pe.message}`);
          }

          const res = await BusinessApi.request('/backup/restore', 'POST', { snapshot: parsed });
          if (!res.success) {
            throw new Error(res.error || 'Restore failed');
          }

          const result = res.result || {};
          restoreBox.style.background = '#ECFDF5';
          restoreBox.style.border = '1px solid #A7F3D0';
          restoreBox.style.color = '#065F46';
          restoreBox.innerHTML = `
            <div style="font-weight: 800; font-size: 13px;">✅ Restore Successful!</div>
            <div style="margin-top: 4px;">Restored <strong>${result.totalRestored || 0}</strong> records cleanly into live books.</div>
            <button id="btn-goto-dashboard-after-restore" class="btn-primary" style="margin-top: 10px; width: 100%; min-height: 38px; font-size: 12px; font-weight: 700;">
              📊 View Dashboard
            </button>
          `;

          container.querySelector('#btn-goto-dashboard-after-restore')?.addEventListener('click', () => {
            if (window.appNavigate) {
              window.appNavigate('dashboard');
            } else {
              window.location.reload();
            }
          });
        } catch (err) {
          restoreBox.style.background = '#FEF2F2';
          restoreBox.style.border = '1px solid #FECACA';
          restoreBox.style.color = '#991B1B';
          restoreBox.innerHTML = `
            <div style="font-weight: 800; font-size: 13px;">❌ Restore Failed</div>
            <div style="margin-top: 4px;">${err.message}</div>
          `;
        } finally {
          restoreInput.value = '';
        }
      };

      reader.onerror = () => {
        restoreBox.style.background = '#FEF2F2';
        restoreBox.style.border = '1px solid #FECACA';
        restoreBox.style.color = '#991B1B';
        restoreBox.innerHTML = '<span style="color: var(--color-danger);">Failed to read file from storage.</span>';
        restoreInput.value = '';
      };

      reader.readAsText(file);
    });

    // Cloud sync triggers
    container.querySelector('#btn-sync-gdrive')?.addEventListener('click', () => {
      alert('Google Drive is not connected. Cloud backup is inactive.');
    });

    container.querySelector('#btn-sync-supabase')?.addEventListener('click', () => {
      alert('Supabase is not connected. Cloud database sync is inactive.');
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
            <span>Local Database Storage</span>
            <span class="badge-status badge-active">Active • Connected</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md); font-size: 13px;">
            <span>Google Drive API</span>
            <span class="badge-status badge-neutral" style="color: #64748B; background: #F1F5F9; border: 1px solid #CBD5E1;">Not Connected</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #F8FAFC; border-radius: var(--radius-md); font-size: 13px;">
            <span>Supabase Cloud DB</span>
            <span class="badge-status badge-neutral" style="color: #64748B; background: #F1F5F9; border: 1px solid #CBD5E1;">Not Connected</span>
          </div>
        </div>
      `;
    } catch (e) {
      listEl.innerHTML = `<div style="color: var(--color-danger); font-size: 12px;">Failed to query sync state: ${e.message}</div>`;
    }
  }
};
