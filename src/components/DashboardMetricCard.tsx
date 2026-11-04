import type { LucideIcon } from 'lucide-react';

type DashboardMetricCardProps = {
  title: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'yellow' | 'red' | 'green' | 'purple';
  format?: (value: number) => string;
  detail?: string;
};

const toneClasses = {
  blue: {
    accent: 'bg-blue-500',
    icon: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  },
  yellow: {
    accent: 'bg-amber-500',
    icon: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  red: {
    accent: 'bg-rose-500',
    icon: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  },
  green: {
    accent: 'bg-emerald-600',
    icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  purple: {
    accent: 'bg-violet-500',
    icon: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  },
} as const;

function formatMetric(value: number | string, formatter?: (value: number) => string) {
  if (typeof value !== 'number') return value;
  if (formatter) return formatter(value);
  if (value > 999999) {
    return Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }
  return value.toLocaleString();
}

export function DashboardMetricCard({ title, value, description, icon: Icon, tone, format, detail }: DashboardMetricCardProps) {
  const styles = toneClasses[tone];

  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="text-[clamp(1.5rem,4vw,2rem)] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {formatMetric(value, format)}
      </p>
      {(detail || (typeof value === 'number' && value > 999999)) && (
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {detail || (typeof value === 'number' ? value.toLocaleString() : value)}
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
