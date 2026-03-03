# In-App Notification System - JSC Payroll Management System

## Overview

The JSC-PMS now includes a comprehensive, production-ready in-app notification system that provides real-time alerts for all payroll, HR, and financial operations. The system is fully integrated with existing workflows and ready for migration to NestJS/Supabase.

## Features

✅ **Complete Database Schema** - IndexedDB implementation with Supabase migration path  
✅ **Full CRUD API** - Create, read, update, delete notifications  
✅ **Role-Based Targeting** - Send notifications to specific users or roles  
✅ **Priority Levels** - Low, Medium, High, Urgent  
✅ **Category Types** - Info, Success, Warning, Error, Action Required  
✅ **Rich Metadata** - Links, entity tracking, custom actions  
✅ **Real-time Updates** - Polls every 30 seconds for new notifications  
✅ **Unread Badge Counter** - Shows unread count in header  
✅ **Interactive Dropdown** - Filter, mark as read, delete notifications  
✅ **Pre-built Templates** - 20+ templates for common scenarios  
✅ **Workflow Integration** - Ready-to-use integration helpers  
✅ **Demo Seeder** - Auto-populates sample notifications  
✅ **Production-Ready** - Complete NestJS/Supabase migration guide  

## Architecture

```
/lib/
├── notificationAPI.ts              # Core notification API and CRUD operations
├── notification-integration.ts     # Workflow integration helpers
├── notification-integration-guide.ts # Complete integration examples
└── notification-seeder.ts          # Demo data seeder

/components/
└── NotificationDropdown.tsx        # Interactive UI component

/lib/indexeddb.ts                   # Database schema (updated)
```

## Database Schema

### Notification Interface

```typescript
interface Notification {
  id: string;
  recipient_id: string;           // User ID or 'all' for broadcast
  recipient_role?: string;        // Target specific roles
  type: 'payroll' | 'leave' | 'promotion' | 'loan' | 'bank_payment' | 'approval' | 'system' | 'arrears' | 'document';
  category: 'info' | 'success' | 'warning' | 'error' | 'action_required';
  title: string;
  message: string;
  link?: string;                  // Deep link to related page
  entity_type?: string;           // e.g., 'payroll_batch'
  entity_id?: string;             // ID of related entity
  metadata?: Record<string, any>; // Additional context
  is_read: boolean;
  read_at?: string;
  created_at: string;
  expires_at?: string;            // Optional expiration
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action_label?: string;          // e.g., 'Review Now'
  action_link?: string;
  created_by?: string;
}
```

## Usage Examples

### 1. Basic Notification Creation

```typescript
import notificationAPI from './lib/notificationAPI';

// Send a simple notification
await notificationAPI.createNotification({
  recipient_id: 'user-123',
  type: 'payroll',
  category: 'success',
  title: 'Payroll Processed',
  message: 'December 2024 payroll has been processed successfully.',
  priority: 'medium',
  link: '/payroll',
});
```

### 2. Using Pre-built Templates

```typescript
import { NotificationTemplates } from './lib/notificationAPI';

// Notify staff about payslip
const template = NotificationTemplates.payslipGenerated('December 2024', staffId);
await notificationAPI.createNotification(template);

// Notify approver about leave request
const template = NotificationTemplates.leaveRequestSubmitted(
  'John Doe',
  'Annual Leave',
  approverId
);
await notificationAPI.createNotification(template);
```

### 3. Using Integration Helpers

```typescript
import { NotificationIntegration } from './lib/notification-integration';

// In PayrollPage.tsx - when creating payroll batch
await NotificationIntegration.notifyPayrollBatchCreated(
  batchNumber,
  month,
  currentUserId
);

// In LeaveManagementPage.tsx - when approving leave
await NotificationIntegration.notifyLeaveRequestApproved(
  leaveType,
  startDate,
  endDate,
  staffId
);

// In LoanManagementPage.tsx - when loan is disbursed
await NotificationIntegration.notifyLoanDisbursed(
  loanType,
  amount,
  staffId
);
```

### 4. Broadcast to All Users with a Role

```typescript
// Notify all approvers
await notificationAPI.createRoleNotification('approver', {
  type: 'payroll',
  category: 'action_required',
  title: 'Payroll Pending Review',
  message: 'Payroll batch PAY/2025/01 requires your review.',
  priority: 'urgent',
  action_label: 'Review Now',
  action_link: '/approvals',
});
```

### 5. Get User Notifications

```typescript
// Get all notifications for a user
const notifications = await notificationAPI.getUserNotifications(
  userId,
  userRole
);

// Get only unread notifications
const unread = await notificationAPI.getUserNotifications(
  userId,
  userRole,
  { is_read: false }
);

// Get unread count
const count = await notificationAPI.getUnreadCount(userId, userRole);
```

### 6. Mark as Read / Delete

```typescript
// Mark single notification as read
await notificationAPI.markAsRead(notificationId);

// Mark all as read
await notificationAPI.markAllAsRead(userId, userRole);

// Delete notification
await notificationAPI.deleteNotification(notificationId);

// Clear all read notifications
await notificationAPI.deleteReadNotifications(userId, userRole);
```

## Available Notification Templates

### Payroll
- `payrollBatchCreated(batchNumber, month, recipientId)`
- `payrollBatchSubmitted(batchNumber, month, role)`
- `payrollApproved(batchNumber, month, recipientId)`
- `payrollRejected(batchNumber, month, reason, recipientId)`
- `payrollLocked(batchNumber, month, recipientId)`
- `payslipGenerated(month, recipientId)`

