import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Search, 
  Filter
} from 'lucide-react';
import { staffAllowanceAPI, staffDeductionAPI } from '../lib/api-client';
import { useToast } from '../components/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Breadcrumb } from '../components/Breadcrumb';
import { StatusBadge } from '../components/StatusBadge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';

interface AdjustmentItem {
  id: string;
  staff_id: string;
  staff_number: string;
  staff_name: string; // Combined first_name + last_name
  code: string; // allowance_code or deduction_code
  name: string; // allowance_name or deduction_name
  amount: string | number;
  percentage: string | number | null;
  type: string;
  status: string;
  created_at: string;
  effective_from: string;
}

const StaffAdjustmentApprovalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'allowances' | 'deductions'>('allowances');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdjustmentItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // Default to pending items
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const fetchItems = async () => {
    setLoading(true);
    // Clear selection when refreshing/changing filters
    setSelectedIds([]); 
    try {
      let result;
      const query = {
        page,
        limit,
        search: searchTerm,
        status: statusFilter === 'all' ? undefined : statusFilter
      };

      if (activeTab === 'allowances') {
        const response = await staffAllowanceAPI.getAllStaffAllowances(query);
        result = {
          data: response.data.map((item: any) => ({
            id: item.id,
            staff_id: item.staff_id,
            staff_number: item.staff_number,
            staff_name: `${item.first_name} ${item.last_name}`,
            code: item.allowance_code,
            name: item.allowance_name,
            amount: item.amount,
            percentage: item.percentage,
            type: item.type,
            status: item.status,
            created_at: item.created_at,
            effective_from: item.effective_from,
            is_allowance: true
          })),
          meta: response.meta
        };
      } else {
        const response = await staffDeductionAPI.getAllStaffDeductions(query);
        result = {
          data: response.data.map((item: any) => ({
            id: item.id,
            staff_id: item.staff_id,
            staff_number: item.staff_number,
            staff_name: `${item.first_name} ${item.last_name}`,
            code: item.deduction_code,
            name: item.deduction_name,
            amount: item.amount,
            percentage: item.percentage,
            type: item.type,
            status: item.status,
            created_at: item.created_at,
            effective_from: item.effective_from,
            is_allowance: false
          })),
          meta: response.meta
        };
      }

      setItems(result.data);
      setTotalItems(result.meta.total || 0);
    } catch (error) {
      console.error('Error fetching adjustments:', error);
      showToast('error', 'Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab, page, limit, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchItems();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'allowances' | 'deductions');
    setPage(1);
    setItems([]);
  };

  const handleApprove = async (id: string) => {
    try {
      if (activeTab === 'allowances') {
        await staffAllowanceAPI.updateStaffAllowance(id, { status: 'active' }, '', '');
      } else {
        await staffDeductionAPI.updateStaffDeduction(id, { status: 'active' }, '', '');
      }
      showToast('success', 'Item approved successfully');
      fetchItems();
    } catch (error) {
      console.error('Error approving item:', error);
      showToast('error', 'Failed to approve item');
    }
  };

  const handleReject = async (id: string) => {
    const confirmed = await confirm('Are you sure you want to reject this item? It will be deactivated.');
    if (!confirmed) return;
    
    try {
      if (activeTab === 'allowances') {
        await staffAllowanceAPI.updateStaffAllowance(id, { status: 'inactive' }, '', '');
      } else {
        await staffDeductionAPI.updateStaffDeduction(id, { status: 'inactive' }, '', '');
      }
      showToast('success', 'Item rejected/deactivated');
      fetchItems();
    } catch (error) {
      console.error('Error rejecting item:', error);
      showToast('error', 'Failed to reject item');
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.length === 0) return;
    
    const actionText = action === 'approve' ? 'approve' : 'reject';
    const status = action === 'approve' ? 'active' : 'inactive';
    
    const confirmed = await confirm(`Are you sure you want to ${actionText} ${selectedIds.length} items?`);
    if (!confirmed) return;
    
    try {
      if (activeTab === 'allowances') {
        await staffAllowanceAPI.bulkUpdateStatus(selectedIds, status);
      } else {
        await staffDeductionAPI.bulkUpdateStatus(selectedIds, status);
      }
      showToast('success', `${selectedIds.length} items ${action}d successfully`);
      fetchItems();
    } catch (error) {
      console.error(`Error ${action}ing items:`, error);
      showToast('error', `Failed to ${action} items`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const totalPages = Math.ceil(totalItems / limit);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Staff Adjustment Approvals' }]} />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Adjustment Approvals</h1>
          <p className="text-muted-foreground">Review and approve staff allowances and deductions submitted by Payroll Loaders.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 border-b border-border space-y-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
              <TabsTrigger value="allowances">Allowances</TabsTrigger>
              <TabsTrigger value="deductions">Deductions</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
               {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{selectedIds.length} selected</span>
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleBulkAction('approve')}
                  >
                    <Check className="w-4 h-4 mr-1" /> Approve Selected
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleBulkAction('reject')}
                  >
                    <X className="w-4 h-4 mr-1" /> Reject Selected
                  </Button>
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or staff number..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              <button 
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === 'pending' 
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' 
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Pending
              </button>
              <button 
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === 'active' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Active
              </button>
              <button 
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === 'all' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input 
                    type="checkbox" 
                    checked={items.length > 0 && selectedIds.length === items.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="flex justify-center mb-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                    Loading data...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No items found matching your criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelectOne(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.staff_name}</div>
                      <div className="text-xs text-muted-foreground">{item.staff_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.code}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                       {item.type === 'fixed' 
                        ? `₦${parseFloat(item.amount as string).toLocaleString()}` 
                        : `${item.percentage}% (of Basic)`}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status as any} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700 text-white h-8 px-2"
                            onClick={() => handleApprove(item.id)}
                            title="Approve"
                          >
                            <Check className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            className="h-8 px-2"
                            onClick={() => handleReject(item.id)}
                            title="Reject"
                          >
                            <X className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {items.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalItems)} of {totalItems} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffAdjustmentApprovalPage;
