-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create idempotency_keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    response_code INTEGER,
    response_body JSONB,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_idempotency_key UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys(created_at);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_idempotency_keys_updated_at ON idempotency_keys;
CREATE TRIGGER update_idempotency_keys_updated_at
    BEFORE UPDATE ON idempotency_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
