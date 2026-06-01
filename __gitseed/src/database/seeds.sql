-- =====================================================
-- JSC-PMS Seed Data - Initial Setup
-- =====================================================

-- =====================================================
-- 1. SYSTEM SETTINGS
-- =====================================================

INSERT INTO system_settings (id, approval_workflow, tax_configuration, payroll_settings) VALUES (
    'default',
    '[
        {"stage": 1, "name": "HR Review", "role": "Payroll/HR Manager"},
        {"stage": 2, "name": "Finance Review", "role": "Accountant"},
        {"stage": 3, "name": "Final Approval", "role": "Admin"}
    ]'::jsonb,
    '{
        "tax_year": 2025,
        "consolidated_relief_allowance": 200000,
        "gross_income_relief_percentage": 1,
        "pension_relief_percentage": 8,
        "nhis_relief_percentage": 5,
        "nhf_relief_percentage": 2.5,
        "life_assurance_premium_limit": 50000,
        "tax_brackets": [
            {"min": 0, "max": 300000, "rate": 7},
            {"min": 300000, "max": 600000, "rate": 11},
            {"min": 600000, "max": 1100000, "rate": 15},
            {"min": 1100000, "max": 1600000, "rate": 19},
            {"min": 1600000, "max": 3200000, "rate": 21},
            {"min": 3200000, "max": null, "rate": 24}
        ]
    }'::jsonb,
    '{
        "default_pension_percentage": 8,
        "default_nhf_percentage": 2.5,
        "minimum_wage": 70000
    }'::jsonb
);

-- =====================================================
-- 2. DEPARTMENTS
-- =====================================================

INSERT INTO departments (id, name, code, description, status) VALUES
    ('b1111111-1111-1111-1111-111111111111', 'Human Resources', 'HR', 'Manages staff recruitment, development, and welfare', 'active'),
    ('b2222222-2222-2222-2222-222222222222', 'Finance & Accounts', 'FIN', 'Handles financial planning, budgeting, and accounting', 'active'),
    ('b3333333-3333-3333-3333-333333333333', 'Administration', 'ADMIN', 'General administrative services', 'active'),
    ('b4444444-4444-4444-4444-444444444444', 'Legal Services', 'LEGAL', 'Provides legal advisory and litigation support', 'active'),
    ('b5555555-5555-5555-5555-555555555555', 'IT Department', 'IT', 'Manages information technology infrastructure', 'active');

-- =====================================================
-- 3. SALARY STRUCTURE
-- =====================================================

INSERT INTO salary_structures (id, name, code, effective_date, description, grade_levels, status) VALUES (
    'c1111111-1111-1111-1111-111111111111',
    'JSC Consolidated Salary Structure 2024',
    'CONSAL-2024',
    '2024-01-01',
    'Current consolidated salary structure for all JSC staff',
    '[
        {
            "level": 7,
            "steps": [
                {"step": 1, "basic_salary": 250000},
                {"step": 2, "basic_salary": 260000},
                {"step": 3, "basic_salary": 270000},
                {"step": 4, "basic_salary": 280000},
                {"step": 5, "basic_salary": 290000}
            ]
        },
        {
            "level": 8,
            "steps": [
                {"step": 1, "basic_salary": 320000},
                {"step": 2, "basic_salary": 335000},
                {"step": 3, "basic_salary": 350000},
                {"step": 4, "basic_salary": 365000},
                {"step": 5, "basic_salary": 380000}
            ]
        },
        {
            "level": 9,
            "steps": [
                {"step": 1, "basic_salary": 420000},
                {"step": 2, "basic_salary": 440000},
                {"step": 3, "basic_salary": 460000},
                {"step": 4, "basic_salary": 480000},
                {"step": 5, "basic_salary": 500000}
            ]
        },
        {
            "level": 10,
            "steps": [
                {"step": 1, "basic_salary": 550000},
                {"step": 2, "basic_salary": 575000},
                {"step": 3, "basic_salary": 600000},
                {"step": 4, "basic_salary": 625000},
                {"step": 5, "basic_salary": 650000}
            ]
        },
        {
            "level": 12,
            "steps": [
                {"step": 1, "basic_salary": 750000},
                {"step": 2, "basic_salary": 780000},
                {"step": 3, "basic_salary": 810000},
                {"step": 4, "basic_salary": 840000},
                {"step": 5, "basic_salary": 870000}
            ]
        },
        {
            "level": 14,
            "steps": [
                {"step": 1, "basic_salary": 950000},
                {"step": 2, "basic_salary": 990000},
                {"step": 3, "basic_salary": 1030000},
                {"step": 4, "basic_salary": 1070000},
                {"step": 5, "basic_salary": 1110000}
            ]
        }
    ]'::jsonb,
    'active'
);

