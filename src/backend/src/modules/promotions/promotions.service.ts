import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { SalaryLookupService } from '../salary-structures/salary-lookup.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationPriority, NotificationType } from '../notifications/dto/notification.dto';
import { AuditService } from '@modules/audit/audit.service';
import { AuditAction } from '@modules/audit/dto/audit.dto';
import { PayeCalculatorService } from '@common/tax/paye-calculator.service';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);
  private readonly businessTimeZone = 'Africa/Lagos';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly salaryLookupService: SalaryLookupService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly payeCalculator: PayeCalculatorService,
  ) {}

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private getBusinessDateParts(value: any) {
    const rawValue = String(value || '').trim();
    const plainDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const slashIsoMatch = rawValue.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    const slashLocaleMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (plainDateMatch) {
      const year = Number(plainDateMatch[1]);
      const month = Number(plainDateMatch[2]);
      const day = Number(plainDateMatch[3]);
      const validated = new Date(Date.UTC(year, month - 1, day));
      if (
        validated.getUTCFullYear() === year &&
        validated.getUTCMonth() === month - 1 &&
        validated.getUTCDate() === day
      ) {
        return { year, month, day };
      }
      throw new BadRequestException('Invalid promotion effective date');
    }

    if (slashIsoMatch) {
      const year = Number(slashIsoMatch[1]);
      const month = Number(slashIsoMatch[2]);
      const day = Number(slashIsoMatch[3]);
      const validated = new Date(Date.UTC(year, month - 1, day));

      if (
        validated.getUTCFullYear() === year &&
        validated.getUTCMonth() === month - 1 &&
        validated.getUTCDate() === day
      ) {
        return { year, month, day };
      }
    }

    if (slashLocaleMatch) {
      const first = Number(slashLocaleMatch[1]);
      const second = Number(slashLocaleMatch[2]);
      const year = Number(slashLocaleMatch[3]);

      // Browser locale/date picker integrations may hand us slash dates.
      // Prefer the only non-ambiguous interpretation; otherwise default to MM/DD/YYYY.
      const month = second > 12 ? first : second <= 12 && first > 12 ? second : first;
      const day = second > 12 ? second : second <= 12 && first > 12 ? first : second;
      const validated = new Date(Date.UTC(year, month - 1, day));

      if (
        validated.getUTCFullYear() === year &&
        validated.getUTCMonth() === month - 1 &&
        validated.getUTCDate() === day
      ) {
        return { year, month, day };
      }
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid promotion effective date');
    }

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.businessTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(parsedDate);

    return {
      year: Number(parts.find((part) => part.type === 'year')?.value || 0),
      month: Number(parts.find((part) => part.type === 'month')?.value || 0),
      day: Number(parts.find((part) => part.type === 'day')?.value || 0),
    };
  }

  private buildMonthKey(year: number, month: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private canonicalizeBusinessDate(value: any, fallbackDate?: any) {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) {
      throw new BadRequestException('Invalid promotion effective date');
    }

    const pad2 = (val: number) => String(val).padStart(2, '0');

    const fallbackYear = (() => {
      try {
        return this.getBusinessDateParts(fallbackDate ?? new Date()).year;
      } catch {
        return new Date().getFullYear();
      }
    })();

    const cleaned = rawValue.replace(/[,\u00B7]/g, ' ').replace(/\s+/g, ' ').trim();
    const monthNameMatch = cleaned.match(
      /^(?:[A-Za-z]{3,}\.?\s+)?([A-Za-z]{3,})\.?\s+(\d{1,2})(?:\s+(\d{4}))?$/i,
    );

    if (monthNameMatch) {
      const monthToken = String(monthNameMatch[1] ?? '').replace(/\./g, '').toLowerCase();
      const day = Number(monthNameMatch[2]);
      const year = monthNameMatch[3] ? Number(monthNameMatch[3]) : fallbackYear;
      const monthMap: Record<string, number> = {
        jan: 1,
        january: 1,
        feb: 2,
        february: 2,
        mar: 3,
        march: 3,
        apr: 4,
        april: 4,
        may: 5,
        jun: 6,
        june: 6,
        jul: 7,
        july: 7,
        aug: 8,
        august: 8,
        sep: 9,
        sept: 9,
        september: 9,
        oct: 10,
        october: 10,
        nov: 11,
        november: 11,
        dec: 12,
        december: 12,
      };
      const month = monthMap[monthToken];

      if (!month || !Number.isFinite(day) || !Number.isFinite(year)) {
        throw new BadRequestException('Invalid promotion effective date');
      }

      const validated = new Date(Date.UTC(year, month - 1, day));
      if (
        validated.getUTCFullYear() !== year ||
        validated.getUTCMonth() !== month - 1 ||
        validated.getUTCDate() !== day
      ) {
        throw new BadRequestException('Invalid promotion effective date');
      }

      return `${year}-${pad2(month)}-${pad2(day)}`;
    }

    try {
      const parts = this.getBusinessDateParts(rawValue);
      return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
    } catch (error) {
      void error;
    }

    throw new BadRequestException('Invalid promotion effective date');
  }

  private canonicalizePromotionEffectiveDate(value: any, fallbackDate?: any) {
    const rawValue = String(value ?? '').trim();
    const yearMatch = rawValue.match(/^(\d{4})[-/]/);
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      if (year < 1900 || year > 2100) {
        throw new BadRequestException('Promotion effective date must be between 1900 and 2100.');
      }
    }
    const canonicalDate = this.canonicalizeBusinessDate(value, fallbackDate);
    const { year } = this.getBusinessDateParts(canonicalDate);
    if (year < 1900 || year > 2100) {
      throw new BadRequestException('Promotion effective date must be between 1900 and 2100.');
    }
    return canonicalDate;
  }

  private getStaffName(staff: any) {
    return [staff?.first_name, staff?.last_name].filter(Boolean).join(' ').trim();
  }

  private valuesMatch(left: unknown, right: unknown) {
    return String(left ?? '') === String(right ?? '');
  }

  private async rollbackPromotionOnRejection(client: any, promotion: any) {
    const staffResult = await client.query('SELECT * FROM staff WHERE id = $1 FOR UPDATE', [promotion.staff_id]);
    const staff = staffResult.rows[0];

    if (!staff) {
      throw new NotFoundException(`Staff member for promotion ${promotion.id} was not found`);
    }

    const stillOnAppliedPromotion =
      this.valuesMatch(staff.grade_level, promotion.new_grade_level) &&
      this.valuesMatch(staff.step, promotion.new_step);

    if (!stillOnAppliedPromotion) {
      return false;
    }

    const previousPromotionResult = await client.query(
      `SELECT promotion_date, effective_date
       FROM promotions
       WHERE staff_id = $1
         AND id != $2
         AND status = 'approved'
       ORDER BY COALESCE(promotion_date, effective_date) DESC NULLS LAST
       LIMIT 1`,
      [promotion.staff_id, promotion.id],
    );
    const previousPromotion = previousPromotionResult.rows[0];
    const previousPromotionDate = previousPromotion?.promotion_date || previousPromotion?.effective_date || null;

    await client.query(
      `UPDATE staff
       SET grade_level = $1,
           step = $2,
           current_basic_salary = $3,
           last_promotion_date = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [promotion.old_grade_level, promotion.old_step, promotion.old_basic_salary, previousPromotionDate, promotion.staff_id],
    );
    return true;
  }

  /**
   * Reduce a grade level token to a single canonical form so exclusion rules
   * configured in System Config always match the staff record regardless of how
   * the value was entered/stored. Mirrors PayrollService.canonicalizeGrade.
   *   "GL 12" / "GL12" / "012" / "12"  -> "12"
   *   "CAT 1" / "CAT1"                 -> "CAT1"
   */
  private canonicalizeGrade(value: any): string {
    const stripped = String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();
    const numericMatch = stripped.match(/^(?:GL)?0*(\d+)$/);
    return numericMatch ? numericMatch[1] : stripped;
  }

  private isExcludedFromGlobalItem(item: any, staffMember: any): boolean {
    const gradeKey = this.canonicalizeGrade(staffMember.grade_level);
    const empType = String(staffMember.employment_type || '').trim().toLowerCase();

    const parseList = (value: any): string[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    // Canonicalize both sides so e.g. configured "12" matches stored "GL 12" / "012".
    const excludedGrades = parseList(item.excluded_grades).map((grade) => this.canonicalizeGrade(grade));
    if (gradeKey && excludedGrades.includes(gradeKey)) return true;

    const excludedEmploymentTypes = parseList(item.excluded_employment_types).map((type) => String(type || '').trim().toLowerCase());
    return !!empType && excludedEmploymentTypes.includes(empType);
  }

  private async getPayrollContextStaff(staffId: string, gradeLevel?: string | number) {
    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [staffId]);
    return staff && gradeLevel !== undefined ? { ...staff, grade_level: gradeLevel } : staff;
  }

  private normalizeCalculationBasis(value: any): 'basic' | 'gross' {
    return String(value || '').toLowerCase() === 'gross' ? 'gross' : 'basic';
  }

  private calculatePercentageAmount(
    percentageValue: any,
    basicSalary: number,
    grossSalary: number,
    calculationBasis: any,
  ): number {
    const percentage = parseFloat(String(percentageValue ?? '0')) || 0;
    const basis = this.normalizeCalculationBasis(calculationBasis);
    const baseAmount = basis === 'gross' ? grossSalary : basicSalary;
    return (baseAmount * percentage) / 100;
  }

  private normalizePromotionRankValue(value: unknown): number {
    const normalized = this.canonicalizeGrade(value);
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number(value);
  }

  private hasProvidedValue(value: unknown): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  private resolveStepValue(value: unknown, fallback: unknown): number {
    const resolved = this.hasProvidedValue(value) ? Number(value) : Number(fallback);
    return resolved;
  }

  private assertPromotionAdvances(
    currentGradeLevel: unknown,
    currentStep: unknown,
    newGradeLevel: unknown,
    newStep: unknown,
  ) {
    const currentGrade = this.normalizePromotionRankValue(currentGradeLevel);
    const targetGrade = this.normalizePromotionRankValue(newGradeLevel);
    const currentStepNumber = Number(currentStep);
    const targetStepNumber = Number(newStep);

    if (
      !Number.isFinite(currentGrade) ||
      !Number.isFinite(targetGrade) ||
      !Number.isFinite(currentStepNumber) ||
      !Number.isFinite(targetStepNumber)
    ) {
      throw new BadRequestException('Promotion grade/step is invalid.');
    }

    if (
      targetGrade < currentGrade ||
      (targetGrade === currentGrade && targetStepNumber <= currentStepNumber)
    ) {
      throw new BadRequestException('New grade/step must be higher than current grade/step');
    }
  }

  private getDefaultPromotionArrearsEndDate() {
    const today = this.getBusinessDateParts(new Date());
    const lastDayOfPreviousMonth = new Date(Date.UTC(today.year, today.month - 1, 0));
    return `${lastDayOfPreviousMonth.getUTCFullYear()}-${String(lastDayOfPreviousMonth.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDayOfPreviousMonth.getUTCDate()).padStart(2, '0')}`;
  }

  private getPromotionArrearsMonthRanges(effectiveDate: string, effectiveEndDate: string) {
    const startParts = this.getBusinessDateParts(effectiveDate);
    const endParts = this.getBusinessDateParts(effectiveEndDate);
    const start = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
    const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));
    const ranges: Array<{
      month: string;
      startDate: string;
      endDate: string;
      eligibleDays: number;
      daysInMonth: number;
      fraction: number;
    }> = [];

    if (start > end) return ranges;
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const finalMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor <= finalMonth) {
      const year = cursor.getUTCFullYear();
      const monthIndex = cursor.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      const monthStart = new Date(Date.UTC(year, monthIndex, 1));
      const monthEnd = new Date(Date.UTC(year, monthIndex, daysInMonth));
      const coveredStart = start > monthStart ? start : monthStart;
      const coveredEnd = end < monthEnd ? end : monthEnd;
      const eligibleDays = Math.floor((coveredEnd.getTime() - coveredStart.getTime()) / 86400000) + 1;
      ranges.push({
        month: this.buildMonthKey(year, monthIndex + 1),
        startDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(coveredStart.getUTCDate()).padStart(2, '0')}`,
        endDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(coveredEnd.getUTCDate()).padStart(2, '0')}`,
        eligibleDays,
        daysInMonth,
        fraction: eligibleDays / daysInMonth,
      });
      cursor = new Date(Date.UTC(year, monthIndex + 1, 1));
    }
    return ranges;
  }

  private async resolvePromotionBasicSalaries(promotion: any) {
    let oldBasicSalary: number;
    try {
      oldBasicSalary = await this.salaryLookupService.getBasicSalary(
        promotion.old_grade_level,
        promotion.old_step,
      );
    } catch (error) {
      this.logger.warn(
        `Could not lookup old salary for promotion ${promotion.id} (GL${promotion.old_grade_level}/${promotion.old_step}). Using stored value.`,
      );
      oldBasicSalary = parseFloat(promotion.old_basic_salary || '0');
    }

    let newBasicSalary: number;
    try {
      newBasicSalary = await this.salaryLookupService.getBasicSalary(
        promotion.new_grade_level,
        promotion.new_step,
      );
    } catch (error) {
      this.logger.warn(
        `Could not lookup new salary for promotion ${promotion.id} (GL${promotion.new_grade_level}/${promotion.new_step}). Using stored value.`,
      );
      newBasicSalary = parseFloat(promotion.new_basic_salary || '0');
    }

    return {
      oldBasicSalary: this.roundCurrency(oldBasicSalary),
      newBasicSalary: this.roundCurrency(newBasicSalary),
    };
  }

  private async calculatePromotionArrearsPeriod(
    staff: any,
    effectiveDate: string,
    effectiveEndDate: string,
    oldBasicSalary: number,
    newBasicSalary: number,
    oldGradeLevel: number | string,
    newGradeLevel: number | string,
    taxConfig: any,
  ) {
    const ranges = this.getPromotionArrearsMonthRanges(effectiveDate, effectiveEndDate);
    const isContractStaff = String(staff?.employment_type || '').trim().toLowerCase() === 'contract';
    const details: any[] = [];
    const deductionItemsByCode = new Map<string, any>();
    const payeReliefs = { pension: 0, nhf: 0, nhia: 0 };
    let totalArrears = 0;
    let basicTotalArrears = 0;
    let totalDeductions = 0;
    let payeOnPromotionArrears = 0;

    for (const range of ranges) {
      const [oldAllowances, newAllowances] = await Promise.all([
        this.calculateAllowanceBreakdown(staff.id, oldBasicSalary, oldGradeLevel, range.month),
        this.calculateAllowanceBreakdown(staff.id, newBasicSalary, newGradeLevel, range.month),
      ]);
      const oldGrossSalary = this.roundCurrency(oldBasicSalary + oldAllowances.total);
      const newGrossSalary = this.roundCurrency(newBasicSalary + newAllowances.total);
      const [oldDeductions, newDeductions] = await Promise.all([
        this.calculateDeductionBreakdown(staff.id, oldBasicSalary, oldGradeLevel, range.month, oldGrossSalary),
        this.calculateDeductionBreakdown(staff.id, newBasicSalary, newGradeLevel, range.month, newGrossSalary),
      ]);
      const monthlyBasicDifference = this.roundCurrency(newBasicSalary - oldBasicSalary);
      const monthlyGrossDifference = this.roundCurrency(newGrossSalary - oldGrossSalary);
      const basicAmount = this.roundCurrency(monthlyBasicDifference * range.fraction);
      const grossAmount = this.roundCurrency(monthlyGrossDifference * range.fraction);
      const arrearsDeductions = await this.calculatePromotionArrearsDeductionBreakdown(
        newDeductions.items,
        monthlyGrossDifference,
        monthlyBasicDifference,
        range.fraction,
      );
      const oldReliefs = this.getPayeReliefAmounts(oldDeductions.items);
      const newReliefs = this.getPayeReliefAmounts(newDeductions.items);
      const oldTax = this.payeCalculator.calculate(
        oldGrossSalary,
        oldAllowances.items,
        taxConfig,
        isContractStaff,
        oldReliefs.pension,
        oldReliefs.nhf,
        oldReliefs.nhia,
      );
      const newTax = this.payeCalculator.calculate(
        newGrossSalary,
        newAllowances.items,
        taxConfig,
        isContractStaff,
        newReliefs.pension,
        newReliefs.nhf,
        newReliefs.nhia,
      );
      const monthlyPayeDifference = this.roundCurrency(Math.max(0, newTax.monthly_tax - oldTax.monthly_tax));
      const payeAmount = this.roundCurrency(monthlyPayeDifference * range.fraction);
      const netAmount = this.roundCurrency(grossAmount - arrearsDeductions.total - payeAmount);

      totalArrears = this.roundCurrency(totalArrears + grossAmount);
      basicTotalArrears = this.roundCurrency(basicTotalArrears + basicAmount);
      totalDeductions = this.roundCurrency(totalDeductions + arrearsDeductions.total);
      payeOnPromotionArrears = this.roundCurrency(payeOnPromotionArrears + payeAmount);
      payeReliefs.pension += arrearsDeductions.payeReliefs.pension;
      payeReliefs.nhf += arrearsDeductions.payeReliefs.nhf;
      payeReliefs.nhia += arrearsDeductions.payeReliefs.nhia;
      for (const item of arrearsDeductions.items) {
        const code = String(item.code || '').trim();
        const existing = deductionItemsByCode.get(code);
        deductionItemsByCode.set(code, existing
          ? { ...existing, amount: this.roundCurrency(existing.amount + item.amount) }
          : { ...item });
      }

      details.push({
        calculation_method: 'promotion_salary_period_v1',
        month: range.month,
        effective_start_date: range.startDate,
        effective_end_date: range.endDate,
        eligible_days: range.eligibleDays,
        days_in_month: range.daysInMonth,
        month_fraction: Number(range.fraction.toFixed(8)),
        old_basic_salary: oldBasicSalary,
        new_basic_salary: newBasicSalary,
        monthly_basic_difference: monthlyBasicDifference,
        basic_amount: basicAmount,
        old_allowances: oldAllowances.items,
        new_allowances: newAllowances.items,
        old_gross: oldGrossSalary,
        new_gross: newGrossSalary,
        monthly_gross_difference: monthlyGrossDifference,
        gross_amount: grossAmount,
        amount: grossAmount,
        old_deductions: oldDeductions.items,
        new_deductions: newDeductions.items,
        deductions: arrearsDeductions.items,
        total_deductions: arrearsDeductions.total,
        paye_old_monthly: oldTax.monthly_tax,
        paye_new_monthly: newTax.monthly_tax,
        paye_monthly_difference: monthlyPayeDifference,
        paye_amount: payeAmount,
        paye_reliefs: {
          pension: this.roundCurrency(arrearsDeductions.payeReliefs.pension),
          nhf: this.roundCurrency(arrearsDeductions.payeReliefs.nhf),
          nhia: this.roundCurrency(arrearsDeductions.payeReliefs.nhia),
        },
        net_amount: netAmount,
      });
    }

    return {
      details,
      monthsDiff: details.length,
      totalArrears,
      grossTotalArrears: totalArrears,
      basicTotalArrears,
      totalDeductions,
      payeOnPromotionArrears,
      totalArrearsDeductions: this.roundCurrency(totalDeductions + payeOnPromotionArrears),
      estimatedNetArrears: this.roundCurrency(totalArrears - totalDeductions - payeOnPromotionArrears),
      proratedFirstMonth: this.roundCurrency(Number(details[0]?.gross_amount || 0)),
      basicProratedFirstMonth: this.roundCurrency(Number(details[0]?.basic_amount || 0)),
      fullMonthsAfter: Math.max(0, details.length - 1),
      monthlyDifference: this.roundCurrency(Number(details[0]?.monthly_gross_difference || 0)),
      grossMonthlyDifference: this.roundCurrency(Number(details[0]?.monthly_gross_difference || 0)),
      basicMonthlyDifference: this.roundCurrency(Number(details[0]?.monthly_basic_difference || 0)),
      arrearsDeductions: {
        items: Array.from(deductionItemsByCode.values()),
        total: this.roundCurrency(totalDeductions),
        payeReliefs: {
          pension: this.roundCurrency(payeReliefs.pension),
          nhf: this.roundCurrency(payeReliefs.nhf),
          nhia: this.roundCurrency(payeReliefs.nhia),
        },
      },
    };
  }

  private async findExistingPromotionArrears(
    promotion: any,
    oldBasicSalary: number,
    newBasicSalary: number,
    effectiveDate: string,
  ) {
    return this.databaseService.queryOne(
      `SELECT *
       FROM arrears
       WHERE reason = 'promotion'
         AND staff_id = $1
         AND effective_date = $2::date
         AND old_basic_salary = $3
         AND new_basic_salary = $4
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        promotion.staff_id,
        effectiveDate,
        oldBasicSalary,
        newBasicSalary,
      ],
    );
  }

  private async evaluatePromotionArrears(promotion: any) {
    if (!promotion?.promotion_date && !promotion?.effective_date) {
      return {
        effectiveDate: null,
        oldBasicSalary: 0,
        newBasicSalary: 0,
        monthlyDifference: 0,
        monthsDiff: 0,
        proratedFirstMonth: 0,
        fullMonthsAfter: 0,
        totalArrears: 0,
        details: [],
        shouldCreate: false,
        reason: 'missing_effective_date',
      };
    }

    const rawEffectiveDate = promotion.promotion_date || promotion.effective_date;
    let effectiveDate: string;
    try {
      effectiveDate = this.canonicalizePromotionEffectiveDate(
        rawEffectiveDate,
        promotion.approval_date || promotion.created_at || new Date(),
      );
    } catch {
      return {
        effectiveDate: null,
        oldBasicSalary: 0,
        newBasicSalary: 0,
        monthlyDifference: 0,
        monthsDiff: 0,
        proratedFirstMonth: 0,
        fullMonthsAfter: 0,
        totalArrears: 0,
        details: [],
        shouldCreate: false,
        reason: 'invalid_effective_date',
      };
    }

    const effectiveEndDate = this.canonicalizeBusinessDate(
      promotion.arrears_end_date || this.getDefaultPromotionArrearsEndDate(),
      new Date(),
    );
    const defaultEndDate = this.getDefaultPromotionArrearsEndDate();
    if (effectiveEndDate > defaultEndDate) {
      throw new BadRequestException('Promotion arrears end date must be before the current payroll month.');
    }
    const { oldBasicSalary, newBasicSalary } = await this.resolvePromotionBasicSalaries(promotion);
    const taxSettings = await this.databaseService.queryOne(
      `SELECT tax_configuration FROM system_settings WHERE key = 'general_settings'`,
    );
    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [promotion.staff_id]);
    if (!staff) throw new NotFoundException(`Staff member with ID ${promotion.staff_id} does not exist.`);
    const arrearsCalculation = await this.calculatePromotionArrearsPeriod(
      staff,
      effectiveDate,
      effectiveEndDate,
      oldBasicSalary,
      newBasicSalary,
      promotion.old_grade_level,
      promotion.new_grade_level,
      taxSettings?.tax_configuration || {},
    );
    const firstDetail = arrearsCalculation.details[0];
    const oldGrossSalary = this.roundCurrency(Number(firstDetail?.old_gross ?? oldBasicSalary));
    const newGrossSalary = this.roundCurrency(Number(firstDetail?.new_gross ?? newBasicSalary));
    const basicMonthlyDifference = arrearsCalculation.basicMonthlyDifference;
    const grossMonthlyDifference = arrearsCalculation.grossMonthlyDifference;

    return {
      effectiveDate,
      effectiveEndDate,
      oldBasicSalary,
      newBasicSalary,
      oldGrossSalary,
      newGrossSalary,
      basicMonthlyDifference,
      ...arrearsCalculation,
      shouldCreate: arrearsCalculation.monthsDiff > 0 && arrearsCalculation.totalArrears > 0,
      reason:
        arrearsCalculation.monthsDiff <= 0
          ? 'not_backdated'
          : arrearsCalculation.totalArrears <= 0
            ? 'non_positive_difference'
            : 'eligible',
    };
  }

  private async createPromotionArrearsRecord(
    promotion: any,
    evaluation: {
      effectiveDate: any;
      effectiveEndDate: any;
      oldBasicSalary: number;
      newBasicSalary: number;
      oldGrossSalary?: number;
      newGrossSalary?: number;
      monthsDiff: number;
      totalArrears: number;
      details: any[];
    },
    userId?: string,
    notify = true,
  ) {
    const createdBy = userId || promotion.created_by || promotion.approved_by || null;
    const arrearsRecord = await this.databaseService.queryOne(
      `INSERT INTO arrears (
        staff_id, reason, old_salary, new_salary,
        old_basic_salary, new_basic_salary,
        effective_date, effective_end_date, months_owed, total_arrears,
        status, details, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        promotion.staff_id,
        'promotion',
        evaluation.oldGrossSalary ?? evaluation.oldBasicSalary,
        evaluation.newGrossSalary ?? evaluation.newBasicSalary,
        evaluation.oldBasicSalary,
        evaluation.newBasicSalary,
        evaluation.effectiveDate,
        evaluation.effectiveEndDate,
        evaluation.monthsDiff,
        evaluation.totalArrears,
        'pending',
        JSON.stringify(evaluation.details),
        createdBy,
      ],
    );

    if (notify) {
      const staff = await this.databaseService.queryOne(
        'SELECT first_name, last_name FROM staff WHERE id = $1',
        [promotion.staff_id],
      );
      const staffName = this.getStaffName(staff);

      await Promise.all(
        ['admin', 'payroll_officer'].map((role) =>
          this.notificationsService.createRoleNotification({
            role,
            type: NotificationType.ARREARS,
            category: NotificationCategory.ACTION_REQUIRED,
            title: 'Arrears approval required',
            message: staffName
              ? `Promotion arrears for ${staffName} is pending approval (${evaluation.totalArrears.toFixed(2)}).`
              : `Promotion arrears is pending approval (${evaluation.totalArrears.toFixed(2)}).`,
            link: '/arrears',
            entity_type: 'arrears',
            entity_id: arrearsRecord?.id,
            priority: NotificationPriority.HIGH,
            action_label: 'Review',
            action_link: '/arrears',
            created_by: createdBy || undefined,
            metadata: { arrears_id: arrearsRecord?.id, staff_id: promotion.staff_id, promotion_id: promotion.id },
          }),
        ),
      );
    }

    return arrearsRecord;
  }

  private async ensurePromotionArrearsProcessed(promotion: any, userId?: string, notify = true) {
    const evaluation = await this.evaluatePromotionArrears(promotion);

    if (!evaluation.effectiveDate) {
      return { outcome: 'skipped', reason: evaluation.reason, evaluation, arrearsRecord: null };
    }

    const existingArrears = await this.findExistingPromotionArrears(
      promotion,
      evaluation.oldBasicSalary,
      evaluation.newBasicSalary,
      evaluation.effectiveDate,
    );

    let arrearsRecord = existingArrears;
    let outcome: 'inserted' | 'existing' | 'no_due' = 'no_due';
    if (evaluation.shouldCreate) {
      if (existingArrears) {
        let existingDetails: any[] = [];
        try {
          const parsed = typeof existingArrears.details === 'string'
            ? JSON.parse(existingArrears.details)
            : existingArrears.details;
          existingDetails = Array.isArray(parsed) ? parsed : [];
        } catch {
          existingDetails = [];
        }
        if (
          existingArrears.status === 'pending' &&
          !existingArrears.payroll_batch_id &&
          !existingDetails.some((detail: any) => detail?.calculation_method === 'promotion_salary_period_v1')
        ) {
          arrearsRecord = await this.databaseService.queryOne(
            `UPDATE arrears
             SET old_salary = $1, new_salary = $2,
                 old_basic_salary = $3, new_basic_salary = $4,
                 effective_end_date = $5::date, months_owed = $6,
                 total_arrears = $7, details = $8, updated_at = NOW()
             WHERE id = $9 AND status = 'pending' AND payroll_batch_id IS NULL
             RETURNING *`,
            [
              evaluation.oldGrossSalary,
              evaluation.newGrossSalary,
              evaluation.oldBasicSalary,
              evaluation.newBasicSalary,
              evaluation.effectiveEndDate,
              evaluation.monthsDiff,
              evaluation.totalArrears,
              JSON.stringify(evaluation.details),
              existingArrears.id,
            ],
          );
        }
        outcome = 'existing';
      } else {
        arrearsRecord = await this.createPromotionArrearsRecord(promotion, evaluation, userId, notify);
        outcome = 'inserted';
      }
    }

    await this.databaseService.query(
      `UPDATE promotions
       SET arrears_calculated = true,
           updated_at = NOW()
       WHERE id = $1`,
      [promotion.id],
    );

    return { outcome, reason: evaluation.reason, evaluation, arrearsRecord };
  }

  /**
   * Get staff promotion history
   */
  async getStaffPromotions(staffId: string) {
    try {
      const promotions = await this.databaseService.query(
        `SELECT p.*, s.first_name, s.last_name 
         FROM promotions p
         JOIN staff s ON p.staff_id = s.id
         WHERE p.staff_id = $1
         ORDER BY p.promotion_date DESC`,
        [staffId]
      );
      return promotions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if a staff member has an existing pending promotion.
   * Returns the pending promotion if found, null otherwise.
   */
  private async getStaffPendingPromotion(staffId: string, excludePromotionId?: string) {
    const whereClauses = ['staff_id = $1', "status = 'pending'"];
    const params: any[] = [staffId];

    if (excludePromotionId) {
      params.push(excludePromotionId);
      whereClauses.push(`id != $${params.length}`);
    }

    return this.databaseService.queryOne(
      `SELECT *
       FROM promotions
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 1`,
      params,
    );
  }

  /**
   * Delete a promotion. Only pending or rejected promotions can be deleted.
   */
  async deletePromotion(id: string, userId: string) {
    const promotion = await this.databaseService.queryOne(
      'SELECT * FROM promotions WHERE id = $1',
      [id],
    );

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    if (promotion.status !== 'pending' && promotion.status !== 'rejected') {
      throw new BadRequestException(
        `Cannot delete a promotion with status '${promotion.status}'. Only pending or rejected promotions can be deleted.`,
      );
    }

    await this.databaseService.query('DELETE FROM promotions WHERE id = $1', [id]);

    const staff = await this.databaseService.queryOne(
      'SELECT first_name, last_name, staff_number FROM staff WHERE id = $1',
      [promotion.staff_id],
    );
    const staffName = this.getStaffName(staff);

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE,
      entity: 'promotions',
      entityId: id,
      description: staffName
        ? `Deleted ${promotion.status} promotion for ${staffName}`
        : `Deleted ${promotion.status} promotion`,
      oldValues: promotion,
    });

    return { message: 'Promotion deleted successfully', id };
  }

  /**
   * Create promotion request
   */
  async createPromotion(dto: any, userId: string) {
    // Handle both camelCase and snake_case for compatibility
    const staffId = dto.staffId || dto.staff_id;
    const newGradeLevel = dto.newGradeLevel || dto.new_grade_level;
    const newStep = dto.newStep || dto.new_step;
    let newBasicSalary = dto.newBasicSalary || dto.new_basic_salary;
    const effectiveDate = dto.effectiveDate || dto.effective_date;
    const promotionType = dto.promotionType || dto.promotion_type;
    const remarks = dto.remarks;
    const status = dto.status || 'pending';

    // Calculate salary if not provided
    if (!newBasicSalary) {
      try {
        newBasicSalary = await this.salaryLookupService.getBasicSalary(newGradeLevel, newStep);
      } catch (error) {
        throw new NotFoundException(`Could not determine salary for Grade ${newGradeLevel} Step ${newStep}. Please ensure salary structure is configured.`);
      }
    }
    
    // Get current staff details
    const staff = await this.databaseService.queryOne(
      'SELECT * FROM staff WHERE id = $1',
      [staffId]
    );

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffId} does not exist.`);
    }

    this.assertPromotionAdvances(staff.grade_level, staff.step, newGradeLevel, newStep);

    // Prevent duplicate pending promotions for the same staff
    const existingPending = await this.getStaffPendingPromotion(staffId);
    if (existingPending) {
      throw new BadRequestException(
        `A pending promotion already exists for this staff member. Please review or delete the existing pending promotion (ID: ${existingPending.id}) before creating a new one.`,
      );
    }

    const canonicalEffectiveDate = this.canonicalizePromotionEffectiveDate(effectiveDate, new Date());
    const rawArrearsEndDate = dto.arrearsEndDate || dto.arrears_end_date || this.getDefaultPromotionArrearsEndDate();
    const canonicalArrearsEndDate = this.canonicalizeBusinessDate(rawArrearsEndDate, new Date());
    if (canonicalArrearsEndDate > this.getDefaultPromotionArrearsEndDate()) {
      throw new BadRequestException('Promotion arrears end date must be before the current payroll month.');
    }
    
    // Create promotion record
    const result = await this.databaseService.queryOne(
      `INSERT INTO promotions (
        staff_id, old_grade_level, old_step, old_basic_salary,
        new_grade_level, new_step, new_basic_salary,
        promotion_date, effective_date, arrears_end_date, promotion_type, remarks, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12, $13, $14) RETURNING *`,
      [
        staffId, staff.grade_level, staff.step, staff.current_basic_salary,
        newGradeLevel, newStep, newBasicSalary,
        canonicalEffectiveDate,
        canonicalEffectiveDate,
        canonicalArrearsEndDate,
        promotionType || 'regular',
        remarks,
        status,
        userId,
      ]
    );

    this.logger.log(`Promotion request created for staff ${staff.staff_number}`);

    const staffName = this.getStaffName(staff);

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entity: 'promotions',
      entityId: result.id,
      description: `Created promotion request for ${staffName} to Grade ${newGradeLevel} Step ${newStep}`,
      newValues: result,
    });

    if (status === 'pending') {
      await Promise.all(
        ['admin', 'hr_manager'].map((role) =>
          this.notificationsService.createRoleNotification({
            role,
            type: NotificationType.PROMOTION,
            category: NotificationCategory.ACTION_REQUIRED,
            title: 'Promotion approval required',
            message: staffName
              ? `${staffName} promotion to GL ${newGradeLevel}/Step ${newStep} is pending approval.`
              : `Promotion to GL ${newGradeLevel}/Step ${newStep} is pending approval.`,
            link: '/promotions',
            entity_type: 'promotion',
            entity_id: result.id,
            priority: NotificationPriority.HIGH,
            action_label: 'Review',
            action_link: '/promotions',
            created_by: userId,
            metadata: { promotion_id: result.id, staff_id: staffId },
          }),
        ),
      );
    }

    // If created as approved (e.g. by admin directly), process it immediately
    if (status === 'approved') {
        await this.processPromotionApproval(result.id, userId);
    }

    return { message: 'Promotion request created successfully', id: result.id };
  }

  /**
   * Approve promotion
   */
  async approvePromotion(id: string, userId: string) {
    const promotion = await this.databaseService.queryOne('SELECT * FROM promotions WHERE id = $1', [id]);
    
    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    if (promotion.status === 'approved') {
      return { message: 'Promotion is already approved' };
    }

    const currentStaff = await this.databaseService.queryOne(
      'SELECT grade_level, step FROM staff WHERE id = $1',
      [promotion.staff_id],
    );
    if (!currentStaff) {
      throw new NotFoundException(`Staff member for promotion ${id} not found`);
    }

    this.assertPromotionAdvances(
      currentStaff.grade_level,
      currentStaff.step,
      promotion.new_grade_level,
      promotion.new_step,
    );

    await this.databaseService.query(
      `UPDATE promotions SET status = 'approved', approved_by = $1, approval_date = NOW(), updated_at = NOW() WHERE id = $2`,
      [userId, id]
    );

    const updatedPromotion = await this.databaseService.queryOne('SELECT * FROM promotions WHERE id = $1', [id]);

    const staff = await this.databaseService.queryOne('SELECT staff_number, first_name, last_name FROM staff WHERE id = $1', [promotion.staff_id]);
    const staffName = this.getStaffName(staff);
    
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'promotions',
      entityId: promotion.id,
      description: `Approved promotion for ${staffName}`,
      oldValues: promotion,
      newValues: updatedPromotion,
    });

    await this.processPromotionApproval(id, userId);

    if (promotion.created_by) {
      await this.notificationsService.create({
        recipient_id: promotion.created_by,
        type: NotificationType.PROMOTION,
        category: NotificationCategory.SUCCESS,
        title: 'Promotion approved',
        message: staffName ? `${staffName} promotion was approved.` : 'Promotion was approved.',
        link: '/promotions',
        entity_type: 'promotion',
        entity_id: promotion.id,
        priority: NotificationPriority.MEDIUM,
        action_label: 'View',
        action_link: '/promotions',
        created_by: userId,
        metadata: { promotion_id: promotion.id, staff_id: promotion.staff_id },
      });
    }

    return { message: 'Promotion approved successfully' };
  }

  /**
   * Reject promotion
   */
  async rejectPromotion(id: string, userId: string, reason: string) {
    const promotion = await this.databaseService.queryOne('SELECT * FROM promotions WHERE id = $1', [id]);
    
    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    if (promotion.status !== 'pending') {
      throw new BadRequestException(`Cannot reject promotion with status ${promotion.status}`);
    }

    let rolledBack = false;
    await this.databaseService.transaction(async (client) => {
      rolledBack = await this.rollbackPromotionOnRejection(client, promotion);

      await client.query(
        `UPDATE promotions
         SET status = 'rejected',
             rejection_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [reason, id],
      );
    });

    const updatedPromotion = await this.databaseService.queryOne('SELECT * FROM promotions WHERE id = $1', [id]);

    const staff = await this.databaseService.queryOne('SELECT staff_number, first_name, last_name FROM staff WHERE id = $1', [promotion.staff_id]);
    const staffName = this.getStaffName(staff);
    
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'promotions',
      entityId: promotion.id,
      description: rolledBack
        ? `Rejected promotion for ${staffName} and restored the previous grade/step`
        : `Rejected promotion for ${staffName}`,
      oldValues: promotion,
      newValues: updatedPromotion,
    });

    if (promotion.created_by) {
      await this.notificationsService.create({
        recipient_id: promotion.created_by,
        type: NotificationType.PROMOTION,
        category: NotificationCategory.WARNING,
        title: 'Promotion rejected',
        message: rolledBack
          ? (staffName ? `${staffName} promotion was rejected and rolled back.` : 'Promotion was rejected and rolled back.')
          : (staffName ? `${staffName} promotion was rejected.` : 'Promotion was rejected.'),
        link: '/promotions',
        entity_type: 'promotion',
        entity_id: promotion.id,
        priority: NotificationPriority.MEDIUM,
        action_label: 'View',
        action_link: '/promotions',
        created_by: userId,
        metadata: { promotion_id: promotion.id, staff_id: promotion.staff_id, reason },
      });
    }

    return {
      message: rolledBack
        ? 'Promotion rejected successfully and the staff record was rolled back.'
        : 'Promotion rejected successfully',
    };
  }

  private async prepareBulkPromotionBatch(promotionIds: string[]) {
    const normalizedIds = Array.from(
      new Set(
        (promotionIds || [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    );

    if (normalizedIds.length === 0) {
      throw new BadRequestException('No promotions selected.');
    }

    const promotions = await this.databaseService.query(
      `SELECT p.*, s.staff_number,
              TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) as staff_name
       FROM promotions p
       LEFT JOIN staff s ON p.staff_id = s.id
       WHERE p.id = ANY($1::uuid[])`,
      [normalizedIds],
    );

    const foundIds = new Set(promotions.map((promotion: any) => promotion.id));
    const failures: Array<{ id: string; staff_id?: string; staff_number?: string; staff_name?: string; reason: string }> = [];

    for (const id of normalizedIds) {
      if (!foundIds.has(id)) {
        failures.push({ id, reason: 'Promotion not found.' });
      }
    }

    const staffPromotionCounts = new Map<string, number>();
    for (const promotion of promotions) {
      if (promotion.status === 'pending' && promotion.staff_id) {
        staffPromotionCounts.set(promotion.staff_id, (staffPromotionCounts.get(promotion.staff_id) || 0) + 1);
      }
    }

    const actionablePromotions: any[] = [];
    for (const promotion of promotions) {
      if (promotion.status !== 'pending') {
        failures.push({
          id: promotion.id,
          staff_id: promotion.staff_id,
          staff_number: promotion.staff_number,
          staff_name: promotion.staff_name,
          reason: `Promotion is already ${promotion.status}.`,
        });
        continue;
      }

      if ((staffPromotionCounts.get(promotion.staff_id) || 0) > 1) {
        failures.push({
          id: promotion.id,
          staff_id: promotion.staff_id,
          staff_number: promotion.staff_number,
          staff_name: promotion.staff_name,
          reason: 'Multiple pending promotions were selected for this staff member. Approve or reject them individually.',
        });
        continue;
      }

      actionablePromotions.push(promotion);
    }

    return {
      actionablePromotions,
      failures,
      totalRequested: normalizedIds.length,
    };
  }

  private async processBulkPromotionBatch(
    promotions: any[],
    handler: (promotion: any) => Promise<any>,
    concurrency = 4,
  ) {
    const successes: Array<{ id: string; staff_id?: string; staff_number?: string; staff_name?: string }> = [];
    const failures: Array<{ id: string; staff_id?: string; staff_number?: string; staff_name?: string; reason: string }> = [];

    for (let index = 0; index < promotions.length; index += concurrency) {
      const chunk = promotions.slice(index, index + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (promotion) => {
          await handler(promotion);
          return promotion;
        }),
      );

      results.forEach((result, chunkIndex) => {
        const promotion = chunk[chunkIndex];
        if (result.status === 'fulfilled') {
          successes.push({
            id: promotion.id,
            staff_id: promotion.staff_id,
            staff_number: promotion.staff_number,
            staff_name: promotion.staff_name,
          });
          return;
        }

        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason || 'Bulk promotion processing failed.');
        failures.push({
          id: promotion.id,
          staff_id: promotion.staff_id,
          staff_number: promotion.staff_number,
          staff_name: promotion.staff_name,
          reason,
        });
      });
    }

    return { successes, failures };
  }

  async bulkApprovePromotions(promotionIds: string[], userId: string) {
    const { actionablePromotions, failures: initialFailures, totalRequested } = await this.prepareBulkPromotionBatch(promotionIds);
    const { successes, failures: processingFailures } = await this.processBulkPromotionBatch(
      actionablePromotions,
      (promotion) => this.approvePromotion(promotion.id, userId),
    );
    const failures = [...initialFailures, ...processingFailures];

    return {
      message:
        failures.length > 0
          ? 'Bulk promotion approval completed with some failures.'
          : 'Bulk promotion approval completed successfully.',
      totalRequested,
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    };
  }

  async bulkRejectPromotions(promotionIds: string[], userId: string, reason?: string) {
    const { actionablePromotions, failures: initialFailures, totalRequested } = await this.prepareBulkPromotionBatch(promotionIds);
    const rejectionReason = String(reason || '').trim() || 'Bulk rejected';
    const { successes, failures: processingFailures } = await this.processBulkPromotionBatch(
      actionablePromotions,
      (promotion) => this.rejectPromotion(promotion.id, userId, rejectionReason),
    );
    const failures = [...initialFailures, ...processingFailures];

    return {
      message:
        failures.length > 0
          ? 'Bulk promotion rejection completed with some failures.'
          : 'Bulk promotion rejection completed successfully.',
      totalRequested,
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    };
  }

  /**
   * Process promotion approval (Update staff & Calculate arrears)
   */
  private async processPromotionApproval(promotionId: string, userId: string) {
    const promotion = await this.databaseService.queryOne('SELECT * FROM promotions WHERE id = $1', [promotionId]);
    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [promotion.staff_id]);

    if (!staff) return;

    this.assertPromotionAdvances(staff.grade_level, staff.step, promotion.new_grade_level, promotion.new_step);

    let promotionDateForStaff = promotion.promotion_date;
    try {
      const canonicalPromotionDate = this.canonicalizeBusinessDate(
        promotion.promotion_date || promotion.effective_date,
        promotion.approval_date || promotion.created_at || new Date(),
      );
      promotionDateForStaff = canonicalPromotionDate;

      if (
        String(promotion.promotion_date ?? '').trim() !== canonicalPromotionDate ||
        String(promotion.effective_date ?? '').trim() !== canonicalPromotionDate
      ) {
        await this.databaseService.query(
          `UPDATE promotions
           SET promotion_date = $1,
               effective_date = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [canonicalPromotionDate, promotion.id],
        );
      }
    } catch (error) {
      void error;
    }

    // Update staff record
    await this.databaseService.query(
      `UPDATE staff 
       SET grade_level = $1, step = $2, current_basic_salary = $3, 
           last_promotion_date = $4, updated_at = NOW()
       WHERE id = $5`,
      [promotion.new_grade_level, promotion.new_step, promotion.new_basic_salary, promotionDateForStaff, staff.id]
    );

    this.logger.log(`Staff ${staff.staff_number} promoted to GL ${promotion.new_grade_level} Step ${promotion.new_step}`);

    // AUTOMATIC ARREARS CALCULATION
    try {
      const result = await this.ensurePromotionArrearsProcessed(promotion, userId, true);
      this.logger.log(
        `Evaluated promotion arrears for staff ${staff.id}. Outcome: ${result.outcome}. Reason: ${result.reason}. Months: ${result.evaluation.monthsDiff}. Difference: ${result.evaluation.monthlyDifference}`,
      );

      if (result.outcome === 'inserted') {
        this.logger.log(
          `Arrears record created for ${staff.staff_number}: ₦${result.evaluation.totalArrears} for ${result.evaluation.monthsDiff} months`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to calculate/insert arrears: ${error.message}`, error.stack);
    }
  }

  async backfillApprovedPromotionArrears(options?: {
    promotionId?: string;
    limit?: number;
    execute?: boolean;
    notify?: boolean;
  }) {
    const promotionId = String(options?.promotionId || '').trim();
    const limit = Math.max(0, Number(options?.limit || 0));
    const execute = options?.execute === true;
    const notify = options?.notify !== false;
    const params: any[] = [];
    const whereClauses = [`p.status = 'approved'`];

    if (promotionId) {
      params.push(promotionId);
      whereClauses.push(`p.id = $${params.length}`);
    }

    const limitClause = limit > 0 ? `LIMIT ${limit}` : '';
    const promotions = await this.databaseService.query(
      `SELECT p.*, s.staff_number,
              TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) as staff_name
       FROM promotions p
       JOIN staff s ON s.id = p.staff_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY COALESCE(p.promotion_date, p.effective_date) ASC, p.created_at ASC
       ${limitClause}`,
      params,
    );

    const summary = {
      evaluated: promotions.length,
      inserted: 0,
      missing: 0,
      existing: 0,
      noDue: 0,
      skipped: 0,
      failed: 0,
      items: [] as Array<{
        promotionId: string;
        staffNumber?: string;
        staffName?: string;
        outcome: string;
        reason: string;
        totalArrears?: number;
      }>,
    };

    for (const promotion of promotions) {
      try {
        const evaluation = await this.evaluatePromotionArrears(promotion);
        const existingArrears = evaluation.effectiveDate
          ? await this.findExistingPromotionArrears(
              promotion,
              evaluation.oldBasicSalary,
              evaluation.newBasicSalary,
              evaluation.effectiveDate,
            )
          : null;

        let outcome = 'skipped';
        if (evaluation.shouldCreate) {
          if (existingArrears) {
            outcome = 'existing';
            summary.existing += 1;
          } else if (execute) {
            const result = await this.ensurePromotionArrearsProcessed(
              promotion,
              promotion.approved_by || promotion.created_by,
              notify,
            );
            outcome = result.outcome;
            if (result.outcome === 'inserted') {
              summary.inserted += 1;
            } else if (result.outcome === 'existing') {
              summary.existing += 1;
            } else {
              summary.noDue += 1;
            }
          } else {
            outcome = 'missing';
            summary.missing += 1;
          }
        } else if (execute) {
          await this.ensurePromotionArrearsProcessed(
            promotion,
            promotion.approved_by || promotion.created_by,
            false,
          );
          outcome = 'no_due';
          summary.noDue += 1;
        } else {
          outcome = evaluation.reason === 'missing_effective_date' || evaluation.reason === 'invalid_effective_date'
            ? 'skipped'
            : 'no_due';
          if (outcome === 'skipped') {
            summary.skipped += 1;
          } else {
            summary.noDue += 1;
          }
        }

        summary.items.push({
          promotionId: promotion.id,
          staffNumber: promotion.staff_number,
          staffName: promotion.staff_name,
          outcome,
          reason: evaluation.reason,
          totalArrears: evaluation.totalArrears,
        });
      } catch (error) {
        summary.failed += 1;
        summary.items.push({
          promotionId: promotion.id,
          staffNumber: promotion.staff_number,
          staffName: promotion.staff_name,
          outcome: 'failed',
          reason: error instanceof Error ? error.message : String(error || 'Unknown error'),
        });
      }
    }

    return summary;
  }

  /**
   * Promote staff member (Legacy wrapper)
   */
  async promoteStaff(dto: any, userId: string) {
    return this.createPromotion(dto, userId);
  }

  /**
   * Calculate arrears preview for a potential promotion
   */
  async calculateArrearsPreview(
    staffId: string,
    newGradeLevel: number | string,
    newStep: number | string,
    effectiveDate: string,
    oldGradeLevel?: number | string,
    oldStep?: number | string,
    effectiveEndDate?: string,
  ) {
    const canonicalEffectiveDate = this.canonicalizePromotionEffectiveDate(effectiveDate, new Date());
    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [staffId]);
    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffId} does not exist.`);
    }

    const resolvedOldGradeLevel = this.hasProvidedValue(oldGradeLevel) ? oldGradeLevel : staff.grade_level;
    const resolvedOldStep = this.resolveStepValue(oldStep, staff.step);
    const resolvedNewGradeLevel = this.hasProvidedValue(newGradeLevel) ? newGradeLevel : staff.grade_level;
    const resolvedNewStep = this.resolveStepValue(newStep, staff.step);

    // Calculate Old Basic Salary based on current Grade/Step (don't rely on stored current_basic_salary which might be stale)
    let oldBasicSalary: number;
    try {
      oldBasicSalary = await this.salaryLookupService.getBasicSalary(resolvedOldGradeLevel, resolvedOldStep);
    } catch (error) {
      // Fallback to stored salary if lookup fails (e.g. old grade not in current structure)
      this.logger.warn(`Could not lookup old salary for staff ${staffId} (GL${staff.grade_level}/${staff.step}). Using stored value.`);
      oldBasicSalary = parseFloat(staff.current_basic_salary || '0');
    }
    
    // Get new basic salary
    let newBasicSalary: number;
    try {
      newBasicSalary = await this.salaryLookupService.getBasicSalary(resolvedNewGradeLevel, resolvedNewStep);
    } catch (error) {
      throw new NotFoundException(`Could not determine salary for Grade ${resolvedNewGradeLevel} Step ${resolvedNewStep}.`);
    }

    this.assertPromotionAdvances(
      resolvedOldGradeLevel,
      resolvedOldStep,
      resolvedNewGradeLevel,
      resolvedNewStep,
    );

    const oldContextGrade = resolvedOldGradeLevel;
    const newContextGrade = resolvedNewGradeLevel;
    const canonicalEffectiveEndDate = this.canonicalizeBusinessDate(
      effectiveEndDate || this.getDefaultPromotionArrearsEndDate(),
      new Date(),
    );
    if (canonicalEffectiveEndDate > this.getDefaultPromotionArrearsEndDate()) {
      throw new BadRequestException('Promotion arrears end date must be before the current payroll month.');
    }
    const employmentDate = staff.employment_date ? this.canonicalizeBusinessDate(staff.employment_date, new Date()) : null;
    if (employmentDate && canonicalEffectiveDate < employmentDate) {
      throw new BadRequestException('Promotion effective date cannot be earlier than the staff employment date.');
    }
    const taxSettings = await this.databaseService.queryOne(
      `SELECT tax_configuration FROM system_settings WHERE key = 'general_settings'`,
    );
    const taxConfig = taxSettings?.tax_configuration || {};
    const calculation = await this.calculatePromotionArrearsPeriod(
      staff,
      canonicalEffectiveDate,
      canonicalEffectiveEndDate,
      oldBasicSalary,
      newBasicSalary,
      oldContextGrade,
      newContextGrade,
      taxConfig,
    );
    const firstDetail = calculation.details[0];
    const oldAllowances = firstDetail
      ? { items: firstDetail.old_allowances, total: this.roundCurrency(firstDetail.old_allowances.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)) }
      : await this.calculateAllowanceBreakdown(staffId, oldBasicSalary, oldContextGrade);
    const newAllowances = firstDetail
      ? { items: firstDetail.new_allowances, total: this.roundCurrency(firstDetail.new_allowances.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)) }
      : await this.calculateAllowanceBreakdown(staffId, newBasicSalary, newContextGrade);
    const oldDeductions = firstDetail
      ? { items: firstDetail.old_deductions, total: this.roundCurrency(firstDetail.old_deductions.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)) }
      : await this.calculateDeductionBreakdown(staffId, oldBasicSalary, oldContextGrade);
    const newDeductions = firstDetail
      ? { items: firstDetail.new_deductions, total: this.roundCurrency(firstDetail.new_deductions.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)) }
      : await this.calculateDeductionBreakdown(staffId, newBasicSalary, newContextGrade);
    const oldGrossSalary = this.roundCurrency(Number(firstDetail?.old_gross ?? (oldBasicSalary + oldAllowances.total)));
    const newGrossSalary = this.roundCurrency(Number(firstDetail?.new_gross ?? (newBasicSalary + newAllowances.total)));
    const oldNetSalary = this.roundCurrency(oldGrossSalary - oldDeductions.total);
    const newNetSalary = this.roundCurrency(newGrossSalary - newDeductions.total);
    const regularPaye = this.roundCurrency(Number(firstDetail?.paye_new_monthly || 0));

    return {
      oldBasicSalary,
      newBasicSalary,
      effectiveDate: canonicalEffectiveDate,
      effectiveEndDate: canonicalEffectiveEndDate,
      basicMonthlyDifference: calculation.basicMonthlyDifference || this.roundCurrency(newBasicSalary - oldBasicSalary),
      oldNetSalary,
      newNetSalary,
      monthlyDifference: calculation.monthlyDifference,
      grossMonthlyDifference: calculation.grossMonthlyDifference,
      monthsDiff: calculation.monthsDiff,
      proratedFirstMonth: calculation.proratedFirstMonth,
      fullMonthsAfter: calculation.fullMonthsAfter,
      totalArrears: calculation.totalArrears,
      grossTotalArrears: calculation.totalArrears,
      oldGrossSalary,
      newGrossSalary,
      oldAllowances,
      newAllowances,
      oldDeductions,
      newDeductions,
      basicTotalArrears: calculation.basicTotalArrears,
      arrearsCalculationBasis: 'gross',
      arrearsDeductions: calculation.arrearsDeductions,
      regularPaye,
      payeOnPromotionArrears: calculation.payeOnPromotionArrears,
      totalArrearsDeductions: calculation.totalArrearsDeductions,
      estimatedNetArrears: calculation.estimatedNetArrears,
      monthlyDetails: calculation.details,
    };
  }

  /**
   * Get eligible promotions
   */
  async getEligiblePromotions() {
    return this.databaseService.query(
      `SELECT s.*, d.name as department_name
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.status = 'active'
       ORDER BY s.employment_date ASC
       LIMIT 50`
    );
  }

  /**
   * Get all promotions
   */
  async getAll(query?: {
    page?: number;
    limit?: number;
    status?: string;
    staffId?: string;
    search?: string;
  }) {
    const page = Math.max(1, Number(query?.page || 1));
    const limit = Math.min(500, Math.max(1, Number(query?.limit || 100)));
    const offset = (page - 1) * limit;
    const status = String(query?.status || '').trim();
    const staffId = String(query?.staffId || '').trim();
    const search = String(query?.search || '').trim();

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClauses.push(`p.status = $${paramIndex}`);
      params.push(status);
      paramIndex += 1;
    }

    if (staffId) {
      whereClauses.push(`p.staff_id = $${paramIndex}`);
      params.push(staffId);
      paramIndex += 1;
    }

    if (search) {
      whereClauses.push(
        `(s.first_name ILIKE $${paramIndex} OR s.last_name ILIKE $${paramIndex} OR s.staff_number ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex += 1;
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await this.databaseService.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM promotions p
       JOIN staff s ON p.staff_id = s.id
       ${whereClause}`,
      params,
    );
    const total = parseInt(countResult?.total?.toString() || '0');

    const data = await this.databaseService.query(
      `SELECT p.*,
              s.first_name,
              s.last_name,
              s.staff_number,
              TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) as staff_name
       FROM promotions p
       JOIN staff s ON p.staff_id = s.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
      },
    };
  }

  /**
   * Calculate gross salary (Basic + Allowances)
   */
  private async calculateGrossSalary(staffId: string, basicSalary: number, gradeLevel?: string | number): Promise<number> {
    const staffMember = await this.getPayrollContextStaff(staffId, gradeLevel);
    // 1. Get Global Allowances (applies_to_all = true)
    const globalAllowances = await this.databaseService.query(
      `SELECT * FROM allowances WHERE status = 'active' AND applies_to_all = true`
    );

    // 2. Get Staff Specific Allowances
    // We join with allowances table to get the type
    const staffAllowances = await this.databaseService.query(
      `SELECT sa.*,
              COALESCE(sa.custom_type, a.type) as allowance_type,
              COALESCE(sa.custom_calculation_basis, a.calculation_basis, 'basic') as calculation_basis,
              a.percentage as global_percentage
       FROM staff_allowances sa
       LEFT JOIN allowances a ON sa.allowance_id = a.id
       WHERE sa.status = 'active' AND sa.staff_id = $1`,
      [staffId]
    );

    let totalAllowances = 0;

    // Calculate fixed and basic-based allowances first.
    for (const allowance of globalAllowances) {
      if (staffMember && this.isExcludedFromGlobalItem(allowance, staffMember)) {
        continue;
      }

      if (allowance.type === 'fixed') {
        totalAllowances += parseFloat(allowance.amount);
      } else if (this.normalizeCalculationBasis(allowance.calculation_basis) === 'basic') {
        totalAllowances += (basicSalary * parseFloat(allowance.percentage)) / 100;
      }
    }

    for (const allowance of staffAllowances) {
      const type = allowance.allowance_type;
      if (type === 'fixed') {
        const amt = allowance.amount ? parseFloat(allowance.amount) : 0;
        totalAllowances += amt;
      } else if (this.normalizeCalculationBasis(allowance.calculation_basis) === 'basic') {
        const pct = allowance.percentage ? parseFloat(allowance.percentage) : 0;
        totalAllowances += (basicSalary * pct) / 100;
      }
    }

    const allowanceGrossBase = basicSalary + totalAllowances;

    for (const allowance of globalAllowances) {
      if (staffMember && this.isExcludedFromGlobalItem(allowance, staffMember)) {
        continue;
      }
      if (allowance.type === 'percentage' && this.normalizeCalculationBasis(allowance.calculation_basis) === 'gross') {
        totalAllowances += this.calculatePercentageAmount(
          allowance.percentage,
          basicSalary,
          allowanceGrossBase,
          allowance.calculation_basis,
        );
      }
    }

    for (const allowance of staffAllowances) {
      const type = allowance.allowance_type;
      if (type === 'percentage' && this.normalizeCalculationBasis(allowance.calculation_basis) === 'gross') {
        const pct = allowance.percentage ? parseFloat(allowance.percentage) : 0;
        totalAllowances += (allowanceGrossBase * pct) / 100;
      }
    }

    return basicSalary + totalAllowances;
  }

  /**
   * Calculate total deductions for promotion arrears context.
   * Only global deductions that apply to the staff member are included.
   */
  private async calculateTotalDeductions(staffId: string, basicSalary: number, gradeLevel?: string | number): Promise<number> {
    const staffMember = await this.getPayrollContextStaff(staffId, gradeLevel);
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true AND code != 'TAX'`
    );

    let totalDeductions = 0;
    const grossSalary = await this.calculateGrossSalary(staffId, basicSalary, gradeLevel);

    for (const deduction of globalDeductions) {
      if (staffMember && this.isExcludedFromGlobalItem(deduction, staffMember)) {
        continue;
      }

      if (deduction.type === 'percentage') {
        totalDeductions += this.calculatePercentageAmount(
          deduction.percentage,
          basicSalary,
          grossSalary,
          deduction.calculation_basis,
        );
      } else if (deduction.type === 'fixed') {
        totalDeductions += parseFloat(deduction.amount);
      }
    }

    return totalDeductions;
  }

  private async calculateAllowanceBreakdown(
    staffId: string,
    basicSalary: number,
    gradeLevel?: string | number,
    month?: string,
  ): Promise<{ total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string; is_taxable?: boolean }> }> {
    const staffMember = await this.getPayrollContextStaff(staffId, gradeLevel);
    const globalAllowances = await this.databaseService.query(
      `SELECT * FROM allowances WHERE status = 'active' AND applies_to_all = true`,
    );

    const staffAllowances = await this.databaseService.query(
      `SELECT sa.*,
              COALESCE(sa.custom_type, a.type) as allowance_type,
              COALESCE(sa.custom_calculation_basis, a.calculation_basis, 'basic') as calculation_basis,
              COALESCE(sa.custom_is_taxable, a.is_taxable, true) as is_taxable,
              a.percentage as global_percentage,
              COALESCE(sa.custom_allowance_name, a.name) as allowance_name,
              COALESCE(sa.custom_allowance_code, a.code) as allowance_code
       FROM staff_allowances sa
       LEFT JOIN allowances a ON sa.allowance_id = a.id
       WHERE sa.status = 'active' AND sa.staff_id = $1
         AND ($2::text IS NULL OR (
           sa.effective_from <= TO_DATE($2 || '-01', 'YYYY-MM-DD')
           AND (sa.effective_to IS NULL OR sa.effective_to >= TO_DATE($2 || '-01', 'YYYY-MM-DD'))
         ))`,
      [staffId, month || null],
    );

    const items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string; is_taxable?: boolean }> = [];
    let total = 0;

    for (const allowance of globalAllowances) {
      if (staffMember && this.isExcludedFromGlobalItem(allowance, staffMember)) {
        continue;
      }

      let amount = 0;
      if (allowance.type === 'fixed') {
        amount = parseFloat(allowance.amount);
      } else if (this.normalizeCalculationBasis(allowance.calculation_basis) === 'basic') {
        amount = (basicSalary * parseFloat(allowance.percentage)) / 100;
      }
      if (amount) {
        items.push({
          code: allowance.code,
          name: allowance.name,
          amount,
          type: allowance.type,
          calculation_basis: this.normalizeCalculationBasis(allowance.calculation_basis),
          source: 'global',
          is_taxable: allowance.is_taxable !== false,
        });
        total += amount;
      }
    }

    for (const allowance of staffAllowances) {
      const type = allowance.allowance_type;
      let amount = 0;
      if (type === 'fixed') {
        amount = allowance.amount ? parseFloat(allowance.amount) : 0;
      } else if (this.normalizeCalculationBasis(allowance.calculation_basis) === 'basic') {
        const pct = allowance.percentage ? parseFloat(allowance.percentage) : 0;
        amount = (basicSalary * pct) / 100;
      }
      if (amount) {
        items.push({
          code: allowance.allowance_code,
          name: allowance.allowance_name,
          amount,
          type,
          calculation_basis: this.normalizeCalculationBasis(allowance.calculation_basis),
          source: 'staff',
          is_taxable: allowance.is_taxable !== false,
        });
        total += amount;
      }
    }

    const allowanceGrossBase = basicSalary + total;

    for (const allowance of globalAllowances) {
      if (staffMember && this.isExcludedFromGlobalItem(allowance, staffMember)) {
        continue;
      }
      if (allowance.type !== 'percentage' || this.normalizeCalculationBasis(allowance.calculation_basis) !== 'gross') {
        continue;
      }

      const amount = this.calculatePercentageAmount(
        allowance.percentage,
        basicSalary,
        allowanceGrossBase,
        allowance.calculation_basis,
      );

      if (amount) {
        items.push({
          code: allowance.code,
          name: allowance.name,
          amount,
          type: allowance.type,
          calculation_basis: 'gross',
          source: 'global',
          is_taxable: allowance.is_taxable !== false,
        });
        total += amount;
      }
    }

    for (const allowance of staffAllowances) {
      const type = allowance.allowance_type;
      if (type !== 'percentage' || this.normalizeCalculationBasis(allowance.calculation_basis) !== 'gross') {
        continue;
      }

      const amount = this.calculatePercentageAmount(
        allowance.percentage,
        basicSalary,
        allowanceGrossBase,
        allowance.calculation_basis,
      );

      if (amount) {
        items.push({
          code: allowance.allowance_code,
          name: allowance.allowance_name,
          amount,
          type,
          calculation_basis: 'gross',
          source: 'staff',
          is_taxable: allowance.is_taxable !== false,
        });
        total += amount;
      }
    }

    return { total, items };
  }

  private getPayeReliefAmounts(items: any[]) {
    return (items || []).reduce((result, item: any) => {
      if (item.is_paye_relief !== true) return result;
      const code = String(item.code || '').toUpperCase();
      const name = String(item.name || '').toUpperCase();
      if (code === 'PENSION' || name.includes('PENSION')) result.pension += this.roundCurrency(item.amount);
      if (code === 'NHF' || name.includes('NHF') || name.includes('HOUSING FUND')) result.nhf += this.roundCurrency(item.amount);
      if (code === 'NHIA' || code === 'NHIS' || name.includes('NHIA') || name.includes('NHIS') || name.includes('HEALTH INSURANCE')) result.nhia += this.roundCurrency(item.amount);
      return result;
    }, { pension: 0, nhf: 0, nhia: 0 });
  }

  private async calculatePromotionArrearsDeductionBreakdown(
    deductionItems: any[],
    grossArrears: number,
    basicArrears: number,
    monthFraction = 1,
  ) {
    const items: any[] = [];
    const seen = new Set<string>();
    const payeReliefs = { pension: 0, nhf: 0, nhia: 0 };
    for (const deduction of deductionItems || []) {
      if (deduction.applies_to_promotion_arrears !== true) continue;
      const code = String(deduction.code || '').toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const basis = deduction.promotion_arrears_basis === 'gross' ? 'gross' : 'basic';
      const base = basis === 'gross' ? grossArrears : basicArrears;
      const monthlyAmount = deduction.type === 'percentage'
        ? this.roundCurrency((base * Number(deduction.percentage || 0)) / 100)
        : this.roundCurrency(Number(deduction.amount || 0));
      const amount = this.roundCurrency(monthlyAmount * monthFraction);
      if (amount <= 0) continue;
      const item = {
        code: `${deduction.code}_ARREARS`,
        name: `${deduction.name} (Promotion Arrears)`,
        amount,
        monthly_amount: monthlyAmount,
        type: deduction.type,
        source: deduction.source,
        calculation_basis: basis,
        is_paye_relief: deduction.is_paye_relief === true,
      };
      items.push(item);
      const relief = this.getPayeReliefAmounts([{ ...deduction, amount }]);
      payeReliefs.pension += relief.pension;
      payeReliefs.nhf += relief.nhf;
      payeReliefs.nhia += relief.nhia;
    }
    return { total: this.roundCurrency(items.reduce((sum, item) => sum + item.amount, 0)), items, payeReliefs };
  }

  private async calculateDeductionBreakdown(
    staffId: string,
    basicSalary: number,
    gradeLevel?: string | number,
    month?: string,
    grossSalaryOverride?: number,
  ): Promise<{ total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string; applies_to_promotion_arrears?: boolean; promotion_arrears_basis?: string; is_paye_relief?: boolean }> }> {
    const staffMember = await this.getPayrollContextStaff(staffId, gradeLevel);
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true AND code != 'TAX'`,
    );
    const staffDeductions = await this.databaseService.query(
      `SELECT sd.*,
              COALESCE(sd.custom_deduction_name, d.name) as deduction_name,
              COALESCE(sd.custom_deduction_code, d.code) as deduction_code,
              COALESCE(sd.custom_type, d.type) as type,
              COALESCE(sd.custom_calculation_basis, d.calculation_basis, 'basic') as calculation_basis,
              d.applies_to_promotion_arrears, d.promotion_arrears_basis, d.is_paye_relief,
              d.excluded_grades, d.excluded_employment_types
       FROM staff_deductions sd
       LEFT JOIN deductions d ON sd.deduction_id = d.id
       WHERE sd.status = 'active' AND sd.staff_id = $1
         AND ($2::text IS NULL OR (
           sd.effective_from <= TO_DATE($2 || '-01', 'YYYY-MM-DD')
           AND (sd.effective_to IS NULL OR sd.effective_to >= TO_DATE($2 || '-01', 'YYYY-MM-DD'))
         ))`,
      [staffId, month || null],
    );

    const items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string; applies_to_promotion_arrears?: boolean; promotion_arrears_basis?: string; is_paye_relief?: boolean }> = [];
    let total = 0;
    const grossSalary = grossSalaryOverride !== undefined
      ? grossSalaryOverride
      : await this.calculateGrossSalary(staffId, basicSalary, gradeLevel);

    for (const deduction of globalDeductions) {
      if (staffMember && this.isExcludedFromGlobalItem(deduction, staffMember)) {
        continue;
      }

      let amount = 0;
      if (deduction.type === 'percentage') {
        amount = this.calculatePercentageAmount(
          deduction.percentage,
          basicSalary,
          grossSalary,
          deduction.calculation_basis,
        );
      } else if (deduction.type === 'fixed') {
        amount = parseFloat(deduction.amount);
      }
      if (amount) {
        items.push({
          code: deduction.code,
          name: deduction.name,
          amount,
          type: deduction.type,
          calculation_basis: this.normalizeCalculationBasis(deduction.calculation_basis),
          source: 'global',
          applies_to_promotion_arrears: deduction.applies_to_promotion_arrears === true,
          promotion_arrears_basis: deduction.promotion_arrears_basis,
          is_paye_relief: deduction.is_paye_relief === true,
        });
        total += amount;
      }
    }

    for (const deduction of staffDeductions) {
      if (staffMember && this.isExcludedFromGlobalItem(deduction, staffMember)) continue;
      let amount = 0;
      if (deduction.type === 'fixed') amount = Number(deduction.amount || 0);
      if (deduction.type === 'percentage') {
        amount = this.calculatePercentageAmount(deduction.percentage, basicSalary, grossSalary, deduction.calculation_basis);
      }
      if (amount <= 0) continue;
      items.push({
        code: deduction.deduction_code || deduction.code,
        name: deduction.deduction_name || deduction.name,
        amount,
        type: deduction.type,
        calculation_basis: this.normalizeCalculationBasis(deduction.calculation_basis),
        source: 'staff',
        applies_to_promotion_arrears: deduction.applies_to_promotion_arrears === true,
        promotion_arrears_basis: deduction.promotion_arrears_basis,
        is_paye_relief: deduction.is_paye_relief === true,
      });
      total += amount;
    }

    return { total, items };
  }
}
