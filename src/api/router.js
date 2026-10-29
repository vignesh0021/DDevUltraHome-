/**
 * DDevUltraHome — Business Management API Router
 * 
 * Exposes unified REST endpoints for:
 * 1. Authentication & RBAC (Owner, Accountant, Site Manager, Engineer, Client)
 * 2. Executive Dashboard (KPIs, cash, receivables, payables, advances)
 * 3. Projects & Clients Directory
 * 4. Quotations & Milestone Billing
 * 5. Receipts & Advance Revenue Allocations
 * 6. Expenses, Petty Cash & Purchases
 * 7. Suppliers, Invoices & Accounts Payable
 * 8. Progress Tracking & Daily Site Logs
 * 9. Document Vault, Watermarking & Human OCR Verification Gate
 * 10. Financial Reports (P&L, Cashflow, Supplier Aging)
 * 11. Backup & Cloud Sync Status
 * 12. Company Profile & Account Settings
 */

import { defaultDb } from '../database/connection.js';
import { MigrationRunner } from '../database/migrationRunner.js';
import { AuthService } from '../services/authService.js';
import { FinancialService } from '../services/financialService.js';
import { DocumentService } from '../services/documentService.js';
import { SyncService } from '../services/syncService.js';
import { QuotationService } from '../services/quotationService.js';

export class BusinessApiRouter {
  constructor(db = null) {
    this.db = db || defaultDb;
    this.authService = new AuthService(this.db);
    this.financialService = new FinancialService(this.db);
    this.documentService = new DocumentService(this.db);
    this.syncService = new SyncService(this.db);
    this.quotationService = new QuotationService(this.db);

    // Ensure migrations are up-to-date
    try {
      const runner = new MigrationRunner(this.db);
      runner.runMigrations();
    } catch (e) {
      console.warn('Migration run notice in router:', e.message);
    }
  }

