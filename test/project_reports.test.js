import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { FinancialService } from '../src/services/financialService.js';
import { LabourService } from '../src/services/labourService.js';

describe('DDevUltraHome — Project Financial Reports Engine', () => {
  let db;
  let finance;
  let labour;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    const runner = new MigrationRunner(db);
    runner.runMigrations();
    finance = new FinancialService(db);
    labour = new LabourService(db);

    // Initial setup: client and project
    db.run(`
      INSERT INTO clients (id, name, phone, email, billing_address)
      VALUES ('cli-rep-1', 'Thiru. Venkatesh', '+91 98401 23456', 'venkatesh@example.com', 'Anna Nagar, Chennai');
    `);

    db.run(`
      INSERT INTO projects (id, project_code, name, client_id, site_address, contract_value, budgeted_cost, status)
      VALUES ('prj-rep-1', 'PRJ-REP-2026', 'Anna Nagar Duplex', 'cli-rep-1', 'Anna Nagar West, Chennai', 5000000.00, 4200000.00, 'ACTIVE');
    `);

    // Fund account with sufficient balance for tests
    db.run(`
      UPDATE financial_accounts SET current_balance = 5000000.00 WHERE id = 'acc-hdfc-current';
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('generates comprehensive project report with empty books showing ₹0', () => {
    const report = finance.getProjectFullReport('prj-rep-1');
    assert.ok(report);
    assert.equal(report.project.name, 'Anna Nagar Duplex');
    assert.equal(report.summary.contractValue, 5000000.00);
    assert.equal(report.summary.totalIncomeReceived, 0.00);
    assert.equal(report.summary.totalExpenses, 0.00);
    assert.equal(report.summary.outstandingClientPayments, 5000000.00);
    assert.equal(report.summary.labourWagesEarned, 0.00);
    assert.equal(report.summary.labourWagesPaid, 0.00);
    assert.equal(report.summary.labourWagesOutstanding, 0.00);
    assert.equal(report.summary.netCashflow, 0.00);
    assert.equal(report.transactionHistory.length, 0);
  });

  test('computes income, expense category breakdown, and net cashflow accurately', () => {
    // 1. Client advance receipt of ₹10,00,000
    finance.recordClientReceipt({
      projectId: 'prj-rep-1',
      clientId: 'cli-rep-1',
      amount: 1000000.00,
      paymentMode: 'BANK_TRANSFER',
      receiptDate: '2026-10-15',
      accountId: 'acc-hdfc-current',
      isAdvance: 1,
      notes: 'Foundation advance'
    });

    // 2. Direct site expenses across categories
    finance.recordExpense({
      projectId: 'prj-rep-1',
      amount: 250000.00,
      category: 'MATERIAL',
      paymentMode: 'NEFT',
      expenseDate: '2026-10-16',
      accountId: 'acc-hdfc-current',
      paidTo: 'UltraTech Cement Dealer',
      notes: 'Cement bags delivery'
    });

    finance.recordExpense({
      projectId: 'prj-rep-1',
      amount: 35000.00,
      category: 'TRANSPORT',
      paymentMode: 'CASH',
      expenseDate: '2026-10-17',
      accountId: 'acc-hdfc-current',
      paidTo: 'Lorry Freight Logistics',
      notes: 'TMT bar transport'
    });

    finance.recordExpense({
      projectId: 'prj-rep-1',
      amount: 15000.00,
      category: 'EQUIPMENT',
      paymentMode: 'BANK_TRANSFER',
      expenseDate: '2026-10-18',
      accountId: 'acc-hdfc-current',
      paidTo: 'JCB Earthmovers Hire',
      notes: 'Basement excavation hire'
    });

    const report = finance.getProjectFullReport('prj-rep-1');
    assert.equal(report.summary.totalIncomeReceived, 1000000.00);
    assert.equal(report.summary.totalExpenses, 300000.00); // 250k + 35k + 15k
    assert.equal(report.summary.outstandingClientPayments, 4000000.00); // 5000k - 1000k
    assert.equal(report.summary.netCashflow, 700000.00); // 1000k - 300k

    // Category breakdown assertions
    assert.equal(report.expenseCategoryBreakdown.MATERIALS, 250000.00);
    assert.equal(report.expenseCategoryBreakdown.TRANSPORT, 35000.00);
    assert.equal(report.expenseCategoryBreakdown.EQUIPMENT, 15000.00);
    assert.equal(report.expenseCategoryBreakdown.MISCELLANEOUS, 0.00);

    // Transactions list contains 4 entries sorted by date descending
    assert.equal(report.transactionHistory.length, 4);
    assert.equal(report.transactionHistory[0].type, 'EXPENSE'); // Oct 18
    assert.equal(report.transactionHistory[3].type, 'INCOME');  // Oct 15
  });

  test('incorporates labour attendance and wages into project financial statement', () => {
    const worker = labour.createWorker({ name: 'Raju M', dailyWage: 1000 });
    labour.recordAttendance({ workerId: worker.id, projectId: 'prj-rep-1', attendanceDate: '2026-10-20', status: 'PRESENT' });
    labour.recordAttendance({ workerId: worker.id, projectId: 'prj-rep-1', attendanceDate: '2026-10-21', status: 'PRESENT' });

    labour.recordLabourPayment({
      workerId: worker.id,
      projectId: 'prj-rep-1',
      accountId: 'acc-hdfc-current',
      paymentType: 'ADVANCE',
      amount: 500.00,
      paymentDate: '2026-10-20'
    });

    const report = finance.getProjectFullReport('prj-rep-1');
    assert.equal(report.summary.labourWagesEarned, 2000.00);
    assert.equal(report.summary.labourWagesPaid, 500.00);
    assert.equal(report.summary.labourWagesOutstanding, 1500.00);
  });

  test('filters transactions by date range accurately', () => {
    const today = new Date().toISOString().split('T')[0];

    // Transaction yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    finance.recordClientReceipt({
      projectId: 'prj-rep-1',
      clientId: 'cli-rep-1',
      amount: 100000.00,
      receiptDate: yesterday,
      accountId: 'acc-hdfc-current',
      paymentMode: 'CASH'
    });

    // Transaction today
    finance.recordClientReceipt({
      projectId: 'prj-rep-1',
      clientId: 'cli-rep-1',
      amount: 50000.00,
      receiptDate: today,
      accountId: 'acc-hdfc-current',
      paymentMode: 'CASH'
    });

    // Filter by TODAY
    const todayReport = finance.getProjectFullReport('prj-rep-1', { dateRange: 'TODAY' });
    assert.equal(todayReport.summary.totalIncomeReceived, 50000.00);

    // Filter by ALL
    const allReport = finance.getProjectFullReport('prj-rep-1', { dateRange: 'ALL' });
    assert.equal(allReport.summary.totalIncomeReceived, 150000.00);
  });
});
