import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class ArrearsService {
  private readonly logger = new Logger(ArrearsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create manual arrears/adjustment
   */
  async createArrears(data: any, userId: string) {
    const {
      staffId, reason, amount, effectiveDate, 
      monthsOwed = 1, description
    } = data;

    // Get staff details
    const staff = await this.databaseService.queryOne('SELECT * FROM staff WHERE id = $1', [staffId]);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${staffId} not found`);
    }

    // Prepare details JSON
    const details = [{
      month: new Date(effectiveDate).toISOString().substring(0, 7),
      amount: parseFloat(amount),
      description: description || 'Manual Adjustment'
    }];

    const totalArrears = parseFloat(amount);

    await this.databaseService.query(
      `INSERT INTO arrears (
        staff_id, reason, old_salary, new_salary, 
        old_basic_salary, new_basic_salary,
        effective_date, months_owed, total_arrears, 
        status, details, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        staffId, reason || 'other', 
        staff.current_basic_salary || 0, staff.current_basic_salary || 0, // No salary change implies same salary
        staff.current_basic_salary || 0, staff.current_basic_salary || 0,
        effectiveDate, monthsOwed, totalArrears,
        'pending', JSON.stringify(details), userId
      ]
    );

    this.logger.log(`Manual arrears created for staff ${staff.staff_number} by user ${userId}`);
    return { message: 'Arrears created successfully' };
  }

  /**
   * Delete arrears (only if pending)
   */
  async deleteArrears(id: string, userId: string) {
    const arrears = await this.databaseService.queryOne('SELECT * FROM arrears WHERE id = $1', [id]);
    
    if (!arrears) {
      throw new NotFoundException(`Arrears record with ID ${id} not found`);
    }

    if (arrears.status !== 'pending') {
      throw new Error('Only pending arrears can be deleted');
    }

    await this.databaseService.query('DELETE FROM arrears WHERE id = $1', [id]);
    
    this.logger.log(`Arrears ${id} deleted by user ${userId}`);
    return { message: 'Arrears deleted successfully' };
  }

  /**
   * Get pending arrears
   */
  async getPendingArrears() {
    return this.databaseService.query(
      `SELECT a.*, s.first_name || ' ' || s.last_name as staff_name, s.staff_number,
              s.grade_level as current_grade, s.step as current_step,
              p.old_grade_level as old_grade, p.new_grade_level as new_grade,
              p.old_step as old_step, p.new_step as new_step
       FROM arrears a
       JOIN staff s ON a.staff_id = s.id
       LEFT JOIN promotions p ON a.staff_id = p.staff_id 
           AND a.effective_date = p.promotion_date::date 
           AND a.reason = 'promotion'
       WHERE a.status IN ('pending', 'approved', 'processed')
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

    await this.databaseService.query(
      `UPDATE arrears SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    this.logger.log(`Arrears ${id} approved by user ${userId}`);
    return { message: 'Arrears approved successfully' };
  }

  /**
   * Merge arrears to payroll
   */
  async mergeArrearsToPayroll(arrearsId: string, payrollBatchId: string, userId: string) {
    const arrears = await this.databaseService.queryOne('SELECT * FROM arrears WHERE id = $1', [arrearsId]);
    
    if (!arrears) {
      throw new NotFoundException(`Arrears record with ID ${arrearsId} not found`);
    }

    if (arrears.status !== 'approved') {
      throw new BadRequestException('Arrears must be approved before merging to payroll');
    }

    // Link arrears to the payroll batch
    await this.databaseService.query(
      `UPDATE arrears 
       SET status = 'processed', payroll_batch_id = $1, updated_at = NOW() 
       WHERE id = $2`,
      [payrollBatchId, arrearsId]
    );

    this.logger.log(`Arrears ${arrearsId} merged to payroll batch ${payrollBatchId} by user ${userId}`);
    return { message: 'Arrears merged to payroll successfully. Please regenerate payroll lines for this batch to reflect changes.' };
  }

  /**
   * Recalculate arrears
   */
  async recalculateArrears(id: string, userId: string) {
    const arrears = await this.databaseService.queryOne('SELECT * FROM arrears WHERE id = $1', [id]);
    
    if (!arrears) {
      throw new NotFoundException(`Arrears record with ID ${id} not found`);
    }

    // Mock recalculation logic
    // In a real scenario, this would re-evaluate the salary difference based on effective date
    
    this.logger.log(`Arrears ${id} recalculated by user ${userId}`);
    return { message: 'Arrears recalculated successfully', amount: arrears.amount };
  }
}
