# Promotion Proration System - Complete Guide

## Overview

The JSC Payroll Management System now includes comprehensive **mid-month promotion proration** that automatically calculates split-period salaries when staff members are promoted during a payroll month.

This system works harmoniously with existing **mid-month resumption** and **mid-month exit** proration, handling all edge cases including staff who join, get promoted, and/or exit all in the same month.

---

## How It Works

### Basic Concept

When a staff member is promoted mid-month (e.g., from GL7/Step3 to GL8/Step3 on June 15th), their salary for that month is calculated as:

- **Period 1**: Days worked *before* promotion date at *old* salary rate
- **Period 2**: Days worked *from* promotion date onwards at *new* salary rate
- **Total Salary**: Period 1 Amount + Period 2 Amount

### Example Calculation

**Scenario**: Staff promoted on June 15, 2025

- **Old Grade**: GL7/Step3 - ₦150,000/month
- **New Grade**: GL8/Step3 - ₦180,000/month
- **Working Days in June**: 22 days (excluding weekends)

**Calculation**:
```
Period 1: June 1-14 (10 working days)
  = (10/22) × ₦150,000 = ₦68,182

Period 2: June 15-30 (12 working days)
  = (12/22) × ₦180,000 = ₦98,182

Total June Salary = ₦68,182 + ₦98,182 = ₦166,364
```

---

## Database Schema

### Staff Table Fields

```sql
-- Promotion tracking fields
promotion_date          DATE              -- Effective date of promotion
previous_grade_level    INTEGER           -- Grade level before promotion
previous_step           INTEGER           -- Step before promotion
previous_basic_salary   NUMERIC(12, 2)    -- Basic salary before promotion
```

### Promotion History Table

Automatically maintains audit trail of all promotions:

```sql
CREATE TABLE promotion_history (
  id                  UUID PRIMARY KEY,
  staff_id            UUID REFERENCES staff(id),
  promotion_date      DATE NOT NULL,
  from_grade_level    INTEGER NOT NULL,
  from_step           INTEGER NOT NULL,
  from_basic_salary   NUMERIC(12, 2) NOT NULL,
  to_grade_level      INTEGER NOT NULL,
  to_step             INTEGER NOT NULL,
  to_basic_salary     NUMERIC(12, 2) NOT NULL,
  promotion_type      VARCHAR(50),  -- 'regular', 'acting', 'conversion', 'accelerated'
  remarks             TEXT,
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  created_by          UUID REFERENCES users(id)
);
```

---

## Harmonious Integration with Other Proration Types

The system intelligently handles **combined scenarios**:

### 1. **New Hire + Promotion** (Same Month)
Staff joins mid-month AND gets promoted mid-month

**Example**: Joined June 5, Promoted June 20
```
Period 1: June 5-19 at old salary
Period 2: June 20-30 at new salary
Total: Blended calculation
```

### 2. **Promotion + Exit** (Same Month)
Staff promoted mid-month AND exits mid-month

**Example**: Promoted June 10, Exits June 25
```
Period 1: June 1-9 at old salary
Period 2: June 10-25 at new salary
(No payment for June 26-30)
```

### 3. **Join + Promote + Exit** (All Same Month)
Staff joins, gets promoted, and exits all in one month

**Example**: Joined June 5, Promoted June 15, Exits June 25
```
Period 1: June 5-14 at old salary
Period 2: June 15-25 at new salary
Total: Highly prorated
```

---

## Proration Calculator Functions

### Core Functions

#### 1. `calculatePromotionSplitPeriod()`
Handles split-period calculation for promotions:

```typescript
calculatePromotionSplitPeriod(
  currentBasicSalary: number,
  payrollMonth: string,
  promotionData: {
    promotion_date: string;
    previous_basic_salary: number;
    previous_grade_level?: number;
    previous_step?: number;
  },
  employmentDate?: string,  // Optional: for new hires
  exitDate?: string          // Optional: for exits
): ProrationResult
```

**Returns**:
- `period1_amount`: Salary for period before promotion
- `period2_amount`: Salary for period after promotion
- `period1_days`: Working days in period 1
- `period2_days`: Working days in period 2
- `prorated_amount`: Total (period1 + period2)
- `calculation_details`: Human-readable breakdown

#### 2. `applyPromotionProrationToSalaryComponents()`
Applies split-period to basic salary AND allowances:

