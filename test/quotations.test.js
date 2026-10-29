import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { QuotationService } from '../src/services/quotationService.js';
import { BusinessApiRouter } from '../src/api/router.js';

describe('DDevUltraHome — Quotation Builder & Client-Ready Watermarked PDF Engine', () => {
  let db;
  let runner;
  let quoteService;
  let router;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
    runner.runMigrations();
    quoteService = new QuotationService(db);
    router = new BusinessApiRouter(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('creates itemized quotation with accurate subtotal, tax calculation, and line items', () => {
    const quote = quoteService.createQuotation({
      clientId: 'cli-thiumani-01',
      projectId: 'prj-kun-01',
      title: 'Kundrathur Residence (G+1 Villa) Proposal',
      taxRate: 0,
      items: [
        {
          itemCode: 'BLD-GF',
          description: 'Ground Floor Built-up Area',
          category: 'CIVIL',
          unit: 'sqft',
          quantity: 723,
          unitRate: 2300,
          totalPrice: 1662900.00
        },
        {
          itemCode: 'BLD-FF',
          description: 'First Floor Built-up Area',
          category: 'CIVIL',
          unit: 'sqft',
          quantity: 723,
          unitRate: 2300,
          totalPrice: 1662900.00
        },
        {
          itemCode: 'BLD-HR',
          description: 'Headroom Area',
          category: 'CIVIL',
          unit: 'sqft',
          quantity: 85,
          unitRate: 2000,
          totalPrice: 170000.00
        },
        {
          itemCode: 'EXT-01',
          description: 'Septic Tank 10000L',
          category: 'CIVIL',
          unit: 'liters',
          quantity: 10000,
          unitRate: 20,
          totalPrice: 200000.00
        }
      ]
    });

    assert.ok(quote.id);
    assert.match(quote.quotation_number, /QUO-\d{4}-\d{4}/);
    assert.equal(quote.revision_number, 0);
    assert.equal(quote.status, 'DRAFT');
    assert.equal(quote.subtotal, 3695800.00);
    assert.equal(quote.total_amount, 3695800.00);
    assert.equal(quote.items.length, 4);
    assert.equal(quote.client_name, 'Mr. Thiumani P.');
    assert.equal(quote.project_name, 'Kundrathur Residence (G+1 Villa)');
  });

  test('rejects quotation creation when missing required fields (client or title)', () => {
    assert.throws(() => {
      quoteService.createQuotation({
        title: 'Missing Client Quote',
        items: []
      });
    }, /Missing required field: clientId/i);

    assert.throws(() => {
      quoteService.createQuotation({
        clientId: 'cli-thiumani-01',
        title: '',
        items: []
      });
    }, /Missing required field: title/i);
  });

  test('updates quotation status with transition validation (DRAFT -> APPROVED)', () => {
    const quote = quoteService.createQuotation({
      clientId: 'cli-thiumani-01',
      title: 'Status Test Quote',
      items: [{ description: 'Civil work', quantity: 1, unitRate: 50000, totalPrice: 50000 }]
    });

    assert.equal(quote.status, 'DRAFT');

    const approved = quoteService.updateStatus(quote.id, 'APPROVED');
    assert.equal(approved.status, 'APPROVED');

    assert.throws(() => {
      quoteService.updateStatus(quote.id, 'INVALID_STATUS');
    }, /Invalid quotation status/i);
  });

  test('creates new sequential revision and marks previous revision as SUPERSEDED', () => {
    const original = quoteService.createQuotation({
      clientId: 'cli-thiumani-01',
      projectId: 'prj-kun-01',
      title: 'Original Revision Quote',
      items: [{ description: 'Foundations', quantity: 1, unitRate: 100000, totalPrice: 100000 }]
    });

    assert.equal(original.revision_number, 0);
    assert.equal(original.status, 'DRAFT');

    const revision = quoteService.createRevision(original.id);

    assert.equal(revision.quotation_number, original.quotation_number);
    assert.equal(revision.revision_number, 1);
    assert.equal(revision.status, 'DRAFT');
    assert.equal(revision.items.length, 1);

    const reloadedOriginal = quoteService.getQuotationById(original.id);
    assert.equal(reloadedOriginal.status, 'SUPERSEDED');
  });

  test('generates client-ready printable HTML document with corporate branding, Schedule A, B, and watermark', () => {
    const quote = quoteService.createQuotation({
      clientId: 'cli-thiumani-01',
      projectId: 'prj-kun-01',
      title: 'Residential Villa Construction — Kundrathur (G+1)',
      items: [
        {
          itemCode: 'GF-01',
          description: 'Ground Floor Built-up Area (723 sqft @ ₹2300/sqft)',
          category: 'CIVIL',
          unit: 'sqft',
          quantity: 723,
          unitRate: 2300,
          totalPrice: 1662900.00
        }
      ]
    });

    const html = quoteService.generatePrintableHtml(quote.id);

    assert.ok(typeof html === 'string');
    assert.match(html, /D DEV ULTRA HOMES/i, 'Must contain builder company name');
    assert.match(html, /Building your dreams/i, 'Must contain corporate tagline');
    assert.match(html, /Velachery, Chennai/i, 'Must contain corporate registered office');
    assert.match(html, /Mr\. Thiumani P\./i, 'Must contain client name');
    assert.match(html, /Schedule A: Engineering/i, 'Must contain Schedule A specifications');
    assert.match(html, /Schedule B: Itemized Scope/i, 'Must contain Schedule B line items');
    assert.match(html, /CONFIDENTIAL/i, 'Must contain diagonal watermark');
    assert.match(html, /window\.print\(\)/i, 'Must contain 1-click print trigger');
    assert.match(html, /Authorized Signatory \/ Builder/i, 'Must contain builder signature line');
    assert.match(html, /Client \/ House Owner Signature/i, 'Must contain client acceptance line');
  });

  test('BusinessApiRouter handles full quotations REST lifecycle', async () => {
    // 1. Create quotation via router
    const createRes = await router.handle('/api/business/quotations', 'POST', {
      clientId: 'cli-thiumani-01',
      projectId: 'prj-kun-01',
      title: 'API Router Generated Proposal',
      items: [
        { description: 'Brickwork 9" flyash', category: 'CIVIL', unit: 'sqft', quantity: 723, unitRate: 2300, totalPrice: 1662900 }
      ]
    });

    assert.equal(createRes.status, 201);
    assert.ok(createRes.data.quotation.id);
    const quoteId = createRes.data.quotation.id;

    // 2. Fetch quotation list
    const listRes = await router.handle('/api/business/quotations', 'GET');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.quotations.length >= 1);

    // 3. Fetch printable HTML document
    const htmlRes = await router.handle(`/api/business/quotations/${quoteId}/html`, 'GET');
    assert.equal(htmlRes.status, 200);
    assert.ok(htmlRes.data.html.includes('D DEV ULTRA HOMES'));

    // 4. Update status to APPROVED
    const statusRes = await router.handle(`/api/business/quotations/${quoteId}/status`, 'POST', {
      status: 'APPROVED'
    });
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.data.quotation.status, 'APPROVED');
  });
});
