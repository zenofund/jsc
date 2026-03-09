import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { SalaryLookupService } from '../salary-structures/salary-lookup.service';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly salaryLookupService: SalaryLookupService
  ) {}

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

    await this.processPromotionApproval(id, userId);

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

    return { message: 'Promotion rejected successfully' };
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

      const today = new Date();
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const effectiveMonth = new Date(effectiveDateObj.getFullYear(), effectiveDateObj.getMonth(), 1);
      
      const monthsDiff = (currentMonth.getFullYear() - effectiveMonth.getFullYear()) * 12 + (currentMonth.getMonth() - effectiveMonth.getMonth());
      
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
        const oldGrossSalary = await this.calculateGrossSalary(staff.id, oldBasicSalary);
        const newGrossSalary = await this.calculateGrossSalary(staff.id, newBasicSalaryFloat);

        // Calculate deductions (excluding TAX)
        const oldDeductions = await this.calculateTotalDeductions(staff.id, oldBasicSalary);
        const newDeductions = await this.calculateTotalDeductions(staff.id, newBasicSalaryFloat);

        // Calculate Net Salary (Before Tax) for arrears purposes
        const oldNetSalary = oldGrossSalary - oldDeductions;
        const newNetSalary = newGrossSalary - newDeductions;
        
        const monthlyDifference = newNetSalary - oldNetSalary;
        
        if (monthlyDifference > 0) {
          const daysInEffectiveMonth = new Date(effectiveMonth.getFullYear(), effectiveMonth.getMonth() + 1, 0).getDate();
          const effectiveDay = effectiveDateObj.getDate();
          const eligibleDays = Math.max(0, daysInEffectiveMonth - (effectiveDay - 1));
          const dailyDifference = monthlyDifference / daysInEffectiveMonth;
          const proratedFirstMonth = dailyDifference * eligibleDays;
          const fullMonthsAfter = Math.max(0, monthsDiff - 1);
          const totalArrears = proratedFirstMonth + (monthlyDifference * fullMonthsAfter);
          
          const details = [];
          for (let i = 0; i < monthsDiff; i++) {
            const monthDate = new Date(effectiveMonth.getFullYear(), effectiveMonth.getMonth() + i, 1);
            const monthStr = monthDate.toISOString().substring(0, 7);
            const amount = i === 0 ? proratedFirstMonth : monthlyDifference;
            details.push({
              month: monthStr,
              amount
            });
          }
          
          await this.databaseService.query(
            `INSERT INTO arrears (
              staff_id, reason, old_salary, new_salary, 
              old_basic_salary, new_basic_salary,
              effective_date, months_owed, total_arrears, 
              status, details, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              staff.id, 'promotion', oldNetSalary, newNetSalary,
              oldBasicSalary, newBasicSalaryFloat,
              promotion.promotion_date, monthsDiff, totalArrears,
              'pending', JSON.stringify(details), userId
            ]
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

    const oldAllowances = await this.calculateAllowanceBreakdown(staffId, oldBasicSalary);
    const newAllowances = await this.calculateAllowanceBreakdown(staffId, newBasicSalary);
    const oldGrossSalary = oldBasicSalary + oldAllowances.total;
    const newGrossSalary = newBasicSalary + newAllowances.total;
    
    const oldDeductions = await this.calculateDeductionBreakdown(staffId, oldBasicSalary);
    const newDeductions = await this.calculateDeductionBreakdown(staffId, newBasicSalary);

    const oldNetSalary = oldGrossSalary - oldDeductions.total;
    const newNetSalary = newGrossSalary - newDeductions.total;

    // Calculate Difference
    const monthlyDifference = newNetSalary - oldNetSalary;
    
    // Calculate Months Owed
    const effectiveDateObj = new Date(effectiveDate);
    const effectiveMonth = new Date(effectiveDateObj.getFullYear(), effectiveDateObj.getMonth(), 1);
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthsDiff = (currentMonth.getFullYear() - effectiveMonth.getFullYear()) * 12 + (currentMonth.getMonth() - effectiveMonth.getMonth());
    
    const safeMonthsDiff = Math.max(0, monthsDiff);
    let totalArrears = 0;
    let proratedFirstMonth = 0;
    let fullMonthsAfter = 0;
    if (monthlyDifference > 0 && safeMonthsDiff > 0) {
      const daysInEffectiveMonth = new Date(effectiveMonth.getFullYear(), effectiveMonth.getMonth() + 1, 0).getDate();
      const effectiveDay = effectiveDateObj.getDate();
      const eligibleDays = Math.max(0, daysInEffectiveMonth - (effectiveDay - 1));
      const dailyDifference = monthlyDifference / daysInEffectiveMonth;
      proratedFirstMonth = dailyDifference * eligibleDays;
      fullMonthsAfter = Math.max(0, safeMonthsDiff - 1);
      totalArrears = proratedFirstMonth + (monthlyDifference * fullMonthsAfter);
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
  private async calculateGrossSalary(staffId: string, basicSalary: number): Promise<number> {
    // 1. Get Global Allowances (applies_to_all = true)
    const globalAllowances = await this.databaseService.query(
      `SELECT * FROM allowances WHERE status = 'active' AND applies_to_all = true`
    );

    // 2. Get Staff Specific Allowances
    // We join with allowances table to get the type
    const staffAllowances = await this.databaseService.query(
      `SELECT sa.*, a.type as allowance_type, a.percentage as global_percentage
       FROM staff_allowances sa
       JOIN allowances a ON sa.allowance_id = a.id
       WHERE sa.status = 'active' AND sa.staff_id = $1`,
      [staffId]
    );

    let totalAllowances = 0;

    // Calculate Global Allowances
    for (const allowance of globalAllowances) {
      if (allowance.type === 'percentage') {
        totalAllowances += (basicSalary * parseFloat(allowance.percentage)) / 100;
      } else if (allowance.type === 'fixed') {
        totalAllowances += parseFloat(allowance.amount);
      }
    }

    // Calculate Staff Specific Allowances
    for (const allowance of staffAllowances) {
      const type = allowance.allowance_type;
      
      if (type === 'percentage') {
        const pct = allowance.percentage ? parseFloat(allowance.percentage) : 0;
        totalAllowances += (basicSalary * pct) / 100;
      } else if (type === 'fixed') {
        const amt = allowance.amount ? parseFloat(allowance.amount) : 0;
        totalAllowances += amt;
      }
    }

    return basicSalary + totalAllowances;
  }

  /**
   * Calculate total deductions (Global + Staff, excluding TAX)
   */
  private async calculateTotalDeductions(staffId: string, basicSalary: number): Promise<number> {
    // 1. Get Global Deductions (applies_to_all = true)
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true AND code != 'TAX'`
    );

    // 2. Get Staff Specific Deductions
    const staffDeductions = await this.databaseService.query(
      `SELECT sd.*, d.type as deduction_type, d.percentage as global_percentage
       FROM staff_deductions sd
       JOIN deductions d ON sd.deduction_id = d.id
       WHERE sd.status = 'active' AND sd.staff_id = $1 AND d.code != 'TAX'`,
      [staffId]
    );

    let totalDeductions = 0;

    // Calculate Global Deductions
    for (const deduction of globalDeductions) {
      if (deduction.type === 'percentage') {
        totalDeductions += (basicSalary * parseFloat(deduction.percentage)) / 100;
      } else if (deduction.type === 'fixed') {
        totalDeductions += parseFloat(deduction.amount);
      }
    }

    // Calculate Staff Specific Deductions
    for (const deduction of staffDeductions) {
      const type = deduction.deduction_type;
      
      if (type === 'percentage') {
        const pct = deduction.percentage ? parseFloat(deduction.percentage) : 0;
        totalDeductions += (basicSalary * pct) / 100;
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
  ): Promise<{ total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string }> }> {
    const globalAllowances = await this.databaseService.query(
      `SELECT * FROM allowances WHERE status = 'active' AND applies_to_all = true`,
    );

    const staffAllowances = await this.databaseService.query(
      `SELECT sa.*, a.type as allowance_type, a.percentage as global_percentage, a.name as allowance_name, a.code as allowance_code
       FROM staff_allowances sa
       JOIN allowances a ON sa.allowance_id = a.id
       WHERE sa.status = 'active' AND sa.staff_id = $1`,
      [staffId],
    );

    const items: Array<{ code: string; name: string; amount: number; type: string; source: string }> = [];
    let total = 0;

    for (const allowance of globalAllowances) {
      let amount = 0;
      if (allowance.type === 'percentage') {
        amount = (basicSalary * parseFloat(allowance.percentage)) / 100;
      } else if (allowance.type === 'fixed') {
        amount = parseFloat(allowance.amount);
      }
      if (amount) {
        items.push({
          code: allowance.code,
          name: allowance.name,
          amount,
          type: allowance.type,
          source: 'global',
        });
        total += amount;
      }
    }

    for (const allowance of staffAllowances) {
      const type = allowance.allowance_type;
      let amount = 0;
      if (type === 'percentage') {
        const pct = allowance.percentage ? parseFloat(allowance.percentage) : 0;
        amount = (basicSalary * pct) / 100;
      } else if (type === 'fixed') {
        amount = allowance.amount ? parseFloat(allowance.amount) : 0;
      }
      if (amount) {
        items.push({
          code: allowance.allowance_code,
          name: allowance.allowance_name,
          amount,
          type,
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
  ): Promise<{ total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string }> }> {
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true AND code != 'TAX'`,
    );

    const staffDeductions = await this.databaseService.query(
      `SELECT sd.*, d.type as deduction_type, d.percentage as global_percentage, d.name as deduction_name, d.code as deduction_code
       FROM staff_deductions sd
       JOIN deductions d ON sd.deduction_id = d.id
       WHERE sd.status = 'active' AND sd.staff_id = $1 AND d.code != 'TAX'`,
      [staffId],
    );

    const items: Array<{ code: string; name: string; amount: number; type: string; source: string }> = [];
    let total = 0;

    for (const deduction of globalDeductions) {
      let amount = 0;
      if (deduction.type === 'percentage') {
        amount = (basicSalary * parseFloat(deduction.percentage)) / 100;
      } else if (deduction.type === 'fixed') {
        amount = parseFloat(deduction.amount);
      }
      if (amount) {
        items.push({
          code: deduction.code,
          name: deduction.name,
          amount,
          type: deduction.type,
          source: 'global',
        });
        total += amount;
      }
    }

    for (const deduction of staffDeductions) {
      const type = deduction.deduction_type;
      let amount = 0;
      if (type === 'percentage') {
        const pct = deduction.percentage ? parseFloat(deduction.percentage) : 0;
        amount = (basicSalary * pct) / 100;
      } else if (type === 'fixed') {
        amount = deduction.amount ? parseFloat(deduction.amount) : 0;
      }
      if (amount) {
        items.push({
          code: deduction.deduction_code,
          name: deduction.deduction_name,
          amount,
          type,
          source: 'staff',
        });
        total += amount;
      }
    }

    return { total, items };
  }
}
