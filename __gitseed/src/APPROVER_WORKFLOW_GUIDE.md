# 📋 Approver Workflow Guide - JSC Payroll Management System

## Overview

The JSC-PMS (Judicial Service Committee Payroll Management System) implements a **sophisticated multi-level approval workflow** that ensures proper checks and balances for critical payroll operations. This guide explains the complete approver workflow, roles, and processes.

---

## 🎯 Multi-Level Approval Architecture

### Default Approval Stages

The system implements a **4-stage hierarchical approval workflow**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYROLL APPROVAL WORKFLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Stage 1: UNIT HEAD REVIEW         → Reviewer Role              │
│           ↓ (Approve/Reject)                                     │
│                                                                  │
│  Stage 2: DIRECTOR ADMIN APPROVAL  → Approver Role              │
│           ↓ (Approve/Reject)                                     │
│                                                                  │
│  Stage 3: PERMANENT SECRETARY      → Approver Role              │
│           ↓ (Approve/Reject)                                     │
│                                                                  │
│  Stage 4: AUDITOR REVIEW           → Auditor Role (Read-only)   │
│           ↓                                                      │
│                                                                  │
│         FINAL APPROVAL → LOCKED → PAYMENT EXECUTION              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 User Roles in Approval Workflow

### 1. **Reviewer** (Stage 1)
**Role:** Unit Head / Section Head  
**Responsibilities:**
- First-level review of payroll batches
- Verify staff count and basic accuracy
- Check for obvious errors or anomalies
- Forward to next stage or reject for corrections

**Permissions:**
- ✅ View payroll batches
- ✅ Review payroll lines
- ✅ Approve Stage 1
- ✅ Reject with comments
- ✅ View staff records
- ❌ Cannot create/edit payroll batches
- ❌ Cannot skip to higher stages

**Access:** `role: 'reviewer'`

---

### 2. **Approver** (Stages 2 & 3)
**Role:** Director Admin / Permanent Secretary  
**Responsibilities:**
- Authoritative approval of payroll
- Financial verification
- Policy compliance check
- Final decision authority

**Permissions:**
- ✅ View all payroll data
- ✅ Approve their assigned stage
- ✅ Reject with detailed comments
- ✅ View complete audit trail
- ✅ Access to all reports
- ❌ Cannot modify payroll after submission
- ❌ Cannot approve stages out of sequence

**Access:** `role: 'approver'`

**Note:** Multiple approvers can exist in the system, but they can only act on their designated stage.

---

### 3. **Auditor** (Stage 4)
**Role:** Internal Auditor / Audit Unit  
**Responsibilities:**
- Final compliance review
- Financial audit verification
- Regulatory compliance check
- Read-only observation

**Permissions:**
- ✅ Read-only access to ALL data
- ✅ View complete audit trail
- ✅ Access all reports and exports
- ✅ View approval history
- ❌ CANNOT approve or reject
- ❌ CANNOT modify any data
- ❌ CANNOT create or delete records

**Access:** `role: 'auditor'`

---

## 🔄 Approval Workflow Process

### Step-by-Step Flow

#### **Step 1: Payroll Creation** (Payroll Officer)
```typescript
1. Payroll Officer creates batch
2. Generates payroll lines for all active staff
3. Reviews calculations
4. Clicks "Submit for Approval"
```

**Status Change:** `draft` → `pending_review`  
**Current Stage:** `1` (Unit Head Review)

---

#### **Step 2: Unit Head Review** (Reviewer)
```typescript
1. Reviewer logs in
2. Navigates to "Approvals" page
3. Sees pending payroll batches
4. Clicks "View Details"
5. Reviews:
   - Total staff count
   - Total gross pay
   - Total deductions
   - Net pay
   - Individual payroll lines
6. Options:
   a) APPROVE → Moves to Stage 2
   b) REJECT → Returns to Payroll Officer with comments
```

**On Approve:**
- Status: `pending_review` → `in_review`
- Current Stage: `1` → `2`
- Notification sent to Stage 2 approvers

