
-- Add missing columns to salary_structures table

-- Add code column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salary_structures' AND column_name = 'code') THEN
        ALTER TABLE salary_structures ADD COLUMN code VARCHAR(50);
        ALTER TABLE salary_structures ADD CONSTRAINT salary_structures_code_key UNIQUE (code);
    END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salary_structures' AND column_name = 'description') THEN
        ALTER TABLE salary_structures ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add created_by column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salary_structures' AND column_name = 'created_by') THEN
        ALTER TABLE salary_structures ADD COLUMN created_by UUID;
    END IF;
END $$;

-- Ensure not null constraint for code (might need to update existing rows first if table is not empty)
-- For now we leave it nullable until populated, or update it with a default value
UPDATE salary_structures SET code = 'STRUCT-' || id WHERE code IS NULL;
ALTER TABLE salary_structures ALTER COLUMN code SET NOT NULL;
