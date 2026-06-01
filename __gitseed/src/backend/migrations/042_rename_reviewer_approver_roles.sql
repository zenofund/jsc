-- Rename roles:
-- reviewer -> checking
-- approver -> cpo

DO $$
DECLARE role_constraint_name text;
BEGIN
  SELECT tc.constraint_name
  INTO role_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_name = tc.table_name
  WHERE tc.table_name = 'users'
    AND tc.constraint_type = 'CHECK'
    AND ccu.column_name = 'role'
  LIMIT 1;

  IF role_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', role_constraint_name);
  END IF;

  ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (
    LOWER(role) IN (
      'admin',
      'super_admin',
      'staff',
      'payroll_officer',
      'payroll_loader',
      'hr_manager',
      'cashier',
      'auditor',
      'reviewer',
      'approver',
      'checking',
      'cpo'
    )
  ) NOT VALID;

  BEGIN
    ALTER TABLE users VALIDATE CONSTRAINT users_role_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

UPDATE users SET role = 'checking' WHERE LOWER(role) = 'reviewer';
UPDATE users SET role = 'cpo' WHERE LOWER(role) = 'approver';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_approvals') THEN
    UPDATE workflow_approvals SET approver_role = 'checking' WHERE LOWER(approver_role) = 'reviewer';
    UPDATE workflow_approvals SET approver_role = 'cpo' WHERE LOWER(approver_role) = 'approver';
  END IF;
END $$;

UPDATE system_settings
SET value =
  CASE
    WHEN jsonb_typeof(value->'approval_workflow') = 'array' THEN
      jsonb_set(
        value,
        '{approval_workflow}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN LOWER(elem->>'role') = 'reviewer' THEN jsonb_set(elem, '{role}', '"checking"'::jsonb)
              WHEN LOWER(elem->>'role') = 'approver' THEN jsonb_set(elem, '{role}', '"cpo"'::jsonb)
              ELSE elem
            END
          )
          FROM jsonb_array_elements(value->'approval_workflow') elem
        )
      )
    ELSE value
  END
WHERE key = 'general_settings'
  AND value ? 'approval_workflow';
