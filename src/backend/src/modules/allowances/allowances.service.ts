import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class AllowancesService {
  private readonly logger = new Logger(AllowancesService.name);
  private readonly lagosTimeZone = 'Africa/Lagos';

  constructor(private databaseService: DatabaseService) {}

  private normalizeStatus(value: unknown): string {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  private canTransitionApprovalStatus(currentStatus: unknown): boolean {
    const normalized = this.normalizeStatus(currentStatus);
    return (
      normalized === 'pending' ||
      normalized === 'pending_approval' ||
      normalized === 'pending_review' ||
      normalized === 'awaiting_approval' ||
      normalized === 'submitted' ||
      normalized === 'active'
    );
  }

  private toMonthStart(value: any): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    return `${String(value).substring(0, 7)}-01`;
  }

  private cleanString(value: any): string | null {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  private hasEmptyNumericInput(value: any): boolean {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  }

  private assertStaffAllowanceValue(dto: any, type: 'fixed' | 'percentage' | null, requireValue: boolean) {
    if (!type) return;

    const fieldName = type === 'fixed' ? 'amount' : 'percentage';
    const label = type === 'fixed' ? 'Amount' : 'Percentage';
    const rawValue = dto?.[fieldName];

    if (!requireValue) {
      if (this.hasOwn(dto, fieldName) && this.hasEmptyNumericInput(rawValue)) {
        throw new BadRequestException(`${label} is required`);
      }
      return;
    }

    if (this.hasEmptyNumericInput(rawValue)) {
      throw new BadRequestException(`${label} is required`);
    }
  }

  private formatDateForLagos(value: any): string | null {
    if (value === undefined || value === null || value === '') return null;

    const raw = String(value).trim();
    const plainDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (plainDateMatch && !raw.includes('T')) {
      return plainDateMatch[1];
    }

    const parsed = value instanceof Date ? value : new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return plainDateMatch?.[1] || raw;
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.lagosTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(parsed);

    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    return `${year}-${month}-${day}`;
  }

  private normalizeStaffAllowanceRecord<T extends Record<string, any> | null>(record: T): T {
    if (!record) {
      return record;
    }

    return {
      ...record,
      effective_from: this.formatDateForLagos(record.effective_from),
      effective_to: this.formatDateForLagos(record.effective_to),
    };
  }

  private hasOwn(dto: any, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(dto || {}, key);
  }

  private hasStaffAllowanceDefinitionInput(dto: any): boolean {
    return [
      'allowance_id',
      'allowanceId',
      'allowance_code',
      'allowanceCode',
      'allowance_name',
      'allowanceName',
      'type',
      'entry_mode',
      'entryMode',
      'calculation_basis',
      'calculationBasis',
      'is_taxable',
      'isTaxable',
      'is_pensionable',
      'isPensionable',
    ].some((key) => this.hasOwn(dto, key));
  }

  private normalizeCalculationBasis(value: any): 'basic' | 'gross' {
    const normalized = this.cleanString(value)?.toLowerCase();
    return normalized === 'gross' ? 'gross' : 'basic';
  }

  private getEntryMode(dto: any): 'configured' | 'custom' | undefined {
    const rawMode = this.cleanString(dto.entry_mode ?? dto.entryMode);
    if (rawMode === 'configured' || rawMode === 'custom') {
      return rawMode;
    }
    return undefined;
  }

  private deriveCustomCode(name: string, prefix: string): string {
    const slug = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);

    return `${prefix}_${slug || 'ITEM'}`;
  }

  private async resolveStaffAllowanceDefinition(dto: any) {
    const requestedMode = this.getEntryMode(dto);
    const allowanceId = this.cleanString(dto.allowance_id ?? dto.allowanceId);
    const allowanceCode = this.cleanString(dto.allowance_code ?? dto.allowanceCode);
    const allowanceName = this.cleanString(dto.allowance_name ?? dto.allowanceName);
    const allowanceType = this.cleanString(dto.type);

    let configuredAllowance = null;
    if (allowanceId) {
      configuredAllowance = await this.databaseService.queryOne(
        'SELECT * FROM allowances WHERE id = $1',
        [allowanceId],
      );
    } else if (allowanceCode && requestedMode !== 'custom') {
      configuredAllowance = await this.databaseService.queryOne(
        'SELECT * FROM allowances WHERE code = $1',
        [allowanceCode],
      );
    }

    const shouldUseConfigured =
      requestedMode === 'configured' ||
      Boolean(allowanceId) ||
      (requestedMode !== 'custom' && Boolean(configuredAllowance));

    if (shouldUseConfigured) {
      if (!configuredAllowance) {
        throw new BadRequestException('Please select a valid allowance from Payroll Setup');
      }
      if (configuredAllowance.applies_to_all) {
        throw new BadRequestException('Global allowances cannot be assigned as staff-specific');
      }
      if (configuredAllowance.status !== 'active') {
        throw new BadRequestException('Selected allowance is not active');
      }

      return {
        entryMode: 'configured' as const,
        allowanceId: configuredAllowance.id,
        allowanceCode: configuredAllowance.code,
        allowanceName: configuredAllowance.name,
        type: configuredAllowance.type,
        calculationBasis: this.normalizeCalculationBasis(configuredAllowance.calculation_basis),
        isTaxable: configuredAllowance.is_taxable,
        isPensionable: configuredAllowance.is_pensionable,
      };
    }

    if (!allowanceName) {
      throw new BadRequestException('Custom allowance name is required');
    }
    if (allowanceType !== 'fixed' && allowanceType !== 'percentage') {
      throw new BadRequestException('Custom allowance type must be fixed or percentage');
    }

    return {
      entryMode: 'custom' as const,
      allowanceId: null,
      allowanceCode: allowanceCode || this.deriveCustomCode(allowanceName, 'ALLOW'),
      allowanceName,
      type: allowanceType,
      calculationBasis: this.normalizeCalculationBasis(dto.calculation_basis ?? dto.calculationBasis),
      isTaxable: dto.is_taxable ?? dto.isTaxable ?? true,
      isPensionable: dto.is_pensionable ?? dto.isPensionable ?? false,
    };
  }

  // ==================== GLOBAL ALLOWANCES ====================

  async createGlobalAllowance(dto: any, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM allowances WHERE code = $1',
      [dto.code],
    );

    if (existing) {
      throw new BadRequestException(`Allowance with code ${dto.code} already exists`);
    }

    const allowance = await this.databaseService.queryOne(
      `INSERT INTO allowances (
        code, name, type, calculation_basis, amount, percentage, is_taxable, is_pensionable, applies_to_all, status, created_by, excluded_grades, excluded_employment_types
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12)
      RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.type,
        this.normalizeCalculationBasis(dto.calculation_basis ?? dto.calculationBasis),
        dto.amount || null,
        dto.percentage || null,
        dto.is_taxable ?? dto.isTaxable ?? true,
        dto.is_pensionable ?? dto.isPensionable ?? false,
        dto.appliesToAll ?? dto.applies_to_all ?? true,
        userId,
        dto.excluded_grades !== undefined ? JSON.stringify(dto.excluded_grades || []) : '[]',
        dto.excluded_employment_types !== undefined ? JSON.stringify(dto.excluded_employment_types || []) : '[]',
      ],
    );

    this.logger.log(`Global allowance ${dto.code} created by user ${userId}`);
    return allowance;
  }

  async findAllGlobalAllowances(query: any) {
    const { page = 1, limit = 100, status } = query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM allowances ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    const dataQuery = `
      SELECT * FROM allowances
      ${whereClause}
      ORDER BY code
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
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

  async updateGlobalAllowance(id: string, dto: any, userId: string) {
    const existing = await this.databaseService.queryOne('SELECT id FROM allowances WHERE id = $1', [id]);

    if (!existing) {
      throw new NotFoundException(`Allowance with ID ${id} not found`);
    }

    if (dto.code) {
      const existingCode = await this.databaseService.queryOne(
        'SELECT id FROM allowances WHERE code = $1 AND id != $2',
        [dto.code, id],
      );
      if (existingCode) {
        throw new BadRequestException(`Allowance with code ${dto.code} already exists`);
      }
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE allowances
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           type = COALESCE($3, type),
           calculation_basis = COALESCE($4, calculation_basis),
           amount = COALESCE($5, amount),
           percentage = COALESCE($6, percentage),
           is_taxable = COALESCE($7, is_taxable),
           is_pensionable = COALESCE($8, is_pensionable),
           status = COALESCE($9, status),
           applies_to_all = COALESCE($11, applies_to_all),
           excluded_grades = COALESCE($12, excluded_grades),
           excluded_employment_types = COALESCE($13, excluded_employment_types),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.type,
        this.hasOwn(dto, 'calculation_basis') || this.hasOwn(dto, 'calculationBasis')
          ? this.normalizeCalculationBasis(dto.calculation_basis ?? dto.calculationBasis)
          : null,
        dto.amount,
        dto.percentage,
        dto.is_taxable ?? dto.isTaxable,
        dto.is_pensionable ?? dto.isPensionable,
        dto.status,
        id,
        dto.appliesToAll ?? dto.applies_to_all ?? null,
        dto.excluded_grades !== undefined ? JSON.stringify(dto.excluded_grades || []) : null,
        dto.excluded_employment_types !== undefined ? JSON.stringify(dto.excluded_employment_types || []) : null
      ],
    );

    this.logger.log(`Global allowance ${id} updated by user ${userId}`);
    return updated;
  }

  async removeGlobalAllowance(id: string, userId: string) {
    const existing = await this.databaseService.queryOne('SELECT id FROM allowances WHERE id = $1', [id]);

    if (!existing) {
      throw new NotFoundException(`Allowance with ID ${id} not found`);
    }

    await this.databaseService.transaction(async (client) => {
      await client.query('DELETE FROM staff_allowances WHERE allowance_id = $1', [id]);
      await client.query('DELETE FROM allowances WHERE id = $1', [id]);
    });

    this.logger.log(`Global allowance ${id} deleted by user ${userId}`);
    return { message: 'Allowance deleted successfully' };
  }

  // ==================== STAFF-SPECIFIC ALLOWANCES ====================

  async createStaffAllowance(dto: any, userId: string, userRole?: string) {
    // Determine initial status based on role
    // Payroll Loaders require approval (pending status)
    // Admins and Managers are auto-approved (active status)
    let initialStatus = 'active';
    if (userRole === 'payroll_loader') {
      initialStatus = 'pending';
    }

    const definition = await this.resolveStaffAllowanceDefinition(dto);
    this.assertStaffAllowanceValue(dto, definition.type, true);

    const staffAllowance = await this.databaseService.queryOne(
      `INSERT INTO staff_allowances (
        staff_id, allowance_id, custom_allowance_code, custom_allowance_name,
        custom_type, custom_calculation_basis, custom_is_taxable, custom_is_pensionable, amount, percentage,
        effective_from, effective_to, frequency, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        dto.staff_id || dto.staffId,
        definition.allowanceId,
        definition.entryMode === 'custom' ? definition.allowanceCode : null,
        definition.entryMode === 'custom' ? definition.allowanceName : null,
        definition.entryMode === 'custom' ? definition.type : null,
        definition.entryMode === 'custom' ? definition.calculationBasis : null,
        definition.entryMode === 'custom' ? definition.isTaxable : null,
        definition.entryMode === 'custom' ? definition.isPensionable : null,
        definition.type === 'fixed' ? (dto.amount ?? null) : null,
        definition.type === 'percentage' ? (dto.percentage ?? null) : null,
        this.toMonthStart(dto.effective_from || dto.startMonth),
        this.toMonthStart(dto.effective_to || dto.endMonth),
        dto.frequency || 'recurring',
        initialStatus,
        userId,
      ],
    );

    this.logger.log(
      `Staff allowance created for staff ${dto.staff_id || dto.staffId} by user ${userId} with status ${initialStatus}`,
    );
    return this.normalizeStaffAllowanceRecord(staffAllowance);
  }

  async findStaffAllowances(staffId: string, query: any) {
    const { status, month } = query;

    let whereClause = 'WHERE staff_id = $1';
    const params = [staffId];

    if (status) {
      whereClause += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (month) {
      whereClause += ` AND effective_from <= TO_DATE($${params.length + 1} || '-01', 'YYYY-MM-DD')`;
      params.push(month);
      whereClause += ` AND (effective_to IS NULL OR effective_to >= TO_DATE($${params.length + 1} || '-01', 'YYYY-MM-DD'))`;
      params.push(month);
    }

    const data = await this.databaseService.query(
      `SELECT sa.*, 
              COALESCE(sa.custom_allowance_name, a.name) as allowance_name, 
              COALESCE(sa.custom_allowance_code, a.code) as allowance_code, 
              COALESCE(sa.custom_type, a.type) as type, 
              COALESCE(sa.custom_calculation_basis, a.calculation_basis, 'basic') as calculation_basis,
              COALESCE(sa.custom_is_taxable, a.is_taxable, true) as is_taxable, 
              COALESCE(sa.custom_is_pensionable, a.is_pensionable, false) as is_pensionable,
              CASE WHEN sa.allowance_id IS NULL THEN 'custom' ELSE 'configured' END as entry_mode
       FROM staff_allowances sa
       LEFT JOIN allowances a ON sa.allowance_id = a.id
       ${whereClause} 
       ORDER BY sa.created_at DESC`,
      params,
    );

    return data.map((record: any) => this.normalizeStaffAllowanceRecord(record));
  }

  async findAllStaffAllowances(query: any) {
    const { page = 1, limit = 100, status } = query;
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = '';

    if (status) {
      whereClause = 'WHERE sa.status = $1';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM staff_allowances sa ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    const dataQuery = `
      SELECT sa.*, 
              s.staff_number,
              s.first_name,
              s.last_name,
              COALESCE(sa.custom_allowance_name, a.name) as allowance_name, 
              COALESCE(sa.custom_allowance_code, a.code) as allowance_code,
              COALESCE(sa.custom_type, a.type) as type,
              COALESCE(sa.custom_calculation_basis, a.calculation_basis, 'basic') as calculation_basis,
              COALESCE(sa.custom_is_taxable, a.is_taxable, true) as is_taxable,
              COALESCE(sa.custom_is_pensionable, a.is_pensionable, false) as is_pensionable,
              CASE WHEN sa.allowance_id IS NULL THEN 'custom' ELSE 'configured' END as entry_mode
      FROM staff_allowances sa
      JOIN staff s ON sa.staff_id = s.id
      LEFT JOIN allowances a ON sa.allowance_id = a.id
      ${whereClause}
      ORDER BY sa.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const data = await this.databaseService.query(dataQuery, [...params, limit, offset]);

    return {
      data: data.map((record: any) => this.normalizeStaffAllowanceRecord(record)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  async updateStaffAllowance(id: string, dto: any, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT * FROM staff_allowances WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException(`Staff allowance with ID ${id} not found`);
    }

    const requestedStatus = this.normalizeStatus(dto?.status);
    if ((requestedStatus === 'active' || requestedStatus === 'inactive') && !this.canTransitionApprovalStatus(existing.status)) {
      throw new BadRequestException('This adjustment is not eligible for approval changes');
    }

    const hasDefinitionInput = this.hasStaffAllowanceDefinitionInput(dto);
    const definition = hasDefinitionInput
      ? await this.resolveStaffAllowanceDefinition(dto)
      : {
          entryMode: existing.allowance_id ? ('configured' as const) : ('custom' as const),
          allowanceId: existing.allowance_id || null,
          allowanceCode: existing.custom_allowance_code || null,
          allowanceName: existing.custom_allowance_name || null,
          type: existing.custom_type || null,
          calculationBasis: existing.custom_calculation_basis || 'basic',
          isTaxable: existing.custom_is_taxable,
          isPensionable: existing.custom_is_pensionable,
        };
    this.assertStaffAllowanceValue(dto, definition.type, hasDefinitionInput);

    const effectiveFrom = this.toMonthStart(dto.effective_from ?? dto.startMonth);
    const effectiveTo = this.toMonthStart(dto.effective_to ?? dto.endMonth);

    const updated = await this.databaseService.queryOne(
      `UPDATE staff_allowances
       SET allowance_id = $1,
           custom_allowance_code = $2,
           custom_allowance_name = $3,
           custom_type = $4,
           custom_calculation_basis = $5,
           custom_is_taxable = $6,
           custom_is_pensionable = $7,
           amount = CASE WHEN $14::boolean THEN $8 ELSE COALESCE($8, amount) END,
           percentage = CASE WHEN $14::boolean THEN $9 ELSE COALESCE($9, percentage) END,
           effective_from = COALESCE($10, effective_from),
           effective_to = CASE WHEN $13::date IS NULL AND $16::boolean THEN NULL ELSE COALESCE($13, effective_to) END,
           frequency = COALESCE($11, frequency),
           status = COALESCE($12, status),
           updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        definition.allowanceId,
        definition.entryMode === 'custom' ? definition.allowanceCode : null,
        definition.entryMode === 'custom' ? definition.allowanceName : null,
        definition.entryMode === 'custom' ? definition.type : null,
        definition.entryMode === 'custom' ? definition.calculationBasis : null,
        definition.entryMode === 'custom' ? definition.isTaxable : null,
        definition.entryMode === 'custom' ? definition.isPensionable : null,
        hasDefinitionInput
          ? (definition.type === 'fixed' ? (dto.amount ?? null) : null)
          : dto.amount,
        hasDefinitionInput
          ? (definition.type === 'percentage' ? (dto.percentage ?? null) : null)
          : dto.percentage,
        effectiveFrom,
        dto.frequency,
        dto.status,
        effectiveTo,
        hasDefinitionInput,
        id,
        dto.effective_to === null || dto.effective_to === '',
      ],
    );

    this.logger.log(`Staff allowance ${id} updated by user ${userId}`);
    return this.normalizeStaffAllowanceRecord(updated);
  }

  async removeStaffAllowance(id: string, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM staff_allowances WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException(`Staff allowance with ID ${id} not found`);
    }

    await this.databaseService.query(
      `DELETE FROM staff_allowances WHERE id = $1`,
      [id],
    );

    this.logger.log(`Staff allowance ${id} deleted by user ${userId}`);
    return { message: 'Staff allowance deleted successfully' };
  }

  async bulkUpdateStaffAllowanceStatus(ids: string[], status: string, userId: string) {
    if (!ids.length) return { count: 0 };

    const requestedStatus = this.normalizeStatus(status);
    if (requestedStatus !== 'active' && requestedStatus !== 'inactive') {
      throw new BadRequestException('Invalid status for bulk approval');
    }

    const result = await this.databaseService.query(
      `UPDATE staff_allowances 
       SET status = $1, updated_at = NOW() 
       WHERE id = ANY($2::uuid[])
         AND LOWER(COALESCE(status, '')) IN ('pending','pending_approval','pending_review','awaiting_approval','submitted','active')
       RETURNING id`,
      [status, ids],
    );

    this.logger.log(`${result.length} staff allowances updated to ${status} by user ${userId}`);
    return { count: result.length, ids: result.map(r => r.id) };
  }
}
