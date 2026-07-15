import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { CooperativeType, CreateCooperativeDto } from './dto/create-cooperative.dto';
import { AddCooperativeMemberDto } from './dto/add-member.dto';
import { RecordContributionDto } from './dto/record-contribution.dto';
import {
  CooperativeMigrationImportDto,
  MigrationContributionRowDto,
  MigrationMemberRowDto,
  MigrationOpeningBalanceRowDto,
} from './dto/migration-import.dto';

const CONTRIBUTION_TOTAL_SQL = `COALESCE(SUM(CASE
  WHEN cc.contribution_type IN ('registration_fee', 'annual_subscription') THEN 0
  ELSE cc.amount
END), 0)`;

@Injectable()
export class CooperativesService {
  private readonly logger = new Logger(CooperativesService.name);

  constructor(private databaseService: DatabaseService) {}

  // ==================== COOPERATIVES ====================

  /**
   * Create a new cooperative
   */
  async createCooperative(dto: CreateCooperativeDto, userId: string) {
    // Check if code already exists
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM cooperatives WHERE code = $1',
      [dto.code],
    );

    if (existing) {
      throw new BadRequestException(`Cooperative with code ${dto.code} already exists`);
    }

    const cooperative = await this.databaseService.queryOne(
      `INSERT INTO cooperatives (
        code, name, description, type, registration_fee, monthly_contribution, 
        interest_rate, status, created_by,
        registration_number, date_established, cooperative_type, monthly_contribution_required,
        share_capital_value, minimum_shares, interest_rate_on_loans, maximum_loan_multiplier,
        meeting_schedule, chairman_name, secretary_name, treasurer_name, contact_email,
        contact_phone, bank_name, bank_account_number, auto_deduct_contribution
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.description || null,
        dto.type || 'thrift',
        dto.registrationFee || 0,
        dto.monthlyContribution || 0,
        dto.interestRate || 0,
        dto.status || 'active',
        userId,
        dto.registration_number,
        dto.date_established,
        dto.cooperative_type,
        dto.monthly_contribution_required,
        dto.share_capital_value,
        dto.minimum_shares,
        dto.interest_rate_on_loans,
        dto.maximum_loan_multiplier,
        dto.meeting_schedule,
        dto.chairman_name,
        dto.secretary_name,
        dto.treasurer_name,
        dto.contact_email,
        dto.contact_phone,
        dto.bank_name,
        dto.bank_account_number,
        dto.auto_deduct_contribution || false
      ],
    );

    this.logger.log(`Cooperative ${dto.code} created by user ${userId}`);
    
    // Transform result to match camelCase API expectations if needed or return as is (database returns snake_case)
    // For consistency with other endpoints, we might want to map it, but NestJS/ClassSerializer usually handles this if configured.
    // However, the error message suggests strict DTO validation on the response or request side.
    // The user error specifically mentioned "property created_by should not exist" which usually comes from ValidationPipe whitelisting
    // on the REQUEST body.
    
    return cooperative;
  }

  /**
   * Get all cooperatives
   */
  async findAllCooperatives(status?: string) {
    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM cooperative_members cm WHERE cm.cooperative_id = c.id AND cm.status = 'active') as total_members,
        (SELECT ${CONTRIBUTION_TOTAL_SQL} FROM cooperative_contributions cc WHERE cc.cooperative_id = c.id) as total_contributions,
        (SELECT ${CONTRIBUTION_TOTAL_SQL} FROM cooperative_contributions cc WHERE cc.cooperative_id = c.id) as total_share_capital,
        (
          SELECT COALESCE(SUM(ld.amount_disbursed), 0)
          FROM loan_disbursements ld
          JOIN loan_applications la ON ld.loan_application_id = la.id
          JOIN loan_types lt ON la.loan_type_id = lt.id
          WHERE lt.cooperative_id = c.id
        ) as total_loans_disbursed,
        (
          SELECT COALESCE(SUM(ld.balance_outstanding), 0)
          FROM loan_disbursements ld
          JOIN loan_applications la ON ld.loan_application_id = la.id
          JOIN loan_types lt ON la.loan_type_id = lt.id
          WHERE lt.cooperative_id = c.id
            AND ld.status = 'active'
        ) as total_loans_outstanding
      FROM cooperatives c
    `;
    const params = [];

    if (status) {
      query += ' WHERE c.status = $1';
      params.push(status);
    }

    query += ' ORDER BY c.name';

    return this.databaseService.query(query, params);
  }

  /**
   * Get cooperative by ID with member count and total contributions
   */
  async findOneCooperative(id: string) {
    const cooperative = await this.databaseService.queryOne(
      `SELECT 
        c.*,
        (SELECT COUNT(*) FROM cooperative_members cm WHERE cm.cooperative_id = c.id AND cm.status = 'active') as member_count,
        (SELECT ${CONTRIBUTION_TOTAL_SQL} FROM cooperative_contributions cc WHERE cc.cooperative_id = c.id) as total_contributions,
        (SELECT ${CONTRIBUTION_TOTAL_SQL} FROM cooperative_contributions cc WHERE cc.cooperative_id = c.id) as total_share_capital,
        (
          SELECT COALESCE(SUM(ld.amount_disbursed), 0)
          FROM loan_disbursements ld
          JOIN loan_applications la ON ld.loan_application_id = la.id
          JOIN loan_types lt ON la.loan_type_id = lt.id
          WHERE lt.cooperative_id = c.id
        ) as total_loans_disbursed,
        (
          SELECT COALESCE(SUM(ld.balance_outstanding), 0)
          FROM loan_disbursements ld
          JOIN loan_applications la ON ld.loan_application_id = la.id
          JOIN loan_types lt ON la.loan_type_id = lt.id
          WHERE lt.cooperative_id = c.id
            AND ld.status = 'active'
        ) as total_loans_outstanding
      FROM cooperatives c
      WHERE c.id = $1`,
      [id],
    );

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    return cooperative;
  }

