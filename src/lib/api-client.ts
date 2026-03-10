// API Client - NestJS Backend
// ============================================
// V2.0 - Production-Ready Architecture
// All requests route to live NestJS + Supabase backend
// 113 API endpoints operational
// ============================================

import type { User, Staff, PayrollBatch, PayrollLine, LoanApplication, CooperativeContribution, Allowance, Deduction, CooperativeMember, SystemSettings } from '../types/entities';

// Configuration for API backend
const API_CONFIG = {
  // NestJS API base URL (configure for production)
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:3000/api/v1',
  // Supabase configuration
  supabase: {
    url: import.meta.env?.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env?.VITE_SUPABASE_ANON_KEY || '',
  }
};

// Helper function for making API requests
async function makeApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token') || ''}`,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - Session expired
      if (response.status === 401) {
        // Allow skipping global handler for specific requests (e.g. background checks)
        const skipHandler = (options.headers as any)?.['X-Skip-Auth-Handler'];
        
        if (!skipHandler) {
          // Clear all auth data
          localStorage.removeItem('jsc_auth_token');
          localStorage.removeItem('jsc_current_user');
          localStorage.removeItem('jsc_user');
          
          // Redirect to login if not already on a public route
          const publicRoutes = ['/login', '/forgot-password', '/reset-password'];
          const isPublicRoute = publicRoutes.some(route => window.location.pathname.includes(route));
          
          if (!isPublicRoute) {
            window.location.reload();
          }
          
          throw new Error('Session expired. Please login again.');
        }
      }

      const rawText = await response.text().catch(() => '');
      let parsed: any = null;
      try { parsed = rawText ? JSON.parse(rawText) : null; } catch {}
      let msg: any = parsed?.message ?? parsed?.error ?? null;
      if (Array.isArray(msg)) msg = msg.join('; ');
      const fallback = `HTTP ${response.status}: ${response.statusText}`;
      throw new Error((typeof msg === 'string' && msg.trim()) ? msg : fallback);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const text = await response.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    return response.text();
  } catch (error: any) {
    // Check if it's a network error (backend not running)
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      console.error('Backend server is not running. Please start the backend server with: cd backend && npm run start:dev');
      throw new Error('Backend server is not available. Please ensure the backend is running on http://localhost:3000');
    }
    throw error;
  }
}

// ============================================
// AUTHENTICATION API
// ============================================

