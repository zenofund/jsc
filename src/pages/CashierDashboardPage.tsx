import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { payrollAPI } from '../lib/api-client';
import { PageSkeleton } from '../components/PageLoader';
import { toast } from 'sonner';
import { 
  DollarSign, CheckCircle, Clock, TrendingUp, 
  Calendar, Receipt, FileText
} from 'lucide-react';
import { formatCurrency, formatCompactCurrency } from '../utils/format';

interface PayrollBatch {
  id: string;
  batch_number: string;
  month: string;
  year: number;
  total_staff: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  status: 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'locked' | 'paid' | 'ready_for_payment';
  payment_status?: 'pending' | 'processing' | 'completed' | 'failed';
  payment_executed_by?: string;
  payment_executed_at?: string;
  payment_reference?: string;
  created_at?: string;
  updated_at?: string;
}

export function CashierDashboardPage() {
  const { user } = useAuth();
  const [pendingPayments, setPendingPayments] = useState<PayrollBatch[]>([]);
  const [recentlyPaid, setRecentlyPaid] = useState<PayrollBatch[]>([]);
  const [paidBatches, setPaidBatches] = useState<PayrollBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const pending = await payrollAPI.getPendingPayments();
      const allBatches = await payrollAPI.getAllPayrollBatches();
      const paid = allBatches
        .filter((b: PayrollBatch) => b.status === 'paid' || b.payment_status === 'completed')
        .sort((a: PayrollBatch, b: PayrollBatch) => {
          const dateA = a.payment_executed_at || a.updated_at || a.created_at;
          const dateB = b.payment_executed_at || b.updated_at || b.created_at;
          const timeA = dateA ? new Date(dateA).getTime() : 0;
          const timeB = dateB ? new Date(dateB).getTime() : 0;
          return timeB - timeA;
        })
        .slice(0, 5);
      
      setPendingPayments(pending);
      setRecentlyPaid(paid);
      setPaidBatches(allBatches.filter((b: PayrollBatch) => b.status === 'paid' || b.payment_status === 'completed'));
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentBatchJourney = (batch: PayrollBatch) => {
    try {
      sessionStorage.setItem('cashier-payment-batch-payroll-id', batch.id);
    } catch (error) {
      console.warn('Could not store the selected payroll batch for payment navigation', error);
    }
    (window as any).navigateTo?.('bank-payments');
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  const totalPendingAmount = pendingPayments.reduce((sum, batch) => sum + (batch.total_net || 0), 0);
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const paidThisMonth = paidBatches.filter(batch => {
    const batchDateValue = batch.payment_executed_at || batch.updated_at || batch.created_at;
    if (!batchDateValue) return false;
    const batchDate = new Date(batchDateValue);
    const now = new Date();
    return batchDate.getMonth() === now.getMonth() && batchDate.getFullYear() === now.getFullYear();
  });
  const totalPaidThisMonth = paidThisMonth.reduce((sum, batch) => sum + batch.total_net, 0);

  const statCards = [
    {
      title: 'Pending Payments',
      value: pendingPayments.length,
      icon: Clock,
      color: 'yellow',
      subtitle: 'Awaiting execution',
    },
    {
      title: 'Pending Amount',
      value: totalPendingAmount,
      isCurrency: true,
      icon: DollarSign,
      color: 'blue',
      subtitle: 'Total to be paid',
    },
    {
      title: 'Paid This Month',
      value: paidThisMonth.length,
      icon: CheckCircle,
      color: 'green',
      subtitle: currentMonth,
    },
    {
      title: 'Amount Paid',
      value: totalPaidThisMonth,
      isCurrency: true,
      icon: TrendingUp,
      color: 'green',
      subtitle: 'This month',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400',
    green: 'bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Cashier Dashboard' }]} />
      
      <div className="mb-4 sm:mb-6">
        <h1 className="text-foreground mb-1 sm:mb-2 text-base sm:text-lg font-semibold">Welcome back, {user?.full_name}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">Execute payments for approved payroll batches.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="min-w-0 bg-card border border-border rounded-lg p-3 sm:p-6">
              <div className="mb-2 sm:mb-4">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="min-w-0 text-[clamp(0.875rem,5vw,1.5rem)] sm:text-2xl leading-tight tracking-tight tabular-nums font-bold text-foreground">
                {(stat as any).isCurrency
                  ? formatCompactCurrency(stat.value as number).short
                  : typeof stat.value === 'number' && stat.value > 999999
                    ? Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(stat.value)
                    : typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </div>
              {!(stat as any).isCurrency && typeof stat.value === 'number' && stat.value > 999999 && (
                <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-1 break-all">{stat.value.toLocaleString()}</div>
              )}
              {(stat as any).isCurrency && typeof stat.value === 'number' && stat.value > 999999 && (
                <div className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-1 break-all">
                  {formatCompactCurrency(stat.value).full}
                </div>
              )}
              <div className="text-xs sm:text-sm text-muted-foreground mt-1 leading-tight">{stat.title}</div>
              <div className="text-[11px] sm:text-xs text-muted-foreground/80 mt-2 leading-snug line-clamp-2">{stat.subtitle}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pending Payments */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="font-semibold text-card-foreground text-base sm:text-lg">Pending Payments</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-muted-foreground">{pendingPayments.length} waiting</span>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto">
            {pendingPayments.length > 0 ? (
              pendingPayments.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/30 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-950/30 transition-colors">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-foreground text-sm sm:text-base truncate">{batch.batch_number}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{batch.month} {batch.year}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{batch.total_staff} staff</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {formatCurrency(batch.total_net)}
                    </p>
                    <button
                      onClick={() => openPaymentBatchJourney(batch)}
                      className="mt-2 px-3 py-1.5 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded text-xs sm:text-sm transition-colors"
                    >
                      Open Payment Batches
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-green-500 dark:text-green-400" />
                <p className="text-sm">No pending payments</p>
                <p className="text-xs mt-1">All payrolls have been processed</p>
              </div>
            )}
          </div>
        </div>

        {/* Recently Paid */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <h3 className="font-semibold text-card-foreground mb-3 sm:mb-4 text-base sm:text-lg">Recently Paid</h3>
          <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto">
            {recentlyPaid.length > 0 ? (
              recentlyPaid.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground text-sm sm:text-base truncate">{batch.batch_number}</p>
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{batch.month} {batch.year}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Receipt className="w-3 h-3 text-muted-foreground/70" />
                      <p className="text-xs text-muted-foreground truncate">{batch.payment_reference}</p>
                    </div>
                    {batch.payment_executed_at && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {new Date(batch.payment_executed_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={batch.status} />
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {formatCurrency(batch.total_net)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">No payment history</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 sm:mt-6 bg-card border border-border rounded-lg p-4 sm:p-6">
        <h3 className="font-semibold text-card-foreground mb-3 sm:mb-4 text-base sm:text-lg">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          <button 
            onClick={() => (window as any).navigateTo?.('reports')}
            className="flex items-center gap-3 p-3 sm:p-4 bg-accent/10 dark:bg-accent/20 hover:bg-accent/20 dark:hover:bg-accent/30 active:bg-accent/30 dark:active:bg-accent/40 rounded-lg transition-colors">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">Payment Reports</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">View analytics</p>
            </div>
          </button>

          <button 
            onClick={() => (window as any).navigateTo?.('payslips')}
            className="flex items-center gap-3 p-3 sm:p-4 bg-muted/50 hover:bg-muted active:bg-muted/80 rounded-lg transition-colors">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-muted-foreground/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-medium text-foreground text-sm sm:text-base">View Payslips</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Check distributions</p>
            </div>
          </button>
        </div>
      </div>

    </div>
  );
}
