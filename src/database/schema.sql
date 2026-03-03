-- =====================================================
-- 26. NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Recipient Information
    recipient_id VARCHAR(255) NOT NULL, -- User ID or 'all' for broadcast
    recipient_role VARCHAR(50), -- Target specific roles (optional)
    
    -- Notification Content
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'payroll', 'leave', 'promotion', 'loan', 'bank_payment', 
        'approval', 'system', 'arrears', 'document'
    )),
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'info', 'success', 'warning', 'error', 'action_required'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Navigation & Links
    link TEXT, -- Deep link to related page
    action_label VARCHAR(100), -- e.g., 'Review Now', 'View Details'
    action_link TEXT, -- URL for action button
    
    -- Entity Association
    entity_type VARCHAR(100), -- e.g., 'payroll_batch', 'leave_request'
    entity_id VARCHAR(255), -- ID of related entity
    
    -- Additional Data
    metadata JSONB, -- Additional contextual data
    
    -- Status & Priority
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Audit & Lifecycle
    created_by VARCHAR(255), -- System or user who triggered the notification
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP -- Optional expiration date
);

-- Indexes for performance
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_recipient_role ON notifications(recipient_role);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_priority ON notifications(priority);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_notifications_recipient_unread ON notifications(recipient_id, is_read) WHERE is_read = false;