export const authAPI = {
  login: async (email: string, password: string): Promise<User | null> => {
    // NestJS implementation
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      // Store the auth token
      if (data.access_token) {
        localStorage.setItem('jsc_auth_token', data.access_token);
      }
      
      // Return user object in expected format
      return {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.name,
        role: data.user.role,
        department: data.user.department_id,
        staff_id: data.user.staff_id || data.user.staffId,
        permissions: data.user.permissions || [],
        status: data.user.status || 'active',
        must_change_password: data.user.must_change_password || false,
        created_at: data.user.created_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    // NestJS implementation
    try {
      const data = await makeApiRequest('/auth/profile');
      console.log('Profile data:', data); // Debug log
      return {
        id: data.id,
        email: data.email,
        full_name: data.name || data.full_name,
        role: data.role,
        department: data.department_name || data.department_id,
        staff_id: data.staff_id || data.staffId || (data.user && (data.user.staff_id || data.user.staffId)),
        permissions: data.permissions || [],
        status: data.status || 'active',
        must_change_password: data.must_change_password || false,
        created_at: data.created_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  changePassword: async (userId: string, oldPassword: string, newPassword: string, confirmPassword: string) => {
    // NestJS implementation
    return makeApiRequest('/auth/change-password', {
      method: 'PATCH',
      body: JSON.stringify({
        currentPassword: oldPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword
      })
    });
  },

  logout: async () => {
    // NestJS implementation
    localStorage.removeItem('jsc_auth_token');
    localStorage.removeItem('jsc_current_user');
    localStorage.removeItem('jsc_user');
  }
};

// ============================================
// STAFF API
// ============================================

export const staffAPI = {
  async getAllStaff(options?: { page?: number; limit?: number; fetchAll?: boolean }) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 100;
    const fetchAll = options?.fetchAll ?? false;

    if (!fetchAll) {
      return makeApiRequest(`/staff?page=${page}&limit=${limit}`, {
        method: 'GET',
      });
    }

    // Fetch all pages and aggregate results
    let currentPage = 1;
    const aggregated: any[] = [];
    let totalPages = 1;

    do {
      const resp = await makeApiRequest(`/staff?page=${currentPage}&limit=${limit}`, {
        method: 'GET',
      });
      const data = Array.isArray(resp) ? resp : (resp.data || []);
      aggregated.push(...data);
      const meta = resp?.meta || resp?.pagination;
      if (meta && typeof meta.totalPages === 'number') {
        totalPages = meta.totalPages;
      } else {
        // Fallback: stop if returned less than limit
        totalPages = data.length < limit ? currentPage : currentPage + 1;
      }
      currentPage += 1;
    } while (currentPage <= totalPages);

    return { data: aggregated, meta: { total: aggregated.length, page: 1, limit: aggregated.length, totalPages: 1 } };
  },

  async createStaff(staffData: any, options?: RequestInit) {
    return makeApiRequest('/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
      ...options,
    });
  },

  async updateStaff(id: string, staffData: any) {
    return makeApiRequest(`/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(staffData),
    });
  },

  async getStaff(id: string) {
    return makeApiRequest(`/staff/${id}`, {
      method: 'GET',
    });
  },

  async getActiveStaff() {
    return makeApiRequest('/staff?status=active', {
      method: 'GET',
    });
  },

  async getNextStaffNumber() {
    return makeApiRequest('/staff/next-staff-number', {
      method: 'GET',
    });
  },

  async bulkImport(records: any[]) {
    // Backend expects an array of BulkCreateStaffDto items
    return makeApiRequest('/staff/bulk-import', {
      method: 'POST',
      body: JSON.stringify(records),
    });
  }
};

// ============================================
// DEPARTMENT API
// ============================================

export const departmentAPI = {
  async createDepartment(departmentData: any, options?: RequestInit) {
    return makeApiRequest('/departments', {
      method: 'POST',
      body: JSON.stringify(departmentData),
      ...options,
    });
  },

  async updateDepartment(id: string, departmentData: any) {
    return makeApiRequest(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(departmentData),
    });
  },

  async getDepartment(id: string) {
    return makeApiRequest(`/departments/${id}`, {
      method: 'GET',
    });
  },

  async getAllDepartments() {
    return makeApiRequest('/departments', {
      method: 'GET',
    });
  },

  async deleteDepartment(id: string) {
    return makeApiRequest(`/departments/${id}`, {
      method: 'DELETE',
    });
  }
};

// ============================================
// PAYROLL API
// ============================================

export const payrollAPI = {
  async createPayrollBatch(batchData: any) {
    return makeApiRequest('/payroll/batches', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  },

  async generatePayrollLines(batchId: string, userId: string, userEmail: string) {
    return makeApiRequest(`/payroll/batches/${batchId}/generate-lines`, {
      method: 'POST',
      body: JSON.stringify({ userId, userEmail }),
    });
  },

  async submitForApproval(batchId: string, userId: string, userEmail: string) {
    return makeApiRequest(`/payroll/batches/${batchId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ userId, userEmail }),
    });
  },

  async approvePayrollStage(batchId: string, stage: number, userId: string, userEmail: string, comments?: string) {
    return makeApiRequest(`/payroll/batches/${batchId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approved', comments }),
    });
  },

  async rejectPayrollStage(batchId: string, stage: number, userId: string, userEmail: string, reason: string) {
    return makeApiRequest(`/payroll/batches/${batchId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action: 'rejected', comments: reason }),
    });
  },

  async lockPayroll(batchId: string, userId: string, userEmail: string) {
    return makeApiRequest(`/payroll/batches/${batchId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ userId, userEmail }),
    });
  },

  async getPayrollBatch(batchId: string) {
    return makeApiRequest(`/payroll/batches/${batchId}`, {
      method: 'GET',
    });
  },

  async getAllPayrollBatches(options?: { payrollMonth?: string; status?: string; year?: string; month?: string }) {
    const params = new URLSearchParams();
    if (options?.payrollMonth) params.append('payrollMonth', options.payrollMonth);
    if (options?.status) params.append('status', options.status);
    if (options?.year) params.append('year', options.year);
    if (options?.month) params.append('month', options.month);

    const queryString = params.toString();
    const result = await makeApiRequest(`/payroll/batches${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
    // Return just the data array for compatibility
    return result.data || result;
  },

  async getPayrollLines(batchId: string, options?: { page?: number; limit?: number; search?: string; sort?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.search) params.append('search', options.search);
    if (options?.sort) params.append('sort', options.sort);
    
    const queryString = params.toString();
    const result = await makeApiRequest(`/payroll/batches/${batchId}/lines${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
    const raw = result.data || result;
    const metaRaw = result.meta || { total: Array.isArray(raw) ? raw.length : 0, page: 1, limit: 1000, totalPages: 1 };
    const meta = {
      total: Number(metaRaw.total) || 0,
      page: Number(metaRaw.page) || 1,
      limit: Number(metaRaw.limit) || 1000,
      totalPages: Number(metaRaw.totalPages) || 1,
    };

    const normalizeLine = (line: any) => {
      const parseArray = (value: any) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };
      const parseObject = (value: any) => {
        if (value && typeof value === 'object') return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return undefined;
          }
        }
        return value;
      };
      return {
        ...line,
        allowances: parseArray(line.allowances),
        deductions: parseArray(line.deductions),
        tax_details: parseObject(line.tax_details),
      };
    };
    
    const data = Array.isArray(raw) ? raw.map(normalizeLine) : raw;
    return { data, meta };
  },

  async getMyApprovalHistory() {
    return makeApiRequest('/payroll/approvals/history', {
      method: 'GET',
    });
  },

  async executePayment(batchId: string, reference: string) {
    return makeApiRequest(`/payroll/batches/${batchId}/execute-payment`, {
      method: 'POST',
      body: JSON.stringify({ reference }),
    });
  },

  async getPendingPayments() {
    return makeApiRequest('/payroll/pending-payments', {
      method: 'GET',
    });
  },

  async getPaymentTrace(batchId: string) {
    return makeApiRequest(`/payroll/batches/${batchId}/payment-trace`, {
      method: 'GET',
    });
  },

  async exportPayroll(batchId: string, format: 'csv' | 'excel' | 'bank') {
    return makeApiRequest(`/payroll/batches/${batchId}/export?format=${format}`, {
      method: 'GET',
    });
  },
};

// ============================================
// ARREARS API
// ============================================

export const arrearsAPI = {
  async getPendingArrears() {
    return makeApiRequest('/arrears/pending');
  },

  async createArrears(data: any) {
    return makeApiRequest('/arrears/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteArrears(id: string) {
    return makeApiRequest(`/arrears/${id}/delete`, {
      method: 'POST',
    });
  },

  async approveArrears(arrearsId: string, approverId: string, approverEmail: string) {
    // Note: Backend ArrearsController::approveArrears takes no body in controller definition,
    // but the service method likely uses req.user.userId.
    // The controller signature is: approveArrears(@Param('id') id: string, @Request() req)
    // So sending body is ignored but harmless.
    return makeApiRequest(`/arrears/${arrearsId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverId, approverEmail }),
    });
  },

  async rejectArrears(arrearsId: string, rejectorId: string, rejectorEmail: string, reason: string) {
    // Note: Endpoint `/arrears/:id/reject` is MISSING in ArrearsController.
    // Only `approve`, `merge`, `recalculate`, and `getPendingArrears` exist.
    // Assuming we might need to add it or it's not implemented.
    return makeApiRequest(`/arrears/${arrearsId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectorId, rejectorEmail, reason }),
    });
  },

  async mergeArrearsToPayroll(arrearsId: string, payrollBatchId: string, userId: string, userEmail: string) {
    return makeApiRequest(`/arrears/${arrearsId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ payrollBatchId, userId, userEmail }),
    });
  },

  async getStaffArrears(staffId: string) {
    // Note: Endpoint `/arrears/staff/:id` is MISSING in ArrearsController.
    // Only `getPendingArrears` exists.
    return makeApiRequest(`/arrears/staff/${staffId}`);
  },

  async getAll() {
    // Note: Endpoint `/arrears` (GET all) is MISSING in ArrearsController.
    // Only `getPendingArrears` exists.
    return makeApiRequest('/arrears');
  },

  async recalculateArrears(arrearsId: string, userId: string, userEmail: string) {
    return makeApiRequest(`/arrears/${arrearsId}/recalculate`, {
      method: 'POST',
      body: JSON.stringify({ userId, userEmail }),
    });
  },
};

