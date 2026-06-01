// Loan Management API - NestJS Backend Integration
// Handles Loan Applications, Approvals, Disbursements, Repayments, and Cooperative Management
// V2.0 - Direct backend calls (IndexedDB removed)

import type {
  LoanType,
  LoanApplication,
  Cooperative,
  CooperativeMember,
  CooperativeContribution,
} from '../types/entities';

// Helper function to make API requests
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api/v1';

async function makeApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('jsc_auth_token') || ''}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ==================== LOAN TYPES MANAGEMENT ====================

export const loanTypeAPI = {
  // Get all loan types
  async getAll(filters?: { status?: 'active' | 'inactive' }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    const url = `/loans/types${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, { method: 'GET' });
  },

  // Get loan type by ID
  async getById(id: string) {
    return makeApiRequest(`/loans/types/${id}`, { method: 'GET' });
  },

  // Create new loan type
  async create(data: Omit<LoanType, 'id' | 'created_at' | 'updated_at'>) {
    return makeApiRequest('/loans/types', { method: 'POST', body: JSON.stringify(data) });
  },

  // Update loan type
  async update(id: string, data: Partial<LoanType>) {
    return makeApiRequest(`/loans/types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  // Delete loan type
  async delete(id: string) {
    return makeApiRequest(`/loans/types/${id}`, { method: 'DELETE' });
  },
};

// ==================== LOAN APPLICATIONS ====================

export const loanApplicationAPI = {
  // Get all loan applications
  async getAll(filters?: {
    staff_id?: string;
    status?: string;
    loan_type_id?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.staff_id) params.append('staff_id', filters.staff_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.loan_type_id) params.append('loan_type_id', filters.loan_type_id);
    
    const queryString = params.toString();
    const url = `/loans/applications${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, { method: 'GET' });
  },

  // Get loan application by ID
  async getById(id: string) {
    const application = await makeApiRequest(`/loans/applications/${id}`, { method: 'GET' });
    if (!application) return null;

    // Get guarantors
    const guarantors = await makeApiRequest(`/loans/guarantors?loan_application_id=${id}`, { method: 'GET' });
    
    return {
      ...application,
      guarantors,
    };
  },

  // Create loan application (draft)
  async create(data: {
    staff_id?: string;
    loan_type_id?: string;
    amount_requested?: number;
    purpose?: string;
    tenure_months?: number;
    staffId?: string;
    loanTypeId?: string;
    requestedAmount?: number;
    tenureMonths?: number;
    guarantors?: Array<{ staff_id?: string; staffId?: string; remarks?: string }>;
  }) {
    const staffId = data.staffId || data.staff_id;
    const loanTypeId = data.loanTypeId || data.loan_type_id;
    const requestedAmount = data.requestedAmount ?? data.amount_requested;
    const tenureMonths = data.tenureMonths ?? data.tenure_months;
    const guarantors = Array.isArray(data.guarantors) ? data.guarantors : [];

    const payload = {
      staffId,
      loanTypeId,
      requestedAmount: typeof requestedAmount === 'string' ? parseFloat(requestedAmount) : requestedAmount,
      tenureMonths: typeof tenureMonths === 'string' ? parseInt(tenureMonths, 10) : tenureMonths,
      purpose: data.purpose,
      guarantors: guarantors.map((g) => ({
        staffId: g.staffId || g.staff_id,
        remarks: g.remarks,
      })),
    };

    return makeApiRequest('/loans/applications', { method: 'POST', body: JSON.stringify(payload) });
  },

  // Submit loan application for approval
  async submit(id: string, guarantors: { staff_id: string }[]) {
    const application = await makeApiRequest(`/loans/applications/${id}`, { method: 'GET' });
    if (!application) throw new Error('Application not found');
    if (application.status !== 'draft') throw new Error('Only draft applications can be submitted');

    const loanType = await makeApiRequest(`/loans/types/${application.loan_type_id}`, { method: 'GET' });
    if (!loanType) throw new Error('Loan type not found');

    // Validate guarantors
    if (loanType.requires_guarantors && guarantors.length < loanType.min_guarantors) {
      throw new Error(`Minimum ${loanType.min_guarantors} guarantors required`);
    }

    // Create guarantor records using the backend DTO shape.
    for (const guarantor of guarantors) {
      await makeApiRequest('/loans/guarantors', {
        method: 'POST',
        body: JSON.stringify({
          loanApplicationId: id,
          guarantorStaffId: guarantor.staff_id,
        }),
      });
    }

    return makeApiRequest(`/loans/applications/${id}/submit`, { method: 'PUT' });
  },

  // Approve/Reject loan application
  async processApproval(
    id: string,
    approverId: string,
    approverName: string,
    action: 'approved' | 'rejected',
    comments?: string,
    approvedAmount?: number
  ) {
    if (action === 'approved') {
      let amount = approvedAmount;
      
      // If amount not provided, fetch application to get requested amount
      if (!amount) {
        const application = await makeApiRequest(`/loans/applications/${id}`, { method: 'GET' });
        if (!application) throw new Error('Application not found');
        amount = application.amount_requested;
      }

      const payload = {
        approvedAmount: amount,
        remarks: comments
      };
      return makeApiRequest(`/loans/applications/${id}/approve`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      const payload = {
        remarks: comments || 'No reason provided'
      };
      return makeApiRequest(`/loans/applications/${id}/reject`, { method: 'PATCH', body: JSON.stringify(payload) });
    }
  },

  // Cancel loan application
  async cancel(id: string) {
    const application = await makeApiRequest(`/loans/applications/${id}`, { method: 'GET' });
    if (!application) throw new Error('Application not found');

    const updated: LoanApplication = {
      ...application,
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    };

    return makeApiRequest(`/loans/applications/${id}`, { method: 'PUT', body: JSON.stringify(updated) });
  },

  // Get staff loan eligibility
  async checkEligibility(staffId: string, loanTypeId: string, amount: number) {
    const staff = await makeApiRequest(`/staff/${staffId}`, { method: 'GET' });
    if (!staff) throw new Error('Staff not found');

    const loanType = await makeApiRequest(`/loans/types/${loanTypeId}`, { method: 'GET' });
    if (!loanType) throw new Error('Loan type not found');

    const errors: string[] = [];

    // Check years of service
    if (loanType.min_service_years) {
      const yearsOfService = Math.floor(
        (new Date().getTime() - new Date(staff.appointment.date_of_first_appointment).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
      );
      if (yearsOfService < loanType.min_service_years) {
        errors.push(`Minimum ${loanType.min_service_years} years of service required`);
      }
    }

    // Check maximum amount
    if (loanType.max_amount && amount > loanType.max_amount) {
      errors.push(`Maximum loan amount is ₦${loanType.max_amount.toLocaleString()}`);
    }

    // Check maximum salary percentage (would need salary calculation)
    // This is placeholder - in production, calculate actual current salary
    const estimatedSalary = 50000; // Placeholder
    const maxAllowed = (estimatedSalary * loanType.max_salary_percentage) / 100;
    if (amount > maxAllowed) {
      errors.push(`Amount exceeds ${loanType.max_salary_percentage}% of monthly salary`);
    }

    // Check outstanding loans
    const existingLoans = await makeApiRequest(`/loans/disbursements?staff_id=${staffId}`, { method: 'GET' });
    const activeLoans = existingLoans.filter((loan: any) => loan.status === 'active');
    if (activeLoans.length > 0) {
      errors.push('Staff has outstanding loan(s)');
    }

    return {
      eligible: errors.length === 0,
      errors,
    };
  },
};

// ==================== GUARANTOR MANAGEMENT ====================

export const guarantorAPI = {
  // Get guarantor requests (for staff who are guarantors)
  async getMyGuarantorRequests(staffId: string) {
    const guarantors = await makeApiRequest(`/loans/guarantors?guarantor_staff_id=${staffId}`, { method: 'GET' });
    
    // Get application details for each
    const requests = await Promise.all(
      guarantors.map(async (guarantor: any) => {
        const application = await makeApiRequest(`/loans/applications/${guarantor.loan_application_id}`, { method: 'GET' });
        return {
          ...guarantor,
          application,
        };
      })
    );

    return requests.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  // Accept/Decline guarantor request
  async respondToRequest(id: string, action: 'accepted' | 'declined', comments?: string) {
    const guarantor = await makeApiRequest(`/loans/guarantors/${id}`, { method: 'GET' });
    if (!guarantor) throw new Error('Guarantor request not found');

    return makeApiRequest(`/loans/guarantors/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        consentStatus: action,
        consentDate: new Date().toISOString(),
        consentComments: comments,
      }),
    });
  },
};

