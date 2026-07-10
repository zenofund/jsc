ALTER TABLE allowances
  ADD COLUMN IF NOT EXISTS calculation_basis VARCHAR(20) DEFAULT 'basic';

ALTER TABLE allowances
  DROP CONSTRAINT IF EXISTS allowances_calculation_basis_check;

ALTER TABLE allowances
  ADD CONSTRAINT allowances_calculation_basis_check
  CHECK (calculation_basis IN ('basic', 'gross'));

ALTER TABLE deductions
  ADD COLUMN IF NOT EXISTS calculation_basis VARCHAR(20) DEFAULT 'basic';

ALTER TABLE deductions
  DROP CONSTRAINT IF EXISTS deductions_calculation_basis_check;

ALTER TABLE deductions
  ADD CONSTRAINT deductions_calculation_basis_check
  CHECK (calculation_basis IN ('basic', 'gross'));

ALTER TABLE staff_allowances
  ADD COLUMN IF NOT EXISTS custom_calculation_basis VARCHAR(20);

ALTER TABLE staff_allowances
  DROP CONSTRAINT IF EXISTS staff_allowances_custom_calculation_basis_check;

ALTER TABLE staff_allowances
  ADD CONSTRAINT staff_allowances_custom_calculation_basis_check
  CHECK (custom_calculation_basis IS NULL OR custom_calculation_basis IN ('basic', 'gross'));

ALTER TABLE staff_deductions
  ADD COLUMN IF NOT EXISTS custom_calculation_basis VARCHAR(20);

ALTER TABLE staff_deductions
  DROP CONSTRAINT IF EXISTS staff_deductions_custom_calculation_basis_check;

ALTER TABLE staff_deductions
  ADD CONSTRAINT staff_deductions_custom_calculation_basis_check
  CHECK (custom_calculation_basis IS NULL OR custom_calculation_basis IN ('basic', 'gross'));

UPDATE allowances
SET calculation_basis = CASE
  WHEN type = 'percentage' AND code IN ('PENSION', 'NHF', 'NHIS', 'NHIA') THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%PENSION%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%NHF%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%HOUSING FUND%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%NHIS%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%NHIA%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%HEALTH INSURANCE%' THEN 'gross'
  ELSE 'basic'
END
WHERE calculation_basis IS NULL OR calculation_basis NOT IN ('basic', 'gross');

UPDATE deductions
SET calculation_basis = CASE
  WHEN type = 'percentage' AND code IN ('PENSION', 'NHF', 'NHIS', 'NHIA') THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%PENSION%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%NHF%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%HOUSING FUND%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%NHIS%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%NHIA%' THEN 'gross'
  WHEN type = 'percentage' AND UPPER(name) LIKE '%HEALTH INSURANCE%' THEN 'gross'
  ELSE 'basic'
END
WHERE calculation_basis IS NULL OR calculation_basis NOT IN ('basic', 'gross');

UPDATE staff_allowances sa
SET custom_calculation_basis = 'basic'
WHERE sa.allowance_id IS NULL
  AND COALESCE(sa.custom_type, '') = 'percentage'
  AND (sa.custom_calculation_basis IS NULL OR sa.custom_calculation_basis NOT IN ('basic', 'gross'));

UPDATE staff_deductions sd
SET custom_calculation_basis = 'basic'
WHERE sd.deduction_id IS NULL
  AND COALESCE(sd.custom_type, '') = 'percentage'
  AND (sd.custom_calculation_basis IS NULL OR sd.custom_calculation_basis NOT IN ('basic', 'gross'));
