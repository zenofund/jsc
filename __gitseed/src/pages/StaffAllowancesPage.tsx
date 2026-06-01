import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { staffAPI, staffAllowanceAPI, staffDeductionAPI, allowanceAPI, deductionAPI } from '../lib/api-client';
import { Staff, StaffAllowance, StaffDeduction, Allowance, Deduction } from '../types/entities';
import { Plus, Edit, Trash2, DollarSign, User, Calendar, X, Loader2 } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageSkeleton } from '../components/PageLoader';
import { StaffSearch } from '../components/ui/StaffSearch';

type TabType = 'allowances' | 'deductions';

export function StaffAllowancesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  
  const [activeTab, setActiveTab] = useState<TabType>('allowances');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [staffAllowances, setStaffAllowances] = useState<StaffAllowance[]>([]);
  const [staffDeductions, setStaffDeductions] = useState<StaffDeduction[]>([]);
  const [allowanceOptions, setAllowanceOptions] = useState<Allowance[]>([]);
  const [deductionOptions, setDeductionOptions] = useState<Deduction[]>([]);
  
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<StaffAllowance | null>(null);
  const [editingDeduction, setEditingDeduction] = useState<StaffDeduction | null>(null);
  
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedStaff) {
      loadStaffItems();
    }
  }, [selectedStaff]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [allowances, deductions] = await Promise.all([
          allowanceAPI.getAllAllowances(),
          deductionAPI.getAllDeductions(),
        ]);
        const filteredAllowances = (allowances || []).filter((a: any) => a.status === 'active' && a.applies_to_all === false);
        const filteredDeductions = (deductions || []).filter((d: any) => d.status === 'active' && d.applies_to_all === false);
        setAllowanceOptions(filteredAllowances);
        setDeductionOptions(filteredDeductions);
      } catch (error: any) {
        showToast('error', error.message || 'Failed to load allowance/deduction catalog');
      }
    };
    loadCatalog();
  }, []);

// ... existing code ...
  const loadStaffItems = async () => {
    if (!selectedStaff) return;
    
    try {
      const [allowances, deductions] = await Promise.all([
        staffAllowanceAPI.getStaffAllowances(selectedStaff.id),
        staffDeductionAPI.getStaffDeductions(selectedStaff.id),
      ]);
      
      setStaffAllowances(allowances);
      setStaffDeductions(deductions);
    } catch (error) {
      showToast('error', 'Failed to load staff items');
    }
  };
