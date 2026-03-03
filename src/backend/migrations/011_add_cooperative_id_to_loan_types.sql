-- Add cooperative_id to loan_types
ALTER TABLE loan_types 
ADD COLUMN IF NOT EXISTS cooperative_id UUID REFERENCES cooperatives(id);
