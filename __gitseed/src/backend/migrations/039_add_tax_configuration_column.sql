
-- Add tax_configuration column to system_settings if it doesn't exist
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tax_configuration JSONB;
