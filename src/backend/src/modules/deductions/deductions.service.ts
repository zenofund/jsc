import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class DeductionsService {
  private readonly logger = new Logger(DeductionsService.name);

  constructor(private databaseService: DatabaseService) {}

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
        code, name, type, amount, percentage, applies_to_all, is_statutory, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
      RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.type,
        dto.amount || null,
        dto.percentage || null,
        dto.appliesToAll ?? true,
        dto.is_statutory ?? false,
        userId,
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
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [dto.code, dto.name, dto.type, dto.amount, dto.percentage, dto.status, dto.is_statutory, id],
    );

    this.logger.log(`Global deduction ${id} updated by user ${userId}`);
    return updated;
  }

  async removeGlobalDeduction(id: string, userId: string) {
    const existing = await this.databaseService.queryOne('SELECT id FROM deductions WHERE id = $1', [id]);

    if (!existing) {
      throw new NotFoundException(`Deduction with ID ${id} not found`);
    }

    await this.databaseService.query(
      `UPDATE deductions SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    this.logger.log(`Global deduction ${id} deactivated by user ${userId}`);
    return { message: 'Deduction deactivated successfully' };
  }

  // ==================== STAFF-SPECIFIC DEDUCTIONS ====================

  async createStaffDeduction(dto: any, userId: string, userRole?: string) {
    const deductionCode = dto.deduction_code || dto.deductionCode;
    const deductionName = dto.deduction_name || dto.deductionName;

    // Determine initial status based on role
    let initialStatus = 'active';
    if (userRole === 'payroll_loader') {
      initialStatus = 'pending';
    }

    // 1. Check if deduction exists
    let deduction = await this.databaseService.queryOne(
      'SELECT * FROM deductions WHERE code = $1',
      [deductionCode],
    );

    // 2. If not, create global deduction
    if (!deduction) {
      try {
        deduction = await this.createGlobalDeduction({
          code: deductionCode,
          name: deductionName,
          type: dto.type || 'fixed',
          appliesToAll: false, // Default to false for ad-hoc creations
        }, userId);
      } catch (error) {
        // If race condition or error, try fetching again
         deduction = await this.databaseService.queryOne(
          'SELECT * FROM deductions WHERE code = $1',
          [deductionCode],
        );
        if (!deduction) throw new BadRequestException(`Failed to create or find deduction with code ${deductionCode}. Detailed error: ${error.message}`);
      }
    }

    // 3. Create staff deduction linked to (potentially new) global deduction
    const staffDeduction = await this.databaseService.queryOne(
      `INSERT INTO staff_deductions (
        staff_id, deduction_id, amount, percentage,
        effective_from, effective_to, frequency, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dto.staff_id || dto.staffId,
        deduction.id, // Use the ID we resolved
        dto.amount || null,
        dto.percentage || null,
        (dto.effective_from || dto.startMonth) ? `${(dto.effective_from || dto.startMonth).substring(0, 7)}-01` : null,
        (dto.effective_to || dto.endMonth) ? `${(dto.effective_to || dto.endMonth).substring(0, 7)}-01` : null,
        dto.frequency || 'monthly',
        initialStatus,
        userId,
      ],
    );

    this.logger.log(`Staff deduction created for staff ${dto.staffId} by user ${userId} with status ${initialStatus}`);
    return staffDeduction;
  }

  async findStaffDeductions(staffId: string, query: any) {
    const { status } = query;

    let whereClause = 'WHERE staff_id = $1';
    const params = [staffId];

    if (status) {
      whereClause += ' AND status = $2';
      params.push(status);
    }

    const data = await this.databaseService.query(
      `SELECT sd.*, 
              d.name as deduction_name, 
              d.code as deduction_code, 
              d.type
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
              d.name as deduction_name, 
              d.code as deduction_code,
              d.type
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

    // Handle potential deduction code/name change (Upsert logic)
    let deductionId = existing.deduction_id;
    const newCode = dto.deduction_code || dto.deductionCode;
    const newName = dto.deduction_name || dto.deductionName;

    if (newCode) {
       let deduction = await this.databaseService.queryOne(
        'SELECT * FROM deductions WHERE code = $1',
        [newCode],
      );

      if (!deduction && newName) {
        deduction = await this.createGlobalDeduction({
          code: newCode,
          name: newName,
          type: dto.type || 'fixed',
          appliesToAll: false,
        }, userId);
      }

      if (deduction) {
        deductionId = deduction.id;
      }
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE staff_deductions
       SET deduction_id = $1,
           amount = COALESCE($2, amount),
           percentage = COALESCE($3, percentage),
           effective_to = COALESCE($4, effective_to),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        deductionId,
        dto.amount,
        dto.percentage,
        (dto.effective_to || dto.endMonth) ? `${(dto.effective_to || dto.endMonth).substring(0, 7)}-01` : null,
        dto.status,
        id
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
      `UPDATE staff_deductions SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    this.logger.log(`Staff deduction ${id} deactivated by user ${userId}`);
    return { message: 'Staff deduction deactivated successfully' };
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
