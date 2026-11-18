-- Add explicit, per-action permissions for payroll, arrears, staff records, and adjustments.
-- Empty arrays are explicit no-access assignments; only NULL assignments inherit defaults.
-- Existing non-NULL assignments are preserved, even when they match the old role template.

INSERT INTO app_permissions (permission_key, module_name, display_name, description, is_active)
VALUES
  ('payroll.batch.generate', 'payroll', 'Generate Payroll Lines', 'Generate or regenerate payroll lines for a batch', TRUE),
  ('payroll.batch.submit', 'payroll', 'Submit Payroll Batch', 'Submit a payroll batch for approval', TRUE),
  ('payroll.batch.lock', 'payroll', 'Lock Payroll Batch', 'Lock an approved payroll batch', TRUE),
  ('payroll.batch.delete', 'payroll', 'Delete Payroll Batch', 'Delete a draft payroll batch', TRUE),
  ('payroll.payment.read', 'payroll', 'View Payroll Payments', 'View pending payments and payment traces', TRUE),
  ('payroll.structure.read', 'payroll', 'View Salary Structures', 'View configured salary structures', TRUE),
  ('payroll.structure.create', 'payroll', 'Create Salary Structures', 'Create salary structures', TRUE),
  ('payroll.structure.update', 'payroll', 'Update Salary Structures', 'Update salary structures', TRUE),
  ('payroll.structure.delete', 'payroll', 'Delete Salary Structures', 'Deactivate or permanently delete salary structures', TRUE),
  ('arrears.read', 'arrears', 'View Arrears', 'View arrears and adjustment records', TRUE),
  ('arrears.create', 'arrears', 'Create Arrears', 'Create manual arrears or adjustments', TRUE),
  ('arrears.preview', 'arrears', 'Preview Arrears', 'Preview calculated manual salary arrears', TRUE),
  ('arrears.delete', 'arrears', 'Delete Arrears', 'Delete arrears records', TRUE),
  ('arrears.approve', 'arrears', 'Approve Arrears', 'Approve arrears records', TRUE),
  ('arrears.reject', 'arrears', 'Reject Arrears', 'Reject arrears records', TRUE),
  ('arrears.bulk_approve', 'arrears', 'Bulk Approve Arrears', 'Approve multiple arrears records', TRUE),
  ('arrears.bulk_reject', 'arrears', 'Bulk Reject Arrears', 'Reject multiple arrears records', TRUE),
  ('arrears.merge', 'arrears', 'Merge Arrears', 'Merge arrears into a payroll batch', TRUE),
  ('arrears.bulk_merge', 'arrears', 'Bulk Merge Arrears', 'Merge multiple arrears into a payroll batch', TRUE),
  ('arrears.recalculate', 'arrears', 'Recalculate Arrears', 'Recalculate arrears amounts', TRUE),
  ('staff.allowance.catalog.read', 'staff_adjustments', 'View Allowance Catalog', 'View configured allowance definitions', TRUE),
  ('staff.allowance.catalog.create', 'staff_adjustments', 'Create Allowance Definition', 'Create configured allowance definitions', TRUE),
  ('staff.allowance.catalog.update', 'staff_adjustments', 'Update Allowance Definition', 'Update configured allowance definitions', TRUE),
  ('staff.allowance.catalog.delete', 'staff_adjustments', 'Delete Allowance Definition', 'Delete configured allowance definitions', TRUE),
  ('staff.allowance.read', 'staff_adjustments', 'View Staff Allowances', 'View staff-specific allowances', TRUE),
  ('staff.allowance.create', 'staff_adjustments', 'Create Staff Allowance', 'Create staff-specific allowances', TRUE),
  ('staff.allowance.update', 'staff_adjustments', 'Update Staff Allowance', 'Update staff-specific allowances', TRUE),
  ('staff.allowance.delete', 'staff_adjustments', 'Delete Staff Allowance', 'Delete staff-specific allowances', TRUE),
  ('staff.allowance.status.update', 'staff_adjustments', 'Change Staff Allowance Status', 'Change status for staff-specific allowances', TRUE),
  ('staff.deduction.catalog.read', 'staff_adjustments', 'View Deduction Catalog', 'View configured deduction definitions', TRUE),
  ('staff.deduction.catalog.create', 'staff_adjustments', 'Create Deduction Definition', 'Create configured deduction definitions', TRUE),
  ('staff.deduction.catalog.update', 'staff_adjustments', 'Update Deduction Definition', 'Update configured deduction definitions', TRUE),
  ('staff.deduction.catalog.delete', 'staff_adjustments', 'Delete Deduction Definition', 'Delete configured deduction definitions', TRUE),
  ('staff.deduction.read', 'staff_adjustments', 'View Staff Deductions', 'View staff-specific deductions', TRUE),
  ('staff.deduction.create', 'staff_adjustments', 'Create Staff Deduction', 'Create staff-specific deductions', TRUE),
  ('staff.deduction.update', 'staff_adjustments', 'Update Staff Deduction', 'Update staff-specific deductions', TRUE),
  ('staff.deduction.delete', 'staff_adjustments', 'Delete Staff Deduction', 'Delete staff-specific deductions', TRUE),
  ('staff.deduction.status.update', 'staff_adjustments', 'Change Staff Deduction Status', 'Change status for staff-specific deductions', TRUE),
  ('staff.record.create', 'staff', 'Create Staff Records', 'Create staff records', TRUE),
  ('staff.record.update', 'staff', 'Update Staff Records', 'Update staff records', TRUE),
  ('staff.record.delete', 'staff', 'Delete Staff Records', 'Delete staff records', TRUE),
  ('staff.record.import', 'staff', 'Import Staff Records', 'Bulk import staff records', TRUE),
  ('staff.request.read', 'staff', 'View Own Staff Requests', 'View requests for the signed-in staff member', TRUE),
  ('staff.request.create', 'staff', 'Create Own Staff Requests', 'Create requests for the signed-in staff member', TRUE),
  ('staff.request.read.all', 'staff', 'View All Staff Requests', 'View requests for any staff member', TRUE),
  ('staff.request.create.all', 'staff', 'Create Requests for Any Staff', 'Create requests on behalf of any staff member', TRUE),
  ('staff.request.approve', 'staff', 'Approve Staff Requests', 'Approve staff requests', TRUE),
  ('staff.request.reject', 'staff', 'Reject Staff Requests', 'Reject staff requests', TRUE),
  ('staff.document.read', 'staff', 'View Own Staff Documents', 'View documents for the signed-in staff member', TRUE),
  ('staff.document.create', 'staff', 'Upload Own Staff Documents', 'Upload documents for the signed-in staff member', TRUE),
  ('staff.document.read.all', 'staff', 'View All Staff Documents', 'View documents for any staff member', TRUE),
  ('staff.document.create.all', 'staff', 'Upload Documents for Any Staff', 'Upload documents for any staff member', TRUE),
  ('staff.document.delete', 'staff', 'Delete Staff Documents', 'Delete staff documents', TRUE)
