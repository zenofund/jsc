// Notification API - Complete notification management for JSC-PMS
// Integrated with live NestJS backend
import type { Notification } from '../types/entities';

// API Configuration
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api/v1';

// Helper function to get auth token
const getAuthToken = (): string => {
  return localStorage.getItem('jsc_auth_token') || '';
};

// Helper function for making API requests
async function makeApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken()}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export interface CreateNotificationInput {
  recipient_id: string | 'all'; // User ID or 'all' for broadcast
  recipient_role?: string; // Target specific roles
  type: Notification['type'];
  category: Notification['category'];
  title: string;
  message: string;
  link?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  priority?: Notification['priority'];
  action_label?: string;
  action_link?: string;
  created_by?: string;
  expires_at?: string;
}

export interface NotificationFilters {
  recipient_id?: string;
  recipient_role?: string;
  type?: Notification['type'];
  category?: Notification['category'];
  is_read?: boolean;
  priority?: Notification['priority'];
  from_date?: string;
  to_date?: string;
}

class NotificationAPI {
  // Create a single notification
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    return await makeApiRequest('/notifications', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Create notifications for multiple users
  async createBulkNotifications(
    recipient_ids: string[],
    input: Omit<CreateNotificationInput, 'recipient_id'>
  ): Promise<Notification[]> {
    return await makeApiRequest('/notifications/bulk', {
      method: 'POST',
      body: JSON.stringify({ recipient_ids, ...input }),
    });
  }

  // Create broadcast notification for all users with a specific role
  async createRoleNotification(
    role: string,
    input: Omit<CreateNotificationInput, 'recipient_id' | 'recipient_role'>
  ): Promise<Notification> {
    return await makeApiRequest('/notifications/role', {
      method: 'POST',
      body: JSON.stringify({ role, ...input }),
    });
  }

  // Get notifications for a specific user
  async getUserNotifications(
    userId: string,
    userRole: string,
    filters?: Omit<NotificationFilters, 'recipient_id' | 'recipient_role'>
  ): Promise<Notification[]> {
    const params = new URLSearchParams({
      ...(filters?.type && { type: filters.type }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.is_read !== undefined && { is_read: String(filters.is_read) }),
      ...(filters?.priority && { priority: filters.priority }),
      ...(filters?.from_date && { from_date: filters.from_date }),
      ...(filters?.to_date && { to_date: filters.to_date }),
    });

    return await makeApiRequest(`/notifications?${params.toString()}`);
  }

  // Get unread count for a user
  async getUnreadCount(userId: string, userRole: string): Promise<number> {
    const result = await makeApiRequest(`/notifications/unread-count`);
    console.log('Unread count API response:', result);
    return result.unreadCount || 0;
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<Notification> {
    return await makeApiRequest(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string, userRole: string): Promise<void> {
    await makeApiRequest(`/notifications/mark-all-read`, {
      method: 'PUT',
      body: JSON.stringify({}),
    });
  }

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<void> {
    await makeApiRequest(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  // Delete all read notifications for a user
  async deleteReadNotifications(userId: string, userRole: string): Promise<void> {
    await makeApiRequest(`/notifications/read/all`, {
      method: 'DELETE',
    });
  }

  // Get notification by ID
  async getNotificationById(notificationId: string): Promise<Notification | undefined> {
    try {
      return await makeApiRequest(`/notifications/${notificationId}`);
    } catch (error) {
      return undefined;
    }
  }

  // Delete expired notifications (cleanup utility)
  async deleteExpiredNotifications(): Promise<number> {
    const result = await makeApiRequest('/notifications/expired', {
      method: 'DELETE',
    });
    return result.count || 0;
  }

  // Get notifications by entity (e.g., all notifications for a specific payroll batch)
  async getNotificationsByEntity(
    entityType: string,
    entityId: string
  ): Promise<Notification[]> {
    return await makeApiRequest(`/notifications/entity/${entityType}/${entityId}`);
  }
}

// Notification Template Factory - Pre-defined templates for common scenarios
export class NotificationTemplates {
  // Payroll Templates
  static payrollBatchCreated(batchNumber: string, month: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'payroll' as const,
      category: 'info' as const,
      title: 'New Payroll Batch Created',
      message: `Payroll batch ${batchNumber} for ${month} has been created and is ready for processing.`,
      priority: 'medium' as const,
      link: '/payroll',
    };
  }

  static payrollBatchSubmitted(batchNumber: string, month: string, role: string) {
    return {
      recipient_id: 'all',
      recipient_role: role,
      type: 'payroll' as const,
      category: 'action_required' as const,
      title: 'Payroll Batch Pending Review',
      message: `Payroll batch ${batchNumber} for ${month} has been submitted and requires your review.`,
      priority: 'high' as const,
      action_label: 'Review Now',
      action_link: '/approvals',
      link: '/approvals',
    };
  }

  static payrollApproved(batchNumber: string, month: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'payroll' as const,
      category: 'success' as const,
      title: 'Payroll Batch Approved',
      message: `Payroll batch ${batchNumber} for ${month} has been approved and is ready for payment processing.`,
      priority: 'medium' as const,
      link: '/payroll',
    };
  }

  static payrollRejected(batchNumber: string, month: string, reason: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'payroll' as const,
      category: 'error' as const,
      title: 'Payroll Batch Rejected',
      message: `Payroll batch ${batchNumber} for ${month} was rejected. Reason: ${reason}`,
      priority: 'high' as const,
      link: '/payroll',
    };
  }

  static payrollLocked(batchNumber: string, month: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'payroll' as const,
      category: 'success' as const,
      title: 'Payroll Batch Locked',
      message: `Payroll batch ${batchNumber} for ${month} has been locked and is ready for payment.`,
      priority: 'medium' as const,
      link: '/payroll',
    };
  }

  static payslipGenerated(month: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'payroll' as const,
      category: 'success' as const,
      title: 'Payslip Available',
      message: `Your payslip for ${month} is now available for download.`,
      priority: 'medium' as const,
      action_label: 'View Payslip',
      action_link: '/payslips',
      link: '/payslips',
    };
  }

