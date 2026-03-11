-- Allow alphanumeric grade levels (e.g., CAT1, CAT4) across staff and payroll tables.
-- Converts grade_level columns to text where needed and updates legacy numeric-only constraints.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'staff'
      AND column_name = 'grade_level'
      AND data_type IN ('integer', 'smallint', 'bigint')
  ) THEN
    ALTER TABLE staff
    ALTER COLUMN grade_level TYPE VARCHAR(20)
    USING grade_level::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payroll_lines'
      AND column_name = 'grade_level'
      AND data_type IN ('integer', 'smallint', 'bigint')
  ) THEN
    ALTER TABLE payroll_lines
    ALTER COLUMN grade_level TYPE VARCHAR(20)
    USING grade_level::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'promotions'
      AND column_name = 'old_grade_level'
      AND data_type IN ('integer', 'smallint', 'bigint')
  ) THEN
    ALTER TABLE promotions
    ALTER COLUMN old_grade_level TYPE VARCHAR(20)
    USING old_grade_level::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'promotions'
      AND column_name = 'new_grade_level'
      AND data_type IN ('integer', 'smallint', 'bigint')
  ) THEN
    ALTER TABLE promotions
    ALTER COLUMN new_grade_level TYPE VARCHAR(20)
    USING new_grade_level::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_grade_level_allowed'
      AND table_name = 'staff'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE staff DROP CONSTRAINT staff_grade_level_allowed;
  END IF;

  ALTER TABLE staff
  ADD CONSTRAINT staff_grade_level_allowed
  CHECK (
    grade_level IS NULL
    OR (
      grade_level ~ '^[0-9]+$'
      AND (grade_level::int) BETWEEN 1 AND 17
      AND (grade_level::int) NOT IN (1, 2, 11)
    )
    OR grade_level ~ '^[A-Za-z]+[0-9]+$'
  ) NOT VALID;

  BEGIN
    ALTER TABLE staff VALIDATE CONSTRAINT staff_grade_level_allowed;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

