import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { PageSkeleton } from '../components/PageLoader';
import { formatCurrency } from '../utils/format';
import { 
  payrollAPI, 
  loanApplicationAPI, 
  staffPortalAPI,
  arrearsAPI,
  promotionAPI,
  paymentBatchAPI,
  settingsAPI,
  staffAllowanceAPI,
  staffDeductionAPI,
} from '../lib/api-client';
import type {
  PayrollBatch,
  LoanApplication,
  LeaveRequest,
  PaymentBatch,
  Arrear,
  Promotion,
} from '../types/entities';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Wallet,
  Calendar,
  CreditCard,
  TrendingUp,
  Award,
  AlertCircle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  User,
  Info,
  Sliders,
} from 'lucide-react';

type ApprovalType = 'payroll' | 'loan' | 'leave' | 'payment' | 'arrear' | 'promotion' | 'adjustment';
type TabType = 'all' | 'history' | ApprovalType;

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  subtitle: string;
  amount?: number;
  status: string;
  created_at: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  data: any;
}

export function ApprovalsPageEnhanced() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(true);
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [comments, setComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [myActions, setMyActions] = useState<any[]>([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    payroll: 0,
    loans: 0,
    leaves: 0,
    payments: 0,
    arrears: 0,
    promotions: 0,
    adjustments: 0,
    critical: 0,
  });

  useEffect(() => {
    if (!user) return;
    loadAllApprovals();
  }, [user]);

  const normalizeRole = (role: any) => {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'reviewer') return 'checking';
    if (r === 'approver') return 'cpo';
    return r;
  };

  const isPayrollOnlyApproverRole = ['checking', 'cpo', 'auditor', 'audit'].includes(normalizeRole(user?.role || ''));

  useEffect(() => {
    if (!isPayrollOnlyApproverRole) return;
    if (!['all', 'payroll', 'history'].includes(activeTab)) {
      setActiveTab('all');
    }
  }, [activeTab, isPayrollOnlyApproverRole]);

  const loadAllApprovals = async () => {
    try {
      setLoading(true);
      const items: ApprovalItem[] = [];

      // Load Settings for Workflow
      let workflow: any[] = [];
      try {
        const settings = await settingsAPI.getSettings();
        workflow = settings?.approval_workflow || [];
      } catch (e) {
        console.error('Failed to load workflow settings', e);
      }

      // Load Payroll Approvals
      const payrolls = await payrollAPI.getAllPayrollBatches();
      const pendingPayrolls = payrolls.filter((p: any) => 
        ['pending_review', 'in_review', 'pending_approval'].includes(p.status)
      );
      
      pendingPayrolls.forEach((p: any) => {
        // Check if user can approve
        const currentStage = p.current_approval_stage || 1;
        const stageConfig = workflow.find((w: any) => w.stage === currentStage);
        const requiredRole = normalizeRole(stageConfig?.role);
        
        // Admin can always approve. Specific roles must match the stage.
        // If workflow is not configured, fallback to standard roles? 
        // No, strict adherence to workflow is requested.
        // But if workflow is empty, maybe we shouldn't show anything or show all to admin?
        // Assuming admin is always safe.
        const canApprove = 
          normalizeRole(user?.role) === 'admin' || 
          (requiredRole && normalizeRole(user?.role) === requiredRole);

        if (canApprove) {
          items.push({
            id: p.id,
            type: 'payroll',
            title: `Payroll ${p.batch_number}`,
            subtitle: `${p.payroll_month || p.month || 'Unknown month'} - ${(p.total_staff ?? p.totalStaff ?? 0)} staff (Stage ${currentStage}: ${stageConfig?.name || 'Review'})`,
            amount: p.total_net ?? p.total_net_pay ?? p.totalNet ?? 0,
            status: p.status,
            created_at: p.created_at,
            urgency: calculateUrgency(p.created_at),
            data: p,
          });
        }
      });

      if (!isPayrollOnlyApproverRole) {
        // Load Loan Approvals
        const loansResult = await loanApplicationAPI.getAll();
        const loans = Array.isArray(loansResult) ? loansResult : (loansResult.data || []);
        const pendingLoans = loans.filter((l: any) => l.status === 'pending');
        
        pendingLoans.forEach((l: any) => {
          items.push({
            id: l.id,
            type: 'loan',
            title: `Loan Application`,
            subtitle: `${l.staff_name} - ${l.loan_type_name}`,
            amount: l.approved_amount || l.requested_amount,
            status: l.status,
            created_at: l.created_at,
            urgency: calculateUrgency(l.created_at),
            data: l,
          });
        });

        // Load Leave Approvals
        const leavesResult = await staffPortalAPI.getAllLeaveRequests();
        const leaves = Array.isArray(leavesResult) ? leavesResult : (leavesResult.data || []);
        const pendingLeaves = leaves.filter((l: any) => l.status === 'pending');
        
        pendingLeaves.forEach((l: any) => {
          const staffLabel = l.staff_name || [l.first_name, l.last_name].filter(Boolean).join(' ') || l.staff_number || 'Staff';
          const leaveTypeLabel = l.leave_type_name || l.leave_type || 'Leave';
          const daysVal = (l.number_of_days ?? l.days_requested);
          const daysLabel = typeof daysVal === 'number' ? `${daysVal} ${daysVal === 1 ? 'day' : 'days'}` : '-';
          items.push({
            id: l.id,
            type: 'leave',
            title: `Leave Request`,
            subtitle: `${staffLabel} - ${leaveTypeLabel} (${daysLabel})`,
            status: l.status,
            created_at: l.created_at,
            urgency: calculateLeaveUrgency(l.start_date),
            data: l,
          });
        });

        // Load Payment Batch Approvals
        const paymentsResult = await paymentBatchAPI.getAll();
        const payments = Array.isArray(paymentsResult) ? paymentsResult : (paymentsResult.data || []);
        const pendingPayments = payments.filter((p: any) => p.status === 'pending_approval');
        
        pendingPayments.forEach((p: any) => {
          items.push({
            id: p.id,
            type: 'payment',
            title: `Payment Batch ${p.batch_number}`,
            subtitle: `${p.payroll_month} - ${p.total_transactions} transactions`,
            amount: p.total_amount,
            status: p.status,
            created_at: p.created_at,
            urgency: 'high' as const,
            data: p,
          });
        });

        // Load Arrear Approvals
        try {
          const arrearsResult = await arrearsAPI.getPendingArrears();
          const arrears = Array.isArray(arrearsResult) ? arrearsResult : (arrearsResult?.data || []);
          const pendingArrears = arrears.filter((a: any) => a.status === 'pending');
          pendingArrears.forEach((a: any) => {
            items.push({
              id: a.id,
              type: 'arrear',
              title: `Arrears Payment`,
              subtitle: `${a.staff_name} - ${a.reason}`,
              amount: a.total_arrears,
              status: a.status,
              created_at: a.created_at,
              urgency: calculateUrgency(a.created_at),
              data: a,
            });
          });
        } catch (e) {}

        // Load Promotion Approvals
        const promotionsResult = await promotionAPI.getAll();
        const promotions = Array.isArray(promotionsResult) ? promotionsResult : (promotionsResult.data || []);
        const pendingPromotions = promotions.filter((p: any) => p.status === 'pending');
        
        pendingPromotions.forEach((p: any) => {
          items.push({
            id: p.id,
            type: 'promotion',
            title: `Promotion Request`,
            subtitle: `${p.staff_name} - Grade ${p.old_grade || 'N/A'} to ${p.new_grade || 'N/A'}`,
            amount: (p.new_salary || 0) - (p.old_salary || 0),
            status: p.status,
            created_at: p.created_at,
            urgency: calculateUrgency(p.created_at),
            data: p,
          });
        });

        // Load Staff Adjustments (Allowances)
        const allowancesResult = await staffAllowanceAPI.getAllStaffAllowances({ status: 'pending' });
        const allowances = allowancesResult.data || [];
        
        allowances.forEach((a: any) => {
          items.push({
            id: a.id,
            type: 'adjustment',
            title: `Allowance Adjustment`,
            subtitle: `${a.staff_name} - ${a.allowance_name}`,
            amount: a.amount,
            status: a.status,
            created_at: a.created_at,
            urgency: calculateUrgency(a.created_at),
            data: { ...a, adjustmentType: 'allowance' },
          });
        });

        // Load Staff Adjustments (Deductions)
        const deductionsResult = await staffDeductionAPI.getAllStaffDeductions({ status: 'pending' });
        const deductions = deductionsResult.data || [];
        
        deductions.forEach((d: any) => {
          items.push({
            id: d.id,
            type: 'adjustment',
            title: `Deduction Adjustment`,
            subtitle: `${d.staff_name} - ${d.deduction_name}`,
            amount: d.amount,
            status: d.status,
            created_at: d.created_at,
            urgency: calculateUrgency(d.created_at),
            data: { ...d, adjustmentType: 'deduction' },
          });
        });
      }

      // Sort by urgency and date
      items.sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setApprovalItems(items);

      // Calculate stats
      setStats({
        total: items.length,
        payroll: items.filter(i => i.type === 'payroll').length,
        loans: items.filter(i => i.type === 'loan').length,
        leaves: items.filter(i => i.type === 'leave').length,
        payments: items.filter(i => i.type === 'payment').length,
        arrears: items.filter(i => i.type === 'arrear').length,
        promotions: items.filter(i => i.type === 'promotion').length,
        adjustments: items.filter(i => i.type === 'adjustment').length,
        critical: items.filter(i => i.urgency === 'critical').length,
      });

      // Load My Approval Actions History (Payroll)
      try {
        const history = await payrollAPI.getMyApprovalHistory();
        setMyActions(history?.data || history || []);
      } catch (e) {
        console.error('Failed to load my approval history', e);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
      showToast('error', 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const calculateUrgency = (createdAt: string): ApprovalItem['urgency'] => {
    const daysOld = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOld > 7) return 'critical';
    if (daysOld > 3) return 'high';
    if (daysOld > 1) return 'medium';
    return 'low';
  };

  const calculateLeaveUrgency = (startDate: string): ApprovalItem['urgency'] => {
    const daysUntilStart = Math.floor((new Date(startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilStart <= 2) return 'critical';
    if (daysUntilStart <= 5) return 'high';
    if (daysUntilStart <= 10) return 'medium';
    return 'low';
  };

  const handleApprove = async () => {
    if (!selectedItem) return;

    try {
      setActionLoading(true);

      switch (selectedItem.type) {
        case 'payroll':
          const stage = selectedItem.data.current_approval_stage || 1;
          await payrollAPI.approvePayrollStage(selectedItem.id, stage, user!.id, user!.email, comments);
          break;
        
        case 'loan':
          await loanApplicationAPI.processApproval(selectedItem.id, user!.id, user!.full_name, 'approved', comments, selectedItem.amount);
          break;
        
        case 'leave':
          await staffPortalAPI.approveLeaveRequest(selectedItem.id, user!.id, user!.email);
          break;
        
        case 'payment':
          await paymentBatchAPI.approveForPayment(selectedItem.id, user!.id, user!.full_name);
          break;
        
        case 'arrear':
          await arrearsAPI.approveArrears(selectedItem.id, user!.id, user!.email);
          break;
        
        case 'promotion':
          await promotionAPI.approvePromotion(selectedItem.id, user!.id, user!.email);
          break;

        case 'adjustment':
          if (selectedItem.data.adjustmentType === 'allowance') {
            await staffAllowanceAPI.updateStaffAllowance(selectedItem.id, { status: 'active' }, user!.id, user!.email);
          } else {
            await staffDeductionAPI.updateStaffDeduction(selectedItem.id, { status: 'active' }, user!.id, user!.email);
          }
          break;
      }

      showToast('success', `${selectedItem.type} approved successfully`);
      setShowApprovalModal(false);
      setSelectedItem(null);
      setComments('');
      loadAllApprovals();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !comments.trim()) {
      showToast('error', 'Please provide rejection comments');
      return;
    }

    try {
      setActionLoading(true);

      switch (selectedItem.type) {
        case 'payroll':
          const stage = selectedItem.data.current_approval_stage || 1;
          await payrollAPI.rejectPayrollStage(selectedItem.id, stage, user!.id, user!.email, comments);
          break;
        
        case 'loan':
          await loanApplicationAPI.processApproval(selectedItem.id, user!.id, user!.full_name, 'rejected', comments);
          break;
        
        case 'leave':
          await staffPortalAPI.rejectLeaveRequest(selectedItem.id, user!.id, user!.email, comments);
          break;
        
        case 'arrear':
          await arrearsAPI.rejectArrears(selectedItem.id, user!.id, user!.email, comments);
          break;
        
        case 'promotion':
          await promotionAPI.rejectPromotion(selectedItem.id, user!.id, user!.email, comments);
          break;

        case 'adjustment':
          if (selectedItem.data.adjustmentType === 'allowance') {
            await staffAllowanceAPI.updateStaffAllowance(selectedItem.id, { status: 'inactive' }, user!.id, user!.email);
          } else {
            await staffDeductionAPI.updateStaffDeduction(selectedItem.id, { status: 'inactive' }, user!.id, user!.email);
          }
          break;

        case 'payment':
          // Payment batches don't have reject - just delete
          showToast('info', 'Payment batches cannot be rejected, only deleted');
          return;
      }

      showToast('success', `${selectedItem.type} rejected`);
      setShowApprovalModal(false);
      setSelectedItem(null);
      setComments('');
      loadAllApprovals();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeIcon = (type: ApprovalType) => {
    const icons = {
      payroll: FileText,
      loan: Wallet,
      leave: Calendar,
      payment: CreditCard,
      arrear: TrendingUp,
      promotion: Award,
      adjustment: Sliders,
    };
    return icons[type];
  };

  const getUrgencyBadge = (urgency: ApprovalItem['urgency']) => {
    const badges = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${badges[urgency]}`}>{urgency.toUpperCase()}</span>;
  };

  const filteredItems = activeTab === 'all' 
    ? approvalItems 
    : approvalItems.filter(item => item.type === activeTab);

  const columns = [
    {
      header: 'Type',
      accessor: (row: ApprovalItem) => {
        const Icon = getTypeIcon(row.type);
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <span className="capitalize">{row.type}</span>
          </div>
        );
      },
    },
    { header: 'Title', accessor: 'title' as keyof ApprovalItem },
    { header: 'Details', accessor: 'subtitle' as keyof ApprovalItem },
    {
      header: 'Amount',
      accessor: (row: ApprovalItem) => (row.amount !== undefined && row.amount !== null) ? formatCurrency(row.amount) : '-',
    },
    {
      header: 'Urgency',
      accessor: (row: ApprovalItem) => getUrgencyBadge(row.urgency),
    },
    {
      header: 'Submitted',
      accessor: (row: ApprovalItem) => {
        const date = new Date(row.created_at);
        const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div>
            <div className="text-sm">{date.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">{daysAgo} days ago</div>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (row: ApprovalItem) => (
        <button
          onClick={() => {
            setSelectedItem(row);
            setShowApprovalModal(true);
          }}
          className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          Review
        </button>
      ),
    },
  ];

  const isPayrollOfficer = user?.role === 'payroll_officer';
  const tabs = [
    ...(isPayrollOnlyApproverRole
      ? ([
          { id: 'all', label: 'All Approvals', count: stats.total },
          { id: 'payroll', label: 'Payroll', count: stats.payroll },
          { id: 'history', label: 'My Actions', count: myActions.length },
        ] as const)
      : isPayrollOfficer
        ? ([
            { id: 'all', label: 'All Approvals', count: stats.total },
            { id: 'payroll', label: 'Payroll', count: stats.payroll },
            { id: 'loan', label: 'Loans', count: stats.loans },
            { id: 'payment', label: 'Payments', count: stats.payments },
            { id: 'arrear', label: 'Arrears', count: stats.arrears },
            { id: 'adjustment', label: 'Adjustments', count: stats.adjustments },
            { id: 'history', label: 'My Actions', count: myActions.length },
          ] as const)
        : ([
            { id: 'all', label: 'All Approvals', count: stats.total },
            { id: 'payroll', label: 'Payroll', count: stats.payroll },
            { id: 'loan', label: 'Loans', count: stats.loans },
            { id: 'leave', label: 'Leaves', count: stats.leaves },
            { id: 'payment', label: 'Payments', count: stats.payments },
            { id: 'arrear', label: 'Arrears', count: stats.arrears },
            { id: 'promotion', label: 'Promotions', count: stats.promotions },
            { id: 'adjustment', label: 'Adjustments', count: stats.adjustments },
            { id: 'history', label: 'My Actions', count: myActions.length },
          ] as const)),
  ];

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  const renderDetails = () => {
    if (!selectedItem) return null;
    const data = selectedItem.data;

    switch (selectedItem.type) {
      case 'leave':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" /> Staff Information
                </h4>
                <div className="bg-muted/30 p-3 rounded-lg border border-border grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Name</span>
                    <p className="font-medium text-foreground">{data.first_name} {data.last_name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Staff Number</span>
                    <p className="font-medium text-foreground">{data.staff_number}</p>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Leave Request Details
                </h4>
                <div className="bg-muted/30 p-3 rounded-lg border border-border grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Type</span>
                    <p className="font-medium text-foreground">{data.leave_type_name || data.leave_type}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Duration</span>
                    <p className="font-medium text-foreground">{data.number_of_days} days</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Start Date</span>
                    <p className="font-medium text-foreground">{new Date(data.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">End Date</span>
                    <p className="font-medium text-foreground">{new Date(data.end_date).toLocaleDateString()}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Reason</span>
                    <p className="mt-1 text-foreground bg-background p-2 rounded border border-border/50 text-sm">
                      {data.reason}
                    </p>
                  </div>
                  {data.relief_officer_staff_id && (
                    <div className="col-span-2 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Relief Officer</span>
                      <p className="font-medium text-foreground">
                        {data.relief_officer_first_name} {data.relief_officer_last_name} 
                        <span className="text-muted-foreground font-normal ml-1">({data.relief_officer_staff_number})</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'loan':
        return (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Applicant</span>
                  <p className="font-medium text-foreground">{data.staff_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Loan Type</span>
                  <p className="font-medium text-foreground">{data.loan_type_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Amount</span>
                  <p className="font-medium text-foreground">{formatCurrency(data.requested_amount || 0)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Duration</span>
                  <p className="font-medium text-foreground">{data.duration_months} months</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Purpose</span>
                <p className="mt-1 text-sm text-foreground bg-background p-2 rounded border border-border/50">
                  {data.reason || 'No reason provided'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'payroll':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Batch Number</span>
                <p className="font-medium text-foreground">{data.batch_number}</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Period</span>
                <p className="font-medium text-foreground">
                  {(() => {
                    const period = data.payroll_month || data.month;
                    if (!period) return 'N/A';
                    const date = new Date(period);
                    return !isNaN(date.getTime()) 
                      ? date.toLocaleString('default', { month: 'long' })
                      : period;
                  })()}
                </p>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Staff</span>
                <p className="font-medium text-foreground">{data.total_staff}</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Net Pay</span>
                <p className="font-medium text-foreground">{formatCurrency(data.total_net_pay || data.total_net || 0)}</p>
              </div>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Batch Number</span>
                <p className="font-medium text-foreground">{data.batch_number}</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Payroll Month</span>
                <p className="font-medium text-foreground">{data.payroll_month}</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Transactions</span>
                <p className="font-medium text-foreground">{data.total_transactions}</p>
              </div>
              <div className="bg-muted/30 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Amount</span>
                <p className="font-medium text-foreground">{formatCurrency(data.total_amount || 0)}</p>
              </div>
            </div>
          </div>
        );

      case 'arrear':
        return (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Staff Name</span>
                  <p className="font-medium text-foreground">{data.staff_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Amount</span>
                  <p className="font-medium text-foreground">{formatCurrency(data.total_arrears || 0)}</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Reason</span>
                <p className="mt-1 text-sm text-foreground bg-background p-2 rounded border border-border/50">
                  {data.reason}
                </p>
              </div>
            </div>
          </div>
        );

      case 'promotion':
        return (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Staff Name</span>
                <p className="font-medium text-foreground">{data.staff_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background rounded border border-border/50">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Current Grade</span>
                  <p className="font-medium text-foreground">{data.old_grade || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatCurrency(data.old_salary || 0)}</p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                  <span className="text-xs text-green-700 dark:text-green-300 uppercase tracking-wider block mb-1">New Grade</span>
                  <p className="font-medium text-foreground">{data.new_grade || 'N/A'}</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">{formatCurrency(data.new_salary || 0)}</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Salary Increase</span>
                <p className="font-medium text-green-600 dark:text-green-400">
                  +{formatCurrency((data.new_salary || 0) - (data.old_salary || 0))}
                </p>
              </div>
            </div>
          </div>
        );

      case 'adjustment':
        return (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Staff Name</span>
                  <p className="font-medium text-foreground">{data.staff_name}</p>
                </div>
                <div>
                   <span className="text-xs text-muted-foreground uppercase tracking-wider">Type</span>
                   <p className="font-medium text-foreground">{data.adjustmentType === 'allowance' ? 'Allowance' : 'Deduction'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Item</span>
                  <p className="font-medium text-foreground">{data.adjustmentType === 'allowance' ? data.allowance_name : data.deduction_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Amount</span>
                  <p className="font-medium text-foreground">{formatCurrency(data.amount || 0)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Frequency</span>
                  <p className="font-medium text-foreground capitalize">{data.frequency}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Start Date</span>
                  <p className="font-medium text-foreground">{new Date(data.start_date).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-muted/30 rounded-lg p-4 border border-border max-h-96 overflow-y-auto">
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Approvals' }]} />

      <div className="mb-6">
        <h1 className="text-foreground mb-2">Approvals Dashboard</h1>
        <p className="text-muted-foreground">Centralized approval management for all entities</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Pending</span>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting your action</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Critical Items</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          <p className="text-xs text-muted-foreground mt-1">Requires immediate attention</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">High Priority</span>
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {approvalItems.filter(i => i.urgency === 'high').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Action needed soon</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">This Week</span>
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {approvalItems.filter(i => {
              const daysOld = Math.floor((Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24));
              return daysOld <= 7;
            }).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Submitted recently</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <div className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label} {tab.count > 0 && <span className="ml-1 text-xs">({tab.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Approvals Table or My Actions */}
      {activeTab === 'history' ? (
        myActions.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Info className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2">No Approval History</h3>
            <p className="text-muted-foreground">Your approved/rejected actions will appear here</p>
          </div>
        ) : (
          <DataTable
            data={myActions}
            columns={[
              { header: 'Batch Number', accessor: 'batch_number' as keyof any },
              { header: 'Month', accessor: 'month' as keyof any },
              { header: 'Stage', accessor: 'stage_name' as keyof any },
              { header: 'Status', accessor: (row: any) => <StatusBadge status={row.status} /> },
              { header: 'Date', accessor: (row: any) => new Date(row.action_date).toLocaleString() },
            ]}
            searchable
            searchPlaceholder="Search by batch number or month..."
          />
        )
      ) : (
        filteredItems.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2">No Pending Approvals</h3>
            <p className="text-muted-foreground">
              {activeTab === 'all' ? 'All items are up to date' : `No pending ${activeTab} approvals`}
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredItems}
            columns={columns}
            searchable
            searchPlaceholder="Search approvals..."
          />
        )
      )}

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedItem(null);
          setComments('');
        }}
        title={selectedItem ? `Review ${selectedItem.type}` : 'Review'}
        size="md"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <h3 className="font-semibold text-foreground">{selectedItem.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedItem.subtitle}</p>
              </div>
              <div className="text-right">
                {getUrgencyBadge(selectedItem.urgency)}
                {selectedItem.amount && (
                  <p className="text-lg font-bold text-primary mt-2">
                    {formatCurrency(selectedItem.amount)}
                  </p>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="font-medium text-foreground">{new Date(selectedItem.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium text-foreground capitalize">{selectedItem.status.replace('_', ' ')}</p>
              </div>
            </div>

            {/* Type-specific details */}
            <div className="border border-border rounded-lg p-4 max-h-64 overflow-y-auto">
              <h4 className="font-medium text-foreground mb-3">Details</h4>
              {renderDetails()}
            </div>

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Comments {selectedItem.type !== 'leave' && '(Optional)'}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Enter your comments..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedItem(null);
                  setComments('');
                }}
                className="px-4 py-2 text-foreground hover:bg-accent rounded-lg"
                disabled={actionLoading}
              >
                Cancel
              </button>
              {selectedItem.type !== 'payment' && (
                <button
                  onClick={handleReject}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  disabled={actionLoading}
                >
                  <ThumbsDown className="w-4 h-4" />
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </button>
              )}
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                disabled={actionLoading}
              >
                <ThumbsUp className="w-4 h-4" />
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
