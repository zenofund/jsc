import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../../components/Breadcrumb';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { PageSkeleton } from '../../components/PageLoader';
import { 
  staffPortalAPI, 
  loanApplicationAPI, 
  promotionAPI,
  arrearsAPI,
} from '../../lib/api-client';
import { 
  FileText, 
  Calendar, 
  Wallet, 
  Award, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';

type RequestType = 'leave' | 'loan' | 'promotion' | 'arrear' | 'general';

interface RequestItem {
  id: string;
  type: RequestType;
  title: string;
  subtitle: string;
  status: string;
  created_at: string;
  amount?: number;
  data: any;
}

export function StaffRequestStatusPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (user?.staff_id) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user?.staff_id) return;

    try {
      setLoading(true);
      const requestItems: RequestItem[] = [];

      // Load Leave Requests
      try {
        const leavesResponse = await staffPortalAPI.getStaffLeaveRequests(user.staff_id);
        const leavesData = Array.isArray(leavesResponse) ? leavesResponse : (leavesResponse?.data || []);
        const leaves = Array.isArray(leavesData) ? leavesData : [];
        leaves.forEach((l: any) => {
          requestItems.push({
            id: l.id,
            type: 'leave',
            title: 'Leave Request',
            subtitle: `${l.leave_type_name || 'Leave'} (${l.number_of_days ?? 0} days)`,
            status: l.status,
            created_at: l.created_at,
            data: l
          });
        });
      } catch (e) { console.error('Error loading leaves', e); }

      // Load Loan Applications
      try {
        const loansResponse = await loanApplicationAPI.getAll({ staff_id: user.staff_id });
        const loansData = Array.isArray(loansResponse) ? loansResponse : (loansResponse?.data || []);
        const loans = Array.isArray(loansData) ? loansData : [];
        loans.forEach((l: any) => {
          requestItems.push({
            id: l.id,
            type: 'loan',
            title: 'Loan Application',
            subtitle: l.loan_type_name,
            amount: l.requested_amount,
            status: l.status,
            created_at: l.created_at,
            data: l
          });
        });
      } catch (e) { console.error('Error loading loans', e); }

      // Load Promotions
      try {
        const promotionsResponse = await promotionAPI.getStaffPromotions(user.staff_id);
        const promotionsData = Array.isArray(promotionsResponse) ? promotionsResponse : (promotionsResponse?.data || []);
        const promotions = Array.isArray(promotionsData) ? promotionsData : [];
        promotions.forEach((p: any) => {
          requestItems.push({
            id: p.id,
            type: 'promotion',
            title: 'Promotion Request',
            subtitle: `Grade ${p.old_grade_level ?? 'N/A'} to ${p.new_grade_level ?? 'N/A'}`,
            status: p.status,
            created_at: p.created_at,
            data: p
          });
        });
      } catch (e) { console.error('Error loading promotions', e); }

      // Load General Requests
      try {
        const requests = await staffPortalAPI.getStaffRequests(user.staff_id);
        requests.forEach((r: any) => {
          requestItems.push({
            id: r.id,
            type: 'general',
            title: 'General Request',
            subtitle: r.request_type.replace('_', ' '),
            status: r.status,
            created_at: r.created_at,
            data: r
          });
        });
      } catch (e) { console.error('Error loading general requests', e); }

      // Sort by date desc
      requestItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setItems(requestItems);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: RequestType) => {
    switch (type) {
      case 'leave': return Calendar;
      case 'loan': return Wallet;
      case 'promotion': return Award;
      case 'arrear': return TrendingUp;
      case 'general': return FileText;
      default: return FileText;
    }
  };

  const columns = [
    {
      header: 'Type',
      accessor: (row: RequestItem) => {
        const Icon = getTypeIcon(row.type);
        return (
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-primary/10`}>
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="capitalize font-medium">{row.type}</span>
          </div>
        );
      },
    },
    { header: 'Title', accessor: 'title' as keyof RequestItem },
    { header: 'Details', accessor: 'subtitle' as keyof RequestItem },
    {
      header: 'Amount',
      accessor: (row: RequestItem) => row.amount ? formatCurrency(row.amount) : '-',
    },
    {
      header: 'Status',
      accessor: (row: RequestItem) => <StatusBadge status={row.status as any} />,
    },
    {
      header: 'Date',
      accessor: (row: RequestItem) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(item => {
        if (filter === 'pending') return ['pending', 'submitted', 'in_review'].includes(item.status);
        if (filter === 'approved') return ['approved', 'completed'].includes(item.status);
        if (filter === 'rejected') return ['rejected', 'declined'].includes(item.status);
        return true;
      });

  if (loading) return <PageSkeleton mode="table" />;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Requests' }]} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Requests</h1>
          <p className="text-muted-foreground">Track the status of your applications and requests</p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === f 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{items.filter(i => ['pending', 'submitted', 'in_review'].includes(i.status)).length}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold">{items.filter(i => ['approved', 'completed'].includes(i.status)).length}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold">{items.filter(i => ['rejected', 'declined'].includes(i.status)).length}</p>
          </div>
        </div>
      </div>

      <DataTable
        data={filteredItems}
        columns={columns}
        searchable
        searchPlaceholder="Search requests..."
      />
    </div>
  );
}
