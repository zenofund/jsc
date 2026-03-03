-- SMTP Settings Table
-- Stores email server configuration for the system

CREATE TABLE IF NOT EXISTS smtp_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN DEFAULT false,
  username VARCHAR(255) NOT NULL,
  password_encrypted TEXT NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) NOT NULL DEFAULT 'JSC Payroll System',
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMP,
  test_status VARCHAR(50),
  test_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Only allow one active SMTP configuration
CREATE UNIQUE INDEX IF NOT EXISTS idx_smtp_settings_active ON smtp_settings(is_active) WHERE is_active = true;

-- Email notification logs
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  template_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  metadata JSONB
);

-- Indexes for email logs
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);

-- Comments
COMMENT ON TABLE smtp_settings IS 'SMTP server configuration for sending emails';
COMMENT ON TABLE email_logs IS 'Log of all emails sent by the system';
