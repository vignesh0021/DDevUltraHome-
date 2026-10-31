/**
 * DDevUltraHome — Labour Attendance, Wage Calculation & Payment Ledger Service
 * 
 * Accounting & Integrity Rules:
 * 1. Never mark wages paid merely because attendance was recorded.
 * 2. Payable wages are computed from certified attendance (Full day 1.0, Half day 0.5, Absent 0.0) × agreed rate.
 * 3. Advances and wage payouts reduce worker balance without double counting.
 * 4. Prevent accidental duplicate attendance for the same worker, project, and date.
 * 5. Maintain an auditable, chronological worker payment ledger and wage statement.
 */

import { SafeMath } from '../engine/math.js';

export class LabourService {
  constructor(dbConnection) {
    this.db = dbConnection;
  }

  /**
   * Create a new labour worker profile
   */
  createWorker(data) {
    const {
      name,
      phone = '',
      trade = 'MASON',
      wageType = 'DAILY',
      dailyWage = 0,
      joiningDate = null,
      notes = ''
    } = data;

    if (!name || !name.trim()) {
      throw new Error('Worker name is mandatory.');
    }

    const validTrades = ['MASON', 'CARPENTER', 'PAINTER', 'HELPER', 'BAR_BENDER', 'ELECTRICIAN', 'PLUMBER', 'WELDER', 'OTHER'];
    const cleanTrade = validTrades.includes(trade) ? trade : 'OTHER';
    const cleanWageType = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(wageType) ? wageType : 'DAILY';
    const rate = Math.max(0, parseFloat(dailyWage) || 0);
    const joinDate = joiningDate || new Date().toISOString().split('T')[0];

    const countRow = this.db.queryOne('SELECT COUNT(*) as cnt FROM labour_workers;');
    const seq = (countRow.cnt + 1).toString().padStart(3, '0');
    const workerCode = `LAB-${seq}`;
    const id = `lab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    this.db.run(`
      INSERT INTO labour_workers (
        id, worker_code, name, phone, trade, wage_type, daily_wage, joining_date, is_active, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'));
    `, [id, workerCode, name.trim(), phone.trim(), cleanTrade, cleanWageType, rate, joinDate, notes.trim()]);

    return this.getWorkerById(id);
  }

  /**
   * Update worker profile
   */
  updateWorker(workerId, data) {
    const existing = this.db.queryOne('SELECT * FROM labour_workers WHERE id = ? AND deleted_at IS NULL;', [workerId]);
    if (!existing) throw new Error(`Labour worker ${workerId} not found.`);

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const phone = data.phone !== undefined ? data.phone.trim() : existing.phone;
    const trade = data.trade !== undefined ? data.trade : existing.trade;
    const wageType = data.wageType !== undefined ? data.wageType : (data.wage_type !== undefined ? data.wage_type : existing.wage_type);
    const dailyWage = data.dailyWage !== undefined ? parseFloat(data.dailyWage) : (data.daily_wage !== undefined ? parseFloat(data.daily_wage) : existing.daily_wage);
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : (data.is_active !== undefined ? data.is_active : existing.is_active);
    const notes = data.notes !== undefined ? data.notes : existing.notes;

    this.db.run(`
      UPDATE labour_workers
      SET name = ?, phone = ?, trade = ?, wage_type = ?, daily_wage = ?, is_active = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?;
    `, [name, phone, trade, wageType, dailyWage, isActive, notes, workerId]);

    return this.getWorkerById(workerId);
  }

  /**
   * Soft-delete/archive a worker
   */
  deleteWorker(workerId) {
    const existing = this.db.queryOne('SELECT * FROM labour_workers WHERE id = ? AND deleted_at IS NULL;', [workerId]);
    if (!existing) throw new Error(`Labour worker ${workerId} not found.`);
    this.db.run("UPDATE labour_workers SET deleted_at = datetime('now'), is_active = 0, updated_at = datetime('now') WHERE id = ?;", [workerId]);
    return { success: true, archivedId: workerId };
  }

  /**
   * Get worker by ID with ledger balances
   */
  getWorkerById(workerId) {
    const worker = this.db.queryOne('SELECT * FROM labour_workers WHERE id = ?;', [workerId]);
    if (!worker) return null;

    // Attendance earned
    const attStats = this.db.queryOne(`
      SELECT 
        COUNT(*) as total_records,
        COALESCE(SUM(units), 0) as total_days_worked,
        COALESCE(SUM(earned_amount + overtime_amount), 0.00) as total_earned
      FROM labour_attendance
      WHERE worker_id = ?;
    `, [workerId]);

    // Payments made (advances and wage payouts)
    const payStats = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_type = 'ADVANCE' THEN amount ELSE 0.00 END), 0.00) as total_advances,
        COALESCE(SUM(CASE WHEN payment_type != 'ADVANCE' THEN amount ELSE 0.00 END), 0.00) as total_wages_paid,
        COALESCE(SUM(amount), 0.00) as total_paid
      FROM labour_payments
      WHERE worker_id = ? AND deleted_at IS NULL;
    `, [workerId]);

    // Adjustments
    const adjStats = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN adjustment_type = 'ADDITION' THEN amount ELSE 0.00 END), 0.00) as total_additions,
        COALESCE(SUM(CASE WHEN adjustment_type = 'DEDUCTION' THEN amount ELSE 0.00 END), 0.00) as total_deductions
      FROM labour_adjustments
      WHERE worker_id = ?;
    `, [workerId]);

    const totalEarned = SafeMath.round((attStats?.total_earned || 0) + (adjStats?.total_additions || 0), 2);
    const totalPaid = SafeMath.round((payStats?.total_paid || 0) + (adjStats?.total_deductions || 0), 2);
    const balancePayable = SafeMath.round(totalEarned - totalPaid, 2);

    return {
      ...worker,
      stats: {
        totalDaysWorked: attStats?.total_days_worked || 0,
        totalEarned,
        totalAdvances: SafeMath.round(payStats?.total_advances || 0, 2),
        totalWagesPaid: SafeMath.round(payStats?.total_wages_paid || 0, 2),
        totalPaid,
        balancePayable
      }
    };
  }

  /**
   * List all labour workers with summary balances
   */
  listWorkers(filters = {}) {
    let sql = 'SELECT * FROM labour_workers WHERE deleted_at IS NULL';
    const params = [];
    if (filters.trade) {
      sql += ' AND trade = ?';
      params.push(filters.trade);
    }
    if (filters.isActive !== undefined) {
      sql += ' AND is_active = ?';
      params.push(filters.isActive ? 1 : 0);
    }
    sql += ' ORDER BY is_active DESC, name ASC;';

    const rows = this.db.query(sql, params);
    return rows.map(r => this.getWorkerById(r.id));
  }

  /**
   * Record Daily Attendance
   * Enforces duplicate prevention rule: same worker, project, and date.
   */
  recordAttendance(data) {
    const {
      workerId,
      projectId = null,
      attendanceDate,
      status = 'PRESENT',
      overtimeHours = 0,
      notes = '',
      recordedBy = null,
      allowOverwrite = false
    } = data;

    if (!workerId || !attendanceDate) {
      throw new Error('Worker ID and Attendance Date are mandatory.');
    }

    const worker = this.db.queryOne('SELECT * FROM labour_workers WHERE id = ? AND deleted_at IS NULL;', [workerId]);
    if (!worker) throw new Error(`Labour worker ${workerId} not found.`);

    const validStatuses = ['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}.`);
    }

    // Check duplicate
    const checkSql = projectId
      ? 'SELECT * FROM labour_attendance WHERE worker_id = ? AND project_id = ? AND attendance_date = ?;'
      : 'SELECT * FROM labour_attendance WHERE worker_id = ? AND project_id IS NULL AND attendance_date = ?;';
    const checkParams = projectId ? [workerId, projectId, attendanceDate] : [workerId, attendanceDate];
    const existing = this.db.queryOne(checkSql, checkParams);

    if (existing && !allowOverwrite) {
      throw new Error(`Duplicate attendance: Attendance already recorded for worker ${worker.name} on ${attendanceDate}.`);
    }

    // Unit calculation: Present=1.0, Half-day=0.5, Absent/Leave=0.0
    const unitMap = { PRESENT: 1.0, HALF_DAY: 0.5, ABSENT: 0.0, LEAVE: 0.0 };
    const units = unitMap[status] ?? 1.0;
    const dailyRate = worker.daily_wage || 0;
    const earnedAmount = SafeMath.round(units * dailyRate, 2);
    const otHours = Math.max(0, parseFloat(overtimeHours) || 0);
    const hourlyRate = dailyRate > 0 ? dailyRate / 8 : 0;
    const overtimeAmount = SafeMath.round(otHours * hourlyRate, 2);

    if (existing && allowOverwrite) {
      this.db.run(`
        UPDATE labour_attendance
        SET status = ?, units = ?, daily_rate = ?, earned_amount = ?,
            overtime_hours = ?, overtime_amount = ?, notes = ?, recorded_by = ?, updated_at = datetime('now')
        WHERE id = ?;
      `, [status, units, dailyRate, earnedAmount, otHours, overtimeAmount, notes, recordedBy, existing.id]);
      return this.db.queryOne('SELECT * FROM labour_attendance WHERE id = ?;', [existing.id]);
    }

    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.db.run(`
      INSERT INTO labour_attendance (
        id, worker_id, project_id, attendance_date, status, units, daily_rate,
        earned_amount, overtime_hours, overtime_amount, notes, recorded_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));
    `, [
      id, workerId, projectId, attendanceDate, status, units, dailyRate,
      earnedAmount, otHours, overtimeAmount, notes, recordedBy
    ]);

    return this.db.queryOne('SELECT * FROM labour_attendance WHERE id = ?;', [id]);
  }

  /**
   * List attendance records with worker and project names
   */
  listAttendance(filters = {}) {
    let sql = `
      SELECT a.*, w.name as worker_name, w.worker_code, w.trade, p.name as project_name
      FROM labour_attendance a
      JOIN labour_workers w ON a.worker_id = w.id
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.workerId) {
      sql += ' AND a.worker_id = ?';
      params.push(filters.workerId);
    }
    if (filters.projectId) {
      sql += ' AND a.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.date) {
      sql += ' AND a.attendance_date = ?';
      params.push(filters.date);
    }
    if (filters.startDate) {
      sql += ' AND a.attendance_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND a.attendance_date <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY a.attendance_date DESC, w.name ASC;';
    return this.db.query(sql, params);
  }

  /**
   * Monthly Attendance Summary by Worker
   */
  getMonthlyAttendanceSummary(yearMonth, projectId = null) {
    let sql = `
      SELECT 
        w.id as worker_id,
        w.worker_code,
        w.name as worker_name,
        w.trade,
        w.daily_wage,
        COALESCE(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END), 0) as present_days,
        COALESCE(SUM(CASE WHEN a.status = 'HALF_DAY' THEN 1 ELSE 0 END), 0) as half_days,
        COALESCE(SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END), 0) as absent_days,
        COALESCE(SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END), 0) as leave_days,
        COALESCE(SUM(a.units), 0) as total_units,
        COALESCE(SUM(a.earned_amount + a.overtime_amount), 0.00) as total_earned
      FROM labour_workers w
      LEFT JOIN labour_attendance a ON w.id = a.worker_id AND a.attendance_date LIKE ?
    `;
    const params = [`${yearMonth}%`];

    if (projectId) {
      sql += ' AND a.project_id = ?';
      params.push(projectId);
    }

    sql += `
      WHERE w.deleted_at IS NULL
      GROUP BY w.id
      ORDER BY w.trade, w.name;
    `;
    return this.db.query(sql, params);
  }

  /**
   * Record Labour Advance or Wage Disbursement
   */
  recordLabourPayment(data) {
    const {
      workerId,
      projectId = null,
      paymentType = 'ADVANCE', // 'ADVANCE' | 'WAGE_PAYMENT' | 'SETTLEMENT' | 'BONUS'
      amount,
      paymentDate,
      paymentMode = 'CASH',
      accountId = null,
      referenceNumber = '',
      periodStart = null,
      periodEnd = null,
      notes = '',
      recordedBy = null
    } = data;

    const numAmount = parseFloat(amount);
    if (!workerId || !numAmount || numAmount <= 0) {
      throw new Error('Worker ID and positive payment amount are mandatory.');
    }

    const validTypes = ['ADVANCE', 'WAGE_PAYMENT', 'SETTLEMENT', 'BONUS'];
    if (!validTypes.includes(paymentType)) {
      throw new Error(`Invalid payment type: ${paymentType}`);
    }

    return this.db.transaction(() => {
      const worker = this.db.queryOne('SELECT * FROM labour_workers WHERE id = ? AND deleted_at IS NULL;', [workerId]);
      if (!worker) throw new Error(`Labour worker ${workerId} not found.`);

      // Check account if provided
      let newAccountBalance = null;
      if (accountId) {
        const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [accountId]);
        if (!account) throw new Error(`Financial account ${accountId} not found.`);
        if (account.current_balance < numAmount) {
          throw new Error(`Insufficient funds: Account balance ₹${account.current_balance} is less than payment ₹${numAmount}.`);
        }
        newAccountBalance = SafeMath.round(account.current_balance - numAmount, 2);
        this.db.run("UPDATE financial_accounts SET current_balance = ?, updated_at = datetime('now') WHERE id = ?;", [newAccountBalance, accountId]);
      }

      const countRow = this.db.queryOne('SELECT COUNT(*) as cnt FROM labour_payments;');
      const seq = (countRow.cnt + 1).toString().padStart(4, '0');
      const paymentNumber = `PAY-LAB-${new Date().getFullYear()}-${seq}`;
      const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      this.db.run(`
        INSERT INTO labour_payments (
          id, payment_number, worker_id, project_id, payment_type, amount,
          payment_date, payment_mode, account_id, reference_number,
          period_start, period_end, notes, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
      `, [
        paymentId, paymentNumber, workerId, projectId, paymentType, numAmount,
        paymentDate || new Date().toISOString().split('T')[0], paymentMode, accountId,
        referenceNumber, periodStart, periodEnd, notes, recordedBy
      ]);

      // Audit ledger entry if account was used
      if (accountId) {
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
          numAmount, newAccountBalance, paymentId,
          paymentDate || new Date().toISOString().split('T')[0],
          `Labour Payment (${paymentType}) to ${worker.name}: ${notes}`
        ]);
      }

      const updatedWorker = this.getWorkerById(workerId);
      return {
        paymentId,
        paymentNumber,
        workerId,
        amount: numAmount,
        paymentType,
        newBalancePayable: updatedWorker.stats.balancePayable,
        newAccountBalance
      };
    });
  }

  /**
   * List all labour payment records
   */
  listPayments(filters = {}) {
    let sql = `
      SELECT p.*, w.name as worker_name, w.worker_code, w.trade, prj.name as project_name, a.account_name
      FROM labour_payments p
      JOIN labour_workers w ON p.worker_id = w.id
      LEFT JOIN projects prj ON p.project_id = prj.id
      LEFT JOIN financial_accounts a ON p.account_id = a.id
      WHERE p.deleted_at IS NULL
    `;
    const params = [];
    if (filters.workerId) {
      sql += ' AND p.worker_id = ?';
      params.push(filters.workerId);
    }
    if (filters.projectId) {
      sql += ' AND p.project_id = ?';
      params.push(filters.projectId);
    }
    if (filters.paymentType) {
      sql += ' AND p.payment_type = ?';
      params.push(filters.paymentType);
    }
    if (filters.startDate) {
      sql += ' AND p.payment_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND p.payment_date <= ?';
      params.push(filters.endDate);
    }
    sql += ' ORDER BY p.payment_date DESC, p.created_at DESC;';
    return this.db.query(sql, params);
  }

  /**
   * Void/delete a labour payment and restore account funds if needed
   */
  voidLabourPayment(paymentId, reason = '') {
    return this.db.transaction(() => {
      const payment = this.db.queryOne('SELECT * FROM labour_payments WHERE id = ? AND deleted_at IS NULL;', [paymentId]);
      if (!payment) throw new Error(`Labour payment ${paymentId} not found.`);

      if (payment.account_id) {
        const account = this.db.queryOne('SELECT id, current_balance FROM financial_accounts WHERE id = ?;', [payment.account_id]);
        if (account) {
          const restoredBalance = SafeMath.round(account.current_balance + payment.amount, 2);
          this.db.run("UPDATE financial_accounts SET current_balance = ?, updated_at = datetime('now') WHERE id = ?;", [restoredBalance, payment.account_id]);
        }
      }

      this.db.run("UPDATE labour_payments SET deleted_at = datetime('now'), notes = COALESCE(notes, '') || ' [VOIDED: ' || ? || ']' WHERE id = ?;", [reason || 'Voided by user', paymentId]);
      return { success: true, voidedId: paymentId };
    });
  }

  /**
   * Record manual wage adjustment / deduction with audit reason
   */
  recordAdjustment(data) {
    const {
      workerId,
      projectId = null,
      adjustmentType = 'DEDUCTION', // 'DEDUCTION' | 'ADDITION' | 'CORRECTION'
      amount,
      adjustmentDate,
      reason,
      authorisedBy = null
    } = data;

    const numAmount = parseFloat(amount);
    if (!workerId || !numAmount || numAmount <= 0) {
      throw new Error('Worker ID and positive adjustment amount are mandatory.');
    }
    if (!reason || !reason.trim()) {
      throw new Error('Audit reason for manual wage adjustment is required.');
    }

    const id = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.db.run(`
      INSERT INTO labour_adjustments (
        id, worker_id, project_id, adjustment_type, amount, adjustment_date, reason, authorised_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
    `, [
      id, workerId, projectId, adjustmentType, numAmount,
      adjustmentDate || new Date().toISOString().split('T')[0], reason.trim(), authorisedBy
    ]);

    const updated = this.getWorkerById(workerId);
    return {
      id,
      workerId,
      adjustmentType,
      amount: numAmount,
      newBalancePayable: updated.stats.balancePayable
    };
  }

  /**
   * Worker Payment Ledger (Chronological audit history of earned wages, advances, and payouts)
   */
  getWorkerLedger(workerId) {
    const worker = this.getWorkerById(workerId);
    if (!worker) throw new Error(`Labour worker ${workerId} not found.`);

    const attendance = this.db.query(`
      SELECT 
        a.id, a.attendance_date as date, 'ATTENDANCE' as entry_type,
        'Wage Earned (' || a.status || CASE WHEN a.units = 0.5 THEN ' - Half Day' ELSE '' END || ')' as description,
        (a.earned_amount + a.overtime_amount) as credit_amount,
        0.00 as debit_amount,
        a.created_at, p.name as project_name
      FROM labour_attendance a
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE a.worker_id = ? AND (a.earned_amount + a.overtime_amount) > 0
    `, [workerId]);

    const payments = this.db.query(`
      SELECT 
        p.id, p.payment_date as date, 'PAYMENT' as entry_type,
        'Disbursement (' || p.payment_type || ' via ' || p.payment_mode || ')' as description,
        0.00 as credit_amount,
        p.amount as debit_amount,
        p.created_at, prj.name as project_name
      FROM labour_payments p
      LEFT JOIN projects prj ON p.project_id = prj.id
      WHERE p.worker_id = ? AND p.deleted_at IS NULL
    `, [workerId]);

    const adjustments = this.db.query(`
      SELECT 
        adj.id, adj.adjustment_date as date, 'ADJUSTMENT' as entry_type,
        'Adjustment: ' || adj.reason as description,
        CASE WHEN adj.adjustment_type = 'ADDITION' THEN adj.amount ELSE 0.00 END as credit_amount,
        CASE WHEN adj.adjustment_type = 'DEDUCTION' THEN adj.amount ELSE 0.00 END as debit_amount,
        adj.created_at, prj.name as project_name
      FROM labour_adjustments adj
      LEFT JOIN projects prj ON adj.project_id = prj.id
      WHERE adj.worker_id = ?
    `, [workerId]);

    const entries = [...attendance, ...payments, ...adjustments].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.created_at.localeCompare(b.created_at);
    });

    let runningBalance = 0;
    const ledgerWithBalance = entries.map(e => {
      runningBalance = SafeMath.round(runningBalance + e.credit_amount - e.debit_amount, 2);
      return {
        ...e,
        balance: runningBalance
      };
    });

    return {
      worker,
      ledger: ledgerWithBalance,
      currentBalance: runningBalance
    };
  }

  /**
   * Generate Printable / Shareable Wage Statement for a Worker
   */
  generateWageStatement(workerId, startDateOrOptions = null, maybeEndDate = null) {
    const worker = this.getWorkerById(workerId);
    if (!worker) throw new Error(`Labour worker ${workerId} not found.`);

    let startDate = null;
    let endDate = null;
    if (typeof startDateOrOptions === 'object' && startDateOrOptions !== null) {
      startDate = startDateOrOptions.startDate || null;
      endDate = startDateOrOptions.endDate || null;
    } else {
      startDate = startDateOrOptions || null;
      endDate = maybeEndDate || null;
    }

    let attSql = 'SELECT * FROM labour_attendance WHERE worker_id = ?';
    let paySql = 'SELECT * FROM labour_payments WHERE worker_id = ? AND deleted_at IS NULL';
    const attParams = [workerId];
    const payParams = [workerId];

    if (startDate) {
      attSql += ' AND attendance_date >= ?';
      paySql += ' AND payment_date >= ?';
      attParams.push(startDate);
      payParams.push(startDate);
    }
    if (endDate) {
      attSql += ' AND attendance_date <= ?';
      paySql += ' AND payment_date <= ?';
      attParams.push(endDate);
      payParams.push(endDate);
    }

    attSql += ' ORDER BY attendance_date ASC;';
    paySql += ' ORDER BY payment_date ASC;';

    const attendance = this.db.query(attSql, attParams);
    const payments = this.db.query(paySql, payParams);

    const presentDays = attendance.filter(a => a.status === 'PRESENT').length;
    const halfDays = attendance.filter(a => a.status === 'HALF_DAY').length;
    const absentDays = attendance.filter(a => a.status === 'ABSENT').length;
    const leaveDays = attendance.filter(a => a.status === 'LEAVE').length;
    const totalDaysWorked = attendance.reduce((s, a) => s + (a.units || 0), 0);
    const baseWages = attendance.reduce((s, a) => s + (a.earned_amount || 0), 0);
    const overtimeEarned = attendance.reduce((s, a) => s + (a.overtime_amount || 0), 0);
    const grossEarned = SafeMath.round(baseWages + overtimeEarned, 2);

    const advancesPaid = payments.filter(p => p.payment_type === 'ADVANCE').reduce((s, p) => s + p.amount, 0);
    const wagesPaid = payments.filter(p => p.payment_type !== 'ADVANCE').reduce((s, p) => s + p.amount, 0);
    const totalDisbursed = SafeMath.round(advancesPaid + wagesPaid, 2);
    const netPayable = SafeMath.round(grossEarned - totalDisbursed, 2);

    return {
      worker: {
        id: worker.id,
        name: worker.name,
        code: worker.worker_code,
        trade: worker.trade,
        dailyWage: worker.daily_wage
      },
      period: {
        startDate: startDate || 'All Time',
        endDate: endDate || 'Present'
      },
      summary: {
        presentDays,
        halfDays,
        absentDays,
        leaveDays,
        totalDaysWorked,
        baseWages,
        overtimeEarned,
        grossEarned,
        advancesPaid,
        wagesPaid,
        totalDisbursed,
        netPayable
      },
      attendanceList: attendance,
      paymentList: payments,
      ledger: this.getWorkerLedger(workerId).ledger
    };
  }

  /**
   * Get project-wise labour summary (total wages earned, paid, and outstanding)
   */
  getProjectLabourSummary(projectId) {
    const earned = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(units), 0) as total_days,
        COALESCE(SUM(earned_amount + overtime_amount), 0.00) as wages_earned
      FROM labour_attendance
      WHERE project_id = ?;
    `, [projectId]);

    const paid = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_type = 'ADVANCE' THEN amount ELSE 0.00 END), 0.00) as advances_paid,
        COALESCE(SUM(CASE WHEN payment_type != 'ADVANCE' THEN amount ELSE 0.00 END), 0.00) as wages_paid,
        COALESCE(SUM(amount), 0.00) as total_disbursed
      FROM labour_payments
      WHERE project_id = ? AND deleted_at IS NULL;
    `, [projectId]);

    const wagesEarned = SafeMath.round(earned?.wages_earned || 0, 2);
    const totalDisbursed = SafeMath.round(paid?.total_disbursed || 0, 2);
    const wagesOutstanding = SafeMath.round(Math.max(0, wagesEarned - totalDisbursed), 2);

    return {
      projectId,
      totalDaysWorked: earned?.total_days || 0,
      wagesEarned,
      advancesPaid: SafeMath.round(paid?.advances_paid || 0, 2),
      wagesPaid: SafeMath.round(paid?.wages_paid || 0, 2),
      totalDisbursed,
      wagesOutstanding
    };
  }
}
