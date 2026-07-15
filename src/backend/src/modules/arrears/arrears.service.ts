import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationCategory, NotificationPriority, NotificationType } from '../notifications/dto/notification.dto';

@Injectable()
export class ArrearsService {
  private readonly logger = new Logger(ArrearsService.name);
  private readonly businessTimeZone = 'Africa/Lagos';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
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

  private buildMonthlyBreakdown(
    effectiveDate: any,
    monthsOwed: number,
    firstMonthAmount: number,
    recurringAmount: number,
  ) {
    const { year, month } = this.getBusinessDateParts(effectiveDate);
    const details: Array<{ month: string; amount: number }> = [];

    for (let index = 0; index < monthsOwed; index += 1) {
      const monthDate = new Date(Date.UTC(year, month - 1 + index, 1));
      const amount = index === 0 ? firstMonthAmount : recurringAmount;

      details.push({
        month: this.buildMonthKey(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1),
        amount: this.roundCurrency(amount),
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
      `SELECT a.*, s.first_name || ' ' || s.last_name as staff_name, s.staff_number
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
    const { year, month } = this.getBusinessDateParts(effectiveDate);
    const details = [{
      month: this.buildMonthKey(year, month),
      amount: this.roundCurrency(parseFloat(amount)),
      description: description || 'Manual Adjustment'
    }];

    const totalArrears = this.roundCurrency(parseFloat(amount));
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

    let details = Array.isArray(arrears.details) ? arrears.details : [];
    let totalArrears = this.roundCurrency(Number(arrears.total_arrears || 0));

    if (arrears.reason === 'promotion') {
      const monthsOwed = Math.max(0, Number(arrears.months_owed || 0));
      const { year, month, day } = this.getBusinessDateParts(arrears.effective_date);
      const daysInEffectiveMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const eligibleDays = Math.max(0, daysInEffectiveMonth - (day - 1));
      const monthlyDifference = this.roundCurrency(
        Number(arrears.new_salary || 0) - Number(arrears.old_salary || 0),
      );
      const dailyDifference = daysInEffectiveMonth > 0 ? monthlyDifference / daysInEffectiveMonth : 0;
      const firstMonthAmount = this.roundCurrency(dailyDifference * eligibleDays);

      details = this.buildMonthlyBreakdown(
        arrears.effective_date,
        monthsOwed,
        firstMonthAmount,
        monthlyDifference,
      );
      totalArrears = this.roundCurrency(
        details.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      );
    } else if (arrears.effective_date) {
      const description = Array.isArray(details) && details[0]?.description
        ? details[0].description
        : 'Manual Adjustment';
      const { year, month } = this.getBusinessDateParts(arrears.effective_date);
      details = [{
        month: this.buildMonthKey(year, month),
        amount: totalArrears,
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
