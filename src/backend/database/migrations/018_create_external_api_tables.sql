-- External API Key Management System
-- For integrating external systems (Cooperative System, etc.)

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL, -- e.g., "Cooperative Management System"
  description TEXT,
  api_key VARCHAR(255) UNIQUE NOT NULL, -- Hashed API key
  api_key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification (e.g., "jsc_live_")
  
  -- Permissions
  scopes TEXT[] DEFAULT '{}', -- ['read:staff', 'write:deductions', 'read:payroll']
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, revoked
  
  -- Security
  ip_whitelist TEXT[], -- Optional IP restrictions
  rate_limit_per_hour INTEGER DEFAULT 1000,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP, -- Optional expiration
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API call logs (audit trail)
CREATE TABLE IF NOT EXISTS api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  -- Request details
  method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE
  endpoint VARCHAR(500) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  
  -- Request/Response
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  
  -- Performance
  execution_time_ms INTEGER,
  
  -- Errors
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhooks configuration
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL, -- Webhook URL to call
  
  -- Events to listen to
  events TEXT[] DEFAULT '{}', -- ['payroll.completed', 'deduction.processed']
  
  -- Security
  secret VARCHAR(255), -- For signing webhook payloads
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, inactive
  
  -- Retry configuration
  retry_attempts INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  
  -- Stats
  last_triggered_at TIMESTAMP,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  
  -- Delivery details
  status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  
  -- Retry tracking
  attempt_number INTEGER DEFAULT 1,
  next_retry_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP
);

-- External deductions (created via API)
CREATE TABLE IF NOT EXISTS external_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  -- Link to actual deduction
  staff_deduction_id UUID REFERENCES staff_deductions(id) ON DELETE CASCADE,
  
  -- External system reference
  external_reference VARCHAR(255), -- Reference ID from cooperative system
  external_system VARCHAR(100), -- 'cooperative_system', etc.
  
  -- Deduction details
  staff_id UUID REFERENCES staff(id),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  
  -- Processing
  status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed, cancelled
  processed_at TIMESTAMP,
  payroll_batch_id UUID REFERENCES payroll_batches(id),
  
  -- Metadata
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_api_keys_status ON api_keys(status);
CREATE INDEX idx_api_keys_api_key ON api_keys(api_key);
CREATE INDEX idx_api_call_logs_api_key_id ON api_call_logs(api_key_id);
CREATE INDEX idx_api_call_logs_created_at ON api_call_logs(created_at);
CREATE INDEX idx_webhook_endpoints_api_key_id ON webhook_endpoints(api_key_id);
CREATE INDEX idx_webhook_deliveries_webhook_endpoint_id ON webhook_deliveries(webhook_endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_external_deductions_api_key_id ON external_deductions(api_key_id);
CREATE INDEX idx_external_deductions_staff_id ON external_deductions(staff_id);
CREATE INDEX idx_external_deductions_status ON external_deductions(status);
CREATE INDEX idx_external_deductions_external_ref ON external_deductions(external_reference);

-- Comments
COMMENT ON TABLE api_keys IS 'API keys for external system integration';
COMMENT ON TABLE api_call_logs IS 'Audit trail of all external API calls';
COMMENT ON TABLE webhook_endpoints IS 'Webhook configurations for event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Log of webhook delivery attempts';
COMMENT ON TABLE external_deductions IS 'Deductions created via external API';

COMMENT ON COLUMN api_keys.scopes IS 'Permissions: read:staff, write:deductions, read:payroll, etc.';
COMMENT ON COLUMN api_keys.ip_whitelist IS 'Optional IP address restrictions';
COMMENT ON COLUMN webhook_endpoints.secret IS 'Secret for HMAC signature verification';
COMMENT ON COLUMN external_deductions.external_reference IS 'Reference ID from external system (e.g., cooperative member ID)';