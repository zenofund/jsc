import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { staffAPI, staffAllowanceAPI, staffDeductionAPI, allowanceAPI, deductionAPI } from '../lib/api-client';
import { Staff, StaffAllowance, StaffDeduction, Allowance, Deduction } from '../types/entities';
import { Plus, Edit, Trash2, DollarSign, User, Calendar, X, Loader2, MoreVertical } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageSkeleton } from '../components/PageLoader';
import { StaffSearch } from '../components/ui/StaffSearch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

type TabType = 'allowances' | 'deductions';
type EntryMode = 'configured' | 'custom';
type FrequencyType = 'recurring' | 'one-time';

type StaffAllowanceFormData = {
  entry_mode: EntryMode;
  allowance_id: string;
  allowance_code: string;
  allowance_name: string;
  type: 'fixed' | 'percentage';
  calculation_basis: 'basic' | 'gross';
  amount: number | string;
  percentage: number | string;
  frequency: FrequencyType;
  is_taxable: boolean;
  is_pensionable: boolean;
  effective_from: string;
  effective_to: string;
  notes: string;
};

type StaffDeductionFormData = {
  entry_mode: EntryMode;
  deduction_id: string;
  deduction_code: string;
  deduction_name: string;
  type: 'fixed' | 'percentage';
  calculation_basis: 'basic' | 'gross';
  amount: number | string;
  percentage: number | string;
  frequency: FrequencyType;
  effective_from: string;
  effective_to: string;
  notes: string;
};

const LAGOS_TIMEZONE = 'Africa/Lagos';
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getDatePartsInLagos = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';

  return { year, month, day };
};

const getCurrentMonthValue = () => {
  const { year, month } = getDatePartsInLagos(new Date());
  return `${year}-${month}`;
};

const normalizeAdjustmentDateValue = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { monthValue: '', displayValue: '' };
  }

  const plainDateMatch = raw.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (plainDateMatch) {
    const [, year, month, day] = plainDateMatch;
    return {
      monthValue: `${year}-${month}`,
      displayValue: day ? `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}, ${year}` : `${MONTH_NAMES[Number(month) - 1]} ${year}`,
    };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { monthValue: raw.substring(0, 7), displayValue: raw };
  }

  const { year, month, day } = getDatePartsInLagos(parsed);
  return {
    monthValue: `${year}-${month}`,
    displayValue: `${MONTH_NAMES[Number(month) - 1]} ${Number(day)}, ${year}`,
  };
};

const hasEmptyNumericField = (value: unknown) =>
  value === '' || value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

