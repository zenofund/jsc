-- Force drop table to ensure clean state
DROP TABLE IF EXISTS system_settings;

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO system_settings (key, value, description)
VALUES (
    'general_settings',
    '{
        "organization_name": "Judicial Service Committee",
        "payroll_prefix": "JSC",
        "auto_generate_payslips": true,
        "app_version": "1.0.1",
        "approval_workflow": [
            {"stage": 1, "role": "reviewer", "name": "Review"},
            {"stage": 2, "role": "approver", "name": "Approval"},
            {"stage": 3, "role": "auditor", "name": "Audit"},
            {"stage": 4, "role": "cashier", "name": "Payment"}
        ],
        "tax_zones": [
            {"zone": "Lagos", "rate": 0},
            {"zone": "Ogun", "rate": 0},
            {"zone": "FCT", "rate": 0}
        ]
    }'::jsonb,
    'General application settings including organization details and workflow'
) ON CONFLICT (key) DO NOTHING;