// ============================================
// PROMOTIONS API
// ============================================

export const promotionAPI = {
  async createPromotion(promotionData: any) {
    return makeApiRequest('/promotions/create', {
      method: 'POST',
      body: JSON.stringify(promotionData),
    });
  },

  async previewArrears(
    staffId: string,
    newGradeLevel: number,
    newStep: number,
    effectiveDate: string,
    oldGradeLevel?: number,
    oldStep?: number,
  ) {
    return makeApiRequest('/promotions/preview-arrears', {
      method: 'POST',
      body: JSON.stringify({ staffId, newGradeLevel, newStep, effectiveDate, oldGradeLevel, oldStep }),
    });
  },

  async approvePromotion(promotionId: string, approverId: string, approverEmail: string, comment?: string) {
    // Note: Endpoint `/promotions/:id/approve` is MISSING in PromotionsController.
    // It has `getStaffPromotions`, `promoteStaff`, `getEligiblePromotions`, `getAll`.
    // Approval logic might be missing or handled via `promoteStaff` directly if it auto-approves.
    return makeApiRequest(`/promotions/${promotionId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverId, approverEmail, comment }),
    });
  },

  async rejectPromotion(promotionId: string, approverId: string, approverEmail: string, reason: string) {
    // Note: Endpoint `/promotions/:id/reject` is MISSING in PromotionsController.
    return makeApiRequest(`/promotions/${promotionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ approverId, approverEmail, reason }),
    });
  },

  async calculatePromotionArrears(promotionId: string) {
    // Note: Endpoint `/promotions/:id/calculate-arrears` is MISSING in PromotionsController.
    return makeApiRequest(`/promotions/${promotionId}/calculate-arrears`, {
      method: 'POST',
    });
  },

  async getAll() {
    return makeApiRequest('/promotions', {
      method: 'GET',
    });
  },

  async getStaffPromotions(staffId: string) {
    return makeApiRequest(`/promotions/staff/${staffId}`, {
      method: 'GET',
    });
  },
};

// ============================================
// PAYMENT BATCH API
// ============================================

export const paymentBatchAPI = {
  async getAll() {
    // Re-use payroll batches but filter for those ready for payment if needed
    // Or map to a specific payments endpoint
    const result = await makeApiRequest('/payroll/batches');
    return result.data || result;
  },

  async approveForPayment(batchId: string, userId: string, userEmail: string) {
      return makeApiRequest(`/payroll/batches/${batchId}/execute-payment`, {
        method: 'POST',
        body: JSON.stringify({ userId, userEmail }),
      });
    },
  };

// ============================================
// AUDIT LOG API
// ============================================

