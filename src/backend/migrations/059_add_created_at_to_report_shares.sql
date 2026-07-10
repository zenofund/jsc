ALTER TABLE report_shares
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE report_shares
SET created_at = NOW()
WHERE created_at IS NULL;
