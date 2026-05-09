# Multi-Cooperative Management System

## Overview

The JSC Payroll Management System now supports **MULTIPLE COOPERATIVE SOCIETIES**, allowing staff members to belong to different cooperatives simultaneously. This is typical in Nigerian government agencies where staff participate in various cooperative societies such as:

- Thrift & Credit Cooperatives
- Multipurpose Cooperatives
- Transport Cooperatives
- Housing Cooperatives
- Producer/Consumer Cooperatives

## Architecture

### Database Schema

#### 1. **Cooperatives** (`cooperatives` object store)

Represents individual cooperative societies within the organization.

```typescript
interface Cooperative {
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
```

**Indexes:**
- Primary: `id`
- Unique: `code`
- Non-unique: `status`, `cooperative_type`

#### 2. **Cooperative Members** (`cooperative_members` object store)

Represents staff membership in specific cooperatives. A staff member can have multiple memberships (one per cooperative).

```typescript
interface CooperativeMember {
  id: string;
  cooperative_id: string; // Link to specific cooperative
  cooperative_name: string;
  member_number: string; // Unique per cooperative (e.g., TCC/2024/0001)
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
```

**Indexes:**
- Primary: `id`
- Non-unique: `cooperative_id`, `staff_id`, `status`
- **Composite Unique:** `[cooperative_id, staff_id]` - ensures a staff can only join a cooperative once

#### 3. **Cooperative Contributions** (`cooperative_contributions` object store)

Tracks contributions made by members to their respective cooperatives.

```typescript
interface CooperativeContribution {
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
```

**Indexes:**
- Primary: `id`
- Non-unique: `cooperative_id`, `member_id`, `staff_id`, `payroll_batch_id`

### Loan-Cooperative Integration

Loans can be **optionally linked** to specific cooperatives:

#### Updated Loan Interfaces

**LoanType:**
```typescript
interface LoanType {
  // ... existing fields
  cooperative_id?: string; // Optional: Link loan type to a specific cooperative
}
```

**LoanApplication:**
```typescript
interface LoanApplication {
  // ... existing fields
  cooperative_id?: string; // Optional: Link loan to a specific cooperative
  cooperative_name?: string;
}
```

**LoanDisbursement:**
```typescript
interface LoanDisbursement {
  // ... existing fields
  cooperative_id?: string; // Optional: Link disbursement to a specific cooperative
  cooperative_name?: string;
}
```

**Indexes Added:**
- `loan_applications`: Added `cooperative_id` index
- `loan_disbursements`: Added `cooperative_id` index

## API Endpoints

### Cooperative Entity Management (`cooperativeAPI`)

#### Get All Cooperatives
```typescript
cooperativeAPI.getAll(filters?: { 
  status?: 'active' | 'inactive' | 'suspended'; 
  cooperative_type?: string 
})
```

#### Get Cooperative by ID
```typescript
cooperativeAPI.getById(id: string)
```

#### Get Cooperative by Code
```typescript
cooperativeAPI.getByCode(code: string)
```

#### Create Cooperative
```typescript
cooperativeAPI.create({
  name: string;
  code: string;
  description: string;
  cooperative_type: 'thrift_credit' | 'multipurpose' | ...;
  monthly_contribution_required: number;
  share_capital_value: number;
  minimum_shares: number;
  interest_rate_on_loans: number;
  maximum_loan_multiplier: number;
  // ... other fields
})
```

#### Update Cooperative
```typescript
cooperativeAPI.update(id: string, data: Partial<Cooperative>)
```

### Member Management

#### Get All Members
```typescript
cooperativeAPI.getAllMembers(filters?: { 
  cooperative_id?: string;
  status?: string;
  staff_id?: string;
})
```

#### Get Member by ID
```typescript
cooperativeAPI.getMemberById(id: string)
```

#### Get Member by Staff and Cooperative
```typescript
cooperativeAPI.getMemberByStaffAndCooperative(staffId: string, cooperativeId: string)
```

#### Get All Memberships for a Staff
```typescript
cooperativeAPI.getMembershipsByStaffId(staffId: string)
```
Returns all cooperatives a staff member belongs to.

