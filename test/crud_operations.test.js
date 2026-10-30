import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { BusinessApiRouter } from '../src/api/router.js';
import { FinancialService } from '../src/services/financialService.js';
import { QuotationService } from '../src/services/quotationService.js';
import { DocumentService } from '../src/services/documentService.js';

describe('DDevUltraHome — Comprehensive Entity CRUD & Double-Entry Accounting Audit', () => {
  let db;
  let runner;
  let router;
  let financialService;
  let quotationService;
  let documentService;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
    runner.runMigrations();
    financialService = new FinancialService(db);
    quotationService = new QuotationService(db);
    documentService = new DocumentService(db);
    router = new BusinessApiRouter(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('Projects: full lifecycle (Create, Read, Update, and Archive)', async () => {
    // 1. Create project
    const createRes = await router.handle('/api/business/projects', 'POST', {
      name: 'Tambaram Commercial Complex',
      client_id: 'cli-thiumani-01',
      site_address: '42 Mudichur Road, Tambaram West, Chennai',
      district: 'Chengalpattu',
      contract_value: 6500000,
      budgeted_cost: 5100000
    });
    assert.equal(createRes.status, 201);
    const prjId = createRes.data.project.id;

    // 2. Read single project
    const getRes = await router.handle(`/api/business/projects/${prjId}`, 'GET');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.project.name, 'Tambaram Commercial Complex');
    assert.equal(getRes.data.project.district, 'Chengalpattu');

    // 3. Update project details & stage
    const updateRes = await router.handle(`/api/business/projects/${prjId}`, 'PUT', {
      name: 'Tambaram Commercial Plaza',
      current_stage: 'RCC_FRAMING',
      contract_value: 6800000
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.project.name, 'Tambaram Commercial Plaza');
    assert.equal(updateRes.data.project.current_stage, 'RCC_FRAMING');
    assert.equal(updateRes.data.project.contract_value, 6800000);

    // 4. Archive project
    const delRes = await router.handle(`/api/business/projects/${prjId}`, 'DELETE');
    assert.equal(delRes.status, 200);

    // 5. Verify excluded from active projects list
    const listRes = await router.handle('/api/business/projects', 'GET');
    const found = listRes.data.projects.find(p => p.id === prjId);
    assert.equal(found, undefined, 'Archived project should not appear in active projects list');
  });

  test('Clients: full lifecycle (Create, Read, Update, and Archive)', async () => {
    // 1. Create client
    const createRes = await router.handle('/api/business/clients', 'POST', {
      name: 'Dr. K. Annamalai',
      company_name: 'Annamalai Ortho Care',
      phone: '+91 94441 23456',
      email: 'annamalai@example.com',
      billing_address: 'No. 12 Anna Salai, Guindy, Chennai',
      gstin: '33AABCA1234F1Z9',
      pan: 'AABCA1234F'
    });
    assert.equal(createRes.status, 201);
    const cliId = createRes.data.client.id;

    // 2. Read client list
    const listRes = await router.handle('/api/business/clients', 'GET');
    assert.equal(listRes.status, 200);
    const client = listRes.data.clients.find(c => c.id === cliId);
    assert.ok(client);
    assert.equal(client.company_name, 'Annamalai Ortho Care');

    // 3. Update client
    const updateRes = await router.handle(`/api/business/clients/${cliId}`, 'PUT', {
      phone: '+91 98400 55667',
      billing_address: 'No. 14 Anna Salai, Guindy, Chennai'
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.client.phone, '+91 98400 55667');
    assert.equal(updateRes.data.client.billing_address, 'No. 14 Anna Salai, Guindy, Chennai');

    // 4. Archive client
    const delRes = await router.handle(`/api/business/clients/${cliId}`, 'DELETE');
    assert.equal(delRes.status, 200);

    // 5. Verify excluded from active list
    const refreshed = await router.handle('/api/business/clients', 'GET');
    assert.equal(refreshed.data.clients.find(c => c.id === cliId), undefined);
  });

  test('Quotations: Create, Update draft line items, Recalculate totals, and Delete draft', async () => {
    // 1. Create quotation using valid category CIVIL
    const createRes = await router.handle('/api/business/quotations', 'POST', {
      clientId: 'cli-thiumani-01',
      projectId: 'prj-kun-01',
      title: 'Structural Steel Shed Estimate',
      taxRate: 18,
      items: [
        {
          itemCode: 'STL-01',
          description: 'MS Tubular Truss Fabrication',
          category: 'CIVIL',
          unit: 'kg',
          quantity: 2000,
          unitRate: 95,
          totalPrice: 190000
        }
      ]
    });
    assert.equal(createRes.status, 201);
    const qId = createRes.data.quotation.id;
    assert.equal(createRes.data.quotation.subtotal, 190000);
    assert.equal(createRes.data.quotation.tax_amount, 34200);
    assert.equal(createRes.data.quotation.total_amount, 224200);

    // 2. Update quotation line items
    const updateRes = await router.handle(`/api/business/quotations/${qId}`, 'PUT', {
      title: 'Structural Steel Shed & Roofing Estimate',
      taxRate: 18,
      items: [
        {
          itemCode: 'STL-01',
          description: 'MS Tubular Truss Fabrication',
          category: 'CIVIL',
          unit: 'kg',
          quantity: 2500,
          unitRate: 95,
          totalPrice: 237500
        },
        {
          itemCode: 'RF-01',
          description: 'Tata Bluescope Color Coated Roofing Sheets',
          category: 'OTHER',
          unit: 'sqft',
          quantity: 1200,
          unitRate: 65,
          totalPrice: 78000
        }
      ]
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.quotation.subtotal, 315500); // 237500 + 78000
    assert.equal(updateRes.data.quotation.tax_amount, 56790); // 18% of 315500
    assert.equal(updateRes.data.quotation.total_amount, 372290);

    // 3. Delete draft quotation
    const delRes = await router.handle(`/api/business/quotations/${qId}`, 'DELETE');
    assert.equal(delRes.status, 200);

    // 4. Verify quotation deleted
    const getRes = await router.handle(`/api/business/quotations/${qId}`, 'GET');
    assert.equal(getRes.status, 404);
  });

  test('Expenses: Record, Update, and Void with double-entry ledger refund', async () => {
    // Fund account first to verify strict liquidity control
    db.run('UPDATE financial_accounts SET current_balance = 100000.00 WHERE id = ?;', ['acc-hdfc-current']);
    const startBalance = 100000.00;

    // 1. Record expense of ₹45,000
    const expRes = await router.handle('/api/business/expenses', 'POST', {
      projectId: 'prj-kun-01',
      category: 'EQUIPMENT',
      amount: 45000,
      paidTo: 'L&T JCB Earthmovers Rental',
      expenseDate: '2026-04-05',
      accountId: 'acc-hdfc-current',
      paymentMode: 'BANK_TRANSFER',
      notes: 'Site excavation 3 days'
    });
    assert.equal(expRes.status, 201);
    const expId = expRes.data.expense.id;

    // Verify bank balance was deducted
    const afterDeduct = db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']);
    assert.equal(afterDeduct.current_balance, startBalance - 45000);

    // 2. Update expense fields (paid_to and notes)
    const updateRes = await router.handle(`/api/business/expenses/${expId}`, 'PUT', {
      paid_to: 'L&T JCB Earthmovers Pvt Ltd',
      notes: 'Site excavation 3 days (updated invoice #992)'
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.expense.paid_to, 'L&T JCB Earthmovers Pvt Ltd');

    // 3. Void expense (e.g. rental cancelled and refunded)
    const voidRes = await router.handle(`/api/business/expenses/${expId}/void`, 'POST', {
      reason: 'Earthwork cancelled due to unseasonal rain'
    });
    assert.equal(voidRes.status, 200);

    // 4. Verify financial account balance was refunded
    const finalAccount = db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']);
    assert.equal(finalAccount.current_balance, startBalance, 'Account balance must be restored to original balance');

    // 5. Verify reversing credit ledger entry was created
    const reversalTx = db.queryOne(`
      SELECT * FROM account_transactions 
      WHERE reference_id = ? AND transaction_type = 'CREDIT' AND notes LIKE '%Void expense%';
    `, [expId]);
    assert.ok(reversalTx, 'Reversing ledger transaction must exist');
    assert.equal(reversalTx.amount, 45000);

    // 6. Verify excluded from active expenses
    const listRes = await router.handle('/api/business/expenses', 'GET');
    assert.equal(listRes.data.expenses.find(e => e.id === expId), undefined);
  });

  test('Client Receipts: Record and Void with reversing debit ledger entry', async () => {
    const initialAccount = db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']);
    const startBalance = initialAccount.current_balance;

    // 1. Record receipt of ₹2,00,000
    const recRes = await router.handle('/api/business/income/receipts', 'POST', {
      projectId: 'prj-kun-01',
      clientId: 'cli-thiumani-01',
      amount: 200000,
      receiptDate: '2026-04-05',
      accountId: 'acc-hdfc-current',
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: 'UTR-TEST-889900',
      isAdvance: 1
    });
    assert.equal(recRes.status, 201);
    const recId = recRes.data.receipt.receiptId || recRes.data.receipt.id;

    // Verify balance was credited
    const afterCredit = db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']);
    assert.equal(afterCredit.current_balance, startBalance + 200000);

    // 2. Void receipt (e.g. cheque bounced or payment reversed)
    const voidRes = await router.handle(`/api/business/income/receipts/${recId}/void`, 'POST', {
      reason: 'Cheque dishonoured by issuing bank'
    });
    assert.equal(voidRes.status, 200);

    // 3. Verify balance was deducted back to original
    const finalAccount = db.queryOne('SELECT current_balance FROM financial_accounts WHERE id = ?;', ['acc-hdfc-current']);
    assert.equal(finalAccount.current_balance, startBalance);

    // 4. Verify reversing debit ledger entry
    const reversalTx = db.queryOne(`
      SELECT * FROM account_transactions 
      WHERE reference_id = ? AND transaction_type = 'DEBIT' AND notes LIKE '%Void receipt%';
    `, [recId]);
    assert.ok(reversalTx);
    assert.equal(reversalTx.amount, 200000);

    // 5. Verify excluded from active receipts list
    const listRes = await router.handle('/api/business/income/receipts', 'GET');
    assert.equal(listRes.data.receipts.find(r => r.id === recId), undefined);
  });

  test('Suppliers & Invoices: Create, Update, Archive vendor and Void unpaid bill', async () => {
    // 1. Create supplier
    const supRes = await router.handle('/api/business/suppliers', 'POST', {
      name: 'Kavitha Blue Metal Quarries',
      category: 'AGGREGATES',
      contactPerson: 'Mr. Saravanan',
      phone: '+91 98402 33445',
      gstin: '33AABCK9988Z1Z2'
    });
    assert.equal(supRes.status, 201);
    const supId = supRes.data.supplier.id;

    // 2. Update supplier
    const supUpdate = await router.handle(`/api/business/suppliers/${supId}`, 'PUT', {
      phone: '+91 98402 99999'
    });
    assert.equal(supUpdate.status, 200);
    assert.equal(supUpdate.data.supplier.phone, '+91 98402 99999');

    // 3. Log bill of ₹80,000
    const invRes = await router.handle('/api/business/suppliers/invoices', 'POST', {
      supplierId: supId,
      projectId: 'prj-kun-01',
      invoiceNumber: 'INV-BLU-1002',
      invoiceDate: '2026-04-05',
      dueDate: '2026-04-20',
      subtotal: 80000,
      taxAmount: 0,
      totalAmount: 80000,
      notes: '400 cuft 20mm Blue Metal aggregate'
    });
    assert.equal(invRes.status, 201);
    const invId = invRes.data.invoice.invoiceId || invRes.data.invoice.id;

    // Verify supplier dues increased
    const supWithDues = db.queryOne('SELECT current_dues FROM suppliers WHERE id = ?;', [supId]);
    assert.equal(supWithDues.current_dues, 80000);

    // 4. Void unpaid bill (e.g. wrong quarry bill uploaded)
    const voidInv = await router.handle(`/api/business/suppliers/invoices/${invId}/void`, 'POST', {
      reason: 'Billed to incorrect construction firm'
    });
    assert.equal(voidInv.status, 200);

    // Verify dues reversed back to 0
    const supAfterVoid = db.queryOne('SELECT current_dues FROM suppliers WHERE id = ?;', [supId]);
    assert.equal(supAfterVoid.current_dues, 0);

    // 5. Archive vendor
    const delSup = await router.handle(`/api/business/suppliers/${supId}`, 'DELETE');
    assert.equal(delSup.status, 200);
    const activeSups = await router.handle('/api/business/suppliers', 'GET');
    assert.equal(activeSups.data.suppliers.find(s => s.id === supId), undefined);
  });

  test('Milestones & Daily Progress Reports (DPR): Create, Update/Certify, and Delete', async () => {
    // 1. Create milestone
    const msRes = await router.handle('/api/business/milestones', 'POST', {
      projectId: 'prj-kun-01',
      title: 'Plinth Beam Casting & Curing',
      milestoneCode: 'MS-PLINTH',
      description: 'Plinth beam formwork, rebar layout, M25 concrete casting and 7 days pond curing',
      sequenceOrder: 2,
      targetPercentage: 10,
      invoicePercentage: 10,
      invoiceAmount: 422740
    });
    assert.equal(msRes.status, 201);
    const msId = msRes.data.milestone.id;

    // 2. Update / Certify milestone
    const patchMs = await router.handle(`/api/business/milestones/${msId}`, 'PATCH', {
      status: 'IN_PROGRESS',
      target_percentage: 60
    });
    assert.equal(patchMs.status, 200);
    assert.equal(patchMs.data.milestone.status, 'IN_PROGRESS');
    assert.equal(patchMs.data.milestone.target_percentage, 60);

    // 3. Create Daily Progress Report (DPR)
    const dprRes = await router.handle('/api/business/progress', 'POST', {
      projectId: 'prj-kun-01',
      milestoneId: msId,
      reportDate: '2026-04-06',
      stageCompletionPercentage: 60,
      workforceCount: 16,
      weatherCondition: 'Sunny / Dry (Clear Sky)',
      workNotes: 'Plinth shuttering completed, cover blocks installed, pouring scheduled for 2 PM.',
      recordedBy: 'usr-sitemanager-1'
    });
    assert.equal(dprRes.status, 201);
    const dprId = dprRes.data.progress.id;

    // 4. Verify progress appears in project diary
    const diaryRes = await router.handle('/api/business/progress?projectId=prj-kun-01', 'GET');
    assert.ok(diaryRes.data.progress.some(p => p.id === dprId));

    // 5. Delete DPR entry
    const delDpr = await router.handle(`/api/business/progress/${dprId}`, 'DELETE');
    assert.equal(delDpr.status, 200);

    // 6. Delete milestone
    const delMs = await router.handle(`/api/business/milestones/${msId}`, 'DELETE');
    assert.equal(delMs.status, 200);
  });

  test('Documents: Upload, Register with SHA-256 hash, and Soft-delete with audit', async () => {
    // 1. Create document
    const docRes = await router.handle('/api/business/documents', 'POST', {
      projectId: 'prj-kun-01',
      documentType: 'DRAWING',
      fileName: 'Structural_Column_Reinforcement_Detail.dwg.pdf',
      filePath: '/storage/drawings/Structural_Column.pdf',
      fileSize: 450200,
      mimeType: 'application/pdf',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      createdBy: 'usr-sitemanager-1'
    });
    assert.equal(docRes.status, 201);
    const docId = docRes.data.document.id;

    // 2. Read documents list
    const docsList = await router.handle('/api/business/documents', 'GET');
    assert.ok(docsList.data.documents.some(d => d.id === docId));

    // 3. Soft-delete document
    const delRes = await router.handle(`/api/business/documents/${docId}`, 'DELETE', {}, {}, { user: { id: 'usr-owner-1' } });
    assert.equal(delRes.status, 200);

    // 4. Verify soft-deleted from active vault
    const refreshed = await router.handle('/api/business/documents', 'GET');
    assert.equal(refreshed.data.documents.find(d => d.id === docId), undefined);

    // 5. Verify audit log was recorded
    const audit = db.queryOne('SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? AND action = ?;', ['DOCUMENT', docId, 'DELETE']);
    assert.ok(audit, 'Audit log must record document deletion');
  });
});
