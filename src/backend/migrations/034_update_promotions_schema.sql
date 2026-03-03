-- Add missing columns to promotions table
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS arrears_calculated BOOLEAN DEFAULT FALSE;
