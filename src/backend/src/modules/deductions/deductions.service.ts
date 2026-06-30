import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class DeductionsService {
  private readonly logger = new Logger(DeductionsService.name);

  constructor(private databaseService: DatabaseService) {}

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

  private hasOwn(dto: any, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(dto || {}, key);
  }

  private hasStaffDeductionDefinitionInput(dto: any): boolean {
    return [
      'deduction_id',
      'deductionId',
      'deduction_code',
      'deductionCode',
      'deduction_name',
      'deductionName',
      'type',
      'entry_mode',
      'entryMode',
    ].some((key) => this.hasOwn(dto, key));
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

  private async resolveStaffDeductionDefinition(dto: any) {
    const requestedMode = this.getEntryMode(dto);
    const deductionId = this.cleanString(dto.deduction_id ?? dto.deductionId);
    const deductionCode = this.cleanString(dto.deduction_code ?? dto.deductionCode);
    const deductionName = this.cleanString(dto.deduction_name ?? dto.deductionName);
    const deductionType = this.cleanString(dto.type);

    let configuredDeduction = null;
    if (deductionId) {
      configuredDeduction = await this.databaseService.queryOne(
        'SELECT * FROM deductions WHERE id = $1',
        [deductionId],
      );
    } else if (deductionCode && requestedMode !== 'custom') {
      configuredDeduction = await this.databaseService.queryOne(
        'SELECT * FROM deductions WHERE code = $1',
        [deductionCode],
      );
    }

    const shouldUseConfigured =
      requestedMode === 'configured' ||
      Boolean(deductionId) ||
      (requestedMode !== 'custom' && Boolean(configuredDeduction));

    if (shouldUseConfigured) {
      if (!configuredDeduction) {
        throw new BadRequestException('Please select a valid deduction from Payroll Setup');
      }
      if (configuredDeduction.applies_to_all) {
        throw new BadRequestException('Global deductions cannot be assigned as staff-specific');
      }
      if (configuredDeduction.status !== 'active') {
        throw new BadRequestException('Selected deduction is not active');
      }

      return {
        entryMode: 'configured' as const,
        deductionId: configuredDeduction.id,
        deductionCode: configuredDeduction.code,
        deductionName: configuredDeduction.name,
        type: configuredDeduction.type,
      };
    }

    if (!deductionName) {
      throw new BadRequestException('Custom deduction name is required');
    }
    if (deductionType !== 'fixed' && deductionType !== 'percentage') {
      throw new BadRequestException('Custom deduction type must be fixed or percentage');
    }

    return {
      entryMode: 'custom' as const,
      deductionId: null,
      deductionCode: deductionCode || this.deriveCustomCode(deductionName, 'DEDUCT'),
      deductionName,
      type: deductionType,
    };
  }

  // ==================== GLOBAL DEDUCTIONS ====================

  async createGlobalDeduction(dto: any, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM deductions WHERE code = $1',
      [dto.code],
    );

    if (existing) {
      throw new BadRequestException(`Deduction with code ${dto.code} already exists`);
    }

    const deduction = await this.databaseService.queryOne(
      `INSERT INTO deductions (
        code, name, type, amount, percentage, applies_to_all, is_statutory, status, created_by, excluded_grades, excluded_employment_types
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)
      RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.type,
        dto.amount || null,
        dto.percentage || null,
        dto.appliesToAll ?? dto.applies_to_all ?? true,
        dto.is_statutory ?? false,
        userId,
        dto.excluded_grades !== undefined ? JSON.stringify(dto.excluded_grades || []) : '[]',
        dto.excluded_employment_types !== undefined ? JSON.stringify(dto.excluded_employment_types || []) : '[]',
      ],
    );

    this.logger.log(`Global deduction ${dto.code} created by user ${userId}`);
    return deduction;
  }

  async findAllGlobalDeductions(query: any) {
    const { page = 1, limit = 20, status } = query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM deductions ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    const dataQuery = `
      SELECT * FROM deductions
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

  async updateGlobalDeduction(id: string, dto: any, userId: string) {
    const existing = await this.databaseService.queryOne('SELECT id FROM deductions WHERE id = $1', [id]);

    if (!existing) {
      throw new NotFoundException(`Deduction with ID ${id} not found`);
    }

    if (dto.code) {
      const existingCode = await this.databaseService.queryOne(
        'SELECT id FROM deductions WHERE code = $1 AND id != $2',
        [dto.code, id],
      );
      if (existingCode) {
        throw new BadRequestException(`Deduction with code ${dto.code} already exists`);
      }
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE deductions
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           type = COALESCE($3, type),
           amount = COALESCE($4, amount),
           percentage = COALESCE($5, percentage),
           status = COALESCE($6, status),
           is_statutory = COALESCE($7, is_statutory),
           applies_to_all = COALESCE($9, applies_to_all),
           excluded_grades = COALESCE($10, excluded_grades),
           excluded_employment_types = COALESCE($11, excluded_employment_types),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        dto.code, 
        dto.name, 
        dto.type, 
        dto.amount, 
        dto.percentage, 
        dto.status, 
        dto.is_statutory ?? dto.isStatutory,
        id,
        dto.appliesToAll ?? dto.applies_to_all ?? null,
        dto.excluded_grades !== undefined ? JSON.stringify(dto.excluded_grades || []) : null,
        dto.excluded_employment_types !== undefined ? JSON.stringify(dto.excluded_employment_types || []) : null
      ],
    );

    this.logger.log(`Global deduction ${id} updated by user ${userId}`);
    return updated;
  }

  async removeGlobalDeduction(id: string, userId: string) {
    const existing = await this.databaseService.queryOne('SELECT id FROM deductions WHERE id = $1', [id]);

    if (!existing) {
      throw new NotFoundException(`Deduction with ID ${id} not found`);
    }

    await this.databaseService.transaction(async (client) => {
      await client.query('DELETE FROM staff_deductions WHERE deduction_id = $1', [id]);
      await client.query('DELETE FROM deductions WHERE id = $1 RETURNING id', [id]);
    });

    this.logger.log(`Global deduction ${id} deleted by user ${userId}`);
    return { message: 'Deduction deleted successfully' };
  }

  // ==================== STAFF-SPECIFIC DEDUCTIONS ====================

  async createStaffDeduction(dto: any, userId: string, userRole?: string) {
    // Determine initial status based on role
    let initialStatus = 'active';
    if (userRole === 'payroll_loader') {
      initialStatus = 'pending';
    }

    const definition = await this.resolveStaffDeductionDefinition(dto);

    const staffDeduction = await this.databaseService.queryOne(
      `INSERT INTO staff_deductions (
        staff_id, deduction_id, custom_deduction_code, custom_deduction_name,
        custom_type, amount, percentage,
        effective_from, effective_to, frequency, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        dto.staff_id || dto.staffId,
        definition.deductionId,
        definition.entryMode === 'custom' ? definition.deductionCode : null,
        definition.entryMode === 'custom' ? definition.deductionName : null,
        definition.entryMode === 'custom' ? definition.type : null,
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
      `Staff deduction created for staff ${dto.staff_id || dto.staffId} by user ${userId} with status ${initialStatus}`,
    );
    return staffDeduction;
  }

  async findStaffDeductions(staffId: string, query: any) {
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
      `SELECT sd.*, 
              COALESCE(sd.custom_deduction_name, d.name) as deduction_name, 
              COALESCE(sd.custom_deduction_code, d.code) as deduction_code, 
              COALESCE(sd.custom_type, d.type) as type,
              CASE WHEN sd.deduction_id IS NULL THEN 'custom' ELSE 'configured' END as entry_mode
       FROM staff_deductions sd
       LEFT JOIN deductions d ON sd.deduction_id = d.id
       ${whereClause} 
       ORDER BY sd.created_at DESC`,
      params,
    );

    return data;
  }

  async findAllStaffDeductions(query: any) {
    const { page = 1, limit = 50, status } = query;
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = '';

    if (status) {
      whereClause = 'WHERE sd.status = $1';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM staff_deductions sd ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    const dataQuery = `
      SELECT sd.*, 
              s.staff_number,
              s.first_name,
              s.last_name,
              COALESCE(sd.custom_deduction_name, d.name) as deduction_name, 
              COALESCE(sd.custom_deduction_code, d.code) as deduction_code,
              COALESCE(sd.custom_type, d.type) as type,
              CASE WHEN sd.deduction_id IS NULL THEN 'custom' ELSE 'configured' END as entry_mode
      FROM staff_deductions sd
      JOIN staff s ON sd.staff_id = s.id
      LEFT JOIN deductions d ON sd.deduction_id = d.id
      ${whereClause}
      ORDER BY sd.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const data = await this.databaseService.query(dataQuery, [...params, limit, offset]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  async updateStaffDeduction(id: string, dto: any, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT * FROM staff_deductions WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException(`Staff deduction with ID ${id} not found`);
    }

    const hasDefinitionInput = this.hasStaffDeductionDefinitionInput(dto);
    const definition = hasDefinitionInput
      ? await this.resolveStaffDeductionDefinition(dto)
      : {
          entryMode: existing.deduction_id ? ('configured' as const) : ('custom' as const),
          deductionId: existing.deduction_id || null,
          deductionCode: existing.custom_deduction_code || null,
          deductionName: existing.custom_deduction_name || null,
          type: existing.custom_type || null,
        };

    const effectiveFrom = this.toMonthStart(dto.effective_from ?? dto.startMonth);
    const effectiveTo = this.toMonthStart(dto.effective_to ?? dto.endMonth);

    const updated = await this.databaseService.queryOne(
      `UPDATE staff_deductions
       SET deduction_id = $1,
           custom_deduction_code = $2,
           custom_deduction_name = $3,
           custom_type = $4,
           amount = CASE WHEN $11::boolean THEN $5 ELSE COALESCE($5, amount) END,
           percentage = CASE WHEN $11::boolean THEN $6 ELSE COALESCE($6, percentage) END,
           effective_from = COALESCE($7, effective_from),
           effective_to = CASE WHEN $10::date IS NULL AND $13::boolean THEN NULL ELSE COALESCE($10, effective_to) END,
           frequency = COALESCE($8, frequency),
           status = COALESCE($9, status),
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        definition.deductionId,
        definition.entryMode === 'custom' ? definition.deductionCode : null,
        definition.entryMode === 'custom' ? definition.deductionName : null,
        definition.entryMode === 'custom' ? definition.type : null,
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

    this.logger.log(`Staff deduction ${id} updated by user ${userId}`);
    return updated;
  }

  async removeStaffDeduction(id: string, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM staff_deductions WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException(`Staff deduction with ID ${id} not found`);
    }

    await this.databaseService.query(
      `DELETE FROM staff_deductions WHERE id = $1`,
      [id],
    );

    this.logger.log(`Staff deduction ${id} deleted by user ${userId}`);
    return { message: 'Staff deduction deleted successfully' };
  }

  async bulkUpdateStaffDeductionStatus(ids: string[], status: string, userId: string) {
    if (!ids.length) return { count: 0 };

    const result = await this.databaseService.query(
      `UPDATE staff_deductions 
       SET status = $1, updated_at = NOW() 
       WHERE id = ANY($2::uuid[])
       RETURNING id`,
      [status, ids],
    );

    this.logger.log(`${result.length} staff deductions updated to ${status} by user ${userId}`);
    return { count: result.length, ids: result.map(r => r.id) };
  }
}
