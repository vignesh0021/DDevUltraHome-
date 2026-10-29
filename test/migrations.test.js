import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';

describe('DDevUltraHome Versioned Migration Framework & Relational Schema', () => {
  let db;
  let runner;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
  });

  afterEach(() => {
    db.close();
  });

  test('runs migrations 001 and 002 sequentially on a clean database', () => {
    const result = runner.runMigrations();

    assert.equal(result.appliedCount, 2, 'Should have applied exactly 2 migrations');
    assert.equal(result.currentVersion, 2, 'Current schema version must be 2');

    // Verify migration tracking table
    const applied = runner.getAppliedVersions();
    assert.deepEqual(applied, [1, 2]);

    // Second run should be a no-op (idempotent)
    const secondRun = runner.runMigrations();
    assert.equal(secondRun.appliedCount, 0, 'No pending migrations should run on second pass');
  });

  test('creates all core tables with foreign key enforcement', () => {
    runner.runMigrations();

    // Verify tables exist
    const tables = db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' 
      ORDER BY name ASC;
    `).map(r => r.name);

    const expectedTables = [
      '_schema_migrations',
      'account_transactions',
      'audit_logs',
      'budget_variations',
      'client_receipts',
      'clients',
      'company_settings',
      'contracts',
      'documents',
      'expenses',
      'financial_accounts',
      'milestones',
      'ocr_reviews',
      'progress_updates',
      'project_budgets',
      'projects',
      'quotation_items',
      'quotations',
      'receipt_allocations',
      'supplier_invoices',
      'supplier_payments',
      'suppliers',
      'sync_state',
      'users'
    ];

    for (const expected of expectedTables) {
      assert.ok(tables.includes(expected), `Table ${expected} must exist in database`);
    }

    // Verify foreign key enforcement
    assert.throws(() => {
      // Inserting project with non-existent client must throw foreign key constraint error
      db.run(`
        INSERT INTO projects (id, project_code, name, client_id, site_address)
        VALUES ('p1', 'PRJ-001', 'Test House', 'non-existent-client', 'Chennai');
      `);
    }, /FOREIGN KEY/i, 'Foreign key constraint must prevent orphaned project');
  });

  test('seeds default users with 5 RBAC roles and company settings', () => {
    runner.runMigrations();

    const users = db.query('SELECT role, email, full_name FROM users ORDER BY role ASC;');
    assert.equal(users.length, 5, 'Should have seeded 5 default users');

    const roles = users.map(u => u.role);
    assert.ok(roles.includes('OWNER'), 'Must have OWNER user');
    assert.ok(roles.includes('ACCOUNTANT'), 'Must have ACCOUNTANT user');
    assert.ok(roles.includes('SITE_MANAGER'), 'Must have SITE_MANAGER user');
    assert.ok(roles.includes('ENGINEER'), 'Must have ENGINEER user');
    assert.ok(roles.includes('CLIENT'), 'Must have CLIENT user');

    const settings = db.queryOne("SELECT company_name, tagline FROM company_settings WHERE id = 'company-main';");
    assert.ok(settings, 'Company settings must exist');
    assert.equal(settings.company_name, 'D DEV ULTRA HOMES');
    assert.equal(settings.tagline, 'Building your dreams');

    const accounts = db.query('SELECT account_type, account_name FROM financial_accounts;');
    assert.equal(accounts.length, 3, 'Must have seeded 3 default accounts (Bank & Petty cash)');
  });
});
