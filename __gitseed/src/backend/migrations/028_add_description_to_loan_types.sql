-- Add missing description column to loan_types table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'loan_types'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE loan_types ADD COLUMN description TEXT;
    END IF;
END $$;
