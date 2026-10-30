/**
 * DDevUltraHome — Quotation & Client Proposal Service
 * 
 * Manages construction cost estimates, revision versioning,
 * Schedule A engineering specifications, Schedule B built-up area & extra work line items,
 * and generates official client-ready watermarked print/PDF documents.
 */

import { SafeMath } from '../engine/math.js';

export class QuotationService {
  constructor(dbConnection) {
    this.db = dbConnection;
  }

  /**
   * Create a new itemized quotation
   * @param {Object} data 
   * @returns {Object} Created quotation with items
   */
  createQuotation(data) {
    const {
      projectId = null,
      clientId,
      title,
      quotationNumber = null,
      revisionNumber = 0,
      taxRate = 0.00,
      termsConditions = null,
      validUntil = null,
      createdBy = null,
      items = []
    } = data;

    if (!clientId) {
      throw new Error('Missing required field: clientId is mandatory.');
    }
    if (!title || !title.trim()) {
      throw new Error('Missing required field: title is mandatory.');
    }

    return this.db.transaction(() => {
      // 1. Verify client exists
      const client = this.db.queryOne('SELECT id, name FROM clients WHERE id = ?;', [clientId]);
      if (!client) {
        throw new Error(`Client with ID ${clientId} not found.`);
      }

      // 2. Generate sequential quotation number if not provided
      let qNumber = quotationNumber;
      if (!qNumber) {
        const countRow = this.db.queryOne('SELECT COUNT(DISTINCT quotation_number) as cnt FROM quotations;');
        const seq = (countRow.cnt + 1).toString().padStart(4, '0');
        qNumber = `QUO-${new Date().getFullYear()}-${seq}`;
      }

      // 3. Compute item totals & subtotal
      let computedSubtotal = 0.00;
      const normalizedItems = items.map((itm, idx) => {
        const qty = parseFloat(itm.quantity) || 1;
        const rate = parseFloat(itm.unitRate) || 0;
        const lineTotal = itm.totalPrice ? parseFloat(itm.totalPrice) : SafeMath.round(qty * rate, 2);
        computedSubtotal = SafeMath.round(computedSubtotal + lineTotal, 2);

        return {
          id: `qitm_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          itemCode: itm.itemCode || `ITM-${(idx + 1).toString().padStart(2, '0')}`,
          description: itm.description || 'Civil Works Item',
          category: itm.category || 'CIVIL',
          unit: itm.unit || 'sqft',
          quantity: qty,
          unitRate: rate,
          totalPrice: lineTotal,
          notes: itm.notes || ''
        };
      });

      const taxAmount = SafeMath.round((computedSubtotal * (parseFloat(taxRate) || 0)) / 100, 2);
      const totalAmount = SafeMath.round(computedSubtotal + taxAmount, 2);

      const quoteId = `quot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const defaultValidity = validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const defaultTerms = termsConditions || 
        '1. 8-Stage milestone payment schedule as per Schedule B.\n' +
        '2. Mobilization advance is an unearned deposit until milestone certification.\n' +
        '3. Water and 3-phase electricity connection charges to be borne by client.\n' +
        '4. Quotation valid for 30 days from date of issue.';

      this.db.run(`
        INSERT INTO quotations (
          id, quotation_number, revision_number, project_id, client_id,
          title, subtotal, tax_rate, tax_amount, total_amount,
          terms_conditions, valid_until, status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, datetime('now'), datetime('now'));
      `, [
        quoteId, qNumber, revisionNumber, projectId, clientId,
        title.trim(), computedSubtotal, taxRate, taxAmount, totalAmount,
        defaultTerms, defaultValidity, createdBy
      ]);

      // Insert line items
      for (const itm of normalizedItems) {
        this.db.run(`
          INSERT INTO quotation_items (
            id, quotation_id, item_code, description, category,
            unit, quantity, unit_rate, total_price, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          itm.id, quoteId, itm.itemCode, itm.description, itm.category,
          itm.unit, itm.quantity, itm.unitRate, itm.totalPrice, itm.notes
        ]);
      }

      return this.getQuotationById(quoteId);
    });
  }

  /**
   * Retrieve quotation by ID with full client, project, and line item details
   */
  getQuotationById(id) {
    const quote = this.db.queryOne(`
      SELECT q.*, 
             c.name as client_name, c.phone as client_phone, c.email as client_email, c.billing_address as client_address,
             p.name as project_name, p.project_code, p.site_address as project_site_address, p.district as project_district
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      WHERE q.id = ?;
    `, [id]);

    if (!quote) return null;

    const items = this.db.query(`
      SELECT * FROM quotation_items 
      WHERE quotation_id = ? 
      ORDER BY item_code ASC, id ASC;
    `, [id]);

    let milestones = [];
    if (quote.project_id) {
      milestones = this.db.query(`
        SELECT * FROM milestones 
        WHERE project_id = ? 
        ORDER BY target_percentage ASC;
      `, [quote.project_id]);
    }

    return {
      ...quote,
      items,
      milestones
    };
  }

  /**
   * List all quotations with optional filters
   */
  listQuotations(filters = {}) {
    const { projectId, clientId, status } = filters;
    let sql = `
      SELECT q.*, 
             c.name as client_name, c.phone as client_phone,
             p.name as project_name, p.project_code
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND q.project_id = ?';
      params.push(projectId);
    }
    if (clientId) {
      sql += ' AND q.client_id = ?';
      params.push(clientId);
    }
    if (status) {
      sql += ' AND q.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY q.created_at DESC;';
    return this.db.query(sql, params);
  }

  /**
   * Update quotation status (e.g. DRAFT -> SENT -> APPROVED)
   */
  updateStatus(id, newStatus, userId = null) {
    const validStatuses = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'SUPERSEDED'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid quotation status "${newStatus}". Must be one of: ${validStatuses.join(', ')}`);
    }

    const quote = this.db.queryOne('SELECT * FROM quotations WHERE id = ?;', [id]);
    if (!quote) {
      throw new Error(`Quotation with ID ${id} not found.`);
    }

    this.db.run(`
      UPDATE quotations 
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?;
    `, [newStatus, id]);

    return this.getQuotationById(id);
  }

  /**
   * Create a new revision of an existing quotation
   */
  createRevision(originalId, createdBy = null) {
    const original = this.getQuotationById(originalId);
    if (!original) {
      throw new Error(`Quotation ${originalId} not found.`);
    }

    return this.db.transaction(() => {
      // Mark original as SUPERSEDED
      this.db.run("UPDATE quotations SET status = 'SUPERSEDED', updated_at = datetime('now') WHERE id = ?;", [originalId]);

      // Create next revision
      const nextRev = original.revision_number + 1;
      const newQuote = this.createQuotation({
        projectId: original.project_id,
        clientId: original.client_id,
        title: original.title,
        quotationNumber: original.quotation_number,
        revisionNumber: nextRev,
        taxRate: original.tax_rate,
        termsConditions: original.terms_conditions,
        validUntil: original.valid_until,
        createdBy,
        items: original.items.map(itm => ({
          itemCode: itm.item_code,
          description: itm.description,
          category: itm.category,
          unit: itm.unit,
          quantity: itm.quantity,
          unitRate: itm.unit_rate,
          totalPrice: itm.total_price,
          notes: itm.notes
        }))
      });

      return newQuote;
    });
  }

  /**
   * Update an existing draft quotation
   */
  updateQuotation(id, data) {
    const existing = this.getQuotationById(id);
    if (!existing) {
      throw new Error(`Quotation with ID ${id} not found.`);
    }

    if (existing.status !== 'DRAFT') {
      throw new Error(`Cannot modify quotation ${id} with status "${existing.status}". Create a new revision instead.`);
    }

    const {
      title = existing.title,
      taxRate = existing.tax_rate,
      termsConditions = existing.terms_conditions,
      validUntil = existing.valid_until,
      items = null
    } = data;

    return this.db.transaction(() => {
      let subtotal = existing.subtotal;
      let taxAmount = existing.tax_amount;
      let totalAmount = existing.total_amount;

      if (items && Array.isArray(items)) {
        // Delete existing items
        this.db.run('DELETE FROM quotation_items WHERE quotation_id = ?;', [id]);

        let computedSubtotal = 0.00;
        const normalizedItems = items.map((itm, idx) => {
          const qty = parseFloat(itm.quantity) || 1;
          const rate = parseFloat(itm.unitRate) || 0;
          const lineTotal = itm.totalPrice ? parseFloat(itm.totalPrice) : SafeMath.round(qty * rate, 2);
          computedSubtotal = SafeMath.round(computedSubtotal + lineTotal, 2);

          return {
            id: `qitm_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            itemCode: itm.itemCode || `ITM-${(idx + 1).toString().padStart(2, '0')}`,
            description: itm.description || 'Civil Works Item',
            category: itm.category || 'CIVIL',
            unit: itm.unit || 'sqft',
            quantity: qty,
            unitRate: rate,
            totalPrice: lineTotal,
            notes: itm.notes || ''
          };
        });

        subtotal = computedSubtotal;
        taxAmount = SafeMath.round((subtotal * (parseFloat(taxRate) || 0)) / 100, 2);
        totalAmount = SafeMath.round(subtotal + taxAmount, 2);

        for (const itm of normalizedItems) {
          this.db.run(`
            INSERT INTO quotation_items (
              id, quotation_id, item_code, description, category,
              unit, quantity, unit_rate, total_price, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `, [
            itm.id, id, itm.itemCode, itm.description, itm.category,
            itm.unit, itm.quantity, itm.unitRate, itm.totalPrice, itm.notes
          ]);
        }
      } else if (taxRate !== undefined && taxRate !== existing.tax_rate) {
        taxAmount = SafeMath.round((subtotal * (parseFloat(taxRate) || 0)) / 100, 2);
        totalAmount = SafeMath.round(subtotal + taxAmount, 2);
      }

      this.db.run(`
        UPDATE quotations
        SET title = ?, tax_rate = ?, tax_amount = ?, subtotal = ?, total_amount = ?,
            terms_conditions = ?, valid_until = ?, updated_at = datetime('now')
        WHERE id = ?;
      `, [
        title.trim(), taxRate, taxAmount, subtotal, totalAmount,
        termsConditions, validUntil, id
      ]);

      return this.getQuotationById(id);
    });
  }

  /**
   * Delete a draft quotation
   */
  deleteQuotation(id) {
    const existing = this.getQuotationById(id);
    if (!existing) {
      throw new Error(`Quotation with ID ${id} not found.`);
    }

    if (existing.status !== 'DRAFT') {
      throw new Error(`Cannot delete quotation ${id} with status "${existing.status}". Only DRAFT quotations can be deleted.`);
    }

    return this.db.transaction(() => {
      this.db.run('DELETE FROM quotation_items WHERE quotation_id = ?;', [id]);
      this.db.run('DELETE FROM quotations WHERE id = ?;', [id]);
      return { success: true, deletedId: id };
    });
  }

  /**
   * Generate official client-ready printable HTML document with corporate letterhead,
   * Schedule A specifications, Schedule B items, payment milestones, and dynamic watermark.
   */
  generatePrintableHtml(id) {
    const quote = this.getQuotationById(id);
    if (!quote) {
      throw new Error(`Quotation ${id} not found.`);
    }

    const company = this.db.queryOne('SELECT * FROM company_settings LIMIT 1;') || {
      company_name: 'D DEV ULTRA HOMES',
      tagline: 'Building your dreams',
      address: '6a MGR Nagar, 2nd Cross Street, Velachery, Chennai - 600042',
      phone: '+91 98414 24267',
      email: 'contact@ddevultrahomes.com',
      gstin: '33AAAAA0000A1Z5',
      pan: 'AAAAA0000A'
    };

    const dateStr = quote.created_at ? new Date(quote.created_at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    }) : new Date().toLocaleDateString('en-IN');

    const validUntilStr = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    }) : '30 Days from date of issue';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quotation ${quote.quotation_number} Rev ${quote.revision_number} — ${company.company_name}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      margin: 0;
      padding: 20px;
      font-size: 13px;
      line-height: 1.45;
      position: relative;
    }
    .watermark-overlay {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 60px;
      font-weight: 900;
      color: rgba(11, 25, 44, 0.05);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .quote-container {
      position: relative;
      z-index: 1;
      max-width: 800px;
      margin: 0 auto;
    }
    .header-table {
      width: 100%;
      border-bottom: 3px solid #0B192C;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .company-title {
      font-size: 22px;
      font-weight: 900;
      color: #0B192C;
      letter-spacing: 0.04em;
      margin: 0;
    }
    .company-tagline {
      font-size: 12px;
      font-weight: 700;
      color: #D97706;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .company-meta {
      font-size: 11px;
      color: #475569;
      line-height: 1.4;
      margin-top: 4px;
    }
    .doc-badge {
      display: inline-block;
      background: #0B192C;
      color: #FFFFFF;
      padding: 4px 10px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.05em;
      border-radius: 4px;
    }
    .details-grid {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .details-col {
      flex: 1;
    }
    .details-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748B;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }
    .details-val {
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0B192C;
      background: #E2E8F0;
      padding: 6px 10px;
      border-left: 4px solid #0B192C;
      margin: 16px 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 12px;
    }
    table.data-table th {
      background: #0B192C;
      color: #FFFFFF;
      text-align: left;
      padding: 8px 10px;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table.data-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #E2E8F0;
      color: #1E293B;
    }
    table.data-table tr:nth-child(even) td {
      background: #F8FAFC;
    }
    .text-right {
      text-align: right;
    }
    .total-box {
      float: right;
      width: 280px;
      margin-top: 6px;
      margin-bottom: 16px;
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .total-row.grand {
      font-size: 15px;
      font-weight: 900;
      color: #0B192C;
      border-top: 2px solid #0B192C;
      padding-top: 6px;
      margin-top: 6px;
    }
    .clear {
      clear: both;
    }
    .specs-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 11px;
      color: #334155;
      line-height: 1.5;
      margin-bottom: 14px;
    }
    .terms-box {
      font-size: 11px;
      color: #475569;
      background: #FFFFFF;
      border: 1px dashed #CBD5E1;
      border-radius: 6px;
      padding: 10px 14px;
      white-space: pre-line;
      margin-bottom: 24px;
    }
    .sig-table {
      width: 100%;
      margin-top: 30px;
      border-collapse: collapse;
    }
    .sig-cell {
      width: 50%;
      padding: 10px 20px;
      vertical-align: bottom;
    }
    .sig-line {
      border-top: 1px solid #475569;
      padding-top: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .watermark-overlay {
        opacity: 0.08;
      }
    }
  </style>
</head>
<body>
  <div class="watermark-overlay">D DEV ULTRA HOMES — CONFIDENTIAL</div>

  <div class="quote-container">
    <div class="no-print" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; background: #0B192C; padding: 10px 16px; border-radius: 6px; color: white;">
      <span style="font-weight: 700; font-size: 13px;">Official Construction Quotation Preview</span>
      <button onclick="window.print()" style="background: #D97706; color: white; border: none; padding: 6px 14px; border-radius: 4px; font-weight: 700; cursor: pointer;">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <!-- Corporate Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <h1 class="company-title">${company.company_name}</h1>
          <div class="company-tagline">${company.tagline}</div>
          <div class="company-meta">
            ${company.address}<br>
            Phone: ${company.phone} • Email: ${company.email}<br>
            GSTIN: ${company.gstin || 'N/A'} • PAN: ${company.pan || 'N/A'}
          </div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div class="doc-badge">OFFICIAL ESTIMATE</div>
          <div style="font-size: 15px; font-weight: 800; color: #0B192C; margin-top: 8px;">
            ${quote.quotation_number}
          </div>
          <div style="font-size: 11px; color: #64748B;">Revision ${quote.revision_number}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">Date: <strong>${dateStr}</strong></div>
          <div style="font-size: 11px; color: #B45309; margin-top: 2px;">Valid Until: <strong>${validUntilStr}</strong></div>
        </td>
      </tr>
    </table>

    <!-- Project & Client Metadata -->
    <div class="details-grid">
      <div class="details-col">
        <div class="details-label">Client Details (House Owner)</div>
        <div class="details-val">${quote.client_name || 'N/A'}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">
          Phone: ${quote.client_phone || 'N/A'}<br>
          Address: ${quote.client_address || 'Chennai, Tamil Nadu'}
        </div>
      </div>
      <div class="details-col">
        <div class="details-label">Project &amp; Site Details</div>
        <div class="details-val">${quote.title}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">
          Site: ${quote.project_site_address || 'Tamil Nadu'}<br>
          District: ${quote.project_district || 'Chennai'}
        </div>
      </div>
    </div>

    <!-- Schedule A: Technical Specifications -->
    <div class="section-title">Schedule A: Engineering &amp; Material Specifications</div>
    <div class="specs-box">
      • <strong>RCC Framed Structure:</strong> Column footing, columns, plinth beams, and 5" roof slab thickness.<br>
      • <strong>Basement &amp; Superstructure:</strong> 9" flyash brickwork in CM 1:5 in external walls; 4.5" partition walls in CM 1:4.<br>
      • <strong>Approved Cement Brands:</strong> Dalmia, Coromandel, UltraTech, Ramco (HDPE or paper bags).<br>
      • <strong>Reinforcement Steel:</strong> High-yield Fe 550D TMT reinforcement bars.<br>
      • <strong>Flooring &amp; Finishes:</strong> 4'×2' Vitrified tiles (Kag/Anuj @ ₹50/sqft base) with 4" skirting; Glazed tiles in toilets up to 7ft height.<br>
      • <strong>Joinery &amp; Woodwork:</strong> First quality teak wood main door (3'6"×7') & frame; UPVC sliding windows; waterproof flush doors.<br>
      • <strong>Kitchen &amp; Plumbing:</strong> Black granite platform (₹120/sqft base), SS sink bowl; Parryware closets and taps.<br>
      • <strong>Electrical:</strong> Orbit fire-resistant wires with GM/Orbit modular switches (3-phase wiring).<br>
      • <strong>Painting:</strong> Asian Tractor Emulsion (2 coats + primer) interior; Asian Ace Emulsion exterior.
    </div>

    <!-- Schedule B: Itemized Cost Breakdown -->
    <div class="section-title">Schedule B: Itemized Scope of Work &amp; Built-up Area</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Description &amp; Scope of Work</th>
          <th style="width: 80px;">Category</th>
          <th style="width: 60px;" class="text-right">Qty</th>
          <th style="width: 50px;">Unit</th>
          <th style="width: 90px;" class="text-right">Unit Rate (₹)</th>
          <th style="width: 110px;" class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${quote.items.map((itm, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>
              <strong>${itm.description}</strong>
              ${itm.notes ? `<div style="font-size: 10px; color: #64748B;">${itm.notes}</div>` : ''}
            </td>
            <td><span style="font-size: 10px; font-weight: 700; color: #475569;">${itm.category}</span></td>
            <td class="text-right">${itm.quantity}</td>
            <td>${itm.unit}</td>
            <td class="text-right">${itm.unit_rate ? itm.unit_rate.toLocaleString('en-IN') : '-'}</td>
            <td class="text-right"><strong>${itm.total_price.toLocaleString('en-IN')}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Totals Summary -->
    <div class="total-box">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>₹${(quote.subtotal || 0).toLocaleString('en-IN')}</span>
      </div>
      ${quote.tax_rate > 0 ? `
        <div class="total-row">
          <span>GST (${quote.tax_rate}%):</span>
          <span>₹${(quote.tax_amount || 0).toLocaleString('en-IN')}</span>
        </div>
      ` : ''}
      <div class="total-row grand">
        <span>Total Proposal:</span>
        <span>₹${(quote.total_amount || 0).toLocaleString('en-IN')}</span>
      </div>
    </div>
    <div class="clear"></div>

    <!-- Schedule B Milestones (Payment Terms) -->
    ${quote.milestones && quote.milestones.length > 0 ? `
      <div class="section-title">Schedule B Payment Terms (8 Milestone Stages)</div>
      <table class="data-table" style="font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 60px;">Stage</th>
            <th>Construction Stage / Deliverable</th>
            <th style="width: 80px;" class="text-right">Target %</th>
            <th style="width: 110px;" class="text-right">Stage Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${quote.milestones.map(m => `
            <tr>
              <td><strong>${m.milestone_code || 'MS'}</strong></td>
              <td>${m.title}</td>
              <td class="text-right">${m.target_percentage}%</td>
              <td class="text-right"><strong>₹${(m.invoice_amount || 0).toLocaleString('en-IN')}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    <!-- Terms & Conditions -->
    <div class="section-title">Terms &amp; Conditions</div>
    <div class="terms-box">${quote.terms_conditions || 'Standard contract terms apply.'}</div>

    <!-- Signatures Table -->
    <table class="sig-table">
      <tr>
        <td class="sig-cell">
          <div style="height: 45px;"></div>
          <div class="sig-line">
            For ${company.company_name}<br>
            <span style="font-size: 10px; font-weight: normal; color: #64748B;">Authorized Signatory / Builder</span>
          </div>
        </td>
        <td class="sig-cell text-right" style="text-align: right;">
          <div style="height: 45px;"></div>
          <div class="sig-line" style="text-align: right;">
            Accepted by: ${quote.client_name || 'Client / House Owner'}<br>
            <span style="font-size: 10px; font-weight: normal; color: #64748B;">Client / House Owner Signature &amp; Date</span>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
  }
}
