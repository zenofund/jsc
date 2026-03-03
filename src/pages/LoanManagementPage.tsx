import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Users, Clock, CheckCircle, XCircle, FileText,
  Plus, Edit2, Trash2, Download, Search, Building2,
  Wallet, RefreshCw, CreditCard, X, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { loanApplicationAPI, loanTypeAPI, disbursementAPI, loanStatsAPI, cooperativeAPI } from '../lib/loanAPI';
import type { LoanType, LoanApplication, LoanDisbursement } from '../types/entities';
import { PageSkeleton } from '../components/PageLoader';
import { showToast } from '../utils/toast';

type TabType = 'overview' | 'applications' | 'loan-types' | 'disbursements' | 'reports';

export function LoanManagementPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [disbursements, setDisbursements] = useState<LoanDisbursement[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [processingApplicationId, setProcessingApplicationId] = useState<string | null>(null);
  const [isDisbursing, setIsDisbursing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overview, apps, types, disb] = await Promise.all([
        loanStatsAPI.getOverview(),
        loanApplicationAPI.getAll(),
        loanTypeAPI.getAll(),
        disbursementAPI.getAll(),
      ]);
      setStats(overview);
      setLoanApplications(apps);
      setLoanTypes(types);
      setDisbursements(disb);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Loan & Cooperative Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage staff loans, guarantors, disbursements, and cooperative society
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-accent border border-border transition-colors w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'applications', label: 'Applications', icon: FileText },
            { id: 'loan-types', label: 'Loan Types', icon: CreditCard },
            { id: 'disbursements', label: 'Disbursements', icon: DollarSign },
            { id: 'reports', label: 'Reports', icon: Download },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab stats={stats} />}
      {activeTab === 'applications' && (
        <ApplicationsTab applications={loanApplications} onRefresh={loadData} />
      )}
      {activeTab === 'loan-types' && (
        <LoanTypesTab loanTypes={loanTypes} onRefresh={loadData} />
      )}
      {activeTab === 'disbursements' && (
        <DisbursementsTab disbursements={disbursements} />
      )}
      {activeTab === 'reports' && <ReportsTab />}
    </div>
  );
}

