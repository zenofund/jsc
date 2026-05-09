
-- Add retirement_date column to staff table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'retirement_date') THEN
        ALTER TABLE staff ADD COLUMN retirement_date DATE;
    END IF;
END $$;
