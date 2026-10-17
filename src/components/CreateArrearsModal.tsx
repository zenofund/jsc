import React, { useState } from 'react';
import { Modal } from './Modal';
import { Staff } from '../types/entities';
import { Loader2 } from 'lucide-react';
import { StaffSearch } from './ui/StaffSearch';

interface CreateArrearsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreview: (data: any) => Promise<any>;
  onSubmit: (data: any) => Promise<void>;
}

const formatCurrency = (value: any) => `₦${Number(value || 0).toLocaleString('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export function CreateArrearsModal({ isOpen, onClose, onPreview, onSubmit }: CreateArrearsModalProps) {
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [formData, setFormData] = useState({
    staffId: '',
    reason: 'salary_adjustment',
    effectiveStartDate: '',
    effectiveEndDate: '',
    description: '',
  });

  const currentPreviewKey = JSON.stringify({
    staffId: formData.staffId,
    effectiveStartDate: formData.effectiveStartDate,
    effectiveEndDate: formData.effectiveEndDate,
  });
  const hasValidPeriod = Boolean(
    formData.staffId && formData.effectiveStartDate && formData.effectiveEndDate &&
    formData.effectiveStartDate <= formData.effectiveEndDate,
  );
  const hasCurrentPreview = Boolean(preview && previewKey === currentPreviewKey);

  const updateForm = (changes: Partial<typeof formData>) => {
    setFormData((current) => ({ ...current, ...changes }));
    setPreview(null);
    setPreviewKey('');
    setPreviewError('');
  };

  const handlePreview = async () => {
    if (!hasValidPeriod) return;
    setIsPreviewing(true);
    setPreviewError('');
    try {
      const result = await onPreview({
        staffId: formData.staffId,
        effectiveStartDate: formData.effectiveStartDate,
        effectiveEndDate: formData.effectiveEndDate,
      });
      setPreview(result);
      setPreviewKey(currentPreviewKey);
    } catch (error: any) {
      setPreview(null);
      setPreviewKey('');
      setPreviewError(error?.message || 'Could not calculate arrears for this period.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasValidPeriod || !hasCurrentPreview) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        description: formData.description.trim(),
      });
      onClose();
      setFormData({
        staffId: '',
        reason: 'salary_adjustment',
        effectiveStartDate: '',
        effectiveEndDate: '',
        description: '',
      });
      setSelectedStaff(null);
      setPreview(null);
      setPreviewKey('');
    } catch {
      // The parent displays the request error.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Manual Salary Arrears">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Staff Member</label>
          <StaffSearch
            status="active"
            selectedStaff={selectedStaff}
            onSelect={(staff) => {
              setSelectedStaff(staff);
              updateForm({ staffId: staff?.id ?? '' });
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Reason</label>
          <select
            value={formData.reason}
            onChange={(event) => updateForm({ reason: event.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="salary_adjustment">Salary Adjustment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Effective Start Date</label>
            <input
              type="date"
              value={formData.effectiveStartDate}
              onChange={(event) => updateForm({ effectiveStartDate: event.target.value })}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Effective End Date</label>
            <input
              type="date"
              value={formData.effectiveEndDate}
              min={formData.effectiveStartDate || undefined}
              onChange={(event) => updateForm({ effectiveEndDate: event.target.value })}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Both dates are inclusive. End the arrears period before dates already covered by the regular payroll.
        </p>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(event) => updateForm({ description: event.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
            placeholder="Optional note for the arrears record"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={!hasValidPeriod || isPreviewing || isSubmitting}
            className="w-full px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPreviewing && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPreviewing ? 'Calculating…' : 'Calculate Arrears Preview'}
          </button>
          {previewError && <p className="mt-2 text-sm text-destructive">{previewError}</p>}
        </div>

        {hasCurrentPreview && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <h3 className="font-medium text-foreground">Calculated Period Breakdown</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Basic arrears</span><span className="text-right">{formatCurrency(preview.totalBasic)}</span>
              <span className="text-muted-foreground">Allowance arrears</span><span className="text-right">{formatCurrency(preview.totalAllowances)}</span>
              <span className="text-muted-foreground">Gross arrears</span><span className="text-right font-medium">{formatCurrency(preview.totalGross)}</span>
              <span className="text-muted-foreground">Configured deductions</span><span className="text-right">{formatCurrency(preview.totalDeductions)}</span>
              <span className="text-muted-foreground">Arrears PAYE</span><span className="text-right">{formatCurrency(preview.totalPaye)}</span>
              <span className="text-muted-foreground font-medium">Net arrears</span><span className="text-right font-semibold">{formatCurrency(preview.totalNet)}</span>
            </div>

            <div className="overflow-x-auto border border-border rounded">
              <table className="min-w-[760px] w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-2 text-left">Month / covered dates</th>
                    <th className="px-2 py-2 text-right">Days</th>
                    <th className="px-2 py-2 text-right">Basic</th>
                    <th className="px-2 py-2 text-right">Allowance</th>
                    <th className="px-2 py-2 text-right">Gross</th>
                    <th className="px-2 py-2 text-right">Deductions</th>
                    <th className="px-2 py-2 text-right">PAYE</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.details || []).map((detail: any, index: number) => (
                    <tr key={`${detail.month}-${index}`} className="border-t border-border">
                      <td className="px-2 py-2">
                        <div>{detail.month}</div>
                        <div className="text-muted-foreground">{detail.effective_start_date} – {detail.effective_end_date}</div>
                      </td>
                      <td className="px-2 py-2 text-right">{detail.eligible_days}/{detail.days_in_month}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(detail.basic_amount)}</td>
                      <td className="px-2 py-2 text-right" title={(detail.allowances || []).map((item: any) => `${item.name}: ${formatCurrency(item.amount)}`).join('\n')}>
                        {formatCurrency(detail.allowance_amount)}
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(detail.gross_amount)}</td>
                      <td className="px-2 py-2 text-right" title={(detail.deductions || []).map((item: any) => `${item.name}: ${formatCurrency(item.amount)}`).join('\n')}>
                        {formatCurrency(detail.total_deductions)}
                        <div className="text-left text-[10px] text-muted-foreground">
                          PAYE reliefs: P {formatCurrency(detail.paye_reliefs?.pension)} · NHF {formatCurrency(detail.paye_reliefs?.nhf)} · NHIA {formatCurrency(detail.paye_reliefs?.nhia)}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(detail.paye_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Allowance percentages and deduction bases come from payroll configuration. Monthly PAYE is prorated by eligible calendar days.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isPreviewing || !hasCurrentPreview}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Arrears
          </button>
        </div>
      </form>
    </Modal>
  );
}