**On Reject:**
- Status: `pending_review` → `rejected`
- Notification sent to Payroll Officer
- Comments mandatory

---

#### **Step 3: Director Admin Approval** (Approver - Stage 2)
```typescript
1. Director Admin logs in
2. Receives notification
3. Views payroll batch
4. Reviews:
   - Previous approval history
   - Reviewer's comments
   - Financial totals
   - Compliance checks
5. Options:
   a) APPROVE → Moves to Stage 3
   b) REJECT → Returns to Payroll Officer
```

**On Approve:**
- Status: `in_review` (remains)
- Current Stage: `2` → `3`
- Notification sent to Permanent Secretary

**On Reject:**
- Status: `in_review` → `rejected`
- Workflow stops
- All previous approvals invalidated

---

#### **Step 4: Permanent Secretary Approval** (Approver - Stage 3)
```typescript
1. Permanent Secretary logs in
2. Receives notification
3. Reviews:
   - Complete approval chain
   - All comments from previous stages
   - Financial authorization
   - Budget compliance
4. Options:
   a) APPROVE → Moves to Stage 4 (Auditor)
   b) REJECT → Returns to start
```

**On Approve:**
- Status: `in_review` → `approved`
- Current Stage: `3` → `4`
- Notification sent to Auditor

**On Reject:**
- Status: `in_review` → `rejected`
- Complete workflow reset required

---

#### **Step 5: Auditor Review** (Auditor - Read-Only)
```typescript
1. Auditor logs in
2. Reviews approved payroll (read-only)
3. Checks:
   - Compliance with regulations
   - Proper approval sequence
   - Audit trail completeness
   - Financial accuracy
4. No action required (observation only)
5. If issues found → Reports to management (out-of-system)
```

**Status:** `approved` (no change)  
**Current Stage:** `4` (final)

---

#### **Step 6: Payment Execution** (Payroll Officer/Cashier)
```typescript
1. After all approvals complete
2. Payroll Officer locks the batch
3. Status: approved → locked
4. Cashier executes payment via Bank Integration module
5. Payment batches generated for disbursement
```

---

## 📊 Approval Dashboard (ApprovalsPageEnhanced)

### What Approvers See

The enhanced approvals page shows **6 types of approval items**:

```typescript
1. 📄 Payroll Batches       - Monthly salary processing
2. 💰 Loan Applications     - Staff loan requests
3. 📅 Leave Requests        - Leave approval workflow
4. 💳 Payment Batches       - Bank payment authorization
5. 📈 Arrears               - Salary arrears approval
6. 🏆 Promotions            - Staff promotion approvals
```

### Dashboard Features

#### **Stats Cards**
- **Total Pending:** All items awaiting action
- **Payroll:** Pending payroll batches
- **Loans:** Loan applications needing approval
- **Leaves:** Leave requests awaiting decision
- **Payments:** Bank payments pending authorization
- **Arrears:** Arrears calculations pending approval
- **Promotions:** Promotion requests pending approval
- **Critical:** High-priority items requiring urgent action

#### **Filter Tabs**
- **All:** Shows all pending items across types
- **Payroll:** Payroll batches only
- **Loan:** Loan applications only
- **Leave:** Leave requests only
- **Payment:** Payment batches only
- **Arrear:** Arrears only
- **Promotion:** Promotions only

#### **Action Buttons**
Each item shows:
- 👁️ **View Details:** See complete information
- ✅ **Approve:** Approve current stage
- ❌ **Reject:** Reject with mandatory comments

---

## 🔐 Role-Based Access Control

### Permissions Matrix

