-- Separate system administration from policy and operational administration.
-- The seeded system administrator account remains the initial Super Admin.

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

UPDATE users
SET role = 'policy_admin'
WHERE LOWER(TRIM(role)) = 'admin';

UPDATE users
SET role = 'super_admin'
WHERE LOWER(TRIM(email)) = 'admin@jsc.gov.ng'
  AND LOWER(TRIM(role)) = 'policy_admin';

UPDATE users
SET role = CASE LOWER(TRIM(role))
  WHEN 'payroll officer' THEN 'payroll_officer'
  WHEN 'payroll/hr manager' THEN 'hr_manager'
  WHEN 'hr manager' THEN 'hr_manager'
  WHEN 'payroll loader' THEN 'payroll_loader'
  WHEN 'payroll manager' THEN 'payroll_manager'
  WHEN 'reviewer' THEN 'checking'
  WHEN 'approver' THEN 'cpo'
  WHEN 'cooperative manager' THEN 'coop_manager'
  WHEN 'cooperative officer' THEN 'cooperative_officer'
  WHEN 'loan officer' THEN 'loan_officer'
  WHEN 'audit officer' THEN 'audit_officer'
  ELSE LOWER(TRIM(role))
END;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (
    LOWER(TRIM(role)) IN (
      'super_admin', 'policy_admin', 'staff', 'payroll_officer', 'payroll_loader',
      'payroll_manager', 'payroll_hr_manager', 'hr_manager', 'reviewer', 'checking',
      'approver', 'cpo', 'auditor', 'audit_officer', 'cashier', 'accountant',
      'analyst', 'cooperative_officer', 'loan_officer', 'coop_manager'
    )
  ) NOT VALID;

DO $$
BEGIN
  IF to_regclass('public.app_role_permissions') IS NOT NULL THEN
    INSERT INTO app_role_permissions (role_key, permission_key)
    SELECT 'policy_admin', permission_key
    FROM app_role_permissions
    WHERE LOWER(role_key) = 'admin'
    ON CONFLICT (role_key, permission_key) DO NOTHING;

    DELETE FROM app_role_permissions WHERE LOWER(role_key) = 'admin';

    INSERT INTO app_role_permissions (role_key, permission_key)
    SELECT 'super_admin', permission_key
    FROM app_role_permissions
    WHERE LOWER(role_key) = 'policy_admin'
      AND permission_key IN (
        'user.account.read', 'user.account.create', 'user.account.update',
        'user.account.delete', 'settings.manage', 'audit.read', 'profile.read'
      )
    ON CONFLICT (role_key, permission_key) DO NOTHING;

    DELETE FROM app_role_permissions
    WHERE LOWER(role_key) = 'policy_admin'
      AND permission_key IN (
        'user.account.read', 'user.account.create', 'user.account.update',
        'user.account.delete', 'settings.manage', 'audit.read'
      );
  END IF;

  IF to_regclass('public.workflow_approvals') IS NOT NULL THEN
    UPDATE workflow_approvals
    SET approver_role = CASE LOWER(TRIM(approver_role))
      WHEN 'admin' THEN 'policy_admin'
      WHEN 'payroll/hr manager' THEN 'hr_manager'
      WHEN 'hr manager' THEN 'hr_manager'
      WHEN 'payroll officer' THEN 'payroll_officer'
      WHEN 'reviewer' THEN 'checking'
      WHEN 'approver' THEN 'cpo'
      WHEN 'cooperative manager' THEN 'coop_manager'
      ELSE LOWER(TRIM(approver_role))
    END;
  END IF;

  IF to_regclass('public.approval_workflows') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'approval_workflows'
         AND column_name = 'role_required'
     ) THEN
    EXECUTE $migration$
      UPDATE approval_workflows
      SET role_required = 'policy_admin'
      WHERE LOWER(role_required) = 'admin'
    $migration$;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    UPDATE notifications
    SET recipient_role = 'policy_admin'
    WHERE LOWER(recipient_role) = 'admin';
  END IF;
END $$;

UPDATE system_settings
SET value = jsonb_set(
  value,
  '{approval_workflow}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN LOWER(elem->>'role') = 'admin'
          THEN jsonb_set(elem, '{role}', '"policy_admin"'::jsonb)
        WHEN LOWER(TRIM(elem->>'role')) IN ('payroll/hr manager', 'hr manager')
          THEN jsonb_set(elem, '{role}', '"hr_manager"'::jsonb)
        WHEN LOWER(TRIM(elem->>'role')) = 'payroll officer'
          THEN jsonb_set(elem, '{role}', '"payroll_officer"'::jsonb)
        WHEN LOWER(TRIM(elem->>'role')) = 'payroll loader'
          THEN jsonb_set(elem, '{role}', '"payroll_loader"'::jsonb)
        WHEN LOWER(TRIM(elem->>'role')) = 'reviewer'
          THEN jsonb_set(elem, '{role}', '"checking"'::jsonb)
        WHEN LOWER(TRIM(elem->>'role')) = 'approver'
          THEN jsonb_set(elem, '{role}', '"cpo"'::jsonb)
        WHEN LOWER(TRIM(elem->>'role')) = 'cooperative manager'
          THEN jsonb_set(elem, '{role}', '"coop_manager"'::jsonb)
        ELSE jsonb_set(
          elem,
          '{role}',
          to_jsonb(regexp_replace(LOWER(TRIM(elem->>'role')), '[^a-z0-9]+', '_', 'g'))
        )
      END
    )
    FROM jsonb_array_elements(value->'approval_workflow') elem
  ), '[]'::jsonb)
)
WHERE key = 'general_settings'
  AND jsonb_typeof(value->'approval_workflow') = 'array';
