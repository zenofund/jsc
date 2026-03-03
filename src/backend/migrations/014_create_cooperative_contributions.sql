CREATE TABLE IF NOT EXISTS cooperative_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cooperative_id UUID REFERENCES cooperatives(id),
    member_id UUID REFERENCES cooperative_members(id),
    amount DECIMAL(15, 2) NOT NULL,
    contribution_month VARCHAR(7), -- YYYY-MM
    payroll_batch_id UUID REFERENCES payroll_batches(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
