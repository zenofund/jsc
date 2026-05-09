-- =====================================================
-- JSC-PMS - USER SEED DATA (READY TO USE)
-- =====================================================
-- This file contains user seed data with properly formatted
-- bcrypt placeholder hashes that follow the correct format.
--
-- ⚠️ IMPORTANT: Replace placeholder hashes with real ones!
-- =====================================================

-- HOW TO USE THIS FILE:
--
-- Step 1: Generate real bcrypt hashes
--         Run this Node.js script to generate hashes:
--
--         const bcrypt = require('bcrypt');
--         
--         async function generateHashes() {
--           console.log('admin123:', await bcrypt.hash('admin123', 10));
--           console.log('payroll123:', await bcrypt.hash('payroll123', 10));
--           console.log('hr123:', await bcrypt.hash('hr123', 10));
--           console.log('acc123:', await bcrypt.hash('acc123', 10));
--           console.log('auditor123:', await bcrypt.hash('auditor123', 10));
--           console.log('cashier123:', await bcrypt.hash('cashier123', 10));
--         }
--         
--         generateHashes();
--
-- Step 2: Replace the placeholder hashes below with real ones
--
-- Step 3: Run this SQL in Supabase SQL Editor or via psql
--
-- OR: Just use the TypeScript seeder instead:
--     cd backend && npm run db:seed

-- =====================================================
-- PREREQUISITE CHECK
-- =====================================================
-- Ensure departments exist before running this:

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM departments WHERE id = 'b1111111-1111-1111-1111-111111111111') THEN
        RAISE EXCEPTION 'Department b1111111-1111-1111-1111-111111111111 (HR) does not exist. Run full seed first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE id = 'b2222222-2222-2222-2222-222222222222') THEN
        RAISE EXCEPTION 'Department b2222222-2222-2222-2222-222222222222 (Finance) does not exist. Run full seed first.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM departments WHERE id = 'b3333333-3333-3333-3333-333333333333') THEN
        RAISE EXCEPTION 'Department b3333333-3333-3333-3333-333333333333 (Admin) does not exist. Run full seed first.';
    END IF;
END $$;

-- =====================================================
-- USER SEED DATA
-- =====================================================

INSERT INTO users (
    id, 
    email, 
    password_hash, 
    full_name, 
    role, 
    department_id, 
    status,
    created_at,
    updated_at
) VALUES
    -- 1. SYSTEM ADMINISTRATOR
    -- Email: admin@jsc.gov.ng
    -- Password: admin123
    (
        'a0000001-0001-0001-0001-000000000001',
        'admin@jsc.gov.ng',
        '$2b$10$YourGeneratedBcryptHashForAdmin123GoesHereXXXXXXXXXXXX',
        'System Administrator',
        'Admin',
        'b3333333-3333-3333-3333-333333333333',
        'active',
        NOW(),
        NOW()
    ),
    
    -- 2. PAYROLL OFFICER
    -- Email: payroll@jsc.gov.ng
    -- Password: payroll123
    (
        'a0000002-0002-0002-0002-000000000002',
        'payroll@jsc.gov.ng',
        '$2b$10$YourGeneratedBcryptHashForPayroll123GoesHereXXXXXXXXXX',
        'Payroll Officer',
        'Payroll Officer',
        'b1111111-1111-1111-1111-111111111111',
        'active',
        NOW(),
        NOW()
    ),
    
    -- 3. HR MANAGER
    -- Email: hr@jsc.gov.ng
    -- Password: hr123
    (
        'a0000003-0003-0003-0003-000000000003',
        'hr@jsc.gov.ng',
        '$2b$10$YourGeneratedBcryptHashForHR123GoesHereXXXXXXXXXXXXXXX',
        'HR Manager',
        'Payroll/HR Manager',
        'b1111111-1111-1111-1111-111111111111',
        'active',
        NOW(),
        NOW()
    ),
    
    -- 4. CHIEF ACCOUNTANT
    -- Email: accounts@jsc.gov.ng
    -- Password: acc123
    (
        'a0000004-0004-0004-0004-000000000004',
        'accounts@jsc.gov.ng',
        '$2b$10$YourGeneratedBcryptHashForAcc123GoesHereXXXXXXXXXXXXXX',
        'Chief Accountant',
        'Accountant',
        'b2222222-2222-2222-2222-222222222222',
        'active',
        NOW(),
        NOW()
    ),
    
    -- 5. INTERNAL AUDITOR
    -- Email: auditor@jsc.gov.ng
    -- Password: auditor123
    (
        'a0000005-0005-0005-0005-000000000005',
        'auditor@jsc.gov.ng',
        '$2b$10$YourGeneratedBcryptHashForAuditor123GoesHereXXXXXXXXXX',
        'Internal Auditor',
        'Auditor',
        'b2222222-2222-2222-2222-222222222222',
        'active',
        NOW(),
        NOW()
    ),
    
    -- 6. CASHIER OFFICER
    -- Email: cashier@jsc.gov.ng
    -- Password: cashier123
    (
        'a0000006-0006-0006-0006-000000000006',
        'cashier@jsc.gov.ng',
        '$2b$10$YourGeneratedBcryptHashForCashier123GoesHereXXXXXXXXXX',
        'Cashier Officer',
        'Cashier',
        'b2222222-2222-2222-2222-222222222222',
        'active',
        NOW(),
        NOW()
    )
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    status = EXCLUDED.status,
    updated_at = NOW();

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 
    '✅ Users Created Successfully' as status,
    COUNT(*) as total_users
FROM users
WHERE email IN (
    'admin@jsc.gov.ng',
    'payroll@jsc.gov.ng',
    'hr@jsc.gov.ng',
    'accounts@jsc.gov.ng',
    'auditor@jsc.gov.ng',
    'cashier@jsc.gov.ng'
);

-- View created users
SELECT 
    email,
    LEFT(password_hash, 15) || '...' as hash_preview,
    full_name,
    role,
    status,
    created_at
FROM users
ORDER BY 
    CASE role
        WHEN 'Admin' THEN 1
        WHEN 'Payroll/HR Manager' THEN 2
        WHEN 'Payroll Officer' THEN 3
        WHEN 'Accountant' THEN 4
        WHEN 'Auditor' THEN 5
        WHEN 'Cashier' THEN 6
        ELSE 99
    END;

-- =====================================================
-- LOGIN CREDENTIALS REFERENCE
-- =====================================================
-- Email                  | Password    | Role
-- -----------------------|-------------|--------------------
-- admin@jsc.gov.ng       | admin123    | Admin
-- payroll@jsc.gov.ng     | payroll123  | Payroll Officer
-- hr@jsc.gov.ng          | hr123       | Payroll/HR Manager
-- accounts@jsc.gov.ng    | acc123      | Accountant
-- auditor@jsc.gov.ng     | auditor123  | Auditor
-- cashier@jsc.gov.ng     | cashier123  | Cashier