-- =====================================================
-- 4. GLOBAL ALLOWANCES
-- =====================================================

INSERT INTO allowances (id, code, name, description, type, amount, percentage, is_taxable, applies_to_all, status) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'HRA', 'Housing Allowance', 'Housing rent allowance', 'percentage', NULL, 40.00, true, true, 'active'),
    ('a2222222-2222-2222-2222-222222222222', 'TRA', 'Transport Allowance', 'Monthly transport allowance', 'percentage', NULL, 20.00, true, true, 'active'),
    ('a3333333-3333-3333-3333-333333333333', 'UTL', 'Utility Allowance', 'Electricity, water, and other utilities', 'percentage', NULL, 15.00, true, true, 'active'),
    ('a4444444-4444-4444-4444-444444444444', 'MEL', 'Meal Allowance', 'Daily meal subsidy', 'fixed', 30000.00, NULL, false, true, 'active'),
    ('a5555555-5555-5555-5555-555555555555', 'FUR', 'Furniture Allowance', 'Annual furniture allowance', 'percentage', NULL, 10.00, true, true, 'active');

-- =====================================================
-- 5. GLOBAL DEDUCTIONS
-- =====================================================

INSERT INTO deductions (id, code, name, description, type, amount, percentage, applies_to_all, status) VALUES
    ('de111111-1111-1111-1111-111111111111', 'PEN', 'Pension', 'Mandatory pension contribution (8%)', 'percentage', NULL, 8.00, true, 'active'),
    ('de222222-2222-2222-2222-222222222222', 'NHF', 'NHF', 'National Housing Fund (2.5%)', 'percentage', NULL, 2.50, true, 'active'),
    ('de333333-3333-3333-3333-333333333333', 'TAX', 'PAYE Tax', 'Pay As You Earn tax (calculated progressively)', 'percentage', NULL, 0.00, true, 'active');

-- =====================================================
-- 6. LEAVE TYPES
-- =====================================================

INSERT INTO leave_types (id, name, code, description, default_days_per_year, is_paid, requires_approval, max_days_per_request, status) VALUES
    ('e1111111-1111-1111-1111-111111111111', 'Annual Leave', 'ANNUAL', 'Paid annual vacation leave', 20, true, true, 20, 'active'),
    ('e2222222-2222-2222-2222-222222222222', 'Sick Leave', 'SICK', 'Medical leave with certificate', 10, true, true, 10, 'active'),
    ('e3333333-3333-3333-3333-333333333333', 'Maternity Leave', 'MATERNITY', 'Maternity leave for female staff', 90, true, true, 90, 'active'),
    ('e4444444-4444-4444-4444-444444444444', 'Paternity Leave', 'PATERNITY', 'Paternity leave for male staff', 5, true, true, 5, 'active'),
    ('e5555555-5555-5555-5555-555555555555', 'Casual Leave', 'CASUAL', 'Short-term personal leave', 5, true, true, 3, 'active'),
    ('e6666666-6666-6666-6666-666666666666', 'Study Leave', 'STUDY', 'Educational advancement leave', 0, false, true, 365, 'active'),
    ('e7777777-7777-7777-7777-777777777777', 'Unpaid Leave', 'UNPAID', 'Leave without pay', 0, false, true, 30, 'active');

-- =====================================================
-- 7. USERS (Default Admin & Demo Users)
-- =====================================================

-- Passwords for demo users:
-- admin@jsc.gov.ng: admin123
-- hr.manager@jsc.gov.ng (hr@jsc.gov.ng): hr123
-- accounts@jsc.gov.ng (accountant@jsc.gov.ng): acc123
-- payroll@jsc.gov.ng: payroll123
-- auditor@jsc.gov.ng: auditor123
-- cashier@jsc.gov.ng: cashier123
-- All hashed with bcrypt (rounds=10)
--
-- NOTE: The hashes below are PLACEHOLDER values.
-- To use this SQL seed file, you need to generate real bcrypt hashes for each password.
-- 
-- Use the TypeScript seeder instead: npm run db:seed
-- OR generate real hashes using:
--   Node.js: await bcrypt.hash('password', 10)
--   Online: https://bcrypt-generator.com (use cost factor 10)
--
-- Replace the hash values below with actual bcrypt hashes before running this SQL file directly.