// ==================== LOAN DISBURSEMENT ====================

export const disbursementAPI = {
  // Get all disbursements
  async getAll(filters?: { staff_id?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.staff_id) params.append('staff_id', filters.staff_id);
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    const url = `/loans/disbursements${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, { method: 'GET' });
  },

  // Get disbursement by ID
  async getById(id: string) {
    return makeApiRequest(`/loans/disbursements/${id}`, { method: 'GET' });
  },

  // Disburse approved loan
  async create(data: {
    loan_application_id: string;
    disbursement_method: 'bank_transfer' | 'cash' | 'cheque';
    bank_name?: string;
    account_number?: string;
    reference_number?: string;
    disbursed_by: string;
    amount?: number;
    disbursement_date?: string;
    remarks?: string;
    account_name?: string;
  }) {
    const application = await makeApiRequest(`/loans/applications/${data.loan_application_id}`, { method: 'GET' });
    if (!application) throw new Error('Application not found');
    if (application.status !== 'approved') throw new Error('Only approved applications can be disbursed');

    // Use backend logic instead of client-side logic
    const payload = {
      loanApplicationId: data.loan_application_id,
      disbursementDate: data.disbursement_date || new Date().toISOString(),
      amount: data.amount || application.amount_approved || application.amount_requested,
      remarks: data.remarks || data.reference_number, // Map reference number to remarks if needed, or just send remarks
      bankName: data.bank_name,
      accountNumber: data.account_number,
      accountName: data.account_name,
    };

    return makeApiRequest('/loans/disbursements', { method: 'POST', body: JSON.stringify(payload) });
  },

  // Get loan statement
  async getStatement(disbursementId: string) {
    const disbursement = await makeApiRequest(`/loans/disbursements/${disbursementId}`, { method: 'GET' });
    if (!disbursement) throw new Error('Disbursement not found');

    const repayments = await makeApiRequest(`/loans/repayments?disbursement_id=${disbursementId}`, { method: 'GET' });

    const totalAmount = disbursement.total_amount ?? disbursement.amount_disbursed ?? disbursement.principal_amount ?? 0;
    const totalRepaid = disbursement.total_repaid ?? 0;
    const balanceOutstanding = disbursement.balance_outstanding ?? 0;
    const tenureMonths = disbursement.tenure_months ?? 0;
    const normalizedRepayments = repayments.map((repayment: any) => ({
      ...repayment,
      repayment_month: repayment.repayment_month ?? repayment.month,
      amount_paid: repayment.amount_paid ?? repayment.amount,
      balance_after_payment: repayment.balance_after_payment ?? 0,
      payment_method: repayment.payment_method ?? (repayment.payroll_batch_id ? 'payroll_deduction' : 'direct_payment'),
      payment_date: repayment.payment_date ?? repayment.repayment_date,
    }));

    return {
      disbursement,
      repayments: normalizedRepayments.sort((a: any, b: any) => a.repayment_month.localeCompare(b.repayment_month)),
      summary: {
        total_amount: totalAmount,
        total_repaid: totalRepaid,
        balance_outstanding: balanceOutstanding,
        months_paid: normalizedRepayments.length,
        months_remaining: Math.max(0, tenureMonths - normalizedRepayments.length),
      },
    };
  },
};

export const loanMigrationAPI = {
  async importMigrationData(data: {
    dryRun?: boolean;
    loans?: any[];
    repayments?: any[];
  }) {
    return makeApiRequest('/loans/migration/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ==================== LOAN REPAYMENTS ====================

export const repaymentAPI = {
  // Pay off a loan in full
  async payOff(data: {
    disbursementId: string;
    amount: number;
    month?: string;
  }) {
    const repaymentMonth = data.month || new Date().toISOString().slice(0, 7);
    return makeApiRequest('/loans/repayments', {
      method: 'POST',
      body: JSON.stringify({
        disbursementId: data.disbursementId,
        amount: data.amount,
        month: repaymentMonth,
      }),
    });
  },

  // Record loan repayment (usually from payroll)
  async create(data: {
    disbursement_id: string;
    repayment_month: string;
    amount_paid: number;
    payroll_batch_id?: string;
    payment_method: 'payroll_deduction' | 'direct_payment' | 'bank_transfer';
    payment_reference?: string;
  }) {
    const disbursement = await makeApiRequest(`/loans/disbursements/${data.disbursement_id}`, { method: 'GET' });
    if (!disbursement) throw new Error('Disbursement not found');

    return makeApiRequest('/loans/repayments', {
      method: 'POST',
      body: JSON.stringify({
        disbursementId: data.disbursement_id,
        amount: data.amount_paid,
        month: data.repayment_month,
        payrollBatchId: data.payroll_batch_id,
      }),
    });
  },

  // Get staff repayments
  async getByStaff(staffId: string) {
    return makeApiRequest(`/loans/repayments?staff_id=${staffId}`, { method: 'GET' });
  },

  // Get pending monthly deductions (for payroll integration)
  async getPendingDeductions(month: string) {
    const allDisbursements = await makeApiRequest('/loans/disbursements', { method: 'GET' });
    const activeDisbursements = allDisbursements.filter((d: any) => 
      d.status === 'active' && 
      d.start_deduction_month <= month && 
      d.end_deduction_month >= month
    );

    // Check if already paid for this month
    const pendingDeductions = [];
    for (const disbursement of activeDisbursements) {
      const existingPayment = await makeApiRequest(
        `/loans/repayments?disbursement_id=${disbursement.id}`,
        { method: 'GET' }
      );
      const alreadyPaid = existingPayment.some((r: any) => r.repayment_month === month);
      
      if (!alreadyPaid) {
        pendingDeductions.push({
          disbursement_id: disbursement.id,
          staff_id: disbursement.staff_id,
          staff_number: disbursement.staff_number,
          staff_name: disbursement.staff_name,
          loan_type: disbursement.loan_type_name,
          monthly_deduction: disbursement.monthly_deduction,
          balance_outstanding: disbursement.balance_outstanding,
        });
      }
    }

    return pendingDeductions;
  },
};

// ==================== COOPERATIVE MANAGEMENT ====================

export const cooperativeAPI = {
  // ========== COOPERATIVE ENTITY MANAGEMENT ==========

  // Get all cooperatives
  async getAll(filters?: { status?: 'active' | 'inactive' | 'suspended'; cooperative_type?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.cooperative_type) params.append('cooperative_type', filters.cooperative_type);
    
    const queryString = params.toString();
    const url = `/cooperatives${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, { method: 'GET' });
  },

  // Get cooperative by ID
  async getById(id: string) {
    return makeApiRequest(`/cooperatives/${id}`, { method: 'GET' });
  },

  // Get cooperative by code
  async getByCode(code: string) {
    const cooperatives = await makeApiRequest('/cooperatives', { method: 'GET' });
    return cooperatives.find((c: any) => c.code === code) || null;
  },

  // Create new cooperative
  async create(data: any) {
    return makeApiRequest('/cooperatives', { method: 'POST', body: JSON.stringify(data) });
  },

  // Update cooperative
  async update(id: string, data: Partial<Cooperative>) {
    return makeApiRequest(`/cooperatives/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  // Delete cooperative
  async delete(id: string) {
    return makeApiRequest(`/cooperatives/${id}`, { method: 'DELETE' });
  },

  // ========== MEMBER MANAGEMENT ==========

  // Get all members (optionally filter by cooperative)
  async getAllMembers(filters?: { cooperative_id?: string; status?: string; staff_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.cooperative_id) params.append('cooperative_id', filters.cooperative_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.staff_id) params.append('staff_id', filters.staff_id);
    
    const queryString = params.toString();
    const url = `/cooperatives/members${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, { method: 'GET' });
  },

  // Get member by ID
  async getMemberById(id: string) {
    return makeApiRequest(`/cooperatives/members/${id}`, { method: 'GET' });
  },

  // Get member by staff ID and cooperative ID
  async getMemberByStaffAndCooperative(staffId: string, cooperativeId: string) {
    const members = await makeApiRequest(`/cooperatives/members?staff_id=${staffId}&cooperative_id=${cooperativeId}`, { method: 'GET' });
    return members.find((m: any) => m.staff_id === staffId && m.cooperative_id === cooperativeId) || null;
  },

  // Get all memberships for a staff
  async getMembershipsByStaffId(staffId: string) {
    return makeApiRequest(`/cooperatives/members?staff_id=${staffId}`, { method: 'GET' });
  },

  // Register new member
  async registerMember(data: {
    cooperative_id: string;
    staff_id: string;
    monthly_contribution: number;
    shares_owned?: number;
  }) {
    // Map to backend DTO expectations
    const payload = {
      cooperativeId: data.cooperative_id,
      staffId: data.staff_id,
      monthlyContribution: data.monthly_contribution,
      shares_owned: data.shares_owned
    };
    return makeApiRequest('/cooperatives/members', { method: 'POST', body: JSON.stringify(payload) });
  },

  // Record contribution
  async recordContribution(data: {
    cooperative_id: string;
    member_id: string;
    contribution_month: string;
    amount: number;
    contribution_type: 'regular' | 'voluntary' | 'share_capital' | 'special_levy';
    payroll_batch_id?: string;
    payment_method: 'payroll_deduction' | 'cash' | 'bank_transfer';
    receipt_number?: string;
  }) {
    // Map to backend DTO expectations
    const payload = {
      cooperativeId: data.cooperative_id,
      memberId: data.member_id,
      amount: data.amount,
      month: data.contribution_month,
      payrollBatchId: data.payroll_batch_id,
      contributionType: data.contribution_type,
      paymentMethod: data.payment_method,
      contribution_type: data.contribution_type,
      payment_method: data.payment_method,
      receipt_number: data.receipt_number
    };
    return makeApiRequest('/cooperatives/contributions', { method: 'POST', body: JSON.stringify(payload) });
  },

  // Delete contribution
  async deleteContribution(id: string) {
    return makeApiRequest(`/cooperatives/contributions/${id}`, { method: 'DELETE' });
  },

  // Get contributions (optionally filter)
  async getContributions(filters?: { 
    cooperative_id?: string; 
    member_id?: string; 
    staff_id?: string;
    contribution_month?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.cooperative_id) params.append('cooperative_id', filters.cooperative_id);
    if (filters?.member_id) params.append('member_id', filters.member_id);
    if (filters?.staff_id) params.append('staff_id', filters.staff_id);
    if (filters?.contribution_month) params.append('contribution_month', filters.contribution_month);
    
    const queryString = params.toString();
    const url = `/cooperatives/contributions/all${queryString ? `?${queryString}` : ''}`;
    
    return makeApiRequest(url, { method: 'GET' });
  },

  // Get member statement
  async getMemberStatement(memberId: string) {
    return makeApiRequest(`/cooperatives/members/${memberId}/statement`, { method: 'GET' });
  },

  // Process withdrawal
  async withdraw(data: { memberId: string; amount: number; reason?: string }) {
    return makeApiRequest('/cooperatives/withdrawals', { method: 'POST', body: JSON.stringify(data) });
  },

  // Distribute dividends
  async distributeDividends(cooperativeId: string, totalAmount: number) {
    return makeApiRequest(`/cooperatives/${cooperativeId}/dividends`, { 
      method: 'POST', 
      body: JSON.stringify({ totalAmount }) 
    });
  },

  // Cooperative migration import (cooperatives, members, opening balances, contributions)
  async importMigrationData(data: {
    dryRun?: boolean;
    cooperatives?: any[];
    members?: any[];
    openingBalances?: any[];
    contributions?: any[];
  }) {
    return makeApiRequest('/cooperatives/migration/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateMember(
    memberId: string,
    data: {
      monthly_contribution?: number;
      shares_owned?: number;
      monthlyContribution?: number;
      sharesOwned?: number;
    },
  ) {
    const monthlyContribution = data.monthlyContribution ?? data.monthly_contribution;
    const shares_owned = data.shares_owned ?? data.sharesOwned;
    const payload: any = {};
    if (monthlyContribution !== undefined) payload.monthlyContribution = monthlyContribution;
    if (shares_owned !== undefined) payload.shares_owned = shares_owned;

    return makeApiRequest(`/cooperatives/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Update member status
  async updateMemberStatus(memberId: string, status: 'active' | 'inactive' | 'suspended', reason?: string) {
    const member = await makeApiRequest(`/cooperatives/members/${memberId}`, { method: 'GET' });
    if (!member) throw new Error('Member not found');

    const updated: CooperativeMember = {
      ...member,
      status,
      suspension_reason: status === 'suspended' ? reason : undefined,
      exit_date: status === 'inactive' ? new Date().toISOString() : member.exit_date,
      updated_at: new Date().toISOString(),
    };

    return makeApiRequest(`/cooperatives/members/${memberId}`, { method: 'PUT', body: JSON.stringify(updated) });
  },

  // Delete member
  async deleteMember(memberId: string) {
    return makeApiRequest(`/cooperatives/members/${memberId}`, { method: 'DELETE' });
  },

  // Get cooperative statistics
  async getCooperativeStats(cooperativeId: string) {
    return makeApiRequest(`/cooperatives/${cooperativeId}/stats`, { method: 'GET' });
  },
};

// ==================== STATISTICS & REPORTS ====================

export const loanStatsAPI = {
  // Get overview statistics
  async getOverview() {
    const applications = await makeApiRequest('/loans/applications', { method: 'GET' });
    const disbursements = await makeApiRequest('/loans/disbursements', { method: 'GET' });
    const members = await makeApiRequest('/cooperatives/members', { method: 'GET' });

    const toNumber = (value: unknown) => Number(value || 0);
    const activeDisbursements = disbursements.filter((d: any) => d.status === 'active');
    const pendingApplications = applications.filter((a: any) =>
      ['pending', 'guarantor_pending', 'under_review'].includes(String(a.status)),
    );

    return {
      total_applications: applications.length,
      pending_applications: pendingApplications.length,
      approved_applications: applications.filter((a: any) => a.status === 'approved').length,
      rejected_applications: applications.filter((a: any) => a.status === 'rejected').length,
      active_loans: activeDisbursements.length,
      completed_loans: disbursements.filter((d: any) => d.status === 'completed').length,
      total_disbursed: disbursements.reduce(
        (sum: number, d: any) => sum + toNumber(d.amount_disbursed ?? d.principal_amount),
        0,
      ),
      total_outstanding: activeDisbursements.reduce((sum: number, d: any) => sum + toNumber(d.balance_outstanding), 0),
      total_repaid: disbursements.reduce((sum: number, d: any) => sum + toNumber(d.total_repaid), 0),
      cooperative_members: members.filter((m: any) => m.status === 'active').length,
      total_contributions: members.reduce((sum: number, m: any) => sum + toNumber(m.total_contributions), 0),
    };
  },

  // Get loan type statistics
  async getLoanTypeStats() {
    const applications = await makeApiRequest('/loans/applications', { method: 'GET' });
    const loanTypes = await makeApiRequest('/loans/types', { method: 'GET' });

    return loanTypes.map((type: any) => {
      const typeApplications = applications.filter((a: any) => a.loan_type_id === type.id);
      const approved = typeApplications.filter((a: any) => a.status === 'approved' || a.status === 'disbursed');
      
      return {
        loan_type: type.name,
        total_applications: typeApplications.length,
        approved: approved.length,
        total_amount: approved.reduce((sum: any, a: any) => sum + parseFloat(a.amount_requested || 0), 0),
      };
    });
  },
};

// Seed default loan types
export async function seedLoanTypes(userId: string) {
  const existingTypes = await makeApiRequest('/loans/types', { method: 'GET' });
  if (existingTypes.length > 0) return;

  const defaultLoanTypes: Omit<LoanType, 'id' | 'created_at' | 'updated_at'>[] = [
    {
      name: 'Salary Advance',
      code: 'SAL_ADV',
      description: 'Short-term salary advance for staff',
      interest_rate: 5,
      max_amount: 500000,
      max_tenure_months: 6,
      min_service_years: 1,
      max_salary_percentage: 50,
      requires_guarantors: false,
      min_guarantors: 0,
      eligibility_criteria: 'Minimum 1 year of service, no outstanding loans',
      status: 'active',
      created_by: userId,
    },
    {
      name: 'Car Loan',
      code: 'CAR',
      description: 'Loan for purchase of personal vehicle',
      interest_rate: 10,
      max_amount: 5000000,
      max_tenure_months: 48,
      min_service_years: 3,
      max_salary_percentage: 40,
      requires_guarantors: true,
      min_guarantors: 2,
      eligibility_criteria: 'Minimum 3 years of service, Grade Level 7 and above',
      status: 'active',
      created_by: userId,
    },
    {
      name: 'Housing Loan',
      code: 'HOUSE',
      description: 'Loan for building or purchasing residential property',
      interest_rate: 12,
      max_amount: 10000000,
      max_tenure_months: 120,
      min_service_years: 5,
      max_salary_percentage: 30,
      requires_guarantors: true,
      min_guarantors: 2,
      eligibility_criteria: 'Minimum 5 years of service, Grade Level 10 and above',
      status: 'active',
      created_by: userId,
    },
    {
      name: 'Educational Loan',
      code: 'EDU',
      description: 'Loan for staff or dependents education/training',
      interest_rate: 8,
      max_amount: 2000000,
      max_tenure_months: 36,
      min_service_years: 2,
      max_salary_percentage: 35,
      requires_guarantors: true,
      min_guarantors: 1,
      eligibility_criteria: 'Minimum 2 years of service, valid admission letter required',
      status: 'active',
      created_by: userId,
    },
    {
      name: 'Emergency Loan',
      code: 'EMERG',
      description: 'Quick loan for emergency situations',
      interest_rate: 6,
      max_amount: 300000,
      max_tenure_months: 12,
      min_service_years: 1,
      max_salary_percentage: 30,
      requires_guarantors: false,
      min_guarantors: 0,
      eligibility_criteria: 'Emergency situation documented',
      status: 'active',
      created_by: userId,
    },
    {
      name: 'Cooperative Loan',
      code: 'COOP',
      description: 'Loan for cooperative society members',
      interest_rate: 7,
      max_amount: 1500000,
      max_tenure_months: 24,
      min_service_years: 2,
      max_salary_percentage: 45,
      requires_guarantors: true,
      min_guarantors: 2,
      eligibility_criteria: 'Active cooperative member for at least 6 months',
      status: 'active',
      created_by: userId,
    },
  ];

  for (const loanType of defaultLoanTypes) {
    await loanTypeAPI.create(loanType);
  }
}
