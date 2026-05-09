/**
 * NOTIFICATION INTEGRATION GUIDE
 * ================================
 * 
 * This file contains example code showing where and how to integrate
 * notification triggers into existing workflows throughout the application.
 * 
 * For Production Migration to NestJS/Supabase:
 * - These notification calls can be added to your NestJS service methods
 * - The NotificationAPI can be replaced with Supabase client calls
 * - All notification templates and logic remain the same
 */

import { NotificationIntegration } from './notification-integration';
import { notificationAPI, NotificationTemplates } from './api-client'; // ✅ Use API client

// ============================================================
// EXAMPLE 1: PAYROLL PROCESSING WORKFLOW
// ============================================================

/**
 * Example: When creating a new payroll batch
 * Location: PayrollPage.tsx or payroll service
 */
async function exampleCreatePayrollBatch(batchData: any, createdByUserId: string) {
  // ... existing payroll batch creation logic ...
  
  // Add notification trigger
  await NotificationIntegration.notifyPayrollBatchCreated(
    batchData.batch_number,
    batchData.month,
    createdByUserId
  );
}

/**
 * Example: When submitting payroll for approval
 * Location: PayrollPage.tsx - handleSubmitForReview function
 */
async function exampleSubmitPayrollForReview(batchNumber: string, month: string) {
  // ... existing submission logic ...
  
  // Notify all approvers (reviewers)
  await NotificationIntegration.notifyPayrollBatchSubmitted(
    batchNumber,
    month,
    'reviewer' // or 'approver' depending on approval stage
  );
}

/**
 * Example: When approving payroll
 * Location: ApprovalsPage.tsx - handleApprove function
 */
async function exampleApprovePayroll(batchNumber: string, month: string, payrollOfficerId: string) {
  // ... existing approval logic ...
  
  // Notify payroll officer
  await NotificationIntegration.notifyPayrollApproved(
    batchNumber,
    month,
    payrollOfficerId
  );
}

/**
 * Example: When payslips are generated
 * Location: After payroll batch is locked and payslips generated
 */
async function exampleGeneratePayslips(month: string, staffIds: string[]) {
  // ... existing payslip generation logic ...
  
  // Notify all staff
  await NotificationIntegration.notifyPayslipsGenerated(month, staffIds);
}

// ============================================================
// EXAMPLE 2: LEAVE MANAGEMENT WORKFLOW
// ============================================================

/**
 * Example: When staff submits leave request
 * Location: StaffPortalPage.tsx - handleLeaveRequestSubmit
 */
async function exampleSubmitLeaveRequest(
  staffName: string,
  leaveType: string,
  approverId: string
) {
  // ... existing leave request creation logic ...
  
  // Notify approver (usually HR Manager or Department Head)
  await NotificationIntegration.notifyLeaveRequestSubmitted(
    staffName,
    leaveType,
    approverId
  );
}

/**
 * Example: When leave is approved
 * Location: LeaveManagementPage.tsx - handleApproveLeave
 */
async function exampleApproveLeave(
  leaveType: string,
  startDate: string,
  endDate: string,
  staffId: string
) {
  // ... existing leave approval logic ...
  
  // Notify staff member
  await NotificationIntegration.notifyLeaveRequestApproved(
    leaveType,
    startDate,
    endDate,
    staffId
  );
}

// ============================================================
// EXAMPLE 3: LOAN MANAGEMENT WORKFLOW
// ============================================================

/**
 * Example: When loan application is submitted
 * Location: LoanManagementPage.tsx - handleSubmitLoanApplication
 */
async function exampleSubmitLoanApplication(
  staffName: string,
  loanType: string,
  amount: number,
  approverId: string
) {
  // ... existing loan application logic ...
  
  // Notify approver
  await NotificationIntegration.notifyLoanApplicationSubmitted(
    staffName,
    loanType,
    amount,
    approverId
  );
}

/**
 * Example: When adding guarantor
 * Location: LoanManagementPage.tsx - handleAddGuarantor
 */
