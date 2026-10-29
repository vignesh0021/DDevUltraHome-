-- DDevUltraHome Schema Migration 001: Initial Core Relational Schema
-- Supports multi-project construction management, accounting controls, milestone tracking, and OCR verification

PRAGMA foreign_keys = ON;

-- 1. Users and Authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK(role IN ('OWNER', 'ACCOUNTANT', 'SITE_MANAGER', 'ENGINEER', 'CLIENT')),
    assigned_project_ids TEXT, -- JSON array of project IDs for restricted roles (e.g. Site Manager, Client)
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- 2. Clients
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    billing_address TEXT,
    gstin TEXT,
    pan TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'PROSPECT')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- 3. Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    site_address TEXT NOT NULL,
    district TEXT NOT NULL DEFAULT 'Chennai',
    state TEXT NOT NULL DEFAULT 'Tamil Nadu',
    contract_value REAL NOT NULL DEFAULT 0.00,
    budgeted_cost REAL NOT NULL DEFAULT 0.00,
    start_date TEXT,
    expected_completion_date TEXT,
    actual_completion_date TEXT,
    current_stage TEXT NOT NULL DEFAULT 'FOUNDATION',
    status TEXT NOT NULL DEFAULT 'PLANNING' CHECK(status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 4. Contracts
CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    contract_value REAL NOT NULL,
    payment_terms TEXT,
    advance_percentage REAL NOT NULL DEFAULT 10.00,
    retention_percentage REAL NOT NULL DEFAULT 5.00,
    agreement_date TEXT NOT NULL,
    document_id TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);

-- 5. Quotations and Revisions
CREATE TABLE IF NOT EXISTS quotations (
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
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(quotation_number, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_quotations_project_id ON quotations(project_id);

CREATE TABLE IF NOT EXISTS quotation_items (
    id TEXT PRIMARY KEY,
    quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    item_code TEXT,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('CIVIL', 'ELECTRICAL', 'PLUMBING', 'FINISHING', 'LABOUR', 'OTHER')),
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_rate REAL NOT NULL,
    total_price REAL NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- 6. Project Budgets and Variations
CREATE TABLE IF NOT EXISTS project_budgets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK(category IN ('CIVIL_WORKS', 'STEEL', 'CEMENT', 'AGGREGATES', 'LABOUR', 'ELECTRICAL', 'PLUMBING', 'FINISHES', 'EQUIPMENT', 'CONTINGENCY', 'OTHER')),
    budgeted_amount REAL NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, category)
);

CREATE TABLE IF NOT EXISTS budget_variations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    variation_number TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED', 'CLIENT_APPROVED', 'REJECTED')),
    approved_by TEXT REFERENCES users(id),
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Financial Accounts (Bank & Cash)
CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('BANK', 'CASH', 'PETTY_CASH')),
    bank_name TEXT,
    account_number TEXT,
    branch_ifsc TEXT,
    current_balance REAL NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Suppliers and Vendors
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    gstin TEXT,
    category TEXT NOT NULL CHECK(category IN ('CEMENT', 'STEEL', 'AGGREGATES', 'RMC', 'BRICKS', 'ELECTRICAL', 'PLUMBING', 'LABOUR_CONTRACTOR', 'EQUIPMENT_RENTAL', 'OTHER')),
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    opening_balance REAL NOT NULL DEFAULT 0.00,
    current_dues REAL NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

-- 9. Construction Milestones and Progress
CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    planned_start_date TEXT,
    planned_end_date TEXT,
    actual_end_date TEXT,
    target_percentage REAL NOT NULL,
    invoice_percentage REAL NOT NULL DEFAULT 0.00,
    invoice_amount REAL NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK(status IN ('NOT_STARTED', 'IN_PROGRESS', 'INSPECTED', 'COMPLETED', 'BILLED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);

CREATE TABLE IF NOT EXISTS progress_updates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
    report_date TEXT NOT NULL,
    completion_percentage REAL NOT NULL,
    site_notes TEXT NOT NULL,
    weather_condition TEXT,
    workforce_count INTEGER DEFAULT 0,
    delay_reason TEXT,
    photo_document_ids TEXT, -- JSON array of document IDs
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Client Receipts and Advances Allocation
-- Accounting rule: Advance receipts are unearned revenue liabilities, not immediate income
CREATE TABLE IF NOT EXISTS client_receipts (
    id TEXT PRIMARY KEY,
    receipt_number TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    contract_id TEXT REFERENCES contracts(id),
    amount REAL NOT NULL CHECK(amount > 0),
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'NEFT_RTGS')),
    reference_number TEXT,
    receipt_date TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
    is_advance INTEGER NOT NULL DEFAULT 0, -- 1 = Advance (Unearned liability), 0 = Earned milestone billing
    allocated_amount REAL NOT NULL DEFAULT 0.00,
    unallocated_balance REAL NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_receipts_project_id ON client_receipts(project_id);

CREATE TABLE IF NOT EXISTS receipt_allocations (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES client_receipts(id) ON DELETE CASCADE,
    milestone_id TEXT REFERENCES milestones(id) ON DELETE RESTRICT,
    allocated_amount REAL NOT NULL CHECK(allocated_amount > 0),
    allocated_date TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
);

-- 11. Supplier Invoices and Bills
-- Accounting rule: Unpaid supplier invoices are payables, not cash outflow until payment record is executed
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    invoice_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.00,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    total_amount REAL NOT NULL CHECK(total_amount >= 0),
    paid_amount REAL NOT NULL DEFAULT 0.00,
    balance_amount REAL NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'DISPUTED')),
    document_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_project ON supplier_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(payment_status);

