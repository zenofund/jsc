UPDATE loan_types
SET
  requires_guarantors = CASE
    WHEN COALESCE(requires_guarantors, false) THEN true
    WHEN COALESCE(min_guarantors, 0) > 0 OR COALESCE(required_guarantors, 0) > 0 THEN true
    ELSE false
  END,
  min_guarantors = CASE
    WHEN COALESCE(requires_guarantors, false) THEN COALESCE(NULLIF(min_guarantors, 0), NULLIF(required_guarantors, 0), 0)
    WHEN COALESCE(min_guarantors, 0) > 0 OR COALESCE(required_guarantors, 0) > 0 THEN COALESCE(NULLIF(min_guarantors, 0), NULLIF(required_guarantors, 0), 0)
    ELSE 0
  END,
  required_guarantors = CASE
    WHEN COALESCE(requires_guarantors, false) THEN COALESCE(NULLIF(required_guarantors, 0), NULLIF(min_guarantors, 0), 0)
    WHEN COALESCE(min_guarantors, 0) > 0 OR COALESCE(required_guarantors, 0) > 0 THEN COALESCE(NULLIF(required_guarantors, 0), NULLIF(min_guarantors, 0), 0)
    ELSE 0
  END
WHERE
  COALESCE(requires_guarantors, false) = false
  AND (COALESCE(min_guarantors, 0) > 0 OR COALESCE(required_guarantors, 0) > 0);
