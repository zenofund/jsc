import React, { useEffect, useState } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageSkeleton } from '../components/PageLoader';
import { StatusBadge } from '../components/StatusBadge';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
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
      value: stats.active_cooperatives,
      icon: Building2,
      tone: 'blue',
      description: `${stats.total_cooperatives} total registered`,
    },
    {
      title: 'Active Members',
      value: stats.active_members,
      icon: Users,
      tone: 'green',
      description: `${stats.total_members} total memberships`,
    },
    {
      title: 'Savings Pool',
      value: stats.total_contributions,
      icon: DollarSign,
      tone: 'green',
      description: 'Total cooperative contributions',
      isCurrency: true,
    },
    {
      title: 'Contribution Entries',
      value: stats.total_contribution_transactions,
      icon: TrendingUp,
      tone: 'yellow',
      description: 'Recorded contribution transactions',
    },
    {
      title: 'Active Loans',
      value: loanManagementEnabled ? loanMetrics.activeLoans : 0,
      icon: Wallet,
      tone: 'purple',
      description: loanManagementEnabled ? 'Currently active disbursements' : 'Loan module is currently off',
    },
    {
      title: 'Outstanding Balance',
      value: loanManagementEnabled ? loanMetrics.outstandingBalance : 0,
      icon: FileText,
      tone: 'red',
      description: loanManagementEnabled ? 'Across all active and historical loans' : 'Activate loan module to track loans',
      isCurrency: true,
    },
  ] as const;

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

  const maxCooperativeContributions = Math.max(
    0,
    ...topCooperatives.map((cooperative: any) => toNumber(cooperative?.total_contributions)),
  );

  return (
    <div className="space-y-5 sm:space-y-7">
      <Breadcrumb items={[{ label: 'Cooperative Dashboard' }]} />

      <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-900 to-green-800 px-5 py-6 shadow-lg shadow-green-950/10 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Cooperative portfolio</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Welcome back, {user?.full_name || 'there'}</h1>
            <p className="mt-2 max-w-2xl text-sm text-green-50/80 sm:text-base">
              Savings, membership, and loan activity across your cooperative portfolio.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white">
            <Building2 className="h-4 w-4 text-emerald-200" />
            Portfolio overview
          </span>
        </div>
      </section>

      <section aria-label="Cooperative portfolio snapshot">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Portfolio snapshot</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Membership, savings, and lending at a glance.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
          {statCards.map((stat) => (
            <DashboardMetricCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              tone={stat.tone}
              format={'isCurrency' in stat && stat.isCurrency ? (value) => formatCompactCurrency(value).short : undefined}
              detail={'isCurrency' in stat && stat.isCurrency && stat.value > 999999 ? formatCompactCurrency(stat.value).full : undefined}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Top cooperatives by savings</h2>
              <p className="mt-1 text-sm text-muted-foreground">Contribution totals for active societies.</p>
            </div>
            <Building2 className="w-5 h-5 text-muted-foreground" />
          </div>
          {cooperativeManagementEnabled ? (
            topCooperatives.length > 0 ? (
              <div className="space-y-3">
                {topCooperatives.map((cooperative: any) => (
                  <div key={cooperative.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
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
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">Savings relative to top society</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {maxCooperativeContributions > 0
                            ? `${Math.round((toNumber(cooperative.total_contributions) / maxCooperativeContributions) * 100)}%`
                            : '0%'}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${maxCooperativeContributions > 0
                              ? (toNumber(cooperative.total_contributions) / maxCooperativeContributions) * 100
                              : 0}%`,
                          }}
                        />
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

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Recent loan activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">Latest disbursements and outstanding balances.</p>
            </div>
            <Wallet className="w-5 h-5 text-muted-foreground" />
          </div>
          {loanManagementEnabled ? (
            recentDisbursements.length > 0 ? (
              <div className="space-y-3">
                {recentDisbursements.map((loan: any) => (
                  <div key={loan.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Module status</h2>
              <p className="mt-1 text-sm text-muted-foreground">Features currently enabled for this portfolio.</p>
            </div>
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

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Quick actions</h2>
              <p className="mt-1 text-sm text-muted-foreground">Jump into cooperative and lending operations.</p>
            </div>
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
                  className={`flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
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