async function exampleRequestGuarantor(
  applicantName: string,
  loanType: string,
  amount: number,
  guarantorId: string
) {
  // ... existing guarantor addition logic ...
  
  // Notify guarantor
  await NotificationIntegration.notifyGuarantorRequest(
    applicantName,
    loanType,
    amount,
    guarantorId
  );
}

/**
 * Example: When loan is disbursed
 * Location: LoanManagementPage.tsx - handleDisburseLoan
 */
async function exampleDisburseLoan(
  loanType: string,
  amount: number,
  staffId: string
) {
  // ... existing disbursement logic ...
  
  // Notify staff member
  await NotificationIntegration.notifyLoanDisbursed(loanType, amount, staffId);
}

// ============================================================
// EXAMPLE 4: PROMOTION WORKFLOW
// ============================================================

/**
 * Example: When promotion is approved
 * Location: PromotionsPage.tsx - handleApprovePromotion
 */
async function exampleApprovePromotion(
  staffName: string,
  newGrade: number,
  newStep: number,
  staffId: string
) {
  // ... existing promotion approval logic ...
  
  // Notify staff member
  await NotificationIntegration.notifyPromotionApproved(
    staffName,
    newGrade,
    newStep,
    staffId
  );
}

// ============================================================
// EXAMPLE 5: BANK PAYMENT WORKFLOW
// ============================================================

/**
 * Example: When payment batch is created
 * Location: BankPaymentsPage.tsx - handleCreatePaymentBatch
 */
async function exampleCreatePaymentBatch(
  batchNumber: string,
  totalAmount: number,
  createdByUserId: string
) {
  // ... existing payment batch creation logic ...
  
  // Notify creator
  await NotificationIntegration.notifyPaymentBatchCreated(
    batchNumber,
    totalAmount,
    createdByUserId
  );
}

/**
 * Example: When payment batch is approved
 * Location: BankPaymentsPage.tsx - handleApprovePaymentBatch
 */
async function exampleApprovePaymentBatch(
  batchNumber: string,
  totalAmount: number
) {
  // ... existing approval logic ...
  
  // Notify all cashiers
  const cashierIds = await NotificationIntegration.getUsersByRole('cashier');
  await NotificationIntegration.notifyPaymentBatchApproved(
    batchNumber,
    totalAmount,
    cashierIds
  );
}

/**
 * Example: When individual payment completes
 * Location: BankPaymentsPage.tsx - after payment processing
 */
async function exampleCompletePayment(amount: number, staffId: string) {
  // ... existing payment completion logic ...
  
  // Notify staff member
  await NotificationIntegration.notifyPaymentCompleted(amount, staffId);
}

// ============================================================
// EXAMPLE 6: CUSTOM NOTIFICATIONS
// ============================================================

/**
 * Example: Send custom notification
 */
async function exampleCustomNotification() {
  await notificationAPI.createNotification({
    recipient_id: 'user-123',
    type: 'system',
    category: 'info',
    title: 'Custom Notification',
    message: 'This is a custom notification message',
    priority: 'medium',
    link: '/some-page',
  });
}

/**
 * Example: Broadcast notification to all users with a role
 */
async function exampleBroadcastToRole() {
  await notificationAPI.createRoleNotification('approver', {
    type: 'system',
    category: 'warning',
    title: 'System Maintenance',
    message: 'The system will undergo maintenance tonight at 10 PM',
    priority: 'high',
  });
}

/**
 * Example: Use pre-built templates
 */
async function exampleUseTemplate() {
  const template = NotificationTemplates.systemMaintenance(
    '10:00 PM',
    '2:00 AM'
  );
  await notificationAPI.createNotification(template);
}

// ============================================================
// INTEGRATION CHECKLIST FOR PRODUCTION
// ============================================================

