-- Enforce allowed Grade Levels at the database layer for JSC
-- Disallow Grade Levels 1, 2, and 11
-- Safe-guarded to avoid errors if the constraint already exists

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_grade_level_allowed'
      AND table_name = 'staff'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE staff
    ADD CONSTRAINT staff_grade_level_allowed
    CHECK (grade_level NOT IN (1, 2, 11)) NOT VALID;
    -- Attempt to validate; if it fails due to legacy rows, the constraint remains NOT VALID
    -- and will still enforce new/updated rows going forward.
    BEGIN
      ALTER TABLE staff VALIDATE CONSTRAINT staff_grade_level_allowed;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Constraint staff_grade_level_allowed left NOT VALID due to existing data';
    END;
  END IF;
END
$$;

COMMENT ON CONSTRAINT staff_grade_level_allowed ON staff
IS 'JSC policy: Grade Levels 1, 2, and 11 are not used (allowed grades: 3–10, 12–17).';
