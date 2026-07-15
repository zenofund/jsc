import React, { useState, useEffect, useMemo } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import { DataTable } from '../../components/DataTable';
import { auditAPI, departmentAPI, payrollAPI, staffAPI, userAPI } from '../../lib/api-client';
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
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [resolvedEntity, setResolvedEntity] = useState<ResolvedEntityInfo | null>(null);
  const [resolvingEntity, setResolvingEntity] = useState(false);
  
  const formatEntity = (value: string) => {
    const clean = String(value || '').replace(/_/g, ' ').toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };
  
  const truncateId = (id?: string) => (id ? id.slice(0, 8) + '…' : '');

  const toDisplayCase = (value?: string) => {
    const raw = String(value || '').replace(/[_-]+/g, ' ').trim();
    if (!raw) return '';
    return raw
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
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

    const bio = record.bio_data;
    if (bio && typeof bio === 'object') {
      return [bio.first_name, bio.middle_name, bio.last_name].filter(Boolean).join(' ').trim();
    }

    return '';
  };

  const getEntitySnapshot = (log: AuditLog) => {
    const newObj = normalizeAuditObject(log.new_values);
    const oldObj = normalizeAuditObject(log.old_values);
    return Object.keys(newObj).length > 0 ? newObj : oldObj;
  };

  const getSnapshotLabel = (log: AuditLog) => {
    const snapshot = getEntitySnapshot(log);
    const entity = String(log.entity || '').trim().toLowerCase();

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

    if (entity === 'department' || entity === 'departments') {
      const name = getRawFriendlyLabel(snapshot.name);
      if (name) {
        return /department$/i.test(name) ? name : `${name} Department`;
      }
    }

    if (entity === 'payroll' || entity === 'payroll_batch' || entity === 'payroll_batches') {
      const batchNumber = getRawFriendlyLabel(snapshot.batch_number);
      if (batchNumber) return `Payroll Batch ${batchNumber}`;
      const month = getRawFriendlyLabel(snapshot.month);
      if (month) return `Payroll for ${month}`;
    }

    if (
      entity === 'cooperative_member' ||
      entity === 'cooperative_members' ||
      entity === 'member' ||
      entity === 'members'
    ) {
      const staffName = getRawFriendlyLabel(snapshot.staff_name) || getPersonName(snapshot);
      const cooperativeName = getRawFriendlyLabel(snapshot.cooperative_name);
      if (staffName && cooperativeName) return `${staffName} in ${cooperativeName}`;
      if (staffName) return `${staffName}'s membership`;
    }

    if (entity === 'loan_application' || entity === 'loan_applications') {
      const reference = getRawFriendlyLabel(snapshot.reference_number);
      if (reference) return `Loan Application ${reference}`;
      const staffName = getRawFriendlyLabel(snapshot.staff_name);
      if (staffName) return `${staffName}'s loan application`;
    }

    if (directCandidates[0]) return directCandidates[0];
    return '';
  };

  const getFieldLabel = (field: string) => {
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
    };
    return map[field] || toDisplayCase(field);
  };

  const isMoneyField = (field: string) =>
    /(amount|salary|gross|net|balance|fee|contribution|deduction|payment)/i.test(field);

  const getFriendlyReferenceValue = (field: string, value: any, resolved?: ResolvedEntityInfo | null) => {
    if (field === 'department_id' && resolved?.kind === 'department') return resolved.label;
    if (field === 'cooperative_id' && resolved?.kind === 'cooperative') return resolved.label;
    if (field === 'member_id' && resolved?.kind === 'cooperative_member') return resolved.label;
    if (field === 'loan_application_id' && resolved?.kind === 'loan_application') return resolved.label;
    if (field === 'loan_type_id' && resolved?.kind === 'loan_type') return resolved.label;
    if ((field === 'staff_id' || field === 'user_id') && (resolved?.kind === 'staff' || resolved?.kind === 'user')) {
      return resolved.label;
    }
    return '';
  };

  const formatFriendlyValue = (field: string, value: any, resolved?: ResolvedEntityInfo | null): string => {
    if (value === null || value === undefined || value === '') return 'Not set';

    const referenced = getFriendlyReferenceValue(field, value, resolved);
    if (referenced) return referenced;

    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (typeof value === 'number') {
      if (isMoneyField(field)) return formatMoney(value);
      return Number.isInteger(value) ? value.toLocaleString('en-NG') : String(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return 'Not set';

      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const stamp = formatTimestampWAT(trimmed);
        return stamp.full !== '-' ? stamp.full : trimmed;
      }

      if (field === 'status' || field === 'payment_status' || field === 'role' || field === 'payment_method') {
        return field === 'role' ? formatRole(trimmed) : toDisplayCase(trimmed);
      }

      if (isMoneyField(field) && !Number.isNaN(Number(trimmed))) {
        return formatMoney(Number(trimmed));
      }

      if (field.endsWith('_id')) {
        return isUuidLike(trimmed) ? truncateId(trimmed) : trimmed;
      }

      return trimmed.length > 220 ? trimmed.slice(0, 220) + '…' : trimmed;
    }

    if (Array.isArray(value)) {
      const items: string[] = value.map((item) => formatFriendlyValue(field, item, resolved));
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

  const getSystemNote = (log: AuditLog) => {
    const raw = String(log.description || '').trim();
    if (!raw) return 'No additional system note was recorded.';
    const cleaned = raw
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' | ');
    return cleaned || 'No additional system note was recorded.';
  };

  const getTargetDisplayName = (log: AuditLog, resolved: any) => {
    const entity = String(log.entity || '').trim().toLowerCase();
    if (resolved?.label) {
      return resolved.label;
    }

    const snapshotLabel = getSnapshotLabel(log);
    if (snapshotLabel) {
      return snapshotLabel;
    }

    if (entity) {
      if (log.entity_id) return `${formatEntity(entity)} ${truncateId(log.entity_id)}`;
      return formatEntity(entity);
    }
    return 'the record';
  };

  const getLaymanSummary = (log: AuditLog, resolved: any) => {
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
    return formatEntity(log.action);
  };

  const getChangeRows = (oldVal?: any, newVal?: any, resolved?: ResolvedEntityInfo | null) => {
    const oldObj = normalizeAuditObject(oldVal);
    const newObj = normalizeAuditObject(newVal);
    const exclude = new Set([
      'created_at',
      'updated_at',
      'approval_date',
      'approval_remarks',
      'ip_address',
      'password',
      'password_hash',
    ]);
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).filter(
      (k) => !exclude.has(k),
    );
    return allKeys
      .map((k) => {
        const before = (oldObj as any)[k];
        const after = (newObj as any)[k];
        if (before === after) return null;
        return {
          field: k,
          label: getFieldLabel(k),
          before: formatFriendlyValue(k, before, resolved),
          after: formatFriendlyValue(k, after, resolved),
          technicalBefore: formatTechnicalValue(before),
          technicalAfter: formatTechnicalValue(after),
        };
      })
      .filter(Boolean) as Array<{
        field: string;
        label: string;
        before: string;
        after: string;
        technicalBefore: string;
        technicalAfter: string;
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
    const description = getSystemNote(log);
    return description === 'No additional system note was recorded.' ? 'No detailed change note was recorded.' : description;
  };

  const buildResolvedEntity = async (log: AuditLog): Promise<ResolvedEntityInfo | null> => {
    const entity = String(log.entity || '').trim().toLowerCase();
    const entityId = String(log.entity_id || '').trim();
    if (!entityId) return null;

    if (entity === 'departments' || entity === 'department') {
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

    if (entity === 'staff' || entity === 'staffs' || entity === 'employees') {
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

    if (entity === 'users' || entity === 'user') {
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

    if (entity === 'payroll' || entity === 'payroll_batch' || entity === 'payroll_batches') {
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

    if (entity === 'cooperatives' || entity === 'cooperative') {
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

    if (
      entity === 'cooperative_member' ||
      entity === 'cooperative_members' ||
      entity === 'member' ||
      entity === 'members'
    ) {
      const member = await cooperativeAPI.getMemberById(entityId);
      const staffName = String(member?.staff_name || '').trim();
      const cooperativeName = String(member?.cooperative_name || '').trim();
      const label = staffName && cooperativeName
        ? `${staffName} in ${cooperativeName}`
        : staffName
          ? `${staffName}'s membership`
          : `Membership ${truncateId(entityId)}`;
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
        ],
      };
    }

    if (entity === 'loan_application' || entity === 'loan_applications') {
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

    if (entity === 'loan_type' || entity === 'loan_types') {
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

  const loadLogs = async () => {
    try {
      setLoading(true);
      const result = await auditAPI.getAll({ limit: 50 });
      const data = Array.isArray(result) ? result : (result.data || result.items || []);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

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

  if (loading) return <PageSkeleton />;

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
          <p className="text-muted-foreground text-sm sm:text-base">Track all system activities and changes</p>
        </div>
        <button 
          onClick={loadLogs}
          className="flex items-center justify-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <button className="flex items-center justify-center px-4 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 w-full sm:w-auto">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
        </div>

        <DataTable
          columns={columns}
          data={filteredLogs}
          onRowClick={(log) => {
            setSelectedLog(log);
            setShowDetailsModal(true);
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
                  <span className="text-foreground font-medium">{formatEntity(selectedLog.entity)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Affected Record</span>
                  <span className="text-foreground font-medium">{getTargetDisplayName(selectedLog, resolvedEntity)}</span>
                </div>
                <div className="flex justify-between gap-3 md:col-span-2">
                  <span className="text-muted-foreground">System Note</span>
                  <span className="text-foreground font-medium">{getSystemNote(selectedLog)}</span>
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
                    <table className="w-full min-w-[900px]">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Field</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Before</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">After</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Technical Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {getChangeRows(selectedLog.old_values, selectedLog.new_values, resolvedEntity).map((row) => (
                          <tr key={row.field} className="hover:bg-accent/50">
                            <td className="px-4 py-3 text-xs sm:text-sm text-foreground font-medium">{row.label}</td>
                            <td className="px-4 py-3 text-xs sm:text-sm text-muted-foreground">{row.before}</td>
                            <td className="px-4 py-3 text-xs sm:text-sm text-foreground">{row.after}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {row.technicalBefore}{' -> '}{row.technicalAfter}
                            </td>
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
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
