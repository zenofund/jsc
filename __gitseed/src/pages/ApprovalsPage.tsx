import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { payrollAPI, workflowAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { CheckCircle, XCircle, MessageSquare, Clock, FileText, DollarSign, User, Info, Loader2 } from 'lucide-react';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';

export function ApprovalsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'general' | 'payroll' | 'history'>('general');
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [generalApprovals, setGeneralApprovals] = useState<any[]>([]);
  const [myActions, setMyActions] = useState<any[]>([]);
  
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  
  const [workflowStages, setWorkflowStages] = useState<any[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      
      // Load Payroll Approvals
      try {
        const batches = await payrollAPI.getAllPayrollBatches();
        const pending = batches.filter((b: any) => 
          ['pending_review', 'in_review', 'pending_approval'].includes(b.status)
        );
        setPendingApprovals(pending);
      } catch (err) {
        console.error('Failed to load payroll batches', err);
      }

      // Load General Approvals
      try {
        const general = await workflowAPI.getMyApprovals();
        setGeneralApprovals(general);
      } catch (err) {
        console.error('Failed to load general approvals', err);
      }

      // Load My Approval Actions History
      try {
        const history = await payrollAPI.getMyApprovalHistory();
        setMyActions(history?.data || history || []);
      } catch (err) {
        console.error('Failed to load my approval history', err);
      }
      
    } catch (error) {
      showToast('error', 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  // Payroll Handlers
  const handleViewWorkflow = async (batch: any) => {
    try {
      setSelectedBatch(batch);
      // Fetch full batch details including workflow approvals from backend
      const batchDetails = await payrollAPI.getPayrollBatch(batch.id);
      const approvals = batchDetails.workflow_approvals || [];
      setWorkflowStages(approvals.sort((a: any, b: any) => a.stage - b.stage));
      setShowApprovalModal(true);
    } catch (error) {
      showToast('error', 'Failed to load workflow details');
    }
  };

  const handleApprove = async () => {
    if (!selectedBatch) return;

    try {
      const currentStage = selectedBatch.current_approval_stage || 1;
      await payrollAPI.approvePayrollStage(selectedBatch.id, currentStage, user!.id, user!.email, comments);
      showToast('success', 'Payroll approved successfully');
      setShowApprovalModal(false);
      setComments('');
      loadApprovals();
    } catch (error) {
      showToast('error', 'Failed to approve payroll');
    }
  };

  const handleReject = async () => {
    if (!selectedBatch || !comments.trim()) {
      showToast('error', 'Please provide rejection comments');
      return;
    }

    try {
      setProcessingAction('reject');
      const currentStage = selectedBatch.current_approval_stage || 1;
      await payrollAPI.rejectPayrollStage(selectedBatch.id, currentStage, user!.id, user!.email, comments);
      showToast('success', 'Payroll rejected');
      setShowApprovalModal(false);
      setComments('');
      loadApprovals();
    } catch (error) {
      showToast('error', 'Failed to reject payroll');
    } finally {
      setProcessingAction(null);
    }
  };

  // General Handlers
  const handleViewRequest = (request: any) => {
    setSelectedRequest(request);
    setShowGeneralModal(true);
  };

  const handleGeneralApprove = async () => {
    if (!selectedRequest) return;
    try {
      await workflowAPI.processApproval(selectedRequest.id, 'approve', comments);
      showToast('success', 'Request approved');
      setShowGeneralModal(false);
      setComments('');
      loadApprovals();
    } catch (error) {
      showToast('error', 'Failed to approve request');
    }
  };

  const handleGeneralReject = async () => {
    if (!selectedRequest || !comments.trim()) {
      showToast('error', 'Please provide rejection comments');
      return;
    }
    try {
      setProcessingAction('reject');
      await workflowAPI.processApproval(selectedRequest.id, 'reject', comments);
      showToast('success', 'Request rejected');
      setShowGeneralModal(false);
      setComments('');
      loadApprovals();
    } catch (error) {
      showToast('error', 'Failed to reject request');
    } finally {
      setProcessingAction(null);
    }
  };

  // Columns Definitions
  const payrollColumns = [
    {
      header: 'Batch Number',
      accessor: 'batch_number' as keyof any,
      sortable: true,
    },
    {
      header: 'Month',
      accessor: 'month' as keyof any,
      sortable: true,
    },
    {
      header: 'Total Staff',
      accessor: 'total_staff' as keyof any,
    },
    {
      header: 'Net Pay',
      accessor: (row: any) => `₦${row.total_net.toLocaleString()}`,
    },
    {
      header: 'Current Stage',
      accessor: (row: any) => `Stage ${row.current_approval_stage || 1}`,
    },
    {
      header: 'Status',
      accessor: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewWorkflow(row);
          }}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Review
        </button>
      ),
    },
  ];

  const generalColumns = [
    {
      header: 'Type',
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          {row.entity_type === 'leave' ? <Clock className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-gray-500" />}
          <span className="capitalize">{row.workflow_name || row.entity_type}</span>
        </div>
      ),
    },
    {
      header: 'Requester',
      accessor: 'requester_name' as keyof any,
    },
    {
      header: 'Step',
      accessor: 'step_name' as keyof any,
    },
    {
      header: 'Date',
      accessor: (row: any) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      header: 'Status',
      accessor: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewRequest(row);
          }}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Review
        </button>
      ),
    },
  ];

  const historyColumns = [
    {
      header: 'Batch Number',
      accessor: 'batch_number' as keyof any,
      sortable: true,
    },
    {
      header: 'Month',
      accessor: 'month' as keyof any,
      sortable: true,
    },
    {
      header: 'Stage',
      accessor: 'stage_name' as keyof any,
    },
    {
      header: 'Status',
      accessor: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Date',
      accessor: (row: any) => new Date(row.action_date).toLocaleString(),
    },
  ];

  // Helper for payroll stages
  const canApproveCurrentStage = (batch: any) => {
    if (!batch || !user) return false;
    const currentStage = batch.current_approval_stage || 1;
    const stageApproval = workflowStages.find(s => s.stage === currentStage);
    return stageApproval && stageApproval.approver_role === user.role && stageApproval.status === 'pending';
  };

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title">Approvals</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border mb-6">
        <button
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('general')}
        >
          General Requests
          {generalApprovals.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {generalApprovals.length}
            </span>
          )}
        </button>
        <button
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'payroll'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('payroll')}
        >
          Payroll Batches
          {pendingApprovals.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {pendingApprovals.length}
            </span>
          )}
        </button>
        <button
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('history')}
        >
          My Actions
          {myActions.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {myActions.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'general' ? (
        generalApprovals.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
            <h3 className="font-medium text-card-foreground mb-2">No Pending Requests</h3>
            <p className="text-muted-foreground">You have no requests awaiting your approval</p>
          </div>
        ) : (
          <DataTable
            data={generalApprovals}
            columns={generalColumns}
            searchable
            searchPlaceholder="Search requests..."
          />
        )
      ) : activeTab === 'payroll' ? (
        pendingApprovals.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
            <h3 className="font-medium text-card-foreground mb-2">No Pending Payroll Batches</h3>
            <p className="text-muted-foreground">All payroll batches are up to date</p>
          </div>
        ) : (
          <DataTable
            data={pendingApprovals}
            columns={payrollColumns}
            searchable
            searchPlaceholder="Search by batch number or month..."
          />
        )
      ) : (
        myActions.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Info className="w-16 h-16 text-blue-500 dark:text-blue-400 mx-auto mb-4" />
            <h3 className="font-medium text-card-foreground mb-2">No Approval History</h3>
            <p className="text-muted-foreground">Your approved/rejected actions will appear here</p>
          </div>
        ) : (
          <DataTable
            data={myActions}
            columns={historyColumns}
            searchable
            searchPlaceholder="Search by batch number or month..."
          />
        )
      )}

      {/* Payroll Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedBatch(null);
          setWorkflowStages([]);
          setComments('');
        }}
        title={`Payroll Approval - ${selectedBatch?.batch_number}`}
        size="lg"
      >
        <div className="space-y-6">
          {/* Batch Summary */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Month</p>
              <p className="font-medium text-foreground">{selectedBatch?.month}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Staff</p>
              <p className="font-medium text-foreground">{selectedBatch?.total_staff}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gross Pay</p>
              <p className="font-medium text-foreground">₦{selectedBatch?.total_gross.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Pay</p>
              <p className="font-medium text-green-600 dark:text-green-500">₦{selectedBatch?.total_net.toLocaleString()}</p>
            </div>
          </div>

          {/* Approval Timeline */}
          <div>
            <h4 className="font-medium text-foreground mb-4">Approval Stages</h4>
            <div className="space-y-3">
              {selectedBatch?.approval_stages?.map((stage: any, index: number) => {
                const isPending = stage.status === 'pending';
                const isApproved = stage.status === 'approved';
                const isRejected = stage.status === 'rejected';
                const isCurrent = isPending && index === selectedBatch.approval_stages.findIndex((s: any) => s.status === 'pending');

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isCurrent
                        ? 'border-primary bg-primary/5'
                        : isApproved
                        ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30'
                        : isRejected
                        ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                            isApproved
                              ? 'bg-green-600 dark:bg-green-700 text-white'
                              : isRejected
                              ? 'bg-red-600 dark:bg-red-700 text-white'
                              : isCurrent
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {stage.stage}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{stage.stage_name}</p>
                          <p className="text-sm text-muted-foreground capitalize">Role: {stage.approver_role.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <StatusBadge status={stage.status} />
                    </div>
                    {stage.comments && (
                      <div className="mt-2 p-2 bg-card border border-border rounded text-sm">
                        <p className="text-xs text-muted-foreground mb-1">Comments:</p>
                        <p className="text-foreground">{stage.comments}</p>
                      </div>
                    )}
                    {stage.approved_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {isApproved ? 'Approved' : 'Rejected'} on {new Date(stage.approved_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approval Actions */}
          {canApproveCurrentStage(selectedBatch) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Comments (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Add any comments or notes..."
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          {canApproveCurrentStage(selectedBatch) ? (
            <>
              <button
                onClick={handleReject}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <XCircle className="w-5 h-5" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle className="w-5 h-5" />
                Approve
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-5 h-5" />
              <span className="text-sm">
                {user?.role === 'auditor' ? 'View only - Auditor mode' : 'Waiting for approval at current stage'}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* General Approval Modal */}
      <Modal
        isOpen={showGeneralModal}
        onClose={() => {
          setShowGeneralModal(false);
          setSelectedRequest(null);
          setComments('');
        }}
        title={`Review Request`}
        size="lg"
      >
        <div className="space-y-6">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
             <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Request Type</span>
                <span className="font-medium">{selectedRequest?.workflow_name}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Requester</span>
                <span className="font-medium">{selectedRequest?.requester_name}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium">{selectedRequest?.requester_email}</span>
             </div>
             <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current Step</span>
                <span className="font-medium">{selectedRequest?.step_name}</span>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Comments (Optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Add any comments or notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            onClick={handleGeneralReject}
            disabled={processingAction === 'reject' || processingAction === 'approve'}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingAction === 'reject' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            Reject
          </button>
          <button
            onClick={handleGeneralApprove}
            disabled={processingAction === 'reject' || processingAction === 'approve'}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingAction === 'approve' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Approve
          </button>
        </div>
      </Modal>
    </div>
  );
}