ON CONFLICT (permission_key) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = NOW();

UPDATE app_permissions
SET is_active = FALSE, updated_at = NOW()
WHERE permission_key IN ('payroll.batch.review', 'payroll.batch.load');

DELETE FROM app_role_permissions
WHERE permission_key IN ('payroll.batch.review', 'payroll.batch.load');

UPDATE users u
SET permissions = COALESCE((
  SELECT ARRAY_AGG(DISTINCT mapped.permission_key ORDER BY mapped.permission_key)
  FROM UNNEST(u.permissions) AS existing(permission_key)
  CROSS JOIN LATERAL (
    VALUES (
      CASE existing.permission_key
        WHEN 'payroll.batch.review' THEN 'payroll.batch.approve'
        WHEN 'payroll.batch.load' THEN 'payroll.batch.generate'
        ELSE existing.permission_key
      END
    )
  ) AS mapped(permission_key)
), '{}'::TEXT[])
WHERE u.permissions && ARRAY['payroll.batch.review', 'payroll.batch.load']::TEXT[];

INSERT INTO app_role_permissions (role_key, permission_key)
SELECT 'policy_admin', permission_key
FROM app_permissions
WHERE is_active = TRUE
  AND module_name IN ('payroll', 'arrears', 'staff_adjustments', 'staff')
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
VALUES
  ('payroll_officer', 'payroll.batch.read'),
  ('payroll_officer', 'payroll.batch.create'),
  ('payroll_officer', 'payroll.batch.generate'),
  ('payroll_officer', 'payroll.batch.submit'),
  ('payroll_officer', 'payroll.batch.approve'),
  ('payroll_officer', 'payroll.payment.read'),
  ('payroll_officer', 'arrears.read'),
  ('payroll_officer', 'arrears.create'),
  ('payroll_officer', 'arrears.preview'),
  ('payroll_officer', 'arrears.delete'),
  ('payroll_officer', 'arrears.approve'),
  ('payroll_officer', 'arrears.reject'),
  ('payroll_officer', 'arrears.bulk_approve'),
  ('payroll_officer', 'arrears.bulk_reject'),
  ('payroll_officer', 'arrears.merge'),
  ('payroll_officer', 'arrears.bulk_merge'),
  ('payroll_officer', 'arrears.recalculate'),
  ('payroll_manager', 'payroll.batch.read'),
  ('payroll_manager', 'arrears.read'),
  ('payroll_manager', 'arrears.create'),
  ('payroll_manager', 'arrears.preview'),
  ('payroll_manager', 'arrears.delete'),
  ('payroll_manager', 'arrears.approve'),
  ('payroll_manager', 'arrears.reject'),
  ('payroll_manager', 'arrears.bulk_approve'),
  ('payroll_manager', 'arrears.bulk_reject'),
  ('payroll_manager', 'arrears.merge'),
  ('payroll_manager', 'arrears.bulk_merge'),
  ('payroll_manager', 'arrears.recalculate'),
  ('hr_manager', 'payroll.batch.read'),
  ('hr_manager', 'payroll.batch.approve'),
  ('hr_manager', 'arrears.read'),
  ('hr_manager', 'arrears.create'),
  ('hr_manager', 'arrears.preview'),
  ('hr_manager', 'arrears.delete'),
  ('hr_manager', 'arrears.merge'),
  ('hr_manager', 'arrears.bulk_merge'),
  ('hr_manager', 'arrears.recalculate'),
  ('payroll_loader', 'payroll.batch.read'),
  ('payroll_loader', 'payroll.batch.create'),
  ('payroll_loader', 'payroll.batch.generate'),
  ('payroll_loader', 'payroll.batch.submit'),
  ('payroll_loader', 'arrears.read'),
  ('payroll_loader', 'staff.allowance.catalog.read'),
  ('payroll_loader', 'staff.allowance.read'),
  ('payroll_loader', 'staff.allowance.create'),
  ('payroll_loader', 'staff.allowance.update'),
  ('payroll_loader', 'staff.allowance.delete'),
  ('payroll_loader', 'staff.deduction.catalog.read'),
  ('payroll_loader', 'staff.deduction.read'),
  ('payroll_loader', 'staff.deduction.create'),
  ('payroll_loader', 'staff.deduction.update'),
  ('payroll_loader', 'staff.deduction.delete'),
  ('checking', 'payroll.batch.read'),
  ('checking', 'payroll.batch.approve'),
  ('cpo', 'payroll.batch.read'),
  ('cpo', 'payroll.batch.approve'),
  ('reviewer', 'payroll.batch.read'),
  ('reviewer', 'payroll.batch.approve'),
  ('approver', 'payroll.batch.read'),
  ('approver', 'payroll.batch.approve'),
  ('auditor', 'payroll.batch.read'),
  ('cashier', 'payroll.batch.read'),
  ('cashier', 'payroll.payment.read'),
  ('cashier', 'payroll.payment.execute'),
  ('staff', 'payslip.read')
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (VALUES ('policy_admin'), ('payroll_officer'), ('payroll_loader'), ('hr_manager')) AS roles(role_key)
CROSS JOIN (VALUES ('payslip.read')) AS grants(permission_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
VALUES
  ('policy_admin', 'staff.record.read'),
  ('payroll_officer', 'staff.record.read'),
  ('payroll_loader', 'staff.record.read'),
  ('hr_manager', 'staff.record.read')
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
VALUES
  ('payroll_officer', 'payroll.structure.read'),
  ('policy_admin', 'payroll.structure.read'),
  ('policy_admin', 'payroll.structure.create'),
  ('policy_admin', 'payroll.structure.update'),
  ('policy_admin', 'payroll.structure.delete'),
  ('hr_manager', 'payroll.structure.read'),
  ('hr_manager', 'payroll.structure.create'),
  ('hr_manager', 'payroll.structure.update')
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (VALUES ('payroll_officer'), ('payroll_loader'), ('hr_manager')) AS roles(role_key)
CROSS JOIN (
  VALUES
    ('staff.allowance.catalog.read'),
    ('staff.allowance.read'),
    ('staff.allowance.create'),
    ('staff.allowance.update'),
    ('staff.allowance.delete'),
    ('staff.allowance.status.update'),
    ('staff.deduction.catalog.read'),
    ('staff.deduction.read'),
    ('staff.deduction.create'),
    ('staff.deduction.update'),
    ('staff.deduction.delete'),
    ('staff.deduction.status.update')
) AS grants(permission_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (VALUES ('policy_admin'), ('hr_manager')) AS roles(role_key)
CROSS JOIN (
  VALUES
    ('staff.allowance.catalog.read'),
    ('staff.allowance.catalog.create'),
    ('staff.allowance.catalog.update'),
    ('staff.deduction.catalog.read'),
    ('staff.deduction.catalog.create'),
    ('staff.deduction.catalog.update')
) AS grants(permission_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (VALUES ('payroll_officer'), ('hr_manager')) AS roles(role_key)
CROSS JOIN (VALUES ('staff.allowance.catalog.read'), ('staff.deduction.catalog.read')) AS grants(permission_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
SELECT 'hr_manager', permission_key
FROM (VALUES
  ('staff.record.create'),
  ('staff.record.update'),
  ('staff.record.import'),
  ('staff.request.read'),
  ('staff.request.create'),
  ('staff.request.read.all'),
  ('staff.request.create.all'),
  ('staff.request.approve'),
  ('staff.request.reject'),
  ('staff.document.read'),
  ('staff.document.create'),
  ('staff.document.read.all'),
  ('staff.document.create.all')
) AS grants(permission_key)
ON CONFLICT (role_key, permission_key) DO NOTHING;

INSERT INTO app_role_permissions (role_key, permission_key)
VALUES
  ('staff', 'staff.request.read'),
  ('staff', 'staff.request.create'),
  ('staff', 'staff.document.read'),
  ('staff', 'staff.document.create')
ON CONFLICT (role_key, permission_key) DO NOTHING;

UPDATE users u
SET permissions = COALESCE((
  SELECT ARRAY_AGG(arp.permission_key ORDER BY arp.permission_key)
  FROM app_role_permissions arp
  JOIN app_permissions ap ON ap.permission_key = arp.permission_key AND ap.is_active = TRUE
  WHERE LOWER(arp.role_key) = LOWER(u.role)
), '{}'::TEXT[])
WHERE u.permissions IS NULL
;

ALTER TABLE users ALTER COLUMN permissions SET DEFAULT '{}'::TEXT[];
