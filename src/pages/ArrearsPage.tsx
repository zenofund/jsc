import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { arrearsAPI, payrollAPI } from '../lib/api-client';
import { Arrears, PayrollBatch } from '../types/entities';
import { PageSkeleton } from '../components/PageLoader';
import { AlertCircle, TrendingUp, DollarSign, RefreshCw, Trash2, Plus, Check, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { showToast } from '../utils/toast';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { MergeArrearsModal } from '../components/MergeArrearsModal';
import { CreateArrearsModal } from '../components/CreateArrearsModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

function formatBreakdownMonth(monthValue: string) {
  const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return monthValue || 'N/A';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const monthDate = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(monthDate);
}

function getBusinessDateParts(value: string) {
  const rawValue = String(value || '').trim();
  const plainDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (plainDateMatch) {
    return {
      year: Number(plainDateMatch[1]),
      month: Number(plainDateMatch[2]),
      day: Number(plainDateMatch[3]),
    };
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsedDate);

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value || 0),
    month: Number(parts.find((part) => part.type === 'month')?.value || 0),
    day: Number(parts.find((part) => part.type === 'day')?.value || 0),
  };
}

function getBreakdownMonthLabel(arrearsItem: Arrears, storedMonth: string, index: number) {
  if (arrearsItem.reason === 'promotion' && arrearsItem.effective_date) {
    const parts = getBusinessDateParts(arrearsItem.effective_date);
    if (parts) {
      const monthDate = new Date(Date.UTC(parts.year, parts.month - 1 + index, 1));
      return new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(monthDate);
    }
  }

  return formatBreakdownMonth(storedMonth);
}

