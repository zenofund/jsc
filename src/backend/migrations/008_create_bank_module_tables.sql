-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(50) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    bank_code VARCHAR(50),
    branch_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_number, bank_name)
);

-- Payment Batches
CREATE TABLE IF NOT EXISTS payment_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    payroll_batch_id UUID REFERENCES payroll_batches(id),
    bank_account_id UUID REFERENCES bank_accounts(id),
    payment_method VARCHAR(50),
    file_format VARCHAR(20),
    total_amount DECIMAL(15, 2) DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    bank_name VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_by_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    approved_by_name VARCHAR(255),
    file_generated BOOLEAN DEFAULT FALSE,
    file_path TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_batch_id UUID REFERENCES payment_batches(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id),
    staff_number VARCHAR(50),
    staff_name VARCHAR(255),
    bank_name VARCHAR(255),
    account_number VARCHAR(50),
    amount DECIMAL(15, 2),
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    reconciled BOOLEAN DEFAULT FALSE,
    reconciliation_date TIMESTAMP WITH TIME ZONE,
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Statements
CREATE TABLE IF NOT EXISTS bank_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    statement_number VARCHAR(50) UNIQUE NOT NULL,
    bank_account_id UUID REFERENCES bank_accounts(id),
    file_name VARCHAR(255),
    statement_date DATE,
    opening_balance DECIMAL(15, 2),
    closing_balance DECIMAL(15, 2),
    uploaded_by UUID REFERENCES users(id),
    uploaded_by_name VARCHAR(255),
    parsed BOOLEAN DEFAULT FALSE,
    total_debits DECIMAL(15, 2) DEFAULT 0,
    total_credits DECIMAL(15, 2) DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Statement Lines
CREATE TABLE IF NOT EXISTS bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_statement_id UUID REFERENCES bank_statements(id) ON DELETE CASCADE,
    transaction_date DATE,
    description TEXT,
    reference VARCHAR(255),
    debit DECIMAL(15, 2) DEFAULT 0,
    credit DECIMAL(15, 2) DEFAULT 0,
    matched BOOLEAN DEFAULT FALSE,
    matched_transaction_id UUID REFERENCES payment_transactions(id),
    match_type VARCHAR(50),
    matched_by UUID REFERENCES users(id),
    matched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Reconciliations
CREATE TABLE IF NOT EXISTS payment_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_number VARCHAR(50) UNIQUE NOT NULL,
    payment_batch_id UUID REFERENCES payment_batches(id),
    bank_statement_id UUID REFERENCES bank_statements(id),
    performed_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'in_progress',
    matched_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Exceptions
CREATE TABLE IF NOT EXISTS payment_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exception_number VARCHAR(50) UNIQUE NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    exception_type VARCHAR(50),
    severity VARCHAR(20),
    description TEXT,
    raised_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'open',
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    escalation_notes TEXT,
    escalated_by UUID REFERENCES users(id),
    escalated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
