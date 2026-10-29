import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { DocumentService } from '../src/services/documentService.js';
import { FinancialService } from '../src/services/financialService.js';

describe('DDevUltraHome Document Watermarking & Human OCR Review Gate', () => {
  let db;
  let runner;
  let docService;
  let financialService;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
    runner.migrate();
    docService = new DocumentService(db);
    financialService = new FinancialService(db);

    // Seed test project and supplier
    db.run(`
      INSERT INTO clients (id, name, phone, email, billing_address)
      VALUES ('client-guindy', 'Mr. JAS Guindy', '+91 98400 12345', 'client.guindy@gmail.com', 'Guindy, Chennai');
    `);

    db.run(`
      INSERT INTO projects (id, client_id, name, project_code, site_address, district, status)
      VALUES ('prj-guindy', 'client-guindy', 'Guindy Luxury Residence', 'PRJ-GND-01', 'Guindy, Chennai', 'Chennai', 'ACTIVE');
    `);

    db.run(`
      INSERT INTO suppliers (id, name, category, contact_person, phone)
      VALUES ('sup-steel-1', 'Chennai TMT Traders', 'STEEL', 'Mr. Balan', '+91 94440 99887');
    `);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('rule: registers document with SHA-256 hash and dynamic D DEV ULTRA HOMES watermark', () => {
    const fileBuffer = Buffer.from('Sample engineering PDF document content for testing SHA256');
    const doc = docService.registerDocument({
      projectId: 'prj-guindy',
      documentType: 'DRAWING',
      fileName: 'Guindy_Ground_Floor_Plan_R0.pdf',
      filePath: '/storage/documents/Guindy_Ground_Floor_Plan_R0.pdf',
      fileSize: fileBuffer.length,
      mimeType: 'application/pdf',
      buffer: fileBuffer,
      createdBy: 'usr-owner-1'
    });

    assert.ok(doc.id.startsWith('doc_'));
    assert.equal(doc.file_name, 'Guindy_Ground_Floor_Plan_R0.pdf');
    assert.ok(doc.sha256_hash.length === 64, 'Computed standard 64-char SHA256');
    assert.ok(doc.watermark_text.includes('D DEV ULTRA HOMES — CONFIDENTIAL'));

    // Verify SVG watermark generation
    const svg = docService.generateWatermarkSvg({
      companyName: 'D DEV ULTRA HOMES',
      tagline: 'Building your dreams',
      notice: 'CONFIDENTIAL'
    });
    assert.ok(svg.includes('D DEV ULTRA HOMES'));
    assert.ok(svg.includes('BUILDING YOUR DREAMS'));
    assert.ok(svg.includes('CONFIDENTIAL'));
  });

  test('rule: OCR extraction initial state is strictly UNVERIFIED and cannot create financial records automatically', () => {
    const doc = docService.registerDocument({
      projectId: 'prj-guindy',
      documentType: 'INVOICE',
      fileName: 'Steel_TMT_Bill_9921.jpg',
      filePath: '/storage/uploads/Steel_TMT_Bill_9921.jpg',
      fileSize: 45000,
      mimeType: 'image/jpeg',
      createdBy: 'usr-sitemanager-1'
    });

    const rawBillText = `
      CHENNAI TMT TRADERS
      GSTIN: 33AAACG9921F1ZV
      Tax Invoice No: INV-TMT-9921
      Date: 2026-10-25
      Description: Fe550D TMT Rebars 12mm & 16mm (2.5 Tons)
      Subtotal: 135,000.00
      CGST (9%): 12,150.00
      SGST (9%): 12,150.00
      Total: 159,300.00
    `;

    const ocrReview = docService.processOcrExtraction({
      documentId: doc.id,
      rawText: rawBillText,
      createdBy: 'usr-sitemanager-1'
    });

    assert.ok(ocrReview.id.startsWith('ocr_'));
    assert.equal(ocrReview.verification_status, 'UNVERIFIED', 'Status must strictly be UNVERIFIED');
    assert.equal(ocrReview.extractedFields.invoiceNumber, 'INV-TMT-9921');
    assert.equal(ocrReview.extractedFields.date, '2026-10-25');
    assert.equal(ocrReview.extractedFields.totalAmount, 159300.00);

    // Verify document status updated to EXTRACTED
    const updatedDoc = docService.getDocumentById(doc.id);
    assert.equal(updatedDoc.ocr_status, 'EXTRACTED');

    // Invariant: Verify NO supplier invoice was created in the database yet
    const invCount = db.queryOne('SELECT COUNT(*) as count FROM supplier_invoices WHERE invoice_number = ?;', ['INV-TMT-9921']);
    assert.equal(invCount.count, 0, 'Unverified OCR must NEVER create financial records automatically');
  });

  test('rule: non-authorized role (Site Manager or Client) CANNOT verify OCR financial transaction', () => {
    const doc = docService.registerDocument({
      projectId: 'prj-guindy',
      documentType: 'INVOICE',
      fileName: 'Sand_Receipt_401.jpg',
      filePath: '/storage/uploads/Sand_Receipt_401.jpg',
      fileSize: 30000,
      mimeType: 'image/jpeg'
    });

    const review = docService.processOcrExtraction({
      documentId: doc.id,
      rawText: 'Sand Supply Bill No: SND-401 Total: 15000'
    });

    // Site Manager attempts to verify: MUST throw Unauthorized
    assert.throws(() => {
      docService.humanVerifyOcrTransaction({
        reviewId: review.id,
        userId: 'usr-sitemanager-1',
        userRole: 'SITE_MANAGER',
        action: 'CONFIRMED',
        verifiedFields: { totalAmount: 15000 }
      });
    }, /Unauthorized: Role "SITE_MANAGER" is NOT permitted to verify OCR/);

    // Client attempts to verify: MUST throw Unauthorized
    assert.throws(() => {
      docService.humanVerifyOcrTransaction({
        reviewId: review.id,
        userId: 'usr-client-1',
        userRole: 'CLIENT',
        action: 'CONFIRMED',
        verifiedFields: { totalAmount: 15000 }
      });
    }, /Unauthorized: Role "CLIENT" is NOT permitted to verify OCR/);
  });

  test('rule: human verification by Accountant/Owner confirms OCR bill and creates verified financial transaction', () => {
    const doc = docService.registerDocument({
      projectId: 'prj-guindy',
      documentType: 'INVOICE',
      fileName: 'Steel_TMT_Bill_9921.jpg',
      filePath: '/storage/uploads/Steel_TMT_Bill_9921.jpg',
      fileSize: 45000,
      mimeType: 'image/jpeg'
    });

    const review = docService.processOcrExtraction({
      documentId: doc.id,
      rawText: 'Tax Invoice No: INV-TMT-9921 Date: 2026-10-25 Total: 159300.00'
    });

    // Human Accountant reviews, corrects the supplier reference and confirms
    const verificationResult = docService.humanVerifyOcrTransaction({
      reviewId: review.id,
      userId: 'usr-accountant-1',
      userRole: 'ACCOUNTANT',
      action: 'CONFIRMED',
      verifiedFields: {
        supplierId: 'sup-steel-1',
        projectId: 'prj-guindy',
        invoiceNumber: 'INV-TMT-9921',
        date: '2026-10-25',
        totalAmount: 159300.00,
        taxAmount: 24300.00
      },
      notes: 'Verified against physical gate pass and weighed on weighbridge',
      financialService,
      financialAction: 'SUPPLIER_INVOICE'
    });

    assert.equal(verificationResult.review.verification_status, 'CONFIRMED');
    assert.equal(verificationResult.review.verified_by, 'usr-accountant-1');
    assert.ok(verificationResult.financialRecord, 'Financial invoice created upon human verification');
    assert.equal(verificationResult.financialRecord.totalAmount, 159300.00);

    // Verify document marked as HUMAN_VERIFIED
    const updatedDoc = docService.getDocumentById(doc.id);
    assert.equal(updatedDoc.ocr_status, 'HUMAN_VERIFIED');

    // Verify supplier invoice exists in database
    const inv = db.queryOne('SELECT * FROM supplier_invoices WHERE invoice_number = ?;', ['INV-TMT-9921']);
    assert.ok(inv);
    assert.equal(inv.total_amount, 159300.00);
    assert.equal(inv.payment_status, 'UNPAID', 'Preserves rule: invoice creates payable, not cash outflow');
  });

  test('rule: human verification rejection marks document REJECTED and creates no financial transaction', () => {
    const doc = docService.registerDocument({
      projectId: 'prj-guindy',
      documentType: 'INVOICE',
      fileName: 'Fake_Bill.jpg',
      filePath: '/storage/uploads/Fake_Bill.jpg',
      fileSize: 20000,
      mimeType: 'image/jpeg'
    });

    const review = docService.processOcrExtraction({
      documentId: doc.id,
      rawText: 'Dubious Cement Bill 9999 Total: 85000'
    });

    const verificationResult = docService.humanVerifyOcrTransaction({
      reviewId: review.id,
      userId: 'usr-owner-1',
      userRole: 'OWNER',
      action: 'REJECTED',
      notes: 'Fake duplicate bill detected; rejected.',
      financialService,
      financialAction: 'SUPPLIER_INVOICE'
    });

    assert.equal(verificationResult.review.verification_status, 'REJECTED');
    assert.equal(verificationResult.financialRecord, null);

    const updatedDoc = docService.getDocumentById(doc.id);
    assert.equal(updatedDoc.ocr_status, 'REJECTED');

    const invCount = db.queryOne('SELECT COUNT(*) as count FROM supplier_invoices;');
    assert.equal(invCount.count, 0);
  });
});
