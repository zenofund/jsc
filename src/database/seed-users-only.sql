-- =====================================================
-- JSC-PMS - USER SEED DATA ONLY
-- =====================================================
-- This file contains ONLY user account seed data
-- For full database seeding, use: npm run db:seed
-- =====================================================

-- IMPORTANT: Generate real bcrypt hashes before using!
-- The hashes below are PLACEHOLDERS and will NOT work for login.
--
-- To generate real bcrypt hashes:
--
-- Option 1 - Node.js (Recommended):
--   const bcrypt = require('bcrypt');
--   const hash = await bcrypt.hash('admin123', 10);
--   console.log(hash);
--
-- Option 2 - Online Tool:
--   Visit: https://bcrypt-generator.com
--   Set Cost Factor: 10
--   Enter password and generate
--
-- Option 3 - Use TypeScript Seeder:
--   cd backend && npm run db:seed
--   (This automatically generates correct hashes)

-- =====================================================
-- USER ACCOUNTS
-- =====================================================

-- Prerequisites: departments table must exist with these IDs:
-- b1111111-1111-1111-1111-111111111111 (Human Resources)
-- b2222222-2222-2222-2222-222222222222 (Finance & Accounts)
-- b3333333-3333-3333-3333-333333333333 (Administration)

-- Password Reference:
-- admin@jsc.gov.ng      : admin123
-- hr@jsc.gov.ng         : hr123
-- accounts@jsc.gov.ng   : acc123
-- payroll@jsc.gov.ng    : payroll123
-- auditor@jsc.gov.ng    : auditor123
-- cashier@jsc.gov.ng    : cashier123

INSERT INTO users (
    id, 
    email, 
    password_hash, 
    full_name, 
    role, 
    department_id, 
    status
) VALUES
    (
        'a0000001-0001-0001-0001-000000000001',
        'admin@jsc.gov.ng',
        '$2b$10$REPLACE_WITH_REAL_HASH_FOR_admin123_____________________',
        'System Administrator',
        'Admin',
        'b3333333-3333-3333-3333-333333333333',
        'active'
    ),
    (
        'a0000002-0002-0002-0002-000000000002',
        'payroll@jsc.gov.ng',
        '$2b$10$REPLACE_WITH_REAL_HASH_FOR_payroll123__________________',
        'Payroll Officer',
        'Payroll Officer',
        'b1111111-1111-1111-1111-111111111111',
        'active'
    ),
    (
        'a0000003-0003-0003-0003-000000000003',
        'hr@jsc.gov.ng',
        '$2b$10$REPLACE_WITH_REAL_HASH_FOR_hr123________________________',
        'HR Manager',
        'Payroll/HR Manager',
        'b1111111-1111-1111-1111-111111111111',
        'active'
    ),
    (
        'a0000004-0004-0004-0004-000000000004',
        'accounts@jsc.gov.ng',
        '$2b$10$REPLACE_WITH_REAL_HASH_FOR_acc123_______________________',
        'Chief Accountant',
        'Accountant',
        'b2222222-2222-2222-2222-222222222222',
        'active'
    ),
    (
        'a0000005-0005-0005-0005-000000000005',
        'auditor@jsc.gov.ng',
        '$2b$10$REPLACE_WITH_REAL_HASH_FOR_auditor123___________________',
        'Internal Auditor',
        'Auditor',
        'b2222222-2222-2222-2222-222222222222',
        'active'
    ),
    (
        'a0000006-0006-0006-0006-000000000006',
        'cashier@jsc.gov.ng',
        '$2b$10$REPLACE_WITH_REAL_HASH_FOR_cashier123___________________',
        'Cashier Officer',
        'Cashier',
        'b2222222-2222-2222-2222-222222222222',
        'active'
    )
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify users were created:
--
-- SELECT 
--     email, 
--     LEFT(password_hash, 20) as hash_preview,
--     full_name,
--     role, 
--     status,
--     created_at 
-- FROM users 
-- ORDER BY email;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Bcrypt hashes are 60 characters long and start with $2b$10$
-- 2. Each password needs a unique hash (don't reuse the same hash)
-- 3. The 'status' column uses values: 'active', 'inactive', 'suspended'
-- 4. Make sure departments exist before running this script
-- 5. For development, use: npm run db:seed (auto-generates hashes)
