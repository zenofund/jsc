-- =====================================================
-- JSC-PMS Row Level Security (RLS) Policies
-- =====================================================
-- NOTE: These are OPTIONAL since the backend uses SERVICE_ROLE_KEY
-- which bypasses RLS. However, they provide an extra security layer
-- (defense in depth) and are recommended for audit compliance.
-- =====================================================

-- =====================================================
-- APPROACH: Backend-Controlled Security
-- =====================================================
-- The JSC-PMS uses APPLICATION-LEVEL security, not database-level RLS.
-- 
-- Why?
-- 1. Custom JWT authentication (not Supabase Auth)
-- 2. All database access goes through NestJS backend
-- 3. Backend uses SERVICE_ROLE_KEY (bypasses RLS)
-- 4. Authorization controlled by NestJS Guards
--
-- When to enable these policies:
-- - For defense in depth (extra security layer)
-- - For audit compliance requirements
-- - To prevent accidental direct database access
-- - If you decide to add direct client access in future
-- =====================================================

-- =====================================================
-- OPTION 1: Disable RLS (Current Approach)
-- =====================================================
-- Since backend uses SERVICE_ROLE_KEY, RLS is effectively bypassed.
-- This is the current production configuration.

-- Example: Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines DISABLE ROW LEVEL SECURITY;
-- ... (repeat for all 30 tables)

-- =====================================================
-- OPTION 2: Enable RLS (Defense in Depth - Recommended)
-- =====================================================
-- Even though backend bypasses RLS, enabling these policies
-- adds an extra security layer for audit compliance.

-- ==================== USERS TABLE ====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Admin can see all users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );

-- Users can view their own record
CREATE POLICY "Users can view own record"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Admin can manage users
CREATE POLICY "Admins can manage users"
  ON users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );

-- ==================== STAFF TABLE ====================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view staff
CREATE POLICY "Authenticated users can view staff"
  ON staff FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only Admin, Payroll Officer, HR Manager can create staff
CREATE POLICY "Authorized roles can create staff"
  ON staff FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

-- Only Admin, Payroll Officer, HR Manager can update staff
CREATE POLICY "Authorized roles can update staff"
  ON staff FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

-- Only Admin can delete staff
CREATE POLICY "Only admins can delete staff"
  ON staff FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );

-- ==================== DEPARTMENTS TABLE ====================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view departments
CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only Admin can manage departments
CREATE POLICY "Only admins can manage departments"
  ON departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );

-- ==================== PAYROLL BATCHES ====================

ALTER TABLE payroll_batches ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view payroll batches
CREATE POLICY "Authenticated users can view payroll batches"
  ON payroll_batches FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only Payroll Officer and Admin can create batches
CREATE POLICY "Authorized roles can create payroll batches"
  ON payroll_batches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer')
      AND u.status = 'active'
    )
  );

-- Only Payroll Officer and Admin can update draft batches
CREATE POLICY "Authorized roles can update draft payroll batches"
  ON payroll_batches FOR UPDATE
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer')
      AND u.status = 'active'
    )
  );

-- Only Admin can delete draft batches
CREATE POLICY "Only admins can delete draft payroll batches"
  ON payroll_batches FOR DELETE
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );

-- ==================== PAYROLL LINES ====================

ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;

-- Staff can view their own payroll lines
CREATE POLICY "Staff can view own payroll lines"
  ON payroll_lines FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

-- Authorized roles can view all payroll lines
CREATE POLICY "Authorized roles can view all payroll lines"
  ON payroll_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager', 'Accountant', 'Auditor', 'Cashier')
      AND u.status = 'active'
    )
  );

-- Only system can create/update payroll lines (via backend)
CREATE POLICY "System can manage payroll lines"
  ON payroll_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer')
      AND u.status = 'active'
    )
  );

-- ==================== ALLOWANCES ====================

ALTER TABLE allowances ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view allowances
CREATE POLICY "Authenticated users can view allowances"
  ON allowances FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only Admin and HR Manager can manage allowances
CREATE POLICY "Authorized roles can manage allowances"
  ON allowances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

-- ==================== DEDUCTIONS ====================

ALTER TABLE deductions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view deductions
CREATE POLICY "Authenticated users can view deductions"
  ON deductions FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only Admin and HR Manager can manage deductions
CREATE POLICY "Authorized roles can manage deductions"
  ON deductions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

-- ==================== STAFF ALLOWANCES ====================