  // Leave Management Templates
  static leaveRequestSubmitted(staffName: string, leaveType: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'leave' as const,
      category: 'action_required' as const,
      title: 'New Leave Request',
      message: `${staffName} has submitted a ${leaveType} leave request for your approval.`,
      priority: 'high' as const,
      action_label: 'Review Request',
      action_link: '/leave-management',
      link: '/leave-management',
    };
  }

  static leaveRequestApproved(leaveType: string, startDate: string, endDate: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'leave' as const,
      category: 'success' as const,
      title: 'Leave Request Approved',
      message: `Your ${leaveType} leave request from ${startDate} to ${endDate} has been approved.`,
      priority: 'high' as const,
      link: '/staff-portal',
    };
  }

  static leaveRequestRejected(leaveType: string, reason: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'leave' as const,
      category: 'error' as const,
      title: 'Leave Request Rejected',
      message: `Your ${leaveType} leave request was rejected. Reason: ${reason}`,
      priority: 'high' as const,
      link: '/staff-portal',
    };
  }

  // Promotion Templates
  static promotionApproved(staffName: string, newGrade: number, newStep: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'promotion' as const,
      category: 'success' as const,
      title: 'Promotion Approved',
      message: `Congratulations! Your promotion to Grade ${newGrade} Step ${newStep} has been approved.`,
      priority: 'high' as const,
      link: '/staff-portal',
    };
  }

  static promotionProcessed(staffName: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'promotion' as const,
      category: 'info' as const,
      title: 'Promotion Processed',
      message: `${staffName}'s promotion has been processed and arrears have been calculated.`,
      priority: 'medium' as const,
      link: '/promotions',
    };
  }

  // Loan Templates
  static loanApplicationSubmitted(staffName: string, loanType: string, amount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'loan' as const,
      category: 'action_required' as const,
      title: 'New Loan Application',
      message: `${staffName} has applied for a ${loanType} loan of ₦${amount.toLocaleString()} for your review.`,
      priority: 'high' as const,
      action_label: 'Review Application',
      action_link: '/loan-management',
      link: '/loan-management',
    };
  }

  static loanApplicationApproved(loanType: string, amount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'loan' as const,
      category: 'success' as const,
      title: 'Loan Application Approved',
      message: `Your ${loanType} loan application for ₦${amount.toLocaleString()} has been approved.`,
      priority: 'high' as const,
      link: '/staff-portal',
    };
  }

  static loanDisbursed(loanType: string, amount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'loan' as const,
      category: 'success' as const,
      title: 'Loan Disbursed',
      message: `Your ${loanType} loan of ₦${amount.toLocaleString()} has been disbursed to your account.`,
      priority: 'high' as const,
      link: '/staff-portal',
    };
  }

  static guarantorRequest(applicantName: string, loanType: string, amount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'loan' as const,
      category: 'action_required' as const,
      title: 'Loan Guarantor Request',
      message: `${applicantName} has requested you to be a guarantor for their ${loanType} loan of ₦${amount.toLocaleString()}.`,
      priority: 'urgent' as const,
      action_label: 'Respond',
      action_link: '/staff-portal',
      link: '/staff-portal',
    };
  }

  // Bank Payment Templates
  static paymentBatchCreated(batchNumber: string, totalAmount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'bank_payment' as const,
      category: 'info' as const,
      title: 'Payment Batch Created',
      message: `Payment batch ${batchNumber} for ₦${totalAmount.toLocaleString()} has been created.`,
      priority: 'medium' as const,
      link: '/bank-payments',
    };
  }

  static paymentBatchApproved(batchNumber: string, totalAmount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'bank_payment' as const,
      category: 'success' as const,
      title: 'Payment Batch Approved',
      message: `Payment batch ${batchNumber} for ₦${totalAmount.toLocaleString()} has been approved and is ready for execution.`,
      priority: 'high' as const,
      link: '/bank-payments',
    };
  }

  static paymentCompleted(amount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'bank_payment' as const,
      category: 'success' as const,
      title: 'Salary Payment Received',
      message: `Your salary payment of ₦${amount.toLocaleString()} has been successfully processed.`,
      priority: 'medium' as const,
      link: '/staff-portal',
    };
  }

  static paymentFailed(batchNumber: string, reason: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'bank_payment' as const,
      category: 'error' as const,
      title: 'Payment Batch Failed',
      message: `Payment batch ${batchNumber} failed. Reason: ${reason}`,
      priority: 'urgent' as const,
      action_label: 'View Details',
      action_link: '/bank-payments',
      link: '/bank-payments',
    };
  }

  static reconciliationIssue(batchNumber: string, varianceAmount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'bank_payment' as const,
      category: 'warning' as const,
      title: 'Reconciliation Issue Detected',
      message: `Payment batch ${batchNumber} has a variance of ₦${varianceAmount.toLocaleString()}. Please investigate.`,
      priority: 'high' as const,
      action_label: 'View Details',
      action_link: '/bank-payments',
      link: '/bank-payments',
    };
  }

  // Arrears Templates
  static arrearsCalculated(staffName: string, amount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'arrears' as const,
      category: 'info' as const,
      title: 'Arrears Calculated',
      message: `Arrears of ₦${amount.toLocaleString()} have been calculated for ${staffName}.`,
      priority: 'medium' as const,
      link: '/arrears',
    };
  }

  static arrearsPaid(amount: number, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'arrears' as const,
      category: 'success' as const,
      title: 'Arrears Payment',
      message: `Your arrears payment of ₦${amount.toLocaleString()} has been processed.`,
      priority: 'medium' as const,
      link: '/staff-portal',
    };
  }

  // System Templates
  static systemMaintenance(startTime: string, endTime: string) {
    return {
      recipient_id: 'all',
      type: 'system' as const,
      category: 'warning' as const,
      title: 'Scheduled System Maintenance',
      message: `The system will be undergoing maintenance from ${startTime} to ${endTime}. Please save your work.`,
      priority: 'urgent' as const,
    };
  }

  static documentUploaded(documentType: string, recipientId: string) {
    return {
      recipient_id: recipientId,
      type: 'document' as const,
      category: 'success' as const,
      title: 'Document Uploaded',
      message: `Your ${documentType} has been successfully uploaded.`,
      priority: 'low' as const,
      link: '/staff-portal',
    };
  }
}

const notificationAPI = new NotificationAPI();
export default notificationAPI;
