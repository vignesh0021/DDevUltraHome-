-- DDevUltraHome Schema Migration 003: Kundrathur Residence Real Agreement Data & Integrity Indexes
-- Source Reference: Construction Agreement executed 4th April 2026
-- Builder: Mr. C. Selvakumar (D DEV ULTRA HOMES)
-- House Owner: Mr. Thiumani P. (Anakaputhur, Chennai - 600070)
-- Project: Residential House at Kundrathur (G+1 Villa + Headroom, ₹42,27,400)

-- 1. Enforce unique supplier bill constraint to eliminate duplicate invoice risk
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoices_unique_bill 
ON supplier_invoices(supplier_id, invoice_number);

-- 2. Seed Real-World Client: Mr. Thiumani P.
INSERT OR IGNORE INTO clients (
    id,
    name,
    company_name,
    phone,
    email,
    billing_address,
    status,
    notes
) VALUES (
    'cli-thiumani-01',
    'Mr. Thiumani P.',
    'Residential Homeowner',
    '+91 98400 99887',
    'thiumani.p@gmail.com',
    'No:1, First Street, Karunanithi Nagar, Anakaputhur, Chennai - 600070',
    'ACTIVE',
    'Client for Kundrathur G+1 Villa. Housing loan availed through LIC HFL Chennai.'
);

-- 3. Seed Real-World Project: Kundrathur Residence
INSERT OR IGNORE INTO projects (
    id,
    project_code,
    name,
    client_id,
    site_address,
    district,
    state,
    contract_value,
    budgeted_cost,
    start_date,
    expected_completion_date,
    current_stage,
    status
) VALUES (
    'prj-kun-01',
    'PRJ-KUN-2026',
    'Kundrathur Residence (G+1 Villa)',
    'cli-thiumani-01',
    'Kundrathur No., Chennai - 600069, Tamil Nadu',
    'Chennai',
    'Tamil Nadu',
    4227400.00,
    3400000.00,
    '2026-04-04',
    '2026-10-04',
    'STRUCTURE',
    'ACTIVE'
);

-- 4. Seed Contract Details (Deed of Agreement)
INSERT OR IGNORE INTO contracts (
    id,
    project_id,
    contract_number,
    title,
    contract_value,
    payment_terms,
    advance_percentage,
    retention_percentage,
    agreement_date,
    status
) VALUES (
    'ctr-kun-01',
    'prj-kun-01',
    'CTR-KUN-2026-001',
    'Construction Agreement — Residential Building at Kundrathur',
    4227400.00,
    'Advance ₹8,00,000 cash; Balance ₹34,27,400 in 7 stages through LIC HFL Chennai loan disbursement. 6 months completion timeline.',
    18.92,
    0.00,
    '2026-04-04',
    'ACTIVE'
);

-- 5. Seed 8 Contract Payment Milestones (Matching Schedule B Terms)
INSERT OR IGNORE INTO milestones (
    id,
    project_id,
    milestone_code,
    title,
    description,
    target_percentage,
    invoice_percentage,
    invoice_amount,
    status
) VALUES 
(
    'ms-kun-01',
    'prj-kun-01',
    'MS-01',
    'Mobilization Advance',
    'Advance cash deposit as per agreement clause 2. Classified as unearned liability deposit until stage certification.',
    18.92,
    18.92,
    800000.00,
    'BILLED'
),
(
    'ms-kun-02',
    'prj-kun-01',
    'MS-02',
    'Ground Floor Roof Level Brickwork',
    'Completion of 9" external flyash brickwork in CM 1:5 and 4.5" partition walls up to 10ft ceiling height.',
    14.19,
    14.19,
    600000.00,
    'COMPLETED'
),
(
    'ms-kun-03',
    'prj-kun-01',
    'MS-03',
    'Ground Floor Roof Slab Concrete',
    'RCC framed slab 5" thickness, beams, and columns casting using approved ready/site concrete mix.',
    16.56,
    16.56,
    700000.00,
    'IN_PROGRESS'
),
(
    'ms-kun-04',
    'prj-kun-01',
    'MS-04',
    'First Floor Roof Level Brickwork',
    'First floor superstructure 9" and 4.5" brickwork up to roof beam height.',
    14.19,
    14.19,
    600000.00,
    'NOT_STARTED'
),
(
    'ms-kun-05',
    'prj-kun-01',
    'MS-05',
    'First Floor Roof Slab Concrete',
    'First floor 5" RCC roof slab, lintels (5"), and sunshades (2") casting.',
    16.56,
    16.56,
    700000.00,
    'NOT_STARTED'
),
(
    'ms-kun-06',
    'prj-kun-01',
    'MS-06',
    'Outer & Inner Plastering',
    'Internal ceiling plastering in CM 1:4 and external wall plastering in CM 1:5 including 4ft parapet wall.',
    11.83,
    11.83,
    500000.00,
    'NOT_STARTED'
),
(
    'ms-kun-07',
    'prj-kun-01',
    'MS-07',
    'Plumbing, Painting, Carpentry & Electrical',
    'Orbit 3-phase wiring, Parryware sanitary fittings, 4x2 vitrified tiles, teak main door, and Asian Paints emulsion.',
    7.10,
    7.10,
    300000.00,
    'NOT_STARTED'
),
(
    'ms-kun-08',
    'prj-kun-01',
    'MS-08',
    'Handover & Final Settlement',
    'Pre-handover final snag clearance, site cleaning, and handover within 6 months.',
    0.65,
    0.65,
    27400.00,
    'NOT_STARTED'
);

-- 6. Seed Project Budgets by Schedule A Category
INSERT OR IGNORE INTO project_budgets (id, project_id, category, budgeted_amount, notes)
VALUES
('bgt-kun-01', 'prj-kun-01', 'CIVIL_WORKS', 1600000.00, 'Foundation, RCC frame, basement earthwork, flyash brickwork & plastering'),
('bgt-kun-02', 'prj-kun-01', 'STEEL', 550000.00, 'Fe 550D TMT reinforcement steel bars'),
('bgt-kun-03', 'prj-kun-01', 'CEMENT', 400000.00, 'Dalmia, Coromandel, UltraTech or Ramco cement HDPE/paper bags'),
('bgt-kun-04', 'prj-kun-01', 'AGGREGATES', 250000.00, 'M-Sand for masonry and plastering, blue metal 20mm/40mm'),
('bgt-kun-05', 'prj-kun-01', 'FINISHES', 350000.00, '4x2 vitrified tiles (Kag/Anuj @ ₹50/sqft base) & Asian Paints (Tractor/Ace)'),
('bgt-kun-06', 'prj-kun-01', 'ELECTRICAL', 120000.00, 'Orbit wires & GM/Orbit modular switches with 3-phase wiring'),
('bgt-kun-07', 'prj-kun-01', 'PLUMBING', 130000.00, 'Parryware closets & taps, CPVC & PVC pipes, 1000L water tank'),
('bgt-kun-08', 'prj-kun-01', 'LABOUR', 0.00, 'Integrated into civil works subcontracts');
