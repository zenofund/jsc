-- Add location column to departments table
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS location VARCHAR(255);