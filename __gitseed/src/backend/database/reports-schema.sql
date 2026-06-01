-- Reports Module Schema

-- 1. Report Templates
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- payroll, staff, etc.
    config JSONB NOT NULL, -- The report configuration
    is_public BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- 2. Report Executions (History)
CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    execution_type VARCHAR(20) DEFAULT 'manual', -- manual, scheduled, api
    status VARCHAR(20) NOT NULL, -- running, completed, failed
    total_rows INTEGER,
    execution_time_ms INTEGER,
    export_format VARCHAR(10), -- json, csv, pdf, excel
    file_path TEXT, -- If result was saved to file
    error_message TEXT,
    executed_by UUID REFERENCES users(id),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Report Schedules
CREATE TABLE IF NOT EXISTS report_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly, custom
    cron_expression VARCHAR(100),
    time_of_day VARCHAR(5), -- HH:mm
    day_of_week INTEGER[], -- 0-6
    day_of_month INTEGER[], -- 1-31
    recipients JSONB, -- Array of user_ids or emails
    export_format VARCHAR(10) DEFAULT 'pdf',
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Report Shares
CREATE TABLE IF NOT EXISTS report_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    shared_with_role VARCHAR(50),
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_execute BOOLEAN DEFAULT TRUE,
    can_schedule BOOLEAN DEFAULT FALSE,
    shared_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_id, shared_with_user_id)
);

-- 5. Report Favorites
CREATE TABLE IF NOT EXISTS report_favorites (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, template_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);
CREATE INDEX IF NOT EXISTS idx_report_executions_template_id ON report_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_executed_by ON report_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = true;
