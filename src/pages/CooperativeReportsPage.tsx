import React, { useState, useEffect } from 'react';
import {
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  DollarSign, 
  FileText, 
  Download, 
  Filter,
  RefreshCw,
  Building2,
  Wallet,
  CreditCard
} from 'lucide-react';
import { formatCompactCurrency, formatCurrency } from '../utils/format';
import { PageSkeleton } from '../components/PageLoader';
import { cooperativeAPI, disbursementAPI } from '../lib/loanAPI';
import type { Cooperative, CooperativeMember, CooperativeContribution, LoanDisbursement } from '../types/entities';

type ReportType = 'overview' | 'contributions' | 'loans' | 'members' | 'financial' | 'cross-cooperative';

export function CooperativeReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('overview');
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);
  const [selectedCooperative, setSelectedCooperative] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCooperatives();
  }, []);

  const loadCooperatives = async () => {
    try {
      setLoading(true);
      const coops = await cooperativeAPI.getAll({ status: 'active' });
      setCooperatives(coops);
    } catch (error) {
      console.error('Error loading cooperatives:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  const reportTabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'contributions', label: 'Contributions', icon: DollarSign },
    { id: 'loans', label: 'Loans', icon: FileText },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'financial', label: 'Financial Statements', icon: BarChart3 },
    { id: 'cross-cooperative', label: 'Cross-Cooperative Analysis', icon: PieChart },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">Cooperative Reports</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Comprehensive reporting and analytics for all cooperative societies
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            onClick={loadCooperatives}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-accent border border-border transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-2 text-card-foreground">Cooperative</label>
            <select
              value={selectedCooperative}
              onChange={(e) => setSelectedCooperative(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Cooperatives</option>
              {cooperatives.map((coop) => (
                <option key={coop.id} value={coop.id}>
                  {coop.name} ({coop.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-2 text-card-foreground">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-card-foreground">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4 overflow-x-auto">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as ReportType)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeReport === tab.id
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

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading reports...</div>
      ) : (
        <>
          {activeReport === 'overview' && (
            <OverviewReport cooperatives={cooperatives} selectedCooperativeId={selectedCooperative} />
          )}
          {activeReport === 'contributions' && (
            <ContributionsReport cooperatives={cooperatives} selectedCooperativeId={selectedCooperative} dateRange={dateRange} />
          )}
          {activeReport === 'loans' && (
            <LoansReport cooperatives={cooperatives} selectedCooperativeId={selectedCooperative} dateRange={dateRange} />
          )}
          {activeReport === 'members' && (
            <MembersReport cooperatives={cooperatives} selectedCooperativeId={selectedCooperative} />
          )}
          {activeReport === 'financial' && (
            <FinancialReport cooperatives={cooperatives} selectedCooperativeId={selectedCooperative} dateRange={dateRange} />
          )}
          {activeReport === 'cross-cooperative' && (
            <CrossCooperativeReport cooperatives={cooperatives} />
          )}
        </>
      )}
    </div>
  );
}

// Overview Report Component
function OverviewReport({ cooperatives, selectedCooperativeId }: { cooperatives: Cooperative[]; selectedCooperativeId: string }) {
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, [cooperatives, selectedCooperativeId]);

  const loadStats = async () => {
    try {
      const coopsToAnalyze = selectedCooperativeId === 'all' 
        ? cooperatives 
        : cooperatives.filter(c => c.id === selectedCooperativeId);

      const statsPromises = coopsToAnalyze.map(coop => cooperativeAPI.getCooperativeStats(coop.id));
      const results = await Promise.all(statsPromises);
      setStats(results);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const totalStats = stats.reduce((acc, stat) => ({
    total_members: acc.total_members + (stat?.total_members || 0),
    active_members: acc.active_members + (stat?.active_members || 0),
    total_contributions: acc.total_contributions + (stat?.total_contributions || 0),
    total_loans_disbursed: acc.total_loans_disbursed + (stat?.total_loans_disbursed || 0),
    total_outstanding: acc.total_outstanding + (stat?.total_outstanding || 0),
    total_share_capital: acc.total_share_capital + (stat?.total_share_capital || 0),
  }), {
    total_members: 0,
    active_members: 0,
    total_contributions: 0,
    total_loans_disbursed: 0,
    total_outstanding: 0,
    total_share_capital: 0,
  });

  return (
    <div className="space-y-6">
      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold text-card-foreground">{totalStats.total_members.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{totalStats.active_members} active members</p>
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contributions</p>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-card-foreground">{formatCompactCurrency(totalStats.total_contributions).short}</span>
                <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(totalStats.total_contributions).full}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Share Capital</p>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-card-foreground">{formatCompactCurrency(totalStats.total_share_capital).short}</span>
                <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(totalStats.total_share_capital).full}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Loans Disbursed</p>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-card-foreground">{formatCompactCurrency(totalStats.total_loans_disbursed).short}</span>
                <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(totalStats.total_loans_disbursed).full}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <DollarSign className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-card-foreground">{formatCompactCurrency(totalStats.total_outstanding).short}</span>
                <span className="text-xs text-muted-foreground font-mono">{formatCompactCurrency(totalStats.total_outstanding).full}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Cooperatives</p>
              <p className="text-2xl font-bold text-card-foreground">{cooperatives.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Cooperative Stats */}
      <div className="space-y-4">
        <h2 className="text-lg text-card-foreground">Cooperative Breakdown</h2>
        <div className="grid grid-cols-1 gap-4">
          {stats.map((stat) => (
            <div key={stat?.cooperative?.id || Math.random()} className="p-4 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-card-foreground">{stat?.cooperative?.name || 'Unknown'}</h3>
                    <p className="text-sm text-muted-foreground">{stat?.cooperative?.code || 'N/A'} • {stat?.cooperative?.cooperative_type || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Members</p>
                  <p className="text-sm text-card-foreground">{stat?.active_members || 0}/{stat?.total_members || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contributions</p>
                  <p className="text-sm text-card-foreground">{formatCurrency(stat?.total_contributions)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Share Capital</p>
                  <p className="text-sm text-card-foreground">{formatCurrency(stat?.total_share_capital)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Loans Disbursed</p>
                  <p className="text-sm text-card-foreground">{formatCurrency(stat?.total_loans_disbursed)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                  <p className="text-sm text-card-foreground">{formatCurrency(stat?.total_outstanding)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Contributions Report Component
function ContributionsReport({ 
  cooperatives, 
  selectedCooperativeId,
  dateRange 
}: { 
  cooperatives: Cooperative[]; 
  selectedCooperativeId: string;
  dateRange: { from: string; to: string };
}) {
  const [contributions, setContributions] = useState<CooperativeContribution[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadContributions();
  }, [selectedCooperativeId, dateRange]);

  const loadContributions = async () => {
    try {
      const filters: any = {};
      if (selectedCooperativeId !== 'all') {
        filters.cooperative_id = selectedCooperativeId;
      }

      let allContributions = await cooperativeAPI.getContributions(filters);
      
      // Filter by date range
      allContributions = allContributions.filter((c: CooperativeContribution) => {
        const contributionDate = new Date(c.payment_date);
        return contributionDate >= new Date(dateRange.from) && contributionDate <= new Date(dateRange.to);
      });

      setContributions(allContributions);

      // Calculate summary
      const totalAmount = allContributions.reduce((sum: number, c: CooperativeContribution) => sum + c.amount, 0);
      const byType = allContributions.reduce((acc: any, c: CooperativeContribution) => {
        acc[c.contribution_type] = (acc[c.contribution_type] || 0) + c.amount;
        return acc;
      }, {});

      setSummary({
        total_amount: totalAmount,
        total_count: allContributions.length,
        by_type: byType,
        by_cooperative: allContributions.reduce((acc: any, c: any) => {
          acc[c.cooperative_name] = (acc[c.cooperative_name] || 0) + c.amount;
          return acc;
        }, {}),
      });
    } catch (error) {
      console.error('Error loading contributions:', error);
    }
  };

  if (!summary) return <div className="text-center py-12 text-muted-foreground">Loading contributions...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Contributions</p>
          <p className="text-2xl text-card-foreground">₦{summary.total_amount.toLocaleString()}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Number of Contributions</p>
          <p className="text-2xl text-card-foreground">{summary.total_count}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Regular Contributions</p>
          <p className="text-2xl text-card-foreground">₦{(summary.by_type.regular || 0).toLocaleString()}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Share Capital</p>
          <p className="text-2xl text-card-foreground">₦{(summary.by_type.share_capital || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Contributions by Cooperative */}
      {selectedCooperativeId === 'all' && (
        <div className="p-6 rounded-lg border border-border bg-card">
          <h3 className="text-lg mb-4 text-card-foreground">Contributions by Cooperative</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_cooperative).map(([name, amount]: [string, any]) => (
              <div key={name} className="flex items-center justify-between p-3 rounded bg-muted">
                <span className="text-sm text-card-foreground">{name}</span>
                <span className="text-card-foreground">₦{amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contributions Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg text-card-foreground">Contribution Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Member</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Cooperative</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Payment Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contributions.slice(0, 50).map((contribution) => (
                <tr key={contribution.id} className="hover:bg-accent transition-colors">
                  <td className="px-6 py-4 text-sm text-card-foreground">
                    {new Date(contribution.payment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-card-foreground">{contribution.staff_name}</div>
                    <div className="text-xs text-muted-foreground">{contribution.staff_number}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-card-foreground">{contribution.cooperative_name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                      {contribution.contribution_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-card-foreground">
                    ₦{contribution.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-card-foreground">
                    {contribution.payment_method.replace('_', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {contributions.length > 50 && (
          <div className="p-4 text-center text-sm text-muted-foreground border-t border-border">
            Showing 50 of {contributions.length} contributions
          </div>
        )}
      </div>
    </div>
  );
}

// Loans Report Component
function LoansReport({ 
  cooperatives, 
  selectedCooperativeId,
  dateRange 
}: { 
  cooperatives: Cooperative[]; 
  selectedCooperativeId: string;
  dateRange: { from: string; to: string };
}) {
  const [loans, setLoans] = useState<LoanDisbursement[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadLoans();
  }, [selectedCooperativeId, dateRange]);

  const loadLoans = async () => {
    try {
      // Fetch all disbursements from API
      let allLoans = await disbursementAPI.getAll();
      
      // Filter by cooperative if selected
      if (selectedCooperativeId !== 'all') {
        allLoans = allLoans.filter((l: any) => l.cooperative_id === selectedCooperativeId);
      } else {
        // Only show loans linked to cooperatives
        allLoans = allLoans.filter((l: any) => l.cooperative_id);
      }

      // Filter by date
      allLoans = allLoans.filter((l: any) => {
        const loanDate = new Date(l.disbursement_date);
        return loanDate >= new Date(dateRange.from) && loanDate <= new Date(dateRange.to);
      });

      setLoans(allLoans);

      // Calculate summary
      const totalDisbursed = allLoans.reduce((sum: any, l: any) => sum + l.principal_amount, 0);
      const totalOutstanding = allLoans.reduce((sum: any, l: any) => sum + l.balance_outstanding, 0);
      const totalRepaid = allLoans.reduce((sum: any, l: any) => sum + l.total_repaid, 0);

      setSummary({
        total_count: allLoans.length,
        total_disbursed: totalDisbursed,
        total_outstanding: totalOutstanding,
        total_repaid: totalRepaid,
        by_cooperative: allLoans.reduce((acc: any, l: any) => {
          const key = l.cooperative_name || 'Unknown';
          if (!acc[key]) {
            acc[key] = { count: 0, disbursed: 0, outstanding: 0 };
          }
          acc[key].count++;
          acc[key].disbursed += l.principal_amount;
          acc[key].outstanding += l.balance_outstanding;
          return acc;
        }, {}),
      });
    } catch (error) {
      console.error('Error loading loans:', error);
    }
  };

  if (!summary) return <div className="text-center py-12 text-muted-foreground">Loading loans...</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Loans</p>
          <p className="text-2xl text-card-foreground">{summary.total_count}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Disbursed</p>
          <p className="text-2xl text-card-foreground">₦{summary.total_disbursed.toLocaleString()}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Repaid</p>
          <p className="text-2xl text-card-foreground">₦{summary.total_repaid.toLocaleString()}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
          <p className="text-2xl text-card-foreground">₦{summary.total_outstanding.toLocaleString()}</p>
        </div>
      </div>

      {/* Loans by Cooperative */}
      {selectedCooperativeId === 'all' && Object.keys(summary.by_cooperative).length > 0 && (
        <div className="p-6 rounded-lg border border-border bg-card">
          <h3 className="text-lg mb-4 text-card-foreground">Loans by Cooperative</h3>
          <div className="space-y-2">
            {Object.entries(summary.by_cooperative).map(([name, data]: [string, any]) => (
              <div key={name} className="p-3 rounded bg-muted">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-card-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground">{data.count} loans</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Disbursed: </span>
                    <span className="text-card-foreground">₦{data.disbursed.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Outstanding: </span>
                    <span className="text-card-foreground">₦{data.outstanding.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loans Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg text-card-foreground">Loan Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Staff</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Cooperative</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Disbursed</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Repaid</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Outstanding</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loans.slice(0, 50).map((loan) => (
                <tr key={loan.id} className="hover:bg-accent transition-colors">
                  <td className="px-6 py-4 text-sm text-card-foreground">
                    {new Date(loan.disbursement_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-card-foreground">{loan.staff_name}</div>
                    <div className="text-xs text-muted-foreground">{loan.staff_number}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-card-foreground">{loan.cooperative_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-right text-sm text-card-foreground">
                    ₦{loan.principal_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-card-foreground">
                    ₦{loan.total_repaid.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-card-foreground">
                    ₦{loan.balance_outstanding.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      loan.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      loan.status === 'active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {loan.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loans.length > 50 && (
          <div className="p-4 text-center text-sm text-muted-foreground border-t border-border">
            Showing 50 of {loans.length} loans
          </div>
        )}
      </div>
    </div>
  );
}

// Members Report Component
function MembersReport({ cooperatives, selectedCooperativeId }: { cooperatives: Cooperative[]; selectedCooperativeId: string }) {
  const [members, setMembers] = useState<CooperativeMember[]>([]);

  useEffect(() => {
    loadMembers();
  }, [selectedCooperativeId]);

  const loadMembers = async () => {
    try {
      const filters: any = {};
      if (selectedCooperativeId !== 'all') {
        filters.cooperative_id = selectedCooperativeId;
      }
      const allMembers = await cooperativeAPI.getAllMembers(filters);
      setMembers(allMembers);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const inactiveMembers = members.filter(m => m.status === 'inactive');
  const suspendedMembers = members.filter(m => m.status === 'suspended');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Members</p>
          <p className="text-2xl text-card-foreground">{members.length}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Active Members</p>
          <p className="text-2xl text-green-600 dark:text-green-400">{activeMembers.length}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Inactive Members</p>
          <p className="text-2xl text-gray-600 dark:text-gray-400">{inactiveMembers.length}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Suspended Members</p>
          <p className="text-2xl text-red-600 dark:text-red-400">{suspendedMembers.length}</p>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg text-card-foreground">Member Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Member #</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Staff Name</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Cooperative</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Monthly Contribution</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Total Contributions</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Shares</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-accent transition-colors">
                  <td className="px-6 py-4 text-sm text-card-foreground">{member.member_number}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-card-foreground">{member.staff_name}</div>
                    <div className="text-xs text-muted-foreground">{member.staff_number}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-card-foreground">{member.cooperative_name}</td>
                  <td className="px-6 py-4 text-right text-sm text-card-foreground">
                    ₦{member.monthly_contribution.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-card-foreground">
                    ₦{member.total_contributions.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-card-foreground">{member.shares_owned}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      member.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      member.status === 'inactive' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Financial Report Component
function FinancialReport({ 
  cooperatives, 
  selectedCooperativeId,
  dateRange 
}: { 
  cooperatives: Cooperative[]; 
  selectedCooperativeId: string;
  dateRange: { from: string; to: string };
}) {
  return (
    <div className="space-y-6">
      <div className="p-12 rounded-lg border border-border bg-card text-center">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg mb-2 text-card-foreground">Financial Statements</h3>
        <p className="text-muted-foreground">
          Comprehensive financial statements including balance sheets, income statements, 
          and cash flow reports will be available here.
        </p>
      </div>
    </div>
  );
}

// Cross-Cooperative Analysis Component
function CrossCooperativeReport({ cooperatives }: { cooperatives: Cooperative[] }) {
  const [staffMemberships, setStaffMemberships] = useState<Map<string, CooperativeMember[]>>(new Map());

  useEffect(() => {
    loadCrossCooperativeData();
  }, []);

  const loadCrossCooperativeData = async () => {
    try {
      const allMembers = await cooperativeAPI.getAllMembers();
      
      // Group by staff_id
      const membershipMap = new Map<string, CooperativeMember[]>();
      allMembers.forEach((member: CooperativeMember) => {
        const existing = membershipMap.get(member.staff_id) || [];
        membershipMap.set(member.staff_id, [...existing, member]);
      });

      setStaffMemberships(membershipMap);
    } catch (error) {
      console.error('Error loading cross-cooperative data:', error);
    }
  };

  // Calculate stats
  const multiCooperativeStaff = Array.from(staffMemberships.entries()).filter(([_, memberships]) => memberships.length > 1);
  const maxMemberships = Math.max(...Array.from(staffMemberships.values()).map(m => m.length), 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total Unique Staff</p>
          <p className="text-2xl text-card-foreground">{staffMemberships.size}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Multi-Cooperative Members</p>
          <p className="text-2xl text-card-foreground">{multiCooperativeStaff.length}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Max Cooperatives per Staff</p>
          <p className="text-2xl text-card-foreground">{maxMemberships}</p>
        </div>
      </div>

      {/* Multi-Cooperative Members */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg text-card-foreground">Staff with Multiple Cooperative Memberships</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Staff Name</th>
                <th className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Cooperatives</th>
                <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Cooperative Names</th>
                <th className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Total Monthly Deduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {multiCooperativeStaff.map(([staffId, memberships]) => {
                const totalMonthly = memberships.reduce((sum, m) => sum + m.monthly_contribution, 0);
                return (
                  <tr key={staffId} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-card-foreground">{memberships[0].staff_name}</div>
                      <div className="text-xs text-muted-foreground">{memberships[0].staff_number}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-sm">
                        {memberships.length} cooperatives
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {memberships.map(m => (
                          <div key={m.id} className="text-xs text-muted-foreground">
                            • {m.cooperative_name} (₦{m.monthly_contribution.toLocaleString()}/month)
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-card-foreground">
                      ₦{totalMonthly.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
