import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { EmailService } from '@modules/email/email.service';
import { AuditService } from '@modules/audit/audit.service';
import { AuditAction } from '@modules/audit/dto/audit.dto';
import { CreateLeaveTypeDto, CreateLeaveRequestDto, ApproveLeaveDto, LeaveStatus } from './dto/leave.dto';
import { WorkflowService } from '@modules/workflow/workflow.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType, NotificationCategory, NotificationPriority } from '@modules/notifications/dto/notification.dto';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private databaseService: DatabaseService,
    private emailService: EmailService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => WorkflowService))
    private workflowService: WorkflowService,
  ) {}

  // ==================== LEAVE TYPES ====================

  /**
   * Create leave type
   */
  async createLeaveType(dto: CreateLeaveTypeDto, userId: string) {
    const leaveType = await this.databaseService.queryOne(
      `INSERT INTO leave_types (
        name, description, annual_days, is_paid, carries_forward, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING *`,
      [dto.name, dto.description || null, dto.annualDays, dto.isPaid, dto.carriesForward, userId],
    );

    this.logger.log(`Leave type ${dto.name} created by user ${userId}`);
    return leaveType;
  }

  /**
   * Get all leave types
   */
  async findAllLeaveTypes(status?: string) {
    let query = 'SELECT * FROM leave_types';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY name';

    return this.databaseService.query(query, params);
  }

  /**
   * Get leave type by ID
   */
  async findOneLeaveType(id: string) {
    const leaveType = await this.databaseService.queryOne(
      'SELECT * FROM leave_types WHERE id = $1',
      [id],
    );

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  // ==================== LEAVE BALANCES ====================

  /**
   * Initialize leave balances for all staff for a year
   */
  async initializeLeaveBalances(year: number, userId: string) {
    // Get all active leave types
    const leaveTypes = await this.databaseService.query(
      'SELECT id, annual_days FROM leave_types WHERE status = $1',
      ['active'],
    );

    // Get all active staff
    const staffList = await this.databaseService.query(
      'SELECT id FROM staff WHERE status = $1',
      ['active'],
    );

    if (staffList.length === 0 || leaveTypes.length === 0) {
      return { message: 'No staff or leave types found', initialized: 0 };
    }

    let initialized = 0;

    for (const staff of staffList) {
      for (const leaveType of leaveTypes) {
        // Check if balance already exists
        const existing = await this.databaseService.queryOne(
          'SELECT id FROM leave_balances WHERE staff_id = $1 AND leave_type_id = $2 AND year = $3',
          [staff.id, leaveType.id, year],
        );

        if (!existing) {
          await this.databaseService.queryOne(
            `INSERT INTO leave_balances (
              staff_id, leave_type_id, year, entitled_days, used_days, remaining_days, created_by
            ) VALUES ($1, $2, $3, $4, 0, $4, $5)`,
            [staff.id, leaveType.id, year, leaveType.annual_days, userId],
          );
          initialized++;
        }
      }
    }

    this.logger.log(`Initialized ${initialized} leave balances for year ${year}`);
    return { message: `Initialized ${initialized} leave balances`, initialized };
  }

  /**
   * Get staff leave balances
   */
  async getStaffLeaveBalances(staffId: string, year?: number) {
    const staff = await this.databaseService.queryOne(
      'SELECT gender FROM staff WHERE id = $1',
      [staffId],
    );
    const staffGender = String(staff?.gender || '').toLowerCase();
    let query = `
      SELECT 
        lb.*,
        lt.name as leave_type_name,
        lt.is_paid
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.staff_id = $1
    `;
    const params: (string | number)[] = [staffId];

    if (year) {
      query += ' AND lb.year = $2';
      params.push(year);
    }

    query += ' ORDER BY lt.name';

    const balances = await this.databaseService.query(query, params);
    if (!staffGender) return balances;

    return (balances || []).filter((row: any) => {
      const name = String(row.leave_type_name || '').toLowerCase();
      if (name.includes('maternity') && staffGender !== 'female') return false;
      if (name.includes('paternity') && staffGender !== 'male') return false;
      return true;
    });
  }

  // ==================== LEAVE REQUESTS ====================

  /**
   * Create leave request
   */
  async createLeaveRequest(dto: CreateLeaveRequestDto, userId: string) {
    // Verify staff exists
    const staff = await this.databaseService.queryOne(
      'SELECT id, staff_number, first_name, last_name, gender FROM staff WHERE id = $1 AND status = $2',
      [dto.staffId, 'active'],
    );

    if (!staff) {
      throw new NotFoundException('Active staff not found');
    }

    // Verify leave type exists
    const leaveType = await this.databaseService.queryOne(
      'SELECT * FROM leave_types WHERE id = $1 AND status = $2',
      [dto.leaveTypeId, 'active'],
    );

    if (!leaveType) {
      throw new NotFoundException('Active leave type not found');
    }

    const leaveTypeName = String(leaveType?.name || '').toLowerCase();
    const staffGender = String(staff?.gender || '').toLowerCase();
    if (leaveTypeName.includes('maternity') && staffGender !== 'female') {
      throw new BadRequestException('Maternity leave is only available for female staff');
    }
    if (leaveTypeName.includes('paternity') && staffGender !== 'male') {
      throw new BadRequestException('Paternity leave is only available for male staff');
    }

    // Calculate number of days
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    
    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Get leave balance for current year
    const currentYear = new Date().getFullYear();
    let balance = await this.databaseService.queryOne(
      'SELECT * FROM leave_balances WHERE staff_id = $1 AND leave_type_id = $2 AND year = $3',
      [dto.staffId, dto.leaveTypeId, currentYear],
    );

    if (!balance) {
      const entitledDays = parseInt(String(leaveType?.annual_days || 0), 10);
      const created = await this.databaseService.queryOne(
        `INSERT INTO leave_balances (
          staff_id, leave_type_id, year, entitled_days, used_days, remaining_days, created_by
        ) VALUES ($1, $2, $3, $4, 0, $4, $5)
        ON CONFLICT (staff_id, leave_type_id, year) DO NOTHING
        RETURNING *`,
        [dto.staffId, dto.leaveTypeId, currentYear, entitledDays, userId],
      );
      balance = created || await this.databaseService.queryOne(
        'SELECT * FROM leave_balances WHERE staff_id = $1 AND leave_type_id = $2 AND year = $3',
        [dto.staffId, dto.leaveTypeId, currentYear],
      );
    }

    if (!balance) {
      throw new NotFoundException(`Leave balance not found for year ${currentYear}`);
    }

    if (parseFloat(balance.remaining_days) < daysDiff) {
      throw new BadRequestException(
        `Insufficient leave balance. Remaining: ${balance.remaining_days} days, Requested: ${daysDiff} days`,
      );
    }

    // Generate request number
    const count = await this.databaseService.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM leave_requests',
    );
    const requestNumber = `LEAVE/${currentYear}/${String(parseInt(count.count.toString()) + 1).padStart(5, '0')}`;

    // Create leave request
    const request = await this.databaseService.queryOne(
      `INSERT INTO leave_requests (
        request_number, staff_id, leave_type_id, start_date, end_date, 
        number_of_days, reason, relief_officer_staff_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
      RETURNING *`,
      [
        requestNumber,
        dto.staffId,
        dto.leaveTypeId,
        dto.startDate,
        dto.endDate,
        daysDiff,
        dto.reason,
        dto.reliefOfficerStaffId || null,
        userId,
      ],
    );

    this.logger.log(`Leave request ${requestNumber} created for staff ${staff.staff_number}`);

    // Initiate approval workflow
    try {
      await this.workflowService.createRequest('Leave Request', 'leave', request.id, userId);
    } catch (error) {
      this.logger.warn(`Failed to initiate workflow for leave request ${request.id}: ${error.message}`);
    }

    // Notify relief officer
    if (dto.reliefOfficerStaffId) {
      try {
        await this.notificationsService.create({
          recipient_id: dto.reliefOfficerStaffId,
          type: NotificationType.LEAVE,
          category: NotificationCategory.ACTION_REQUIRED,
          title: 'Relief Officer Request',
          message: `You have been selected as relief officer by ${staff.first_name} ${staff.last_name} for leave from ${dto.startDate} to ${dto.endDate}.`,
          entity_type: 'leave_request',
          entity_id: request.id,
          priority: NotificationPriority.MEDIUM,
        });
      } catch (error) {
        this.logger.error(`Failed to notify relief officer: ${error.message}`);
      }
    }

    // Log audit trail
    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entity: 'leave_request',
      entityId: request.id,
      description: `Created leave request ${requestNumber} for ${daysDiff} days`,
      newValues: request,
    });

    return request;
  }

  /**
   * Get all leave requests
   */
  async findAllLeaveRequests(query: {
    staffId?: string;
    leaveTypeId?: string;
    status?: LeaveStatus;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, staffId, leaveTypeId, status } = query;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (staffId) {
      whereConditions.push(`lr.staff_id = $${paramIndex++}`);
      params.push(staffId);
    }

    if (leaveTypeId) {
      whereConditions.push(`lr.leave_type_id = $${paramIndex++}`);
      params.push(leaveTypeId);
    }

    if (status) {
      whereConditions.push(`lr.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM leave_requests lr ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    // Get paginated data
    const dataQuery = `
      SELECT 
        lr.*,
        s.staff_number,
        s.first_name,
        s.last_name,
        lt.name as leave_type_name,
        lt.is_paid,
        ro.staff_number as relief_officer_staff_number,
        ro.first_name as relief_officer_first_name,
        ro.last_name as relief_officer_last_name
      FROM leave_requests lr
      JOIN staff s ON lr.staff_id = s.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN staff ro ON lr.relief_officer_staff_id = ro.id
      ${whereClause}
      ORDER BY lr.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const data = await this.databaseService.query(dataQuery, [...params, limit, offset]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get leave request by ID
   */
  async findOneLeaveRequest(id: string) {
    const request = await this.databaseService.queryOne(
      `SELECT 
        lr.*,
        s.staff_number,
        s.first_name,
        s.last_name,
        s.email,
        lt.name as leave_type_name,
        lt.is_paid,
        ro.staff_number as relief_officer_staff_number,
        ro.first_name as relief_officer_first_name,
        ro.last_name as relief_officer_last_name
      FROM leave_requests lr
      JOIN staff s ON lr.staff_id = s.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN staff ro ON lr.relief_officer_staff_id = ro.id
      WHERE lr.id = $1`,
      [id],
    );

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    return request;
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(id: string, dto: ApproveLeaveDto, userId: string) {
    const request = await this.findOneLeaveRequest(id);

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    // Update request status
    const updated = await this.databaseService.queryOne(
      `UPDATE leave_requests 
      SET status = 'approved', approval_remarks = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
      WHERE id = $3 RETURNING *`,
      [dto.remarks || null, userId, id],
    );

    // Update leave balance
    const currentYear = new Date().getFullYear();
    await this.databaseService.queryOne(
      `UPDATE leave_balances 
      SET used_days = used_days + $1,
          remaining_days = remaining_days - $1,
          updated_at = NOW()
      WHERE staff_id = $2 AND leave_type_id = $3 AND year = $4`,
      [request.number_of_days, request.staff_id, request.leave_type_id, currentYear],
    );

    // Send email notification
    if (request.email) {
      try {
        await this.emailService.sendLeaveNotificationEmail(
          request.email,
          `${request.first_name} ${request.last_name}`,
          request.leave_type_name,
          'approved',
          new Date(request.start_date).toLocaleDateString(),
          new Date(request.end_date).toLocaleDateString(),
        );
        this.logger.log(`Leave approval email sent to ${request.email}`);
      } catch (error) {
        this.logger.error(`Failed to send leave approval email: ${error.message}`);
      }
    }

    // Send in-app notification
    try {
      await this.notificationsService.create({
        recipient_id: request.staff_id,
        type: NotificationType.LEAVE,
        category: NotificationCategory.SUCCESS,
        title: 'Leave Request Approved',
        message: `Your leave request for ${request.leave_type_name} has been approved.`,
        entity_type: 'leave_request',
        entity_id: request.id,
        priority: NotificationPriority.MEDIUM,
      });
    } catch (error) {
      this.logger.error(`Failed to send in-app notification: ${error.message}`);
    }

    this.logger.log(`Leave request ${request.request_number} approved by user ${userId}`);

    // Log audit trail
    await this.auditService.log({
      userId,
      action: AuditAction.APPROVE,
      entity: 'leave_request',
      entityId: request.id,
      description: `Approved leave request ${request.request_number}`,
      oldValues: { status: 'pending' },
      newValues: { status: 'approved' },
    });

    return updated;
  }

  /**
   * Reject leave request
   */
  async rejectLeaveRequest(id: string, remarks: string, userId: string) {
    const request = await this.findOneLeaveRequest(id);

    if (request.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE leave_requests 
      SET status = 'rejected', approval_remarks = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
      WHERE id = $3 RETURNING *`,
      [remarks, userId, id],
    );

    // Send email notification
    if (request.email) {
      try {
        await this.emailService.sendLeaveNotificationEmail(
          request.email,
          `${request.first_name} ${request.last_name}`,
          request.leave_type_name,
          'rejected',
          new Date(request.start_date).toLocaleDateString(),
          new Date(request.end_date).toLocaleDateString(),
        );
        this.logger.log(`Leave rejection email sent to ${request.email}`);
      } catch (error) {
        this.logger.error(`Failed to send leave rejection email: ${error.message}`);
      }
    }

    // Send in-app notification
    try {
      await this.notificationsService.create({
        recipient_id: request.staff_id,
        type: NotificationType.LEAVE,
        category: NotificationCategory.WARNING,
        title: 'Leave Request Rejected',
        message: `Your leave request for ${request.leave_type_name} has been rejected. Reason: ${remarks}`,
        entity_type: 'leave_request',
        entity_id: request.id,
        priority: NotificationPriority.HIGH,
      });
    } catch (error) {
      this.logger.error(`Failed to send in-app notification: ${error.message}`);
    }

    this.logger.log(`Leave request ${request.request_number} rejected by user ${userId}`);

    // Log audit trail
    await this.auditService.log({
      userId,
      action: AuditAction.REJECT,
      entity: 'leave_request',
      entityId: request.id,
      description: `Rejected leave request ${request.request_number}`,
      oldValues: { status: 'pending' },
      newValues: { status: 'rejected' },
    });

    return updated;
  }

  /**
   * Cancel leave request
   */
  async cancelLeaveRequest(id: string, userId: string) {
    const request = await this.databaseService.queryOne(
      'SELECT * FROM leave_requests WHERE id = $1',
      [id],
    );

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.status === 'cancelled') {
      throw new BadRequestException('Request is already cancelled');
    }

    // If approved, refund the leave days
    if (request.status === 'approved') {
      const currentYear = new Date().getFullYear();
      await this.databaseService.queryOne(
        `UPDATE leave_balances 
        SET used_days = used_days - $1,
            remaining_days = remaining_days + $1,
            updated_at = NOW()
        WHERE staff_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.number_of_days, request.staff_id, request.leave_type_id, currentYear],
      );
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );

    this.logger.log(`Leave request ${request.request_number} cancelled`);

    // Log audit trail
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'leave_request',
      entityId: request.id,
      description: `Cancelled leave request ${request.request_number}`,
      oldValues: { status: request.status },
      newValues: { status: 'cancelled' },
    });

    return updated;
  }
}
