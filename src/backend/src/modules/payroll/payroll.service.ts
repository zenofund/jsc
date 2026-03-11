import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationCategory, NotificationPriority } from '../notifications/dto/notification.dto';
import { ExternalApiService } from '../external-api/external-api.service';
import { SalaryLookupService } from '../salary-structures/salary-lookup.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/dto/audit.dto';
import { CooperativesService } from '../cooperatives/cooperatives.service';
import { CreatePayrollBatchDto } from './dto/create-payroll-batch.dto';
import { ApprovePayrollDto } from './dto/approve-payroll.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private databaseService: DatabaseService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private externalApiService: ExternalApiService,
    private salaryLookupService: SalaryLookupService,
    private auditService: AuditService,
    private cooperativesService: CooperativesService,
  ) {}

  async onModuleInit() {
    await this.ensureWorkflowApprovalsTable();
    await this.ensurePayrollPaymentColumns();
    await this.ensurePayrollBankColumns();
    await this.ensurePayrollLockColumns();
  }

  private async ensurePayrollLockColumns() {
    try {
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS locked_by UUID
      `);
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE
      `);
    } catch (error: any) {
      this.logger.warn(`Failed to ensure payroll lock columns: ${error?.message}`);
    }
  }

  private async ensurePayrollBankColumns() {
    try {
      await this.databaseService.query(`
        ALTER TABLE payroll_lines 
        ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)
      `);
      await this.databaseService.query(`
        ALTER TABLE payroll_lines 
        ADD COLUMN IF NOT EXISTS account_number VARCHAR(20)
      `);
    } catch (error: any) {
      this.logger.warn(`Failed to ensure payroll bank columns: ${error?.message}`);
    }
  }

  private async ensureWorkflowApprovalsTable() {
    try {
      await this.databaseService.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
      await this.databaseService.query(`
        CREATE TABLE IF NOT EXISTS workflow_approvals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payroll_batch_id UUID NOT NULL,
          stage INTEGER NOT NULL,
          stage_name VARCHAR(255) NOT NULL,
          approver_role VARCHAR(100) NOT NULL,
          approver_id UUID,
          comments TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          action_date TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await this.databaseService.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_approvals_batch_stage
        ON workflow_approvals(payroll_batch_id, stage)
      `);
      
      // Ensure payroll_batches has current_approval_stage
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS current_approval_stage INTEGER DEFAULT 0
      `);

    } catch (error: any) {
      this.logger.error(`Failed to ensure workflow_approvals table: ${error?.message}`);
    }
  }

  private async ensurePayrollPaymentColumns() {
    try {
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)
      `);
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS payment_executed_by UUID
      `);
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS payment_executed_at TIMESTAMP WITH TIME ZONE
      `);
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `);
      await this.databaseService.query(`
        ALTER TABLE payroll_batches 
        ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20)
      `);
    } catch (error: any) {
      this.logger.warn(`Failed to ensure payroll payment columns: ${error?.message}`);
    }
  }
  /**
   * Get all payslips for a staff member
   */
  async getStaffPayslips(staffId: string, payrollMonth?: string) {
    const values: any[] = [staffId];
    const monthClause = payrollMonth ? ' AND pb.payroll_month = $2' : '';
    if (payrollMonth) values.push(payrollMonth);

    const query = `
      SELECT pl.*, pb.payroll_month, pb.batch_number, pb.status as batch_status
      FROM payroll_lines pl
      JOIN payroll_batches pb ON pl.payroll_batch_id = pb.id
      WHERE pl.staff_id = $1 AND pb.status != 'draft'${monthClause}
      ORDER BY pb.payroll_month DESC
    `;
    return this.databaseService.query(query, values);
  }

  /**
   * Get all payslips for a batch
   */
  async getBatchPayslips(batchId: string, payrollMonth?: string) {
    const values: any[] = [batchId];
    const monthClause = payrollMonth ? ' AND pb.payroll_month = $2' : '';
    if (payrollMonth) values.push(payrollMonth);

    const query = `
      SELECT pl.*, pb.payroll_month, pb.batch_number, pb.status as batch_status
      FROM payroll_lines pl
      JOIN payroll_batches pb ON pl.payroll_batch_id = pb.id
      WHERE pl.payroll_batch_id = $1${monthClause}
      ORDER BY pl.staff_number ASC
    `;
    return this.databaseService.query(query, values);
  }

  /**
   * Create new payroll batch
   */
  async createBatch(createDto: CreatePayrollBatchDto, userId: string) {
    const { payrollMonth, periodStart, periodEnd } = createDto;

    // Check if batch already exists for this month
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM payroll_batches WHERE payroll_month = $1',
      [payrollMonth],
    );

    if (existing) {
      throw new BadRequestException(`Payroll batch for ${payrollMonth} already exists`);
    }

    // Generate batch number
    const year = payrollMonth.split('-')[0];
    const month = payrollMonth.split('-')[1];
    const batchNumber = `PAY/${year}/${month}/${Date.now().toString().slice(-4)}`;

    try {
      // Create batch using transaction to ensure uniqueness check is atomic if isolation level allows,
      // or rely on unique constraint on payroll_month if it exists. 
      // Since we don't know if unique constraint exists, we'll try to insert and catch error, 
      // or double check within a transaction with locking (if needed, but insert catch is better for concurrency).
      // Ideally, payroll_month should be unique.
      
      const batch = await this.databaseService.queryOne(
        `INSERT INTO payroll_batches (
          batch_number, payroll_month, period_start, period_end,
          status, created_by
        ) VALUES ($1, $2, $3, $4, 'draft', $5)
        RETURNING *`,
        [batchNumber, payrollMonth, periodStart, periodEnd, userId],
      );

      this.logger.log(`Payroll batch ${batchNumber} created by user ${userId}`);
      return batch;
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
         throw new BadRequestException(`Payroll batch for ${payrollMonth} already exists`);
      }
      // If no unique constraint, the previous check might have failed due to race condition.
      // Let's re-check manually if insertion failed for other reasons but duplicate exists.
      const existing = await this.databaseService.queryOne(
        'SELECT id FROM payroll_batches WHERE payroll_month = $1',
        [payrollMonth],
      );
      if (existing) {
        throw new BadRequestException(`Payroll batch for ${payrollMonth} already exists`);
      }
      throw error;
    }
  }

  /**
   * Generate payroll lines for all eligible staff (BULK PROCESSING)
   * Optimized for 800+ staff members
   */
  async generatePayrollLines(batchId: string, userId: string) {
    const startTime = Date.now();

    // Get batch
    const batch = await this.findOne(batchId);
    if (batch.status !== 'draft') {
      throw new BadRequestException('Can only generate lines for draft batches');
    }

    // Get all active staff with department info
    const staff = await this.databaseService.query<any>(
      `SELECT s.*, d.name as department_name
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.status = 'active'
       ORDER BY s.staff_number`,
    );

    if (staff.length === 0) {
      throw new BadRequestException('No active staff found');
    }

    // Get global allowances
    const globalAllowances = await this.databaseService.query(
      `SELECT * FROM allowances WHERE status = 'active' AND applies_to_all = true`,
    );

    // Get global deductions
    const globalDeductions = await this.databaseService.query(
      `SELECT * FROM deductions WHERE status = 'active' AND applies_to_all = true`,
    );

    // Get all staff-specific allowances for this month
    const staffAllowances = await this.databaseService.query(
      `SELECT sa.*, 
              a.name as allowance_name,
              a.code as allowance_code,
              a.type,
              a.is_taxable
       FROM staff_allowances sa
       LEFT JOIN allowances a ON sa.allowance_id = a.id
       WHERE sa.status = 'active' 
       AND sa.start_month <= $1 
       AND (sa.end_month IS NULL OR sa.end_month >= $1)`,
      [batch.payroll_month],
    );

    // Get all staff-specific deductions for this month
    const staffDeductions = await this.databaseService.query(
      `SELECT sd.*, 
              d.name as deduction_name,
              d.code as deduction_code,
              d.type,
              d.is_statutory
       FROM staff_deductions sd
       LEFT JOIN deductions d ON sd.deduction_id = d.id
       WHERE sd.status = 'active' 
       AND sd.start_month <= $1 
       AND (sd.end_month IS NULL OR sd.end_month >= $1)`,
      [batch.payroll_month],
    );

    // Get approved arrears or arrears already linked to this batch
    const arrears = await this.databaseService.query(
      `SELECT * FROM arrears WHERE status = 'approved' OR (status = 'processed' AND payroll_batch_id = $1)`,
      [batchId]
    );

    // Get active loan repayments
    const loanRepayments = await this.databaseService.query(
      `SELECT ld.*, la.staff_id
       FROM loan_disbursements ld
       JOIN loan_applications la ON ld.loan_application_id = la.id
       WHERE ld.status = 'active' AND ld.balance_outstanding > 0`,
    );

    // Get active cooperative memberships for auto-deduction
    const cooperativeMemberships = await this.cooperativesService.getAutoDeductMemberships();

    // Get system tax settings
    const systemSettings = await this.databaseService.queryOne(
      `SELECT tax_configuration FROM system_settings WHERE key = 'general_settings'`,
    );
    const taxConfig = systemSettings?.tax_configuration || {};

    // **NEW: Batch-fetch all basic salaries from salary structure**
    // This is much more efficient than individual lookups
    const staffGradeLevels = staff.map(s => ({
      gradeLevel: s.grade_level,
      step: s.step,
    }));
    
    const salaryMap = await this.salaryLookupService.getBasicSalariesBatch(staffGradeLevels);
    this.logger.log(`Fetched basic salaries for ${salaryMap.size} unique grade/step combinations from salary structure`);

    // Prepare payroll lines array for bulk insert
    const payrollLines = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    // Process each staff member
    for (const staffMember of staff) {
      // **CHANGED: Fetch basic salary from structure instead of staff record**
      const salaryKey = `${staffMember.grade_level}-${staffMember.step}`;
      const basicSalary = salaryMap.get(salaryKey);
      
      if (!basicSalary) {
        this.logger.warn(
          `Skipping staff ${staffMember.staff_number}: Grade ${staffMember.grade_level} Step ${staffMember.step} not found in salary structure`
        );
        continue; // Skip this staff member
      }

      // Calculate allowances
      const allowancesArray = [];
      let totalAllowances = 0;

      // Global allowances
      for (const allowance of globalAllowances) {
        let amount = 0;
        if (allowance.type === 'fixed') {
          amount = parseFloat(allowance.amount);
        } else if (allowance.type === 'percentage') {
          amount = (basicSalary * parseFloat(allowance.percentage)) / 100;
        }

        if (amount > 0) {
          allowancesArray.push({
            code: allowance.code,
            name: allowance.name,
            amount: amount,
            is_taxable: allowance.is_taxable,
          });
          totalAllowances += amount;
        }
      }

      // Staff-specific allowances
      const staffSpecificAllowances = staffAllowances.filter(
        (a) => a.staff_id === staffMember.id,
      );
      for (const allowance of staffSpecificAllowances) {
        let amount = 0;
        if (allowance.type === 'fixed') {
          amount = parseFloat(allowance.amount);
        } else if (allowance.type === 'percentage') {
          amount = (basicSalary * parseFloat(allowance.percentage)) / 100;
        }

        if (amount > 0) {
          allowancesArray.push({
            code: allowance.allowance_code,
            name: allowance.allowance_name,
            amount: amount,
            is_taxable: allowance.is_taxable,
          });
          totalAllowances += amount;
        }
      }

      // Add arrears if applicable
      const staffArrears = arrears.filter((arr) => arr.staff_id === staffMember.id);
      for (const arrear of staffArrears) {
        const arrearAmount = parseFloat(arrear.total_arrears || arrear.amount);
        allowancesArray.push({
          code: 'ARREAR',
          name: `Arrear: ${arrear.reason}`,
          amount: arrearAmount,
          is_taxable: true,
        });
        totalAllowances += arrearAmount;
      }

      // Calculate gross pay
      const grossPay = basicSalary + totalAllowances;

      // Calculate deductions FIRST to determine reliefs
      const deductionsArray = [];
      let totalDeductionsAmount = 0;
      let pensionDeductionAmount = 0;
      let nhfDeductionAmount = 0;
      let nhisDeductionAmount = 0;

      const isContractStaff = staffMember.employment_type === 'Contract';
      const gradeKey = String(staffMember.grade_level || '').replace(/\s+/g, '').toUpperCase();
      const isCat1 = gradeKey === 'CAT1';
      const isCat4 = gradeKey === 'CAT4';
      const gradeNumber = Number(gradeKey);
      const excludeUnionForSeniorGrades = !isNaN(gradeNumber) && gradeNumber >= 15 && gradeNumber <= 17;

      // Global deductions
      for (const deduction of globalDeductions) {
        if (deduction.code === 'TAX') continue; // Skip Tax for now

        // Skip Pension, NHF, NHIS, Union Dues for Contract Staff
        if (isContractStaff) {
            const name = deduction.name.toUpperCase();
            const code = deduction.code.toUpperCase();
            if (
              code.includes('PENSION') || name.includes('PENSION') ||
              code.includes('NHF') || name.includes('NHF') || name.includes('HOUSING FUND') ||
              code.includes('NHIS') || name.includes('NHIS') || name.includes('HEALTH INSURANCE') ||
              code.includes('UNION') || name.includes('UNION')
            ) {
              continue;
            }
        }
        if (excludeUnionForSeniorGrades) {
            const name = deduction.name.toUpperCase();
            const code = deduction.code.toUpperCase();
            if (code.includes('UNION') || name.includes('UNION')) {
              continue;
            }
        }
        if (isCat1 || isCat4) {
            const name = deduction.name.toUpperCase();
            const code = deduction.code.toUpperCase();
            const isPension = code.includes('PENSION') || name.includes('PENSION');
            const isNhf = code.includes('NHF') || name.includes('NHF') || name.includes('HOUSING FUND');
            const isNhis = code.includes('NHIS') || name.includes('NHIS') || name.includes('HEALTH INSURANCE');
            const isUnion = code.includes('UNION') || name.includes('UNION');
            if ((isCat1 && (isPension || isNhf || isNhis || isUnion)) || (isCat4 && (isNhf || isNhis || isUnion))) {
              continue;
            }
        }

        let amount = 0;
        if (deduction.type === 'fixed') {
          amount = parseFloat(deduction.amount);
        } else if (deduction.type === 'percentage') {
          const code = String(deduction.code || '').toUpperCase();
          const name = String(deduction.name || '').toUpperCase();
          if (
            code.includes('PENSION') || name.includes('PENSION') ||
            code.includes('NHF') || name.includes('NHF') || name.includes('HOUSING FUND') ||
            code.includes('NHIS') || name.includes('NHIS') || name.includes('NHIA') || name.includes('HEALTH INSURANCE')
          ) {
            amount = (grossPay * parseFloat(deduction.percentage)) / 100;
          } else {
            amount = (basicSalary * parseFloat(deduction.percentage)) / 100;
          }
        }

        // Track specific deductions for tax relief
        const reliefCode = String(deduction.code || '').toUpperCase();
        const reliefName = String(deduction.name || '').toUpperCase();
        if (reliefCode === 'PENSION' || reliefName.includes('PENSION')) pensionDeductionAmount += amount;
        if (reliefCode === 'NHF' || reliefName.includes('NHF') || reliefName.includes('HOUSING FUND')) nhfDeductionAmount += amount;
        if (
          reliefCode === 'NHIS' ||
          reliefCode === 'NHIA' ||
          reliefName.includes('NHIS') ||
          reliefName.includes('NHIA') ||
          reliefName.includes('HEALTH INSURANCE')
        ) {
          nhisDeductionAmount += amount;
        }

        deductionsArray.push({
          code: deduction.code,
          name: deduction.name,
          amount: amount,
        });
        totalDeductionsAmount += amount;
      }

      // Staff-specific deductions
      const staffSpecificDeductions = staffDeductions.filter(
        (d) => d.staff_id === staffMember.id,
      );
      for (const deduction of staffSpecificDeductions) {
        // Skip Pension, NHF, NHIS, Union Dues for Contract Staff also in staff-specific deductions
        if (isContractStaff) {
            const name = (deduction.deduction_name || deduction.name || '').toUpperCase();
            const code = (deduction.deduction_code || deduction.code || '').toUpperCase();
            if (
              code.includes('PENSION') || name.includes('PENSION') ||
              code.includes('NHF') || name.includes('NHF') || name.includes('HOUSING FUND') ||
              code.includes('NHIS') || name.includes('NHIS') || name.includes('HEALTH INSURANCE') ||
              code.includes('UNION') || name.includes('UNION')
            ) {
              continue;
            }
        }
        if (excludeUnionForSeniorGrades) {
            const name = (deduction.deduction_name || deduction.name || '').toUpperCase();
            const code = (deduction.deduction_code || deduction.code || '').toUpperCase();
            if (code.includes('UNION') || name.includes('UNION')) {
              continue;
            }
        }
        if (isCat1 || isCat4) {
            const name = (deduction.deduction_name || deduction.name || '').toUpperCase();
            const code = (deduction.deduction_code || deduction.code || '').toUpperCase();
            const isPension = code.includes('PENSION') || name.includes('PENSION');
            const isNhf = code.includes('NHF') || name.includes('NHF') || name.includes('HOUSING FUND');
            const isNhis = code.includes('NHIS') || name.includes('NHIS') || name.includes('HEALTH INSURANCE');
            const isUnion = code.includes('UNION') || name.includes('UNION');
            if ((isCat1 && (isPension || isNhf || isNhis || isUnion)) || (isCat4 && (isNhf || isNhis || isUnion))) {
              continue;
            }
        }

        let amount = 0;
        if (deduction.type === 'fixed') {
          amount = parseFloat(deduction.amount);
        } else if (deduction.type === 'percentage') {
          const code = String(deduction.deduction_code || deduction.code || '').toUpperCase();
          const name = String(deduction.deduction_name || deduction.name || '').toUpperCase();
          if (
            code.includes('PENSION') || name.includes('PENSION') ||
            code.includes('NHF') || name.includes('NHF') || name.includes('HOUSING FUND') ||
            code.includes('NHIS') || name.includes('NHIS') || name.includes('NHIA') || name.includes('HEALTH INSURANCE')
          ) {
            amount = (grossPay * parseFloat(deduction.percentage)) / 100;
          } else {
            amount = (basicSalary * parseFloat(deduction.percentage)) / 100;
          }
        }

        // Track specific deductions for tax relief (if manually assigned)
        const reliefCode = String(deduction.deduction_code || deduction.code || '').toUpperCase();
        const reliefName = String(deduction.deduction_name || deduction.name || '').toUpperCase();
        if (reliefCode === 'PENSION' || reliefName.includes('PENSION')) pensionDeductionAmount += amount;
        if (reliefCode === 'NHF' || reliefName.includes('NHF') || reliefName.includes('HOUSING FUND')) nhfDeductionAmount += amount;
        if (
          reliefCode === 'NHIS' ||
          reliefCode === 'NHIA' ||
          reliefName.includes('NHIS') ||
          reliefName.includes('NHIA') ||
          reliefName.includes('HEALTH INSURANCE')
        ) {
          nhisDeductionAmount += amount;
        }

        deductionsArray.push({
          code: deduction.deduction_code || deduction.code,
          name: deduction.deduction_name || deduction.name,
          amount: amount,
        });
        totalDeductionsAmount += amount;
      }

      // Loan repayments
      const staffLoans = loanRepayments.filter((loan) => loan.staff_id === staffMember.id);
      for (const loan of staffLoans) {
        const repaymentAmount = parseFloat(loan.monthly_deduction);
        deductionsArray.push({
          code: 'LOAN',
          name: 'Loan Repayment',
          amount: repaymentAmount,
        });
        totalDeductionsAmount += repaymentAmount;
      }

      // Cooperative Contributions (Auto-Deduct)
      const staffCoops = cooperativeMemberships.filter((m) => m.staff_id === staffMember.id);
      for (const coop of staffCoops) {
        const contributionAmount = parseFloat(coop.monthly_contribution);
        if (contributionAmount > 0) {
          deductionsArray.push({
            code: coop.cooperative_code,
            name: `${coop.cooperative_name} Contribution`,
            amount: contributionAmount,
            cooperative_id: coop.cooperative_id,
            member_id: coop.member_id,
            is_cooperative: true,
          });
          totalDeductionsAmount += contributionAmount;
        }
      }

      // Calculate tax (Now passing actual deduction amounts for relief)
      const taxDetails = this.calculatePAYE(
        grossPay, 
        allowancesArray, 
        taxConfig, 
        isContractStaff,
        pensionDeductionAmount,
        nhfDeductionAmount,
        nhisDeductionAmount
      );

      // Add Tax deduction
      deductionsArray.push({
        code: 'TAX',
        name: 'PAYE Tax',
        amount: taxDetails.monthly_tax,
      });
      totalDeductionsAmount += taxDetails.monthly_tax;

      // Calculate net pay

      // Calculate net pay
      const netPay = grossPay - totalDeductionsAmount;

      // Add to payroll lines array
      payrollLines.push({
        id: uuidv4(),
        payroll_batch_id: batchId,
        staff_id: staffMember.id,
        staff_number: staffMember.staff_number,
        staff_name: `${staffMember.first_name} ${staffMember.last_name}`,
        grade_level: staffMember.grade_level,
        step: staffMember.step,
        basic_salary: basicSalary,
        allowances: JSON.stringify(allowancesArray),
        deductions: JSON.stringify(deductionsArray),
        gross_pay: grossPay,
        total_deductions: totalDeductionsAmount,
        net_pay: netPay,
        tax_details: JSON.stringify(taxDetails),
        bank_name: staffMember.bank_name,
        account_number: staffMember.account_number,
      });

      totalGross += grossPay;
      totalDeductions += totalDeductionsAmount;
      totalNet += netPay;
    }

    // Bulk insert payroll lines using PostgreSQL transaction
    await this.databaseService.transaction(async (client) => {
      // Delete existing lines if any
      await client.query('DELETE FROM payroll_lines WHERE payroll_batch_id = $1', [batchId]);

      // Bulk insert new lines - Process in chunks of 100 to avoid query parameter limits (approx 65535 params max)
      // Each line has 14 parameters, so 100 lines = 1400 params (safe)
      const CHUNK_SIZE = 100;
      
      if (payrollLines.length > 0) {
        for (let i = 0; i < payrollLines.length; i += CHUNK_SIZE) {
          const chunk = payrollLines.slice(i, i + CHUNK_SIZE);
          const values = [];
          const placeholders = [];
          let paramIndex = 1;

          chunk.forEach((line) => {
            const rowPlaceholders = [];
            rowPlaceholders.push(`$${paramIndex++}`); // id
            rowPlaceholders.push(`$${paramIndex++}`); // payroll_batch_id
            rowPlaceholders.push(`$${paramIndex++}`); // staff_id
            rowPlaceholders.push(`$${paramIndex++}`); // staff_number
            rowPlaceholders.push(`$${paramIndex++}`); // staff_name
            rowPlaceholders.push(`$${paramIndex++}`); // grade_level
            rowPlaceholders.push(`$${paramIndex++}`); // step
            rowPlaceholders.push(`$${paramIndex++}`); // basic_salary
            rowPlaceholders.push(`$${paramIndex++}`); // allowances
            rowPlaceholders.push(`$${paramIndex++}`); // deductions
            rowPlaceholders.push(`$${paramIndex++}`); // gross_pay
            rowPlaceholders.push(`$${paramIndex++}`); // total_deductions
            rowPlaceholders.push(`$${paramIndex++}`); // net_pay
            rowPlaceholders.push(`$${paramIndex++}`); // tax_details
            rowPlaceholders.push(`$${paramIndex++}`); // bank_name
            rowPlaceholders.push(`$${paramIndex++}`); // account_number

            placeholders.push(`(${rowPlaceholders.join(', ')})`);

            values.push(
              line.id,
              line.payroll_batch_id,
              line.staff_id,
              line.staff_number,
              line.staff_name,
              line.grade_level,
              line.step,
              line.basic_salary,
              line.allowances,
              line.deductions,
              line.gross_pay,
              line.total_deductions,
              line.net_pay,
              line.tax_details,
              line.bank_name,
              line.account_number,
            );
          });

          const insertQuery = `
            INSERT INTO payroll_lines (
              id, payroll_batch_id, staff_id, staff_number, staff_name,
              grade_level, step, basic_salary, allowances, deductions,
              gross_pay, total_deductions, net_pay, tax_details, bank_name, account_number
            ) VALUES ${placeholders.join(', ')}
          `;

          await client.query(insertQuery, values);
        }
      }

      // Update batch totals
      await client.query(
        `UPDATE payroll_batches 
         SET total_staff = $1, total_gross = $2, total_deductions = $3, total_net = $4, updated_at = NOW()
         WHERE id = $5`,
        [staff.length, totalGross, totalDeductions, totalNet, batchId],
      );
    });

    const duration = Date.now() - startTime;
    this.logger.log(
      `Generated ${payrollLines.length} payroll lines in ${duration}ms for batch ${batchId}`,
    );

    return {
      batch_id: batchId,
      total_staff: staff.length,
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
      processing_time_ms: duration,
    };
  }

  /**
   * Calculate Nigerian PAYE Tax (Progressive)
   */
  private calculatePAYE(
    grossPay: number, 
    allowances: any[], 
    taxConfig: any, 
    isContractStaff: boolean = false,
    pensionDeduction: number = 0,
    nhfDeduction: number = 0,
    nhisDeduction: number = 0
  ) {
    const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const nonTaxableAllowances = allowances
      .filter((a) => !a.is_taxable)
      .reduce((sum, a) => sum + a.amount, 0);
    const monthlyTaxableIncome = isContractStaff
      ? grossPay
      : grossPay - nonTaxableAllowances;
    const safeMonthlyTaxableIncome = Math.max(0, monthlyTaxableIncome);
    const annualTaxableIncome = round2(safeMonthlyTaxableIncome * 12);

    let pensionRelief = 0;
    let nhfRelief = 0;
    let nhisRelief = 0;
    let rentRelief = 0;
    const cra = 0;
    let grossIncomeRelief = 0;

    if (!isContractStaff) {
      pensionRelief = round2(pensionDeduction * 12);
      nhfRelief = round2(nhfDeduction * 12);
      const nhisReliefEnabled =
        taxConfig?.include_nhis_relief ??
        taxConfig?.apply_nhis_relief ??
        taxConfig?.nhis_relief_enabled ??
        taxConfig?.nhia_relief_enabled ??
        true;
      nhisRelief = nhisReliefEnabled ? round2(nhisDeduction * 12) : 0;
      const housingAllowance = allowances.find(
        (a) => a.code === 'HOUSING' || a.name.toLowerCase().includes('housing')
      )?.amount || 0;
      rentRelief = round2(
        (housingAllowance * 12 * (taxConfig.rent_relief_percentage || 0)) / 100
      );
      grossIncomeRelief = round2(
        (annualTaxableIncome * (taxConfig.gross_income_relief_percentage || 0)) / 100
      );
    }

    const totalReliefs = round2(cra + grossIncomeRelief + pensionRelief + nhfRelief + nhisRelief + rentRelief);
    const taxableIncomeAfterReliefs = Math.max(0, round2(annualTaxableIncome - totalReliefs));

    const configuredBrackets = Array.isArray(taxConfig?.tax_brackets)
      ? taxConfig.tax_brackets
      : [];
    const taxBrackets = configuredBrackets;

    if (!Array.isArray(taxBrackets) || taxBrackets.length === 0) {
      this.logger.error('Tax brackets configuration missing or invalid');
      throw new BadRequestException('System tax configuration is missing or invalid. Please contact administrator.');
    }

    const normalizedBrackets = taxBrackets.map((bracket: any) => {
      const limit = typeof bracket.limit === 'number'
        ? bracket.limit
        : typeof bracket.max === 'number'
          ? bracket.max
          : typeof bracket.upper_limit === 'number'
            ? bracket.upper_limit
            : null;
      return {
        limit,
        rate: Number(bracket.rate) || 0,
        min: typeof bracket.min === 'number'
          ? bracket.min
          : typeof bracket.lower_limit === 'number'
            ? bracket.lower_limit
            : undefined,
        max: typeof bracket.max === 'number'
          ? bracket.max
          : typeof bracket.upper_limit === 'number'
            ? bracket.upper_limit
            : undefined,
      };
    });

    const orderedBrackets = [...normalizedBrackets].sort((a, b) => {
      const aLimit = a.limit ?? Number.POSITIVE_INFINITY;
      const bLimit = b.limit ?? Number.POSITIVE_INFINITY;
      return aLimit - bLimit;
    });

    let annualTax = 0;
    let remainingIncome = taxableIncomeAfterReliefs;
    let consumedIncome = 0;
    const taxBreakdown = [];

    for (const bracket of orderedBrackets) {
      if (remainingIncome <= 0) {
        break;
      }
      const bandLimit = typeof bracket.limit === 'number' ? bracket.limit : null;
      const bandConsumption = Math.min(remainingIncome, bandLimit ?? remainingIncome);
      if (bandConsumption <= 0) {
        continue;
      }
      const taxForBracket = round2((bandConsumption * bracket.rate) / 100);
      annualTax = round2(annualTax + taxForBracket);
      const breakdownStart = round2(consumedIncome);
      const breakdownEnd = bandLimit !== null ? round2(consumedIncome + bandConsumption) : null;
      taxBreakdown.push({
        bracket: breakdownEnd !== null
          ? `${breakdownStart.toLocaleString()} - ${breakdownEnd.toLocaleString()}`
          : `${breakdownStart.toLocaleString()} - above`,
        rate: bracket.rate,
        taxable_amount: round2(bandConsumption),
        tax: taxForBracket,
      });
      remainingIncome = round2(remainingIncome - bandConsumption);
      consumedIncome = round2(consumedIncome + bandConsumption);
    }

    const monthlyTax = round2(annualTax / 12);

    return {
      taxable_income: round2(safeMonthlyTaxableIncome),
      annual_taxable_income: annualTaxableIncome,
      total_reliefs: totalReliefs,
      taxable_income_after_reliefs: taxableIncomeAfterReliefs,
      annual_tax: annualTax,
      monthly_tax: monthlyTax,
      tax_breakdown: taxBreakdown,
    };
  }

  /**
   * Submit batch for approval
   */
  async submitForApproval(batchId: string, userId: string) {
    const batch = await this.findOne(batchId);

    if (batch.status !== 'draft') {
      throw new BadRequestException('Only draft batches can be submitted for approval');
    }

    // Check if payroll lines exist
    const linesCount = await this.databaseService.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM payroll_lines WHERE payroll_batch_id = $1',
      [batchId],
    );

    if (!linesCount || parseInt(linesCount.count.toString()) === 0) {
      throw new BadRequestException('Cannot submit batch without payroll lines');
    }

    // Get approval workflow from column-based system settings
    const kvSettings = await this.databaseService.queryOne(
      `SELECT value FROM system_settings WHERE key = 'general_settings'`,
    ).catch(() => null);
    const kvRaw = kvSettings?.value?.approval_workflow;
    let workflow: any[] = [];
    if (Array.isArray(kvRaw)) workflow = kvRaw;
    else if (typeof kvRaw === 'string' && kvRaw.trim()) {
      try {
        workflow = JSON.parse(kvRaw);
      } catch (error: any) {
        this.logger.warn(`Failed to parse approval_workflow from system_settings: ${error?.message}`);
      }
    }

    workflow = (workflow || []).map((s: any) => ({
      stage: typeof s?.stage === 'number' ? s.stage : parseInt(String(s?.stage || 0), 10),
      role: String(s?.role || '').trim(),
      name: String(s?.name || '').trim(),
    })).filter((s: any) => s.stage > 0 && s.role && s.name)
      .sort((a, b) => a.stage - b.stage); // Sort by stage to ensure order

    if (workflow.length === 0) {
      throw new BadRequestException('Approval workflow is not configured. Please contact administrator.');
    }

    // Ensure workflow_approvals table exists
    await this.ensureWorkflowApprovalsTable();

    // Create approval stages
    try {
      await this.databaseService.transaction(async (client) => {
        // Delete ALL existing approvals for this batch to ensure a clean slate for re-submission
        await client.query(`DELETE FROM workflow_approvals WHERE payroll_batch_id = $1`, [batchId]);
        
        for (const stage of workflow) {
          await client.query(
            `INSERT INTO workflow_approvals (
              id, payroll_batch_id, stage, stage_name, approver_role, status
            ) VALUES ($1, $2, $3, $4, $5, 'pending')`,
            [uuidv4(), batchId, stage.stage, stage.name, stage.role],
          );
        }
  
        // Reset to Stage 1
        await client.query(
          `UPDATE payroll_batches 
           SET status = 'pending_review', current_approval_stage = 1, updated_at = NOW()
           WHERE id = $1`,
          [batchId],
        );
      });
    } catch (err: any) {
      this.logger.error(`Failed to create workflow approvals: ${err?.message}`);
      throw new BadRequestException(`Failed to create approval stages: ${err?.message || 'invalid configuration'}`);
    }

    // Send notifications to first stage approvers
    try {
      const firstStage = workflow.find((s) => s.stage === 1);
      if (firstStage) {
        const approvers = await this.databaseService.query(
          'SELECT id FROM users WHERE role = $1',
          [firstStage.role],
        );

        for (const approver of approvers) {
          await this.notificationsService.create({
            recipient_id: approver.id,
            type: NotificationType.PAYROLL,
            category: NotificationCategory.ACTION_REQUIRED,
            title: 'Payroll Batch Approval Needed',
            message: `Payroll batch ${batch.batch_number} requires your approval.`,
            entity_type: 'payroll_batch',
            entity_id: batchId,
            priority: NotificationPriority.HIGH,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send notifications: ${error.message}`);
    }

    this.logger.log(`Batch ${batchId} submitted for approval by user ${userId}`);

    return { message: 'Batch submitted for approval successfully' };
  }


  /**
   * Approve/Reject payroll batch
   */
  async approveOrReject(batchId: string, approveDto: ApprovePayrollDto, userId: string) {
    this.logger.log(`approveOrReject called for batch ${batchId} by user ${userId} with action ${approveDto.action}`);
    const batch = await this.findOne(batchId);
    const { action, comments } = approveDto;

    // Get current approval stage
    const currentStage = typeof batch.current_approval_stage === 'number' 
      ? batch.current_approval_stage 
      : parseInt(String(batch.current_approval_stage || 1), 10);
    
    this.logger.log(`Processing approval action '${action}' for batch ${batchId} at stage ${currentStage} by user ${userId}`);

    const currentApproval = await this.databaseService.queryOne(
      `SELECT * FROM workflow_approvals 
       WHERE payroll_batch_id = $1 AND stage = $2 AND status = 'pending'`,
      [batchId, currentStage],
    );

    if (!currentApproval) {
      this.logger.warn(`No pending approval found for batch ${batchId} stage ${currentStage}`);
      // Check if maybe it's already approved?
      const approvedStage = await this.databaseService.queryOne(
        `SELECT * FROM workflow_approvals 
         WHERE payroll_batch_id = $1 AND stage = $2 AND status = 'approved'`,
        [batchId, currentStage],
      );
      
      if (approvedStage) {
         throw new BadRequestException(`Stage ${currentStage} is already approved. Waiting for next stage.`);
      }
      
      throw new BadRequestException(`No pending approval found for stage ${currentStage}`);
    }

    this.logger.log(`Found current approval: ${JSON.stringify(currentApproval)}`);

    // Get user role
    const user = await this.databaseService.queryOne(
      'SELECT role FROM users WHERE id = $1',
      [userId],
    );

    if (!user) {
        throw new BadRequestException('User not found');
    }
    this.logger.log(`User role: ${user.role}`);

    // Normalize roles for comparison
    // Some roles might be stored as 'payroll_officer' but user has 'Payroll Officer' etc.
    // Ideally we should use slugs everywhere. Assuming slugs are used.
    
    // Allow admin/super_admin to override any stage
    if (user.role.toLowerCase() !== 'admin' && user.role.toLowerCase() !== 'super_admin' && user.role !== currentApproval.approver_role) {
       // Check if the user role matches loosely (case insensitive)
       if (user.role.toLowerCase() !== currentApproval.approver_role.toLowerCase()) {
          this.logger.warn(`Role mismatch: Required ${currentApproval.approver_role}, User has ${user.role}`);
          throw new BadRequestException(`You do not have permission to approve this stage. Required: ${currentApproval.approver_role}, Current: ${user.role}`);
       }
    }

    try {
      await this.databaseService.transaction(async (client) => {
        this.logger.log(`Starting transaction for approval...`);
        // Update approval record
        // Status should be 'approved' or 'rejected' to match workflow_approvals status enum/check
        const status = action;

        const updateResult = await client.query(
          `UPDATE workflow_approvals 
           SET status = $1, approver_id = $2, comments = $3, action_date = NOW()
           WHERE id = $4`,
          [status, userId, comments, currentApproval.id],
        );
        this.logger.log(`Updated workflow_approvals: ${updateResult.rowCount} rows`);

        if (action === 'rejected') {
          // Reject batch - Reset to 'draft' to allow corrections as per requirement
          // Reset status to draft and delete PENDING workflow_approvals for this batch
          // to allow a fresh submission process.
          
          await client.query(
            `UPDATE payroll_batches 
             SET status = 'draft', 
                 current_approval_stage = 0, 
                 updated_at = NOW() 
             WHERE id = $1`,
            [batchId],
          );
          
          await client.query(
            `DELETE FROM workflow_approvals WHERE payroll_batch_id = $1 AND status = 'pending'`,
            [batchId]
          );
          this.logger.log(`Batch rejected and reset to draft.`);

        } else if (action === 'approved') {
          // Check if there is a next stage
          const nextStageResult = await client.query(
            'SELECT stage FROM workflow_approvals WHERE payroll_batch_id = $1 AND stage > $2 ORDER BY stage ASC LIMIT 1',
            [batchId, currentStage],
          );

          const nextStage = nextStageResult.rows[0];
          this.logger.log(`Next stage found: ${JSON.stringify(nextStage)}`);

          if (!nextStage) {
            // No next stage found - Final approval - mark as ready for payment
            await client.query(
              `UPDATE payroll_batches SET status = 'ready_for_payment', updated_at = NOW() WHERE id = $1`,
              [batchId],
            );
            this.logger.log(`Batch fully approved (ready_for_payment).`);
          } else {
            // Move to next stage found
            await client.query(
              `UPDATE payroll_batches 
               SET current_approval_stage = $2, status = 'pending_review', updated_at = NOW()
               WHERE id = $1`,
              [batchId, nextStage.stage],
            );
            this.logger.log(`Moved to next stage: ${nextStage.stage}`);
          }
        }
      });
    } catch (e) {
      this.logger.error(`Transaction failed: ${e.message}`, e.stack);
      throw e;
    }

    this.logger.log(`Batch ${batchId} ${action} by user ${userId}`);

    // Send notifications
    try {
      if (action === 'rejected') {
        await this.notificationsService.create({
          recipient_id: batch.created_by,
          type: NotificationType.PAYROLL,
          category: NotificationCategory.ACTION_REQUIRED,
          title: 'Payroll Batch Returned',
          message: `Payroll batch ${batch.batch_number} was returned/rejected. Please review and resubmit. Comments: ${comments}`,
          entity_type: 'payroll_batch',
          entity_id: batchId,
          priority: NotificationPriority.HIGH,
        });
      } else if (action === 'approved') {
        // Get updated batch status to decide notification
        const updatedBatch = await this.databaseService.queryOne('SELECT status, current_approval_stage FROM payroll_batches WHERE id = $1', [batchId]);

        if (updatedBatch.status === 'ready_for_payment') {
          // Notify creator and Cashiers
          await this.notificationsService.create({
            recipient_id: batch.created_by,
            type: NotificationType.PAYROLL,
            category: NotificationCategory.SUCCESS,
            title: 'Payroll Batch Approved',
            message: `Payroll batch ${batch.batch_number} has been fully approved and is ready for payment.`,
            entity_type: 'payroll_batch',
            entity_id: batchId,
            priority: NotificationPriority.MEDIUM,
          });
          
          // Notify Cashiers
          const cashiers = await this.databaseService.query('SELECT id FROM users WHERE role = $1', ['cashier']);
          for (const cashier of cashiers) {
             await this.notificationsService.create({
              recipient_id: cashier.id,
              type: NotificationType.PAYROLL,
              category: NotificationCategory.ACTION_REQUIRED,
              title: 'Payment Action Required',
              message: `Payroll batch ${batch.batch_number} is approved and ready for payment processing.`,
              entity_type: 'payroll_batch',
              entity_id: batchId,
              priority: NotificationPriority.HIGH,
            });
          }

        } else if (updatedBatch.status === 'pending_review') {
          // Notify next approver(s)
          const nextStageInfo = await this.databaseService.queryOne(
            `SELECT approver_role FROM workflow_approvals 
             WHERE payroll_batch_id = $1 AND stage = $2`,
            [batchId, updatedBatch.current_approval_stage]
          );

          if (nextStageInfo) {
             const approvers = await this.databaseService.query('SELECT id FROM users WHERE role = $1', [nextStageInfo.approver_role]);
             if (approvers.length === 0) {
               this.logger.warn(`No users found for role ${nextStageInfo.approver_role} for stage ${updatedBatch.current_approval_stage}`);
             }
             for (const approver of approvers) {
                await this.notificationsService.create({
                  recipient_id: approver.id,
                  type: NotificationType.PAYROLL,
                  category: NotificationCategory.ACTION_REQUIRED,
                  title: 'Payroll Approval Required',
                  message: `Payroll batch ${batch.batch_number} requires your approval (Stage ${updatedBatch.current_approval_stage}).`,
                  entity_type: 'payroll_batch',
                  entity_id: batchId,
                  priority: NotificationPriority.HIGH,
                });
             }
          } else {
             this.logger.error(`Next stage info not found for batch ${batchId} stage ${updatedBatch.current_approval_stage}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send notifications: ${error.message}`);
    }


    return { message: `Batch ${action} successfully` };
  }

  /**
   * Lock payroll batch
   */
  async lockBatch(batchId: string, userId: string) {
    const batch = await this.findOne(batchId);

    // Allow locking if batch is ready for payment or already paid
    if (batch.status !== 'ready_for_payment' && batch.status !== 'paid' && batch.status !== 'approved') {
      throw new BadRequestException('Only approved, ready for payment, or paid batches can be locked');
    }

    await this.databaseService.query(
      `UPDATE payroll_batches 
       SET status = 'locked', locked_by = $1, locked_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [userId, batchId],
    );

    this.logger.log(`Batch ${batchId} locked by user ${userId}`);

    // Send payroll completion emails to all staff
    this.sendPayrollCompletionEmails(batchId);

    // Trigger webhook for external systems
    this.triggerPayrollCompletedWebhook(batchId);

    // Mark external deductions as processed
    this.processExternalDeductions(batchId);

    // Process Cooperative Deductions
    this.processCooperativeDeductions(batchId, userId);

    return { message: 'Batch locked successfully' };
  }

  /**
   * Process cooperative deductions from locked batch
   */
  private async processCooperativeDeductions(batchId: string, userId: string) {
    try {
      const batch = await this.findOne(batchId);
      const payrollLines = await this.databaseService.query(
        'SELECT staff_id, deductions FROM payroll_lines WHERE payroll_batch_id = $1',
        [batchId]
      );

      const contributions = [];

      for (const line of payrollLines) {
        let deductions = [];
        try {
          deductions = typeof line.deductions === 'string' ? JSON.parse(line.deductions) : line.deductions;
        } catch (e) {
          continue;
        }

        if (!Array.isArray(deductions)) continue;

        for (const deduction of deductions) {
          if (deduction.is_cooperative && deduction.cooperative_id && deduction.member_id) {
            contributions.push({
              cooperativeId: deduction.cooperative_id,
              memberId: deduction.member_id,
              amount: parseFloat(deduction.amount),
              month: batch.payroll_month,
            });
          }
        }
      }

      if (contributions.length > 0) {
        await this.cooperativesService.processPayrollDeductions(batchId, contributions, userId);
        this.logger.log(`Processed ${contributions.length} cooperative contributions for batch ${batchId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process cooperative deductions: ${error.message}`);
      // Don't throw, just log. We don't want to rollback the lock if this fails (or maybe we do? Requirement unclear but usually better to log)
    }
  }

  /**
   * Trigger webhook for payroll completion
   */
  private async triggerPayrollCompletedWebhook(batchId: string) {
    try {
      const batch = await this.findOne(batchId);

      // Get total deductions for each external system
      const externalDeductions = await this.databaseService.query(
        `SELECT 
          ed.external_system,
          COUNT(*) as deduction_count,
          SUM(ed.amount) as total_amount
         FROM external_deductions ed
         JOIN payroll_lines pl ON ed.staff_id = pl.staff_id
         WHERE pl.payroll_batch_id = $1 AND ed.status = 'pending'
         GROUP BY ed.external_system`,
        [batchId],
      );

      // Prepare webhook payload
      const payload = {
        event: 'payroll.completed',
        timestamp: new Date().toISOString(),
        payroll: {
          batch_id: batch.id,
          batch_number: batch.batch_number,
          payroll_month: batch.payroll_month,
          period_start: batch.period_start,
          period_end: batch.period_end,
          total_staff: batch.total_staff,
          total_gross: parseFloat(batch.total_gross),
          total_deductions: parseFloat(batch.total_deductions),
          total_net: parseFloat(batch.total_net),
          locked_at: new Date().toISOString(),
        },
        external_deductions: externalDeductions.map(ed => ({
          system: ed.external_system,
          count: parseInt(ed.deduction_count),
          total_amount: parseFloat(ed.total_amount),
        })),
      };

      // Trigger webhook
      await this.externalApiService.triggerWebhook('payroll.completed', payload);

      this.logger.log(`Payroll completed webhook triggered for batch ${batchId}`);
    } catch (error) {
      this.logger.error(`Failed to trigger payroll webhook: ${error.message}`);
    }
  }

  /**
   * Process external deductions (mark as processed)
   */
  private async processExternalDeductions(batchId: string) {
    try {
      await this.databaseService.query(
        `UPDATE external_deductions ed
         SET status = 'processed', processed_at = NOW(), payroll_batch_id = $1
         FROM payroll_lines pl
         WHERE ed.staff_id = pl.staff_id 
         AND pl.payroll_batch_id = $1 
         AND ed.status = 'pending'`,
        [batchId],
      );

      this.logger.log(`External deductions processed for batch ${batchId}`);
    } catch (error) {
      this.logger.error(`Failed to process external deductions: ${error.message}`);
    }
  }

  /**
   * Send payroll completion emails to all staff in batch
   */
  private async sendPayrollCompletionEmails(batchId: string) {
    try {
      const batch = await this.findOne(batchId);
      
      // Get all staff in this payroll batch with their email addresses
      const staff = await this.databaseService.query(
        `SELECT pl.staff_id, pl.staff_name, s.email
         FROM payroll_lines pl
         JOIN staff s ON pl.staff_id = s.id
         WHERE pl.payroll_batch_id = $1 AND s.email IS NOT NULL`,
        [batchId],
      );

      if (staff.length === 0) {
        this.logger.warn(`No staff with email addresses found for batch ${batchId}`);
        return;
      }

      // Parse month and year from payroll_month (format: YYYY-MM)
      if (!batch.payroll_month) {
          this.logger.warn(`Batch ${batchId} has no payroll_month set. Skipping email notification.`);
          return;
      }
      const parts = batch.payroll_month.split('-');
      if (parts.length !== 2) {
          this.logger.warn(`Batch ${batchId} has invalid payroll_month format: ${batch.payroll_month}. Skipping email notification.`);
          return;
      }
      const [year, month] = parts;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[parseInt(month) - 1];

      // Send emails (asynchronously, don't wait)
      // Use Promise.allSettled to ensure all emails are attempted
      const emailPromises = staff.map(async (staffMember) => {
        if (!staffMember.email) return;
        
        try {
          await this.emailService.sendPayrollCompletionEmail(
            staffMember.email,
            staffMember.staff_name,
            batch.batch_number,
            monthName,
            parseInt(year),
          );
        } catch (error) {
          this.logger.error(`Failed to send payroll email to ${staffMember.email}: ${error.message}`);
        }
      });
      
      // Fire and forget, or await if critical. Since this is in lockBatch, we probably don't want to block too long.
      // But we should catch errors at the top level.
      Promise.allSettled(emailPromises).then(() => {
          this.logger.log(`Payroll completion emails processing finished for ${staff.length} staff members`);
      });

      this.logger.log(`Payroll completion emails queued for ${staff.length} staff members`);
    } catch (error) {
      this.logger.error(`Failed to send payroll completion emails: ${error.message}`);
      // Do NOT throw error here, so lockBatch can continue even if emails fail
    }
  }

  /**
   * Get all payroll batches
   */
  async findAll(query: any) {
    const { page = 1, limit = 20, status, payrollMonth, year, month } = query;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (payrollMonth) {
      whereConditions.push(`payroll_month = $${paramIndex}`);
      params.push(payrollMonth);
      paramIndex++;
    } else if (year && month) {
      const m = month.toString().padStart(2, '0');
      whereConditions.push(`payroll_month = $${paramIndex}`);
      params.push(`${year}-${m}`);
      paramIndex++;
    } else if (year) {
      whereConditions.push(`payroll_month LIKE $${paramIndex}`);
      params.push(`${year}-%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM payroll_batches ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    const dataQuery = `
      SELECT pb.*, pb.payroll_month as month, u.full_name as created_by_name
      FROM payroll_batches pb
      LEFT JOIN users u ON pb.created_by = u.id
      ${whereClause}
      ORDER BY pb.created_at DESC
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
   * Get single payroll batch
   */
  async findOne(id: string) {
    const batch = await this.databaseService.queryOne(
      `SELECT pb.*, pb.payroll_month as month, u.full_name as created_by_name
       FROM payroll_batches pb
       LEFT JOIN users u ON pb.created_by = u.id
       WHERE pb.id = $1`,
      [id],
    );

    if (!batch) {
      throw new NotFoundException(`Payroll batch with ID ${id} not found`);
    }

    return batch;
  }

  /**
   * Get payroll lines for a batch
   */
  async getPayrollLines(batchId: string, query: any) {
    const { page = 1, limit = 50, search, sort = 'desc' } = query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE payroll_batch_id = $1';
    const params: any[] = [batchId];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND (staff_number ILIKE $${paramIndex} OR staff_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as total FROM payroll_lines ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    // Default sort is descending (Highest Grade first). 
    // If sort='asc', then Lowest Grade first (grade_level ASC).
    const sortOrder = sort === 'asc' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT *, (COALESCE(gross_pay, 0)::numeric - COALESCE(basic_salary, 0)::numeric) as total_allowances FROM payroll_lines
      ${whereClause}
      ORDER BY grade_level ${sortOrder}, step ${sortOrder}, staff_number ASC
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

  async getPaymentTrace(batchId: string) {
    const batch = await this.databaseService.queryOne(
      `SELECT id, batch_number, payroll_month, status
       FROM payroll_batches
       WHERE id = $1`,
      [batchId],
    );

    if (!batch) {
      throw new NotFoundException(`Payroll batch #${batchId} not found`);
    }

    const lines = await this.databaseService.query(
      `SELECT id, staff_id, staff_number, staff_name, net_pay, bank_name, account_number
       FROM payroll_lines
       WHERE payroll_batch_id = $1
       ORDER BY staff_number`,
      [batchId],
    );

    const paymentBatches = await this.databaseService.query(
      `SELECT id, status, created_at
       FROM payment_batches
       WHERE payroll_batch_id = $1
       ORDER BY created_at DESC`,
      [batchId],
    );

    if (!paymentBatches.length) {
      const unpaid = lines.map((line) => ({
        staff_id: line.staff_id,
        staff_number: line.staff_number,
        staff_name: line.staff_name,
        net_pay: line.net_pay,
        reason: 'No payment batch generated',
      }));

      return {
        batch,
        total_staff: lines.length,
        paid_count: 0,
        unpaid_count: unpaid.length,
        payment_batch_ids: [],
        unpaid,
      };
    }

    const paymentBatchIds = paymentBatches.map((pb) => pb.id);
    const transactions = await this.databaseService.query(
      `SELECT id, payment_batch_id, staff_id, staff_number, status, bank_response_message, updated_at
       FROM payment_transactions
       WHERE payment_batch_id = ANY($1::uuid[])
       ORDER BY updated_at DESC`,
      [paymentBatchIds],
    );

    const transactionMap = new Map<string, any>();
    for (const tx of transactions) {
      const keys = [tx.staff_id, tx.staff_number].filter(Boolean);
      for (const key of keys) {
        if (!transactionMap.has(key)) {
          transactionMap.set(key, tx);
        }
      }
    }

    let paidCount = 0;
    const unpaid: Array<any> = [];

    for (const line of lines) {
      const tx = transactionMap.get(line.staff_id) || transactionMap.get(line.staff_number);
      const netPay = typeof line.net_pay === 'number' ? line.net_pay : parseFloat(line.net_pay || '0');
      const missingBank = !line.bank_name || !line.account_number;

      if (tx?.status === 'successful' || tx?.status === 'completed' || tx?.status === 'confirmed') {
        paidCount += 1;
        continue;
      }

      let reason = 'Not in payment batch';
      if (missingBank) {
        reason = 'Missing bank details';
      } else if (!netPay || netPay <= 0) {
        reason = 'Zero net pay';
      } else if (tx?.status === 'failed') {
        reason = tx.bank_response_message || 'Payment failed';
      } else if (tx?.status === 'processing' || tx?.status === 'pending') {
        reason = `Payment ${tx.status}`;
      }

      unpaid.push({
        staff_id: line.staff_id,
        staff_number: line.staff_number,
        staff_name: line.staff_name,
        net_pay: netPay,
        transaction_status: tx?.status || 'none',
        reason,
      });
    }

    return {
      batch,
      total_staff: lines.length,
      paid_count: paidCount,
      unpaid_count: unpaid.length,
      payment_batch_ids: paymentBatchIds,
      unpaid,
    };
  }

  /**
   * Delete batch (only draft batches)
   */
  async remove(id: string, userId: string) {
    const batch = await this.databaseService.queryOne(
      'SELECT status FROM payroll_batches WHERE id = $1',
      [id],
    );

    if (!batch) {
      throw new NotFoundException(`Payroll batch #${id} not found`);
    }

    if (batch.status !== 'draft') {
      throw new BadRequestException('Only draft payroll batches can be deleted');
    }

    await this.databaseService.query('DELETE FROM payroll_batches WHERE id = $1', [id]);

    this.logger.log(`Payroll batch ${id} deleted by ${userId}`);
    return { message: 'Payroll batch deleted successfully' };
  }

  async getPendingPayments() {
    return this.databaseService.query(
      `SELECT *, payroll_month as month FROM payroll_batches 
       WHERE (status = 'approved' OR status = 'ready_for_payment')
       AND (payment_status IS NULL OR payment_status = 'pending')
       ORDER BY created_at DESC`
    );
  }

  async executePayment(id: string, reference: string, userId: string) {
    const batch = await this.databaseService.queryOne(
      'SELECT id, status, payment_status FROM payroll_batches WHERE id = $1',
      [id],
    );

    if (!batch) {
      throw new NotFoundException(`Payroll batch #${id} not found`);
    }

    if (batch.status !== 'approved' && batch.status !== 'ready_for_payment') {
      throw new BadRequestException('Only approved or ready for payment payroll batches can be paid');
    }

    if (batch.payment_status === 'completed') {
      throw new BadRequestException('Payment already completed for this batch');
    }

    await this.ensurePayrollPaymentColumns();
    try {
      await this.databaseService.query(
        `UPDATE payroll_batches 
         SET status = 'paid',
             payment_status = 'completed',
             payment_reference = $1,
             payment_executed_by = $2,
             payment_executed_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [reference, userId, id],
      );
    } catch (error: any) {
      // Attempt to fix missing columns and retry
      if ((error?.message || '').includes('does not exist')) {
        await this.ensurePayrollPaymentColumns();
        await this.databaseService.query(
          `UPDATE payroll_batches 
           SET status = 'paid',
               payment_status = 'completed',
               payment_reference = $1,
               payment_executed_by = $2,
               payment_executed_at = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [reference, userId, id],
        );
      } else {
        throw error;
      }
    }

    // Audit log
    await this.auditService.log({
      userId,
      action: AuditAction.PROCESS,
      entity: 'payroll_batch',
      entityId: id,
      description: `Executed payment for payroll batch ${id}`,
      newValues: { payment_reference: reference, status: 'paid' },
    });

    this.logger.log(`Payment executed for batch ${id} by ${userId}`);
    return { message: 'Payment executed successfully' };
  }

  /**
   * Get approval actions history for a specific approver (approved/rejected)
   */
  async getApproverHistory(userId: string, role?: string) {
    const normalizedRole = role?.toLowerCase();
    const isAuditor = normalizedRole === 'auditor' || normalizedRole === 'audit';
    const query = `
      SELECT 
        wa.id,
        wa.stage,
        wa.stage_name,
        wa.approver_role,
        wa.status,
        wa.comments,
        wa.action_date,
        pb.id as batch_id,
        pb.batch_number,
        pb.payroll_month as month
      FROM workflow_approvals wa
      JOIN payroll_batches pb ON wa.payroll_batch_id = pb.id
      WHERE ${
        isAuditor
          ? "LOWER(wa.approver_role) = 'auditor'"
          : 'wa.approver_id = $1'
      }
        AND (wa.status = 'approved' OR wa.status = 'rejected')
      ORDER BY wa.action_date DESC
    `;
    return this.databaseService.query(query, isAuditor ? [] : [userId]);
  }
}