### Leave Management
- `leaveRequestSubmitted(staffName, leaveType, recipientId)`
- `leaveRequestApproved(leaveType, startDate, endDate, recipientId)`
- `leaveRequestRejected(leaveType, reason, recipientId)`

### Promotions
- `promotionApproved(staffName, newGrade, newStep, recipientId)`
- `promotionProcessed(staffName, recipientId)`

### Loan Management
- `loanApplicationSubmitted(staffName, loanType, amount, recipientId)`
- `loanApplicationApproved(loanType, amount, recipientId)`
- `loanDisbursed(loanType, amount, recipientId)`
- `guarantorRequest(applicantName, loanType, amount, recipientId)`

### Bank Payments
- `paymentBatchCreated(batchNumber, totalAmount, recipientId)`
- `paymentBatchApproved(batchNumber, totalAmount, recipientId)`
- `paymentCompleted(amount, recipientId)`
- `paymentFailed(batchNumber, reason, recipientId)`
- `reconciliationIssue(batchNumber, varianceAmount, recipientId)`

### Arrears
- `arrearsCalculated(staffName, amount, recipientId)`
- `arrearsPaid(amount, recipientId)`

### System
- `systemMaintenance(startTime, endTime)`
- `documentUploaded(documentType, recipientId)`

## Integration into Existing Workflows

### Example: Payroll Submission

```typescript
// In PayrollPage.tsx
const handleSubmitForReview = async (batchId: string) => {
  try {
    // Existing logic
    const batch = await payrollAPI.submitBatchForReview(batchId);
    
    // Add notification
    await NotificationIntegration.notifyPayrollBatchSubmitted(
      batch.batch_number,
      batch.month,
      'reviewer' // or get from approval workflow
    );
    
    toast.success('Payroll submitted for review');
  } catch (error) {
    toast.error('Failed to submit payroll');
  }
};
```

### Example: Leave Approval

```typescript
// In LeaveManagementPage.tsx
const handleApproveLeave = async (requestId: string) => {
  try {
    // Existing logic
    const request = await leaveAPI.approveLeave(requestId, currentUser.id);
    
    // Add notification
    await NotificationIntegration.notifyLeaveRequestApproved(
      request.leave_type,
      request.start_date,
      request.end_date,
      request.staff_id
    );
    
    toast.success('Leave request approved');
  } catch (error) {
    toast.error('Failed to approve leave');
  }
};
```

## Testing the System

### Browser Console Commands

```javascript
// Seed demo notifications
await seedDemoNotifications(userId, userRole);

// Test the notification system
await testNotifications(userId);

// Clear all notifications
await clearAllNotifications(userId, userRole);
```

## UI Component

The `NotificationDropdown` component provides:
- **Bell icon with unread badge** in the header
- **Dropdown panel** with all notifications
- **Filter tabs** (All / Unread)
- **Mark as read** functionality
- **Delete notifications**
- **Direct navigation** to related pages
- **Auto-refresh** every 30 seconds
- **Priority badges** for urgent/high priority items
- **Action buttons** for quick actions

## Production Migration Guide

### Step 1: Supabase Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id TEXT NOT NULL,
  recipient_role TEXT,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  priority TEXT NOT NULL,
  action_label TEXT,
  action_link TEXT,
  created_by TEXT
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_role ON notifications(recipient_role);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### Step 2: NestJS Service

```typescript
@Injectable()
export class NotificationService {
  constructor(
    @Inject('SUPABASE_CLIENT') private supabase: SupabaseClient,
  ) {}

  async createNotification(data: CreateNotificationDto) {
    const { data: notification, error } = await this.supabase
      .from('notifications')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return notification;
  }

  async getUserNotifications(userId: string, userRole: string) {
    const { data, error } = await this.supabase
      .from('notifications')
      .select('*')
      .or(`recipient_id.eq.${userId},and(recipient_id.eq.all,recipient_role.eq.${userRole})`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  // ... other methods
}
```

### Step 3: Real-time Subscriptions (Optional)

```typescript
// In NotificationDropdown.tsx
const subscription = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${userId}`,
    },
    (payload) => {
      setNotifications(prev => [payload.new, ...prev]);
      setUnreadCount(prev => prev + 1);
    }
  )
  .subscribe();
```

## Best Practices

1. **Always use templates** - Use pre-built templates for consistency
2. **Async/await** - Always await notification calls
3. **Error handling** - Wrap in try-catch, don't let notification failures break workflows
4. **Priority levels** - Use `urgent` sparingly, reserve for critical actions
5. **Expiration dates** - Set `expires_at` for time-sensitive notifications
6. **Metadata** - Include relevant entity IDs for audit trails
7. **Action links** - Always provide deep links to related pages
8. **Cleanup** - Run `deleteExpiredNotifications()` periodically

## Monitoring & Analytics

```typescript
// Get notification statistics
const stats = {
  total: await notificationAPI.getUserNotifications(userId, userRole),
  unread: await notificationAPI.getUnreadCount(userId, userRole),
  byType: notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {}),
};
```

## Troubleshooting

### Notifications not appearing?
- Check IndexedDB in browser DevTools
- Verify user ID and role are correct
- Check console for errors
- Try `testNotifications(userId)` in console

### Real-time not working?
- Check polling interval (default: 30 seconds)
- Verify notification creation is successful
- Check network tab for API calls

### Seeder not working?
- Call `seedDemoNotifications(userId, userRole)` manually
- Check console for errors
- Verify database is initialized

## Support

For issues or questions:
1. Check the integration guide: `/lib/notification-integration-guide.ts`
2. Review examples in this README
3. Test with browser console commands
4. Check browser console for errors

---

**Status:** ✅ Fully Functional  
**Version:** 1.0.0  
**Last Updated:** December 25, 2024