const parseNumericField = (value: unknown) => {
  if (hasEmptyNumericField(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildAllowanceFormState = (
  initialData?: StaffAllowance | null,
  allowanceOptions: Allowance[] = [],
): StaffAllowanceFormData => {
  if (!initialData) {
    return {
      entry_mode: 'configured',
      allowance_id: '',
      allowance_code: '',
      allowance_name: '',
      type: 'fixed',
      calculation_basis: 'basic',
      amount: 0,
      percentage: 0,
      frequency: 'recurring',
      is_taxable: true,
      is_pensionable: false,
      effective_from: getCurrentMonthValue(),
      effective_to: '',
      notes: '',
    };
  }

  const match = allowanceOptions.find((a) => a.code === initialData.allowance_code);
  return {
    entry_mode: (initialData.entry_mode ?? (initialData.allowance_id ? 'configured' : 'custom')) as EntryMode,
    allowance_id: initialData.allowance_id ?? match?.id ?? '',
    allowance_code: initialData.allowance_code ?? '',
    allowance_name: initialData.allowance_name ?? '',
    type: (initialData.type ?? 'fixed') as 'fixed' | 'percentage',
    calculation_basis: (initialData.calculation_basis ?? 'basic') as 'basic' | 'gross',
    amount: initialData.amount ?? 0,
    percentage: initialData.percentage ?? 0,
    frequency: (initialData.frequency ?? 'recurring') as FrequencyType,
    is_taxable: initialData.is_taxable ?? true,
    is_pensionable: initialData.is_pensionable ?? false,
    effective_from: normalizeAdjustmentDateValue(initialData.effective_from).monthValue || getCurrentMonthValue(),
    effective_to: normalizeAdjustmentDateValue(initialData.effective_to).monthValue,
    notes: initialData.notes ?? '',
  };
};

const buildDeductionFormState = (
  initialData?: StaffDeduction | null,
  deductionOptions: Deduction[] = [],
): StaffDeductionFormData => {
  if (!initialData) {
    return {
      entry_mode: 'configured',
      deduction_id: '',
      deduction_code: '',
      deduction_name: '',
      type: 'fixed',
      calculation_basis: 'basic',
      amount: 0,
      percentage: 0,
      frequency: 'recurring',
      effective_from: getCurrentMonthValue(),
      effective_to: '',
      notes: '',
    };
  }

  const match = deductionOptions.find((d) => d.code === initialData.deduction_code);
  return {
    entry_mode: (initialData.entry_mode ?? (initialData.deduction_id ? 'configured' : 'custom')) as EntryMode,
    deduction_id: initialData.deduction_id ?? match?.id ?? '',
    deduction_code: initialData.deduction_code ?? '',
    deduction_name: initialData.deduction_name ?? '',
    type: (initialData.type ?? 'fixed') as 'fixed' | 'percentage',
    calculation_basis: (initialData.calculation_basis ?? 'basic') as 'basic' | 'gross',
    amount: initialData.amount ?? 0,
    percentage: initialData.percentage ?? 0,
    frequency: (initialData.frequency ?? 'recurring') as FrequencyType,
    effective_from: normalizeAdjustmentDateValue(initialData.effective_from).monthValue || getCurrentMonthValue(),
    effective_to: normalizeAdjustmentDateValue(initialData.effective_to).monthValue,
    notes: initialData.notes ?? '',
  };
};

function StaffAllowanceForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  allowanceOptions,
}: {
  initialData?: StaffAllowance | null;
  onSubmit: (data: StaffAllowanceFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  allowanceOptions: Allowance[];
}) {
  const [localFormData, setLocalFormData] = useState<StaffAllowanceFormData>(() =>
    buildAllowanceFormState(initialData, allowanceOptions),
  );

  useEffect(() => {
    if (!initialData) return;
    setLocalFormData(buildAllowanceFormState(initialData, allowanceOptions));
  }, [initialData?.id, allowanceOptions]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Entry Method</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLocalFormData((prev) => ({ ...prev, entry_mode: 'configured' }))}
            className={`rounded-md border px-3 py-2 text-sm ${
              localFormData.entry_mode === 'configured'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            Configured Item
          </button>
          <button
            type="button"
            onClick={() =>
              setLocalFormData((prev) => ({
                ...prev,
                entry_mode: 'custom',
                allowance_id: '',
              }))
            }
            className={`rounded-md border px-3 py-2 text-sm ${
              localFormData.entry_mode === 'custom'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            Custom Item
          </button>
        </div>
      </div>

      {localFormData.entry_mode === 'configured' ? (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Allowance *</label>
          <select
            value={localFormData.allowance_id}
            onChange={(e) => {
              const selected = allowanceOptions.find((a) => a.id === e.target.value);
              if (!selected) {
                setLocalFormData((prev) => ({
                  ...prev,
                  allowance_id: e.target.value,
                }));
                return;
              }
              setLocalFormData((prev) => ({
                ...prev,
                allowance_id: selected.id,
                allowance_code: selected.code,
                allowance_name: selected.name,
                type: selected.type as 'fixed' | 'percentage',
                calculation_basis: (selected.calculation_basis ?? 'basic') as 'basic' | 'gross',
                is_taxable: selected.is_taxable,
                is_pensionable: selected.is_pensionable,
                amount: selected.type === 'fixed' ? (selected.amount ?? 0) : prev.amount,
                percentage: selected.type === 'percentage' ? (selected.percentage ?? 0) : prev.percentage,
              }));
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
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Allowance Name *</label>
            <input
              type="text"
              value={localFormData.allowance_name}
              onChange={(e) => setLocalFormData((prev) => ({ ...prev, allowance_name: e.target.value }))}
              placeholder="e.g. Special Duty Allowance"
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Code (Optional)</label>
            <input
              type="text"
              value={localFormData.allowance_code}
              onChange={(e) =>
                setLocalFormData((prev) => ({ ...prev, allowance_code: e.target.value.toUpperCase() }))
              }
              placeholder="e.g. SPEC_DUTY"
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Type</label>
          <select
            value={localFormData.type}
            disabled={localFormData.entry_mode === 'configured'}
            onChange={(e) =>
              setLocalFormData((prev) => ({ ...prev, type: e.target.value as 'fixed' | 'percentage' }))
            }
            className={`w-full p-2 border border-border rounded-md text-foreground ${
              localFormData.entry_mode === 'configured' ? 'bg-muted' : 'bg-background'
            }`}
          >
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {localFormData.type === 'fixed' ? 'Amount (₦)' : 'Percentage (%)'}
          </label>
          <input
            type="number"
            value={localFormData.type === 'fixed' ? localFormData.amount : localFormData.percentage}
            onChange={(e) =>
              setLocalFormData((prev) => ({
                ...prev,
                [prev.type === 'fixed' ? 'amount' : 'percentage']: e.target.value,
              }))
            }
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>
      </div>

      {localFormData.type === 'percentage' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Calculation Basis</label>
          <label
            className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 ${
              localFormData.entry_mode === 'configured'
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'cursor-pointer bg-background text-foreground'
            }`}
          >
            <input
              type="checkbox"
              checked={localFormData.calculation_basis === 'gross'}
              disabled={localFormData.entry_mode === 'configured'}
              onChange={(e) =>
                setLocalFormData((prev) => ({
                  ...prev,
                  calculation_basis: e.target.checked ? 'gross' : 'basic',
                }))
              }
              className="size-4"
            />
            <span className="text-sm">Calculate on Gross Salary</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {localFormData.entry_mode === 'configured'
              ? 'Inherited from the configured allowance.'
              : 'Unchecked uses Basic Salary.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Frequency</label>
          <select
            value={localFormData.frequency}
            onChange={(e) =>
              setLocalFormData((prev) => ({ ...prev, frequency: e.target.value as FrequencyType }))
            }
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
              disabled={localFormData.entry_mode === 'configured'}
              onChange={(e) => setLocalFormData((prev) => ({ ...prev, is_taxable: e.target.checked }))}
              className="size-4"
            />
            <span className="text-sm text-foreground">Taxable</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localFormData.is_pensionable}
              disabled={localFormData.entry_mode === 'configured'}
              onChange={(e) => setLocalFormData((prev) => ({ ...prev, is_pensionable: e.target.checked }))}
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
            onChange={(e) => setLocalFormData((prev) => ({ ...prev, effective_from: e.target.value }))}
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Effective To (Optional)</label>
          <input
            type="month"
            value={localFormData.effective_to}
            onChange={(e) => setLocalFormData((prev) => ({ ...prev, effective_to: e.target.value }))}
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
        <textarea
          value={localFormData.notes}
          onChange={(e) => setLocalFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={3}
          placeholder="Reason for allowance..."
          className="w-full p-2 border border-border rounded-md bg-background text-foreground"
        />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <button onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>
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
}

function StaffDeductionForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  deductionOptions,
}: {
  initialData?: StaffDeduction | null;
  onSubmit: (data: StaffDeductionFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  deductionOptions: Deduction[];
}) {
  const [localFormData, setLocalFormData] = useState<StaffDeductionFormData>(() =>
    buildDeductionFormState(initialData, deductionOptions),
  );

  useEffect(() => {
    if (!initialData) return;
    setLocalFormData(buildDeductionFormState(initialData, deductionOptions));
  }, [initialData?.id, deductionOptions]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Entry Method</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLocalFormData((prev) => ({ ...prev, entry_mode: 'configured' }))}
            className={`rounded-md border px-3 py-2 text-sm ${
              localFormData.entry_mode === 'configured'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            Configured Item
          </button>
          <button
            type="button"
            onClick={() =>
              setLocalFormData((prev) => ({
                ...prev,
                entry_mode: 'custom',
                deduction_id: '',
              }))
            }
            className={`rounded-md border px-3 py-2 text-sm ${
              localFormData.entry_mode === 'custom'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            Custom Item
          </button>
        </div>
      </div>

      {localFormData.entry_mode === 'configured' ? (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Deduction *</label>
          <select
            value={localFormData.deduction_id}
            onChange={(e) => {
              const selected = deductionOptions.find((d) => d.id === e.target.value);
              if (!selected) {
                setLocalFormData((prev) => ({
                  ...prev,
                  deduction_id: e.target.value,
                }));
                return;
              }
              setLocalFormData((prev) => ({
                ...prev,
                deduction_id: selected.id,
                deduction_code: selected.code,
                deduction_name: selected.name,
                type: selected.type as 'fixed' | 'percentage',
                calculation_basis: (selected.calculation_basis ?? 'basic') as 'basic' | 'gross',
                amount: selected.type === 'fixed' ? (selected.amount ?? 0) : prev.amount,
                percentage: selected.type === 'percentage' ? (selected.percentage ?? 0) : prev.percentage,
              }));
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
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Deduction Name *</label>
            <input
              type="text"
              value={localFormData.deduction_name}
              onChange={(e) => setLocalFormData((prev) => ({ ...prev, deduction_name: e.target.value }))}
              placeholder="e.g. Staff Recovery"
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Code (Optional)</label>
            <input
              type="text"
              value={localFormData.deduction_code}
              onChange={(e) =>
                setLocalFormData((prev) => ({ ...prev, deduction_code: e.target.value.toUpperCase() }))
              }
              placeholder="e.g. RECOVERY"
              className="w-full p-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Type</label>
          <select
            value={localFormData.type}
            disabled={localFormData.entry_mode === 'configured'}
            onChange={(e) =>
              setLocalFormData((prev) => ({ ...prev, type: e.target.value as 'fixed' | 'percentage' }))
            }
            className={`w-full p-2 border border-border rounded-md text-foreground ${
              localFormData.entry_mode === 'configured' ? 'bg-muted' : 'bg-background'
            }`}
          >
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {localFormData.type === 'fixed' ? 'Amount (₦)' : 'Percentage (%)'}
          </label>
          <input
            type="number"
            value={localFormData.type === 'fixed' ? localFormData.amount : localFormData.percentage}
            onChange={(e) =>
              setLocalFormData((prev) => ({
                ...prev,
                [prev.type === 'fixed' ? 'amount' : 'percentage']: e.target.value,
              }))
            }
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>
      </div>

      {localFormData.type === 'percentage' && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Calculation Basis</label>
          <label
            className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 ${
              localFormData.entry_mode === 'configured'
                ? 'cursor-not-allowed bg-muted text-muted-foreground'
                : 'cursor-pointer bg-background text-foreground'
            }`}
          >
            <input
              type="checkbox"
              checked={localFormData.calculation_basis === 'gross'}
              disabled={localFormData.entry_mode === 'configured'}
              onChange={(e) =>
                setLocalFormData((prev) => ({
                  ...prev,
                  calculation_basis: e.target.checked ? 'gross' : 'basic',
                }))
              }
              className="size-4"
            />
            <span className="text-sm">Calculate on Gross Salary</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {localFormData.entry_mode === 'configured'
              ? 'Inherited from the configured deduction.'
              : 'Unchecked uses Basic Salary.'}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Frequency</label>
        <select
          value={localFormData.frequency}
          onChange={(e) =>
            setLocalFormData((prev) => ({ ...prev, frequency: e.target.value as FrequencyType }))
          }
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
            onChange={(e) => setLocalFormData((prev) => ({ ...prev, effective_from: e.target.value }))}
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Effective To (Optional)</label>
          <input
            type="month"
            value={localFormData.effective_to}
            onChange={(e) => setLocalFormData((prev) => ({ ...prev, effective_to: e.target.value }))}
            className="w-full p-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
        <textarea
          value={localFormData.notes}
          onChange={(e) => setLocalFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={3}
          placeholder="Reason for deduction..."
          className="w-full p-2 border border-border rounded-md bg-background text-foreground"
        />
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <button onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>
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
}

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
  
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unwrapApiData = <T,>(value: T[] | { data?: T[] } | null | undefined): T[] => {
    if (Array.isArray(value)) return value;
    return Array.isArray(value?.data) ? value.data : [];
  };

  const isActive = (item: any) => String(item?.status ?? 'active').toLowerCase() === 'active';

  const isStaffSpecificCatalogItem = (item: any) => {
    const value = item?.applies_to_all ?? item?.appliesToAll;
    return value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false';
  };

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
        const filteredAllowances = unwrapApiData<Allowance>(allowances).filter(
          (a: any) => isActive(a) && isStaffSpecificCatalogItem(a),
        );
        const filteredDeductions = unwrapApiData<Deduction>(deductions).filter(
          (d: any) => isActive(d) && isStaffSpecificCatalogItem(d),
        );
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
      
      setStaffAllowances(unwrapApiData<StaffAllowance>(allowances));
      setStaffDeductions(unwrapApiData<StaffDeduction>(deductions));
    } catch (error) {
      showToast('error', 'Failed to load staff items');
    }
  };
// ... existing code ...

  const handleCreateAllowance = () => {
    setEditingAllowance(null);
    setShowAllowanceModal(true);
  };

  const handleEditAllowance = (allowance: StaffAllowance) => {
    setEditingAllowance(allowance);
    setShowAllowanceModal(true);
  };

  const handleSaveAllowance = async (formData: any) => {
    if (!selectedStaff) {
      showToast('error', 'Please select a staff member');
      return;
    }
    if (formData.entry_mode === 'configured' && !formData.allowance_id) {
      showToast('error', 'Please select an allowance');
      return;
    }
    if (formData.entry_mode === 'custom' && !String(formData.allowance_name || '').trim()) {
      showToast('error', 'Please enter an allowance name');
      return;
    }
    if (formData.type === 'fixed' && hasEmptyNumericField(formData.amount)) {
      showToast('error', 'Please enter an amount');
      return;
    }
    if (formData.type === 'percentage' && hasEmptyNumericField(formData.percentage)) {
      showToast('error', 'Please enter a percentage');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        staff_id: selectedStaff.id,
        staff_number: selectedStaff.staff_number,
        staff_name: `${selectedStaff.bio_data.first_name} ${selectedStaff.bio_data.last_name}`,
        entry_mode: formData.entry_mode,
        allowance_id: formData.entry_mode === 'configured' ? formData.allowance_id : null,
        allowance_code: formData.allowance_code,
        allowance_name: formData.allowance_name,
        type: formData.type,
        calculation_basis: formData.calculation_basis,
        amount: formData.type === 'fixed' ? parseNumericField(formData.amount) : undefined,
        percentage: formData.type === 'percentage' ? parseNumericField(formData.percentage) : undefined,
        frequency: formData.frequency,
        is_taxable: formData.is_taxable,
        is_pensionable: formData.is_pensionable,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || (formData.frequency === 'one-time' ? formData.effective_from : null),
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
    if (!selectedStaff) {
      showToast('error', 'Please select a staff member');
      return;
    }
    if (formData.entry_mode === 'configured' && !formData.deduction_id) {
      showToast('error', 'Please select a deduction');
      return;
    }
    if (formData.entry_mode === 'custom' && !String(formData.deduction_name || '').trim()) {
      showToast('error', 'Please enter a deduction name');
      return;
    }
    if (formData.type === 'fixed' && hasEmptyNumericField(formData.amount)) {
      showToast('error', 'Please enter an amount');
      return;
    }
    if (formData.type === 'percentage' && hasEmptyNumericField(formData.percentage)) {
      showToast('error', 'Please enter a percentage');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        staff_id: selectedStaff.id,
        staff_number: selectedStaff.staff_number,
        staff_name: `${selectedStaff.bio_data.first_name} ${selectedStaff.bio_data.last_name}`,
        entry_mode: formData.entry_mode,
        deduction_id: formData.entry_mode === 'configured' ? formData.deduction_id : null,
        deduction_code: formData.deduction_code,
        deduction_name: formData.deduction_name,
        type: formData.type,
        calculation_basis: formData.calculation_basis,
        amount: formData.type === 'fixed' ? parseNumericField(formData.amount) : undefined,
        percentage: formData.type === 'percentage' ? parseNumericField(formData.percentage) : undefined,
        frequency: formData.frequency,
        effective_from: formData.effective_from,
        effective_to: formData.effective_to || (formData.frequency === 'one-time' ? formData.effective_from : null),
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
    return normalizeAdjustmentDateValue(dateString).displayValue || dateString;
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
                            {allowance.entry_mode === 'custom' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                Custom
                              </span>
                            )}
                            {allowance.is_taxable && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                Taxable
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Code: {allowance.allowance_code}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-2 hover:bg-accent rounded"
                              disabled={deletingId === allowance.id}
                              aria-label={`Open actions for ${allowance.allowance_name}`}
                            >
                              {deletingId === allowance.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <MoreVertical className="size-4" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditAllowance(allowance)}>
                              <Edit className="size-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete('allowance', allowance.id, allowance.allowance_name)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Amount</p>
                          <p className="font-medium text-foreground">
                            {allowance.type === 'percentage' 
                              ? `${allowance.percentage ?? 0}% of ${allowance.calculation_basis === 'gross' ? 'Gross' : 'Basic'}` 
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
                            {deduction.entry_mode === 'custom' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                Custom
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Code: {deduction.deduction_code}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-2 hover:bg-accent rounded"
                              disabled={deletingId === deduction.id}
                              aria-label={`Open actions for ${deduction.deduction_name}`}
                            >
                              {deletingId === deduction.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <MoreVertical className="size-4" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditDeduction(deduction)}>
                              <Edit className="size-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete('deduction', deduction.id, deduction.deduction_name)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Amount</p>
                          <p className="font-medium text-foreground">
                            {deduction.type === 'percentage' 
                              ? `${deduction.percentage ?? 0}% of ${deduction.calculation_basis === 'gross' ? 'Gross' : 'Basic'}` 
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