| Action                          | Payroll Officer | Reviewer | Approver | Auditor | Admin |
|---------------------------------|----------------|----------|----------|---------|-------|
| Create Payroll Batch            | ✅             | ❌       | ❌       | ❌      | ✅    |
| Submit for Approval             | ✅             | ❌       | ❌       | ❌      | ✅    |
| Approve Stage 1 (Review)        | ❌             | ✅       | ❌       | ❌      | ✅    |
| Approve Stage 2 (Director)      | ❌             | ❌       | ✅       | ❌      | ✅    |
| Approve Stage 3 (Perm Sec)      | ❌             | ❌       | ✅       | ❌      | ✅    |
| View Audit Trail                | ✅             | ✅       | ✅       | ✅      | ✅    |
| Reject Payroll                  | ❌             | ✅       | ✅       | ❌      | ✅    |
| Lock Payroll                    | ✅             | ❌       | ❌       | ❌      | ✅    |
| Execute Payment                 | ❌             | ❌       | ❌       | ❌      | ✅    |
| Modify Data                     | ✅             | ❌       | ❌       | ❌      | ✅    |

---

## 📝 Approval Process Details

### Database Schema

#### **workflow_approvals** Table
```typescript
{
  id: string;                    // Unique approval record ID
  payroll_batch_id: string;      // Reference to payroll batch
  stage: number;                 // 1, 2, 3, or 4
  stage_name: string;            // "Unit Head Review", "Director Admin", etc.
  approver_role: string;         // "reviewer", "approver", "auditor"
  status: 'pending' | 'approved' | 'rejected';
  approver_id?: string;          // User who took action
  comments?: string;             // Approval/rejection comments
  action_date?: string;          // When action was taken
  created_at: string;            // When stage was created
}
```

#### **PayrollBatch** Fields
```typescript
{
  id: string;
  batch_number: string;
  month: string;
  status: 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'locked';
  current_approval_stage?: number;  // 1, 2, 3, 4, or undefined (when complete)
  total_staff: number;
  total_gross_pay: number;
  total_deductions: number;
  total_net_pay: number;
  created_by: string;
  submitted_at?: string;
  approved_at?: string;
  locked_at?: string;
}
```

---

## 🔔 Notification Integration

### Approvers Receive Notifications For:

#### **1. New Approval Required**
```typescript
Type: 'approval'
Category: 'action_required'
Priority: 'high'
Title: "New Payroll Batch Awaiting Your Approval"
Message: "Payroll batch JSC-PAY-2024-001 (January 2024) requires your approval at Stage 2"
Action: "Review & Approve"
Link: "/approvals"
```

#### **2. Approval Stage Completed**
```typescript
Type: 'payroll'
Category: 'success'
Priority: 'medium'
Title: "Stage 1 Approved"
Message: "Unit Head has approved payroll batch JSC-PAY-2024-001"
Link: "/payroll"
```

#### **3. Payroll Rejected**
```typescript
Type: 'payroll'
Category: 'warning'
Priority: 'urgent'
Title: "Payroll Batch Rejected"
Message: "Director Admin rejected JSC-PAY-2024-001 - Reason: Incorrect deductions"
Link: "/payroll"
```

#### **4. All Approvals Complete**
```typescript
Type: 'payroll'
Category: 'success'
Priority: 'high'
Title: "Payroll Fully Approved"
Message: "JSC-PAY-2024-001 has completed all approval stages and is ready for locking"
Link: "/payroll"
```

---

## 🛠️ API Endpoints

### Approval APIs

```typescript
// 1. Submit payroll for approval
await payrollAPI.submitForApproval(batchId, userId, userEmail);
// Creates workflow_approvals for all stages
// Sets status to 'pending_review'
// Sets current_approval_stage to 1

// 2. Approve current stage
await payrollAPI.approvePayrollStage(batchId, stage, userId, userEmail, comments);
// Marks stage as 'approved'
// Increments current_approval_stage
// Updates batch status
// Sends notifications

// 3. Reject current stage
await payrollAPI.rejectPayrollStage(batchId, stage, userId, userEmail, comments);
// Marks stage as 'rejected'
// Sets batch status to 'rejected'
// Resets workflow
// Sends notifications
// Comments MANDATORY

// 4. Get workflow approvals for batch
const approvals = await db.getByIndex('workflow_approvals', 'payroll_batch_id', batchId);
// Returns all approval stages for the batch
// Shows which stages are pending/approved/rejected

// 5. Get pending approvals for user
const pendingItems = await payrollAPI.getAllPayrollBatches();
const filtered = pendingItems.filter(batch => {
  const canApprove = canApproveCurrentStage(batch, user);
  return canApprove && batch.status !== 'approved' && batch.status !== 'locked';
});
```

