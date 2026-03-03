/**
 * Nigerian PAYE Tax Calculation Engine
 * Implements progressive tax bands, CRA, and tax relief as per Nigerian tax laws
 * 
 * Reference: Personal Income Tax Act (PITA) - Federal Inland Revenue Service (FIRS)
 */

// Nigerian PAYE Tax Bands (Annual rates)
export const NIGERIAN_TAX_BANDS = [
  { min: 0, max: 300000, rate: 7 },           // First ₦300,000 at 7%
  { min: 300000, max: 600000, rate: 11 },     // Next ₦300,000 at 11%
  { min: 600000, max: 1100000, rate: 15 },    // Next ₦500,000 at 15%
  { min: 1100000, max: 1600000, rate: 19 },   // Next ₦500,000 at 19%
  { min: 1600000, max: 3200000, rate: 21 },   // Next ₦1,600,000 at 21%
  { min: 3200000, max: Infinity, rate: 24 },  // Above ₦3,200,000 at 24%
];

export interface TaxConfiguration {
  tax_bands: { min: number; max: number; rate: number }[];
  cra_rate_1: number;           // 1% of gross
  cra_fixed_amount: number;     // ₦200,000
  cra_rate_2: number;           // 20% of gross
  minimum_tax_rate: number;     // Minimum tax (0.5% of gross for companies, 1% for individuals)
  nhf_rate: number;             // National Housing Fund rate (2.5%)
  pension_rate: number;         // Pension contribution rate (8%)
  use_annual_calculation: boolean; // Use annual tax calculation vs monthly
}

export const DEFAULT_TAX_CONFIG: TaxConfiguration = {
  tax_bands: NIGERIAN_TAX_BANDS,
  cra_rate_1: 1,                // 1% of gross income
  cra_fixed_amount: 200000,     // ₦200,000 fixed amount
  cra_rate_2: 20,               // 20% of gross income
  minimum_tax_rate: 0.5,        // 0.5% minimum tax
  nhf_rate: 2.5,                // 2.5% NHF
  pension_rate: 8,              // 8% pension
  use_annual_calculation: true, // Calculate on annual basis then divide by 12
};

export interface TaxCalculationInput {
  basic_salary: number;
  total_allowances: number;
  gross_pay: number;
  pension_amount?: number;      // If already calculated
  nhf_amount?: number;          // If already calculated
  nhis_amount?: number;         // If already calculated
  is_taxable_allowances: number; // Sum of taxable allowances only
}

