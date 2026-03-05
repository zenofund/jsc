
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS total_repayment DECIMAL(15, 2);
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS interest_amount DECIMAL(15, 2);
