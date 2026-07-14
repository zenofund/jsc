ALTER TABLE cooperative_members
  ADD COLUMN IF NOT EXISTS registration_fee_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registration_fee_paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS annual_subscription_amount DECIMAL(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_annual_subscription_paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_annual_subscription_year INTEGER;
