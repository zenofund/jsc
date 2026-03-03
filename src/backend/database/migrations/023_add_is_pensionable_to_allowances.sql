-- Add is_pensionable column to allowances table
ALTER TABLE allowances
ADD COLUMN IF NOT EXISTS is_pensionable BOOLEAN DEFAULT false;