---

## 🎨 UI/UX for Approvers

### Approval Modal Components

#### **View Details Modal**
```
┌────────────────────────────────────────────────┐
│  Payroll Batch: JSC-PAY-2024-001               │
│  Month: January 2024                           │
├────────────────────────────────────────────────┤
│                                                 │
│  📊 Summary                                     │
│  • Total Staff: 150                            │
│  • Gross Pay: ₦45,000,000                      │
│  • Deductions: ₦12,500,000                     │
│  • Net Pay: ₦32,500,000                        │
│                                                 │
│  ✅ Approval Timeline                           │
│                                                 │
│  ✓ Stage 1: Unit Head Review                   │
│    Approved by John Doe on 15 Jan 2024         │
│    "All calculations verified"                 │
│                                                 │
│  ⏳ Stage 2: Director Admin (Current)           │
│    Awaiting your approval                      │
│                                                 │
│  ⭕ Stage 3: Permanent Secretary                │
│    Pending                                      │
│                                                 │
│  ⭕ Stage 4: Auditor Review                     │
│    Pending                                      │
│                                                 │
│  💬 Comments (Optional)                         │
│  ┌──────────────────────────────────────┐      │
│  │                                      │      │
│  └──────────────────────────────────────┘      │
│                                                 │
│  [✅ Approve Stage 2]  [❌ Reject]              │
│                                                 │
└────────────────────────────────────────────────┘
```

#### **Status Indicators**
- 🟢 **Approved:** Green checkmark, stage completed
- 🔵 **Pending:** Blue clock, awaiting action
- 🔴 **Rejected:** Red X, stage rejected
- 🟡 **Current:** Yellow highlight, your action required

---

## 📋 Approval Best Practices

### For Reviewers (Stage 1)
✅ **Do:**
- Verify staff count matches expected
- Check for obvious calculation errors
- Ensure all active staff are included
- Review new hires and terminations
- Provide constructive comments

❌ **Don't:**
- Approve without thorough review
- Skip checking individual lines
- Approve if data looks incorrect
- Leave vague comments

### For Approvers (Stages 2 & 3)
✅ **Do:**
- Review previous stage comments
- Verify financial totals
- Check budget compliance
- Ensure policy adherence
- Document concerns clearly
- Approve only if fully satisfied

❌ **Don't:**
- Rubber-stamp approvals
- Skip reading reviewer notes
- Approve under time pressure without review
- Reject without clear explanation

### For Auditors (Stage 4)
✅ **Do:**
- Verify complete approval chain
- Check audit trail completeness
- Review for regulatory compliance
- Document observations
- Report issues to management

❌ **Don't:**
- Attempt to modify data
- Approve/reject (read-only role)
- Bypass security controls

---

## 🔍 Audit Trail

### Every Approval Action Logs:

```typescript
{
  action: 'APPROVE_STAGE' | 'REJECT_STAGE' | 'SUBMIT_FOR_APPROVAL',
  user_id: string,
  user_email: string,
  entity_type: 'payroll_batch',
  entity_id: string,
  old_value: {
    status: 'pending_review',
    current_approval_stage: 1
  },
  new_value: {
    status: 'in_review',
    current_approval_stage: 2
  },
  metadata: {
    stage: 2,
    comments: 'Approved after verification',
    approver_name: 'John Doe'
  },
  timestamp: '2024-01-15T10:30:00Z',
  ip_address: '192.168.1.100' // (Future enhancement)
}
```