#### Register New Member
```typescript
cooperativeAPI.registerMember({
  cooperative_id: string;
  staff_id: string;
  monthly_contribution: number;
  shares_owned?: number;
})
```
- Validates cooperative and staff exist
- Checks for duplicate membership in same cooperative
- Generates cooperative-specific member number (e.g., `TCC/2024/0001`)
- Calculates initial share capital based on shares

### Contribution Management

#### Record Contribution
```typescript
cooperativeAPI.recordContribution({
  cooperative_id: string;
  member_id: string;
  contribution_month: string;
  amount: number;
  contribution_type: 'regular' | 'voluntary' | 'share_capital' | 'special_levy';
  payroll_batch_id?: string;
  payment_method: 'payroll_deduction' | 'cash' | 'bank_transfer';
  receipt_number?: string;
})
```
- Updates member totals (total_contributions, total_share_capital, shares_owned)
- Updates cooperative totals
- Links to payroll batch if deducted via payroll

#### Get Contributions
```typescript
cooperativeAPI.getContributions(filters?: { 
  cooperative_id?: string; 
  member_id?: string; 
  staff_id?: string;
  contribution_month?: string;
})
```

#### Get Member Statement
```typescript
cooperativeAPI.getMemberStatement(memberId: string)
```
Returns:
- Member details
- All contributions
- All loans linked to that cooperative

#### Update Member Status
```typescript
cooperativeAPI.updateMemberStatus(
  memberId: string, 
  status: 'active' | 'inactive' | 'suspended', 
  reason?: string
)
```
- Sets exit_date when status changes to 'inactive'
- Records suspension_reason for suspended members

#### Get Cooperative Statistics
```typescript
cooperativeAPI.getCooperativeStats(cooperativeId: string)
```
Returns:
- Cooperative details
- Total members
- Active members
- Total contributions
- Total loans disbursed
- Total outstanding loans
- Average contribution

## Usage Examples

### Example 1: Creating a New Cooperative

```typescript
const newCooperative = await cooperativeAPI.create({
  name: 'JSC Thrift & Credit Cooperative Society',
  code: 'TCC',
  description: 'Main thrift and credit cooperative for all JSC staff',
  registration_number: 'RC-2015/NGR/001',
  date_established: '2015-03-15',
  cooperative_type: 'thrift_credit',
  monthly_contribution_required: 5000,
  share_capital_value: 1000,
  minimum_shares: 10,
  interest_rate_on_loans: 7,
  maximum_loan_multiplier: 3,
  meeting_schedule: 'Monthly - Last Friday',
  chairman_name: 'Hon. Justice A. B. Mohammed',
  secretary_name: 'Mrs. Grace Okoro',
  treasurer_name: 'Mr. Samuel Adebayo',
  contact_email: 'tcc@jsc.gov.ng',
  contact_phone: '080-1234-5678',
  bank_name: 'First Bank of Nigeria',
  bank_account_number: '2048576912',
  status: 'active',
  created_by: currentUser.id,
});
```

### Example 2: Registering a Staff Member to Multiple Cooperatives

```typescript
// Register to Thrift & Credit Cooperative
const tccMembership = await cooperativeAPI.registerMember({
  cooperative_id: 'cooperative-tcc-id',
  staff_id: 'staff-123',
  monthly_contribution: 5000,
  shares_owned: 10, // Optional, defaults to minimum_shares
});
// Member number: TCC/2024/0001

// Register to Multipurpose Cooperative
const mpcMembership = await cooperativeAPI.registerMember({
  cooperative_id: 'cooperative-mpc-id',
  staff_id: 'staff-123',
  monthly_contribution: 3000,
  shares_owned: 20,
});
// Member number: MPC/2024/0001

// Get all memberships for this staff
const memberships = await cooperativeAPI.getMembershipsByStaffId('staff-123');
// Returns: [tccMembership, mpcMembership]
```

### Example 3: Recording Monthly Contributions

```typescript
// Record contribution for January 2025
await cooperativeAPI.recordContribution({
  cooperative_id: 'cooperative-tcc-id',
  member_id: 'member-id',
  contribution_month: '2025-01',
  amount: 5000,
  contribution_type: 'regular',
  payroll_batch_id: 'batch-jan-2025', // Linked to payroll
  payment_method: 'payroll_deduction',
});
```

