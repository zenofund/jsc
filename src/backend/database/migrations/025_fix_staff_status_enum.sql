DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'staff'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE 'CHECK (status IN (%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE staff DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;

  EXECUTE '
    ALTER TABLE staff
    ADD CONSTRAINT staff_status_check
    CHECK (status IN (
      ''active'', ''suspended'', ''on_leave'', ''retired'', ''terminated'',
      ''resigned'', ''secondment'', ''interdiction''
    ))';
END $$;
