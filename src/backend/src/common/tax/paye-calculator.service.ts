import { BadRequestException, Injectable, Logger } from '@nestjs/common';

export interface PayeCalculation {
  taxable_income: number;
  annual_taxable_income: number;
  total_reliefs: number;
  taxable_income_after_reliefs: number;
  annual_tax: number;
  monthly_tax: number;
  tax_breakdown: Array<{
    bracket: string;
    rate: number;
    taxable_amount: number;
    tax: number;
  }>;
}

@Injectable()
export class PayeCalculatorService {
  private readonly logger = new Logger(PayeCalculatorService.name);

  private round2(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  calculate(
    grossPay: number,
    allowances: any[],
    taxConfig: any,
    isContractStaff = false,
    pensionDeduction = 0,
    nhfDeduction = 0,
    nhisDeduction = 0,
  ): PayeCalculation {
    const nonTaxableAllowances = (allowances || [])
      .filter((allowance) => !allowance.is_taxable)
      .reduce((sum, allowance) => sum + allowance.amount, 0);
    const monthlyTaxableIncome = isContractStaff ? grossPay : grossPay - nonTaxableAllowances;
    const safeMonthlyTaxableIncome = Math.max(0, monthlyTaxableIncome);
    const annualTaxableIncome = this.round2(safeMonthlyTaxableIncome * 12);

    let pensionRelief = 0;
    let nhfRelief = 0;
    let nhisRelief = 0;
    let rentRelief = 0;
    let grossIncomeRelief = 0;

    if (!isContractStaff) {
      pensionRelief = this.round2(pensionDeduction * 12);
      nhfRelief = this.round2(nhfDeduction * 12);
      const nhisReliefEnabled =
        taxConfig?.include_nhis_relief ??
        taxConfig?.apply_nhis_relief ??
        taxConfig?.nhis_relief_enabled ??
        taxConfig?.nhia_relief_enabled ??
        true;
      nhisRelief = nhisReliefEnabled ? this.round2(nhisDeduction * 12) : 0;
      const housingAllowance = (allowances || []).find(
        (allowance) => allowance.code === 'HOUSING' || String(allowance.name || '').toLowerCase().includes('housing'),
      )?.amount || 0;
      rentRelief = this.round2(
        (housingAllowance * 12 * (taxConfig?.rent_relief_percentage || 0)) / 100,
      );
      grossIncomeRelief = this.round2(
        (annualTaxableIncome * (taxConfig?.gross_income_relief_percentage || 0)) / 100,
      );
    }

    const totalReliefs = this.round2(grossIncomeRelief + pensionRelief + nhfRelief + nhisRelief + rentRelief);
    const taxableIncomeAfterReliefs = Math.max(0, this.round2(annualTaxableIncome - totalReliefs));
    const taxBrackets = Array.isArray(taxConfig?.tax_brackets) ? taxConfig.tax_brackets : [];

    if (taxBrackets.length === 0) {
      this.logger.error('Tax brackets configuration missing or invalid');
      throw new BadRequestException('System tax configuration is missing or invalid. Please contact administrator.');
    }

    const normalizedBrackets = taxBrackets.map((bracket: any) => {
      const limit = typeof bracket.limit === 'number'
        ? bracket.limit
        : typeof bracket.max === 'number'
          ? bracket.max
          : typeof bracket.upper_limit === 'number'
            ? bracket.upper_limit
            : null;
      return {
        limit,
        rate: Number(bracket.rate) || 0,
      };
    });
    const orderedBrackets = [...normalizedBrackets].sort((a, b) =>
      (a.limit ?? Number.POSITIVE_INFINITY) - (b.limit ?? Number.POSITIVE_INFINITY),
    );

    let annualTax = 0;
    let remainingIncome = taxableIncomeAfterReliefs;
    let consumedIncome = 0;
    const taxBreakdown: PayeCalculation['tax_breakdown'] = [];

    for (const bracket of orderedBrackets) {
      if (remainingIncome <= 0) break;
      const bandLimit = typeof bracket.limit === 'number' ? bracket.limit : null;
      const bandConsumption = Math.min(remainingIncome, bandLimit ?? remainingIncome);
      if (bandConsumption <= 0) continue;
      const taxForBracket = this.round2((bandConsumption * bracket.rate) / 100);
      annualTax = this.round2(annualTax + taxForBracket);
      const breakdownStart = this.round2(consumedIncome);
      const breakdownEnd = bandLimit !== null ? this.round2(consumedIncome + bandConsumption) : null;
      taxBreakdown.push({
        bracket: breakdownEnd !== null
          ? `${breakdownStart.toLocaleString()} - ${breakdownEnd.toLocaleString()}`
          : `${breakdownStart.toLocaleString()} - above`,
        rate: bracket.rate,
        taxable_amount: this.round2(bandConsumption),
        tax: taxForBracket,
      });
      remainingIncome = this.round2(remainingIncome - bandConsumption);
      consumedIncome = this.round2(consumedIncome + bandConsumption);
    }

    return {
      taxable_income: this.round2(safeMonthlyTaxableIncome),
      annual_taxable_income: annualTaxableIncome,
      total_reliefs: totalReliefs,
      taxable_income_after_reliefs: taxableIncomeAfterReliefs,
      annual_tax: annualTax,
      monthly_tax: this.round2(annualTax / 12),
      tax_breakdown: taxBreakdown,
    };
  }
}
