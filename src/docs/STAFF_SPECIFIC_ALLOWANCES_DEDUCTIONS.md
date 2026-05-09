# Staff-Specific Allowances & Deductions System

## Overview

The system now handles **three types** of allowances and deductions:

### 1. **Global/Standard** (Applied to ALL staff)
- Defined in `allowances` and `deductions` tables
- Applied uniformly during payroll generation
- Examples: Housing (50% of basic), Transport (25% of basic), Pension (8%)

### 2. **Staff-Specific** (Applied to INDIVIDUAL staff)
- Stored in `staff_allowances` and `staff_deductions` tables
- Can be **recurring** (every month) or **one-time** (single payroll)
- Examples: Overtime, Acting allowance, Loan repayment, Disciplinary deduction

### 3. **Payroll Adjustments** (Manual edits AFTER generation)
- Stored in `payroll_adjustments` table
- Applied to specific payroll lines after payroll is generated
- Examples: Correction of errors, ad-hoc bonuses, emergency deductions

---

## Database Schema

### StaffAllowance
```typescript
{
  id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  allowance_code: string;        // e.g., "OVT" for overtime
  allowance_name: string;        // e.g., "Overtime Pay"
  type: 'fixed' | 'percentage';
  amount?: number;               // For fixed type
  percentage?: number;           // For percentage type
  frequency: 'recurring' | 'one-time';
  is_taxable: boolean;
  is_pensionable: boolean;
  effective_from: string;        // YYYY-MM format
  effective_to?: string;         // YYYY-MM format (optional)
  status: 'active' | 'inactive' | 'expired';
  applied_months?: string[];     // Track which months it was applied to
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### StaffDeduction
```typescript
{
  id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  deduction_code: string;        // e.g., "LOAN_001"
  deduction_name: string;        // e.g., "Car Loan Repayment"
  type: 'fixed' | 'percentage';
  amount?: number;
  percentage?: number;
  frequency: 'recurring' | 'one-time';
  effective_from: string;
  effective_to?: string;
  status: 'active' | 'inactive' | 'expired';
  applied_months?: string[];
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### PayrollAdjustment
```typescript
{
  id: string;
  payroll_batch_id: string;
  payroll_line_id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string;
  adjustment_type: 'allowance' | 'deduction';
  item_code: string;
  item_name: string;
  amount: number;
  reason: string;                // Mandatory explanation
  is_taxable?: boolean;
  adjusted_by: string;
  created_at: string;
}
```

---

## How It Works

### Payroll Generation Flow

```
1. Generate Payroll Batch
   ↓
2. For Each Active Staff:
   ↓
   a. Calculate Basic Salary (from grade level & step)
   ↓
   b. Apply GLOBAL Allowances
      - Housing (50% of basic)
      - Transport (25% of basic)
      - Meal (₦10,000 fixed)
   ↓
   c. Apply STAFF-SPECIFIC Allowances
      - Query `staff_allowances` WHERE staff_id = X AND status = 'active'
      - Check if current month is within effective_from/effective_to range
      - Apply one-time OR recurring allowances
      - Mark one-time allowances as applied
   ↓
   d. Calculate Gross Pay
      = Basic + All Allowances
   ↓
   e. Calculate Progressive PAYE Tax
      - Use tax engine with CRA and relief
   ↓
   f. Apply GLOBAL Deductions
      - Pension (8%)
      - NHF (2.5%)
      - Cooperative (₦5,000)
   ↓
   g. Apply STAFF-SPECIFIC Deductions
      - Query `staff_deductions` WHERE staff_id = X AND status = 'active'
      - Apply recurring or one-time deductions
      - Mark one-time deductions as applied
   ↓
   h. Add Progressive Tax
   ↓
   i. Calculate Net Pay
      = Gross - Total Deductions
   ↓
3. Create Payroll Line
   ↓
4. Payroll Officer can MANUALLY ADJUST individual lines
   ↓
5. Submit for Approval
```

---

## API Endpoints

### Staff Allowances

#### Create Staff Allowance
```typescript
await staffAllowanceAPI.createStaffAllowance({
  staff_id: 'staff-uuid',
  staff_number: 'JSC/2020/0015',
  staff_name: 'John Doe',
  allowance_code: 'OVT',
  allowance_name: 'Overtime Pay - December',
  type: 'fixed',
  amount: 50000,
  frequency: 'one-time',
  is_taxable: true,
  is_pensionable: false,
  effective_from: '2024-12',
  effective_to: '2024-12',
  notes: 'Extra hours worked during budget preparation',
  status: 'active',
}, userId, userEmail);
```

#### Get Staff Allowances
```typescript
// Get all allowances for a specific staff
const allowances = await staffAllowanceAPI.getStaffAllowances(staffId);

// Get active allowances for payroll month
const activeAllowances = await staffAllowanceAPI.getActiveAllowances(staffId, '2024-12');
```

#### Update Staff Allowance
```typescript
await staffAllowanceAPI.updateStaffAllowance(allowanceId, {
  amount: 75000,
  notes: 'Increased due to additional hours',
}, userId, userEmail);
```

#### Deactivate/Expire Allowance
```typescript
await staffAllowanceAPI.deactivateStaffAllowance(allowanceId, userId, userEmail);
```

---

### Staff Deductions

#### Create Staff Deduction
```typescript
await staffDeductionAPI.createStaffDeduction({
  staff_id: 'staff-uuid',
  staff_number: 'JSC/2020/0015',
  staff_name: 'John Doe',
  deduction_code: 'LOAN_CAR_001',
  deduction_name: 'Car Loan Monthly Repayment',
  type: 'fixed',
  amount: 125000,
  frequency: 'recurring',
  is_taxable: false,
  effective_from: '2024-12',
  effective_to: '2028-12', // 4 years
  notes: 'Car loan approved on 2024-11-15',
  status: 'active',
}, userId, userEmail);
```

#### Get Staff Deductions
```typescript
const deductions = await staffDeductionAPI.getStaffDeductions(staffId);
```

---

### Payroll Adjustments

#### Add Adjustment to Payroll Line
```typescript
await payrollAdjustmentAPI.addAdjustment({
  payroll_batch_id: 'batch-uuid',
  payroll_line_id: 'line-uuid',
  staff_id: 'staff-uuid',
  staff_number: 'JSC/2020/0015',
  staff_name: 'John Doe',
  adjustment_type: 'allowance',
  item_code: 'BONUS',
  item_name: 'Performance Bonus',
  amount: 100000,
  reason: 'Exceptional performance in Q4 2024',
  is_taxable: true,
}, userId, userEmail);
```

#### Get Adjustments for Batch
```typescript
const adjustments = await payrollAdjustmentAPI.getBatchAdjustments(batchId);
```

#### Remove Adjustment
```typescript
await payrollAdjustmentAPI.removeAdjustment(adjustmentId, userId, userEmail);
```

---

## Use Cases

### Use Case 1: Overtime Payment

**Scenario**: Staff member worked extra hours in December

```typescript
// 1. Create one-time allowance
await staffAllowanceAPI.createStaffAllowance({
  staff_id: 'staff-001',
  staff_number: 'JSC/2020/0015',
  staff_name: 'John Doe',
  allowance_code: 'OVT',
  allowance_name: 'Overtime - December 2024',
  type: 'fixed',
  amount: 75000,
  frequency: 'one-time',
  is_taxable: true,
  is_pensionable: false,
  effective_from: '2024-12',
  effective_to: '2024-12',
  notes: '40 hours overtime @ ₦1,875/hour',
  status: 'active',
}, userId, userEmail);

// 2. Generate payroll - overtime will be included automatically
await payrollAPI.generatePayrollLines(batchId, userId, userEmail);

// 3. Overtime allowance will be marked as applied to '2024-12'
```

---

### Use Case 2: Acting Allowance (Recurring)

**Scenario**: Staff acting as HOD for 6 months

```typescript
await staffAllowanceAPI.createStaffAllowance({
  staff_id: 'staff-002',
  staff_number: 'JSC/2019/0234',
  staff_name: 'Jane Smith',
  allowance_code: 'ACT',
  allowance_name: 'Acting HOD Allowance',
  type: 'percentage',
  percentage: 15, // 15% of basic salary
  frequency: 'recurring',
  is_taxable: true,
  is_pensionable: false,
  effective_from: '2024-12',
  effective_to: '2025-05', // 6 months
  notes: 'Acting as HOD Administration while substantive HOD is on study leave',
  status: 'active',
}, userId, userEmail);

// Will be applied monthly from Dec 2024 to May 2025
```

---

### Use Case 3: Loan Repayment (Recurring)

**Scenario**: Staff has car loan with monthly repayment

```typescript
await staffDeductionAPI.createStaffDeduction({
  staff_id: 'staff-003',
  staff_number: 'JSC/2018/0156',
  staff_name: 'Ahmed Bello',
  deduction_code: 'LOAN_CAR_045',
  deduction_name: 'Car Loan Repayment',
  type: 'fixed',
  amount: 125000,
  frequency: 'recurring',
  effective_from: '2024-12',
  effective_to: '2028-11', // 48 months
  notes: 'Car loan disbursed 2024-11-20, Amount: ₦6,000,000, Tenure: 48 months',
  status: 'active',
}, userId, userEmail);
```

---

### Use Case 4: Disciplinary Deduction (One-Time)

**Scenario**: Staff had unauthorized absence, deduction for 3 days

```typescript
await staffDeductionAPI.createStaffDeduction({
  staff_id: 'staff-004',
  staff_number: 'JSC/2021/0089',
  staff_name: 'Chioma Okeke',
  deduction_code: 'DISC',
  deduction_name: 'Unauthorized Absence - 3 Days',
  type: 'fixed',
  amount: 15000, // 3 days × daily rate
  frequency: 'one-time',
  effective_from: '2024-12',
  effective_to: '2024-12',
  notes: 'Disciplinary action - unauthorized absence Nov 12-14, 2024. Ref: DISC/2024/045',
  status: 'active',
}, userId, userEmail);
```

---

### Use Case 5: Manual Adjustment After Generation

**Scenario**: Payroll generated but forgot to include special duty allowance

```typescript
// 1. Payroll already generated
await payrollAPI.generatePayrollLines(batchId, userId, userEmail);

// 2. Add adjustment manually
await payrollAdjustmentAPI.addAdjustment({
  payroll_batch_id: batchId,
  payroll_line_id: lineId,
  staff_id: 'staff-005',
  staff_number: 'JSC/2017/0234',
  staff_name: 'Fatima Hassan',
  adjustment_type: 'allowance',
  item_code: 'SP_DUTY',
  item_name: 'Special Duty Allowance',
  amount: 50000,
  reason: 'Served on election tribunal - initially omitted from payroll',
  is_taxable: true,
}, userId, userEmail);

// 3. Recalculate payroll line totals
await payrollAdjustmentAPI.recalculatePayrollLine(lineId);
```

---

## Automatic Lifecycle Management

### One-Time Allowances/Deductions

1. **Before Application**:
   - status: 'active'
   - applied_months: []

2. **After Payroll Generation**:
   - status: 'expired'
   - applied_months: ['2024-12']

3. **Future Payroll Runs**:
   - Skipped (status = 'expired')

### Recurring Allowances/Deductions

1. **Within Date Range**:
   - status: 'active'
   - applied_months: ['2024-12', '2025-01', '2025-02', ...]

2. **After Effective_To Date**:
   - status: 'expired'
   - applied_months: ['2024-12', ..., '2025-05']

3. **Future Payroll Runs**:
   - Skipped (status = 'expired' or outside date range)

---

## Validation Rules

### Staff Allowances
- ✅ `effective_from` must be valid YYYY-MM format
- ✅ `effective_to` must be >= `effective_from` (if provided)
- ✅ Must specify either `amount` (for fixed) or `percentage` (for percentage)
- ✅ Cannot create duplicate active allowance with same code for same staff in same period
- ✅ One-time allowances must have `effective_from` = `effective_to`

### Staff Deductions
- ✅ Same validation as allowances
- ✅ Deduction amount cannot exceed staff's gross pay
- ✅ Total deductions cannot exceed 100% of gross pay

### Payroll Adjustments
- ✅ Can only adjust payroll in 'draft' status
- ✅ Must provide reason (mandatory)
- ✅ Adjustment causes recalculation of tax (if taxable)
- ✅ Audit trail logged for every adjustment

---

## Audit Trail

Every operation is logged:

```typescript
// Creating staff allowance
AUDIT: CREATE | staff_allowance | allowance-uuid | User: payroll@jsc.gov.ng
Old: null
New: { allowance_code: 'OVT', amount: 75000, staff_id: 'staff-001', ... }

// Applying to payroll
AUDIT: APPLY | staff_allowance | allowance-uuid | User: system
Old: { applied_months: [] }
New: { applied_months: ['2024-12'], status: 'expired' }

// Manual adjustment
AUDIT: ADJUST | payroll_line | line-uuid | User: payroll@jsc.gov.ng
Old: { net_pay: 425000 }
New: { net_pay: 475000, adjustments: [{ amount: 50000, reason: '...' }] }
```

---

## Benefits

### ✅ **Flexibility**
- Handle individual staff circumstances
- Support one-time and recurring patterns
- No need to modify global settings

### ✅ **Accuracy**
- Precise control over who gets what
- Automatic lifecycle management
- Prevents duplicate applications

### ✅ **Transparency**
- Full audit trail
- Mandatory reasons for adjustments
- Track which months items were applied

### ✅ **Compliance**
- Tax implications properly handled
- All items are taxable/non-taxable flagged
- Integration with progressive tax engine

### ✅ **Production-Ready**
- Validated input
- Error handling
- Comprehensive logging
- Full CRUD operations

---

## Next Steps

1. **Review** this documentation
2. **Test** with sample staff and payroll scenarios
3. **Integrate** with existing payroll pages
4. **Add UI** for managing staff-specific items
5. **Train** payroll officers on the new features

---

**Version**: 1.0  
**Last Updated**: December 2024  
**Status**: Production Ready  
**Database Version**: 4
