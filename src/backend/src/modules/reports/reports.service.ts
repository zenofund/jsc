import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  ExecuteReportDto,
  ScheduleReportDto,
  ShareReportDto,
  ReportConfigDto,
  ReportFilterDto,
  FilterOperator,
  DataSource,
  ExportFormat,
} from './dto/report.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly dataSources: DataSource[] = [
    {
      table: 'staff',
      label: 'Staff Members',
      fields: [
        { field: 'staff_number', type: 'string', label: 'Staff Number', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'first_name', type: 'string', label: 'First Name', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'last_name', type: 'string', label: 'Last Name', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'email', type: 'string', label: 'Email', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'designation', type: 'string', label: 'Designation', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'employment_type', type: 'string', label: 'Employment Type', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'current_basic_salary', type: 'number', label: 'Basic Salary', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'employment_date', type: 'date', label: 'Employment Date', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'status', type: 'string', label: 'Status', isSearchable: false, isFilterable: true, isAggregatable: false },
      ],
      relationships: [
        { table: 'departments', field: 'department_id', foreignKey: 'id' },
      ],
    },
    {
      table: 'departments',
      label: 'Departments',
      fields: [
        { field: 'code', type: 'string', label: 'Code', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'name', type: 'string', label: 'Name', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'description', type: 'string', label: 'Description', isSearchable: true, isFilterable: false, isAggregatable: false },
      ],
      relationships: [],
    },
    {
      table: 'payroll_batches',
      label: 'Payroll Batches',
      fields: [
        { field: 'batch_number', type: 'string', label: 'Batch Number', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'payroll_month', type: 'string', label: 'Payroll Month', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'status', type: 'string', label: 'Status', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'total_staff', type: 'number', label: 'Total Staff', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'total_gross', type: 'number', label: 'Total Gross Pay', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'total_deductions', type: 'number', label: 'Total Deductions', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'total_net', type: 'number', label: 'Total Net Pay', isSearchable: false, isFilterable: true, isAggregatable: true },
      ],
      relationships: [],
    },
    {
      table: 'payroll_lines',
      label: 'Payroll Details',
      fields: [
        { field: 'staff_number', type: 'string', label: 'Staff Number', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'staff_name', type: 'string', label: 'Staff Name', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'basic_salary', type: 'number', label: 'Basic Salary', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'gross_pay', type: 'number', label: 'Gross Pay', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'total_deductions', type: 'number', label: 'Total Deductions', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'net_pay', type: 'number', label: 'Net Pay', isSearchable: false, isFilterable: true, isAggregatable: true },
      ],
      relationships: [
        { table: 'payroll_batches', field: 'payroll_batch_id', foreignKey: 'id' },
        { table: 'staff', field: 'staff_id', foreignKey: 'id' },
      ],
    },
    {
      table: 'loan_applications',
      label: 'Loan Applications',
      fields: [
        { field: 'application_number', type: 'string', label: 'Application Number', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'amount_requested', type: 'number', label: 'Requested Amount', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'tenure_months', type: 'number', label: 'Tenure (Months)', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'status', type: 'string', label: 'Status', isSearchable: false, isFilterable: true, isAggregatable: false },
      ],
      relationships: [
        { table: 'staff', field: 'staff_id', foreignKey: 'id' },
        { table: 'loan_types', field: 'loan_type_id', foreignKey: 'id' },
      ],
    },
    {
      table: 'leave_requests',
      label: 'Leave Requests',
      fields: [
        { field: 'request_number', type: 'string', label: 'Request Number', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'start_date', type: 'date', label: 'Start Date', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'end_date', type: 'date', label: 'End Date', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'number_of_days', type: 'number', label: 'Number of Days', isSearchable: false, isFilterable: true, isAggregatable: true },
        { field: 'status', type: 'string', label: 'Status', isSearchable: false, isFilterable: true, isAggregatable: false },
      ],
      relationships: [
        { table: 'staff', field: 'staff_id', foreignKey: 'id' },
        { table: 'leave_types', field: 'leave_type_id', foreignKey: 'id' },
      ],
    },
    {
      table: 'cooperatives',
      label: 'Cooperatives',
      fields: [
        { field: 'code', type: 'string', label: 'Code', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'name', type: 'string', label: 'Name', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'type', type: 'string', label: 'Type', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'monthly_contribution', type: 'number', label: 'Monthly Contribution', isSearchable: false, isFilterable: true, isAggregatable: true },
      ],
      relationships: [],
    },
    {
      table: 'audit_trail',
      label: 'Audit Trail',
      fields: [
        { field: 'action', type: 'string', label: 'Action', isSearchable: false, isFilterable: true, isAggregatable: false },
        { field: 'entity', type: 'string', label: 'Entity', isSearchable: true, isFilterable: true, isAggregatable: false },
        { field: 'description', type: 'string', label: 'Description', isSearchable: true, isFilterable: false, isAggregatable: false },
        { field: 'created_at', type: 'date', label: 'Date/Time', isSearchable: false, isFilterable: true, isAggregatable: false },
      ],
      relationships: [
        { table: 'users', field: 'user_id', foreignKey: 'id' },
      ],
    },
  ];

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
      ORDER BY s.staff_number
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
        `SELECT pl.*, s.staff_number, s.first_name, s.last_name
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
            staff_name: `${l.first_name} ${l.last_name}`,
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
    return this.dataSources;
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
      this.logger.error(`Error creating template: ${error.message}`);
      throw new BadRequestException(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Get all report templates (user's own + public + shared)
   */
  async findAllTemplates(userId: string, category?: string) {
    const whereConditions = ['rt.status = $1'];
    const params: any[] = ['active'];
    let paramIndex = 2;

    if (category) {
      whereConditions.push(`rt.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Get templates: owned by user OR public OR shared with user
    const query = `
      SELECT DISTINCT ON (rt.id)
        rt.*,
        u.full_name as created_by_name,
        CASE 
          WHEN rt.created_by = $${paramIndex} THEN 'owner'
          WHEN rs.id IS NOT NULL THEN 'shared'
          WHEN rt.is_public = true THEN 'public'
        END as access_type,
        EXISTS(SELECT 1 FROM report_favorites WHERE template_id = rt.id AND user_id = $${paramIndex}) as is_favorite
      FROM report_templates rt
      LEFT JOIN users u ON rt.created_by = u.id
      LEFT JOIN report_shares rs ON rt.id = rs.template_id 
        AND (rs.shared_with_user_id = $${paramIndex} OR rs.shared_with_role = (SELECT role FROM users WHERE id = $${paramIndex}))
      WHERE ${whereConditions.join(' AND ')}
        AND (rt.created_by = $${paramIndex} OR rt.is_public = true OR rs.id IS NOT NULL)
      ORDER BY rt.id, rt.created_at DESC
    `;

    params.push(userId);

    try {
      return await this.databaseService.query(query, params);
    } catch (error) {
      this.logger.error(`Error finding templates: ${error.message}`);
      return []; // Return empty array on error instead of 500
    }
  }

  /**
   * Get single report template
   */
  async findOneTemplate(id: string, userId: string) {
    const template = await this.databaseService.queryOne(
      `SELECT 
        rt.*,
        u.full_name as created_by_name,
        CASE 
          WHEN rt.created_by = $2 THEN 'owner'
          WHEN rs.id IS NOT NULL THEN 'shared'
          WHEN rt.is_public = true THEN 'public'
        END as access_type,
        rs.can_edit,
        rs.can_execute,
        rs.can_schedule
      FROM report_templates rt
      LEFT JOIN users u ON rt.created_by = u.id
      LEFT JOIN report_shares rs ON rt.id = rs.template_id AND rs.shared_with_user_id = $2
      WHERE rt.id = $1 
        AND (rt.created_by = $2 OR rt.is_public = true OR rs.id IS NOT NULL)`,
      [id, userId],
    );

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

    const updated = await this.databaseService.queryOne(
      `UPDATE report_templates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    this.logger.log(`Report template ${id} updated by user ${userId}`);
    return updated;
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
    const startTime = Date.now();

    // Get template
    const template = await this.findOneTemplate(dto.templateId, userId);

    if (!template.can_execute && template.created_by !== userId) {
      throw new BadRequestException('You do not have permission to execute this report');
    }

    const config = typeof template.config === 'string' 
      ? JSON.parse(template.config) 
      : template.config;

    // Merge runtime filters
    if (dto.runtimeFilters && dto.runtimeFilters.length > 0) {
      config.filters = [...(config.filters || []), ...dto.runtimeFilters];
    }

    // Validate config before execution
    this.validateReportConfig(config);

    // Build and execute SQL query
    const sql = this.buildSQLQuery(config);
    this.logger.log(`Executing report: ${template.name}`);
    this.logger.debug(`Generated SQL: ${sql.query}`);

    let data, totalRows, error;

    try {
      data = await this.databaseService.query(sql.query, sql.params);
      totalRows = data.length;
    } catch (err) {
      error = err.message;
      this.logger.error(`Report execution failed: ${error}`);
      // Include query in error for debugging (remove in production)
      throw new BadRequestException(`Report execution failed: ${error}. Query: ${sql.query}`);
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    await this.databaseService.queryOne(
      `INSERT INTO report_executions (
        template_id, execution_type, status, total_rows, execution_time_ms,
        export_format, executed_by, completed_at
      ) VALUES ($1, 'manual', $2, $3, $4, $5, $6, NOW())
      RETURNING *`,
      [
        dto.templateId,
        error ? 'failed' : 'completed',
        totalRows,
        executionTime,
        dto.exportFormat || 'json',
        userId,
      ],
    );

    return {
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
      },
      data,
      meta: {
        totalRows,
        executionTimeMs: executionTime,
        executedAt: new Date().toISOString(),
        executedBy: userId,
      },
    };
  }


  /**
   * Build SQL query from report configuration
   */
  private buildSQLQuery(config: ReportConfigDto): { query: string; params: any[] } {
    const params: any[] = [];
    let paramIndex = 1;

    // Build SELECT clause
    const selectFields = config.fields
      .filter(f => f.visible !== false)
      .map(f => {
        const fieldRef = `${f.table}.${f.field}`;
        if (f.aggregate) {
          return `${f.aggregate}(${fieldRef}) AS "${f.alias || f.field}"`;
        }
        return `${fieldRef} AS "${f.alias || f.field}"`;
      })
      .join(', ');

    // Get base table (first table in fields)
    const baseTable = config.fields[0].table;

    // Build FROM clause
    let fromClause = baseTable;

    const relationshipsMap = new Map(
      this.dataSources.map(source => [source.table, source.relationships]),
    );
    const tablesUsed = new Set<string>([
      ...config.fields.map(f => f.table),
      ...(config.filters || []).map(f => f.table),
      ...(config.groupBy || []).map(g => g.table),
      ...(config.orderBy || []).map(o => o.table),
    ]);
    const inferredJoins = [];
    if (!config.joins || config.joins.length === 0) {
      const missingTables = [];
      for (const table of tablesUsed) {
        if (table === baseTable) continue;
        const baseRels = relationshipsMap.get(baseTable) || [];
        const targetRels = relationshipsMap.get(table) || [];
        const relFromBase = baseRels.find(r => r.table === table);
        const relFromTarget = targetRels.find(r => r.table === baseTable);
        if (relFromBase) {
          inferredJoins.push({
            table,
            type: 'LEFT',
            onField: relFromBase.field,
            joinField: relFromBase.foreignKey,
          });
          continue;
        }
        if (relFromTarget) {
          inferredJoins.push({
            table,
            type: 'LEFT',
            onField: relFromTarget.foreignKey,
            joinField: relFromTarget.field,
          });
          continue;
        }
        missingTables.push(table);
      }
      if (missingTables.length > 0) {
        throw new BadRequestException(`Missing join configuration for: ${missingTables.join(', ')}`);
      }
    }

    const effectiveJoins = config.joins && config.joins.length > 0 ? config.joins : inferredJoins;
    if (effectiveJoins.length > 0) {
      const joinClauses = effectiveJoins.map(j => {
        return `${j.type} JOIN ${j.table} ON ${baseTable}.${j.onField} = ${j.table}.${j.joinField}`;
      }).join(' ');
      fromClause += ` ${joinClauses}`;
    }

    // Build WHERE clause
    let whereClause = '';
    if (config.filters && config.filters.length > 0) {
      const conditions = config.filters.map(f => {
        const fieldRef = `${f.table}.${f.field}`;
        
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
          case FilterOperator.BETWEEN:
            params.push(f.values![0], f.values![1]);
            return `${fieldRef} BETWEEN $${paramIndex - 2} AND $${paramIndex - 1}`;
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
      const groupFields = config.groupBy.map(g => `${g.table}.${g.field}`).join(', ');
      groupByClause = `GROUP BY ${groupFields}`;
    }

    // Build ORDER BY clause
    let orderByClause = '';
    if (config.orderBy && config.orderBy.length > 0) {
      const orderFields = config.orderBy.map(o => `${o.table}.${o.field} ${o.direction}`).join(', ');
      orderByClause = `ORDER BY ${orderFields}`;
    }

    // Build LIMIT/OFFSET clause
    let limitClause = '';
    if (config.limit) {
      limitClause = `LIMIT ${config.limit}`;
      if (config.offset) {
        limitClause += ` OFFSET ${config.offset}`;
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

    // Validate field names (prevent SQL injection)
    // Allow alphanumeric and underscores, case insensitive
    const validTablePattern = /^[a-z0-9_]+$/i;
    const validFieldPattern = /^[a-z0-9_]+$/i;

    for (const field of config.fields) {
      if (!field.table || !field.field) {
        throw new BadRequestException('All fields must have a table and field name');
      }
      if (!validTablePattern.test(field.table)) {
        throw new BadRequestException(`Invalid table name: ${field.table}`);
      }
      if (!validFieldPattern.test(field.field)) {
        throw new BadRequestException(`Invalid field name: ${field.field}`);
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
      return await this.databaseService.query(
        `SELECT rt.*, u.full_name as created_by_name
         FROM report_favorites rf
         JOIN report_templates rt ON rf.template_id = rt.id
         LEFT JOIN users u ON rt.created_by = u.id
         WHERE rf.user_id = $1 AND rt.status = 'active'
         ORDER BY rf.created_at DESC`,
        [userId],
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
  async getExecutionHistory(templateId: string, userId: string, limit: number = 50) {
    await this.findOneTemplate(templateId, userId); // Check access

    return this.databaseService.query(
      `SELECT 
        re.*,
        u.full_name as executed_by_name
       FROM report_executions re
       LEFT JOIN users u ON re.executed_by = u.id
       WHERE re.template_id = $1
       ORDER BY re.executed_at DESC
       LIMIT $2`,
      [templateId, limit],
    );
  }
}
