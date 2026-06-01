import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import {
  paymentBatchAPI,
  bankAccountAPI,
  bankStatementAPI,
  reconciliationAPI,
  paymentExceptionAPI,
  paymentStatsAPI,
} from '../lib/bankAPI';
import { payrollAPI } from '../lib/api-client';
import type {
  PaymentBatch,
  BankStatement,
  PaymentException,
  PayrollBatch,
  BankAccount,
  PaymentTransaction,
} from '../types/entities';
import { NIGERIAN_BANKS } from '../constants/banks';
import {
  DollarSign,
  AlertCircle,
  CheckCircle,
  Download,
  Upload,
  Play,
  CreditCard,
  BarChart3,
  Plus,
  Building2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { Button } from '../components/ui/button';
import { PageSkeleton } from '../components/PageLoader';

type TabType = 'overview' | 'payments' | 'reconciliation' | 'exceptions' | 'bank-accounts';

export function BankPaymentsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatch[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [exceptions, setExceptions] = useState<PaymentException[]>([]);
  
  // Modal states
  const [showCreatePaymentModal, setShowCreatePaymentModal] = useState(false);
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [showAddBankAccountModal, setShowAddBankAccountModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PaymentBatch | null>(null);
  const [batchTransactions, setBatchTransactions] = useState<PaymentTransaction[]>([]);
  
  // Execution Modal state
  const [selectedBatchForExecution, setSelectedBatchForExecution] = useState<PaymentBatch | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Form states
  const [availablePayrolls, setAvailablePayrolls] = useState<PayrollBatch[]>([]);
  const [newPaymentForm, setNewPaymentForm] = useState({
    payroll_batch_id: '',
    bank_account_id: '',
    payment_method: 'bank_transfer' as PaymentBatch['payment_method'],
    file_format: 'custom_csv' as PaymentBatch['file_format'],
  });

  const [newBankAccountForm, setNewBankAccountForm] = useState({
    bank_name: '',
    bank_code: '',
    account_number: '',
    account_name: '',
    account_type: 'salary_disbursement' as BankAccount['account_type'],
    is_active: true,
    api_enabled: false,
  });
  const [showEditBankAccountModal, setShowEditBankAccountModal] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [editBankAccountForm, setEditBankAccountForm] = useState({
    account_name: '',
    is_active: true,
  });
  const canManageBankAccounts = ['admin', 'super_admin', 'payroll_manager'].includes(user?.role || '');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, batches, accounts, exceptionsData] = await Promise.all([
        paymentStatsAPI.getDashboard(),
        paymentBatchAPI.getAll(),
        bankAccountAPI.getAll(),
        paymentExceptionAPI.getAll(),
      ]);

      setStats(statsData);
      setPaymentBatches(batches);
      setBankAccounts(accounts);
      setExceptions(exceptionsData);

      // Load approved payrolls for payment creation
      if (activeTab === 'payments') {
        const payrolls = await payrollAPI.getAllPayrollBatches();
        const approved = payrolls.filter((p: PayrollBatch) => 
          (p.status === 'approved' || p.status === 'ready_for_payment') &&
          (p.payment_status !== 'pending' && p.payment_status !== 'processing' && p.payment_status !== 'completed')
        );
        setAvailablePayrolls(approved);
      }
    } catch (error) {
      console.error('Error loading bank payments data:', error);
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    try {
      if (!newPaymentForm.payroll_batch_id) {
        showToast('error', 'Please select a payroll batch');
        return;
      }

      setIsSubmitting(true);
      const batch = await paymentBatchAPI.createFromPayroll(
        newPaymentForm.payroll_batch_id,
        newPaymentForm.bank_account_id || null,
        newPaymentForm.payment_method,
        newPaymentForm.file_format,
        user!.id,
        user!.full_name
      );

      showToast('success', `Payment batch ${batch.batch_number} created successfully`);
      setShowCreatePaymentModal(false);
      resetPaymentForm();
      loadData();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to create payment batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateFile = async (batch: PaymentBatch) => {
    try {
      const { content, filename } = await paymentBatchAPI.generatePaymentFile(batch.id);

      // Download file
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      showToast('success', 'Payment file generated and downloaded');
      loadData();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to generate payment file');
    }
  };

  const handleProcessBatch = async (batch: PaymentBatch) => {
    if (!await confirm(`Process payment for ${batch.batch_number}? This will initiate bank transfers.`)) return;

    try {
      await paymentBatchAPI.processPayment(batch.id);
      showToast('success', 'Payment processing initiated');
      loadData();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to process payment');
    }
  };

  const handleExecuteBatch = (batch: PaymentBatch) => {
    setSelectedBatchForExecution(batch);
  };

  const confirmExecuteBatch = async () => {
    if (!selectedBatchForExecution || !paymentReference.trim()) {
      showToast('error', 'Please enter a bank reference number');
      return;
    }

    try {
      setIsExecuting(true);
      await paymentBatchAPI.executePayments(selectedBatchForExecution.id, paymentReference.trim());
      showToast('success', 'Payment executed successfully');

      // Optimistically update local state
      setPaymentBatches(prev => prev.map(b => 
        b.id === selectedBatchForExecution.id 
          ? { ...b, status: 'completed' } 
          : b
      ));

      setSelectedBatchForExecution(null);
      setPaymentReference('');
      
      // Delay reload slightly to ensure backend is consistent
      setTimeout(() => loadData(), 500);
    } catch (error: any) {
      showToast('error', error.message || 'Failed to execute payment');
    } finally {
      setIsExecuting(false);
    }
  };
  const handleViewBatchDetails = async (batch: PaymentBatch) => {
    try {
      const transactions = await paymentBatchAPI.getTransactions(batch.id);
      setBatchTransactions(transactions);
      setSelectedBatch(batch);
      setShowBatchDetailsModal(true);
    } catch (error) {
      showToast('error', 'Failed to load batch details');
    }
  };

  const handleAddBankAccount = async () => {
    try {
      if (!newBankAccountForm.bank_name || !newBankAccountForm.account_number) {
        showToast('error', 'Please fill in required fields');
        return;
      }

      setIsSubmitting(true);
      const payload = {
        bankName: newBankAccountForm.bank_name,
        bankCode: newBankAccountForm.bank_code,
        accountNumber: newBankAccountForm.account_number,
        accountName: newBankAccountForm.account_name,
        accountType: newBankAccountForm.account_type,
        isActive: newBankAccountForm.is_active,
        apiEnabled: newBankAccountForm.api_enabled,
      };

      await bankAccountAPI.create(payload as any, user!.id);
      showToast('success', 'Bank account added successfully');
      setShowAddBankAccountModal(false);
      resetBankAccountForm();
      
      // Force reload all data
      setLoading(true);
      const [statsData, batches, accounts, exceptionsData] = await Promise.all([
        paymentStatsAPI.getDashboard(),
        paymentBatchAPI.getAll(),
        bankAccountAPI.getAll(),
        paymentExceptionAPI.getAll(),
      ]);

      setStats(statsData);
      setPaymentBatches(batches);
      setBankAccounts(accounts);
      setExceptions(exceptionsData);
      setLoading(false);
    } catch (error: any) {
      showToast('error', error.message || 'Failed to add bank account');
      setLoading(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditBankAccount = (account: BankAccount) => {
    setEditingBankAccount(account);
    setEditBankAccountForm({
      account_name: account.account_name || '',
      is_active: Boolean(account.is_active),
    });
    setShowEditBankAccountModal(true);
  };

  const handleUpdateBankAccount = async () => {
    if (!editingBankAccount) return;
    try {
      setIsSubmitting(true);
      await bankAccountAPI.update(editingBankAccount.id, {
        accountName: editBankAccountForm.account_name,
        isActive: editBankAccountForm.is_active,
      } as any);
      showToast('success', 'Bank account updated successfully');
      setShowEditBankAccountModal(false);
      setEditingBankAccount(null);
      const accounts = await bankAccountAPI.getAll();
      setBankAccounts(accounts);
    } catch (error: any) {
      showToast('error', error.message || 'Failed to update bank account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBankAccount = async (account: BankAccount) => {
    const ok = await confirm({
      title: 'Delete bank account?',
      message: `Delete ${account.bank_name} - ${account.account_number}? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      setIsSubmitting(true);
      const result = await bankAccountAPI.delete(account.id);
      showToast('success', result?.message || 'Bank account deleted successfully');
      const accounts = await bankAccountAPI.getAll();
      setBankAccounts(accounts);
    } catch (error: any) {
      showToast('error', error.message || 'Failed to delete bank account');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bank-accounts') {
      // Force refresh bank accounts when tab is active
      bankAccountAPI.getAll().then(setBankAccounts).catch(console.error);
    }
  }, [activeTab]);

  const resetPaymentForm = () => {
    setNewPaymentForm({
      payroll_batch_id: '',
      bank_account_id: '',
      payment_method: 'bank_transfer',
      file_format: 'custom_csv',
    });
  };

  const resetBankAccountForm = () => {
    setNewBankAccountForm({
      bank_name: '',
      bank_code: '',
      account_number: '',
      account_name: '',
      account_type: 'salary_disbursement',
      is_active: true,
      api_enabled: false,
    });
  };

  const getPaymentStatusBadge = (status: PaymentBatch['status']) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
      pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
      processing: { label: 'Processing', color: 'bg-purple-100 text-purple-800' },
      completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
      confirmed: { label: 'Confirmed', color: 'bg-teal-100 text-teal-800' },
      failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
      partially_completed: { label: 'Partially Completed', color: 'bg-orange-100 text-orange-800' },
    };

    const entry = statusMap[status as string] || { label: (String(status).replace(/_/g, ' ').toUpperCase()), color: 'bg-muted text-foreground' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${entry.color}`}>{entry.label}</span>;
  };

  const paymentColumns = [
    { header: 'Batch Number', accessor: 'batch_number' as keyof PaymentBatch, sortable: true },
    { header: 'Month', accessor: 'payroll_month' as keyof PaymentBatch, sortable: true },
    {
      header: 'Amount',
      accessor: (row: PaymentBatch) => formatCurrency(row.total_amount),
    },
    { header: 'Transactions', accessor: 'total_transactions' as keyof PaymentBatch },
    { header: 'Method', accessor: (row: PaymentBatch) => row.payment_method.replace('_', ' ').toUpperCase() },
    { header: 'Status', accessor: (row: PaymentBatch) => getPaymentStatusBadge(row.status) },
    {
      header: 'Actions',
      accessor: (row: PaymentBatch) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewBatchDetails(row)}
            className="p-1 hover:bg-accent rounded"
            title="View Details"
          >
            <FileText className="w-4 h-4 text-blue-600" />
          </button>
          {(row.status === 'draft' || row.status === 'pending_approval' || row.status === 'approved') && !row.file_generated && (
            <button
              onClick={() => handleGenerateFile(row)}
              className="p-1 hover:bg-accent rounded"
              title="Generate Payment File"
            >
              <Download className="w-4 h-4 text-green-600" />
            </button>
          )}
          {row.status === 'approved' && (
            <button
              onClick={() => handleProcessBatch(row)}
              className="p-1 hover:bg-accent rounded"
              title="Process Payment"
            >
              <Play className="w-4 h-4 text-primary" />
            </button>
          )}
          {row.status === 'processing' && (
            <button
              onClick={() => handleExecuteBatch(row)}
              className="p-1 hover:bg-accent rounded"
              title="Execute Payment"
            >
              <CheckCircle className="w-4 h-4 text-green-600" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const exceptionColumns = [
    { header: 'Exception #', accessor: 'exception_number' as keyof PaymentException },
    { header: 'Type', accessor: (row: PaymentException) => row.exception_type.replace('_', ' ').toUpperCase() },
    {
      header: 'Severity',
      accessor: (row: PaymentException) => {
        const colors = {
          low: 'bg-gray-100 text-gray-800',
          medium: 'bg-yellow-100 text-yellow-800',
          high: 'bg-orange-100 text-orange-800',
          critical: 'bg-red-100 text-red-800',
        };
        return <span className={`px-2 py-1 rounded text-xs font-medium ${colors[row.severity]}`}>{row.severity.toUpperCase()}</span>;
      },
    },
    { header: 'Description', accessor: 'description' as keyof PaymentException },
    { header: 'Status', accessor: (row: PaymentException) => <StatusBadge status={row.status} /> },
    { header: 'Created', accessor: (row: PaymentException) => new Date(row.created_at).toLocaleDateString() },
  ];

  const bankAccountColumns = [
    { header: 'Bank Name', accessor: 'bank_name' as keyof BankAccount },
    { header: 'Account Number', accessor: 'account_number' as keyof BankAccount },
    { header: 'Account Name', accessor: 'account_name' as keyof BankAccount },
    { header: 'Type', accessor: (row: BankAccount) => row.account_type.replace('_', ' ').toUpperCase() },
    {
      header: 'Status',
      accessor: (row: BankAccount) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${row.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    ...(canManageBankAccounts
      ? [{
          header: 'Actions',
          accessor: (row: BankAccount) => (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => openEditBankAccount(row)}>
                Edit
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteBankAccount(row)}>
                Delete
              </Button>
            </div>
          ),
        }]
      : []),
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'payments', label: 'Payment Batches', icon: CreditCard },
    { id: 'reconciliation', label: 'Reconciliation', icon: CheckCircle },
    { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle },
    { id: 'bank-accounts', label: 'Bank Accounts', icon: Building2 },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Breadcrumb items={[{ label: 'Bank Payments & Reconciliation' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Bank Payments & Reconciliation</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Automated salary disbursement and payment reconciliation</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'payments' && (
            <button
              onClick={() => setShowCreatePaymentModal(true)}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Create Payment Batch</span>
              <span className="sm:hidden">Create Batch</span>
            </button>
          )}
          {activeTab === 'bank-accounts' && ['admin', 'super_admin'].includes(user?.role || '') && (
            <button
              onClick={() => setShowAddBankAccountModal(true)}
              className="bg-primary text-primary-foreground px-3 sm:px-4 py-2 rounded-lg hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Add Bank Account</span>
              <span className="sm:hidden">Add Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <div className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <PageSkeleton mode="grid" />
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total Amount Processed</span>
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(stats.total_amount_processed || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Successful Transactions</span>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.successful_transactions || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(stats.total_transactions || 0) > 0
                      ? `${(((stats.successful_transactions || 0) / (stats.total_transactions || 1)) * 100).toFixed(1)}% success rate`
                      : 'No transactions'}
                  </p>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Failed Transactions</span>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.failed_transactions || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Open Exceptions</span>
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.open_exceptions || 0}</p>
                  <p className="text-xs text-red-600 mt-1">{stats.critical_exceptions || 0} critical</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">This Month Summary</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Payment Batches</span>
                      <span className="font-medium text-foreground">{stats.this_month_batches || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount Processed</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(stats.this_month_amount || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pending Reconciliation</span>
                      <span className="font-medium text-foreground">{stats.reconciliation_pending || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">Payment Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pending Approval</span>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                        {stats.pending_batches || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Processing</span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                        {stats.processing_batches || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Completed</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {stats.completed_batches || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Batches Tab */}
          {activeTab === 'payments' && (
            <DataTable
              data={paymentBatches}
              columns={paymentColumns}
              searchable
              searchPlaceholder="Search payment batches..."
            />
          )}

          {/* Reconciliation Tab */}
          {activeTab === 'reconciliation' && (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Bank Statement Reconciliation</h3>
              <p className="text-muted-foreground mb-4">
                Upload bank statements to automatically match transactions and identify discrepancies
              </p>
              <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90">
                Upload Bank Statement
              </button>
            </div>
          )}

          {/* Exceptions Tab */}
          {activeTab === 'exceptions' && (
            <DataTable
              data={exceptions}
              columns={exceptionColumns}
              searchable
              searchPlaceholder="Search exceptions..."
            />
          )}

          {/* Bank Accounts Tab */}
          {activeTab === 'bank-accounts' && (
            <DataTable
              data={bankAccounts}
              columns={bankAccountColumns}
              searchable
              searchPlaceholder="Search bank accounts..."
            />
          )}
        </>
      )}

      {/* Create Payment Batch Modal */}
      <Modal
        isOpen={showCreatePaymentModal}
        onClose={() => {
          setShowCreatePaymentModal(false);
          resetPaymentForm();
        }}
        title="Create Payment Batch"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreatePaymentModal(false);
                resetPaymentForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePayment}
              isLoading={isSubmitting}
            >
              Create Payment Batch
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Select Payroll Batch *
            </label>
            <select
              value={newPaymentForm.payroll_batch_id}
              onChange={(e) => setNewPaymentForm({ ...newPaymentForm, payroll_batch_id: e.target.value })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">-- Select Payroll --</option>
              {availablePayrolls.map((payroll) => (
                <option key={payroll.id} value={payroll.id}>
                  {payroll.batch_number} - {payroll.month} ({formatCurrency(payroll.total_net)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Payment Method *
            </label>
            <select
              value={newPaymentForm.payment_method}
              onChange={(e) => setNewPaymentForm({ ...newPaymentForm, payment_method: e.target.value as any })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              File Format *
            </label>
            <select
              value={newPaymentForm.file_format}
              onChange={(e) => setNewPaymentForm({ ...newPaymentForm, file_format: e.target.value as any })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="custom_csv">Standard CSV</option>
              <option value="nibss">NIBSS Format</option>
              <option value="remita">Remita Format</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Source Bank Account (Optional)
            </label>
            <select
              value={newPaymentForm.bank_account_id}
              onChange={(e) => setNewPaymentForm({ ...newPaymentForm, bank_account_id: e.target.value })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Select Bank Account --</option>
              {bankAccounts.filter(a => a.is_active).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} - {account.account_number}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Batch Details Modal */}
      <Modal
        isOpen={showBatchDetailsModal}
        onClose={() => {
          setShowBatchDetailsModal(false);
          setSelectedBatch(null);
          setBatchTransactions([]);
        }}
        title={`Payment Batch: ${selectedBatch?.batch_number}`}
        size="lg"
      >
        {selectedBatch && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium text-foreground">{getPaymentStatusBadge(selectedBatch.status)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium text-foreground">{formatCurrency(selectedBatch.total_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="font-medium text-foreground">{selectedBatch.total_transactions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-medium text-foreground">{selectedBatch.payment_method.replace('_', ' ').toUpperCase()}</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="font-medium text-foreground mb-2">Transaction Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Successful:</span>
                  <span className="text-sm text-green-600 font-medium">
                    {batchTransactions.filter(t => t.status === 'successful').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Failed:</span>
                  <span className="text-sm text-red-600 font-medium">
                    {batchTransactions.filter(t => t.status === 'failed').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pending:</span>
                  <span className="text-sm text-yellow-600 font-medium">
                    {batchTransactions.filter(t => t.status === 'pending').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Bank Account Modal */}
      <Modal
        isOpen={showAddBankAccountModal}
        onClose={() => {
          setShowAddBankAccountModal(false);
          resetBankAccountForm();
        }}
        title="Add Bank Account"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddBankAccountModal(false);
                resetBankAccountForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddBankAccount}
              isLoading={isSubmitting}
            >
              Add Account
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Bank Name *</label>
            <select
              value={newBankAccountForm.bank_name}
              onChange={(e) => {
                const bank = NIGERIAN_BANKS.find(b => b.name === e.target.value);
                setNewBankAccountForm({
                  ...newBankAccountForm,
                  bank_name: e.target.value,
                  bank_code: bank?.code || '',
                });
              }}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">-- Select Bank --</option>
              {NIGERIAN_BANKS.map((bank) => (
                <option key={bank.code} value={bank.name}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Account Number *</label>
            <input
              type="text"
              value={newBankAccountForm.account_number}
              onChange={(e) => setNewBankAccountForm({ ...newBankAccountForm, account_number: e.target.value })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
              maxLength={10}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Account Name *</label>
            <input
              type="text"
              value={newBankAccountForm.account_name}
              onChange={(e) => setNewBankAccountForm({ ...newBankAccountForm, account_name: e.target.value })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Account Type *</label>
            <select
              value={newBankAccountForm.account_type}
              onChange={(e) => setNewBankAccountForm({ ...newBankAccountForm, account_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
            >
              <option value="salary_disbursement">Salary Disbursement</option>
              <option value="pension">Pension</option>
              <option value="tax">Tax</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit Bank Account Modal */}
      <Modal
        isOpen={showEditBankAccountModal}
        onClose={() => {
          setShowEditBankAccountModal(false);
          setEditingBankAccount(null);
        }}
        title="Edit Bank Account"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditBankAccountModal(false);
                setEditingBankAccount(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateBankAccount} isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        }
      >
        {editingBankAccount && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Bank Name</label>
              <input
                value={editingBankAccount.bank_name}
                readOnly
                className="w-full px-3 py-2 border border-border bg-muted text-foreground rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Number</label>
              <input
                value={editingBankAccount.account_number}
                readOnly
                className="w-full px-3 py-2 border border-border bg-muted text-foreground rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Name</label>
              <input
                value={editBankAccountForm.account_name}
                onChange={(e) => setEditBankAccountForm({ ...editBankAccountForm, account_name: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editBankAccountForm.is_active}
                onChange={(e) => setEditBankAccountForm({ ...editBankAccountForm, is_active: e.target.checked })}
                className="h-4 w-4"
              />
              <span className="text-sm text-foreground">Active</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Execution Modal */}
      {selectedBatchForExecution && (
        <Modal
          isOpen={true}
          title="Execute Payment"
          onClose={() => {
            setSelectedBatchForExecution(null);
            setPaymentReference('');
          }}
        >
          <div className="space-y-4">
            {/* Batch Details */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Batch Number:</span>
                <span className="font-medium text-foreground">{selectedBatchForExecution.batch_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Period:</span>
                <span className="font-medium text-foreground">{selectedBatchForExecution.payroll_month}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Transactions:</span>
                <span className="font-medium text-foreground">{selectedBatchForExecution.total_transactions}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total Amount:</span>
                <span className="text-lg font-semibold text-primary">
                  {formatCurrency(selectedBatchForExecution.total_amount)}
                </span>
              </div>
            </div>

            {/* Payment Reference Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Bank Reference Number <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g., TXN202412240001"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enter the transaction reference from your bank system
              </p>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-3 flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">Payment Confirmation</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  This action will mark the payroll as paid and cannot be undone. Please ensure the bank transfer has been completed.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedBatchForExecution(null);
                  setPaymentReference('');
                }}
                className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 active:bg-muted/60 text-foreground rounded-lg transition-colors"
                disabled={isExecuting}
              >
                Cancel
              </button>
              <button
                onClick={confirmExecuteBatch}
                disabled={isExecuting}
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
