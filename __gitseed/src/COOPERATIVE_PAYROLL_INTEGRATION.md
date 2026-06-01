# Cooperative-Payroll-Loan Integration Guide

## Overview
The JSC-PMS now has a comprehensive multi-cooperative management system fully integrated with Payroll Processing and Loan Management. This document explains how all components work together.

---

## System Components

### 1. Cooperative Management Page
**Location:** `/pages/CooperativeManagementPage.tsx`

**Purpose:** Administrative interface for managing cooperatives, members, and contributions.

**Features:**
- Create and manage multiple cooperatives (Thrift & Credit, Multipurpose, Transport, etc.)
- Register staff as members in one or more cooperatives
- Record manual contributions
- View cooperative statistics and member details
- Track total contributions, share capital, loans, and dividends

**Access:** Admin, Payroll/HR Manager

---

### 2. Payroll Integration

#### How Cooperative Contributions are Deducted

**File:** `/lib/api.ts` (processPayroll function)

**Process:**
1. **During Payroll Processing:**
   - System automatically fetches all active cooperative memberships for each staff
   - For each membership, adds a deduction line:
     ```javascript
     {
       code: `COOP_{cooperative_id}`,
       name: "{Cooperative Name} Contribution",
       amount: monthly_contribution
     }
     ```
   - Deductions appear on payroll lines alongside tax, pension, NHF, etc.

2. **When Payroll is Locked (Finalized):**
   - System automatically calls `recordCooperativeContributionsFromPayroll()`
   - Creates contribution records in `cooperative_contributions` table
   - Updates member's `total_contributions`
   - Updates cooperative's `total_contributions`
   - Generates receipt numbers: `PAY-{batchId}-{memberNumber}`

**Code Flow:**
```
Process Payroll → Add Cooperative Deductions → Staff Approves Payroll 
→ Lock Payroll → Auto-Record Contributions → Update Totals
```

**Example Payroll Line Deductions:**
```javascript
deductions: [
  { code: 'PEN', name: 'Pension', amount: 7500 },
  { code: 'NHF', name: 'NHF', amount: 2500 },
  { code: 'COOP_abc123', name: 'Thrift & Credit Contribution', amount: 5000 },
  { code: 'COOP_def456', name: 'Transport Cooperative Contribution', amount: 2000 },
  { code: 'TAX', name: 'PAYE (Progressive)', amount: 15000 }
]
```

---

### 3. Loan Types Linked to Cooperatives

**File:** `/pages/LoanManagementPage.tsx` (LoanTypesTab)

**Database Field:** `LoanType.cooperative_id` (optional)

**Purpose:** Link specific loan types to cooperatives, restricting eligibility to cooperative members only.

**How to Use:**
1. Navigate to **Loan & Cooperative Management → Loan Types**
2. Click **"New Loan Type"**
3. Fill in loan details
4. In **"Linked Cooperative"** dropdown:
   - Select **"None - General Loan"** for regular staff loans
   - Select a specific cooperative for cooperative-only loans
5. Save

**Display:**
- Loan types linked to cooperatives show a badge with the cooperative name
- Badge appears on loan type cards with cooperative icon

**Eligibility Logic:**
- If `cooperative_id` is set: Only members of that cooperative can apply
- If `cooperative_id` is null/empty: All staff can apply

**Example Use Cases:**
- **General Staff Loan** → No cooperative link
- **Cooperative Quick Loan** → Linked to "Thrift & Credit Cooperative"
- **Transport Loan** → Linked to "Transport Cooperative"
- **Housing Advance** → Linked to "Housing Cooperative"

---

### 4. Old Cooperative Tab (Deprecated)

**File:** `/pages/LoanManagementPage.tsx` (CooperativeTab)

**Status:** This tab shows cooperative members but doesn't specify WHICH cooperative. Since staff can now belong to multiple cooperatives, this tab is outdated.

**Recommendation:**
- **Option 1:** Remove this tab and direct users to the Cooperative Management Page
- **Option 2:** Update it to show all cooperatives with expandable member lists

