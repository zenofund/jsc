-- Configurable app permissions catalog and role templates

CREATE TABLE IF NOT EXISTS app_permissions (
  permission_key TEXT PRIMARY KEY,
  module_name VARCHAR(50) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_role_permissions (
  role_key VARCHAR(50) NOT NULL,
  permission_key TEXT NOT NULL REFERENCES app_permissions(permission_key) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (role_key, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_app_permissions_module_name
  ON app_permissions(module_name);

CREATE INDEX IF NOT EXISTS idx_app_role_permissions_role_key
  ON app_role_permissions(role_key);

ALTER TABLE users
  ALTER COLUMN permissions SET DEFAULT '{}'::TEXT[];

INSERT INTO app_permissions (permission_key, module_name, display_name, description)
VALUES
  ('user.account.read', 'admin', 'User Accounts Read', 'View user accounts'),
  ('user.account.create', 'admin', 'User Accounts Create', 'Create new user accounts'),
  ('user.account.update', 'admin', 'User Accounts Update', 'Edit existing user accounts'),
  ('user.account.delete', 'admin', 'User Accounts Delete', 'Delete user accounts'),
  ('settings.manage', 'settings', 'Settings Manage', 'Manage system settings'),
  ('staff.record.read', 'staff', 'Staff Records Read', 'View staff records'),
  ('staff.record.create', 'staff', 'Staff Records Create', 'Create staff records'),
  ('staff.record.update', 'staff', 'Staff Records Update', 'Edit staff records'),
  ('payroll.batch.read', 'payroll', 'Payroll Batch Read', 'View payroll batches'),
  ('payroll.batch.create', 'payroll', 'Payroll Batch Create', 'Create payroll batches'),
  ('payroll.batch.review', 'payroll', 'Payroll Batch Review', 'Review payroll batches'),
  ('payroll.batch.approve', 'payroll', 'Payroll Batch Approve', 'Approve payroll batches'),
  ('payroll.batch.load', 'payroll', 'Payroll Batch Load', 'Load payroll source data'),
  ('payroll.payment.execute', 'payroll', 'Payroll Payment Execute', 'Execute payroll payment process'),
  ('reports.read', 'reports', 'Reports Read', 'View reports'),
  ('reports.export', 'reports', 'Reports Export', 'Export reports'),
  ('audit.read', 'audit', 'Audit Read', 'View audit logs'),
  ('profile.read', 'profile', 'Profile Read', 'View own profile'),
  ('payslip.read', 'profile', 'Payslip Read', 'View own payslip')
ON CONFLICT (permission_key) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO app_role_permissions (role_key, permission_key)
VALUES
  ('admin', 'user.account.read'),
  ('admin', 'user.account.create'),
  ('admin', 'user.account.update'),
  ('admin', 'user.account.delete'),
  ('admin', 'settings.manage'),
  ('admin', 'staff.record.read'),
  ('admin', 'staff.record.create'),
  ('admin', 'staff.record.update'),
  ('admin', 'payroll.batch.read'),
  ('admin', 'payroll.batch.create'),
  ('admin', 'payroll.batch.review'),
  ('admin', 'payroll.batch.approve'),
  ('admin', 'payroll.batch.load'),
  ('admin', 'payroll.payment.execute'),
  ('admin', 'reports.read'),
  ('admin', 'reports.export'),
  ('admin', 'audit.read'),
  ('admin', 'profile.read'),
  ('admin', 'payslip.read'),

  ('hr_manager', 'staff.record.read'),
  ('hr_manager', 'staff.record.create'),
  ('hr_manager', 'staff.record.update'),
  ('hr_manager', 'reports.read'),
  ('hr_manager', 'profile.read'),
  ('hr_manager', 'payslip.read'),

  ('payroll_officer', 'payroll.batch.read'),
  ('payroll_officer', 'payroll.batch.create'),
  ('payroll_officer', 'staff.record.read'),
  ('payroll_officer', 'reports.read'),
  ('payroll_officer', 'profile.read'),
  ('payroll_officer', 'payslip.read'),

  ('payroll_loader', 'payroll.batch.read'),
  ('payroll_loader', 'payroll.batch.load'),
  ('payroll_loader', 'profile.read'),
  ('payroll_loader', 'payslip.read'),

  ('checking', 'payroll.batch.read'),
  ('checking', 'payroll.batch.review'),
  ('checking', 'staff.record.read'),
  ('checking', 'profile.read'),
  ('checking', 'payslip.read'),

  ('cpo', 'payroll.batch.read'),
  ('cpo', 'payroll.batch.approve'),
  ('cpo', 'staff.record.read'),
  ('cpo', 'profile.read'),
  ('cpo', 'payslip.read'),

  ('reviewer', 'payroll.batch.read'),
  ('reviewer', 'payroll.batch.review'),
  ('reviewer', 'staff.record.read'),
  ('reviewer', 'profile.read'),
  ('reviewer', 'payslip.read'),

  ('approver', 'payroll.batch.read'),
  ('approver', 'payroll.batch.approve'),
  ('approver', 'staff.record.read'),
  ('approver', 'profile.read'),
  ('approver', 'payslip.read'),

  ('cashier', 'payroll.batch.read'),
  ('cashier', 'payroll.payment.execute'),
  ('cashier', 'profile.read'),
  ('cashier', 'payslip.read'),

  ('auditor', 'reports.read'),
  ('auditor', 'audit.read'),
  ('auditor', 'payroll.batch.read'),
  ('auditor', 'staff.record.read'),
  ('auditor', 'profile.read'),
  ('auditor', 'payslip.read'),

  ('staff', 'profile.read'),
  ('staff', 'payslip.read')
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Backfill users without explicit permissions from role templates.
UPDATE users u
SET permissions = rp.permission_keys
FROM (
  SELECT role_key, ARRAY_AGG(permission_key ORDER BY permission_key)::TEXT[] AS permission_keys
  FROM app_role_permissions
  GROUP BY role_key
) rp
WHERE u.permissions IS NULL
  AND LOWER(u.role) = LOWER(rp.role_key);
