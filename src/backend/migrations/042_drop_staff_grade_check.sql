-- Drop rigid CHECK constraint to allow configuration-driven validation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_grade_level_allowed'
      AND table_name = 'staff'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE staff DROP CONSTRAINT staff_grade_level_allowed;
  END IF;
END
$$;

