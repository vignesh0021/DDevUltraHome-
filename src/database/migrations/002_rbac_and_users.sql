-- DDevUltraHome Schema Migration 002: RBAC Roles and Default System Users
-- Roles: OWNER, ACCOUNTANT, SITE_MANAGER, ENGINEER, CLIENT

-- Insert default company settings record if none exists
INSERT OR IGNORE INTO company_settings (
    id,
    company_name,
    tagline,
    logo_path,
    address,
    phone,
    email,
    gstin,
    pan,
    currency,
    currency_symbol
) VALUES (
    'company-main',
    'D DEV ULTRA HOMES',
    'Building your dreams',
    '/assets/ddevultrahome-logo.png',
    'Plot No. 54, Anna Nagar 2nd Street, Velachery, Chennai - 600042, Tamil Nadu',
    '+91 98414 24267',
    'admin@ddevultrahomes.com',
    '33AABCD1234E1Z5',
    'AABCD1234E',
    'INR',
    '₹'
);

-- Seed Initial Default Users with PBKDF2/SHA256 hashed passwords (passwords: 'DDev@2026')
-- Hash for 'DDev@2026': standard salted SHA-256 for offline demonstration & auth service
INSERT OR IGNORE INTO users (id, email, password_hash, full_name, phone, role, is_active)
VALUES 
(
    'usr-owner-1',
    'owner@ddevultrahomes.com',
    'pbkdf2$ddev2026salt1234$8a8c7088fe6938ea8512e6ef1a88cf308ebebe1365033422738a1a19a6bf0f03',
    'Vignesh (Managing Director)',
    '+91 98414 24267',
    'OWNER',
    1
),
(
    'usr-accountant-1',
    'accounts@ddevultrahomes.com',
    'pbkdf2$ddev2026salt1234$8a8c7088fe6938ea8512e6ef1a88cf308ebebe1365033422738a1a19a6bf0f03',
    'Kavitha R (Senior Accountant)',
    '+91 98414 24268',
    'ACCOUNTANT',
    1
),
(
    'usr-sitemanager-1',
    'site.suresh@ddevultrahomes.com',
    'pbkdf2$ddev2026salt1234$8a8c7088fe6938ea8512e6ef1a88cf308ebebe1365033422738a1a19a6bf0f03',
    'Suresh Kumar (Site Manager)',
    '+91 98414 24269',
    'SITE_MANAGER',
    1
),
(
    'usr-engineer-1',
    'engineer.arun@ddevultrahomes.com',
    'pbkdf2$ddev2026salt1234$8a8c7088fe6938ea8512e6ef1a88cf308ebebe1365033422738a1a19a6bf0f03',
    'Er. Arunachalam (Project Engineer)',
    '+91 98414 24270',
    'ENGINEER',
    1
),
(
    'usr-client-1',
    'client.guindy@gmail.com',
    'pbkdf2$ddev2026salt1234$8a8c7088fe6938ea8512e6ef1a88cf308ebebe1365033422738a1a19a6bf0f03',
    'Sundaram & Family (Client)',
    '+91 98414 24271',
    'CLIENT',
    1
);

-- Initialize Default Operating Accounts
INSERT OR IGNORE INTO financial_accounts (id, account_name, account_type, bank_name, account_number, branch_ifsc, current_balance)
VALUES
(
    'acc-hdfc-current',
    'HDFC Construction Main Current A/C',
    'BANK',
    'HDFC Bank',
    '50200012345678',
    'HDFC0001234',
    0.00
),
(
    'acc-icici-escrow',
    'ICICI Project Escrow A/C',
    'BANK',
    'ICICI Bank',
    '10200087654321',
    'ICIC0004321',
    0.00
),
(
    'acc-site-petty-cash',
    'Site Office Petty Cash Wallet',
    'PETTY_CASH',
    'Cash in Hand',
    'PETTY-CHENNAI-01',
    'N/A',
    0.00
);

-- Initialize Sync State Tracker
INSERT OR IGNORE INTO sync_state (id, entity_table, cloud_provider, sync_status)
VALUES
('sync-projects', 'projects', 'LOCAL_SNAPSHOT', 'IDLE'),
('sync-clients', 'clients', 'LOCAL_SNAPSHOT', 'IDLE'),
('sync-invoices', 'supplier_invoices', 'LOCAL_SNAPSHOT', 'IDLE'),
('sync-receipts', 'client_receipts', 'LOCAL_SNAPSHOT', 'IDLE'),
('sync-expenses', 'expenses', 'LOCAL_SNAPSHOT', 'IDLE'),
('sync-documents', 'documents', 'LOCAL_SNAPSHOT', 'IDLE');
