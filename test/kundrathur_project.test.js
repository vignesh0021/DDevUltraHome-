import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { BusinessApiRouter } from '../src/api/router.js';

describe('DDevUltraHome — Kundrathur Residence Real Agreement & Contract Integrity', () => {
  let db;
  let runner;
  let router;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
    runner.runMigrations();
    router = new BusinessApiRouter(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('verifies Kundrathur Residence project and client Mr. Thiumani P. are seeded accurately', () => {
    const client = db.queryOne("SELECT * FROM clients WHERE id = 'cli-thiumani-01';");
    assert.ok(client, 'Client Mr. Thiumani P. must exist');
    assert.equal(client.name, 'Mr. Thiumani P.');
    assert.match(client.phone, /98400/);
    assert.match(client.billing_address, /Anakaputhur/);

    const project = db.queryOne("SELECT * FROM projects WHERE id = 'prj-kun-01';");
    assert.ok(project, 'Kundrathur project must exist');
    assert.equal(project.project_code, 'PRJ-KUN-2026');
    assert.equal(project.name, 'Kundrathur Residence (G+1 Villa)');
    assert.equal(project.contract_value, 4227400.00);
    assert.equal(project.budgeted_cost, 3400000.00);
    assert.equal(project.district, 'Chennai');
    assert.equal(project.status, 'ACTIVE');

    const contract = db.queryOne("SELECT * FROM contracts WHERE id = 'ctr-kun-01';");
    assert.ok(contract, 'Contract deed must exist');
    assert.equal(contract.contract_value, 4227400.00);
    assert.equal(contract.contract_number, 'CTR-KUN-2026-001');
    assert.equal(contract.advance_percentage, 18.92);
  });

  test('verifies all 8 payment milestones sum exactly to ₹42,27,400 and 100% of contract', () => {
    const milestones = db.query("SELECT * FROM milestones WHERE project_id = 'prj-kun-01' ORDER BY milestone_code ASC;");
    assert.equal(milestones.length, 8, 'Contract must contain exactly 8 milestone stages');

    const totalAmount = milestones.reduce((sum, m) => sum + m.invoice_amount, 0);
    const totalPercentage = milestones.reduce((sum, m) => sum + m.target_percentage, 0);

    assert.equal(Math.round(totalAmount), 4227400, 'Sum of all milestones must equal contract value ₹42,27,400');
    assert.equal(Math.round(totalPercentage), 100, 'Sum of all milestone percentages must equal 100%');

    // Milestone 1: Advance
    assert.equal(milestones[0].milestone_code, 'MS-01');
    assert.equal(milestones[0].invoice_amount, 800000.00);
    assert.equal(milestones[0].status, 'BILLED');

    // Milestone 2: G.F Roof Level Brickwork
    assert.equal(milestones[1].milestone_code, 'MS-02');
    assert.equal(milestones[1].invoice_amount, 600000.00);

    // Milestone 3: G.F Roof Slab Concrete
    assert.equal(milestones[2].milestone_code, 'MS-03');
    assert.equal(milestones[2].invoice_amount, 700000.00);

    // Milestone 8: Handover / Completion
    assert.equal(milestones[7].milestone_code, 'MS-08');
    assert.equal(milestones[7].invoice_amount, 27400.00);
  });

  test('verifies BusinessApiRouter GET /projects/prj-kun-01 returns complete contract and milestones payload', async () => {
    const res = await router.handle('/api/business/projects/prj-kun-01', 'GET');

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.project.name, 'Kundrathur Residence (G+1 Villa)');
    assert.equal(res.data.project.client_name, 'Mr. Thiumani P.');
    assert.equal(res.data.project.contract_value, 4227400.00);
    assert.equal(res.data.milestones.length, 8);
    assert.ok(res.data.financials, 'Financials summary must be included');
  });

  test('verifies unique bill index prevents duplicate supplier invoice entry', () => {
    // Insert a test supplier
    db.run(`
      INSERT INTO suppliers (id, name, phone, category)
      VALUES ('sup-test-1', 'Chennai Steel Yard', '+91 98400 11223', 'STEEL');
    `);

    // First invoice insertion succeeds
    db.run(`
      INSERT INTO supplier_invoices (
        id, invoice_number, supplier_id, project_id, invoice_date, due_date,
        total_amount, payment_status
      ) VALUES ('inv-1', 'INV-2026-001', 'sup-test-1', 'prj-kun-01', '2026-04-10', '2026-05-10', 50000.00, 'UNPAID');
    `);

    // Duplicate invoice insertion with same supplier_id and invoice_number must be rejected
    assert.throws(() => {
      db.run(`
        INSERT INTO supplier_invoices (
          id, invoice_number, supplier_id, project_id, invoice_date, due_date,
          total_amount, payment_status
        ) VALUES ('inv-2', 'INV-2026-001', 'sup-test-1', 'prj-kun-01', '2026-04-10', '2026-05-10', 50000.00, 'UNPAID');
      `);
    }, /UNIQUE constraint failed/i, 'Database must enforce unique bill constraint per supplier');
  });
});
