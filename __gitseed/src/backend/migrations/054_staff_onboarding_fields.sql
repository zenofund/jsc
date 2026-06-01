DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'zone'
  ) THEN
    ALTER TABLE staff ADD COLUMN zone VARCHAR(5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'qualification'
  ) THEN
    ALTER TABLE staff ADD COLUMN qualification VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'date_of_first_appointment'
  ) THEN
    ALTER TABLE staff ADD COLUMN date_of_first_appointment DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'post_on_first_appointment'
  ) THEN
    ALTER TABLE staff ADD COLUMN post_on_first_appointment VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'present_appointment'
  ) THEN
    ALTER TABLE staff ADD COLUMN present_appointment VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'date_of_present_appointment'
  ) THEN
    ALTER TABLE staff ADD COLUMN date_of_present_appointment DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'bank_code'
  ) THEN
    ALTER TABLE staff ADD COLUMN bank_code VARCHAR(20);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_zone_allowed'
      AND table_name = 'staff'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE staff
    ADD CONSTRAINT staff_zone_allowed
    CHECK (zone IS NULL OR zone IN ('NC', 'NE', 'NW', 'SS', 'SW', 'SE')) NOT VALID;
  END IF;

  BEGIN
    ALTER TABLE staff VALIDATE CONSTRAINT staff_zone_allowed;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
