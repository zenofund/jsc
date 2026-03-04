DELETE FROM leave_balances lb
USING leave_types lt, staff s
WHERE lb.leave_type_id = lt.id
  AND lb.staff_id = s.id
  AND lower(lt.name) LIKE '%maternity%'
  AND lower(coalesce(s.gender, '')) <> 'female';

DELETE FROM leave_balances lb
USING leave_types lt, staff s
WHERE lb.leave_type_id = lt.id
  AND lb.staff_id = s.id
  AND lower(lt.name) LIKE '%paternity%'
  AND lower(coalesce(s.gender, '')) <> 'male';
