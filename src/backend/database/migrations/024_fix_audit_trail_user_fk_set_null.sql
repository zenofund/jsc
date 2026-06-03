-- Fix audit_trail user FK so admin can delete users without removing audit history
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_class ref ON ref.oid = con.confrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid
  WHERE rel.relname = 'audit_trail'
    AND ref.relname = 'users'
    AND con.contype = 'f'
    AND att.attname = 'user_id'
    AND att.attnum = ANY(con.conkey);

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE audit_trail DROP CONSTRAINT %I', constraint_name);
  END IF;

  EXECUTE 'ALTER TABLE audit_trail ADD CONSTRAINT audit_trail_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL';
END $$;
