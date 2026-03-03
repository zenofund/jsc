import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { arrearsAPI, payrollAPI } from '../lib/api-client';
import { Arrears, PayrollBatch } from '../types/entities';
import { PageSkeleton } from '../components/PageLoader';
import { AlertCircle, TrendingUp, DollarSign, RefreshCw, Trash2, Plus, Check, Loader2, CheckCircle } from 'lucide-react';
import { showToast } from '../utils/toast';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { MergeArrearsModal } from '../components/MergeArrearsModal';
import { CreateArrearsModal } from '../components/CreateArrearsModal';

export function ArrearsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [arrears, setArrears] = useState<Arrears[]>([]);
  const [selectedArrears, setSelectedArrears] = useState<Arrears | null>(null);
  const [payrollBatches, setPayrollBatches] = useState<PayrollBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const pendingArrears = await arrearsAPI.getPendingArrears();
      setArrears(pendingArrears);
      
      const batches = await payrollAPI.getAllPayrollBatches();
      setPayrollBatches(batches.filter((b: PayrollBatch) => b.status === 'draft'));
    } catch (error) {
      console.error('Failed to load arrears data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  const handleApproveArrears = async (arrearsId: string) => {
    try {
      setApprovingId(arrearsId);
      await arrearsAPI.approveArrears(arrearsId, user!.id, user!.email);
      showToast.success('Arrears approved successfully');
      loadData();
    } catch (error: any) {
      console.error('Failed to approve arrears:', error);
      showToast.error('Failed to approve arrears', error.message || 'An error occurred');
    } finally {
      setApprovingId(null);
    }
  };

  const handleMergeToPayroll = async () => {
    if (!selectedArrears || !selectedBatchId) {
      console.error('Please select a payroll batch');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await arrearsAPI.mergeArrearsToPayroll(selectedArrears.id, selectedBatchId, user!.id, user!.email);
      showToast.success(response.message || 'Arrears merged successfully');
      setShowMergeModal(false);
      setSelectedArrears(null);
      setSelectedBatchId('');
      loadData();
    } catch (error: any) {
      console.error('Failed to merge arrears:', error);
      showToast.error('Failed to merge arrears', error.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecalculateArrears = async (arrearsId: string) => {
    const confirmed = await confirm({
      title: 'Recalculate Arrears?',
      message: 'This will update the amount based on current salary structure'
    });
    if (!confirmed) {
      return;
    }

    try {
      setRecalculatingId(arrearsId);
      const updated = await arrearsAPI.recalculateArrears(arrearsId, user!.id, user!.email);
      showToast.success('Arrears recalculated successfully');
      loadData();
    } catch (error: any) {
      showToast.error('Failed to recalculate arrears', error.message || 'An error occurred');
    } finally {
      setRecalculatingId(null);
    }
  };

  const handleCreateArrears = async (data: any) => {
    try {
      await arrearsAPI.createArrears(data);
      showToast.success('Adjustment created successfully');
      loadData();
    } catch (error: any) {
      showToast.error('Failed to create adjustment', error.message || 'An error occurred');
      throw error;
    }
  };

  const handleDeleteArrears = async (id: string) => {
    if (!await confirm({ title: 'Delete Arrears?', message: 'This action cannot be undone. Only pending arrears can be deleted.' })) return;
    try {
      await arrearsAPI.deleteArrears(id);
      showToast.success('Arrears deleted successfully');
      loadData();
    } catch (error: any) {
      showToast.error('Failed to delete arrears', error.message || 'An error occurred');
    }
  };

  const columns = [
    {
      header: 'Staff Number',
      accessor: 'staff_number' as keyof Arrears,
      sortable: true,
    },
    {
      header: 'Staff Name',
      accessor: 'staff_name' as keyof Arrears,
      sortable: true,
    },
    {
      header: 'Reason',
      accessor: (row: Arrears) => (
        <span className="capitalize">{row.reason.replace('_', ' ')}</span>
      ),
    },
    {
      header: 'Effective Date',
      accessor: (row: Arrears) => {
        if (!row.effective_date) return 'N/A';
        const date = new Date(row.effective_date);
        return isNaN(date.getTime()) || date.getFullYear() === 1970 
          ? 'Invalid Date' 
          : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      },
    },
    {
      header: 'Months Owed',
      accessor: 'months_owed' as keyof Arrears,
    },
    {
      header: 'Total Arrears',
      accessor: (row: Arrears) => `₦${Number(row.total_arrears).toLocaleString()}`,
    },
    {
      header: 'Status',
      accessor: (row: Arrears) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      accessor: (row: Arrears) => {
        if (['payroll_loader'].includes(user?.role || '')) {
          return <span className="text-muted-foreground text-xs italic">View Only</span>;
        }
        
        return (
          <div className="flex items-center gap-2">
            {row.status === 'pending' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApproveArrears(row.id);
                }}
                disabled={approvingId === row.id}
                className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded text-green-600 dark:text-green-400 disabled:opacity-50"
                title="Approve Arrears"
              >
                {approvingId === row.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
            )}
            
            {row.status === 'approved' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedArrears(row);
                  setShowMergeModal(true);
                }}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                Merge to Payroll
              </button>
            )}

            {(row.status === 'pending' || row.status === 'approved') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRecalculateArrears(row.id);
                }}
                disabled={recalculatingId === row.id}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50"
                title="Recalculate"
              >
                <RefreshCw className={`w-4 h-4 text-primary ${recalculatingId === row.id ? 'animate-spin' : ''}`} />
              </button>
            )}
            {row.status === 'pending' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteArrears(row.id);
                }}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // Calculate stats
  const stats = {
    total: arrears.length,
    pending: arrears.filter(a => a.status === 'pending').length,
    approved: arrears.filter(a => a.status === 'approved').length,
    processed: arrears.filter(a => a.status === 'processed').length,
    totalAmount: arrears.reduce((sum, a) => sum + Number(a.total_arrears), 0),
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Breadcrumb items={[{ label: 'Arrears & Adjustments' }]} />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="page-title">Arrears & Adjustments</h1>
          <p className="text-muted-foreground">Manage salary arrears from promotions, salary structure updates, and adjustments</p>
        </div>
        {!['payroll_loader'].includes(user?.role || '') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Adjustment
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 justify-items-center md:justify-items-stretch max-w-sm md:max-w-none mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 text-gray-600 dark:text-gray-500" />
          </div>
          <div className="text-2xl font-semibold text-foreground">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Cases</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="text-2xl font-semibold text-foreground">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Pending</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-500" />
          </div>
          <div className="text-2xl font-semibold text-foreground">{stats.approved}</div>
          <div className="text-sm text-muted-foreground">Approved</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-purple-600 dark:text-purple-500" />
          </div>
          <div className="text-2xl font-semibold text-foreground">{stats.processed}</div>
          <div className="text-sm text-muted-foreground">Processed</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-accent" />
          </div>
          <div className="text-2xl font-semibold text-foreground">₦{stats.totalAmount.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Total Amount</div>
        </div>
      </div>

      {/* Arrears Detection Info */}
      <div className="mb-6 p-4 bg-green-50/50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
        <h3 className="font-medium text-green-900 dark:text-green-400 mb-2">Automatic Arrears Detection</h3>
        <p className="text-sm text-green-800 dark:text-green-300">
          The system automatically detects arrears from: <strong>Backdated Promotions</strong>, 
          <strong> Salary Structure Updates</strong>, <strong> Step Increment Delays</strong>, 
          and <strong> Missed Payroll Updates</strong>. All detected arrears require approval before 
          being merged into payroll.
        </p>
      </div>

      <DataTable
        data={arrears}
        columns={columns}
        onRowClick={setSelectedArrears}
        searchable
        searchPlaceholder="Search by staff name or number..."
      />

      {/* Arrears Details Modal */}
      {selectedArrears && !showMergeModal && (
        <Modal
          isOpen={!!selectedArrears}
          onClose={() => setSelectedArrears(null)}
          title={`Arrears Details - ${selectedArrears.staff_number}`}
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Staff Name</p>
                <p className="font-medium text-foreground">{selectedArrears.staff_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium text-foreground capitalize">{selectedArrears.reason.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Effective Date</p>
                <p className="font-medium text-foreground">{selectedArrears.effective_date}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div>
                  <StatusBadge status={selectedArrears.status} />
                </div>
              </div>
            </div>

            {/* Grade Change Info */}
            {selectedArrears.reason === 'promotion' && selectedArrears.old_grade && selectedArrears.new_grade && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Previous Grade</p>
                  <p className="font-medium text-foreground">GL {selectedArrears.old_grade} / Step {selectedArrears.old_step}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">New Grade</p>
                  <p className="font-medium text-green-600 dark:text-green-500">GL {selectedArrears.new_grade} / Step {selectedArrears.new_step}</p>
                </div>
              </div>
            )}

            {/* Breakdown Table */}
            <div>
              <h4 className="font-medium text-foreground mb-3">Breakdown by Month</h4>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Month</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedArrears.arrears_details || []).map((detail: any, index: number) => (
                      <tr key={index} className="border-t border-border">
                        <td className="px-4 py-2 text-foreground">{detail.month}</td>
                        <td className="px-4 py-2 text-foreground text-right">₦{Number(detail.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!selectedArrears.arrears_details || selectedArrears.arrears_details.length === 0) && (
                      <tr>
                         <td colSpan={2} className="px-4 py-4 text-center text-muted-foreground">
                            No breakdown details available
                         </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t border-border">
                    <tr>
                      <td className="px-4 py-2 font-medium text-foreground">Total ({selectedArrears.months_owed} months)</td>
                      <td className="px-4 py-2 font-semibold text-foreground text-right">₦{Number(selectedArrears.total_arrears).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Merge to Payroll Modal */}
      <MergeArrearsModal
        isOpen={showMergeModal}
        onClose={() => {
          setShowMergeModal(false);
          setSelectedArrears(null);
          setSelectedBatchId('');
        }}
        title="Merge Arrears to Payroll Batch"
        arrears={selectedArrears}
        payrollBatches={payrollBatches}
        selectedBatchId={selectedBatchId}
        onBatchChange={setSelectedBatchId}
        onMerge={handleMergeToPayroll}
        isSubmitting={isSubmitting}
      />

      {/* Create Arrears Modal */}
      <CreateArrearsModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateArrears}
      />
    </div>
  );
}