**Current Functionality:**
- Shows basic member list
- Register new members (but doesn't specify cooperative)
- Limited CRUD operations

**Better Alternative:** Use the **Cooperative Management Page** for all cooperative operations.

---

## Complete Workflow Examples

### Example 1: Staff Joins a Cooperative and Gets Deductions

**Step 1: Register Staff in Cooperative**
1. Admin goes to **Cooperative Management**
2. Clicks **"Members"** tab
3. Clicks **"Register Member"**
4. Selects:
   - Cooperative: Thrift & Credit Cooperative
   - Staff: John Doe (JSC-2024-001)
   - Monthly Contribution: ₦5,000
   - Shares: 10
5. Saves

**Step 2: Process Payroll**
1. Payroll Officer creates new payroll batch for January 2025
2. System automatically:
   - Detects John is a member of Thrift & Credit Cooperative
   - Adds ₦5,000 deduction to his payroll line
   - Deduction appears as "Thrift & Credit Cooperative Contribution"

**Step 3: Payroll Approval & Locking**
1. Payroll goes through approval workflow
2. When locked/finalized:
   - System creates contribution record
   - Updates John's total_contributions: ₦5,000
   - Updates cooperative's total_contributions
   - Generates receipt: `PAY-12ab34cd-JSC-2024-001`

**Step 4: Verify Contribution**
1. Admin checks **Cooperative Management → Contributions**
2. Sees John's contribution recorded
3. Contribution shows:
   - Type: Regular
   - Payment Method: Payroll Deduction
   - Amount: ₦5,000
   - Month: January 2025

---

### Example 2: Create Cooperative-Specific Loan Type

**Step 1: Create Loan Type**
1. Go to **Loan & Cooperative Management → Loan Types**
2. Click **"New Loan Type"**
3. Fill in:
   - Name: Cooperative Emergency Loan
   - Code: COOP-EMG
   - Interest Rate: 5%
   - Max Amount: ₦100,000
   - Max Tenure: 6 months
   - **Linked Cooperative:** Thrift & Credit Cooperative ✓
4. Save

**Step 2: Staff Applies for Loan**
1. Only members of Thrift & Credit Cooperative can see this loan type
2. Staff applies through portal
3. Loan shows cooperative badge

**Step 3: Loan Approval & Repayment**
1. Loan gets approved
2. Repayment deductions added to payroll
3. Both loan repayment AND cooperative contributions deducted monthly

---

### Example 3: Staff in Multiple Cooperatives

**Scenario:**
- Sarah is member of:
  - Thrift & Credit Cooperative (₦5,000/month)
  - Transport Cooperative (₦2,000/month)

**Payroll Impact:**
Her payroll deductions will show:
```
Deductions:
- Pension: ₦7,500
- NHF: ₦2,500
- Thrift & Credit Contribution: ₦5,000
- Transport Cooperative Contribution: ₦2,000
- PAYE Tax: ₦15,000
Total Deductions: ₦32,000
```

**Contribution Records:**
When payroll is locked, 2 separate contribution records are created:
1. Thrift & Credit - ₦5,000
2. Transport - ₦2,000

---

## Database Schema

### cooperative_members
```typescript
{
  id: string;
  cooperative_id: string;        // Links to specific cooperative
  staff_id: string;              // Links to staff record
  monthly_contribution: number;   // Auto-deducted from payroll
  total_contributions: number;    // Updated when payroll locked
  status: 'active' | 'inactive' | 'suspended';
}
```

### cooperative_contributions
```typescript
{
  id: string;
  cooperative_id: string;
  member_id: string;
  contribution_month: string;     // YYYY-MM
  amount: number;
  contribution_type: 'regular' | 'voluntary' | 'share_capital' | 'special_levy';
  payment_method: 'payroll_deduction' | 'cash' | 'bank_transfer';
  receipt_number: string;         // PAY-{batchId}-{memberNumber}
  recorded_by: string;            // 'system' for auto-generated
}
```

### loan_types
```typescript
{
  id: string;
  name: string;
  code: string;
  interest_rate: number;
  cooperative_id?: string;        // Optional link to cooperative
  // ... other fields
}
```

---

## API Functions

### Payroll API (`/lib/api.ts`)
```typescript
// Automatically called when payroll is locked
recordCooperativeContributionsFromPayroll(
  batchId: string, 
  payrollMonth: string
): Promise<void>
```

### Cooperative API (`/lib/loanAPI.ts`)
```typescript
cooperativeAPI.getAll()                           // Get all cooperatives
cooperativeAPI.create(data)                       // Create new cooperative
cooperativeAPI.registerMember(data)               // Register staff as member
cooperativeAPI.recordContribution(data)           // Manual contribution
cooperativeAPI.getCooperativeStats(id)           // Get statistics
cooperativeAPI.getAllMembers()                    // Get all members
```

---

## Key Points

✅ **Automatic Payroll Deduction:** Cooperative contributions are automatically deducted from staff salary during payroll processing

✅ **Multi-Cooperative Support:** Staff can belong to multiple cooperatives simultaneously

✅ **Automatic Contribution Recording:** When payroll is finalized, contributions are automatically recorded in the cooperative system

✅ **Loan Type Linking:** Loan types can be optionally linked to specific cooperatives for member-only access

✅ **Complete Audit Trail:** All deductions, contributions, and transactions are tracked with timestamps and user IDs

✅ **Real-time Totals:** Cooperative totals are updated automatically when payroll is processed

---

## Future Enhancements

1. **Cooperative Loan Repayment Integration:** Link loan repayments to cooperative accounts
2. **Dividend Distribution:** Calculate and distribute dividends based on contributions
3. **Share Value Appreciation:** Track share capital value over time
4. **Member Portal:** Let staff view their cooperative memberships and contributions
5. **Contribution History Reports:** Generate detailed contribution reports per member/cooperative
6. **Cooperative Dashboards:** Analytics for cooperative performance

---

## Notes

- The old "Cooperative" tab in Loan Management is now deprecated in favor of the dedicated Cooperative Management Page
- All cooperative operations should be performed through the Cooperative Management Page
- Payroll processing handles ALL deductions automatically - no manual intervention needed
- Contributions are only recorded when payroll status changes to "locked"
- Receipt numbers are auto-generated in format: `PAY-{batchId}-{memberNumber}`

---

**Last Updated:** December 2024
