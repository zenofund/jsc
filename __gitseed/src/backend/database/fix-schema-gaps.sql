-- Fix leave_requests
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(50);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type_id UUID REFERENCES leave_types(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS relief_officer_staff_id UUID REFERENCES staff(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approval_remarks TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name = 'days_requested') THEN
        ALTER TABLE leave_requests RENAME COLUMN days_requested TO number_of_days;
    END IF;
END $$;

-- Create leave_balances
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    leave_type_id UUID REFERENCES leave_types(id),
    year INTEGER NOT NULL,
    entitled_days INTEGER DEFAULT 0,
    used_days INTEGER DEFAULT 0,
    remaining_days INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, leave_type_id, year)
);

-- Create password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);
