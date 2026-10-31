-- DDevUltraHome Schema Migration 004: Labour Management, Financial Calculator & Project Enhancements
-- Supports Labour Profiles, Daily Attendance, Wages, Advances, Ledger, and Project Reporting

PRAGMA foreign_keys = ON;

-- 1. Labour Workers
CREATE TABLE IF NOT EXISTS labour_workers (
    id TEXT PRIMARY KEY,
    worker_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    trade TEXT NOT NULL CHECK(trade IN ('MASON', 'CARPENTER', 'PAINTER', 'HELPER', 'BAR_BENDER', 'ELECTRICIAN', 'PLUMBER', 'WELDER', 'OTHER')),
    wage_type TEXT NOT NULL DEFAULT 'DAILY' CHECK(wage_type IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    daily_wage REAL NOT NULL DEFAULT 0.00 CHECK(daily_wage >= 0),
    joining_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_labour_workers_trade ON labour_workers(trade);
CREATE INDEX IF NOT EXISTS idx_labour_workers_active ON labour_workers(is_active);

-- 2. Daily Labour Attendance
-- Rule: Prevent accidental duplicate attendance records for the same worker, project and date
CREATE TABLE IF NOT EXISTS labour_attendance (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL REFERENCES labour_workers(id) ON DELETE RESTRICT,
    project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
    attendance_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE')),
    units REAL NOT NULL DEFAULT 1.0 CHECK(units >= 0 AND units <= 1.0),
    daily_rate REAL NOT NULL DEFAULT 0.00 CHECK(daily_rate >= 0),
    earned_amount REAL NOT NULL DEFAULT 0.00 CHECK(earned_amount >= 0),
    overtime_hours REAL NOT NULL DEFAULT 0.00 CHECK(overtime_hours >= 0),
    overtime_amount REAL NOT NULL DEFAULT 0.00 CHECK(overtime_amount >= 0),
    notes TEXT,
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(worker_id, project_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_labour_att_date ON labour_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_labour_att_worker ON labour_attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_labour_att_project ON labour_attendance(project_id);

-- 3. Labour Payments and Advances
-- Rule: Never mark wages paid merely because attendance was recorded. All disbursements are logged here.
CREATE TABLE IF NOT EXISTS labour_payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT UNIQUE NOT NULL,
    worker_id TEXT NOT NULL REFERENCES labour_workers(id) ON DELETE RESTRICT,
    project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
    payment_type TEXT NOT NULL CHECK(payment_type IN ('ADVANCE', 'WAGE_PAYMENT', 'SETTLEMENT', 'BONUS')),
    amount REAL NOT NULL CHECK(amount > 0),
    payment_date TEXT NOT NULL,
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE')),
    account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL,
    reference_number TEXT,
    period_start TEXT,
    period_end TEXT,
    notes TEXT,
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_labour_payments_worker ON labour_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_labour_payments_project ON labour_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_labour_payments_date ON labour_payments(payment_date);

-- 4. Labour Adjustments and Wage Corrections (Audit Trail)
CREATE TABLE IF NOT EXISTS labour_adjustments (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL REFERENCES labour_workers(id) ON DELETE RESTRICT,
    project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
    adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('DEDUCTION', 'ADDITION', 'CORRECTION')),
    amount REAL NOT NULL,
    adjustment_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    authorised_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_labour_adj_worker ON labour_adjustments(worker_id);

-- 5. Project schema additions
ALTER TABLE projects ADD COLUMN description TEXT;
ALTER TABLE projects ADD COLUMN client_contact TEXT;

-- 6. Business Overhead System Project (For company-level expenses/income without a specific project site)
INSERT OR IGNORE INTO projects (
    id, project_code, name, client_id, site_address, district, state, contract_value, budgeted_cost, current_stage, status
) VALUES (
    'prj-business-overhead',
    'PRJ-HQ',
    'General Business / Office Overhead',
    'cli-thiumani-01',
    'Plot No. 54, Anna Nagar 2nd Street, Velachery, Chennai - 600042',
    'Chennai',
    'Tamil Nadu',
    0.00,
    0.00,
    'STRUCTURE',
    'ACTIVE'
);

-- 7. Update Quotations Status Check to Support 'CONVERTED'
PRAGMA foreign_keys = OFF;
CREATE TABLE IF NOT EXISTS quotations_new (
    id TEXT PRIMARY KEY,
    quotation_number TEXT NOT NULL,
    revision_number INTEGER NOT NULL DEFAULT 0,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.00,
    tax_rate REAL NOT NULL DEFAULT 18.00,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    total_amount REAL NOT NULL DEFAULT 0.00,
    terms_conditions TEXT,
    valid_until TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'CONVERTED')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(quotation_number, revision_number)
);
INSERT OR IGNORE INTO quotations_new SELECT * FROM quotations;
DROP TABLE IF EXISTS quotations;
ALTER TABLE quotations_new RENAME TO quotations;
CREATE INDEX IF NOT EXISTS idx_quotations_project_id ON quotations(project_id);
PRAGMA foreign_keys = ON;

-- 8. Update Expenses Schema to Support Business-Level Expenses & Expanded Categories
PRAGMA foreign_keys = OFF;
CREATE TABLE IF NOT EXISTS expenses_new (
    id TEXT PRIMARY KEY,
    expense_number TEXT UNIQUE NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK(category IN ('MATERIAL', 'LABOUR', 'EQUIPMENT', 'PETTY_CASH', 'SUBCONTRACTOR', 'PERMITS', 'OVERHEAD', 'TRAVEL', 'TRANSPORT', 'RENT', 'ELECTRICITY', 'FOOD', 'MISCELLANEOUS', 'OTHER')),
    amount REAL NOT NULL CHECK(amount > 0),
    expense_date TEXT NOT NULL,
    paid_to TEXT NOT NULL,
    payment_mode TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
    supplier_id TEXT REFERENCES suppliers(id),
    document_id TEXT,
    approval_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK(approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by TEXT REFERENCES users(id),
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);
INSERT OR IGNORE INTO expenses_new SELECT * FROM expenses;
DROP TABLE IF EXISTS expenses;
ALTER TABLE expenses_new RENAME TO expenses;
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
PRAGMA foreign_keys = ON;



