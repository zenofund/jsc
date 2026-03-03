-- Password Reset Tokens Table
-- Stores secure tokens for password reset functionality

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  used_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add comment for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens with expiration and usage tracking';

-- Cleanup expired tokens periodically (run via cron job or scheduled task)
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '7 days';
