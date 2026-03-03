# Notification System - Quick Start Guide

## What's Been Implemented

### ✅ Complete Notification System
1. **Database Schema** - Added `notifications` table to IndexedDB (v7)
2. **Full API** - Complete CRUD operations in `/lib/notificationAPI.ts`
3. **UI Component** - Interactive dropdown in `/components/NotificationDropdown.tsx`
4. **Integration Layer** - Pre-built helpers in `/lib/notification-integration.ts`
5. **Templates** - 20+ pre-built notification templates
6. **Demo Seeder** - Auto-populates sample notifications
7. **Production Guide** - Complete NestJS/Supabase migration docs

### ✅ Features
- Real-time badge counter showing unread notifications
- Dropdown panel with filter, mark as read, delete functions
- Auto-refresh every 30 seconds
- Priority levels (Low, Medium, High, Urgent)
- Category types (Info, Success, Warning, Error, Action Required)
- Deep linking to related pages
- Role-based and broadcast notifications
- Expiration dates for time-sensitive alerts

## How to Use

### For End Users
1. Click the **bell icon** in the header
2. View all notifications or filter by unread
3. Click a notification to navigate to related page
4. Mark notifications as read or delete them
5. Use "Mark all as read" or "Clear read notifications"

### For Developers

#### Quick Example
```typescript
import { NotificationIntegration } from './lib/notification-integration';

// When submitting payroll for review
await NotificationIntegration.notifyPayrollBatchSubmitted(
  batchNumber,
  month,
  'reviewer'
);

// When approving leave
await NotificationIntegration.notifyLeaveRequestApproved(
  leaveType,
  startDate,
  endDate,
  staffId
);
```

#### Available Templates
```typescript
import { NotificationTemplates } from './lib/notificationAPI';

// Payroll
NotificationTemplates.payrollBatchCreated(batchNumber, month, recipientId)
NotificationTemplates.payslipGenerated(month, recipientId)

// Leave
NotificationTemplates.leaveRequestSubmitted(staffName, leaveType, recipientId)
NotificationTemplates.leaveRequestApproved(leaveType, startDate, endDate, recipientId)

// Loans
NotificationTemplates.loanApplicationSubmitted(staffName, loanType, amount, recipientId)
NotificationTemplates.loanDisbursed(loanType, amount, recipientId)

// Bank Payments
NotificationTemplates.paymentCompleted(amount, recipientId)
NotificationTemplates.reconciliationIssue(batchNumber, varianceAmount, recipientId)

// And 12 more...
```

## Integration Points

### Where to Add Notifications

1. **PayrollPage.tsx**
   - `handleCreateBatch` → `notifyPayrollBatchCreated`
   - `handleSubmitForReview` → `notifyPayrollBatchSubmitted`
   - `handleLockBatch` → `notifyPayrollLocked`

2. **ApprovalsPage.tsx**
   - `handleApprove` → `notifyPayrollApproved`
   - `handleReject` → `notifyPayrollRejected`

3. **LeaveManagementPage.tsx**
   - `handleApproveLeave` → `notifyLeaveRequestApproved`
   - `handleRejectLeave` → `notifyLeaveRequestRejected`

4. **LoanManagementPage.tsx**
   - `handleSubmitApplication` → `notifyLoanApplicationSubmitted`
   - `handleDisburseLoan` → `notifyLoanDisbursed`
   - `handleAddGuarantor` → `notifyGuarantorRequest`

5. **BankPaymentsPage.tsx**
   - `handleExecutePayment` → `notifyPaymentCompleted`
   - `handleReconcile` → `notifyReconciliationIssue`

6. **PromotionsPage.tsx**
   - `handleApprovePromotion` → `notifyPromotionApproved`

## Testing

### Browser Console Commands
```javascript
// Seed demo notifications for current user
await seedDemoNotifications(userId, userRole);

// Test the system
await testNotifications(userId);

// Clear all notifications
await clearAllNotifications(userId, userRole);
```

### Manual Testing
1. Login as different user roles
2. Demo notifications will auto-populate on first login
3. Click the bell icon to view notifications
4. Test mark as read, delete, and filtering
5. Click notifications to test navigation

## Production Migration

### Supabase Schema
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
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

### NestJS Endpoints
```
POST   /notifications          - Create notification
GET    /notifications/:userId  - Get user notifications
PATCH  /notifications/:id/read - Mark as read
DELETE /notifications/:id      - Delete notification
```

## Files Created

```
/lib/
├── notificationAPI.ts                  # Core API (320 lines)
├── notification-integration.ts         # Integration helpers (420 lines)
├── notification-integration-guide.ts   # Examples & docs (650 lines)
└── notification-seeder.ts              # Demo seeder (180 lines)

/components/
└── NotificationDropdown.tsx            # UI component (330 lines)

/lib/indexeddb.ts                       # Updated schema (v6 → v7)
/components/Layout.tsx                  # Updated with dropdown
/App.tsx                                # Added auto-seeding
/NOTIFICATION_SYSTEM.md                 # Complete documentation
```

## Key Benefits

1. **Zero API changes needed** - Works with IndexedDB now, Supabase later
2. **Pre-built templates** - Copy-paste integration
3. **Production-ready** - Complete migration guide included
4. **Role-based** - Target specific users or roles
5. **Rich metadata** - Entity tracking and deep links
6. **Auto-cleanup** - Expired notifications handled
7. **Demo data** - Instant testing with sample notifications

## Next Steps

### Immediate
1. ✅ System is functional - test with demo notifications
2. ✅ Click bell icon to see notifications
3. ✅ All templates and APIs ready to use

### When integrating into workflows
1. Import `NotificationIntegration` in your page components
2. Add notification calls after successful operations
3. Use pre-built templates or create custom ones
4. Test with different user roles

### For production
1. Run Supabase schema migration
2. Create NestJS NotificationService
3. Update `notificationAPI.ts` to call NestJS
4. Optional: Add real-time subscriptions

## Support

📖 Full documentation: `/NOTIFICATION_SYSTEM.md`  
📝 Integration examples: `/lib/notification-integration-guide.ts`  
🧪 Test functions: `/lib/notification-seeder.ts`

---

**Status:** ✅ Fully Operational  
**Ready for:** Immediate use + Production migration  
**Breaking Changes:** None - backward compatible
