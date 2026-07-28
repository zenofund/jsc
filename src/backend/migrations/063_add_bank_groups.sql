CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bank_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name VARCHAR(150) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    bank_code VARCHAR(20),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bank_groups
    ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE staff
    ADD COLUMN IF NOT EXISTS bank_group_id UUID;

ALTER TABLE payroll_lines
    ADD COLUMN IF NOT EXISTS bank_group_id UUID;

ALTER TABLE payroll_lines
    ADD COLUMN IF NOT EXISTS bank_group_name VARCHAR(150);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_bank_groups_created_by'
    ) THEN
        ALTER TABLE bank_groups
            ADD CONSTRAINT fk_bank_groups_created_by
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_staff_bank_group'
    ) THEN
        ALTER TABLE staff
            ADD CONSTRAINT fk_staff_bank_group
            FOREIGN KEY (bank_group_id) REFERENCES bank_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_payroll_lines_bank_group'
    ) THEN
        ALTER TABLE payroll_lines
            ADD CONSTRAINT fk_payroll_lines_bank_group
            FOREIGN KEY (bank_group_id) REFERENCES bank_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_groups_bank_name_group_name_ci
    ON bank_groups (LOWER(bank_name), LOWER(group_name));

CREATE INDEX IF NOT EXISTS idx_bank_groups_bank_name_active
    ON bank_groups (bank_name, is_active, group_name);

CREATE INDEX IF NOT EXISTS idx_bank_groups_bank_code_active
    ON bank_groups (bank_code, is_active, group_name);

CREATE INDEX IF NOT EXISTS idx_bank_groups_name
    ON bank_groups (group_name);

CREATE INDEX IF NOT EXISTS idx_staff_bank_group_id
    ON staff (bank_group_id);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_bank_group_id
    ON payroll_lines (bank_group_id);

UPDATE payroll_lines pl
SET bank_group_name = bg.group_name
FROM bank_groups bg
WHERE pl.bank_group_id = bg.id
  AND (pl.bank_group_name IS NULL OR BTRIM(pl.bank_group_name) = '');
