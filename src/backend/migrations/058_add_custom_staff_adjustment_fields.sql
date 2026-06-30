ALTER TABLE staff_allowances
  ADD COLUMN IF NOT EXISTS custom_allowance_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS custom_allowance_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS custom_is_taxable BOOLEAN,
  ADD COLUMN IF NOT EXISTS custom_is_pensionable BOOLEAN;

ALTER TABLE staff_deductions
  ADD COLUMN IF NOT EXISTS custom_deduction_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS custom_deduction_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_type VARCHAR(20);
