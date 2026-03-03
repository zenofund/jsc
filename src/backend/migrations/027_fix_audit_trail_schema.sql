-- Fix audit_trail schema to match application code

-- 1. Rename timestamp to created_at
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_trail'
        AND column_name = 'timestamp'
    ) THEN
        ALTER TABLE audit_trail RENAME COLUMN timestamp TO created_at;
    END IF;
END $$;

-- 2. Rename entity_type to entity
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_trail'
        AND column_name = 'entity_type'
    ) THEN
        ALTER TABLE audit_trail RENAME COLUMN entity_type TO entity;
    END IF;
END $$;

-- 3. Add description column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_trail'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE audit_trail ADD COLUMN description TEXT;
    END IF;
END $$;

-- 4. Add ip_address column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_trail'
        AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE audit_trail ADD COLUMN ip_address VARCHAR(45);
    END IF;
END $$;
