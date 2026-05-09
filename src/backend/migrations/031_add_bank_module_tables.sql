-- Bank Module Tables

-- 1. Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    bank_code VARCHAR(20),
    branch_name VARCHAR(100),
    account_type VARCHAR(50) DEFAULT 'salary_disbursement',
    is_active BOOLEAN DEFAULT TRUE,
    api_enabled BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_number, bank_name)
);

-- 2. Payment Batches
CREATE TABLE IF NOT EXISTS payment_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    payroll_batch_id UUID REFERENCES payroll_batches(id),
    bank_account_id UUID REFERENCES bank_accounts(id),
    payment_method VARCHAR(50) NOT NULL, -- bank_transfer, cheque, cash
    file_format VARCHAR(50) NOT NULL, -- nibss, remita, csv
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    bank_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, processing, completed, failed
    file_generated BOOLEAN DEFAULT FALSE,
    file_path TEXT,
    created_by UUID,
    created_by_name VARCHAR(255),
    approved_by UUID,
    approved_by_name VARCHAR(255),
    approved_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_batch_id UUID REFERENCES payment_batches(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id),
    staff_number VARCHAR(50),
    staff_name VARCHAR(255),
    bank_name VARCHAR(100),
    account_number VARCHAR(20),
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, successful, failed
    transaction_reference VARCHAR(100),
    bank_response_code VARCHAR(10),
    bank_response_message TEXT,
    retry_count INTEGER DEFAULT 0,
    payment_date TIMESTAMP WITH TIME ZONE,
    reconciled BOOLEAN DEFAULT FALSE,
    reconciliation_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Bank Statements
CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_number VARCHAR(50) UNIQUE NOT NULL,
    bank_account_id UUID REFERENCES bank_accounts(id),
    file_name VARCHAR(255) NOT NULL,
    statement_date DATE NOT NULL,
    opening_balance DECIMAL(15, 2),
    closing_balance DECIMAL(15, 2),
    total_debits DECIMAL(15, 2) DEFAULT 0,
    total_credits DECIMAL(15, 2) DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    parsed BOOLEAN DEFAULT FALSE,
    uploaded_by UUID,
    uploaded_by_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Bank Statement Lines
CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_statement_id UUID REFERENCES bank_statements(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    description TEXT,
    reference VARCHAR(100),
    debit DECIMAL(15, 2) DEFAULT 0,
    credit DECIMAL(15, 2) DEFAULT 0,
    balance DECIMAL(15, 2),
    matched BOOLEAN DEFAULT FALSE,
    matched_transaction_id UUID REFERENCES payment_transactions(id),
    match_type VARCHAR(20), -- automatic, manual
    matched_by UUID,
    matched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Payment Reconciliations
CREATE TABLE IF NOT EXISTS payment_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_number VARCHAR(50) UNIQUE NOT NULL,
    payment_batch_id UUID REFERENCES payment_batches(id),
    bank_statement_id UUID REFERENCES bank_statements(id),
    matched_count INTEGER DEFAULT 0,
    unmatched_count INTEGER DEFAULT 0,
    variance_amount DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Payment Exceptions
CREATE TABLE IF NOT EXISTS payment_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exception_number VARCHAR(50) UNIQUE NOT NULL,
    related_entity_type VARCHAR(50) NOT NULL, -- payment_batch, payment_transaction, reconciliation
    related_entity_id UUID NOT NULL,
    exception_type VARCHAR(50) NOT NULL, -- failed_payment, unmatched_transaction, variance, duplicate
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    description TEXT,
    status VARCHAR(20) DEFAULT 'open', -- open, resolved, escalated
    raised_by UUID,
    resolution_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    escalation_notes TEXT,
    escalated_by UUID,
    escalated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
