-- =====================================================
-- REPORTS MODULE SCHEMA
-- =====================================================

-- Report Templates Table
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- 'payroll', 'staff', 'loans', 'leave', 'cooperative', 'custom'
    
    -- Report Configuration (JSON)
    config JSONB NOT NULL, -- { tables, fields, filters, joins, groupBy, orderBy, aggregations }
    
    -- Metadata
    is_public BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false, -- System-defined templates
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'archived'
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_template_name UNIQUE(name, created_by)
);

CREATE INDEX idx_report_templates_category ON report_templates(category);
CREATE INDEX idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX idx_report_templates_status ON report_templates(status);

-- Report Executions Table (Track report runs)
CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    
    -- Execution Details
    execution_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled', 'api'
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
    
    -- Results
    total_rows INTEGER,
    execution_time_ms INTEGER,
    file_path TEXT, -- Path to exported file if generated
    export_format VARCHAR(20), -- 'pdf', 'excel', 'csv', 'json'
    
    -- Error Tracking
    error_message TEXT,
    
    -- Audit
    executed_by UUID REFERENCES users(id),
    executed_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_report_executions_template ON report_executions(template_id);
CREATE INDEX idx_report_executions_executed_by ON report_executions(executed_by);
CREATE INDEX idx_report_executions_status ON report_executions(status);

-- Report Schedules Table
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    
    -- Schedule Configuration
    schedule_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    cron_expression VARCHAR(100), -- For custom schedules
    
    -- Time Settings
    time_of_day TIME, -- Execution time
    day_of_week INTEGER[], -- For weekly (0=Sunday, 6=Saturday)
    day_of_month INTEGER[], -- For monthly (1-31)
    
    -- Recipients
    recipients JSONB, -- [{ userId, email }]
    
    -- Export Settings
    export_format VARCHAR(20) DEFAULT 'pdf', -- 'pdf', 'excel', 'csv'
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_schedules_template ON report_schedules(template_id);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = true;

-- Report Shares Table (Share reports with specific users)
CREATE TABLE IF NOT EXISTS report_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    
    -- Shared With
    shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    shared_with_role VARCHAR(50), -- Share with entire role
    
    -- Permissions
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    can_execute BOOLEAN DEFAULT true,
    can_schedule BOOLEAN DEFAULT false,
    
    -- Audit
    shared_by UUID REFERENCES users(id),
    shared_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- Optional expiration
    
    CONSTRAINT unique_template_user_share UNIQUE(template_id, shared_with_user_id),
    CONSTRAINT unique_template_role_share UNIQUE(template_id, shared_with_role)
);

CREATE INDEX idx_report_shares_template ON report_shares(template_id);
CREATE INDEX idx_report_shares_user ON report_shares(shared_with_user_id);
CREATE INDEX idx_report_shares_role ON report_shares(shared_with_role);

-- Report Favorites Table
CREATE TABLE IF NOT EXISTS report_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_user_favorite UNIQUE(template_id, user_id)
);

CREATE INDEX idx_report_favorites_user ON report_favorites(user_id);

COMMENT ON TABLE report_templates IS 'User-defined custom report templates';
COMMENT ON TABLE report_executions IS 'History of report executions';
COMMENT ON TABLE report_schedules IS 'Scheduled report configurations';
COMMENT ON TABLE report_shares IS 'Report sharing permissions';
COMMENT ON TABLE report_favorites IS 'User favorite reports';
