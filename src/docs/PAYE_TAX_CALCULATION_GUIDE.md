# Nigerian PAYE Tax Calculation Guide

## Overview
The JSC Payroll Management System implements **progressive PAYE (Pay As You Earn) tax calculation** in compliance with Nigerian tax laws as specified by the Federal Inland Revenue Service (FIRS) under the Personal Income Tax Act (PITA).

## Tax Engine Location
- **Engine**: `/lib/tax-engine.ts`
- **Integration**: `/lib/api.ts` (payrollAPI.generatePayrollLines)
- **API**: `/lib/api-client.ts` (settingsAPI.getTaxConfiguration, settingsAPI.updateTaxConfiguration)

## Progressive Tax Bands (2024)

| Band | Income Range | Tax Rate |
|------|--------------|----------|
| 1 | ₦0 - ₦300,000 | 7% |
| 2 | ₦300,001 - ₦600,000 | 11% |
| 3 | ₦600,001 - ₦1,100,000 | 15% |
| 4 | ₦1,100,001 - ₦1,600,000 | 19% |
| 5 | ₦1,600,001 - ₦3,200,000 | 21% |
| 6 | Above ₦3,200,000 | 24% |

## Tax Calculation Formula

### Step 1: Calculate Annual Gross Income
```
Annual Gross = Monthly Gross × 12
Monthly Gross = Basic Salary + All Taxable Allowances
```

### Step 2: Calculate Statutory Deductions (Pre-Tax)
- **Pension**: 8% of basic salary (annualized)
- **NHF (National Housing Fund)**: 2.5% of basic salary (annualized)
- **NHIS (if applicable)**: Fixed or percentage amount (annualized)

### Step 3: Calculate Consolidated Relief Allowance (CRA)
```
CRA = MAXIMUM OF:
  Option 1: (1% of Annual Gross) + ₦200,000
  Option 2: 20% of Annual Gross
```

**Example:**
- Annual Gross = ₦1,200,000
- Option 1 = (₦1,200,000 × 1%) + ₦200,000 = ₦212,000
- Option 2 = ₦1,200,000 × 20% = ₦240,000
- **CRA = ₦240,000** (higher of the two)

### Step 4: Calculate Total Relief
```
Total Relief = CRA + Annual Pension + Annual NHF + Annual NHIS
```

### Step 5: Calculate Taxable Income
```
Annual Taxable Income = Annual Gross - Total Relief
```

### Step 6: Apply Progressive Tax Bands
Tax is calculated progressively across bands:

**Example: Annual Taxable Income = ₦1,500,000**

| Band | Range | Taxable Amount | Rate | Tax |
|------|-------|----------------|------|-----|
| 1 | ₦0 - ₦300,000 | ₦300,000 | 7% | ₦21,000 |
| 2 | ₦300,000 - ₦600,000 | ₦300,000 | 11% | ₦33,000 |
| 3 | ₦600,000 - ₦1,100,000 | ₦500,000 | 15% | ₦75,000 |
| 4 | ₦1,100,000 - ₦1,500,000 | ₦400,000 | 19% | ₦76,000 |
| **Total** | | | | **₦205,000** |

### Step 7: Calculate Monthly PAYE
```
Monthly PAYE = Annual Tax ÷ 12
```

**Example:**
```
Annual Tax = ₦205,000
Monthly PAYE = ₦205,000 ÷ 12 = ₦17,083.33
```

## Complete Example

### Staff Profile:
- **Basic Salary**: ₦150,000/month
- **Housing Allowance**: ₦75,000/month (50% of basic, taxable)
- **Transport Allowance**: ₦37,500/month (25% of basic, taxable)
- **Total Gross**: ₦262,500/month

### Calculation:

#### 1. Annual Gross
```
Annual Gross = ₦262,500 × 12 = ₦3,150,000
```

#### 2. Statutory Deductions
```
Annual Pension (8%) = ₦150,000 × 12 × 8% = ₦144,000
Annual NHF (2.5%) = ₦150,000 × 12 × 2.5% = ₦45,000
```

#### 3. CRA Calculation
```
Option 1 = (₦3,150,000 × 1%) + ₦200,000 = ₦231,500
Option 2 = ₦3,150,000 × 20% = ₦630,000
CRA = ₦630,000 (higher)
```

#### 4. Total Relief
```
Total Relief = ₦630,000 + ₦144,000 + ₦45,000 = ₦819,000
```

#### 5. Taxable Income
```
Annual Taxable Income = ₦3,150,000 - ₦819,000 = ₦2,331,000
```

#### 6. Progressive Tax Calculation

| Band | Range | Taxable | Rate | Tax |
|------|-------|---------|------|-----|
| 1 | ₦0 - ₦300,000 | ₦300,000 | 7% | ₦21,000 |
| 2 | ₦300,000 - ₦600,000 | ₦300,000 | 11% | ₦33,000 |
| 3 | ₦600,000 - ₦1,100,000 | ₦500,000 | 15% | ₦75,000 |
| 4 | ₦1,100,000 - ₦1,600,000 | ₦500,000 | 19% | ₦95,000 |
| 5 | ₦1,600,000 - ₦2,331,000 | ₦731,000 | 21% | ₦153,510 |
| **Total** | | | | **₦377,510** |

