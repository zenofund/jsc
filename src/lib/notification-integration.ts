// Notification Integration - Automated notification generation for workflow events
import { notificationAPI, NotificationTemplates } from './api-client'; // ✅ Use API client instead
import type { User } from '../types/entities';

/**
 * Helper class to integrate notifications into existing workflows
 * This provides a clean interface for triggering notifications from various modules
 */
export class NotificationIntegration {
  
  // ==================== PAYROLL NOTIFICATIONS ====================
  
  /**
   * Notify when a new payroll batch is created
   */
  static async notifyPayrollBatchCreated(
    batchNumber: string,
    month: string,
    createdBy: string
  ) {
    try {
      const template = NotificationTemplates.payrollBatchCreated(batchNumber, month, createdBy);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send payroll batch created notification:', error);
    }
  }

  /**
   * Notify approvers when payroll batch is submitted for review
   */
  static async notifyPayrollBatchSubmitted(
    batchNumber: string,
    month: string,
    approverRole: string
  ) {
    try {
      const template = NotificationTemplates.payrollBatchSubmitted(batchNumber, month, approverRole);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send payroll batch submitted notification:', error);
    }
  }

  /**
   * Notify payroll officer when batch is approved
   */
  static async notifyPayrollApproved(
    batchNumber: string,
    month: string,
    payrollOfficerId: string
  ) {
    try {
      const template = NotificationTemplates.payrollApproved(batchNumber, month, payrollOfficerId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send payroll approved notification:', error);
    }
  }

  /**
   * Notify payroll officer when batch is rejected
   */
  static async notifyPayrollRejected(
    batchNumber: string,
    month: string,
    reason: string,
    payrollOfficerId: string
  ) {
    try {
      const template = NotificationTemplates.payrollRejected(batchNumber, month, reason, payrollOfficerId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send payroll rejected notification:', error);
    }
  }

  /**
   * Notify when payroll batch is locked
   */
  static async notifyPayrollLocked(
    batchNumber: string,
    month: string,
    cashierIds: string[]
  ) {
    try {
      await Promise.all(
        cashierIds.map(cashierId => {
          const template = NotificationTemplates.payrollLocked(batchNumber, month, cashierId);
          return notificationAPI.createNotification(template);
        })
      );
    } catch (error) {
      console.error('Failed to send payroll locked notification:', error);
    }
  }

  /**
   * Notify all staff when payslips are generated
   */
  static async notifyPayslipsGenerated(
    month: string,
    staffIds: string[]
  ) {
    try {
      await Promise.all(
        staffIds.map(staffId => {
          const template = NotificationTemplates.payslipGenerated(month, staffId);
          return notificationAPI.createNotification(template);
        })
      );
    } catch (error) {
      console.error('Failed to send payslip generated notifications:', error);
    }
  }

  // ==================== LEAVE MANAGEMENT NOTIFICATIONS ====================

  /**
   * Notify approver when leave request is submitted
   */
  static async notifyLeaveRequestSubmitted(
    staffName: string,
    leaveType: string,
    approverId: string
  ) {
    try {
      const template = NotificationTemplates.leaveRequestSubmitted(staffName, leaveType, approverId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send leave request notification:', error);
    }
  }

  /**
   * Notify staff when leave request is approved
   */
  static async notifyLeaveRequestApproved(
    leaveType: string,
    startDate: string,
    endDate: string,
    staffId: string
  ) {
    try {
      const template = NotificationTemplates.leaveRequestApproved(leaveType, startDate, endDate, staffId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send leave approved notification:', error);
    }
  }

  /**
   * Notify staff when leave request is rejected
   */
  static async notifyLeaveRequestRejected(
    leaveType: string,
    reason: string,
    staffId: string
  ) {
    try {
      const template = NotificationTemplates.leaveRequestRejected(leaveType, reason, staffId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send leave rejected notification:', error);
    }
  }

  // ==================== PROMOTION NOTIFICATIONS ====================

  /**
   * Notify staff when promotion is approved
   */
  static async notifyPromotionApproved(
    staffName: string,
    newGrade: number,
    newStep: number,
    staffId: string
  ) {
    try {
      const template = NotificationTemplates.promotionApproved(staffName, newGrade, newStep, staffId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send promotion approved notification:', error);
    }
  }

  /**
   * Notify HR when promotion is processed
   */
  static async notifyPromotionProcessed(
    staffName: string,
    hrOfficerIds: string[]
  ) {
    try {
      await Promise.all(
        hrOfficerIds.map(hrId => {
          const template = NotificationTemplates.promotionProcessed(staffName, hrId);
          return notificationAPI.createNotification(template);
        })
      );
    } catch (error) {
      console.error('Failed to send promotion processed notification:', error);
    }
  }

  // ==================== LOAN MANAGEMENT NOTIFICATIONS ====================

  /**
   * Notify approver when loan application is submitted
   */
  static async notifyLoanApplicationSubmitted(
    staffName: string,
    loanType: string,
    amount: number,
    approverId: string
  ) {
    try {
      const template = NotificationTemplates.loanApplicationSubmitted(staffName, loanType, amount, approverId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send loan application notification:', error);
    }
  }

  /**
   * Notify staff when loan is approved
   */
  static async notifyLoanApplicationApproved(
    loanType: string,
    amount: number,
    staffId: string
  ) {
    try {
      const template = NotificationTemplates.loanApplicationApproved(loanType, amount, staffId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send loan approved notification:', error);
    }
  }

  /**
   * Notify staff when loan is disbursed
   */
  static async notifyLoanDisbursed(
    loanType: string,
    amount: number,
    staffId: string
  ) {
    try {
      const template = NotificationTemplates.loanDisbursed(loanType, amount, staffId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send loan disbursed notification:', error);
    }
  }

  /**
   * Notify guarantor when they are requested
   */
  static async notifyGuarantorRequest(
    applicantName: string,
    loanType: string,
    amount: number,
    guarantorId: string
  ) {
    try {
      const template = NotificationTemplates.guarantorRequest(applicantName, loanType, amount, guarantorId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send guarantor request notification:', error);
    }
  }

  // ==================== BANK PAYMENT NOTIFICATIONS ====================

  /**
   * Notify when payment batch is created
   */
  static async notifyPaymentBatchCreated(
    batchNumber: string,
    totalAmount: number,
    createdBy: string
  ) {
    try {
      const template = NotificationTemplates.paymentBatchCreated(batchNumber, totalAmount, createdBy);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send payment batch created notification:', error);
    }
  }

  /**
   * Notify cashier when payment batch is approved
   */
  static async notifyPaymentBatchApproved(
    batchNumber: string,
    totalAmount: number,
    cashierIds: string[]
  ) {
    try {
      await Promise.all(
        cashierIds.map(cashierId => {
          const template = NotificationTemplates.paymentBatchApproved(batchNumber, totalAmount, cashierId);
          return notificationAPI.createNotification(template);
        })
      );
    } catch (error) {
      console.error('Failed to send payment batch approved notification:', error);
    }
  }

  /**
   * Notify staff when salary payment is completed
   */
  static async notifyPaymentCompleted(
    amount: number,
    staffId: string
  ) {
    try {
      const template = NotificationTemplates.paymentCompleted(amount, staffId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send payment completed notification:', error);
    }
  }

  /**
   * Notify admin when payment batch fails
   */
  static async notifyPaymentFailed(
    batchNumber: string,
    reason: string,
    adminIds: string[]
  ) {
    try {
      await Promise.all(
        adminIds.map(adminId => {
          const template = NotificationTemplates.paymentFailed(batchNumber, reason, adminId);
          return notificationAPI.createNotification(template);
        })
      );
    } catch (error) {
      console.error('Failed to send payment failed notification:', error);
    }
  }

  /**
   * Notify cashier of reconciliation issues
   */
  static async notifyReconciliationIssue(
    batchNumber: string,
    varianceAmount: number,
    cashierIds: string[]
  ) {
    try {
      await Promise.all(
        cashierIds.map(cashierId => {
          const template = NotificationTemplates.reconciliationIssue(batchNumber, varianceAmount, cashierId);
          return notificationAPI.createNotification(template);
        })
      );
    } catch (error) {
      console.error('Failed to send reconciliation issue notification:', error);
    }
  }

  // ==================== ARREARS NOTIFICATIONS ====================

  /**
   * Notify HR when arrears are calculated
   */
  static async notifyArrearsCalculated(
    staffName: string,
    amount: number,
    hrOfficerIds: string[]
  ) {
    try {
      await Promise.all(
        hrOfficerIds.map(hrId => {
          const template = NotificationTemplates.arrearsCalculated(staffName, amount, hrId);
          return notificationAPI.createNotification(template);
        })
      );
    } catch (error) {
      console.error('Failed to send arrears calculated notification:', error);
    }
  }

  /**
   * Notify staff when arrears are paid
   */
  static async notifyArrearsPaid(
    amount: number,
    staffId: string
  ) {
    try {
      const template = NotificationTemplates.arrearsPaid(amount, staffId);
      await notificationAPI.createNotification(template);
    } catch (error) {
      console.error('Failed to send arrears paid notification:', error);
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Get all users with a specific role
   * Used to send notifications to all users of a certain role
   */
  static async getUsersByRole(role: string): Promise<string[]> {
    try {
      // Use API client to fetch users by role
      const { userAPI } = await import('./api-client');
      const allUsers = await userAPI.getAllUsers();
      
      return allUsers
        .filter((user: any) => user.role === role && user.status === 'active')
        .map((user: any) => user.id);
    } catch (error) {
      console.error('Failed to get users by role:', error);
      return [];
    }
  }

  /**
   * Send system-wide notification to all users
   */
  static async sendSystemNotification(
    title: string,
    message: string,
    category: 'info' | 'success' | 'warning' | 'error' = 'info',
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ) {
    try {
      await notificationAPI.createNotification({
        recipient_id: 'all',
        type: 'system',
        category,
        title,
        message,
        priority,
      });
    } catch (error) {
      console.error('Failed to send system notification:', error);
    }
  }

  /**
   * Clean up expired notifications (should be run periodically)
   */
  static async cleanupExpiredNotifications() {
    try {
      const count = await notificationAPI.deleteExpiredNotifications();
      console.log(`Cleaned up ${count} expired notifications`);
      return count;
    } catch (error) {
      console.error('Failed to cleanup expired notifications:', error);
      return 0;
    }
  }
}