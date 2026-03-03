-- Create promotions table if it doesn't exist
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    old_grade_level INTEGER NOT NULL,
    old_step INTEGER NOT NULL,
    old_basic_salary DECIMAL(15, 2) NOT NULL,
    new_grade_level INTEGER NOT NULL,
    new_step INTEGER NOT NULL,
    new_basic_salary DECIMAL(15, 2) NOT NULL,
    promotion_date TIMESTAMP WITH TIME ZONE NOT NULL,
    promotion_type VARCHAR(50) DEFAULT 'regular', -- regular, acting, conversion, accelerated
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add last_promotion_date to staff table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'last_promotion_date') THEN 
        ALTER TABLE staff ADD COLUMN last_promotion_date TIMESTAMP WITH TIME ZONE; 
    END IF; 
END $$;
