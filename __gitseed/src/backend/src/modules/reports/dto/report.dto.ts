import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsEnum, IsObject, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

// Enums
export enum ReportCategory {
  PAYROLL = 'payroll',
  STAFF = 'staff',
  LOANS = 'loans',
  LEAVE = 'leave',
  COOPERATIVE = 'cooperative',
  DEDUCTIONS = 'deductions',
  ALLOWANCES = 'allowances',
  AUDIT = 'audit',
  CUSTOM = 'custom',
}

export enum AggregateFunction {
  COUNT = 'COUNT',
  SUM = 'SUM',
  AVG = 'AVG',
  MIN = 'MIN',
  MAX = 'MAX',
}

export enum FilterOperator {
  EQUALS = '=',
  NOT_EQUALS = '!=',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN_OR_EQUAL = '<=',
  LIKE = 'LIKE',
  IN = 'IN',
  NOT_IN = 'NOT IN',
  BETWEEN = 'BETWEEN',
  IS_NULL = 'IS NULL',
  IS_NOT_NULL = 'IS NOT NULL',
}

export enum ExportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
}

// Report Field Configuration
export class ReportFieldDto {
  @IsString()
  @IsNotEmpty()
  table: string; // e.g., 'staff', 'payroll_batches'

  @IsString()
  @IsNotEmpty()
  field: string; // e.g., 'first_name', 'gross_pay'

  @IsString()
  @IsOptional()
  alias?: string; // Display name

  @IsEnum(AggregateFunction)
  @IsOptional()
  aggregate?: AggregateFunction; // For SUM, AVG, COUNT, etc.

  @IsBoolean()
  @IsOptional()
  visible?: boolean; // Show in output or use for filtering only
}

// Report Filter Configuration
export class ReportFilterDto {
  @IsString()
  @IsNotEmpty()
  table: string;

  @IsString()
  @IsNotEmpty()
  field: string;

  @IsEnum(FilterOperator)
  operator: FilterOperator;

  @IsOptional()
  value?: any; // Value to filter by

  @IsOptional()
  values?: any[]; // For IN, BETWEEN operators
}

// Report Join Configuration
export class ReportJoinDto {
  @IsString()
  @IsNotEmpty()
  table: string; // Table to join

  @IsString()
  @IsNotEmpty()
  type: string; // 'INNER', 'LEFT', 'RIGHT'

  @IsString()
  @IsNotEmpty()
  onField: string; // Field from base table

  @IsString()
  @IsNotEmpty()
  joinField: string; // Field from joined table
}

// Report Group By Configuration
export class ReportGroupByDto {
  @IsString()
  @IsNotEmpty()
  table: string;

  @IsString()
  @IsNotEmpty()
  field: string;
}

// Report Order By Configuration
export class ReportOrderByDto {
  @IsString()
  @IsNotEmpty()
  table: string;

  @IsString()
  @IsNotEmpty()
  field: string;

  @IsString()
  @IsNotEmpty()
  direction: string; // 'ASC', 'DESC'
}

// Complete Report Configuration
export class ReportConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFieldDto)
  fields: ReportFieldDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  @IsOptional()
  filters?: ReportFilterDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportJoinDto)
  @IsOptional()
  joins?: ReportJoinDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportGroupByDto)
  @IsOptional()
  groupBy?: ReportGroupByDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportOrderByDto)
  @IsOptional()
  orderBy?: ReportOrderByDto[];

  @IsNumber()
  @IsOptional()
  limit?: number;

  @IsNumber()
  @IsOptional()
  offset?: number;
}

// Create Report Template DTO
export class CreateReportTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReportCategory)
  category: ReportCategory;

  @ValidateNested()
  @Type(() => ReportConfigDto)
  config: ReportConfigDto;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

// Update Report Template DTO
export class UpdateReportTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReportCategory)
  @IsOptional()
  category?: ReportCategory;

  @ValidateNested()
  @Type(() => ReportConfigDto)
  @IsOptional()
  config?: ReportConfigDto;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsString()
  @IsOptional()
  status?: string;
}

// Execute Report DTO
export class ExecuteReportDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  @IsOptional()
  runtimeFilters?: ReportFilterDto[]; // Additional filters applied at runtime

  @IsEnum(ExportFormat)
  @IsOptional()
  exportFormat?: ExportFormat;
}

// Schedule Report DTO
export class ScheduleReportDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @IsNotEmpty()
  scheduleType: string; // 'daily', 'weekly', 'monthly', 'custom'

  @IsString()
  @IsOptional()
  cronExpression?: string;

  @IsString()
  @IsOptional()
  timeOfDay?: string; // HH:mm format

  @IsArray()
  @IsOptional()
  dayOfWeek?: number[]; // [0-6]

  @IsArray()
  @IsOptional()
  dayOfMonth?: number[]; // [1-31]

  @IsArray()
  @IsOptional()
  recipients?: Array<{ userId?: string; email?: string }>;

  @IsEnum(ExportFormat)
  @IsOptional()
  exportFormat?: ExportFormat;
}

// Share Report DTO
export class ShareReportDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @IsOptional()
  sharedWithUserId?: string;

  @IsString()
  @IsOptional()
  sharedWithRole?: string;

  @IsBoolean()
  @IsOptional()
  canView?: boolean;

  @IsBoolean()
  @IsOptional()
  canEdit?: boolean;

  @IsBoolean()
  @IsOptional()
  canExecute?: boolean;

  @IsBoolean()
  @IsOptional()
  canSchedule?: boolean;

  @IsString()
  @IsOptional()
  expiresAt?: string; // ISO date string
}

// Available Data Sources (for UI)
export interface DataSourceField {
  field: string;
  type: string; // 'string', 'number', 'date', 'boolean'
  label: string;
  isSearchable: boolean;
  isFilterable: boolean;
  isAggregatable: boolean;
}

export interface DataSource {
  table: string;
  label: string;
  fields: DataSourceField[];
  relationships: Array<{
    table: string;
    field: string;
    foreignKey: string;
  }>;
}
