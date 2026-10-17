-- Store a fingerprint with every idempotency key so the same key cannot be
-- accidentally reused for another user, route, or request body.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  response_code INTEGER,
  response_body JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_idempotency_key UNIQUE (key)
);

ALTER TABLE idempotency_keys
ADD COLUMN IF NOT EXISTS request_hash TEXT;

UPDATE idempotency_keys
SET request_hash = split_part(path, '::idempotency-hash::', 2),
    path = split_part(path, '::idempotency-hash::', 1)
WHERE request_hash IS NULL
  AND position('::idempotency-hash::' IN path) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_keys_key
ON idempotency_keys (key);

-- Payroll has one batch per month. Do not remove historical data if duplicates
-- already exist; the service also serializes creates by month in that case.
DO $$
DECLARE
  month_column TEXT;
  has_duplicates BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payroll_batches' AND column_name = 'payroll_month'
  ) THEN
    month_column := 'payroll_month';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payroll_batches' AND column_name = 'month'
  ) THEN
    month_column := 'month';
  END IF;

  IF month_column IS NOT NULL THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM payroll_batches WHERE %1$I IS NOT NULL GROUP BY %1$I HAVING COUNT(*) > 1)',
      month_column
    ) INTO has_duplicates;

    IF has_duplicates THEN
      RAISE NOTICE 'Historical payroll batches contain duplicate months; the service-level month lock will protect new batches. Review existing rows before adding the unique index.';
    ELSE
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_batches_payroll_month ON payroll_batches (%I) WHERE %I IS NOT NULL',
        month_column,
        month_column
      );
    END IF;
  ELSE
    RAISE NOTICE 'No payroll month column found; skipped the payroll batch unique index.';
  END IF;
END $$;
