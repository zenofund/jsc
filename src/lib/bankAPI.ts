// Bank Payment & Reconciliation API - NestJS Backend Integration
// Handles salary disbursement, bank file generation, and reconciliation
// V2.0 - Direct backend calls (IndexedDB removed)

import type {
  BankAccount,
  PaymentBatch,
  PaymentTransaction,
  BankStatement,
  BankStatementLine,
  PaymentReconciliation,
  PaymentException,
  PayrollBatch,
  PayrollLine,
  Staff,
} from '../types/entities';

import { NIGERIAN_BANKS } from '../constants/banks';

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
    cache: 'no-store',
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

// ==================== BANK ACCOUNT MANAGEMENT ====================

export const bankAccountAPI = {
  async create(data: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<BankAccount> {
    return makeApiRequest('/bank/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAll(): Promise<BankAccount[]> {
    return makeApiRequest(`/bank/accounts?_t=${Date.now()}`, { method: 'GET' });
  },

  async getById(id: string): Promise<BankAccount | null> {
    try {
      return await makeApiRequest(`/bank/accounts/${id}?_t=${Date.now()}`, { method: 'GET' });
    } catch {
      return null;
    }
  },

  async getActive(): Promise<BankAccount[]> {
    return makeApiRequest(`/bank/accounts?is_active=true&_t=${Date.now()}`, { method: 'GET' });
  },

  async update(id: string, data: Partial<BankAccount>): Promise<void> {
    await makeApiRequest(`/bank/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ==================== PAYMENT BATCH MANAGEMENT ====================

export const paymentBatchAPI = {
  async createFromPayroll(
    payrollBatchId: string,
    bankAccountId: string | null,
    paymentMethod: PaymentBatch['payment_method'],
    fileFormat: PaymentBatch['file_format'],
    userId: string,
    userName: string
  ): Promise<PaymentBatch> {
    return makeApiRequest('/bank/payment-batches', {
      method: 'POST',
      body: JSON.stringify({
        payrollBatchId,
        bankAccountId,
        paymentMethod,
        fileFormat,
        userId,
        userName,
      }),
    });
  },

  async getAll(): Promise<PaymentBatch[]> {
    return makeApiRequest(`/bank/payment-batches?_t=${Date.now()}`, { method: 'GET' });
  },

  async getById(id: string): Promise<PaymentBatch | null> {
    try {
      return await makeApiRequest(`/bank/payment-batches/${id}?_t=${Date.now()}`, { method: 'GET' });
    } catch {
      return null;
    }
  },

  async getTransactions(batchId: string): Promise<PaymentTransaction[]> {
    return makeApiRequest(`/bank/payment-batches/${batchId}/transactions?_t=${Date.now()}`, { method: 'GET' });
  },

  async updateStatus(id: string, status: PaymentBatch['status']): Promise<void> {
    await makeApiRequest(`/bank/payment-batches/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async generateFile(id: string): Promise<{ content: string; filename: string }> {
    return makeApiRequest(`/bank/payment-batches/${id}/generate-file`, { method: 'POST' });
  },

  async executePayments(id: string, reference: string): Promise<void> {
    await makeApiRequest(`/bank/payment-batches/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ reference }),
    });
  },

  async confirmCompletion(id: string): Promise<void> {
    await makeApiRequest(`/bank/payment-batches/${id}/confirm`, { method: 'POST' });
  },

  async retryFailedTransaction(transactionId: string): Promise<void> {
    await makeApiRequest(`/bank/transactions/${transactionId}/retry`, { method: 'POST' });
  },

  // Alias methods for backward compatibility
  async generatePaymentFile(id: string): Promise<{ content: string; filename: string }> {
    return this.generateFile(id);
  },

  async processPayment(id: string): Promise<void> {
    // Process payment by executing it
    // In the backend, this should handle the actual payment initiation
    await makeApiRequest(`/bank/payment-batches/${id}/process`, {
      method: 'POST',
    });
  },

  async approveForPayment(id: string, approverId: string, approverName: string): Promise<void> {
    await makeApiRequest(`/bank/payment-batches/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverId, approverName }),
    });
  },
};

// ==================== BANK STATEMENT MANAGEMENT ====================

export const bankStatementAPI = {
  async upload(
    bankAccountId: string,
    fileName: string,
    statementDate: string,
    openingBalance: number,
    closingBalance: number,
    userId: string,
    userName: string
  ): Promise<BankStatement> {
    return makeApiRequest('/bank/statements', {
      method: 'POST',
      body: JSON.stringify({
        bankAccountId,
        fileName,
        statementDate,
        openingBalance,
        closingBalance,
        userId,
        userName,
      }),
    });
  },

  async parseCSV(statementId: string, csvContent: string): Promise<void> {
    await makeApiRequest(`/bank/statements/${statementId}/parse`, {
      method: 'POST',
      body: JSON.stringify({ csvContent }),
    });
  },

  async getAll(): Promise<BankStatement[]> {
    return makeApiRequest(`/bank/statements?_t=${Date.now()}`, { method: 'GET' });
  },

  async getById(id: string): Promise<BankStatement | null> {
    try {
      return await makeApiRequest(`/bank/statements/${id}?_t=${Date.now()}`, { method: 'GET' });
    } catch {
      return null;
    }
  },

  async getLines(statementId: string): Promise<BankStatementLine[]> {
    return makeApiRequest(`/bank/statements/${statementId}/lines?_t=${Date.now()}`, { method: 'GET' });
  },
};

// ==================== PAYMENT RECONCILIATION ====================

export const reconciliationAPI = {
  async create(paymentBatchId: string, statementId: string, userId: string): Promise<PaymentReconciliation> {
    return makeApiRequest('/bank/reconciliations', {
      method: 'POST',
      body: JSON.stringify({ paymentBatchId, statementId, userId }),
    });
  },

  async autoMatch(reconciliationId: string): Promise<number> {
    const result = await makeApiRequest(`/bank/reconciliations/${reconciliationId}/auto-match`, {
      method: 'POST',
    });
    return result.matchCount || 0;
  },

  async manualMatch(transactionId: string, statementLineId: string, userId: string): Promise<void> {
    await makeApiRequest('/bank/reconciliations/manual-match', {
      method: 'POST',
      body: JSON.stringify({ transactionId, statementLineId, userId }),
    });
  },

  async getAll(): Promise<PaymentReconciliation[]> {
    return makeApiRequest(`/bank/reconciliations?_t=${Date.now()}`, { method: 'GET' });
  },

  async getById(id: string): Promise<PaymentReconciliation | null> {
    try {
      return await makeApiRequest(`/bank/reconciliations/${id}?_t=${Date.now()}`, { method: 'GET' });
    } catch {
      return null;
    }
  },
};

// ==================== PAYMENT EXCEPTIONS ====================

export const paymentExceptionAPI = {
  async create(
    relatedEntityType: 'payment_batch' | 'payment_transaction' | 'reconciliation',
    relatedEntityId: string,
    exceptionType: PaymentException['exception_type'],
    severity: PaymentException['severity'],
    description: string,
    raisedBy: string
  ): Promise<PaymentException> {
    return makeApiRequest('/bank/exceptions', {
      method: 'POST',
      body: JSON.stringify({
        relatedEntityType,
        relatedEntityId,
        exceptionType,
        severity,
        description,
        raisedBy,
      }),
    });
  },

  async getAll(): Promise<PaymentException[]> {
    return makeApiRequest('/bank/exceptions', { method: 'GET' });
  },

  async getById(id: string): Promise<PaymentException | null> {
    try {
      return await makeApiRequest(`/bank/exceptions/${id}`, { method: 'GET' });
    } catch {
      return null;
    }
  },

  async resolve(id: string, resolutionNotes: string, resolvedBy: string): Promise<void> {
    await makeApiRequest(`/bank/exceptions/${id}/resolve`, {
      method: 'PUT',
      body: JSON.stringify({ resolutionNotes, resolvedBy }),
    });
  },

  async escalate(id: string, escalationNotes: string, escalatedBy: string): Promise<void> {
    await makeApiRequest(`/bank/exceptions/${id}/escalate`, {
      method: 'PUT',
      body: JSON.stringify({ escalationNotes, escalatedBy }),
    });
  },
};

// ==================== PAYMENT STATISTICS ====================

export const paymentStatsAPI = {
  async getDashboard(): Promise<any> {
    return makeApiRequest(`/bank/stats/dashboard?_t=${Date.now()}`, { method: 'GET' });
  },
};

// ==================== NIGERIAN BANK LIST ====================

export { NIGERIAN_BANKS } from '../constants/banks';