import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { AddCooperativeMemberDto } from './dto/add-member.dto';
import { RecordContributionDto } from './dto/record-contribution.dto';

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
        (SELECT COALESCE(SUM(cc.amount), 0) FROM cooperative_contributions cc WHERE cc.cooperative_id = c.id) as total_contributions
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
        (SELECT COALESCE(SUM(cc.amount), 0) FROM cooperative_contributions cc WHERE cc.cooperative_id = c.id) as total_contributions
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
      'SELECT id, monthly_contribution FROM cooperatives WHERE id = $1',
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
        SET status = 'active', monthly_contribution = $1, shares_owned = $2, updated_at = NOW(), updated_by = $3
        WHERE id = $4 RETURNING *`,
        [dto.monthlyContribution || cooperative.monthly_contribution, dto.shares_owned || 0, userId, existingMember.id],
      );

      this.logger.log(`Staff ${staff.staff_number} reactivated in cooperative ${dto.cooperativeId}`);
      return member;
    }

    // Add new member
    const member = await this.databaseService.queryOne(
      `INSERT INTO cooperative_members (
        cooperative_id, staff_id, monthly_contribution, shares_owned, join_date, status, created_by
      ) VALUES ($1, $2, $3, $4, NOW(), 'active', $5)
      RETURNING *`,
      [
        dto.cooperativeId,
        dto.staffId,
        dto.monthlyContribution || cooperative.monthly_contribution,
        dto.shares_owned || 0,
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
        COALESCE(SUM(cc.amount), 0) as total_contributions
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
        COALESCE(SUM(cc.amount), 0) as total_contributions
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
   * Get all contributions across all cooperatives
   */
  async getAllContributions() {
    const query = `
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
      ORDER BY cc.created_at DESC
    `;

    return this.databaseService.query(query);
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
  }>, userId: string) {
    if (contributions.length === 0) {
      return [];
    }

    const values = contributions
      .map((c, i) => {
        const baseIndex = i * 5;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${contributions.length * 5 + 1})`;
      })
      .join(', ');

    const params = contributions.flatMap(c => [
      c.cooperativeId,
      c.memberId,
      c.amount,
      c.month,
      payrollBatchId,
    ]);
    params.push(userId);

    const result = await this.databaseService.query(
      `INSERT INTO cooperative_contributions (
        cooperative_id, member_id, amount, contribution_month, payroll_batch_id, created_by
      ) VALUES ${values}
      RETURNING *`,
      params,
    );

    this.logger.log(`Bulk recorded ${contributions.length} contributions from payroll ${payrollBatchId}`);
    return result;
  }

  async getAllMembers(staffId?: string) {
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
        COALESCE(SUM(cc.amount), 0) as total_contributions
      FROM cooperative_members cm
      JOIN staff s ON cm.staff_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      JOIN cooperatives c ON cm.cooperative_id = c.id
      LEFT JOIN cooperative_contributions cc ON cm.id = cc.member_id
    `;
    const params = [];

    if (staffId) {
      query += ' WHERE cm.staff_id = $1';
      params.push(staffId);
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
        COALESCE(SUM(cc.amount), 0) as total_contributions
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

  async updateMember(id: string, dto: Partial<AddCooperativeMemberDto> & { status?: string, suspension_reason?: string }, userId: string) {
    await this.getMemberById(id);

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dto.monthlyContribution) {
      updates.push(`monthly_contribution = $${paramIndex++}`);
      values.push(dto.monthlyContribution);
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
        (SELECT COALESCE(SUM(amount), 0) FROM cooperative_contributions WHERE cooperative_id = $1) as total_contributions,
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
        COALESCE(SUM(cc.amount), 0) as total_contributions,
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
        c.name as cooperative_name,
        c.code as cooperative_code,
        s.staff_number
      FROM cooperative_members cm
      JOIN cooperatives c ON cm.cooperative_id = c.id
      JOIN staff s ON cm.staff_id = s.id
      WHERE c.auto_deduct_contribution = true 
      AND c.status = 'active'
      AND cm.status = 'active'`,
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
    }>, 
    userId: string
  ) {
    return this.bulkRecordFromPayroll(payrollBatchId, deductions, userId);
  }
}