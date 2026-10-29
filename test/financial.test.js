import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { FinancialService } from '../src/services/financialService.js';

describe('DDevUltraHome Financial Accounting & Integrity Controls', () => {
  let db;
  let finance;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    const runner = new MigrationRunner(db);
    runner.runMigrations();
    finance = new FinancialService(db);

    // Setup basic test entities
    db.run(`
      INSERT INTO clients (id, name, phone, email) 
      VALUES ('cli-1', 'Thiru. Rajesh', '+91 98840 12345', 'rajesh@example.com');
    `);

    db.run(`
      INSERT INTO projects (id, project_code, name, client_id, site_address, contract_value, budgeted_cost, status)
      VALUES ('prj-1', 'PRJ-2026-001', 'Guindy Luxury Villa', 'cli-1', 'Velachery, Chennai', 5000000.00, 4200000.00, 'ACTIVE');
    `);

    db.run(`
      INSERT INTO milestones (id, project_id, milestone_code, title, target_percentage, invoice_percentage, invoice_amount, status)
      VALUES ('mls-1', 'prj-1', 'M-01', 'Foundation & Plinth Completion', 20.00, 20.00, 1000000.00, 'COMPLETED');
    `);

    db.run(`
      INSERT INTO suppliers (id, name, phone, category, current_dues)
      VALUES ('sup-1', 'Tirumala ReadyMix & Aggregates', '+91 98400 99999', 'RMC', 0.00);
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('rule: client advance is recorded as unearned liability and NOT treated as profit', () => {
    // Client pays 10% advance (₹5,00,000)
    const receipt = finance.recordClientReceipt({
      projectId: 'prj-1',
      clientId: 'cli-1',
      amount: 500000.00,
      paymentMode: 'NEFT_RTGS',
      referenceNumber: 'HDFC987654321',
      receiptDate: '2026-10-25',
      accountId: 'acc-hdfc-current',
      isAdvance: 1,
      notes: 'Initial mobilization advance'
    });

    assert.equal(receipt.isAdvance, true);
    assert.equal(receipt.amount, 500000.00);
    assert.equal(receipt.unallocatedBalance, 500000.00);
    assert.equal(receipt.newAccountBalance, 500000.00);

    // Check Project P&L: Earned revenue MUST be 0.00, not ₹5,00,000!
    const pnl = finance.getProjectPnL('prj-1');
    assert.equal(pnl.financials.totalCashReceived, 500000.00, 'Cash was received');
    assert.equal(pnl.financials.unearnedAdvanceLiability, 500000.00, 'Full advance is unearned liability');
    assert.equal(pnl.financials.earnedRevenue, 0.00, 'Advance is NOT earned revenue');
    assert.equal(pnl.financials.operatingProfit, 0.00, 'Profit must be zero');
  });

  test('rule: allocating advance to completed milestone recognizes earned revenue', () => {
    // 1. Receive Advance ₹5,00,000
    const receipt = finance.recordClientReceipt({
      projectId: 'prj-1',
      clientId: 'cli-1',
      amount: 500000.00,
      paymentMode: 'BANK_TRANSFER',
      accountId: 'acc-hdfc-current',
      isAdvance: 1
    });

    // 2. Allocate ₹3,00,000 towards completed foundation milestone
    const allocation = finance.allocateAdvanceToMilestone(receipt.receiptId, 'mls-1', 300000.00);
    assert.equal(allocation.allocatedAmount, 300000.00);
    assert.equal(allocation.remainingAdvanceBalance, 200000.00);

    // 3. Now P&L should reflect exactly ₹3,00,000 as earned revenue
    const pnl = finance.getProjectPnL('prj-1');
    assert.equal(pnl.financials.earnedRevenue, 300000.00, 'Recognized earned revenue from milestone');
    assert.equal(pnl.financials.unearnedAdvanceLiability, 200000.00, 'Remaining ₹2,00,000 stays as liability');
    assert.equal(pnl.financials.operatingProfit, 300000.00);
  });

  test('rule: unpaid supplier invoice creates accounts payable without deducting cash', () => {
    // Seed initial bank balance ₹1,00,000
    db.run("UPDATE financial_accounts SET current_balance = 100000.00 WHERE id = 'acc-hdfc-current';");

    // Supplier raises invoice for RMC concrete ₹1,50,000
    const invoice = finance.recordSupplierInvoice({
      invoiceNumber: 'INV-TRM-889',
      supplierId: 'sup-1',
      projectId: 'prj-1',
      invoiceDate: '2026-10-26',
      totalAmount: 150000.00,
      notes: 'M25 grade concrete for footing'
    });

    assert.equal(invoice.totalAmount, 150000.00);
    assert.equal(invoice.paymentStatus, 'UNPAID');
    assert.equal(invoice.supplierCurrentDues, 150000.00);

    // Bank balance MUST NOT have changed!
    const account = db.queryOne("SELECT current_balance FROM financial_accounts WHERE id = 'acc-hdfc-current';");
    assert.equal(account.current_balance, 100000.00, 'Unpaid invoice must NOT deduct cash');

    // Executive summary must show Accounts Payable = ₹1,50,000
    const summary = finance.getExecutiveDashboardSummary();
    assert.equal(summary.accountsPayable, 150000.00);
  });

  test('rule: supplier payment deducts from bank account and updates payables', () => {
    // Bank balance ₹5,00,000
    db.run("UPDATE financial_accounts SET current_balance = 500000.00 WHERE id = 'acc-hdfc-current';");

    const invoice = finance.recordSupplierInvoice({
      invoiceNumber: 'INV-TRM-889',
      supplierId: 'sup-1',
      projectId: 'prj-1',
      totalAmount: 150000.00
    });

    // Pay ₹1,00,000 partial payment
    const payment = finance.recordSupplierPayment({
      supplierId: 'sup-1',
      invoiceId: invoice.invoiceId,
      projectId: 'prj-1',
      accountId: 'acc-hdfc-current',
      amount: 100000.00,
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: 'HDFC-PAY-44321'
    });

    assert.equal(payment.amount, 100000.00);
    assert.equal(payment.newAccountBalance, 400000.00, 'Bank balance reduced by payment amount');
    assert.equal(payment.supplierCurrentDues, 50000.00, 'Remaining dues is ₹50,000');

    // Invoice status should now be PARTIALLY_PAID
    const updatedInv = db.queryOne('SELECT balance_amount, payment_status FROM supplier_invoices WHERE id = ?;', [invoice.invoiceId]);
    assert.equal(updatedInv.balance_amount, 50000.00);
    assert.equal(updatedInv.payment_status, 'PARTIALLY_PAID');
  });

  test('rule: insufficient account balance blocks outgoing payment', () => {
    // Account has ₹10,000
    db.run("UPDATE financial_accounts SET current_balance = 10000.00 WHERE id = 'acc-hdfc-current';");

    assert.throws(() => {
      // Trying to pay ₹25,000
      finance.recordExpense({
        projectId: 'prj-1',
        category: 'LABOUR',
        amount: 25000.00,
        paidTo: 'Site Masons Guild',
        paymentMode: 'BANK_TRANSFER',
        accountId: 'acc-hdfc-current'
      });
    }, /Insufficient funds/i);
  });
});
