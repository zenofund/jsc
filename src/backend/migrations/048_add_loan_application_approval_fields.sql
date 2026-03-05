-- Add approval and rejection fields to loan_applications table
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(15, 2);
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS approval_remarks TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS rejected_by UUID;
ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
