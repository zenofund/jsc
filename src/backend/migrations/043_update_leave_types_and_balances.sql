UPDATE leave_types SET annual_days = 30 WHERE lower(name) = 'annual leave';
UPDATE leave_types SET annual_days = 112 WHERE lower(name) = 'maternity leave';
UPDATE leave_types SET annual_days = 14 WHERE lower(name) = 'paternity leave';

INSERT INTO leave_types (name, annual_days, is_paid, carries_forward, status)
VALUES ('Maternity Leave', 112, TRUE, FALSE, 'active')
ON CONFLICT (name) DO NOTHING;

INSERT INTO leave_types (name, annual_days, is_paid, carries_forward, status)
VALUES ('Paternity Leave', 14, TRUE, FALSE, 'active')
ON CONFLICT (name) DO NOTHING;

UPDATE leave_balances lb
SET entitled_days = 30,
    remaining_days = GREATEST(0, 30 - lb.used_days),
    updated_at = NOW()
FROM leave_types lt
WHERE lb.leave_type_id = lt.id
  AND lower(lt.name) = 'annual leave'
  AND lb.year = EXTRACT(year FROM CURRENT_DATE)::int;

UPDATE leave_balances lb
SET entitled_days = 112,
    remaining_days = GREATEST(0, 112 - lb.used_days),
    updated_at = NOW()
FROM leave_types lt
WHERE lb.leave_type_id = lt.id
  AND lower(lt.name) = 'maternity leave'
  AND lb.year = EXTRACT(year FROM CURRENT_DATE)::int;

UPDATE leave_balances lb
SET entitled_days = 14,
    remaining_days = GREATEST(0, 14 - lb.used_days),
    updated_at = NOW()
FROM leave_types lt
WHERE lb.leave_type_id = lt.id
  AND lower(lt.name) = 'paternity leave'
  AND lb.year = EXTRACT(year FROM CURRENT_DATE)::int;

INSERT INTO leave_balances (staff_id, leave_type_id, year, entitled_days, used_days, remaining_days, created_at, updated_at)
SELECT s.id,
       lt.id,
       EXTRACT(year FROM CURRENT_DATE)::int,
       lt.annual_days,
       0,
       lt.annual_days,
       NOW(),
       NOW()
FROM staff s
JOIN leave_types lt ON lt.status = 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM leave_balances lb
  WHERE lb.staff_id = s.id
    AND lb.leave_type_id = lt.id
    AND lb.year = EXTRACT(year FROM CURRENT_DATE)::int
);
