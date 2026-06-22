import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  ExecuteReportDto,
  ScheduleReportDto,
  ShareReportDto,
  ReportConfigDto,
  ReportFilterDto,
  ReportJoinDto,
  PreviewReportDto,
  FilterOperator,
  DataSource,
  ExportFormat,
} from './dto/report.dto';
import { REPORT_DATA_SOURCES } from './report-data-sources.config';

type RelationshipEdge = NonNullable<DataSource['relationshipGraph']>[number];
type JoinPlanStep = {
  edge: RelationshipEdge;
  joinType: string;
  sourceRef: string;
  targetRef: string;
  targetTable: string;
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly allowedJoinTypes = new Set(['INNER', 'LEFT', 'RIGHT']);
  private readonly allowedSortDirections = new Set(['ASC', 'DESC']);
  private readonly maxReportLimit = 1000;
  private readonly defaultResultPageSize = 25;
  private readonly maxResultPageSize = 100;
  private readonly defaultTemplatePageSize = 24;
  private readonly maxTemplatePageSize = 100;
  private readonly defaultHistoryPageSize = 20;
  private readonly maxHistoryPageSize = 100;
  private readonly maxAsyncExportRows = 10000;
  private readonly executionTimeoutMs = 15000;
  private readonly exportDirectory = join(process.cwd(), 'storage', 'report-exports');
  private readonly validTablePattern = /^[a-z0-9_]+$/i;
  private readonly validFieldPattern = /^[a-z0-9_]+$/i;
  private readonly validAliasPattern = /^[a-z0-9 _-]+$/i;
  private isTemplateNameUniqueViolation(error: any): boolean {
    const code = String(error?.code || '');
    const constraint = String(error?.constraint || '');
    const message = String(error?.message || '');
    return (
      code === '23505' &&
      (constraint.toLowerCase().includes('unique_template_name') ||
        message.toLowerCase().includes('unique_template_name') ||
        message.toLowerCase().includes('report_templates') ||
        message.toLowerCase().includes('duplicate key value'))
    );
  }
  private readonly dataSources: DataSource[] = REPORT_DATA_SOURCES;
  private readonly relationshipGraph: RelationshipEdge[] = this.buildRelationshipGraph();

  constructor(private databaseService: DatabaseService) {}

  // ==================== STANDARD REPORTS ====================

  /**
   * Get Staff Report
   */
  async getStaffReport(filters: { department?: string; status?: string }) {
    const params: any[] = [];
    let whereClause = '';

    if (filters.department) {
      params.push(filters.department);
      whereClause += ` AND d.name = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      whereClause += ` AND s.status = $${params.length}`;
    }

    const query = `
      SELECT
        s.staff_number,
        s.first_name,
        s.last_name,
        s.status,
        d.name as department,
        s.grade_level,
        s.step,
        s.current_basic_salary as basic_salary
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1 ${whereClause}
      ORDER BY s.grade_level DESC NULLS LAST, s.step DESC NULLS LAST, s.staff_number ASC
    `;

    const staff = await this.databaseService.query(query, params);

    // Calculate aggregates
    const by_department: Record<string, number> = {};
    const by_grade: Record<string, number> = {};

    staff.forEach((s: any) => {
      const dept = s.department || 'Unassigned';
      const grade = `GL ${s.grade_level || '?'}`;
      
      by_department[dept] = (by_department[dept] || 0) + 1;
      by_grade[grade] = (by_grade[grade] || 0) + 1;
    });

    // Format for frontend
    return {
      total: staff.length,
      by_department,
      by_grade,
      staff: staff.map((s: any) => ({
        staff_number: s.staff_number,
        status: s.status,
        bio_data: { first_name: s.first_name, last_name: s.last_name },
        appointment: { department: s.department },
        salary_info: {
          grade_level: s.grade_level,
          step: s.step,
          basic_salary: parseFloat(s.basic_salary)
        }
      }))
    };
  }

  /**
   * Get Payroll Report
   */
  async getPayrollReport(month: string) {
    try {
      this.logger.log(`Generating payroll report for month: ${month}`);
      
      const batch = await this.databaseService.queryOne(
        `SELECT * FROM payroll_batches WHERE payroll_month = $1 LIMIT 1`,
        [month]
      );

      if (!batch) {
        this.logger.warn(`No payroll batch found for month: ${month}`);
        return null;
      }

      this.logger.log(`Found batch ${batch.id} for month ${month}`);

      const lines = await this.databaseService.query(
        `SELECT pl.*, s.staff_number, s.first_name, s.middle_name, s.last_name
         FROM payroll_lines pl
         JOIN staff s ON pl.staff_id = s.id
         WHERE pl.payroll_batch_id = $1`,
        [batch.id]
      );

      this.logger.log(`Found ${lines.length} payroll lines for batch ${batch.id}`);

      return {
        summary: {
          total_staff: batch.total_staff,
          total_basic: parseFloat(batch.total_gross) * 0.7, // Approximation
          total_gross: parseFloat(batch.total_gross),
          total_deductions: parseFloat(batch.total_gross) - parseFloat(batch.total_net),
          total_net: parseFloat(batch.total_net),
        },
        lines: lines.map((l: any) => {
          const basicSalary = parseFloat(l.basic_salary || '0');
          const grossPay = parseFloat(l.gross_pay || '0');
          return {
            staff_number: l.staff_number,
            staff_name: [l.first_name, l.middle_name, l.last_name].filter(Boolean).join(' ').trim(),
            basic_salary: basicSalary,
            total_allowances: grossPay - basicSalary,
            gross_pay: grossPay,
            total_deductions: parseFloat(l.total_deductions || '0'),
            net_pay: parseFloat(l.net_pay || '0')
          };
        })
      };
    } catch (error) {
      this.logger.error(`Error generating payroll report for ${month}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPayrollBankSchedule(month: string) {
    const batch = await this.databaseService.queryOne(
      `SELECT * FROM payroll_batches WHERE payroll_month = $1 LIMIT 1`,
      [month],
    );

    if (!batch) {
      return null;
    }

    const rawLines = await this.databaseService.query(
      `SELECT 
        pl.bank_name,
        pl.account_number,
        pl.net_pay,
        s.staff_number,
        s.first_name,
        s.middle_name,
        s.last_name
      FROM payroll_lines pl
      JOIN staff s ON pl.staff_id = s.id
      WHERE pl.payroll_batch_id = $1
      ORDER BY pl.bank_name NULLS LAST, s.staff_number ASC`,
      [batch.id],
    );

    const lines = (rawLines || []).map((l: any) => {
      const bankName = String(l.bank_name || '').trim() || 'Unknown Bank';
      const accountNumber = String(l.account_number || '').trim() || '';
      const amount = typeof l.net_pay === 'number' ? l.net_pay : parseFloat(l.net_pay || '0');
      return {
        bank_name: bankName,
        staff_number: l.staff_number,
        staff_name: [l.first_name, l.middle_name, l.last_name].filter(Boolean).join(' ').trim(),
        account_number: accountNumber,
        net_pay: Number.isFinite(amount) ? amount : 0,
        has_bank_details: Boolean(bankName && accountNumber),
      };
    });

    const bankMap = new Map<string, any>();
    for (const line of lines) {
      const key = line.bank_name;
      if (!bankMap.has(key)) {
        bankMap.set(key, {
          bank_name: key,
          total_staff: 0,
          total_amount: 0,
          lines: [],
        });
      }
      const entry = bankMap.get(key);
      entry.total_staff += 1;
      entry.total_amount += line.net_pay;
      entry.lines.push(line);
    }

    const banks = Array.from(bankMap.values()).sort((a, b) =>
      String(a.bank_name).localeCompare(String(b.bank_name), undefined, { sensitivity: 'base' }),
    );

    const totals = {
      total_banks: banks.length,
      total_staff: lines.length,
      total_amount: banks.reduce((sum, b) => sum + (b.total_amount || 0), 0),
      missing_bank_details: lines.filter((l) => !l.account_number || l.bank_name === 'Unknown Bank').length,
    };

    return {
      month,
      batch: {
        id: batch.id,
        batch_number: batch.batch_number,
        payroll_month: batch.payroll_month,
        status: batch.status,
      },
      totals,
      banks,
    };
  }

  /**
   * Get Variance Report
   */
  async getVarianceReport(month1: string, month2: string) {
    const batch1 = await this.databaseService.queryOne(
      `SELECT * FROM payroll_batches WHERE payroll_month = $1 LIMIT 1`,
      [month1]
    );
    const batch2 = await this.databaseService.queryOne(
      `SELECT * FROM payroll_batches WHERE payroll_month = $1 LIMIT 1`,
      [month2]
    );

    const data1 = batch1 || { total_staff: 0, total_net: 0 };
    const data2 = batch2 || { total_staff: 0, total_net: 0 };

    const net1 = parseFloat(data1.total_net || 0);
    const net2 = parseFloat(data2.total_net || 0);
    const diff = net2 - net1;
    const pct = net1 === 0 ? (net2 === 0 ? 0 : 100) : (diff / net1) * 100;

    return {
      month1: {
        month: month1,
        total_staff: data1.total_staff || 0,
        total_net: net1
      },
      month2: {
        month: month2,
        total_staff: data2.total_staff || 0,
        total_net: net2
      },
      variance: {
        staff_change: (data2.total_staff || 0) - (data1.total_staff || 0),
        amount_change: diff,
        percentage_change: pct
      }
    };
  }

  /**
   * Get Remittance Report
   */
  async getRemittanceReport(month: string, type: string) {
    const batch = await this.databaseService.queryOne(
      `SELECT * FROM payroll_batches WHERE payroll_month = $1 LIMIT 1`,
      [month]
    );

    if (!batch) return null;

    const lines = await this.databaseService.query(
      `SELECT pl.deductions, s.staff_number, s.first_name, s.last_name
       FROM payroll_lines pl
       JOIN staff s ON pl.staff_id = s.id
       WHERE pl.payroll_batch_id = $1`,
      [batch.id]
    );

    const remittances = lines.map((l: any) => {
      const deds = l.deductions || [];
      const relevant = deds.filter((d: any) => 
        d.name.toLowerCase().includes(type.toLowerCase()) || 
        (type === 'tax' && (d.is_statutory || d.name.toLowerCase().includes('paye'))) ||
        (type === 'pension' && d.name.toLowerCase().includes('pension')) ||
        (type === 'cooperative' && (d.name.toLowerCase().includes('coop') || d.name.toLowerCase().includes('contribution') || d.type === 'cooperative'))
      );
      
      const amount = relevant.reduce((sum: number, d: any) => sum + parseFloat(d.amount), 0);
      
      return {
        staff_number: l.staff_number,
        staff_name: `${l.first_name} ${l.last_name}`,
        amount
      };
    }).filter((r: any) => r.amount > 0);

    const total = remittances.reduce((sum: number, r: any) => sum + r.amount, 0);

    return {
      total_staff: remittances.length,
      total_amount: total,
      remittances
    };
  }

  // ==================== DATA SOURCES (Available Tables & Fields) ====================

  /**
   * Get all available data sources for report building
   */
  async getDataSources(): Promise<DataSource[]> {
    return this.dataSources.map((source) => ({
      ...source,
      relationships: this.getLegacyRelationships(source.table),
      relationshipGraph: this.getOutgoingEdges(source.table),
    }));
  }

  // ==================== REPORT TEMPLATES ====================

  /**
   * Create a new report template
   */
  async createTemplate(dto: CreateReportTemplateDto, userId: string) {
    try {
      // Validate configuration
      this.validateReportConfig(dto.config);

      const template = await this.databaseService.queryOne(
        `INSERT INTO report_templates (
          name, description, category, config, is_public, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
        RETURNING *`,
        [
          dto.name,
          dto.description || null,
          dto.category,
          JSON.stringify(dto.config),
          dto.isPublic ?? false,
          userId,
        ],
      );

      this.logger.log(`Report template "${dto.name}" created by user ${userId}`);
      return template;
    } catch (error) {
      if (this.isTemplateNameUniqueViolation(error)) {
        throw new ConflictException('A report template with this name already exists. Please use a different name.');
      }
      this.logger.error(`Error creating template: ${error.message}`);
      throw new BadRequestException(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Get all report templates (user's own + public + shared)
   */
  async findAllTemplates(userId: string, category?: string, page: number = 1, pageSize: number = this.defaultTemplatePageSize) {
    const userRole = await this.getUserRole(userId);
    const { page: safePage, pageSize: safePageSize, offset } = this.normalizePagination(
      page,
      pageSize,
      this.defaultTemplatePageSize,
      this.maxTemplatePageSize,
    );
    const params: any[] = [userId, userRole];
    const whereConditions = [`rt.status = 'active'`];

    if (category) {
      whereConditions.push(`rt.category = $${params.length + 1}`);
      params.push(category);
    }

    const baseFromWhere = `
      FROM report_templates rt
      LEFT JOIN users u ON rt.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT rs.*
        FROM report_shares rs
        WHERE rs.template_id = rt.id
          AND (rs.shared_with_user_id = $1 OR rs.shared_with_role = $2)
          AND (rs.expires_at IS NULL OR rs.expires_at > NOW())
        ORDER BY CASE WHEN rs.shared_with_user_id = $1 THEN 0 ELSE 1 END, rs.created_at DESC
        LIMIT 1
      ) rs ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int as execution_count,
          COUNT(*) FILTER (WHERE re.status = 'failed')::int as failed_execution_count,
          MAX(re.executed_at) as last_executed_at,
          ROUND(AVG(re.execution_time_ms))::int as average_execution_time_ms
        FROM report_executions re
        WHERE re.template_id = rt.id
      ) metrics ON true
      WHERE ${whereConditions.join(' AND ')}
        AND (rt.created_by = $1 OR rt.is_public = true OR (rs.id IS NOT NULL AND rs.can_view = true))
    `;

    const totalQuery = `
      SELECT COUNT(*)::int as total
      FROM (
        SELECT DISTINCT rt.id
        ${baseFromWhere}
      ) template_ids
    `;

    const query = `
      SELECT
        rt.*,
        u.full_name as created_by_name,
        CASE 
          WHEN rt.created_by = $1 THEN 'owner'
          WHEN rs.id IS NOT NULL THEN 'shared'
          WHEN rt.is_public = true THEN 'public'
        END as access_type,
        EXISTS(SELECT 1 FROM report_favorites WHERE template_id = rt.id AND user_id = $1) as is_favorite,
        CASE
          WHEN rt.created_by = $1 THEN true
          WHEN rt.is_public = true THEN true
          ELSE COALESCE(rs.can_view, false)
        END as can_view,
        CASE
          WHEN rt.created_by = $1 THEN true
          ELSE COALESCE(rs.can_edit, false)
        END as can_edit,
        CASE
          WHEN rt.created_by = $1 THEN true
          WHEN rt.is_public = true THEN true
          ELSE COALESCE(rs.can_execute, false)
        END as can_execute,
        CASE
          WHEN rt.created_by = $1 THEN true
          ELSE COALESCE(rs.can_schedule, false)
        END as can_schedule,
        COALESCE(metrics.execution_count, 0) as execution_count,
        COALESCE(metrics.failed_execution_count, 0) as failed_execution_count,
        metrics.last_executed_at,
        COALESCE(metrics.average_execution_time_ms, 0) as average_execution_time_ms
      ${baseFromWhere}
      ORDER BY rt.created_at DESC, rt.id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    try {
      const totalResult = await this.databaseService.queryOne(totalQuery, params);
      const data = await this.databaseService.query(query, [...params, safePageSize, offset]);
      const total = Number(totalResult?.total || 0);
      return {
        data,
        meta: {
          total,
          page: safePage,
          pageSize: safePageSize,
          totalPages: Math.max(Math.ceil(total / safePageSize), 1),
          hasNextPage: offset + safePageSize < total,
        },
      };
    } catch (error) {
      this.logger.error(`Error finding templates: ${error.message}`);
      return {
        data: [],
        meta: {
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          totalPages: 1,
          hasNextPage: false,
        },
      };
    }
  }

  /**
   * Get single report template
   */
  async findOneTemplate(id: string, userId: string) {
    const template = await this.getAccessibleTemplate(id, userId);

    if (!template) {
      throw new NotFoundException('Report template not found or access denied');
    }

    return template;
  }

  /**
   * Update report template
   */
  async updateTemplate(id: string, dto: UpdateReportTemplateDto, userId: string) {
    const template = await this.findOneTemplate(id, userId);

    if (template.created_by !== userId && !template.can_edit) {
      throw new BadRequestException('You do not have permission to edit this report');
    }

    if (dto.config) {
      this.validateReportConfig(dto.config);
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (dto.name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(dto.description);
    }
    if (dto.category) {
      updates.push(`category = $${paramIndex++}`);
      params.push(dto.category);
    }
    if (dto.config) {
      updates.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(dto.config));
    }
    if (dto.isPublic !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      params.push(dto.isPublic);
    }
    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(dto.status);
    }

    updates.push(`updated_by = $${paramIndex++}`, `updated_at = NOW()`);
    params.push(userId);
    params.push(id);

    try {
      const updated = await this.databaseService.queryOne(
        `UPDATE report_templates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params,
      );

      this.logger.log(`Report template ${id} updated by user ${userId}`);
      return updated;
    } catch (error) {
      if (this.isTemplateNameUniqueViolation(error)) {
        throw new ConflictException('A report template with this name already exists. Please use a different name.');
      }
      this.logger.error(`Error updating template: ${error.message}`);
      throw new BadRequestException(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Delete report template
   */
  async deleteTemplate(id: string, userId: string) {
    const template = await this.findOneTemplate(id, userId);

    if (template.created_by !== userId) {
      throw new BadRequestException('Only the owner can delete this report');
    }

    await this.databaseService.query('DELETE FROM report_templates WHERE id = $1', [id]);

    this.logger.log(`Report template ${id} deleted by user ${userId}`);
    return { message: 'Report template deleted successfully' };
  }

  // ==================== REPORT EXECUTION ====================

  /**
   * Execute report and return data
   */
  async executeReport(dto: ExecuteReportDto, userId: string) {
    const template = await this.findOneTemplate(dto.templateId, userId);

    if (!template.can_execute && template.created_by !== userId) {
      throw new BadRequestException('You do not have permission to execute this report');
    }

    const config = typeof template.config === 'string'
      ? JSON.parse(template.config) 
      : template.config;

    if (dto.runtimeFilters && dto.runtimeFilters.length > 0) {
      config.filters = [...(config.filters || []), ...dto.runtimeFilters];
    }

    const { page, pageSize, offset } = this.normalizePagination(
      dto.page,
      dto.pageSize,
      this.defaultResultPageSize,
      this.maxResultPageSize,
    );

    if ((dto.exportFormat || ExportFormat.JSON) !== ExportFormat.JSON) {
      const execution = await this.recordExecutionStart(dto.templateId, userId, dto.exportFormat || ExportFormat.CSV);
      void this.processAsyncExport({
        executionId: execution.id,
        templateId: dto.templateId,
        templateName: template.name,
        templateCategory: template.category,
        requestedBy: userId,
        exportFormat: dto.exportFormat || ExportFormat.CSV,
        config,
      });

      return {
        template: {
          id: template.id,
          name: template.name,
          category: template.category,
        },
        data: [],
        meta: {
          totalRows: 0,
          returnedRows: 0,
          executionTimeMs: 0,
          executedAt: new Date().toISOString(),
          executedBy: userId,
          page,
          pageSize,
          totalPages: 0,
          hasNextPage: false,
          executionId: execution.id,
          executionStatus: 'running',
          async: true,
        },
      };
    }

    return this.executeReportConfig({
      config,
      templateId: dto.templateId,
      templateName: template.name,
      templateCategory: template.category,
      userId,
      exportFormat: ExportFormat.JSON,
      page,
      pageSize,
      offset,
      persistExecution: true,
    });
  }

  async previewReport(dto: PreviewReportDto, userId: string) {
    const { page, pageSize, offset } = this.normalizePagination(
      dto.page,
      dto.pageSize,
      this.defaultResultPageSize,
      this.maxResultPageSize,
    );

    return this.executeReportConfig({
      config: dto.config,
      templateId: 'preview',
      templateName: dto.name || 'Preview Report',
      templateCategory: dto.category || 'custom',
      userId,
      exportFormat: ExportFormat.JSON,
      page,
      pageSize,
      offset,
      persistExecution: false,
    });
  }

  private async executeReportConfig(options: {
    config: ReportConfigDto;
    templateId: string;
    templateName: string;
    templateCategory: string;
    userId: string;
    exportFormat: ExportFormat;
    page: number;
    pageSize: number;
    offset: number;
    persistExecution: boolean;
    executionId?: string;
  }) {
    const startTime = Date.now();
    const config = this.applyPaginationToConfig(options.config, options.pageSize, options.offset);
    this.validateReportConfig(config);

    const countQuery = this.buildCountQuery(config);
    const sql = this.buildSQLQuery(config);
    this.logger.log(
      `Executing report config for ${options.templateName} (${options.templateId}) page ${options.page} size ${options.pageSize}`,
    );

    let executionId = options.executionId;
    if (options.persistExecution && !executionId) {
      const execution = await this.recordExecutionStart(options.templateId, options.userId, options.exportFormat);
      executionId = execution.id;
    }

    try {
      const totalResult = await this.withTimeout(
        this.databaseService.queryOne(countQuery.query, countQuery.params),
        this.executionTimeoutMs,
        'Report execution timed out while counting rows.',
      );
      const totalRows = Number(totalResult?.total || 0);

      const data = await this.withTimeout(
        this.databaseService.query(sql.query, sql.params),
        this.executionTimeoutMs,
        'Report execution timed out while fetching rows.',
      );
      const executionTime = Date.now() - startTime;

      if (executionId) {
        await this.recordExecutionCompletion(executionId, {
          totalRows,
          executionTimeMs: executionTime,
        });
      }

      this.logger.log(
        `Report ${options.templateId} completed with ${totalRows} rows in ${executionTime}ms`,
      );

      return {
        template: {
          id: options.templateId,
          name: options.templateName,
          category: options.templateCategory,
        },
        data,
        meta: {
          totalRows,
          returnedRows: data.length,
          executionTimeMs: executionTime,
          executedAt: new Date().toISOString(),
          executedBy: options.userId,
          page: options.page,
          pageSize: options.pageSize,
          totalPages: Math.max(Math.ceil(totalRows / options.pageSize), 1),
          hasNextPage: options.offset + options.pageSize < totalRows,
          executionId,
          executionStatus: executionId ? 'completed' : 'preview',
          async: false,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error';
      if (executionId) {
        await this.recordExecutionFailure(executionId, message, Date.now() - startTime);
      }
      this.logger.error(`Report execution failed for template ${options.templateId}: ${message}`);
      throw new BadRequestException(
        message.includes('timed out')
          ? message
          : 'Report execution failed. Please review the selected fields, joins, and filters.',
      );
    }
  }

  private buildCountQuery(config: ReportConfigDto) {
    const countConfig: ReportConfigDto = {
      ...config,
      limit: undefined,
      offset: undefined,
    };
    const baseQuery = this.buildSQLQuery(countConfig);
    return {
      query: `SELECT COUNT(*)::int as total FROM (${baseQuery.query}) report_rows`,
      params: baseQuery.params,
    };
  }

  private normalizePagination(
    page?: number,
    pageSize?: number,
    defaultPageSize: number = this.defaultResultPageSize,
    maxPageSize: number = this.maxResultPageSize,
  ) {
    const safePage = Number.isInteger(page) && Number(page) > 0 ? Number(page) : 1;
    const parsedPageSize = Number.isInteger(pageSize) && Number(pageSize) > 0 ? Number(pageSize) : defaultPageSize;
    const safePageSize = Math.min(parsedPageSize, maxPageSize);
    return {
      page: safePage,
      pageSize: safePageSize,
      offset: (safePage - 1) * safePageSize,
    };
  }

  private applyPaginationToConfig(config: ReportConfigDto, limit: number, offset: number): ReportConfigDto {
    return {
      ...config,
      fields: [...config.fields],
      filters: config.filters ? [...config.filters] : undefined,
      joins: config.joins ? [...config.joins] : undefined,
      groupBy: config.groupBy ? [...config.groupBy] : undefined,
      orderBy: config.orderBy ? [...config.orderBy] : undefined,
      limit,
      offset,
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async recordExecutionStart(templateId: string, userId: string, exportFormat: ExportFormat) {
    return this.databaseService.queryOne(
      `INSERT INTO report_executions (
        template_id, execution_type, status, export_format, executed_by
      ) VALUES ($1, 'manual', 'running', $2, $3)
      RETURNING *`,
      [templateId, exportFormat, userId],
    );
  }

  private async recordExecutionCompletion(
    executionId: string,
    updates: { totalRows: number; executionTimeMs: number; filePath?: string },
  ) {
    return this.databaseService.query(
      `UPDATE report_executions
       SET status = 'completed',
           total_rows = $2,
           execution_time_ms = $3,
           file_path = COALESCE($4, file_path),
           completed_at = NOW()
       WHERE id = $1`,
      [executionId, updates.totalRows, updates.executionTimeMs, updates.filePath || null],
    );
  }

  private async recordExecutionFailure(executionId: string, errorMessage: string, executionTimeMs?: number) {
    return this.databaseService.query(
      `UPDATE report_executions
       SET status = 'failed',
           error_message = $2,
           execution_time_ms = COALESCE($3, execution_time_ms),
           completed_at = NOW()
       WHERE id = $1`,
      [executionId, errorMessage.slice(0, 2000), executionTimeMs || null],
    );
  }

  private async processAsyncExport(options: {
    executionId: string;
    templateId: string;
    templateName: string;
    templateCategory: string;
    requestedBy: string;
    exportFormat: ExportFormat;
    config: ReportConfigDto;
  }) {
    const startedAt = Date.now();
    try {
      this.validateReportConfig(options.config);
      const countQuery = this.buildCountQuery(options.config);
      const totalResult = await this.withTimeout(
        this.databaseService.queryOne(countQuery.query, countQuery.params),
        this.executionTimeoutMs,
        'Export preparation timed out while counting rows.',
      );
      const totalRows = Number(totalResult?.total || 0);

      if (totalRows > this.maxAsyncExportRows) {
        throw new Error(`Export exceeds the maximum async row limit of ${this.maxAsyncExportRows}.`);
      }

      const exportConfig = {
        ...options.config,
        limit: totalRows || this.maxAsyncExportRows,
        offset: 0,
      };
      const sql = this.buildSQLQuery(exportConfig);
      const rows = await this.withTimeout(
        this.databaseService.query(sql.query, sql.params),
        this.executionTimeoutMs,
        'Export generation timed out while fetching rows.',
      );

      const { filePath } = await this.writeExportFile(
        options.executionId,
        options.templateName,
        options.exportFormat,
        rows,
      );

      await this.recordExecutionCompletion(options.executionId, {
        totalRows: rows.length,
        executionTimeMs: Date.now() - startedAt,
        filePath,
      });
      this.logger.log(`Async export ${options.executionId} completed for template ${options.templateId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error';
      await this.recordExecutionFailure(options.executionId, message, Date.now() - startedAt);
      this.logger.error(`Async export ${options.executionId} failed: ${message}`);
    }
  }

  private async writeExportFile(
    executionId: string,
    templateName: string,
    exportFormat: ExportFormat,
    rows: Record<string, any>[],
  ) {
    await fs.mkdir(this.exportDirectory, { recursive: true });
    const extension =
      exportFormat === ExportFormat.PDF ? 'pdf' : exportFormat === ExportFormat.EXCEL ? 'xls' : 'csv';
    const safeName = templateName.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
    const filePath = join(this.exportDirectory, `${safeName}-${executionId}.${extension}`);

    let content = '';
    if (exportFormat === ExportFormat.PDF) {
      content = this.generateSimplePdf(rows, templateName);
      await fs.writeFile(filePath, Buffer.from(content, 'binary'));
    } else if (exportFormat === ExportFormat.EXCEL) {
      content = this.generateExcelHtml(rows, templateName);
      await fs.writeFile(filePath, content, 'utf8');
    } else {
      content = this.generateCsv(rows);
      await fs.writeFile(filePath, content, 'utf8');
    }

    return { filePath };
  }

  private generateCsv(rows: Record<string, any>[]) {
    if (rows.length === 0) {
      return '';
    }
    const headers = Object.keys(rows[0]);
    const escapeCell = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(','))].join(
      '\n',
    );
  }

  private generateExcelHtml(rows: Record<string, any>[], title: string) {
    if (rows.length === 0) {
      return `<html><body><h1>${title}</h1><p>No data available.</p></body></html>`;
    }
    const headers = Object.keys(rows[0]);
    const headerRow = headers.map((header) => `<th>${header}</th>`).join('');
    const bodyRows = rows
      .map(
        (row) =>
          `<tr>${headers
            .map((header) => `<td>${String(row[header] ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>`)
            .join('')}</tr>`,
      )
      .join('');
    return `<html><body><h1>${title}</h1><table border="1"><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  }

  private generateSimplePdf(rows: Record<string, any>[], title: string) {
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const lines = [title, '', headers.join(' | '), ...rows.map((row) => headers.map((header) => String(row[header] ?? '')).join(' | '))];
    const escapedLines = lines.map((line) => line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
    const textCommands = escapedLines
      .slice(0, 40)
      .map((line, index) => `BT /F1 10 Tf 50 ${780 - index * 16} Td (${line.slice(0, 110)}) Tj ET`)
      .join('\n');
    const stream = `${textCommands}\n`;
    const objects = [
      `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
      `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
      `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
      `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
      `5 0 obj << /Length ${stream.length} >> stream\n${stream}endstream endobj`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((object) => {
      offsets.push(pdf.length);
      pdf += `${object}\n`;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return pdf;
  }


  /**
   * Build SQL query from report configuration
   */
  private buildSQLQuery(config: ReportConfigDto): { query: string; params: any[] } {
    const params: any[] = [];
    let paramIndex = 1;
    const baseTable = config.fields[0].table;
    const tablesUsed = this.getTablesUsed(config);
    const { fromClause, tableRefs } = this.resolveJoinPlan(baseTable, tablesUsed, config.joins || []);

    // Build SELECT clause
    const selectFields = config.fields
      .filter(f => f.visible !== false)
      .map(f => {
        const fieldRef = this.buildFieldReference(tableRefs, f.table, f.field);
        if (f.aggregate) {
          return `${f.aggregate}(${fieldRef}) AS "${f.alias || f.field}"`;
        }
        return `${fieldRef} AS "${f.alias || f.field}"`;
      })
      .join(', ');

    // Build WHERE clause
    let whereClause = '';
    if (config.filters && config.filters.length > 0) {
      const conditions = config.filters.map(f => {
        const fieldRef = this.buildFieldReference(tableRefs, f.table, f.field);
        
        switch (f.operator) {
          case FilterOperator.IS_NULL:
            return `${fieldRef} IS NULL`;
          case FilterOperator.IS_NOT_NULL:
            return `${fieldRef} IS NOT NULL`;
          case FilterOperator.IN: {
            const inPlaceholders = f.values!.map(() => `$${paramIndex++}`).join(', ');
            params.push(...f.values!);
            return `${fieldRef} IN (${inPlaceholders})`;
          }
          case FilterOperator.NOT_IN: {
            const notInPlaceholders = f.values!.map(() => `$${paramIndex++}`).join(', ');
            params.push(...f.values!);
            return `${fieldRef} NOT IN (${notInPlaceholders})`;
          }
          case FilterOperator.BETWEEN: {
            const startPlaceholder = `$${paramIndex++}`;
            const endPlaceholder = `$${paramIndex++}`;
            params.push(f.values![0], f.values![1]);
            return `${fieldRef} BETWEEN ${startPlaceholder} AND ${endPlaceholder}`;
          }
          case FilterOperator.LIKE:
            params.push(`%${f.value}%`);
            return `${fieldRef} ILIKE $${paramIndex++}`;
          default:
            params.push(f.value);
            return `${fieldRef} ${f.operator} $${paramIndex++}`;
        }
      });
      
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    // Build GROUP BY clause
    let groupByClause = '';
    if (config.groupBy && config.groupBy.length > 0) {
      const groupFields = config.groupBy
        .map(g => this.buildFieldReference(tableRefs, g.table, g.field))
        .join(', ');
      groupByClause = `GROUP BY ${groupFields}`;
    }

    // Build ORDER BY clause
    let orderByClause = '';
    if (config.orderBy && config.orderBy.length > 0) {
      const orderFields = config.orderBy
        .map(o => `${this.buildFieldReference(tableRefs, o.table, o.field)} ${String(o.direction).toUpperCase()}`)
        .join(', ');
      orderByClause = `ORDER BY ${orderFields}`;
    }

    // Build LIMIT/OFFSET clause
    let limitClause = '';
    if (config.limit !== undefined) {
      limitClause = `LIMIT $${paramIndex++}`;
      params.push(config.limit);
      if (config.offset !== undefined) {
        limitClause += ` OFFSET $${paramIndex++}`;
        params.push(config.offset);
      }
    }

    // Combine all clauses
    const query = `
      SELECT ${selectFields}
      FROM ${fromClause}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      ${limitClause}
    `.trim();

    return { query, params };
  }

  /**
   * Validate report configuration
   */
  private validateReportConfig(config: ReportConfigDto) {
    if (!config) {
      throw new BadRequestException('Report configuration is required');
    }

    if (!config.fields || config.fields.length === 0) {
      throw new BadRequestException('Report must have at least one field');
    }

    const baseTable = config.fields[0].table;
    this.assertKnownTable(baseTable);

    const visibleFields = config.fields.filter((field) => field.visible !== false);
    if (visibleFields.length === 0) {
      throw new BadRequestException('Report must have at least one visible field');
    }
    const tablesUsed = this.getTablesUsed(config);

    for (const field of config.fields) {
      this.assertReportField(field.table, field.field, 'field selection');
      if (field.aggregate && !this.getDataSourceField(field.table, field.field)?.isAggregatable) {
        throw new BadRequestException(`Field ${field.table}.${field.field} cannot be aggregated`);
      }
      if (field.alias && !this.validAliasPattern.test(field.alias)) {
        throw new BadRequestException(`Invalid alias for ${field.table}.${field.field}`);
      }
    }

    for (const filter of config.filters || []) {
      this.assertReportField(filter.table, filter.field, 'filter');
      if (!this.getDataSourceField(filter.table, filter.field)?.isFilterable) {
        throw new BadRequestException(`Field ${filter.table}.${filter.field} cannot be filtered`);
      }
      this.validateFilter(filter);
    }

    for (const groupBy of config.groupBy || []) {
      this.assertReportField(groupBy.table, groupBy.field, 'group by');
    }

    for (const orderBy of config.orderBy || []) {
      this.assertReportField(orderBy.table, orderBy.field, 'order by');
      if (!this.allowedSortDirections.has(String(orderBy.direction || '').toUpperCase())) {
        throw new BadRequestException(`Invalid sort direction for ${orderBy.table}.${orderBy.field}`);
      }
    }

    if (config.limit !== undefined) {
      if (!Number.isInteger(config.limit) || config.limit < 1 || config.limit > this.maxReportLimit) {
        throw new BadRequestException(`Limit must be an integer between 1 and ${this.maxReportLimit}`);
      }
    }

    if (config.offset !== undefined) {
      if (!Number.isInteger(config.offset) || config.offset < 0) {
        throw new BadRequestException('Offset must be a non-negative integer');
      }
    }

    const joinedTables = Array.from(tablesUsed).filter((table) => table !== baseTable);
    if (config.joins && config.joins.length > 0) {
      const configuredJoinTables = new Set<string>();
      for (const join of config.joins) {
        this.assertKnownTable(join.table);
        const normalizedJoinType = String(join.type || '').toUpperCase();
        if (!this.allowedJoinTypes.has(normalizedJoinType)) {
          throw new BadRequestException(`Invalid join type for ${join.table}`);
        }
        if (join.alias && !this.validAliasPattern.test(join.alias)) {
          throw new BadRequestException(`Invalid join alias for ${join.table}`);
        }
        const joinSource = join.fromTable || baseTable;
        this.assertKnownTable(joinSource);
        if (join.onField || join.joinField) {
          if (!join.onField || !join.joinField) {
            throw new BadRequestException(`Join ${joinSource} -> ${join.table} must provide both onField and joinField when using legacy direct join config`);
          }
          if (!this.validFieldPattern.test(join.onField) || !this.validFieldPattern.test(join.joinField)) {
            throw new BadRequestException(`Invalid join fields for ${join.table}`);
          }
          const directEdge = this.getDirectEdge(joinSource, join.table);
          if (!directEdge || directEdge.localKey !== join.onField || directEdge.remoteKey !== join.joinField) {
            throw new BadRequestException(`Join from ${joinSource} to ${join.table} is not allowed`);
          }
        } else if (join.fromTable && !this.getDirectEdge(joinSource, join.table)) {
          throw new BadRequestException(`Join from ${joinSource} to ${join.table} is not allowed`);
        } else if (!join.fromTable && !this.findRelationshipPath(baseTable, join.table)) {
          throw new BadRequestException(`Join path from ${baseTable} to ${join.table} is not allowed`);
        }
        configuredJoinTables.add(join.table);
      }

      const missingJoinTables = joinedTables.filter((table) => !configuredJoinTables.has(table));
      if (missingJoinTables.length > 0) {
        const unresolved = missingJoinTables.filter((table) => !this.findRelationshipPath(baseTable, table));
        if (unresolved.length > 0) {
          throw new BadRequestException(`Missing join configuration for: ${unresolved.join(', ')}`);
        }
      }
    } else {
      const missingJoinTables = joinedTables.filter((table) => !this.findRelationshipPath(baseTable, table));
      if (missingJoinTables.length > 0) {
        throw new BadRequestException(`Missing join configuration for: ${missingJoinTables.join(', ')}`);
      }
    }

    const hasAggregate = visibleFields.some((field) => Boolean(field.aggregate));
    if (hasAggregate) {
      const groupBySet = new Set((config.groupBy || []).map((group) => `${group.table}.${group.field}`));
      const ungroupedFields = visibleFields
        .filter((field) => !field.aggregate)
        .filter((field) => !groupBySet.has(`${field.table}.${field.field}`))
        .map((field) => `${field.table}.${field.field}`);

      if (ungroupedFields.length > 0) {
        throw new BadRequestException(
          `Grouped reports must include all non-aggregated visible fields in groupBy: ${ungroupedFields.join(', ')}`,
        );
      }
    }

    return true;
  }

  // ==================== REPORT SCHEDULES ====================

  /**
   * Schedule a report
   */
  async scheduleReport(dto: ScheduleReportDto, userId: string) {
    const template = await this.findOneTemplate(dto.templateId, userId);

    if (!template.can_schedule && template.created_by !== userId) {
      throw new BadRequestException('You do not have permission to schedule this report');
    }

    const schedule = await this.databaseService.queryOne(
      `INSERT INTO report_schedules (
        template_id, schedule_type, cron_expression, time_of_day,
        day_of_week, day_of_month, recipients, export_format, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dto.templateId,
        dto.scheduleType,
        dto.cronExpression || null,
        dto.timeOfDay || null,
        dto.dayOfWeek || null,
        dto.dayOfMonth || null,
        JSON.stringify(dto.recipients || []),
        dto.exportFormat || 'pdf',
        userId,
      ],
    );

    this.logger.log(`Report schedule created for template ${dto.templateId}`);
    return schedule;
  }

  /**
   * Get all schedules for a template
   */
  async getReportSchedules(templateId: string, userId: string) {
    await this.findOneTemplate(templateId, userId); // Check access

    return this.databaseService.query(
      `SELECT * FROM report_schedules WHERE template_id = $1 ORDER BY created_at DESC`,
      [templateId],
    );
  }

  // ==================== REPORT SHARING ====================

  /**
   * Share a report with user or role
   */
  async shareReport(dto: ShareReportDto, userId: string) {
    const template = await this.findOneTemplate(dto.templateId, userId);

    if (template.created_by !== userId) {
      throw new BadRequestException('Only the owner can share this report');
    }

    if (!dto.sharedWithUserId && !dto.sharedWithRole) {
      throw new BadRequestException('Must specify either userId or role to share with');
    }

    if ((dto.canView ?? true) === false && ((dto.canEdit ?? false) || (dto.canExecute ?? false) || (dto.canSchedule ?? false))) {
      throw new BadRequestException('Reports cannot grant edit, execute, or schedule permission without view access');
    }

    const share = await this.databaseService.queryOne(
      `INSERT INTO report_shares (
        template_id, shared_with_user_id, shared_with_role,
        can_view, can_edit, can_execute, can_schedule,
        shared_by, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (template_id, shared_with_user_id) 
      DO UPDATE SET
        can_view = EXCLUDED.can_view,
        can_edit = EXCLUDED.can_edit,
        can_execute = EXCLUDED.can_execute,
        can_schedule = EXCLUDED.can_schedule
      RETURNING *`,
      [
        dto.templateId,
        dto.sharedWithUserId || null,
        dto.sharedWithRole || null,
        dto.canView ?? true,
        dto.canEdit ?? false,
        dto.canExecute ?? true,
        dto.canSchedule ?? false,
        userId,
        dto.expiresAt || null,
      ],
    );

    this.logger.log(`Report ${dto.templateId} shared by user ${userId}`);
    return share;
  }

  // ==================== FAVORITES ====================

  /**
   * Add report to favorites
   */
  async addToFavorites(templateId: string, userId: string) {
    await this.findOneTemplate(templateId, userId); // Check access

    await this.databaseService.queryOne(
      `INSERT INTO report_favorites (template_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (template_id, user_id) DO NOTHING`,
      [templateId, userId],
    );

    return { message: 'Report added to favorites' };
  }

  /**
   * Remove report from favorites
   */
  async removeFromFavorites(templateId: string, userId: string) {
    await this.databaseService.query(
      `DELETE FROM report_favorites WHERE template_id = $1 AND user_id = $2`,
      [templateId, userId],
    );

    return { message: 'Report removed from favorites' };
  }

  /**
   * Get user's favorite reports
   */
  async getFavorites(userId: string) {
    try {
      const userRole = await this.getUserRole(userId);
      return await this.databaseService.query(
        `SELECT rt.*, u.full_name as created_by_name
         FROM report_favorites rf
         JOIN report_templates rt ON rf.template_id = rt.id
         LEFT JOIN users u ON rt.created_by = u.id
         LEFT JOIN LATERAL (
           SELECT rs.*
           FROM report_shares rs
           WHERE rs.template_id = rt.id
             AND (rs.shared_with_user_id = $1 OR rs.shared_with_role = $2)
             AND (rs.expires_at IS NULL OR rs.expires_at > NOW())
           ORDER BY CASE WHEN rs.shared_with_user_id = $1 THEN 0 ELSE 1 END, rs.created_at DESC
           LIMIT 1
         ) rs ON true
         WHERE rf.user_id = $1
           AND rt.status = 'active'
           AND (rt.created_by = $1 OR rt.is_public = true OR (rs.id IS NOT NULL AND rs.can_view = true))
         ORDER BY rf.created_at DESC`,
        [userId, userRole],
      );
    } catch (error) {
      this.logger.error(`Error finding favorites: ${error.message}`);
      return []; // Return empty array on error
    }
  }

  // ==================== REPORT EXECUTION HISTORY ====================

  /**
   * Get execution history for a template
   */
  async getExecutionHistory(templateId: string, userId: string, page: number = 1, pageSize: number = this.defaultHistoryPageSize) {
    await this.findOneTemplate(templateId, userId); // Check access
    const { page: safePage, pageSize: safePageSize, offset } = this.normalizePagination(
      page,
      pageSize,
      this.defaultHistoryPageSize,
      this.maxHistoryPageSize,
    );

    const totalResult = await this.databaseService.queryOne(
      `SELECT COUNT(*)::int as total
       FROM report_executions
       WHERE template_id = $1`,
      [templateId],
    );

    const data = await this.databaseService.query(
      `SELECT 
        re.*,
        u.full_name as executed_by_name
       FROM report_executions re
       LEFT JOIN users u ON re.executed_by = u.id
       WHERE re.template_id = $1
       ORDER BY re.executed_at DESC
       LIMIT $2
       OFFSET $3`,
      [templateId, safePageSize, offset],
    );

    const total = Number(totalResult?.total || 0);
    return {
      data,
      meta: {
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages: Math.max(Math.ceil(total / safePageSize), 1),
        hasNextPage: offset + safePageSize < total,
      },
    };
  }

  async getExecutionById(executionId: string, userId: string) {
    const execution = await this.databaseService.queryOne(
      `SELECT re.*, rt.name as template_name, rt.category as template_category
       FROM report_executions re
       LEFT JOIN report_templates rt ON re.template_id = rt.id
       WHERE re.id = $1`,
      [executionId],
    );

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    if (execution.template_id) {
      await this.findOneTemplate(execution.template_id, userId);
    } else if (execution.executed_by !== userId) {
      throw new BadRequestException('You do not have permission to access this execution');
    }

    return execution;
  }

  private getDataSourceMap() {
    return new Map(this.dataSources.map((source) => [source.table, source]));
  }

  private getTablesUsed(config: ReportConfigDto) {
    return new Set<string>([
      ...config.fields.map((field) => field.table),
      ...(config.filters || []).map((filter) => filter.table),
      ...(config.groupBy || []).map((group) => group.table),
      ...(config.orderBy || []).map((order) => order.table),
    ]);
  }

  private buildRelationshipGraph(): RelationshipEdge[] {
    const relationships: RelationshipEdge[] = [];
    const addEdge = (
      sourceTable: string,
      targetTable: string,
      localKey: string,
      remoteKey: string,
      label: string,
      joinTypes: string[] = ['LEFT', 'INNER'],
      defaultJoinType = 'LEFT',
    ) => {
      relationships.push({
        sourceTable,
        targetTable,
        localKey,
        remoteKey,
        joinTypes,
        defaultJoinType,
        label,
      });
    };

    addEdge('staff', 'departments', 'department_id', 'id', 'Staff Department');
    addEdge('departments', 'staff', 'id', 'department_id', 'Department Staff');
    addEdge('users', 'staff', 'staff_id', 'id', 'User Staff');
    addEdge('staff', 'users', 'id', 'staff_id', 'Staff User');

    addEdge('payroll_lines', 'payroll_batches', 'payroll_batch_id', 'id', 'Payroll Line Batch');
    addEdge('payroll_batches', 'payroll_lines', 'id', 'payroll_batch_id', 'Payroll Batch Lines');
    addEdge('payroll_lines', 'staff', 'staff_id', 'id', 'Payroll Line Staff');
    addEdge('staff', 'payroll_lines', 'id', 'staff_id', 'Staff Payroll Lines');

    addEdge('loan_applications', 'staff', 'staff_id', 'id', 'Loan Applicant');
    addEdge('staff', 'loan_applications', 'id', 'staff_id', 'Staff Loan Applications');
    addEdge('loan_applications', 'loan_types', 'loan_type_id', 'id', 'Application Loan Type');
    addEdge('loan_types', 'loan_applications', 'id', 'loan_type_id', 'Loan Type Applications');
    addEdge('loan_types', 'cooperatives', 'cooperative_id', 'id', 'Loan Type Cooperative');
    addEdge('cooperatives', 'loan_types', 'id', 'cooperative_id', 'Cooperative Loan Types');

    addEdge('loan_disbursements', 'loan_applications', 'loan_application_id', 'id', 'Disbursement Application');
    addEdge('loan_applications', 'loan_disbursements', 'id', 'loan_application_id', 'Application Disbursements');
    addEdge('loan_disbursements', 'staff', 'staff_id', 'id', 'Disbursement Staff');
    addEdge('staff', 'loan_disbursements', 'id', 'staff_id', 'Staff Disbursements');
    addEdge('loan_disbursements', 'payroll_batches', 'payroll_batch_id', 'id', 'Disbursement Payroll Batch');
    addEdge('payroll_batches', 'loan_disbursements', 'id', 'payroll_batch_id', 'Payroll Batch Disbursements');
    addEdge('loan_disbursements', 'users', 'disbursed_by', 'id', 'Disbursed By User');
    addEdge('users', 'loan_disbursements', 'id', 'disbursed_by', 'User Loan Disbursements');

    addEdge('loan_repayments', 'loan_disbursements', 'disbursement_id', 'id', 'Repayment Disbursement');
    addEdge('loan_disbursements', 'loan_repayments', 'id', 'disbursement_id', 'Disbursement Repayments');
    addEdge('loan_repayments', 'staff', 'staff_id', 'id', 'Repayment Staff');
    addEdge('staff', 'loan_repayments', 'id', 'staff_id', 'Staff Loan Repayments');
    addEdge('loan_repayments', 'payroll_batches', 'payroll_batch_id', 'id', 'Repayment Payroll Batch');
    addEdge('payroll_batches', 'loan_repayments', 'id', 'payroll_batch_id', 'Payroll Batch Loan Repayments');
    addEdge('loan_repayments', 'users', 'recorded_by', 'id', 'Recorded By User');
    addEdge('users', 'loan_repayments', 'id', 'recorded_by', 'User Loan Repayments');

    addEdge('leave_requests', 'staff', 'staff_id', 'id', 'Leave Request Staff');
    addEdge('staff', 'leave_requests', 'id', 'staff_id', 'Staff Leave Requests');
    addEdge('leave_requests', 'leave_types', 'leave_type_id', 'id', 'Leave Request Type');
    addEdge('leave_types', 'leave_requests', 'id', 'leave_type_id', 'Leave Type Requests');

    addEdge('cooperative_members', 'cooperatives', 'cooperative_id', 'id', 'Member Cooperative');
    addEdge('cooperatives', 'cooperative_members', 'id', 'cooperative_id', 'Cooperative Members');
    addEdge('cooperative_members', 'staff', 'staff_id', 'id', 'Member Staff');
    addEdge('staff', 'cooperative_members', 'id', 'staff_id', 'Staff Cooperative Memberships');

    addEdge('cooperative_contributions', 'cooperatives', 'cooperative_id', 'id', 'Contribution Cooperative');
    addEdge('cooperatives', 'cooperative_contributions', 'id', 'cooperative_id', 'Cooperative Contributions');
    addEdge('cooperative_contributions', 'cooperative_members', 'member_id', 'id', 'Contribution Member');
    addEdge('cooperative_members', 'cooperative_contributions', 'id', 'member_id', 'Member Contributions');
    addEdge('cooperative_contributions', 'payroll_batches', 'payroll_batch_id', 'id', 'Contribution Payroll Batch');
    addEdge('payroll_batches', 'cooperative_contributions', 'id', 'payroll_batch_id', 'Payroll Batch Contributions');

    addEdge('audit_trail', 'users', 'user_id', 'id', 'Audit User');
    addEdge('users', 'audit_trail', 'id', 'user_id', 'User Audit Entries');

    return relationships;
  }

  private getOutgoingEdges(table: string) {
    return this.relationshipGraph.filter((edge) => edge.sourceTable === table);
  }

  private getLegacyRelationships(table: string) {
    return this.getOutgoingEdges(table).map((edge) => ({
      table: edge.targetTable,
      field: edge.localKey,
      foreignKey: edge.remoteKey,
      label: edge.label,
      joinTypes: edge.joinTypes,
    }));
  }

  private assertKnownTable(table: string) {
    if (!table || !this.validTablePattern.test(table)) {
      throw new BadRequestException(`Invalid table name: ${table}`);
    }

    if (!this.getDataSourceMap().has(table)) {
      throw new BadRequestException(`Unknown table: ${table}`);
    }
  }

  private getDataSourceField(table: string, field: string) {
    this.assertKnownTable(table);

    if (!field || !this.validFieldPattern.test(field)) {
      throw new BadRequestException(`Invalid field name: ${field}`);
    }

    return this.getDataSourceMap().get(table)?.fields.find((sourceField) => sourceField.field === field);
  }

  private assertReportField(table: string, field: string, usage: string) {
    if (!this.getDataSourceField(table, field)) {
      throw new BadRequestException(`Unknown field ${table}.${field} used in ${usage}`);
    }
  }

  private getDirectEdge(sourceTable: string, targetTable: string) {
    return this.relationshipGraph.find(
      (edge) => edge.sourceTable === sourceTable && edge.targetTable === targetTable,
    );
  }

  private findRelationshipPath(sourceTable: string, targetTable: string) {
    if (sourceTable === targetTable) {
      return [] as RelationshipEdge[];
    }

    const queue: Array<{ table: string; path: RelationshipEdge[] }> = [{ table: sourceTable, path: [] }];
    const visited = new Set<string>([sourceTable]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of this.getOutgoingEdges(current.table)) {
        if (visited.has(edge.targetTable)) {
          continue;
        }
        const nextPath = [...current.path, edge];
        if (edge.targetTable === targetTable) {
          return nextPath;
        }
        visited.add(edge.targetTable);
        queue.push({ table: edge.targetTable, path: nextPath });
      }
    }

    return null;
  }

  private resolveJoinPlan(baseTable: string, tablesUsed: Set<string>, joins: ReportJoinDto[]) {
    const primaryTableRefs = new Map<string, string>([[baseTable, 't0']]);
    const joinSteps: JoinPlanStep[] = [];
    const requestedJoins = new Map<string, ReportJoinDto>();
    joins.forEach((join) => {
      if (!requestedJoins.has(join.table)) {
        requestedJoins.set(join.table, join);
      }
    });

    let aliasCounter = 1;
    const getOrCreatePrimaryRef = (table: string) => {
      if (!primaryTableRefs.has(table)) {
        primaryTableRefs.set(table, `t${aliasCounter++}`);
      }
      return primaryTableRefs.get(table)!;
    };
    const stepBySignature = new Map<string, JoinPlanStep>();
    const requiredTables = Array.from(new Set([
      ...Array.from(tablesUsed).filter((table) => table !== baseTable),
      ...requestedJoins.keys(),
    ]));

    for (const targetTable of requiredTables) {
      const explicitJoin = requestedJoins.get(targetTable);
      const path = this.resolvePathForTable(baseTable, targetTable, explicitJoin);

      path.forEach((edge, index) => {
        const sourceRef = getOrCreatePrimaryRef(edge.sourceTable);
        const isFinalEdge = index === path.length - 1;
        const requestedJoinType = explicitJoin ? String(explicitJoin.type || '').toUpperCase() : '';
        const joinType = isFinalEdge && this.allowedJoinTypes.has(requestedJoinType)
          ? requestedJoinType
          : edge.defaultJoinType;
        const signature = `${sourceRef}:${edge.sourceTable}.${edge.localKey}->${edge.targetTable}.${edge.remoteKey}`;
        const existingStep = stepBySignature.get(signature);

        if (existingStep) {
          if (existingStep.joinType !== 'LEFT' && joinType === 'LEFT') {
            existingStep.joinType = 'LEFT';
          }
          return;
        }

        const targetRef = getOrCreatePrimaryRef(edge.targetTable);
        const step: JoinPlanStep = {
          edge,
          joinType,
          sourceRef,
          targetRef,
          targetTable: edge.targetTable,
        };
        joinSteps.push(step);
        stepBySignature.set(signature, step);
      });
    }

    const fromClause = [
      `${baseTable} ${primaryTableRefs.get(baseTable)}`,
      ...joinSteps.map(
        (step) =>
          `${step.joinType} JOIN ${step.targetTable} ${step.targetRef} ON ${step.sourceRef}.${step.edge.localKey} = ${step.targetRef}.${step.edge.remoteKey}`,
      ),
    ].join(' ');

    return { fromClause, tableRefs: primaryTableRefs };
  }

  private resolvePathForTable(baseTable: string, targetTable: string, explicitJoin?: ReportJoinDto) {
    if (targetTable === baseTable) {
      return [] as RelationshipEdge[];
    }

    if (explicitJoin?.fromTable) {
      const prefixPath =
        explicitJoin.fromTable === baseTable ? [] : this.findRelationshipPath(baseTable, explicitJoin.fromTable);
      const directEdge = this.getDirectEdge(explicitJoin.fromTable, targetTable);
      if (!directEdge || !prefixPath) {
        throw new BadRequestException(`Join path from ${baseTable} to ${targetTable} is not allowed`);
      }
      return [...prefixPath, directEdge];
    }

    if (explicitJoin?.onField && explicitJoin.joinField) {
      const directEdge = this.getDirectEdge(baseTable, targetTable);
      if (
        !directEdge ||
        directEdge.localKey !== explicitJoin.onField ||
        directEdge.remoteKey !== explicitJoin.joinField
      ) {
        throw new BadRequestException(`Join path from ${baseTable} to ${targetTable} is not allowed`);
      }
      return [directEdge];
    }

    const inferredPath = this.findRelationshipPath(baseTable, targetTable);
    if (!inferredPath) {
      throw new BadRequestException(`Join path from ${baseTable} to ${targetTable} is not allowed`);
    }
    return inferredPath;
  }

  private buildFieldReference(tableRefs: Map<string, string>, table: string, field: string) {
    const tableRef = tableRefs.get(table);
    if (!tableRef) {
      throw new BadRequestException(`Missing table reference for ${table}.${field}`);
    }
    return `${tableRef}.${field}`;
  }

  private validateFilter(filter: ReportFilterDto) {
    switch (filter.operator) {
      case FilterOperator.IS_NULL:
      case FilterOperator.IS_NOT_NULL:
        return;
      case FilterOperator.IN:
      case FilterOperator.NOT_IN:
        if (!Array.isArray(filter.values) || filter.values.length === 0) {
          throw new BadRequestException(`Filter ${filter.table}.${filter.field} requires one or more values`);
        }
        return;
      case FilterOperator.BETWEEN:
        if (!Array.isArray(filter.values) || filter.values.length !== 2) {
          throw new BadRequestException(`Filter ${filter.table}.${filter.field} requires exactly two values for BETWEEN`);
        }
        return;
      default:
        if (filter.value === undefined || filter.value === null || filter.value === '') {
          throw new BadRequestException(`Filter ${filter.table}.${filter.field} requires a value`);
        }
    }
  }

  private async getUserRole(userId: string) {
    const user = await this.databaseService.queryOne(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (!user?.role) {
      throw new NotFoundException('User context not found');
    }
    return user.role;
  }

  private async getAccessibleTemplate(id: string, userId: string) {
    const userRole = await this.getUserRole(userId);

    return this.databaseService.queryOne(
      `SELECT
        rt.*,
        u.full_name as created_by_name,
        CASE
          WHEN rt.created_by = $2 THEN 'owner'
          WHEN rs.id IS NOT NULL THEN 'shared'
          WHEN rt.is_public = true THEN 'public'
        END as access_type,
        CASE
          WHEN rt.created_by = $2 THEN true
          WHEN rt.is_public = true THEN true
          ELSE COALESCE(rs.can_view, false)
        END as can_view,
        CASE
          WHEN rt.created_by = $2 THEN true
          ELSE COALESCE(rs.can_edit, false)
        END as can_edit,
        CASE
          WHEN rt.created_by = $2 THEN true
          WHEN rt.is_public = true THEN true
          ELSE COALESCE(rs.can_execute, false)
        END as can_execute,
        CASE
          WHEN rt.created_by = $2 THEN true
          ELSE COALESCE(rs.can_schedule, false)
        END as can_schedule
      FROM report_templates rt
      LEFT JOIN users u ON rt.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT rs.*
        FROM report_shares rs
        WHERE rs.template_id = rt.id
          AND (rs.shared_with_user_id = $2 OR rs.shared_with_role = $3)
          AND (rs.expires_at IS NULL OR rs.expires_at > NOW())
        ORDER BY CASE WHEN rs.shared_with_user_id = $2 THEN 0 ELSE 1 END, rs.created_at DESC
        LIMIT 1
      ) rs ON true
      WHERE rt.id = $1
        AND rt.status = 'active'
        AND (rt.created_by = $2 OR rt.is_public = true OR (rs.id IS NOT NULL AND rs.can_view = true))`,
      [id, userId, userRole],
    );
  }
}