INSERT INTO users (id, email, password_hash, full_name, role, department_id, status) VALUES
    ('a0000001-0001-0001-0001-000000000001', 'admin@jsc.gov.ng', '$2b$10$8eJ5lQXQX5X5X5X5X5X5XeJ5lQXQX5X5X5X5X5X5XeJ5lQXQX5X5X5a', 'System Administrator', 'Admin', 'b3333333-3333-3333-3333-333333333333', 'active'),
    ('a0000002-0002-0002-0002-000000000002', 'payroll@jsc.gov.ng', '$2b$10$9fK6mRYRY6Y6Y6Y6Y6Y6YfK6mRYRY6Y6Y6Y6Y6Y6YfK6mRYRY6Y6Y6b', 'Payroll Officer', 'Payroll Officer', 'b1111111-1111-1111-1111-111111111111', 'active'),
    ('a0000003-0003-0003-0003-000000000003', 'hr@jsc.gov.ng', '$2b$10$7dI4kPXPX4X4X4X4X4X4XdI4kPXPX4X4X4X4X4X4XdI4kPXPX4X4X4c', 'HR Manager', 'Payroll/HR Manager', 'b1111111-1111-1111-1111-111111111111', 'active'),
    ('a0000004-0004-0004-0004-000000000004', 'accounts@jsc.gov.ng', '$2b$10$5bG2iNVNV2V2V2V2V2V2VbG2iNVNV2V2V2V2V2V2VbG2iNVNV2V2V2d', 'Chief Accountant', 'Accountant', 'b2222222-2222-2222-2222-222222222222', 'active'),
    ('a0000005-0005-0005-0005-000000000005', 'auditor@jsc.gov.ng', '$2b$10$3aE1hMTMT1T1T1T1T1T1TaE1hMTMT1T1T1T1T1T1TaE1hMTMT1T1T1e', 'Internal Auditor', 'Auditor', 'b2222222-2222-2222-2222-222222222222', 'active'),
    ('a0000006-0006-0006-0006-000000000006', 'cashier@jsc.gov.ng', '$2b$10$1zC9gLSLS9S9S9S9S9S9SzC9gLSLS9S9S9S9S9S9SzC9gLSLS9S9S9f', 'Cashier Officer', 'Cashier', 'b2222222-2222-2222-2222-222222222222', 'active');

-- =====================================================
-- 8. COOPERATIVES
-- =====================================================

INSERT INTO cooperatives (id, name, code, description, cooperative_type, registration_number, registration_date, status) VALUES
    ('c1111111-1111-1111-1111-111111111111', 'JSC Thrift & Credit Cooperative', 'JSC-THRIFT', 'Staff savings and loan cooperative society', 'Thrift & Credit', 'REG/COOP/2020/001', '2020-01-15', 'active'),
    ('c2222222-2222-2222-2222-222222222222', 'JSC Multipurpose Cooperative', 'JSC-MULTI', 'Multipurpose cooperative for various staff needs', 'Multipurpose', 'REG/COOP/2020/002', '2020-03-10', 'active'),
    ('c3333333-3333-3333-3333-333333333333', 'JSC Transport Cooperative', 'JSC-TRANS', 'Vehicle purchase and transport cooperative', 'Transport', 'REG/COOP/2021/001', '2021-06-01', 'active');

-- =====================================================
-- 9. LOAN TYPES
-- =====================================================

INSERT INTO loan_types (id, code, name, description, interest_rate, max_amount, max_tenure_months, min_service_years, max_salary_percentage, requires_guarantors, min_guarantors, eligibility_criteria, cooperative_id, status) VALUES
    ('f0000001-0001-0001-0001-000000000001', 'SAL-ADV', 'Salary Advance', 'Short-term salary advance', 5.00, 500000, 6, 1, 30, false, 0, 'Minimum 1 year service required', NULL, 'active'),
    ('f0000002-0002-0002-0002-000000000002', 'CAR-LOAN', 'Car Loan', 'Vehicle purchase loan', 8.00, 5000000, 48, 3, 40, true, 2, 'Minimum 3 years service, 2 guarantors required', NULL, 'active'),
    ('f0000003-0003-0003-0003-000000000003', 'EDU-LOAN', 'Education Loan', 'Staff education and development', 6.00, 2000000, 24, 2, 35, true, 1, 'For accredited courses only', NULL, 'active'),
    ('f0000004-0004-0004-0004-000000000004', 'COOP-LOAN', 'Cooperative Loan', 'Thrift cooperative member loan', 4.00, 3000000, 36, 1, 40, true, 2, 'Must be active thrift cooperative member', 'c1111111-1111-1111-1111-111111111111', 'active');

-- =====================================================
-- NOTE: Staff records will be created via the Staff Management Module
-- This is intentional to demonstrate the onboarding workflow
-- =====================================================

-- End of seed data