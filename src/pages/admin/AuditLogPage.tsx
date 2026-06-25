import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import { DataTable } from '../../components/DataTable';
import { auditAPI, departmentAPI } from '../../lib/api-client';
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

export function AuditLogPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [resolvedEntity, setResolvedEntity] = useState<any>(null);
  const [resolvingEntity, setResolvingEntity] = useState(false);
  
  const formatEntity = (value: string) => {
    const clean = String(value || '').replace(/_/g, ' ').toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };
  
  const truncateId = (id?: string) => (id ? id.slice(0, 8) + '…' : '');

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

  const getTargetDisplayName = (log: AuditLog, resolved: any) => {
    const entity = String(log.entity || '').trim().toLowerCase();
    if ((entity === 'departments' || entity === 'department') && resolved?.kind === 'department') {
      const name = String(resolved?.data?.name || '').trim();
      if (!name) return 'a department';
      const hasDeptWord = /department$/i.test(name);
      return hasDeptWord ? name : `${name} Department`;
    }
    if (entity) {
      return `the ${formatEntity(entity)}`;
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

  const formatValue = (v: any) => {
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

  const getChangeRows = (oldVal?: any, newVal?: any) => {
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
          before: formatValue(before),
          after: formatValue(after),
        };
      })
      .filter(Boolean) as Array<{ field: string; before: string; after: string }>;
  };
  
  const formatChanges = (oldVal?: any, newVal?: any) => {
    const oldObj = normalizeAuditObject(oldVal);
    const newObj = normalizeAuditObject(newVal);
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const exclude = ['created_at', 'updated_at', 'approval_date', 'approval_remarks', 'ip_address', 'password', 'password_hash'];
    const priorities = ['id', 'reason', 'status', 'start_date', 'end_date', 'leave_type_id', 'promotion_date', 'new_grade_level', 'old_grade_level'];
    const keys = allKeys
      .filter(k => !exclude.includes(k))
      .sort((a, b) => priorities.indexOf(a) - priorities.indexOf(b))
      .slice(0, 8);
    const formatVal = (v: any) => {
      if (v === null || v === undefined) return '-';
      if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 19);
        return v.length > 60 ? v.slice(0, 60) + '…' : v;
      }
      if (typeof v === 'object') return '[object]';
      return String(v);
    };
    const rows = keys.map(k => {
      const o = oldObj[k];
      const n = newObj[k];
      if (o === n) return null;
      const ov = formatVal(o);
      const nv = formatVal(n);
      return `${k}: ${ov || '-'} → ${nv || '-'}`;
    }).filter(Boolean) as string[];
    if (rows.length === 0) {
      return 'No changes';
    }
    return rows.join('; ');
  };

  useEffect(() => {
    const resolve = async () => {
      if (!showDetailsModal || !selectedLog) return;
      const entity = String(selectedLog.entity || '').trim().toLowerCase();
      const entityId = String(selectedLog.entity_id || '').trim();
      if (!entityId) {
        setResolvedEntity(null);
        return;
      }

      setResolvingEntity(true);
      try {
        if (entity === 'departments' || entity === 'department') {
          const dept = await departmentAPI.getDepartment(entityId);
          setResolvedEntity({ kind: 'department', data: dept });
          return;
        }
        setResolvedEntity(null);
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

  const columns = [
    { 
      header: 'Time', 
      accessor: (log: AuditLog) => (
        <div className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2 text-gray-400" />
          {new Date(log.created_at).toLocaleString()}
        </div>
      )
    },
    { 
      header: 'Action', 
      accessor: (log: AuditLog) => {
        const desc = String(log.description || '');
        if (String(log.entity || '').toLowerCase() === 'payroll' && desc.toLowerCase().startsWith('approval stage')) {
          const first = desc.split('|')[0]?.trim();
          return first || formatEntity(log.action);
        }
        return formatEntity(log.action);
      } 
    },
    { header: 'Entity', accessor: (log: AuditLog) => formatEntity(log.entity) },
    { 
      header: 'User', 
      accessor: (log: AuditLog) => {
        const role = String(log.user_role || '').trim().toLowerCase();
        const roleLabel =
          role === 'auditor' ? 'Audit Office' :
          role === 'checking' ? 'Checking' :
          role === 'cpo' ? 'CPO' :
          role ? formatEntity(role) :
          '';
        const nameOrEmail = log.user_name || log.user_email || log.user_id;
        if (!roleLabel) return nameOrEmail;
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
          data={logs.filter(log => 
            JSON.stringify(log).toLowerCase().includes(filter.toLowerCase())
          )}
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
                  <span className="text-muted-foreground">Event ID</span>
                  <span className="text-foreground font-medium">{selectedLog.id}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Time (Local)</span>
                  <span className="text-foreground font-medium">{formatTimestamp(selectedLog.created_at).local}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Time (ISO)</span>
                  <span className="text-foreground font-medium">{formatTimestamp(selectedLog.created_at).iso}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="text-foreground font-medium">{formatIpAddress(selectedLog.ip_address)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Action</span>
                  <span className="text-foreground font-medium">{formatEntity(selectedLog.action)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Entity</span>
                  <span className="text-foreground font-medium">{formatEntity(selectedLog.entity)}</span>
                </div>
                <div className="flex justify-between gap-3 md:col-span-2">
                  <span className="text-muted-foreground">Entity ID</span>
                  <span className="text-foreground font-medium">{selectedLog.entity_id || '-'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">User</span>
                  <span className="text-foreground font-medium">
                    {selectedLog.user_name || selectedLog.user_email || selectedLog.user_id || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Role</span>
                  <span className="text-foreground font-medium">{selectedLog.user_role || '-'}</span>
                </div>
                <div className="flex justify-between gap-3 md:col-span-2">
                  <span className="text-muted-foreground">Description</span>
                  <span className="text-foreground font-medium">{selectedLog.description || '-'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/10 p-4">
              <div className="text-sm font-semibold text-foreground mb-3">Target</div>
              {resolvingEntity ? (
                <div className="text-sm text-muted-foreground">Loading entity details…</div>
              ) : resolvedEntity?.kind === 'department' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Department</span>
                    <span className="text-foreground font-medium">{resolvedEntity.data?.name || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Code</span>
                    <span className="text-foreground font-medium">{resolvedEntity.data?.code || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-foreground font-medium">{resolvedEntity.data?.status || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-3 md:col-span-2">
                    <span className="text-muted-foreground">Department ID</span>
                    <span className="text-foreground font-medium">{resolvedEntity.data?.id || selectedLog.entity_id || '-'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No entity details available for this event.</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Change Summary</div>
              <div className="text-sm text-muted-foreground">
                {formatChanges(selectedLog.old_values, selectedLog.new_values) === 'No changes'
                  ? 'No before/after snapshot was captured for this event.'
                  : formatChanges(selectedLog.old_values, selectedLog.new_values)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Field-Level Changes</div>
              {getChangeRows(selectedLog.old_values, selectedLog.new_values).length === 0 ? (
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
                        {getChangeRows(selectedLog.old_values, selectedLog.new_values).map((row) => (
                          <tr key={row.field} className="hover:bg-accent/50">
                            <td className="px-4 py-3 text-xs sm:text-sm text-foreground font-medium">{row.field}</td>
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
          </div>
        )}
      </Modal>
    </div>
  );
}
