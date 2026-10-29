/**
 * DDevUltraHome — Versioned Migration Runner
 * Discovers, tracks, and applies sequential schema migrations within atomic transactions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MigrationRunner {
  constructor(dbConnection, migrationsDir = null) {
    this.db = dbConnection;
    this.migrationsDir = migrationsDir || path.join(__dirname, 'migrations');
  }

  /**
   * Initialize migration tracking table
   */
  initMigrationTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  /**
   * Get list of applied migration versions
   * @returns {number[]}
   */
  getAppliedVersions() {
    this.initMigrationTable();
    const rows = this.db.query('SELECT version FROM _schema_migrations ORDER BY version ASC;');
    return rows.map(r => r.version);
  }

  /**
   * Discover migration files on disk sorted by version number
   */
  discoverMigrations() {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir);
    const migrations = [];

    for (const file of files) {
      const match = /^(\d+)_([\w-]+)\.(sql|js)$/.exec(file);
      if (match) {
        const version = parseInt(match[1], 10);
        const name = match[2];
        const type = match[3];
        const fullPath = path.join(this.migrationsDir, file);
        migrations.push({ version, name, type, file, fullPath });
      }
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Run all pending migrations in order
   * @returns {{ appliedCount: number, applied: Array<{ version: number, name: string }> }}
   */
  runMigrations() {
    this.initMigrationTable();
    const appliedVersions = new Set(this.getAppliedVersions());
    const allMigrations = this.discoverMigrations();
    const pending = allMigrations.filter(m => !appliedVersions.has(m.version));

    const applied = [];

    for (const m of pending) {
      this.db.transaction(() => {
        if (m.type === 'sql') {
          const sql = fs.readFileSync(m.fullPath, 'utf-8');
          this.db.exec(sql);
        }
        this.db.run(
          'INSERT INTO _schema_migrations (version, name, applied_at) VALUES (?, ?, datetime(\'now\'));',
          [m.version, m.file]
        );
      });
      applied.push({ version: m.version, name: m.file });
    }

    return {
      appliedCount: applied.length,
      applied,
      currentVersion: this.getCurrentVersion()
    };
  }

  /**
   * Alias for runMigrations
   */
  migrate() {
    return this.runMigrations();
  }

  /**
   * Get highest applied migration version
   */
  getCurrentVersion() {
    this.initMigrationTable();
    const row = this.db.queryOne('SELECT MAX(version) as current_version FROM _schema_migrations;');
    return row && row.current_version ? row.current_version : 0;
  }

  /**
   * Check migration status
   */
  getStatus() {
    this.initMigrationTable();
    const appliedVersions = new Set(this.getAppliedVersions());
    const all = this.discoverMigrations();
    return {
      currentVersion: this.getCurrentVersion(),
      totalMigrations: all.length,
      appliedCount: appliedVersions.size,
      pendingCount: all.length - appliedVersions.size,
      migrations: all.map(m => ({
        version: m.version,
        file: m.file,
        applied: appliedVersions.has(m.version)
      }))
    };
  }
}