/**
 * STEP 1: Add notification triggers to existing workflows
 * --------------------------------------------------------
 * Location: Each page component where actions occur
 * 
 * Examples:
 * - PayrollPage.tsx: Add to handleCreateBatch, handleSubmitForReview, handleLockBatch
 * - ApprovalsPage.tsx: Add to handleApprove, handleReject
 * - LeaveManagementPage.tsx: Add to handleApprove, handleReject
 * - LoanManagementPage.tsx: Add to handleSubmit, handleApprove, handleDisburse
 * - PromotionsPage.tsx: Add to handleApprove
 * - BankPaymentsPage.tsx: Add to handleExecutePayment, handleReconcile
 * 
 * 
 * STEP 2: Database Migration for Supabase
 * ----------------------------------------
 * 
 * SQL Schema for notifications table:
 * 
 * CREATE TABLE notifications (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   recipient_id TEXT NOT NULL,
 *   recipient_role TEXT,
 *   type TEXT NOT NULL CHECK (type IN ('payroll', 'leave', 'promotion', 'loan', 'bank_payment', 'approval', 'system', 'arrears', 'document')),
 *   category TEXT NOT NULL CHECK (category IN ('info', 'success', 'warning', 'error', 'action_required')),
 *   title TEXT NOT NULL,
 *   message TEXT NOT NULL,
 *   link TEXT,
 *   entity_type TEXT,
 *   entity_id TEXT,
 *   metadata JSONB,
 *   is_read BOOLEAN DEFAULT FALSE,
 *   read_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   expires_at TIMESTAMPTZ,
 *   priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
 *   action_label TEXT,
 *   action_link TEXT,
 *   created_by TEXT
 * );
 * 
 * CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
 * CREATE INDEX idx_notifications_role ON notifications(recipient_role);
 * CREATE INDEX idx_notifications_type ON notifications(type);
 * CREATE INDEX idx_notifications_is_read ON notifications(is_read);
 * CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
 * 
 * 
 * STEP 3: NestJS Service Implementation
 * --------------------------------------
 * 
 * Create NotificationService in NestJS:
 * 
 * @Injectable()
 * export class NotificationService {
 *   constructor(
 *     @InjectRepository(Notification)
 *     private notificationRepository: Repository<Notification>,
 *   ) {}
 * 
 *   async createNotification(data: CreateNotificationDto) {
 *     const notification = this.notificationRepository.create(data);
 *     return await this.notificationRepository.save(notification);
 *   }
 * 
 *   async getUserNotifications(userId: string, userRole: string) {
 *     return await this.notificationRepository.find({
 *       where: [
 *         { recipient_id: userId },
 *         { recipient_id: 'all', recipient_role: userRole }
 *       ],
 *       order: { created_at: 'DESC' }
 *     });
 *   }
 * 
 *   // ... other methods
 * }
 * 
 * 
 * STEP 4: Real-time Notifications (Optional)
 * -------------------------------------------
 * 
 * For Supabase real-time:
 * 
 * const subscription = supabase
 *   .channel('notifications')
 *   .on(
 *     'postgres_changes',
 *     {
 *       event: 'INSERT',
 *       schema: 'public',
 *       table: 'notifications',
 *       filter: `recipient_id=eq.${userId}`
 *     },
 *     (payload) => {
 *       // Handle new notification
 *       console.log('New notification:', payload.new);
 *     }
 *   )
 *   .subscribe();
 */

export const NOTIFICATION_INTEGRATION_GUIDE = {
  // This is just documentation - the actual implementations are shown above
  payrollWorkflow: 'See exampleCreatePayrollBatch, exampleSubmitPayrollForReview, etc.',
  leaveWorkflow: 'See exampleSubmitLeaveRequest, exampleApproveLeave, etc.',
  loanWorkflow: 'See exampleSubmitLoanApplication, exampleDisburseLoan, etc.',
  promotionWorkflow: 'See exampleApprovePromotion',
  bankPaymentWorkflow: 'See exampleCreatePaymentBatch, exampleApprovePaymentBatch, etc.',
};