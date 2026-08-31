import React, { useEffect, useState } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageSkeleton } from '../components/PageLoader';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { cooperativeAPI, disbursementAPI } from '../lib/loanAPI';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import {
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

type CooperativeStats = {
  total_cooperatives: number;
  active_cooperatives: number;
  total_members: number;
  active_members: number;
  total_contributions: number;
  total_contribution_transactions: number;
};

const emptyStats: CooperativeStats = {
  total_cooperatives: 0,
  active_cooperatives: 0,
  total_members: 0,
  active_members: 0,
  total_contributions: 0,
  total_contribution_transactions: 0,
};

const toNumber = (value: unknown) => Number(value || 0);

export function CooperativeDashboardPage() {
  const { user } = useAuth();
  const { loanManagementEnabled, cooperativeManagementEnabled } = useSystemSettings();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CooperativeStats>(emptyStats);
  const [topCooperatives, setTopCooperatives] = useState<any[]>([]);
  const [recentDisbursements, setRecentDisbursements] = useState<any[]>([]);
  const [loanMetrics, setLoanMetrics] = useState({
    activeLoans: 0,
    outstandingBalance: 0,
    totalDisbursed: 0,
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);

        const [cooperativeStats, cooperatives, disbursements] = await Promise.all([
          cooperativeManagementEnabled ? cooperativeAPI.getCooperativeStats('') : Promise.resolve(emptyStats),
          cooperativeManagementEnabled ? cooperativeAPI.getAll({ status: 'active' }) : Promise.resolve([]),
          loanManagementEnabled ? disbursementAPI.getAll() : Promise.resolve([]),
        ]);

        setStats({
          total_cooperatives: toNumber((cooperativeStats as any)?.total_cooperatives),
          active_cooperatives: toNumber((cooperativeStats as any)?.active_cooperatives),
          total_members: toNumber((cooperativeStats as any)?.total_members),
          active_members: toNumber((cooperativeStats as any)?.active_members),
          total_contributions: toNumber((cooperativeStats as any)?.total_contributions),
          total_contribution_transactions: toNumber((cooperativeStats as any)?.total_contribution_transactions),
        });

        const rankedCooperatives = (Array.isArray(cooperatives) ? cooperatives : [])
          .sort((a: any, b: any) => {
            const contributionDelta = toNumber(b?.total_contributions) - toNumber(a?.total_contributions);
            if (contributionDelta !== 0) return contributionDelta;
            return toNumber(b?.total_members) - toNumber(a?.total_members);
          })
          .slice(0, 5);
        setTopCooperatives(rankedCooperatives);

        const latestDisbursements = (Array.isArray(disbursements) ? disbursements : [])
          .sort((a: any, b: any) => {
            const aDate = new Date(a?.disbursement_date || a?.created_at || 0).getTime();
            const bDate = new Date(b?.disbursement_date || b?.created_at || 0).getTime();
            return bDate - aDate;
          })
          .slice(0, 5);
        setRecentDisbursements(latestDisbursements);

        const fullDisbursementList = Array.isArray(disbursements) ? disbursements : [];
        setLoanMetrics({
          activeLoans: fullDisbursementList.filter((item: any) => item?.status === 'active').length,
          outstandingBalance: fullDisbursementList.reduce(
            (sum: number, item: any) => sum + toNumber(item?.balance_outstanding),
            0,
          ),
          totalDisbursed: fullDisbursementList.reduce(
            (sum: number, item: any) => sum + toNumber(item?.amount_disbursed ?? item?.principal_amount),
            0,
          ),
        });
      } catch (error) {
        console.error('Error loading cooperative dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [cooperativeManagementEnabled, loanManagementEnabled]);

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  const statCards = [
    {
      title: 'Active Cooperatives',
      value: stats.active_cooperatives || stats.total_cooperatives,
      icon: Building2,
      color: 'blue',
      subtitle: `${stats.total_cooperatives} total registered`,
    },
    {
      title: 'Active Members',
      value: stats.active_members || stats.total_members,
      icon: Users,
      color: 'green',
      subtitle: `${stats.total_members} total memberships`,
    },
    {
      title: 'Savings Pool',
      value: stats.total_contributions,
      icon: DollarSign,
      color: 'emerald',
      subtitle: 'Total cooperative contributions',
      isCurrency: true,
    },
    {
      title: 'Contribution Entries',
      value: stats.total_contribution_transactions,
      icon: TrendingUp,
      color: 'yellow',
      subtitle: 'Recorded contribution transactions',
    },
    {
      title: 'Active Loans',
      value: loanManagementEnabled ? loanMetrics.activeLoans : 0,
      icon: Wallet,
      color: 'purple',
      subtitle: loanManagementEnabled ? 'Currently active disbursements' : 'Loan module is currently off',
    },
    {
      title: 'Outstanding Balance',
      value: loanManagementEnabled ? loanMetrics.outstandingBalance : 0,
      icon: FileText,
      color: 'rose',
      subtitle: loanManagementEnabled ? 'Across all active and historical loans' : 'Activate loan module to track loans',
      isCurrency: true,
    },
  ];

  type StatCard = (typeof statCards)[number];

  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
    rose: 'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400',
  } as const;

  const quickActions = [
    {
      label: 'Cooperative Management',
      description: 'Manage societies, members, and contributions',
      icon: Building2,
      view: 'cooperative-management',
      enabled: cooperativeManagementEnabled,
    },
    {
      label: 'Loan Management',
      description: 'Review disbursements and loan operations',
      icon: Wallet,
      view: 'loan-management',
      enabled: loanManagementEnabled,
    },
    {
      label: 'Cooperative Reports',
      description: 'Review savings and performance reports',
      icon: FileText,
      view: 'cooperative-reports',
      enabled: cooperativeManagementEnabled,
    },
    {
      label: 'Module Activation',
      description: 'Turn cooperative and loan modules on or off',
      icon: Settings,
      view: 'admin',
      enabled: true,
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Cooperative Dashboard' }]} />

      <div className="mb-4 sm:mb-6">
        <h1 className="text-foreground mb-1 sm:mb-2 text-base sm:text-lg font-semibold">
          Welcome back, {user?.full_name}
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Here is your cooperative portfolio snapshot, with savings, membership, and loan activity front and center.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        {statCards.map((stat: StatCard) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-card border border-border rounded-lg p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-10 h-10 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col">
                    <span className="text-xl sm:text-2xl font-bold text-foreground">
                      {stat.isCurrency
                        ? formatCompactCurrency(stat.value).short
                        : stat.value.toLocaleString()}
                    </span>
                    {stat.isCurrency && stat.value > 999999 && (
                      <span className="text-xs text-muted-foreground font-mono mt-0.5">
                        {formatCompactCurrency(stat.value).full}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.title}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground/80 mt-2 ml-14">{stat.subtitle}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Top Cooperatives</h2>
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
          {cooperativeManagementEnabled ? (
            topCooperatives.length > 0 ? (
              <div className="space-y-3">
                {topCooperatives.map((cooperative: any) => (
                  <div key={cooperative.id} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{cooperative.name}</p>
                        <p className="text-xs text-muted-foreground">{cooperative.code}</p>
                      </div>
                      <StatusBadge status={cooperative.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Members</p>
                        <p className="font-semibold text-foreground">{toNumber(cooperative.total_members).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Savings</p>
                        <p className="font-semibold text-foreground">{formatCurrency(toNumber(cooperative.total_contributions))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Loans Disbursed</p>
                        <p className="font-semibold text-foreground">{formatCurrency(toNumber(cooperative.total_loans_disbursed))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Outstanding</p>
                        <p className="font-semibold text-foreground">{formatCurrency(toNumber(cooperative.total_loans_outstanding))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No active cooperatives yet.
              </p>
            )
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <XCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Cooperative module is off</p>
              <p className="text-xs text-muted-foreground mt-1">
                Turn it on from Module Activation to view cooperative portfolio metrics here.
              </p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Loan Activity</h2>
            <Wallet className="w-5 h-5 text-muted-foreground" />
          </div>
          {loanManagementEnabled ? (
            recentDisbursements.length > 0 ? (
              <div className="space-y-3">
                {recentDisbursements.map((loan: any) => (
                  <div key={loan.id} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{loan.staff_name || 'Unknown staff'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {loan.loan_type_name || 'Loan'} {loan.disbursement_number ? `• ${loan.disbursement_number}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={loan.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Disbursed</p>
                        <p className="font-semibold text-foreground">
                          {formatCurrency(toNumber(loan.amount_disbursed ?? loan.principal_amount))}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Outstanding</p>
                        <p className="font-semibold text-foreground">{formatCurrency(toNumber(loan.balance_outstanding))}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No loan disbursements found yet.
              </p>
            )
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <XCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Loan module is off</p>
              <p className="text-xs text-muted-foreground mt-1">
                Activate the loan module to track disbursements and outstanding balances here.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Module Status</h2>
            <Settings className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium text-foreground">Cooperative Management</p>
                <p className="text-xs text-muted-foreground">Savings, members, and cooperative operations</p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${cooperativeManagementEnabled ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'}`}>
                {cooperativeManagementEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {cooperativeManagementEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium text-foreground">Loan Management</p>
                <p className="text-xs text-muted-foreground">Applications, disbursements, and repayment monitoring</p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${loanManagementEnabled ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'}`}>
                {loanManagementEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {loanManagementEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => action.enabled && (window as any).navigateTo?.(action.view)}
                  disabled={!action.enabled}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    action.enabled
                      ? 'border-border bg-background hover:bg-muted'
                      : 'border-border bg-muted/30 opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