// ... existing code ...

  const StaffAllowanceForm = ({ 
    initialData, 
    onSubmit, 
    onCancel, 
    isSubmitting,
    allowanceOptions,
  }: { 
    initialData?: StaffAllowance | null, 
    onSubmit: (data: any) => void, 
    onCancel: () => void, 
    isSubmitting: boolean,
    allowanceOptions: Allowance[],
  }) => {
    const [localFormData, setLocalFormData] = useState({
      allowance_id: '',
      allowance_code: initialData?.allowance_code ?? '',
      allowance_name: initialData?.allowance_name ?? '',
      type: initialData?.type ?? 'fixed',
      amount: initialData?.amount ?? 0,
      percentage: initialData?.percentage ?? 0,
      frequency: initialData?.frequency ?? 'recurring',
      is_taxable: initialData?.is_taxable ?? true,
      is_pensionable: initialData?.is_pensionable ?? false,
      effective_from: initialData?.effective_from ? initialData.effective_from.substring(0, 7) : new Date().toISOString().substring(0, 7),
      effective_to: initialData?.effective_to ? initialData.effective_to.substring(0, 7) : '',
      notes: initialData?.notes ?? '',
    });

    // Update state when initialData changes
    useEffect(() => {
      if (initialData) {
        const match = allowanceOptions.find((a) => a.code === initialData.allowance_code);
        setLocalFormData({
          allowance_id: match?.id || '',
          allowance_code: initialData.allowance_code ?? '',
          allowance_name: initialData.allowance_name ?? '',
          type: initialData.type ?? 'fixed',
          amount: initialData.amount ?? 0,
          percentage: initialData.percentage ?? 0,
          frequency: initialData.frequency ?? 'recurring',
          is_taxable: initialData.is_taxable ?? true,
          is_pensionable: initialData.is_pensionable ?? false,
          effective_from: initialData.effective_from ? initialData.effective_from.substring(0, 7) : new Date().toISOString().substring(0, 7),
          effective_to: initialData.effective_to ? initialData.effective_to.substring(0, 7) : '',
          notes: initialData.notes ?? '',
        });
      }
    }, [initialData, allowanceOptions]);

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Allowance *
          </label>
          <select
            value={localFormData.allowance_id}
            onChange={(e) => {
              const selected = allowanceOptions.find((a) => a.id === e.target.value);
              if (!selected) {
                setLocalFormData({
                  ...localFormData,
                  allowance_id: e.target.value,
                });
                return;
              }
              setLocalFormData({
                ...localFormData,
                allowance_id: selected.id,
                allowance_code: selected.code,
                allowance_name: selected.name,
                type: selected.type,
                is_taxable: selected.is_taxable,
                is_pensionable: selected.is_pensionable,
                amount: selected.type === 'fixed' ? (selected.amount ?? 0) : localFormData.amount,
                percentage: selected.type === 'percentage' ? (selected.percentage ?? 0) : localFormData.percentage,
              });
            }}
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="">-- Select Allowance --</option>
            {allowanceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code} - {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Type</label>
            <select
              value={localFormData.type}
              disabled
              className="w-full p-2 border border-border rounded-md bg-muted text-foreground"
            >
              <option value="fixed">Fixed Amount</option>
              <option value="percentage">Percentage of Basic</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {localFormData.type === 'fixed' ? 'Amount (₦)' : 'Percentage (%)'}
            </label>
            <input
              type="number"
              value={localFormData.type === 'fixed' ? localFormData.amount : localFormData.percentage}
              onChange={(e) => setLocalFormData({
                ...localFormData,
                [localFormData.type === 'fixed' ? 'amount' : 'percentage']: e.target.value
              })}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Frequency</label>
            <select
              value={localFormData.frequency}
              onChange={(e) => setLocalFormData({ ...localFormData, frequency: e.target.value as 'recurring' | 'one-time' })}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="recurring">Recurring (Monthly)</option>
              <option value="one-time">One-Time</option>
            </select>
          </div>

          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localFormData.is_taxable}
                disabled
                className="size-4"
              />
              <span className="text-sm text-foreground">Taxable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localFormData.is_pensionable}
                disabled
                className="size-4"
              />
              <span className="text-sm text-foreground">Pensionable</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Effective From</label>
            <input
              type="month"
              value={localFormData.effective_from}
              onChange={(e) => setLocalFormData({ ...localFormData, effective_from: e.target.value })}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Effective To (Optional)
            </label>
            <input
              type="month"
              value={localFormData.effective_to}
              onChange={(e) => setLocalFormData({ ...localFormData, effective_to: e.target.value })}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
          <textarea
            value={localFormData.notes}
            onChange={(e) => setLocalFormData({ ...localFormData, notes: e.target.value })}
            rows={3}
            placeholder="Reason for allowance..."
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={onCancel}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(localFormData)}
            className="btn-primary flex items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {initialData ? 'Update' : 'Create'} Allowance
          </button>
        </div>
      </div>
    );
  };

  const StaffDeductionForm = ({ 
    initialData, 
    onSubmit, 
    onCancel, 
    isSubmitting,
    deductionOptions,
  }: { 
    initialData?: StaffDeduction | null, 
    onSubmit: (data: any) => void, 
    onCancel: () => void, 
    isSubmitting: boolean,
    deductionOptions: Deduction[],
  }) => {
    const [localFormData, setLocalFormData] = useState({
      deduction_id: '',
      deduction_code: initialData?.deduction_code ?? '',
      deduction_name: initialData?.deduction_name ?? '',
      type: initialData?.type ?? 'fixed',
      amount: initialData?.amount ?? 0,
      percentage: initialData?.percentage ?? 0,
      frequency: initialData?.frequency ?? 'recurring',
      effective_from: initialData?.effective_from ? initialData.effective_from.substring(0, 7) : new Date().toISOString().substring(0, 7),
      effective_to: initialData?.effective_to ? initialData.effective_to.substring(0, 7) : '',
      notes: initialData?.notes ?? '',
    });

    // Update state when initialData changes
    useEffect(() => {
      if (initialData) {
        const match = deductionOptions.find((d) => d.code === initialData.deduction_code);
        setLocalFormData({
          deduction_id: match?.id || '',
          deduction_code: initialData.deduction_code ?? '',
          deduction_name: initialData.deduction_name ?? '',
          type: initialData.type ?? 'fixed',
          amount: initialData.amount ?? 0,
          percentage: initialData.percentage ?? 0,
          frequency: initialData.frequency ?? 'recurring',
          effective_from: initialData.effective_from ? initialData.effective_from.substring(0, 7) : new Date().toISOString().substring(0, 7),
          effective_to: initialData.effective_to ? initialData.effective_to.substring(0, 7) : '',
          notes: initialData.notes ?? '',
        });
      }
    }, [initialData, deductionOptions]);

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Deduction *
          </label>
          <select
            value={localFormData.deduction_id}
            onChange={(e) => {
              const selected = deductionOptions.find((d) => d.id === e.target.value);
              if (!selected) {
                setLocalFormData({
                  ...localFormData,
                  deduction_id: e.target.value,
                });
                return;
              }
              setLocalFormData({
                ...localFormData,
                deduction_id: selected.id,
                deduction_code: selected.code,
                deduction_name: selected.name,
                type: selected.type,
                amount: selected.type === 'fixed' ? (selected.amount ?? 0) : localFormData.amount,
                percentage: selected.type === 'percentage' ? (selected.percentage ?? 0) : localFormData.percentage,
              });
            }}
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="">-- Select Deduction --</option>
            {deductionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.code} - {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Type</label>
            <select
              value={localFormData.type}
              disabled
              className="w-full p-2 border border-border rounded-md bg-muted text-foreground"
            >
              <option value="fixed">Fixed Amount</option>
              <option value="percentage">Percentage of Gross</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {localFormData.type === 'fixed' ? 'Amount (₦)' : 'Percentage (%)'}
            </label>
            <input
              type="number"
              value={localFormData.type === 'fixed' ? localFormData.amount : localFormData.percentage}
              onChange={(e) => setLocalFormData({
                ...localFormData,
                [localFormData.type === 'fixed' ? 'amount' : 'percentage']: e.target.value
              })}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Frequency</label>
          <select
            value={localFormData.frequency}
            onChange={(e) => setLocalFormData({ ...localFormData, frequency: e.target.value as 'recurring' | 'one-time' })}
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="recurring">Recurring (Monthly)</option>
            <option value="one-time">One-Time</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Effective From</label>
            <input
              type="month"
              value={localFormData.effective_from}
              onChange={(e) => setLocalFormData({ ...localFormData, effective_from: e.target.value })}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Effective To (Optional)
            </label>
            <input
              type="month"
              value={localFormData.effective_to}
              onChange={(e) => setLocalFormData({ ...localFormData, effective_to: e.target.value })}
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
          <textarea
            value={localFormData.notes}
            onChange={(e) => setLocalFormData({ ...localFormData, notes: e.target.value })}
            rows={3}
            placeholder="Reason for deduction..."
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={onCancel}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(localFormData)}
            className="btn-primary flex items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {initialData ? 'Update' : 'Create'} Deduction
          </button>
        </div>
      </div>
    );
  };

  const handleCreateAllowance = () => {
    setEditingAllowance(null);
    setShowAllowanceModal(true);
  };

  const handleEditAllowance = (allowance: StaffAllowance) => {
    setEditingAllowance(allowance);
    setShowAllowanceModal(true);
  };

  const handleSaveAllowance = async (formData: any) => {
    if (!selectedStaff || !formData.allowance_id) {
      showToast('error', 'Please select an allowance');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        staff_id: selectedStaff.id,
        staff_number: selectedStaff.staff_number,
        staff_name: `${selectedStaff.bio_data.first_name} ${selectedStaff.bio_data.last_name}`,
        allowance_id: formData.allowance_id,
        allowance_code: formData.allowance_code,
        allowance_name: formData.allowance_name,
        type: formData.type,
        amount: formData.type === 'fixed' ? parseFloat(formData.amount) : undefined,
        percentage: formData.type === 'percentage' ? parseFloat(formData.percentage) : undefined,
        frequency: formData.frequency,
        is_taxable: formData.is_taxable,
        is_pensionable: formData.is_pensionable,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || undefined,
        notes: formData.notes,
        created_by: user!.id,
      };

      if (editingAllowance) {
        await staffAllowanceAPI.updateStaffAllowance(editingAllowance.id, data, user!.id, user!.email);
        showToast('success', 'Allowance updated successfully');
      } else {
        await staffAllowanceAPI.createStaffAllowance(data, user!.id, user!.email);
        showToast('success', 'Allowance created successfully');
      }

      setShowAllowanceModal(false);
      loadStaffItems();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to save allowance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDeduction = () => {
    setEditingDeduction(null);
    setShowDeductionModal(true);
  };

  const handleEditDeduction = (deduction: StaffDeduction) => {
    setEditingDeduction(deduction);
    setShowDeductionModal(true);
  };

  const handleSaveDeduction = async (formData: any) => {
    if (!selectedStaff || !formData.deduction_id) {
      showToast('error', 'Please select a deduction');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        staff_id: selectedStaff.id,
        staff_number: selectedStaff.staff_number,
        staff_name: `${selectedStaff.bio_data.first_name} ${selectedStaff.bio_data.last_name}`,
        deduction_id: formData.deduction_id,
        deduction_code: formData.deduction_code,
        deduction_name: formData.deduction_name,
        type: formData.type,
        amount: formData.type === 'fixed' ? parseFloat(formData.amount) : undefined,
        percentage: formData.type === 'percentage' ? parseFloat(formData.percentage) : undefined,
        frequency: formData.frequency,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || undefined,
        notes: formData.notes,
        created_by: user!.id,
      };

      if (editingDeduction) {
        await staffDeductionAPI.updateStaffDeduction(editingDeduction.id, data, user!.id, user!.email);
        showToast('success', 'Deduction updated successfully');
      } else {
        await staffDeductionAPI.createStaffDeduction(data, user!.id, user!.email);
        showToast('success', 'Deduction created successfully');
      }

      setShowDeductionModal(false);
      loadStaffItems();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to save deduction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (type: 'allowance' | 'deduction', id: string, title: string) => {
    const confirmed = await confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`);
    if (!confirmed) return;
    
    setDeletingId(id);
    setIsSubmitting(true);
    try {
      if (type === 'allowance') {
        await staffAllowanceAPI.deleteStaffAllowance(id, user!.id, user!.email);
        showToast('success', 'Allowance deleted successfully');
      } else {
        await staffDeductionAPI.deleteStaffDeduction(id, user!.id, user!.email);
        showToast('success', 'Deduction deleted successfully');
      }
      loadStaffItems();
    } catch (error) {
      showToast('error', `Failed to delete ${type}`);
    } finally {
      setIsSubmitting(false);
      setDeletingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return <PageSkeleton mode="detail" />;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Adjustments' }]} />
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Adjustments</h1>
          <p className="text-muted-foreground">Manage individual staff allowances, deductions, and one-time adjustments</p>
        </div>
      </div>

      {/* Staff Selector */}
      <div className="bg-card p-4 rounded-lg border border-border mb-6">
        <StaffSearch 
          onSelect={(staff) => setSelectedStaff(staff)} 
          selectedStaff={selectedStaff}
        />
      </div>

      {selectedStaff && (
        <>
          {/* Tabs */}
          <div className="border-b border-border mb-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('allowances')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'allowances'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Allowances ({staffAllowances.length})
              </button>
              <button
                onClick={() => setActiveTab('deductions')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'deductions'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Deductions ({staffDeductions.length})
              </button>
            </div>
          </div>

          {/* Allowances Tab */}
          {activeTab === 'allowances' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-foreground">Staff Allowances</h2>
                <button
                  onClick={handleCreateAllowance}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="size-4" />
                  Add Allowance
                </button>
              </div>

              {staffAllowances.length === 0 ? (
                <div className="bg-card p-8 rounded-lg border border-border text-center">
                  <DollarSign className="size-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No staff-specific allowances configured</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staffAllowances.map(allowance => (
                    <div key={allowance.id} className="bg-card p-4 rounded-lg border border-border">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground">{allowance.allowance_name}</h3>
                            <StatusBadge status={allowance.status} />
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {allowance.frequency === 'one-time' ? 'One-Time' : 'Recurring'}
                            </span>
                            {allowance.is_taxable && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                Taxable
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Code: {allowance.allowance_code}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditAllowance(allowance)}
                            className="p-2 hover:bg-accent rounded"
                            disabled={deletingId === allowance.id}
                          >
                            <Edit className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('allowance', allowance.id, allowance.allowance_name)}
                            className="p-2 hover:bg-destructive/10 rounded text-destructive"
                            disabled={deletingId === allowance.id}
                          >
                            {deletingId === allowance.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Amount</p>
                          <p className="font-medium text-foreground">
                            {allowance.type === 'percentage' 
                              ? `${allowance.percentage ?? 0}% of Basic` 
                              : formatCurrency(allowance.amount ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Effective From</p>
                          <p className="font-medium text-foreground">{formatDate(allowance.effective_from)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Effective To</p>
                          <p className="font-medium text-foreground">{allowance.effective_to ? formatDate(allowance.effective_to) : 'Ongoing'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Applied</p>
                          <p className="font-medium text-foreground">{allowance.applied_months?.length || 0} months</p>
                        </div>
                      </div>
                      
                      {allowance.notes && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-sm text-muted-foreground">{allowance.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deductions Tab */}
          {activeTab === 'deductions' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-foreground">Staff Deductions</h2>
                <button
                  onClick={handleCreateDeduction}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="size-4" />
                  Add Deduction
                </button>
              </div>

              {staffDeductions.length === 0 ? (
                <div className="bg-card p-8 rounded-lg border border-border text-center">
                  <DollarSign className="size-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No staff-specific deductions configured</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {staffDeductions.map(deduction => (
                    <div key={deduction.id} className="bg-card p-4 rounded-lg border border-border">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground">{deduction.deduction_name}</h3>
                            <StatusBadge status={deduction.status} />
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              {deduction.frequency === 'one-time' ? 'One-Time' : 'Recurring'}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">Code: {deduction.deduction_code}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditDeduction(deduction)}
                            className="p-2 hover:bg-accent rounded"
                            disabled={deletingId === deduction.id}
                          >
                            <Edit className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('deduction', deduction.id, deduction.deduction_name)}
                            className="p-2 hover:bg-destructive/10 rounded text-destructive"
                            disabled={deletingId === deduction.id}
                          >
                            {deletingId === deduction.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Amount</p>
                          <p className="font-medium text-foreground">
                            {deduction.type === 'percentage' 
                              ? `${deduction.percentage ?? 0}% of Gross` 
                              : formatCurrency(deduction.amount ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Effective From</p>
                          <p className="font-medium text-foreground">{formatDate(deduction.effective_from)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Effective To</p>
                          <p className="font-medium text-foreground">{deduction.effective_to ? formatDate(deduction.effective_to) : 'Ongoing'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Applied</p>
                          <p className="font-medium text-foreground">{deduction.applied_months?.length || 0} months</p>
                        </div>
                      </div>
                      
                      {deduction.notes && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-sm text-muted-foreground">{deduction.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Allowance Modal */}
      {showAllowanceModal && (
        <Modal
          isOpen={showAllowanceModal}
          onClose={() => setShowAllowanceModal(false)}
          title={editingAllowance ? 'Edit Allowance' : 'Add Staff Allowance'}
        >
          <StaffAllowanceForm
            initialData={editingAllowance}
            onSubmit={handleSaveAllowance}
            onCancel={() => setShowAllowanceModal(false)}
            isSubmitting={isSubmitting}
            allowanceOptions={allowanceOptions}
          />
        </Modal>
      )}

      {/* Deduction Modal */}
      {showDeductionModal && (
        <Modal
          isOpen={showDeductionModal}
          onClose={() => setShowDeductionModal(false)}
          title={editingDeduction ? 'Edit Deduction' : 'Add Staff Deduction'}
        >
          <StaffDeductionForm
            initialData={editingDeduction}
            onSubmit={handleSaveDeduction}
            onCancel={() => setShowDeductionModal(false)}
            isSubmitting={isSubmitting}
            deductionOptions={deductionOptions}
          />
        </Modal>
      )}
    </div>
  );
}
