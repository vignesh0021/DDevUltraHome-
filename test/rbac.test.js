import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { AuthService } from '../src/services/authService.js';
import { Roles, Permissions } from '../config/rbac.js';

describe('DDevUltraHome Role-Based Access Control (RBAC) & Authentication', () => {
  let db;
  let auth;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    const runner = new MigrationRunner(db);
    runner.runMigrations();
    auth = new AuthService(db);
  });

  afterEach(() => {
    db.close();
  });

  test('authenticates valid users with seeded credentials', () => {
    const session = auth.login('owner@ddevultrahomes.com', 'DDev@2026');

    assert.ok(session.token, 'Session token should be generated');
    assert.equal(session.user.role, Roles.OWNER);
    assert.equal(session.user.email, 'owner@ddevultrahomes.com');

    // Token verification
    const verified = auth.verifySession(session.token);
    assert.equal(verified.id, session.user.id);
  });

  test('rejects incorrect passwords and deactivated accounts', () => {
    assert.throws(() => {
      auth.login('owner@ddevultrahomes.com', 'WrongPassword');
    }, /Invalid email or password/i);

    // Deactivate accountant
    db.run("UPDATE users SET is_active = 0 WHERE email = 'accounts@ddevultrahomes.com';");
    assert.throws(() => {
      auth.login('accounts@ddevultrahomes.com', 'DDev@2026');
    }, /deactivated/i);
  });

  test('Owner role has complete executive permissions', () => {
    const owner = { id: '1', role: Roles.OWNER, assignedProjectIds: [] };

    assert.ok(auth.authorize(owner, Permissions.VIEW_EXECUTIVE_DASHBOARD));
    assert.ok(auth.authorize(owner, Permissions.VIEW_COMPANY_FINANCIALS));
    assert.ok(auth.authorize(owner, Permissions.VIEW_PROFIT_LOSS));
    assert.ok(auth.authorize(owner, Permissions.MANAGE_COMPANY_SETTINGS));
    assert.ok(auth.authorize(owner, Permissions.APPROVE_QUOTATION));
    assert.ok(auth.authorize(owner, Permissions.TRIGGER_CLOUD_SYNC));
  });

  test('Accountant role can manage financial records but cannot alter company settings', () => {
    const accountant = { id: '2', role: Roles.ACCOUNTANT, assignedProjectIds: [] };

    assert.ok(auth.authorize(accountant, Permissions.VIEW_EXECUTIVE_DASHBOARD));
    assert.ok(auth.authorize(accountant, Permissions.RECORD_CLIENT_RECEIPT));
    assert.ok(auth.authorize(accountant, Permissions.RECORD_SUPPLIER_PAYMENT));
    assert.ok(auth.authorize(accountant, Permissions.VIEW_SUPPLIER_DUES));

    // Must be forbidden from changing company statutory profile/ownership
    assert.equal(auth.authorize(accountant, Permissions.MANAGE_COMPANY_SETTINGS), false);
    assert.equal(auth.authorize(accountant, Permissions.DELETE_PROJECT), false);
  });

  test('Site Manager role cannot view company financials or supplier dues', () => {
    const manager = { id: '3', role: Roles.SITE_MANAGER, assignedProjectIds: ['prj-101'] };

    assert.ok(auth.authorize(manager, Permissions.RECORD_EXPENSE));
    assert.ok(auth.authorize(manager, Permissions.UPDATE_SITE_PROGRESS));

    // Strictly forbidden from executive finances
    assert.equal(auth.authorize(manager, Permissions.VIEW_COMPANY_FINANCIALS), false);
    assert.equal(auth.authorize(manager, Permissions.VIEW_PROFIT_LOSS), false);
    assert.equal(auth.authorize(manager, Permissions.VIEW_SUPPLIER_DUES), false);
    assert.equal(auth.authorize(manager, Permissions.APPROVE_QUOTATION), false);

    // Project context boundary check: only authorized for assigned project
    assert.ok(auth.authorize(manager, Permissions.VIEW_ASSIGNED_PROJECTS, { projectId: 'prj-101' }));
    assert.equal(auth.authorize(manager, Permissions.VIEW_ASSIGNED_PROJECTS, { projectId: 'prj-999' }), false);
  });

  test('Client role is strictly restricted to their designated project portal', () => {
    const client = { id: '5', role: Roles.CLIENT, assignedProjectIds: ['prj-guindy'] };

    assert.ok(auth.authorize(client, Permissions.VIEW_OWN_PROJECT_PORTAL));
    assert.ok(auth.authorize(client, Permissions.VIEW_SITE_PROGRESS));

    // Client must NEVER see company financials, expenses, or supplier payables
    assert.equal(auth.authorize(client, Permissions.VIEW_COMPANY_FINANCIALS), false);
    assert.equal(auth.authorize(client, Permissions.VIEW_ALL_EXPENSES), false);
    assert.equal(auth.authorize(client, Permissions.RECORD_EXPENSE), false);
    assert.equal(auth.authorize(client, Permissions.VIEW_SUPPLIER_DUES), false);
    assert.equal(auth.authorize(client, Permissions.MANAGE_CLIENTS), false);

    // Project boundary check
    assert.ok(auth.authorize(client, Permissions.VIEW_OWN_PROJECT_PORTAL, { projectId: 'prj-guindy' }));
    assert.equal(auth.authorize(client, Permissions.VIEW_OWN_PROJECT_PORTAL, { projectId: 'prj-other' }), false);
  });
});
