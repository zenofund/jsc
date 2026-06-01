import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { staffAPI } from '../lib/api-client';
import { Staff } from '../types/entities';
import { Loader2 } from 'lucide-react';

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
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    staffId: '',
    reason: 'salary_adjustment',
    amount: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    description: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadStaff();
    }
  }, [isOpen]);

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const response = await staffAPI.getActiveStaff();
      // Ensure we have an array
      const data = Array.isArray(response) ? response : (response.data || []);
      setStaffList(data);
    } catch (error) {
      console.error('Failed to load staff:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.staffId || !formData.amount || !formData.effectiveDate) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      // Reset form
      setFormData({
        staffId: '',
        reason: 'salary_adjustment',
        amount: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        description: '',
      });
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Manual Adjustment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Staff Member
          </label>
          <select
            value={formData.staffId}
            onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            disabled={loadingStaff}
          >
            <option value="">-- Select Staff --</option>
            {staffList.map((staff) => {
              // Handle both flat (backend) and nested (legacy/frontend-type) structures
              const firstName = staff.bio_data?.first_name || (staff as any).first_name || '';
              const lastName = staff.bio_data?.last_name || (staff as any).last_name || '';
              return (
                <option key={staff.id} value={staff.id}>
                  {staff.staff_number} - {firstName} {lastName}
                </option>
              );
            })}
          </select>
          {loadingStaff && <p className="text-xs text-muted-foreground mt-1">Loading staff...</p>}
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
            Amount (₦)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            required
            placeholder="0.00"
          />
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
            disabled={isSubmitting || !formData.staffId}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Adjustment
          </button>
        </div>
      </form>
    </Modal>
  );
}
