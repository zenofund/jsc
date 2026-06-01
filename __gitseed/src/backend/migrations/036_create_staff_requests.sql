-- Create staff_requests table
CREATE TABLE IF NOT EXISTS staff_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES staff(id),
    request_type VARCHAR(50) NOT NULL, -- 'contact_update', 'bank_update', etc.
    details JSONB, -- Store the form data here
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_requests_staff_id ON staff_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_requests_status ON staff_requests(status);