// Overview Tab
function OverviewTab({ stats }: { stats: any }) {
  if (!stats) return <div className="text-center py-12 text-muted-foreground">Loading statistics...</div>;

  const statCards = [
    { title: 'Total Applications', value: stats.total_applications, icon: FileText, color: 'text-blue-500' },
    { title: 'Pending Applications', value: stats.pending_applications, icon: Clock, color: 'text-yellow-500' },
    { title: 'Active Loans', value: stats.active_loans, icon: TrendingUp, color: 'text-green-500' },
    { title: 'Total Disbursed', value: `₦${stats.total_disbursed.toLocaleString()}`, icon: DollarSign, color: 'text-purple-500' },
    { title: 'Outstanding Balance', value: `₦${stats.total_outstanding.toLocaleString()}`, icon: Wallet, color: 'text-red-500' },
    { title: 'Total Repaid', value: `₦${stats.total_repaid.toLocaleString()}`, icon: CheckCircle, color: 'text-green-500' },
    { title: 'Cooperative Members', value: stats.cooperative_members, icon: Users, color: 'text-indigo-500' },
    { title: 'Total Contributions', value: `₦${stats.total_contributions.toLocaleString()}`, icon: Building2, color: 'text-teal-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <div
          key={index}
          className="p-6 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-muted">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
          </div>
          <p className="text-sm mb-1 text-muted-foreground">{stat.title}</p>
          <p className="text-2xl text-card-foreground">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

// Applications Tab
function ApplicationsTab({
  applications,
  onRefresh,
}: {
  applications: LoanApplication[];
  onRefresh: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [disbursementData, setDisbursementData] = useState({
    disbursement_method: 'bank_transfer' as const,
    bank_name: '',
    account_number: '',
    reference_number: '',
  });
  const [decisionModal, setDecisionModal] = useState<{ open: boolean; appId: string | null; action: 'approved' | 'rejected' | null }>({ open: false, appId: null, action: null });
  const [decisionReason, setDecisionReason] = useState<string>('');

  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesSearch =
      app.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.application_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleApprove = async (applicationId: string, action: 'approved' | 'rejected', comments?: string) => {
    try {
      setProcessingId(applicationId);
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      await loanApplicationAPI.processApproval(applicationId, currentUser.id, currentUser.full_name, action, comments);
      onRefresh();
      showToast.success(`Application ${action} successfully`);
    } catch (error: any) {
      showToast.error('Error', error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDisburse = async () => {
    if (!selectedApp) return;
    try {
      setIsDisbursing(true);
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      await disbursementAPI.create({
        ...disbursementData,
        loan_application_id: selectedApp.id,
        disbursed_by: currentUser.id,
      });
      onRefresh();
      showToast.success('Loan disbursed successfully');
      setShowDisbursementModal(false);
      setSelectedApp(null);
    } catch (error: any) {
      showToast.error('Error', error.message);
    } finally {
      setIsDisbursing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-500',
      pending: 'bg-yellow-500',
      guarantor_pending: 'bg-orange-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      disbursed: 'bg-blue-500',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs text-white ${colors[status]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by staff name or application number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="guarantor_pending">Guarantor Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="disbursed">Disbursed</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Application #</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Staff Details</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Loan Type</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Tenure</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No applications found
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-card-foreground">{app.application_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(app.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-card-foreground">{app.staff_name}</div>
                      <div className="text-xs text-muted-foreground">{app.staff_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-card-foreground">{app.loan_type_name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm text-card-foreground">₦{app.amount_requested.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        +₦{app.interest_amount.toLocaleString()} interest
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-card-foreground">{app.tenure_months} months</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(app.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {app.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(app.id, 'approved')}
                              disabled={processingId === app.id}
                              className="p-2 rounded hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Approve"
                            >
                              {processingId === app.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setDecisionModal({ open: true, appId: app.id, action: 'rejected' });
                                setDecisionReason('');
                              }}
                              disabled={processingId === app.id}
                              className="p-2 rounded hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reject"
                            >
                              {processingId === app.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                        {app.status === 'approved' && (
                          <button
                            onClick={() => {
                              setSelectedApp(app);
                              setShowDisbursementModal(true);
                            }}
                            className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-sm transition-colors"
                          >
                            Disburse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disbursement Modal */}
      {showDisbursementModal && selectedApp && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-lg p-6 bg-card border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3>Disburse Loan</h3>
              <button onClick={() => setShowDisbursementModal(false)} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Disbursement Method</label>
                <select
                  value={disbursementData.disbursement_method}
                  onChange={(e) =>
                    setDisbursementData({ ...disbursementData, disbursement_method: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              {disbursementData.disbursement_method === 'bank_transfer' && (
                <>
                  <div>
                    <label className="block text-sm mb-1 text-card-foreground">Bank Name</label>
                    <input
                      type="text"
                      value={disbursementData.bank_name}
                      onChange={(e) => setDisbursementData({ ...disbursementData, bank_name: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-card-foreground">Account Number</label>
                    <input
                      type="text"
                      value={disbursementData.account_number}
                      onChange={(e) => setDisbursementData({ ...disbursementData, account_number: e.target.value })}
                      className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Reference Number</label>
                <input
                  type="text"
                  value={disbursementData.reference_number}
                  onChange={(e) => setDisbursementData({ ...disbursementData, reference_number: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleDisburse}
                  disabled={isDisbursing}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {isDisbursing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Disburse
                </button>
                <button
                  onClick={() => setShowDisbursementModal(false)}
                  disabled={isDisbursing}
                  className="flex-1 py-2 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decision Reason Modal */}
      {decisionModal.open && decisionModal.action === 'rejected' && decisionModal.appId && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-lg p-6 bg-card border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3>Rejection Reason</h3>
              <button onClick={() => setDecisionModal({ open: false, appId: null, action: null })} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Please provide a reason</label>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter a brief reason for rejection"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDecisionModal({ open: false, appId: null, action: null })}
                  className="px-4 py-2 text-foreground hover:bg-accent rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!decisionReason.trim()) {
                      showToast.warning('Rejection reason is required');
                      return;
                    }
                    const targetId = decisionModal.appId!;
                    setDecisionModal({ open: false, appId: null, action: null });
                    await handleApprove(targetId, 'rejected', decisionReason.trim());
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Loan Types Tab with full CRUD
function LoanTypesTab({
  loanTypes,
  onRefresh,
}: {
  loanTypes: LoanType[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<LoanType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cooperatives, setCooperatives] = useState<any[]>([]);

  useEffect(() => {
    loadCooperatives();
  }, []);

  const loadCooperatives = async () => {
    try {
      const coops = await cooperativeAPI.getAll();
      setCooperatives(coops.filter((c: any) => c.status === 'active'));
    } catch (error) {
      console.error('Error loading cooperatives:', error);
    }
  };
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    interest_rate: 0,
    max_amount: 0,
    max_tenure_months: 12,
    min_service_years: 1,
    max_salary_percentage: 40,
    requires_guarantors: false,
    min_guarantors: 0,
    eligibility_criteria: '',
    status: 'active' as 'active' | 'inactive',
    cooperative_id: '' as string | undefined,
  });

  const handleCreate = () => {
    setEditingType(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      interest_rate: 0,
      max_amount: 0,
      max_tenure_months: 12,
      min_service_years: 1,
      max_salary_percentage: 40,
      requires_guarantors: false,
      min_guarantors: 0,
      eligibility_criteria: '',
      status: 'active',
      cooperative_id: '',
    });
    setShowModal(true);
  };

  const handleEdit = (loanType: LoanType) => {
    setEditingType(loanType);
    setFormData({
      name: loanType.name,
      code: loanType.code,
      description: loanType.description || '',
      interest_rate: loanType.interest_rate,
      max_amount: loanType.max_amount || 0,
      max_tenure_months: loanType.max_tenure_months,
      min_service_years: loanType.min_service_years || 1,
      max_salary_percentage: loanType.max_salary_percentage,
      cooperative_id: loanType.cooperative_id || '',
      requires_guarantors: loanType.requires_guarantors,
      min_guarantors: loanType.min_guarantors,
      eligibility_criteria: loanType.eligibility_criteria || '',
      status: loanType.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Map snake_case formData to camelCase DTO expected by backend
      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description,
        interestRate: formData.interest_rate,
        maxAmount: formData.max_amount,
        maxTenureMonths: formData.max_tenure_months,
        minServiceYears: formData.min_service_years,
        maxSalaryPercentage: formData.max_salary_percentage,
        requiresGuarantors: formData.requires_guarantors,
        minGuarantors: formData.min_guarantors,
        eligibilityCriteria: formData.eligibility_criteria,
        status: formData.status,
        cooperativeId: formData.cooperative_id,
      };

      if (editingType) {
        // We now allow updating all fields as requested by admin
        // Removed the filtering of restricted fields
        await loanTypeAPI.update(editingType.id, payload as any);
        showToast.success('Loan type updated successfully');
      } else {
        await loanTypeAPI.create(payload as any);
        showToast.success('Loan type created successfully');
      }
      setShowModal(false);
      onRefresh();
    } catch (error: any) {
      showToast.error('Error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Are you sure you want to delete this loan type?');
    if (!confirmed) return;
    try {
      setDeletingId(id);
      await loanTypeAPI.delete(id);
      showToast.success('Loan type deleted successfully');
      onRefresh();
    } catch (error: any) {
      showToast.error('Error', error.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2>Loan Types Configuration</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Loan Type
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loanTypes.map((loanType) => (
          <div
            key={loanType.id}
            className="p-6 rounded-lg border border-border bg-card"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="mb-1">{loanType.name}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    loanType.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
                  } text-white`}
                >
                  {loanType.status.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEdit(loanType)} 
                  disabled={deletingId === loanType.id}
                  className="p-2 hover:bg-accent rounded transition-colors disabled:opacity-50"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(loanType.id)} 
                  disabled={deletingId === loanType.id}
                  className="p-2 hover:bg-destructive hover:text-destructive-foreground rounded transition-colors disabled:opacity-50"
                >
                  {deletingId === loanType.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-sm mb-4 text-muted-foreground">{loanType.description}</p>
            {loanType.cooperative_id && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary">
                  {cooperatives.find(c => c.id === loanType.cooperative_id)?.name || 'Cooperative Loan'}
                </span>
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest Rate:</span>
                <span className="text-card-foreground">{loanType.interest_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Amount:</span>
                <span className="text-card-foreground">₦{loanType.max_amount?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Tenure:</span>
                <span className="text-card-foreground">{loanType.max_tenure_months} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guarantors:</span>
                <span className="text-card-foreground">{loanType.requires_guarantors ? `${loanType.min_guarantors} required` : 'Not required'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full rounded-lg p-6 max-h-[90vh] overflow-y-auto bg-card border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3>{editingType ? 'Edit Loan Type' : 'Create Loan Type'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Description *</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Interest Rate (%) *</label>
                  <input
                    type="number"
                    required
                    value={formData.interest_rate}
                    onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Max Amount (₦)</label>
                  <input
                    type="number"
                    value={formData.max_amount}
                    onChange={(e) => setFormData({ ...formData, max_amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Max Tenure (months) *</label>
                  <input
                    type="number"
                    required
                    value={formData.max_tenure_months}
                    onChange={(e) => setFormData({ ...formData, max_tenure_months: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Min Service Years</label>
                  <input
                    type="number"
                    value={formData.min_service_years}
                    onChange={(e) => setFormData({ ...formData, min_service_years: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Max Salary % *</label>
                  <input
                    type="number"
                    required
                    value={formData.max_salary_percentage}
                    onChange={(e) => setFormData({ ...formData, max_salary_percentage: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Linked Cooperative (Optional)</label>
                <select
                  value={formData.cooperative_id || ''}
                  onChange={(e) => setFormData({ ...formData, cooperative_id: e.target.value || undefined })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">None - General Loan</option>
                  {cooperatives.map((coop) => (
                    <option key={coop.id} value={coop.id}>
                      {coop.name} ({coop.code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Link this loan type to a specific cooperative. Only cooperative members can apply.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requires_guarantors}
                  onChange={(e) => setFormData({ ...formData, requires_guarantors: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm text-card-foreground">Requires Guarantors</label>
              </div>
              {formData.requires_guarantors && (
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Minimum Guarantors *</label>
                  <input
                    type="number"
                    required
                    value={formData.min_guarantors}
                    onChange={(e) => setFormData({ ...formData, min_guarantors: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Eligibility Criteria *</label>
                <textarea
                  required
                  value={formData.eligibility_criteria}
                  onChange={(e) => setFormData({ ...formData, eligibility_criteria: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingType ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Disbursements Tab
function DisbursementsTab({ disbursements }: { disbursements: LoanDisbursement[] }) {
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statement, setStatement] = useState<any>(null);

  const viewStatement = async (disbId: string) => {
    try {
      const stmt = await disbursementAPI.getStatement(disbId);
      setStatement(stmt);
      setShowStatementModal(true);
    } catch (error) {
      console.error('Error loading statement:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Disbursement #</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Staff</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Loan Type</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Outstanding</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {disbursements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No disbursements found
                  </td>
                </tr>
              ) : (
                disbursements.map((disb) => (
                  <tr key={disb.id} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-card-foreground">{disb.disbursement_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(disb.disbursement_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-card-foreground">{disb.staff_name}</div>
                      <div className="text-xs text-muted-foreground">{disb.staff_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-card-foreground">{disb.loan_type_name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm text-card-foreground">₦{disb.total_amount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">
                        ₦{disb.monthly_deduction.toLocaleString()}/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-card-foreground">₦{disb.balance_outstanding.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs text-white ${
                          disb.status === 'active' ? 'bg-green-500' : disb.status === 'completed' ? 'bg-gray-500' : 'bg-red-500'
                        }`}
                      >
                        {disb.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => viewStatement(disb.id)}
                        className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-sm transition-colors"
                      >
                        Statement
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statement Modal */}
      {showStatementModal && statement && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full rounded-lg p-6 max-h-[80vh] overflow-y-auto bg-card border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3>Loan Statement</h3>
              <button onClick={() => setShowStatementModal(false)} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded">
                <div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="text-lg text-card-foreground">₦{statement.summary.total_amount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Outstanding</div>
                  <div className="text-lg text-card-foreground">₦{statement.summary.balance_outstanding.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Repaid</div>
                  <div className="text-lg text-card-foreground">₦{statement.summary.total_repaid.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Months Remaining</div>
                  <div className="text-lg text-card-foreground">{statement.summary.months_remaining}</div>
                </div>
              </div>
              <div>
                <h4 className="mb-2">Repayment History</h4>
                <div className="space-y-2">
                  {statement.repayments.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">No repayments yet</div>
                  ) : (
                    statement.repayments.map((rep: any) => (
                      <div key={rep.id} className="flex justify-between p-3 bg-muted rounded">
                        <div>
                          <div className="text-card-foreground">{rep.repayment_month}</div>
                          <div className="text-sm text-muted-foreground">{rep.payment_method}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-card-foreground">₦{rep.amount_paid.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">Balance: ₦{rep.balance_after_payment.toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reports Tab
function ReportsTab() {
  const reports = [
    { name: 'Loan Applications Report', description: 'All loan applications with status' },
    { name: 'Disbursement Report', description: 'All loan disbursements by period' },
    { name: 'Repayment Schedule', description: 'Upcoming and overdue repayments' },
    { name: 'Cooperative Statement', description: 'Member contributions and dividends' },
    { name: 'Loan Aging Report', description: 'Outstanding loans by age' },
    { name: 'Defaulters Report', description: 'Staff with overdue repayments' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {reports.map((report, index) => (
        <div
          key={index}
          className="p-6 rounded-lg border border-border bg-card"
        >
          <FileText className="w-8 h-8 text-primary mb-4" />
          <h3 className="mb-2">{report.name}</h3>
          <p className="text-sm mb-4 text-muted-foreground">{report.description}</p>
          <button className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
            <Download className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      ))}
    </div>
  );
}
