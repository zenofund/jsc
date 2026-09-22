-- Reconcile the promotion-arrears defaults for databases adopted by the
-- consolidated migration runner. Admin changes made after this migration
-- remain authoritative; this only establishes the supported statutory policy.
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
