-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DROP TABLES IF EXIST (Clean Slate)
DROP TABLE IF EXISTS staff_documents CASCADE;
DROP TABLE IF EXISTS promotions CASCADE;
DROP TABLE IF EXISTS arrears CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS audit_trail CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;
DROP TABLE IF EXISTS loan_applications CASCADE;
DROP TABLE IF EXISTS loan_types CASCADE;
DROP TABLE IF EXISTS cooperative_members CASCADE;
DROP TABLE IF EXISTS cooperatives CASCADE;
DROP TABLE IF EXISTS payroll_lines CASCADE;
DROP TABLE IF EXISTS payroll_batches CASCADE;
DROP TABLE IF EXISTS staff_deductions CASCADE;
DROP TABLE IF EXISTS staff_allowances CASCADE;
DROP TABLE IF EXISTS deductions CASCADE;
DROP TABLE IF EXISTS allowances CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS salary_structures CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- =====================================================
-- 1. DEPARTMENTS
-- =====================================================
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    head_of_department UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. USERS
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'payroll_officer', 'hr_manager', 'reviewer', 'approver', 'auditor', 'cashier', 'staff')),
    permissions TEXT[],
    department_id UUID REFERENCES departments(id),
    staff_id UUID,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    must_change_password BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circular dependency resolution
ALTER TABLE departments 
ADD CONSTRAINT fk_dept_head 
FOREIGN KEY (head_of_department) REFERENCES users(id);

-- =====================================================
-- 3. SALARY STRUCTURES
-- =====================================================
CREATE TABLE salary_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    effective_date DATE NOT NULL,
    grade_levels JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. STAFF
-- =====================================================
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Bio Data
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE, -- Made optional for seed
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    state_of_origin VARCHAR(100),
    lga_of_origin VARCHAR(100),
    nationality VARCHAR(100) DEFAULT 'Nigerian',
    marital_status VARCHAR(20),

    -- Next of Kin
    nok_name VARCHAR(255),
    nok_relationship VARCHAR(50),
    nok_phone VARCHAR(20),
    nok_address TEXT,

    -- Appointment
    date_of_first_appointment DATE,
    current_posting VARCHAR(255),
    department_id UUID REFERENCES departments(id),
    designation VARCHAR(255),
    employment_type VARCHAR(50),
    employment_date DATE NOT NULL,
    exit_date DATE,
    exit_reason VARCHAR(50),
    promotion_date DATE,
    
    -- Salary Info
    grade_level INTEGER,
    step INTEGER,
    current_basic_salary DECIMAL(15, 2),
    bank_name VARCHAR(100),
    account_number VARCHAR(20),
    bvn VARCHAR(20),
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'on_leave', 'retired', 'terminated')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users 
ADD CONSTRAINT fk_user_staff 
FOREIGN KEY (staff_id) REFERENCES staff(id);

-- =====================================================
-- 5. ALLOWANCES & DEDUCTIONS
-- =====================================================
CREATE TABLE allowances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) CHECK (type IN ('fixed', 'percentage')),
    amount DECIMAL(15, 2),
    percentage DECIMAL(5, 2),
    is_taxable BOOLEAN DEFAULT TRUE,
    is_pensionable BOOLEAN DEFAULT FALSE,
    applies_to_all BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) CHECK (type IN ('fixed', 'percentage')),
    amount DECIMAL(15, 2),
    percentage DECIMAL(5, 2),
    is_statutory BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. STAFF ALLOWANCES & DEDUCTIONS
-- =====================================================
CREATE TABLE staff_allowances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    allowance_id UUID REFERENCES allowances(id),
    amount DECIMAL(15, 2),
    percentage DECIMAL(5, 2),
    frequency VARCHAR(20) DEFAULT 'recurring',
    effective_from DATE NOT NULL,
    effective_to DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE staff_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    deduction_id UUID REFERENCES deductions(id),
    amount DECIMAL(15, 2),
    percentage DECIMAL(5, 2),
    frequency VARCHAR(20) DEFAULT 'recurring',
    effective_from DATE NOT NULL,
    effective_to DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. PAYROLL BATCHES
-- =====================================================
CREATE TABLE payroll_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    month VARCHAR(7) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_staff INTEGER DEFAULT 0,
    total_gross DECIMAL(15, 2) DEFAULT 0,
    total_deductions DECIMAL(15, 2) DEFAULT 0,
    total_net DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    payment_status VARCHAR(20),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. PAYROLL LINES
