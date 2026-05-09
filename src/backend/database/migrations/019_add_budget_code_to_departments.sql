-- Add budget_code column to departments table
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS budget_code VARCHAR(50);