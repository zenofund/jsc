import React, { useState } from 'react';
import { Modal } from './Modal';
import { Staff } from '../types/entities';
import { Loader2 } from 'lucide-react';
import { StaffSearch } from './ui/StaffSearch';

interface CreateArrearsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export function CreateArrearsModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateArrearsModalProps) {
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    staffId: '',
    reason: 'salary_adjustment',
    basicAmount: '',
    grossAmount: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    description: '',
  });

  const normalizedBasicAmount = String(formData.basicAmount || '').trim();
  const normalizedGrossAmount = String(formData.grossAmount || '').trim();
  const basicAmount = Number(normalizedBasicAmount);
  const grossAmount = Number(normalizedGrossAmount);
  const hasValidAmounts =
    normalizedBasicAmount !== '' &&
    normalizedGrossAmount !== '' &&
    Number.isFinite(basicAmount) &&
    Number.isFinite(grossAmount) &&
    basicAmount >= 0 &&
    grossAmount > 0 &&
    basicAmount <= grossAmount;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffId || !hasValidAmounts || !formData.effectiveDate) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        basicAmount: normalizedBasicAmount,
        grossAmount: normalizedGrossAmount,
      });
      onClose();
      // Reset form
      setFormData({
        staffId: '',
        reason: 'salary_adjustment',
        basicAmount: '',
        grossAmount: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        description: '',
      });
      setSelectedStaff(null);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Manual Arrears / Adjustment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Staff Member
          </label>
          <StaffSearch
            status="active"
            selectedStaff={selectedStaff}
            onSelect={(staff) => {
              setSelectedStaff(staff);
              setFormData({ ...formData, staffId: staff?.id ?? '' });
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Reason
          </label>
          <select
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="salary_adjustment">Salary Adjustment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Basic Arrears (₦)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.basicAmount}
            onChange={(e) => setFormData({ ...formData, basicAmount: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            placeholder="0.00"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The basic-pay portion of the total gross arrears.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Gross Arrears (Total, ₦)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.grossAmount}
            onChange={(e) => setFormData({ ...formData, grossAmount: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            placeholder="0.00"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Total payable, including the basic arrears above. Basic arrears cannot exceed gross arrears.
          </p>
          {normalizedBasicAmount && normalizedGrossAmount && basicAmount > grossAmount && (
            <p className="mt-1 text-xs text-destructive">Basic arrears must not exceed gross arrears.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Effective Date
          </label>
          <input
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
            placeholder="Reason for adjustment..."
          />
        </div>

        <div className="flex gap-3 pt-4">
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
            disabled={isSubmitting || !formData.staffId || !hasValidAmounts}
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
