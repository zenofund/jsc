import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { EmailService } from '@modules/email/email.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType, NotificationCategory, NotificationPriority } from '@modules/notifications/dto/notification.dto';
import {
  CreateLoanTypeDto,
  UpdateLoanTypeDto,
  CreateLoanApplicationDto,
  UpdateLoanApplicationDto,
  ApproveLoanDto,
  DisburseLoanDto,
  RecordRepaymentDto,
  CreateGuarantorDto,
  UpdateGuarantorDto,
  LoanStatus,
} from './dto/loan.dto';
import {
  LoanMigrationImportDto,
  MigrationLoanRepaymentRowDto,
  MigrationLoanRowDto,
} from './dto/migration-import.dto';

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private databaseService: DatabaseService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  // ==================== LOAN TYPES ====================

  async createLoanType(dto: CreateLoanTypeDto, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM loan_types WHERE code = $1',
      [dto.code],
    );

    if (existing) {
      throw new BadRequestException(`Loan type with code ${dto.code} already exists`);
    }

    const requiresGuarantors = dto.requiresGuarantors ?? false;
    const minGuarantors = requiresGuarantors
      ? (dto.minGuarantors ?? dto.requiredGuarantors ?? 0)
      : 0;
    const requiredGuarantors = requiresGuarantors
      ? (dto.requiredGuarantors ?? minGuarantors ?? 0)
      : 0;

    const loanType = await this.databaseService.queryOne(
      `INSERT INTO loan_types (
        code, name, description, max_amount, interest_rate, 
        max_tenure_months, required_guarantors, cooperative_id, status, created_by,
        min_service_years, max_salary_percentage, min_guarantors, eligibility_criteria, requires_guarantors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.description || null,
        dto.maxAmount,
        dto.interestRate,
        dto.maxTenureMonths,
        requiredGuarantors,
        (dto.cooperativeId === '' || dto.cooperativeId === null) ? null : dto.cooperativeId,
        dto.status || 'active',
        userId,
        dto.minServiceYears,
        dto.maxSalaryPercentage,
        minGuarantors,
        dto.eligibilityCriteria,
        requiresGuarantors
      ],
    );

    this.logger.log(`Loan type ${dto.code} created by user ${userId}`);
    return loanType;
  }

  async findAllLoanTypes(filters: { status?: string; cooperativeId?: string } = {}) {
    let query = `
      SELECT lt.*, c.name as cooperative_name
      FROM loan_types lt
      LEFT JOIN cooperatives c ON lt.cooperative_id = c.id
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`lt.status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters.cooperativeId) {
      conditions.push(`lt.cooperative_id = $${paramIndex++}`);
      params.push(filters.cooperativeId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY lt.name';

    return this.databaseService.query(query, params);
  }

  async findOneLoanType(id: string) {
    const loanType = await this.databaseService.queryOne(
      `SELECT lt.*, c.name as cooperative_name
      FROM loan_types lt
      LEFT JOIN cooperatives c ON lt.cooperative_id = c.id
      WHERE lt.id = $1`,
      [id],
    );

    if (!loanType) {
      throw new NotFoundException('Loan type not found');
    }

    return loanType;
  }

  async updateLoanType(id: string, dto: UpdateLoanTypeDto, userId: string) {
    const existing = await this.findOneLoanType(id);

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dto.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.code) {
      updates.push(`code = $${paramIndex++}`);
      values.push(dto.code);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.maxAmount) {
      updates.push(`max_amount = $${paramIndex++}`);
      values.push(dto.maxAmount);
    }
    if (dto.interestRate !== undefined) {
      updates.push(`interest_rate = $${paramIndex++}`);
      values.push(dto.interestRate);
    }
    if (dto.maxTenureMonths) {
      updates.push(`max_tenure_months = $${paramIndex++}`);
      values.push(dto.maxTenureMonths);
    }
    if (dto.minServiceYears !== undefined) {
      updates.push(`min_service_years = $${paramIndex++}`);
      values.push(dto.minServiceYears);
    }
    if (dto.maxSalaryPercentage !== undefined) {
      updates.push(`max_salary_percentage = $${paramIndex++}`);
      values.push(dto.maxSalaryPercentage);
    }
    const shouldSyncGuarantors =
      dto.requiresGuarantors !== undefined ||
      dto.minGuarantors !== undefined ||
      dto.requiredGuarantors !== undefined;
    if (shouldSyncGuarantors) {
      const nextRequiresGuarantors = dto.requiresGuarantors ?? existing.requires_guarantors ?? false;
      let nextMinGuarantors = dto.minGuarantors ?? existing.min_guarantors ?? 0;
      let nextRequiredGuarantors = dto.requiredGuarantors ?? existing.required_guarantors ?? 0;

      if (!nextRequiresGuarantors) {
        nextMinGuarantors = 0;
        nextRequiredGuarantors = 0;
      } else {
        if (!nextMinGuarantors && nextRequiredGuarantors) {
          nextMinGuarantors = nextRequiredGuarantors;
        }
        if (!nextRequiredGuarantors && nextMinGuarantors) {
          nextRequiredGuarantors = nextMinGuarantors;
        }
      }

      updates.push(`requires_guarantors = $${paramIndex++}`);
      values.push(nextRequiresGuarantors);
      updates.push(`min_guarantors = $${paramIndex++}`);
      values.push(nextMinGuarantors);
      updates.push(`required_guarantors = $${paramIndex++}`);
      values.push(nextRequiredGuarantors);
    }
    if (dto.cooperativeId !== undefined) {
      if (dto.cooperativeId === '' || dto.cooperativeId === null) {
        updates.push(`cooperative_id = $${paramIndex++}`);
        values.push(null);
      } else {
        updates.push(`cooperative_id = $${paramIndex++}`);
        values.push(dto.cooperativeId);
      }
    }
    if (dto.eligibilityCriteria !== undefined) {
      updates.push(`eligibility_criteria = $${paramIndex++}`);
      values.push(dto.eligibilityCriteria);
    }
    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE loan_types 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updated = await this.databaseService.queryOne(query, values);
    this.logger.log(`Loan type ${id} updated by user ${userId}`);
    return updated;
  }

  async deleteLoanType(id: string, userId: string) {
    const existing = await this.findOneLoanType(id);

    // Check if loan type is used in applications
    const usageCount = await this.databaseService.queryOne(
      'SELECT COUNT(*) as count FROM loan_applications WHERE loan_type_id = $1',
      [id],
    );

    if (parseInt(usageCount.count) > 0) {
      throw new BadRequestException('Cannot delete loan type that has applications');
    }

    await this.databaseService.query('DELETE FROM loan_types WHERE id = $1', [id]);
    this.logger.log(`Loan type ${id} deleted by user ${userId}`);
    return { message: 'Loan type deleted successfully' };
  }

  // ==================== LOAN APPLICATIONS ====================

  async createLoanApplication(dto: CreateLoanApplicationDto, userId: string) {
    // Get staff info
    const staff = await this.databaseService.queryOne(
      `SELECT s.id, s.staff_number, 
        s.first_name,
        s.last_name
      FROM staff s WHERE s.id = $1`,
      [dto.staffId],
    );

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Get loan type
    const loanType = await this.findOneLoanType(dto.loanTypeId);

    // Validate amount
    if (dto.requestedAmount > loanType.max_amount) {
      throw new BadRequestException(`Requested amount exceeds maximum of ₦${loanType.max_amount.toLocaleString()}`);
    }

    // Validate tenure
    if (dto.tenureMonths > loanType.max_tenure_months) {
      throw new BadRequestException(`Tenure exceeds maximum of ${loanType.max_tenure_months} months`);
    }

    // Calculate loan details
    const interestAmount = (dto.requestedAmount * loanType.interest_rate * dto.tenureMonths) / (12 * 100);
    const totalRepayment = dto.requestedAmount + interestAmount;
    const monthlyDeduction = Math.round(totalRepayment / dto.tenureMonths);

    // Generate application number
    const year = new Date().getFullYear();
    const count = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM loan_applications 
       WHERE application_number LIKE $1`,
      [`LN/${year}/%`],
    );
    const appNumber = `LN/${year}/${String(parseInt(count.count) + 1).padStart(5, '0')}`;

    // Create application
    const application = await this.databaseService.queryOne(
      `INSERT INTO loan_applications (
        application_number, staff_id, staff_number, staff_name,
        loan_type_id, loan_type_name, amount_requested, purpose, tenure_months,
        monthly_deduction, total_repayment, interest_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
      RETURNING *`,
      [
        appNumber,
        dto.staffId,
        staff.staff_number,
        `${staff.first_name} ${staff.last_name}`,
        dto.loanTypeId,
        loanType.name,
        dto.requestedAmount,
        dto.purpose,
        dto.tenureMonths,
        monthlyDeduction,
        Math.round(totalRepayment),
        Math.round(interestAmount),
      ],
    );

    this.logger.log(`Loan application ${appNumber} created for staff ${staff.staff_number}`);
    return application;
  }

  async findAllLoanApplications(filters: {
    staffId?: string;
    loanTypeId?: string;
    status?: string;
  }) {
    let query = `
      SELECT la.*, lt.name as loan_type_name_derived, lt.cooperative_id,
        COUNT(lg.id) as guarantor_count,
        s.bank_name as staff_bank_name, 
        s.account_number as staff_account_number, 
        s.account_name as staff_account_name
      FROM loan_applications la
      LEFT JOIN loan_types lt ON la.loan_type_id = lt.id
      LEFT JOIN loan_guarantors lg ON la.id = lg.loan_application_id
      LEFT JOIN staff s ON la.staff_id = s.id
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.staffId) {
      conditions.push(`la.staff_id = $${paramIndex++}`);
      params.push(filters.staffId);
    }
    if (filters.loanTypeId) {
      conditions.push(`la.loan_type_id = $${paramIndex++}`);
      params.push(filters.loanTypeId);
    }
    if (filters.status) {
      conditions.push(`la.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY la.id, lt.name, lt.cooperative_id, s.bank_name, s.account_number, s.account_name ORDER BY la.created_at DESC';

    const applications = await this.databaseService.query(query, params);
    
    // Ensure loan_type_name is populated (fallback to derived if null)
    return applications.map(app => ({
      ...app,
      loan_type_name: app.loan_type_name || app.loan_type_name_derived
    }));
  }

  async findOneLoanApplication(id: string) {
    const application = await this.databaseService.queryOne(
      `SELECT la.*, lt.name as loan_type_name, lt.cooperative_id,
        lt.required_guarantors, lt.requires_guarantors, lt.min_guarantors,
        s.bank_name as staff_bank_name,
        s.account_number as staff_account_number,
        s.account_name as staff_account_name
      FROM loan_applications la
      LEFT JOIN loan_types lt ON la.loan_type_id = lt.id
      LEFT JOIN staff s ON la.staff_id = s.id
      WHERE la.id = $1`,
      [id],
    );

    if (!application) {
      throw new NotFoundException('Loan application not found');
    }

    // Get guarantors
    const guarantors = await this.databaseService.query(
      `SELECT lg.*, 
        s.staff_number,
        s.first_name,
        s.last_name
      FROM loan_guarantors lg
      LEFT JOIN staff s ON lg.guarantor_staff_id = s.id
      WHERE lg.loan_application_id = $1`,
      [id],
    );

    return { ...application, guarantors };
  }

  async updateLoanApplication(id: string, dto: UpdateLoanApplicationDto, userId: string) {
    const application = await this.findOneLoanApplication(id);

    if (application.status !== 'draft') {
      throw new BadRequestException('Can only update draft applications');
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dto.requestedAmount) {
      updates.push(`amount_requested = $${paramIndex++}`);
      values.push(dto.requestedAmount);
    }
    if (dto.tenureMonths) {
      updates.push(`tenure_months = $${paramIndex++}`);
      values.push(dto.tenureMonths);
    }
    if (dto.purpose) {
      updates.push(`purpose = $${paramIndex++}`);
      values.push(dto.purpose);
    }
    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE loan_applications 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    return this.databaseService.queryOne(query, values);
  }

  async submitLoanApplication(id: string, userId: string) {
    const application = await this.findOneLoanApplication(id);

    if (application.status !== 'draft') {
      throw new BadRequestException('Application already submitted');
    }

    const guarantorCount = application.guarantors.length;
    const requiresGuarantors = Boolean(application.requires_guarantors);
    const minGuarantors = Number(application.min_guarantors ?? application.required_guarantors ?? 0);

    if (requiresGuarantors && guarantorCount < minGuarantors) {
      throw new BadRequestException(
        `Application requires ${minGuarantors} guarantors, only ${guarantorCount} added`,
      );
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE loan_applications 
       SET status = $2, submitted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, requiresGuarantors ? 'guarantor_pending' : 'pending'],
    );

    this.logger.log(`Loan application ${application.application_number} submitted`);

    if (requiresGuarantors) {
      try {
        const guarantors = await this.findGuarantors({ loanApplicationId: id });
        for (const guarantor of guarantors) {
          await this.notificationsService.create({
            recipient_id: guarantor.guarantor_staff_id,
            type: NotificationType.LOAN,
            category: NotificationCategory.ACTION_REQUIRED,
            title: 'Loan Guarantor Request',
            message: `You have been requested to be a guarantor for a loan application by ${application.staff_name || 'a colleague'} (App #${application.application_number}).`,
            entity_type: 'loan_guarantor',
            entity_id: guarantor.id,
            priority: NotificationPriority.HIGH,
          });
        }
      } catch (error) {
        this.logger.error(`Failed to send notifications: ${error.message}`);
      }
    }

    return updated;
  }

  async approveLoanApplication(id: string, dto: ApproveLoanDto, userId: string) {
    const application = await this.findOneLoanApplication(id);

    if (application.status !== 'pending') {
      throw new BadRequestException('Application must be in pending status');
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE loan_applications 
       SET status = 'approved', 
           amount_approved = $1, 
           approval_remarks = $2,
           approved_by = $3,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [dto.approvedAmount, dto.remarks || null, userId, id],
    );

    this.logger.log(`Loan application ${application.application_number} approved`);

    // Notify applicant
    try {
      await this.notificationsService.create({
        recipient_id: application.staff_id,
        type: NotificationType.LOAN,
        category: NotificationCategory.SUCCESS,
        title: 'Loan Application Approved',
        message: `Your loan application ${application.application_number} has been approved for ${dto.approvedAmount}.`,
        entity_type: 'loan_application',
        entity_id: id,
        priority: NotificationPriority.HIGH,
      });
    } catch (error) {
      this.logger.error(`Failed to send notifications: ${error.message}`);
    }

    return updated;
  }

  async rejectLoanApplication(id: string, remarks: string, userId: string) {
    const application = await this.findOneLoanApplication(id);

    const updated = await this.databaseService.queryOne(
      `UPDATE loan_applications 
       SET status = 'rejected', 
           rejection_reason = $1,
           rejected_by = $2,
           rejected_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [remarks, userId, id],
    );

    this.logger.log(`Loan application ${application.application_number} rejected`);

    // Notify applicant
    try {
      await this.notificationsService.create({
        recipient_id: application.staff_id,
        type: NotificationType.LOAN,
        category: NotificationCategory.WARNING,
        title: 'Loan Application Rejected',
        message: `Your loan application ${application.application_number} has been rejected. Reason: ${remarks}`,
        entity_type: 'loan_application',
        entity_id: id,
        priority: NotificationPriority.HIGH,
      });
    } catch (error) {
      this.logger.error(`Failed to send notifications: ${error.message}`);
    }

    return updated;
  }

  async deleteLoanApplication(id: string, userId: string) {
    const application = await this.findOneLoanApplication(id);

    if (application.status !== 'draft') {
      throw new BadRequestException('Can only delete draft applications');
    }

    await this.databaseService.query('DELETE FROM loan_guarantors WHERE loan_application_id = $1', [id]);
    await this.databaseService.query('DELETE FROM loan_applications WHERE id = $1', [id]);

    this.logger.log(`Loan application ${application.application_number} deleted`);
    return { message: 'Application deleted successfully' };
  }

  // ==================== GUARANTORS ====================

  async addGuarantor(dto: CreateGuarantorDto, userId: string) {
    const application = await this.findOneLoanApplication(dto.loanApplicationId);

    if (application.status !== 'draft') {
      throw new BadRequestException('Can only add guarantors to draft applications');
    }

    // Get guarantor staff info
    const guarantor = await this.databaseService.queryOne(
      `SELECT id, staff_number, 
        bio_data->>'first_name' as first_name,
        bio_data->>'last_name' as last_name
      FROM staff WHERE id = $1`,
      [dto.guarantorStaffId],
    );

    if (!guarantor) {
      throw new NotFoundException('Guarantor staff not found');
    }

    // Check if already added
    const existing = await this.databaseService.queryOne(
      `SELECT id FROM loan_guarantors 
       WHERE loan_application_id = $1 AND guarantor_staff_id = $2`,
      [dto.loanApplicationId, dto.guarantorStaffId],
    );

    if (existing) {
      throw new BadRequestException('Guarantor already added to this application');
    }

    const created = await this.databaseService.queryOne(
      `INSERT INTO loan_guarantors (
        loan_application_id, guarantor_staff_id, guarantor_staff_number,
        guarantor_name, relationship, consent_status, remarks
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING *`,
      [
        dto.loanApplicationId,
        dto.guarantorStaffId,
        guarantor.staff_number,
        `${guarantor.first_name} ${guarantor.last_name}`,
        dto.relationship || null,
        dto.remarks || null,
      ],
    );

    this.logger.log(`Guarantor added to application ${application.application_number}`);
    return created;
  }

  async findGuarantors(filters: {
    loanApplicationId?: string;
    guarantorStaffId?: string;
  }) {
    let query = `
      SELECT lg.*, la.application_number, 
        s.first_name || ' ' || s.last_name as applicant_name,
        la.amount_requested, la.loan_type_name
      FROM loan_guarantors lg
      LEFT JOIN loan_applications la ON lg.loan_application_id = la.id
      LEFT JOIN staff s ON la.staff_id = s.id
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.loanApplicationId) {
      conditions.push(`lg.loan_application_id = $${paramIndex++}`);
      params.push(filters.loanApplicationId);
    }
    if (filters.guarantorStaffId) {
      conditions.push(`lg.guarantor_staff_id = $${paramIndex++}`);
      params.push(filters.guarantorStaffId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY lg.created_at DESC';

    return this.databaseService.query(query, params);
  }

  async findOneGuarantor(id: string) {
    const guarantor = await this.databaseService.queryOne(
      `SELECT lg.*, la.application_number, 
        s.first_name || ' ' || s.last_name as applicant_name
      FROM loan_guarantors lg
      LEFT JOIN loan_applications la ON lg.loan_application_id = la.id
      LEFT JOIN staff s ON la.staff_id = s.id
      WHERE lg.id = $1`,
      [id],
    );

    if (!guarantor) {
      throw new NotFoundException('Guarantor not found');
    }

    return guarantor;
  }

  async updateGuarantor(id: string, dto: UpdateGuarantorDto, userId: string) {
    const guarantor = await this.findOneGuarantor(id);

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dto.consentStatus) {
      updates.push(`consent_status = $${paramIndex++}`);
      values.push(dto.consentStatus);
    }
    if (dto.consentComments) {
      updates.push(`consent_comments = $${paramIndex++}`);
      values.push(dto.consentComments);
    }
    if (dto.consentDate) {
      updates.push(`consent_date = $${paramIndex++}`);
      values.push(dto.consentDate);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE loan_guarantors 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updated = await this.databaseService.queryOne(query, values);

    // Check if all guarantors responded
    const allGuarantors = await this.findGuarantors({
      loanApplicationId: guarantor.loan_application_id,
    });

    const allResponded = allGuarantors.every(g => g.consent_status !== 'pending');
    const allAccepted = allGuarantors.every(g => g.consent_status === 'accepted');
    const anyDeclined = allGuarantors.some(g => g.consent_status === 'declined');

    if (allResponded) {
      let newStatus = 'pending';
      let rejectionReason = null;

      if (anyDeclined) {
        newStatus = 'rejected';
        rejectionReason = 'One or more guarantors declined';
      } else if (allAccepted) {
        newStatus = 'pending';
      }

      await this.databaseService.query(
        `UPDATE loan_applications 
         SET status = $1, rejection_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [newStatus, rejectionReason, guarantor.loan_application_id],
      );
    }

    return updated;
  }

  async removeGuarantor(id: string, userId: string) {
    const guarantor = await this.findOneGuarantor(id);

    const application = await this.findOneLoanApplication(guarantor.loan_application_id);
    if (application.status !== 'draft') {
      throw new BadRequestException('Can only remove guarantors from draft applications');
    }

    await this.databaseService.query('DELETE FROM loan_guarantors WHERE id = $1', [id]);
    this.logger.log(`Guarantor removed from application ${application.application_number}`);
    return { message: 'Guarantor removed successfully' };
  }

  // ==================== DISBURSEMENTS ====================

  async disburseLoan(dto: DisburseLoanDto, userId: string) {
    const application = await this.findOneLoanApplication(dto.loanApplicationId);

    if (application.status !== 'approved') {
      throw new BadRequestException('Application must be approved before disbursement');
    }

    // Generate disbursement number
    const year = new Date().getFullYear();
    const count = await this.databaseService.queryOne(
      `SELECT COUNT(*) as count FROM loan_disbursements 
       WHERE disbursement_number LIKE $1`,
      [`DISB/${year}/%`],
    );
    const disbNumber = `DISB/${year}/${String(parseInt(count.count) + 1).padStart(5, '0')}`;

    const disbursement = await this.databaseService.queryOne(
      `INSERT INTO loan_disbursements (
        disbursement_number, loan_application_id, staff_id, staff_number,
        amount_disbursed, disbursement_date, disbursement_method,
        start_month, tenure_months, monthly_deduction, balance_outstanding,
        payroll_batch_id, disbursed_by, remarks, status,
        bank_name, account_number, account_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', $15, $16, $17)
      RETURNING *`,
      [
        disbNumber,
        dto.loanApplicationId,
        application.staff_id,
        application.staff_number,
        dto.amount,
        dto.disbursementDate,
        'bank_transfer',
        new Date().toISOString().slice(0, 7),
        application.tenure_months,
        application.monthly_deduction,
        dto.amount,
        dto.payrollBatchId || null,
        userId,
        dto.remarks || null,
        dto.bankName || application.staff_bank_name || null,
        dto.accountNumber || application.staff_account_number || null,
        dto.accountName || application.staff_account_name || null,
      ],
    );

    // Update application status
    await this.databaseService.query(
      `UPDATE loan_applications 
       SET status = 'disbursed', updated_at = NOW()
       WHERE id = $1`,
      [dto.loanApplicationId],
    );

    this.logger.log(`Loan ${disbNumber} disbursed to staff ${application.staff_number}`);
    return disbursement;
  }

  async findAllDisbursements(filters: {
    staffId?: string;
    status?: string;
  }) {
    let query = `
      SELECT ld.*, la.application_number, la.loan_type_name
      FROM loan_disbursements ld
      LEFT JOIN loan_applications la ON ld.loan_application_id = la.id
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.staffId) {
      conditions.push(`ld.staff_id = $${paramIndex++}`);
      params.push(filters.staffId);
    }
    if (filters.status) {
      conditions.push(`ld.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ld.disbursement_date DESC';

    return this.databaseService.query(query, params);
  }

  async findOneDisbursement(id: string) {
    const disbursement = await this.databaseService.queryOne(
      `SELECT ld.*, la.application_number, la.loan_type_name
      FROM loan_disbursements ld
      LEFT JOIN loan_applications la ON ld.loan_application_id = la.id
      WHERE ld.id = $1`,
      [id],
    );

    if (!disbursement) {
      throw new NotFoundException('Disbursement not found');
    }

    return disbursement;
  }

  async getDisbursementRepayments(id: string) {
    const disbursement = await this.findOneDisbursement(id);

    return this.databaseService.query(
      `SELECT * FROM loan_repayments 
       WHERE disbursement_id = $1 
       ORDER BY repayment_date DESC`,
      [id],
    );
  }

  async completeDisbursement(id: string, userId: string) {
    const disbursement = await this.findOneDisbursement(id);

    if (disbursement.balance_outstanding > 0) {
      throw new BadRequestException('Cannot complete disbursement with outstanding balance');
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE loan_disbursements 
       SET status = 'completed', end_month = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [new Date().toISOString().slice(0, 7), id],
    );

    this.logger.log(`Disbursement ${disbursement.disbursement_number} marked as completed`);
    return updated;
  }

  // ==================== REPAYMENTS ====================

  async recordRepayment(dto: RecordRepaymentDto, userId: string) {
    const disbursement = await this.findOneDisbursement(dto.disbursementId);

    if (disbursement.status !== 'active') {
      throw new BadRequestException('Disbursement is not active');
    }

    const repayment = await this.databaseService.queryOne(
      `INSERT INTO loan_repayments (
        disbursement_id, staff_id, amount, repayment_date, 
        month, payroll_batch_id, recorded_by
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6)
      RETURNING *`,
      [
        dto.disbursementId,
        disbursement.staff_id,
        dto.amount,
        dto.month,
        dto.payrollBatchId || null,
        userId,
      ],
    );

    // Update disbursement balance
    const newBalance = disbursement.balance_outstanding - dto.amount;
    await this.databaseService.query(
      `UPDATE loan_disbursements 
       SET balance_outstanding = $1, 
           status = CASE WHEN $1 <= 0 THEN 'completed' ELSE status END,
           updated_at = NOW()
       WHERE id = $2`,
      [newBalance, dto.disbursementId],
    );

    this.logger.log(`Repayment of ₦${dto.amount} recorded for disbursement ${disbursement.disbursement_number}`);
    return repayment;
  }

  async findAllRepayments(filters: {
    disbursementId?: string;
    staffId?: string;
  }) {
    let query = `
      SELECT lr.*, ld.disbursement_number, ld.staff_number
      FROM loan_repayments lr
      LEFT JOIN loan_disbursements ld ON lr.disbursement_id = ld.id
    `;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.disbursementId) {
      conditions.push(`lr.disbursement_id = $${paramIndex++}`);
      params.push(filters.disbursementId);
    }
    if (filters.staffId) {
      conditions.push(`lr.staff_id = $${paramIndex++}`);
      params.push(filters.staffId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY lr.repayment_date DESC';

    return this.databaseService.query(query, params);
  }

  async findOneRepayment(id: string) {
    const repayment = await this.databaseService.queryOne(
      `SELECT lr.*, ld.disbursement_number, ld.staff_number
      FROM loan_repayments lr
      LEFT JOIN loan_disbursements ld ON lr.disbursement_id = ld.id
      WHERE lr.id = $1`,
      [id],
    );

    if (!repayment) {
      throw new NotFoundException('Repayment not found');
    }

    return repayment;
  }

  // ==================== STATS ====================

  async getLoanStats() {
    const stats = await this.databaseService.queryOne(
      `SELECT 
        COUNT(DISTINCT CASE WHEN la.status IN ('pending', 'guarantor_pending') THEN la.id END) as pending_applications,
        COUNT(DISTINCT CASE WHEN la.status = 'approved' THEN la.id END) as approved_applications,
        COUNT(DISTINCT CASE WHEN ld.status = 'active' THEN ld.id END) as active_disbursements,
        COALESCE(SUM(CASE WHEN ld.status = 'active' THEN ld.balance_outstanding ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(ld.amount_disbursed), 0) as total_disbursed
      FROM loan_applications la
      LEFT JOIN loan_disbursements ld ON la.id = ld.loan_application_id`,
    );

    return stats;
  }

  async getStaffLoanStats(staffId: string) {
    const stats = await this.databaseService.queryOne(
      `SELECT 
        COUNT(DISTINCT la.id) as total_applications,
        COUNT(DISTINCT CASE WHEN la.status = 'approved' THEN la.id END) as approved_applications,
        COUNT(DISTINCT ld.id) as total_disbursements,
        COALESCE(SUM(ld.amount_disbursed), 0) as total_amount_disbursed,
        COALESCE(SUM(ld.balance_outstanding), 0) as total_outstanding
      FROM loan_applications la
      LEFT JOIN loan_disbursements ld ON la.id = ld.loan_application_id
      WHERE la.staff_id = $1`,
      [staffId],
    );

    return stats;
  }

  private normalizeMonth(month?: string): string {
    if (!month) {
      return new Date().toISOString().slice(0, 7);
    }
    if (/^\d{4}-\d{2}$/.test(month)) {
      return month;
    }
    const parsed = new Date(month);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid month value: ${month}`);
    }
    return parsed.toISOString().slice(0, 7);
  }

  private normalizeDate(date?: string): string {
    if (!date) {
      return new Date().toISOString().slice(0, 10);
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value: ${date}`);
    }
    return parsed.toISOString().slice(0, 10);
  }

  private async resolveStaff(row: { staffId?: string; staffNumber?: string }) {
    if (row.staffId) {
      const staff = await this.databaseService.queryOne(
        `SELECT id, staff_number, first_name, last_name
         FROM staff WHERE id = $1`,
        [row.staffId],
      );
      if (!staff) throw new NotFoundException(`Staff not found for id ${row.staffId}`);
      return staff;
    }
    if (!row.staffNumber) {
      throw new BadRequestException('Provide staffId or staffNumber');
    }
    const staff = await this.databaseService.queryOne(
      `SELECT id, staff_number, first_name, last_name
       FROM staff WHERE staff_number = $1`,
      [row.staffNumber],
    );
    if (!staff) throw new NotFoundException(`Staff not found for number ${row.staffNumber}`);
    return staff;
  }

  private async resolveLoanType(row: { loanTypeId?: string; loanTypeCode?: string }) {
    if (row.loanTypeId) {
      const loanType = await this.databaseService.queryOne(
        `SELECT id, code, name, interest_rate
         FROM loan_types WHERE id = $1`,
        [row.loanTypeId],
      );
      if (!loanType) throw new NotFoundException(`Loan type not found for id ${row.loanTypeId}`);
      return loanType;
    }
    if (!row.loanTypeCode) {
      throw new BadRequestException('Provide loanTypeId or loanTypeCode');
    }
    const loanType = await this.databaseService.queryOne(
      `SELECT id, code, name, interest_rate
       FROM loan_types WHERE code = $1`,
      [row.loanTypeCode],
    );
    if (!loanType) throw new NotFoundException(`Loan type not found for code ${row.loanTypeCode}`);
    return loanType;
  }

  async importMigrationData(dto: LoanMigrationImportDto, userId: string) {
    const dryRun = Boolean(dto.dryRun);
    const result = {
      dryRun,
      summary: {
        loans: { total: dto.loans?.length || 0, success: 0, failed: 0 },
        repayments: { total: dto.repayments?.length || 0, success: 0, failed: 0 },
      },
      errors: [] as Array<{ section: string; row: number; message: string }>,
      references: [] as Array<{ row: number; legacyReference?: string; disbursementNumber: string }>,
    };

    const addError = (section: string, row: number, error: any) => {
      result.errors.push({
        section,
        row,
        message: error?.message || 'Unknown import error',
      });
    };

    const legacyDisbursementMap = new Map<string, string>();

    for (let i = 0; i < (dto.loans || []).length; i++) {
      const row = dto.loans![i] as MigrationLoanRowDto;
      try {
        const staff = await this.resolveStaff({ staffId: row.staffId, staffNumber: row.staffNumber });
        const loanType = await this.resolveLoanType({ loanTypeId: row.loanTypeId, loanTypeCode: row.loanTypeCode });

        const principal = Number(row.principalAmount || 0);
        const amountRepaid = Number(row.amountRepaid || 0);
        const normalizedOutstanding =
          row.outstandingBalance !== undefined
            ? Number(row.outstandingBalance)
            : Math.max(0, principal - amountRepaid);
        const interestRate = row.interestRate !== undefined ? Number(row.interestRate) : Number(loanType.interest_rate || 0);
        const interestAmount = (principal * interestRate * row.tenureMonths) / (12 * 100);
        const totalRepayment = principal + interestAmount;
        const monthlyDeduction = Math.round(totalRepayment / row.tenureMonths);
        const appStatus = LoanStatus.DISBURSED;
        const disbursementStatus =
          normalizedOutstanding <= 0
            ? LoanStatus.COMPLETED
            : row.status === LoanStatus.DEFAULTED
              ? LoanStatus.DEFAULTED
              : 'active';

        const disbursementDate = this.normalizeDate(row.disbursementDate);
        const startMonth = this.normalizeMonth(row.startMonth || disbursementDate);
        const openingRepaymentMonth = this.normalizeMonth(row.startMonth || disbursementDate);

        // Generate numbers consistent with current format
        const year = new Date().getFullYear();
        const appCount = await this.databaseService.queryOne(
          `SELECT COUNT(*) as count FROM loan_applications WHERE application_number LIKE $1`,
          [`LN/${year}/%`],
        );
        const applicationNumber = `LN/${year}/${String(parseInt(appCount.count, 10) + 1).padStart(5, '0')}`;

        const disbCount = await this.databaseService.queryOne(
          `SELECT COUNT(*) as count FROM loan_disbursements WHERE disbursement_number LIKE $1`,
          [`DISB/${year}/%`],
        );
        const disbursementNumber = `DISB/${year}/${String(parseInt(disbCount.count, 10) + 1).padStart(5, '0')}`;

        if (!dryRun) {
          const app = await this.databaseService.queryOne(
            `INSERT INTO loan_applications (
              application_number, staff_id, staff_number, staff_name,
              loan_type_id, loan_type_name, amount_requested, amount_approved,
              purpose, tenure_months, monthly_deduction, total_repayment, interest_amount,
              status, approved_by, approved_at, approval_remarks, submitted_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8,
              $9, $10, $11, $12, $13,
              $14, $15, NOW(), $16, NOW()
            ) RETURNING *`,
            [
              applicationNumber,
              staff.id,
              staff.staff_number,
              `${staff.first_name} ${staff.last_name}`.trim(),
              loanType.id,
              loanType.name,
              principal,
              principal,
              row.purpose || 'Legacy migration import',
              row.tenureMonths,
              monthlyDeduction,
              Math.round(totalRepayment * 100) / 100,
              Math.round(interestAmount * 100) / 100,
              appStatus,
              userId,
              row.remarks || 'Imported from legacy records',
            ],
          );

          const disbursement = await this.databaseService.queryOne(
            `INSERT INTO loan_disbursements (
              disbursement_number, loan_application_id, staff_id, staff_number,
              amount_disbursed, disbursement_date, disbursement_method, start_month, end_month,
              tenure_months, monthly_deduction, balance_outstanding, disbursed_by,
              remarks, status, bank_name, account_number, account_name
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8, $9,
              $10, $11, $12, $13,
              $14, $15, $16, $17, $18
            ) RETURNING *`,
            [
              disbursementNumber,
              app.id,
              staff.id,
              staff.staff_number,
              principal,
              disbursementDate,
              row.disbursementMethod || 'migration',
              startMonth,
              row.endMonth ? this.normalizeMonth(row.endMonth) : null,
              row.tenureMonths,
              monthlyDeduction,
              normalizedOutstanding,
              userId,
              row.remarks || 'Imported from legacy records',
              disbursementStatus,
              null,
              null,
              null,
            ],
          );

          if (amountRepaid > 0) {
            await this.databaseService.query(
              `INSERT INTO loan_repayments (
                disbursement_id, staff_id, amount, repayment_date, month,
                payment_method, reference_number, recorded_by, remarks
              ) VALUES (
                $1, $2, $3, NOW(), $4,
                $5, $6, $7, $8
              )`,
              [
                disbursement.id,
                staff.id,
                amountRepaid,
                openingRepaymentMonth,
                'migration',
                row.legacyReference || `MIG-OPEN-${disbursementNumber}`,
                userId,
                'Opening repaid amount from legacy migration',
              ],
            );
          }
        }

        if (row.legacyReference) {
          legacyDisbursementMap.set(row.legacyReference, disbursementNumber);
        }
        result.references.push({
          row: i + 1,
          legacyReference: row.legacyReference,
          disbursementNumber,
        });
        result.summary.loans.success++;
      } catch (error) {
        result.summary.loans.failed++;
        addError('loans', i + 1, error);
      }
    }

    for (let i = 0; i < (dto.repayments || []).length; i++) {
      const row = dto.repayments![i] as MigrationLoanRepaymentRowDto;
      try {
        let disbursementNumber = row.disbursementNumber || '';
        if (!disbursementNumber && row.legacyReference) {
          disbursementNumber = legacyDisbursementMap.get(row.legacyReference) || '';
        }
        if (!disbursementNumber) {
          throw new BadRequestException('Provide disbursementNumber or a mapped legacyReference');
        }

        const disbursement = await this.databaseService.queryOne(
          `SELECT id, staff_id, balance_outstanding, status FROM loan_disbursements
           WHERE disbursement_number = $1`,
          [disbursementNumber],
        );
        if (!disbursement) {
          throw new NotFoundException(`Disbursement not found for ${disbursementNumber}`);
        }
        const month = this.normalizeMonth(row.month);
        const amount = Number(row.amount || 0);
        const newBalance = Number(disbursement.balance_outstanding || 0) - amount;

        if (!dryRun) {
          await this.databaseService.query(
            `INSERT INTO loan_repayments (
              disbursement_id, staff_id, amount, repayment_date, month,
              payment_method, reference_number, recorded_by, remarks
            ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8)`,
            [
              disbursement.id,
              disbursement.staff_id,
              amount,
              month,
              'migration',
              row.legacyReference || `MIG-RPY-${disbursementNumber}-${i + 1}`,
              userId,
              'Repayment from legacy migration',
            ],
          );
          await this.databaseService.query(
            `UPDATE loan_disbursements
             SET balance_outstanding = $1,
                 status = CASE WHEN $1 <= 0 THEN 'completed' ELSE status END,
                 updated_at = NOW()
             WHERE id = $2`,
            [newBalance, disbursement.id],
          );
        }

        result.summary.repayments.success++;
      } catch (error) {
        result.summary.repayments.failed++;
        addError('repayments', i + 1, error);
      }
    }

    return result;
  }
}