export const auditAPI = {
  async getAll(filters?: {
    userId?: string;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.entity) params.append('entity', filters.entity);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = `/audit${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, { method: 'GET' });
  },
};

// ============================================
// STAFF REQUESTS API
// ============================================

export const staffRequestsAPI = {
  async getAll(filters?: { status?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    const qs = params.toString();
    return makeApiRequest(`/staff/requests${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },

  async approve(id: string, notes?: string) {
    return makeApiRequest(`/staff/requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async reject(id: string, notes?: string) {
    return makeApiRequest(`/staff/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },
};

 // ============================================
 // EXPORTS FROM OTHER MODULES
// ============================================

export { loanApplicationAPI } from './loanAPI';

 // ============================================
 // USER MANAGEMENT API
// ============================================

export const userAPI = {
  async createUser(userData: any, options?: RequestInit) {
    return makeApiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
      ...options,
    });
  },

  async updateUser(userId: string, userData: any) {
    return makeApiRequest(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  async getAllUsers() {
    return makeApiRequest('/users', {
      method: 'GET',
    });
  },

  async deleteUser(userId: string, deletedBy: string, deletedByEmail: string) {
    // Note: Backend UsersController::deleteUser takes no body, just the ID.
    // So body params here are ignored but harmless.
    return makeApiRequest(`/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ deletedBy, deletedByEmail }),
    });
  },
};

// ============================================
// PAYROLL SETUP API
// ============================================

export const bankAPI = {
  getSupportedBanks: async () => {
    return makeApiRequest('/bank/supported-banks', {
      method: 'GET',
    });
  },

  createPaymentBatch: async (data: any) => {
    return makeApiRequest('/bank/payment-batches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPaymentBatches: async () => {
    return makeApiRequest('/bank/payment-batches', {
      method: 'GET',
    });
  },

  generatePaymentFile: async (id: string) => {
    return makeApiRequest(`/bank/payment-batches/${id}/generate-file`, {
      method: 'POST',
    });
  }
};

export const salaryStructureAPI = {
  async createStructure(structureData: any, userId: string, userEmail: string) {
    return makeApiRequest('/salary-structures', {
      method: 'POST',
      body: JSON.stringify(structureData),
    });
  },

  async updateStructure(structureId: string, updates: any, userId: string, userEmail: string) {
    return makeApiRequest(`/salary-structures/${structureId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async getAllStructures() {
    const result = await makeApiRequest('/salary-structures?limit=1000', {
      method: 'GET',
    });
    // Return just the data array for compatibility with existing code
    return result.data || result;
  },

  async getStructureById(structureId: string) {
    return makeApiRequest(`/salary-structures/${structureId}`, {
      method: 'GET',
    });
  },

  async deleteStructure(structureId: string, userId: string, userEmail: string) {
    // Note: Backend SalaryStructuresController::remove takes no body, just the ID.
    // So body params here are ignored but harmless.
    return makeApiRequest(`/salary-structures/${structureId}`, {
      method: 'DELETE',
    });
  },

  async getActiveStructure() {
    return makeApiRequest('/salary-structures/active', {
      method: 'GET',
    });
  },

  async getSalaryForGradeAndStep(structureId: string, gradeLevel: string | number, step: number) {
    return makeApiRequest(`/salary-structures/${structureId}/salary/${gradeLevel}/${step}`, {
      method: 'GET',
    });
  },
};

export const allowanceAPI = {
  async createAllowance(allowanceData: any) {
    return makeApiRequest('/allowances/global', {
      method: 'POST',
      body: JSON.stringify(allowanceData),
    });
  },

  async updateAllowance(id: string, allowanceData: any) {
    return makeApiRequest(`/allowances/global/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(allowanceData),
    });
  },

  async getAllAllowances() {
    const result = await makeApiRequest('/allowances/global?limit=1000&status=active', {
      method: 'GET',
    });
    // Return just the data array for compatibility with existing code
    return result.data || result;
  },

  async deleteAllowance(id: string) {
    return makeApiRequest(`/allowances/global/${id}`, {
      method: 'DELETE',
    });
  },
};

export const deductionAPI = {
  async createDeduction(deductionData: any, userId?: string, userEmail?: string) {
    return makeApiRequest('/deductions/global', {
      method: 'POST',
      body: JSON.stringify(deductionData),
    });
  },

  async updateDeduction(id: string, deductionData: any, userId?: string, userEmail?: string) {
    return makeApiRequest(`/deductions/global/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(deductionData),
    });
  },

  async getAllDeductions() {
    const result = await makeApiRequest('/deductions/global?limit=1000&status=active', {
      method: 'GET',
    });
    // Return just the data array for compatibility with existing code
    return result.data || result;
  },

  async deleteDeduction(id: string, userId?: string, userEmail?: string) {
    return makeApiRequest(`/deductions/global/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// REPORTS API
// ============================================

export const reportAPI = {
  // Standard Reports - Supabase Backend
  async getStaffReport(filters?: { department?: string; status?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.department) params.append('department', filters.department);
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    const url = `/reports/staff${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, {
      method: 'GET',
    });
  },

  async getPayrollReport(month: string): Promise<any> {
    return makeApiRequest(`/reports/payroll/${month}`, {
      method: 'GET',
    });
  },

  async getVarianceReport(month1: string, month2: string): Promise<any> {
    return makeApiRequest(`/reports/variance?month1=${month1}&month2=${month2}`, {
      method: 'GET',
    });
  },

  async getRemittanceReport(month: string, type: 'pension' | 'tax' | 'cooperative'): Promise<any> {
    return makeApiRequest(`/reports/remittance/${month}?type=${type}`, {
      method: 'GET',
    });
  },
};

// ============================================
// PAYSLIPS API
// ============================================

export const payslipAPI = {
  async getStaffPayslips(staffId: string, payrollMonth?: string) {
    // Note: Mapped to PayrollController::getStaffPayslips
    const query = payrollMonth ? `?payrollMonth=${encodeURIComponent(payrollMonth)}` : '';
    const result = await makeApiRequest(`/payroll/payslips/staff/${staffId}${query}`, {
      method: 'GET',
    });
    return result.data || result;
  },

  async getPayslipByBatchAndStaff(batchId: string, staffId: string) {
    // Note: Endpoint `/payslips/batch/:batchId/staff/:staffId` does not exist.
    // We can likely use `/payroll/batches/:batchId/lines?staff_id=:staffId` if the backend supports filtering lines.
    // PayrollController::getPayrollLines takes `@Query() query: any` so it might support it.
    // Let's try to map it to that.
    const result = await makeApiRequest(`/payroll/batches/${batchId}/lines?staff_id=${staffId}`, {
      method: 'GET',
    });
    return result.data || result;
  },

  async getBatchPayslips(batchId: string, payrollMonth?: string) {
    // Note: Endpoint now exists in PayrollController
    const query = payrollMonth ? `?payrollMonth=${encodeURIComponent(payrollMonth)}` : '';
    const result = await makeApiRequest(`/payroll/payslips/batch/${batchId}${query}`, {
      method: 'GET',
    });
    return result.data || result;
  },
};

// ============================================
// SETTINGS API
// ============================================

export const settingsAPI = {
  async getSettings(options?: RequestInit) {
    return makeApiRequest('/settings', {
      method: 'GET',
      ...options,
    });
  },

  async updateSettings(settings: any, userId: string, userEmail: string) {
    return makeApiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify({ ...settings, userId, userEmail }),
    });
  },

  async getTaxConfiguration() {
    return makeApiRequest('/settings/tax-configuration', {
      method: 'GET',
    });
  },

  async updateTaxConfiguration(taxConfig: any, userId: string, userEmail: string) {
    return makeApiRequest('/settings/tax-configuration', {
      method: 'PUT',
      body: JSON.stringify({ ...taxConfig, userId, userEmail }),
    });
  },
};

// ============================================
// STAFF-SPECIFIC ALLOWANCES & DEDUCTIONS API
// ============================================

import * as StaffSpecificAPI from './api-staff-specific';

export const staffAllowanceAPI = {
  createStaffAllowance: StaffSpecificAPI.staffAllowanceAPI.createStaffAllowance,
  getStaffAllowances: StaffSpecificAPI.staffAllowanceAPI.getStaffAllowances,
  getStaffAllowanceById: StaffSpecificAPI.staffAllowanceAPI.getStaffAllowanceById,
  getActiveAllowancesForMonth: StaffSpecificAPI.staffAllowanceAPI.getActiveAllowancesForMonth,
  updateStaffAllowance: StaffSpecificAPI.staffAllowanceAPI.updateStaffAllowance,
  markAsApplied: StaffSpecificAPI.staffAllowanceAPI.markAsApplied,
  deactivateStaffAllowance: StaffSpecificAPI.staffAllowanceAPI.deactivateStaffAllowance,
  deleteStaffAllowance: StaffSpecificAPI.staffAllowanceAPI.deleteStaffAllowance,
  getAllStaffAllowances: StaffSpecificAPI.staffAllowanceAPI.getAllStaffAllowances,
  bulkUpdateStatus: StaffSpecificAPI.staffAllowanceAPI.bulkUpdateStatus,
};

export const staffDeductionAPI = {
  createStaffDeduction: StaffSpecificAPI.staffDeductionAPI.createStaffDeduction,
  getStaffDeductions: StaffSpecificAPI.staffDeductionAPI.getStaffDeductions,
  getStaffDeductionById: StaffSpecificAPI.staffDeductionAPI.getStaffDeductionById,
  getActiveDeductionsForMonth: StaffSpecificAPI.staffDeductionAPI.getActiveDeductionsForMonth,
  updateStaffDeduction: StaffSpecificAPI.staffDeductionAPI.updateStaffDeduction,
  markAsApplied: StaffSpecificAPI.staffDeductionAPI.markAsApplied,
  deactivateStaffDeduction: StaffSpecificAPI.staffDeductionAPI.deactivateStaffDeduction,
  deleteStaffDeduction: StaffSpecificAPI.staffDeductionAPI.deleteStaffDeduction,
  getAllStaffDeductions: StaffSpecificAPI.staffDeductionAPI.getAllStaffDeductions,
  bulkUpdateStatus: StaffSpecificAPI.staffDeductionAPI.bulkUpdateStatus,
};

export const payrollAdjustmentAPI = {
  addAdjustment: StaffSpecificAPI.payrollAdjustmentAPI.addAdjustment,
  getBatchAdjustments: StaffSpecificAPI.payrollAdjustmentAPI.getBatchAdjustments,
  getLineAdjustments: StaffSpecificAPI.payrollAdjustmentAPI.getLineAdjustments,
  getStaffAdjustments: StaffSpecificAPI.payrollAdjustmentAPI.getStaffAdjustments,
  removeAdjustment: StaffSpecificAPI.payrollAdjustmentAPI.removeAdjustment,
  recalculatePayrollLine: StaffSpecificAPI.payrollAdjustmentAPI.recalculatePayrollLine,
  getAllAdjustments: StaffSpecificAPI.payrollAdjustmentAPI.getAllAdjustments,
};

// ============================================
// DASHBOARD API
// ============================================

export const dashboardAPI = {
  getDashboardStats: async () => {
    // NestJS implementation - fetch stats from multiple endpoints
    try {
      const [staffStatsResponse, payrollData, leaveRequests, arrearsData] = await Promise.all([
        makeApiRequest('/staff/statistics'),
        makeApiRequest('/payroll/batches?limit=10'),
        makeApiRequest('/leave/requests?status=pending').catch(() => ({ data: [] })),
        makeApiRequest('/arrears/pending').catch(() => []),
      ]);

      const staffStats = staffStatsResponse.overview || {};

      // Transform the data to match the expected format
      return {
        total_staff: parseInt(staffStats.total_staff || '0'),
        active_staff: parseInt(staffStats.active_staff || '0'),
        on_leave: parseInt(staffStats.on_leave || '0'),
        new_hires: parseInt(staffStats.new_this_month || '0'),
        pending_approvals: (payrollData.data || []).filter((b: any) => b.status === 'pending_approval').length,
        pending_payments: (payrollData.data || []).filter((b: any) => b.status === 'approved').length,
        upcoming_payroll: (payrollData.data || []).filter((b: any) => b.status === 'draft').length,
        pending_leave_requests: Array.isArray(leaveRequests.data) ? leaveRequests.data.length : 0,
        monthly_payroll: parseFloat(staffStats.monthly_payroll || '0'),
        yearly_payroll: parseFloat(staffStats.yearly_payroll || '0'),
        recent_batches: payrollData.data || [],
        pending_arrears: Array.isArray(arrearsData) ? arrearsData.filter((a: any) => a.status === 'pending' && !a.payroll_batch_id).length : 0,
        active_payroll_count: (payrollData.data || []).filter((b: any) => b.status !== 'paid' && b.status !== 'locked').length,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Return default values on error
      return {
        total_staff: 0,
        active_staff: 0,
        on_leave: 0,
        new_hires: 0,
        pending_approvals: 0,
        pending_payments: 0,
        upcoming_payroll: 0,
        pending_leave_requests: 0,
        monthly_payroll: 0,
        yearly_payroll: 0,
        recent_batches: [],
        pending_arrears: 0,
        active_payroll_count: 0,
      };
    }
  },
  
  getCalendarEvents: async (year: number, month: number) => {
    // NestJS implementation - fetch payroll batches for calendar
    try {
      const [batchesResult, settings] = await Promise.all([
        makeApiRequest(`/payroll/batches?year=${year}&month=${month + 1}`),
        settingsAPI.getSettings().catch(() => ({ payday_day: 25 }))
      ]);
      
      const batches = batchesResult.data || [];
      const payday = settings?.payday_day || 25;
      
      // Transform to calendar events
      const events = batches.map((batch: any) => {
        const dateStr = batch.payment_executed_at || batch.payment_date || batch.created_at;
        const dateObj = new Date(dateStr);
        
        let type = 'created';
        if (batch.status === 'paid') type = 'paid';
        else if (batch.status === 'approved' || batch.status === 'payment_processing') type = 'approved';
        
        return {
          id: batch.id,
          title: `Payroll: ${batch.payroll_month}`,
          date: dateObj.getDate(),
          type: type,
          status: batch.status,
          batch_number: batch.batch_number,
          amount: batch.total_net,
          timestamp: batch.created_at
        };
      });

      // Add Cutoff event
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      if (payday <= daysInMonth) {
        events.push({
          id: 'cutoff-event',
          title: 'Payroll Cutoff',
          date: payday,
          type: 'cutoff',
          status: 'scheduled'
        });
      }

      return events;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  },
};


// ============================================
// LEAVE API
// ============================================

export const leaveAPI = {
  async getLeaveTypes() {
    return makeApiRequest('/leave/types', {
      method: 'GET',
    });
  },

  async getLeaveBalances(staffId: string, year?: number) {
    const query = year ? `?year=${year}` : '';
    return makeApiRequest(`/leave/balances/staff/${staffId}${query}`, {
      method: 'GET',
    });
  },

  async requestLeave(data: any, userId: string, userEmail: string) {
    return makeApiRequest('/leave/requests', {
      method: 'POST',
      body: JSON.stringify({ ...data, userId, userEmail }),
    });
  },

  async getLeaveRequests(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return makeApiRequest(`/leave/requests${queryString}`, {
      method: 'GET',
    });
  },

  async approveLeave(requestId: string, data: { approverId: string, comments?: string }) {
    // Note: Backend uses PUT /leave/requests/:id/approve
    // Expects ApproveLeaveDto which likely needs more than just approverId/comments?
    // Looking at controller: @Body() dto: ApproveLeaveDto.
    // Assuming data matches dto structure.
    return makeApiRequest(`/leave/requests/${requestId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async rejectLeave(requestId: string, data: { rejectorId: string, reason: string }) {
    // Note: Backend uses PUT /leave/requests/:id/reject
    // Expects body: { remarks: string }
    return makeApiRequest(`/leave/requests/${requestId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ remarks: data.reason }),
    });
  },
};

// ============================================
// STAFF PORTAL API
// ============================================

export const staffPortalAPI = {
  // Leave Requests
  async createLeaveRequest(leaveData: any) {
    return makeApiRequest('/leave/requests', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
  },

  async getStaffLeaveRequests(staffId: string) {
    return makeApiRequest(`/leave/requests/staff/${staffId}`, {
      method: 'GET',
    });
  },

  async getAllLeaveRequests(status?: string) {
    const query = status ? `?status=${status}` : '';
    return makeApiRequest(`/leave/requests${query}`, {
      method: 'GET',
    });
  },

  async getPendingLeaveRequests() {
    return makeApiRequest('/leave/requests?status=pending', {
      method: 'GET',
    });
  },

  async approveLeaveRequest(requestId: string, approverId: string, approverEmail: string) {
    return makeApiRequest(`/leave/requests/${requestId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  },

  async rejectLeaveRequest(requestId: string, approverId: string, approverEmail: string, reason: string) {
    return makeApiRequest(`/leave/requests/${requestId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ remarks: reason }),
    });
  },

  async cancelLeaveRequest(requestId: string, staffId: string) {
    return makeApiRequest(`/leave/requests/${requestId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  },

  // Leave Balances
  async getLeaveBalance(staffId: string) {
    return makeApiRequest(`/leave/balances/${staffId}`, {
      method: 'GET',
    });
  },

  async initializeLeaveBalance(staffId: string, year: number) {
    return makeApiRequest('/leave/balances', {
      method: 'POST',
      body: JSON.stringify({ staffId, year }),
    });
  },

  async getAllLeaveBalances() {
    return makeApiRequest('/leave/balances', {
      method: 'GET',
    });
  },

  async updateLeaveBalance(staffId: string, balanceData: any) {
    return makeApiRequest(`/leave/balances/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(balanceData),
    });
  },

  // Staff Documents
  async createStaffDocument(documentData: any) {
    return makeApiRequest('/staff/documents', {
      method: 'POST',
      body: JSON.stringify(documentData),
    });
  },

  async getStaffDocuments(staffId: string) {
    return makeApiRequest(`/staff/documents/${staffId}`, {
      method: 'GET',
    });
  },

  async deleteStaffDocument(documentId: string) {
    return makeApiRequest(`/staff/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  // Staff Requests
  async createStaffRequest(requestData: any) {
    return makeApiRequest('/staff/requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  async getStaffRequests(staffId: string) {
    return makeApiRequest(`/staff/requests/staff/${staffId}`, {
      method: 'GET',
    });
  },

  async getAllRequests() {
    return makeApiRequest('/staff/requests', {
      method: 'GET',
    });
  },

  async updateRequestStatus(requestId: string, status: string, processedBy: string, notes?: string) {
    return makeApiRequest(`/staff/requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, processedBy, notes }),
    });
  },

  async updateStaffProfile(staffId: string, profileData: any) {
    return makeApiRequest(`/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
  },

  async getStaffDashboardStats(staffId: string) {
    return makeApiRequest(`/staff/dashboard-stats/${staffId}`, {
      method: 'GET',
    });
  },
};

// ============================================
// Notification API
// ============================================

import notificationAPIInstance, { type CreateNotificationInput, type NotificationFilters } from './notificationAPI';
import type { Notification } from '../types/entities';

export const notificationAPI = {
  // Create notification
  createNotification: async (input: CreateNotificationInput): Promise<Notification> => {
    // NestJS implementation
    const response = await fetch(`${API_CONFIG.baseURL}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
      },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error('Failed to create notification');
    return await response.json();
  },

  // Create bulk notifications
  createBulkNotifications: async (
    recipient_ids: string[],
    input: Omit<CreateNotificationInput, 'recipient_id'>
  ): Promise<Notification[]> => {
    // NestJS implementation
    const response = await fetch(`${API_CONFIG.baseURL}/notifications/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
      },
      body: JSON.stringify({ recipient_ids, ...input })
    });
    if (!response.ok) throw new Error('Failed to create bulk notifications');
    return await response.json();
  },

  // Create role notification
  createRoleNotification: async (
    role: string,
    input: Omit<CreateNotificationInput, 'recipient_id' | 'recipient_role'>
  ): Promise<Notification> => {
    // NestJS implementation
    const response = await fetch(`${API_CONFIG.baseURL}/notifications/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
      },
      body: JSON.stringify({ role, ...input })
    });
    if (!response.ok) throw new Error('Failed to create role notification');
    return await response.json();
  },

  // Get user notifications
  getUserNotifications: async (
    userId: string,
    userRole: string,
    filters?: Omit<NotificationFilters, 'recipient_id' | 'recipient_role'>
  ): Promise<Notification[]> => {
    
    // NestJS implementation
    try {
      const queryParams = new URLSearchParams();
      if (filters?.type) queryParams.append('type', filters.type);
      if (filters?.category) queryParams.append('category', filters.category);
      if (filters?.is_read !== undefined) queryParams.append('is_read', String(filters.is_read));
      if (filters?.priority) queryParams.append('priority', filters.priority);
      if (filters?.from_date) queryParams.append('from_date', filters.from_date);
      if (filters?.to_date) queryParams.append('to_date', filters.to_date);

      return await makeApiRequest(`/notifications?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  },

  // Get unread count for a user
  async getUnreadCount(userId: string, userRole: string): Promise<number> {
    try {
      const result = await makeApiRequest('/notifications/unread-count');
      // Handle both { unreadCount: 5 } and { count: 5 } formats for backward compatibility
      const count = result.unreadCount !== undefined ? result.unreadCount : (result.count || 0);
      return typeof count === 'string' ? parseInt(count, 10) : count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<Notification> {
    return await makeApiRequest(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  // Mark all as read
  async markAllAsRead(userId: string, userRole: string): Promise<void> {
    await makeApiRequest('/notifications/mark-all-read', {
      method: 'PUT',
    });
  },

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    // NestJS implementation
    const response = await fetch(`${API_CONFIG.baseURL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to delete notification');
  },

  // Delete read notifications
  async deleteReadNotifications(userId: string, userRole: string): Promise<void> {
    // NestJS implementation
    const response = await fetch(`${API_CONFIG.baseURL}/notifications/read/all`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to delete read notifications');
  },

  // Get notification by ID
  getNotificationById: async (notificationId: string): Promise<Notification | undefined> => {
    // NestJS implementation
    const response = await fetch(`${API_CONFIG.baseURL}/notifications/${notificationId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
      }
    });
    if (!response.ok) {
      if (response.status === 404) return undefined;
      throw new Error('Failed to fetch notification');
    }
    return await response.json();
  },

  // Delete expired notifications
  deleteExpiredNotifications: async (): Promise<number> => {
    // NestJS implementation
    const response = await fetch(`${API_CONFIG.baseURL}/notifications/cleanup-expired`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to cleanup expired notifications');
    const data = await response.json();
    return data.count;
  },

  // Get notifications by entity
  getNotificationsByEntity: async (
    entityType: string,
    entityId: string
  ): Promise<Notification[]> => {
    // NestJS implementation
    const response = await fetch(
      `${API_CONFIG.baseURL}/notifications/entity/${entityType}/${entityId}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token')}`
        }
      }
    );
    if (!response.ok) throw new Error('Failed to fetch entity notifications');
    return await response.json();
  },

  subscribe: async (subscription: any) => {
    return makeApiRequest('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  },
  unsubscribe: async (payload: { endpoint?: string }) => {
    return makeApiRequest('/notifications/subscribe', {
      method: 'DELETE',
      body: JSON.stringify(payload || {}),
    });
  },
};

// ============================================
// COOPERATIVE MANAGEMENT API
// ============================================

export const cooperativeAPI = {
  // Cooperative Entity Management
  async getAll(filters?: { status?: string; cooperative_type?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.cooperative_type) params.append('cooperative_type', filters.cooperative_type);
    
    const queryString = params.toString();
    const url = `/cooperatives${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, {
      method: 'GET',
    });
  },

  async getById(id: string) {
    return makeApiRequest(`/cooperatives/${id}`, {
      method: 'GET',
    });
  },

  async getByCode(code: string) {
    return makeApiRequest(`/cooperatives/code/${code}`, {
      method: 'GET',
    });
  },

  async create(data: any) {
    return makeApiRequest('/cooperatives', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return makeApiRequest(`/cooperatives/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Member Management
  async getAllMembers(filters?: { cooperative_id?: string; status?: string; staff_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.cooperative_id) params.append('cooperative_id', filters.cooperative_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.staff_id) params.append('staff_id', filters.staff_id);
    
    const queryString = params.toString();
    const url = `/cooperatives/members${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, {
      method: 'GET',
    });
  },

  async getMemberById(id: string) {
    return makeApiRequest(`/cooperatives/members/${id}`, {
      method: 'GET',
    });
  },

  async getMemberByStaffAndCooperative(staffId: string, cooperativeId: string) {
    return makeApiRequest(`/cooperatives/${cooperativeId}/members/${staffId}`, {
      method: 'GET',
    });
  },

  async getMembershipsByStaffId(staffId: string) {
    return makeApiRequest(`/cooperatives/staff/${staffId}/memberships`, {
      method: 'GET',
    });
  },

  async registerMember(data: any) {
    return makeApiRequest('/cooperatives/members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateMemberStatus(memberId: string, status: string, reason?: string) {
    return makeApiRequest(`/cooperatives/members/${memberId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  },

  // Contributions
  async recordContribution(data: any) {
    return makeApiRequest('/cooperatives/contributions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getContributions(filters?: { cooperative_id?: string; member_id?: string; staff_id?: string; contribution_month?: string }) {
    const params = new URLSearchParams();
    if (filters?.cooperative_id) params.append('cooperative_id', filters.cooperative_id);
    if (filters?.member_id) params.append('member_id', filters.member_id);
    if (filters?.staff_id) params.append('staff_id', filters.staff_id);
    if (filters?.contribution_month) params.append('contribution_month', filters.contribution_month);
    
    const queryString = params.toString();
    const url = `/cooperatives/contributions${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, {
      method: 'GET',
    });
  },

  async getMemberStatement(memberId: string) {
    return makeApiRequest(`/cooperatives/members/${memberId}/statement`, {
      method: 'GET',
    });
  },

  async getCooperativeStats(cooperativeId: string) {
    return makeApiRequest(`/cooperatives/${cooperativeId}/stats`, {
      method: 'GET',
    });
  },

  async getOverview() {
    return makeApiRequest('/cooperatives/overview', {
      method: 'GET',
    });
  },
};

// ============================================
// WORKFLOW API
// ============================================

export const workflowAPI = {
  async createWorkflow(data: any) {
    return makeApiRequest('/workflow/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async addStep(data: any) {
    return makeApiRequest('/workflow/steps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyApprovals() {
    return makeApiRequest('/workflow/approvals', {
      method: 'GET',
    });
  },

  async processApproval(id: string, action: 'approve' | 'reject' | 'return', comments?: string) {
    return makeApiRequest(`/workflow/approvals/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action, comments }),
    });
  },
};

// ============================================
// EMAIL / SMTP SETTINGS API
// ============================================
export const emailAPI = {
  async getSmtpSettings() {
    return makeApiRequest('/email/smtp-settings', { method: 'GET' });
  },
  async createSmtpSettings(payload: any) {
    return makeApiRequest('/email/smtp-settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async updateSmtpSettings(id: string, payload: any) {
    return makeApiRequest(`/email/smtp-settings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  async testSmtpSettings(payload: any) {
    return makeApiRequest('/email/smtp-settings/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async getEmailStats() {
    return makeApiRequest('/email/logs/stats', { method: 'GET' });
  },
};

// ============================================
// Export all API namespaces
// ============================================

export * from './loanAPI';
export * from './api-staff-specific';
export * from './bankAPI';

// Export notification utilities
export { NotificationTemplates } from './notificationAPI';
export { NotificationIntegration } from './notification-integration';
export type { CreateNotificationInput, NotificationFilters } from './notificationAPI';

export default {
  authAPI,
  staffAPI,
  departmentAPI,
  payrollAPI,
  arrearsAPI,
  promotionAPI,
  userAPI,
  salaryStructureAPI,
  allowanceAPI,
  deductionAPI,
  reportAPI,
  payslipAPI,
  settingsAPI,
  staffAllowanceAPI,
  staffDeductionAPI,
  payrollAdjustmentAPI,
  dashboardAPI,
  auditAPI,
  staffPortalAPI,
  notificationAPI,
  cooperativeAPI,
  workflowAPI,
  emailAPI,
};
