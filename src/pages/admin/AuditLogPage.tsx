import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import { DataTable } from '../../components/DataTable';
import { auditAPI } from '../../lib/api-client';
import { PageSkeleton } from '../../components/PageLoader';
import { Search, Filter, RefreshCw, Clock } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
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
  
  const formatEntity = (value: string) => {
    const clean = String(value || '').replace(/_/g, ' ').toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };
  
  const truncateId = (id?: string) => (id ? id.slice(0, 8) + '…' : '');
  
  const formatChanges = (oldVal?: any, newVal?: any) => {
    const oldObj = typeof oldVal === 'object' && oldVal ? oldVal : {};
    const newObj = typeof newVal === 'object' && newVal ? newVal : {};
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
    { header: 'Action', accessor: (log: AuditLog) => formatEntity(log.action) },
    { header: 'Entity', accessor: (log: AuditLog) => formatEntity(log.entity) },
    { header: 'User', accessor: (log: AuditLog) => log.user_name || log.user_email || log.user_id },
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
          onRowClick={(log) => console.log(log)}
        />
      </div>
    </div>
  );
}