#### 7. Monthly PAYE
```
Monthly PAYE = ₦377,510 ÷ 12 = ₦31,459.17
```

#### 8. Effective Tax Rate
```
Effective Rate = (₦377,510 ÷ ₦3,150,000) × 100 = 11.98%
```

## API Usage

### Get Tax Configuration
```typescript
import { settingsAPI } from './lib/api-client';

const taxConfig = await settingsAPI.getTaxConfiguration();
console.log(taxConfig);
```

### Update Tax Configuration
```typescript
import { settingsAPI } from './lib/api-client';

const newTaxConfig = {
  tax_bands: [
    { min: 0, max: 300000, rate: 7 },
    { min: 300000, max: 600000, rate: 11 },
    // ... more bands
  ],
  cra_rate_1: 1,
  cra_fixed_amount: 200000,
  cra_rate_2: 20,
  minimum_tax_rate: 0.5,
  nhf_rate: 2.5,
  pension_rate: 8,
  use_annual_calculation: true,
};

await settingsAPI.updateTaxConfiguration(newTaxConfig, userId, userEmail);
```

### Calculate Tax for Individual
```typescript
import { calculatePAYE } from './lib/tax-engine';

const input = {
  basic_salary: 150000,
  total_allowances: 112500,
  gross_pay: 262500,
  is_taxable_allowances: 112500,
};

const taxResult = calculatePAYE(input);
console.log('Monthly PAYE:', taxResult.monthly_tax);
console.log('Annual Tax:', taxResult.total_annual_tax);
console.log('Effective Rate:', taxResult.effective_tax_rate);
```

## Minimum Tax Rule

The system also calculates a **minimum tax** (0.5% of annual gross income) and applies the **higher of**:
- Progressive tax calculation, OR
- Minimum tax

This ensures compliance with minimum tax requirements.

## Tax Details in Payroll

When payroll is generated, each staff member's `PayrollLine` includes a `tax_details` object containing:

```typescript
{
  gross_income: number;              // Monthly gross
  annual_gross: number;              // Annual gross
  cra_amount: number;                // Consolidated Relief Allowance
  pension_deduction: number;         // Monthly pension
  nhf_deduction: number;             // Monthly NHF
  total_relief: number;              // Annual total relief
  taxable_income: number;            // Monthly taxable income
  annual_taxable_income: number;     // Annual taxable income
  tax_breakdown: {                   // Band-by-band breakdown
    band: number;
    min: number;
    max: number;
    rate: number;
    taxable_in_band: number;
    tax_in_band: number;
  }[];
  total_annual_tax: number;          // Total annual tax
  monthly_tax: number;               // Monthly PAYE deduction
  effective_tax_rate: number;        // Percentage
  calculation_method: string;        // 'progressive' or 'minimum'
}
```

## Compliance Features

✅ **FIRS Compliant**: Implements official Nigerian tax bands
✅ **Progressive Calculation**: Tax applied incrementally across bands
✅ **CRA Support**: Proper Consolidated Relief Allowance calculation
✅ **Statutory Deductions**: Pension, NHF deducted before tax
✅ **Minimum Tax**: Ensures minimum tax obligation is met
✅ **Audit Trail**: All tax calculations logged with full breakdown
✅ **Configurable**: Tax bands and rates can be updated via API
✅ **Validated**: Input validation prevents configuration errors

## Migration from Flat Tax

### Old System (Deprecated):
```typescript
// Simple flat 7% of gross - NOT COMPLIANT
tax_amount = gross_pay × 7%
```

### New System (Production-Ready):
```typescript
// Progressive bands with CRA and relief - COMPLIANT
tax_amount = calculatePAYE(input).monthly_tax
```

## Testing Tax Calculation

Run payroll generation and inspect the `tax_details` field in any `PayrollLine`:

```typescript
const batch = await payrollAPI.createPayrollBatch('2024-12', userId, userEmail);
await payrollAPI.generatePayrollLines(batch.id, userId, userEmail);
const lines = await payrollAPI.getPayrollLines(batch.id);

console.log('First staff tax details:', lines[0].tax_details);
```

## Production Deployment Notes

1. **Verify Tax Bands**: Confirm current FIRS tax bands before deployment
2. **Test Edge Cases**: Test with minimum wage, maximum earners, and mid-range salaries
3. **Audit Trail**: Review audit logs for all tax configuration changes
4. **Payslip Display**: Ensure tax breakdown is visible on staff payslips
5. **Compliance Report**: Generate monthly tax remittance reports
6. **Annual Review**: Update tax bands annually as per FIRS guidelines

## Support & References

- **Federal Inland Revenue Service (FIRS)**: https://www.firs.gov.ng
- **Personal Income Tax Act (PITA)**: Nigerian Tax Laws
- **Tax Engine**: `/lib/tax-engine.ts`
- **System Settings**: Admin → Settings → Tax Configuration

---

**Last Updated**: December 2024
**Version**: 1.0
**Author**: JSC-PMS Development Team