-- 12. Supplier Payments
CREATE TABLE IF NOT EXISTS supplier_payments (
    id TEXT PRIMARY KEY,
    payment_number TEXT UNIQUE NOT NULL,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_id TEXT REFERENCES supplier_invoices(id) ON DELETE SET NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
    amount REAL NOT NULL CHECK(amount > 0),
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'NEFT_RTGS')),
    reference_number TEXT,
    payment_date TEXT NOT NULL,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);

-- 13. Direct Expenses and Site Purchases
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    expense_number TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    category TEXT NOT NULL CHECK(category IN ('MATERIAL', 'LABOUR', 'EQUIPMENT', 'PETTY_CASH', 'SUBCONTRACTOR', 'PERMITS', 'OVERHEAD', 'TRAVEL', 'OTHER')),
    amount REAL NOT NULL CHECK(amount > 0),
    expense_date TEXT NOT NULL,
    paid_to TEXT NOT NULL,
    payment_mode TEXT NOT NULL CHECK(payment_mode IN ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'PETTY_CASH')),
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

CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- 14. Double-Entry Account Transactions Ledger
CREATE TABLE IF NOT EXISTS account_transactions (
    id TEXT PRIMARY KEY,
    transaction_number TEXT UNIQUE NOT NULL,
    account_id TEXT NOT NULL REFERENCES financial_accounts(id) ON DELETE RESTRICT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('CREDIT', 'DEBIT')),
    amount REAL NOT NULL CHECK(amount > 0),
    balance_after REAL NOT NULL,
    reference_type TEXT NOT NULL CHECK(reference_type IN ('CLIENT_RECEIPT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'TRANSFER', 'OPENING_BALANCE', 'ADJUSTMENT')),
    reference_id TEXT,
    transaction_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_transactions_account ON account_transactions(account_id);

-- 15. Documents, Watermarking and OCR Review Records
-- Human verification rule: Raw OCR extraction is provisional until verified by an authorized user
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK(document_type IN ('INVOICE', 'RECEIPT', 'CONTRACT', 'DRAWING', 'SITE_PHOTO', 'MEASUREMENT_SHEET', 'QUOTATION_DOC', 'OTHER')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    sha256_hash TEXT,
    watermark_text TEXT,
    ocr_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK(ocr_status IN ('NOT_APPLICABLE', 'PENDING', 'EXTRACTED', 'HUMAN_VERIFIED', 'REJECTED')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS ocr_reviews (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    raw_extracted_text TEXT,
    extracted_fields_json TEXT, -- JSON containing provisional { vendor, invoice_no, date, subtotal, tax, total }
    verified_fields_json TEXT,  -- JSON containing human-confirmed fields
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED', 'CORRECTED', 'CONFIRMED', 'REJECTED')),
    verified_by TEXT REFERENCES users(id),
    verification_notes TEXT,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'VERIFY', 'REJECT', 'SYNC', 'LOGIN')),
    user_id TEXT,
    user_role TEXT,
    changes_json TEXT,
    ip_address TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 17. Cloud Synchronization Metadata
CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY,
    entity_table TEXT NOT NULL,
    last_synced_at TEXT,
    last_snapshot_hash TEXT,
    cloud_provider TEXT NOT NULL DEFAULT 'LOCAL_SNAPSHOT' CHECK(cloud_provider IN ('LOCAL_SNAPSHOT', 'GOOGLE_DRIVE', 'SUPABASE', 'CUSTOM_S3')),
    sync_status TEXT NOT NULL DEFAULT 'IDLE' CHECK(sync_status IN ('IDLE', 'SYNCING', 'SUCCESS', 'FAILED')),
    error_message TEXT,
    records_synced_count INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entity_table, cloud_provider)
);

-- 18. Company Settings & Profile
CREATE TABLE IF NOT EXISTS company_settings (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL DEFAULT 'D DEV ULTRA HOMES',
    tagline TEXT NOT NULL DEFAULT 'Building your dreams',
    logo_path TEXT DEFAULT '/assets/ddevultrahome-logo.png',
    address TEXT NOT NULL DEFAULT 'Chennai, Tamil Nadu, India',
    phone TEXT NOT NULL DEFAULT '+91 98414 24267',
    email TEXT NOT NULL DEFAULT 'contact@ddevultrahomes.com',
    gstin TEXT DEFAULT '33AAAAA0000A1Z5',
    pan TEXT DEFAULT 'AAAAA0000A',
    currency TEXT NOT NULL DEFAULT 'INR',
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    financial_year_start TEXT NOT NULL DEFAULT '04-01',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
