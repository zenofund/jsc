import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { EmailService } from '@modules/email/email.service';
import { SalaryLookupService } from '@modules/salary-structures/salary-lookup.service';
import { AuditService } from '@modules/audit/audit.service';
import { CreateStaffDto, BulkCreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AuditAction } from '@modules/audit/dto/audit.dto';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType, NotificationCategory, NotificationPriority } from '@modules/notifications/dto/notification.dto';
import { DepartmentsService } from '@modules/departments/departments.service';
import { SettingsService } from '@modules/settings/settings.service';

@Injectable()
export class StaffService implements OnModuleInit {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private databaseService: DatabaseService,
    private emailService: EmailService,
    private salaryLookupService: SalaryLookupService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private departmentsService: DepartmentsService,
    private settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    await this.ensureStaffOnboardingColumns();
  }

  private async ensureStaffOnboardingColumns() {
    try {
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS zone VARCHAR(5)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS qualification VARCHAR(255)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_of_first_appointment DATE`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS post_on_first_appointment VARCHAR(255)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS present_appointment VARCHAR(255)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS date_of_present_appointment DATE`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS bank_code VARCHAR(20)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS confirmation_date DATE`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS retirement_date DATE`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS account_name VARCHAR(255)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS pension_pin VARCHAR(50)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS nhf_number VARCHAR(50)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS unit VARCHAR(255)`);
      await this.databaseService.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS cadre VARCHAR(255)`);
      await this.databaseService.query(`ALTER TABLE staff ALTER COLUMN email DROP NOT NULL`).catch(() => null);

      await this.databaseService.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = 'staff_zone_allowed'
              AND table_name = 'staff'
              AND constraint_type = 'CHECK'
          ) THEN
            ALTER TABLE staff
            ADD CONSTRAINT staff_zone_allowed
            CHECK (zone IS NULL OR zone IN ('NC', 'NE', 'NW', 'SS', 'SW', 'SE')) NOT VALID;
          END IF;
        END $$;
      `);

      await this.databaseService.query(`ALTER TABLE staff VALIDATE CONSTRAINT staff_zone_allowed`).catch(() => null);
    } catch (error: any) {
      this.logger.warn(`Failed to ensure staff onboarding columns: ${error?.message}`);
    }
  }

  /**
   * Create new staff member
   */
  async create(createStaffDto: CreateStaffDto, userId: string) {
    const staffNumber = String(createStaffDto.staffNumber || '').trim();
    if (!staffNumber) {
      throw new BadRequestException('Staff number is required');
    }

    let normalizedEmail = createStaffDto.email
      ? String(createStaffDto.email).trim().toLowerCase()
      : null;

    const existingStaffNumber = await this.databaseService.queryOne(
      'SELECT id FROM staff WHERE staff_number = $1',
      [staffNumber],
    );
    if (existingStaffNumber) {
      throw new BadRequestException('Staff number already exists');
    }

    if (normalizedEmail) {
      const existing = await this.databaseService.queryOne(
        'SELECT id FROM staff WHERE email = $1',
        [normalizedEmail],
      );
      if (existing) {
        throw new BadRequestException('Email already exists');
      }
    }

    if (!normalizedEmail) {
      const emailColumn = await this.databaseService.queryOne<{ is_nullable: 'YES' | 'NO' }>(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_name = 'staff' AND column_name = 'email'`,
      );
      if (emailColumn?.is_nullable === 'NO') {
        const base = staffNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        normalizedEmail = `${base || 'staff'}@no-email.local`;
      }
    }

    // Validate grade_level and step exist in salary structure
    // AND fetch the basic salary from the structure
    let basicSalary: number;
    
    try {
      await this.salaryLookupService.validateGradeAndStep(
        createStaffDto.gradeLevel,
        createStaffDto.step,
      );
      
      // Fetch basic salary from structure (this is the new approach)
      basicSalary = await this.salaryLookupService.getBasicSalary(
        createStaffDto.gradeLevel,
        createStaffDto.step,
      );
      
      this.logger.log(
        `Grade ${createStaffDto.gradeLevel} Step ${createStaffDto.step} validated. ` +
        `Basic salary from structure: ₦${basicSalary.toLocaleString()}`
      );
    } catch (error) {
      throw new BadRequestException(
        `Invalid grade/step combination: ${error.message}`
      );
    }

    // Use salary from structure, but keep currentBasicSalary parameter for backwards compatibility
    // If currentBasicSalary is provided and different, log a warning
    if (createStaffDto.currentBasicSalary && createStaffDto.currentBasicSalary !== basicSalary) {
      this.logger.warn(
        `Staff creation: provided salary (₦${createStaffDto.currentBasicSalary}) differs from ` +
        `structure salary (₦${basicSalary}). Using structure salary.`
      );
    }

    let staff: any;
    try {
      staff = await this.databaseService.queryOne(
        `INSERT INTO staff (
          staff_number, first_name, middle_name, last_name, date_of_birth, gender, marital_status,
          phone, email, address, state_of_origin, lga_of_origin, zone, qualification, nationality,
          department_id, designation, employment_type, employment_date, date_of_first_appointment, post_on_first_appointment, present_appointment, date_of_present_appointment, exit_date, exit_reason, confirmation_date, retirement_date,
          grade_level, step, current_basic_salary,
          bank_name, bank_code, account_number, account_name, bvn,
          tax_id, pension_pin, nhf_number,
          nok_name, nok_relationship, nok_phone, nok_address,
          unit, cadre,
          status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
          $28, $29, $30,
          $31, $32, $33, $34, $35,
          $36, $37, $38,
          $39, $40, $41, $42,
          $43, $44,
          $45, $46
        ) RETURNING *`,
        [
          staffNumber,
          createStaffDto.firstName,
          createStaffDto.middleName,
          createStaffDto.lastName,
          createStaffDto.dateOfBirth,
          createStaffDto.gender,
          createStaffDto.maritalStatus || null,
          createStaffDto.phone || null,
          normalizedEmail,
          createStaffDto.address || null,
          createStaffDto.stateOfOrigin,
          createStaffDto.lgaOfOrigin,
          createStaffDto.zone,
          createStaffDto.qualification,
          createStaffDto.nationality || 'Nigerian',
          createStaffDto.departmentId || null,
          createStaffDto.designation || null,
          createStaffDto.employmentType || null,
          createStaffDto.employmentDate,
          createStaffDto.employmentDate,
          createStaffDto.postOnFirstAppointment,
          createStaffDto.presentAppointment,
          createStaffDto.dateOfPresentAppointment,
          createStaffDto.exitDate,
          createStaffDto.exitReason || null,
          createStaffDto.confirmationDate || null,
          createStaffDto.retirementDate || null,
          createStaffDto.gradeLevel,
          createStaffDto.step,
          basicSalary,
          createStaffDto.bankName,
          createStaffDto.bankCode,
          createStaffDto.accountNumber,
          createStaffDto.accountName,
          createStaffDto.bvn || null,
          createStaffDto.taxId || null,
          createStaffDto.pensionPin || null,
          createStaffDto.nhfNumber || null,
          createStaffDto.nokName || null,
          createStaffDto.nokRelationship || null,
          createStaffDto.nokPhone || null,
          createStaffDto.nokAddress || null,
          createStaffDto.unit || null,
          createStaffDto.cadre || null,
          'active',
          userId,
        ],
      );
    } catch (error: any) {
      const code = error?.code;
      const detail = error?.detail || '';
      this.logger.error(`Staff create failed (${code}): ${error?.message}`);
      if (code === '23505') {
        if (detail.includes('staff_number')) {
          throw new BadRequestException('Staff number already exists');
        }
        if (detail.includes('email')) {
          throw new BadRequestException('Email already exists');
        }
        throw new BadRequestException('Duplicate value violates unique constraint');
      }
      if (code === '23502') {
        throw new BadRequestException(`${error?.column || 'A required field'} is required`);
      }
      if (code === '23503') {
        throw new BadRequestException('Invalid reference data. Check department or current user.');
      }
      if (code === '22P02') {
        throw new BadRequestException('Invalid data format supplied for one or more fields.');
      }
      if (code === '42703') {
        throw new BadRequestException('Staff table schema is outdated. Missing required columns.');
      }
      throw error;
    }

    // Log audit trail
    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entity: 'staff',
      entityId: staff.id,
      description: `Created staff member ${staff.first_name} ${staff.last_name}`,
      newValues: staff,
    });

    this.logger.log(`Staff created: ${staffNumber} by user ${userId}`);
    
    // Automatically create user account if email is provided
    if (createStaffDto.email) {
      try {
        await this.createUserAccountForStaff(staff.id, staff.email, `${staff.first_name} ${staff.last_name}`, userId);
      } catch (error) {
        this.logger.error(`Failed to create user account for staff ${staffNumber}: ${error.message}`, error.stack);
        // Don't fail staff creation if user account creation fails
      }
    } else {
        this.logger.warn(`No email provided for staff ${staffNumber}, skipping user account creation.`);
    }
    
    return staff;
  }

  async getNextStaffNumber() {
    const value = await this.getNextStaffNumberValue();
    return { staff_number: value };
  }

  private async getNextStaffNumberValue(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.databaseService.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM staff WHERE staff_number LIKE $1`,
      [`JSC/${year}/%`],
    );
    const sequence = (parseInt((count?.count as any) || '0', 10) + 1);
    return `JSC/${year}/${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Automatically create user account for newly created staff
   */
  private async createUserAccountForStaff(staffId: string, email: string, fullName: string, createdBy: string) {
    // Check if user account already exists
    const existingUser = await this.databaseService.queryOne(
      'SELECT id FROM users WHERE email = $1 OR staff_id = $2',
      [email, staffId],
    );

    if (existingUser) {
      this.logger.warn(`User account already exists for email ${email}`);
      return null;
    }

    const defaultPassword = '12345678';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // Create user account with default password
    const user = await this.databaseService.queryOne(
      `INSERT INTO users (email, password_hash, full_name, role, staff_id, status)
       VALUES ($1, $2, $3, 'staff', $4, 'active')
       RETURNING id, email, full_name, role`,
      [email, passwordHash, fullName, staffId],
    );

    // Send welcome email with credentials
    try {
      await this.emailService.sendWelcomeEmail(email, fullName, defaultPassword);
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
    }

    this.logger.log(`User account created automatically for staff ${staffId} with default password`);
    return user;
  }

  /**
   * Get all staff with pagination and filtering
   */
  async findAll(query: QueryStaffDto) {
    const { page = 1, limit = 20, search, status, departmentId, employmentType } = query;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(s.first_name ILIKE $${paramIndex} OR s.last_name ILIKE $${paramIndex} OR s.staff_number ILIKE $${paramIndex} OR s.email ILIKE $${paramIndex})`,
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`s.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (departmentId) {
      whereConditions.push(`s.department_id = $${paramIndex}`);
      params.push(departmentId);
      paramIndex++;
    }

    if (employmentType) {
      whereConditions.push(`s.employment_type = $${paramIndex}`);
      params.push(employmentType);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM staff s
      ${whereClause}
    `;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    // Get paginated data
    const dataQuery = `
      SELECT s.*, d.name as department_name, d.code as department_code
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      ${whereClause}
      ORDER BY s.created_at DESC
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
   * Get staff by ID
   */
  async findOne(id: string) {
    const staff = await this.databaseService.queryOne(
      `SELECT s.*, d.name as department_name, d.code as department_code,
              u.email as user_email, u.role as user_role
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN users u ON u.staff_id = s.id
       WHERE s.id = $1`,
      [id],
    );

    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    return staff;
  }

  /**
   * Get staff by staff number
   */
  async findByStaffNumber(staffNumber: string) {
    const staff = await this.databaseService.queryOne(
      `SELECT s.*, d.name as department_name
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.staff_number = $1`,
      [staffNumber],
    );

    if (!staff) {
      throw new NotFoundException(`Staff with number ${staffNumber} not found`);
    }

    return staff;
  }

  /**
   * Update staff
   */
  async update(id: string, updateStaffDto: UpdateStaffDto, userId: string) {
    const existing = await this.findOne(id);

    if (updateStaffDto.gradeLevel !== undefined || updateStaffDto.step !== undefined) {
      const newGrade = updateStaffDto.gradeLevel ?? existing.grade_level;
      const newStep = updateStaffDto.step ?? existing.step;
      await this.salaryLookupService.validateGradeAndStep(newGrade as any, newStep as any);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    // Build dynamic update query
    Object.entries(updateStaffDto).forEach(([key, value]) => {
      if (value !== undefined) {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        updates.push(`${snakeKey} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE staff 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updated = await this.databaseService.queryOne(query, params);

    // Log audit trail
    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'staff',
      entityId: id,
      description: `Updated staff member ${updated.first_name} ${updated.last_name}`,
      oldValues: existing,
      newValues: updated,
    });

    this.logger.log(`Staff ${id} updated by user ${userId}`);
    return updated;
  }

  /**
   * Delete staff (soft delete)
   */
  async remove(id: string, userId: string) {
    await this.findOne(id);

    await this.databaseService.query(
      `UPDATE staff SET status = 'terminated', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    this.logger.log(`Staff ${id} soft deleted by user ${userId}`);
    return { message: 'Staff member terminated successfully' };
  }

  /**
   * Get staff eligible for payroll (active and interdiction)
   */
  async getPayrollEligibleStaff() {
    return this.databaseService.query(
      `SELECT s.*, d.name as department_name
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.status IN ('active', 'interdiction')
       ORDER BY s.staff_number`,
    );
  }

  /**
   * Get staff statistics
   */
  async getStatistics() {
    const stats = await this.databaseService.queryOne(`
      SELECT 
        COUNT(*) as total_staff,
        COUNT(*) FILTER (WHERE status = 'active') as active_staff,
        COUNT(*) FILTER (WHERE status = 'on_leave') as on_leave,
        COUNT(*) FILTER (WHERE status = 'retired') as retired,
        COUNT(*) FILTER (WHERE employment_type = 'Permanent') as permanent,
        COUNT(*) FILTER (WHERE employment_type = 'Contract') as contract,
        COUNT(DISTINCT department_id) as total_departments,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_this_month,
        COALESCE(SUM(current_basic_salary) FILTER (WHERE status = 'active'), 0) as monthly_payroll
      FROM staff
    `);

    const byDepartment = await this.databaseService.query(`
      SELECT d.name, d.code, COUNT(s.id) as staff_count
      FROM departments d
      LEFT JOIN staff s ON s.department_id = d.id AND s.status = 'active'
      GROUP BY d.id, d.name, d.code
      ORDER BY staff_count DESC
    `);

    const byGrade = await this.databaseService.query(`
      SELECT grade_level, COUNT(*) as count
      FROM staff
      WHERE status = 'active'
      GROUP BY grade_level
      ORDER BY grade_level
    `);

    return {
      overview: {
        ...stats,
        yearly_payroll: (parseFloat(stats.monthly_payroll) * 12)
      },
      byDepartment,
      byGrade,
    };
  }

  /**
   * Get staff requests
   */
  async getStaffRequests(staffId: string) {
    return this.databaseService.query(
      `SELECT * FROM staff_requests WHERE staff_id = $1 ORDER BY created_at DESC`,
      [staffId]
    );
  }

  /**
   * Create staff request
   */
  async createStaffRequest(data: any, userId: string) {
    const result = await this.databaseService.queryOne(
      `INSERT INTO staff_requests (
        staff_id, request_type, details, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *`,
      [data.staff_id, data.request_type, data.details, 'pending']
    );

    // Notify HR
    try {
      const hrUsers = await this.databaseService.query(
        "SELECT id FROM users WHERE role IN ('admin', 'hr_manager')"
      );

      // Get staff details for the message
      const staff = await this.databaseService.queryOne(
        'SELECT first_name, last_name FROM staff WHERE id = $1',
        [data.staff_id]
      );
      const staffName = staff ? `${staff.first_name} ${staff.last_name}` : 'A staff member';

      for (const hr of hrUsers) {
        await this.notificationsService.create({
          recipient_id: hr.id,
          type: NotificationType.STAFF,
          category: NotificationCategory.ACTION_REQUIRED,
          title: 'New Staff Request',
          message: `${staffName} has submitted a ${data.request_type.replace(/_/g, ' ')} request.`,
          entity_type: 'staff_request',
          entity_id: result.id,
          priority: NotificationPriority.MEDIUM,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify HR about staff request: ${error.message}`);
    }

    return result;
  }

  async findAllStaffRequests(query: { status?: string; page?: number; limit?: number }) {
    const status = query.status || 'pending';
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await this.databaseService.queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM staff_requests WHERE ($1::text IS NULL OR status = $1)`,
      [status || null],
    );
    const total = parseInt(countResult?.total || '0');

    const data = await this.databaseService.query(
      `SELECT sr.*, s.staff_number, s.first_name, s.last_name, d.name as department_name
       FROM staff_requests sr
       LEFT JOIN staff s ON sr.staff_id = s.id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE ($1::text IS NULL OR sr.status = $1)
       ORDER BY sr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status || null, limit, offset],
    );

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async processStaffRequest(id: string, action: 'approved' | 'rejected', notes: string | undefined, userId: string) {
    const request = await this.databaseService.queryOne(
      `SELECT * FROM staff_requests WHERE id = $1`,
      [id],
    );
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE staff_requests
       SET status = $1, processed_by = $2, processed_at = NOW(), notes = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [action, userId, notes || null, id],
    );

    try {
      const requesterUser = await this.databaseService.queryOne(
        `SELECT id FROM users WHERE staff_id = $1`,
        [request.staff_id],
      );
      if (requesterUser?.id) {
        await this.notificationsService.create({
          recipient_id: requesterUser.id,
          type: NotificationType.STAFF,
          category: action === 'approved' ? NotificationCategory.SUCCESS : NotificationCategory.ERROR,
          title: `Your request was ${action}`,
          message: `Your ${request.request_type.replace(/_/g, ' ')} request has been ${action}.`,
          entity_type: 'staff_request',
          entity_id: request.id,
          priority: NotificationPriority.MEDIUM,
        });
      }
    } catch (e) {
      this.logger.error(`Failed to notify requester: ${e.message}`);
    }

    return updated;
  }

  /**
   * Get staff documents
   */
  async getStaffDocuments(staffId: string) {
    return this.databaseService.query(
      `SELECT * FROM staff_documents WHERE staff_id = $1 ORDER BY created_at DESC`,
      [staffId]
    );
  }

  /**
   * Create staff document
   */
  async createStaffDocument(data: any, userId: string) {
    const result = await this.databaseService.queryOne(
      `INSERT INTO staff_documents (
        staff_id, name, type, file_url, file_size, mime_type, description, uploaded_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        data.staff_id, 
        data.name, 
        data.type, 
        data.file_url, 
        data.file_size || 0, 
        data.mime_type || 'application/octet-stream', 
        data.description, 
        userId
      ]
    );

    // Notify HR about new document
    try {
      const hrUsers = await this.databaseService.query(
        "SELECT id FROM users WHERE role IN ('admin', 'hr_manager')"
      );

      const staff = await this.databaseService.queryOne(
        'SELECT first_name, last_name FROM staff WHERE id = $1',
        [data.staff_id]
      );
      const staffName = staff ? `${staff.first_name} ${staff.last_name}` : 'A staff member';

      for (const hr of hrUsers) {
        await this.notificationsService.create({
          recipient_id: hr.id,
          type: NotificationType.STAFF,
          category: NotificationCategory.INFO,
          title: 'New Staff Document',
          message: `${staffName} has uploaded a new document: ${data.name}`,
          entity_type: 'staff_document',
          entity_id: result.id,
          priority: NotificationPriority.LOW,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify HR about staff document: ${error.message}`);
    }

    return result;
  }

  /**
   * Get staff dashboard statistics
   */
  async getDashboardStats(staffId: string) {
    const staff = await this.findOne(staffId);
    
    // Calculate years of service
    const employmentDate = new Date(staff.employment_date);
    const today = new Date();
    const yearsOfService = Math.floor((today.getTime() - employmentDate.getTime()) / (1000 * 60 * 60 * 24 * 365));

    // Get recent payslips (mocking the table name as payroll_lines might differ)
    // Assuming payroll_lines table exists and links to staff
    const recentPayslips = await this.databaseService.query(
      `SELECT pl.net_pay, pb.month, pb.year
       FROM payroll_lines pl
       JOIN payroll_batches pb ON pl.payroll_batch_id = pb.id
       WHERE pl.staff_id = $1
       ORDER BY pb.created_at DESC
       LIMIT 3`,
      [staffId]
    ).catch(() => []); // Fail safe if table doesn't exist

    // Get pending leave requests
    const pendingLeave = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM leave_requests WHERE staff_id = $1 AND status = 'pending'`,
      [staffId]
    ).catch(() => ({ count: 0 }));

    // Get pending staff requests
    const pendingRequests = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM staff_requests WHERE staff_id = $1 AND status = 'pending'`,
      [staffId]
    ).catch(() => ({ count: 0 }));
    
    // Get promotion history
    const promotionHistory = await this.getStaffPromotions(staffId);

    // Get system settings for payday
    const settings = await this.settingsService.getSettings();
    const paydayDay = settings.payday_day || 25;
    
    // Calculate next payday
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let nextPaydayDate: Date;
    
    if (currentDay <= paydayDay) {
      // This month
      nextPaydayDate = new Date(currentYear, currentMonth, paydayDay);
    } else {
      // Next month
      nextPaydayDate = new Date(currentYear, currentMonth + 1, paydayDay);
    }

    // Transform staff to nested object expected by frontend
    const nestedStaff = {
      id: staff.id,
      staff_number: staff.staff_number,
      bio_data: {
        first_name: staff.first_name,
        middle_name: staff.middle_name,
        last_name: staff.last_name,
        email: staff.email,
        phone: staff.phone,
        gender: staff.gender,
        date_of_birth: staff.date_of_birth,
        marital_status: staff.marital_status,
        address: staff.address,
        state_of_origin: staff.state_of_origin,
        lga_of_origin: staff.lga_of_origin,
      },
      appointment: {
        date_of_first_appointment: staff.employment_date,
        current_posting: staff.department_name, // Using department name as posting for now
        department: staff.department_name,
        designation: staff.designation,
        status: staff.status,
      },
      salary_info: {
        grade_level: staff.grade_level,
        step: staff.step,
        bank_name: staff.bank_name,
        account_number: staff.account_number,
        current_salary: staff.current_basic_salary,
      },
      next_of_kin: {
        name: staff.nok_name,
        relationship: staff.nok_relationship,
        phone: staff.nok_phone,
        address: staff.nok_address,
      }
    };

    const leaveRows = await this.databaseService.query(
      `SELECT 
        lt.name as leave_type_name,
        lt.annual_days,
        lb.entitled_days,
        lb.used_days,
        lb.remaining_days
       FROM leave_types lt
       LEFT JOIN leave_balances lb 
         ON lb.leave_type_id = lt.id 
        AND lb.staff_id = $1 
        AND lb.year = $2
       WHERE lt.status = 'active'`,
      [staffId, currentYear],
    ).catch(() => []);

    const leaveTotals = {
      total: 0,
      annual: 0,
      sick: 0,
      maternity: 0,
      paternity: 0,
    };
    const staffGender = String(staff.gender || '').toLowerCase();

    for (const row of leaveRows || []) {
      const name = String(row.leave_type_name || '').toLowerCase();
      const fallbackEntitled = parseInt(String(row.entitled_days ?? row.annual_days ?? 0), 10);
      const remaining = row.remaining_days !== null && row.remaining_days !== undefined
        ? parseInt(String(row.remaining_days), 10)
        : fallbackEntitled;

      if (name.includes('maternity') && staffGender !== 'female') {
        continue;
      }
      if (name.includes('paternity') && staffGender !== 'male') {
        continue;
      }

      if (name.includes('annual')) leaveTotals.annual = remaining;
      else if (name.includes('sick')) leaveTotals.sick = remaining;
      else if (name.includes('maternity')) leaveTotals.maternity = remaining;
      else if (name.includes('paternity')) leaveTotals.paternity = remaining;

      if (!Number.isNaN(remaining)) {
        leaveTotals.total += remaining;
      }
    }

    return {
      staff: nestedStaff,
      current_salary: staff.current_basic_salary,
      grade_level: staff.grade_level,
      step: staff.step,
      years_of_service: yearsOfService,
      department: staff.department_name,
      designation: staff.designation,
      leave_balance: leaveTotals,
      recent_payslips: recentPayslips,
      pending_requests: {
        leave: parseInt(pendingLeave?.count || '0'),
        self_service: parseInt(pendingRequests?.count || '0')
      },
      promotion_history: promotionHistory,
      next_payday: nextPaydayDate.toISOString(),
    };
  }

  /**
   * Get staff promotion history
   */
  async getStaffPromotions(staffId: string) {
    // Check if promotions table exists first
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
      // If table doesn't exist or other error, return empty array
      return [];
    }
  }

  /**
   * Promote staff member
   */
  async promoteStaff(dto: any, userId: string) {
    const { staffId, newGradeLevel, newStep, newBasicSalary, effectiveDate, promotionType, remarks } = dto;
    
    const staff = await this.findOne(staffId);
    
    // Create promotion record if table exists
    try {
      await this.databaseService.query(
        `INSERT INTO promotions (
          staff_id, old_grade_level, old_step, old_basic_salary,
          new_grade_level, new_step, new_basic_salary,
          promotion_date, promotion_type, remarks, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          staffId, staff.grade_level, staff.step, staff.current_basic_salary,
          newGradeLevel, newStep, newBasicSalary,
          effectiveDate, promotionType || 'regular', remarks, userId
        ]
      );
    } catch (error) {
      this.logger.warn(`Failed to create promotion record: ${error.message}`);
      // Continue to update staff record even if history logging fails
    }

    // Update staff record
    await this.databaseService.query(
      `UPDATE staff 
       SET grade_level = $1, step = $2, current_basic_salary = $3, updated_at = NOW()
       WHERE id = $4`,
      [newGradeLevel, newStep, newBasicSalary, staffId]
    );

    this.logger.log(`Staff ${staff.staff_number} promoted to GL ${newGradeLevel} Step ${newStep}`);
    
    return { message: 'Staff promoted successfully' };
  }

  /**
   * Get eligible promotions
   */
  async getEligiblePromotions() {
    // Business logic: Staff who haven't been promoted in 3+ years
    // For now, return active staff ordered by last promotion date
    return this.databaseService.query(
      `SELECT s.*, d.name as department_name
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.status = 'active'
       -- AND (s.last_promotion_date IS NULL OR s.last_promotion_date < NOW() - INTERVAL '3 years')
       ORDER BY s.employment_date ASC
       LIMIT 50`
    );
  }

  /**
   * Bulk import staff - Optimized for 800+ records
   */
  async bulkImport(staffRecords: BulkCreateStaffDto[], userId: string) {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    if (!staffRecords.length) return results;

    this.logger.log(`Starting bulk import of ${staffRecords.length} records...`);
    const startTime = Date.now();

    try {
      const userExists = await this.databaseService.queryOne(
        'SELECT id FROM users WHERE id = $1',
        [userId],
      );
      if (!userExists) {
        throw new UnauthorizedException('Session expired. Please log in again.');
      }

      let structure = null;
      try {
        structure = await this.salaryLookupService.getActiveStructure();
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }

      // 1. Pre-fetch all necessary reference data in parallel
      const [departments, existingStaff, existingUsers] = await Promise.all([
        this.departmentsService.findAll(),
        this.databaseService.query<{ staff_number: string }>(
          'SELECT staff_number FROM staff'
        ),
        this.databaseService.query<{ email: string }>(
          'SELECT email FROM users'
        ),
      ]);

      // Create lookup maps
      const deptMap = new Map<string, string>(); // name/code -> id
      departments.forEach(dept => {
        deptMap.set(dept.name.toLowerCase(), dept.id);
        if (dept.code) deptMap.set(dept.code.toLowerCase(), dept.id);
      });

      const existingEmails = new Set(existingUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
      const existingStaffNumbers = new Set(existingStaff.map(s => s.staff_number).filter(Boolean));
      
      // Salary lookup map from active structure
      const salaryMap = new Map<string, number>();
      if (structure?.grade_levels) {
        const gradeLevels = structure.grade_levels as any[];
        gradeLevels.forEach(g => {
          g.steps?.forEach(s => {
            salaryMap.set(`${g.level}-${s.step}`, parseFloat(s.basic_salary));
          });
        });
      }

      // Default password hash (hash once for all users to save 80+ seconds)
      const defaultPassword = '12345678';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      const validStaffToInsert = [];
      const validUsersToInsert = [];

      const parseDateValue = (value: any, fieldLabel: string, required: boolean) => {
        if (value === undefined || value === null || String(value).trim() === '') {
          if (required) throw new Error(`${fieldLabel} is required`);
          return null;
        }

        let dateString: string | null = null;
        
        if (value instanceof Date && !isNaN(value.getTime())) {
          dateString = value.toISOString().split('T')[0];
        } else {
          const raw = String(value).trim();
          // Try DD/MM/YYYY format first
          const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
          if (ddmmyyyy) {
            dateString = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            // YYYY-MM-DD format
            dateString = raw;
          } else {
            // Try standard Date parsing
            const parsed = new Date(raw);
            if (isNaN(parsed.getTime())) {
              throw new Error(`${fieldLabel} has invalid date format: ${raw}`);
            }
            dateString = parsed.toISOString().split('T')[0];
          }
        }

        // Validate date existence (e.g., Feb 29 in non-leap year)
        if (dateString) {
          const [year, month, day] = dateString.split('-').map(Number);
          const testDate = new Date(year, month - 1, day);
          if (
            testDate.getFullYear() !== year ||
            testDate.getMonth() !== month - 1 ||
            testDate.getDate() !== day
          ) {
             throw new Error(`${fieldLabel} is an invalid date: ${dateString}`);
          }
        }

        return dateString;
      };

      const normalizeGender = (value: any) => {
        const g = String(value || '').toLowerCase().trim();
        if (!g) return null;
        if (g === 'famale') return 'female';
        if (g === 'male' || g === 'female') return g;
        return null;
      };

      // 2. Validate and transform records in memory
      let autoNumberCounter = 1;
      for (const record of staffRecords) {
        try {
          const dateOfBirth = parseDateValue(record.dateOfBirth, 'dateOfBirth', false);
          const employmentDate = parseDateValue(record.employmentDate, 'employmentDate', false) || new Date().toISOString().split('T')[0];
          const dateOfPresentAppointment = parseDateValue(record.dateOfPresentAppointment, 'dateOfPresentAppointment', false);
          const confirmationDate = parseDateValue(record.confirmationDate, 'confirmationDate', false);
          const retirementDate = parseDateValue(record.retirementDate, 'retirementDate', false);
          const exitDate = parseDateValue(record.exitDate, 'exitDate', false);

          // Resolve Department
          let departmentId = record.departmentId;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          if (departmentId && !uuidRegex.test(departmentId)) {
            this.logger.warn(`Invalid departmentId format in CSV: ${departmentId}. Ignoring and trying name resolution.`);
            departmentId = undefined;
          }

          if (!departmentId && record.departmentName) {
            departmentId = deptMap.get(record.departmentName.toLowerCase());
            if (!departmentId) throw new Error(`Department '${record.departmentName}' not found`);
          }
          if (!departmentId) departmentId = null;

          let staffNumber = String(record.staffNumber || '').trim();
          if (!staffNumber) {
            do {
              staffNumber = `AUTO-${Date.now()}-${autoNumberCounter++}`;
            } while (existingStaffNumbers.has(staffNumber));
          }
          if (existingStaffNumbers.has(staffNumber)) throw new Error(`Staff number ${staffNumber} already exists`);
          existingStaffNumbers.add(staffNumber);

          // Check Email uniqueness
          if (record.email) {
            const emailLower = record.email.toLowerCase();
            if (existingEmails.has(emailLower)) throw new Error(`Email ${record.email} already exists`);
            existingEmails.add(emailLower); // Add to set to prevent duplicates within same upload
          }

          let basicSalary: number | null = null;
          if (record.gradeLevel !== undefined && record.gradeLevel !== null && String(record.gradeLevel).trim() !== '' && record.step !== undefined && record.step !== null && !Number.isNaN(Number(record.step))) {
            const salaryKey = `${record.gradeLevel}-${record.step}`;
            const resolvedSalary = salaryMap.get(salaryKey);
            if (resolvedSalary !== undefined) {
              basicSalary = resolvedSalary;
            }
          }

          // Pre-generate ID for linking staff with users
          const staffId = uuidv4();

          // Prepare Staff database object (snake_case)
          const staffData = {
            id: staffId,
            staff_number: staffNumber,
            first_name: record.firstName || 'Unknown',
            middle_name: record.middleName,
            last_name: record.lastName || 'Unknown',
            date_of_birth: dateOfBirth,
            gender: normalizeGender(record.gender),
            marital_status: record.maritalStatus || null,
            phone: record.phone || null,
            email: record.email || null,
            address: record.address || null,
            state_of_origin: record.stateOfOrigin,
            lga_of_origin: record.lgaOfOrigin,
            zone: record.zone,
            qualification: record.qualification,
            nationality: record.nationality || 'Nigerian',
            department_id: departmentId,
            designation: record.designation || null,
            employment_type: record.employmentType || null,
            employment_date: employmentDate,
            date_of_first_appointment: employmentDate,
            post_on_first_appointment: record.postOnFirstAppointment,
            present_appointment: record.presentAppointment,
            date_of_present_appointment: dateOfPresentAppointment,
            exit_date: exitDate,
            confirmation_date: confirmationDate,
            grade_level: record.gradeLevel,
            step: record.step,
            current_basic_salary: basicSalary,
            bank_name: record.bankName,
            bank_code: record.bankCode,
            account_number: record.accountNumber,
            account_name: record.accountName,
            bvn: record.bvn || null,
            tax_id: record.taxId || null,
            pension_pin: record.pensionPin || null,
            nhf_number: record.nhfNumber || null,
            nok_name: record.nokName || null,
            nok_relationship: record.nokRelationship || null,
            nok_phone: record.nokPhone || null,
            nok_address: record.nokAddress || null,
            unit: record.unit || null,
            cadre: record.cadre || null,
            retirement_date: retirementDate,
            status: 'active',
            created_by: userId,
            created_at: new Date(),
            updated_at: new Date()
          };

          validStaffToInsert.push(staffData);
          if (validStaffToInsert.length === 1) {
            this.logger.debug(`First staff record keys: ${Object.keys(staffData).join(', ')}`);
            this.logger.debug(`First staff record values: ${JSON.stringify(Object.values(staffData))}`);
          }

          // Prepare User database object if email exists
          if (record.email && record.email.includes('@')) {
            validUsersToInsert.push({
              id: uuidv4(),
              email: record.email.toLowerCase(),
              password_hash: passwordHash,
              full_name: `${record.firstName} ${record.lastName}`,
              role: 'staff',
              staff_id: staffId,
              status: 'active',
              created_at: new Date()
            });
          }

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            record: `${record.firstName} ${record.lastName}`,
            error: error.message,
          });
        }
      }

      // 3. Bulk Database Insert
      if (validStaffToInsert.length > 0) {
        // Chunk inserts to avoid parameter limits (PostgreSQL has a limit of 65535 parameters)
        // For staff with ~40 columns, chunk size should be < 1500. 100 is safe and fast.
        const CHUNK_SIZE = 100;
        
        await this.databaseService.transaction(async (client) => {
          for (let i = 0; i < validStaffToInsert.length; i += CHUNK_SIZE) {
            const chunk = validStaffToInsert.slice(i, i + CHUNK_SIZE);
            await this.databaseService.bulkInsert('staff', chunk, client);
          }

          if (validUsersToInsert.length > 0) {
            for (let i = 0; i < validUsersToInsert.length; i += CHUNK_SIZE) {
              const chunk = validUsersToInsert.slice(i, i + CHUNK_SIZE);
              await this.databaseService.bulkInsert('users', chunk, client);
            }
          }
        });

        // Log a single audit trail entry for the whole batch
        // Note: entityId MUST be a valid UUID or null in the database.
        // We'll leave it as null and use description/newValues to store batch info.
        await this.auditService.log({
          userId,
          action: AuditAction.CREATE,
          entity: 'staff',
          entityId: null,
          description: `Bulk imported ${validStaffToInsert.length} staff members`,
          newValues: { count: validStaffToInsert.length, success: results.success, failed: results.failed },
        });
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Bulk import completed in ${duration}ms: ${results.success} success, ${results.failed} failed`);
      if (results.failed > 0) {
        this.logger.error(`First error: ${JSON.stringify(results.errors[0])}`);
      }
      
    } catch (error) {
      this.logger.error(`Fatal error during bulk import: ${error.message}`, error.stack);
      throw error;
    }

    return results;
  }

  /**
   * Sync legacy staff members who don't have user accounts
   */
  async syncLegacyStaffUsers(userId: string) {
    const staffWithoutUsers = await this.databaseService.query(
      `SELECT s.* 
       FROM staff s 
       LEFT JOIN users u ON u.staff_id = s.id 
       WHERE u.id IS NULL 
       AND s.email IS NOT NULL 
       AND s.status = 'active'`
    );

    const results = {
      total: staffWithoutUsers.length,
      created: 0,
      failed: 0,
      linked: 0,
      errors: [],
    };

    for (const staff of staffWithoutUsers) {
      try {
        // Check if user exists with same email but not linked
        const existingUser = await this.databaseService.queryOne(
          'SELECT id FROM users WHERE email = $1',
          [staff.email]
        );

        if (existingUser) {
           this.logger.warn(`User exists with email ${staff.email} but not linked to staff ${staff.staff_number}. Linking...`);
           await this.databaseService.query(
             'UPDATE users SET staff_id = $1 WHERE id = $2',
             [staff.id, existingUser.id]
           );
           results.linked++;
           continue;
        }

        await this.createUserAccountForStaff(staff.id, staff.email, `${staff.first_name} ${staff.last_name}`, userId);
        results.created++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          staff: staff.staff_number,
          error: error.message,
        });
      }
    }

    this.logger.log(`Legacy sync completed: ${results.created} created, ${results.linked} linked, ${results.failed} failed`);
    return results;
  }

  /**
   * Create user account for staff member and send welcome email
   */
  async createUserAccount(staffId: string, role: string, userId: string) {
    const staff = await this.findOne(staffId);

    if (!staff.email) {
      throw new BadRequestException('Staff member must have an email address');
    }

    // Check if user account already exists
    const existingUser = await this.databaseService.queryOne(
      'SELECT id FROM users WHERE email = $1 OR staff_id = $2',
      [staff.email, staffId],
    );

    if (existingUser) {
      throw new BadRequestException('User account already exists for this staff member');
    }

    // Generate temporary password
    const tempPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create user account
    const user = await this.databaseService.queryOne(
      `INSERT INTO users (email, password_hash, full_name, role, staff_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, email, full_name, role`,
      [
        staff.email,
        passwordHash,
        `${staff.first_name} ${staff.last_name}`,
        role,
        staffId,
      ],
    );

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(
        staff.email,
        `${staff.first_name} ${staff.last_name}`,
        tempPassword,
      );
      this.logger.log(`Welcome email sent to ${staff.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
      // Don't fail the user creation if email fails
    }

    this.logger.log(`User account created for staff ${staffId} with role ${role}`);
    return {
      user,
      tempPassword, // Return temp password for admin to share manually if email fails
    };
  }

  /**
   * Generate temporary password
   */
  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const length = 12;
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `JSC${password}!`;
  }

  /**
   * Sync salaries for all active staff with the current active salary structure
   * Optimized for bulk updates by Grade/Step to handle 1000+ users efficiently
   * This is called when a salary structure is updated or a new one is activated
   */
  async syncSalariesWithActiveStructure() {
    const startTime = Date.now();
    this.logger.log('Starting optimized staff salary synchronization...');
    
    try {
      const structure = await this.salaryLookupService.getActiveStructure();
      const gradeLevels = structure.grade_levels;

      if (!Array.isArray(gradeLevels)) {
        this.logger.error('Invalid salary structure format during sync');
        return;
      }

      let updateCount = 0;

      // OPTIMIZATION: Instead of updating staff one by one, we update by Grade/Step groups.
      // For 1000 users, this reduces queries from ~1000 to ~100 (number of grade/step combinations).
      // It also uses database-level filtering to only touch rows that actually need changing.
      
      for (const grade of gradeLevels) {
        if (grade.steps && Array.isArray(grade.steps)) {
          for (const stepData of grade.steps) {
             const basicSalary = parseFloat(stepData.basic_salary);
             
             if (isNaN(basicSalary) || basicSalary <= 0) continue;

             // Execute optimized bulk update for this specific grade/step bucket
             // The query is highly efficient because it uses indexed columns (grade_level, step)
             await this.databaseService.query(
               `UPDATE staff
                SET current_basic_salary = $1,
                    updated_at = NOW()
                WHERE grade_level = $2 
                  AND step = $3 
                  AND status = 'active'
                  AND (current_basic_salary IS NULL OR current_basic_salary != $1)`,
               [basicSalary, grade.level, stepData.step]
             );
             
             updateCount++;
          }
        }
      }
      
      const duration = Date.now() - startTime;
      this.logger.log(`Completed salary sync with structure "${structure.code}" in ${duration}ms. Processed ${updateCount} grade/step buckets.`);
    } catch (error) {
      this.logger.error(`Failed to sync staff salaries: ${error.message}`, error.stack);
      // We do not throw here to prevent the salary structure update from failing 
      // just because the background sync had an issue.
    }
  }
}
