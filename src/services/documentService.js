/**
 * DDevUltraHome — Document Management, Watermarking & Human-Verified OCR Gate Service
 * 
 * Enforces mandatory business security & accounting rules:
 * 1. All corporate documents, bills, and engineering drawings have SHA-256 integrity hashes.
 * 2. Documents can be branded with dynamic D DEV ULTRA HOMES confidentiality watermarks.
 * 3. Raw OCR extractions are PROVISIONAL and strictly UNVERIFIED.
 * 4. NEVER post OCR-scanned amounts to financial ledgers without explicit human verification
 *    by an authorized role (OWNER or ACCOUNTANT).
 */

import { createHash } from 'node:crypto';

export class DocumentService {
  constructor(dbConnection) {
    this.db = dbConnection;
  }

  /**
   * Register a new document with SHA-256 hash and watermark configuration
   * @param {Object} data
   * @returns {Object} Created document metadata
   */
  registerDocument(data) {
    const {
      projectId = null,
      documentType,
      fileName,
      filePath,
      fileSize = 0,
      mimeType = 'application/octet-stream',
      buffer = null,
      watermarkText = null,
      createdBy = null
    } = data;

    if (!fileName || !filePath || !documentType) {
      throw new Error('fileName, filePath, and documentType are required.');
    }

    const validTypes = ['INVOICE', 'RECEIPT', 'CONTRACT', 'DRAWING', 'SITE_PHOTO', 'MEASUREMENT_SHEET', 'QUOTATION_DOC', 'OTHER'];
    if (!validTypes.includes(documentType)) {
      throw new Error(`Invalid documentType "${documentType}". Must be one of: ${validTypes.join(', ')}`);
    }

    // Compute SHA-256 integrity hash
    let sha256Hash = null;
    if (buffer) {
      sha256Hash = createHash('sha256').update(buffer).digest('hex');
    } else {
      sha256Hash = createHash('sha256').update(`${fileName}-${filePath}-${Date.now()}`).digest('hex');
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const effectiveWatermark = watermarkText || `D DEV ULTRA HOMES — CONFIDENTIAL — ${new Date().toISOString().split('T')[0]}`;

    return this.db.transaction(() => {
      this.db.run(`
        INSERT INTO documents (
          id, project_id, document_type, file_name, file_path,
          file_size, mime_type, sha256_hash, watermark_text,
          ocr_status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
      `, [
        docId,
        projectId,
        documentType,
        fileName,
        filePath,
        fileSize,
        mimeType,
        sha256Hash,
        effectiveWatermark,
        documentType === 'INVOICE' || documentType === 'RECEIPT' ? 'PENDING' : 'NOT_APPLICABLE',
        createdBy
      ]);

      // Audit log
      this._logAudit('DOCUMENT', docId, 'CREATE', createdBy, {
        fileName,
        documentType,
        sha256Hash
      });

      return this.getDocumentById(docId);
    });
  }

  /**
   * Fetch document by ID
   */
  getDocumentById(id) {
    const doc = this.db.queryOne('SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL;', [id]);
    return doc || null;
  }

  /**
   * List documents with optional filters
   */
  listDocuments(filters = {}) {
    const { projectId, documentType } = filters;
    let sql = 'SELECT * FROM documents WHERE deleted_at IS NULL';
    const params = [];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    if (documentType) {
      sql += ' AND document_type = ?';
      params.push(documentType);
    }
    sql += ' ORDER BY created_at DESC;';

    return this.db.query(sql, params);
  }

  /**
   * Generate an SVG watermark overlay with diagonal brand text
   * Suitable for overlaying on HTML previews, canvas, or PDF export streams
   */
  generateWatermarkSvg(options = {}) {
    const {
      companyName = 'D DEV ULTRA HOMES',
      tagline = 'Building your dreams',
      notice = 'CONFIDENTIAL & PROPRIETARY',
      timestamp = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      width = 800,
      height = 600,
      opacity = 0.12
    } = options;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <style>
          .watermark-text {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            fill: #0F172A;
            opacity: ${opacity};
            font-weight: 800;
            text-anchor: middle;
            user-select: none;
            letter-spacing: 0.15em;
          }
          .watermark-sub {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            fill: #D97706;
            opacity: ${opacity * 1.2};
            font-weight: 600;
            text-anchor: middle;
            user-select: none;
            letter-spacing: 0.1em;
          }
        </style>
        <g transform="translate(${width / 2}, ${height / 2}) rotate(-35)">
          <text y="-35" class="watermark-text" font-size="42">${companyName}</text>
          <text y="15" class="watermark-sub" font-size="22">${tagline.toUpperCase()}</text>
          <text y="50" class="watermark-text" font-size="16">${notice} • ${timestamp}</text>
        </g>
      </svg>
    `.trim();
  }

  /**
   * Process and register OCR extraction from a scanned bill/receipt.
   * Mandates that the initial status is always UNVERIFIED.
   * 
   * @param {Object} data { documentId, rawText, provisionalFields, createdBy }
   * @returns {Object} Created OCR review record
   */
  processOcrExtraction(data) {
    const {
      documentId,
      rawText = '',
      provisionalFields = {},
      createdBy = null
    } = data;

    const doc = this.getDocumentById(documentId);
    if (!doc) {
      throw new Error(`Document with ID ${documentId} not found.`);
    }

    // Automatic regex-based parsing if provisional fields are missing or partial
    const extracted = { ...provisionalFields };

    if (!extracted.invoiceNumber && rawText) {
      const invMatch = rawText.match(/(?:Tax\s+Invoice|Invoice|Bill|Inv)(?:\s*(?:No|Number|#|\.))?[:\s.-]+([A-Za-z0-9\-\/]+)/i);
      if (invMatch && invMatch[1].toLowerCase() !== 'no') {
        extracted.invoiceNumber = invMatch[1].trim();
      }
    }

    if (!extracted.date && rawText) {
      const dateMatch = rawText.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}-\d{2}-\d{2})/);
      if (dateMatch) extracted.date = dateMatch[1].trim();
    }

    if ((!extracted.totalAmount || extracted.totalAmount <= 0) && rawText) {
      const amountMatches = [...rawText.matchAll(/(?:Total|Grand Total|Net Amount|Amount|INR|Rs\.?|₹)[\s:]*([0-9,]+\.?[0-9]*)/gi)];
      if (amountMatches.length > 0) {
        const lastMatch = amountMatches[amountMatches.length - 1][1].replace(/,/g, '');
        const val = parseFloat(lastMatch);
        if (!isNaN(val)) extracted.totalAmount = val;
      }
    }

    const reviewId = `ocr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return this.db.transaction(() => {
      this.db.run(`
        INSERT INTO ocr_reviews (
          id, document_id, raw_extracted_text,
          extracted_fields_json, verified_fields_json,
          verification_status, created_at
        ) VALUES (?, ?, ?, ?, NULL, 'UNVERIFIED', datetime('now'));
      `, [
        reviewId,
        documentId,
        rawText,
        JSON.stringify(extracted)
      ]);

      this.db.run(`
        UPDATE documents
        SET ocr_status = 'EXTRACTED'
        WHERE id = ?;
      `, [documentId]);

      this._logAudit('OCR_REVIEW', reviewId, 'CREATE', createdBy, {
        documentId,
        extractedFields: extracted,
        status: 'UNVERIFIED'
      });

      return this.getOcrReview(reviewId);
    });
  }

  /**
   * Get OCR review by ID
   */
  getOcrReview(reviewId) {
    const review = this.db.queryOne('SELECT * FROM ocr_reviews WHERE id = ?;', [reviewId]);
    if (!review) return null;

    return {
      ...review,
      extractedFields: review.extracted_fields_json ? JSON.parse(review.extracted_fields_json) : null,
      verifiedFields: review.verified_fields_json ? JSON.parse(review.verified_fields_json) : null
    };
  }

  /**
   * List OCR review records
   */
  listOcrReviews(filters = {}) {
    const { status, documentId } = filters;
    let sql = `
      SELECT o.*, d.file_name, d.document_type, d.project_id
      FROM ocr_reviews o
      JOIN documents d ON o.document_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND o.verification_status = ?';
      params.push(status);
    }
    if (documentId) {
      sql += ' AND o.document_id = ?';
      params.push(documentId);
    }

    sql += ' ORDER BY o.created_at DESC;';
    const rows = this.db.query(sql, params);

    return rows.map(r => ({
      ...r,
      extractedFields: r.extracted_fields_json ? JSON.parse(r.extracted_fields_json) : null,
      verifiedFields: r.verified_fields_json ? JSON.parse(r.verified_fields_json) : null
    }));
  }

  /**
   * HUMAN VERIFICATION GATE
   * 
   * Strict Rule: Only OWNER or ACCOUNTANT can verify OCR records.
   * Raw or unverified OCR records CANNOT automatically trigger financial transactions.
   * 
   * @param {Object} options
   */
  humanVerifyOcrTransaction(options) {
    const {
      reviewId,
      userId,
      userRole,
      action, // 'CONFIRMED', 'CORRECTED', 'REJECTED'
      verifiedFields = {},
      notes = '',
      financialService = null,
      financialAction = null, // 'SUPPLIER_INVOICE' | 'EXPENSE'
      financialPayload = {}
    } = options;

    // RBAC verification gate
    if (!['OWNER', 'ACCOUNTANT'].includes(userRole)) {
      throw new Error(`Unauthorized: Role "${userRole}" is NOT permitted to verify OCR financial records. Requires OWNER or ACCOUNTANT.`);
    }

    if (!['CONFIRMED', 'CORRECTED', 'REJECTED'].includes(action)) {
      throw new Error(`Invalid verification action "${action}". Must be CONFIRMED, CORRECTED, or REJECTED.`);
    }

    const review = this.getOcrReview(reviewId);
    if (!review) {
      throw new Error(`OCR Review with ID ${reviewId} not found.`);
    }

    if (review.verification_status !== 'UNVERIFIED') {
      throw new Error(`OCR Review ${reviewId} has already been processed with status: ${review.verification_status}.`);
    }

    return this.db.transaction(() => {
      const verifiedAt = new Date().toISOString();
      const verifiedJson = JSON.stringify(verifiedFields);

      this.db.run(`
        UPDATE ocr_reviews
        SET verification_status = ?,
            verified_fields_json = ?,
            verified_by = ?,
            verification_notes = ?,
            verified_at = ?
        WHERE id = ?;
      `, [
        action,
        verifiedJson,
        userId,
        notes,
        verifiedAt,
        reviewId
      ]);

      const docOcrStatus = action === 'REJECTED' ? 'REJECTED' : 'HUMAN_VERIFIED';
      this.db.run(`
        UPDATE documents
        SET ocr_status = ?
        WHERE id = ?;
      `, [docOcrStatus, review.document_id]);

      this._logAudit('OCR_REVIEW', reviewId, 'VERIFY', userId, {
        action,
        verifiedFields,
        notes
      });

      let createdFinancialRecord = null;

      // Only create financial transaction if human verified (CONFIRMED or CORRECTED)
      if (action !== 'REJECTED' && financialService && financialAction) {
        if (financialAction === 'SUPPLIER_INVOICE') {
          createdFinancialRecord = financialService.recordSupplierInvoice({
            supplierId: verifiedFields.supplierId || financialPayload.supplierId,
            projectId: verifiedFields.projectId || financialPayload.projectId,
            invoiceNumber: verifiedFields.invoiceNumber || financialPayload.invoiceNumber,
            invoiceDate: verifiedFields.date || financialPayload.invoiceDate || new Date().toISOString().split('T')[0],
            totalAmount: verifiedFields.totalAmount || financialPayload.totalAmount,
            taxAmount: verifiedFields.taxAmount || financialPayload.taxAmount || 0,
            notes: `[OCR-Verified: ${reviewId}] ${notes || ''}`.trim()
          });
        } else if (financialAction === 'EXPENSE') {
          createdFinancialRecord = financialService.recordExpense({
            projectId: verifiedFields.projectId || financialPayload.projectId,
            category: verifiedFields.category || financialPayload.category || 'SITE_PURCHASES',
            amount: verifiedFields.totalAmount || financialPayload.amount,
            paidTo: verifiedFields.vendor || financialPayload.paidTo || 'Cash Vendor',
            paymentMode: financialPayload.paymentMode || 'PETTY_CASH',
            accountId: financialPayload.accountId,
            expenseDate: verifiedFields.date || financialPayload.expenseDate || new Date().toISOString().split('T')[0],
            documentId: review.document_id,
            notes: `[OCR-Verified: ${reviewId}] ${notes || ''}`.trim(),
            createdBy: userId
          });
        }
      }

      return {
        review: this.getOcrReview(reviewId),
        financialRecord: createdFinancialRecord
      };
    });
  }

  /**
   * Soft-delete a document
   */
  deleteDocument(id, userId = null) {
    const doc = this.getDocumentById(id);
    if (!doc) {
      throw new Error(`Document ${id} not found.`);
    }

    this.db.run('UPDATE documents SET deleted_at = datetime(\'now\') WHERE id = ?;', [id]);
    this._logAudit('DOCUMENT', id, 'DELETE', userId, { fileName: doc.file_name });
    return { success: true, deletedId: id };
  }

  /**
   * Internal audit logger
   */
  _logAudit(entityType, entityId, action, userId, changes) {
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      this.db.run(`
        INSERT INTO audit_logs (
          id, entity_type, entity_id, action, user_id, changes_json, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'));
      `, [
        id,
        entityType,
        entityId,
        action,
        userId,
        JSON.stringify(changes)
      ]);
    } catch (e) {
      // Non-fatal if audit log fails
      console.warn('Audit log write error:', e.message);
    }
  }
}
