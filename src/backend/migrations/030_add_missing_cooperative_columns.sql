-- Add missing columns to cooperatives table
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS date_established DATE;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS cooperative_type VARCHAR(50);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS monthly_contribution_required DECIMAL(15, 2);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS share_capital_value DECIMAL(15, 2);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS minimum_shares INTEGER DEFAULT 0;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS interest_rate_on_loans DECIMAL(5, 2);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS maximum_loan_multiplier DECIMAL(5, 2);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS meeting_schedule VARCHAR(255);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS chairman_name VARCHAR(255);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS secretary_name VARCHAR(255);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS treasurer_name VARCHAR(255);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);

-- Add missing columns to cooperative_members table
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS shares_owned INTEGER DEFAULT 0;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS total_share_capital DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS total_loans_taken DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS total_loans_repaid DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS outstanding_loan_balance DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS dividend_earned DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS exit_date DATE;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS staff_name VARCHAR(255);
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS staff_number VARCHAR(50);
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS cooperative_name VARCHAR(255);
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE cooperative_members ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add missing columns to cooperative_contributions table
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS cooperative_name VARCHAR(255);
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS staff_id UUID;
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS staff_number VARCHAR(50);
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS staff_name VARCHAR(255);
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS contribution_type VARCHAR(50) DEFAULT 'regular';
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE cooperative_contributions ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100);
