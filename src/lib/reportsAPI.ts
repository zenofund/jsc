// Reports API Client - Live Backend Integration
// All endpoints connect to your production NestJS backend

const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api/v1';

// Types matching backend DTOs
export interface DataSourceField {
  field: string;
  type: string;
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

export interface ReportField {
  table: string;
  field: string;
  alias?: string;
  aggregate?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  visible?: boolean;
}

export interface ReportFilter {
  table: string;
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN' | 'BETWEEN' | 'IS NULL' | 'IS NOT NULL';
  value?: any;
  values?: any[];
}

export interface ReportJoin {
  table: string;
  type: 'INNER' | 'LEFT' | 'RIGHT';
  onField: string;
  joinField: string;
}

export interface ReportGroupBy {
  table: string;
  field: string;
}

export interface ReportOrderBy {
  table: string;
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface ReportConfig {
  fields: ReportField[];
  filters?: ReportFilter[];
  joins?: ReportJoin[];
  groupBy?: ReportGroupBy[];
  orderBy?: ReportOrderBy[];
  limit?: number;
  offset?: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'payroll' | 'staff' | 'loans' | 'leave' | 'cooperative' | 'deductions' | 'allowances' | 'audit' | 'custom';
  config: ReportConfig;
  is_public: boolean;
  is_system: boolean;
  status: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  access_type?: 'owner' | 'shared' | 'public';
  is_favorite?: boolean;
  can_edit?: boolean;
  can_execute?: boolean;
  can_schedule?: boolean;
}

export interface ReportExecution {
  id: string;
  template_id: string;
  execution_type: 'manual' | 'scheduled' | 'api';
  status: 'running' | 'completed' | 'failed';
  total_rows?: number;
  execution_time_ms?: number;
  file_path?: string;
  export_format?: 'pdf' | 'excel' | 'csv' | 'json';
  error_message?: string;
  executed_by: string;
  executed_by_name?: string;
  executed_at: string;
  completed_at?: string;
}

export interface ReportSchedule {
  id: string;
  template_id: string;
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  cron_expression?: string;
  time_of_day?: string;
  day_of_week?: number[];
  day_of_month?: number[];
  recipients: Array<{ userId?: string; email?: string }>;
  export_format: 'pdf' | 'excel' | 'csv';
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
}

export interface ReportExecutionResult {
  template: {
    id: string;
    name: string;
    category: string;
  };
  data: any[];
  meta: {
    totalRows: number;
    executionTimeMs: number;
    executedAt: string;
    executedBy: string;
  };
}

// Helper function to get auth token
function getAuthToken(): string {
  const token = localStorage.getItem('jsc_auth_token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
}

// Helper function to make authenticated requests
export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message || `API Error: ${response.status}`, response.status, error);
  }

  return response.json();
}

