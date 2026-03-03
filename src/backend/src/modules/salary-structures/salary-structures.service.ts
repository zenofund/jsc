import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { StaffService } from '@modules/staff/staff.service';

@Injectable()
export class SalaryStructuresService {
  private readonly logger = new Logger(SalaryStructuresService.name);

  constructor(
    private databaseService: DatabaseService,
    @Inject(forwardRef(() => StaffService))
    private staffService: StaffService,
  ) {}

  // ==================== SALARY STRUCTURES ====================

  async create(dto: any, userId: string) {
    // Auto-generate code if not provided
    const code = dto.code || dto.name.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Check if code already exists
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM salary_structures WHERE code = $1',
      [code],
    );

    if (existing) {
      throw new BadRequestException(`Salary structure with code ${code} already exists`);
    }

    const structure = await this.databaseService.queryOne(
      `INSERT INTO salary_structures (
        name, code, effective_date, description, grade_levels, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING *`,
      [
        dto.name,
        code,
        dto.effective_date || new Date(),
        dto.description || null,
        JSON.stringify(dto.grade_levels || []),
        userId,
      ],
    );

    this.logger.log(`Salary structure ${code} created by user ${userId}`);
    
    // Sync salaries if this new structure is active
    if (structure.status === 'active') {
      // Run in background to avoid blocking the response
      this.staffService.syncSalariesWithActiveStructure().catch(err => 
        this.logger.error(`Background salary sync failed: ${err.message}`)
      );
    }

    return structure;
  }

  async findAll(query: any) {
    const { page = 1, limit = 100, status } = query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM salary_structures ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    const dataQuery = `
      SELECT * FROM salary_structures
      ${whereClause}
      ORDER BY effective_date DESC, name
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

  async findOne(id: string) {
    const structure = await this.databaseService.queryOne(
      'SELECT * FROM salary_structures WHERE id = $1',
      [id],
    );

    if (!structure) {
      throw new NotFoundException(`Salary structure with ID ${id} not found`);
    }

    return structure;
  }

  async findByCode(code: string) {
    const structure = await this.databaseService.queryOne(
      'SELECT * FROM salary_structures WHERE code = $1',
      [code],
    );

    if (!structure) {
      throw new NotFoundException(`Salary structure with code ${code} not found`);
    }

    return structure;
  }

  async update(id: string, dto: any, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM salary_structures WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException(`Salary structure with ID ${id} not found`);
    }

    // Check if code is being changed and already exists
    if (dto.code) {
      const codeExists = await this.databaseService.queryOne(
        'SELECT id FROM salary_structures WHERE code = $1 AND id != $2',
        [dto.code, id],
      );

      if (codeExists) {
        throw new BadRequestException(`Salary structure with code ${dto.code} already exists`);
      }
    }

    const updated = await this.databaseService.queryOne(
      `UPDATE salary_structures
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           effective_date = COALESCE($3, effective_date),
           description = COALESCE($4, description),
           grade_levels = COALESCE($5, grade_levels),
           status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        dto.name,
        dto.code,
        dto.effective_date,
        dto.description,
        dto.grade_levels ? JSON.stringify(dto.grade_levels) : null,
        dto.status,
        id,
      ],
    );

    this.logger.log(`Salary structure ${id} updated by user ${userId}`);
    
    // Sync salaries if the updated structure is active
    if (updated.status === 'active') {
      // Run in background to avoid blocking the response
      this.staffService.syncSalariesWithActiveStructure().catch(err => 
        this.logger.error(`Background salary sync failed: ${err.message}`)
      );
    }
    
    return updated;
  }

  async remove(id: string, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM salary_structures WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException(`Salary structure with ID ${id} not found`);
    }

    // Soft delete - set status to inactive
    const deleted = await this.databaseService.queryOne(
      `UPDATE salary_structures
       SET status = 'inactive',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    this.logger.log(`Salary structure ${id} deactivated by user ${userId}`);
    return deleted;
  }

  async hardDelete(id: string, userId: string) {
    const existing = await this.databaseService.queryOne(
      'SELECT id FROM salary_structures WHERE id = $1',
      [id],
    );

    if (!existing) {
      throw new NotFoundException(`Salary structure with ID ${id} not found`);
    }

    // Hard delete from database
    await this.databaseService.query('DELETE FROM salary_structures WHERE id = $1', [id]);

    this.logger.log(`Salary structure ${id} permanently deleted by user ${userId}`);
    return { message: 'Salary structure permanently deleted' };
  }

  async getActiveStructure() {
    const structure = await this.databaseService.queryOne(
      `SELECT * FROM salary_structures 
       WHERE status = 'active' 
       ORDER BY effective_date DESC 
       LIMIT 1`,
      [],
    );

    if (!structure) {
      throw new NotFoundException('No active salary structure found');
    }

    return structure;
  }

  async getSalaryForGradeAndStep(structureId: string, gradeLevel: number, step: number) {
    const structure = await this.findOne(structureId);

    // Parse the grade_levels JSONB
    const gradeLevels = structure.grade_levels;
    
    if (!Array.isArray(gradeLevels)) {
      throw new BadRequestException('Invalid salary structure format');
    }

    // Find the grade level
    const grade = gradeLevels.find((g: any) => g.level === gradeLevel);
    
    if (!grade) {
      throw new NotFoundException(`Grade level ${gradeLevel} not found in structure`);
    }

    // Find the step
    const stepData = grade.steps?.find((s: any) => s.step === step);
    
    if (!stepData) {
      throw new NotFoundException(`Step ${step} not found in grade level ${gradeLevel}`);
    }

    return {
      gradeLevel,
      step,
      basicSalary: stepData.basic_salary,
      structureName: structure.name,
      structureCode: structure.code,
    };
  }
}
