import React, { useState, useEffect, useMemo } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import { DataTable } from '../../components/DataTable';
import { auditAPI, departmentAPI, payrollAPI, promotionAPI, staffAPI, userAPI } from '../../lib/api-client';
import { cooperativeAPI, loanApplicationAPI, loanTypeAPI } from '../../lib/loanAPI';
import { PageSkeleton } from '../../components/PageLoader';
import { Search, Filter, RefreshCw, Clock } from 'lucide-react';
import { Modal } from '../../components/Modal';

interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  entity: string;
  entity_id: string;
  description?: string;
  old_values?: any;
  new_values?: any;
  ip_address: string;
  created_at: string;
}

interface ResolvedEntityInfo {
  kind: string;
  label: string;
  data: any;
  details: Array<{ label: string; value: string }>;
}

export function AuditLogPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [resolvedEntity, setResolvedEntity] = useState<ResolvedEntityInfo | null>(null);
  const [resolvingEntity, setResolvingEntity] = useState(false);
  const [dateRangeMode, setDateRangeMode] = useState<string>('recent');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const formatEntity = (value: string) => {
    const clean = String(value || '').replace(/_/g, ' ').toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };
  
  const truncateId = (id?: string) => (id ? id.slice(0, 8) + '…' : '');

  const toDisplayCase = (value?: string) => {
    const raw = String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .trim();
    if (!raw) return '';
    return raw
      .split(/\s+/)
      .map((part) => {
        const lower = part.toLowerCase();
        if (lower === 'id') return 'ID';
        if (lower === 'api') return 'API';
        if (lower === 'hr') return 'HR';
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const formatRole = (value?: string) => {
    const role = String(value || '').trim().toLowerCase();
    if (!role) return '-';
    if (role === 'cpo') return 'CPO';
    if (role === 'hr_manager') return 'HR Manager';
    if (role === 'payroll_officer') return 'Payroll Officer';
    if (role === 'payroll_loader') return 'Payroll Loader';
    return toDisplayCase(role);
  };

  const isUuidLike = (value?: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const getRawFriendlyLabel = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (isUuidLike(text)) return truncateId(text);
    return text;
  };

  const inferEntityKind = (log: AuditLog) => {
    const entity = String(log.entity || '').trim().toLowerCase();
    const description = String(log.description || '').trim().toLowerCase();
    const snapshot = getEntitySnapshot(log);
    const snapshotKeys = Object.keys(snapshot).map((key) => key.toLowerCase());

    if (description.includes('/cooperatives/members/')) return 'cooperative_member';
    if (description.includes('/cooperatives/contributions')) return 'cooperative_contribution';
    if (description.includes('/cooperatives/')) return 'cooperative';
    if (description.includes('/promotions/')) return 'promotion';
    if (description.includes('/loans/applications/')) return 'loan_application';
    if (description.includes('/loans/types/')) return 'loan_type';
    if (description.includes('/staff/')) return 'staff';
    if (description.includes('/departments/')) return 'department';
    if (description.includes('/users/')) return 'user';
    if (description.includes('/payroll/batches/')) return 'payroll';

    if (snapshotKeys.includes('member_number') || snapshotKeys.includes('monthly_contribution')) {
      return 'cooperative_member';
    }
    if (
      snapshotKeys.includes('staff_id') &&
      (snapshotKeys.includes('cooperative_id') ||
        entity === 'cooperatives' ||
        entity === 'cooperative') &&
      (snapshotKeys.includes('join_date') ||
        snapshotKeys.includes('shares_owned') ||
        snapshotKeys.includes('registration_fee_amount') ||
        snapshotKeys.includes('annual_subscription_amount'))
    ) {
      return 'cooperative_member';
    }
    if (snapshotKeys.includes('contribution_month') || snapshotKeys.includes('contribution_type')) {
      return 'cooperative_contribution';
    }
    if (
      snapshotKeys.includes('new_grade_level') ||
      snapshotKeys.includes('new_step') ||
      snapshotKeys.includes('promotion_type') ||
      snapshotKeys.includes('effective_date') ||
      snapshotKeys.includes('promotion_date')
    ) {
      return 'promotion';
    }

    if (entity === 'cooperatives' || entity === 'cooperative') return 'cooperative';
    if (entity === 'promotions' || entity === 'promotion') return 'promotion';
    if (entity === 'departments' || entity === 'department') return 'department';
    if (entity === 'staff' || entity === 'staffs' || entity === 'employees') return 'staff';
    if (entity === 'users' || entity === 'user') return 'user';
    if (entity === 'payroll' || entity === 'payroll_batch' || entity === 'payroll_batches') return 'payroll';
    if (entity === 'loan_application' || entity === 'loan_applications') return 'loan_application';
    if (entity === 'loan_type' || entity === 'loan_types') return 'loan_type';
    if (entity === 'cooperative_member' || entity === 'cooperative_members' || entity === 'member' || entity === 'members') {
      return 'cooperative_member';
    }

    return entity || 'record';
  };

  const getRecordTypeLabel = (log: AuditLog) => {
    const kind = inferEntityKind(log);
    if (kind === 'promotion') return 'Promotion';
    if (kind === 'cooperative_member') return 'Cooperative Membership';
    if (kind === 'cooperative_contribution') return 'Cooperative Contribution';
    if (kind === 'loan_application') return 'Loan Application';
    if (kind === 'loan_type') return 'Loan Type';
    if (kind === 'payroll') return 'Payroll Batch';
    if (kind === 'user') return 'User Account';
    if (kind === 'staff') return 'Staff Record';
    if (kind === 'department') return 'Department';
    if (kind === 'cooperative') return 'Cooperative';
    return formatEntity(kind);
  };

  const normalizeFieldKey = (field: string) =>
    String(field || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .replace(/__+/g, '_')
      .trim()
      .toLowerCase();

  const FIELD_ALIASES: Record<string, string> = {
    cooperativeid: 'cooperative_id',
    cooperative_id: 'cooperative_id',
    cooperativename: 'cooperative_name',
    cooperative_name: 'cooperative_name',
    monthlycontribution: 'monthly_contribution',
    monthly_contribution: 'monthly_contribution',
    registrationfeeamount: 'registration_fee_amount',
    registration_fee_amount: 'registration_fee_amount',
    annualsubscriptionamount: 'annual_subscription_amount',
    annual_subscription_amount: 'annual_subscription_amount',
    sharesowned: 'shares_owned',
    shares_owned: 'shares_owned',
    totalcontributions: 'total_contributions',
    total_contributions: 'total_contributions',
    totalsharecapital: 'total_share_capital',
    total_share_capital: 'total_share_capital',
    totalloanstaken: 'total_loans_taken',
    total_loans_taken: 'total_loans_taken',
    totalloansrepaid: 'total_loans_repaid',
    total_loans_repaid: 'total_loans_repaid',
    outstandingloanbalance: 'outstanding_loan_balance',
    outstanding_loan_balance: 'outstanding_loan_balance',
    dividendearned: 'dividend_earned',
    dividend_earned: 'dividend_earned',
    staffid: 'staff_id',
    staff_id: 'staff_id',
    staffname: 'staff_name',
    staff_name: 'staff_name',
    staffnumber: 'staff_number',
    staff_number: 'staff_number',
    membernumber: 'member_number',
    member_number: 'member_number',
    joindate: 'join_date',
    join_date: 'join_date',
    exitdate: 'exit_date',
    exit_date: 'exit_date',
    createdby: 'created_by',
    created_by: 'created_by',
    updatedby: 'updated_by',
    updated_by: 'updated_by',
    departmentid: 'department_id',
    department_id: 'department_id',
    loantypeid: 'loan_type_id',
    loan_type_id: 'loan_type_id',
    loanapplicationid: 'loan_application_id',
    loan_application_id: 'loan_application_id',
    payrollbatchid: 'payroll_batch_id',
    payroll_batch_id: 'payroll_batch_id',
  };

  const getCanonicalFieldName = (field: string) => {
    const normalized = normalizeFieldKey(field);
    const compact = normalized.replace(/_/g, '');
    return FIELD_ALIASES[normalized] || FIELD_ALIASES[compact] || normalized;
  };

  const getCanonicalObject = (value: any) => {
    const source = normalizeAuditObject(value);
    const canonical: Record<string, any> = {};
    Object.entries(source).forEach(([rawKey, rawValue]) => {
      const key = getCanonicalFieldName(rawKey);
      if (!(key in canonical)) {
        canonical[key] = rawValue;
      }
    });
    return canonical;
  };

  const isBlankValue = (value: any) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
  };

  const getComparableValue = (field: string, value: any): any => {
    if (isBlankValue(value)) return null;

    if (typeof value === 'number') return Number(value);
    if (typeof value === 'boolean') return value;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (!Number.isNaN(Number(trimmed)) && (isMoneyField(field) || /^-?\d+(\.\d+)?$/.test(trimmed))) {
        return Number(trimmed);
      }

      if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(trimmed)) {
        const date = new Date(trimmed);
        if (!Number.isNaN(date.getTime())) return date.getTime();
      }

      return trimmed.toLowerCase();
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const areEquivalentValues = (field: string, before: any, after: any) =>
    getComparableValue(field, before) === getComparableValue(field, after);

  const hiddenChangeFields = new Set([
    'id',
    'created_by',
    'updated_by',
    'approved_by',
    'rejected_by',
    'created_at',
    'updated_at',
    'approval_date',
    'approval_remarks',
    'ip_address',
    'password',
    'password_hash',
    'staff_number',
    'member_number',
    'department',
    'staff_name',
    'cooperative_name',
    'dividend_earned',
    'total_loans_taken',
    'total_loans_repaid',
    'outstanding_loan_balance',
    'total_contributions',
    'total_share_capital',
  ]);

  const getBusinessNote = (log: AuditLog, resolved?: ResolvedEntityInfo | null) => {
    const action = String(log.action || '').trim().toLowerCase();
    const target = getTargetDisplayName(log, resolved);
    const recordType = getRecordTypeLabel(log).toLowerCase();

    if (inferEntityKind(log) === 'promotion') {
      const source = resolved?.data || getEntitySnapshot(log);
      const staffName = String(source?.staff_name || getPersonName(source) || '').trim();
      const nextLevel = formatGradeStep(source?.new_grade_level, source?.new_step);
      const effectiveDate = source?.effective_date || source?.promotion_date;
      const effectiveLabel = effectiveDate ? formatTimestampWAT(String(effectiveDate)).date : '';
      const detailParts = [nextLevel, effectiveLabel && effectiveLabel !== '-' ? `effective ${effectiveLabel}` : ''].filter(Boolean);

      if (action === 'create') return `${staffName || 'A staff member'} was submitted for promotion${detailParts.length ? ` ${detailParts.join(', ')}` : ''}.`;
      if (action === 'approve') return `${staffName || 'The staff member'}'s promotion was approved${detailParts.length ? ` ${detailParts.join(', ')}` : ''}.`;
      if (action === 'reject') return `${staffName || 'The staff member'}'s promotion was rejected.`;
    }

    if (action === 'create') return `${target} was created.`;
    if (action === 'update') return `${target} was updated.`;
    if (action === 'delete') return `${target} was removed.`;
    if (action === 'approve') return `${target} was approved.`;
    if (action === 'reject') return `${target} was rejected.`;
    if (action === 'login') return `The user signed into their account.`;
    if (action === 'logout') return `The user signed out of their account.`;
    return `${toDisplayCase(action) || 'This'} action was recorded for this ${recordType}.`;
  };

  const getRawSystemNote = (log: AuditLog) => {
    const raw = String(log.description || '').trim();
    if (!raw) return 'No technical note was recorded.';
    return raw;
  };

  const normalizeAuditObject = (val: any) => {
    if (!val) return {};
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return typeof parsed === 'object' && parsed ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  };

  const formatTimestamp = (value?: string) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) {
      return { iso: '-', local: '-' };
    }
    const iso = d.toISOString();
    const local = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(d);
    return { iso, local };
  };

  const formatTimestampWAT = (value?: string) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) {
      return { date: '-', time: '-', full: '-' };
    }

    const date = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      timeZone: 'Africa/Lagos',
    }).format(d);

    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Lagos',
    }).format(d);

    return { date, time: `${time} WAT`, full: `${date} ${time} WAT` };
  };

  const formatIpAddress = (value?: string) => {
    const ip = String(value || '').trim();
    if (!ip) return '-';
    if (ip === '::1' || ip === '127.0.0.1') return 'Localhost';
    return ip;
  };

  const getPersonName = (record: any) => {
    if (!record || typeof record !== 'object') return '';
    const direct = String(record.full_name || record.name || record.staff_name || '').trim();
    if (direct) return direct;

    const flat = [record.first_name, record.middle_name, record.last_name].filter(Boolean).join(' ').trim();
    if (flat) return flat;

    const bio = record.bio_data;
    if (bio && typeof bio === 'object') {
      return [bio.first_name, bio.middle_name, bio.last_name].filter(Boolean).join(' ').trim();
    }

    return '';
  };

  const getEntitySnapshot = (log: AuditLog) => {
    const newObj = getCanonicalObject(log.new_values);
    const oldObj = getCanonicalObject(log.old_values);
    return Object.keys(newObj).length > 0 ? newObj : oldObj;
  };

  const getSnapshotLabel = (log: AuditLog) => {
    const snapshot = getEntitySnapshot(log);
    const entity = inferEntityKind(log);

    const directCandidates = [
      snapshot.name,
      snapshot.title,
      snapshot.full_name,
      snapshot.staff_name,
      snapshot.batch_number,
      snapshot.reference_number,
      snapshot.email,
      snapshot.code,
    ]
      .map((value) => getRawFriendlyLabel(value))
      .filter(Boolean);

    if (entity === 'staff' || entity === 'staffs' || entity === 'employees') {
      const staffName = getPersonName(snapshot);
      if (staffName) return staffName;
    }

    if (entity === 'department') {
      const name = getRawFriendlyLabel(snapshot.name);
      if (name) {
        return /department$/i.test(name) ? name : `${name} Department`;
      }
    }

    if (entity === 'payroll') {
      const batchNumber = getRawFriendlyLabel(snapshot.batch_number);
      if (batchNumber) return `Payroll Batch ${batchNumber}`;
      const month = getRawFriendlyLabel(snapshot.month);
      if (month) return `Payroll for ${month}`;
    }

    if (entity === 'cooperative_member') {
      const staffName = getRawFriendlyLabel(snapshot.staff_name) || getPersonName(snapshot);
      const cooperativeName = getRawFriendlyLabel(snapshot.cooperative_name);
      if (staffName && cooperativeName) return `${staffName} in ${cooperativeName}`;
      if (staffName) return `${staffName}'s membership`;
    }

    if (entity === 'cooperative') {
      const cooperativeName = getRawFriendlyLabel(snapshot.name || snapshot.cooperative_name);
      if (cooperativeName) return cooperativeName;
    }

    if (entity === 'promotion') {
      const staffName = getRawFriendlyLabel(snapshot.staff_name);
      if (staffName) return `Promotion for ${staffName}`;
    }

    if (entity === 'loan_application') {
      const reference = getRawFriendlyLabel(snapshot.reference_number);
      if (reference) return `Loan Application ${reference}`;
      const staffName = getRawFriendlyLabel(snapshot.staff_name);
      if (staffName) return `${staffName}'s loan application`;
    }

    if (directCandidates[0]) return directCandidates[0];
    return '';
  };

  const getFieldLabel = (field: string) => {
    const canonical = getCanonicalFieldName(field);
    const map: Record<string, string> = {
      id: 'Record ID',
      status: 'Status',
      name: 'Name',
      title: 'Title',
      code: 'Code',
      description: 'Description',
      email: 'Email Address',
      phone: 'Phone Number',
      role: 'Role',
      user_id: 'User',
      staff_id: 'Staff Member',
      department_id: 'Department',
      cooperative_id: 'Cooperative',
      member_id: 'Membership',
      loan_type_id: 'Loan Type',
      loan_application_id: 'Loan Application',
      batch_id: 'Payroll Batch',
      payroll_batch_id: 'Payroll Batch',
      created_by: 'Created By',
      updated_by: 'Updated By',
      approved_by: 'Approved By',
      rejected_by: 'Rejected By',
      amount: 'Amount',
      amount_requested: 'Requested Amount',
      amount_approved: 'Approved Amount',
      monthly_contribution: 'Monthly Contribution',
      shares_owned: 'Shares Owned',
      registration_fee_amount: 'Registration Fee',
      annual_subscription_amount: 'Annual Subscription',
      total_amount: 'Total Amount',
      total_gross: 'Total Gross',
      total_deductions: 'Total Deductions',
      total_net: 'Total Net Pay',
      balance_outstanding: 'Outstanding Balance',
      current_approval_stage: 'Approval Stage',
      payment_status: 'Payment Status',
      payment_method: 'Payment Method',
      month: 'Month',
      start_date: 'Start Date',
      end_date: 'End Date',
      join_date: 'Join Date',
      exit_date: 'Exit Date',
      reason: 'Reason',
      remarks: 'Remarks',
      reference_number: 'Reference Number',
      batch_number: 'Batch Number',
      must_change_password: 'Force Password Change',
      old_allowances: 'Previous Allowances',
      new_allowances: 'Updated Allowances',
      old_deductions: 'Previous Deductions',
      new_deductions: 'Updated Deductions',
      old_grade_level: 'Previous Grade Level',
      old_step: 'Previous Step',
      old_basic_salary: 'Previous Basic Salary',
      new_grade_level: 'New Grade Level',
      new_step: 'New Step',
      new_basic_salary: 'New Basic Salary',
      effective_date: 'Effective Date',
      promotion_date: 'Promotion Date',
      promotion_type: 'Promotion Type',
      rejection_reason: 'Rejection Reason',
    };
    return map[canonical] || toDisplayCase(canonical);
  };

  const isMoneyField = (field: string) =>
    /(amount|salary|gross|net|balance|fee|contribution|deduction|payment)/i.test(field);

  const isAdjustmentCollection = (value: any) =>
    Boolean(
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Array.isArray((value as any).items),
    );

  const summarizeAdjustmentCollection = (value: any) => {
    const items = Array.isArray(value?.items) ? value.items : [];
    const total =
      typeof value?.total === 'number'
        ? value.total
        : items.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0);

    if (items.length === 0) {
      return `No items, total ${formatMoney(Number(total || 0))}`;
    }

    const preview = items
      .slice(0, 3)
      .map((item: any) => {
        const name = String(item?.name || item?.code || 'Item').trim();
        const amount = Number(item?.amount || 0);
        return `${name} ${formatMoney(amount)}`;
      })
      .join('; ');

    const moreCount = items.length - 3;
    const suffix = moreCount > 0 ? `; plus ${moreCount} more` : '';
    return `${items.length} item${items.length === 1 ? '' : 's'}, total ${formatMoney(Number(total || 0))}: ${preview}${suffix}`;
  };

  const formatGradeStep = (gradeLevel: any, step: any) => {
    const grade = String(gradeLevel ?? '').trim();
    const stepText = String(step ?? '').trim();
    if (grade && stepText) return `GL ${grade} Step ${stepText}`;
    if (grade) return `GL ${grade}`;
    if (stepText) return `Step ${stepText}`;
    return '';
  };

  const describePromotionTarget = (record: any) => {
    const staffName = String(record?.staff_name || '').trim();
    const nextLevel = formatGradeStep(record?.new_grade_level, record?.new_step);
    const effectiveDate = record?.effective_date || record?.promotion_date;
    const effectiveLabel = effectiveDate ? formatTimestampWAT(String(effectiveDate)).date : '';

    const parts = [
      staffName ? `for ${staffName}` : '',
      nextLevel ? `to ${nextLevel}` : '',
      effectiveLabel && effectiveLabel !== '-' ? `effective ${effectiveLabel}` : '',
    ].filter(Boolean);

    return parts.length > 0 ? `Promotion ${parts.join(' ')}` : 'Promotion';
  };

  const buildPromotionNarrative = (log: AuditLog, resolved?: ResolvedEntityInfo | null) => {
    const source = resolved?.data || getEntitySnapshot(log);
    const actor = String(log.user_name || log.user_email || log.user_id || 'A user').trim() || 'A user';
    const action = String(log.action || '').trim().toLowerCase();
    const staffName = String(source?.staff_name || getPersonName(source) || '').trim() || 'a staff member';
    const previousLevel = formatGradeStep(source?.old_grade_level, source?.old_step);
    const nextLevel = formatGradeStep(source?.new_grade_level, source?.new_step);
    const effectiveDate = source?.effective_date || source?.promotion_date;
    const effectiveLabel = effectiveDate ? formatTimestampWAT(String(effectiveDate)).date : '';
    const promotionType = String(source?.promotion_type || '').trim();
    const time = formatTimestampWAT(log.created_at).time;

    const details = [
      nextLevel ? `to ${nextLevel}` : '',
      effectiveLabel && effectiveLabel !== '-' ? `effective ${effectiveLabel}` : '',
      promotionType ? `as a ${toDisplayCase(promotionType)} promotion` : '',
    ].filter(Boolean).join(' ');

    if (action === 'create') {
      return `${actor} created a promotion request for ${staffName}${details ? ` ${details}` : ''} at ${time}.`;
    }
    if (action === 'approve') {
      return `${actor} approved ${staffName}'s promotion${details ? ` ${details}` : ''} at ${time}.`;
    }
    if (action === 'reject') {
      return `${actor} rejected ${staffName}'s promotion${details ? ` ${details}` : ''} at ${time}.`;
    }
    if (action === 'update') {
      const changeText =
        previousLevel && nextLevel
          ? ` from ${previousLevel} to ${nextLevel}`
          : nextLevel
            ? ` to ${nextLevel}`
            : '';
      return `${actor} updated ${staffName}'s promotion${changeText}${effectiveLabel && effectiveLabel !== '-' ? ` effective ${effectiveLabel}` : ''} at ${time}.`;
    }
    return `${actor} recorded a promotion for ${staffName}${details ? ` ${details}` : ''} at ${time}.`;
  };

  const getFriendlyReferenceValue = (field: string, value: any, resolved?: ResolvedEntityInfo | null) => {
    const canonical = getCanonicalFieldName(field);
    if (canonical === 'department_id' && resolved?.kind === 'department') return resolved.label;
    if (canonical === 'cooperative_id' && resolved?.kind === 'cooperative') return resolved.label;
    if (canonical === 'cooperative_id' && resolved?.kind === 'cooperative_member') {
      return String(resolved.data?.cooperative_name || resolved.label || '').trim();
    }
    if (canonical === 'member_id' && resolved?.kind === 'cooperative_member') return resolved.label;
    if (canonical === 'loan_application_id' && resolved?.kind === 'loan_application') return resolved.label;
    if (canonical === 'loan_type_id' && resolved?.kind === 'loan_type') return resolved.label;
    if (canonical === 'staff_id' && resolved?.kind === 'cooperative_member') {
      return String(resolved.data?.staff_name || '').trim();
    }
    if ((canonical === 'staff_id' || canonical === 'user_id') && (resolved?.kind === 'staff' || resolved?.kind === 'user')) {
      return resolved.label;
    }
    if (canonical === 'staff_name' && resolved?.kind === 'cooperative_member') {
      return String(resolved.data?.staff_name || '').trim();
    }
    return '';
  };

  const formatFriendlyValue = (field: string, value: any, resolved?: ResolvedEntityInfo | null): string => {
    const canonical = getCanonicalFieldName(field);
    if (value === null || value === undefined || value === '') return 'Not set';

    const referenced = getFriendlyReferenceValue(canonical, value, resolved);
    if (referenced) return referenced;

    if (
      canonical === 'old_allowances' ||
      canonical === 'new_allowances' ||
      canonical === 'old_deductions' ||
      canonical === 'new_deductions' ||
      isAdjustmentCollection(value)
    ) {
      return summarizeAdjustmentCollection(value);
    }

    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (typeof value === 'number') {
      if (isMoneyField(canonical)) return formatMoney(value);
      return Number.isInteger(value) ? value.toLocaleString('en-NG') : String(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return 'Not set';

      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const stamp = formatTimestampWAT(trimmed);
        return stamp.full !== '-' ? stamp.full : trimmed;
      }

      if (canonical === 'status' || canonical === 'payment_status' || canonical === 'role' || canonical === 'payment_method') {
        return canonical === 'role' ? formatRole(trimmed) : toDisplayCase(trimmed);
      }

      if (isMoneyField(canonical) && !Number.isNaN(Number(trimmed))) {
        return formatMoney(Number(trimmed));
      }

      if (canonical.endsWith('_id')) {
        return isUuidLike(trimmed) ? truncateId(trimmed) : trimmed;
      }

      return trimmed.length > 220 ? trimmed.slice(0, 220) + '…' : trimmed;
    }

    if (Array.isArray(value)) {
      const items: string[] = value.map((item) => formatFriendlyValue(canonical, item, resolved));
      return items.length > 0 ? items.join(', ') : 'None';
    }

    try {
      const json = JSON.stringify(value);
      return json.length > 220 ? json.slice(0, 220) + '…' : json;
    } catch {
      return String(value);
    }
  };

  const formatTechnicalValue = (v: any) => {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) {
          return d.toISOString();
        }
      }
      return v.length > 220 ? v.slice(0, 220) + '…' : v;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      const json = JSON.stringify(v);
      return json.length > 220 ? json.slice(0, 220) + '…' : json;
    } catch {
      return String(v);
    }
  };

  const getTargetDisplayName = (log: AuditLog, resolved: any) => {
    const entity = inferEntityKind(log);
    if (resolved?.label) {
      return resolved.label;
    }

    const snapshotLabel = getSnapshotLabel(log);
    if (snapshotLabel) {
      return snapshotLabel;
    }

    if (entity) {
      if (entity === 'cooperative_member' && log.entity_id) return `Membership ${truncateId(log.entity_id)}`;
      if (log.entity_id) return `${getRecordTypeLabel(log)} ${truncateId(log.entity_id)}`;
      return getRecordTypeLabel(log);
    }
    return 'the record';
  };

  const getLaymanSummary = (log: AuditLog, resolved: any) => {
    if (inferEntityKind(log) === 'promotion') {
      return buildPromotionNarrative(log, resolved);
    }
    const actor = String(log.user_name || log.user_email || log.user_id || 'A user').trim() || 'A user';
    const action = String(log.action || '').trim().toLowerCase();
    const target = getTargetDisplayName(log, resolved);
    const when = formatTimestampWAT(log.created_at).time;

    if (action === 'delete') {
      const status = String(resolved?.data?.status || '').trim().toLowerCase();
      const verb = status === 'inactive' ? 'deactivated' : 'deleted';
      return `${actor} ${verb} ${target} at ${when}.`;
    }
    if (action === 'create') {
      return `${actor} created ${target} at ${when}.`;
    }
    if (action === 'update') {
      return `${actor} updated ${target} at ${when}.`;
    }
    if (action === 'approve') {
      return `${actor} approved ${target} at ${when}.`;
    }
    if (action === 'reject') {
      return `${actor} rejected ${target} at ${when}.`;
    }
    if (action === 'login') {
      return `${actor} logged into the system at ${when}.`;
    }
    if (action === 'logout') {
      return `${actor} logged out of the system at ${when}.`;
    }
    if (action) {
      return `${actor} performed ${formatEntity(action)} on ${target} at ${when}.`;
    }
    return `${actor} performed an action at ${when}.`;
  };

  const getActionLabel = (log: AuditLog) => {
    const desc = String(log.description || '');
    if (String(log.entity || '').toLowerCase() === 'payroll' && desc.toLowerCase().startsWith('approval stage')) {
      const first = desc.split('|')[0]?.trim();
      return first || formatEntity(log.action);
    }
    const kind = inferEntityKind(log);
    if (kind === 'cooperative_member' && String(log.action || '').trim().toLowerCase() === 'update') {
      return 'Membership Updated';
    }
    if (kind === 'cooperative_member' && String(log.action || '').trim().toLowerCase() === 'create') {
      return 'Membership Created';
    }
    return formatEntity(log.action);
  };

  const getChangeRows = (oldVal?: any, newVal?: any, resolved?: ResolvedEntityInfo | null) => {
    const oldObj = getCanonicalObject(oldVal);
    const newObj = getCanonicalObject(newVal);
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).filter(
      (k) => !hiddenChangeFields.has(k),
    );
    return allKeys
      .map((k) => {
        const before = (oldObj as any)[k];
        const after = (newObj as any)[k];
        if (areEquivalentValues(k, before, after)) return null;
        if (isBlankValue(before) && isBlankValue(after)) return null;
        return {
          field: k,
          label: getFieldLabel(k),
          before: formatFriendlyValue(k, before, resolved),
          after: formatFriendlyValue(k, after, resolved),
        };
      })
      .filter(Boolean) as Array<{
        field: string;
        label: string;
        before: string;
        after: string;
      }>;
  };
  
  const formatChanges = (oldVal?: any, newVal?: any, resolved?: ResolvedEntityInfo | null) => {
    const rows = getChangeRows(oldVal, newVal, resolved).slice(0, 4);
    if (rows.length === 0) {
      return 'No changes';
    }
    return rows.map((row) => `${row.label}: ${row.before} -> ${row.after}`).join('; ');
  };

  const getActivityPreview = (log: AuditLog) => {
    const summary = formatChanges(log.old_values, log.new_values);
    if (summary !== 'No changes') return summary;
    return getBusinessNote(log, null);
  };

  const buildResolvedEntity = async (log: AuditLog): Promise<ResolvedEntityInfo | null> => {
    const entity = inferEntityKind(log);
    const entityId = String(log.entity_id || '').trim();
    const snapshot = getEntitySnapshot(log);
    const snapshotStaffId = String(snapshot.staff_id || '').trim();
    const snapshotCooperativeId = String(snapshot.cooperative_id || entityId || '').trim();
    if (!entityId && !snapshotStaffId && !snapshotCooperativeId) return null;

    if (entity === 'department') {
      const dept = await departmentAPI.getDepartment(entityId);
      const name = String(dept?.name || '').trim();
      const label = name ? (/department$/i.test(name) ? name : `${name} Department`) : 'Department';
      return {
        kind: 'department',
        label,
        data: dept,
        details: [
          { label: 'Department', value: label },
          { label: 'Code', value: String(dept?.code || '-') },
          { label: 'Status', value: toDisplayCase(dept?.status) || '-' },
        ],
      };
    }

    if (entity === 'staff') {
      const staff = await staffAPI.getStaff(entityId);
      const label = getPersonName(staff) || `Staff ${truncateId(entityId)}`;
      return {
        kind: 'staff',
        label,
        data: staff,
        details: [
          { label: 'Staff Member', value: label },
          { label: 'Staff Number', value: String(staff?.staff_number || '-') },
          { label: 'Department', value: String(staff?.appointment?.department || '-') },
          { label: 'Status', value: toDisplayCase(staff?.status) || '-' },
        ],
      };
    }

    if (entity === 'user') {
      const result = await userAPI.getAllUsers();
      const users = Array.isArray(result) ? result : result?.data || result?.items || [];
      const user = users.find((item: any) => String(item?.id || '') === entityId);
      if (!user) return null;
      const label = String(user.full_name || user.name || user.email || `User ${truncateId(entityId)}`).trim();
      return {
        kind: 'user',
        label,
        data: user,
        details: [
          { label: 'User', value: label },
          { label: 'Email Address', value: String(user?.email || '-') },
          { label: 'Role', value: formatRole(user?.role) },
          { label: 'Status', value: toDisplayCase(user?.status) || '-' },
        ],
      };
    }

    if (entity === 'payroll') {
      const batch = await payrollAPI.getPayrollBatch(entityId);
      const label = String(batch?.batch_number || '').trim()
        ? `Payroll Batch ${batch.batch_number}`
        : String(batch?.month || '').trim()
          ? `Payroll for ${batch.month}`
          : `Payroll ${truncateId(entityId)}`;
      return {
        kind: 'payroll',
        label,
        data: batch,
        details: [
          { label: 'Payroll Batch', value: label },
          { label: 'Month', value: String(batch?.month || '-') },
          { label: 'Status', value: toDisplayCase(batch?.status) || '-' },
          {
            label: 'Total Net Pay',
            value: typeof batch?.total_net === 'number' ? formatMoney(batch.total_net) : String(batch?.total_net || '-'),
          },
        ],
      };
    }

    if (entity === 'cooperative') {
      const cooperative = await cooperativeAPI.getById(entityId);
      const label = String(cooperative?.name || `Cooperative ${truncateId(entityId)}`).trim();
      return {
        kind: 'cooperative',
        label,
        data: cooperative,
        details: [
          { label: 'Cooperative', value: label },
          { label: 'Code', value: String(cooperative?.code || '-') },
          { label: 'Type', value: toDisplayCase(cooperative?.cooperative_type) || '-' },
          { label: 'Status', value: toDisplayCase(cooperative?.status) || '-' },
        ],
      };
    }

    if (entity === 'cooperative_member') {
      let member: any = null;

      if (entityId) {
        try {
          member = await cooperativeAPI.getMemberById(entityId);
        } catch {
          member = null;
        }
      }

      if (!member) {
        const [staff, cooperative] = await Promise.all([
          snapshotStaffId ? staffAPI.getStaff(snapshotStaffId).catch(() => null) : Promise.resolve(null),
          snapshotCooperativeId ? cooperativeAPI.getById(snapshotCooperativeId).catch(() => null) : Promise.resolve(null),
        ]);

        member = {
          ...snapshot,
          id: entityId || snapshot.id || null,
          staff_id: snapshotStaffId || snapshot.staff_id || null,
          cooperative_id: snapshotCooperativeId || snapshot.cooperative_id || null,
          staff_name: String(snapshot.staff_name || getPersonName(staff) || '').trim(),
          staff_number: String(snapshot.staff_number || staff?.staff_number || '').trim(),
          cooperative_name: String(snapshot.cooperative_name || cooperative?.name || '').trim(),
          department: String(snapshot.department || staff?.appointment?.department || '').trim(),
          member_number: String(snapshot.member_number || snapshot.staff_number || staff?.staff_number || '').trim(),
        };
      }

      const staffName = String(member?.staff_name || '').trim();
      const cooperativeName = String(member?.cooperative_name || '').trim();
      const label = staffName && cooperativeName
        ? `${staffName} in ${cooperativeName}`
        : staffName
          ? `${staffName}'s membership`
          : cooperativeName
            ? `Membership in ${cooperativeName}`
            : entityId
              ? `Membership ${truncateId(entityId)}`
              : 'Membership';
      return {
        kind: 'cooperative_member',
        label,
        data: member,
        details: [
          { label: 'Membership', value: label },
          { label: 'Staff Member', value: staffName || '-' },
          { label: 'Cooperative', value: cooperativeName || '-' },
          {
            label: 'Monthly Contribution',
            value:
              typeof member?.monthly_contribution === 'number'
                ? formatMoney(member.monthly_contribution)
                : String(member?.monthly_contribution || '-'),
          },
          { label: 'Member Number', value: String(member?.member_number || '-') },
          { label: 'Department', value: String(member?.department || '-') },
        ],
      };
    }

    if (entity === 'promotion') {
      let promotion: any = null;
      if (entityId) {
        const result = await promotionAPI.getAll().catch(() => null);
        const promotions = Array.isArray(result) ? result : result?.data || result?.items || [];
        promotion = promotions.find((item: any) => String(item?.id || '') === entityId) || null;
      }

      const snapshotPromotion = getEntitySnapshot(log);
      const source = promotion || snapshotPromotion;
      const staffId = String(source?.staff_id || snapshotPromotion?.staff_id || '').trim();
      const staff = staffId ? await staffAPI.getStaff(staffId).catch(() => null) : null;
      const staffName = String(source?.staff_name || getPersonName(source) || getPersonName(staff) || '').trim();
      const label = staffName ? describePromotionTarget({ ...source, staff_name: staffName }) : 'Promotion';

      return {
        kind: 'promotion',
        label,
        data: {
          ...source,
          staff_name: staffName,
          staff_number: source?.staff_number || staff?.staff_number || null,
        },
        details: [
          { label: 'Promotion', value: label },
          { label: 'Staff Member', value: staffName || '-' },
          { label: 'Staff Number', value: String(source?.staff_number || staff?.staff_number || '-') },
          { label: 'From', value: formatGradeStep(source?.old_grade_level, source?.old_step) || '-' },
          { label: 'To', value: formatGradeStep(source?.new_grade_level, source?.new_step) || '-' },
          {
            label: 'Effective Date',
            value: source?.effective_date || source?.promotion_date
              ? formatTimestampWAT(String(source?.effective_date || source?.promotion_date)).date
              : '-',
          },
          { label: 'Type', value: toDisplayCase(source?.promotion_type) || '-' },
          { label: 'Status', value: toDisplayCase(source?.status) || '-' },
        ],
      };
    }

    if (entity === 'loan_application') {
      const application = await loanApplicationAPI.getById(entityId);
      const reference = String(application?.reference_number || '').trim();
      const staffName = String(application?.staff_name || '').trim();
      const label = reference
        ? `Loan Application ${reference}`
        : staffName
          ? `${staffName}'s loan application`
          : `Loan Application ${truncateId(entityId)}`;
      return {
        kind: 'loan_application',
        label,
        data: application,
        details: [
          { label: 'Loan Application', value: label },
          { label: 'Staff Member', value: staffName || '-' },
          {
            label: 'Requested Amount',
            value:
              typeof application?.amount_requested === 'number'
                ? formatMoney(application.amount_requested)
                : String(application?.amount_requested || '-'),
          },
          { label: 'Status', value: toDisplayCase(application?.status) || '-' },
        ],
      };
    }

    if (entity === 'loan_type') {
      const loanType = await loanTypeAPI.getById(entityId);
      const label = String(loanType?.name || `Loan Type ${truncateId(entityId)}`).trim();
      return {
        kind: 'loan_type',
        label,
        data: loanType,
        details: [
          { label: 'Loan Type', value: label },
          { label: 'Code', value: String(loanType?.code || '-') },
          {
            label: 'Maximum Amount',
            value:
              typeof loanType?.max_amount === 'number'
                ? formatMoney(loanType.max_amount)
                : String(loanType?.max_amount || '-'),
          },
          { label: 'Status', value: toDisplayCase(loanType?.status) || '-' },
        ],
      };
    }

    if (entity === 'cooperative_contribution') {
      const snapshot = getEntitySnapshot(log);
      const staffName = String(snapshot.staff_name || '').trim();
      const cooperativeName = String(snapshot.cooperative_name || '').trim();
      const label = staffName && cooperativeName
        ? `${staffName} contribution in ${cooperativeName}`
        : staffName
          ? `${staffName} contribution`
          : `Contribution ${truncateId(entityId)}`;
      return {
        kind: 'cooperative_contribution',
        label,
        data: snapshot,
        details: [
          { label: 'Contribution', value: label },
          { label: 'Staff Member', value: staffName || '-' },
          { label: 'Cooperative', value: cooperativeName || '-' },
          {
            label: 'Amount',
            value:
              typeof snapshot.amount === 'number' || (!Number.isNaN(Number(snapshot.amount)) && snapshot.amount !== '')
                ? formatMoney(Number(snapshot.amount))
                : String(snapshot.amount || '-'),
          },
        ],
      };
    }

    return null;
  };

  useEffect(() => {
    const resolve = async () => {
      if (!showDetailsModal || !selectedLog) return;
      const entityId = String(selectedLog.entity_id || '').trim();
      setResolvedEntity(null);
      if (!entityId) return;

      setResolvingEntity(true);
      try {
        const resolved = await buildResolvedEntity(selectedLog);
        setResolvedEntity(resolved);
      } catch {
        setResolvedEntity(null);
      } finally {
        setResolvingEntity(false);
      }
    };

    resolve();
  }, [showDetailsModal, selectedLog]);

  const loadLogs = async (currentPage: number = 1) => {
    try {
      setLoading(true);
      
      let startDate: string | undefined;
      let endDate: string | undefined;

      const now = new Date();
      if (dateRangeMode === 'today') {
        const start = new Date(now.setHours(0, 0, 0, 0));
        startDate = start.toISOString();
      } else if (dateRangeMode === 'last7days') {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        startDate = start.toISOString();
      } else if (dateRangeMode === 'last30days') {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        startDate = start.toISOString();
      } else if (dateRangeMode === 'custom') {
        if (customStartDate) {
          startDate = new Date(customStartDate).toISOString();
        }
        if (customEndDate) {
          endDate = new Date(customEndDate + 'T23:59:59.999Z').toISOString();
        }
      }

      const result = await auditAPI.getAll({ 
        page: currentPage, 
        limit: 50,
        startDate,
        endDate
      });
      const data = Array.isArray(result) ? result : (result.data || result.items || []);
      setLogs(data);
      if (result && result.meta) {
        setTotalPages(result.meta.totalPages || 1);
        setPage(result.meta.page || 1);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dateRangeMode]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        const query = filter.toLowerCase();
        if (!query) return true;
        const haystack = [
          JSON.stringify(log),
          getTargetDisplayName(log, null),
          getLaymanSummary(log, null),
          getActivityPreview(log),
          formatRole(log.user_role),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      }),
    [logs, filter],
  );

  const columns = [
    { 
      header: 'Time', 
      accessor: (log: AuditLog) => (
        <div className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2 text-gray-400" />
          {formatTimestampWAT(log.created_at).full}
        </div>
      )
    },
    { 
      header: 'Activity', 
      accessor: (log: AuditLog) => {
        return (
          <div className="min-w-[220px]">
            <div className="font-medium text-foreground">{getActionLabel(log)}</div>
            <div className="text-xs text-muted-foreground">{getActivityPreview(log)}</div>
          </div>
        );
      } 
    },
    {
      header: 'Record',
      accessor: (log: AuditLog) => (
        <div className="min-w-[180px]">
          <div className="font-medium text-foreground">{getTargetDisplayName(log, null)}</div>
          <div className="text-xs text-muted-foreground">{formatEntity(log.entity)}</div>
        </div>
      )
    },
    { 
      header: 'User', 
      accessor: (log: AuditLog) => {
        const roleLabel = formatRole(log.user_role);
        const nameOrEmail = log.user_name || log.user_email || log.user_id;
        if (!roleLabel || roleLabel === '-') return nameOrEmail;
        const same = String(nameOrEmail || '').trim().toLowerCase() === roleLabel.trim().toLowerCase();
        const inner = same ? (log.user_email || log.user_id) : nameOrEmail;
        return `${roleLabel} (${inner})`;
      } 
    },
  ];

  if (loading && logs.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Breadcrumb 
        items={[
          { label: 'Dashboard', path: '/' },
          { label: 'System', path: '#' },
          { label: 'Audit Log', path: '/audit-log' },
        ]} 
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">System Audit Log</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Track key system activities and changes</p>
        </div>
        <button 
          onClick={() => loadLogs(page)}
          className="flex items-center justify-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm w-full sm:w-auto"
              value={dateRangeMode}
              onChange={(e) => {
                setDateRangeMode(e.target.value);
                setPage(1);
              }}
            >
              <option value="recent">Recent</option>
              <option value="today">Today</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            {dateRangeMode === 'custom' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 sm:flex-none"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 sm:flex-none"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
                <button 
                  onClick={() => {
                    setPage(1);
                    loadLogs(1);
                  }} 
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredLogs}
          onRowClick={(log) => {
            setSelectedLog(log);
            setShowDetailsModal(true);
          }}
          serverSidePagination={{
            currentPage: page,
            totalPages: totalPages,
            onPageChange: (newPage) => setPage(newPage)
          }}
        />
      </div>

      <Modal
        isOpen={showDetailsModal && Boolean(selectedLog)}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedLog(null);
        }}
        title="Audit Event Details"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-primary/5 p-4">
              <div className="text-sm font-semibold text-foreground">Summary</div>
              <div className="mt-1 text-sm text-foreground">
                {getLaymanSummary(selectedLog, resolvedEntity)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {formatTimestampWAT(selectedLog.created_at).full}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Done By</span>
                  <span className="text-foreground font-medium">
                    {selectedLog.user_name || selectedLog.user_email || selectedLog.user_id || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-foreground font-medium">{formatRole(selectedLog.user_role)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Action</span>
                  <span className="text-foreground font-medium">{getActionLabel(selectedLog)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Record Type</span>
                  <span className="text-foreground font-medium">{getRecordTypeLabel(selectedLog)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Affected Record</span>
                  <span className="text-foreground font-medium">{getTargetDisplayName(selectedLog, resolvedEntity)}</span>
                </div>
                <div className="flex justify-between gap-3 md:col-span-2">
                  <span className="text-muted-foreground">What Happened</span>
                  <span className="text-foreground font-medium">{getBusinessNote(selectedLog, resolvedEntity)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <div className="text-sm font-semibold text-foreground mb-3">Target</div>
              {resolvingEntity ? (
                <div className="text-sm text-muted-foreground">Loading entity details…</div>
              ) : resolvedEntity ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {resolvedEntity.details.map((detail) => (
                    <div key={detail.label} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{detail.label}</span>
                      <span className="text-foreground font-medium text-right">{detail.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No linked record details were available, but the event summary still shows the main action in plain terms.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Change Summary</div>
              <div className="text-sm text-muted-foreground">
                {formatChanges(selectedLog.old_values, selectedLog.new_values, resolvedEntity) === 'No changes'
                  ? 'No before/after snapshot was captured for this event.'
                  : formatChanges(selectedLog.old_values, selectedLog.new_values, resolvedEntity)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Field-Level Changes</div>
              {getChangeRows(selectedLog.old_values, selectedLog.new_values, resolvedEntity).length === 0 ? (
                <div className="text-sm text-muted-foreground">No before/after snapshot was captured for this event.</div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Field</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Before</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {getChangeRows(selectedLog.old_values, selectedLog.new_values, resolvedEntity).map((row) => (
                          <tr key={row.field} className="hover:bg-accent/50">
                            <td className="px-4 py-3 text-xs sm:text-sm text-foreground font-medium">{row.label}</td>
                            <td className="px-4 py-3 text-xs sm:text-sm text-muted-foreground">{row.before}</td>
                            <td className="px-4 py-3 text-xs sm:text-sm text-foreground">{row.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <div className="text-sm font-semibold text-foreground mb-3">Technical Reference</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Event ID</span>
                  <span className="text-foreground font-medium">{selectedLog.id}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Record ID</span>
                  <span className="text-foreground font-medium">{selectedLog.entity_id || '-'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Time (Local)</span>
                  <span className="text-foreground font-medium">{formatTimestamp(selectedLog.created_at).local}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Time (ISO)</span>
                  <span className="text-foreground font-medium">{formatTimestamp(selectedLog.created_at).iso}</span>
                </div>
                <div className="flex justify-between gap-3 md:col-span-2">
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="text-foreground font-medium">{formatIpAddress(selectedLog.ip_address)}</span>
                </div>
                <div className="flex justify-between gap-3 md:col-span-2">
                  <span className="text-muted-foreground">Raw System Note</span>
                  <span className="text-foreground font-medium break-all">{getRawSystemNote(selectedLog)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