export function ArrearsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [arrears, setArrears] = useState<Arrears[]>([]);
  const [selectedArrears, setSelectedArrears] = useState<Arrears | null>(null);
  const [payrollBatches, setPayrollBatches] = useState<PayrollBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isBulkMergeMode, setIsBulkMergeMode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectedArrearsIds, setSelectedArrearsIds] = useState<string[]>([]);

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

  const canReviewArrears = ['admin', 'payroll_officer'].includes(user?.role || '');
  const canMergeArrears = ['admin', 'payroll_officer', 'payroll_manager', 'hr_manager'].includes(user?.role || '');
  const canBulkSelectArrears = canReviewArrears || canMergeArrears;

  const isSelectableArrears = (item: Arrears) =>
    (item.status === 'pending' && canReviewArrears) || (item.status === 'approved' && canMergeArrears);

  const isPromotionApprovalBlocked = (item: Arrears) =>
    item.reason === 'promotion' && Boolean(item.staff_status) && item.staff_status !== 'active';

  const selectableArrearsIds = useMemo(
    () => arrears.filter((item) => isSelectableArrears(item)).map((item) => item.id),
    [arrears, canReviewArrears, canMergeArrears],
  );

  const selectedPendingArrears = useMemo(
    () => arrears.filter((item) => selectedArrearsIds.includes(item.id) && item.status === 'pending'),
    [arrears, selectedArrearsIds],
  );

  const blockedPendingApprovalCount = useMemo(
    () => selectedPendingArrears.filter((item) => isPromotionApprovalBlocked(item)).length,
    [selectedPendingArrears],
  );

  const selectedApprovedArrears = useMemo(
    () => arrears.filter((item) => selectedArrearsIds.includes(item.id) && item.status === 'approved'),
    [arrears, selectedArrearsIds],
  );

  useEffect(() => {
    setSelectedArrearsIds((currentSelection) => {
      const allowedIds = new Set(arrears.filter((item) => isSelectableArrears(item)).map((item) => item.id));
      return currentSelection.filter((id) => allowedIds.has(id));
    });
  }, [arrears, canReviewArrears, canMergeArrears]);

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  const handleApproveArrears = async (arrearsId: string) => {
    const arrearsItem = arrears.find((item) => item.id === arrearsId);
    if (arrearsItem && isPromotionApprovalBlocked(arrearsItem)) {
      showToast.warning(`Cannot approve promotion: Staff is ${arrearsItem.staff_status}.`);
      return;
    }

    try {
      setApprovingId(arrearsId);
      await arrearsAPI.approveArrears(arrearsId, user!.id, user!.email);
      showToast.success('Arrears approved successfully');
      await loadData();
    } catch (error: any) {
      console.error('Failed to approve arrears:', error);
      showToast.error('Failed to approve arrears', error.message || 'An error occurred');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectArrears = async (arrearsId: string) => {
    const confirmed = await confirm({
      title: 'Reject Arrears?',
      message: 'This arrears record will be marked as rejected.',
    });
    if (!confirmed) {
      return;
    }

    try {
      setRejectingId(arrearsId);
      await arrearsAPI.rejectArrears(arrearsId, user!.id, user!.email, '');
      showToast.success('Arrears rejected successfully');
      await loadData();
    } catch (error: any) {
      showToast.error('Failed to reject arrears', error.message || 'An error occurred');
    } finally {
      setRejectingId(null);
    }
  };

  const handleMergeToPayroll = async () => {
    const bulkMergeIds = selectedApprovedArrears.map((item) => item.id);
    if ((!selectedArrears && !isBulkMergeMode) || !selectedBatchId) {
      console.error('Please select a payroll batch');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = isBulkMergeMode
        ? await arrearsAPI.bulkMergeArrearsToPayroll(bulkMergeIds, selectedBatchId, user!.id, user!.email)
        : await arrearsAPI.mergeArrearsToPayroll(selectedArrears!.id, selectedBatchId, user!.id, user!.email);
      showToast.success(response.message || 'Arrears merged successfully');
      setShowMergeModal(false);
      setIsBulkMergeMode(false);
      setSelectedArrears(null);
      setSelectedBatchId('');
      if (isBulkMergeMode) {
        setSelectedArrearsIds((currentSelection) => currentSelection.filter((id) => !bulkMergeIds.includes(id)));
      }
      await loadData();
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
      await arrearsAPI.recalculateArrears(arrearsId, user!.id, user!.email);
      showToast.success('Arrears recalculated successfully');
      await loadData();
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
      await loadData();
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
      await loadData();
    } catch (error: any) {
      showToast.error('Failed to delete arrears', error.message || 'An error occurred');
    }
  };

  const toggleArrearsSelection = (arrearsId: string) => {
    setSelectedArrearsIds((currentSelection) =>
      currentSelection.includes(arrearsId)
        ? currentSelection.filter((id) => id !== arrearsId)
        : [...currentSelection, arrearsId],
    );
  };

  const toggleSelectAllPending = () => {
    if (selectableArrearsIds.length === 0) {
      setSelectedArrearsIds([]);
      return;
    }

    const allSelected = selectableArrearsIds.every((id) => selectedArrearsIds.includes(id));
    setSelectedArrearsIds((currentSelection) => {
      const nonSelectable = currentSelection.filter((id) => !selectableArrearsIds.includes(id));
      return allSelected ? nonSelectable : [...nonSelectable, ...selectableArrearsIds];
    });
  };

  const openBulkMergeModal = () => {
    if (selectedApprovedArrears.length === 0) {
      return;
    }

    setSelectedArrears(null);
    setSelectedBatchId('');
    setIsBulkMergeMode(true);
    setShowMergeModal(true);
  };

  const handleBulkArrearsAction = async (action: 'approve' | 'reject') => {
    if (!canReviewArrears || selectedPendingArrears.length === 0) {
      return;
    }

    const blockedForApproval = action === 'approve' ? selectedPendingArrears.filter(isPromotionApprovalBlocked) : [];
    const actionablePendingArrears =
      action === 'approve' ? selectedPendingArrears.filter((item) => !isPromotionApprovalBlocked(item)) : selectedPendingArrears;

    if (action === 'approve' && blockedForApproval.length > 0) {
      showToast.warning(`Skipping ${blockedForApproval.length} promotion arrears: staff not active.`);
    }

    if (action === 'approve' && actionablePendingArrears.length === 0) {
      return;
    }

    const actionLabel = action === 'approve' ? 'approve' : 'reject';
    const confirmed = await confirm({
      title: action === 'approve' ? 'Bulk Approve Arrears?' : 'Bulk Reject Arrears?',
      message: `${actionablePendingArrears.length} pending arrears record${actionablePendingArrears.length === 1 ? '' : 's'} will be ${actionLabel}d. Continue?`,
    });

    if (!confirmed) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const result =
        action === 'approve'
          ? await arrearsAPI.bulkApproveArrears(actionablePendingArrears.map((item) => item.id))
          : await arrearsAPI.bulkRejectArrears(actionablePendingArrears.map((item) => item.id));

      const successfulIds = Array.isArray(result?.successes)
        ? result.successes.map((item: any) => item.id).filter(Boolean)
        : [];
      const failedArrears = Array.isArray(result?.failures) ? result.failures : [];

      setSelectedArrearsIds((currentSelection) => currentSelection.filter((id) => !successfulIds.includes(id)));
      await loadData();

      if (successfulIds.length > 0) {
        showToast.success(
          `${action === 'approve' ? 'Approved' : 'Rejected'} ${successfulIds.length} arrears record${successfulIds.length === 1 ? '' : 's'} successfully.`,
        );
      }

      if (failedArrears.length > 0) {
        const failedSummary = failedArrears
          .slice(0, 3)
          .map((item: any) => String(item.staff_name || '').trim() || item.id)
          .join(', ');
        if (successfulIds.length > 0) {
          showToast.warning(
            `${failedArrears.length} arrears record${failedArrears.length === 1 ? '' : 's'} failed${failedSummary ? `: ${failedSummary}` : ''}${failedArrears.length > 3 ? '...' : ''}`,
          );
        } else {
          showToast.error(
            'Bulk arrears action failed',
            `${failedArrears.length} arrears record${failedArrears.length === 1 ? '' : 's'} failed${failedSummary ? `: ${failedSummary}` : ''}${failedArrears.length > 3 ? '...' : ''}`,
          );
        }
      }
    } catch (error: any) {
      showToast.error(`Failed to ${actionLabel} arrears`, error?.message || 'An error occurred');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const columns = [
    ...(canBulkSelectArrears
      ? [
          {
            header: (
              <input
                type="checkbox"
                checked={selectableArrearsIds.length > 0 && selectableArrearsIds.every((id) => selectedArrearsIds.includes(id))}
                onChange={toggleSelectAllPending}
                disabled={selectableArrearsIds.length === 0 || bulkActionLoading}
                aria-label="Select all eligible arrears"
                className="h-4 w-4 rounded border-border"
              />
            ),
            accessor: (row: Arrears) =>
              isSelectableArrears(row) ? (
                <input
                  type="checkbox"
                  checked={selectedArrearsIds.includes(row.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleArrearsSelection(row.id)}
                  disabled={bulkActionLoading}
                  aria-label={`Select arrears for ${row.staff_name}`}
                  className="h-4 w-4 rounded border-border"
                />
              ) : null,
          },
        ]
      : []),
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

        const isProcessing =
          approvingId === row.id || rejectingId === row.id || recalculatingId === row.id || bulkActionLoading;
        const isApprovalBlocked = isPromotionApprovalBlocked(row);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                disabled={isProcessing}
                className="p-2 hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Open actions for arrears ${row.id}`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {row.status === 'pending' && (
                <DropdownMenuItem
                  onClick={() => handleApproveArrears(row.id)}
                  disabled={isApprovalBlocked}
                >
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                  {isApprovalBlocked ? `Approve Arrears (Staff ${row.staff_status})` : 'Approve Arrears'}
                </DropdownMenuItem>
              )}
              {row.status === 'pending' && canReviewArrears && (
                <DropdownMenuItem
                  onClick={() => handleRejectArrears(row.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="w-4 h-4 mr-2 text-red-600" />
                  Reject Arrears
                </DropdownMenuItem>
              )}
              {row.status === 'approved' && canMergeArrears && (
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedArrears(row);
                    setIsBulkMergeMode(false);
                    setSelectedBatchId('');
                    setShowMergeModal(true);
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                  Merge to Payroll
                </DropdownMenuItem>
              )}
              {(row.status === 'pending' || row.status === 'approved') && (
                <DropdownMenuItem onClick={() => handleRecalculateArrears(row.id)}>
                  <RefreshCw className="w-4 h-4 mr-2 text-primary" />
                  Recalculate
                </DropdownMenuItem>
              )}
              {row.status === 'pending' && (
                <DropdownMenuItem
                  onClick={() => handleDeleteArrears(row.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-600" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // Calculate stats
  const stats = {
    total: arrears.length,
    pending: arrears.filter(a => a.status === 'pending').length,
    approved: arrears.filter(a => a.status === 'approved').length,
    rejected: arrears.filter(a => a.status === 'rejected').length,
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
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 justify-items-center md:justify-items-stretch max-w-sm md:max-w-none mx-auto">
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
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-500" />
          </div>
          <div className="text-2xl font-semibold text-foreground">{stats.rejected}</div>
          <div className="text-sm text-muted-foreground">Rejected</div>
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

      {canBulkSelectArrears && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                {selectedArrearsIds.length} eligible arrears record{selectedArrearsIds.length === 1 ? '' : 's'} selected
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedPendingArrears.length} pending selected{blockedPendingApprovalCount > 0 ? ` (${blockedPendingApprovalCount} blocked from approval)` : ''}. {selectedApprovedArrears.length} approved ready for merge.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedArrearsIds([])}
                disabled={selectedArrearsIds.length === 0 || bulkActionLoading}
                className="px-3 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Selection
              </button>
              {canReviewArrears && (
                <button
                  type="button"
                  onClick={() => handleBulkArrearsAction('approve')}
                  disabled={selectedPendingArrears.length === 0 || bulkActionLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Bulk Approve
                </button>
              )}
              {canReviewArrears && (
                <button
                  type="button"
                  onClick={() => handleBulkArrearsAction('reject')}
                  disabled={selectedPendingArrears.length === 0 || bulkActionLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Bulk Reject
                </button>
              )}
              {canMergeArrears && (
                <button
                  type="button"
                  onClick={openBulkMergeModal}
                  disabled={selectedApprovedArrears.length === 0 || bulkActionLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TrendingUp className="w-4 h-4" />
                  Bulk Merge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
          title={selectedArrears.staff_name ? `Arrears Details - ${selectedArrears.staff_name}` : 'Arrears Details'}
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
                <p className="font-medium text-foreground">
                  {selectedArrears.effective_date 
                    ? new Date(selectedArrears.effective_date).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      })
                    : 'N/A'}
                </p>
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
                    {(selectedArrears.details || selectedArrears.arrears_details || []).map((detail: any, index: number) => (
                      <tr key={index} className="border-t border-border">
                        <td className="px-4 py-2 text-foreground">{getBreakdownMonthLabel(selectedArrears, detail.month, index)}</td>
                        <td className="px-4 py-2 text-foreground text-right">₦{Number(detail.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                    {(!(selectedArrears.details || selectedArrears.arrears_details) || (selectedArrears.details || selectedArrears.arrears_details).length === 0) && (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
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
          setIsBulkMergeMode(false);
          setSelectedArrears(null);
          setSelectedBatchId('');
        }}
        title={isBulkMergeMode ? 'Bulk Merge Arrears to Payroll Batch' : 'Merge Arrears to Payroll Batch'}
        arrears={selectedArrears}
        arrearsList={isBulkMergeMode ? selectedApprovedArrears : []}
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
