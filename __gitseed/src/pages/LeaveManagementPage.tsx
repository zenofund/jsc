import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { staffPortalAPI } from '../lib/api-client';
import { LeaveRequest } from '../types/entities';
import { formatDate } from '../lib/date-utils';
import { PageSkeleton } from '../components/PageLoader';
import { Calendar, CheckCircle, XCircle, Clock, User, FileText, Loader2 } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

export function LeaveManagementPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    loadLeaveRequests();
  }, [filterStatus]);

  const loadLeaveRequests = async () => {
    try {
      let response: any;
      if (filterStatus === 'all') {
        response = await staffPortalAPI.getAllLeaveRequests();
      } else {
        response = await staffPortalAPI.getAllLeaveRequests(filterStatus);
      }
      
      const requests = Array.isArray(response) ? response : (response.data || []);
      setLeaveRequests(requests.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)));
    } catch (error) {
      showToast('error', 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (leaveId: string) => {
    if (!await confirm('Are you sure you want to approve this leave request?')) {
      return;
    }

    try {
      setProcessingLeaveId(leaveId);
      await staffPortalAPI.approveLeaveRequest(leaveId, user!.id, user!.email);
      showToast('success', 'Leave request approved successfully');
      loadLeaveRequests();
      setShowDetailsModal(false);
    } catch (error) {
      showToast('error', 'Failed to approve leave request');
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedLeave || !rejectionReason.trim()) {
      showToast('error', 'Please provide a rejection reason');
      return;
    }

    try {
      setIsRejecting(true);
      await staffPortalAPI.rejectLeaveRequest(selectedLeave.id, user!.id, user!.email, rejectionReason);
      showToast('success', 'Leave request rejected');
      setShowRejectModal(false);
      setShowDetailsModal(false);
      setRejectionReason('');
      loadLeaveRequests();
    } catch (error) {
      showToast('error', 'Failed to reject leave request');
    } finally {
      setIsRejecting(false);
    }
  };

  const getLeaveTypeColor = (type: string) => {
    const lowerType = (type || '').toLowerCase();
    const colors: Record<string, string> = {
      annual: 'text-green-600 bg-green-100 dark:bg-green-950/30 dark:text-green-400',
      sick: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400',
      maternity: 'text-pink-600 bg-pink-100 dark:bg-pink-950/30 dark:text-pink-400',
      paternity: 'text-blue-600 bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400',
      study: 'text-purple-600 bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400',
      compassionate: 'text-gray-600 bg-gray-100 dark:bg-gray-950/30 dark:text-gray-400',
      unpaid: 'text-red-600 bg-red-100 dark:bg-red-950/30 dark:text-red-400',
    };
    
    if (lowerType.includes('annual')) return colors.annual;
    if (lowerType.includes('sick')) return colors.sick;
    if (lowerType.includes('maternity')) return colors.maternity;
    if (lowerType.includes('paternity')) return colors.paternity;
    if (lowerType.includes('study')) return colors.study;
    if (lowerType.includes('compassionate')) return colors.compassionate;
    if (lowerType.includes('unpaid')) return colors.unpaid;
    
    return colors.annual;
  };

  const columns = [
    {
      header: 'Staff Number',
      accessor: 'staff_number' as keyof LeaveRequest,
      sortable: true,
    },
    {
      header: 'Staff Name',
      accessor: (row: any) => `${row.first_name || ''} ${row.last_name || ''}`,
      sortable: true,
    },
    {
      header: 'Leave Type',
      accessor: (row: any) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getLeaveTypeColor(row.leave_type_name || row.leave_type)}`}>
          {(row.leave_type_name || row.leave_type || '').replace(/_/g, ' ').toUpperCase()}
        </span>
      ),
    },
    {
      header: 'Start Date',
      accessor: (row: LeaveRequest) => formatDate(row.start_date),
      sortable: true,
    },
    {
      header: 'End Date',
      accessor: (row: LeaveRequest) => formatDate(row.end_date),
      sortable: true,
    },
    {
      header: 'Days',
      accessor: 'number_of_days' as keyof LeaveRequest,
      sortable: true,
    },
    {
      header: 'Status',
      accessor: (row: LeaveRequest) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      accessor: (row: LeaveRequest) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedLeave(row);
              setShowDetailsModal(true);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            title="View Details"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleApprove(row.id);
                }}
                disabled={processingLeaveId === row.id}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {processingLeaveId === row.id && <Loader2 className="w-3 h-3 animate-spin" />}
                Approve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setSelectedLeave(row);
                  setShowRejectModal(true);
                }}
                disabled={processingLeaveId === row.id}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // Calculate stats
  const stats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter(l => l.status === 'pending').length,
    approved: leaveRequests.filter(l => l.status === 'approved').length,
    rejected: leaveRequests.filter(l => l.status === 'rejected').length,
  };

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Leave Management' }]} />
      
      <div className="mb-6">
        <h1 className="page-title">Leave Management</h1>
        <p className="text-muted-foreground">Review and manage staff leave requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 justify-items-center md:justify-items-stretch max-w-sm md:max-w-none mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-500" />
          </div>
          <div className="text-2xl font-semibold text-foreground">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Requests</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="text-2xl font-semibold text-foreground">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Pending Review</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-500" />
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
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground border border-border hover:bg-muted'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading leave requests...</div>
      ) : (
        <DataTable
          data={leaveRequests}
          columns={columns}
          searchable
          searchPlaceholder="Search by staff name or number..."
        />
      )}

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Leave Request Details"
        footer={
          selectedLeave?.status === 'pending' ? (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setShowRejectModal(true);
                }}
                disabled={processingLeaveId === selectedLeave!.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedLeave!.id)}
                disabled={processingLeaveId === selectedLeave!.id}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {processingLeaveId === selectedLeave!.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Approve
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDetailsModal(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          )
        }
      >
        {selectedLeave && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Staff Number</label>
                <p className="text-foreground">{(selectedLeave as any).staff_number}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Staff Name</label>
                <p className="text-foreground">{(selectedLeave as any).first_name} {(selectedLeave as any).last_name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Leave Type</label>
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getLeaveTypeColor((selectedLeave as any).leave_type_name || selectedLeave.leave_type)}`}>
                  {((selectedLeave as any).leave_type_name || selectedLeave.leave_type || '').replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Status</label>
                <StatusBadge status={selectedLeave.status} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
                <p className="text-foreground">{formatDate(selectedLeave.start_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
                <p className="text-foreground">{formatDate(selectedLeave.end_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Days Requested</label>
                <p className="text-foreground font-semibold">{selectedLeave.number_of_days} days</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Reason</label>
              <p className="text-foreground bg-muted p-3 rounded-lg">{selectedLeave.reason}</p>
            </div>

            {selectedLeave.status === 'approved' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-green-700 dark:text-green-400 mb-1">Approved By</label>
                  <p className="text-foreground">{selectedLeave.approved_by}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-700 dark:text-green-400 mb-1">Approval Date</label>
                  <p className="text-foreground">{formatDate(selectedLeave.approval_date)}</p>
                </div>
              </div>
            )}

            {selectedLeave.status === 'rejected' && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                <label className="block text-sm font-medium text-red-700 dark:text-red-400 mb-1">Rejection Reason</label>
                <p className="text-foreground">{selectedLeave.rejection_reason}</p>
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
              Request submitted on: {new Date(selectedLeave.created_at).toLocaleString()}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectionReason('');
        }}
        title="Reject Leave Request"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowRejectModal(false);
                setRejectionReason('');
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={isRejecting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRejecting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Rejection
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please provide a reason for rejecting this leave request. This will be communicated to the staff member.
          </p>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Rejection Reason *
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={4}
              placeholder="Enter reason for rejection..."
              required
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}