// Reports API
export const reportsAPI = {
  // ==================== DATA SOURCES ====================
  
  /**
   * Get available data sources (tables & fields)
   */
  async getDataSources(): Promise<DataSource[]> {
    return apiRequest<DataSource[]>('/reports/data-sources');
  },

  // ==================== REPORT TEMPLATES ====================

  /**
   * Create a new report template
   */
  async createTemplate(data: {
    name: string;
    description?: string;
    category: ReportTemplate['category'];
    config: ReportConfig;
    isPublic?: boolean;
  }): Promise<ReportTemplate> {
    return apiRequest<ReportTemplate>('/reports/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get all report templates
   */
  async getTemplates(category?: string): Promise<ReportTemplate[]> {
    const params = category ? `?category=${category}` : '';
    return apiRequest<ReportTemplate[]>(`/reports/templates${params}`);
  },

  /**
   * Get single report template
   */
  async getTemplate(id: string): Promise<ReportTemplate> {
    return apiRequest<ReportTemplate>(`/reports/templates/${id}`);
  },

  /**
   * Update report template
   */
  async updateTemplate(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      category: ReportTemplate['category'];
      config: ReportConfig;
      isPublic: boolean;
      status: string;
    }>
  ): Promise<ReportTemplate> {
    return apiRequest<ReportTemplate>(`/reports/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete report template
   */
  async deleteTemplate(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/reports/templates/${id}`, {
      method: 'DELETE',
    });
  },

  // ==================== REPORT EXECUTION ====================

  /**
   * Execute a report and get live data
   */
  async executeReport(data: {
    templateId: string;
    runtimeFilters?: ReportFilter[];
    exportFormat?: 'pdf' | 'excel' | 'csv' | 'json';
  }): Promise<ReportExecutionResult> {
    return apiRequest<ReportExecutionResult>('/reports/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get execution history for a report
   */
  async getExecutionHistory(templateId: string, limit?: number): Promise<ReportExecution[]> {
    const params = limit ? `?limit=${limit}` : '';
    return apiRequest<ReportExecution[]>(`/reports/executions/${templateId}${params}`);
  },

  // ==================== REPORT SCHEDULES ====================

  /**
   * Schedule a report
   */
  async scheduleReport(data: {
    templateId: string;
    scheduleType: 'daily' | 'weekly' | 'monthly' | 'custom';
    cronExpression?: string;
    timeOfDay?: string;
    dayOfWeek?: number[];
    dayOfMonth?: number[];
    recipients?: Array<{ userId?: string; email?: string }>;
    exportFormat?: 'pdf' | 'excel' | 'csv';
  }): Promise<ReportSchedule> {
    return apiRequest<ReportSchedule>('/reports/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get schedules for a report
   */
  async getSchedules(templateId: string): Promise<ReportSchedule[]> {
    return apiRequest<ReportSchedule[]>(`/reports/schedules/${templateId}`);
  },

  // ==================== REPORT SHARING ====================

  /**
   * Share a report with user or role
   */
  async shareReport(data: {
    templateId: string;
    sharedWithUserId?: string;
    sharedWithRole?: string;
    canView?: boolean;
    canEdit?: boolean;
    canExecute?: boolean;
    canSchedule?: boolean;
    expiresAt?: string;
  }): Promise<any> {
    return apiRequest('/reports/share', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ==================== FAVORITES ====================

  /**
   * Add report to favorites
   */
  async addToFavorites(templateId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/reports/favorites/${templateId}`, {
      method: 'POST',
    });
  },

  /**
   * Remove report from favorites
   */
  async removeFromFavorites(templateId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/reports/favorites/${templateId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get favorite reports
   */
  async getFavorites(): Promise<ReportTemplate[]> {
    return apiRequest<ReportTemplate[]>('/reports/favorites');
  },
};

// Helper functions for UI
export const reportHelpers = {
  /**
   * Get category display name
   */
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      payroll: 'Payroll',
      staff: 'Staff',
      loans: 'Loans',
      leave: 'Leave',
      cooperative: 'Cooperative',
      deductions: 'Deductions',
      allowances: 'Allowances',
      audit: 'Audit Trail',
      custom: 'Custom',
    };
    return labels[category] || category;
  },

  /**
   * Get category color
   */
  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      payroll: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      staff: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      loans: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      leave: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      cooperative: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      deductions: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      allowances: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
      audit: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      custom: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    };
    return colors[category] || colors.custom;
  },

  /**
   * Get operator display label
   */
  getOperatorLabel(operator: string): string {
    const labels: Record<string, string> = {
      '=': 'Equals',
      '!=': 'Not Equals',
      '>': 'Greater Than',
      '<': 'Less Than',
      '>=': 'Greater or Equal',
      '<=': 'Less or Equal',
      'LIKE': 'Contains',
      'IN': 'In List',
      'NOT IN': 'Not In List',
      'BETWEEN': 'Between',
      'IS NULL': 'Is Empty',
      'IS NOT NULL': 'Is Not Empty',
    };
    return labels[operator] || operator;
  },

  /**
   * Format execution time
   */
  formatExecutionTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  },

  /**
   * Get available operators for field type
   */
  getOperatorsForType(fieldType: string): string[] {
    if (fieldType === 'number') {
      return ['=', '!=', '>', '<', '>=', '<=', 'BETWEEN', 'IS NULL', 'IS NOT NULL'];
    } else if (fieldType === 'date') {
      return ['=', '!=', '>', '<', '>=', '<=', 'BETWEEN', 'IS NULL', 'IS NOT NULL'];
    } else if (fieldType === 'string') {
      return ['=', '!=', 'LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'];
    } else if (fieldType === 'boolean') {
      return ['=', '!=', 'IS NULL', 'IS NOT NULL'];
    }
    return ['=', '!=', 'IS NULL', 'IS NOT NULL'];
  },
};
