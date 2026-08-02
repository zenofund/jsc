const viewAliases = new Map<string, string>([
  ['/', 'dashboard'],
  ['/dashboard', 'dashboard'],
  ['/hr-dashboard', 'hr-dashboard'],
  ['/hr', 'hr-dashboard'],
  ['/cashier-dashboard', 'cashier-dashboard'],
  ['/cashier', 'cashier-dashboard'],
  ['/staff', 'staff'],
  ['/staff-list', 'staff'],
  ['/staff-portal', 'staff-portal'],
  ['/staff/request-status', 'staff-request-status'],
  ['/staff-request-status', 'staff-request-status'],
  ['/staff/requests', 'staff-requests'],
  ['/staff-requests', 'staff-requests'],
  ['/payroll', 'payroll'],
  ['/promotions', 'promotions'],
  ['/promotion', 'promotions'],
  ['/promtion', 'promotions'],
  ['/arrears', 'arrears'],
  ['/approvals', 'approvals'],
  ['/approval', 'approvals'],
  ['/payslips', 'payslips'],
  ['/payslip', 'payslips'],
  ['/reports', 'reports'],
  ['/setup', 'setup'],
  ['/payroll-setup', 'setup'],
  ['/admin', 'admin'],
  ['/loan-management', 'loan-management'],
  ['/loan', 'loan-management'],
  ['/loans', 'loan-management'],
  ['/department-management', 'department-management'],
  ['/departments', 'department-management'],
  ['/staff-allowances', 'staff-allowances'],
  ['/staff-adjustments', 'staff-allowances'],
  ['/adjustments', 'staff-allowances'],
  ['/staff-adjustment-approvals', 'staff-adjustment-approvals'],
  ['/adjustment-approvals', 'staff-adjustment-approvals'],
  ['/leave-management', 'leave-management'],
  ['/leave', 'leave-management'],
  ['/bank-payments', 'bank-payments'],
  ['/bank-payment', 'bank-payments'],
  ['/e-mandate', 'bank-payments'],
  ['/emandate', 'bank-payments'],
  ['/notifications', 'notifications'],
  ['/notification', 'notifications'],
  ['/cooperative-reports', 'cooperative-reports'],
  ['/coop-reports', 'cooperative-reports'],
  ['/cooperative-management', 'cooperative-management'],
  ['/cooperative', 'cooperative-management'],
  ['/custom-report-builder', 'custom-report-builder'],
  ['/report-builder', 'custom-report-builder'],
  ['/reports-list', 'reports-list'],
  ['/smtp-settings', 'smtp-settings'],
  ['/change-password', 'change-password'],
  ['/audit-log', 'audit-log'],
  ['/audit', 'audit-log'],
  ['/tax-configuration', 'tax-configuration'],
  ['/tax-config', 'tax-configuration'],
]);

const isAbsoluteUrl = (value: string) => /^[a-z][a-z0-9+.-]*:/i.test(value);

const normalizePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '') || '/';
};

export const resolveNotificationNavigationTarget = (rawLink?: string | null) => {
  const link = String(rawLink || '').trim();
  if (!link) {
    return { type: 'none' as const };
  }

  let normalizedPath = '';
  let externalHref = '';

  if (isAbsoluteUrl(link)) {
    try {
      const parsed = new URL(link);
      if (parsed.origin !== window.location.origin) {
        return { type: 'external' as const, href: parsed.toString() };
      }
      normalizedPath = normalizePath(parsed.pathname);
      externalHref = parsed.toString();
    } catch {
      return { type: 'external' as const, href: link };
    }
  } else {
    try {
      const parsed = new URL(link, window.location.origin);
      normalizedPath = normalizePath(parsed.pathname);
      externalHref = parsed.toString();
    } catch {
      normalizedPath = normalizePath(link);
      externalHref = link;
    }
  }

  const normalizedKey = normalizedPath.toLowerCase();
  const matchedView = viewAliases.get(normalizedKey);
  if (matchedView) {
    return { type: 'internal' as const, view: matchedView };
  }

  return { type: 'external' as const, href: externalHref };
};

export const navigateFromNotificationLink = (rawLink?: string | null) => {
  const target = resolveNotificationNavigationTarget(rawLink);

  if (target.type === 'internal') {
    (window as any).navigateTo?.(target.view);
    return true;
  }

  if (target.type === 'external') {
    window.location.href = target.href;
    return true;
  }

  return false;
};