-- =====================================================
CREATE TABLE payroll_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_batch_id UUID REFERENCES payroll_batches(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id),
    grade_level INTEGER,
    step INTEGER,
    basic_salary DECIMAL(15, 2),
    allowances JSONB,
    deductions JSONB,
    gross_pay DECIMAL(15, 2),
    total_deductions DECIMAL(15, 2),
    net_pay DECIMAL(15, 2),
    is_prorated BOOLEAN DEFAULT FALSE,
    proration_details JSONB,
    tax_details JSONB,
    bank_name VARCHAR(100),
    account_number VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 9. COOPERATIVES
-- =====================================================
CREATE TABLE cooperatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    type VARCHAR(50), -- thrift, multi_purpose
    registration_fee DECIMAL(15, 2),
    monthly_contribution DECIMAL(15, 2),
    interest_rate DECIMAL(5, 2),
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cooperative_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cooperative_id UUID REFERENCES cooperatives(id),
    staff_id UUID REFERENCES staff(id),
    member_number VARCHAR(50),
    monthly_contribution DECIMAL(15, 2),
    total_contributions DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. LOANS
-- =====================================================
CREATE TABLE loan_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    interest_rate DECIMAL(5, 2),
    max_amount DECIMAL(15, 2),
    max_tenure_months INTEGER,
    required_guarantors INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE loan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_number VARCHAR(50) UNIQUE NOT NULL,
    staff_id UUID REFERENCES staff(id),
    loan_type_id UUID REFERENCES loan_types(id),
    amount_requested DECIMAL(15, 2) NOT NULL,
    purpose TEXT,
    tenure_months INTEGER,
    monthly_deduction DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. LEAVE MANAGEMENT
-- =====================================================
CREATE TABLE leave_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    annual_days INTEGER,
    is_paid BOOLEAN DEFAULT TRUE,
    carries_forward BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number VARCHAR(50),
    staff_id UUID REFERENCES staff(id),
    leave_type_id UUID REFERENCES leave_types(id),
    leave_type VARCHAR(50), -- Legacy/Fallback
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    number_of_days INTEGER,
    reason TEXT,
    relief_officer_staff_id UUID REFERENCES staff(id),
    status VARCHAR(20) DEFAULT 'pending',
    approval_remarks TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    leave_type_id UUID REFERENCES leave_types(id),
    year INTEGER NOT NULL,
    entitled_days INTEGER DEFAULT 0,
    used_days INTEGER DEFAULT 0,
    remaining_days INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, leave_type_id, year)
);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =====================================================
-- 12. NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id VARCHAR(255),
    recipient_role VARCHAR(50),
    type VARCHAR(50),
    category VARCHAR(20),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    entity_type VARCHAR(50),
    entity_id UUID,
    metadata JSONB,
    priority VARCHAR(20) DEFAULT 'medium',
    action_label VARCHAR(50),
    action_link VARCHAR(255),
    created_by VARCHAR(255) DEFAULT 'system',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 13. AUDIT TRAIL
-- =====================================================
CREATE TABLE audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 14. SYSTEM SETTINGS
-- =====================================================
CREATE TABLE system_settings (
    id VARCHAR(50) PRIMARY KEY, -- 'default'
    approval_workflow JSONB,
    tax_configuration JSONB,
    key VARCHAR(50) UNIQUE, -- Legacy support
    value JSONB, -- Legacy support
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 15. ARREARS
-- =====================================================
CREATE TABLE arrears (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    reason VARCHAR(50),
    amount DECIMAL(15, 2),
    effective_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_salary DECIMAL(15, 2),
    new_salary DECIMAL(15, 2),
    old_basic_salary DECIMAL(15, 2),
    new_basic_salary DECIMAL(15, 2),
    months_owed INTEGER,
    total_arrears DECIMAL(15, 2),
    details JSONB,
    payroll_batch_id UUID REFERENCES payroll_batches(id),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 16. PROMOTIONS
-- =====================================================
CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    old_grade_level INTEGER,
    new_grade_level INTEGER,
    effective_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_step INTEGER,
    old_basic_salary DECIMAL(15, 2),
    new_step INTEGER,
    new_basic_salary DECIMAL(15, 2),
    promotion_date TIMESTAMP WITH TIME ZONE,
    promotion_type VARCHAR(50) DEFAULT 'regular',
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approval_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    arrears_calculated BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 17. DOCUMENTS
-- =====================================================
CREATE TABLE staff_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    document_type VARCHAR(50),
    title VARCHAR(255),
    file_url TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