ALTER TABLE staff_allowances ENABLE ROW LEVEL SECURITY;

-- Staff can view their own allowances
CREATE POLICY "Staff can view own allowances"
  ON staff_allowances FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

-- Authorized roles can view all staff allowances
CREATE POLICY "Authorized roles can view all staff allowances"
  ON staff_allowances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager', 'Accountant', 'Auditor')
      AND u.status = 'active'
    )
  );

-- Only Admin, Payroll Officer, HR Manager can manage staff allowances
CREATE POLICY "Authorized roles can manage staff allowances"
  ON staff_allowances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

-- ==================== STAFF DEDUCTIONS ====================

ALTER TABLE staff_deductions ENABLE ROW LEVEL SECURITY;

-- Staff can view their own deductions
CREATE POLICY "Staff can view own deductions"
  ON staff_deductions FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

-- Authorized roles can view all staff deductions
CREATE POLICY "Authorized roles can view all staff deductions"
  ON staff_deductions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager', 'Accountant', 'Auditor')
      AND u.status = 'active'
    )
  );

-- Only Admin, Payroll Officer, HR Manager can manage staff deductions
CREATE POLICY "Authorized roles can manage staff deductions"
  ON staff_deductions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

-- ==================== WORKFLOW APPROVALS ====================

ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;

-- Authorized roles can view approvals
CREATE POLICY "Authorized roles can view approvals"
  ON workflow_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll/HR Manager', 'Accountant', 'Auditor')
      AND u.status = 'active'
    )
  );

-- System can manage approvals (via backend)
CREATE POLICY "System can manage approvals"
  ON workflow_approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer')
      AND u.status = 'active'
    )
  );

-- ==================== AUDIT TRAIL ====================

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Only Admin and Auditor can view audit trail
CREATE POLICY "Authorized roles can view audit trail"
  ON audit_trail FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Auditor')
      AND u.status = 'active'
    )
  );

-- System can insert audit records
CREATE POLICY "System can insert audit records"
  ON audit_trail FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ==================== COOPERATIVES ====================

ALTER TABLE cooperatives ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view cooperatives
CREATE POLICY "Authenticated users can view cooperatives"
  ON cooperatives FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only Admin can manage cooperatives
CREATE POLICY "Only admins can manage cooperatives"
  ON cooperatives FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );

-- ==================== LOAN APPLICATIONS ====================

ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

-- Staff can view their own loan applications
CREATE POLICY "Staff can view own loan applications"
  ON loan_applications FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

-- Authorized roles can view all loan applications
CREATE POLICY "Authorized roles can view all loan applications"
  ON loan_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager', 'Accountant')
      AND u.status = 'active'
    )
  );

-- Staff can create their own loan applications
CREATE POLICY "Staff can create own loan applications"
  ON loan_applications FOR INSERT
  WITH CHECK (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

-- Authorized roles can update loan applications
CREATE POLICY "Authorized roles can update loan applications"
  ON loan_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

-- ==================== NOTIFICATIONS ====================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- System can create notifications for any user
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- APPLY RLS TO REMAINING TABLES
-- =====================================================

-- Enable RLS on all remaining tables with basic policies

ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view salary structures"
  ON salary_structures FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE arrears ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized roles can manage arrears"
  ON arrears FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll Officer', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized roles can manage promotions"
  ON promotions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('Admin', 'Payroll/HR Manager')
      AND u.status = 'active'
    )
  );

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view leave types"
  ON leave_types FOR SELECT
  USING (auth.role() = 'authenticated');

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own leave balances"
  ON leave_balances FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage own leave requests"
  ON leave_requests FOR ALL
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view own documents"
  ON staff_documents FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN users u ON u.staff_id = s.id
      WHERE u.id = auth.uid()
    )
  );

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage system settings"
  ON system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'Admin'
      AND u.status = 'active'
    )
  );

-- =====================================================
-- SUMMARY
-- =====================================================
-- RLS Status: ENABLED (Defense in Depth)
-- 
-- Backend Access: Uses SERVICE_ROLE_KEY (bypasses RLS)
-- Direct Client Access: Blocked by RLS policies
-- 
-- This configuration provides:
-- 1. Application-level security (primary)
-- 2. Database-level security (backup)
-- 3. Audit compliance
-- 4. Defense in depth
-- 
-- To disable RLS and rely only on backend security,
-- run: ALTER TABLE tablename DISABLE ROW LEVEL SECURITY;
-- for each table.
-- =====================================================
