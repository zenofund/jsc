-- Add bank details to loan_disbursements
ALTER TABLE loan_disbursements ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE loan_disbursements ADD COLUMN IF NOT EXISTS account_number VARCHAR(20);
ALTER TABLE loan_disbursements ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);
