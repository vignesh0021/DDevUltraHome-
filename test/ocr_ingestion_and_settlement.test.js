import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { DocumentService } from '../src/services/documentService.js';
import { FinancialService } from '../src/services/financialService.js';
import { BusinessApiRouter } from '../src/api/router.js';

describe('DDevUltraHome — OCR Bill Ingestion & Supplier Payables Settlement Wizard', () => {
  let db;
  let runner;
  let docService;
  let financialService;
  let router;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
    runner.migrate();
    docService = new DocumentService(db);
    financialService = new FinancialService(db);
    router = new BusinessApiRouter(db);

    // Seed test bank balance of ₹5,00,000 for settlement tests
    db.run("UPDATE financial_accounts SET current_balance = 500000.00 WHERE id = 'acc-hdfc-current';");
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('rule: registers bill document with SHA-256 hash and dynamic D DEV ULTRA HOMES watermark', () => {
    const billBuffer = Buffer.from('Official Tax Invoice: Chennai TMT Traders - 2.5 Tons Fe550D TMT Steel');
    const doc = docService.registerDocument({
      projectId: 'prj-kun-01',
      documentType: 'INVOICE',
      fileName: 'Chennai_TMT_Bill_9921.pdf',
      filePath: '/storage/uploads/Chennai_TMT_Bill_9921.pdf',
      fileSize: billBuffer.length,
      mimeType: 'application/pdf',
      buffer: billBuffer,
      createdBy: 'usr-sitemanager-1'
    });

    assert.ok(doc.id.startsWith('doc_'));
    assert.equal(doc.file_name, 'Chennai_TMT_Bill_9921.pdf');
    assert.equal(doc.sha256_hash.length, 64, 'SHA-256 hex string must be exactly 64 characters');
    assert.ok(doc.watermark_text.includes('D DEV ULTRA HOMES — CONFIDENTIAL'));
    assert.equal(doc.ocr_status, 'PENDING');

    // Watermark SVG generation
    const svg = docService.generateWatermarkSvg({
      companyName: 'D DEV ULTRA HOMES',
      tagline: 'Building your dreams',
      notice: 'CONFIDENTIAL & PROPRIETARY'
    });
    assert.ok(svg.includes('D DEV ULTRA HOMES'));
    assert.ok(svg.includes('BUILDING YOUR DREAMS'));
    assert.ok(svg.includes('<svg'));
  });

  test('rule: OCR extraction creates an UNVERIFIED review gate and posts zero financial entries', () => {
    const doc = docService.registerDocument({
      projectId: 'prj-kun-01',
      documentType: 'INVOICE',
      fileName: 'UltraTech_Cement_Bill_504.jpg',
      filePath: '/storage/uploads/UltraTech_Cement_Bill_504.jpg',
      fileSize: 52000,
      mimeType: 'image/jpeg',
      createdBy: 'usr-sitemanager-1'
    });

    const rawBillText = `
      ULTRATECH CEMENT DEPOT
      Tax Invoice No: INV-UTC-504
      Date: 2026-10-25
      Particulars: OPC 53 Grade Cement 100 Bags
      Subtotal: 38,000.00
      GST (28%): 10,640.00
      Total: 48,640.00
    `;

    const ocrReview = docService.processOcrExtraction({
      documentId: doc.id,
      rawText: rawBillText,
      createdBy: 'usr-sitemanager-1'
    });

    assert.ok(ocrReview.id.startsWith('ocr_'));
    assert.equal(ocrReview.verification_status, 'UNVERIFIED');
    assert.equal(ocrReview.extractedFields.invoiceNumber, 'INV-UTC-504');
    assert.equal(ocrReview.extractedFields.date, '2026-10-25');
    assert.equal(ocrReview.extractedFields.totalAmount, 48640.00);

    // Verify ZERO financial records created automatically
    const invCount = db.queryOne('SELECT COUNT(*) as cnt FROM supplier_invoices WHERE invoice_number = ?;', ['INV-UTC-504']).cnt;
    assert.equal(invCount, 0, 'No supplier invoice must exist before human verification');
  });

  test('rule: unauthorized role (SITE_MANAGER) is blocked from verifying OCR financial records', () => {
    const doc = docService.registerDocument({
      projectId: 'prj-kun-01',
      documentType: 'INVOICE',
      fileName: 'Hardware_Bill_101.jpg',
      filePath: '/storage/uploads/Hardware_Bill_101.jpg',
      fileSize: 32000,
      mimeType: 'image/jpeg',
      createdBy: 'usr-sitemanager-1'
    });

    const review = docService.processOcrExtraction({
      documentId: doc.id,
      rawText: 'Total: 5000.00',
      createdBy: 'usr-sitemanager-1'
    });

    assert.throws(() => {
      docService.humanVerifyOcrTransaction({
        reviewId: review.id,
        userId: 'usr-sitemanager-1',
        userRole: 'SITE_MANAGER',
        action: 'CONFIRMED',
        verifiedFields: { totalAmount: 5000.00 },
        financialService,
        financialAction: 'EXPENSE'
      });
    }, /Unauthorized.*SITE_MANAGER.*Requires OWNER or ACCOUNTANT/i);
  });

  test('rule: human verification by Owner/Accountant creates verified supplier invoice in Accounts Payable', () => {
    // Register supplier
    db.run(`
      INSERT OR IGNORE INTO suppliers (id, name, category, phone, current_dues)
      VALUES ('sup-tmt-01', 'Chennai TMT Traders', 'STEEL', '+91 94440 99887', 0.00);
    `);

    const doc = docService.registerDocument({
      projectId: 'prj-kun-01',
      documentType: 'INVOICE',
      fileName: 'TMT_Steel_Tax_Invoice_9921.pdf',
      filePath: '/storage/uploads/TMT_Steel_Tax_Invoice_9921.pdf',
      fileSize: 154000,
      mimeType: 'application/pdf',
      createdBy: 'usr-sitemanager-1'
    });

    const review = docService.processOcrExtraction({
      documentId: doc.id,
      rawText: 'Tax Invoice No: INV-TMT-9921\nDate: 2026-10-25\nTotal: 159,300.00',
      createdBy: 'usr-sitemanager-1'
    });

    // Human verification by Accountant
    const verification = docService.humanVerifyOcrTransaction({
      reviewId: review.id,
      userId: 'usr-accountant-1',
      userRole: 'ACCOUNTANT',
      action: 'CONFIRMED',
      verifiedFields: {
        invoiceNumber: 'INV-TMT-9921',
        totalAmount: 159300.00,
        taxAmount: 24300.00,
        date: '2026-10-25',
        supplierId: 'sup-tmt-01',
        projectId: 'prj-kun-01'
      },
      notes: 'Physical weighbridge slip and steel test certificate verified',
      financialService,
      financialAction: 'SUPPLIER_INVOICE'
    });

    assert.equal(verification.review.verification_status, 'CONFIRMED');
    assert.equal(verification.financialRecord.paymentStatus, 'UNPAID');
    assert.equal(verification.financialRecord.totalAmount, 159300.00);
    assert.equal(verification.financialRecord.supplierCurrentDues, 159300.00);

    // Bank balance must remain strictly ₹5,00,000 (not reduced)
    const acc = db.queryOne("SELECT current_balance FROM financial_accounts WHERE id = 'acc-hdfc-current';");
    assert.equal(acc.current_balance, 500000.00, 'Unpaid invoice creates Accounts Payable without deducting cash');
  });

  test('rule: Settle Dues wizard disburses payment, deducts bank balance, reduces dues, and reconciles invoice', () => {
    // 1. Setup Supplier & Invoice
    db.run(`
      INSERT OR IGNORE INTO suppliers (id, name, category, phone, current_dues)
      VALUES ('sup-rmc-01', 'Velachery ReadyMix Depot', 'RMC', '+91 98402 55667', 0.00);
    `);

    const inv = financialService.recordSupplierInvoice({
      invoiceNumber: 'INV-RMC-2026',
      supplierId: 'sup-rmc-01',
      projectId: 'prj-kun-01',
      invoiceDate: '2026-10-20',
      totalAmount: 200000.00,
      notes: 'M25 grade concrete for Kundrathur roof slab'
    });

    assert.equal(inv.supplierCurrentDues, 200000.00);

    // 2. Disburse partial settlement of ₹1,20,000 from HDFC Bank Account (current balance ₹5,00,000)
    const partialPayment = financialService.recordSupplierPayment({
      supplierId: 'sup-rmc-01',
      invoiceId: inv.invoiceId,
      projectId: 'prj-kun-01',
      accountId: 'acc-hdfc-current',
      amount: 120000.00,
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: 'UTR-HDFC-889911',
      paymentDate: '2026-10-26',
      notes: 'Stage 1 slab concrete partial disbursal'
    });

    assert.equal(partialPayment.amount, 120000.00);
    assert.equal(partialPayment.newAccountBalance, 380000.00, 'Bank balance debited ₹1,20,000 -> ₹3,80,000');
    assert.equal(partialPayment.supplierCurrentDues, 80000.00, 'Supplier dues reduced to ₹80,000');

    // Check invoice status: PARTIALLY_PAID
    const invCheck1 = db.queryOne('SELECT balance_amount, payment_status FROM supplier_invoices WHERE id = ?;', [inv.invoiceId]);
    assert.equal(invCheck1.balance_amount, 80000.00);
    assert.equal(invCheck1.payment_status, 'PARTIALLY_PAID');

    // 3. Disburse remaining ₹80,000 settlement to clear invoice in full
    const finalPayment = financialService.recordSupplierPayment({
      supplierId: 'sup-rmc-01',
      invoiceId: inv.invoiceId,
      projectId: 'prj-kun-01',
      accountId: 'acc-hdfc-current',
      amount: 80000.00,
      paymentMode: 'UPI',
      referenceNumber: 'UPI-774422',
      paymentDate: '2026-10-27',
      notes: 'Final settlement for M25 concrete'
    });

    assert.equal(finalPayment.newAccountBalance, 300000.00);
    assert.equal(finalPayment.supplierCurrentDues, 0.00, 'Supplier dues cleared in full');

    // Check invoice status: PAID
    const invCheck2 = db.queryOne('SELECT balance_amount, payment_status FROM supplier_invoices WHERE id = ?;', [inv.invoiceId]);
    assert.equal(invCheck2.balance_amount, 0.00);
    assert.equal(invCheck2.payment_status, 'PAID');
  });

  test('rule: Settle Dues wizard blocks payment when bank account has insufficient funds', () => {
    db.run(`
      INSERT OR IGNORE INTO suppliers (id, name, category, phone, current_dues)
      VALUES ('sup-tiles-01', 'Kag Tiles Depot', 'OTHER', '+91 94450 11223', 0.00);
    `);

    // Only ₹5,000 in petty cash
    db.run("UPDATE financial_accounts SET current_balance = 5000.00 WHERE id = 'acc-site-petty-cash';");

    assert.throws(() => {
      financialService.recordSupplierPayment({
        supplierId: 'sup-tiles-01',
        projectId: 'prj-kun-01',
        accountId: 'acc-site-petty-cash',
        amount: 25000.00, // Attempting ₹25,000 from ₹5,000 balance
        paymentMode: 'CASH'
      });
    }, /Insufficient funds.*balance ₹5000 is less than payment ₹25000/i);
  });

  test('rule: BusinessApiRouter handles full REST lifecycle for documents, OCR, and supplier settlement', async () => {
    // 1. POST /api/business/documents
    const docPost = await router.handle('/api/business/documents', 'POST', {
      projectId: 'prj-kun-01',
      documentType: 'INVOICE',
      fileName: 'Plumbing_Pipes_Bill.pdf',
      filePath: '/storage/uploads/Plumbing_Pipes_Bill.pdf',
      fileSize: 48000,
      mimeType: 'application/pdf',
      createdBy: 'usr-sitemanager-1'
    });
    assert.equal(docPost.status, 201);
    assert.ok(docPost.data.document.id);

    // 2. POST /api/business/ocr/extract
    const ocrPost = await router.handle('/api/business/ocr/extract', 'POST', {
      documentId: docPost.data.document.id,
      rawText: 'Tax Invoice: INV-PLM-77\nTotal: 18500.00\nDate: 2026-10-25'
    });
    assert.equal(ocrPost.status, 201);
    assert.equal(ocrPost.data.review.verification_status, 'UNVERIFIED');

    // 3. GET /api/business/ocr/reviews
    const ocrGet = await router.handle('/api/business/ocr/reviews', 'GET', null);
    assert.equal(ocrGet.status, 200);
    assert.ok(ocrGet.data.reviews.length >= 1);

    // 4. POST /api/business/ocr/verify (Human verification by Accountant)
    db.run("INSERT OR IGNORE INTO suppliers (id, name, category, phone) VALUES ('sup-plm-01', 'Parryware Plumbing Store', 'PLUMBING', '+91 98401 77889');");

    const verifyPost = await router.handle('/api/business/ocr/verify', 'POST', {
      reviewId: ocrPost.data.review.id,
      userId: 'usr-accountant-1',
      userRole: 'ACCOUNTANT',
      action: 'CONFIRMED',
      verifiedFields: {
        invoiceNumber: 'INV-PLM-77',
        totalAmount: 18500.00,
        supplierId: 'sup-plm-01',
        projectId: 'prj-kun-01',
        date: '2026-10-25'
      },
      notes: 'Verified plumbing materials against bill',
      financialAction: 'SUPPLIER_INVOICE'
    });
    assert.equal(verifyPost.status, 200);
    assert.equal(verifyPost.data.review.verification_status, 'CONFIRMED');

    // 5. GET /api/business/suppliers/invoices
    const invGet = await router.handle('/api/business/suppliers/invoices?supplierId=sup-plm-01', 'GET');
    assert.equal(invGet.status, 200);
    assert.equal(invGet.data.invoices.length, 1);
    assert.equal(invGet.data.invoices[0].invoice_number, 'INV-PLM-77');

    // 6. POST /api/business/suppliers/payments (Settle invoice in full)
    const payPost = await router.handle('/api/business/suppliers/payments', 'POST', {
      supplierId: 'sup-plm-01',
      invoiceId: invGet.data.invoices[0].id,
      projectId: 'prj-kun-01',
      accountId: 'acc-hdfc-current',
      amount: 18500.00,
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: 'UTR-PLM-112233',
      paymentDate: '2026-10-26',
      notes: 'Paid in full'
    });
    assert.equal(payPost.status, 200);
    assert.equal(payPost.data.payment.amount, 18500.00);

    // 7. Verify invoice is marked PAID
    const settledInv = await router.handle('/api/business/suppliers/invoices?supplierId=sup-plm-01', 'GET');
    assert.equal(settledInv.data.invoices[0].payment_status, 'PAID');
    assert.equal(settledInv.data.invoices[0].balance_amount, 0.00);
  });
});
