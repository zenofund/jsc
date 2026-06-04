import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Plus, Edit, Users, DollarSign, TrendingUp,
  Search, Filter, RefreshCw, X, Trash2, Eye, UserPlus,
  Receipt, FileText, AlertCircle, CheckCircle, XCircle,
  Calendar, CreditCard, Shield, Mail, Phone, Wallet, Loader2,
  Minus, PieChart, Download, Upload, MoreVertical
} from 'lucide-react';
import { cooperativeAPI, loanMigrationAPI } from '../lib/loanAPI';
import { staffAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import type { Cooperative, CooperativeMember, CooperativeContribution, Staff } from '../types/entities';
import { formatStaffLabelWithId } from '../lib/name-utils';
import { formatCurrency } from '../utils/format';
import { toast } from 'sonner';

type ViewMode = 'cooperatives' | 'members' | 'contributions';

interface CooperativeFormData {
  name: string;
  code: string;
  description: string;
  registration_number: string;
  date_established: string;
  cooperative_type: 'thrift_credit' | 'multipurpose' | 'producer' | 'consumer' | 'housing' | 'transport' | 'other';
  monthly_contribution_required: number;
  share_capital_value: number | '';
  minimum_shares: number | '';
  interest_rate_on_loans: number;
  maximum_loan_multiplier: number;
  meeting_schedule: string;
  chairman_name: string;
  secretary_name: string;
  treasurer_name: string;
  contact_email: string;
  contact_phone: string;
  bank_name: string;
  bank_account_number: string;
  auto_deduct_contribution: boolean;
  status: 'active' | 'inactive' | 'suspended';
}

interface MemberFormData {
  cooperative_id: string;
  staff_id: string;
  monthly_contribution: number;
  shares_owned: number | '';
}

interface ContributionFormData {
  cooperative_id: string;
  member_id: string;
  contribution_month: string;
  amount: number;
  contribution_type: 'regular' | 'voluntary' | 'share_capital' | 'special_levy';
  payment_method: 'payroll_deduction' | 'cash' | 'bank_transfer';
  receipt_number: string;
}

const COOPERATIVE_TYPES = [
  { value: 'thrift_credit', label: 'Thrift & Credit' },
  { value: 'multipurpose', label: 'Multipurpose' },
  { value: 'producer', label: 'Producer' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'housing', label: 'Housing' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

const NIGERIAN_BANKS = [
  'Access Bank', 'Citibank', 'Ecobank', 'Fidelity Bank', 'First Bank of Nigeria',
  'First City Monument Bank (FCMB)', 'Guaranty Trust Bank (GTBank)', 'Heritage Bank',
  'Keystone Bank', 'Polaris Bank', 'Providus Bank', 'Stanbic IBTC Bank',
  'Standard Chartered Bank', 'Sterling Bank', 'Union Bank', 'United Bank for Africa (UBA)',
  'Unity Bank', 'Wema Bank', 'Zenith Bank'
];

const toOptionalNumber = (value: number | '' | undefined) =>
  value === '' || value === undefined ? undefined : Number(value);

export function CooperativeManagementPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('cooperatives');
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [members, setMembers] = useState<CooperativeMember[]>([]);
  const [contributions, setContributions] = useState<CooperativeContribution[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedCooperative, setSelectedCooperative] = useState<Cooperative | null>(null);
  const [selectedMember, setSelectedMember] = useState<CooperativeMember | null>(null);
  const [dbError, setDbError] = useState(false);

  // Pagination states for members
  const [currentPage, setCurrentPage] = useState(1);
  const [membersPerPage] = useState(25);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Modal states
  const [showCooperativeModal, setShowCooperativeModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [editingCooperative, setEditingCooperative] = useState<Cooperative | null>(null);
  const [editingMember, setEditingMember] = useState<CooperativeMember | null>(null);
  const [cooperativeStats, setCooperativeStats] = useState<any>(null);
  const [memberToDelete, setMemberToDelete] = useState<CooperativeMember | null>(null);
  const [cooperativeToDelete, setCooperativeToDelete] = useState<Cooperative | null>(null);
  const [contributionToDelete, setContributionToDelete] = useState<CooperativeContribution | null>(null);

  // New features state
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showDividendModal, setShowDividendModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [memberStatement, setMemberStatement] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState({
    total_cooperatives: 0,
    total_members: 0,
    total_contribution_transactions: 0
  });

  useEffect(() => {
    reloadDashboardData(cooperatives.length > 0);
  }, [viewMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, viewMode]);

  const loadStats = async () => {
    try {
      const stats = await cooperativeAPI.getCooperativeStats(''); // Empty ID for global stats
      setDashboardStats({
        total_cooperatives: Number(stats?.total_cooperatives || 0),
        total_members: Number(stats?.total_members || 0),
        total_contribution_transactions: Number(
          stats?.total_contribution_transactions ?? stats?.total_contributions_count ?? 0,
        ),
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  const loadData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const coops = await cooperativeAPI.getAll();
      setCooperatives(coops);

      if (viewMode === 'members') {
        const allMembers = await cooperativeAPI.getAllMembers();
        setMembers(allMembers);
      } else if (viewMode === 'contributions') {
        const allContributions = await cooperativeAPI.getContributions({});
        setContributions(allContributions);
      }

      // Load all staff for member registration (fetch all pages, not first page only)
      const response = await staffAPI.getAllStaff({ fetchAll: true, limit: 1000 });
      const rawData = Array.isArray(response) ? response : (response.data || []);
      
      // Map flat data to nested structure if needed
      const staff: Staff[] = rawData.map((item: any) => {
        // If already nested, return as is
        if (item.bio_data) return item;

        // Otherwise map flat structure to nested
        return {
          id: item.id,
          staff_number: item.staff_number,
          bio_data: {
            first_name: item.first_name,
            last_name: item.surname || item.last_name,
            middle_name: item.other_names || item.middle_name,
            email: item.email,
            phone: item.phone,
            address: item.address,
            gender: item.gender,
            date_of_birth: item.date_of_birth,
            marital_status: item.marital_status,
            state_of_origin: item.state_of_origin,
            lga_of_origin: item.lga_of_origin,
          },
          appointment: {
            department: item.department_name || item.department,
            designation: item.designation,
            current_posting: item.current_posting,
            date_of_first_appointment: item.date_of_first_appointment,
            employment_date: item.employment_date,
            status: item.status,
          },
          salary_info: {
            grade_level: item.grade_level,
            step: item.step,
            account_number: item.account_number,
            bank_name: item.bank_name,
            bvn: item.bvn,
          },
          next_of_kin: {
            name: item.nok_name,
            relationship: item.nok_relationship,
            phone: item.nok_phone,
            address: item.nok_address,
          },
          status: item.status,
        } as unknown as Staff;
      });

      setAllStaff(staff.filter(s => s.status === 'active'));
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error.name === 'NotFoundError' || error.message?.includes('object stores')) {
        setDbError(true);
        toast.error('Database upgrade required. Please refresh the page.');
      } else {
        toast.error('Failed to load data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const reloadDashboardData = async (isRefresh = true) => {
    await Promise.all([loadData(isRefresh), loadStats()]);
  };

  const handleCreateCooperative = async (formData: CooperativeFormData) => {
    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description,
        type: formData.cooperative_type, // Map cooperative_type to type for backend compatibility
        registrationFee: 0, // Default value
        monthlyContribution: formData.monthly_contribution_required, // Map to monthlyContribution
        interestRate: formData.interest_rate_on_loans, // Map to interestRate
        
        // New fields
        registration_number: formData.registration_number,
        date_established: formData.date_established,
        cooperative_type: formData.cooperative_type,
        monthly_contribution_required: formData.monthly_contribution_required,
        share_capital_value: toOptionalNumber(formData.share_capital_value),
        minimum_shares: toOptionalNumber(formData.minimum_shares),
        interest_rate_on_loans: formData.interest_rate_on_loans,
        maximum_loan_multiplier: formData.maximum_loan_multiplier,
        meeting_schedule: formData.meeting_schedule,
        chairman_name: formData.chairman_name,
        secretary_name: formData.secretary_name,
        treasurer_name: formData.treasurer_name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        bank_name: formData.bank_name,
        bank_account_number: formData.bank_account_number,
        auto_deduct_contribution: formData.auto_deduct_contribution,
        status: formData.status,
      };

      await cooperativeAPI.create(payload as any);
      toast.success('Cooperative created successfully');
      setShowCooperativeModal(false);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create cooperative');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCooperative = async (id: string, formData: Partial<CooperativeFormData>) => {
    try {
      setIsSubmitting(true);
      const payload: any = { ...formData };
      payload.share_capital_value = toOptionalNumber(formData.share_capital_value);
      payload.minimum_shares = toOptionalNumber(formData.minimum_shares);
      
      // Map fields for backend compatibility if they exist in update data
      if (formData.cooperative_type) payload.type = formData.cooperative_type;
      if (formData.monthly_contribution_required) payload.monthlyContribution = formData.monthly_contribution_required;
      if (formData.interest_rate_on_loans) payload.interestRate = formData.interest_rate_on_loans;

      await cooperativeAPI.update(id, payload);
      toast.success('Cooperative updated successfully');
      setShowCooperativeModal(false);
      setEditingCooperative(null);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update cooperative');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCooperative = (coop: Cooperative) => {
    setCooperativeToDelete(coop);
  };

  const confirmDeleteCooperative = async () => {
    if (!cooperativeToDelete) return;

    try {
      setUpdatingStatusId(cooperativeToDelete.id);
      await cooperativeAPI.delete(cooperativeToDelete.id);
      toast.success('Cooperative deleted successfully');
      setCooperativeToDelete(null);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete cooperative');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleRegisterMember = async (formData: MemberFormData) => {
    try {
      setIsSubmitting(true);
      await cooperativeAPI.registerMember({
        ...formData,
        shares_owned: toOptionalNumber(formData.shares_owned),
      });
      toast.success('Member registered successfully');
      setShowMemberModal(false);
      setEditingMember(null);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to register member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = async (memberId: string, formData: MemberFormData) => {
    try {
      setIsSubmitting(true);
      await cooperativeAPI.updateMember(memberId, {
        monthly_contribution: formData.monthly_contribution,
        shares_owned: toOptionalNumber(formData.shares_owned),
      });
      toast.success('Member updated successfully');
      setShowMemberModal(false);
      setEditingMember(null);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordContribution = async (formData: ContributionFormData) => {
    try {
      setIsSubmitting(true);
      await cooperativeAPI.recordContribution({
        ...formData,
      });
      toast.success('Contribution recorded successfully');
      setShowContributionModal(false);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record contribution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportMigration = async (payload: any, dryRun: boolean) => {
    try {
      setIsSubmitting(true);
      const cooperativePayload = {
        cooperatives: payload?.cooperatives || [],
        members: payload?.members || [],
        openingBalances: payload?.openingBalances || [],
        contributions: payload?.contributions || [],
      };
      const loanPayload = {
        loans: payload?.loans || [],
        repayments: payload?.repayments || [],
      };

      const hasCooperativeRows =
        cooperativePayload.cooperatives.length > 0 ||
        cooperativePayload.members.length > 0 ||
        cooperativePayload.openingBalances.length > 0 ||
        cooperativePayload.contributions.length > 0;
      const hasLoanRows = loanPayload.loans.length > 0 || loanPayload.repayments.length > 0;

      let coopResult: any = null;
      let loanResult: any = null;

      if (hasCooperativeRows) {
        coopResult = await cooperativeAPI.importMigrationData({
          ...cooperativePayload,
          dryRun,
        });
      }
      if (hasLoanRows) {
        loanResult = await loanMigrationAPI.importMigrationData({
          ...loanPayload,
          dryRun,
        });
      }

      const failedCount =
        (coopResult?.summary?.cooperatives?.failed || 0) +
        (coopResult?.summary?.members?.failed || 0) +
        (coopResult?.summary?.openingBalances?.failed || 0) +
        (coopResult?.summary?.contributions?.failed || 0) +
        (loanResult?.summary?.loans?.failed || 0) +
        (loanResult?.summary?.repayments?.failed || 0);

      const result = {
        cooperative: coopResult,
        loans: loanResult,
        summary: {
          cooperatives: coopResult?.summary?.cooperatives || { success: 0, failed: 0 },
          members: coopResult?.summary?.members || { success: 0, failed: 0 },
          openingBalances: coopResult?.summary?.openingBalances || { success: 0, failed: 0 },
          contributions: coopResult?.summary?.contributions || { success: 0, failed: 0 },
          loans: loanResult?.summary?.loans || { success: 0, failed: 0 },
          repayments: loanResult?.summary?.repayments || { success: 0, failed: 0 },
        },
      };

      if (failedCount > 0) {
        toast.warning(
          `${dryRun ? 'Dry run' : 'Import'} completed with ${failedCount} failed row(s).`,
        );
      } else {
        toast.success(`${dryRun ? 'Dry run' : 'Import'} completed successfully.`);
      }

      if (!dryRun) {
        reloadDashboardData();
      }
      return result;
    } catch (error: any) {
      toast.error(error.message || 'Migration import failed');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (memberId: string, amount: number, reason: string) => {
    try {
      setIsSubmitting(true);
      await cooperativeAPI.withdraw({ memberId, amount, reason });
      toast.success('Withdrawal processed successfully');
      setShowWithdrawalModal(false);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDistributeDividends = async (cooperativeId: string, amount: number) => {
    try {
      setIsSubmitting(true);
      await cooperativeAPI.distributeDividends(cooperativeId, amount);
      toast.success('Dividends distributed successfully');
      setShowDividendModal(false);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to distribute dividends');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewStatement = async (member: CooperativeMember) => {
    try {
      const statement = await cooperativeAPI.getMemberStatement(member.id);
      setMemberStatement(statement);
      setSelectedMember(member);
      setShowStatementModal(true);
    } catch (error: any) {
      toast.error('Failed to load statement');
    }
  };

  const handleViewStats = async (cooperative: Cooperative) => {
    try {
      const stats = await cooperativeAPI.getCooperativeStats(cooperative.id);
      setCooperativeStats(stats);
      setSelectedCooperative(cooperative);
      setShowStatsModal(true);
    } catch (error) {
      toast.error('Failed to load statistics');
    }
  };

  const handleUpdateMemberStatus = async (
    memberId: string,
    status: 'active' | 'inactive' | 'suspended',
    reason?: string
  ) => {
    try {
      setUpdatingStatusId(memberId);
      await cooperativeAPI.updateMemberStatus(memberId, status, reason);
      toast.success(`Member status updated to ${status}`);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update member status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeleteMember = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      setMemberToDelete(member);
    }
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;

    try {
      setUpdatingStatusId(memberToDelete.id);
      await cooperativeAPI.deleteMember(memberToDelete.id);
      toast.success('Member deleted successfully');
      setMemberToDelete(null);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete member');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeleteContribution = (contribution: CooperativeContribution) => {
    setContributionToDelete(contribution);
  };

  const confirmDeleteContribution = async () => {
    if (!contributionToDelete) return;

    try {
      setUpdatingStatusId(contributionToDelete.id);
      await cooperativeAPI.deleteContribution(contributionToDelete.id);
      toast.success('Contribution deleted successfully');
      setContributionToDelete(null);
      reloadDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete contribution');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Filter and search logic
  const filteredCooperatives = cooperatives.filter(coop => {
    const matchesSearch = 
      (coop.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (coop.code || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || coop.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredMembers = useMemo(() => {
    const filtered = members.filter(member => {
      const matchesSearch =
        (member.staff_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.staff_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.member_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (member.cooperative_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    // Apply pagination
    const indexOfLastMember = currentPage * membersPerPage;
    const indexOfFirstMember = indexOfLastMember - membersPerPage;
    return filtered.slice(indexOfFirstMember, indexOfLastMember);
  }, [members, searchTerm, filterStatus, currentPage, membersPerPage]);

  const totalMemberPages = Math.ceil(members.filter(member => {
    const matchesSearch =
      (member.staff_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.staff_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.member_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.cooperative_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).length / membersPerPage);

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(Math.min(Math.max(pageNumber, 1), Math.max(totalMemberPages, 1)));
  };

  const filteredContributions = contributions.filter(contrib => {
    const matchesSearch = 
      (contrib.staff_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contrib.cooperative_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contrib.contribution_month || '').includes(searchTerm);
    return matchesSearch;
  });

  if (dbError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md p-8 rounded-lg border border-border bg-card">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Database Update Required</h2>
          <p className="text-muted-foreground mb-6">
            The cooperative management system requires a database update. 
            Please refresh the page to complete the upgrade.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Cooperative Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage cooperative societies, members, and contributions
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            onClick={() => reloadDashboardData()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-accent border border-border transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="inline">Refresh</span>
          </button>
          {viewMode === 'cooperatives' && (
            <button
              onClick={() => setShowMigrationModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-accent border border-border transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="whitespace-nowrap">Migration Import</span>
            </button>
          )}
          {viewMode === 'cooperatives' && (
            <button
              onClick={() => {
                setEditingCooperative(null);
                setShowCooperativeModal(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="whitespace-nowrap">New Cooperative</span>
            </button>
          )}
          {viewMode === 'members' && (
            <button
              onClick={() => {
                setEditingMember(null);
                setShowMemberModal(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span className="whitespace-nowrap">Register Member</span>
            </button>
          )}
          {viewMode === 'contributions' && (
            <button
              onClick={() => setShowContributionModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              <Receipt className="w-4 h-4" />
              <span className="whitespace-nowrap">Record Contribution</span>
            </button>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-6 overflow-x-auto">
          {[
            { id: 'cooperatives', label: `Cooperatives (${dashboardStats.total_cooperatives || cooperatives.length})`, icon: Building2 },
            { id: 'members', label: `Members (${dashboardStats.total_members || members.length})`, icon: Users },
            { id: 'contributions', label: `Contributions (${dashboardStats.total_contribution_transactions || contributions.length})`, icon: DollarSign },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as ViewMode)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                viewMode === tab.id
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

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${viewMode}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {viewMode !== 'contributions' && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        )}
      </div>

      {/* Content based on view mode */}
      {viewMode === 'cooperatives' && (
        <CooperativesView
          cooperatives={filteredCooperatives}
          onEdit={(coop) => {
            setEditingCooperative(coop);
            setShowCooperativeModal(true);
          }}
          onViewStats={handleViewStats}
          onDistributeDividends={(coop) => {
            setSelectedCooperative(coop);
            setShowDividendModal(true);
          }}
          onDelete={handleDeleteCooperative}
        />
      )}

      {viewMode === 'members' && (
        <>
          <MembersView
            members={filteredMembers}
            onEdit={(member) => {
              setEditingMember(member);
              setShowMemberModal(true);
            }}
            onUpdateStatus={handleUpdateMemberStatus}
            onWithdraw={(member) => {
              setSelectedMember(member);
              setShowWithdrawalModal(true);
            }}
            onViewStatement={handleViewStatement}
            onDelete={handleDeleteMember}
            updatingStatusId={updatingStatusId}
          />
          {totalMemberPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:pointer-events-none text-sm transition-colors"
              >
                Previous
              </button>
              <span className="min-w-[96px] text-center text-sm text-muted-foreground">
                Page {currentPage} of {totalMemberPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalMemberPages}
                className="px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:pointer-events-none text-sm transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {viewMode === 'contributions' && (
        <ContributionsView 
          contributions={filteredContributions} 
          onDelete={handleDeleteContribution}
          updatingStatusId={updatingStatusId}
        />
      )}

      {/* Modals */}
      {showCooperativeModal && (
        <CooperativeFormModal
          cooperative={editingCooperative}
          onClose={() => {
            setShowCooperativeModal(false);
            setEditingCooperative(null);
          }}
          onSubmit={(data) => {
            if (editingCooperative) {
              handleUpdateCooperative(editingCooperative.id, data);
            } else {
              handleCreateCooperative(data as CooperativeFormData);
            }
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {showMemberModal && (
        <MemberFormModal
          member={editingMember}
          cooperatives={cooperatives.filter(c => c.status === 'active')}
          staff={allStaff}
          onClose={() => {
            setShowMemberModal(false);
            setEditingMember(null);
          }}
          onSubmit={(data) => {
            if (editingMember) {
              handleUpdateMember(editingMember.id, data);
              return;
            }
            handleRegisterMember(data);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {showContributionModal && (
        <ContributionFormModal
          cooperatives={cooperatives.filter(c => c.status === 'active')}
          members={members.filter(m => m.status === 'active')}
          onClose={() => setShowContributionModal(false)}
          onSubmit={handleRecordContribution}
          isSubmitting={isSubmitting}
        />
      )}

      {showMigrationModal && (
        <MigrationImportModal
          onClose={() => setShowMigrationModal(false)}
          onSubmit={handleImportMigration}
          isSubmitting={isSubmitting}
        />
      )}

      {showStatsModal && selectedCooperative && cooperativeStats && (
        <CooperativeStatsModal
          cooperative={selectedCooperative}
          stats={cooperativeStats}
          onClose={() => {
            setShowStatsModal(false);
            setSelectedCooperative(null);
            setCooperativeStats(null);
          }}
        />
      )}

      {showWithdrawalModal && selectedMember && (
        <WithdrawalFormModal
          member={selectedMember}
          onClose={() => {
            setShowWithdrawalModal(false);
            setSelectedMember(null);
          }}
          onSubmit={handleWithdraw}
          isSubmitting={isSubmitting}
        />
      )}

      {showDividendModal && selectedCooperative && (
        <DividendFormModal
          cooperative={selectedCooperative}
          onClose={() => {
            setShowDividendModal(false);
            setSelectedCooperative(null);
          }}
          onSubmit={handleDistributeDividends}
          isSubmitting={isSubmitting}
        />
      )}

      {showStatementModal && selectedMember && (
        <StatementModal
          member={selectedMember}
          statement={memberStatement}
          onClose={() => {
            setShowStatementModal(false);
            setSelectedMember(null);
            setMemberStatement([]);
          }}
        />
      )}

      {memberToDelete && (
        <Modal
          isOpen={!!memberToDelete}
          onClose={() => setMemberToDelete(null)}
          title="Delete Member"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong>{memberToDelete.staff_name}</strong> from <strong>{memberToDelete.cooperative_name}</strong>?
            </p>
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Warning
              </p>
              <p className="mt-1">This action cannot be undone. All contribution records will be permanently removed.</p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                disabled={updatingStatusId === memberToDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMember}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-2"
                disabled={updatingStatusId === memberToDelete.id}
              >
                {updatingStatusId === memberToDelete.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Member
              </button>
            </div>
          </div>
        </Modal>
      )}

      {cooperativeToDelete && (
        <Modal
          isOpen={!!cooperativeToDelete}
          onClose={() => setCooperativeToDelete(null)}
          title="Delete Cooperative"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete <strong>{cooperativeToDelete.name}</strong>?
            </p>
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Warning
              </p>
              <p className="mt-1">This action cannot be undone. You can only delete a cooperative if it has no members.</p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setCooperativeToDelete(null)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                disabled={updatingStatusId === cooperativeToDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCooperative}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-2"
                disabled={updatingStatusId === cooperativeToDelete.id}
              >
                {updatingStatusId === cooperativeToDelete.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Cooperative
              </button>
            </div>
          </div>
        </Modal>
      )}

      {contributionToDelete && (
        <Modal
          isOpen={!!contributionToDelete}
          onClose={() => setContributionToDelete(null)}
          title="Delete Contribution"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete this contribution of <strong>{formatCurrency(contributionToDelete.amount)}</strong>?
            </p>
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Warning
              </p>
              <p className="mt-1">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setContributionToDelete(null)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                disabled={updatingStatusId === contributionToDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteContribution}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-2"
                disabled={updatingStatusId === contributionToDelete.id}
              >
                {updatingStatusId === contributionToDelete.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Contribution
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Cooperatives View Component
function CooperativesView({
  cooperatives,
  onEdit,
  onViewStats,
  onDistributeDividends,
  onDelete,
}: {
  cooperatives: Cooperative[];
  onEdit: (coop: Cooperative) => void;
  onViewStats: (coop: Cooperative) => void;
  onDistributeDividends: (coop: Cooperative) => void;
  onDelete: (coop: Cooperative) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {cooperatives.map((coop) => (
        <div
          key={coop.id}
          className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{coop.name}</h3>
                <p className="text-sm text-muted-foreground">{coop.code}</p>
              </div>
            </div>
            <StatusBadge status={coop.status} />
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span className="text-foreground capitalize">
                {coop.cooperative_type ? coop.cooperative_type.replace('_', ' ') : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Members:</span>
              <span className="text-foreground font-medium">{coop.total_members}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Monthly Contribution:</span>
              <span className="text-foreground font-medium">
                {formatCurrency(coop.monthly_contribution_required || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Contributions:</span>
              <span className="text-foreground font-medium">
                {formatCurrency(coop.total_contributions || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Outstanding Loans:</span>
              <span className="text-foreground font-medium">
                {formatCurrency(coop.total_loans_outstanding || 0)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onViewStats(coop)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            >
              <Eye className="w-4 h-4" />
              Stats
            </button>
            <button
              onClick={() => onDistributeDividends(coop)}
              className="px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
              title="Distribute Dividends"
            >
              <PieChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(coop)}
              className="px-3 py-2 rounded-lg bg-accent hover:bg-accent/80 text-foreground transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(coop)}
              className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {cooperatives.length === 0 && (
        <div className="col-span-full text-center py-12">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No cooperatives found</p>
        </div>
      )}
    </div>
  );
}

// Members View Component
function MembersView({
  members,
  onEdit,
  onUpdateStatus,
  onWithdraw,
  onViewStatement,
  onDelete,
  updatingStatusId,
}: {
  members: CooperativeMember[];
  onEdit: (member: CooperativeMember) => void;
  onUpdateStatus: (memberId: string, status: 'active' | 'inactive' | 'suspended', reason?: string) => void;
  onWithdraw: (member: CooperativeMember) => void;
  onViewStatement: (member: CooperativeMember) => void;
  onDelete: (memberId: string) => void;
  updatingStatusId?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm">Member Number</th>
              <th className="px-4 py-3 text-left text-sm">Staff Name</th>
              <th className="px-4 py-3 text-left text-sm">Cooperative</th>
              <th className="px-4 py-3 text-left text-sm">Department</th>
              <th className="px-4 py-3 text-right text-sm">Monthly Contribution</th>
              <th className="px-4 py-3 text-right text-sm">Total Contributions</th>
              <th className="px-4 py-3 text-right text-sm">Shares</th>
              <th className="px-4 py-3 text-center text-sm">Status</th>
              <th className="px-4 py-3 text-center text-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-sm font-medium">{member.member_number}</td>
                <td className="px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{member.staff_name}</div>
                    <div className="text-xs text-muted-foreground">{member.staff_number}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{member.cooperative_name}</td>
                <td className="px-4 py-3 text-sm">{member.department}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {formatCurrency(member.monthly_contribution)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium">
                  {formatCurrency(member.total_contributions)}
                </td>
                <td className="px-4 py-3 text-sm text-right">{member.shares_owned}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={member.status} />
                </td>
                <td className="px-4 py-3 text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1 hover:bg-accent rounded"
                        title="Actions"
                        disabled={updatingStatusId === member.id}
                      >
                        {updatingStatusId === member.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(member)}>
                        <Edit className="w-4 h-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {member.status === 'active' && (
                        <DropdownMenuItem
                          onClick={() => onUpdateStatus(member.id, 'suspended', 'Admin action')}
                          disabled={updatingStatusId === member.id}
                        >
                          <XCircle className="w-4 h-4 text-orange-500" />
                          Suspend
                        </DropdownMenuItem>
                      )}
                      {member.status === 'suspended' && (
                        <DropdownMenuItem
                          onClick={() => onUpdateStatus(member.id, 'active')}
                          disabled={updatingStatusId === member.id}
                        >
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Reactivate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onWithdraw(member)}>
                        <Minus className="w-4 h-4 text-orange-500" />
                        Withdraw Funds
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewStatement(member)}>
                        <FileText className="w-4 h-4 text-blue-500" />
                        View Statement
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(member.id)}
                        disabled={updatingStatusId === member.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No members found</p>
        </div>
      )}
    </div>
  );
}

// Contributions View Component
function ContributionsView({ 
  contributions,
  onDelete,
  updatingStatusId
}: { 
  contributions: CooperativeContribution[];
  onDelete: (contribution: CooperativeContribution) => void;
  updatingStatusId?: string | null;
}) {
  const totalAmount = contributions.reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contributions</p>
              <p className="text-xl font-bold">{contributions.length}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Average Contribution</p>
              <p className="text-xl font-bold">
                {formatCurrency(contributions.length > 0 ? Math.round(totalAmount / contributions.length) : 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm">Date</th>
                <th className="px-4 py-3 text-left text-sm">Staff Name</th>
                <th className="px-4 py-3 text-left text-sm">Cooperative</th>
                <th className="px-4 py-3 text-left text-sm">Month</th>
                <th className="px-4 py-3 text-left text-sm">Type</th>
                <th className="px-4 py-3 text-left text-sm">Payment Method</th>
                <th className="px-4 py-3 text-right text-sm">Amount</th>
                <th className="px-4 py-3 text-left text-sm">Receipt #</th>
                <th className="px-4 py-3 text-center text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contributions.map((contrib) => (
                <tr key={contrib.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    {new Date(contrib.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{contrib.staff_name}</div>
                      <div className="text-xs text-muted-foreground">{contrib.staff_number}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{contrib.cooperative_name}</td>
                  <td className="px-4 py-3 text-sm">{contrib.contribution_month}</td>
                  <td className="px-4 py-3 text-sm capitalize">
                    {contrib.contribution_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">
                    {contrib.payment_method.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {formatCurrency(contrib.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm">{contrib.receipt_number || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onDelete(contrib)}
                      className="p-1 hover:bg-accent rounded text-destructive"
                      title="Delete Contribution"
                      disabled={updatingStatusId === contrib.id}
                    >
                      {updatingStatusId === contrib.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {contributions.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No contributions found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Cooperative Form Modal
function CooperativeFormModal({
  cooperative,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  cooperative: Cooperative | null;
  onClose: () => void;
  onSubmit: (data: CooperativeFormData | Partial<CooperativeFormData>) => void;
  isSubmitting?: boolean;
}) {
  const [formData, setFormData] = useState<CooperativeFormData>({
    name: cooperative?.name || '',
    code: cooperative?.code || '',
    description: cooperative?.description || '',
    registration_number: cooperative?.registration_number || '',
    date_established: cooperative?.date_established || new Date().toISOString().split('T')[0],
    cooperative_type: cooperative?.cooperative_type || 'thrift_credit',
    monthly_contribution_required: cooperative?.monthly_contribution_required || 0,
    share_capital_value: cooperative?.share_capital_value ?? '',
    minimum_shares: cooperative?.minimum_shares ?? '',
    interest_rate_on_loans: cooperative?.interest_rate_on_loans || 7,
    maximum_loan_multiplier: cooperative?.maximum_loan_multiplier || 3,
    meeting_schedule: cooperative?.meeting_schedule || '',
    chairman_name: cooperative?.chairman_name || '',
    secretary_name: cooperative?.secretary_name || '',
    treasurer_name: cooperative?.treasurer_name || '',
    contact_email: cooperative?.contact_email || '',
    contact_phone: cooperative?.contact_phone || '',
    bank_name: cooperative?.bank_name || '',
    bank_account_number: cooperative?.bank_account_number || '',
    auto_deduct_contribution: cooperative?.auto_deduct_contribution || false,
    status: cooperative?.status || 'active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={cooperative ? 'Edit Cooperative' : 'Create New Cooperative'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="font-medium">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">Cooperative Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
                maxLength={10}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-2">Registration Number</label>
              <input
                type="text"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Date Established</label>
              <input
                type="date"
                value={formData.date_established}
                onChange={(e) => setFormData({ ...formData, date_established: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Type *</label>
              <select
                value={formData.cooperative_type}
                onChange={(e) => setFormData({ ...formData, cooperative_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                {COOPERATIVE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Financial Configuration */}
        <div className="space-y-4">
          <h3 className="font-medium">Financial Configuration</h3>
          
          <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border border-border">
            <input
              type="checkbox"
              id="auto_deduct"
              checked={formData.auto_deduct_contribution}
              onChange={(e) => setFormData({ ...formData, auto_deduct_contribution: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="auto_deduct" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
              Enable Auto-Deduction from Payroll
              <p className="text-xs text-muted-foreground mt-1 font-normal">
                If enabled, monthly contributions will be automatically deducted from members' payroll.
              </p>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">Monthly Contribution Required (₦) *</label>
              <input
                type="number"
                value={formData.monthly_contribution_required}
                onChange={(e) => setFormData({ ...formData, monthly_contribution_required: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Share Capital Value (₦)</label>
              <input
                type="number"
                value={formData.share_capital_value}
                onChange={(e) => setFormData({ ...formData, share_capital_value: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Minimum Shares</label>
              <input
                type="number"
                value={formData.minimum_shares}
                onChange={(e) => setFormData({ ...formData, minimum_shares: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Interest Rate on Loans (%) *</label>
              <input
                type="number"
                value={formData.interest_rate_on_loans}
                onChange={(e) => setFormData({ ...formData, interest_rate_on_loans: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Maximum Loan Multiplier *</label>
              <input
                type="number"
                value={formData.maximum_loan_multiplier}
                onChange={(e) => setFormData({ ...formData, maximum_loan_multiplier: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
                min="1"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Meeting Schedule</label>
              <input
                type="text"
                value={formData.meeting_schedule}
                onChange={(e) => setFormData({ ...formData, meeting_schedule: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., Monthly - Last Friday"
              />
            </div>
          </div>
        </div>

        {/* Leadership */}
        <div className="space-y-4">
          <h3 className="font-medium">Leadership</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-2">Chairman Name</label>
              <input
                type="text"
                value={formData.chairman_name}
                onChange={(e) => setFormData({ ...formData, chairman_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Secretary Name</label>
              <input
                type="text"
                value={formData.secretary_name}
                onChange={(e) => setFormData({ ...formData, secretary_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Treasurer Name</label>
              <input
                type="text"
                value={formData.treasurer_name}
                onChange={(e) => setFormData({ ...formData, treasurer_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="font-medium">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">Contact Email</label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">Contact Phone</label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="space-y-4">
          <h3 className="font-medium">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2">Bank Name</label>
              <select
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select Bank</option>
                {NIGERIAN_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-2">Bank Account Number</label>
              <input
                type="text"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                maxLength={10}
              />
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm mb-2">Status *</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {cooperative ? 'Updating...' : 'Creating...'}
              </span>
            ) : (
              cooperative ? 'Update Cooperative' : 'Create Cooperative'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Member Form Modal
function MemberFormModal({
  member,
  cooperatives,
  staff,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  member?: CooperativeMember | null;
  cooperatives: Cooperative[];
  staff: Staff[];
  onClose: () => void;
  onSubmit: (data: MemberFormData) => void;
  isSubmitting?: boolean;
}) {
  const isEditing = Boolean(member);
  const [formData, setFormData] = useState<MemberFormData>(() => ({
    cooperative_id: member?.cooperative_id || '',
    staff_id: member?.staff_id || '',
    monthly_contribution: Number(member?.monthly_contribution ?? (member as any)?.monthlyContribution ?? 0),
    shares_owned: member?.shares_owned !== undefined && member?.shares_owned !== null 
      ? Number(member.shares_owned) 
      : (member as any)?.sharesOwned !== undefined && (member as any)?.sharesOwned !== null
        ? Number((member as any).sharesOwned)
        : '',
  }));
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  useEffect(() => {
    if (member) {
      setFormData({
        cooperative_id: member.cooperative_id || '',
        staff_id: member.staff_id || '',
        monthly_contribution: Number(member.monthly_contribution ?? (member as any).monthlyContribution ?? 0),
        shares_owned: member.shares_owned !== undefined && member.shares_owned !== null 
          ? Number(member.shares_owned) 
          : (member as any).sharesOwned !== undefined && (member as any).sharesOwned !== null
            ? Number((member as any).sharesOwned)
            : '',
      });
    }
  }, [member]);

  const selectedCooperative = cooperatives.find(c => c.id === formData.cooperative_id);
  const shareCapitalValue = Number(selectedCooperative?.share_capital_value || 0);
  const hasShareCapitalValue = shareCapitalValue > 0;
  const shareCount = Number(formData.shares_owned || 0);
  const shareCapitalTotal = hasShareCapitalValue ? shareCount * shareCapitalValue : 0;
  const getStaffDisplayLabel = (staff: Staff) => {
    return formatStaffLabelWithId(staff);
  };

  const filteredStaffList = useMemo(() => {
    const q = staffSearchTerm.trim().toLowerCase();
    if (!q) return staff;

    return staff.filter((s) => {
      const staffNo = (s.staff_number || '').toLowerCase();
      const label = getStaffDisplayLabel(s).toLowerCase();
      return staffNo.includes(q) || label.includes(q);
    });
  }, [staff, staffSearchTerm]);

  useEffect(() => {
    if (selectedCooperative && !isEditing) {
      setFormData(prev => ({
        ...prev,
        monthly_contribution: Number(selectedCooperative.monthly_contribution_required),
        shares_owned: hasShareCapitalValue ? (selectedCooperative.minimum_shares ?? '') : '',
      }));
    }
  }, [selectedCooperative, hasShareCapitalValue, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cooperative_id || !formData.staff_id) {
      toast.error('Please select both cooperative and staff member');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        setStaffSearchTerm('');
        onClose();
      }}
      title={member ? 'Edit Member' : 'Register New Member'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-2">Cooperative *</label>
          <select
            value={formData.cooperative_id}
            onChange={(e) => setFormData({ ...formData, cooperative_id: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            disabled={isEditing}
          >
            <option value="">Select Cooperative</option>
            {cooperatives.map((coop) => (
              <option key={coop.id} value={coop.id}>
                {coop.name} ({coop.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-2">Staff Member *</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={staffSearchTerm}
              onChange={(e) => setStaffSearchTerm(e.target.value)}
              placeholder="Search by name or staff ID..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isEditing}
            />
          </div>
          <select
            value={formData.staff_id}
            onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            disabled={isEditing}
          >
            <option value="">Select Staff</option>
            {filteredStaffList.length === 0 ? (
              <option value="" disabled>
                No staff match "{staffSearchTerm.trim()}"
              </option>
            ) : (
              filteredStaffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {getStaffDisplayLabel(s)}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-2">Monthly Contribution (₦) *</label>
          <input
            type="number"
            value={formData.monthly_contribution}
            onChange={(e) => setFormData({ ...formData, monthly_contribution: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            min="0"
          />
          {selectedCooperative && (
            <p className="text-xs text-muted-foreground mt-1">
              Minimum required: {formatCurrency(selectedCooperative.monthly_contribution_required)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm mb-2">Number of Shares</label>
          <input
            type="number"
            value={formData.shares_owned}
            onChange={(e) => setFormData({ ...formData, shares_owned: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            min="0"
          />
          {selectedCooperative && (
            <p className="text-xs text-muted-foreground mt-1">
              {hasShareCapitalValue
                ? `Minimum shares: ${selectedCooperative.minimum_shares || 0} @ ${formatCurrency(shareCapitalValue)} each = ${formatCurrency((selectedCooperative.minimum_shares || 0) * shareCapitalValue)}`
                : 'Optional. Leave blank if this cooperative has no Share Capital Value configured.'}
            </p>
          )}
        </div>

        {selectedCooperative && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="font-medium mb-2 text-sm">Initial Payment Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Share Capital:</span>
                <span>{formatCurrency(shareCapitalTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First Month Contribution:</span>
                <span>{formatCurrency(formData.monthly_contribution)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-border">
                <span>Total:</span>
                <span>{formatCurrency(shareCapitalTotal + Number(formData.monthly_contribution))}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {member ? 'Updating...' : 'Registering...'}
              </span>
            ) : (
              member ? 'Update Member' : 'Register Member'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Contribution Form Modal
function ContributionFormModal({
  cooperatives,
  members,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  cooperatives: Cooperative[];
  members: CooperativeMember[];
  onClose: () => void;
  onSubmit: (data: ContributionFormData) => void;
  isSubmitting?: boolean;
}) {
  const [formData, setFormData] = useState<ContributionFormData>({
    cooperative_id: '',
    member_id: '',
    contribution_month: new Date().toISOString().slice(0, 7),
    amount: 0,
    contribution_type: 'regular',
    payment_method: 'cash',
    receipt_number: '',
  });
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  const filteredMembers = members.filter(m => m.cooperative_id === formData.cooperative_id);
  const getMemberDisplayLabel = (m: CooperativeMember) => `${m.staff_name || 'Unknown Member'} (${m.member_number})`;
  const filteredMemberList = useMemo(() => {
    const q = memberSearchTerm.trim().toLowerCase();
    if (!q) return filteredMembers;

    return filteredMembers.filter((m) => {
      const memberNo = (m.member_number || '').toLowerCase();
      const staffNo = (m.staff_number || '').toLowerCase();
      const label = getMemberDisplayLabel(m).toLowerCase();
      return memberNo.includes(q) || staffNo.includes(q) || label.includes(q);
    });
  }, [filteredMembers, memberSearchTerm]);
  const selectedMember = members.find(m => m.id === formData.member_id);

  useEffect(() => {
    if (selectedMember && formData.contribution_type === 'regular') {
      setFormData(prev => ({
        ...prev,
        amount: selectedMember.monthly_contribution,
      }));
    }
  }, [selectedMember, formData.contribution_type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cooperative_id || !formData.member_id) {
      toast.error('Please select both cooperative and member');
      return;
    }
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        setMemberSearchTerm('');
        onClose();
      }}
      title="Record Contribution"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-2">Cooperative *</label>
          <select
            value={formData.cooperative_id}
            onChange={(e) => {
              setFormData({ ...formData, cooperative_id: e.target.value, member_id: '' });
              setMemberSearchTerm('');
            }}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          >
            <option value="">Select Cooperative</option>
            {cooperatives.map((coop) => (
              <option key={coop.id} value={coop.id}>
                {coop.name} ({coop.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-2">Member *</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={memberSearchTerm}
              onChange={(e) => setMemberSearchTerm(e.target.value)}
              placeholder="Search by name or staff/member ID..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={!formData.cooperative_id}
            />
          </div>
          <select
            value={formData.member_id}
            onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            disabled={!formData.cooperative_id}
          >
            <option value="">Select Member</option>
            {filteredMemberList.length === 0 ? (
              <option value="" disabled>
                No staff match "{memberSearchTerm.trim()}"
              </option>
            ) : (
              filteredMemberList.map((member) => (
                <option key={member.id} value={member.id}>
                  {getMemberDisplayLabel(member)}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2">Contribution Month *</label>
            <input
              type="month"
              value={formData.contribution_month}
              onChange={(e) => setFormData({ ...formData, contribution_month: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Contribution Type *</label>
            <select
              value={formData.contribution_type}
              onChange={(e) => setFormData({ ...formData, contribution_type: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              <option value="regular">Regular Monthly</option>
              <option value="voluntary">Voluntary</option>
              <option value="share_capital">Share Capital</option>
              <option value="special_levy">Special Levy</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2">Amount (₦) *</label>
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            min="0"
          />
          {selectedMember && formData.contribution_type === 'regular' && (
            <p className="text-xs text-muted-foreground mt-1">
              Regular contribution: {formatCurrency(selectedMember.monthly_contribution)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm mb-2">Payment Method *</label>
          <select
            value={formData.payment_method}
            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="payroll_deduction">Payroll Deduction</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-2">Receipt Number</label>
          <input
            type="text"
            value={formData.receipt_number}
            onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Optional"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Recording...
              </span>
            ) : (
              'Record Contribution'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Cooperative Stats Modal
function CooperativeStatsModal({
  cooperative,
  stats,
  onClose,
}: {
  cooperative: Cooperative;
  stats: any;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={true} onClose={onClose} title={`${cooperative.name} - Statistics`} size="lg">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Total Members</p>
            <p className="text-2xl font-bold">{stats.total_members}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.active_members} active
            </p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-muted-foreground mb-1">Total Contributions</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.total_contributions)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Avg: {formatCurrency(stats.average_contribution)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-muted-foreground mb-1">Loans Disbursed</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.total_loans_disbursed)}</p>
          </div>
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-sm text-muted-foreground mb-1">Outstanding Loans</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.total_outstanding)}</p>
          </div>
        </div>

        {/* Cooperative Details */}
        <div className="space-y-3">
          <h3 className="font-medium">Cooperative Details</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Code:</span>
              <span className="ml-2 font-medium">{cooperative.code}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 font-medium capitalize">
                {cooperative.cooperative_type ? cooperative.cooperative_type.replace('_', ' ') : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Monthly Contribution:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(cooperative.monthly_contribution_required || 0)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Share Value:</span>
              <span className="ml-2 font-medium">
                {formatCurrency(cooperative.share_capital_value || 0)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="ml-2 font-medium">{cooperative.interest_rate_on_loans}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Loan Multiplier:</span>
              <span className="ml-2 font-medium">{cooperative.maximum_loan_multiplier}x</span>
            </div>
          </div>
        </div>

        {/* Leadership */}
        {(cooperative.chairman_name || cooperative.secretary_name || cooperative.treasurer_name) && (
          <div className="space-y-2">
            <h3 className="font-medium">Leadership</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {cooperative.chairman_name && (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Chairman:</span>
                  <span className="font-medium">{cooperative.chairman_name}</span>
                </div>
              )}
              {cooperative.secretary_name && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Secretary:</span>
                  <span className="font-medium">{cooperative.secretary_name}</span>
                </div>
              )}
              {cooperative.treasurer_name && (
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Treasurer:</span>
                  <span className="font-medium">{cooperative.treasurer_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact & Bank Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(cooperative.contact_email || cooperative.contact_phone) && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Contact</h3>
              {cooperative.contact_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{cooperative.contact_email}</span>
                </div>
              )}
              {cooperative.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{cooperative.contact_phone}</span>
                </div>
              )}
            </div>
          )}
          {(cooperative.bank_name || cooperative.bank_account_number) && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Bank Details</h3>
              {cooperative.bank_name && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Bank:</span>
                  <span className="ml-2">{cooperative.bank_name}</span>
                </div>
              )}
              {cooperative.bank_account_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="ml-2 font-mono">{cooperative.bank_account_number}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Migration Import Modal
function MigrationImportModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (payload: any, dryRun: boolean) => Promise<any>;
  isSubmitting?: boolean;
}) {
  const samplePayload = `{
  "cooperatives": [],
  "members": [],
  "openingBalances": [],
  "contributions": [],
  "loans": [],
  "repayments": []
}`;
  const [jsonText, setJsonText] = useState(samplePayload);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(jsonText || '{}');
      const response = await onSubmit(parsed, dryRun);
      setResult(response);
    } catch (error: any) {
      toast.error(error.message || 'Invalid JSON payload');
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Migration Import" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-border p-3 bg-muted/20 text-sm">
          <p className="font-medium">Expected JSON keys</p>
          <p className="text-muted-foreground">
            Use any combination of: <code>cooperatives</code>, <code>members</code>, <code>openingBalances</code>, <code>contributions</code>, <code>loans</code>, <code>repayments</code>.
          </p>
        </div>

        <div>
          <label className="block text-sm mb-2">Migration Payload (JSON)</label>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-xs"
            placeholder={samplePayload}
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-border"
          />
          Run as dry run (validate only, no database write)
        </label>

        {result?.summary && (
          <div className="rounded-lg border border-border p-3 bg-muted/20 text-sm space-y-1">
            <p className="font-medium">Last Run Summary</p>
            <p>Cooperatives: {result.summary.cooperatives?.success || 0} success, {result.summary.cooperatives?.failed || 0} failed</p>
            <p>Members: {result.summary.members?.success || 0} success, {result.summary.members?.failed || 0} failed</p>
            <p>Opening Balances: {result.summary.openingBalances?.success || 0} success, {result.summary.openingBalances?.failed || 0} failed</p>
            <p>Contributions: {result.summary.contributions?.success || 0} success, {result.summary.contributions?.failed || 0} failed</p>
            <p>Loans: {result.summary.loans?.success || 0} success, {result.summary.loans?.failed || 0} failed</p>
            <p>Loan Repayments: {result.summary.repayments?.success || 0} success, {result.summary.repayments?.failed || 0} failed</p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Close
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : dryRun ? (
              'Run Dry Import'
            ) : (
              'Run Import'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Withdrawal Form Modal
function WithdrawalFormModal({
  member,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  member: CooperativeMember;
  onClose: () => void;
  onSubmit: (memberId: string, amount: number, reason: string) => void;
  isSubmitting?: boolean;
}) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(member.id, amount, reason);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Withdraw Funds" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-2">Member</label>
          <div className="p-3 bg-muted rounded-md text-sm">
            <p className="font-medium">{member.staff_name}</p>
            <p className="text-muted-foreground">{member.cooperative_name}</p>
            <p className="text-muted-foreground mt-1">
              Current Savings: {formatCurrency(member.total_contributions)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2">Withdrawal Amount (₦) *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            min="0"
            max={Number(member.total_contributions)}
          />
        </div>

        <div>
          <label className="block text-sm mb-2">Reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : (
              'Withdraw'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Dividend Distribution Modal
function DividendFormModal({
  cooperative,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  cooperative: Cooperative;
  onClose: () => void;
  onSubmit: (cooperativeId: string, amount: number) => void;
  isSubmitting?: boolean;
}) {
  const [amount, setAmount] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(cooperative.id, amount);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Distribute Dividends" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-2">Cooperative</label>
          <div className="p-3 bg-muted rounded-md text-sm">
            <p className="font-medium">{cooperative.name}</p>
            <p className="text-muted-foreground">
              Total Savings: {formatCurrency(cooperative.total_contributions || 0)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-2">Total Dividend Amount (₦) *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            required
            min="0"
          />
          <p className="text-xs text-muted-foreground mt-1">
            This amount will be distributed among eligible members based on their savings.
          </p>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Distributing...
              </span>
            ) : (
              'Distribute'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Member Statement Modal
function StatementModal({
  member,
  statement,
  onClose,
}: {
  member: CooperativeMember;
  statement: any[];
  onClose: () => void;
}) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Member Statement" size="lg">
      <div className="space-y-6">
        <div className="flex justify-between items-start p-4 bg-muted/50 rounded-lg">
          <div>
            <h3 className="font-medium text-lg">{member.staff_name}</h3>
            <p className="text-muted-foreground">{member.cooperative_name}</p>
            <p className="text-sm text-muted-foreground mt-1">Member #: {member.member_number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(member.total_contributions)}
            </p>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statement.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium capitalize">
                        {item.contribution_type?.replace('_', ' ') || 'Contribution'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ref: {item.receipt_number || '-'}
                      </div>
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${
                      Number(item.amount) < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(item.running_balance)}
                    </td>
                  </tr>
                ))}
                {statement.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
