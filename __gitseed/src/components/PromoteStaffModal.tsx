import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, Award, Loader2, Info } from 'lucide-react';
import { salaryStructureAPI } from '../lib/api-client';
import { toast } from 'sonner';

interface PromoteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: {
    id: string;
    staff_number: string;
    bio_data: { first_name: string; middle_name?: string; last_name: string };
    salary_info: {
      grade_level: number;
      step: number;
    };
    appointment: {
      designation: string;
      employment_date: string;
      previous_basic_salary?: number;
    };
  } | null;
  currentBasicSalary: number;
  onPromote: (promotionData: {
    promotionDate: string;
    newGradeLevel: number;
    newStep: number;
    newBasicSalary: number;
    promotionType: string;
    remarks?: string;
  }) => Promise<void>;
}

export function PromoteStaffModal({
  isOpen,
  onClose,
  staff,
  currentBasicSalary,
  onPromote,
}: PromoteStaffModalProps) {
  const [formData, setFormData] = useState({
    promotionDate: '',
    newGradeLevel: 0,
    newStep: 1,
    promotionType: 'regular',
    remarks: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSalary, setIsLoadingSalary] = useState(false);
  const [newBasicSalary, setNewBasicSalary] = useState<number>(0);
  const [salaryStructure, setSalaryStructure] = useState<any>(null);
  const [salaryError, setSalaryError] = useState<string>('');

  // Fetch active salary structure on mount
  useEffect(() => {
    const fetchSalaryStructure = async () => {
      try {
        const structure = await salaryStructureAPI.getActiveStructure();
        setSalaryStructure(structure);
      } catch (error: any) {
        console.error('Error fetching salary structure:', error);
        toast.error('Failed to load salary structure');
      }
    };

    if (isOpen) {
      fetchSalaryStructure();
    }
  }, [isOpen]);

  // Pre-fill form when modal opens
  useEffect(() => {
    if (staff && isOpen) {
      const newGradeLevel = staff.salary_info.grade_level + 1;
      const newStep = staff.salary_info.step;

      setFormData({
        promotionDate: new Date().toISOString().split('T')[0],
        newGradeLevel,
        newStep,
        promotionType: 'regular',
        remarks: '',
      });

      // Fetch salary for the new grade/step
      fetchNewSalary(newGradeLevel, newStep);
    }
  }, [staff, isOpen, salaryStructure]);

  // Fetch new salary when grade/step changes
  useEffect(() => {
    if (formData.newGradeLevel > 0 && formData.newStep > 0 && salaryStructure) {
      fetchNewSalary(formData.newGradeLevel, formData.newStep);
    }
  }, [formData.newGradeLevel, formData.newStep, salaryStructure]);

  const fetchNewSalary = async (gradeLevel: number, step: number) => {
    if (!salaryStructure) return;

    setIsLoadingSalary(true);
    setSalaryError('');

    try {
      const result = await salaryStructureAPI.getSalaryForGradeAndStep(
        salaryStructure.id,
        gradeLevel,
        step
      );
      setNewBasicSalary(result.basicSalary);
    } catch (error: any) {
      console.error('Error fetching salary:', error);
      setSalaryError(error.message || 'Grade/Step combination not found in salary structure');
      setNewBasicSalary(0);
    } finally {
      setIsLoadingSalary(false);
    }
  };

  if (!isOpen || !staff) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newBasicSalary || newBasicSalary <= 0) {
      toast.error('Invalid salary for selected grade/step. Please check salary structure.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onPromote({
        ...formData,
        newBasicSalary, // Automatically fetched from salary structure
      });
      onClose();
    } catch (error) {
      console.error('Error promoting staff:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fullName = `${staff.bio_data.first_name} ${staff.bio_data.middle_name || ''} ${staff.bio_data.last_name}`.trim();
  const currentGrade = `GL${staff.salary_info.grade_level}/Step${staff.salary_info.step}`;
  const newGrade = `GL${formData.newGradeLevel}/Step${formData.newStep}`;
  const salaryIncrease = newBasicSalary - currentBasicSalary;
  const salaryIncreasePercent = currentBasicSalary > 0 
    ? ((salaryIncrease / currentBasicSalary) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#008000] text-white p-6 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6" />
            <div>
              <h2 className="text-xl">Promote Staff Member</h2>
              <p className="text-sm text-white/80 mt-1">Salary automatically calculated from structure</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded p-2 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Staff Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Staff Name</p>
                <p className="font-medium">{fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Staff Number</p>
                <p className="font-medium">{staff.staff_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Grade</p>
                <p className="font-medium">{currentGrade}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Basic Salary</p>
                <p className="font-medium">₦{currentBasicSalary.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Salary Structure Info */}
          {salaryStructure && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-blue-900">
                    <strong>Using Salary Structure:</strong> {salaryStructure.name}
                  </p>
                  <p className="text-blue-700 text-xs mt-1">
                    Salaries are automatically fetched based on grade level and step
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Promotion Details */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Promotion Date */}
              <div>
                <label className="block text-sm mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Promotion Effective Date *
                </label>
                <input
                  type="date"
                  value={formData.promotionDate}
                  onChange={(e) => setFormData({ ...formData, promotionDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008000] focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If mid-month, salary will be automatically prorated
                </p>
              </div>

              {/* Promotion Type */}
              <div>
                <label className="block text-sm mb-2">
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  Promotion Type *
                </label>
                <select
                  value={formData.promotionType}
                  onChange={(e) => setFormData({ ...formData, promotionType: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008000] focus:border-transparent"
                >
                  <option value="regular">Regular Promotion</option>
                  <option value="acting">Acting Promotion</option>
                  <option value="conversion">Conversion</option>
                  <option value="accelerated">Accelerated Promotion</option>
                </select>
              </div>
            </div>

            {/* New Grade & Step */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2">New Grade Level *</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.newGradeLevel}
                  onChange={(e) => setFormData({ ...formData, newGradeLevel: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008000] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">New Step *</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={formData.newStep}
                  onChange={(e) => setFormData({ ...formData, newStep: parseInt(e.target.value) || 1 })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008000] focus:border-transparent"
                />
              </div>
            </div>

            {/* Calculated New Basic Salary (Read-only Display) */}
            <div>
              <label className="block text-sm mb-2">
                <Award className="w-4 h-4 inline mr-2" />
                New Basic Salary (Auto-calculated)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={isLoadingSalary ? 'Loading...' : newBasicSalary > 0 ? `₦${newBasicSalary.toLocaleString()}` : 'N/A'}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg bg-gray-50 ${
                    salaryError ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {isLoadingSalary && (
                  <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-gray-400" />
                )}
              </div>
              {salaryError ? (
                <p className="text-xs text-red-600 mt-1">⚠️ {salaryError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Automatically fetched from salary structure for {newGrade}
                </p>
              )}
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm mb-2">Remarks (Optional)</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={3}
                placeholder="Additional notes about this promotion..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008000] focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Promotion Summary */}
          {newBasicSalary > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span>Promotion Summary</span>
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">From</p>
                  <p className="font-medium">{currentGrade}</p>
                  <p className="text-gray-600 text-xs">₦{currentBasicSalary.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-2xl text-green-600">→</div>
                </div>
                <div>
                  <p className="text-gray-600">To</p>
                  <p className="font-medium text-green-600">{newGrade}</p>
                  <p className="text-gray-600 text-xs">₦{newBasicSalary.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700">
                  <strong>Salary Increase:</strong> ₦{salaryIncrease.toLocaleString()}
                  {' '}({salaryIncreasePercent}%)
                </p>
              </div>
            </div>
          )}

          {/* Mid-Month Proration Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm mb-2 text-amber-800">📊 Automatic Proration</h3>
            <p className="text-xs text-amber-700">
              If the promotion date is mid-month, the payroll system will automatically calculate:
            </p>
            <ul className="text-xs text-amber-700 mt-2 ml-4 list-disc space-y-1">
              <li><strong>Period 1:</strong> Days worked at old grade/salary (before promotion date)</li>
              <li><strong>Period 2:</strong> Days worked at new grade/salary (from promotion date onwards)</li>
              <li><strong>Total Salary:</strong> Sum of both periods (blended for the month)</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingSalary || !newBasicSalary}
              className="px-6 py-2 bg-[#008000] text-white rounded-lg hover:bg-[#006600] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Award className="w-4 h-4" />
                  Process Promotion
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
