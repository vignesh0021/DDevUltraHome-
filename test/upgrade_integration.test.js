import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { QuotationService } from '../src/services/quotationService.js';
import { FinancialService } from '../src/services/financialService.js';
import { BusinessApiRouter } from '../src/api/router.js';

describe('DDevUltraHome — Upgrade Integration & System Integrity', () => {
  let db;
  let quoteService;
  let finance;
  let router;
  const ownerContext = { user: { id: 'usr-owner-1', role: 'OWNER' } };

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    const runner = new MigrationRunner(db);
    runner.runMigrations();
    quoteService = new QuotationService(db);
    finance = new FinancialService(db);
    router = new BusinessApiRouter(db);

    // Setup client
    db.run(`
      INSERT INTO clients (id, name, phone, email, billing_address)
      VALUES ('cli-int-1', 'Thiru. Annamalai', '+91 98402 33333', 'annamalai@example.com', 'Porur, Chennai');
    `);

    // Fund account
    db.run(`
      UPDATE financial_accounts SET current_balance = 100000.00 WHERE id = 'acc-hdfc-current';
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('converts approved quotation to project without creating duplicate income or transactions', () => {
    // 1. Create a draft quotation
    const quote = quoteService.createQuotation({
      clientId: 'cli-int-1',
      title: 'Porur Villa Construction Estimate',
      items: [
        { itemType: 'CIVIL_WORK', description: 'Foundation & Earthwork', unit: 'sqft', quantity: 1500, unitRate: 450 },
        { itemType: 'CIVIL_WORK', description: 'RCC Superstructure M25', unit: 'sqft', quantity: 1500, unitRate: 1200 }
      ],
      taxRate: 18,
      termsAndConditions: 'Standard Tamil Nadu Construction terms'
    });

    assert.equal(quote.status, 'DRAFT');
    const initialQuoteTotal = quote.total_amount;

    // 2. Approve quotation
    const approved = quoteService.updateStatus(quote.id, 'APPROVED');
    assert.equal(approved.status, 'APPROVED');

    // Baseline count of transactions and receipts
    const initialReceiptCount = db.queryOne('SELECT COUNT(*) as cnt FROM client_receipts;').cnt;
    const initialTxnCount = db.queryOne('SELECT COUNT(*) as cnt FROM account_transactions;').cnt;

    // 3. Convert quotation to project
    const project = quoteService.convertQuotationToProject(quote.id);

    assert.ok(project);
    assert.equal(project.contract_value, initialQuoteTotal);
    assert.equal(project.name, 'Porur Villa Construction Estimate');

    // Quotation status must now be CONVERTED
    const updatedQuote = quoteService.getQuotationById(quote.id);
    assert.equal(updatedQuote.status, 'CONVERTED');
    assert.equal(updatedQuote.project_id, project.id);

    // CRITICAL INTEGRITY CHECK: No duplicate receipts or transactions created
    const finalReceiptCount = db.queryOne('SELECT COUNT(*) as cnt FROM client_receipts;').cnt;
    const finalTxnCount = db.queryOne('SELECT COUNT(*) as cnt FROM account_transactions;').cnt;
    assert.equal(finalReceiptCount, initialReceiptCount, 'Quotation conversion must not create unearned receipt records');
    assert.equal(finalTxnCount, initialTxnCount, 'Quotation conversion must not create artificial account ledger transactions');

    // Calling convertQuotationToProject again on already converted returns existing without creating new project
    const again = quoteService.convertQuotationToProject(quote.id);
    assert.equal(again.id, project.id);
  });

  test('router supports quotation conversion endpoint POST /quotations/:id/convert-to-project', async () => {
    const quote = quoteService.createQuotation({
      clientId: 'cli-int-1',
      title: 'Maduravoyal Commercial Store',
      items: [{ itemType: 'CIVIL_WORK', description: 'Brickwork', unit: 'sqft', quantity: 500, unitRate: 800 }]
    });
    quoteService.updateStatus(quote.id, 'APPROVED');

    const res = await router.handle(`/quotations/${quote.id}/convert-to-project`, 'POST', {
      siteAddress: 'Maduravoyal Bypass Rd',
      district: 'Chennai'
    }, {}, ownerContext);

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.id);

    const updatedQuote = quoteService.getQuotationById(quote.id);
    assert.equal(updatedQuote.status, 'CONVERTED');
  });

  test('router handles receipt update and deletion with bank balance reconciliation', async () => {
    // 1. Record receipt of ₹50,000 (Bank balance goes from 100k to 150k)
    const recRes = await router.handle('/income/receipts', 'POST', {
      clientId: 'cli-int-1',
      amount: 50000,
      paymentMode: 'CASH',
      receiptDate: '2026-10-25',
      accountId: 'acc-hdfc-current',
      isAdvance: 1,
      notes: 'Initial client deposit'
    }, {}, ownerContext);
    assert.equal(recRes.status, 201);
    const recId = recRes.data.receipt.receiptId;

    const accAfterCreate = db.queryOne("SELECT current_balance FROM financial_accounts WHERE id = 'acc-hdfc-current';");
    assert.equal(accAfterCreate.current_balance, 150000.00);

    // 2. Update receipt amount from ₹50,000 to ₹70,000 (Difference +20k -> Bank balance 170k)
    const updateRes = await router.handle(`/income/receipts/${recId}`, 'PUT', {
      amount: 70000,
      notes: 'Updated client deposit'
    }, {}, ownerContext);
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.success, true);

    const accAfterUpdate = db.queryOne("SELECT current_balance FROM financial_accounts WHERE id = 'acc-hdfc-current';");
    assert.equal(accAfterUpdate.current_balance, 170000.00);

    // 3. Delete/Void receipt (Refunds 70k back out of bank -> Bank balance 100k)
    const delRes = await router.handle(`/income/receipts/${recId}`, 'DELETE', {
      reason: 'Cancelled by accountant'
    }, {}, ownerContext);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.success, true);

    const accAfterDelete = db.queryOne("SELECT current_balance FROM financial_accounts WHERE id = 'acc-hdfc-current';");
    assert.equal(accAfterDelete.current_balance, 100000.00);
  });

  test('router handles expense deletion and restores bank balance', async () => {
    // 1. Record an expense of ₹25,000 (Bank balance goes from 100k to 75k)
    const expRes = await router.handle('/expenses', 'POST', {
      category: 'TRANSPORT',
      amount: 25000,
      paidTo: 'Site Lorry Transport',
      paymentMode: 'CASH',
      expenseDate: '2026-10-25',
      accountId: 'acc-hdfc-current',
      notes: 'Cement transport'
    }, {}, ownerContext);
    assert.equal(expRes.status, 201);
    const expId = expRes.data.expense.id;

    assert.equal(db.queryOne("SELECT current_balance FROM financial_accounts WHERE id = 'acc-hdfc-current';").current_balance, 75000.00);

    // 2. Delete expense (Restores ₹25,000 back to bank -> 100k)
    const delRes = await router.handle(`/expenses/${expId}`, 'DELETE', {
      reason: 'Duplicate voucher'
    }, {}, ownerContext);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.success, true);

    assert.equal(db.queryOne("SELECT current_balance FROM financial_accounts WHERE id = 'acc-hdfc-current';").current_balance, 100000.00);
  });

  test('unassigned transactions safely associate with prj-business-overhead', async () => {
    // Receipt without project_id
    const recRes = await router.handle('/income/receipts', 'POST', {
      clientId: 'cli-int-1',
      amount: 10000,
      paymentMode: 'BANK_TRANSFER',
      receiptDate: '2026-10-25',
      accountId: 'acc-hdfc-current',
      notes: 'General retainer'
    }, {}, ownerContext);
    assert.equal(recRes.status, 201);

    const rec = db.queryOne('SELECT * FROM client_receipts WHERE id = ?;', [recRes.data.receipt.receiptId]);
    assert.equal(rec.project_id, 'prj-business-overhead');

    // Expense without project_id
    const expRes = await router.handle('/expenses', 'POST', {
      category: 'RENT',
      amount: 15000,
      paidTo: 'Office Landlord',
      paymentMode: 'BANK_TRANSFER',
      expenseDate: '2026-10-25',
      accountId: 'acc-hdfc-current',
      notes: 'Head office rent'
    }, {}, ownerContext);
    assert.equal(expRes.status, 201);

    const exp = db.queryOne('SELECT * FROM expenses WHERE id = ?;', [expRes.data.expense.id]);
    assert.equal(exp.project_id, 'prj-business-overhead');
  });
});
