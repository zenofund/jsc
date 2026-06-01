UPDATE loan_applications la
SET loan_type_name = lt.name
FROM loan_types lt
WHERE la.loan_type_id = lt.id
AND la.loan_type_name IS NULL;
