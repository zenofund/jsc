# Approver Flow - Complete Production-Ready Implementation

## ✅ **PRODUCTION READY - ALL APIS IMPLEMENTED**

This document provides a comprehensive overview of the approval system across the JSC Payroll Management System.

---

## 📋 **Table of Contents**

1. [Overview](#overview)
2. [Approval Types](#approval-types)
3. [API Endpoints](#api-endpoints)
4. [User Interface](#user-interface)
5. [Multi-Level Workflow](#multi-level-workflow)
6. [Audit Trail](#audit-trail)
7. [Production Checklist](#production-checklist)

---

## 🎯 **Overview**

The approval system manages 6 different types of approvals across the application:

| Type | Entity | Approver Role | Multi-Level |
|------|--------|---------------|-------------|
| **Payroll** | Monthly payroll batches | Approver, Reviewer, Auditor | ✅ Yes (4 stages) |
| **Loans** | Loan applications | Approver | ✅ Yes (3 stages) |
| **Leaves** | Leave requests | HR Manager, Approver | ❌ No (Single stage) |
| **Payments** | Payment batches | Approver | ❌ No (Single stage) |
| **Arrears** | Arrears payments | Approver | ❌ No (Single stage) |
| **Promotions** | Staff promotions | Approver | ❌ No (Single stage) |

---

## 📝 **Approval Types**

### 1. **Payroll Approvals**

**Entity:** `PayrollBatch`  
**Workflow:** 4-stage multi-level approval

**Stages:**
1. **Unit Head Review** (Reviewer role)
2. **Director Admin Approval** (Approver role)
3. **Permanent Secretary Approval** (Approver role)
4. **Auditor Review** (Auditor role)

**API Endpoints:**

```typescript
// Get all payroll batches
await payrollAPI.getAllPayrollBatches();

// Approve stage
await payrollAPI.approvePayrollStage(
  batchId: string,
  stage: number,
  userId: string,
  userEmail: string,
  comments?: string
);

// Reject stage
await payrollAPI.rejectPayrollStage(
  batchId: string,
  stage: number,
  userId: string,
  userEmail: string,
  comments: string
);

// Get workflow approvals
await db.getByIndex('workflow_approvals', 'payroll_batch_id', batchId);
```

**Status Flow:**
```
draft → pending_review → in_review → pending_approval → approved → posted
       ↓
    rejected (any stage)
```

---

### 2. **Loan Approvals**

**Entity:** `LoanApplication`  
**Workflow:** 3-stage approval with guarantor validation

**Stages:**
1. **Guarantor Approval** (if required)
2. **Unit Head Review**
3. **Final Approval**

**API Endpoints:**

```typescript
// Get all loan applications
await loanApplicationAPI.getAll();

// Get pending applications
const loans = await loanApplicationAPI.getAll();
const pending = loans.filter(l => l.status === 'pending');

// Approve loan
await loanApplicationAPI.processApproval(
  id: string,
  approverId: string,
  approverName: string,
  action: 'approved',
  comments?: string
);

// Reject loan
await loanApplicationAPI.processApproval(
  id: string,
  approverId: string,
  approverName: string,
  action: 'rejected',
  comments: string
);

// Get loan approvals (multi-stage tracking)
await loanApprovalAPI.getByLoanId(loanId);
```

**Status Flow:**
```
draft → pending → guarantor_pending → approved → disbursed
       ↓
    rejected
```

---

### 3. **Leave Approvals**

**Entity:** `LeaveRequest`  
**Workflow:** Single-stage approval

**API Endpoints:**

```typescript
// Get all leave requests
await leaveAPI.getAllRequests();

// Get pending leaves
const leaves = await leaveAPI.getAllRequests();
const pending = leaves.filter(l => l.status === 'pending');

// Approve leave
await leaveAPI.approveLeaveRequest(
  leaveId: string,
  approverId: string,
  approverEmail: string
);

// Reject leave
await leaveAPI.rejectLeaveRequest(
  leaveId: string,
  approverId: string,
  approverEmail: string,
  reason: string
);
```

**Status Flow:**
```
pending → approved
       ↓
    rejected
```

**Auto-Processing:**
- ✅ Automatically deducts from leave balance
- ✅ Updates leave balance in IndexedDB
- ✅ Creates audit trail

---

### 4. **Payment Batch Approvals**

**Entity:** `PaymentBatch`  
**Workflow:** Single-stage approval

**API Endpoints:**

```typescript
// Get all payment batches
await paymentBatchAPI.getAll();

// Get pending payments
const payments = await paymentBatchAPI.getAll();
const pending = payments.filter(p => p.status === 'pending_approval');

// Approve payment batch
await paymentBatchAPI.approveForPayment(
  batchId: string,
  userId: string,
  userName: string
);

// Process payment (after approval)
await paymentBatchAPI.processPayment(batchId);
```

**Status Flow:**
```
draft → pending_approval → approved → processing → completed
                         ↓
                      failed / partially_completed
```

**Note:** Payment batches cannot be "rejected" - they can only be deleted or returned to draft.

---

### 5. **Arrears Approvals**

**Entity:** `Arrear`  
**Workflow:** Single-stage approval

**API Endpoints:**

```typescript
// Get all arrears
await arrearAPI.getAll();

// Get pending arrears
const arrears = await arrearAPI.getAll();
const pending = arrears.filter(a => a.status === 'pending');

// Approve arrear
await arrearAPI.approve(
  arrearId: string,
  userId: string,
  userEmail: string
);

// Reject arrear
await arrearAPI.reject(
  arrearId: string,
  userId: string,
  userEmail: string,
  comments: string
);
```

**Status Flow:**
```
pending → approved → paid
       ↓
    rejected
```

---

### 6. **Promotion Approvals**

**Entity:** `Promotion`  
**Workflow:** Single-stage approval

**API Endpoints:**

```typescript
// Get all promotions
await promotionAPI.getAll();

// Get pending promotions
const promotions = await promotionAPI.getAll();
const pending = promotions.filter(p => p.status === 'pending');

// Approve promotion
await promotionAPI.approve(
  promotionId: string,
  userId: string,
  userEmail: string
);

// Reject promotion
await promotionAPI.reject(
  promotionId: string,
  userId: string,
  userEmail: string,
  comments: string
);
```

**Status Flow:**
```
pending → approved
       ↓
    rejected
```

**Auto-Processing:**
- ✅ Automatically updates staff salary
- ✅ Creates arrears for backdated promotions
- ✅ Updates staff grade/step

---

## 🖥️ **User Interface**

### **Enhanced Approvals Dashboard**

**Location:** `/pages/ApprovalsPageEnhanced.tsx`

**Features:**
- ✅ **Unified Dashboard** - All 6 approval types in one view
- ✅ **Smart Filtering** - Filter by type (payroll, loan, leave, etc.)
- ✅ **Urgency Indicators** - Color-coded urgency (critical, high, medium, low)
- ✅ **Quick Stats** - Total pending, critical items, high priority
- ✅ **Batch Actions** - Approve/reject from modal
- ✅ **Comments Support** - Add approval/rejection comments
- ✅ **Audit Trail** - Full audit log integration

**Tabs:**
1. All Approvals (combined view)
2. Payroll
3. Loans
4. Leaves
5. Payments
6. Arrears
7. Promotions

**Urgency Calculation:**

```typescript
// Auto-calculated based on submission date
- Critical: > 7 days old
- High: > 3 days old
- Medium: > 1 day old
- Low: < 1 day old

// For leaves - based on start date
- Critical: Starts in ≤ 2 days
- High: Starts in ≤ 5 days
- Medium: Starts in ≤ 10 days
- Low: Starts in > 10 days
```

---

## 🔄 **Multi-Level Workflow**

### **Payroll Workflow (4 Stages)**

**Database:** `workflow_approvals` object store

**Schema:**
```typescript
interface WorkflowApproval {
  id: string;
  payroll_batch_id: string;
  stage: number;
  stage_name: string;
  approver_role: string;
  approver_id?: string;
  approver_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  approved_at?: string;
  created_at: string;
}
```

**Workflow Setup:**
```typescript
// Stage 1: Unit Head Review
{ stage: 1, stage_name: 'Unit Head Review', approver_role: 'reviewer' }

// Stage 2: Director Admin Approval
{ stage: 2, stage_name: 'Director Admin Approval', approver_role: 'approver' }

// Stage 3: Permanent Secretary Approval
{ stage: 3, stage_name: 'Permanent Secretary Approval', approver_role: 'approver' }

// Stage 4: Auditor Review
{ stage: 4, stage_name: 'Auditor Review', approver_role: 'auditor' }
```

**API:**
```typescript
// Create workflow stages (automatic on payroll creation)
await workflowAPI.createStages(payrollBatchId);

// Get current stage
const currentStage = payrollBatch.current_approval_stage || 1;

// Approve current stage
await payrollAPI.approvePayrollStage(batchId, currentStage, userId, userEmail);

// This automatically:
// 1. Marks current stage as approved
// 2. Advances to next stage
// 3. Updates payroll batch status
// 4. If final stage → status = 'approved'
```

### **Loan Approval Workflow (3 Stages)**

**Database:** `loan_approvals` object store

**Schema:**
```typescript
interface LoanApproval {
  id: string;
  loan_application_id: string;
  approval_stage: number;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  action: 'approved' | 'rejected' | 'returned';
  comments?: string;
  approved_amount?: number;
  approval_date: string;
  created_at: string;
}
```

**Workflow:**
```typescript
// Stage 1: Guarantor approval (if required)
if (loanType.requires_guarantors) {
  // Wait for all guarantors to approve
  status = 'guarantor_pending'
}

// Stage 2: Unit head review
// Stage 3: Final approval
```

---

## 📊 **Audit Trail**

**All approvals are automatically logged to the audit trail.**

**Database:** `audit_trail` object store

**Auto-logged Actions:**
- ✅ Approval granted
- ✅ Approval rejected
- ✅ Comments added
- ✅ Status changes
- ✅ Amount modifications

**API:**
```typescript
// Automatic logging in all approval APIs
await logAudit(
  userId: string,
  userEmail: string,
  action: 'APPROVE' | 'REJECT',
  entity_type: 'payroll_batch' | 'loan_application' | 'leave_request' | etc,
  entity_id: string,
  old_values?: Record<string, any>,
  new_values?: Record<string, any>
);
```

**Example:**
```typescript
// When approving payroll
await logAudit(userId, userEmail, 'APPROVE', 'payroll_batch', batchId, 
  { status: 'pending_approval' }, 
  { status: 'approved', approved_by: userId }
);
```

---

## ✅ **Production Checklist**

### **API Completeness**

| Entity | Get All | Get Pending | Approve | Reject | Multi-Level | Audit |
|--------|---------|-------------|---------|--------|-------------|-------|
| Payroll | ✅ | ✅ | ✅ | ✅ | ✅ (4 stages) | ✅ |
| Loans | ✅ | ✅ | ✅ | ✅ | ✅ (3 stages) | ✅ |
| Leaves | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Payments | ✅ | ✅ | ✅ | ⚠️ (delete only) | ❌ | ✅ |
| Arrears | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Promotions | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

### **UI Completeness**

- ✅ **Unified Approvals Dashboard** (`/pages/ApprovalsPageEnhanced.tsx`)
- ✅ **Type-specific filtering**
- ✅ **Urgency indicators**
- ✅ **Batch approval modal**
- ✅ **Comments support**
- ✅ **Mobile responsive**
- ✅ **Dark mode support**

### **Business Logic**

- ✅ **Role-based access control**
- ✅ **Stage progression validation**
- ✅ **Auto-deduction (leaves)**
- ✅ **Auto-arrears generation (promotions)**
- ✅ **Guarantor validation (loans)**
- ✅ **Payment file generation**

### **Data Integrity**

- ✅ **Audit trail for all actions**
- ✅ **Status consistency checks**
- ✅ **Transaction rollback on errors**
- ✅ **Duplicate prevention**

---

## 🚀 **How to Use**

### **As an Approver:**

1. **Login** with approver credentials
2. **Navigate** to **Approvals** from sidebar
3. **View** all pending items across all types
4. **Filter** by type or urgency
5. **Click Review** on any item
6. **Add comments** (optional for most, required for rejection)
7. **Approve or Reject**

### **For Payroll (Multi-Stage):**

1. System shows only items at **your stage**
2. Example: If you're a Reviewer, you see only Stage 1 items
3. After approval, item moves to next stage
4. Next approver can then see and approve

### **API Integration Examples:**

```typescript
// Get all pending approvals for current user
const getAllPendingForUser = async (userRole: string) => {
  const items = [];
  
  // Payroll - check stage-based access
  const payrolls = await payrollAPI.getAllPayrollBatches();
  const myPayrolls = payrolls.filter(p => {
    const stage = p.current_approval_stage || 1;
    const workflow = await db.getByIndex('workflow_approvals', 'payroll_batch_id', p.id);
    const currentStage = workflow.find(w => w.stage === stage);
    return currentStage?.approver_role === userRole && currentStage?.status === 'pending';
  });
  items.push(...myPayrolls);
  
  // Loans
  if (userRole === 'approver') {
    const loans = await loanApplicationAPI.getAll();
    items.push(...loans.filter(l => l.status === 'pending'));
  }
  
  // Leaves
  if (userRole === 'hr_manager' || userRole === 'approver') {
    const leaves = await leaveAPI.getAllRequests();
    items.push(...leaves.filter(l => l.status === 'pending'));
  }
  
  // And so on...
  return items;
};
```

---

## 📈 **Statistics & Reporting**

The enhanced approvals dashboard provides:

- **Total Pending Count** - All items awaiting approval
- **Critical Items** - Items > 7 days old
- **High Priority** - Items > 3 days old
- **This Week** - Items submitted in last 7 days
- **Type Breakdown** - Count by approval type

**Export Data:**
```typescript
// Get approval metrics
const metrics = {
  total: approvalItems.length,
  byType: {
    payroll: approvalItems.filter(i => i.type === 'payroll').length,
    loans: approvalItems.filter(i => i.type === 'loan').length,
    // etc...
  },
  byUrgency: {
    critical: approvalItems.filter(i => i.urgency === 'critical').length,
    high: approvalItems.filter(i => i.urgency === 'high').length,
    // etc...
  }
};
```

---

## 🔐 **Security & Access Control**

**Role Permissions:**

| Role | Can Approve | Approval Types | Multi-Level Access |
|------|-------------|----------------|-------------------|
| **Admin** | ✅ | All | All stages |
| **Approver** | ✅ | Payroll (Stage 2-3), Loans, Leaves, Payments, Arrears, Promotions | Stage-specific |
| **Reviewer** | ✅ | Payroll (Stage 1 only) | Stage 1 only |
| **Auditor** | ✅ | Payroll (Stage 4 only) | Stage 4 only |
| **HR Manager** | ✅ | Leaves only | N/A |

**Access Control in Code:**
```typescript
const canApproveCurrentStage = (item: ApprovalItem, user: User) => {
  switch (item.type) {
    case 'payroll':
      const stage = item.data.current_approval_stage || 1;
      const workflow = workflowStages.find(w => w.stage === stage);
      return workflow?.approver_role === user.role;
      
    case 'loan':
      return user.role === 'approver';
      
    case 'leave':
      return user.role === 'hr_manager' || user.role === 'approver';
      
    // etc...
  }
};
```

---

## 🎉 **Status: PRODUCTION READY**

### **✅ Complete Features:**
- All 6 approval types implemented
- Multi-level workflow for payroll and loans
- Unified approvals dashboard
- Full audit trail
- Role-based access control
- Comments and rejection reasons
- Auto-processing (leave deductions, arrears generation)
- Mobile responsive
- Dark mode support

### **📋 Migration Checklist for Production:**
1. ✅ All APIs implemented
2. ✅ Database schemas complete
3. ✅ UI fully functional
4. ⚠️ Add email notifications (when approvals needed)
5. ⚠️ Add SMS notifications for critical items
6. ⚠️ Add deadline enforcement (auto-escalation)
7. ⚠️ Add delegation support (approve on behalf of)

### **🚀 Ready to Deploy:**
The approver flow is **100% production-ready** for prototype/demo use. For full production deployment, add the notification and escalation features listed above.

---

**Last Updated:** 2024-12-25  
**Version:** 1.0  
**Author:** JSC Payroll Development Team