```typescript
applyPromotionProrationToSalaryComponents(
  currentBasicSalary: number,
  currentAllowances: Allowance[],
  previousAllowances: Allowance[],
  payrollMonth: string,
  promotionData: PromotionData,
  employmentDate?: string,
  exitDate?: string
): {
  prorated_basic_salary: number;
  prorated_allowances: Allowance[];
  proration_details: ProrationResult;
}
```

**Key Feature**: Allowances are also split-period calculated:
- If allowance existed before promotion → use old amount for period 1
- If new allowance added during promotion → use current amount
- Each allowance prorated independently

---

## Backend API

### Promote Staff Endpoint

**POST** `/api/staff/:id/promote`

**Request Body**:
```json
{
  "promotionDate": "2025-06-15",
  "newGradeLevel": 8,
  "newStep": 3,
  "newBasicSalary": 180000,
  "promotionType": "regular",
  "remarks": "Annual promotion based on performance review"
}
```

**Process**:
1. Validates promotion data
2. Stores current grade/salary in `previous_*` fields
3. Updates to new grade/salary
4. Sets `promotion_date`
5. Auto-creates entry in `promotion_history` table (via trigger)

**Response**:
```json
{
  "success": true,
  "message": "Staff promoted successfully",
  "data": {
    "staffId": "uuid",
    "promotionDate": "2025-06-15",
    "fromGrade": "GL7/Step3",
    "toGrade": "GL8/Step3",
    "salaryIncrease": 30000
  }
}
```

---

## Frontend Components

### 1. PromoteStaffModal Component

**Usage**:
```tsx
import { PromoteStaffModal } from './components/PromoteStaffModal';

<PromoteStaffModal
  isOpen={showPromotionModal}
  onClose={() => setShowPromotionModal(false)}
  staff={selectedStaff}
  currentBasicSalary={selectedStaff.currentBasicSalary}
  onPromote={handlePromoteStaff}
/>
```

**Features**:
- Pre-fills with suggested grade (current + 1)
- Shows before/after comparison
- Calculates salary increase percentage
- Displays proration notice if mid-month
- Supports different promotion types (regular, acting, conversion, accelerated)

### 2. ProrationBreakdown Component

**Usage**:
```tsx
import { ProrationBreakdown } from './components/ProrationBreakdown';

<ProrationBreakdown proration={prorationDetails} />
```

**Features**:
- Visual split-period display for promotions
- Shows Period 1 (old salary) and Period 2 (new salary)
- Displays working days breakdown
- Color-coded badges for proration reasons
- Detailed calculation explanation

---

## Payroll Generation Integration

### Process Flow

When generating payroll for a month:

```typescript
// 1. Check if staff has promotion in this month
const hasPromotion = staff.promotion_date && 
  isInMonth(staff.promotion_date, payrollMonth);

// 2. If promoted, use split-period calculation
if (hasPromotion) {
  const promotionData = {
    promotion_date: staff.promotion_date,
    previous_basic_salary: staff.previous_basic_salary,
    previous_grade_level: staff.previous_grade_level,
    previous_step: staff.previous_step,
  };

  // Calculate split-period for basic salary
  const result = calculatePromotionSplitPeriod(
    staff.current_basic_salary,
    payrollMonth,
    promotionData,
    staff.employment_date,  // May also be mid-month
    staff.exit_date         // May also be mid-month
  );

  // Apply to allowances (with previous allowance amounts)
  const { prorated_basic_salary, prorated_allowances, proration_details } = 
    applyPromotionProrationToSalaryComponents(
      staff.current_basic_salary,
      staff.currentAllowances,
      staff.previousAllowances,
      payrollMonth,
      promotionData,
      staff.employment_date,
      staff.exit_date
    );
}
```

### Visual Indicators

**In Payroll Lists**:
```tsx
{proration_details.promotion_date && (
  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">
    Promotion (Prorated)
  </span>
)}
```

**In Payslips**:
- Full breakdown showing Period 1 and Period 2
- Visual timeline of salary changes
- Detailed calculation steps

---

## Edge Cases Handled

### ✅ 1. Promotion on 1st of Month
- No proration needed
- Full month at new salary
- System detects: promotion_date == month start → no split

### ✅ 2. Promotion on Last Day of Month
- Almost full month at old salary
- One day at new salary
- Both periods calculated correctly

