/**
 * DDevUltraHome — Database Connection Manager
 * Node.js Native SQLite (node:sqlite DatabaseSync) Driver
 * Supports persistent file storage and fast in-memory execution for automated tests.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseConnection {
  constructor(dbPath = null) {
    this.dbPath = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'ddevultrahome.db');
    this.db = null;
  }

  /**
   * Connect to SQLite database
   * @param {string} [overridePath]
   * @returns {DatabaseSync}
   */
  connect(overridePath = null) {
    if (this.db) return this.db;

    const targetPath = overridePath || this.dbPath;

    if (targetPath !== ':memory:') {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(targetPath);

    // Enforce relational foreign keys & concurrency
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (targetPath !== ':memory:') {
      try {
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec('PRAGMA synchronous = NORMAL;');
      } catch (e) {
        // WAL may not be supported on all virtual mount points
      }
    }

    return this.db;
  }

  /**
   * Execute raw SQL statements (schema creation, bulk scripts)
   */
  exec(sql) {
    const db = this.connect();
    return db.exec(sql);
  }

  /**
   * Run SQL with parameter binding (INSERT, UPDATE, DELETE)
   */
  run(sql, params = []) {
    const db = this.connect();
    const stmt = db.prepare(sql);
    const cleanParams = params.map(p => (p === undefined ? null : p));
    return stmt.run(...cleanParams);
  }

  /**
   * Query all matching rows
   */
  query(sql, params = []) {
    const db = this.connect();
    const stmt = db.prepare(sql);
    const cleanParams = params.map(p => (p === undefined ? null : p));
    return stmt.all(...cleanParams);
  }

  /**
   * Query single matching row
   */
  queryOne(sql, params = []) {
    const rows = this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute callback within a database transaction (supports nested transactions via SAVEPOINT)
   */
  transaction(callback) {
    const db = this.connect();
    if (this._inTransaction) {
      const spName = `sp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      db.exec(`SAVEPOINT ${spName};`);
      try {
        const result = callback(this);
        db.exec(`RELEASE SAVEPOINT ${spName};`);
        return result;
      } catch (err) {
        db.exec(`ROLLBACK TO SAVEPOINT ${spName};`);
        throw err;
      }
    }

    this._inTransaction = true;
    db.exec('BEGIN TRANSACTION;');
    try {
      const result = callback(this);
      db.exec('COMMIT;');
      return result;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    } finally {
      this._inTransaction = false;
    }
  }

  /**
   * Close connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Global default singleton instance
export const db = new DatabaseConnection();
export const defaultDb = db;
