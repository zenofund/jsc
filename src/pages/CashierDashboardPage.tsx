import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';
import { DashboardMetricCard } from '../components/DashboardMetricCard';
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
      tone: 'yellow',
      description: 'Awaiting execution',
    },
    {
      title: 'Pending Amount',
      value: totalPendingAmount,
      isCurrency: true,
      icon: DollarSign,
      tone: 'blue',
      description: 'Total to be paid',
    },
    {
      title: 'Paid This Month',
      value: paidThisMonth.length,
      icon: CheckCircle,
      tone: 'green',
      description: currentMonth,
    },
    {
      title: 'Amount Paid',
      value: totalPaidThisMonth,
      isCurrency: true,
      icon: TrendingUp,
      tone: 'green',
      description: 'This month',
    },
  ] as const;

  return (
    <div className="space-y-5 sm:space-y-7">
      <Breadcrumb items={[{ label: 'Cashier Dashboard' }]} />
      
      <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-900 to-green-800 px-5 py-6 shadow-lg shadow-green-950/10 sm:px-8 sm:py-8">
        <div aria-hidden="true" className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Payment operations</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Welcome back, {user?.full_name || 'there'}</h1>
            <p className="mt-2 text-sm text-green-50/80 sm:text-base">Execute approved payroll payments and track recent disbursements.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white">
            <Calendar className="h-4 w-4 text-emerald-200" />
            {currentMonth}
          </span>
        </div>
      </section>

      <section aria-label="Payment snapshot">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">Payment snapshot</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Current queue and completed payment totals.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {statCards.map((stat) => (
            <DashboardMetricCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              tone={stat.tone}
              format={'isCurrency' in stat && stat.isCurrency ? (value) => formatCompactCurrency(value).short : undefined}
              detail={'isCurrency' in stat && stat.isCurrency && stat.value > 999999 ? formatCurrency(stat.value) : undefined}
            />
          ))}
        </div>
      </section>

      {pendingPayments.length > 0 && (
        <button
          onClick={() => openPaymentBatchJourney(pendingPayments[0])}
          className="flex w-full items-center justify-between gap-4 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{pendingPayments.length} payroll {pendingPayments.length === 1 ? 'batch' : 'batches'} ready for payment</span>
              <span className="block text-sm text-muted-foreground">Pending total: {formatCurrency(totalPendingAmount)}</span>
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-amber-800 dark:text-amber-200">Open queue</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-6">
        {/* Pending Payments */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-card-foreground sm:text-lg">Pending payments</h3>
              <p className="mt-1 text-sm text-muted-foreground">Approved payrolls awaiting execution.</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${pendingPayments.length > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'}`}>
              {pendingPayments.length} waiting
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto">
            {pendingPayments.length > 0 ? (
              pendingPayments.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 transition-colors hover:bg-amber-100/70 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 sm:p-4">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="font-medium text-foreground text-sm sm:text-base truncate">{batch.batch_number}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{batch.month} {batch.year} · {batch.total_staff} staff</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-foreground text-sm sm:text-base">{formatCurrency(batch.total_net)}</p>
                    <button
                      onClick={() => openPaymentBatchJourney(batch)}
                      className="mt-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:text-sm"
                    >
                      Open payment
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-foreground">Payment queue is clear</p>
                <p className="mt-1 text-xs text-muted-foreground">No approved payrolls are waiting for payment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recently Paid */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-card-foreground sm:text-lg">Recently paid</h3>
            <p className="mt-1 text-sm text-muted-foreground">Latest completed payroll disbursements.</p>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto">
            {recentlyPaid.length > 0 ? (
              recentlyPaid.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 sm:p-4">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-foreground text-sm sm:text-base truncate">{batch.batch_number}</p>
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{batch.month} {batch.year}</p>
                    {batch.payment_executed_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Paid {new Date(batch.payment_executed_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={batch.status} />
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">{formatCurrency(batch.total_net)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <FileText className="mx-auto mb-2 h-10 w-10 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No payment history yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Completed payroll payments will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-card-foreground sm:text-lg">Quick actions</h3>
          <p className="mt-1 text-sm text-muted-foreground">Payment reports and staff payslips.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          <button 
            onClick={() => (window as any).navigateTo?.('reports')}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-colors hover:bg-muted active:bg-muted/80 sm:p-4">
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
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left transition-colors hover:bg-muted active:bg-muted/80 sm:p-4">
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
