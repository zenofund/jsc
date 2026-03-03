import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class AllowancesService {
  private readonly logger = new Logger(AllowancesService.name);

  constructor(private databaseService: DatabaseService) {}

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
        code, name, type, amount, percentage, is_taxable, is_pensionable, applies_to_all, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
      RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.type,
        dto.amount || null,
        dto.percentage || null,
        dto.is_taxable ?? dto.isTaxable ?? true,
        dto.is_pensionable ?? false,
        dto.appliesToAll ?? true,
        userId,
      ],
    );

    this.logger.log(`Global allowance ${dto.code} created by user ${userId}`);
    return allowance;
  }

  async findAllGlobalAllowances(query: any) {
    const { page = 1, limit = 20, status } = query;
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
           amount = COALESCE($4, amount),
           percentage = COALESCE($5, percentage),
           is_taxable = COALESCE($6, is_taxable),
           is_pensionable = COALESCE($7, is_pensionable),
           status = COALESCE($8, status),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.type,
        dto.amount,
        dto.percentage,
        dto.is_taxable ?? dto.isTaxable,
        dto.is_pensionable,
        dto.status,
        id,
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

    await this.databaseService.query(
      `UPDATE allowances SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    this.logger.log(`Global allowance ${id} deactivated by user ${userId}`);
    return { message: 'Allowance deactivated successfully' };
  }

  // ==================== STAFF-SPECIFIC ALLOWANCES ====================

  async createStaffAllowance(dto: any, userId: string, userRole?: string) {
    const allowanceCode = dto.allowance_code || dto.allowanceCode;
    const allowanceName = dto.allowance_name || dto.allowanceName;

    // Determine initial status based on role
    // Payroll Loaders require approval (pending status)
    // Admins and Managers are auto-approved (active status)
    let initialStatus = 'active';
    if (userRole === 'payroll_loader') {
      initialStatus = 'pending';
    }

    // 1. Check if allowance exists
    let allowance = await this.databaseService.queryOne(
      'SELECT * FROM allowances WHERE code = $1',
      [allowanceCode],
    );

    // 2. If not, create global allowance
    if (!allowance) {
      try {
        allowance = await this.createGlobalAllowance({
          code: allowanceCode,
          name: allowanceName,
          type: dto.type || 'fixed',
          isTaxable: dto.is_taxable ?? true,
          appliesToAll: false, // Default to false for ad-hoc creations
        }, userId);
      } catch (error) {
        // If race condition or error, try fetching again
         allowance = await this.databaseService.queryOne(
          'SELECT * FROM allowances WHERE code = $1',
          [allowanceCode],
        );
        if (!allowance) throw new BadRequestException(`Failed to create or find allowance with code ${allowanceCode}. Detailed error: ${error.message}`);
      }
    }

    // 3. Create staff allowance linked to (potentially new) global allowance
    const staffAllowance = await this.databaseService.queryOne(
      `INSERT INTO staff_allowances (
        staff_id, allowance_id, amount, percentage,
        effective_from, effective_to, frequency, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dto.staff_id || dto.staffId,
        allowance.id, // Use the ID we resolved
        dto.amount || null,
        dto.percentage || null,
        (dto.effective_from || dto.startMonth) ? `${(dto.effective_from || dto.startMonth).substring(0, 7)}-01` : null,
        (dto.effective_to || dto.endMonth) ? `${(dto.effective_to || dto.endMonth).substring(0, 7)}-01` : null,
        dto.frequency || 'monthly',
        initialStatus,
        userId,
      ],
    );

    this.logger.log(`Staff allowance created for staff ${dto.staffId} by user ${userId} with status ${initialStatus}`);
    return staffAllowance;
  }

  async findStaffAllowances(staffId: string, query: any) {
    const { status } = query;

    let whereClause = 'WHERE staff_id = $1';
    const params = [staffId];

    if (status) {
      whereClause += ' AND status = $2';
      params.push(status);
    }

    const data = await this.databaseService.query(
      `SELECT sa.*, 
              a.name as allowance_name, 
              a.code as allowance_code, 
              a.type, 
              a.is_taxable, 
              a.is_pensionable
       FROM staff_allowances sa
       LEFT JOIN allowances a ON sa.allowance_id = a.id
       ${whereClause} 
       ORDER BY sa.created_at DESC`,
      params,
    );

    return data;
  }

  async findAllStaffAllowances(query: any) {
    const { page = 1, limit = 50, status } = query;
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
              a.name as allowance_name, 
              a.code as allowance_code,
              a.type
      FROM staff_allowances sa
      JOIN staff s ON sa.staff_id = s.id
      LEFT JOIN allowances a ON sa.allowance_id = a.id
      ${whereClause}
      ORDER BY sa.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const data = await this.databaseService.query(dataQuery, [...params, limit, offset]);

    return {
      data,
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

    // Handle potential allowance code/name change (Upsert logic)
    let allowanceId = existing.allowance_id;
    const newCode = dto.allowance_code || dto.allowanceCode;
    const newName = dto.allowance_name || dto.allowanceName;

    if (newCode) {
       let allowance = await this.databaseService.queryOne(
        'SELECT * FROM allowances WHERE code = $1',
        [newCode],
      );

      if (!allowance && newName) {
        allowance = await this.createGlobalAllowance({
          code: newCode,
          name: newName,
          type: dto.type || 'fixed',
          isTaxable: dto.is_taxable ?? true,
          appliesToAll: false,
        }, userId);
      }

      if (allowance) {
        allowanceId = allowance.id;
      }
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE staff_allowances
       SET allowance_id = $1,
           amount = COALESCE($2, amount),
           percentage = COALESCE($3, percentage),
           effective_to = COALESCE($4, effective_to),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        allowanceId,
        dto.amount,
        dto.percentage,
        (dto.effective_to || dto.endMonth) ? `${(dto.effective_to || dto.endMonth).substring(0, 7)}-01` : null,
        dto.status,
        id
      ],
    );

    this.logger.log(`Staff allowance ${id} updated by user ${userId}`);
    return updated;
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
      `UPDATE staff_allowances SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    this.logger.log(`Staff allowance ${id} deactivated by user ${userId}`);
    return { message: 'Staff allowance deactivated successfully' };
  }

  async bulkUpdateStaffAllowanceStatus(ids: string[], status: string, userId: string) {
    if (!ids.length) return { count: 0 };

    const result = await this.databaseService.query(
      `UPDATE staff_allowances 
       SET status = $1, updated_at = NOW() 
       WHERE id = ANY($2::uuid[])
       RETURNING id`,
      [status, ids],
    );

    this.logger.log(`${result.length} staff allowances updated to ${status} by user ${userId}`);
    return { count: result.length, ids: result.map(r => r.id) };
  }
}
