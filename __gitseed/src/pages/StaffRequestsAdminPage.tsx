import React, { useEffect, useMemo, useState } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { PageSkeleton } from '../components/PageLoader';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { staffRequestsAPI } from '../lib/api-client';
import { CheckCircle, XCircle, AlertCircle, Loader2, Eye } from 'lucide-react';

type Status = 'pending' | 'approved' | 'rejected';

export default function StaffRequestsAdminPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Status>('pending');
  const [requests, setRequests] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [processingRowId, setProcessingRowId] = useState<string | null>(null);
  const [modalProcessing, setModalProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await staffRequestsAPI.getAll({ status: activeFilter, limit: 50 });
      setRequests(res.data || []);
    } catch {
      showToast('error', 'Failed to load staff requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeFilter]);

  const handleApprove = async (id: string, notes?: string) => {
    setProcessingRowId(id);
    try {
      await staffRequestsAPI.approve(id, notes);
      // Optimistic update for immediate UI feedback
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'approved', notes: notes || r.notes } : r)));
      showToast('success', 'Request approved');
      await loadData();
      if (selected?.id === id) setSelected(null);
    } catch {
      showToast('error', 'Failed to approve request');
    } finally {
      setProcessingRowId(null);
    }
  };

  const handleReject = async (id: string, notes?: string) => {
    setProcessingRowId(id);
    try {
      await staffRequestsAPI.reject(id, notes);
      // Optimistic update for immediate UI feedback
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'rejected', notes: notes || r.notes } : r)));
      showToast('success', 'Request rejected');
      await loadData();
      if (selected?.id === id) setSelected(null);
    } catch {
      showToast('error', 'Failed to reject request');
    } finally {
      setProcessingRowId(null);
    }
  };

  const prettyType = (t: string) => String(t || '').replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());

  const detailEntries = useMemo(() => {
    if (!selected?.details || typeof selected.details !== 'object') return [];
    const obj = selected.details;
    return Object.keys(obj).map((key) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
      const val = obj[key];
      let display: string = '';
      if (val === null || val === undefined) display = '-';
      else if (Array.isArray(val)) display = val.join(', ');
      else if (typeof val === 'object') display = JSON.stringify(val);
      else if (typeof val === 'boolean') display = val ? 'Yes' : 'No';
      else display = String(val);
      return { label, value: display };
    });
  }, [selected]);

  const columns = [
    { header: 'Staff', accessor: (row: any) => `${row.first_name || ''} ${row.last_name || ''}` },
    { header: 'Staff Number', accessor: (row: any) => row.staff_number || '-' },
    { header: 'Department', accessor: (row: any) => row.department_name || '-' },
    { header: 'Type', accessor: (row: any) => prettyType(row.request_type) },
    { header: 'Status', accessor: (row: any) => row.status },
    { header: 'Created', accessor: (row: any) => new Date(row.created_at).toLocaleString() },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelected(row);
            }}
            className="p-1 hover:bg-accent rounded"
            title="View"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApprove(row.id);
                }}
                className="p-1 hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Approve"
                disabled={processingRowId === row.id}
              >
                {processingRowId === row.id ? <Loader2 className="w-4 h-4 animate-spin text-green-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReject(row.id);
                }}
                className="p-1 hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reject"
                disabled={processingRowId === row.id}
              >
                {processingRowId === row.id ? <Loader2 className="w-4 h-4 animate-spin text-red-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Staff Requests' }]} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="page-title min-w-0">Staff Service Requests</h1>
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg overflow-x-auto whitespace-nowrap max-w-full">
          {(['pending', 'approved', 'rejected'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveFilter(s)}
              className={`px-3 py-1.5 rounded text-sm sm:text-base ${activeFilter === s ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PageSkeleton mode="table" />
      ) : (
        <div className="bg-card border border-border rounded-lg">
          <DataTable
            data={requests}
            columns={columns}
            searchable
            searchPlaceholder="Search staff, type, department..."
            onRowClick={(row) => setSelected(row)}
          />
        </div>
      )}

      {selected && (
        <Modal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          title="Request Details"
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2">
              {selected.status === 'pending' ? (
                <>
                  <button
                    onClick={async () => {
                      setModalProcessing(true);
                      await handleReject(selected.id, modalNotes || undefined);
                      setModalProcessing(false);
                    }}
                    disabled={modalProcessing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {modalProcessing ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Rejecting...</span> : 'Reject'}
                  </button>
                  <button
                    onClick={async () => {
                      setModalProcessing(true);
                      await handleApprove(selected.id, modalNotes || undefined);
                      setModalProcessing(false);
                    }}
                    disabled={modalProcessing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {modalProcessing ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Approving...</span> : 'Approve'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 text-foreground hover:bg-accent rounded-lg"
                >
                  Close
                </button>
              )}
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Staff</span>
                <span className="text-foreground text-right truncate max-w-[60%]">{`${selected.first_name || ''} ${selected.last_name || ''}`.trim()}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Staff Number</span>
                <span className="text-foreground text-right truncate max-w-[60%]">{selected.staff_number || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Department</span>
                <span className="text-foreground text-right truncate max-w-[60%]">{selected.department_name || '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Type</span>
                <span className="text-foreground text-right truncate max-w-[60%]">{prettyType(selected.request_type)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <span className="text-foreground capitalize text-right truncate max-w-[60%]">{selected.status}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground text-right truncate max-w-[60%]">{new Date(selected.created_at).toLocaleString()}</span>
              </div>
            </div>

            {selected.status === 'pending' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes (optional)</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Add any remarks for this decision"
                />
              </div>
            )}

            <div>
              <span className="block text-muted-foreground mb-1">Details</span>
              {detailEntries.length === 0 ? (
                <div className="p-2 border border-border rounded text-muted-foreground">No details provided</div>
              ) : (
                <div className="space-y-2">
                  {detailEntries.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="text-foreground text-right truncate max-w-[60%]">{d.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected.notes && (
              <div>
                <span className="block text-muted-foreground mb-1">Notes</span>
                <div className="p-2 border border-border rounded">{selected.notes}</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
