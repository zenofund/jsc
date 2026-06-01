-- Add missing columns to loan_types table
DO $$
BEGIN
    -- Add min_service_years
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_types' AND column_name = 'min_service_years') THEN
        ALTER TABLE loan_types ADD COLUMN min_service_years INTEGER DEFAULT 0;
    END IF;

    -- Add max_salary_percentage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_types' AND column_name = 'max_salary_percentage') THEN
        ALTER TABLE loan_types ADD COLUMN max_salary_percentage NUMERIC DEFAULT 0;
    END IF;

    -- Add min_guarantors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_types' AND column_name = 'min_guarantors') THEN
        ALTER TABLE loan_types ADD COLUMN min_guarantors INTEGER DEFAULT 0;
    END IF;

    -- Add eligibility_criteria
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_types' AND column_name = 'eligibility_criteria') THEN
        ALTER TABLE loan_types ADD COLUMN eligibility_criteria TEXT;
    END IF;

    -- Add requires_guarantors (boolean)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_types' AND column_name = 'requires_guarantors') THEN
        ALTER TABLE loan_types ADD COLUMN requires_guarantors BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_types' AND column_name = 'updated_at') THEN
        ALTER TABLE loan_types ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

END $$;
