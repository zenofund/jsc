ALTER TABLE deductions
  ADD COLUMN IF NOT EXISTS applies_to_promotion_arrears BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promotion_arrears_basis VARCHAR(10) NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS is_paye_relief BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE deductions
  DROP CONSTRAINT IF EXISTS deductions_promotion_arrears_basis_check;

ALTER TABLE deductions
  ADD CONSTRAINT deductions_promotion_arrears_basis_check
  CHECK (promotion_arrears_basis IN ('basic', 'gross'));

-- Preserve the existing policy for deductions already configured in the system.
UPDATE deductions
SET applies_to_promotion_arrears = TRUE,
    promotion_arrears_basis = CASE
      WHEN UPPER(code) = 'UNION' OR UPPER(name) LIKE '%UNION%' THEN 'basic'
      ELSE 'gross'
    END,
    is_paye_relief = CASE
      WHEN UPPER(code) IN ('PENSION', 'NHIA', 'NHIS', 'NHF')
        OR UPPER(name) LIKE '%PENSION%'
        OR UPPER(name) LIKE '%NHIA%'
        OR UPPER(name) LIKE '%NHIS%'
        OR UPPER(name) LIKE '%NATIONAL HOUSING FUND%'
      THEN TRUE ELSE FALSE
    END
WHERE UPPER(code) IN ('PENSION', 'NHIA', 'NHIS', 'NHF', 'UNION')
   OR UPPER(name) LIKE '%PENSION%'
   OR UPPER(name) LIKE '%NHIA%'
   OR UPPER(name) LIKE '%NHIS%'
   OR UPPER(name) LIKE '%NATIONAL HOUSING FUND%'
   OR UPPER(name) LIKE '%UNION%';
