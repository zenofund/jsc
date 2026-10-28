import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationPriority, NotificationType } from '../notifications/dto/notification.dto';
import { SalaryLookupService } from '../salary-structures/salary-lookup.service';
import { PayeCalculatorService } from '@common/tax/paye-calculator.service';

@Injectable()
export class ArrearsService {
  private readonly logger = new Logger(ArrearsService.name);
  private readonly businessTimeZone = 'Africa/Lagos';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly salaryLookupService?: SalaryLookupService,
    @Optional() private readonly payeCalculator?: PayeCalculatorService,
  ) {}

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private parseCurrencyAmount(value: any) {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) {
      throw new BadRequestException('Amount is required');
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      throw new BadRequestException('Amount must be a valid number');
    }

    return this.roundCurrency(parsedValue);
  }

  private getBusinessDateParts(value: any) {
    const rawValue = String(value || '').trim();
    const plainDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (plainDateMatch) {
      return {
        year: Number(plainDateMatch[1]),
        month: Number(plainDateMatch[2]),
        day: Number(plainDateMatch[3]),
      };
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid effective date');
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

  private getStaffName(staff: any) {
    return [staff?.first_name, staff?.last_name].filter(Boolean).join(' ').trim();
  }

  private parseDateOnly(value: any, label: string) {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new BadRequestException(`${label} must be a valid date.`);

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      year < 1900 || year > 2100 ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${label} must be a valid date.`);
    }

    return { raw, year, month, day, date };
  }

  private getDateOnly(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  private getManualArrearsMonthRanges(start: Date, end: Date) {
    const ranges: Array<{
      month: string;
      startDate: string;
      endDate: string;
      eligibleDays: number;
      daysInMonth: number;
      fraction: number;
    }> = [];

    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (cursor <= lastMonth) {
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
        startDate: this.getDateOnly(coveredStart),
        endDate: this.getDateOnly(coveredEnd),
        eligibleDays,
        daysInMonth,
        fraction: eligibleDays / daysInMonth,
      });
      cursor = new Date(Date.UTC(year, monthIndex + 1, 1));
    }

    return ranges;
  }

  private parseJsonArray(value: any): string[] {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }

  private async findDuplicateArrearsForCreate(
    staffId: string,
    reason: string,
    effectiveDate: string,
    effectiveEndDate?: string,
    excludeId?: string,
  ) {
    const normalizedReason = String(reason || 'other').trim() || 'other';
    const effectiveDateOnly = String(effectiveDate || '').slice(0, 10);
    const periodEndDate = effectiveEndDate ? String(effectiveEndDate).slice(0, 10) : effectiveDateOnly;

    return this.databaseService.queryOne(
      `SELECT id, staff_id, reason, effective_date, effective_end_date, status
       FROM arrears
       WHERE staff_id = $1
         AND reason = $2
         AND effective_date::date = $3::date
         AND COALESCE(effective_end_date::date, effective_date::date) = $4::date
         AND status IN ('pending', 'approved', 'processed', 'rejected')
         AND ($5::uuid IS NULL OR id != $5)
       ORDER BY created_at DESC
       LIMIT 1`,
      [staffId, normalizedReason, effectiveDateOnly, periodEndDate, excludeId || null],
    );
  }

  private canonicalizeGrade(value: any) {
    const stripped = String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();
    const numericMatch = stripped.match(/^(?:GL)?0*(\d+)$/);
    return numericMatch ? numericMatch[1] : stripped;
  }

  private isExcludedFromManualArrears(item: any, staff: any) {
    const grade = this.canonicalizeGrade(staff?.grade_level);
    const employmentType = String(staff?.employment_type || '').trim().toLowerCase();
    const excludedGrades = this.parseJsonArray(item?.excluded_grades).map((value) => this.canonicalizeGrade(value));
    const excludedTypes = this.parseJsonArray(item?.excluded_employment_types).map((value) => value.trim().toLowerCase());
    return (grade && excludedGrades.includes(grade)) || (employmentType && excludedTypes.includes(employmentType));
  }

  private getManualPayeReliefKind(deduction: any): 'pension' | 'nhf' | 'nhia' | null {
    if (deduction?.is_paye_relief !== true) return null;
    const code = String(deduction.code || deduction.deduction_code || '').trim().toUpperCase();
    const name = String(deduction.name || deduction.deduction_name || '').trim().toUpperCase();
    if (code === 'PENSION' || name.includes('PENSION')) return 'pension';
    if (code === 'NHF' || name.includes('NHF') || name.includes('NATIONAL HOUSING FUND')) return 'nhf';
    if (['NHIA', 'NHIS'].includes(code) || ['NHIA', 'NHIS', 'HEALTH INSURANCE'].some((term) => name.includes(term))) return 'nhia';
    return null;
  }

  private async getManualArrearsAllowanceDefinitions(staffId: string, month: string) {
    const globalAllowances = await this.databaseService.query(
      `SELECT * FROM allowances WHERE status = 'active' AND applies_to_all = true`,
    );
    const staffAllowances = await this.databaseService.query(
      `SELECT sa.*,
              COALESCE(sa.custom_allowance_name, a.name) as allowance_name,
              COALESCE(sa.custom_allowance_code, a.code) as allowance_code,
              COALESCE(sa.custom_type, a.type) as type,
              COALESCE(sa.custom_calculation_basis, a.calculation_basis, 'basic') as calculation_basis,
              COALESCE(sa.custom_is_taxable, a.is_taxable, true) as is_taxable,
              a.excluded_grades,
              a.excluded_employment_types
       FROM staff_allowances sa
       LEFT JOIN allowances a ON sa.allowance_id = a.id
       WHERE sa.staff_id = $1 AND sa.status = 'active'
         AND sa.effective_from <= TO_DATE($2 || '-01', 'YYYY-MM-DD')
         AND (sa.effective_to IS NULL OR sa.effective_to >= TO_DATE($2 || '-01', 'YYYY-MM-DD'))`,
      [staffId, month],
    );
    return { globalAllowances, staffAllowances };
  }

  private async getManualArrearsDeductionDefinitions(staffId: string, month: string) {
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true AND code != 'TAX'`,
    );
    const staffDeductions = await this.databaseService.query(
      `SELECT sd.*,
              COALESCE(sd.custom_deduction_name, d.name) as deduction_name,
              COALESCE(sd.custom_deduction_code, d.code) as deduction_code,
              COALESCE(sd.custom_type, d.type) as type,
              COALESCE(sd.custom_calculation_basis, d.calculation_basis, 'basic') as calculation_basis,
              d.is_paye_relief,
              d.is_statutory,
              d.excluded_grades,
              d.excluded_employment_types
       FROM staff_deductions sd
       LEFT JOIN deductions d ON sd.deduction_id = d.id
       WHERE sd.staff_id = $1 AND sd.status = 'active'
         AND sd.effective_from <= TO_DATE($2 || '-01', 'YYYY-MM-DD')
         AND (sd.effective_to IS NULL OR sd.effective_to >= TO_DATE($2 || '-01', 'YYYY-MM-DD'))`,
      [staffId, month],
    );
    return { globalDeductions, staffDeductions };
  }

  private async calculateManualSalaryArrears(staffId: string, effectiveStartDate: any, effectiveEndDate: any) {
    if (!this.salaryLookupService || !this.payeCalculator) {
      throw new BadRequestException('Manual salary arrears calculation is unavailable. Please contact an administrator.');
    }
    const start = this.parseDateOnly(effectiveStartDate, 'Effective start date');
    const end = this.parseDateOnly(effectiveEndDate, 'Effective end date');
    if (start.date > end.date) {
      throw new BadRequestException('Effective end date must be on or after the effective start date.');
    }

    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [staffId]);
    if (!staff) throw new NotFoundException(`Staff with ID ${staffId} not found`);

    const basicSalary = await this.salaryLookupService.getBasicSalary(staff.grade_level, staff.step);
    const adjustedBasicSalary = this.roundCurrency(basicSalary * (staff.status === 'interdiction' ? 0.5 : 1));
    const systemSettings = await this.databaseService.queryOne(
      `SELECT tax_configuration FROM system_settings WHERE key = 'general_settings'`,
    );
    const taxConfig = systemSettings?.tax_configuration || {};
    const isContractStaff = staff.employment_type === 'Contract';
    const monthRanges = this.getManualArrearsMonthRanges(start.date, end.date);
    const details: any[] = [];

    for (const range of monthRanges) {
      const { globalAllowances, staffAllowances } = await this.getManualArrearsAllowanceDefinitions(staff.id, range.month);
      const monthlyAllowances: any[] = [];
      let totalMonthlyAllowances = 0;

      const addAllowance = (allowance: any, isStaffSpecific: boolean) => {
        if (this.isExcludedFromManualArrears(allowance, staff)) return;
        const code = isStaffSpecific ? allowance.allowance_code : allowance.code;
        const name = isStaffSpecific ? allowance.allowance_name : allowance.name;
        const basis = String(allowance.calculation_basis || 'basic').toLowerCase() === 'gross' ? 'gross' : 'basic';
        const type = String(allowance.type || '').toLowerCase();
        let amount = 0;
        if (type === 'fixed') amount = this.roundCurrency(Number(allowance.amount || 0));
        if (type === 'percentage' && basis === 'basic') {
          amount = this.roundCurrency((adjustedBasicSalary * Number(allowance.percentage || 0)) / 100);
        }
        if (amount <= 0) return;
        monthlyAllowances.push({
          code,
          name,
          type,
          percentage: type === 'percentage' ? Number(allowance.percentage || 0) : null,
          calculation_basis: basis,
          is_taxable: allowance.is_taxable !== false,
          monthly_amount: amount,
        });
        totalMonthlyAllowances += amount;
      };

      for (const allowance of globalAllowances) addAllowance(allowance, false);
      for (const allowance of staffAllowances) addAllowance(allowance, true);

      // Match payroll's configured gross basis: basic plus fixed/basic-based
      // allowances, before adding any percentage-of-gross allowances.
      const allowanceGrossBase = this.roundCurrency(adjustedBasicSalary + totalMonthlyAllowances);
      const addGrossAllowance = (allowance: any, isStaffSpecific: boolean) => {
        if (this.isExcludedFromManualArrears(allowance, staff)) return;
        if (
          String(allowance.type || '').toLowerCase() !== 'percentage' ||
          String(allowance.calculation_basis || '').toLowerCase() !== 'gross'
        ) return;
        const amount = this.roundCurrency((allowanceGrossBase * Number(allowance.percentage || 0)) / 100);
        if (amount <= 0) return;
        monthlyAllowances.push({
          code: isStaffSpecific ? allowance.allowance_code : allowance.code,
          name: isStaffSpecific ? allowance.allowance_name : allowance.name,
          type: 'percentage',
          percentage: Number(allowance.percentage || 0),
          calculation_basis: 'gross',
          is_taxable: allowance.is_taxable !== false,
          monthly_amount: amount,
        });
        totalMonthlyAllowances += amount;
      };
      for (const allowance of globalAllowances) addGrossAllowance(allowance, false);
      for (const allowance of staffAllowances) addGrossAllowance(allowance, true);

      const monthlyGross = this.roundCurrency(adjustedBasicSalary + totalMonthlyAllowances);
      const monthlyAllowanceTotal = this.roundCurrency(totalMonthlyAllowances);
      const { globalDeductions, staffDeductions } = await this.getManualArrearsDeductionDefinitions(staff.id, range.month);
      const seenCodes = new Set<string>();
      const deductionItems: any[] = [];
      const monthlyPayeReliefs = { pension: 0, nhf: 0, nhia: 0 };
      const addDeduction = (deduction: any) => {
        if (this.isExcludedFromManualArrears(deduction, staff)) return;
        const code = String(deduction.code || deduction.deduction_code || '').trim();
        const normalizedCode = code.toUpperCase();
        if (!normalizedCode || normalizedCode === 'TAX' || seenCodes.has(normalizedCode)) return;
        seenCodes.add(normalizedCode);
        const name = deduction.name || deduction.deduction_name || code;
        const basis = String(deduction.calculation_basis || 'basic').toLowerCase() === 'gross' ? 'gross' : 'basic';
        const type = String(deduction.type || '').toLowerCase();
        const monthlyAmount = type === 'percentage'
          ? this.roundCurrency(((basis === 'gross' ? monthlyGross : adjustedBasicSalary) * Number(deduction.percentage || 0)) / 100)
          : type === 'fixed'
            ? this.roundCurrency(Number(deduction.amount || 0))
            : 0;
        if (monthlyAmount <= 0) return;
        const proratedAmount = this.roundCurrency(monthlyAmount * range.fraction);
        const reliefKind = this.getManualPayeReliefKind({ ...deduction, code, name });
        deductionItems.push({
          code: `${code}_MANUAL_ARREARS`,
          source_code: code,
          name: `${name} (Manual Arrears)`,
          amount: proratedAmount,
          monthly_amount: monthlyAmount,
          type,
          calculation_basis: basis,
          is_paye_relief: deduction.is_paye_relief === true,
          is_arrears_deduction: true,
        });
        if (reliefKind) monthlyPayeReliefs[reliefKind] += monthlyAmount;
      };
      for (const deduction of globalDeductions) addDeduction(deduction);
      for (const deduction of staffDeductions) addDeduction(deduction);

      const monthlyTax = this.payeCalculator.calculate(
        monthlyGross,
        monthlyAllowances.map((allowance) => ({
          code: allowance.code,
          name: allowance.name,
          amount: allowance.monthly_amount,
          is_taxable: allowance.is_taxable,
        })),
        taxConfig,
        isContractStaff,
        monthlyPayeReliefs.pension,
        monthlyPayeReliefs.nhf,
        monthlyPayeReliefs.nhia,
      ).monthly_tax;

      const basicAmount = this.roundCurrency(adjustedBasicSalary * range.fraction);
      const allowanceItems = monthlyAllowances.map((allowance) => ({
        ...allowance,
        amount: this.roundCurrency(allowance.monthly_amount * range.fraction),
      }));
      const grossAmount = this.roundCurrency(basicAmount + allowanceItems.reduce((sum, allowance) => sum + allowance.amount, 0));
      const payeAmount = this.roundCurrency(monthlyTax * range.fraction);
      const payeReliefs = {
        pension: this.roundCurrency(monthlyPayeReliefs.pension * range.fraction),
        nhf: this.roundCurrency(monthlyPayeReliefs.nhf * range.fraction),
        nhia: this.roundCurrency(monthlyPayeReliefs.nhia * range.fraction),
      };
      const totalDeductions = this.roundCurrency(deductionItems.reduce((sum, item) => sum + item.amount, 0));

      details.push({
        calculation_method: 'manual_salary_period_v1',
        month: range.month,
        effective_start_date: range.startDate,
        effective_end_date: range.endDate,
        eligible_days: range.eligibleDays,
        days_in_month: range.daysInMonth,
        month_fraction: Number(range.fraction.toFixed(8)),
        basic_amount: basicAmount,
        monthly_basic_salary: adjustedBasicSalary,
        allowances: allowanceItems,
        allowance_amount: this.roundCurrency(allowanceItems.reduce((sum, allowance) => sum + allowance.amount, 0)),
        monthly_allowance_amount: monthlyAllowanceTotal,
        gross_amount: grossAmount,
        monthly_gross: monthlyGross,
        amount: grossAmount,
        deductions: deductionItems,
        total_deductions: totalDeductions,
        paye_reliefs: payeReliefs,
        monthly_paye: this.roundCurrency(monthlyTax),
        paye_amount: payeAmount,
        net_amount: this.roundCurrency(grossAmount - totalDeductions - payeAmount),
      });
    }

    const sum = (key: string) => this.roundCurrency(details.reduce((total, item) => total + Number(item[key] || 0), 0));
    const totalGross = sum('gross_amount');
    const totalDeductions = sum('total_deductions');
    const totalPaye = sum('paye_amount');
    return {
      staff,
      effectiveStartDate: start.raw,
      effectiveEndDate: end.raw,
      monthsOwed: details.length,
      details,
      totalBasic: sum('basic_amount'),
      totalAllowances: sum('allowance_amount'),
      totalGross,
      totalDeductions,
      totalPaye,
      totalNet: this.roundCurrency(totalGross - totalDeductions - totalPaye),
    };
  }

  async previewManualSalaryArrears(data: any) {
    if (!data?.staffId) throw new BadRequestException('Staff member is required.');
    return this.calculateManualSalaryArrears(data.staffId, data.effectiveStartDate, data.effectiveEndDate);
  }

  private buildMonthlyBreakdown(
    effectiveDate: any,
    monthsOwed: number,
    firstMonthAmount: number,
    recurringAmount: number,
    basicFirstMonthAmount = firstMonthAmount,
    basicRecurringAmount = recurringAmount,
  ) {
    const { year, month } = this.getBusinessDateParts(effectiveDate);
    const details: Array<{ month: string; amount: number; basic_amount?: number }> = [];

    for (let index = 0; index < monthsOwed; index += 1) {
      const monthDate = new Date(Date.UTC(year, month - 1 + index, 1));
      const amount = index === 0 ? firstMonthAmount : recurringAmount;

      details.push({
        month: this.buildMonthKey(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1),
        amount: this.roundCurrency(amount),
        basic_amount: this.roundCurrency(index === 0 ? basicFirstMonthAmount : basicRecurringAmount),
      });
    }

    return details;
  }

  private getArrearsDisplayLabel(arrears: any) {
    const staffName = String(arrears?.staff_name || '').trim();
    const staffNumber = String(arrears?.staff_number || '').trim();
    return staffName || staffNumber || String(arrears?.id || 'Arrears');
  }

  private async getBulkActionableArrears(
    arrearsIds: string[],
    requiredStatus: 'pending' | 'approved' = 'pending',
  ) {
    const uniqueIds = Array.from(new Set((arrearsIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Select at least one arrears record.');
    }

    const arrearsRecords = await this.databaseService.query(
      `SELECT a.*, s.first_name || ' ' || s.last_name as staff_name, s.staff_number, s.status as staff_status
       FROM arrears a
       JOIN staff s ON a.staff_id = s.id
       WHERE a.id = ANY($1::uuid[])`,
      [uniqueIds],
    );

    const recordMap = new Map(arrearsRecords.map((record: any) => [String(record.id), record]));
    const actionableArrears: any[] = [];
    const failures: Array<{ id: string; staff_name?: string; staff_number?: string; reason: string }> = [];

    for (const arrearsId of uniqueIds) {
      const arrears = recordMap.get(String(arrearsId));
      if (!arrears) {
        failures.push({ id: arrearsId, reason: 'Record not found.' });
        continue;
      }

      if (arrears.status !== requiredStatus) {
        failures.push({
          id: arrearsId,
          staff_name: arrears.staff_name,
          staff_number: arrears.staff_number,
          reason: `Only ${requiredStatus} arrears can be bulk processed. Current status: ${arrears.status}.`,
        });
        continue;
      }

      actionableArrears.push(arrears);
    }

    return {
      totalRequested: uniqueIds.length,
      actionableArrears,
      failures,
    };
  }

  private async processBulkArrearsBatch(
    arrearsRecords: any[],
    processor: (arrears: any) => Promise<any>,
  ) {
    const successes: Array<{ id: string; staff_name?: string; staff_number?: string }> = [];
    const failures: Array<{ id: string; staff_name?: string; staff_number?: string; reason: string }> = [];

    const results = await Promise.allSettled(
      arrearsRecords.map(async (arrears) => {
        await processor(arrears);
        return arrears;
      }),
    );

    results.forEach((result, index) => {
      const arrears = arrearsRecords[index];
      if (result.status === 'fulfilled') {
        successes.push({
          id: arrears.id,
          staff_name: arrears.staff_name,
          staff_number: arrears.staff_number,
        });
        return;
      }

      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason || 'Unknown error');
      failures.push({
        id: arrears.id,
        staff_name: arrears.staff_name,
        staff_number: arrears.staff_number,
        reason,
      });
    });

    return { successes, failures };
  }

  /**
   * Create manual arrears/adjustment
   */
  async createArrears(data: any, userId: string) {
    if (data?.effectiveStartDate !== undefined || data?.effectiveEndDate !== undefined) {
      return this.createCalculatedManualArrears(data, userId);
    }

    const {
      staffId, reason, amount, basicAmount: requestedBasicAmount, grossAmount: requestedGrossAmount, effectiveDate,
      monthsOwed = 1, description
    } = data;
    const hasNewAmountFields = requestedBasicAmount !== undefined || requestedGrossAmount !== undefined;
    const grossArrears = this.parseCurrencyAmount(
      requestedGrossAmount ?? (hasNewAmountFields ? undefined : amount),
    );
    const basicArrears = this.parseCurrencyAmount(
      requestedBasicAmount ?? (hasNewAmountFields ? undefined : amount),
    );

    if (grossArrears <= 0) {
      throw new BadRequestException('Gross arrears must be greater than zero');
    }
    if (basicArrears < 0) {
      throw new BadRequestException('Basic arrears cannot be negative');
    }
    if (basicArrears > grossArrears) {
      throw new BadRequestException('Basic arrears cannot exceed gross arrears');
    }

    const duplicate = await this.findDuplicateArrearsForCreate(staffId, reason, effectiveDate, effectiveDate);
    if (duplicate) {
      throw new BadRequestException('Duplicate arrears already exists for this staff and period. Review the existing entry before creating another one.');
    }

    // Get staff details
    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [staffId]);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${staffId} not found`);
    }

    // Prepare details JSON
    const { year, month } = this.getBusinessDateParts(effectiveDate);
    const details = [{
      month: this.buildMonthKey(year, month),
      amount: grossArrears,
      gross_amount: grossArrears,
      basic_amount: basicArrears,
      description: description || 'Manual Adjustment'
    }];

    const totalArrears = grossArrears;
    const staffName = this.getStaffName(staff);

    const arrearsRecord = await this.databaseService.queryOne(
      `INSERT INTO arrears (
        staff_id, reason, old_salary, new_salary, 
        old_basic_salary, new_basic_salary,
        effective_date, months_owed, total_arrears, 
        status, details, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        staffId, reason || 'other', 
        staff.current_basic_salary || 0, staff.current_basic_salary || 0, // No salary change implies same salary
        staff.current_basic_salary || 0, staff.current_basic_salary || 0,
        effectiveDate, monthsOwed, totalArrears,
        'pending', JSON.stringify(details), userId
      ]
    );

    await Promise.all(
      ['admin', 'payroll_officer'].map((role) =>
        this.notificationsService.createRoleNotification({
          role,
          type: NotificationType.ARREARS,
          category: NotificationCategory.ACTION_REQUIRED,
          title: 'Arrears approval required',
          message: staffName
            ? `Manual arrears for ${staffName} is pending approval (${totalArrears.toFixed(2)}).`
            : `Manual arrears is pending approval (${totalArrears.toFixed(2)}).`,
          link: '/arrears',
          entity_type: 'arrears',
          entity_id: arrearsRecord?.id,
          priority: NotificationPriority.HIGH,
          action_label: 'Review',
          action_link: '/arrears',
          created_by: userId,
          metadata: { arrears_id: arrearsRecord?.id, staff_id: staffId },
        }),
      ),
    );

    this.logger.log(`Manual arrears created for staff ${staff.staff_number} by user ${userId}`);
    return { message: 'Arrears created successfully' };
  }

  private async createCalculatedManualArrears(data: any, userId: string) {
    if (!data?.staffId) throw new BadRequestException('Staff member is required.');
    if (data.reason === 'promotion') {
      throw new BadRequestException('Promotion arrears must use the promotion arrears workflow.');
    }

    const duplicate = await this.findDuplicateArrearsForCreate(
      data.staffId,
      data.reason || 'salary_adjustment',
      data.effectiveStartDate,
      data.effectiveEndDate,
    );
    if (duplicate) {
      throw new BadRequestException('Duplicate arrears already exists for this staff and period. Review the existing entry before creating another one.');
    }

    const calculation = await this.calculateManualSalaryArrears(
      data.staffId,
      data.effectiveStartDate,
      data.effectiveEndDate,
    );
    const { staff } = calculation;
    const reason = data.reason || 'salary_adjustment';
    const description = String(data.description || '').trim();
    const details = calculation.details.map((item) => ({
      ...item,
      ...(description ? { description } : {}),
    }));
    const totalArrears = calculation.totalGross;
    const arrearsRecord = await this.databaseService.queryOne(
      `INSERT INTO arrears (
        staff_id, reason, old_salary, new_salary,
        old_basic_salary, new_basic_salary,
        effective_date, effective_end_date, months_owed, total_arrears,
        status, details, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.staffId,
        reason,
        calculation.details[0]?.monthly_gross || 0,
        calculation.details[0]?.monthly_gross || 0,
        calculation.details[0]?.monthly_basic_salary || 0,
        calculation.details[0]?.monthly_basic_salary || 0,
        calculation.effectiveStartDate,
        calculation.effectiveEndDate,
        calculation.monthsOwed,
        totalArrears,
        'pending',
        JSON.stringify(details),
        userId,
      ],
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
            ? `Manual salary arrears for ${staffName} is pending approval (${totalArrears.toFixed(2)}).`
            : `Manual salary arrears is pending approval (${totalArrears.toFixed(2)}).`,
          link: '/arrears',
          entity_type: 'arrears',
          entity_id: arrearsRecord?.id,
          priority: NotificationPriority.HIGH,
          action_label: 'Review',
          action_link: '/arrears',
          created_by: userId,
          metadata: { arrears_id: arrearsRecord?.id, staff_id: data.staffId },
        }),
      ),
    );

    this.logger.log(`Calculated manual arrears created for staff ${staff.staff_number} by user ${userId}`);
    return {
      message: 'Arrears created successfully',
      arrears: arrearsRecord,
      calculation: {
        total_basic: calculation.totalBasic,
        total_allowances: calculation.totalAllowances,
        total_gross: calculation.totalGross,
        total_deductions: calculation.totalDeductions,
        total_paye: calculation.totalPaye,
        total_net: calculation.totalNet,
      },
    };
  }

  /**
   * Delete arrears (only if pending)
   */
  async deleteArrears(id: string, userId: string) {
    return this.databaseService.transaction(async (client) => {
      const arrearsResult = await client.query('SELECT * FROM arrears WHERE id = $1 FOR UPDATE', [id]);
      const arrears = arrearsResult.rows[0];

      if (!arrears) {
        throw new NotFoundException(`Arrears record with ID ${id} not found`);
      }

      const isManualArrears = String(arrears.reason || '').trim().toLowerCase() !== 'promotion';

      if (arrears.status === 'pending') {
        await client.query('DELETE FROM arrears WHERE id = $1 AND status = $2', [id, 'pending']);
        this.logger.log(`${isManualArrears ? 'Manual ' : ''}arrears ${id} deleted by user ${userId}`);
        return { message: `${isManualArrears ? 'Manual ' : ''}Arrears deleted successfully` };
      }

      if (arrears.status === 'processed') {
        if (!arrears.payroll_batch_id) {
          throw new BadRequestException('Processed arrears without a payroll batch cannot be deleted safely.');
        }

        const batchResult = await client.query(
          'SELECT id, status FROM payroll_batches WHERE id = $1 FOR UPDATE',
          [arrears.payroll_batch_id],
        );
        const payrollBatch = batchResult.rows[0];

        if (!payrollBatch) {
          throw new NotFoundException(`Payroll batch with ID ${arrears.payroll_batch_id} not found`);
        }

        if (payrollBatch.status !== 'draft') {
          throw new BadRequestException('Only processed arrears attached to a draft payroll batch can be deleted.');
        }

        await client.query(
          'DELETE FROM arrears WHERE id = $1 AND status = $2 AND payroll_batch_id = $3',
          [id, 'processed', payrollBatch.id],
        );
        this.logger.log(`Processed ${isManualArrears ? 'manual ' : ''}arrears ${id} deleted from draft batch ${payrollBatch.id} by user ${userId}`);
        return {
          message: isManualArrears
            ? 'Manual arrears deleted successfully. Regenerate payroll lines manually before submitting the draft batch.'
            : 'Arrears deleted successfully. Regenerate payroll lines to reflect the removal.',
        };
      }

      throw new BadRequestException('Only pending arrears or processed arrears attached to a draft payroll batch can be deleted.');
    });
  }

  /**
   * Get pending arrears
   */
  async getPendingArrears() {
    return this.databaseService.query(
      `SELECT a.*, s.first_name || ' ' || s.last_name as staff_name, s.staff_number, s.status as staff_status,
              s.grade_level as current_grade, s.step as current_step,
              p.old_grade_level as old_grade, p.new_grade_level as new_grade,
              p.old_step as old_step, p.new_step as new_step
       FROM arrears a
       JOIN staff s ON a.staff_id = s.id
       LEFT JOIN promotions p ON a.staff_id = p.staff_id 
           AND a.effective_date = p.promotion_date::date 
           AND a.reason = 'promotion'
       WHERE a.status IN ('pending', 'approved', 'rejected', 'processed')
       ORDER BY a.created_at DESC`
    );
  }

  /**
   * Approve arrears
   */
  async approveArrears(id: string, userId: string) {
    const arrears = await this.databaseService.queryOne('SELECT * FROM arrears WHERE id = $1', [id]);
    
    if (!arrears) {
      throw new NotFoundException(`Arrears record with ID ${id} not found`);
    }

    if (arrears.status !== 'pending') {
      throw new BadRequestException('Only pending arrears can be approved');
    }

    if (arrears.reason === 'promotion') {
      const staff = await this.databaseService.queryOne('SELECT status FROM staff WHERE id = $1', [arrears.staff_id]);
      const staffStatus = String(staff?.status || '').trim();
      if (staffStatus !== 'active') {
        throw new BadRequestException(`Cannot approve promotion: Staff is ${staffStatus || 'unknown'}.`);
      }
    }

    await this.databaseService.query(
      `UPDATE arrears SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    if (arrears.created_by) {
      const staff = await this.databaseService.queryOne('SELECT staff_number, first_name, last_name FROM staff WHERE id = $1', [arrears.staff_id]);
      const staffName = this.getStaffName(staff);
      await this.notificationsService.create({
        recipient_id: arrears.created_by,
        type: NotificationType.ARREARS,
        category: NotificationCategory.SUCCESS,
        title: 'Arrears approved',
        message: staffName ? `${staffName} arrears was approved.` : 'Arrears was approved.',
        link: '/arrears',
        entity_type: 'arrears',
        entity_id: arrears.id,
        priority: NotificationPriority.MEDIUM,
        action_label: 'View',
        action_link: '/arrears',
        created_by: userId,
        metadata: { arrears_id: arrears.id, staff_id: arrears.staff_id },
      });
    }

    this.logger.log(`Arrears ${id} approved by user ${userId}`);
    return { message: 'Arrears approved successfully' };
  }

  async rejectArrears(id: string, userId: string, reason?: string) {
    const arrears = await this.databaseService.queryOne('SELECT * FROM arrears WHERE id = $1', [id]);

    if (!arrears) {
      throw new NotFoundException(`Arrears record with ID ${id} not found`);
    }

    if (arrears.status !== 'pending') {
      throw new BadRequestException('Only pending arrears can be rejected');
    }

    const rejectionReason = String(reason || '').trim();
    await this.databaseService.query(
      `UPDATE arrears
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1`,
      [id],
    );

    if (arrears.created_by) {
      const staff = await this.databaseService.queryOne('SELECT staff_number, first_name, last_name FROM staff WHERE id = $1', [arrears.staff_id]);
      const staffName = this.getStaffName(staff);
      await this.notificationsService.create({
        recipient_id: arrears.created_by,
        type: NotificationType.ARREARS,
        category: NotificationCategory.WARNING,
        title: 'Arrears rejected',
        message: rejectionReason
          ? `${staffName ? `${staffName} arrears` : 'Arrears'} was rejected. Reason: ${rejectionReason}`
          : `${staffName ? `${staffName} arrears` : 'Arrears'} was rejected.`,
        link: '/arrears',
        entity_type: 'arrears',
        entity_id: arrears.id,
        priority: NotificationPriority.MEDIUM,
        action_label: 'View',
        action_link: '/arrears',
        created_by: userId,
        metadata: { arrears_id: arrears.id, staff_id: arrears.staff_id, reason: rejectionReason || undefined },
      });
    }

    this.logger.log(`Arrears ${id} rejected by user ${userId}`);
    return { message: 'Arrears rejected successfully' };
  }

  async bulkApproveArrears(arrearsIds: string[], userId: string) {
    const { actionableArrears, failures: initialFailures, totalRequested } = await this.getBulkActionableArrears(arrearsIds, 'pending');
    const { successes, failures: processingFailures } = await this.processBulkArrearsBatch(
      actionableArrears,
      (arrears) => this.approveArrears(arrears.id, userId),
    );
    const failures = [...initialFailures, ...processingFailures];

    return {
      message:
        failures.length > 0
          ? 'Bulk arrears approval completed with some failures.'
          : 'Bulk arrears approval completed successfully.',
      totalRequested,
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    };
  }

  async bulkRejectArrears(arrearsIds: string[], userId: string, reason?: string) {
    const { actionableArrears, failures: initialFailures, totalRequested } = await this.getBulkActionableArrears(arrearsIds, 'pending');
    const rejectionReason = String(reason || '').trim();
    const { successes, failures: processingFailures } = await this.processBulkArrearsBatch(
      actionableArrears,
      (arrears) => this.rejectArrears(arrears.id, userId, rejectionReason),
    );
    const failures = [...initialFailures, ...processingFailures];

    return {
      message:
        failures.length > 0
          ? 'Bulk arrears rejection completed with some failures.'
          : 'Bulk arrears rejection completed successfully.',
      totalRequested,
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    };
  }

  /**
   * Merge arrears to payroll
   */
  async mergeArrearsToPayroll(arrearsId: string, payrollBatchId: string, userId: string) {
    if (!payrollBatchId) {
      throw new BadRequestException('Please select a payroll batch.');
    }

    const payrollBatch = await this.databaseService.queryOne(
      'SELECT id, status, payroll_month, period_start, period_end FROM payroll_batches WHERE id = $1',
      [payrollBatchId],
    );
    if (!payrollBatch) {
      throw new NotFoundException(`Payroll batch with ID ${payrollBatchId} not found`);
    }
    if (payrollBatch.status !== 'draft') {
      throw new BadRequestException('Arrears can only be assigned to a draft payroll batch');
    }

    const arrearsForPeriodCheck = await this.databaseService.queryOne(
      'SELECT id, reason, effective_date, effective_end_date, details FROM arrears WHERE id = $1',
      [arrearsId],
    );
    let arrearsDetails: any[] = [];
    try {
      const parsedDetails = typeof arrearsForPeriodCheck?.details === 'string'
        ? JSON.parse(arrearsForPeriodCheck.details)
        : arrearsForPeriodCheck?.details;
      arrearsDetails = Array.isArray(parsedDetails) ? parsedDetails : [];
    } catch {
      arrearsDetails = [];
    }
    const isCalculatedManualArrears = arrearsDetails.some(
      (detail: any) => detail?.calculation_method === 'manual_salary_period_v1',
    );
    const isCalculatedPromotionArrears = arrearsDetails.some(
      (detail: any) => detail?.calculation_method === 'promotion_salary_period_v1',
    );
    const shouldCheckArrearsPeriod =
      (arrearsForPeriodCheck?.reason !== 'promotion' && isCalculatedManualArrears) ||
      (arrearsForPeriodCheck?.reason === 'promotion' && isCalculatedPromotionArrears);
    if (shouldCheckArrearsPeriod && arrearsForPeriodCheck.effective_end_date) {
      const toDateOnly = (value: any) => value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value || '').slice(0, 10);
      const batchMonth = String(payrollBatch.payroll_month || '').slice(0, 7);
      const payrollPeriodStart = toDateOnly(payrollBatch.period_start) || `${batchMonth}-01`;
      const payrollPeriodEnd = toDateOnly(payrollBatch.period_end) || (() => {
        const [year, month] = batchMonth.split('-').map(Number);
        return year && month
          ? this.getDateOnly(new Date(Date.UTC(year, month, 0)))
          : '';
      })();
      const arrearsStart = toDateOnly(arrearsForPeriodCheck.effective_date);
      const arrearsEnd = toDateOnly(arrearsForPeriodCheck.effective_end_date);
      if (
        payrollPeriodStart && payrollPeriodEnd && arrearsStart && arrearsEnd &&
        arrearsStart <= payrollPeriodEnd && arrearsEnd >= payrollPeriodStart
      ) {
        throw new BadRequestException(
          `Arrears period ${arrearsStart} to ${arrearsEnd} overlaps this payroll period. End the arrears period before ${payrollPeriodStart}; the current payroll handles these dates.`,
        );
      }
    }

    // Claim only unassigned, approved records; the conditional update prevents concurrent assignment.
    const assignedArrears = await this.databaseService.queryOne(
      `UPDATE arrears 
       SET status = 'processed', payroll_batch_id = $1, updated_at = NOW() 
       WHERE id = $2
         AND status = 'approved'
         AND payroll_batch_id IS NULL
       RETURNING id`,
      [payrollBatchId, arrearsId]
    );
    if (!assignedArrears) {
      const arrears = await this.databaseService.queryOne(
        'SELECT id, status, payroll_batch_id FROM arrears WHERE id = $1',
        [arrearsId],
      );
      if (!arrears) {
        throw new NotFoundException(`Arrears record with ID ${arrearsId} not found`);
      }
      if (arrears.payroll_batch_id) {
        throw new BadRequestException(
          `Arrears are already assigned to payroll batch ${arrears.payroll_batch_id}`,
        );
      }
      throw new BadRequestException('Only approved, unassigned arrears can be merged to payroll');
    }

    this.logger.log(`Arrears ${arrearsId} assigned to payroll batch ${payrollBatchId} by user ${userId}`);
    return { message: 'Arrears assigned to payroll batch successfully. Please regenerate payroll lines for this batch to reflect changes.' };
  }

  async bulkMergeArrearsToPayroll(arrearsIds: string[], payrollBatchId: string, userId: string) {
    if (!payrollBatchId) {
      throw new BadRequestException('Please select a payroll batch.');
    }

    const { actionableArrears, failures: initialFailures, totalRequested } = await this.getBulkActionableArrears(
      arrearsIds,
      'approved',
    );

    const { successes, failures: processingFailures } = await this.processBulkArrearsBatch(
      actionableArrears,
      (arrears) => this.mergeArrearsToPayroll(arrears.id, payrollBatchId, userId),
    );
    const failures = [...initialFailures, ...processingFailures];

    return {
      message:
        failures.length > 0
          ? 'Bulk arrears merge completed with some failures.'
          : 'Bulk arrears merge completed successfully.',
      totalRequested,
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures,
    };
  }

  /**
   * Recalculate arrears
   */
  async recalculateArrears(id: string, userId: string) {
    const arrears = await this.databaseService.queryOne('SELECT * FROM arrears WHERE id = $1', [id]);
    
    if (!arrears) {
      throw new NotFoundException(`Arrears record with ID ${id} not found`);
    }

    let details: any[] = [];
    try {
      const parsedDetails = typeof arrears.details === 'string' ? JSON.parse(arrears.details) : arrears.details;
      details = Array.isArray(parsedDetails) ? parsedDetails : [];
    } catch {
      details = [];
    }
    let totalArrears = this.roundCurrency(Number(arrears.total_arrears || 0));

    if (
      arrears.reason === 'promotion' &&
      details.some((item: any) => item?.calculation_method === 'promotion_salary_period_v1')
    ) {
      totalArrears = this.roundCurrency(
        details.reduce((sum: number, item: any) => sum + Number(item?.gross_amount || item?.amount || 0), 0),
      );
    } else if (arrears.reason === 'promotion') {
      const monthsOwed = Math.max(0, Number(arrears.months_owed || 0));
      const { year, month, day } = this.getBusinessDateParts(arrears.effective_date);
      const daysInEffectiveMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const eligibleDays = Math.max(0, daysInEffectiveMonth - (day - 1));
      const monthlyDifference = this.roundCurrency(
        Number(arrears.new_salary || 0) - Number(arrears.old_salary || 0),
      );
      const basicMonthlyDifference = this.roundCurrency(
        Number(arrears.new_basic_salary || 0) - Number(arrears.old_basic_salary || 0),
      );
      const dailyDifference = daysInEffectiveMonth > 0 ? monthlyDifference / daysInEffectiveMonth : 0;
      const basicDailyDifference = daysInEffectiveMonth > 0 ? basicMonthlyDifference / daysInEffectiveMonth : 0;
      const firstMonthAmount = this.roundCurrency(dailyDifference * eligibleDays);
      const basicFirstMonthAmount = this.roundCurrency(basicDailyDifference * eligibleDays);

      details = this.buildMonthlyBreakdown(
        arrears.effective_date,
        monthsOwed,
        firstMonthAmount,
        monthlyDifference,
        basicFirstMonthAmount,
        basicMonthlyDifference,
      );
      totalArrears = this.roundCurrency(
        details.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      );
    } else if (details.some((item: any) => item?.calculation_method === 'manual_salary_period_v1')) {
      if (arrears.effective_date && arrears.effective_end_date) {
        const existingDescription = details.find((item: any) => item?.description)?.description;
        const toDateOnly = (value: any) => value instanceof Date
          ? value.toISOString().slice(0, 10)
          : String(value || '').slice(0, 10);
        const calculation = await this.calculateManualSalaryArrears(
          arrears.staff_id,
          toDateOnly(arrears.effective_date),
          toDateOnly(arrears.effective_end_date),
        );
        details = calculation.details.map((item) => ({
          ...item,
          ...(existingDescription ? { description: existingDescription } : {}),
        }));
        totalArrears = calculation.totalGross;
      } else {
        totalArrears = this.roundCurrency(
          details.reduce((sum: number, item: any) => sum + Number(item?.gross_amount || item?.amount || 0), 0),
        );
      }
    } else if (arrears.effective_date) {
      const existingDetail = Array.isArray(details) ? details[0] : undefined;
      const description = existingDetail?.description || 'Manual Adjustment';
      const { year, month } = this.getBusinessDateParts(arrears.effective_date);
      details = [{
        month: this.buildMonthKey(year, month),
        amount: totalArrears,
        gross_amount: totalArrears,
        ...(existingDetail && Object.prototype.hasOwnProperty.call(existingDetail, 'basic_amount')
          ? { basic_amount: this.roundCurrency(Number(existingDetail.basic_amount || 0)) }
          : {}),
        description,
      }];
    }

    const updatedArrears = await this.databaseService.queryOne(
      `UPDATE arrears
       SET total_arrears = $1, details = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [totalArrears, JSON.stringify(details), id],
    );

    this.logger.log(`Arrears ${id} recalculated by user ${userId}`);
    return {
      message: 'Arrears recalculated successfully',
      amount: totalArrears,
      arrears: updatedArrears,
    };
  }
}
