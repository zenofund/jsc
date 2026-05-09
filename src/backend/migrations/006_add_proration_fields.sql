-- Migration 006: Add Prorated Salary Fields
-- Date: 2024-12-26
-- Description: Add employment_date, exit_date, and exit_reason fields to staff table for prorated salary calculation

-- Add new fields to staff table
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS exit_date DATE,
ADD COLUMN IF NOT EXISTS exit_reason VARCHAR(50) CHECK (exit_reason IN ('resignation', 'termination', 'retirement', 'death'));

-- Add comment to fields
COMMENT ON COLUMN staff.employment_date IS 'Actual resumption date for current position (for prorated salary calculation)';
COMMENT ON COLUMN staff.exit_date IS 'Last working day for staff leaving mid-month (for prorated salary calculation)';
COMMENT ON COLUMN staff.exit_reason IS 'Reason for exit: resignation, termination, retirement, or death';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_staff_employment_date ON staff(employment_date);
CREATE INDEX IF NOT EXISTS idx_staff_exit_date ON staff(exit_date) WHERE exit_date IS NOT NULL;

-- Add trigger to auto-update status when exit_date is set
CREATE OR REPLACE FUNCTION update_staff_status_on_exit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exit_date IS NOT NULL AND NEW.exit_date <= CURRENT_DATE THEN
    NEW.status = 'Inactive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_exit_status_trigger ON staff;
CREATE TRIGGER staff_exit_status_trigger
  BEFORE INSERT OR UPDATE OF exit_date ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_status_on_exit();

-- Create migration_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_log (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Log migration
INSERT INTO migration_log (migration_name, executed_at) 
VALUES ('006_add_proration_fields', NOW())
ON CONFLICT (migration_name) DO NOTHING;