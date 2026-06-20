import { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, Users, Clock, CheckCircle, XCircle, FileText,
  Plus, Edit2, Trash2, Download, Search, Building2,
  Wallet, RefreshCw, CreditCard, X, Loader2, MoreVertical
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { loanApplicationAPI, loanTypeAPI, disbursementAPI, loanStatsAPI, cooperativeAPI, repaymentAPI } from '../lib/loanAPI';
import { staffAPI } from '../lib/api-client';
import type { LoanType, LoanApplication, LoanDisbursement, Cooperative, Staff } from '../types/entities';
import { PageSkeleton } from '../components/PageLoader';
import { showToast } from '../utils/toast';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { Modal } from '../components/Modal';
import { NumberInput } from '../components/NumberInput';
import { formatStaffName } from '../lib/name-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

type TabType = 'overview' | 'applications' | 'loan-types' | 'disbursements' | 'reports';

type ApplicationEditForm = {
  principalAmount: number;
  tenureMonths: number;
  purpose: string;
};

type DisbursementEditForm = {
  principalAmount: number;
  tenureMonths: number;
  startMonth: string;
  status: LoanDisbursement['status'];
  remarks: string;
};

type LoanEditPreview = {
  interestAmount: number;
  totalRepayment: number;
  amountDisbursed: number;
  monthlyDeduction: number;
  balanceOutstanding: number;
  endMonth: string;
};

function addMonthsToYearMonth(startMonth: string, monthsToAdd: number) {
  if (!/^\d{4}-\d{2}$/.test(startMonth)) return '';
  const [year, month] = startMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calculateLoanEditPreview(
  loanType: LoanType | null | undefined,
  principalAmount: number,
  tenureMonths: number,
  totalRepaid = 0,
  startMonth = '',
): LoanEditPreview {
  const principal = Number(principalAmount || 0);
  const tenure = Number(tenureMonths || 0);
  const rate = Number(loanType?.interest_rate || 0);
  const interestAmount = (principal * rate) / 100;
  const isUpfront = loanType?.interest_calculation_method === 'upfront';
  const totalRepayment = isUpfront ? principal : principal + interestAmount;
  const amountDisbursed = Math.max(isUpfront ? principal - interestAmount : principal, 0);
  const monthlyDeduction = tenure > 0 ? Math.round(totalRepayment / tenure) : 0;
  const balanceOutstanding = Math.max(totalRepayment - Number(totalRepaid || 0), 0);

  return {
    interestAmount,
    totalRepayment,
    amountDisbursed,
    monthlyDeduction,
    balanceOutstanding,
    endMonth: startMonth && tenure > 0 ? addMonthsToYearMonth(startMonth, tenure - 1) : '',
  };
}

export function LoanManagementPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [disbursements, setDisbursements] = useState<LoanDisbursement[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<Staff[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [processingApplicationId, setProcessingApplicationId] = useState<string | null>(null);
  const [isDisbursing, setIsDisbursing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [overview, apps, types, disb, staffData] = await Promise.all([
        loanStatsAPI.getOverview(),
        loanApplicationAPI.getAll(),
        loanTypeAPI.getAll(),
        disbursementAPI.getAll(),
        staffAPI.getAllStaff({ fetchAll: true, limit: 1000 }),
      ]);
      setStats(overview);
      setLoanApplications(apps);
      setLoanTypes(types);
      setDisbursements(disb);
      setStaffDirectory(Array.isArray(staffData) ? staffData : staffData.data || []);
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
        <ApplicationsTab
          applications={loanApplications}
          disbursements={disbursements}
          loanTypes={loanTypes}
          staffDirectory={staffDirectory}
          onRefresh={loadData}
        />
      )}
      {activeTab === 'loan-types' && (
        <LoanTypesTab loanTypes={loanTypes} onRefresh={loadData} />
      )}
      {activeTab === 'disbursements' && (
        <DisbursementsTab
          disbursements={disbursements}
          loanTypes={loanTypes}
          staffDirectory={staffDirectory}
          onRefresh={loadData}
        />
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
    { title: 'Total Disbursed', value: formatCompactCurrency(stats.total_disbursed), icon: DollarSign, color: 'text-purple-500', isCurrency: true },
    { title: 'Outstanding Balance', value: formatCompactCurrency(stats.total_outstanding), icon: Wallet, color: 'text-red-500', isCurrency: true },
    { title: 'Total Repaid', value: formatCompactCurrency(stats.total_repaid), icon: CheckCircle, color: 'text-green-500', isCurrency: true },
    { title: 'Cooperative Members', value: stats.cooperative_members, icon: Users, color: 'text-indigo-500' },
    { title: 'Total Contributions', value: formatCompactCurrency(stats.total_contributions), icon: Building2, color: 'text-teal-500', isCurrency: true },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <div
          key={index}
          className="p-6 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">{stat.title}</h3>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <div className="flex flex-col">
            <p className="text-2xl font-bold text-foreground">
              {(stat as any).isCurrency ? stat.value.short : stat.value}
            </p>
            {(stat as any).isCurrency && (stat.value.full !== stat.value.short) && (
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {stat.value.full}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Applications Tab
function ApplicationsTab({
  applications,
  disbursements,
  loanTypes,
  staffDirectory,
  onRefresh,
}: {
  applications: LoanApplication[];
  disbursements: LoanDisbursement[];
  loanTypes: LoanType[];
  staffDirectory: Staff[];
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [showDisbursementModal, setShowDisbursementModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [disbursementData, setDisbursementData] = useState({
    disbursement_method: 'bank_transfer' as const,
    bank_name: '',
    account_number: '',
    reference_number: '',
    amount: 0,
  });
  const [approvalModal, setApprovalModal] = useState<{ open: boolean; app: LoanApplication | null; action: 'approved' | 'rejected' | null }>({ open: false, app: null, action: null });
  const [approvalComment, setApprovalComment] = useState('');
  const [applicationEditModal, setApplicationEditModal] = useState<{ open: boolean; app: LoanApplication | null }>({
    open: false,
    app: null,
  });
  const [applicationEditData, setApplicationEditData] = useState<ApplicationEditForm | null>(null);
  const [isUpdatingApplication, setIsUpdatingApplication] = useState(false);

  // Assign Loan State
  const [assignLoanData, setAssignLoanData] = useState({
    staffId: '',
    loanTypeId: '',
    requestedAmount: 0,
    tenureMonths: 1,
    purpose: '',
    autoApproveDisburse: false,
  });
  const [assigningLoan, setAssigningLoan] = useState(false);
  const [loanTypesList, setLoanTypesList] = useState<LoanType[]>([]);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  useEffect(() => {
    if (selectedApp) {
      setDisbursementData((prev) => ({
        ...prev,
        amount: selectedApp.amount_approved || selectedApp.amount_requested,
        bank_name: selectedApp.staff_bank_name || '',
        account_number: selectedApp.staff_account_number || '',
      }));
    }
  }, [selectedApp]);

  useEffect(() => {
    if (showAssignModal) {
      const fetchFormData = async () => {
        try {
            const typesData = await loanTypeAPI.getAll();
            setLoanTypesList(typesData.filter((t: LoanType) => t.status === 'active'));
          } catch (error) {
          console.error('Failed to load assign form data', error);
        }
      };
      fetchFormData();
    }
  }, [showAssignModal]);

  const getLoanStaffFullName = (staffId: string, staffNumber: string, fallbackName: string) => {
    const staffMember = staffDirectory.find(
      (staff) => String(staff.id) === String(staffId) || String(staff.staff_number) === String(staffNumber),
    );
    return staffMember ? formatStaffName(staffMember) : fallbackName;
  };

  const getStaffDisplayLabel = (staff: Staff) => {
    return `${formatStaffName(staff)} (${staff.staff_number || 'N/A'})`;
  };

  const filteredStaffList = useMemo(() => {
    const q = staffSearchTerm.trim().toLowerCase();
    if (!q) return staffDirectory;

    return staffDirectory.filter((staff) => {
      const staffNo = (staff.staff_number || '').toLowerCase();
      const fullName = formatStaffName(staff).toLowerCase();
      const label = getStaffDisplayLabel(staff).toLowerCase();
      return staffNo.includes(q) || fullName.includes(q) || label.includes(q);
    });
  }, [staffDirectory, staffSearchTerm]);

  const canEditDisbursedApplications = user?.role === 'admin' || user?.role === 'payroll_officer';
  const getApplicationLoanType = (application: LoanApplication) =>
    loanTypes.find((loanType) => loanType.id === application.loan_type_id || loanType.name === application.loan_type_name) || null;
  const getApplicationDisbursement = (applicationId: string) =>
    disbursements.find((disbursement) => disbursement.loan_application_id === applicationId) || null;

  const applicationEditLoanType = useMemo(
    () => (applicationEditModal.app ? getApplicationLoanType(applicationEditModal.app) : null),
    [applicationEditModal.app, loanTypes],
  );
  const applicationEditPreview = useMemo(() => {
    if (!applicationEditData || !applicationEditModal.app) return null;
    const linkedDisbursement = getApplicationDisbursement(applicationEditModal.app.id);
    return calculateLoanEditPreview(
      applicationEditLoanType,
      applicationEditData.principalAmount,
      applicationEditData.tenureMonths,
      Number(linkedDisbursement?.total_repaid || 0),
      linkedDisbursement?.start_deduction_month || '',
    );
  }, [applicationEditData, applicationEditLoanType, applicationEditModal.app, disbursements]);

  const filteredApplications = applications.filter((app) => {
      const fullName = getLoanStaffFullName(app.staff_id, app.staff_number, app.staff_name).toLowerCase();
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
      const matchesSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        app.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.application_number.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });

    const openApplicationEditModal = (app: LoanApplication) => {
      setApplicationEditModal({ open: true, app });
      setApplicationEditData({
        principalAmount: Number(app.amount_approved ?? app.amount_requested ?? 0),
        tenureMonths: Number(app.tenure_months ?? 1),
        purpose: app.purpose || '',
      });
    };

    const closeApplicationEditModal = () => {
      if (isUpdatingApplication) return;
      setApplicationEditModal({ open: false, app: null });
      setApplicationEditData(null);
    };

    const handleAssignLoan = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!assignLoanData.staffId || !assignLoanData.loanTypeId || assignLoanData.requestedAmount <= 0 || assignLoanData.tenureMonths <= 0 || !assignLoanData.purpose) {
        showToast.error('Error', 'Please fill in all required fields correctly');
        return;
      }

      try {
        setAssigningLoan(true);
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const selectedLoanType = loanTypesList.find((type) => type.id === assignLoanData.loanTypeId);

        if (selectedLoanType) {
          if (selectedLoanType.max_amount !== undefined && assignLoanData.requestedAmount > selectedLoanType.max_amount) {
            showToast.error('Invalid Amount', `Maximum loan amount is ${formatCurrency(selectedLoanType.max_amount)}`);
            return;
          }
          if (selectedLoanType.max_tenure_months !== undefined && assignLoanData.tenureMonths > selectedLoanType.max_tenure_months) {
            showToast.error('Invalid Tenure', `Maximum tenure is ${selectedLoanType.max_tenure_months} months`);
            return;
          }
        }
        
        // 1. Create Application
        const createPayload = {
          staffId: assignLoanData.staffId,
          loanTypeId: assignLoanData.loanTypeId,
          requestedAmount: assignLoanData.requestedAmount,
          tenureMonths: assignLoanData.tenureMonths,
          purpose: assignLoanData.purpose,
          guarantors: [] // Admin assigning usually overrides guarantor requirement or handles offline
        };
        
        const newApp = await loanApplicationAPI.create(createPayload);
        
        // 2. Auto Approve & Disburse if checked
        if (assignLoanData.autoApproveDisburse && newApp && newApp.id) {
          // Approve
          await loanApplicationAPI.processApproval(
            newApp.id, 
            currentUser.id, 
            currentUser.full_name, 
            'approved', 
            'Admin Auto-Approved during assignment', 
            assignLoanData.requestedAmount
          );
          
          // Fetch staff bank details for disbursement
          const staff = staffDirectory.find(s => s.id === assignLoanData.staffId);
          
          // Disburse
          await disbursementAPI.create({
            loan_application_id: newApp.id,
            disbursement_method: 'bank_transfer',
            bank_name: staff?.salary_info?.bank_name || 'N/A',
            account_number: staff?.salary_info?.account_number || 'N/A',
            reference_number: `AUTO-${Date.now()}`,
            disbursed_by: currentUser.id,
            amount: assignLoanData.requestedAmount,
          });
          
          showToast.success('Loan assigned, approved, and disbursed successfully');
        } else {
          showToast.success('Loan assigned successfully', 'It is ready for admin approval');
        }
        
        setShowAssignModal(false);
        setStaffSearchTerm('');
        setAssignLoanData({
          staffId: '',
          loanTypeId: '',
          requestedAmount: 0,
          tenureMonths: 1,
          purpose: '',
          autoApproveDisburse: false,
        });
        onRefresh();
        
      } catch (error: any) {
        showToast.error('Error Assigning Loan', error.message);
      } finally {
        setAssigningLoan(false);
      }
    };

    const handleApprove = async (applicationId: string, action: 'approved' | 'rejected', comments?: string) => {
    try {
      setProcessingId(applicationId);
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Get the application to check amount if approving
      const app = applications.find(a => a.id === applicationId);
      const approvedAmount = app ? app.amount_requested : undefined;

      await loanApplicationAPI.processApproval(applicationId, currentUser.id, currentUser.full_name, action, comments, approvedAmount);
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
      
      // Ensure we only pass the necessary fields
      await disbursementAPI.create({
        loan_application_id: selectedApp.id,
        disbursement_method: disbursementData.disbursement_method as any,
        bank_name: disbursementData.bank_name,
        account_number: disbursementData.account_number,
        reference_number: disbursementData.reference_number,
        disbursed_by: currentUser.id,
        // Add amount if available
        amount: selectedApp.amount_approved || selectedApp.amount_requested,
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

  const handleApplicationEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!applicationEditModal.app || !applicationEditData || !applicationEditLoanType || !applicationEditPreview) {
      return;
    }

    if (applicationEditData.principalAmount <= 0) {
      showToast.error('Loan amount must be greater than 0.');
      return;
    }

    if (applicationEditData.tenureMonths < 1) {
      showToast.error('Tenure must be at least 1 month.');
      return;
    }

    if (
      applicationEditLoanType.max_amount !== undefined &&
      applicationEditData.principalAmount > Number(applicationEditLoanType.max_amount)
    ) {
      showToast.error(
        'Invalid Amount',
        `Maximum loan amount is ${formatCurrency(applicationEditLoanType.max_amount)}`,
      );
      return;
    }

    if (
      applicationEditLoanType.max_tenure_months !== undefined &&
      applicationEditData.tenureMonths > Number(applicationEditLoanType.max_tenure_months)
    ) {
      showToast.error(
        'Invalid Tenure',
        `Maximum tenure is ${applicationEditLoanType.max_tenure_months} months`,
      );
      return;
    }

    try {
      setIsUpdatingApplication(true);
      await loanApplicationAPI.update(applicationEditModal.app.id, {
        approvedAmount: applicationEditData.principalAmount,
        requestedAmount: applicationEditData.principalAmount,
        tenureMonths: applicationEditData.tenureMonths,
        purpose: applicationEditData.purpose,
      });
      showToast.success('Disbursed loan updated successfully.');
      closeApplicationEditModal();
      await onRefresh();
    } catch (error: any) {
      showToast.error(error?.message || 'Failed to update disbursed loan');
    } finally {
      setIsUpdatingApplication(false);
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
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="guarantor_pending">Guarantor Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="disbursed">Disbursed</option>
        </select>
        <button
          onClick={() => setShowAssignModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Assign Loan
        </button>
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
                      <div className="text-sm text-card-foreground">
                        {getLoanStaffFullName(app.staff_id, app.staff_number, app.staff_name)}
                      </div>
                      <div className="text-xs text-muted-foreground">{app.staff_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-card-foreground">{app.loan_type_name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm text-card-foreground">{formatCurrency(app.amount_requested)}</div>
                      <div className="text-xs text-muted-foreground">
                        +{formatCurrency(app.interest_amount)} interest
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-card-foreground">{app.tenure_months} months</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(app.status)}</td>
                    <td className="px-6 py-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={processingId === app.id}
                            className="inline-flex items-center justify-center rounded p-2 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Actions"
                          >
                            {processingId === app.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            ) : (
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {['draft', 'pending', 'guarantor_pending'].includes(app.status) && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setApprovalModal({ open: true, app, action: 'approved' });
                                  setApprovalComment('');
                                }}
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setApprovalModal({ open: true, app, action: 'rejected' });
                                  setApprovalComment('');
                                }}
                              >
                                <XCircle className="w-4 h-4 text-red-600" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {app.status === 'approved' && (
                            <>
                              {['draft', 'pending', 'guarantor_pending'].includes(app.status) && (
                                <DropdownMenuSeparator />
                              )}
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedApp(app);
                                  setShowDisbursementModal(true);
                                }}
                              >
                                <Wallet className="w-4 h-4 text-primary" />
                                Disburse
                              </DropdownMenuItem>
                            </>
                          )}
                          {app.status === 'disbursed' && canEditDisbursedApplications && (
                            <>
                              {['draft', 'pending', 'guarantor_pending', 'approved'].includes(app.status) && (
                                <DropdownMenuSeparator />
                              )}
                              <DropdownMenuItem onClick={() => openApplicationEditModal(app)}>
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {applicationEditModal.open && applicationEditModal.app && applicationEditData && applicationEditPreview && (
        <Modal
          isOpen={applicationEditModal.open}
          onClose={closeApplicationEditModal}
          title="Edit Disbursed Loan"
          size="lg"
        >
          <form onSubmit={handleApplicationEditSubmit} className="space-y-5">
            <div className="rounded-lg bg-muted p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Application #</div>
                <div className="text-sm text-card-foreground">{applicationEditModal.app.application_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Staff</div>
                <div className="text-sm text-card-foreground">
                  {getLoanStaffFullName(
                    applicationEditModal.app.staff_id,
                    applicationEditModal.app.staff_number,
                    applicationEditModal.app.staff_name,
                  )}{' '}
                  ({applicationEditModal.app.staff_number})
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Loan Type</div>
                <div className="text-sm text-card-foreground">{applicationEditModal.app.loan_type_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Interest Mode</div>
                <div className="text-sm text-card-foreground capitalize">
                  {applicationEditLoanType?.interest_calculation_method || 'amortized'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Loan Amount</label>
                <NumberInput
                  min={1}
                  value={applicationEditData.principalAmount}
                  onChange={(value) => setApplicationEditData({ ...applicationEditData, principalAmount: value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Tenure (Months)</label>
                <input
                  type="number"
                  min="1"
                  value={applicationEditData.tenureMonths || ''}
                  onChange={(e) =>
                    setApplicationEditData({
                      ...applicationEditData,
                      tenureMonths: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-card-foreground">Purpose</label>
              <textarea
                value={applicationEditData.purpose}
                onChange={(e) => setApplicationEditData({ ...applicationEditData, purpose: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <h4 className="text-sm font-medium text-card-foreground">Automatic Readjustment Preview</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Interest</span>
                  <span className="text-card-foreground">{formatCurrency(applicationEditPreview.interestAmount)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Amount to Receive</span>
                  <span className="text-card-foreground">{formatCurrency(applicationEditPreview.amountDisbursed)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Total Repayment</span>
                  <span className="text-card-foreground">{formatCurrency(applicationEditPreview.totalRepayment)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Monthly Deduction</span>
                  <span className="text-card-foreground">{formatCurrency(applicationEditPreview.monthlyDeduction)}/mo</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Outstanding Balance</span>
                  <span className="text-card-foreground">{formatCurrency(applicationEditPreview.balanceOutstanding)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Projected End Month</span>
                  <span className="text-card-foreground">{applicationEditPreview.endMonth || 'Pending start month'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeApplicationEditModal}
                disabled={isUpdatingApplication}
                className="px-4 py-2 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingApplication || !applicationEditLoanType}
                className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground transition-colors inline-flex items-center gap-2"
              >
                {isUpdatingApplication && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Approval Modal */}
      {approvalModal.open && approvalModal.app && approvalModal.action && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-lg p-6 bg-card border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3>{approvalModal.action === 'approved' ? 'Approve Loan' : 'Reject Loan'}</h3>
              <button onClick={() => setApprovalModal({ open: false, app: null, action: null })} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Comment (Optional)</label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Add a comment for this decision"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setApprovalModal({ open: false, app: null, action: null })}
                  className="px-4 py-2 text-foreground hover:bg-accent rounded"
                >
                  Cancel
                </button>
                <button
                    onClick={async () => {
                      const targetId = approvalModal.app?.id;
                      const action = approvalModal.action;
                      if (!targetId || !action) return;
                      setApprovalModal({ open: false, app: null, action: null });
                      await handleApprove(targetId, action, approvalComment.trim());
                    }}
                    className={`px-4 py-2 text-white rounded ${
                      approvalModal.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {approvalModal.action === 'approved' ? 'Approve' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Assign Loan Modal */}
      <Modal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setStaffSearchTerm('');
          }}
          title="Assign Loan to Staff"
          size="md"
        >
          <form onSubmit={handleAssignLoan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Select Staff *</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={staffSearchTerm}
                  onChange={(e) => setStaffSearchTerm(e.target.value)}
                  placeholder="Search by name or staff ID..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                value={assignLoanData.staffId}
                onChange={(e) => setAssignLoanData({ ...assignLoanData, staffId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">-- Select Staff --</option>
                {filteredStaffList.length === 0 ? (
                  <option value="" disabled>
                    No staff match "{staffSearchTerm.trim()}"
                  </option>
                ) : (
                  filteredStaffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {getStaffDisplayLabel(staff)}
                    </option>
                  ))
                )}
              </select>
            </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Loan Type *</label>
            <select
              value={assignLoanData.loanTypeId}
              onChange={(e) => setAssignLoanData({ ...assignLoanData, loanTypeId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              <option value="">-- Select Loan Type --</option>
              {loanTypesList.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.cooperative_id ? 'Cooperative' : 'Standalone'}) - Max: {formatCurrency(type.max_amount)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Amount (₦) *</label>
              <NumberInput
                min={1}
                value={assignLoanData.requestedAmount}
                onChange={(value) => setAssignLoanData({ ...assignLoanData, requestedAmount: value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Tenure (Months) *</label>
              <input
                type="number"
                min="1"
                value={assignLoanData.tenureMonths || ''}
                onChange={(e) => setAssignLoanData({ ...assignLoanData, tenureMonths: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </div>

          {/* Disbursement Preview */}
          {(() => {
            const selectedLoanType = loanTypesList.find(t => t.id === assignLoanData.loanTypeId);
            if (selectedLoanType && assignLoanData.requestedAmount > 0) {
              const interestAmount = (assignLoanData.requestedAmount * selectedLoanType.interest_rate) / 100;
              const disbursedAmount = selectedLoanType.interest_calculation_method === 'upfront'
                ? assignLoanData.requestedAmount - interestAmount
                : assignLoanData.requestedAmount;

              return (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <h4 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Borrower Disbursement Preview
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Requested Amount:</span>
                      <span className="text-card-foreground font-medium">{formatCurrency(assignLoanData.requestedAmount)}</span>
                    </div>
                    {selectedLoanType.interest_calculation_method === 'upfront' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Interest Deduction ({selectedLoanType.interest_rate}%):</span>
                          <span className="text-destructive font-medium">-{formatCurrency(interestAmount)}</span>
                        </div>
                        <div className="border-t border-border pt-2 mt-2 flex justify-between">
                          <span className="text-primary font-medium">Amount to Receive:</span>
                          <span className="text-primary font-bold">{formatCurrency(disbursedAmount)}</span>
                        </div>
                      </>
                    )}
                    {selectedLoanType.interest_calculation_method === 'amortized' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Full Amount to Receive:</span>
                        <span className="text-primary font-bold">{formatCurrency(disbursedAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Purpose</label>
            <textarea
              value={assignLoanData.purpose}
              onChange={(e) => setAssignLoanData({ ...assignLoanData, purpose: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Enter loan purpose (optional)"
            />
          </div>

          <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg border border-border mt-4">
            <input
              type="checkbox"
              id="autoApproveDisburse"
              checked={assignLoanData.autoApproveDisburse}
              onChange={(e) => setAssignLoanData({ ...assignLoanData, autoApproveDisburse: e.target.checked })}
              className="w-4 h-4 text-primary focus:ring-primary border-border rounded"
            />
            <label htmlFor="autoApproveDisburse" className="text-sm font-medium text-foreground cursor-pointer">
              Auto-Approve & Disburse Immediately
            </label>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            If checked, this loan will instantly bypass the pending state, become approved, and be marked as disbursed using the staff's default salary bank account.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button
              type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setStaffSearchTerm('');
                }}
              className="px-4 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
              disabled={assigningLoan}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assigningLoan}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {assigningLoan ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {assignLoanData.autoApproveDisburse ? 'Assign & Disburse' : 'Assign Loan'}
            </button>
          </div>
        </form>
      </Modal>
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
    interest_calculation_method: 'amortized' as 'amortized' | 'upfront',
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
      interest_calculation_method: 'amortized',
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
      interest_calculation_method: loanType.interest_calculation_method || 'amortized',
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
        interestCalculationMethod: formData.interest_calculation_method,
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
                <span className="text-muted-foreground">Calculation Method:</span>
                <span className="text-card-foreground capitalize">{loanType.interest_calculation_method || 'amortized'}</span>
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
                  <label className="block text-sm mb-1 text-card-foreground">Interest Calculation Method *</label>
                  <select
                    value={formData.interest_calculation_method}
                    onChange={(e) => setFormData({ ...formData, interest_calculation_method: e.target.value as any })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="amortized">Amortized (Monthly Interest + Principal)</option>
                    <option value="upfront">Upfront (Interest Deducted at Source)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Max Amount (₦)</label>
                  <NumberInput
                    value={formData.max_amount}
                    onChange={(value) => setFormData({ ...formData, max_amount: value })}
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
function DisbursementsTab({
  disbursements,
  loanTypes,
  staffDirectory,
  onRefresh,
}: {
  disbursements: LoanDisbursement[];
  loanTypes: LoanType[];
  staffDirectory: Staff[];
  onRefresh: () => Promise<void>;
}) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statement, setStatement] = useState<any>(null);
  const [payoffModal, setPayoffModal] = useState<{ open: boolean; disbursement: LoanDisbursement | null }>({
    open: false,
    disbursement: null,
  });
  const [payoffAmount, setPayoffAmount] = useState<number | ''>('');
  const [isPayingOff, setIsPayingOff] = useState(false);

  const [editModal, setEditModal] = useState<{ open: boolean; disbursement: LoanDisbursement | null }>({
    open: false,
    disbursement: null,
  });
  const [editData, setEditData] = useState<DisbursementEditForm | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const canEditDisbursements = user?.role === 'admin' || user?.role === 'payroll_officer';
  const getDisbursementLoanType = (disbursement: LoanDisbursement) =>
    loanTypes.find(
      (loanType) =>
        loanType.id === disbursement.loan_type_id || loanType.name === disbursement.loan_type_name,
    ) || null;
  const getLoanStaffFullName = (staffId: string, staffNumber: string, fallbackName: string) => {
    const staffMember = staffDirectory.find(
      (staff) => String(staff.id) === String(staffId) || String(staff.staff_number) === String(staffNumber),
    );
    return staffMember ? formatStaffName(staffMember) : fallbackName;
  };
  const editLoanType = useMemo(
    () => (editModal.disbursement ? getDisbursementLoanType(editModal.disbursement) : null),
    [editModal.disbursement, loanTypes],
  );
  const editPreview = useMemo(() => {
    if (!editModal.disbursement || !editData) return null;
    return calculateLoanEditPreview(
      editLoanType,
      editData.principalAmount,
      editData.tenureMonths,
      Number(editModal.disbursement.total_repaid || 0),
      editData.startMonth,
    );
  }, [editData, editLoanType, editModal.disbursement]);
  const filteredDisbursements = disbursements.filter((disb) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    const fullName = getLoanStaffFullName(disb.staff_id, disb.staff_number, disb.staff_name).toLowerCase();
    return (
      fullName.includes(query) ||
      (disb.staff_name || '').toLowerCase().includes(query) ||
      (disb.staff_number || '').toLowerCase().includes(query) ||
      (disb.disbursement_number || '').toLowerCase().includes(query) ||
      (disb.loan_type_name || '').toLowerCase().includes(query)
    );
  });

  const viewStatement = async (disbId: string) => {
    try {
      const stmt = await disbursementAPI.getStatement(disbId);
      setStatement(stmt);
      setShowStatementModal(true);
    } catch (error) {
      console.error('Error loading statement:', error);
    }
  };

  const deleteRepayment = async (repaymentId: string) => {
    if (!statement?.disbursement?.id) return;
    const ok = await confirm({
      title: 'Delete repayment?',
      message: 'This will remove the repayment and recalculate the loan balance.',
    });
    if (!ok) return;

    try {
      await repaymentAPI.delete(repaymentId);
      const stmt = await disbursementAPI.getStatement(statement.disbursement.id);
      setStatement(stmt);
      await onRefresh();
      showToast.success('Repayment deleted successfully.');
    } catch (error: any) {
      showToast.error(error?.message || 'Failed to delete repayment');
    }
  };

  const openPayoffModal = (disbursement: LoanDisbursement) => {
    setPayoffModal({ open: true, disbursement });
    setPayoffAmount(Number(disbursement.balance_outstanding || 0));
  };

  const closePayoffModal = () => {
    if (isPayingOff) return;
    setPayoffModal({ open: false, disbursement: null });
    setPayoffAmount('');
  };

  const openEditModal = (disbursement: LoanDisbursement) => {
    setEditModal({ open: true, disbursement });
    setEditData({
      principalAmount: Number(disbursement.principal_amount ?? disbursement.amount_disbursed ?? 0),
      tenureMonths: Number(disbursement.tenure_months ?? 0),
      startMonth: disbursement.start_deduction_month || '',
      status: disbursement.status,
      remarks: '',
    });
  };

  const closeEditModal = () => {
    if (isEditing) return;
    setEditModal({ open: false, disbursement: null });
    setEditData(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editModal.disbursement || !editData || !editLoanType || !editPreview) return;

    if (editData.tenureMonths < 1) {
      showToast.error('Tenure must be at least 1 month.');
      return;
    }

    if (editData.principalAmount < 0) {
      showToast.error('Amounts cannot be negative.');
      return;
    }

    if (
      editLoanType.max_amount !== undefined &&
      editData.principalAmount > Number(editLoanType.max_amount)
    ) {
      showToast.error('Invalid Amount', `Maximum loan amount is ${formatCurrency(editLoanType.max_amount)}`);
      return;
    }

    if (
      editLoanType.max_tenure_months !== undefined &&
      editData.tenureMonths > Number(editLoanType.max_tenure_months)
    ) {
      showToast.error('Invalid Tenure', `Maximum tenure is ${editLoanType.max_tenure_months} months`);
      return;
    }

    try {
      setIsEditing(true);
      await disbursementAPI.update(editModal.disbursement.id, {
        principalAmount: editData.principalAmount,
        tenureMonths: editData.tenureMonths,
        startMonth: editData.startMonth || undefined,
        status: editData.status,
        remarks: editData.remarks.trim() || undefined,
      });
      showToast.success('Assigned loan updated successfully.');
      setEditModal({ open: false, disbursement: null });
      setEditData(null);
      await onRefresh();
    } catch (error: any) {
      showToast.error(error?.message || 'Failed to update assigned loan');
    } finally {
      setIsEditing(false);
    }
  };

  const handlePayOff = async () => {
    const disbursement = payoffModal.disbursement;
    if (!disbursement) return;

    const outstanding = Number(disbursement.balance_outstanding || 0);
    if (outstanding <= 0) {
      showToast.error('This loan has no outstanding balance.');
      closePayoffModal();
      return;
    }

    const amountToPay = Number(payoffAmount);
    if (amountToPay <= 0) {
      showToast.error('Please enter a valid amount greater than 0.');
      return;
    }

    if (amountToPay > outstanding) {
      showToast.error(`Amount cannot exceed the outstanding balance of ${formatCurrency(outstanding)}.`);
      return;
    }

    try {
      setIsPayingOff(true);
      await repaymentAPI.payOff({
        disbursementId: disbursement.id,
        amount: amountToPay,
      });
      showToast.success('Repayment recorded successfully.');
      closePayoffModal();
      await onRefresh();
    } catch (error: any) {
      showToast.error(error?.message || 'Failed to record repayment');
    } finally {
      setIsPayingOff(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by staff name or disbursement number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

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
              {filteredDisbursements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No disbursements found
                  </td>
                </tr>
              ) : (
                filteredDisbursements.map((disb) => (
                  <tr key={disb.id} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-card-foreground">{disb.disbursement_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(disb.disbursement_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-card-foreground">
                        {getLoanStaffFullName(disb.staff_id, disb.staff_number, disb.staff_name)}
                      </div>
                      <div className="text-xs text-muted-foreground">{disb.staff_number}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-card-foreground">{disb.loan_type_name}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm text-card-foreground">
                        {formatCurrency(disb.total_amount ?? disb.amount_disbursed ?? disb.principal_amount ?? 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(disb.monthly_deduction ?? 0)}/mo
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-card-foreground">
                      {formatCurrency(disb.balance_outstanding ?? 0)}
                    </td>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded p-2 hover:bg-accent transition-colors"
                            title="Actions"
                          >
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditDisbursements && (
                            <DropdownMenuItem onClick={() => openEditModal(disb)}>
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => viewStatement(disb.id)}>
                            <FileText className="w-4 h-4 text-blue-500" />
                            Statement
                          </DropdownMenuItem>
                          {disb.status === 'active' && Number(disb.balance_outstanding || 0) > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openPayoffModal(disb)}>
                                <Wallet className="w-4 h-4 text-green-600" />
                                Repay
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                  <div className="text-lg text-card-foreground">{formatCurrency(statement.summary.total_amount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Outstanding</div>
                  <div className="text-lg text-card-foreground">{formatCurrency(statement.summary.balance_outstanding)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Repaid</div>
                  <div className="text-lg text-card-foreground">{formatCurrency(statement.summary.total_repaid)}</div>
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
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-card-foreground">{formatCurrency(rep.amount_paid)}</div>
                            <div className="text-sm text-muted-foreground">Balance: {formatCurrency(rep.balance_after_payment)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteRepayment(rep.id)}
                            className="p-2 rounded hover:bg-accent text-destructive"
                            title="Delete repayment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {editModal.open && editModal.disbursement && editData && editPreview && (
        <Modal
          isOpen={editModal.open}
          onClose={closeEditModal}
          title="Edit Assigned Loan"
          size="lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div className="rounded-lg bg-muted p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Staff</div>
                <div className="text-sm text-card-foreground">
                  {getLoanStaffFullName(
                    editModal.disbursement.staff_id,
                    editModal.disbursement.staff_number,
                    editModal.disbursement.staff_name,
                  )}{' '}
                  ({editModal.disbursement.staff_number})
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Disbursement #</div>
                <div className="text-sm text-card-foreground">{editModal.disbursement.disbursement_number}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Loan Type</div>
                <div className="text-sm text-card-foreground">{editModal.disbursement.loan_type_name}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Current Status</div>
                <div className="text-sm text-card-foreground">{editModal.disbursement.status.toUpperCase()}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Loan Amount</label>
                <NumberInput
                  min={1}
                  value={editData.principalAmount}
                  onChange={(value) => setEditData({ ...editData, principalAmount: value })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Tenure (Months)</label>
                <input
                  type="number"
                  min="1"
                  value={editData.tenureMonths || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      tenureMonths: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Start Month</label>
                <input
                  type="month"
                  value={editData.startMonth}
                  onChange={(e) => setEditData({ ...editData, startMonth: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Projected End Month</label>
                <div className="w-full px-3 py-2 rounded border border-border bg-muted text-card-foreground">
                  {editPreview.endMonth || 'Pending start month'}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Status</label>
                <select
                  value={editData.status}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      status: e.target.value as LoanDisbursement['status'],
                    })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="defaulted">Defaulted</option>
                  <option value="written_off">Written Off</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
              <h4 className="text-sm font-medium text-card-foreground">Automatic Readjustment Preview</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Interest</span>
                  <span className="text-card-foreground">{formatCurrency(editPreview.interestAmount)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Amount to Receive</span>
                  <span className="text-card-foreground">{formatCurrency(editPreview.amountDisbursed)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Total Repayment</span>
                  <span className="text-card-foreground">{formatCurrency(editPreview.totalRepayment)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Monthly Deduction</span>
                  <span className="text-card-foreground">{formatCurrency(editPreview.monthlyDeduction)}/mo</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Outstanding Balance</span>
                  <span className="text-card-foreground">{formatCurrency(editPreview.balanceOutstanding)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Total Repaid</span>
                  <span className="text-card-foreground">
                    {formatCurrency(Number(editModal.disbursement.total_repaid || 0))}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-card-foreground">Remarks</label>
              <textarea
                value={editData.remarks}
                onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                rows={3}
                placeholder="Add a short reason for this correction"
                className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isEditing}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isEditing}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
              >
                {isEditing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payoffModal.open && payoffModal.disbursement && (
        <Modal
          isOpen={payoffModal.open}
          onClose={closePayoffModal}
          title="Record Repayment"
          size="md"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="text-sm text-muted-foreground">Staff</div>
              <div className="text-sm text-card-foreground">
                {getLoanStaffFullName(
                  payoffModal.disbursement.staff_id,
                  payoffModal.disbursement.staff_number,
                  payoffModal.disbursement.staff_name,
                )}{' '}
                ({payoffModal.disbursement.staff_number})
              </div>
              <div className="text-sm text-muted-foreground mt-2">Outstanding Balance</div>
              <div className="text-lg font-semibold text-card-foreground">
                {formatCurrency(Number(payoffModal.disbursement.balance_outstanding || 0))}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 text-card-foreground">Payment Amount</label>
              <input
                type="number"
                max={Number(payoffModal.disbursement.balance_outstanding || 0)}
                value={payoffAmount}
                onChange={(e) => setPayoffAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter amount to pay"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Enter the amount to record as a manual repayment. The remaining balance and monthly deductions will be adjusted automatically.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePayoffModal}
                disabled={isPayingOff}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePayOff}
                disabled={isPayingOff}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {isPayingOff ? 'Processing...' : 'Record Repayment'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Reports Tab
function ReportsTab() {
  type LoanReportKey =
    | 'applications'
    | 'disbursements'
    | 'repayment-schedule'
    | 'cooperative-statement'
    | 'loan-aging'
    | 'defaulters';

  type ReportColumn = {
    key: string;
    label: string;
    align?: 'left' | 'right';
  };

  const [selectedReport, setSelectedReport] = useState<LoanReportKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [disbursements, setDisbursements] = useState<LoanDisbursement[]>([]);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [reportColumns, setReportColumns] = useState<ReportColumn[]>([]);
  const [reportSummary, setReportSummary] = useState<Array<{ label: string; value: string }>>([]);
  const [reportBreakdown, setReportBreakdown] = useState<Array<{ title: string; items: Array<{ label: string; value: string }> }>>([]);
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('all');
  const [cooperativeFilter, setCooperativeFilter] = useState('all');

  const reports: Array<{ key: LoanReportKey; name: string; description: string }> = [
    { key: 'applications', name: 'Loan Applications Report', description: 'All loan applications with status' },
    { key: 'disbursements', name: 'Disbursement Report', description: 'All loan disbursements by period' },
    { key: 'repayment-schedule', name: 'Repayment Schedule', description: 'Upcoming and overdue repayments' },
    { key: 'cooperative-statement', name: 'Cooperative Statement', description: 'Loans summary by cooperative' },
    { key: 'loan-aging', name: 'Loan Aging Report', description: 'Outstanding loans by age' },
    { key: 'defaulters', name: 'Defaulters Report', description: 'Staff with overdue repayments' },
  ];

  const applicationStatuses = Array.from(new Set(applications.map((a) => a.status)));
  const disbursementStatuses = Array.from(new Set(disbursements.map((d) => d.status)));

  const getDateRange = () => {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const inRange = (value?: string) => {
    if (!value) return false;
    const { start, end } = getDateRange();
    const date = new Date(value);
    return date >= start && date <= end;
  };

  const monthDiff = (from: string, to: string) => {
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    return (toYear - fromYear) * 12 + (toMonth - fromMonth);
  };

  const exportCSV = () => {
    if (!selectedReport || reportRows.length === 0 || reportColumns.length === 0) {
      showToast.warning('No data to export');
      return;
    }
    const headers = reportColumns.map((c) => c.label);
    const lines = [headers.join(',')];
    reportRows.forEach((row) => {
      const line = reportColumns
        .map((col) => {
          const value = row[col.key];
          const text = value === undefined || value === null ? '' : String(value);
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(',');
      lines.push(line);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = `${selectedReport.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Report exported', filename);
  };

  const buildReportView = (
    key: LoanReportKey,
    apps: LoanApplication[],
    disb: LoanDisbursement[],
    coops: Cooperative[]
  ) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const rangeStartMonth = dateFrom.slice(0, 7);
    const rangeEndMonth = dateTo.slice(0, 7);
    const { start, end } = getDateRange();
    const matchesCooperative = (coopId?: string) => cooperativeFilter === 'all' || coopId === cooperativeFilter;
    
    // Helper to safely convert value to number
    const toNumber = (val: any): number => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    if (key === 'applications') {
      const filtered = apps.filter((app) => {
        const statusMatch = statusFilter === 'all' || app.status === statusFilter;
        const dateValue = app.submitted_at || app.created_at;
        const coopMatch = matchesCooperative(app.cooperative_id);
        if (!dateValue) return statusMatch && coopMatch; // If no date, still include if status/coop match
        const date = new Date(dateValue);
        return statusMatch && coopMatch && date >= start && date <= end;
      });
      const totalRequested = filtered.reduce((sum, app) => sum + toNumber(app.amount_requested), 0);
      const byStatus = filtered.reduce((acc: Record<string, number>, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {});
      const columns: ReportColumn[] = [
        { key: 'application_number', label: 'Application #' },
        { key: 'staff_name', label: 'Staff Name' },
        { key: 'staff_number', label: 'Staff Number' },
        { key: 'loan_type_name', label: 'Loan Type' },
        { key: 'amount_requested', label: 'Amount Requested', align: 'right' },
        { key: 'tenure_months', label: 'Tenure (Months)', align: 'right' },
        { key: 'status', label: 'Status' },
        { key: 'created_at', label: 'Submitted' },
      ];
      const rows = filtered.map((app) => ({
        application_number: app.application_number,
        staff_name: app.staff_name,
        staff_number: app.staff_number,
        loan_type_name: app.loan_type_name,
        amount_requested: formatCurrency(app.amount_requested),
        tenure_months: app.tenure_months,
        status: app.status.replace('_', ' '),
        created_at: new Date(app.submitted_at || app.created_at).toLocaleDateString(),
      }));
      const summary = [
        { label: 'Total Applications', value: filtered.length.toString() },
        { label: 'Total Requested', value: formatCurrency(totalRequested) },
        { label: 'Approved', value: String(byStatus.approved || 0) },
        { label: 'Pending', value: String((byStatus.pending || 0) + (byStatus.guarantor_pending || 0) + (byStatus.under_review || 0)) },
      ];
      const breakdown = [
        {
          title: 'By Status',
          items: Object.entries(byStatus).map(([label, value]) => ({
            label: label.replace('_', ' '),
            value: String(value),
          })),
        },
      ];
      return { rows, columns, summary, breakdown };
    }

    if (key === 'disbursements') {
      const filtered = disb.filter((d) => {
        const statusMatch = statusFilter === 'all' || d.status === statusFilter;
        const coopMatch = matchesCooperative(d.cooperative_id);
        if (!d.disbursement_date) return statusMatch && coopMatch; // If no date, still include
        const date = new Date(d.disbursement_date);
        return statusMatch && coopMatch && date >= start && date <= end;
      });
      const totalDisbursed = filtered.reduce(
        (sum, d) => sum + toNumber(d.amount_disbursed ?? d.principal_amount),
        0,
      );
      const totalRepaid = filtered.reduce((sum, d) => sum + toNumber(d.total_repaid), 0);
      const totalOutstanding = filtered.reduce((sum, d) => sum + toNumber(d.balance_outstanding), 0);
      const columns: ReportColumn[] = [
        { key: 'disbursement_number', label: 'Disbursement #' },
        { key: 'staff_name', label: 'Staff Name' },
        { key: 'staff_number', label: 'Staff Number' },
        { key: 'loan_type_name', label: 'Loan Type' },
        { key: 'principal_amount', label: 'Disbursed', align: 'right' },
        { key: 'total_repaid', label: 'Repaid', align: 'right' },
        { key: 'balance_outstanding', label: 'Outstanding', align: 'right' },
        { key: 'status', label: 'Status' },
        { key: 'disbursement_date', label: 'Date' },
      ];
      const rows = filtered.map((d) => ({
        disbursement_number: d.disbursement_number,
        staff_name: d.staff_name,
        staff_number: d.staff_number,
        loan_type_name: d.loan_type_name,
        principal_amount: formatCurrency(d.amount_disbursed ?? d.principal_amount ?? 0),
        total_repaid: formatCurrency(d.total_repaid),
        balance_outstanding: formatCurrency(d.balance_outstanding),
        status: d.status.replace('_', ' '),
        disbursement_date: new Date(d.disbursement_date).toLocaleDateString(),
      }));
      const summary = [
        { label: 'Total Disbursements', value: filtered.length.toString() },
        { label: 'Total Disbursed', value: formatCurrency(totalDisbursed) },
        { label: 'Total Repaid', value: formatCurrency(totalRepaid) },
        { label: 'Outstanding', value: formatCurrency(totalOutstanding) },
      ];
      return { rows, columns, summary, breakdown: [] };
    }

    if (key === 'repayment-schedule') {
      const scheduleStatus = (d: LoanDisbursement) => {
        if (d.status === 'completed' || toNumber(d.balance_outstanding) <= 0) return 'completed';
        if (currentMonth < d.start_deduction_month) return 'upcoming';
        if (currentMonth > d.end_deduction_month && toNumber(d.balance_outstanding) > 0) return 'overdue';
        return 'active';
      };
      const filtered = disb.filter((d) => {
        if (!matchesCooperative(d.cooperative_id)) return false;
        if (!d.start_deduction_month || !d.end_deduction_month) return true; // Include if no date range
        return d.start_deduction_month <= rangeEndMonth && d.end_deduction_month >= rangeStartMonth;
      });
      const scoped = filtered.filter((d) => statusFilter === 'all' || scheduleStatus(d) === statusFilter);
      const activeCount = filtered.filter((d) => scheduleStatus(d) === 'active').length;
      const upcomingCount = filtered.filter((d) => scheduleStatus(d) === 'upcoming').length;
      const overdueCount = filtered.filter((d) => scheduleStatus(d) === 'overdue').length;
      const completedCount = filtered.filter((d) => scheduleStatus(d) === 'completed').length;
      const totalMonthlyDue = filtered
        .filter((d) => scheduleStatus(d) === 'active')
        .reduce((sum, d) => sum + toNumber(d.monthly_deduction), 0);
      const overdueOutstanding = filtered
        .filter((d) => scheduleStatus(d) === 'overdue')
        .reduce((sum, d) => sum + toNumber(d.balance_outstanding), 0);
      const columns: ReportColumn[] = [
        { key: 'staff_name', label: 'Staff Name' },
        { key: 'staff_number', label: 'Staff Number' },
        { key: 'loan_type_name', label: 'Loan Type' },
        { key: 'monthly_deduction', label: 'Monthly Deduction', align: 'right' },
        { key: 'start_deduction_month', label: 'Start Month' },
        { key: 'end_deduction_month', label: 'End Month' },
        { key: 'balance_outstanding', label: 'Outstanding', align: 'right' },
        { key: 'schedule_status', label: 'Schedule Status' },
      ];
      const rows = scoped.map((d) => ({
        staff_name: d.staff_name,
        staff_number: d.staff_number,
        loan_type_name: d.loan_type_name,
        monthly_deduction: formatCurrency(d.monthly_deduction),
        start_deduction_month: d.start_deduction_month,
        end_deduction_month: d.end_deduction_month,
        balance_outstanding: formatCurrency(d.balance_outstanding),
        schedule_status: scheduleStatus(d),
      }));
      const summary = [
        { label: 'Active Loans', value: activeCount.toString() },
        { label: 'Upcoming Loans', value: upcomingCount.toString() },
        { label: 'Overdue Loans', value: overdueCount.toString() },
        { label: 'Completed Loans', value: completedCount.toString() },
        { label: 'Monthly Due', value: formatCurrency(totalMonthlyDue) },
        { label: 'Overdue Outstanding', value: formatCurrency(overdueOutstanding) },
      ];
      return { rows, columns, summary, breakdown: [] };
    }

    if (key === 'cooperative-statement') {
      const coopNameById = coops.reduce((acc: Record<string, string>, coop) => {
        acc[coop.id] = coop.name;
        return acc;
      }, {});
      const filtered = disb.filter((d) => {
        if (!d.cooperative_id) return false;
        if (!d.disbursement_date) return true; // Include if no date
        const disbursementDate = new Date(d.disbursement_date);
        return disbursementDate >= start && disbursementDate <= end;
      });
      const scoped = filtered.filter((d) => matchesCooperative(d.cooperative_id));
      const grouped = scoped.reduce((acc: Record<string, any>, d) => {
        const keyValue = d.cooperative_id || 'unknown';
        const label = d.cooperative_name || coopNameById[keyValue] || 'Unknown Cooperative';
        if (!acc[keyValue]) {
          acc[keyValue] = {
            cooperative_name: label,
            total_loans: 0,
            total_disbursed: 0,
            total_repaid: 0,
            total_outstanding: 0,
          };
        }
        acc[keyValue].total_loans += 1;
        acc[keyValue].total_disbursed += toNumber(d.amount_disbursed ?? d.principal_amount);
        acc[keyValue].total_repaid += toNumber(d.total_repaid);
        acc[keyValue].total_outstanding += toNumber(d.balance_outstanding);
        return acc;
      }, {});
      const rows = Object.values(grouped).map((g: any) => ({
        cooperative_name: g.cooperative_name,
        total_loans: g.total_loans,
        total_disbursed: formatCurrency(g.total_disbursed),
        total_repaid: formatCurrency(g.total_repaid),
        total_outstanding: formatCurrency(g.total_outstanding),
      }));
      const columns: ReportColumn[] = [
        { key: 'cooperative_name', label: 'Cooperative' },
        { key: 'total_loans', label: 'Total Loans', align: 'right' },
        { key: 'total_disbursed', label: 'Disbursed', align: 'right' },
        { key: 'total_repaid', label: 'Repaid', align: 'right' },
        { key: 'total_outstanding', label: 'Outstanding', align: 'right' },
      ];
      const totalLoans = rows.reduce((sum, r: any) => sum + Number(r.total_loans || 0), 0);
      const totalOutstanding = scoped.reduce((sum, d) => sum + toNumber(d.balance_outstanding), 0);
      const summary = [
        { label: 'Cooperatives', value: rows.length.toString() },
        { label: 'Total Loans', value: totalLoans.toString() },
        { label: 'Outstanding', value: formatCurrency(totalOutstanding) },
      ];
      return { rows, columns, summary, breakdown: [] };
    }

    if (key === 'loan-aging') {
      const agingLoans = disb.filter((d) => {
        if (toNumber(d.balance_outstanding) <= 0) return false;
        if (!matchesCooperative(d.cooperative_id)) return false;
        if (!d.disbursement_date) return true; // Include if no date
        const disbursementDate = new Date(d.disbursement_date);
        return disbursementDate >= start && disbursementDate <= end;
      });
      const today = new Date();
      const buckets = agingLoans.reduce((acc: Record<string, { count: number; outstanding: number }>, d) => {
        const disbursementDate = new Date(d.disbursement_date);
        const months = (today.getFullYear() - disbursementDate.getFullYear()) * 12 + (today.getMonth() - disbursementDate.getMonth());
        let bucket = '25+ months';
        if (months <= 3) bucket = '0-3 months';
        else if (months <= 6) bucket = '4-6 months';
        else if (months <= 12) bucket = '7-12 months';
        else if (months <= 24) bucket = '13-24 months';
        if (!acc[bucket]) acc[bucket] = { count: 0, outstanding: 0 };
        acc[bucket].count += 1;
        acc[bucket].outstanding += toNumber(d.balance_outstanding);
        return acc;
      }, {});
      const columns: ReportColumn[] = [
        { key: 'staff_name', label: 'Staff Name' },
        { key: 'staff_number', label: 'Staff Number' },
        { key: 'loan_type_name', label: 'Loan Type' },
        { key: 'disbursement_date', label: 'Disbursed' },
        { key: 'months_since', label: 'Months Since', align: 'right' },
        { key: 'balance_outstanding', label: 'Outstanding', align: 'right' },
        { key: 'aging_bucket', label: 'Aging Bucket' },
      ];
      const rows = agingLoans.map((d) => {
        const disbursementDate = new Date(d.disbursement_date);
        const months = (today.getFullYear() - disbursementDate.getFullYear()) * 12 + (today.getMonth() - disbursementDate.getMonth());
        let bucket = '25+ months';
        if (months <= 3) bucket = '0-3 months';
        else if (months <= 6) bucket = '4-6 months';
        else if (months <= 12) bucket = '7-12 months';
        else if (months <= 24) bucket = '13-24 months';
        return {
          staff_name: d.staff_name,
          staff_number: d.staff_number,
          loan_type_name: d.loan_type_name,
          disbursement_date: new Date(d.disbursement_date).toLocaleDateString(),
          months_since: months,
          balance_outstanding: formatCurrency(d.balance_outstanding),
          aging_bucket: bucket,
        };
      });
      const totalOutstanding = agingLoans.reduce((sum, d) => sum + toNumber(d.balance_outstanding), 0);
      const summary = [
        { label: 'Outstanding Loans', value: agingLoans.length.toString() },
        { label: 'Outstanding Balance', value: formatCurrency(totalOutstanding) },
      ];
      const breakdown = [
        {
          title: 'Aging Buckets',
          items: Object.entries(buckets).map(([label, value]) => ({
            label,
            value: `${value.count} loans • ${formatCurrency(value.outstanding)}`,
          })),
        },
      ];
      return { rows, columns, summary, breakdown };
    }

    const overdue = disb.filter((d) => {
      if (toNumber(d.balance_outstanding) <= 0) return false;
      if (!matchesCooperative(d.cooperative_id)) return false;
      if (d.disbursement_date) {
        const disbursementDate = new Date(d.disbursement_date);
        if (disbursementDate < start || disbursementDate > end) return false;
      }
      return currentMonth > d.end_deduction_month;
    });
    const columns: ReportColumn[] = [
      { key: 'staff_name', label: 'Staff Name' },
      { key: 'staff_number', label: 'Staff Number' },
      { key: 'loan_type_name', label: 'Loan Type' },
      { key: 'end_deduction_month', label: 'End Month' },
      { key: 'months_overdue', label: 'Months Overdue', align: 'right' },
      { key: 'balance_outstanding', label: 'Outstanding', align: 'right' },
    ];
    const rows = overdue.map((d) => ({
      staff_name: d.staff_name,
      staff_number: d.staff_number,
      loan_type_name: d.loan_type_name,
      end_deduction_month: d.end_deduction_month,
      months_overdue: Math.max(0, monthDiff(d.end_deduction_month, currentMonth)),
      balance_outstanding: formatCurrency(d.balance_outstanding),
    }));
    const totalOutstanding = overdue.reduce((sum, d) => sum + toNumber(d.balance_outstanding), 0);
    const summary = [
      { label: 'Defaulters', value: overdue.length.toString() },
      { label: 'Outstanding Balance', value: formatCurrency(totalOutstanding) },
    ];
    return { rows, columns, summary, breakdown: [] };
  };

  const updateReport = async (key: LoanReportKey, force = false) => {
    try {
      setLoading(true);
      let apps = applications;
      let disb = disbursements;
      let coops = cooperatives;
      if (force || applications.length === 0 || disbursements.length === 0 || cooperatives.length === 0) {
        const [appsData, disbData, coopsData] = await Promise.all([
          loanApplicationAPI.getAll(),
          disbursementAPI.getAll(),
          cooperativeAPI.getAll(),
        ]);
        apps = appsData;
        disb = disbData;
        coops = coopsData;
        setApplications(appsData);
        setDisbursements(disbData);
        setCooperatives(coopsData);
      }
      const report = buildReportView(key, apps, disb, coops);
      setReportRows(report.rows);
      setReportColumns(report.columns);
      setReportSummary(report.summary);
      setReportBreakdown(report.breakdown);
    } catch (error: any) {
      showToast.error('Failed to generate report', error?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedReport) return;
    updateReport(selectedReport);
  }, [selectedReport, dateFrom, dateTo, statusFilter, cooperativeFilter]);

  useEffect(() => {
    if (!selectedReport) return;
    setStatusFilter('all');
    setCooperativeFilter('all');
  }, [selectedReport]);

  const statusOptions = selectedReport === 'applications'
    ? applicationStatuses
    : selectedReport === 'disbursements'
      ? disbursementStatuses
      : selectedReport === 'repayment-schedule'
        ? ['active', 'upcoming', 'overdue', 'completed']
        : [];

  const showStatusFilter = selectedReport === 'applications' || selectedReport === 'disbursements' || selectedReport === 'repayment-schedule';
  const showCooperativeFilter = selectedReport !== null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div key={report.key} className="p-6 rounded-lg border border-border bg-card">
            <FileText className="w-8 h-8 text-primary mb-4" />
            <h3 className="mb-2">{report.name}</h3>
            <p className="text-sm mb-4 text-muted-foreground">{report.description}</p>
            <button
              onClick={() => setSelectedReport(report.key)}
              className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        ))}
      </div>

      {selectedReport && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg text-card-foreground">
                {reports.find((r) => r.key === selectedReport)?.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {reports.find((r) => r.key === selectedReport)?.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateReport(selectedReport, true)}
                className="px-3 py-2 rounded border border-border hover:bg-accent text-sm"
              >
                Refresh
              </button>
              <button
                onClick={exportCSV}
                className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-border grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground"
              />
            </div>
            {showStatusFilter && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground"
                >
                  <option value="all">All</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showCooperativeFilter && (
              <div className="md:col-span-3">
                <label className="block text-xs text-muted-foreground mb-1">Cooperative</label>
                <select
                  value={cooperativeFilter}
                  onChange={(e) => setCooperativeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground"
                >
                  <option value="all">All Cooperatives</option>
                  {cooperatives.map((coop) => (
                    <option key={coop.id} value={coop.id}>
                      {coop.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Generating report...</div>
          ) : (
            <div className="p-4 space-y-6">
              {reportSummary.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {reportSummary.map((item) => (
                    <div key={item.label} className="p-4 rounded-lg border border-border bg-muted/20">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className="text-lg text-card-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {reportBreakdown.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reportBreakdown.map((group) => (
                    <div key={group.title} className="p-4 rounded-lg border border-border bg-card">
                      <h4 className="text-sm text-card-foreground mb-3">{group.title}</h4>
                      <div className="space-y-2 text-sm">
                        {group.items.map((item) => (
                          <div key={item.label} className="flex items-center justify-between text-muted-foreground">
                            <span>{item.label}</span>
                            <span className="text-card-foreground">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      {reportColumns.map((column) => (
                        <th
                          key={column.key}
                          className={`px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground ${
                            column.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportRows.length === 0 ? (
                      <tr>
                        <td colSpan={reportColumns.length} className="px-4 py-6 text-center text-muted-foreground">
                          No records found for this period
                        </td>
                      </tr>
                    ) : (
                      reportRows.slice(0, 100).map((row, index) => (
                        <tr key={index} className="hover:bg-accent transition-colors">
                          {reportColumns.map((column) => (
                            <td
                              key={column.key}
                              className={`px-4 py-3 text-sm text-card-foreground ${
                                column.align === 'right' ? 'text-right' : 'text-left'
                              }`}
                            >
                              {row[column.key]}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {reportRows.length > 100 && (
                <div className="text-sm text-muted-foreground text-center">
                  Showing 100 of {reportRows.length} records
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