export interface TaxCalculationResult {
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

/**
 * Calculate Consolidated Relief Allowance (CRA)
 * CRA = Higher of:
 * 1. (1% of gross income) + ₦200,000, OR
 * 2. 20% of gross income
 */
export function calculateCRA(annualGrossIncome: number, config: TaxConfiguration = DEFAULT_TAX_CONFIG): number {
  const option1 = (annualGrossIncome * config.cra_rate_1 / 100) + config.cra_fixed_amount;
  const option2 = annualGrossIncome * config.cra_rate_2 / 100;
  
  return Math.max(option1, option2);
}

/**
 * Calculate progressive tax based on tax bands
 */
export function calculateProgressiveTax(
  taxableIncome: number,
  taxBands: { min: number; max: number; rate: number }[]
): { totalTax: number; breakdown: any[] } {
  let totalTax = 0;
  const breakdown: any[] = [];

  for (const band of taxBands) {
    if (taxableIncome <= band.min) {
      break; // No income in this band
    }

    const taxableInBand = Math.min(taxableIncome, band.max) - band.min;
    const taxInBand = taxableInBand * (band.rate / 100);
    
    totalTax += taxInBand;
    
    breakdown.push({
      band: breakdown.length + 1,
      min: band.min,
      max: band.max === Infinity ? Infinity : band.max,
      rate: band.rate,
      taxable_in_band: taxableInBand,
      tax_in_band: taxInBand,
    });

    if (taxableIncome <= band.max) {
      break; // No more income to tax
    }
  }

  return { totalTax, breakdown };
}

/**
 * Main PAYE Tax Calculation Function
 * Implements full Nigerian PAYE calculation with progressive bands
 */
export function calculatePAYE(
  input: TaxCalculationInput,
  config: TaxConfiguration = DEFAULT_TAX_CONFIG
): TaxCalculationResult {
  // Step 1: Calculate annual gross income
  const monthlyGrossIncome = input.gross_pay;
  const annualGrossIncome = monthlyGrossIncome * 12;

  // Step 2: Calculate statutory deductions (pre-tax)
  // Pension: 8% of basic + transport + housing (if not already calculated)
  const pensionBase = input.basic_salary; // Simplified: use basic salary as pension base
  const pensionDeduction = input.pension_amount ?? (pensionBase * config.pension_rate / 100);
  const annualPension = pensionDeduction * 12;

  // NHF: 2.5% of basic salary (if not already calculated)
  const nhfDeduction = input.nhf_amount ?? (input.basic_salary * config.nhf_rate / 100);
  const annualNHF = nhfDeduction * 12;

  // NHIS: If provided
  const nhisDeduction = input.nhis_amount ?? 0;
  const annualNHIS = nhisDeduction * 12;

  // Step 3: Calculate Consolidated Relief Allowance (CRA)
  const craAmount = calculateCRA(annualGrossIncome, config);

  // Step 4: Calculate total relief/deductions
  const totalAnnualRelief = craAmount + annualPension + annualNHF + annualNHIS;

  // Step 5: Calculate taxable income
  const annualTaxableIncome = Math.max(0, annualGrossIncome - totalAnnualRelief);

  // Step 6: Calculate progressive tax
  const { totalTax, breakdown } = calculateProgressiveTax(annualTaxableIncome, config.tax_bands);

  // Step 7: Calculate minimum tax (alternative calculation)
  const minimumTax = annualGrossIncome * (config.minimum_tax_rate / 100);

  // Step 8: Use higher of progressive tax or minimum tax
  const finalAnnualTax = Math.max(totalTax, minimumTax);
  const calculationMethod = finalAnnualTax === minimumTax ? 'minimum' : 'progressive';

  // Step 9: Calculate monthly tax
  const monthlyTax = finalAnnualTax / 12;

  // Step 10: Calculate effective tax rate
  const effectiveTaxRate = annualGrossIncome > 0 ? (finalAnnualTax / annualGrossIncome) * 100 : 0;

  return {
    gross_income: monthlyGrossIncome,
    annual_gross: annualGrossIncome,
    cra_amount: craAmount,
    pension_deduction: pensionDeduction,
    nhf_deduction: nhfDeduction,
    total_relief: totalAnnualRelief,
    taxable_income: annualTaxableIncome / 12, // Monthly equivalent
    annual_taxable_income: annualTaxableIncome,
    tax_breakdown: breakdown,
    total_annual_tax: finalAnnualTax,
    monthly_tax: monthlyTax,
    effective_tax_rate: effectiveTaxRate,
    calculation_method: calculationMethod,
  };
}

/**
 * Calculate tax for payroll line item
 * Returns the monthly PAYE tax amount
 */
export function calculatePayrollTax(
  basicSalary: number,
  allowances: { code: string; name: string; amount: number; is_taxable?: boolean }[],
  config: TaxConfiguration = DEFAULT_TAX_CONFIG
): {
  monthly_tax: number;
  tax_details: TaxCalculationResult;
} {
  // Calculate gross pay
  const totalAllowances = allowances.reduce((sum, a) => sum + a.amount, 0);
  const grossPay = basicSalary + totalAllowances;

  // Calculate taxable allowances only
  const taxableAllowances = allowances
    .filter(a => a.is_taxable !== false) // Default to taxable if not specified
    .reduce((sum, a) => sum + a.amount, 0);

  // Prepare input for tax calculation
  const input: TaxCalculationInput = {
    basic_salary: basicSalary,
    total_allowances: totalAllowances,
    gross_pay: grossPay,
    is_taxable_allowances: taxableAllowances,
  };

  // Calculate PAYE
  const taxDetails = calculatePAYE(input, config);

  return {
    monthly_tax: taxDetails.monthly_tax,
    tax_details: taxDetails,
  };
}

/**
 * Validate tax configuration
 */
export function validateTaxConfig(config: TaxConfiguration): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate tax bands
  if (!config.tax_bands || config.tax_bands.length === 0) {
    errors.push('Tax bands must be defined');
  } else {
    // Check that bands are in ascending order
    for (let i = 1; i < config.tax_bands.length; i++) {
      if (config.tax_bands[i].min !== config.tax_bands[i - 1].max) {
        errors.push(`Tax band ${i + 1} min (${config.tax_bands[i].min}) should equal previous band max (${config.tax_bands[i - 1].max})`);
      }
    }
  }

