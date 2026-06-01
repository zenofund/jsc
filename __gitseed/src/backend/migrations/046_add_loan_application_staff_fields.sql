ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS staff_number VARCHAR(50);
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS staff_name VARCHAR(255);
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS loan_type_name VARCHAR(255);
