import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { PageSkeleton } from '../../components/PageLoader';
import { 
  payrollAPI, 
  loanApplicationAPI, 
  staffPortalAPI,
  arrearsAPI,
  promotionAPI,
  paymentBatchAPI,
} from '../../lib/api-client';
import { NotificationIntegration } from '../../lib/notification-integration';
import {
  CheckCircle,
  Clock,
  FileText,
  Wallet,
  Calendar,
  CreditCard,
  TrendingUp,
  Award,
  AlertCircle,
  Eye,
} from 'lucide-react';

type ApprovalType = 'payroll' | 'loan' | 'leave' | 'payment' | 'arrear' | 'promotion';
type TabType = 'all' | ApprovalType;

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

export function ApprovalsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(true);
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [comments, setComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    payroll: 0,
    loans: 0,
    leaves: 0,
    payments: 0,
    arrears: 0,
    promotions: 0,
    critical: 0,
  });

  useEffect(() => {
    loadAllApprovals();
  }, []);

  const loadAllApprovals = async () => {
    try {
      setLoading(true);
      const items: ApprovalItem[] = [];

      // Load Payroll Approvals
      try {
        const payrollsResponse = await payrollAPI.getAllPayrollBatches();
        const payrolls = Array.isArray(payrollsResponse) ? payrollsResponse : (payrollsResponse?.data || []);
        const pendingPayrolls = (Array.isArray(payrolls) ? payrolls : []).filter(p => 
          ['pending_review', 'in_review', 'pending_approval'].includes(p.status)
        );
        
        pendingPayrolls.forEach(p => {
          items.push({
            id: p.id,
            type: 'payroll',
            title: `Payroll ${p.batch_number}`,
            subtitle: `${p.month} - ${p.total_staff} staff`,
            amount: p.total_net_pay,
            status: p.status,
            created_at: p.created_at,
            urgency: calculateUrgency(p.created_at),
            data: p,
          });
        });
      } catch (e) { console.error('Error loading payrolls', e); }

      // Load Loan Approvals
      try {
        const loansResponse = await loanApplicationAPI.getAll();
        const loans = Array.isArray(loansResponse) ? loansResponse : (loansResponse?.data || []);
        const pendingLoans = (Array.isArray(loans) ? loans : []).filter(l => l.status === 'pending');
        
        pendingLoans.forEach(l => {
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
      } catch (e) { console.error('Error loading loans', e); }

      // Load Leave Approvals
      try {
        const leavesResponse = await staffPortalAPI.getAllLeaveRequests();
        const leaves = Array.isArray(leavesResponse) ? leavesResponse : (leavesResponse?.data || []);
        const pendingLeaves = (Array.isArray(leaves) ? leaves : []).filter(l => l.status === 'pending');
        
        pendingLeaves.forEach(l => {
          items.push({
            id: l.id,
            type: 'leave',
            title: `Leave Request`,
            subtitle: `${l.staff_name || 'Staff'} - ${l.leave_type_name || 'Leave'} (${l.number_of_days ?? 0} days)`,
            status: l.status,
            created_at: l.created_at,
            urgency: calculateLeaveUrgency(l.start_date),
            data: l,
          });
        });
      } catch (e) { console.error('Error loading leaves', e); }

      // Load Payment Batch Approvals
      try {
        const paymentsResponse = await paymentBatchAPI.getAll();
        const payments = Array.isArray(paymentsResponse) ? paymentsResponse : (paymentsResponse?.data || []);
        const pendingPayments = (Array.isArray(payments) ? payments : []).filter(p => p.status === 'pending_approval');
        
        pendingPayments.forEach(p => {
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
      } catch (e) { console.error('Error loading payments', e); }

      // Load Arrear Approvals
      try {
        const arrearsResponse = await arrearsAPI.getAll();
        const arrears = Array.isArray(arrearsResponse) ? arrearsResponse : (arrearsResponse?.data || []);
        const pendingArrears = (Array.isArray(arrears) ? arrears : []).filter(a => a.status === 'pending');
        
        pendingArrears.forEach(a => {
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
      } catch (e) { console.error('Error loading arrears', e); }

      // Load Promotion Approvals
      try {
        const promotionsResponse = await promotionAPI.getAll();
        const promotions = Array.isArray(promotionsResponse) ? promotionsResponse : (promotionsResponse?.data || []);
        const pendingPromotions = (Array.isArray(promotions) ? promotions : []).filter(p => p.status === 'pending');
        
        pendingPromotions.forEach(p => {
          items.push({
            id: p.id,
            type: 'promotion',
            title: `Promotion Request`,
            subtitle: `${p.staff_name} - Grade ${p.old_grade_level ?? 'N/A'} to ${p.new_grade_level ?? 'N/A'}`,
            amount: (p.new_basic_salary || 0) - (p.old_basic_salary || 0),
            status: p.status,
            created_at: p.created_at,
            urgency: calculateUrgency(p.created_at),
            data: p,
          });
        });
      } catch (e) { console.error('Error loading promotions', e); }

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
        critical: items.filter(i => i.urgency === 'critical').length,
      });
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
          // Notify next stage or final approval
          if (stage >= 3) {
            await NotificationIntegration.notifyPayrollApproved(
              selectedItem.data.batch_number,
              selectedItem.data.month,
              selectedItem.data.created_by
            );
          }
          break;
        
        case 'loan':
          await loanApplicationAPI.processApproval(selectedItem.id, user!.id, user!.full_name, 'approved', comments);
          await NotificationIntegration.notifyLoanApplicationApproved(
            selectedItem.data.loan_type_name,
            selectedItem.data.approved_amount || selectedItem.data.requested_amount,
            selectedItem.data.staff_id
          );
          break;
        
        case 'leave':
          await staffPortalAPI.approveLeaveRequest(selectedItem.id, user!.id, user!.email);
          await NotificationIntegration.notifyLeaveRequestApproved(
            selectedItem.data.leave_type_name,
            selectedItem.data.start_date,
            selectedItem.data.end_date,
            selectedItem.data.staff_id
          );
          break;
        
        case 'payment':
          await paymentBatchAPI.approveForPayment(selectedItem.id, user!.id, user!.email);
          await NotificationIntegration.notifyPaymentBatchApproved(
            selectedItem.data.batch_number,
            selectedItem.data.total_amount,
            [selectedItem.data.created_by] // Notify creator
          );
          break;
        
        case 'arrear':
          await arrearsAPI.approveArrears(selectedItem.id, user!.id, user!.email);
          // No specific notification for arrears yet in Integration class, skipping or adding generic if needed
          break;
        
        case 'promotion':
          await promotionAPI.approvePromotion(selectedItem.id, user!.id, user!.email);
          await NotificationIntegration.notifyPromotionApproved(
            selectedItem.data.staff_name,
            selectedItem.data.new_grade_level,
            selectedItem.data.new_step,
            selectedItem.data.staff_id
          );
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
          await NotificationIntegration.notifyPayrollRejected(
            selectedItem.data.batch_number,
            selectedItem.data.month,
            comments,
            selectedItem.data.created_by
          );
          break;
        
        case 'loan':
          await loanApplicationAPI.processApproval(selectedItem.id, user!.id, user!.full_name, 'rejected', comments);
          // No explicit reject notification in Integration class for Loan, let's skip for now or add one
          break;
        
        case 'leave':
          await staffPortalAPI.rejectLeaveRequest(selectedItem.id, user!.id, user!.email, comments);
          await NotificationIntegration.notifyLeaveRequestRejected(
            selectedItem.data.leave_type_name,
            comments,
            selectedItem.data.staff_id
          );
          break;
        
        case 'arrear':
          await arrearsAPI.rejectArrears(selectedItem.id, user!.id, user!.email, comments);
          break;
        
        case 'promotion':
          await promotionAPI.rejectPromotion(selectedItem.id, user!.id, user!.email, comments);
          // No explicit reject notification in Integration class for Promotion
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
      accessor: (row: ApprovalItem) => row.amount ? `₦${row.amount.toLocaleString('en-NG')}` : '-',
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

  const tabs = [
    { id: 'all', label: 'All Approvals', count: stats.total },
    { id: 'payroll', label: 'Payroll', count: stats.payroll },
    { id: 'loan', label: 'Loans', count: stats.loans },
    { id: 'leave', label: 'Leaves', count: stats.leaves },
    { id: 'payment', label: 'Payments', count: stats.payments },
    { id: 'arrear', label: 'Arrears', count: stats.arrears },
    { id: 'promotion', label: 'Promotions', count: stats.promotions },
  ];

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

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

      {/* Approvals Table */}
      {filteredItems.length === 0 ? (
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
        size="lg"
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
                    ₦{selectedItem.amount.toLocaleString('en-NG')}
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
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(selectedItem.data, null, 2)}
              </pre>
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
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Reject'}
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Approve'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
