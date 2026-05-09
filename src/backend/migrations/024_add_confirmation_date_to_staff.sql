
-- Add confirmation_date column to staff table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'confirmation_date') THEN
        ALTER TABLE staff ADD COLUMN confirmation_date DATE;
    END IF;
END $$;
