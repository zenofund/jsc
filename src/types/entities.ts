// =====================================================
// JSC-PMS Entity Type Definitions
// =====================================================
// Centralized type definitions for all database entities
// Migrated from /lib/indexeddb.ts
// =====================================================

// ============================================
// User & Authentication
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  role: 'admin' | 'payroll_officer' | 'hr_manager' | 'reviewer' | 'checking' | 'approver' | 'cpo' | 'auditor' | 'cashier' | 'staff' | 'payroll_loader';
  permissions: string[];
  department?: string;
  staff_id?: string;
  status: 'active' | 'inactive';
  must_change_password: boolean;
  last_login?: string;
  created_at: string;
}

// ============================================
// Department & Organization
// ============================================

export interface Department {
  id: string;
  name: string;
  code: string;
  head_of_department?: string;
  description?: string;
  budget_code?: string;
  location?: string;
  status: 'active' | 'inactive';
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Staff Management
// ============================================

export interface Staff {
  id: string;
  staff_number: string;
  bio_data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    date_of_birth: string;
    gender: 'male' | 'female';
    phone: string;
    email: string;
    address: string;
    state_of_origin: string;
    lga_of_origin: string;
    marital_status: 'single' | 'married' | 'divorced' | 'widowed';
    nationality?: string;
  };
  next_of_kin: {
    name: string;
    relationship: string;
    phone: string;
    address: string;
  };
  appointment: {
    date_of_first_appointment: string;
    current_posting: string;
    department: string;
    department_id?: string; // Added for edit form population
    designation: string;
    unit?: string;
    cadre?: string;
    appointment_type?: string; // Corresponds to employment_type in DB
    employment_date: string; // Actual resumption/hire date for current position
    confirmation_date?: string; // Date of confirmation of appointment
    retirement_date?: string; // Expected date of retirement
    exit_date?: string; // Resignation/termination date (if applicable)
    exit_reason?: string; // 'resignation' | 'termination' | 'retirement' | 'death'
    promotion_date?: string; // Effective date of promotion for mid-month proration
    previous_grade_level?: number; // Grade level before promotion
    previous_step?: number; // Step before promotion
    previous_basic_salary?: number; // Basic salary before promotion
  };
  salary_info: {
    grade_level: number | string;
    step: number;
    bank_name: string;
    account_number: string;
    account_name?: string;
    bvn?: string;
    pension_pin?: string;
    tax_id?: string;
    nhf_number?: string;
  };
  status: 'active' | 'suspended' | 'on_leave' | 'retired' | 'terminated';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface StaffRequest {
  id: string;
  staff_id: string;
  request_type: 'contact_update' | 'bank_update' | 'salary_certificate' | 'employment_verification' | 'nok_update';
  details: any;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approval_date?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffDocument {
  id: string;
  staff_id: string;
  document_type: 'appointment_letter' | 'confirmation_letter' | 'promotion_letter' | 'id_card' | 'certificate' | 'other';
  title: string;
  file_url?: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
}

// ============================================
// Salary Structure
// ============================================

export interface SalaryStructure {
  id: string;
  name: string;
  effective_date: string;
  grade_levels: {
    level: number;
    steps: {
      step: number;
      basic_salary: number;
    }[];
  }[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Allowances & Deductions
// ============================================

export interface Allowance {
  id: string;
  name: string;
  code: string;
  type: 'fixed' | 'percentage';
  amount?: number;
  percentage?: number;
  is_taxable: boolean;
  is_pensionable: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Deduction {
  id: string;
  name: string;
  code: string;
  type: 'fixed' | 'percentage';
  amount?: number;
  percentage?: number;
  is_statutory: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface StaffAllowance {
  id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  allowance_code: string;
  allowance_name: string;
  type: 'fixed' | 'percentage';
  amount?: number;
  percentage?: number;
  frequency: 'recurring' | 'one-time';
  is_taxable: boolean;
  is_pensionable: boolean;
  effective_from: string;
  effective_to?: string;
  status: 'active' | 'inactive' | 'expired';
  applied_months?: string[]; // Track which payroll months this was applied to
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface StaffDeduction {
  id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  deduction_code: string;
  deduction_name: string;
  type: 'fixed' | 'percentage';
  amount?: number;
  percentage?: number;
  frequency: 'recurring' | 'one-time';
  effective_from: string;
  effective_to?: string;
  status: 'active' | 'inactive' | 'expired';
  applied_months?: string[]; // Track which payroll months this was applied to
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Payroll Management
// ============================================

export interface PayrollBatch {
  id: string;
  batch_number: string;
  month: string;
  period_start: string;
  period_end: string;
  total_staff: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  status: 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'locked' | 'paid' | 'ready_for_payment';
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed';
  payment_executed_by?: string;
  payment_executed_at?: string;
  payment_reference?: string;
  current_approval_stage?: number;
  locked_by?: string;
  locked_at?: string;
  created_by: string;
  created_at: string;
}

export interface PayrollLine {
  id: string;
  payroll_batch_id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  grade_level: number;
  step: number;
  basic_salary: number;
  total_allowances?: number;
  allowances: { code: string; name: string; amount: number; is_taxable?: boolean }[];
  deductions: { code: string; name: string; amount: number }[];
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  bank_name?: string;
  account_number?: string;
  arrears_amount?: number;
  is_prorated: boolean;
  proration_details?: {
    working_days_in_month: number;
    actual_days_worked: number;
    proration_factor: number;
    proration_reason: 'new_hire' | 'mid_month_exit' | 'promotion' | 'combined' | null;
    employment_date?: string;
    exit_date?: string;
    original_basic_salary: number;
    prorated_basic_salary: number;
  };
  tax_details?: {
    gross_income: number;
    annual_gross: number;
    cra_amount: number;
    pension_deduction: number;
    nhf_deduction: number;
    total_relief: number;
    taxable_income: number;
    annual_taxable_income: number;
    tax_breakdown: any[];
    total_annual_tax: number;
    monthly_tax: number;
    effective_tax_rate: number;
    calculation_method: string;
  };
  created_at: string;
}

export interface PayrollAdjustment {
  id: string;
  payroll_batch_id: string;
  payroll_line_id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  adjustment_type: 'allowance' | 'deduction';
  item_code: string;
  item_name: string;
  amount: number;
  reason: string;
  is_taxable?: boolean;
  adjusted_by: string;
  created_at: string;
}

// ============================================
// Arrears Management
// ============================================

export interface Arrears {
  id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  reason: 'promotion' | 'salary_adjustment' | 'increment' | 'other';
  old_salary: number;
  new_salary: number;
  old_basic_salary: number;
  new_basic_salary: number;
  old_grade?: number;
  new_grade?: number;
  old_step?: number;
  new_step?: number;
  adjustment_amount?: number;
  effective_date: string;
  months_owed: number;
  total_arrears: number;
  status: 'pending' | 'approved' | 'processed' | 'paid';
  approved_by?: string;
  approved_at?: string;
  payroll_batch_id?: string;
  arrears_details: { month: string; amount: number }[];
  details: { month: string; amount: number }[];
  created_at: string;
  updated_at?: string;
}

// Note: This is an alias for backward compatibility
export type Arrear = Arrears;

// ============================================
// Promotions
// ============================================

export interface Promotion {
  id: string;
  staff_id: string;
  old_grade_level: number;
  old_step: number;
  new_grade_level: number;
  new_step: number;
  effective_date: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approval_date?: string;
  arrears_calculated: boolean;
  created_at: string;
}

// ============================================
// Notifications
// ============================================

export interface Notification {
  id: string;
  recipient_id: string; // User ID or 'all' for broadcast
  recipient_role?: string; // Target specific roles (optional)
  type: 'payroll' | 'leave' | 'promotion' | 'loan' | 'bank_payment' | 'approval' | 'system' | 'arrears' | 'document';
  category: 'info' | 'success' | 'warning' | 'error' | 'action_required';
  title: string;
  message: string;
  link?: string; // Deep link to related page
  entity_type?: string; // e.g., 'payroll_batch', 'leave_request', 'loan_application'
  entity_id?: string; // ID of related entity
  metadata?: Record<string, any>; // Additional contextual data
  is_read: boolean;
  read_at?: string;
  created_at: string;
  expires_at?: string; // Optional expiration date
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action_label?: string; // e.g., 'Review Now', 'View Details'
  action_link?: string;
  created_by?: string; // System or user who triggered the notification
}

// ============================================
// Audit Trail
// ============================================

export interface AuditTrail {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  timestamp: string;
}

// ============================================
// System Settings
// ============================================

export interface SystemSettings {
  id: string;
  organization_name?: string;
  organization_logo?: string;
  organization_email?: string;
  organization_phone?: string;
  organization_address?: string;
  currency?: string;
  date_format?: string;
  timezone?: string;
  payroll_prefix?: string;
  app_version?: string;
  auto_generate_payslips?: boolean;
  payday_day?: number;
  payroll_cutoff_day: number;
  approval_workflow: { stage: number; name: string; role: string }[];
  allowed_grades?: Array<number | string>;
  arrears_auto_detect: boolean;
  tax_zones: { zone: string; rate: number }[];
  pension_rate: number;
  tax_configuration?: {
    tax_bands: { min: number; max: number; rate: number }[];
    cra_rate_1: number;
    cra_fixed_amount: number;
    cra_rate_2: number;
    minimum_tax_rate: number;
    nhf_rate: number;
    pension_rate: number;
    use_annual_calculation: boolean;
  };
  created_at: string;
  updated_at: string;
}

// ============================================
// Leave Management
// ============================================

export interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'compassionate' | 'unpaid';
  start_date: string;
  end_date: string;
  number_of_days: number;
  reason: string;
  relief_officer?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approval_date?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  staff_id: string;
  year: number;
  annual_leave_total: number;
  annual_leave_used: number;
  annual_leave_balance: number;
  sick_leave_total: number;
  sick_leave_used: number;
  sick_leave_balance: number;
  maternity_leave_total: number;
  maternity_leave_used: number;
  maternity_leave_balance: number;
  paternity_leave_total: number;
  paternity_leave_used: number;
  paternity_leave_balance: number;
  study_leave_total: number;
  study_leave_used: number;
  study_leave_balance: number;
  last_updated: string;
  created_at: string;
}

// ============================================
// Bank Payments & Reconciliation
// ============================================

export interface BankAccount {
  id: string;
  bank_name: string;
  bank_code: string; // CBN bank code
  account_number: string;
  account_name: string;
  account_type: 'salary_disbursement' | 'pension' | 'tax' | 'general';
  balance?: number;
  is_active: boolean;
  api_enabled: boolean;
  api_credentials?: {
    api_key?: string;
    client_id?: string;
    secret_key?: string;
    environment?: 'sandbox' | 'production';
  };
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface PaymentBatch {
  id: string;
  batch_number: string; // PAY/2024/001
  payroll_batch_id: string;
  payroll_month: string;
  total_amount: number;
  total_transactions: number;
  payment_type: 'salary' | 'pension' | 'allowance' | 'loan_disbursement';
  payment_method: 'bank_transfer' | 'cheque' | 'cash';
  bank_account_id?: string;
  bank_name?: string;
  status: 'pending' | 'draft' | 'pending_approval' | 'approved' | 'processing' | 'completed' | 'failed' | 'partially_completed' | 'confirmed';
  file_generated: boolean;
  file_format?: 'nibss' | 'remita' | 'custom_csv' | 'bank_specific';
  file_path?: string;
  file_content?: string; // Blob or base64 for download
  initiated_by: string;
  initiated_by_name: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  processed_at?: string;
  completed_at?: string;
  failed_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: string;
  payment_batch_id: string;
  transaction_reference: string; // Unique per transaction
  staff_id: string;
  staff_number: string;
  staff_name: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  amount: number;
  narration: string;
  status: 'pending' | 'processing' | 'successful' | 'failed' | 'reversed';
  bank_response_code?: string;
  bank_response_message?: string;
  bank_reference?: string; // Bank's unique reference
  processing_date?: string;
  value_date?: string; // Date money hits account
  retry_count: number;
  max_retries: number;
  last_retry_at?: string;
  failure_reason?: string;
  reconciled: boolean;
  reconciliation_date?: string;
  created_at: string;
  updated_at: string;
}

export interface BankStatement {
  id: string;
  bank_account_id: string;
  bank_name: string;
  statement_date: string;
  statement_period_start: string;
  statement_period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_credits: number;
  total_debits: number;
  total_transactions: number;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  parsed: boolean;
  parse_errors?: string[];
}

export interface BankStatementLine {
  id: string;
  bank_statement_id: string;
  transaction_date: string;
  value_date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  matched: boolean;
  payment_transaction_id?: string;
  match_confidence?: number; // 0-100
  match_type?: 'automatic' | 'manual' | 'suggested';
  matched_by?: string;
  matched_at?: string;
  created_at: string;
}

export interface PaymentReconciliation {
  id: string;
  reconciliation_number: string; // REC/2024/001
  payment_batch_id: string;
  bank_statement_id?: string;
  reconciliation_date: string;
  total_expected: number;
  total_matched: number;
  total_unmatched: number;
  matched_count: number;
  unmatched_count: number;
  variance_amount: number;
  status: 'in_progress' | 'completed' | 'requires_investigation';
  notes?: string;
  reconciled_by: string;
  reconciled_by_name: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentException {
  id: string;
  exception_number: string; // EXC/2024/001
  payment_transaction_id?: string;
  payment_batch_id: string;
  exception_type: 'failed_payment' | 'unmatched_transaction' | 'duplicate' | 'amount_mismatch' | 'account_mismatch' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expected_amount?: number;
  actual_amount?: number;
  staff_id?: string;
  staff_name?: string;
  account_number?: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  assigned_to?: string;
  assigned_to_name?: string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Loan Management
// ============================================

export interface LoanType {
  id: string;
  name: string;
  code: string;
  description: string;
  interest_rate: number; // Annual percentage rate
  max_amount?: number; // Maximum loan amount allowed
  max_tenure_months: number; // Maximum repayment period
  min_service_years?: number; // Minimum years of service required
  max_salary_percentage: number; // Maximum % of salary that can be borrowed
  requires_guarantors: boolean;
  min_guarantors: number;
  eligibility_criteria: string;
  status: 'active' | 'inactive';
  cooperative_id?: string; // Optional: Link loan type to a specific cooperative
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface LoanApplication {
  id: string;
  application_number: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  loan_type_id: string;
  loan_type_name: string;
  cooperative_id?: string; // Optional: Link loan to a specific cooperative
  cooperative_name?: string;
  amount_requested: number;
  amount_approved?: number;
  purpose: string;
  staff_bank_name?: string;
  staff_account_number?: string;
  staff_account_name?: string;
  tenure_months: number; // Repayment period in months
  monthly_deduction: number; // Calculated monthly repayment
  total_repayment: number; // Principal + Interest
  interest_amount: number;
  status: 'draft' | 'pending' | 'guarantor_pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'cancelled';
  current_approval_stage?: number;
  approval_history: {
    stage: number;
    approver_id: string;
    approver_name: string;
    action: 'approved' | 'rejected';
    comments?: string;
    timestamp: string;
  }[];
  rejection_reason?: string;
  disbursement_id?: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
}

export interface LoanGuarantor {
  id: string;
  loan_application_id: string;
  guarantor_staff_id: string;
  guarantor_staff_number: string;
  guarantor_name: string;
  guarantor_designation: string;
  guarantor_department: string;
  consent_status: 'pending' | 'accepted' | 'declined';
  consent_date?: string;
  consent_comments?: string;
  liability_amount: number; // Amount guaranteed
  created_at: string;
}

export interface LoanDisbursement {
  id: string;
  disbursement_number: string;
  loan_application_id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  loan_type_name: string;
  cooperative_id?: string; // Optional: Link disbursement to a specific cooperative
  cooperative_name?: string;
  amount_disbursed?: number;
  principal_amount: number;
  interest_amount: number;
  total_amount: number; // Principal + Interest
  tenure_months: number;
  monthly_deduction: number;
  disbursement_date: string;
  disbursement_method: 'bank_transfer' | 'cash' | 'cheque';
  bank_name?: string;
  account_number?: string;
  reference_number?: string;
  balance_outstanding: number;
  total_repaid: number;
  status: 'active' | 'completed' | 'defaulted' | 'written_off';
  start_deduction_month: string; // Format: YYYY-MM
  end_deduction_month: string; // Format: YYYY-MM
  disbursed_by: string;
  created_at: string;
}

export interface LoanRepayment {
  id: string;
  disbursement_id: string;
  staff_id: string;
  staff_number: string;
  payroll_batch_id?: string;
  repayment_month: string; // Format: YYYY-MM
  amount_paid: number;
  principal_paid: number;
  interest_paid: number;
  balance_after_payment: number;
  payment_method: 'payroll_deduction' | 'direct_payment' | 'bank_transfer';
  payment_reference?: string;
  payment_date: string;
  created_at: string;
}

export interface LoanApproval {
  id: string;
  loan_application_id: string;
  approval_stage: number;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  action: 'approved' | 'rejected' | 'returned';
  comments?: string;
  approved_amount?: number; // May differ from requested amount
  recommended_tenure?: number; // May suggest different tenure
  action_date: string;
  created_at: string;
}

// ============================================
// Cooperative Management
// ============================================

export interface Cooperative {
  id: string;
  name: string;
  code: string; // Short code (e.g., TCC, MPC, TRANSPORT)
  description: string;
  registration_number?: string;
  date_established: string;
  cooperative_type: 'thrift_credit' | 'multipurpose' | 'producer' | 'consumer' | 'housing' | 'transport' | 'other';
  monthly_contribution_required: number; // Minimum monthly contribution
  share_capital_value: number; // Value of one share
  minimum_shares: number; // Minimum shares required
  interest_rate_on_loans: number; // Default interest rate for cooperative loans
  maximum_loan_multiplier: number; // E.g., 3x member's savings
  meeting_schedule: string; // E.g., "Monthly - Last Friday"
  chairman_name?: string;
  secretary_name?: string;
  treasurer_name?: string;
  contact_email?: string;
  contact_phone?: string;
  bank_name?: string;
  bank_account_number?: string;
  auto_deduct_contribution?: boolean;
  total_members: number;
  total_contributions: number;
  total_share_capital: number;
  total_loans_disbursed: number;
  total_loans_outstanding: number;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CooperativeMember {
  id: string;
  cooperative_id: string; // Link to specific cooperative
  cooperative_name: string;
  member_number: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  department: string;
  join_date: string;
  monthly_contribution: number;
  total_contributions: number;
  total_share_capital: number;
  shares_owned: number; // Number of shares
  total_loans_taken: number;
  total_loans_repaid: number;
  outstanding_loan_balance: number;
  dividend_earned: number;
  status: 'active' | 'inactive' | 'suspended';
  suspension_reason?: string;
  exit_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CooperativeContribution {
  id: string;
  cooperative_id: string; // Link to specific cooperative
  cooperative_name: string;
  member_id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  contribution_month: string; // Format: YYYY-MM
  amount: number;
  contribution_type: 'regular' | 'voluntary' | 'share_capital' | 'special_levy';
  payroll_batch_id?: string;
  payment_method: 'payroll_deduction' | 'cash' | 'bank_transfer';
  payment_date: string;
  receipt_number?: string;
  created_at: string;
}
