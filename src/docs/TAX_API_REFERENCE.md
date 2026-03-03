# Tax Engine API Reference

## Table of Contents
1. [Core Functions](#core-functions)
2. [Tax Configuration Management](#tax-configuration-management)
3. [Calculation Examples](#calculation-examples)
4. [Type Definitions](#type-definitions)

---

## Core Functions

### `calculatePAYE(input, config)`

Main function to calculate Nigerian PAYE tax with progressive bands.

**Parameters:**
- `input` (TaxCalculationInput): Input data for tax calculation
- `config` (TaxConfiguration): Tax configuration (optional, uses DEFAULT_TAX_CONFIG if not provided)

**Returns:** `TaxCalculationResult` - Complete tax breakdown

**Example:**
```typescript
import { calculatePAYE } from './lib/tax-engine';

const result = calculatePAYE({
  basic_salary: 150000,
  total_allowances: 112500,
  gross_pay: 262500,
  is_taxable_allowances: 112500,
});

console.log('Monthly PAYE:', result.monthly_tax);
// Output: Monthly PAYE: 31459.17
```

---

### `calculatePayrollTax(basicSalary, allowances, config)`

Simplified function for calculating tax in payroll context.

**Parameters:**
- `basicSalary` (number): Staff basic salary
- `allowances` (Array): Array of allowance objects with `is_taxable` flag
- `config` (TaxConfiguration): Tax configuration (optional)

**Returns:** Object with `monthly_tax` and `tax_details`

**Example:**
```typescript
import { calculatePayrollTax } from './lib/tax-engine';

const { monthly_tax, tax_details } = calculatePayrollTax(
  150000,
  [
    { code: 'HOU', name: 'Housing', amount: 75000, is_taxable: true },
    { code: 'TRA', name: 'Transport', amount: 37500, is_taxable: true },
  ]
);

console.log('Tax to deduct:', monthly_tax);
```

---

### `calculateCRA(annualGrossIncome, config)`

Calculate Consolidated Relief Allowance.

**Parameters:**
- `annualGrossIncome` (number): Annual gross income
- `config` (TaxConfiguration): Tax configuration (optional)

**Returns:** `number` - CRA amount

**Formula:**
```
CRA = MAX(
  (1% of annual gross + ₦200,000),
  (20% of annual gross)
)
```

**Example:**
```typescript
import { calculateCRA } from './lib/tax-engine';

const cra = calculateCRA(3150000);
// Returns: 630000 (20% of 3.15M)
```

---

### `calculateProgressiveTax(taxableIncome, taxBands)`

Apply progressive tax bands to calculate total tax.

**Parameters:**
- `taxableIncome` (number): Annual taxable income
- `taxBands` (Array): Array of tax band objects

**Returns:** Object with `totalTax` and `breakdown` array

**Example:**
```typescript
import { calculateProgressiveTax, NIGERIAN_TAX_BANDS } from './lib/tax-engine';

const { totalTax, breakdown } = calculateProgressiveTax(
  2331000,
  NIGERIAN_TAX_BANDS
);

console.log('Total tax:', totalTax);
// Output: 377510

breakdown.forEach(band => {
  console.log(`Band ${band.band}: ₦${band.tax_in_band.toLocaleString()}`);
});
```

---

### `validateTaxConfig(config)`

Validate tax configuration before saving.

**Parameters:**
- `config` (TaxConfiguration): Tax configuration to validate

**Returns:** Object with `valid` (boolean) and `errors` (string[])

**Example:**
```typescript
import { validateTaxConfig } from './lib/tax-engine';

const config = {
  tax_bands: [
    { min: 0, max: 300000, rate: 7 },
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

const validation = validateTaxConfig(config);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

---

### `generateTaxSummary(taxResult)`

Generate a human-readable tax calculation summary.

**Parameters:**
- `taxResult` (TaxCalculationResult): Tax calculation result

**Returns:** `string` - Formatted summary text

**Example:**
```typescript
import { calculatePAYE, generateTaxSummary } from './lib/tax-engine';

const result = calculatePAYE(input);
const summary = generateTaxSummary(result);

console.log(summary);
/*
PAYE Tax Calculation Summary
================================

Gross Income (Monthly): ₦262,500
Gross Income (Annual): ₦3,150,000

Deductions & Relief:
  Consolidated Relief Allowance: ₦630,000
  Pension (8%): ₦144,000
  NHF (2.5%): ₦45,000
  Total Relief: ₦819,000

Taxable Income (Annual): ₦2,331,000

Tax Calculation (Progressive Bands):
  Band 1: ₦300,000 × 7% = ₦21,000
  Band 2: ₦300,000 × 11% = ₦33,000
  Band 3: ₦500,000 × 15% = ₦75,000
  Band 4: ₦500,000 × 19% = ₦95,000
  Band 5: ₦731,000 × 21% = ₦153,510

Total Annual Tax: ₦377,510
Monthly Tax (PAYE): ₦31,459
Effective Tax Rate: 11.98%
Calculation Method: PROGRESSIVE
*/
```

---

## Tax Configuration Management

### Get Tax Configuration

```typescript
import { settingsAPI } from './lib/api-client';

const taxConfig = await settingsAPI.getTaxConfiguration();
console.log(taxConfig);
```

**Response:**
```json
{
  "tax_bands": [
    { "min": 0, "max": 300000, "rate": 7 },
    { "min": 300000, "max": 600000, "rate": 11 },
    { "min": 600000, "max": 1100000, "rate": 15 },
    { "min": 1100000, "max": 1600000, "rate": 19 },
    { "min": 1600000, "max": 3200000, "rate": 21 },
    { "min": 3200000, "max": null, "rate": 24 }
  ],
  "cra_rate_1": 1,
  "cra_fixed_amount": 200000,
  "cra_rate_2": 20,
  "minimum_tax_rate": 0.5,
  "nhf_rate": 2.5,
  "pension_rate": 8,
  "use_annual_calculation": true
}
```

---

### Update Tax Configuration

```typescript
import { settingsAPI } from './lib/api-client';
import { useAuth } from './contexts/AuthContext';

const { user } = useAuth();

const newConfig = {
  tax_bands: [
    { min: 0, max: 300000, rate: 7 },
    { min: 300000, max: 600000, rate: 11 },
    { min: 600000, max: 1100000, rate: 15 },
    { min: 1100000, max: 1600000, rate: 19 },
    { min: 1600000, max: 3200000, rate: 21 },
    { min: 3200000, max: Infinity, rate: 24 },
  ],
  cra_rate_1: 1,
  cra_fixed_amount: 200000,
  cra_rate_2: 20,
  minimum_tax_rate: 0.5,
  nhf_rate: 2.5,
  pension_rate: 8,
  use_annual_calculation: true,
};

try {
  await settingsAPI.updateTaxConfiguration(
    newConfig,
    user.id,
    user.email
  );
  console.log('Tax configuration updated successfully');
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

---

## Calculation Examples

### Example 1: Junior Staff (GL7 Step 5)

**Input:**
- Basic Salary: ₦174,180/month
- Housing Allowance (50%): ₦87,090
- Transport Allowance (25%): ₦43,545
- **Gross Pay**: ₦304,815/month

**Calculation:**
```typescript
const result = calculatePAYE({
  basic_salary: 174180,
  total_allowances: 130635,
  gross_pay: 304815,
  is_taxable_allowances: 130635,
});

console.log(result);
```

**Result:**
- Annual Gross: ₦3,657,780
- CRA: ₦731,556
- Annual Pension: ₦167,053
- Annual NHF: ₦52,204
- Taxable Income: ₦2,706,967
- Annual Tax: ₦429,362
- **Monthly PAYE**: ₦35,780

---

### Example 2: Senior Staff (GL14 Step 8)

**Input:**
- Basic Salary: ₦714,660/month
- Housing Allowance (50%): ₦357,330
- Transport Allowance (25%): ₦178,665
- **Gross Pay**: ₦1,250,655/month

**Calculation:**
```typescript
const result = calculatePAYE({
  basic_salary: 714660,
  total_allowances: 535995,
  gross_pay: 1250655,
  is_taxable_allowances: 535995,
});
```

**Result:**
- Annual Gross: ₦15,007,860
- CRA: ₦3,001,572
- Annual Pension: ₦686,870
- Annual NHF: ₦214,648
- Taxable Income: ₦11,104,770
- Annual Tax: ₦2,426,002
- **Monthly PAYE**: ₦202,167

---

### Example 3: Director Level (GL17 Step 10)

**Input:**
- Basic Salary: ₦1,351,630/month
- Housing Allowance (50%): ₦675,815
- Transport Allowance (25%): ₦337,908
- **Gross Pay**: ₦2,365,353/month

**Calculation:**
```typescript
const result = calculatePAYE({
  basic_salary: 1351630,
  total_allowances: 1013723,
  gross_pay: 2365353,
  is_taxable_allowances: 1013723,
});
```

**Result:**
- Annual Gross: ₦28,384,236
- CRA: ₦5,676,847
- Annual Pension: ₦1,297,562
- Annual NHF: ₦405,489
- Taxable Income: ₦21,004,338
- Annual Tax: ₦4,852,042
- **Monthly PAYE**: ₦404,337

---

## Type Definitions

### TaxConfiguration

```typescript
interface TaxConfiguration {
  tax_bands: { min: number; max: number; rate: number }[];
  cra_rate_1: number;           // 1% of gross
  cra_fixed_amount: number;     // ₦200,000
  cra_rate_2: number;           // 20% of gross
  minimum_tax_rate: number;     // 0.5%
  nhf_rate: number;             // 2.5%
  pension_rate: number;         // 8%
  use_annual_calculation: boolean;
}
```

### TaxCalculationInput

```typescript
interface TaxCalculationInput {
  basic_salary: number;
  total_allowances: number;
  gross_pay: number;
  pension_amount?: number;
  nhf_amount?: number;
  nhis_amount?: number;
  is_taxable_allowances: number;
}
```

### TaxCalculationResult

```typescript
interface TaxCalculationResult {
  gross_income: number;
  annual_gross: number;
  cra_amount: number;
  pension_deduction: number;
  nhf_deduction: number;
  total_relief: number;
  taxable_income: number;
  annual_taxable_income: number;
  tax_breakdown: {
    band: number;
    min: number;
    max: number;
    rate: number;
    taxable_in_band: number;
    tax_in_band: number;
  }[];
  total_annual_tax: number;
  monthly_tax: number;
  effective_tax_rate: number;
  calculation_method: 'progressive' | 'minimum';
}
```

---

## Error Handling

```typescript
try {
  const result = calculatePAYE(input);
  console.log('Tax calculated successfully:', result.monthly_tax);
} catch (error) {
  console.error('Tax calculation failed:', error.message);
}

// Validation errors
try {
  await settingsAPI.updateTaxConfiguration(invalidConfig, userId, userEmail);
} catch (error) {
  // Error: Invalid tax configuration: Tax band 2 min (500000) should equal previous band max (300000)
}
```

---

## Best Practices

1. **Always use `calculatePayrollTax()`** in payroll generation
2. **Validate configurations** before applying changes
3. **Store tax_details** in PayrollLine for audit purposes
4. **Use annual calculation** (recommended by FIRS)
5. **Update tax bands annually** as per FIRS guidelines
6. **Test with edge cases** (minimum wage, very high earners)
7. **Log all tax configuration changes** via audit trail

---

## Integration with Payroll

Tax is automatically calculated during payroll generation:

```typescript
// In payrollAPI.generatePayrollLines()
const { calculatePayrollTax } = await import('./tax-engine');
const taxConfig = settings?.tax_configuration || DEFAULT_TAX_CONFIG;

for (const staff of activeStaff) {
  // ... calculate basic, allowances
  
  const { monthly_tax, tax_details } = calculatePayrollTax(
    basicSalary,
    staffAllowances,
    taxConfig
  );
  
  // Add PAYE as deduction
  staffDeductions.push({
    code: 'TAX',
    name: 'PAYE (Progressive)',
    amount: monthly_tax,
  });
  
  // Store detailed breakdown
  payrollLine.tax_details = tax_details;
}
```

---

**Version**: 1.0  
**Last Updated**: December 2024  
**Maintained By**: JSC-PMS Development Team
