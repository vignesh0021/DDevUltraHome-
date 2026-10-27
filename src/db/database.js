/**
 * DDevUltraHome SQLite Database & Persistence Module
 * Built on Node.js 26 native node:sqlite
 * Stores Projects, Estimate Revisions, Custom Rates, Scrap Transactions, and Audit Trail
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

export class AppDatabase {
  constructor(dbPath = null) {
    if (dbPath) {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(dbPath);
    } else {
      // Memory db for tests
      this.db = new DatabaseSync(':memory:');
    }

    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        client TEXT,
        location TEXT,
        district TEXT DEFAULT 'Chennai',
        plot_area_sqft REAL,
        builtup_area_sqft REAL,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS estimates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        revision INTEGER DEFAULT 1,
        title TEXT NOT NULL,
        items_json TEXT NOT NULL,
        financials_json TEXT NOT NULL,
        grand_total REAL NOT NULL,
        is_locked INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS custom_rates (
        id TEXT PRIMARY KEY,
        material_id TEXT NOT NULL,
        district TEXT NOT NULL,
        rate REAL NOT NULL,
        source_name TEXT,
        notes TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scrap_settlements (
        id TEXT PRIMARY KEY,
        party_name TEXT,
        material_name TEXT NOT NULL,
        weights_json TEXT NOT NULL,
        pricing_json TEXT NOT NULL,
        gross_value REAL NOT NULL,
        net_payout REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL
      );
    `);
  }

  // --- Project CRUD ---
  createProject(proj) {
    const id = proj.id || `PROJ-${Date.now()}`;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, client, location, district, plot_area_sqft, builtup_area_sqft, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      proj.name,
      proj.client || '',
      proj.location || '',
      proj.district || 'Chennai',
      proj.plot_area_sqft || 0,
      proj.builtup_area_sqft || 0,
      proj.status || 'ACTIVE',
      now,
      now
    );
    this.logAudit('PROJECT', id, 'CREATE', `Created project ${proj.name}`);
    return this.getProject(id);
  }

  getProject(id) {
    const stmt = this.db.prepare(`SELECT * FROM projects WHERE id = ?`);
    return stmt.get(id);
  }

  getAllProjects() {
    const stmt = this.db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`);
    return stmt.all();
  }

  // --- Estimates ---
  saveEstimate(est) {
    const id = est.id || `EST-${Date.now()}`;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO estimates (id, project_id, revision, title, items_json, financials_json, grand_total, is_locked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      est.project_id,
      est.revision || 1,
      est.title || 'Estimate Revision',
      JSON.stringify(est.items || []),
      JSON.stringify(est.financials || {}),
      est.grand_total || 0,
      est.is_locked ? 1 : 0,
      now
    );
    this.logAudit('ESTIMATE', id, 'SAVE', `Saved estimate ${id} for project ${est.project_id}`);
    return this.getEstimate(id);
  }

  getEstimate(id) {
    const stmt = this.db.prepare(`SELECT * FROM estimates WHERE id = ?`);
    const row = stmt.get(id);
    if (!row) return null;
    return {
      ...row,
      items: JSON.parse(row.items_json),
      financials: JSON.parse(row.financials_json),
      is_locked: Boolean(row.is_locked)
    };
  }

  getEstimatesForProject(projectId) {
    const stmt = this.db.prepare(`SELECT * FROM estimates WHERE project_id = ? ORDER BY revision ASC`);
    return stmt.all(projectId).map(row => ({
      ...row,
      items: JSON.parse(row.items_json),
      financials: JSON.parse(row.financials_json),
      is_locked: Boolean(row.is_locked)
    }));
  }

  // --- Scrap Settlements ---
  saveScrapSettlement(record) {
    const id = record.id || `SCRAP-${Date.now()}`;
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO scrap_settlements (id, party_name, material_name, weights_json, pricing_json, gross_value, net_payout, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      record.party_name || 'Counter Customer',
      record.material_name,
      JSON.stringify(record.weights || {}),
      JSON.stringify(record.pricing || {}),
      record.gross_value || 0,
      record.net_payout || 0,
      now
    );
    this.logAudit('SCRAP', id, 'SETTLEMENT', `Recorded scrap settlement for ${record.material_name}`);
    return id;
  }

  getAllScrapSettlements() {
    const stmt = this.db.prepare(`SELECT * FROM scrap_settlements ORDER BY created_at DESC LIMIT 50`);
    return stmt.all().map(row => ({
      ...row,
      weights: JSON.parse(row.weights_json),
      pricing: JSON.parse(row.pricing_json)
    }));
  }

  // --- Audit Logs ---
  logAudit(entityType, entityId, action, details) {
    const id = `AUD-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, entityType, entityId, action, details || '', new Date().toISOString());
  }

  getAuditLogs(limit = 50) {
    const stmt = this.db.prepare(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?`);
    return stmt.all(limit);
  }

  // --- Backup & Restore ---
  exportBackupJson() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      projects: this.getAllProjects(),
      estimates: this.db.prepare(`SELECT * FROM estimates`).all(),
      custom_rates: this.db.prepare(`SELECT * FROM custom_rates`).all(),
      scrap_settlements: this.db.prepare(`SELECT * FROM scrap_settlements`).all(),
      audit_logs: this.getAuditLogs(100)
    };
  }

  importBackupJson(data) {
    if (!data || !Array.isArray(data.projects)) {
      throw new Error('Invalid backup format');
    }

    this.db.exec('BEGIN TRANSACTION;');
    try {
      if (data.projects) {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO projects (id, name, client, location, district, plot_area_sqft, builtup_area_sqft, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of data.projects) {
          stmt.run(p.id, p.name, p.client, p.location, p.district, p.plot_area_sqft, p.builtup_area_sqft, p.status, p.created_at, p.updated_at);
        }
      }

      if (data.estimates) {
        const estStmt = this.db.prepare(`
          INSERT OR REPLACE INTO estimates (id, project_id, revision, title, items_json, financials_json, grand_total, is_locked, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const e of data.estimates) {
          estStmt.run(e.id, e.project_id, e.revision, e.title, e.items_json, e.financials_json, e.grand_total, e.is_locked, e.created_at);
        }
      }

      this.db.exec('COMMIT;');
      this.logAudit('DATABASE', 'ALL', 'RESTORE', 'Restored database from JSON backup');
      return true;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }
}
