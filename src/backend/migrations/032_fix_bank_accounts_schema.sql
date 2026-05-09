-- Alter bank_accounts table to add missing columns
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'salary_disbursement';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_code VARCHAR(20);

-- Ensure other tables also exist and are correct (just in case)
CREATE TABLE IF NOT EXISTS payment_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    payroll_batch_id UUID REFERENCES payroll_batches(id),
    bank_account_id UUID REFERENCES bank_accounts(id),
    payment_method VARCHAR(50) NOT NULL,
    file_format VARCHAR(50) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    bank_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
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
