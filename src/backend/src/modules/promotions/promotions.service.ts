import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { SalaryLookupService } from '../salary-structures/salary-lookup.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationPriority, NotificationType } from '../notifications/dto/notification.dto';
import { AuditService } from '@modules/audit/audit.service';
import { AuditAction } from '@modules/audit/dto/audit.dto';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);
  private readonly businessTimeZone = 'Africa/Lagos';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly salaryLookupService: SalaryLookupService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private roundCurrency(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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
    
    // Create promotion record
    const result = await this.databaseService.queryOne(
      `INSERT INTO promotions (
        staff_id, old_grade_level, old_step, old_basic_salary,
        new_grade_level, new_step, new_basic_salary,
        promotion_date, effective_date, promotion_type, remarks, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        staffId, staff.grade_level, staff.step, staff.current_basic_salary,
        newGradeLevel, newStep, newBasicSalary,
        effectiveDate, effectiveDate, promotionType || 'regular', remarks, status, userId
      ]
    );

    this.logger.log(`Promotion request created for staff ${staff.staff_number}`);

    const staffName = [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim() || staff.staff_number;

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
            message: `${staffName} (${staff.staff_number}) promotion to GL ${newGradeLevel}/Step ${newStep} is pending approval.`,
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

    await this.databaseService.query(
      `UPDATE promotions SET status = 'approved', approved_by = $1, approval_date = NOW(), updated_at = NOW() WHERE id = $2`,
      [userId, id]
    );

    const updatedPromotion = await this.databaseService.queryOne('SELECT * FROM promotions WHERE id = $1', [id]);

    const staff = await this.databaseService.queryOne('SELECT staff_number, first_name, last_name FROM staff WHERE id = $1', [promotion.staff_id]);
    const staffName = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ').trim() || staff?.staff_number || 'Staff';
    
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
        message: `${staffName} promotion was approved.`,
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

    await this.databaseService.query(
      `UPDATE promotions SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2`,
      [reason, id]
    );

    const updatedPromotion = await this.databaseService.queryOne('SELECT * FROM promotions WHERE id = $1', [id]);

    const staff = await this.databaseService.queryOne('SELECT staff_number, first_name, last_name FROM staff WHERE id = $1', [promotion.staff_id]);
    const staffName = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ').trim() || staff?.staff_number || 'Staff';
    
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'promotions',
      entityId: promotion.id,
      description: `Rejected promotion for ${staffName}`,
      oldValues: promotion,
      newValues: updatedPromotion,
    });

    if (promotion.created_by) {
      await this.notificationsService.create({
        recipient_id: promotion.created_by,
        type: NotificationType.PROMOTION,
        category: NotificationCategory.WARNING,
        title: 'Promotion rejected',
        message: `${staffName} promotion was rejected.`,
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

    return { message: 'Promotion rejected successfully' };
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

    // Update staff record
    await this.databaseService.query(
      `UPDATE staff 
       SET grade_level = $1, step = $2, current_basic_salary = $3, 
           last_promotion_date = $4, updated_at = NOW()
       WHERE id = $5`,
      [promotion.new_grade_level, promotion.new_step, promotion.new_basic_salary, promotion.promotion_date, staff.id]
    );

    this.logger.log(`Staff ${staff.staff_number} promoted to GL ${promotion.new_grade_level} Step ${promotion.new_step}`);

    // AUTOMATIC ARREARS CALCULATION
    try {
      if (!promotion.promotion_date) {
        this.logger.warn(`Promotion ${promotion.id} has no promotion_date, skipping arrears calculation.`);
        return;
      }

      const effectiveDateObj = new Date(promotion.promotion_date);
      // specific check for 1970 (null date converted)
      if (effectiveDateObj.getFullYear() === 1970) {
         this.logger.warn(`Promotion ${promotion.id} has invalid promotion_date (1970), skipping arrears calculation.`);
         return;
      }

      const effectiveParts = this.getBusinessDateParts(promotion.promotion_date);
      const todayParts = this.getBusinessDateParts(new Date());
      const currentMonth = new Date(Date.UTC(todayParts.year, todayParts.month - 1, 1));
      const effectiveMonth = new Date(Date.UTC(effectiveParts.year, effectiveParts.month - 1, 1));
      
      const monthsDiff = (currentMonth.getUTCFullYear() - effectiveMonth.getUTCFullYear()) * 12 + (currentMonth.getUTCMonth() - effectiveMonth.getUTCMonth());
      
      if (monthsDiff > 0) {
        this.logger.log(`Detecting arrears for staff ${staff.id}. Effective: ${promotion.promotion_date}, Months: ${monthsDiff}`);
        
        // Calculate Old Basic Salary based on current Grade/Step (don't rely on stored current_basic_salary which might be stale)
        let oldBasicSalary: number;
        try {
          oldBasicSalary = await this.salaryLookupService.getBasicSalary(staff.grade_level, staff.step);
        } catch (error) {
          // Fallback to stored salary if lookup fails
          this.logger.warn(`Could not lookup old salary for staff ${staff.id} (GL${staff.grade_level}/${staff.step}). Using stored value.`);
          oldBasicSalary = parseFloat(staff.current_basic_salary || '0');
        }

        const newBasicSalaryFloat = parseFloat(promotion.new_basic_salary);

        // Calculate gross salaries (Basic + Allowances)
        const oldGrossSalary = await this.calculateGrossSalary(staff.id, oldBasicSalary, staff.grade_level);
        const newGrossSalary = await this.calculateGrossSalary(staff.id, newBasicSalaryFloat, promotion.new_grade_level);

        // Calculate deductions (excluding TAX)
        const oldDeductions = await this.calculateTotalDeductions(staff.id, oldBasicSalary, staff.grade_level);
        const newDeductions = await this.calculateTotalDeductions(staff.id, newBasicSalaryFloat, promotion.new_grade_level);

        // Calculate Net Salary (Before Tax) for arrears purposes
        const oldNetSalary = oldGrossSalary - oldDeductions;
        const newNetSalary = newGrossSalary - newDeductions;
        
        const monthlyDifference = newNetSalary - oldNetSalary;
        
        if (monthlyDifference > 0) {
          const daysInEffectiveMonth = new Date(Date.UTC(effectiveParts.year, effectiveParts.month, 0)).getUTCDate();
          const effectiveDay = effectiveParts.day;
          const eligibleDays = Math.max(0, daysInEffectiveMonth - (effectiveDay - 1));
          const dailyDifference = monthlyDifference / daysInEffectiveMonth;
          const proratedFirstMonth = this.roundCurrency(dailyDifference * eligibleDays);
          const fullMonthsAfter = Math.max(0, monthsDiff - 1);
          const roundedMonthlyDifference = this.roundCurrency(monthlyDifference);
          const totalArrears = this.roundCurrency(proratedFirstMonth + (roundedMonthlyDifference * fullMonthsAfter));
          
          const details = [];
          for (let i = 0; i < monthsDiff; i++) {
            const monthDate = new Date(Date.UTC(effectiveParts.year, effectiveParts.month - 1 + i, 1));
            const monthStr = this.buildMonthKey(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1);
            const amount = i === 0 ? proratedFirstMonth : roundedMonthlyDifference;
            details.push({
              month: monthStr,
              amount: this.roundCurrency(amount)
            });
          }
          
          const arrearsRecord = await this.databaseService.queryOne(
            `INSERT INTO arrears (
              staff_id, reason, old_salary, new_salary, 
              old_basic_salary, new_basic_salary,
              effective_date, months_owed, total_arrears, 
              status, details, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
              staff.id, 'promotion', oldNetSalary, newNetSalary,
              oldBasicSalary, newBasicSalaryFloat,
              promotion.promotion_date, monthsDiff, totalArrears,
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
                message: `Promotion arrears for ${staff.staff_number} is pending approval (${totalArrears.toFixed(2)}).`,
                link: '/arrears',
                entity_type: 'arrears',
                entity_id: arrearsRecord?.id,
                priority: NotificationPriority.HIGH,
                action_label: 'Review',
                action_link: '/arrears',
                created_by: userId,
                metadata: { arrears_id: arrearsRecord?.id, staff_id: staff.id, promotion_id: promotionId },
              }),
            ),
          );

          // Mark promotion as having arrears calculated
          await this.databaseService.query(
            `UPDATE promotions SET arrears_calculated = true WHERE id = $1`,
            [promotionId]
          );
          
          this.logger.log(`Arrears record created for ${staff.staff_number}: ₦${totalArrears} for ${monthsDiff} months`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to calculate/insert arrears: ${error.message}`, error.stack);
    }
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
    newGradeLevel: number,
    newStep: number,
    effectiveDate: string,
    oldGradeLevel?: number,
    oldStep?: number,
  ) {
    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [staffId]);
    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffId} does not exist.`);
    }

    // Calculate Old Basic Salary based on current Grade/Step (don't rely on stored current_basic_salary which might be stale)
    let oldBasicSalary: number;
    try {
      const gradeLevel = typeof oldGradeLevel === 'number' ? oldGradeLevel : staff.grade_level;
      const stepLevel = typeof oldStep === 'number' ? oldStep : staff.step;
      oldBasicSalary = await this.salaryLookupService.getBasicSalary(gradeLevel, stepLevel);
    } catch (error) {
      // Fallback to stored salary if lookup fails (e.g. old grade not in current structure)
      this.logger.warn(`Could not lookup old salary for staff ${staffId} (GL${staff.grade_level}/${staff.step}). Using stored value.`);
      oldBasicSalary = parseFloat(staff.current_basic_salary || '0');
    }
    
    // Get new basic salary
    let newBasicSalary: number;
    try {
      newBasicSalary = await this.salaryLookupService.getBasicSalary(newGradeLevel, newStep);
    } catch (error) {
      throw new NotFoundException(`Could not determine salary for Grade ${newGradeLevel} Step ${newStep}.`);
    }

    const oldContextGrade = typeof oldGradeLevel === 'number' ? oldGradeLevel : staff.grade_level;
    const newContextGrade = newGradeLevel;
    const oldAllowances = await this.calculateAllowanceBreakdown(staffId, oldBasicSalary, oldContextGrade);
    const newAllowances = await this.calculateAllowanceBreakdown(staffId, newBasicSalary, newContextGrade);
    const oldGrossSalary = oldBasicSalary + oldAllowances.total;
    const newGrossSalary = newBasicSalary + newAllowances.total;
    
    const oldDeductions = await this.calculateDeductionBreakdown(staffId, oldBasicSalary, oldContextGrade);
    const newDeductions = await this.calculateDeductionBreakdown(staffId, newBasicSalary, newContextGrade);

    const oldNetSalary = oldGrossSalary - oldDeductions.total;
    const newNetSalary = newGrossSalary - newDeductions.total;

    // Calculate Difference
    const monthlyDifference = newNetSalary - oldNetSalary;
    
    // Calculate Months Owed
    const effectiveParts = this.getBusinessDateParts(effectiveDate);
    const effectiveMonth = new Date(Date.UTC(effectiveParts.year, effectiveParts.month - 1, 1));
    const todayParts = this.getBusinessDateParts(new Date());
    const currentMonth = new Date(Date.UTC(todayParts.year, todayParts.month - 1, 1));
    const monthsDiff = (currentMonth.getUTCFullYear() - effectiveMonth.getUTCFullYear()) * 12 + (currentMonth.getUTCMonth() - effectiveMonth.getUTCMonth());
    
    const safeMonthsDiff = Math.max(0, monthsDiff);
    let totalArrears = 0;
    let proratedFirstMonth = 0;
    let fullMonthsAfter = 0;
    if (monthlyDifference > 0 && safeMonthsDiff > 0) {
      const daysInEffectiveMonth = new Date(Date.UTC(effectiveParts.year, effectiveParts.month, 0)).getUTCDate();
      const effectiveDay = effectiveParts.day;
      const eligibleDays = Math.max(0, daysInEffectiveMonth - (effectiveDay - 1));
      const dailyDifference = monthlyDifference / daysInEffectiveMonth;
      proratedFirstMonth = this.roundCurrency(dailyDifference * eligibleDays);
      fullMonthsAfter = Math.max(0, safeMonthsDiff - 1);
      totalArrears = this.roundCurrency(proratedFirstMonth + (this.roundCurrency(monthlyDifference) * fullMonthsAfter));
    }

    return {
      oldBasicSalary,
      newBasicSalary,
      oldNetSalary,
      newNetSalary,
      monthlyDifference,
      monthsDiff: safeMonthsDiff,
      proratedFirstMonth,
      fullMonthsAfter,
      totalArrears,
      oldGrossSalary,
      newGrossSalary,
      oldAllowances,
      newAllowances,
      oldDeductions,
      newDeductions,
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
  async getAll() {
    try {
      return await this.databaseService.query(
        `SELECT p.*, s.first_name, s.last_name, s.staff_number
         FROM promotions p
         JOIN staff s ON p.staff_id = s.id
         ORDER BY p.created_at DESC
         LIMIT 100`
      );
    } catch (error) {
      return [];
    }
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
   * Calculate total deductions (Global + Staff, excluding TAX)
   */
  private async calculateTotalDeductions(staffId: string, basicSalary: number, gradeLevel?: string | number): Promise<number> {
    const staffMember = await this.getPayrollContextStaff(staffId, gradeLevel);
    // 1. Get Global Deductions (applies_to_all = true)
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true AND code != 'TAX'`
    );

    // 2. Get Staff Specific Deductions
    const staffDeductions = await this.databaseService.query(
      `SELECT sd.*,
              COALESCE(sd.custom_type, d.type) as deduction_type,
              COALESCE(sd.custom_calculation_basis, d.calculation_basis, 'basic') as calculation_basis,
              d.percentage as global_percentage
       FROM staff_deductions sd
       LEFT JOIN deductions d ON sd.deduction_id = d.id
       WHERE sd.status = 'active'
         AND sd.staff_id = $1
         AND UPPER(COALESCE(sd.custom_deduction_code, d.code, '')) != 'TAX'`,
      [staffId]
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

    // Calculate Staff Specific Deductions
    for (const deduction of staffDeductions) {
      const type = deduction.deduction_type;
      
      if (type === 'percentage') {
        totalDeductions += this.calculatePercentageAmount(
          deduction.percentage,
          basicSalary,
          grossSalary,
          deduction.calculation_basis,
        );
      } else if (type === 'fixed') {
        const amt = deduction.amount ? parseFloat(deduction.amount) : 0;
        totalDeductions += amt;
      }
    }

    return totalDeductions;
  }

  private async calculateAllowanceBreakdown(
    staffId: string,
    basicSalary: number,
    gradeLevel?: string | number,
  ): Promise<{ total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string }> }> {
    const staffMember = await this.getPayrollContextStaff(staffId, gradeLevel);
    const globalAllowances = await this.databaseService.query(
      `SELECT * FROM allowances WHERE status = 'active' AND applies_to_all = true`,
    );

    const staffAllowances = await this.databaseService.query(
      `SELECT sa.*,
              COALESCE(sa.custom_type, a.type) as allowance_type,
              COALESCE(sa.custom_calculation_basis, a.calculation_basis, 'basic') as calculation_basis,
              a.percentage as global_percentage,
              COALESCE(sa.custom_allowance_name, a.name) as allowance_name,
              COALESCE(sa.custom_allowance_code, a.code) as allowance_code
       FROM staff_allowances sa
       LEFT JOIN allowances a ON sa.allowance_id = a.id
       WHERE sa.status = 'active' AND sa.staff_id = $1`,
      [staffId],
    );

    const items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string }> = [];
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
        });
        total += amount;
      }
    }

    return { total, items };
  }

  private async calculateDeductionBreakdown(
    staffId: string,
    basicSalary: number,
    gradeLevel?: string | number,
  ): Promise<{ total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string }> }> {
    const staffMember = await this.getPayrollContextStaff(staffId, gradeLevel);
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true AND code != 'TAX'`,
    );

    const staffDeductions = await this.databaseService.query(
      `SELECT sd.*,
              COALESCE(sd.custom_type, d.type) as deduction_type,
              COALESCE(sd.custom_calculation_basis, d.calculation_basis, 'basic') as calculation_basis,
              d.percentage as global_percentage,
              COALESCE(sd.custom_deduction_name, d.name) as deduction_name,
              COALESCE(sd.custom_deduction_code, d.code) as deduction_code
       FROM staff_deductions sd
       LEFT JOIN deductions d ON sd.deduction_id = d.id
       WHERE sd.status = 'active'
         AND sd.staff_id = $1
         AND UPPER(COALESCE(sd.custom_deduction_code, d.code, '')) != 'TAX'`,
      [staffId],
    );

    const items: Array<{ code: string; name: string; amount: number; type: string; source: string; calculation_basis?: string }> = [];
    let total = 0;
    const grossSalary = await this.calculateGrossSalary(staffId, basicSalary, gradeLevel);

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
        });
        total += amount;
      }
    }

    for (const deduction of staffDeductions) {
      const type = deduction.deduction_type;
      let amount = 0;
      if (type === 'percentage') {
        amount = this.calculatePercentageAmount(
          deduction.percentage,
          basicSalary,
          grossSalary,
          deduction.calculation_basis,
        );
      } else if (type === 'fixed') {
        amount = deduction.amount ? parseFloat(deduction.amount) : 0;
      }
      if (amount) {
        items.push({
          code: deduction.deduction_code,
          name: deduction.deduction_name,
          amount,
          type,
          calculation_basis: this.normalizeCalculationBasis(deduction.calculation_basis),
          source: 'staff',
        });
        total += amount;
      }
    }

    return { total, items };
  }
}