  // Validate rates
  if (config.pension_rate < 0 || config.pension_rate > 100) {
    errors.push('Pension rate must be between 0 and 100');
  }

  if (config.nhf_rate < 0 || config.nhf_rate > 100) {
    errors.push('NHF rate must be between 0 and 100');
  }

  if (config.cra_rate_1 < 0 || config.cra_rate_1 > 100) {
    errors.push('CRA rate 1 must be between 0 and 100');
  }

  if (config.cra_rate_2 < 0 || config.cra_rate_2 > 100) {
    errors.push('CRA rate 2 must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get tax band description for display
 */
export function getTaxBandDescription(band: { min: number; max: number; rate: number }): string {
  if (band.max === Infinity) {
    return `Above ₦${band.min.toLocaleString()} at ${band.rate}%`;
  }
  return `₦${band.min.toLocaleString()} - ₦${band.max.toLocaleString()} at ${band.rate}%`;
}

/**
 * Export tax calculation summary for reporting
 */
export function generateTaxSummary(taxResult: TaxCalculationResult): string {
  let summary = `PAYE Tax Calculation Summary\n`;
  summary += `================================\n\n`;
  summary += `Gross Income (Monthly): ₦${taxResult.gross_income.toLocaleString()}\n`;
  summary += `Gross Income (Annual): ₦${taxResult.annual_gross.toLocaleString()}\n\n`;
  summary += `Deductions & Relief:\n`;
  summary += `  Consolidated Relief Allowance: ₦${taxResult.cra_amount.toLocaleString()}\n`;
  summary += `  Pension (8%): ₦${(taxResult.pension_deduction * 12).toLocaleString()}\n`;
  summary += `  NHF (2.5%): ₦${(taxResult.nhf_deduction * 12).toLocaleString()}\n`;
  summary += `  Total Relief: ₦${taxResult.total_relief.toLocaleString()}\n\n`;
  summary += `Taxable Income (Annual): ₦${taxResult.annual_taxable_income.toLocaleString()}\n\n`;
  summary += `Tax Calculation (Progressive Bands):\n`;
  
  taxResult.tax_breakdown.forEach(band => {
    if (band.taxable_in_band > 0) {
      summary += `  Band ${band.band}: ₦${band.taxable_in_band.toLocaleString()} × ${band.rate}% = ₦${band.tax_in_band.toLocaleString()}\n`;
    }
  });
  
  summary += `\nTotal Annual Tax: ₦${taxResult.total_annual_tax.toLocaleString()}\n`;
  summary += `Monthly Tax (PAYE): ₦${taxResult.monthly_tax.toLocaleString()}\n`;
  summary += `Effective Tax Rate: ${taxResult.effective_tax_rate.toFixed(2)}%\n`;
  summary += `Calculation Method: ${taxResult.calculation_method.toUpperCase()}\n`;

  return summary;
}
