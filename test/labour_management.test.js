import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { LabourService } from '../src/services/labourService.js';
import { FinancialService } from '../src/services/financialService.js';

describe('DDevUltraHome — Labour Attendance, Wages & Ledger Management', () => {
  let db;
  let labour;
  let finance;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    const runner = new MigrationRunner(db);
    runner.runMigrations();
    labour = new LabourService(db);
    finance = new FinancialService(db);

    // Initial setup: client, project, bank account with funds
    db.run(`
      INSERT INTO clients (id, name, phone, email)
      VALUES ('cli-lab-1', 'Thiru. Selvam', '+91 98410 11111', 'selvam@example.com');
    `);

    db.run(`
      INSERT INTO projects (id, project_code, name, client_id, site_address, contract_value, status)
      VALUES ('prj-lab-1', 'PRJ-LAB-2026', 'Tambaram Villa Site', 'cli-lab-1', 'Tambaram, Chennai', 3500000.00, 'ACTIVE');
    `);

    // Fund the bank account with ₹1,00,000 for wage disbursements
    db.run(`
      UPDATE financial_accounts SET current_balance = 100000.00 WHERE id = 'acc-hdfc-current';
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('creates, updates and lists labour worker profiles with wage rates', () => {
    // 1. Create worker
    const worker = labour.createWorker({
      name: 'Murugan K',
      phone: '+91 94440 22222',
      trade: 'MASON',
      dailyWage: 950.00,
      wageType: 'DAILY',
      joiningDate: '2026-10-01'
    });

    assert.ok(worker.id);
    assert.equal(worker.name, 'Murugan K');
    assert.equal(worker.trade, 'MASON');
    assert.equal(worker.daily_wage, 950.00);
    assert.equal(worker.wage_type, 'DAILY');

    // 2. Update worker
    const updated = labour.updateWorker(worker.id, {
      dailyWage: 1000.00,
      phone: '+91 94440 33333'
    });
    assert.equal(updated.daily_wage, 1000.00);
    assert.equal(updated.phone, '+91 94440 33333');

    // 3. List workers
    const workers = labour.listWorkers();
    assert.equal(workers.length, 1);
    assert.equal(workers[0].name, 'Murugan K');
  });

  test('records daily attendance with Present, Half-day, Absent and calculates overtime', () => {
    const worker = labour.createWorker({
      name: 'Kumar R',
      trade: 'CARPENTER',
      dailyWage: 900.00
    });

    // 1. Full day Present (1.0 unit)
    const attFull = labour.recordAttendance({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      attendanceDate: '2026-10-20',
      status: 'PRESENT',
      overtimeHours: 0
    });
    assert.equal(attFull.units, 1.0);
    assert.equal(attFull.earned_amount, 900.00);
    assert.equal(attFull.overtime_amount, 0.00);

    // 2. Half-day (0.5 unit) with 2 hours overtime
    // Daily wage = 900 for 8 hrs standard day -> hourly = 112.5 -> 2 hrs = 225
    const attHalf = labour.recordAttendance({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      attendanceDate: '2026-10-21',
      status: 'HALF_DAY',
      overtimeHours: 2
    });
    assert.equal(attHalf.units, 0.5);
    assert.equal(attHalf.earned_amount, 450.00);
    assert.equal(attHalf.overtime_amount, 225.00);

    // 3. Absent (0.0 unit)
    const attAbsent = labour.recordAttendance({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      attendanceDate: '2026-10-22',
      status: 'ABSENT'
    });
    assert.equal(attAbsent.units, 0.0);
    assert.equal(attAbsent.earned_amount, 0.00);

    // Total monthly attendance summary
    const summaries = labour.getMonthlyAttendanceSummary('2026-10');
    const workerSummary = summaries.find(s => s.worker_id === worker.id);
    assert.ok(workerSummary);
    assert.equal(workerSummary.present_days, 1);
    assert.equal(workerSummary.half_days, 1);
    assert.equal(workerSummary.absent_days, 1);
    assert.equal(workerSummary.total_earned, 900.00 + 450.00 + 225.00);
  });

  test('prevents accidental duplicate attendance records for the same worker, project and date', () => {
    const worker = labour.createWorker({
      name: 'Ravi S',
      trade: 'HELPER',
      dailyWage: 650.00
    });

    labour.recordAttendance({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      attendanceDate: '2026-10-25',
      status: 'PRESENT'
    });

    // Attempting to record again for same date without allowOverwrite must throw
    assert.throws(() => {
      labour.recordAttendance({
        workerId: worker.id,
        projectId: 'prj-lab-1',
        attendanceDate: '2026-10-25',
        status: 'HALF_DAY'
      });
    }, /Attendance already recorded/);

    // Updating with allowOverwrite: true succeeds
    const updated = labour.recordAttendance({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      attendanceDate: '2026-10-25',
      status: 'HALF_DAY',
      allowOverwrite: true
    });
    assert.equal(updated.status, 'HALF_DAY');
    assert.equal(updated.earned_amount, 325.00);
  });

  test('records advances and wage settlements, deducts bank account, and tracks ledger balance', () => {
    const worker = labour.createWorker({
      name: 'Anbu M',
      trade: 'BAR_BENDER',
      dailyWage: 1000.00
    });

    // 1. Worker takes a site cash advance of ₹1,500 on Monday
    const advance = labour.recordLabourPayment({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      accountId: 'acc-hdfc-current',
      paymentType: 'ADVANCE',
      amount: 1500.00,
      paymentMode: 'CASH',
      paymentDate: '2026-10-26',
      notes: 'Festival advance'
    });

    assert.equal(advance.amount, 1500.00);
    assert.equal(advance.paymentType, 'ADVANCE');

    // Bank balance should be deducted from 100,000 to 98,500
    const accRow1 = db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']);
    assert.equal(accRow1.current_balance, 98500.00);

    // Worker ledger should show outstanding advance (-1500)
    let ledger = labour.getWorkerLedger(worker.id);
    assert.equal(ledger.worker.stats.totalAdvances, 1500.00);
    assert.equal(ledger.worker.stats.totalEarned, 0.00);
    assert.equal(ledger.currentBalance, -1500.00);

    // 2. Worker works 3 days (₹1,000 x 3 = ₹3,000 earned)
    labour.recordAttendance({ workerId: worker.id, projectId: 'prj-lab-1', attendanceDate: '2026-10-26', status: 'PRESENT' });
    labour.recordAttendance({ workerId: worker.id, projectId: 'prj-lab-1', attendanceDate: '2026-10-27', status: 'PRESENT' });
    labour.recordAttendance({ workerId: worker.id, projectId: 'prj-lab-1', attendanceDate: '2026-10-28', status: 'PRESENT' });

    // Ledger should now show: Earned 3,000 - Advances 1,500 = Net Payable 1,500
    ledger = labour.getWorkerLedger(worker.id);
    assert.equal(ledger.worker.stats.totalEarned, 3000.00);
    assert.equal(ledger.worker.stats.totalAdvances, 1500.00);
    assert.equal(ledger.currentBalance, 1500.00);

    // 3. Disburse settlement wage payment of ₹1,500
    const settlement = labour.recordLabourPayment({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      accountId: 'acc-hdfc-current',
      paymentType: 'WAGE_PAYMENT',
      amount: 1500.00,
      paymentMode: 'BANK_TRANSFER',
      paymentDate: '2026-10-29',
      notes: 'Weekly wage settlement'
    });
    assert.equal(settlement.paymentType, 'WAGE_PAYMENT');

    // Bank balance should be deducted to 97,000
    const accRow2 = db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']);
    assert.equal(accRow2.current_balance, 97000.00);

    // Ledger should now show 0 net payable
    ledger = labour.getWorkerLedger(worker.id);
    assert.equal(ledger.worker.stats.totalPaid, 3000.00);
    assert.equal(ledger.currentBalance, 0.00);
  });

  test('voiding a labour payment refunds the bank balance and restores the worker ledger', () => {
    const worker = labour.createWorker({
      name: 'Vasu C',
      dailyWage: 800.00
    });

    const payment = labour.recordLabourPayment({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      accountId: 'acc-hdfc-current',
      paymentType: 'ADVANCE',
      amount: 2000.00,
      paymentDate: '2026-10-27'
    });

    assert.equal(db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']).current_balance, 98000.00);

    // Void the payment
    const voidResult = labour.voidLabourPayment(payment.paymentId, 'Wrong entry created');
    assert.equal(voidResult.success, true);

    // Balance refunded back to 100,000
    assert.equal(db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']).current_balance, 100000.00);

    // Worker ledger shows 0 advances
    const ledger = labour.getWorkerLedger(worker.id);
    assert.equal(ledger.worker.stats.totalAdvances, 0.00);
  });

  test('generates worker wage statement with chronological ledger integrity', () => {
    const worker = labour.createWorker({
      name: 'Dinesh P',
      trade: 'PAINTER',
      dailyWage: 850.00
    });

    labour.recordAttendance({ workerId: worker.id, projectId: 'prj-lab-1', attendanceDate: '2026-10-20', status: 'PRESENT' });
    labour.recordAttendance({ workerId: worker.id, projectId: 'prj-lab-1', attendanceDate: '2026-10-21', status: 'PRESENT', overtimeHours: 1 });
    labour.recordLabourPayment({
      workerId: worker.id,
      projectId: 'prj-lab-1',
      accountId: 'acc-hdfc-current',
      paymentType: 'ADVANCE',
      amount: 500.00,
      paymentDate: '2026-10-21'
    });

    const statement = labour.generateWageStatement(worker.id, {
      startDate: '2026-10-01',
      endDate: '2026-10-31'
    });

    assert.ok(statement.worker);
    assert.equal(statement.worker.name, 'Dinesh P');
    // Earned: 850 + 850 + (850 / 8 = 106.25) = 1806.25
    assert.equal(statement.summary.grossEarned, 1806.25);
    assert.equal(statement.summary.advancesPaid, 500.00);
    assert.ok(statement.ledger.length >= 3);
  });

  test('computes project-wise labour summary accurately', () => {
    const w1 = labour.createWorker({ name: 'Worker 1', dailyWage: 800 });
    const w2 = labour.createWorker({ name: 'Worker 2', dailyWage: 1000 });

    labour.recordAttendance({ workerId: w1.id, projectId: 'prj-lab-1', attendanceDate: '2026-10-20', status: 'PRESENT' });
    labour.recordAttendance({ workerId: w2.id, projectId: 'prj-lab-1', attendanceDate: '2026-10-20', status: 'PRESENT' });

    labour.recordLabourPayment({
      workerId: w1.id,
      projectId: 'prj-lab-1',
      accountId: 'acc-hdfc-current',
      paymentType: 'ADVANCE',
      amount: 400.00,
      paymentDate: '2026-10-20'
    });

    const summary = labour.getProjectLabourSummary('prj-lab-1');
    assert.equal(summary.wagesEarned, 1800.00);
    assert.equal(summary.advancesPaid, 400.00);
    assert.equal(summary.wagesOutstanding, 1400.00);
  });
});
