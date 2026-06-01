-- Add force_password_change column to users table
-- This flag indicates whether a user must change their password on next login

ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;

-- Update existing users with default passwords to force password change
-- This will be useful when automatically creating user accounts for staff

COMMENT ON COLUMN users.force_password_change IS 'Flag to force user to change password on next login';

-- Index for quick lookups of users who need to change passwords
CREATE INDEX IF NOT EXISTS idx_users_force_password_change ON users(force_password_change) WHERE force_password_change = true;
