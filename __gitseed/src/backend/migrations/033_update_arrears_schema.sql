-- Add missing columns to arrears table
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS old_salary DECIMAL(15, 2);
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS new_salary DECIMAL(15, 2);
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS old_basic_salary DECIMAL(15, 2);
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS new_basic_salary DECIMAL(15, 2);
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS months_owed INTEGER;
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS total_arrears DECIMAL(15, 2);
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS payroll_batch_id UUID;
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE arrears ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add foreign key for payroll_batch_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_arrears_payroll_batch') THEN
        ALTER TABLE arrears ADD CONSTRAINT fk_arrears_payroll_batch FOREIGN KEY (payroll_batch_id) REFERENCES payroll_batches(id);
    END IF;
END $$;

-- Add foreign key for created_by if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_arrears_created_by') THEN
        ALTER TABLE arrears ADD CONSTRAINT fk_arrears_created_by FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;
