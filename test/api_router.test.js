import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { BusinessApiRouter } from '../src/api/router.js';

describe('DDevUltraHome Business API Router Endpoints', () => {
  let db;
  let runner;
  let router;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
    runner.migrate();
    router = new BusinessApiRouter(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('GET /api/business/dashboard/summary returns executive metrics and company branding', async () => {
    const res = await router.handle('/api/business/dashboard/summary', 'GET');

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.dashboard.companyName, 'D DEV ULTRA HOMES');
    assert.equal(res.data.dashboard.tagline, 'Building your dreams');
    assert.equal(typeof res.data.dashboard.liquidCash, 'number');
    assert.equal(typeof res.data.dashboard.accountsPayable, 'number');
  });

  test('POST & GET /api/business/clients manages client directory', async () => {
    const createRes = await router.handle('/api/business/clients', 'POST', {
      name: 'Dr. S. K. Ramanathan',
      company_name: 'Ramanathan Diagnostics',
      phone: '+91 98401 11223',
      email: 'ramanathan@gmail.com',
      billing_address: 'Alwarpet, Chennai',
      gstin: '33AAACR1234F1Z8'
    });

    assert.equal(createRes.status, 201);
    assert.ok(createRes.data.client.id);
    assert.equal(createRes.data.client.name, 'Dr. S. K. Ramanathan');

    const listRes = await router.handle('/api/business/clients', 'GET');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.clients.length >= 1);
  });

  test('POST & GET /api/business/projects creates project and retrieves P&L', async () => {
    // 1. Create client first
    const clientRes = await router.handle('/api/business/clients', 'POST', {
      name: 'Mr. JAS Guindy',
      phone: '+91 98400 12345',
      billing_address: 'Guindy, Chennai'
    });
    const clientId = clientRes.data.client.id;

    // 2. Create project
    const prjRes = await router.handle('/api/business/projects', 'POST', {
      name: 'Guindy Residence',
      client_id: clientId,
      project_code: 'PRJ-GND-01',
      site_address: 'Guindy, Chennai',
      district: 'Chennai',
      contract_value: 8500000.00,
      total_builtup_area_sqft: 3450
    });

    assert.equal(prjRes.status, 201);
    const prjId = prjRes.data.project.id;

    // 3. Get project details with P&L
    const detailRes = await router.handle(`/api/business/projects/${prjId}`, 'GET');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.data.project.project_code, 'PRJ-GND-01');
    assert.equal(detailRes.data.financials.earnedRevenue, 0);
  });

  test('POST /api/business/income/receipts records advance without inflating earned profit', async () => {
    // Create client & project
    const cli = await router.handle('/api/business/clients', 'POST', { name: 'Client Test', phone: '123' });
    const prj = await router.handle('/api/business/projects', 'POST', { name: 'Test Prj', client_id: cli.data.client.id });

    // Record advance of ₹5,00,000
    const recRes = await router.handle('/api/business/income/receipts', 'POST', {
      projectId: prj.data.project.id,
      clientId: cli.data.client.id,
      amount: 500000.00,
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: 'HDFC-ADV-001',
      receiptDate: '2026-10-27',
      accountId: 'acc-hdfc-current',
      isAdvance: 1,
      notes: 'Initial mobilization advance'
    });

    assert.equal(recRes.status, 201);
    assert.equal(recRes.data.receipt.amount, 500000.00);

    // Verify P&L: Earned revenue is 0, unearned liability is ₹5,00,000
    const pnlRes = await router.handle(`/api/business/projects/${prj.data.project.id}`, 'GET');
    assert.equal(pnlRes.data.financials.earnedRevenue, 0.00);
    assert.equal(pnlRes.data.financials.unearnedAdvanceLiability, 500000.00);
  });

  test('GET /api/business/backup/snapshot generates valid SHA-256 data hash', async () => {
    const res = await router.handle('/api/business/backup/snapshot', 'GET');

    assert.equal(res.status, 200);
    assert.ok(res.data.dataHash.length === 64);
    assert.equal(res.data.summary.tableCounts.company_settings, 1);
  });

  test('PUT /api/business/settings/accounts/:id updates bank account details and validates inputs', async () => {
    // 1. Successful update with valid IFSC
    const updateRes = await router.handle('/api/business/settings/accounts/acc-hdfc-current', 'PUT', {
      account_name: 'HDFC Corporate Current A/C',
      account_type: 'BANK',
      bank_name: 'HDFC Bank Ltd',
      account_number: '50200012345678',
      branch_ifsc: 'HDFC0001234',
      current_balance: 75000.50
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.success, true);
    assert.equal(updateRes.data.account.account_name, 'HDFC Corporate Current A/C');
    assert.equal(updateRes.data.account.branch_ifsc, 'HDFC0001234');
    assert.equal(updateRes.data.account.current_balance, 75000.50);

    // 2. Reject empty account name
    const emptyNameRes = await router.handle('/api/business/settings/accounts/acc-hdfc-current', 'PUT', {
      account_name: '',
      current_balance: 1000
    });
    assert.equal(emptyNameRes.status, 400);
    assert.ok(emptyNameRes.data.error.includes('Account name cannot be blank'));

    // 3. Reject negative balance
    const negBalRes = await router.handle('/api/business/settings/accounts/acc-hdfc-current', 'PUT', {
      account_name: 'Valid Name',
      current_balance: -500
    });
    assert.equal(negBalRes.status, 400);
    assert.ok(negBalRes.data.error.includes('non-negative'));

    // 4. Reject invalid IFSC
    const badIfscRes = await router.handle('/api/business/settings/accounts/acc-hdfc-current', 'PUT', {
      account_name: 'Valid Name',
      branch_ifsc: 'INVALID123'
    });
    assert.equal(badIfscRes.status, 400);
    assert.ok(badIfscRes.data.error.includes('Invalid IFSC'));

    // 5. 404 for unknown account
    const notFoundRes = await router.handle('/api/business/settings/accounts/nonexistent-id', 'PUT', {
      account_name: 'Test Account'
    });
    assert.equal(notFoundRes.status, 404);
  });
});