  /**
   * Update cooperative
   */
  async updateCooperative(id: string, dto: Partial<CreateCooperativeDto>, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM cooperatives WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException('Cooperative not found');
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dto.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.type) {
      updates.push(`type = $${paramIndex++}`);
      values.push(dto.type);
    }
    if (dto.registrationFee !== undefined) {
      updates.push(`registration_fee = $${paramIndex++}`);
      values.push(dto.registrationFee);
    }
    if (dto.monthlyContribution !== undefined) {
      updates.push(`monthly_contribution = $${paramIndex++}`);
      values.push(dto.monthlyContribution);
    }
    if (dto.interestRate !== undefined) {
      updates.push(`interest_rate = $${paramIndex++}`);
      values.push(dto.interestRate);
    }
    
    // New fields
    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
    }
    if (dto.registration_number) {
      updates.push(`registration_number = $${paramIndex++}`);
      values.push(dto.registration_number);
    }
    if (dto.date_established) {
      updates.push(`date_established = $${paramIndex++}`);
      values.push(dto.date_established);
    }
    if (dto.cooperative_type) {
      updates.push(`cooperative_type = $${paramIndex++}`);
      values.push(dto.cooperative_type);
    }
    if (dto.monthly_contribution_required !== undefined) {
      updates.push(`monthly_contribution_required = $${paramIndex++}`);
      values.push(dto.monthly_contribution_required);
    }
    if (dto.share_capital_value !== undefined) {
      updates.push(`share_capital_value = $${paramIndex++}`);
      values.push(dto.share_capital_value);
    }
    if (dto.minimum_shares !== undefined) {
      updates.push(`minimum_shares = $${paramIndex++}`);
      values.push(dto.minimum_shares);
    }
    if (dto.interest_rate_on_loans !== undefined) {
      updates.push(`interest_rate_on_loans = $${paramIndex++}`);
      values.push(dto.interest_rate_on_loans);
    }
    if (dto.maximum_loan_multiplier !== undefined) {
      updates.push(`maximum_loan_multiplier = $${paramIndex++}`);
      values.push(dto.maximum_loan_multiplier);
    }
    if (dto.meeting_schedule) {
      updates.push(`meeting_schedule = $${paramIndex++}`);
      values.push(dto.meeting_schedule);
    }
    if (dto.chairman_name) {
      updates.push(`chairman_name = $${paramIndex++}`);
      values.push(dto.chairman_name);
    }
    if (dto.secretary_name) {
      updates.push(`secretary_name = $${paramIndex++}`);
      values.push(dto.secretary_name);
    }
    if (dto.treasurer_name) {
      updates.push(`treasurer_name = $${paramIndex++}`);
      values.push(dto.treasurer_name);
    }
    if (dto.contact_email) {
      updates.push(`contact_email = $${paramIndex++}`);
      values.push(dto.contact_email);
    }
    if (dto.contact_phone) {
      updates.push(`contact_phone = $${paramIndex++}`);
      values.push(dto.contact_phone);
    }
    if (dto.bank_name) {
      updates.push(`bank_name = $${paramIndex++}`);
      values.push(dto.bank_name);
    }
    if (dto.bank_account_number) {
      updates.push(`bank_account_number = $${paramIndex++}`);
      values.push(dto.bank_account_number);
    }
    if (dto.auto_deduct_contribution !== undefined) {
      updates.push(`auto_deduct_contribution = $${paramIndex++}`);
      values.push(dto.auto_deduct_contribution);
    }

    updates.push(`updated_at = NOW()`);
    // updates.push(`updated_by = $${paramIndex++}`); // Removed as column doesn't exist
    // values.push(userId);
    values.push(id);

    const cooperative = await this.databaseService.queryOne(
      `UPDATE cooperatives SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    this.logger.log(`Cooperative ${id} updated by user ${userId}`);
    return cooperative;
  }

  /**
   * Delete cooperative
   */
  async deleteCooperative(id: string) {
    const cooperative = await this.databaseService.queryOne(
      'SELECT id FROM cooperatives WHERE id = $1',
      [id],
    );

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    // Check for existing members
    const existingMembers = await this.databaseService.queryOne(
      'SELECT 1 FROM cooperative_members WHERE cooperative_id = $1 LIMIT 1',
      [id],
    );

    if (existingMembers) {
      throw new BadRequestException('Cannot delete cooperative with existing members. Please remove members first.');
    }

    await this.databaseService.query(
      'DELETE FROM cooperatives WHERE id = $1',
      [id],
    );

    this.logger.log(`Cooperative ${id} deleted`);
    return { message: 'Cooperative deleted successfully' };
  }

  // ==================== COOPERATIVE MEMBERS ====================

  /**
   * Add staff to cooperative
   */
  async addMember(dto: AddCooperativeMemberDto, userId: string) {
    // Check if staff exists
    const staff = await this.databaseService.queryOne(
      'SELECT id, staff_number FROM staff WHERE id = $1',
      [dto.staffId],
    );

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Check if cooperative exists
    const cooperative = await this.databaseService.queryOne(
      'SELECT id, monthly_contribution, registration_fee FROM cooperatives WHERE id = $1',
      [dto.cooperativeId],
    );

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    // Check if already a member
    const existingMember = await this.databaseService.queryOne(
      'SELECT id, status FROM cooperative_members WHERE cooperative_id = $1 AND staff_id = $2',
      [dto.cooperativeId, dto.staffId],
    );

    if (existingMember && existingMember.status === 'active') {
      throw new BadRequestException('Staff is already an active member of this cooperative');
    }

    if (existingMember && existingMember.status === 'inactive') {
      // Reactivate membership
      const member = await this.databaseService.queryOne(
        `UPDATE cooperative_members 
        SET status = 'active',
            monthly_contribution = $1,
            shares_owned = $2,
            registration_fee_amount = $3,
            registration_fee_paid_at = NULL,
            annual_subscription_amount = $4,
            first_annual_subscription_paid_at = NULL,
            last_annual_subscription_year = NULL,
            updated_at = NOW(),
            updated_by = $5
        WHERE id = $6 RETURNING *`,
        [
          dto.monthlyContribution || cooperative.monthly_contribution,
          dto.shares_owned || 0,
          dto.registration_fee_amount ?? cooperative.registration_fee ?? 0,
          dto.annual_subscription_amount ?? 0,
          userId,
          existingMember.id,
        ],
      );

      this.logger.log(`Staff ${staff.staff_number} reactivated in cooperative ${dto.cooperativeId}`);
      return member;
    }

    // Add new member
    const member = await this.databaseService.queryOne(
      `INSERT INTO cooperative_members (
        cooperative_id, staff_id, monthly_contribution, shares_owned, registration_fee_amount,
        annual_subscription_amount, join_date, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'active', $7)
      RETURNING *`,
      [
        dto.cooperativeId,
        dto.staffId,
        dto.monthlyContribution || cooperative.monthly_contribution,
        dto.shares_owned || 0,
        dto.registration_fee_amount ?? cooperative.registration_fee ?? 0,
        dto.annual_subscription_amount ?? 0,
        userId,
      ],
    );

    this.logger.log(`Staff ${staff.staff_number} added to cooperative ${dto.cooperativeId}`);
    return member;
  }

  /**
   * Get all members of a cooperative
   */
  async getCooperativeMembers(cooperativeId: string, status?: string) {
    let query = `
      SELECT 
        cm.*,
        s.staff_number,
        -- Use staff number as member number since it is null in DB
        COALESCE(s.staff_number, 'N/A') as member_number,
        CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) as staff_name,
        s.first_name,
        s.last_name,
        s.email,
        COALESCE(d.name, 'Unassigned') as department,
        ${CONTRIBUTION_TOTAL_SQL} as total_contributions
      FROM cooperative_members cm
      JOIN staff s ON cm.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN cooperative_contributions cc ON cm.id = cc.member_id
      WHERE cm.cooperative_id = $1
    `;

    const params = [cooperativeId];

    if (status) {
      query += ' AND cm.status = $2';
      params.push(status);
    }

    query += ' GROUP BY cm.id, s.id, d.name ORDER BY s.staff_number';

    return this.databaseService.query(query, params);
  }

  /**
   * Get staff cooperative memberships
   */
  async getStaffCooperatives(staffId: string) {
    return this.databaseService.query(
      `SELECT 
        cm.*,
        c.code,
        c.name,
        c.type,
        c.monthly_contribution as cooperative_monthly_contribution,
        ${CONTRIBUTION_TOTAL_SQL} as total_contributions
      FROM cooperative_members cm
      JOIN cooperatives c ON cm.cooperative_id = c.id
      LEFT JOIN cooperative_contributions cc ON cm.id = cc.member_id
      WHERE cm.staff_id = $1 AND cm.status = 'active'
      GROUP BY cm.id, c.id
      ORDER BY c.name`,
      [staffId],
    );
  }

  /**
   * Remove member from cooperative
   */
  async removeMember(cooperativeId: string, staffId: string, userId: string) {
    const member = await this.databaseService.queryOne(
      'SELECT id FROM cooperative_members WHERE cooperative_id = $1 AND staff_id = $2 AND status = $3',
      [cooperativeId, staffId, 'active'],
    );

    if (!member) {
      throw new NotFoundException('Active membership not found');
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE cooperative_members 
      SET status = 'inactive', exit_date = NOW(), updated_at = NOW(), updated_by = $1
      WHERE id = $2 RETURNING *`,
      [userId, member.id],
    );

    this.logger.log(`Staff ${staffId} removed from cooperative ${cooperativeId}`);
    return updated;
  }

  // ==================== CONTRIBUTIONS ====================

  /**
   * Record contribution (manual or from payroll)
   */
  async recordContribution(dto: RecordContributionDto, userId: string) {
    // Verify member exists and is active
    const member = await this.databaseService.queryOne(
      `SELECT cm.*, s.staff_number, c.code as cooperative_code
      FROM cooperative_members cm
      JOIN staff s ON cm.staff_id = s.id
      JOIN cooperatives c ON cm.cooperative_id = c.id
      WHERE cm.id = $1 AND cm.cooperative_id = $2 AND cm.status = 'active'`,
      [dto.memberId, dto.cooperativeId],
    );

    if (!member) {
      throw new NotFoundException('Active cooperative member not found');
    }

    // Generate receipt number: [COOPERATIVE_CODE]-[4 RANDOM DIGITS]
    // Example: COOP-1234
    // If receipt_number is provided (e.g., from frontend), use it.
    // Otherwise, generate one.
    // Ensure we handle both snake_case and camelCase inputs for receipt number if frontend sends it.
    let receiptNumber = (dto as any).receiptNumber || dto.receipt_number;
    
    if (!receiptNumber) {
        // Use Math.floor(Math.random() * 9000) + 1000 to ensure 4 digits
        const randomDigits = Math.floor(Math.random() * 9000) + 1000;
        receiptNumber = `${member.cooperative_code}-${randomDigits}`;
    }

    const contribution = await this.databaseService.queryOne(
      `INSERT INTO cooperative_contributions (
        cooperative_id, member_id, amount, contribution_month, 
        payroll_batch_id, created_by, receipt_number,
        payment_method, contribution_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dto.cooperativeId,
        dto.memberId,
        dto.amount,
        dto.month,
        dto.payrollBatchId || null,
        userId,
        receiptNumber,
        (dto as any).paymentMethod || dto.payment_method || 'cash',
        (dto as any).contributionType || dto.contribution_type || 'regular',
      ],
    );

    this.logger.log(`Contribution recorded for member ${dto.memberId}: ${dto.amount} (Receipt: ${receiptNumber})`);
    return contribution;
  }

  /**
   * Delete contribution
   */
  async deleteContribution(id: string, userId: string) {
    const contribution = await this.databaseService.queryOne(
      'SELECT id FROM cooperative_contributions WHERE id = $1',
      [id],
    );

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    await this.databaseService.query(
      'DELETE FROM cooperative_contributions WHERE id = $1',
      [id],
    );

    this.logger.log(`Contribution ${id} deleted by user ${userId}`);
    return { message: 'Contribution deleted successfully' };
  }


  /**
   * Get all contributions across all cooperatives with optional filters
   */
  async getAllContributions(
    filters?: {
      cooperative_id?: string;
      member_id?: string;
      staff_id?: string;
      contribution_month?: string;
    }
  ) {
    let query = `
      SELECT 
        cc.*,
        cm.staff_id,
        s.staff_number,
        s.first_name,
        s.last_name,
        CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) as staff_name,
        c.name as cooperative_name
      FROM cooperative_contributions cc
      JOIN cooperative_members cm ON cc.member_id = cm.id
      JOIN staff s ON cm.staff_id = s.id
      JOIN cooperatives c ON cc.cooperative_id = c.id
    `;

    const params = [];
    let paramIndex = 1;
    const conditions = [];

    if (filters?.cooperative_id) {
      conditions.push(`cc.cooperative_id = $${paramIndex++}`);
      params.push(filters.cooperative_id);
    }

    if (filters?.member_id) {
      conditions.push(`cc.member_id = $${paramIndex++}`);
      params.push(filters.member_id);
    }

    if (filters?.staff_id) {
      conditions.push(`cm.staff_id = $${paramIndex++}`);
      params.push(filters.staff_id);
    }

    if (filters?.contribution_month) {
      conditions.push(`cc.contribution_month = $${paramIndex++}`);
      params.push(filters.contribution_month);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY cc.created_at DESC';

    return this.databaseService.query(query, params);
  }

  /**
   * Get contributions for a cooperative
   */
  async getCooperativeContributions(cooperativeId: string, month?: string) {
    let query = `
      SELECT 
        cc.*,
        cm.staff_id,
        s.staff_number,
        s.first_name,
        s.last_name,
        CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) as staff_name,
        c.name as cooperative_name
      FROM cooperative_contributions cc
      JOIN cooperative_members cm ON cc.member_id = cm.id
      JOIN staff s ON cm.staff_id = s.id
      JOIN cooperatives c ON cc.cooperative_id = c.id
      WHERE cc.cooperative_id = $1
    `;

    const params = [cooperativeId];

    if (month) {
      query += ' AND cc.contribution_month = $2';
      params.push(month);
    }

    query += ' ORDER BY cc.created_at DESC';

    return this.databaseService.query(query, params);
  }

  /**
   * Get member contribution history
   */
  async getMemberContributions(memberId: string) {
    return this.databaseService.query(
      `SELECT 
        cc.*,
        pb.batch_number,
        pb.month as payroll_month,
        pb.year as payroll_year
      FROM cooperative_contributions cc
      LEFT JOIN payroll_batches pb ON cc.payroll_batch_id = pb.id
      WHERE cc.member_id = $1
      ORDER BY cc.contribution_month DESC`,
      [memberId],
    );
  }

  /**
   * Bulk record contributions from payroll
   */
  async bulkRecordFromPayroll(payrollBatchId: string, contributions: Array<{
    cooperativeId: string;
    memberId: string;
    amount: number;
    month: string;
    contributionType?: string;
  }>, userId: string) {
    if (contributions.length === 0) {
      return [];
    }

    return this.databaseService.transaction(async (client) => {
      const values = contributions
        .map((_, i) => {
          const baseIndex = i * 7;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, 'payroll_deduction', $${baseIndex + 6}, $${baseIndex + 7})`;
        })
        .join(', ');

      const params = contributions.flatMap((c) => [
        c.cooperativeId,
        c.memberId,
        c.amount,
        c.month,
        payrollBatchId,
        c.contributionType || 'regular',
        userId,
      ]);

      const result = await client.query(
        `INSERT INTO cooperative_contributions (
          cooperative_id, member_id, amount, contribution_month, payroll_batch_id, payment_method, contribution_type, created_by
        ) VALUES ${values}
        RETURNING *`,
        params,
      );

      const payrollYear = Number(String(contributions[0]?.month || '').slice(0, 4)) || new Date().getFullYear();
      const registrationMemberIds = Array.from(
        new Set(
          contributions
            .filter((contribution) => contribution.contributionType === 'registration_fee')
            .map((contribution) => contribution.memberId),
        ),
      );
      const annualMemberIds = Array.from(
        new Set(
          contributions
            .filter((contribution) => contribution.contributionType === 'annual_subscription')
            .map((contribution) => contribution.memberId),
        ),
      );

      if (registrationMemberIds.length > 0) {
        await client.query(
          `UPDATE cooperative_members
           SET registration_fee_paid_at = COALESCE(registration_fee_paid_at, NOW()),
               updated_at = NOW(),
               updated_by = $1
           WHERE id = ANY($2::uuid[])`,
          [userId, registrationMemberIds],
        );
      }

      if (annualMemberIds.length > 0) {
        await client.query(
          `UPDATE cooperative_members
           SET first_annual_subscription_paid_at = COALESCE(first_annual_subscription_paid_at, NOW()),
               last_annual_subscription_year = GREATEST(COALESCE(last_annual_subscription_year, 0), $1),
               updated_at = NOW(),
               updated_by = $2
           WHERE id = ANY($3::uuid[])`,
          [payrollYear, userId, annualMemberIds],
        );
      }

      this.logger.log(`Bulk recorded ${contributions.length} contributions from payroll ${payrollBatchId}`);
      return result.rows;
    });
  }

  async getAllMembers(filters?: { staffId?: string; cooperativeId?: string; status?: string }) {
    let query = `
      SELECT 
        cm.*,
        s.staff_number,
        COALESCE(s.staff_number, 'N/A') as member_number,
        CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) as staff_name,
        s.first_name,
        s.last_name,
        s.email,
        c.name as cooperative_name,
        COALESCE(d.name, 'Unassigned') as department,
        ${CONTRIBUTION_TOTAL_SQL} as total_contributions
      FROM cooperative_members cm
      JOIN staff s ON cm.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      JOIN cooperatives c ON cm.cooperative_id = c.id
      LEFT JOIN cooperative_contributions cc ON cm.id = cc.member_id
    `;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (filters?.staffId) {
      conditions.push(`cm.staff_id = $${paramIndex++}`);
      params.push(filters.staffId);
    }

    if (filters?.cooperativeId) {
      conditions.push(`cm.cooperative_id = $${paramIndex++}`);
      params.push(filters.cooperativeId);
    }

    if (filters?.status) {
      conditions.push(`cm.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' GROUP BY cm.id, s.staff_number, s.first_name, s.middle_name, s.last_name, s.email, c.name, d.name ORDER BY cm.created_at DESC';

    return this.databaseService.query(query, params);
  }

  async getMemberById(id: string) {
    const member = await this.databaseService.queryOne(
      `SELECT 
        cm.*,
        s.staff_number,
        COALESCE(s.staff_number, 'N/A') as member_number,
        CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name) as staff_name,
        s.first_name,
        s.last_name,
        c.name as cooperative_name,
        COALESCE(d.name, 'Unassigned') as department,
        ${CONTRIBUTION_TOTAL_SQL} as total_contributions
      FROM cooperative_members cm
      JOIN staff s ON cm.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      JOIN cooperatives c ON cm.cooperative_id = c.id
      LEFT JOIN cooperative_contributions cc ON cm.id = cc.member_id
      WHERE cm.id = $1
      GROUP BY cm.id, s.staff_number, s.first_name, s.middle_name, s.last_name, c.name, d.name`,
      [id],
    );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  private normalizeMemberTransferInput(dto: Partial<AddCooperativeMemberDto> & { status?: string; suspension_reason?: string }) {
    return {
      cooperativeId: String(dto.cooperativeId || '').trim(),
      monthlyContribution:
        dto.monthlyContribution !== undefined && dto.monthlyContribution !== null
          ? Number(dto.monthlyContribution)
          : undefined,
      sharesOwned:
        dto.shares_owned !== undefined && dto.shares_owned !== null
          ? Number(dto.shares_owned)
          : undefined,
      registrationFeeAmount:
        dto.registration_fee_amount !== undefined && dto.registration_fee_amount !== null
          ? Number(dto.registration_fee_amount)
          : undefined,
      annualSubscriptionAmount:
        dto.annual_subscription_amount !== undefined && dto.annual_subscription_amount !== null
          ? Number(dto.annual_subscription_amount)
          : undefined,
    };
  }

  private async transferMember(
    member: any,
    dto: Partial<AddCooperativeMemberDto> & { status?: string; suspension_reason?: string },
    userId: string,
  ) {
    const { cooperativeId, monthlyContribution, sharesOwned, registrationFeeAmount, annualSubscriptionAmount } =
      this.normalizeMemberTransferInput(dto);

    if (!cooperativeId) {
      throw new BadRequestException('Target cooperative is required for member transfer');
    }

    const sourceCooperativeId = String(member.cooperative_id || '').trim();
    if (!sourceCooperativeId || cooperativeId === sourceCooperativeId) {
      throw new BadRequestException('Select a different cooperative to transfer this member');
    }

    return this.databaseService.transaction(async (client) => {
      const targetCooperativeRes = await client.query(
        `SELECT id, name, monthly_contribution_required, monthly_contribution, minimum_shares, registration_fee
         FROM cooperatives
         WHERE id = $1`,
        [cooperativeId],
      );
      const targetCooperative = targetCooperativeRes.rows?.[0];

      if (!targetCooperative) {
        throw new NotFoundException('Target cooperative not found');
      }

      const sourceOutstandingLoanRes = await client.query(
        `SELECT ld.id
         FROM loan_disbursements ld
         JOIN loan_applications la ON ld.loan_application_id = la.id
         JOIN loan_types lt ON la.loan_type_id = lt.id
         WHERE ld.staff_id = $1
           AND lt.cooperative_id = $2
           AND ld.status = 'active'
           AND ld.balance_outstanding > 0
         LIMIT 1`,
        [member.staff_id, sourceCooperativeId],
      );

      if ((sourceOutstandingLoanRes.rows?.length || 0) > 0) {
        throw new BadRequestException(
          'Cannot transfer member with an active outstanding loan in the current cooperative. Resolve the loan first.',
        );
      }

      const targetMembershipRes = await client.query(
        `SELECT id, status
         FROM cooperative_members
         WHERE cooperative_id = $1 AND staff_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [cooperativeId, member.staff_id],
      );
      const targetMembership = targetMembershipRes.rows?.[0];

      if (targetMembership && targetMembership.status !== 'inactive') {
        throw new BadRequestException('Staff already has an active or suspended membership in the target cooperative');
      }

      const nextMonthlyContribution =
        monthlyContribution ??
        Number(targetCooperative.monthly_contribution_required ?? targetCooperative.monthly_contribution ?? 0);
      const nextSharesOwned = sharesOwned ?? 0;
      const nextRegistrationFeeAmount = registrationFeeAmount ?? Number(targetCooperative.registration_fee ?? 0);
      const nextAnnualSubscriptionAmount = annualSubscriptionAmount ?? 0;

      if (targetMembership?.id) {
        await client.query(
          `UPDATE cooperative_contributions
           SET member_id = $1,
               cooperative_id = $2
           WHERE member_id = $3`,
          [member.id, cooperativeId, targetMembership.id],
        );
        await client.query(
          `DELETE FROM cooperative_members
           WHERE id = $1`,
          [targetMembership.id],
        );
      }

      await client.query(
        `UPDATE cooperative_contributions
         SET cooperative_id = $1
         WHERE member_id = $2`,
        [cooperativeId, member.id],
      );

      const transferredRes = await client.query(
        `UPDATE cooperative_members
         SET cooperative_id = $1,
             status = 'active',
             monthly_contribution = $2,
             shares_owned = $3,
             registration_fee_amount = $4,
             registration_fee_paid_at = NULL,
             annual_subscription_amount = $5,
             first_annual_subscription_paid_at = NULL,
             last_annual_subscription_year = NULL,
             suspension_reason = NULL,
             exit_date = NULL,
             join_date = NOW(),
             updated_at = NOW(),
             updated_by = $6
         WHERE id = $7
         RETURNING *`,
        [
          cooperativeId,
          nextMonthlyContribution,
          nextSharesOwned,
          nextRegistrationFeeAmount,
          nextAnnualSubscriptionAmount,
          userId,
          member.id,
        ],
      );
      const transferredMember = transferredRes.rows?.[0];

      this.logger.log(
        `Transferred member ${member.staff_number || member.staff_id} from cooperative ${sourceCooperativeId} to ${cooperativeId}`,
      );

      return transferredMember;
    });
  }

  async updateMember(id: string, dto: Partial<AddCooperativeMemberDto> & { status?: string, suspension_reason?: string }, userId: string) {
    const member = await this.getMemberById(id);
    const { cooperativeId } = this.normalizeMemberTransferInput(dto);

    if (cooperativeId && cooperativeId !== String(member.cooperative_id || '').trim()) {
      return this.transferMember(member, dto, userId);
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dto.monthlyContribution !== undefined) {
      updates.push(`monthly_contribution = $${paramIndex++}`);
      values.push(dto.monthlyContribution);
    }

    if (dto.shares_owned !== undefined) {
      updates.push(`shares_owned = $${paramIndex++}`);
      values.push(dto.shares_owned);
    }

    if (dto.registration_fee_amount !== undefined) {
      updates.push(`registration_fee_amount = $${paramIndex++}`);
      values.push(dto.registration_fee_amount);
    }

    if (dto.annual_subscription_amount !== undefined) {
      updates.push(`annual_subscription_amount = $${paramIndex++}`);
      values.push(dto.annual_subscription_amount);
    }

    // Add status update logic
    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
      
      // Handle related fields based on status
      if (dto.status === 'suspended' && dto.suspension_reason) {
        updates.push(`suspension_reason = $${paramIndex++}`);
        values.push(dto.suspension_reason);
      } else if (dto.status === 'inactive') {
        updates.push(`exit_date = NOW()`);
      } else if (dto.status === 'active') {
        updates.push(`suspension_reason = NULL`);
        updates.push(`exit_date = NULL`);
      }
    }

    updates.push(`updated_at = NOW()`, `updated_by = $${paramIndex++}`);
    values.push(userId, id);

    const query = `
      UPDATE cooperative_members 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    return this.databaseService.queryOne(query, values);
  }

  async deleteMember(id: string) {
    const member = await this.databaseService.queryOne(
      'SELECT id FROM cooperative_members WHERE id = $1',
      [id],
    );

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    await this.databaseService.query(
      'DELETE FROM cooperative_members WHERE id = $1',
      [id],
    );

    return { message: 'Member deleted successfully' };
  }

  async getCooperativeStatsById(id: string) {
    const cooperative = await this.databaseService.queryOne(
      'SELECT * FROM cooperatives WHERE id = $1',
      [id],
    );

    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    // Get member stats
    const memberStats = await this.databaseService.queryOne(
      `SELECT
        (SELECT COUNT(*) FROM cooperative_members WHERE cooperative_id = $1) as total_members,
        (SELECT COUNT(*) FROM cooperative_members WHERE cooperative_id = $1 AND status = 'active') as active_members,
        (SELECT COALESCE(SUM(CASE
          WHEN contribution_type IN ('registration_fee', 'annual_subscription') THEN 0
          ELSE amount
        END), 0) FROM cooperative_contributions WHERE cooperative_id = $1) as total_contributions,
        (SELECT COALESCE(AVG(monthly_contribution), 0) FROM cooperative_members WHERE cooperative_id = $1 AND status = 'active') as average_contribution`,
      [id]
    );

    // Get loan stats (via loan_types)
    const loanStats = await this.databaseService.queryOne(
      `SELECT
        COALESCE(SUM(ld.amount_disbursed), 0) as total_loans_disbursed,
        COALESCE(SUM(ld.balance_outstanding), 0) as total_outstanding
       FROM loan_disbursements ld
       JOIN loan_applications la ON ld.loan_application_id = la.id
       JOIN loan_types lt ON la.loan_type_id = lt.id
       WHERE lt.cooperative_id = $1`,
      [id]
    );

    return {
      cooperative,
      total_members: parseInt(memberStats.total_members),
      active_members: parseInt(memberStats.active_members),
      total_contributions: parseFloat(memberStats.total_contributions),
      total_share_capital: parseFloat(memberStats.total_contributions), // Using contributions as share capital
      average_contribution: parseFloat(memberStats.average_contribution),
      total_loans_disbursed: parseFloat(loanStats.total_loans_disbursed),
      total_outstanding: parseFloat(loanStats.total_outstanding),
    };
  }

  async getCooperativeStats() {
    const stats = await this.databaseService.queryOne(
      `SELECT 
        COUNT(DISTINCT c.id) as total_cooperatives,
        COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_cooperatives,
        COUNT(DISTINCT cm.id) as total_members,
        COUNT(DISTINCT CASE WHEN cm.status = 'active' THEN cm.id END) as active_members,
        COALESCE(SUM(CASE
          WHEN cc.contribution_type IN ('registration_fee', 'annual_subscription') THEN 0
          ELSE cc.amount
        END), 0) as total_contributions,
        COUNT(DISTINCT cc.id) as total_contribution_transactions
      FROM cooperatives c
      LEFT JOIN cooperative_members cm ON c.id = cm.cooperative_id
      LEFT JOIN cooperative_contributions cc ON cm.id = cc.member_id`,
    );

    return stats;
  }

  /**
   * Process a withdrawal
   */
  async withdraw(dto: { memberId: string; amount: number; reason?: string }, userId: string) {
    // 1. Get current balance
    const member = await this.getMemberById(dto.memberId);
    const balance = parseFloat(member.total_contributions);

    if (balance < dto.amount) {
      throw new BadRequestException('Insufficient funds');
    }

    // 2. Record negative contribution
    // We need to construct a DTO-like object. 
    // Since recordContribution expects a DTO class instance in strict mode, we might need to cast or ensure it matches.
    // However, recordContribution takes RecordContributionDto which is a class.
    // In JS/TS, passing a plain object matching the interface usually works unless validation pipe transforms it.
    // Inside the service, we can pass plain objects.
    
    // We use a negative amount for withdrawal
    const recordDto: RecordContributionDto = {
      cooperativeId: member.cooperative_id,
      memberId: dto.memberId,
      amount: -Math.abs(dto.amount), // Ensure it is negative
      month: new Date().toISOString().slice(0, 7),
      contribution_type: 'withdrawal',
      payment_method: 'bank_transfer',
      receipt_number: `WD-${Date.now().toString().slice(-6)}`,
      // Add optional fields to satisfy TS if needed, though DTO has them optional
      cooperative_id: member.cooperative_id,
      member_id: dto.memberId,
    };

    return this.recordContribution(recordDto, userId);
  }

  /**
   * Distribute dividends
   */
  async distributeDividends(cooperativeId: string, totalAmount: number, userId: string) {
    // 1. Get all members with savings > 0
    const members = await this.getCooperativeMembers(cooperativeId, 'active');
    const eligibleMembers = members.filter(m => parseFloat(m.total_contributions) > 0);
    
    if (eligibleMembers.length === 0) {
      throw new BadRequestException('No eligible members for dividends');
    }

    const totalSavings = eligibleMembers.reduce((sum, m) => sum + parseFloat(m.total_contributions), 0);
    
    const dividends = [];
    
    // 2. Calculate and record dividend for each member
    for (const member of eligibleMembers) {
      const share = parseFloat(member.total_contributions) / totalSavings;
      const amount = Math.floor(share * totalAmount * 100) / 100; // Round to 2 decimals
      
      if (amount > 0) {
        const recordDto: RecordContributionDto = {
          cooperativeId,
          memberId: member.id,
          amount: amount,
          month: new Date().toISOString().slice(0, 7),
          contribution_type: 'dividend',
          payment_method: 'system',
          receipt_number: `DIV-${Date.now().toString().slice(-6)}`,
          cooperative_id: cooperativeId,
          member_id: member.id,
        };

        await this.recordContribution(recordDto, userId);
        dividends.push({ memberId: member.id, amount });
      }
    }
    
    return { message: 'Dividends distributed', count: dividends.length, totalDistributed: dividends.reduce((s, d) => s + d.amount, 0) };
  }

  /**
   * Get member statement with running balance
   */
  async getMemberStatement(memberId: string) {
     const contributions = await this.databaseService.query(
      `SELECT 
        cc.*,
        pb.batch_number,
        c.name as cooperative_name
      FROM cooperative_contributions cc
      LEFT JOIN payroll_batches pb ON cc.payroll_batch_id = pb.id
      JOIN cooperatives c ON cc.cooperative_id = c.id
      WHERE cc.member_id = $1
      ORDER BY cc.created_at ASC`,
      [memberId],
    );

    let balance = 0;
    const statement = contributions.map(c => {
        balance += parseFloat(c.amount);
        return { ...c, running_balance: balance };
    });

    return statement;
  }

  /**
   * Get all active memberships for cooperatives with auto-deduction enabled
   */
  async getAutoDeductMemberships() {
    return this.databaseService.query(
      `SELECT 
        cm.id as member_id,
        cm.staff_id,
        cm.cooperative_id,
        cm.monthly_contribution,
        cm.registration_fee_amount,
        cm.registration_fee_paid_at,
        cm.annual_subscription_amount,
        cm.first_annual_subscription_paid_at,
        cm.last_annual_subscription_year,
        c.name as cooperative_name,
        c.code as cooperative_code,
        c.auto_deduct_contribution,
        s.staff_number
      FROM cooperative_members cm
      JOIN cooperatives c ON cm.cooperative_id = c.id
      JOIN staff s ON cm.staff_id = s.id
      WHERE c.status = 'active'
      AND cm.status = 'active'
      AND (
        c.auto_deduct_contribution = true
        OR (COALESCE(cm.registration_fee_amount, 0) > 0 AND cm.registration_fee_paid_at IS NULL)
        OR COALESCE(cm.annual_subscription_amount, 0) > 0
      )`,
    );
  }

  /**
   * Process payroll deductions
   * Wrapper for bulkRecordFromPayroll to be called by PayrollService
   */
  async processPayrollDeductions(
    payrollBatchId: string, 
    deductions: Array<{
      cooperativeId: string;
      memberId: string;
      amount: number;
      month: string;
      contributionType?: string;
    }>, 
    userId: string
  ) {
    return this.bulkRecordFromPayroll(payrollBatchId, deductions, userId);
  }

  private normalizeContributionMonth(month?: string): string {
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

  private async resolveCooperativeId(
    row: { cooperativeId?: string; cooperativeCode?: string },
  ): Promise<string> {
    if (row.cooperativeId) {
      return row.cooperativeId;
    }
    if (!row.cooperativeCode) {
      throw new BadRequestException('Provide cooperativeId or cooperativeCode');
    }
    const cooperative = await this.databaseService.queryOne(
      'SELECT id FROM cooperatives WHERE code = $1',
      [row.cooperativeCode],
    );
    if (!cooperative) {
      throw new NotFoundException(`Cooperative not found for code ${row.cooperativeCode}`);
    }
    return cooperative.id;
  }

  private async resolveStaffId(
    row: { staffId?: string; staffNumber?: string },
  ): Promise<string> {
    if (row.staffId) {
      return row.staffId;
    }
    if (!row.staffNumber) {
      throw new BadRequestException('Provide staffId or staffNumber');
    }
    const staff = await this.databaseService.queryOne(
      'SELECT id FROM staff WHERE staff_number = $1',
      [row.staffNumber],
    );
    if (!staff) {
      throw new NotFoundException(`Staff not found for staff number ${row.staffNumber}`);
    }
    return staff.id;
  }

  private async resolveMemberId(
    row: MigrationContributionRowDto | MigrationOpeningBalanceRowDto,
  ): Promise<{ cooperativeId: string; memberId: string }> {
    const cooperativeId = await this.resolveCooperativeId({
      cooperativeId: row.cooperativeId,
      cooperativeCode: row.cooperativeCode,
    });

    if ('memberId' in row && row.memberId) {
      return { cooperativeId, memberId: row.memberId };
    }

    const staffId = await this.resolveStaffId({
      staffId: row.staffId,
      staffNumber: row.staffNumber,
    });
    const member = await this.databaseService.queryOne(
      `SELECT id FROM cooperative_members
       WHERE cooperative_id = $1 AND staff_id = $2 AND status = 'active'`,
      [cooperativeId, staffId],
    );
    if (!member) {
      throw new NotFoundException(
        `Active membership not found for cooperative ${cooperativeId} and staff ${staffId}`,
      );
    }
    return { cooperativeId, memberId: member.id };
  }

  async importMigrationData(dto: CooperativeMigrationImportDto, userId: string) {
    const dryRun = Boolean(dto.dryRun);
    const result = {
      dryRun,
      summary: {
        cooperatives: { total: dto.cooperatives?.length || 0, success: 0, failed: 0 },
        members: { total: dto.members?.length || 0, success: 0, failed: 0 },
        openingBalances: { total: dto.openingBalances?.length || 0, success: 0, failed: 0 },
        contributions: { total: dto.contributions?.length || 0, success: 0, failed: 0 },
      },
      errors: [] as Array<{ section: string; row: number; message: string }>,
    };

    const addError = (section: string, row: number, error: any) => {
      result.errors.push({
        section,
        row,
        message: error?.message || 'Unknown import error',
      });
    };

    for (let i = 0; i < (dto.cooperatives || []).length; i++) {
      const row = dto.cooperatives![i];
      try {
        const existing = await this.databaseService.queryOne(
          'SELECT id FROM cooperatives WHERE code = $1',
          [row.code],
        );
        const cooperativeDto: CreateCooperativeDto = {
          code: row.code,
          name: row.name,
          type: CooperativeType.THRIFT,
          registrationFee: 0,
          monthlyContribution: row.monthly_contribution_required || 0,
          description: row.description,
          cooperative_type: row.cooperative_type,
          monthly_contribution_required: row.monthly_contribution_required,
          share_capital_value: row.share_capital_value,
          minimum_shares: row.minimum_shares,
          status: row.status || 'active',
        };

        if (!dryRun) {
          if (existing) {
            await this.updateCooperative(existing.id, cooperativeDto, userId);
          } else {
            await this.createCooperative(cooperativeDto, userId);
          }
        }
        result.summary.cooperatives.success++;
      } catch (error) {
        result.summary.cooperatives.failed++;
        addError('cooperatives', i + 1, error);
      }
    }

    for (let i = 0; i < (dto.members || []).length; i++) {
      const row = dto.members![i] as MigrationMemberRowDto;
      try {
        const cooperativeId = await this.resolveCooperativeId({
          cooperativeId: row.cooperativeId,
          cooperativeCode: row.cooperativeCode,
        });
        const staffId = await this.resolveStaffId({
          staffId: row.staffId,
          staffNumber: row.staffNumber,
        });
        if (!dryRun) {
          await this.addMember(
            {
              cooperativeId,
              staffId,
              monthlyContribution: row.monthlyContribution,
              shares_owned: row.shares_owned,
            },
            userId,
          );
        }
        result.summary.members.success++;
      } catch (error) {
        result.summary.members.failed++;
        addError('members', i + 1, error);
      }
    }

    for (let i = 0; i < (dto.openingBalances || []).length; i++) {
      const row = dto.openingBalances![i];
      try {
        const resolved = await this.resolveMemberId(row);
        const contributionDto: RecordContributionDto = {
          cooperativeId: resolved.cooperativeId,
          memberId: resolved.memberId,
          amount: row.amount,
          month: this.normalizeContributionMonth(row.month),
          contribution_type: row.contributionType || 'opening_balance',
          payment_method: 'migration',
          receipt_number: `OPEN-${Date.now()}-${i + 1}`,
        };
        if (!dryRun) {
          await this.recordContribution(contributionDto, userId);
        }
        result.summary.openingBalances.success++;
      } catch (error) {
        result.summary.openingBalances.failed++;
        addError('openingBalances', i + 1, error);
      }
    }

    for (let i = 0; i < (dto.contributions || []).length; i++) {
      const row = dto.contributions![i];
      try {
        const resolved = await this.resolveMemberId(row);
        const contributionDto: RecordContributionDto = {
          cooperativeId: resolved.cooperativeId,
          memberId: resolved.memberId,
          amount: row.amount,
          month: this.normalizeContributionMonth(row.month),
          contribution_type: row.contributionType || 'regular',
          payment_method: row.paymentMethod || 'migration',
          receipt_number: row.receiptNumber || `MIG-${Date.now()}-${i + 1}`,
        };
        if (!dryRun) {
          await this.recordContribution(contributionDto, userId);
        }
        result.summary.contributions.success++;
      } catch (error) {
        result.summary.contributions.failed++;
        addError('contributions', i + 1, error);
      }
    }

    return result;
  }
}
