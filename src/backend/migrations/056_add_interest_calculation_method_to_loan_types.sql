-- Add interest_calculation_method column to loan_types table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'loan_types' AND column_name = 'interest_calculation_method'
  ) THEN
    ALTER TABLE loan_types 
    ADD COLUMN interest_calculation_method VARCHAR(20) DEFAULT 'amortized' CHECK (interest_calculation_method IN ('amortized', 'upfront'));
  END IF;
END $$;
