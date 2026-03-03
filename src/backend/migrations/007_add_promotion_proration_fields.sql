-- Migration 007: Add Promotion Proration Fields
-- Date: 2024-12-26
-- Description: Add fields to track mid-month promotions for split-period salary calculation

-- Add promotion tracking fields to staff table
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS promotion_date DATE,
ADD COLUMN IF NOT EXISTS previous_grade_level INTEGER,
ADD COLUMN IF NOT EXISTS previous_step INTEGER,
ADD COLUMN IF NOT EXISTS previous_basic_salary NUMERIC(12, 2);

-- Add comments to fields
COMMENT ON COLUMN staff.promotion_date IS 'Effective date of promotion for mid-month proration calculation';
COMMENT ON COLUMN staff.previous_grade_level IS 'Grade level before current promotion (for split-period calculation)';
COMMENT ON COLUMN staff.previous_step IS 'Step before current promotion (for split-period calculation)';
COMMENT ON COLUMN staff.previous_basic_salary IS 'Basic salary before current promotion (for split-period calculation)';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_staff_promotion_date ON staff(promotion_date) WHERE promotion_date IS NOT NULL;

-- Create promotion history table for audit trail
CREATE TABLE IF NOT EXISTS promotion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  promotion_date DATE NOT NULL,
  from_grade_level INTEGER NOT NULL,
  from_step INTEGER NOT NULL,
  from_basic_salary NUMERIC(12, 2) NOT NULL,
  to_grade_level INTEGER NOT NULL,
  to_step INTEGER NOT NULL,
  to_basic_salary NUMERIC(12, 2) NOT NULL,
  promotion_type VARCHAR(50) DEFAULT 'regular' CHECK (promotion_type IN ('regular', 'acting', 'conversion', 'accelerated')),
  remarks TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create index for promotion history
CREATE INDEX IF NOT EXISTS idx_promotion_history_staff ON promotion_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_promotion_history_date ON promotion_history(promotion_date);

-- Add trigger to auto-archive promotion to history when promotion_date is set
CREATE OR REPLACE FUNCTION archive_promotion_to_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only archive if there was actually a promotion (both previous values exist)
  IF NEW.promotion_date IS NOT NULL 
     AND NEW.previous_grade_level IS NOT NULL 
     AND NEW.previous_basic_salary IS NOT NULL THEN
    
    INSERT INTO promotion_history (
      staff_id,
      promotion_date,
      from_grade_level,
      from_step,
      from_basic_salary,
      to_grade_level,
      to_step,
      to_basic_salary,
      created_at
    ) VALUES (
      NEW.id,
      NEW.promotion_date,
      NEW.previous_grade_level,
      COALESCE(NEW.previous_step, 1),
      NEW.previous_basic_salary,
      NEW.grade_level,
      NEW.step,
      NEW.current_basic_salary,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS promotion_history_trigger ON staff;
CREATE TRIGGER promotion_history_trigger
  AFTER INSERT OR UPDATE OF promotion_date, previous_grade_level, previous_basic_salary ON staff
  FOR EACH ROW
  EXECUTE FUNCTION archive_promotion_to_history();

-- Create migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Log migration
INSERT INTO migration_log (migration_name, executed_at) 
VALUES ('007_add_promotion_proration_fields', NOW())
ON CONFLICT (migration_name) DO NOTHING;
