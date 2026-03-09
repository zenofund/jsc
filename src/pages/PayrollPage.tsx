import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { ViewPayrollLinesModal } from '../components/ViewPayrollLinesModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { payrollAPI, settingsAPI } from '../lib/api-client';
import { PayrollBatch, PayrollLine } from '../types/entities';
import { Plus, Eye, Lock, Loader2, RefreshCw, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { PageSkeleton } from '../components/PageLoader';
import { Button } from '../components/ui/button';
import { formatCurrency } from '../utils/format';
import { useToast } from '../components/Toast';

export function PayrollPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinesModal, setShowLinesModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingBatchId, setProcessingBatchId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [batchToRegenerate, setBatchToRegenerate] = useState<string | null>(null);
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Check if user can manage payroll
  const canManagePayroll = user?.role === 'admin' || user?.role === 'payroll_officer';
  // Only Admin can lock payroll
  const canLockPayroll = user?.role === 'admin';
  // Reviewer, Approver, Audit can only view and download
  const isReadOnlyRole = ['reviewer', 'approver', 'auditor', 'audit'].includes(user?.role || '');

  useEffect(() => {
    // Restrict cashier access
    if (user?.role === 'cashier') {
      (window as any).navigateTo?.('cashier-dashboard');
      return;
    }
    loadBatches();
  }, [user]);

  const loadBatches = async () => {
    try {
      const data = await payrollAPI.getAllPayrollBatches();
      setBatches(data.sort((a: PayrollBatch, b: PayrollBatch) => b.created_at.localeCompare(a.created_at)));
    } catch (error: any) {
      console.error('Failed to load payroll batches:', error);
      // Show user-friendly error message
      if (error.message && error.message.includes('Backend server is not available')) {
        console.error('\n⚠️  BACKEND NOT RUNNING ⚠️');
        console.error('Please start the backend server:');
        console.error('1. Open a new terminal');
        console.error('2. cd backend');
        console.error('3. npm run start:dev');
        console.error('4. Wait for server to start on http://localhost:3000');
        console.error('5. Refresh this page\n');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!selectedMonth) {
      console.error('Please select a month');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Calculate period dates
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${selectedMonth}-01`;
      // Get last day of month: day 0 of next month
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${lastDay}`;

      const batchData = {
        payrollMonth: selectedMonth,
        periodStart: startDate,
        periodEnd: endDate
      };

      const batch = await payrollAPI.createPayrollBatch(batchData);
      console.log(`Payroll batch ${batch.batch_number} created`);
      showToast('success', `Payroll batch ${batch.batch_number} created`);
      setShowCreateModal(false);
      setSelectedMonth('');
      loadBatches();
    } catch (error: any) {
      console.error('Failed to create payroll batch:', error);
      showToast('error', error.response?.data?.message || error.message || 'Failed to create payroll batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateLines = async (batchId: string) => {
    try {
      setProcessingBatchId(batchId);
      await payrollAPI.generatePayrollLines(batchId, user!.id, user!.email);
      console.log('Payroll lines generated successfully');
      loadBatches();
    } catch (error) {
      console.error('Failed to generate payroll lines:', error);
    } finally {
      setProcessingBatchId(null);
    }
  };

  const handleConfirmRegenerate = () => {
    if (batchToRegenerate) {
      handleGenerateLines(batchToRegenerate);
      setShowConfirmDialog(false);
      setBatchToRegenerate(null);
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [executingPayment, setExecutingPayment] = useState(false);
  const [paymentBatch, setPaymentBatch] = useState<PayrollBatch | null>(null);

  const handleOpenPaymentModal = (batch: PayrollBatch) => {
    setPaymentBatch(batch);
    setPaymentReference('');
    setShowPaymentModal(true);
  };

  const handleExecutePayment = async () => {
    if (!paymentBatch || !paymentReference.trim()) {
      showToast('error', 'Please enter a payment reference');
      return;
    }

    try {
      setExecutingPayment(true);
      await payrollAPI.executePayment(paymentBatch.id, paymentReference);
      showToast('success', 'Payment executed successfully');
      setShowPaymentModal(false);
      setPaymentBatch(null);
      setPaymentReference('');
      loadBatches();
    } catch (error: any) {
      console.error('Failed to execute payment:', error);
      showToast('error', error.message || 'Failed to execute payment');
    } finally {
      setExecutingPayment(false);
    }
  };

  const handleOpenTrace = async (batch: PayrollBatch) => {
    try {
      setTraceLoading(true);
      setShowTraceModal(true);
      const data = await payrollAPI.getPaymentTrace(batch.id);
      setTraceData(data);
    } catch (error: any) {
      console.error('Failed to load payment trace:', error);
      showToast('error', error.message || 'Failed to load payment trace');
      setTraceData(null);
    } finally {
      setTraceLoading(false);
    }
  };
  const handleSubmitForApproval = async (batchId: string) => {
    try {
      const token = localStorage.getItem('jsc_auth_token');
      if (!user || !token) {
        console.error('You must be logged in to submit payroll for approval.');
        return;
      }

      const linesResp = await payrollAPI.getPayrollLines(batchId);
      const linesData = Array.isArray(linesResp) ? linesResp : (linesResp?.data || []);
      if (!Array.isArray(linesData) || linesData.length === 0) {
        console.error('Cannot submit: no payroll lines found for this batch.');
        return;
      }

      const settings = await settingsAPI.getSettings().catch(() => null);
      const workflow = settings?.value?.approval_workflow || settings?.approval_workflow || settings?.general_settings?.approval_workflow || [];
      if (!Array.isArray(workflow) || workflow.length === 0) {
        console.error('Cannot submit: approval workflow is not configured.');
        return;
      }

      setProcessingBatchId(batchId);
      await payrollAPI.submitForApproval(batchId, user!.id, user!.email);
      console.log('Payroll submitted for approval');
      loadBatches();
    } catch (error) {
      console.error('Failed to submit payroll:', error);
    } finally {
      setProcessingBatchId(null);
    }
  };

  const handleLockPayroll = async (batchId: string) => {
    try {
      setProcessingBatchId(batchId);
      await payrollAPI.lockPayroll(batchId, user!.id, user!.email);
      console.log('Payroll locked successfully');
      loadBatches();
    } catch (error) {
      console.error('Failed to lock payroll:', error);
    } finally {
      setProcessingBatchId(null);
    }
  };

  const handleViewLines = async (batch: PayrollBatch) => {
    setSelectedBatch(batch);
    setPayrollLines([]);
    setLinesLoading(true);
    setShowLinesModal(true);
    try {
      const response = await payrollAPI.getPayrollLines(batch.id, { page: 1, limit: 100, sort: sortDirection });
      const lines = Array.isArray(response) ? response : (response.data || []);
      const meta = !Array.isArray(response) && response.meta ? response.meta : { total: lines.length, page: 1, limit: 100, totalPages: 1 };
      
      setPayrollLines(lines);
      setPage(Number(meta.page) || 1);
      setTotalPages(Number(meta.totalPages) || 1);
      setTotalLines(Number(meta.total) || lines.length);
    } catch (error) {
      console.error("Error fetching payroll lines:", error);
      setPayrollLines([]);
    } finally {
      setLinesLoading(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!selectedBatch) return;
    
    setLinesLoading(true);
    try {
      const response = await payrollAPI.getPayrollLines(selectedBatch.id, { page: newPage, limit: 100, sort: sortDirection });
      const lines = Array.isArray(response) ? response : (response.data || []);
      const meta = !Array.isArray(response) && response.meta ? response.meta : { total: lines.length, page: newPage, limit: 100, totalPages: 1 };
      
      setPayrollLines(lines);
      setPage(Number(meta.page) || newPage);
      setTotalPages(Number(meta.totalPages) || 1);
      setTotalLines(Number(meta.total) || lines.length);
    } catch (error) {
      console.error("Error fetching payroll lines:", error);
    } finally {
      setLinesLoading(false);
    }
  };

  const handleSortChange = async (direction: 'asc' | 'desc') => {
    if (!selectedBatch) return;
    
    setSortDirection(direction);
    setLinesLoading(true);
    try {
      // Reset to page 1 when sorting changes
      const response = await payrollAPI.getPayrollLines(selectedBatch.id, { page: 1, limit: 100, sort: direction });
      const lines = Array.isArray(response) ? response : (response.data || []);
      const meta = !Array.isArray(response) && response.meta ? response.meta : { total: lines.length, page: 1, limit: 100, totalPages: 1 };
      
      setPayrollLines(lines);
      setPage(1); // Reset to page 1
      setTotalPages(Number(meta.totalPages) || 1);
      setTotalLines(Number(meta.total) || lines.length);
    } catch (error) {
      console.error("Error fetching payroll lines:", error);
    } finally {
      setLinesLoading(false);
    }
  };

  const batchColumns = [
    {
      header: 'Batch Number',
      accessor: 'batch_number' as keyof PayrollBatch,
      sortable: true,
    },
    {
      header: 'Month',
      accessor: 'month' as keyof PayrollBatch,
      sortable: true,
    },
    {
      header: 'Total Staff',
      accessor: 'total_staff' as keyof PayrollBatch,
    },
    {
      header: 'Gross Pay',
      accessor: (row: PayrollBatch) => formatCurrency(row.total_gross),
    },
    {
      header: 'Net Pay',
      accessor: (row: PayrollBatch) => formatCurrency(row.total_net),
    },
    {
      header: 'Status',
      accessor: (row: PayrollBatch) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      accessor: (row: PayrollBatch) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewLines(row);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="View Lines"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {row.status === 'draft' && row.total_staff === 0 && !isReadOnlyRole && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateLines(row.id);
              }}
              disabled={processingBatchId === row.id}
              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {processingBatchId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Generate
            </button>
          )}
          {row.status === 'draft' && row.total_staff > 0 && !isReadOnlyRole && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setBatchToRegenerate(row.id);
                setShowConfirmDialog(true);
              }}
              disabled={processingBatchId === row.id}
              className="px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1"
              title="Regenerate Lines"
            >
              {processingBatchId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Regenerate
            </button>
          )}
          {row.status === 'draft' && row.total_staff > 0 && !isReadOnlyRole && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSubmitForApproval(row.id);
              }}
              disabled={processingBatchId === row.id}
              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
            >
              {processingBatchId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Submit
            </button>
          )}
          {(row.status === 'approved' || row.status === 'ready_for_payment' || row.status === 'paid') && canLockPayroll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLockPayroll(row.id);
              }}
              disabled={processingBatchId === row.id}
              className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
            >
              {processingBatchId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
              Lock
            </button>
          )}
          {(row.status === 'locked' || row.status === 'paid' || row.status === 'ready_for_payment') && !row.payment_status && !isReadOnlyRole && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenPaymentModal(row);
              }}
              className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 flex items-center gap-1"
            >
              <CreditCard className="h-3 w-3" />
              Pay
            </button>
          )}
          {(row.status === 'locked' || row.status === 'paid' || row.status === 'ready_for_payment') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenTrace(row);
              }}
              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1"
            >
              <AlertCircle className="h-3 w-3" />
              Trace
            </button>
          )}
        </div>
      ),
    },
  ];

  const lineColumns = [
    {
      header: 'Staff Number',
      accessor: 'staff_number' as keyof PayrollLine,
    },
    {
      header: 'Staff Name',
      accessor: 'staff_name' as keyof PayrollLine,
    },
    {
      header: 'Grade',
      accessor: (row: PayrollLine) => `GL ${row.grade_level} / S ${row.step}`,
    },
    {
      header: 'Basic Salary',
      accessor: (row: PayrollLine) => formatCurrency(row.basic_salary),
    },
    {
      header: 'Allowances',
      accessor: (row: PayrollLine) => formatCurrency(row.total_allowances || (row.gross_pay - row.basic_salary)),
    },
    {
      header: 'Gross Pay',
      accessor: (row: PayrollLine) => formatCurrency(row.gross_pay),
    },
    {
      header: 'Deductions',
      accessor: (row: PayrollLine) => formatCurrency(row.total_deductions),
    },
    {
      header: 'Net Pay',
      accessor: (row: PayrollLine) => formatCurrency(row.net_pay),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Payroll Processing' }]} />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h1 className="text-foreground mb-1 sm:mb-2 text-lg sm:text-2xl">Payroll Processing</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage monthly payroll batches and processing</p>
        </div>
        {canManagePayroll && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-primary-foreground px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-primary/90 active:bg-primary/80 flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Create New Batch</span>
            <span className="sm:hidden">New Batch</span>
          </button>
        )}
      </div>

      {/* Payroll Workflow Guide */}
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-accent/50 border border-border rounded-lg bg-[rgba(3,46,21,0.3)]">
        <h3 className="font-medium text-foreground mb-2 text-sm sm:text-base">Payroll Processing Workflow</h3>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <span>1. Create Batch →</span>
          <span>2. Generate Lines →</span>
          <span>3. Review & Adjust →</span>
          <span>4. Submit for Approval →</span>
          <span className="hidden sm:inline">5. Multi-level Approval →</span>
          <span className="hidden sm:inline">6. Lock & Export</span>
        </div>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <DataTable
          data={batches}
          columns={batchColumns}
          searchable
          searchPlaceholder="Search by batch number or month..."
        />
      )}

      {/* Create Batch Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Payroll Batch"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <Button
              onClick={handleCreateBatch}
              isLoading={isSubmitting}
            >
              Create Batch
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Select Month *
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent [color-scheme:light] dark:[color-scheme:dark]"
              required
            />
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> After creating the batch, you'll need to generate payroll lines 
              for all active staff. This will calculate salaries based on the current salary structure, 
              allowances, and deductions.
            </p>
          </div>
        </div>
      </Modal>

      {/* View Payroll Lines Modal */}
      <ViewPayrollLinesModal
        isOpen={showLinesModal}
        onClose={() => {
          setShowLinesModal(false);
          setSelectedBatch(null);
          setPayrollLines([]);
          setLinesLoading(false);
          setPage(1);
        }}
        title={`Payroll Lines - ${selectedBatch?.batch_number}`}
        size="xl"
        batch={selectedBatch}
        lines={payrollLines}
        isLoading={linesLoading}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onSortChange={handleSortChange}
        sortDirection={sortDirection}
      />

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Regenerate Payroll Lines?"
        message="This will recalculate all payroll lines for this batch. Any manual adjustments or existing values will be overwritten. This action cannot be undone."
        onConfirm={handleConfirmRegenerate}
        onCancel={() => {
          setShowConfirmDialog(false);
          setBatchToRegenerate(null);
        }}
      />

      {/* Payment Modal */}
      {showPaymentModal && paymentBatch && (
        <Modal
          isOpen={true}
          title="Execute Payment"
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentBatch(null);
            setPaymentReference('');
          }}
        >
          <div className="space-y-4">
            {/* Batch Details */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Batch Number:</span>
                <span className="font-medium text-foreground">{paymentBatch.batch_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Period:</span>
                <span className="font-medium text-foreground">{paymentBatch.month}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Staff:</span>
                <span className="font-medium text-foreground">{paymentBatch.total_staff}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Net Amount:</span>
                <span className="text-lg font-semibold text-primary">
                  {formatCurrency(paymentBatch.total_net)}
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
                  setShowPaymentModal(false);
                  setPaymentBatch(null);
                  setPaymentReference('');
                }}
                className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 active:bg-muted/60 text-foreground rounded-lg transition-colors"
                disabled={executingPayment}
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePayment}
                disabled={executingPayment}
                className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {executingPayment ? (
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

      {showTraceModal && (
        <Modal
          isOpen={true}
          title={`Payment Trace - ${traceData?.batch?.batch_number || selectedBatch?.batch_number || ''}`}
          onClose={() => {
            setShowTraceModal(false);
            setTraceData(null);
          }}
          size="lg"
        >
          {traceLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading payment trace...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Total Staff</div>
                  <div className="text-lg text-card-foreground">{traceData?.total_staff || 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Paid</div>
                  <div className="text-lg text-card-foreground">{traceData?.paid_count || 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Unpaid</div>
                  <div className="text-lg text-card-foreground">{traceData?.unpaid_count || 0}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">Staff</th>
                      <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">Net Pay</th>
                      <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-2 text-left text-xs uppercase tracking-wider text-muted-foreground">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(traceData?.unpaid || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                          No unpaid staff found
                        </td>
                      </tr>
                    ) : (
                      (traceData?.unpaid || []).map((item: any) => (
                        <tr key={`${item.staff_id || item.staff_number}`}>
                          <td className="px-4 py-3">
                            <div className="text-sm text-card-foreground">{item.staff_name}</div>
                            <div className="text-xs text-muted-foreground">{item.staff_number}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-card-foreground">{formatCurrency(item.net_pay)}</td>
                          <td className="px-4 py-3 text-sm text-card-foreground">{item.transaction_status || 'none'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{item.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