### Audit Trail Features:
- ✅ Immutable log (cannot be deleted or modified)
- ✅ Complete approval history
- ✅ User attribution
- ✅ Timestamp for each action
- ✅ Before/after state tracking
- ✅ Searchable and filterable
- ✅ Export to CSV/PDF

---

## 🚨 Error Handling & Validation

### Stage Validation Rules

```typescript
// Rule 1: Stages must be approved in sequence
if (batch.current_approval_stage !== stage) {
  throw new Error('Cannot approve out of sequence');
}

// Rule 2: Only designated role can approve stage
const stageConfig = approvalWorkflow.find(s => s.stage === stage);
if (stageConfig.role !== user.role) {
  throw new Error('Unauthorized to approve this stage');
}

// Rule 3: Cannot approve already approved stage
if (stageApproval.status === 'approved') {
  throw new Error('Stage already approved');
}

// Rule 4: Rejection requires comments
if (action === 'reject' && !comments) {
  throw new Error('Comments required for rejection');
}

// Rule 5: Cannot approve locked payroll
if (batch.status === 'locked') {
  throw new Error('Cannot approve locked payroll');
}
```

---

## 📱 Mobile Responsiveness

Approvers can:
- ✅ View pending approvals on mobile
- ✅ Read payroll details
- ✅ Approve/reject from mobile device
- ✅ Add comments via mobile keyboard
- ✅ Receive push notifications (future)

---

## 🔄 Workflow Customization (Admin)

Admins can customize the approval workflow:

```typescript
// system_settings.approval_workflow
[
  {
    stage: 1,
    name: 'Unit Head Review',
    role: 'reviewer',
    required: true,
    notification_enabled: true
  },
  {
    stage: 2,
    name: 'Director Admin Approval',
    role: 'approver',
    required: true,
    notification_enabled: true
  },
  {
    stage: 3,
    name: 'Permanent Secretary Approval',
    role: 'approver',
    required: true,
    notification_enabled: true
  },
  {
    stage: 4,
    name: 'Auditor Review',
    role: 'auditor',
    required: false, // Optional stage
    notification_enabled: true
  }
]
```

**Customizable Fields:**
- Stage order
- Stage names
- Required vs optional stages
- Role assignments
- Notification settings
- Timeout/SLA settings (future)

---

## 🧪 Test Accounts for Approvers

```bash
# Reviewer (Stage 1)
Email: reviewer@jsc.gov.ng
Password: reviewer123
Role: reviewer

# Approver (Stages 2 & 3)
Email: approver@jsc.gov.ng
Password: approver123
Role: approver

# Auditor (Stage 4)
Email: auditor@jsc.gov.ng
Password: auditor123
Role: auditor
```

---

## 📊 Approval Workflow Metrics

### Key Performance Indicators (KPIs)

1. **Average Approval Time per Stage**
   - Measures efficiency of each stage
   - Identifies bottlenecks

2. **Rejection Rate**
   - % of payrolls rejected
   - Indicates data quality issues

3. **First-Time Approval Rate**
   - % approved without rejection
   - Quality metric

4. **Stage-Specific Metrics**
   - Time spent at each stage
   - Most common rejection reasons

---

## 🎯 Summary

### Approval Workflow Highlights

✅ **4-Stage Hierarchical Approval**  
✅ **Role-Based Access Control**  
✅ **Sequential Stage Progression**  
✅ **Mandatory Rejection Comments**  
✅ **Complete Audit Trail**  
✅ **Real-Time Notifications**  
✅ **Mobile-Responsive UI**  
✅ **Customizable Workflow**  
✅ **Multi-Type Approvals** (Payroll, Loans, Leave, Payments, Arrears, Promotions)  
✅ **Security & Compliance**  

---

## 📞 Support

For questions about the approval workflow:
- **Technical:** Check `/lib/api.ts` → `approvePayrollStage` function
- **UI/UX:** Review `/pages/ApprovalsPageEnhanced.tsx`
- **Documentation:** This guide + `/SYSTEM_GUIDE.md`

**Status:** Production-ready, fully tested, integrated with notification system
