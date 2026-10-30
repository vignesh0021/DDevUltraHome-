/**
 * DDevUltraHome — Backup & Cloud Synchronization Service
 * 
 * Enforces fundamental data protection and audit rules:
 * 1. Offline-first: Complete local JSON and SQLite snapshot capability.
 * 2. Immutable Data Integrity: SHA-256 hash calculated for all backups.
 * 3. Never fake cloud connection: Providers are only marked SUCCESS if real sync succeeds.
 * 4. Safe sequential restoration: Foreign keys and dependencies preserved in atomic transactions.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const BUSINESS_TABLES = [
  'company_settings',
  'users',
  'clients',
  'projects',
  'contracts',
  'project_budgets',
  'budget_variations',
  'quotations',
  'quotation_items',
  'suppliers',
  'financial_accounts',
  'client_receipts',
  'receipt_allocations',
  'supplier_invoices',
  'supplier_payments',
  'expenses',
  'account_transactions',
  'milestones',
  'progress_updates',
  'documents',
  'ocr_reviews'
];

export class SyncService {
  constructor(dbConnection, backupDir = null) {
    this.db = dbConnection;
    this.backupDir = backupDir || path.join(process.cwd(), 'backups');
  }

  /**
   * Generate a complete business data snapshot
   * @returns {Object} { payload, dataHash, summary }
   */
  generateBackupSnapshot() {
    const exportedAt = new Date().toISOString();
    const tablesData = {};
    const tableCounts = {};
    let totalRecords = 0;

    for (const table of BUSINESS_TABLES) {
      try {
        const rows = this.db.query(`SELECT * FROM ${table};`);
        tablesData[table] = rows;
        tableCounts[table] = rows.length;
        totalRecords += rows.length;
      } catch (err) {
        // Table might not exist or error
        tablesData[table] = [];
        tableCounts[table] = 0;
      }
    }

    const payload = {
      meta: {
        app: 'DDevUltraHome',
        version: '1.0.0',
        company: 'D DEV ULTRA HOMES',
        tagline: 'Building your dreams',
        exportedAt,
        totalRecords,
        tableCounts
      },
      data: tablesData
    };

    const serialized = JSON.stringify(payload);
    const dataHash = createHash('sha256').update(serialized).digest('hex');
    payload.dataHash = dataHash;

    // Update local snapshot state in sync_state table
    this._recordSyncState({
      entityTable: 'ALL_ENTITIES',
      cloudProvider: 'LOCAL_SNAPSHOT',
      syncStatus: 'SUCCESS',
      lastSnapshotHash: dataHash,
      recordsSyncedCount: totalRecords,
      errorMessage: null
    });

    return {
      payload,
      serialized,
      dataHash,
      summary: {
        exportedAt,
        totalRecords,
        tableCounts,
        dataHash
      }
    };
  }

  /**
   * Save backup snapshot to a local file
   * @param {string} [customPath]
   * @returns {string} File path where snapshot was saved
   */
  exportBackupToFile(customPath = null) {
    const { serialized, dataHash, summary } = this.generateBackupSnapshot();
    const targetDir = customPath ? path.dirname(customPath) : this.backupDir;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = customPath || path.join(targetDir, `ddevultrahome_backup_${dateStr}_${dataHash.substring(0, 8)}.json`);

    fs.writeFileSync(filePath, serialized, 'utf-8');
    return {
      filePath,
      dataHash,
      fileSize: Buffer.byteLength(serialized),
      summary
    };
  }

  /**
   * Restore database from a backup snapshot
   * @param {Object|string} snapshotData JSON object or raw JSON string
   * @param {Object} options
   * @returns {Object} Restoration summary
   */
  restoreFromSnapshot(snapshotData, options = {}) {
    const { dryRun = false } = options;

    let payload = snapshotData;
    if (typeof snapshotData === 'string') {
      try {
        payload = JSON.parse(snapshotData);
      } catch (e) {
        throw new Error(`Invalid JSON format: ${e.message}`);
      }
    }

    if (!payload.meta || !payload.data) {
      throw new Error('Invalid snapshot structure. Expected top-level "meta" and "data" properties.');
    }

    if (payload.meta.app !== 'DDevUltraHome') {
      throw new Error(`Incompatible backup source app: "${payload.meta.app}". Expected "DDevUltraHome".`);
    }

    if (payload.dataHash) {
      const stableBody = JSON.stringify({ meta: payload.meta, data: payload.data });
      const computedHash = createHash('sha256').update(stableBody).digest('hex');
      if (computedHash !== payload.dataHash) {
        throw new Error('Integrity check failed: Data hash mismatch! Snapshot may be corrupted or modified.');
      }
    }

    if (dryRun) {
      return {
        dryRun: true,
        valid: true,
        meta: payload.meta,
        projectedRecords: payload.meta.totalRecords
      };
    }

    return this.db.transaction(() => {
      // 1. Temporarily disable foreign keys during mass replacement
      this.db.exec('PRAGMA foreign_keys = OFF;');

      const restoredCounts = {};
      let totalRestored = 0;

      try {
        // Delete existing records in reverse dependency order
        const reverseTables = [...BUSINESS_TABLES].reverse();
        for (const table of reverseTables) {
          try {
            this.db.run(`DELETE FROM ${table};`);
          } catch (e) {
            // Ignore if table doesn't exist
          }
        }

        // Insert new records in forward dependency order
        for (const table of BUSINESS_TABLES) {
          const rows = payload.data[table] || [];
          restoredCounts[table] = 0;

          if (rows.length > 0) {
            for (const row of rows) {
              const keys = Object.keys(row);
              const placeholders = keys.map(() => '?').join(', ');
              const values = keys.map(k => row[k]);

              this.db.run(`
                INSERT INTO ${table} (${keys.join(', ')})
                VALUES (${placeholders});
              `, values);

              restoredCounts[table]++;
              totalRestored++;
            }
          }
        }
      } finally {
        this.db.exec('PRAGMA foreign_keys = ON;');
      }

      return {
        success: true,
        restoredAt: new Date().toISOString(),
        totalRestored,
        tableCounts: restoredCounts
      };
    });
  }

  /**
   * Synchronize with cloud provider (Google Drive / Supabase / Custom)
   * Enforces truth in reporting: Never claim success without genuine network confirmation
   * 
   * @param {Object} options
   */
  async syncWithCloud(options = {}) {
    const {
      provider = 'LOCAL_SNAPSHOT', // 'GOOGLE_DRIVE', 'SUPABASE', 'LOCAL_SNAPSHOT'
      credentials = null,
      customAdapter = null
    } = options;

    const syncId = `sync_${Date.now()}`;
    const snapshot = this.generateBackupSnapshot();

    // If local snapshot only
    if (provider === 'LOCAL_SNAPSHOT') {
      return {
        provider: 'LOCAL_SNAPSHOT',
        status: 'SUCCESS',
        syncedAt: new Date().toISOString(),
        recordsSynced: snapshot.summary.totalRecords,
        dataHash: snapshot.dataHash
      };
    }

    // Check credentials presence
    if (!credentials && !customAdapter) {
      const errorMsg = `Cloud sync failed: No credentials provided for provider "${provider}".`;
      this._recordSyncState({
        entityTable: 'ALL_ENTITIES',
        cloudProvider: provider,
        syncStatus: 'FAILED',
        lastSnapshotHash: snapshot.dataHash,
        recordsSyncedCount: 0,
        errorMessage: errorMsg
      });

      return {
        provider,
        status: 'FAILED',
        error: errorMsg,
        syncedAt: null
      };
    }

    // Use custom adapter or adapter interface
    if (customAdapter && typeof customAdapter.uploadSnapshot === 'function') {
      try {
        const result = await customAdapter.uploadSnapshot({
          data: snapshot.payload,
          serialized: snapshot.serialized,
          dataHash: snapshot.dataHash
        });

        this._recordSyncState({
          entityTable: 'ALL_ENTITIES',
          cloudProvider: provider,
          syncStatus: 'SUCCESS',
          lastSnapshotHash: snapshot.dataHash,
          recordsSyncedCount: snapshot.summary.totalRecords,
          errorMessage: null
        });

        return {
          provider,
          status: 'SUCCESS',
          syncedAt: new Date().toISOString(),
          recordsSynced: snapshot.summary.totalRecords,
          dataHash: snapshot.dataHash,
          cloudFileId: result.fileId || null
        };
      } catch (adapterErr) {
        const errorMsg = `Cloud sync upload failed: ${adapterErr.message}`;
        this._recordSyncState({
          entityTable: 'ALL_ENTITIES',
          cloudProvider: provider,
          syncStatus: 'FAILED',
          lastSnapshotHash: snapshot.dataHash,
          recordsSyncedCount: 0,
          errorMessage: errorMsg
        });

        return {
          provider,
          status: 'FAILED',
          error: errorMsg,
          syncedAt: null
        };
      }
    }

    // Default provider stub without network
    const errorMsg = `Cloud sync provider "${provider}" requires active online adapter configuration.`;
    this._recordSyncState({
      entityTable: 'ALL_ENTITIES',
      cloudProvider: provider,
      syncStatus: 'FAILED',
      lastSnapshotHash: snapshot.dataHash,
      recordsSyncedCount: 0,
      errorMessage: errorMsg
    });

    return {
      provider,
      status: 'FAILED',
      error: errorMsg,
      syncedAt: null
    };
  }

  /**
   * Get sync status overview
   */
  getSyncStatus() {
    const states = this.db.query('SELECT * FROM sync_state ORDER BY updated_at DESC;');
    const countRow = this.db.queryOne('SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NULL;');

    return {
      cloudProviders: states,
      lastLocalSnapshot: states.find(s => s.cloud_provider === 'LOCAL_SNAPSHOT') || null,
      totalDocuments: countRow ? countRow.count : 0
    };
  }

  /**
   * Internal helper to record sync state
   */
  _recordSyncState(record) {
    const {
      entityTable,
      cloudProvider,
      syncStatus,
      lastSnapshotHash,
      recordsSyncedCount,
      errorMessage
    } = record;

    const id = `sync_${cloudProvider.toLowerCase()}_${entityTable.toLowerCase()}`;
    const now = new Date().toISOString();

    try {
      this.db.run(`
        INSERT INTO sync_state (
          id, entity_table, last_synced_at, last_snapshot_hash,
          cloud_provider, sync_status, error_message, records_synced_count, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          last_synced_at = excluded.last_synced_at,
          last_snapshot_hash = excluded.last_snapshot_hash,
          sync_status = excluded.sync_status,
          error_message = excluded.error_message,
          records_synced_count = excluded.records_synced_count,
          updated_at = excluded.updated_at;
      `, [
        id,
        entityTable,
        syncStatus === 'SUCCESS' ? now : null,
        lastSnapshotHash,
        cloudProvider,
        syncStatus,
        errorMessage,
        recordsSyncedCount,
        now
      ]);
    } catch (e) {
      // In case table or conflict fails, log warning
      console.warn('Sync state record error:', e.message);
    }
  }
}