### Example 4: Linking Loans to Cooperatives

```typescript
// Create a cooperative-specific loan type
const coopLoanType = await loanTypeAPI.create({
  name: 'TCC Thrift Loan',
  code: 'TCC_THRIFT',
  description: 'Special loan for TCC members',
  interest_rate: 7,
  max_amount: 1500000,
  max_tenure_months: 24,
  cooperative_id: 'cooperative-tcc-id', // Link to cooperative
  // ... other fields
});

// Apply for a cooperative loan
const loanApp = await loanApplicationAPI.create({
  staff_id: 'staff-123',
  loan_type_id: coopLoanType.id,
  cooperative_id: 'cooperative-tcc-id', // Link to cooperative
  cooperative_name: 'JSC Thrift & Credit Cooperative Society',
  amount_requested: 500000,
  purpose: 'Business expansion',
  tenure_months: 12,
  // ... other fields
});
```

### Example 5: Getting Cooperative Reports

```typescript
// Get statistics for a specific cooperative
const stats = await cooperativeAPI.getCooperativeStats('cooperative-tcc-id');

console.log(`
  Cooperative: ${stats.cooperative.name}
  Total Members: ${stats.total_members}
  Active Members: ${stats.active_members}
  Total Contributions: ₦${stats.total_contributions.toLocaleString()}
  Total Loans Disbursed: ₦${stats.total_loans_disbursed.toLocaleString()}
  Outstanding Balance: ₦${stats.total_outstanding.toLocaleString()}
  Average Monthly Contribution: ₦${stats.average_contribution.toLocaleString()}
`);

// Get all contributions for a month
const janContributions = await cooperativeAPI.getContributions({
  cooperative_id: 'cooperative-tcc-id',
  contribution_month: '2025-01',
});
```

## Demo Data

The system includes **three default cooperatives**:

1. **JSC Thrift & Credit Cooperative Society (TCC)**
   - Type: Thrift & Credit
   - Monthly Contribution: ₦5,000
   - Share Value: ₦1,000
   - Interest Rate: 7%

2. **JSC Multipurpose Cooperative Society (MPC)**
   - Type: Multipurpose
   - Monthly Contribution: ₦3,000
   - Share Value: ₦500
   - Interest Rate: 8%

3. **JSC Transport Cooperative (TRANSPORT)**
   - Type: Transport
   - Monthly Contribution: ₦2,000
   - Share Value: ₦1,000
   - Interest Rate: 9%

## Integration with Payroll System

### Automatic Deductions

When processing payroll:

1. System fetches all active cooperative memberships for each staff
2. Deducts monthly contributions for each cooperative membership
3. Creates contribution records linked to payroll batch
4. Updates member and cooperative totals

```typescript
// In payroll processing
const memberships = await cooperativeAPI.getMembershipsByStaffId(staffId);

for (const membership of memberships) {
  if (membership.status === 'active') {
    await cooperativeAPI.recordContribution({
      cooperative_id: membership.cooperative_id,
      member_id: membership.id,
      contribution_month: payrollMonth,
      amount: membership.monthly_contribution,
      contribution_type: 'regular',
      payroll_batch_id: batchId,
      payment_method: 'payroll_deduction',
    });
  }
}
```

## Reporting

Available reports:
- Cooperative-wise contribution summaries
- Member statements by cooperative
- Cross-cooperative membership analysis
- Loan disbursement by cooperative
- Monthly contribution reports per cooperative
- Dividend distribution reports

## Future Enhancements

1. **Dividend Management**: Calculate and distribute dividends based on share capital
2. **Loan Approval by Cooperative**: Allow cooperative executives to approve loans
3. **AGM Management**: Track Annual General Meetings, resolutions, and elections
4. **Financial Reports**: Generate cooperative-specific financial statements
5. **Bulk Registration**: Import multiple members from CSV
6. **Mobile App**: Member self-service portal for viewing statements

## Notes

- Staff can belong to multiple cooperatives simultaneously
- Each membership has a unique member number per cooperative
- Contributions are tracked separately for each cooperative
- Loans can be linked to cooperatives (optional)
- Cooperative totals are automatically updated when transactions occur
- Member status changes (suspension, exit) are tracked with dates and reasons
