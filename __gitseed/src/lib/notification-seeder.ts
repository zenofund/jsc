// Demo Notification Seeder
// This file contains a utility to seed sample notifications for testing and demonstration

import { notificationAPI, NotificationTemplates } from './api-client'; // ✅ Use API client
import { NotificationIntegration } from './notification-integration';

/**
 * Seed demo notifications for testing
 * Call this function from the browser console or during initial setup
 */
export async function seedDemoNotifications(userId: string, userRole: string) {
  console.log('Seeding demo notifications...');

  try {
    // Clear existing notifications first (optional)
    // await notificationAPI.deleteReadNotifications(userId, userRole);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Sample notifications based on user role
    if (userRole === 'admin' || userRole === 'payroll_officer') {
      // Payroll notifications
      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'payroll',
        category: 'success',
        title: 'Payroll Batch Approved',
        message: 'Payroll batch PAY/2024/12 for December 2024 has been approved successfully.',
        priority: 'medium',
        link: '/payroll',
        created_at: twoDaysAgo.toISOString(),
      } as any);

      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'bank_payment',
        category: 'action_required',
        title: 'Payment Batch Ready',
        message: 'Payment batch BATCH/2024/034 is ready for execution. Total amount: ₦45,250,000',
        priority: 'high',
        action_label: 'Execute Payment',
        action_link: '/bank-payments',
        link: '/bank-payments',
        created_at: yesterday.toISOString(),
      } as any);

      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'promotion',
        category: 'info',
        title: 'Promotion Processed',
        message: 'Promotion for John Doe to Grade 12 Step 1 has been processed. Arrears: ₦125,000',
        priority: 'medium',
        link: '/promotions',
        created_at: now.toISOString(),
      } as any);
    }

    if (userRole === 'hr_manager' || userRole === 'admin') {
      // Leave management notifications
      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'leave',
        category: 'action_required',
        title: 'New Leave Request',
        message: 'Sarah Johnson has submitted an Annual Leave request for 10 days.',
        priority: 'high',
        action_label: 'Review Request',
        action_link: '/leave-management',
        link: '/leave-management',
        created_at: now.toISOString(),
      } as any);
    }

    const normalizedRole = userRole === 'reviewer' ? 'checking' : userRole === 'approver' ? 'cpo' : userRole;
    if (normalizedRole === 'cpo' || normalizedRole === 'checking') {
      // Approval notifications
      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'approval',
        category: 'action_required',
        title: 'Payroll Pending Review',
        message: 'Payroll batch PAY/2025/01 for January 2025 is awaiting your review.',
        priority: 'urgent',
        action_label: 'Review Now',
        action_link: '/approvals',
        link: '/approvals',
        created_at: now.toISOString(),
      } as any);

      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'loan',
        category: 'action_required',
        title: 'Loan Application Review',
        message: 'Michael Brown has applied for a Car Loan of ₦2,500,000.',
        priority: 'high',
        action_label: 'Review Application',
        action_link: '/loan-management',
        link: '/loan-management',
        created_at: yesterday.toISOString(),
      } as any);
    }

    if (userRole === 'cashier') {
      // Cashier notifications
      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'bank_payment',
        category: 'action_required',
        title: 'Payment Batch Approved',
        message: 'Payment batch BATCH/2024/034 for ₦45,250,000 has been approved. Ready for execution.',
        priority: 'urgent',
        action_label: 'Execute Payment',
        action_link: '/bank-payments',
        link: '/bank-payments',
        created_at: now.toISOString(),
      } as any);

      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'bank_payment',
        category: 'warning',
        title: 'Reconciliation Issue',
        message: 'Payment batch BATCH/2024/033 has a variance of ₦50,000. Please investigate.',
        priority: 'high',
        action_label: 'View Details',
        action_link: '/bank-payments',
        link: '/bank-payments',
        created_at: yesterday.toISOString(),
      } as any);
    }

    if (userRole === 'staff') {
      // Staff portal notifications
      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'payroll',
        category: 'success',
        title: 'Payslip Available',
        message: 'Your payslip for December 2024 is now available for download.',
        priority: 'medium',
        action_label: 'View Payslip',
        action_link: '/payslips',
        link: '/payslips',
        created_at: twoDaysAgo.toISOString(),
      } as any);

      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'bank_payment',
        category: 'success',
        title: 'Salary Payment Received',
        message: 'Your salary payment of ₦350,000 has been successfully processed.',
        priority: 'medium',
        link: '/staff-portal',
        created_at: yesterday.toISOString(),
      } as any);

      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'leave',
        category: 'success',
        title: 'Leave Request Approved',
        message: 'Your Annual Leave request from Jan 15-24, 2025 has been approved.',
        priority: 'high',
        link: '/staff-portal',
        created_at: now.toISOString(),
      } as any);

      await notificationAPI.createNotification({
        recipient_id: userId,
        type: 'loan',
        category: 'info',
        title: 'Loan Disbursed',
        message: 'Your Personal Loan of ₦500,000 has been disbursed to your account.',
        priority: 'high',
        link: '/staff-portal',
        created_at: yesterday.toISOString(),
      } as any);
    }

    // System-wide notification for all users
    await notificationAPI.createNotification({
      recipient_id: 'all',
      type: 'system',
      category: 'info',
      title: 'System Update',
      message: 'The payroll system has been updated with new features including real-time notifications!',
      priority: 'low',
      created_at: twoDaysAgo.toISOString(),
    } as any);

    console.log('✅ Demo notifications seeded successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to seed demo notifications:', error);
    return false;
  }
}

/**
 * Clear all notifications for a user
 */
export async function clearAllNotifications(userId: string, userRole: string) {
  try {
    const notifications = await notificationAPI.getUserNotifications(userId, userRole);
    await Promise.all(
      notifications.map(n => notificationAPI.deleteNotification(n.id))
    );
    console.log(`✅ Cleared ${notifications.length} notifications`);
    return true;
  } catch (error) {
    console.error('❌ Failed to clear notifications:', error);
    return false;
  }
}

/**
 * Test notification system
 */
export async function testNotifications(userId: string) {
  console.log('Testing notification system...');

  try {
    // Test 1: Create a simple notification
    const notification = await notificationAPI.createNotification({
      recipient_id: userId,
      type: 'system',
      category: 'info',
      title: 'Test Notification',
      message: 'This is a test notification. If you see this, the system is working!',
      priority: 'medium',
    });
    console.log('✅ Test 1 passed: Created notification', notification.id);

    // Test 2: Fetch notifications
    const notifications = await notificationAPI.getUserNotifications(userId, 'admin');
    console.log('✅ Test 2 passed: Fetched', notifications.length, 'notifications');

    // Test 3: Mark as read
    await notificationAPI.markAsRead(notification.id);
    console.log('✅ Test 3 passed: Marked notification as read');

    // Test 4: Delete notification
    await notificationAPI.deleteNotification(notification.id);
    console.log('✅ Test 4 passed: Deleted notification');

    console.log('🎉 All notification tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Notification test failed:', error);
    return false;
  }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).seedDemoNotifications = seedDemoNotifications;
  (window as any).clearAllNotifications = clearAllNotifications;
  (window as any).testNotifications = testNotifications;
}
