-- Create loan guarantors table
CREATE TABLE IF NOT EXISTS loan_guarantors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_application_id UUID REFERENCES loan_applications(id),
    guarantor_staff_id UUID REFERENCES staff(id),
    guarantor_staff_number VARCHAR(50),
    guarantor_name VARCHAR(255),
    relationship VARCHAR(50),
    consent_status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, declined
    consent_comments TEXT,
    consent_date TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loan disbursements table
CREATE TABLE IF NOT EXISTS loan_disbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disbursement_number VARCHAR(50) UNIQUE NOT NULL,
    loan_application_id UUID REFERENCES loan_applications(id),
    staff_id UUID REFERENCES staff(id),
    staff_number VARCHAR(50),
    amount_disbursed DECIMAL(15, 2) NOT NULL,
    disbursement_date DATE NOT NULL,
    disbursement_method VARCHAR(50), -- bank_transfer, cheque, cash
    start_month VARCHAR(7), -- YYYY-MM
    end_month VARCHAR(7), -- YYYY-MM
    tenure_months INTEGER,
    monthly_deduction DECIMAL(15, 2),
    balance DECIMAL(15, 2),
    payroll_batch_id UUID REFERENCES payroll_batches(id),
    disbursed_by UUID REFERENCES users(id),
    remarks TEXT,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, defaulted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loan repayments table
CREATE TABLE IF NOT EXISTS loan_repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disbursement_id UUID REFERENCES loan_disbursements(id),
    staff_id UUID REFERENCES staff(id),
    amount DECIMAL(15, 2) NOT NULL,
    repayment_date DATE NOT NULL,
    month VARCHAR(7), -- YYYY-MM
    payroll_batch_id UUID REFERENCES payroll_batches(id),
    payment_method VARCHAR(50) DEFAULT 'payroll_deduction', -- payroll_deduction, bank_transfer, cash
    reference_number VARCHAR(100),
    recorded_by UUID REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