  /**
   * Route and dispatch an API request
   * @param {string} pathname 
   * @param {string} method 
   * @param {Object} body 
   * @param {Object} query 
   * @param {Object} context { user, token }
   */
  async handle(pathname, method, body = {}, query = {}, context = {}) {
    const rawRoute = pathname.replace(/^\/api\/business/, '');
    const [routePath, queryString] = rawRoute.split('?');
    const route = routePath;
    if (queryString) {
      const parsedParams = new URLSearchParams(queryString);
      for (const [k, v] of parsedParams.entries()) {
        if (query[k] === undefined) query[k] = v;
      }
    }

    // 1. Authentication routes (no auth required)
    if (route === '/auth/login' && method === 'POST') {
      const session = this.authService.authenticate(body.email, body.password);
      return { status: 200, data: { success: true, ...session } };
    }

    if (route === '/auth/roles' && method === 'GET') {
      const roles = this.authService.listUsersWithRoles();
      return { status: 200, data: { success: true, roles } };
    }

    // Role simulation / switch helper for demonstration & tests
    if (route === '/auth/switch-role' && method === 'POST') {
      const { role } = body;
      const targetUser = this.db.queryOne('SELECT * FROM users WHERE role = ? AND is_active = 1 LIMIT 1;', [role]);
      if (!targetUser) {
        return { status: 404, data: { success: false, error: `No active user found with role ${role}` } };
      }
      return {
        status: 200,
        data: {
          success: true,
          user: {
            id: targetUser.id,
            email: targetUser.email,
            fullName: targetUser.full_name,
            role: targetUser.role
          }
        }
      };
    }

    // 2. Dashboard KPIs
    if (route === '/dashboard/summary' && method === 'GET') {
      const summary = this.financialService.getExecutiveDashboardSummary();
      const activeProjects = this.db.queryOne("SELECT COUNT(*) as count FROM projects WHERE status = 'ACTIVE' AND deleted_at IS NULL;").count;
      const totalClients = this.db.queryOne("SELECT COUNT(*) as count FROM clients WHERE deleted_at IS NULL;").count;
      const pendingOcrCount = this.db.queryOne("SELECT COUNT(*) as count FROM ocr_reviews WHERE verification_status = 'UNVERIFIED';").count;
      const company = this.db.queryOne("SELECT * FROM company_settings LIMIT 1;");

      return {
        status: 200,
        data: {
          success: true,
          dashboard: {
            ...summary,
            liquidCash: summary.totalLiquidFunds,
            activeProjects,
            totalClients,
            pendingOcrCount,
            companyName: company ? company.company_name : 'D DEV ULTRA HOMES',
            tagline: company ? company.tagline : 'Building your dreams'
          }
        }
      };
    }

    // 3. Projects
    if (route === '/projects' && method === 'GET') {
      const { status } = query;
      let sql = `
        SELECT p.*, c.name as client_name, c.phone as client_phone
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.deleted_at IS NULL
      `;
      const params = [];
      if (status) {
        sql += ' AND p.status = ?';
        params.push(status);
      }
      sql += ' ORDER BY p.created_at DESC;';
      const projects = this.db.query(sql, params);
      return { status: 200, data: { success: true, projects } };
    }

    if (route === '/projects' && method === 'POST') {
      const { name, client_id, project_code, site_address, district, contract_value, budgeted_cost } = body;
      const id = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const pCode = project_code || `PRJ-${Date.now().toString().slice(-4)}`;

      this.db.run(`
        INSERT INTO projects (
          id, project_code, name, client_id, site_address,
          district, contract_value, budgeted_cost, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'));
      `, [id, pCode, name, client_id, site_address || '', district || 'Chennai', contract_value || 0, budgeted_cost || 0]);

      const project = this.db.queryOne('SELECT * FROM projects WHERE id = ?;', [id]);
      return { status: 201, data: { success: true, project } };
    }

    if (route.startsWith('/projects/') && method === 'GET') {
      const prjId = route.replace('/projects/', '');
      const project = this.db.queryOne(`
        SELECT p.*, c.name as client_name, c.phone as client_phone, c.email as client_email
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.id = ?;
      `, [prjId]);

      if (!project) return { status: 404, data: { success: false, error: 'Project not found' } };

      const pnl = this.financialService.getProjectPnL(prjId);
      const milestones = this.db.query('SELECT * FROM milestones WHERE project_id = ? ORDER BY target_percentage ASC;', [prjId]);
      const updates = this.db.query('SELECT * FROM progress_updates WHERE project_id = ? ORDER BY report_date DESC LIMIT 5;', [prjId]);

      return {
        status: 200,
        data: {
          success: true,
          project,
          financials: pnl.financials,
          milestones,
          recentProgress: updates
        }
      };
    }

    // 4. Clients
    if (route === '/clients' && method === 'GET') {
      const clients = this.db.query(`
        SELECT c.*, 
          COUNT(p.id) as project_count,
          COALESCE(SUM(p.contract_value), 0.0) as total_contract_value
        FROM clients c
        LEFT JOIN projects p ON p.client_id = c.id AND p.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.created_at DESC;
      `);
      return { status: 200, data: { success: true, clients } };
    }

    if (route === '/clients' && method === 'POST') {
      const { name, company_name, phone, email, billing_address, gstin, pan } = body;
      const id = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO clients (
          id, name, company_name, phone, email,
          billing_address, gstin, pan, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
      `, [id, name, company_name, phone, email, billing_address, gstin, pan]);

      const client = this.db.queryOne('SELECT * FROM clients WHERE id = ?;', [id]);
      return { status: 201, data: { success: true, client } };
    }

    // 5. Quotations & Revisions
    if (route === '/quotations' && method === 'GET') {
      const quotations = this.quotationService.listQuotations(query);
      return { status: 200, data: { success: true, quotations } };
    }

    if (route === '/quotations' && method === 'POST') {
      try {
        const quotation = this.quotationService.createQuotation(body);
        return { status: 201, data: { success: true, quotation } };
      } catch (err) {
        return { status: 400, data: { success: false, error: err.message } };
      }
    }

    if (route.startsWith('/quotations/') && route.endsWith('/html') && method === 'GET') {
      const qId = route.replace('/quotations/', '').replace('/html', '');
      try {
        const html = this.quotationService.generatePrintableHtml(qId);
        return { status: 200, data: { success: true, html } };
      } catch (err) {
        return { status: 404, data: { success: false, error: err.message } };
      }
    }

    if (route.startsWith('/quotations/') && route.endsWith('/status') && (method === 'POST' || method === 'PATCH')) {
      const qId = route.replace('/quotations/', '').replace('/status', '');
      try {
        const quotation = this.quotationService.updateStatus(qId, body.status, context?.user?.id);
        return { status: 200, data: { success: true, quotation } };
      } catch (err) {
        return { status: 400, data: { success: false, error: err.message } };
      }
    }

    if (route.startsWith('/quotations/') && route.endsWith('/revision') && method === 'POST') {
      const qId = route.replace('/quotations/', '').replace('/revision', '');
      try {
        const quotation = this.quotationService.createRevision(qId, context?.user?.id);
        return { status: 201, data: { success: true, quotation } };
      } catch (err) {
        return { status: 400, data: { success: false, error: err.message } };
      }
    }

    if (route.startsWith('/quotations/') && method === 'GET') {
      const qId = route.replace('/quotations/', '');
      const quotation = this.quotationService.getQuotationById(qId);
      if (!quotation) {
        return { status: 404, data: { success: false, error: 'Quotation not found' } };
      }
      return { status: 200, data: { success: true, quotation } };
    }

    // 6. Income & Client Receipts
    if (route === '/income/receipts' && method === 'GET') {
      const { projectId } = query;
      let sql = `
        SELECT r.*, p.name as project_name, c.name as client_name, a.account_name
        FROM client_receipts r
        JOIN projects p ON r.project_id = p.id
        JOIN clients c ON r.client_id = c.id
        JOIN financial_accounts a ON r.account_id = a.id
        WHERE 1=1
      `;
      const params = [];
      if (projectId) {
        sql += ' AND r.project_id = ?';
        params.push(projectId);
      }
      sql += ' ORDER BY r.receipt_date DESC;';
      const receipts = this.db.query(sql, params);
      return { status: 200, data: { success: true, receipts } };
    }

    if (route === '/income/receipts' && method === 'POST') {
      const receipt = this.financialService.recordClientReceipt(body);
      return { status: 201, data: { success: true, receipt } };
    }

    if (route === '/income/allocate' && method === 'POST') {
      const allocation = this.financialService.allocateAdvanceToMilestone(body);
      return { status: 200, data: { success: true, allocation } };
    }

    // 7. Expenses
    if (route === '/expenses' && method === 'GET') {
      const { projectId, category } = query;
      let sql = `
        SELECT e.*, p.name as project_name, a.account_name
        FROM expenses e
        LEFT JOIN projects p ON e.project_id = p.id
        JOIN financial_accounts a ON e.account_id = a.id
        WHERE e.deleted_at IS NULL
      `;
      const params = [];
      if (projectId) {
        sql += ' AND e.project_id = ?';
        params.push(projectId);
      }
      if (category) {
        sql += ' AND e.category = ?';
        params.push(category);
      }
      sql += ' ORDER BY e.expense_date DESC;';
      const expenses = this.db.query(sql, params);
      return { status: 200, data: { success: true, expenses } };
    }

    if (route === '/expenses' && method === 'POST') {
      const expense = this.financialService.recordExpense(body);
      return { status: 201, data: { success: true, expense } };
    }

    // 8. Suppliers & Invoices
    if (route === '/suppliers' && method === 'GET') {
      const suppliers = this.db.query(`
        SELECT s.*, 
          COALESCE(SUM(i.total_amount), 0.0) as total_invoiced,
          COALESCE(SUM(i.balance_amount), 0.0) as outstanding_invoices
        FROM suppliers s
        LEFT JOIN supplier_invoices i ON i.supplier_id = s.id AND i.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
        GROUP BY s.id
        ORDER BY s.outstanding_dues DESC;
      `);
      return { status: 200, data: { success: true, suppliers } };
    }

    if (route === '/suppliers' && method === 'POST') {
      const { name, category, contact_person, phone, email, address, gstin } = body;
      const id = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO suppliers (
          id, name, category, contact_person, phone,
          email, address, gstin, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
      `, [id, name, category || 'GENERAL', contact_person, phone, email, address, gstin]);

      const supplier = this.db.queryOne('SELECT * FROM suppliers WHERE id = ?;', [id]);
      return { status: 201, data: { success: true, supplier } };
    }

    if (route === '/suppliers/invoices' && method === 'GET') {
      const { supplierId, projectId, status } = query;
      let sql = `
        SELECT i.*, s.name as supplier_name, p.name as project_name
        FROM supplier_invoices i
        JOIN suppliers s ON i.supplier_id = s.id
        LEFT JOIN projects p ON i.project_id = p.id
        WHERE i.deleted_at IS NULL
      `;
      const params = [];
      if (supplierId) {
        sql += ' AND i.supplier_id = ?';
        params.push(supplierId);
      }
      if (projectId) {
        sql += ' AND i.project_id = ?';
        params.push(projectId);
      }
      if (status) {
        sql += ' AND i.payment_status = ?';
        params.push(status);
      }
      sql += ' ORDER BY i.invoice_date DESC;';
      const invoices = this.db.query(sql, params);
      return { status: 200, data: { success: true, invoices } };
    }

    if (route === '/suppliers/invoices' && method === 'POST') {
      try {
        const invoice = this.financialService.recordSupplierInvoice(body);
        return { status: 201, data: { success: true, invoice } };
      } catch (err) {
        return { status: 400, data: { success: false, error: err.message } };
      }
    }

    if (route === '/suppliers/payments' && method === 'POST') {
      try {
        const payment = this.financialService.recordSupplierPayment(body);
        return { status: 200, data: { success: true, payment } };
      } catch (err) {
        return { status: 400, data: { success: false, error: err.message } };
      }
    }

    // 9. Milestones & Progress
    if (route === '/milestones' && method === 'GET') {
      const { projectId } = query;
      const milestones = this.db.query('SELECT * FROM milestones WHERE project_id = ? ORDER BY target_percentage ASC;', [projectId]);
      return { status: 200, data: { success: true, milestones } };
    }

    if (route === '/milestones' && method === 'POST') {
      const { projectId, title, milestoneCode, targetPercentage, invoicePercentage, invoiceAmount } = body;
      const id = `mls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const mCode = milestoneCode || `M-${Date.now().toString().slice(-4)}`;

      this.db.run(`
        INSERT INTO milestones (
          id, project_id, milestone_code, title, target_percentage, invoice_percentage, invoice_amount, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED');
      `, [id, projectId, mCode, title, targetPercentage || 0, invoicePercentage || 0, invoiceAmount || 0]);

      const milestone = this.db.queryOne('SELECT * FROM milestones WHERE id = ?;', [id]);
      return { status: 201, data: { success: true, milestone } };
    }

    if (route === '/progress' && method === 'GET') {
      const { projectId } = query;
      const updates = this.db.query(`
        SELECT u.*, m.name as milestone_name, p.name as project_name
        FROM progress_updates u
        JOIN projects p ON u.project_id = p.id
        LEFT JOIN milestones m ON u.milestone_id = m.id
        WHERE u.project_id = ?
        ORDER BY u.report_date DESC;
      `, [projectId]);
      return { status: 200, data: { success: true, updates } };
    }

    if (route === '/progress' && method === 'POST') {
      const { projectId, milestoneId, reportDate, completionPercentage, siteNotes, weatherCondition, workforceCount, delayReason, recordedBy } = body;
      const id = `prog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO progress_updates (
          id, project_id, milestone_id, report_date, completion_percentage,
          site_notes, weather_condition, workforce_count, delay_reason, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [id, projectId, milestoneId, reportDate || new Date().toISOString().split('T')[0], completionPercentage, siteNotes, weatherCondition, workforceCount || 0, delayReason, recordedBy]);

      return { status: 201, data: { success: true, id } };
    }

    // 10. Documents & OCR
    if (route === '/documents' && method === 'GET') {
      const documents = this.documentService.listDocuments(query);
      return { status: 200, data: { success: true, documents } };
    }

    if (route === '/documents' && method === 'POST') {
      const doc = this.documentService.registerDocument(body);
      return { status: 201, data: { success: true, document: doc } };
    }

    if (route === '/documents/watermark-svg' && method === 'GET') {
      const svg = this.documentService.generateWatermarkSvg(query);
      return { status: 200, data: { success: true, svg } };
    }

    if (route === '/ocr/reviews' && method === 'GET') {
      const reviews = this.documentService.listOcrReviews(query);
      return { status: 200, data: { success: true, reviews } };
    }

    if (route === '/ocr/extract' && method === 'POST') {
      const review = this.documentService.processOcrExtraction(body);
      return { status: 201, data: { success: true, review } };
    }

    if (route === '/ocr/verify' && method === 'POST') {
      const result = this.documentService.humanVerifyOcrTransaction({
        ...body,
        financialService: this.financialService
      });
      return { status: 200, data: { success: true, ...result } };
    }

    // 11. Financial Reports
    if (route === '/reports/pnl' && method === 'GET') {
      const { projectId } = query;
      if (!projectId) {
        return { status: 400, data: { success: false, error: 'projectId is required for P&L report' } };
      }
      const pnl = this.financialService.getProjectPnL(projectId);
      return { status: 200, data: { success: true, pnl } };
    }

    if (route === '/reports/financial-summary' && method === 'GET') {
      const summary = this.financialService.getExecutiveDashboardSummary();
      return { status: 200, data: { success: true, summary } };
    }

    // 12. Backup & Sync
    if (route === '/backup/snapshot' && method === 'GET') {
      const snapshot = this.syncService.generateBackupSnapshot();
      return { status: 200, data: { success: true, ...snapshot } };
    }

    if (route === '/backup/restore' && method === 'POST') {
      const result = this.syncService.restoreFromSnapshot(body.snapshot);
      return { status: 200, data: { success: true, result } };
    }

    if (route === '/backup/sync' && method === 'POST') {
      const result = await this.syncService.syncWithCloud(body);
      return { status: 200, data: { success: true, result } };
    }

    if (route === '/backup/status' && method === 'GET') {
      const status = this.syncService.getSyncStatus();
      return { status: 200, data: { success: true, status } };
    }

    // 13. Settings & Financial Accounts
    if (route === '/settings/company' && method === 'GET') {
      const company = this.db.queryOne('SELECT * FROM company_settings LIMIT 1;');
      const accounts = this.db.query('SELECT * FROM financial_accounts WHERE is_active = 1;');
      return { status: 200, data: { success: true, company, accounts } };
    }

    if (route === '/settings/company' && method === 'PUT') {
      const { company_name, tagline, phone, email, address, gstin, pan } = body;
      this.db.run(`
        UPDATE company_settings
        SET company_name = ?, tagline = ?, phone = ?, email = ?,
            address = ?, gstin = ?, pan = ?, updated_at = datetime('now')
        WHERE id = 'company-main';
      `, [company_name, tagline, phone, email, address, gstin, pan]);

      const company = this.db.queryOne('SELECT * FROM company_settings LIMIT 1;');
      return { status: 200, data: { success: true, company } };
    }

    return { status: 404, data: { success: false, error: `Route not found: ${method} ${pathname}` } };
  }
}
