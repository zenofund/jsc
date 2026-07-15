import React from 'react';
import { Modal } from './Modal';
import { Arrears, PayrollBatch } from '../types/entities';
import { Loader2 } from 'lucide-react';

interface MergeArrearsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  arrears: Arrears | null;
  arrearsList?: Arrears[];
  payrollBatches: PayrollBatch[];
  selectedBatchId: string;
  onBatchChange: (batchId: string) => void;
  onMerge: () => void;
  isSubmitting?: boolean;
}

export function MergeArrearsModal({
  isOpen,
  onClose,
  title,
  arrears,
  arrearsList = [],
  payrollBatches,
  selectedBatchId,
  onBatchChange,
  onMerge,
  isSubmitting = false,
}: MergeArrearsModalProps) {
  const items = arrearsList.length > 0 ? arrearsList : arrears ? [arrears] : [];
  if (items.length === 0) return null;

  const isBulk = items.length > 1;
  const totalAmount = items.reduce((sum, item) => sum + Number(item.total_arrears || 0), 0);
  const totalMonths = items.reduce((sum, item) => sum + Number(item.months_owed || 0), 0);
  const uniqueStaffCount = new Set(items.map((item) => item.staff_id)).size;
  const primaryArrears = items[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded-lg">
          <h4 className="font-medium text-foreground mb-2">{isBulk ? 'Selected Arrears Summary' : 'Arrears Details'}</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isBulk ? 'Selected Records:' : 'Staff:'}</span>
              <span className="font-medium text-foreground">{isBulk ? `${items.length} arrears records` : primaryArrears.staff_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isBulk ? 'Staff Count:' : 'Reason:'}</span>
              <span className="font-medium text-foreground">{isBulk ? `${uniqueStaffCount} staff` : primaryArrears.reason}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Months Owed:</span>
              <span className="font-medium text-foreground">{isBulk ? `${totalMonths} months` : `${primaryArrears.months_owed} months`}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 mt-2">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="font-semibold text-primary">₦{Number(totalAmount).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Payroll Batch
          </label>
          <select
            value={selectedBatchId}
            onChange={(e) => onBatchChange(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">-- Select Batch --</option>
            {payrollBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_number} - {batch.month} ({batch.status})
              </option>
            ))}
          </select>
          {payrollBatches.length === 0 && (
            <p className="text-sm text-destructive mt-2">
              No draft payroll batches available. Please create a new payroll batch first.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onMerge}
            disabled={!selectedBatchId || isSubmitting}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Merging...' : isBulk ? `Merge ${items.length} Records` : 'Merge to Payroll'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
