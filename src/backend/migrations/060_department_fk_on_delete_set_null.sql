ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_department_id_fkey;

ALTER TABLE staff
  ADD CONSTRAINT staff_department_id_fkey
  FOREIGN KEY (department_id)
  REFERENCES departments(id)
  ON DELETE SET NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_department_id_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_department_id_fkey
  FOREIGN KEY (department_id)
  REFERENCES departments(id)
  ON DELETE SET NULL;
