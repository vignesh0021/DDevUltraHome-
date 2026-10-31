/**
 * DDevUltraHome — Construction Financial & Accounting Integrity Service
 * 
 * Enforces fundamental civil construction business accounting rules:
 * 1. Client advances are unearned liability deposits, NEVER treated as profit or earned revenue.
 * 2. Unpaid supplier invoices are accounts payable, NEVER treated as cash payments.
 * 3. Revenue is earned as project milestones are certified and completed.
 * 4. All inflows and outflows generate double-entry audit records in account_transactions.
 */

import { SafeMath } from '../engine/math.js';

export class FinancialService {
  constructor(dbConnection) {
    this.db = dbConnection;
  }

  /**
   * Record a Client Payment / Advance Receipt
   * @param {Object} data
   * @returns {Object} Created receipt and transaction metadata
   */
  recordClientReceipt(data) {
    const {
      projectId,
      clientId,
      contractId = null,
      amount,
      paymentMode,
      referenceNumber = '',
      receiptDate,
      accountId,
      isAdvance = 0,
      notes = '',
      createdBy = null
    } = data;

    const targetProjectId = projectId || 'prj-business-overhead';

    if (!clientId || !accountId || !amount || amount <= 0) {
      throw new Error('Missing required fields: clientId, accountId, and positive amount are mandatory.');
    }

    return this.db.transaction(() => {
      // 1. Verify account exists
      const account = this.db.queryOne('SELECT id, current_balance, currency FROM financial_accounts WHERE id = ?;', [accountId]);
      if (!account) {
        throw new Error(`Financial account with ID ${accountId} not found.`);
      }

      // 2. Generate unique receipt number
      const countRow = this.db.queryOne('SELECT COUNT(*) as cnt FROM client_receipts;');
      const seq = (countRow.cnt + 1).toString().padStart(4, '0');
      const receiptNumber = `REC-${new Date().getFullYear()}-${seq}`;
      const receiptId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const unallocatedBalance = isAdvance ? amount : 0.00;

      this.db.run(`
        INSERT INTO client_receipts (
          id, receipt_number, project_id, client_id, contract_id,
          amount, payment_mode, reference_number, receipt_date,
          account_id, is_advance, allocated_amount, unallocated_balance,
          notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, datetime('now'));
      `, [
        receiptId, receiptNumber, targetProjectId, clientId, contractId,
        amount, paymentMode, referenceNumber, receiptDate || new Date().toISOString().split('T')[0],
        accountId, isAdvance ? 1 : 0, unallocatedBalance, notes, createdBy
      ]);

      // 3. Update account balance (Debit cash/bank = Increase asset)
      const newBalance = SafeMath.round(account.current_balance + amount, 2);
      this.db.run('UPDATE financial_accounts SET current_balance = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newBalance, accountId]);

      // 4. Record audit transaction
      const txSeq = (this.db.queryOne('SELECT COUNT(*) as cnt FROM account_transactions;').cnt + 1).toString().padStart(5, '0');
      const txNumber = `TXN-${new Date().getFullYear()}-${txSeq}`;
      const txId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO account_transactions (
          id, transaction_number, account_id, project_id,
          transaction_type, amount, balance_after,
          reference_type, reference_id, transaction_date, notes
        ) VALUES (?, ?, ?, ?, 'CREDIT', ?, ?, 'CLIENT_RECEIPT', ?, ?, ?);
      `, [
        txId, txNumber, accountId, projectId,
        amount, newBalance, receiptId, receiptDate || new Date().toISOString().split('T')[0],
        isAdvance ? `Client Advance: ${notes}` : `Milestone Receipt: ${notes}`
      ]);

      return {
        receiptId,
        receiptNumber,
        amount,
        isAdvance: Boolean(isAdvance),
        unallocatedBalance,
        newAccountBalance: newBalance
      };
    });
  }

  /**
   * Allocate advance receipt towards a completed milestone invoice
   */
  allocateAdvanceToMilestone(receiptId, milestoneId, amountToAllocate) {
    if (!receiptId || !milestoneId || !amountToAllocate || amountToAllocate <= 0) {
      throw new Error('Valid receiptId, milestoneId, and positive allocation amount required.');
    }

    return this.db.transaction(() => {
      const receipt = this.db.queryOne('SELECT * FROM client_receipts WHERE id = ?;', [receiptId]);
      if (!receipt) throw new Error(`Receipt ${receiptId} not found.`);

      if (!receipt.is_advance) {
        throw new Error('Only unallocated advance receipts can be allocated against milestones.');
      }

      if (amountToAllocate > receipt.unallocated_balance) {
        throw new Error(`Requested allocation ₹${amountToAllocate} exceeds unallocated advance balance of ₹${receipt.unallocated_balance}.`);
      }

      const milestone = this.db.queryOne('SELECT * FROM milestones WHERE id = ?;', [milestoneId]);
      if (!milestone) throw new Error(`Milestone ${milestoneId} not found.`);

      const allocId = `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      this.db.run(`
        INSERT INTO receipt_allocations (id, receipt_id, milestone_id, allocated_amount, notes)
        VALUES (?, ?, ?, ?, ?);
      `, [allocId, receiptId, milestoneId, amountToAllocate, `Allocated advance to milestone: ${milestone.title}`]);

      const newAllocated = SafeMath.round(receipt.allocated_amount + amountToAllocate, 2);
      const newUnallocated = SafeMath.round(receipt.unallocated_balance - amountToAllocate, 2);

      this.db.run(`
        UPDATE client_receipts
        SET allocated_amount = ?, unallocated_balance = ?
        WHERE id = ?;
      `, [newAllocated, newUnallocated, receiptId]);

      return {
        allocationId: allocId,
        milestoneId,
        allocatedAmount: amountToAllocate,
        remainingAdvanceBalance: newUnallocated
      };
    });
  }

  /**
   * Record a Supplier Invoice (Accounts Payable created, cash balance unchanged)
   */
  recordSupplierInvoice(data) {
    const {
      invoiceNumber,
      supplierId,
      projectId,
      invoiceDate,
      dueDate,
      subtotal,
      taxAmount = 0.00,
      totalAmount,
      documentId = null,
      notes = ''
    } = data;

    if (!invoiceNumber || !supplierId || !projectId || !totalAmount || totalAmount <= 0) {
      throw new Error('Valid invoiceNumber, supplierId, projectId, and positive totalAmount required.');
    }

    return this.db.transaction(() => {
      const supplier = this.db.queryOne('SELECT id, current_dues FROM suppliers WHERE id = ?;', [supplierId]);
      if (!supplier) throw new Error(`Supplier ${supplierId} not found.`);

      const invoiceId = `sinv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO supplier_invoices (
          id, invoice_number, supplier_id, project_id, invoice_date, due_date,
          subtotal, tax_amount, total_amount, paid_amount, balance_amount,
          payment_status, document_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'UNPAID', ?, ?);
      `, [
        invoiceId, invoiceNumber, supplierId, projectId,
        invoiceDate || new Date().toISOString().split('T')[0],
        dueDate || invoiceDate || new Date().toISOString().split('T')[0],
        subtotal || totalAmount, taxAmount, totalAmount, totalAmount,
        documentId, notes
      ]);

      // Increase supplier outstanding dues
      const newDues = SafeMath.round(supplier.current_dues + totalAmount, 2);
      this.db.run('UPDATE suppliers SET current_dues = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newDues, supplierId]);

      return {
        invoiceId,
        invoiceNumber,
        totalAmount,
        paymentStatus: 'UNPAID',
        supplierCurrentDues: newDues
      };
    });
  }

  /**
   * Record Supplier Payment (Cash/Bank Outflow and Payable reduction)
   */
  recordSupplierPayment(data) {
    const {
      supplierId,
      invoiceId = null,
      projectId,
      accountId,
      amount,
      paymentMode,
      referenceNumber = '',
      paymentDate,
      notes = '',
      createdBy = null
    } = data;

    if (!supplierId || !projectId || !accountId || !amount || amount <= 0) {
      throw new Error('Valid supplierId, projectId, accountId, and positive amount are required.');
    }

    return this.db.transaction(() => {
      const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [accountId]);
      if (!account) throw new Error(`Account ${accountId} not found.`);

      if (account.current_balance < amount) {
        throw new Error(`Insufficient funds: Account balance ₹${account.current_balance} is less than payment ₹${amount}.`);
      }

      const supplier = this.db.queryOne('SELECT id, current_dues FROM suppliers WHERE id = ?;', [supplierId]);
      if (!supplier) throw new Error(`Supplier ${supplierId} not found.`);

      const paySeq = (this.db.queryOne('SELECT COUNT(*) as cnt FROM supplier_payments;').cnt + 1).toString().padStart(4, '0');
      const paymentNumber = `SPAY-${new Date().getFullYear()}-${paySeq}`;
      const paymentId = `spay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO supplier_payments (
          id, payment_number, supplier_id, invoice_id, project_id,
          account_id, amount, payment_mode, reference_number,
          payment_date, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        paymentId, paymentNumber, supplierId, invoiceId, projectId,
        accountId, amount, paymentMode, referenceNumber,
        paymentDate || new Date().toISOString().split('T')[0], notes, createdBy
      ]);

      // Deduct from bank/cash account
      const newAccountBalance = SafeMath.round(account.current_balance - amount, 2);
      this.db.run('UPDATE financial_accounts SET current_balance = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newAccountBalance, accountId]);

      // Deduct from supplier dues
      const newDues = SafeMath.round(Math.max(0, supplier.current_dues - amount), 2);
      this.db.run('UPDATE suppliers SET current_dues = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newDues, supplierId]);

      // If specific invoice targeted, update invoice balance
      if (invoiceId) {
        const inv = this.db.queryOne('SELECT paid_amount, total_amount FROM supplier_invoices WHERE id = ?;', [invoiceId]);
        if (inv) {
          const newPaid = SafeMath.round(inv.paid_amount + amount, 2);
          const newBalance = SafeMath.round(Math.max(0, inv.total_amount - newPaid), 2);
          const status = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          this.db.run(`
            UPDATE supplier_invoices
            SET paid_amount = ?, balance_amount = ?, payment_status = ?, updated_at = datetime('now')
            WHERE id = ?;
          `, [newPaid, newBalance, status, invoiceId]);
        }
      }

      // Record double-entry transaction
      const txSeq = (this.db.queryOne('SELECT COUNT(*) as cnt FROM account_transactions;').cnt + 1).toString().padStart(5, '0');
      const txNumber = `TXN-${new Date().getFullYear()}-${txSeq}`;
      const txId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO account_transactions (
          id, transaction_number, account_id, project_id,
          transaction_type, amount, balance_after,
          reference_type, reference_id, transaction_date, notes
        ) VALUES (?, ?, ?, ?, 'DEBIT', ?, ?, 'SUPPLIER_PAYMENT', ?, ?, ?);
      `, [
        txId, txNumber, accountId, projectId,
        amount, newAccountBalance, paymentId,
        paymentDate || new Date().toISOString().split('T')[0],
        `Supplier Payment: ${notes}`
      ]);

      return {
        paymentId,
        paymentNumber,
        amount,
        newAccountBalance,
        supplierCurrentDues: newDues
      };
    });
  }

  /**
   * Record Direct Project Expense (Cash/Bank Outflow)
   */
  recordExpense(data) {
    const {
      projectId = null,
      category,
      amount,
      expenseDate,
      paidTo,
      paymentMode,
      accountId,
      supplierId = null,
      documentId = null,
      notes = '',
      createdBy = null
    } = data;

    const targetProjectId = projectId || 'prj-business-overhead';

    if (!category || !amount || amount <= 0 || !accountId || !paidTo) {
      throw new Error('Missing mandatory expense fields.');
    }

    return this.db.transaction(() => {
      const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [accountId]);
      if (!account) throw new Error(`Account ${accountId} not found.`);

      if (account.current_balance < amount) {
        throw new Error(`Insufficient funds in account: balance is ₹${account.current_balance}, expense is ₹${amount}.`);
      }

      const expSeq = (this.db.queryOne('SELECT COUNT(*) as cnt FROM expenses;').cnt + 1).toString().padStart(4, '0');
      const expenseNumber = `EXP-${new Date().getFullYear()}-${expSeq}`;
      const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO expenses (
          id, expense_number, project_id, category, amount,
          expense_date, paid_to, payment_mode, account_id,
          supplier_id, document_id, approval_status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?, ?);
      `, [
        expenseId, expenseNumber, targetProjectId, category, amount,
        expenseDate || new Date().toISOString().split('T')[0], paidTo,
        paymentMode, accountId, supplierId, documentId, notes, createdBy
      ]);

      // Deduct from account
      const newAccountBalance = SafeMath.round(account.current_balance - amount, 2);
      this.db.run('UPDATE financial_accounts SET current_balance = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newAccountBalance, accountId]);

      // Ledger transaction
      const txSeq = (this.db.queryOne('SELECT COUNT(*) as cnt FROM account_transactions;').cnt + 1).toString().padStart(5, '0');
      const txNumber = `TXN-${new Date().getFullYear()}-${txSeq}`;
      const txId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO account_transactions (
          id, transaction_number, account_id, project_id,
          transaction_type, amount, balance_after,
          reference_type, reference_id, transaction_date, notes
        ) VALUES (?, ?, ?, ?, 'DEBIT', ?, ?, 'EXPENSE', ?, ?, ?);
      `, [
        txId, txNumber, accountId, projectId,
        amount, newAccountBalance, expenseId,
        expenseDate || new Date().toISOString().split('T')[0],
        `Expense (${category}) to ${paidTo}: ${notes}`
      ]);

      return {
        id: expenseId,
        expenseId,
        expenseNumber,
        amount,
        category,
        newAccountBalance
      };
    });
  }

  /**
   * Get Project Profit & Loss with Strict Revenue Recognition
   * Revenue = Only earned milestone billings (Advances excluded until allocated)
   * Costs = Direct expenses + Supplier Invoices incurred
   */
  getProjectPnL(projectId) {
    const project = this.db.queryOne('SELECT * FROM projects WHERE id = ?;', [projectId]);
    if (!project) throw new Error(`Project ${projectId} not found.`);

    // 1. Total Advances Received vs Allocated
    const receiptsSummary = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(amount), 0.00) as total_cash_received,
        COALESCE(SUM(CASE WHEN is_advance = 1 THEN amount ELSE 0.00 END), 0.00) as total_advances_received,
        COALESCE(SUM(CASE WHEN is_advance = 1 THEN unallocated_balance ELSE 0.00 END), 0.00) as unearned_advance_liability,
        COALESCE(SUM(CASE WHEN is_advance = 0 THEN amount ELSE allocated_amount END), 0.00) as earned_revenue
      FROM client_receipts
      WHERE project_id = ? AND deleted_at IS NULL;
    `, [projectId]);

    // 2. Direct Expenses
    const expensesSummary = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(amount), 0.00) as total_direct_expenses
      FROM expenses
      WHERE project_id = ? AND deleted_at IS NULL;
    `, [projectId]);

    // 3. Supplier Invoices Incurred
    const invoicesSummary = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(total_amount), 0.00) as total_supplier_cost,
        COALESCE(SUM(paid_amount), 0.00) as supplier_cost_paid,
        COALESCE(SUM(balance_amount), 0.00) as supplier_cost_payable
      FROM supplier_invoices
      WHERE project_id = ? AND deleted_at IS NULL;
    `, [projectId]);

    const earnedRevenue = SafeMath.round(receiptsSummary.earned_revenue, 2);
    const unearnedAdvanceLiability = SafeMath.round(receiptsSummary.unearned_advance_liability, 2);
    const totalCashReceived = SafeMath.round(receiptsSummary.total_cash_received, 2);

    const totalDirectExpenses = SafeMath.round(expensesSummary.total_direct_expenses, 2);
    const totalSupplierCost = SafeMath.round(invoicesSummary.total_supplier_cost, 2);
    const totalIncurredCost = SafeMath.round(totalDirectExpenses + totalSupplierCost, 2);

    const operatingProfit = SafeMath.round(earnedRevenue - totalIncurredCost, 2);
    const profitMarginPercentage = earnedRevenue > 0 ? SafeMath.round((operatingProfit / earnedRevenue) * 100, 2) : 0.00;

    return {
      projectId: project.id,
      projectName: project.name,
      contractValue: project.contract_value,
      budgetedCost: project.budgeted_cost,
      financials: {
        totalCashReceived,
        earnedRevenue,
        unearnedAdvanceLiability,
        totalIncurredCost,
        breakdown: {
          directExpenses: totalDirectExpenses,
          supplierInvoices: totalSupplierCost,
          supplierPaid: SafeMath.round(invoicesSummary.supplier_cost_paid, 2),
          supplierPayable: SafeMath.round(invoicesSummary.supplier_cost_payable, 2)
        },
        operatingProfit,
        profitMarginPercentage
      }
    };
  }

  /**
   * Get Executive Company Cashflow & Liquidity Summary
   */
  getExecutiveDashboardSummary() {
    // 1. Total liquid cash across all accounts
    const liquidity = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(current_balance), 0.00) as total_liquid_funds,
        COALESCE(SUM(CASE WHEN account_type = 'BANK' THEN current_balance ELSE 0.00 END), 0.00) as bank_balance,
        COALESCE(SUM(CASE WHEN account_type != 'BANK' THEN current_balance ELSE 0.00 END), 0.00) as cash_balance
      FROM financial_accounts
      WHERE is_active = 1;
    `);

    // 2. Active Projects overview
    const projects = this.db.queryOne(`
      SELECT 
        COUNT(*) as total_projects,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END), 0) as active_projects,
        COALESCE(SUM(contract_value), 0.00) as total_contract_value
      FROM projects
      WHERE deleted_at IS NULL;
    `);

    // 3. Outstanding Payables (Supplier Dues)
    const payables = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(balance_amount), 0.00) as total_accounts_payable
      FROM supplier_invoices
      WHERE payment_status != 'PAID' AND deleted_at IS NULL;
    `);

    // 4. Client Advance Liabilities (Unearned money held)
    const advances = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(unallocated_balance), 0.00) as total_unearned_advances
      FROM client_receipts
      WHERE is_advance = 1 AND deleted_at IS NULL;
    `);

    // 5. Total Earned Revenue & Expenses
    const revenue = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN is_advance = 0 THEN amount ELSE allocated_amount END), 0.00) as total_earned_revenue
      FROM client_receipts
      WHERE deleted_at IS NULL;
    `);

    const expenses = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(amount), 0.00) as total_expenses
      FROM expenses
      WHERE deleted_at IS NULL;
    `);

    const netOperatingCashflow = SafeMath.round(
      (revenue.total_earned_revenue || 0) - (expenses.total_expenses || 0) - (payables.total_accounts_payable || 0),
      2
    );

    // 6. Total Income Received
    const incomeRow = this.db.queryOne(`
      SELECT COALESCE(SUM(amount), 0.00) as total_income
      FROM client_receipts
      WHERE deleted_at IS NULL;
    `);
    const totalIncomeReceived = SafeMath.round(incomeRow?.total_income || 0, 2);

    // 7. Outstanding Client Payments
    const outstandingClientPayments = SafeMath.round(Math.max(0, (projects?.total_contract_value || 0) - totalIncomeReceived), 2);

    // 8. Labour Wages Payable
    let labourWagesPayable = 0;
    try {
      const labourEarned = this.db.queryOne(`
        SELECT COALESCE(SUM(earned_amount + overtime_amount), 0.00) as earned
        FROM labour_attendance;
      `);
      const labourPaid = this.db.queryOne(`
        SELECT COALESCE(SUM(amount), 0.00) as paid
        FROM labour_payments
        WHERE deleted_at IS NULL;
      `);
      labourWagesPayable = SafeMath.round(Math.max(0, (labourEarned?.earned || 0) - (labourPaid?.paid || 0)), 2);
    } catch (_) {}

    // 9. Today's Attendance Summary
    let todayAttendance = { totalPresent: 0, workersPresent: [] };
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayAttRows = this.db.query(`
        SELECT a.*, w.name, w.trade
        FROM labour_attendance a
        JOIN labour_workers w ON a.worker_id = w.id
        WHERE a.attendance_date = ? AND a.status IN ('PRESENT', 'HALF_DAY');
      `, [todayStr]);
      todayAttendance = {
        totalPresent: todayAttRows.length,
        workersPresent: todayAttRows.map(r => ({ name: r.name, trade: r.trade, status: r.status }))
      };
    } catch (_) {}

    return {
      totalLiquidFunds: SafeMath.round(liquidity.total_liquid_funds, 2),
      bankBalance: SafeMath.round(liquidity.bank_balance, 2),
      cashBalance: SafeMath.round(liquidity.cash_balance, 2),
      activeProjectsCount: projects.active_projects,
      totalProjectsCount: projects.total_projects,
      totalContractValue: SafeMath.round(projects.total_contract_value, 2),
      accountsPayable: SafeMath.round(payables.total_accounts_payable, 2),
      unearnedAdvanceLiabilities: SafeMath.round(advances.total_unearned_advances, 2),
      netOperatingCashflow,
      totalIncomeReceived,
      totalExpenses: SafeMath.round(expenses.total_expenses || 0, 2),
      outstandingClientPayments,
      labourWagesPayable,
      todayAttendance
    };
  }

  /**
   * Void an Expense (Reverses ledger entry and refunds account balance)
   */
  voidExpense(expenseId, reason = 'Entry correction', voidedBy = null) {
    if (!expenseId) throw new Error('Expense ID is required to void.');

    return this.db.transaction(() => {
      const expense = this.db.queryOne('SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL;', [expenseId]);
      if (!expense) throw new Error(`Expense ${expenseId} not found or already voided.`);

      const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [expense.account_id]);
      if (!account) throw new Error(`Financial account ${expense.account_id} not found.`);

      // Refund account balance
      const newAccountBalance = SafeMath.round(account.current_balance + expense.amount, 2);
      this.db.run('UPDATE financial_accounts SET current_balance = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newAccountBalance, account.id]);

      // Soft delete / void expense
      const voidNote = ` [VOIDED: ${reason}]`;
      this.db.run(`
        UPDATE expenses
        SET deleted_at = datetime('now'),
            notes = COALESCE(notes, '') || ?
        WHERE id = ?;
      `, [voidNote, expenseId]);

      // Record reversing double-entry transaction
      const txSeq = (this.db.queryOne('SELECT COUNT(*) as cnt FROM account_transactions;').cnt + 1).toString().padStart(5, '0');
      const txNumber = `TXN-${new Date().getFullYear()}-${txSeq}`;
      const txId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO account_transactions (
          id, transaction_number, account_id, project_id,
          transaction_type, amount, balance_after,
          reference_type, reference_id, transaction_date, notes
        ) VALUES (?, ?, ?, ?, 'CREDIT', ?, ?, 'EXPENSE', ?, datetime('now'), ?);
      `, [
        txId, txNumber, account.id, expense.project_id,
        expense.amount, newAccountBalance, expenseId,
        `Void expense / Expense Reversal: ${reason}`
      ]);

      return {
        expenseId,
        voided: true,
        refundedAmount: expense.amount,
        newAccountBalance
      };
    });
  }

  /**
   * Update Expense details
   */
  updateExpense(expenseId, data) {
    if (!expenseId) throw new Error('Expense ID is required to update.');

    return this.db.transaction(() => {
      const expense = this.db.queryOne('SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL;', [expenseId]);
      if (!expense) throw new Error(`Expense ${expenseId} not found or voided.`);

      const category = data.category !== undefined ? data.category : expense.category;
      const paidTo = data.paid_to !== undefined ? data.paid_to : (data.paidTo !== undefined ? data.paidTo : expense.paid_to);
      const expenseDate = data.expense_date !== undefined ? data.expense_date : (data.expenseDate !== undefined ? data.expenseDate : expense.expense_date);
      const notes = data.notes !== undefined ? data.notes : expense.notes;
      let amount = expense.amount;

      if (data.amount !== undefined && data.amount !== null && data.amount !== '') {
        const next = Number(data.amount);
        if (!Number.isFinite(next) || next <= 0) throw new Error('Amount must be greater than zero.');
        const delta = SafeMath.round(next - expense.amount, 2);
        if (delta !== 0) {
          const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [expense.account_id]);
          if (!account) throw new Error(`Financial account ${expense.account_id} not found.`);
          if (delta > 0 && account.current_balance + 0.001 < delta) {
            throw new Error(`Not enough balance to raise this expense by ₹${delta.toLocaleString('en-IN')}.`);
          }
          const newBalance = SafeMath.round(account.current_balance - delta, 2);
          this.db.run('UPDATE financial_accounts SET current_balance = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newBalance, account.id]);
          amount = next;
        }
      }

      this.db.run(`
        UPDATE expenses
        SET category = ?,
            paid_to = ?,
            expense_date = ?,
            notes = ?,
            amount = ?
        WHERE id = ?;
      `, [category, paidTo, expenseDate, notes, amount, expenseId]);

      return this.db.queryOne('SELECT * FROM expenses WHERE id = ?;', [expenseId]);
    });
  }

  /**
   * Void a Client Receipt (Reverses ledger entry, unearned liability / revenue, and deducts account balance)
   */
  voidClientReceipt(receiptId, reason = 'Receipt cancelled', voidedBy = null) {
    if (!receiptId) throw new Error('Receipt ID is required to void.');

    return this.db.transaction(() => {
      const receipt = this.db.queryOne('SELECT * FROM client_receipts WHERE id = ? AND deleted_at IS NULL;', [receiptId]);
      if (!receipt) throw new Error(`Receipt ${receiptId} not found or already voided.`);

      if (receipt.allocated_amount > 0) {
        throw new Error(`Cannot void receipt with ₹${receipt.allocated_amount} allocated to milestones. Reverse allocations first.`);
      }

      const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [receipt.account_id]);
      if (!account) throw new Error(`Financial account ${receipt.account_id} not found.`);

      if (account.current_balance < receipt.amount) {
        throw new Error(`Cannot void receipt: Account balance ₹${account.current_balance} is insufficient to reverse deposit of ₹${receipt.amount}.`);
      }

      // Deduct account balance
      const newAccountBalance = SafeMath.round(account.current_balance - receipt.amount, 2);
      this.db.run('UPDATE financial_accounts SET current_balance = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newAccountBalance, account.id]);

      // Soft delete receipt
      const voidNote = ` [VOIDED: ${reason}]`;
      this.db.run(`
        UPDATE client_receipts
        SET deleted_at = datetime('now'),
            unallocated_balance = 0.00,
            notes = COALESCE(notes, '') || ?
        WHERE id = ?;
      `, [voidNote, receiptId]);

      // Reversing transaction
      const txSeq = (this.db.queryOne('SELECT COUNT(*) as cnt FROM account_transactions;').cnt + 1).toString().padStart(5, '0');
      const txNumber = `TXN-${new Date().getFullYear()}-${txSeq}`;
      const txId = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO account_transactions (
          id, transaction_number, account_id, project_id,
          transaction_type, amount, balance_after,
          reference_type, reference_id, transaction_date, notes
        ) VALUES (?, ?, ?, ?, 'DEBIT', ?, ?, 'CLIENT_RECEIPT', ?, datetime('now'), ?);
      `, [
        txId, txNumber, account.id, receipt.project_id,
        receipt.amount, newAccountBalance, receiptId,
        `Void receipt / Client Receipt Reversal: ${reason}`
      ]);

      return {
        receiptId,
        voided: true,
        reversedAmount: receipt.amount,
        newAccountBalance
      };
    });
  }

  /**
   * Void a Supplier Invoice (Reverses accounts payable and supplier dues)
   */
  voidSupplierInvoice(invoiceId, reason = 'Invoice cancelled', voidedBy = null) {
    if (!invoiceId) throw new Error('Invoice ID is required to void.');

    return this.db.transaction(() => {
      const invoice = this.db.queryOne('SELECT * FROM supplier_invoices WHERE id = ? AND deleted_at IS NULL;', [invoiceId]);
      if (!invoice) throw new Error(`Supplier invoice ${invoiceId} not found or already voided.`);

      if (invoice.paid_amount > 0) {
        throw new Error(`Cannot void supplier invoice with ₹${invoice.paid_amount} recorded payments.`);
      }

      const supplier = this.db.queryOne('SELECT id, current_dues FROM suppliers WHERE id = ?;', [invoice.supplier_id]);
      if (!supplier) throw new Error(`Supplier ${invoice.supplier_id} not found.`);

      // Reduce supplier outstanding dues
      const newDues = SafeMath.round(Math.max(0, supplier.current_dues - invoice.balance_amount), 2);
      this.db.run('UPDATE suppliers SET current_dues = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newDues, supplier.id]);

      // Soft delete invoice
      const voidNote = ` [VOIDED: ${reason}]`;
      this.db.run(`
        UPDATE supplier_invoices
        SET deleted_at = datetime('now'),
            payment_status = 'VOIDED',
            balance_amount = 0.00,
            notes = COALESCE(notes, '') || ?
        WHERE id = ?;
      `, [voidNote, invoiceId]);

      return {
        invoiceId,
        voided: true,
        reversedPayable: invoice.total_amount,
        supplierCurrentDues: newDues
      };
    });
  }

  /**
   * Update Client Receipt details
   */
  updateClientReceipt(receiptId, data) {
    if (!receiptId) throw new Error('Receipt ID is required.');
    return this.db.transaction(() => {
      const receipt = this.db.queryOne('SELECT * FROM client_receipts WHERE id = ? AND deleted_at IS NULL;', [receiptId]);
      if (!receipt) throw new Error(`Receipt ${receiptId} not found.`);

      const paymentMode = data.payment_mode || data.paymentMode || receipt.payment_mode;
      const referenceNumber = data.reference_number !== undefined ? data.reference_number : (data.referenceNumber !== undefined ? data.referenceNumber : receipt.reference_number);
      const receiptDate = data.receipt_date || data.receiptDate || receipt.receipt_date;
      const notes = data.notes !== undefined ? data.notes : receipt.notes;

      let amount = receipt.amount;
      if (data.amount !== undefined && data.amount !== null && data.amount !== '') {
        const next = Number(data.amount);
        if (!Number.isFinite(next) || next <= 0) throw new Error('Amount must be greater than zero.');
        const delta = SafeMath.round(next - receipt.amount, 2);
        if (delta !== 0) {
          const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [receipt.account_id]);
          if (!account) throw new Error(`Financial account ${receipt.account_id} not found.`);
          const newBalance = SafeMath.round(account.current_balance + delta, 2);
          if (newBalance < 0) {
            throw new Error(`Cannot lower receipt: Account balance ₹${account.current_balance} would become negative.`);
          }
          this.db.run('UPDATE financial_accounts SET current_balance = ?, updated_at = datetime(\'now\') WHERE id = ?;', [newBalance, account.id]);
          amount = next;
        }
      }

      this.db.run(`
        UPDATE client_receipts
        SET payment_mode = ?, reference_number = ?, receipt_date = ?, notes = ?, amount = ?
        WHERE id = ?;
      `, [paymentMode, referenceNumber, receiptDate, notes, amount, receiptId]);

      return this.db.queryOne('SELECT * FROM client_receipts WHERE id = ?;', [receiptId]);
    });
  }

  /**
   * Comprehensive Project-Wise Financial Report with Date Range Filtering
   */
  getProjectFullReport(projectId, options = {}) {
    const project = this.db.queryOne(`
      SELECT p.*, c.name as client_name, c.phone as client_phone, c.email as client_email, c.billing_address as client_address
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?;
    `, [projectId]);
    if (!project) throw new Error(`Project ${projectId} not found.`);

    let { dateRange = 'ALL', startDate = null, endDate = null } = options;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (dateRange === 'TODAY') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (dateRange === 'THIS_WEEK') {
      const day = now.getDay() || 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - day + 1);
      startDate = mon.toISOString().split('T')[0];
      endDate = todayStr;
    } else if (dateRange === 'THIS_MONTH') {
      startDate = `${todayStr.slice(0, 7)}-01`;
      endDate = todayStr;
    }

    // 1. Quotations linked to project
    const quotations = this.db.query(`
      SELECT id, quotation_number, revision_number, title, subtotal, tax_amount, total_amount, status, created_at
      FROM quotations
      WHERE project_id = ?
      ORDER BY created_at DESC;
    `, [projectId]);
    const quotationValue = quotations.reduce((sum, q) => sum + (q.status !== 'REJECTED' && q.status !== 'SUPERSEDED' ? q.total_amount : 0), 0);

    // 2. Client Receipts (Income)
    let receiptSql = 'SELECT * FROM client_receipts WHERE project_id = ? AND deleted_at IS NULL';
    const receiptParams = [projectId];
    if (startDate) {
      receiptSql += ' AND receipt_date >= ?';
      receiptParams.push(startDate);
    }
    if (endDate) {
      receiptSql += ' AND receipt_date <= ?';
      receiptParams.push(endDate);
    }
    receiptSql += ' ORDER BY receipt_date DESC;';
    const receipts = this.db.query(receiptSql, receiptParams);
    const totalIncomeReceived = SafeMath.round(receipts.reduce((sum, r) => sum + (r.amount || 0), 0), 2);

    // 3. Client payments outstanding
    const effectiveContractValue = project.contract_value > 0 ? project.contract_value : quotationValue;
    const outstandingClientPayments = SafeMath.round(Math.max(0, effectiveContractValue - totalIncomeReceived), 2);

    // 4. Expenses with category breakdown
    let expSql = 'SELECT * FROM expenses WHERE project_id = ? AND deleted_at IS NULL';
    const expParams = [projectId];
    if (startDate) {
      expSql += ' AND expense_date >= ?';
      expParams.push(startDate);
    }
    if (endDate) {
      expSql += ' AND expense_date <= ?';
      expParams.push(endDate);
    }
    expSql += ' ORDER BY expense_date DESC;';
    const expenses = this.db.query(expSql, expParams);
    const totalExpenses = SafeMath.round(expenses.reduce((sum, e) => sum + (e.amount || 0), 0), 2);

    const expenseCategoryBreakdown = {
      MATERIALS: 0,
      TRANSPORT: 0,
      EQUIPMENT: 0,
      RENT: 0,
      LABOUR: 0,
      ELECTRICITY: 0,
      FOOD: 0,
      MISCELLANEOUS: 0
    };
    expenses.forEach(e => {
      const cat = (e.category || '').toUpperCase();
      if (cat.includes('MAT')) expenseCategoryBreakdown.MATERIALS = SafeMath.round(expenseCategoryBreakdown.MATERIALS + e.amount, 2);
      else if (cat.includes('TRANS')) expenseCategoryBreakdown.TRANSPORT = SafeMath.round(expenseCategoryBreakdown.TRANSPORT + e.amount, 2);
      else if (cat.includes('EQUIP')) expenseCategoryBreakdown.EQUIPMENT = SafeMath.round(expenseCategoryBreakdown.EQUIPMENT + e.amount, 2);
      else if (cat.includes('RENT')) expenseCategoryBreakdown.RENT = SafeMath.round(expenseCategoryBreakdown.RENT + e.amount, 2);
      else if (cat.includes('LAB')) expenseCategoryBreakdown.LABOUR = SafeMath.round(expenseCategoryBreakdown.LABOUR + e.amount, 2);
      else if (cat.includes('ELEC') || cat.includes('POW')) expenseCategoryBreakdown.ELECTRICITY = SafeMath.round(expenseCategoryBreakdown.ELECTRICITY + e.amount, 2);
      else if (cat.includes('FOOD') || cat.includes('TEA')) expenseCategoryBreakdown.FOOD = SafeMath.round(expenseCategoryBreakdown.FOOD + e.amount, 2);
      else expenseCategoryBreakdown.MISCELLANEOUS = SafeMath.round(expenseCategoryBreakdown.MISCELLANEOUS + e.amount, 2);
    });

    // 5. Labour Wages (from attendance and labour payments)
    let attSql = 'SELECT * FROM labour_attendance WHERE project_id = ?';
    let labPaySql = 'SELECT * FROM labour_payments WHERE project_id = ? AND deleted_at IS NULL';
    const attParams = [projectId];
    const labPayParams = [projectId];
    if (startDate) {
      attSql += ' AND attendance_date >= ?';
      labPaySql += ' AND payment_date >= ?';
      attParams.push(startDate);
      labPayParams.push(startDate);
    }
    if (endDate) {
      attSql += ' AND attendance_date <= ?';
      labPaySql += ' AND payment_date <= ?';
      attParams.push(endDate);
      labPayParams.push(endDate);
    }
    const attendanceRecords = this.db.query(attSql, attParams);
    const labourPaymentRecords = this.db.query(labPaySql, labPayParams);

    const labourWagesEarned = SafeMath.round(attendanceRecords.reduce((sum, a) => sum + (a.earned_amount || 0) + (a.overtime_amount || 0), 0), 2);
    const labourWagesPaid = SafeMath.round(labourPaymentRecords.reduce((sum, p) => sum + (p.amount || 0), 0), 2);
    const labourWagesOutstanding = SafeMath.round(Math.max(0, labourWagesEarned - labourWagesPaid), 2);

    // 6. Project progress history
    const progressHistory = this.db.query(`
      SELECT * FROM progress_updates WHERE project_id = ? ORDER BY report_date DESC;
    `, [projectId]);

    // 7. Attached bills and receipts documents
    const attachedDocuments = this.db.query(`
      SELECT * FROM documents WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC;
    `, [projectId]);

    // 8. Date-wise combined transaction history
    const txHistory = [
      ...receipts.map(r => ({
        id: r.id,
        date: r.receipt_date,
        type: 'INCOME',
        category: r.is_advance ? 'Advance Receipt' : 'Milestone Receipt',
        description: `Receipt ${r.receipt_number} via ${r.payment_mode}` + (r.reference_number ? ` (Ref: ${r.reference_number})` : ''),
        amount: r.amount,
        flow: 'IN',
        notes: r.notes
      })),
      ...expenses.map(e => ({
        id: e.id,
        date: e.expense_date,
        type: 'EXPENSE',
        category: e.category,
        description: `Expense to ${e.paid_to} via ${e.payment_mode}`,
        amount: e.amount,
        flow: 'OUT',
        notes: e.notes
      })),
      ...labourPaymentRecords.map(p => ({
        id: p.id,
        date: p.payment_date,
        type: 'LABOUR_PAYMENT',
        category: `Labour ${p.payment_type}`,
        description: `Payment ${p.payment_number} via ${p.payment_mode}`,
        amount: p.amount,
        flow: 'OUT',
        notes: p.notes
      }))
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const summary = {
      contractValue: project.contract_value,
      quotationValue,
      totalIncomeReceived,
      outstandingClientPayments,
      totalExpenses,
      labourWagesEarned,
      labourWagesPaid,
      labourWagesOutstanding,
      netCashflow: SafeMath.round(totalIncomeReceived - totalExpenses - labourWagesPaid, 2)
    };

    return {
      project,
      filters: {
        dateRange,
        startDate: startDate || null,
        endDate: endDate || null
      },
      summary,
      financials: summary,
      effectiveContractValue: summary.contractValue,
      totalIncomeReceived,
      totalExpenses,
      outstandingClientPayments,
      labourWagesEarned,
      labourWagesPaid,
      labourWagesOutstanding,
      netOperatingCashflow: summary.netCashflow,
      expenseCategoryBreakdown,
      receipts,
      expenses,
      labourSummary: {
        attendanceCount: attendanceRecords.length,
        wagesEarned: labourWagesEarned,
        wagesPaid: labourWagesPaid,
        wagesOutstanding: labourWagesOutstanding
      },
      quotations,
      progressHistory,
      attachedDocuments,
      transactionHistory: txHistory
    };
  }
}