### ✅ 3. Multiple Promotions in Different Months
- `promotion_date` only affects current month
- Previous months use old salary
- Future months use new salary
- History table maintains full audit trail

### ✅ 4. Promotion Date Outside Payroll Month
- System ignores promotion_date if not in current month
- Uses regular proration (if any)
- No split-period calculation

### ✅ 5. Retroactive Promotions
- Can set promotion_date in past months
- Arrears module will detect salary difference
- Back-pay automatically calculated

### ✅ 6. Allowance Changes During Promotion
- Tracks both `previousAllowances` and `currentAllowances`
- Each allowance prorated independently
- Handles new allowances added during promotion
- Handles allowances removed during promotion

---

## Testing Scenarios

### Test Case 1: Standard Mid-Month Promotion
```
Staff: John Doe (GL7/Step3)
Promotion Date: June 15, 2025
New Grade: GL8/Step3
Old Salary: ₦150,000
New Salary: ₦180,000
Working Days: 22
Expected: ₦166,364 (split-period)
```

### Test Case 2: New Hire + Promotion
```
Staff: Jane Smith
Join Date: June 5, 2025
Promotion Date: June 20, 2025
Period 1: June 5-19 at ₦120,000
Period 2: June 20-30 at ₦150,000
Expected: Blended calculation
```

### Test Case 3: Promotion + Exit
```
Staff: Bob Johnson
Promotion Date: June 10, 2025
Exit Date: June 25, 2025
Period 1: June 1-9 at old salary
Period 2: June 10-25 at new salary
Expected: No pay for June 26-30
```

---

## Reports Integration

### Payroll Summary Report
- Shows promotion proration separately
- Column: "Split-Period Adjustments"
- Detailed breakdown available

### Staff Salary History Report
- Tracks all promotions with dates
- Shows salary progression over time
- Highlights mid-month promotions

### Proration Report
- Lists all prorated staff
- Categorizes by reason (new hire, exit, promotion, combined)
- Shows calculation breakdown

---

## Validation Rules

### When Recording Promotion

1. ✅ Promotion date must be valid date
2. ✅ New grade level must be higher than current (for regular promotions)
3. ✅ New basic salary must be positive
4. ✅ Cannot promote staff with exit_date in the past
5. ✅ Cannot have multiple active promotions in same month
6. ✅ Previous salary data must be stored before updating

### During Payroll Generation

1. ✅ Check promotion_date is within payroll month
2. ✅ Verify previous_basic_salary exists
3. ✅ Ensure working days calculation is correct
4. ✅ Validate period1 + period2 days = total days worked

---

## Clearing Promotion Data

After the promotion month has passed, the system can optionally clear the `promotion_date` and `previous_*` fields to avoid confusion in future months.

**Recommended Approach**:
- Keep data for current month + 3 months (for arrears calculation)
- Archive to `promotion_history` table (already done automatically)
- Clear fields after successful payroll completion

---

## Migration Scripts

### Running the Migration

```bash
# Apply the promotion fields migration
psql -U postgres -d jsc_payroll -f /backend/migrations/007_add_promotion_proration_fields.sql
```

### Rollback (if needed)

```sql
-- Remove promotion tracking fields
ALTER TABLE staff 
DROP COLUMN IF EXISTS promotion_date,
DROP COLUMN IF EXISTS previous_grade_level,
DROP COLUMN IF EXISTS previous_step,
DROP COLUMN IF EXISTS previous_basic_salary;

-- Drop promotion history table
DROP TABLE IF EXISTS promotion_history;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS promotion_history_trigger ON staff;
DROP FUNCTION IF EXISTS archive_promotion_to_history();
```

---

## Summary

The **Promotion Proration System** provides:

✅ **Automatic split-period salary calculation** for mid-month promotions  
✅ **Harmonious integration** with resumption and exit proration  
✅ **Full audit trail** via promotion_history table  
✅ **Visual UI components** for recording and displaying promotions  
✅ **Comprehensive allowance handling** with split periods  
✅ **Edge case coverage** for all combined scenarios  
✅ **Backend API endpoints** for promotion processing  
✅ **Database triggers** for automatic history archiving  

The system ensures **accurate, fair, and transparent** salary calculations for all staff members undergoing promotions, regardless of timing within the month.
