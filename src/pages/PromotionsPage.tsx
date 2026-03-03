import React, { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { promotionAPI, staffAPI, settingsAPI } from '../lib/api-client';
import { Promotion, Staff } from '../types/entities';
import { PageSkeleton } from '../components/PageLoader';
import { TrendingUp, Plus, CheckCircle, XCircle, Eye, AlertCircle, Calendar, Loader2, X } from 'lucide-react';

export function PromotionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingPromotionId, setProcessingPromotionId] = useState<string | null>(null);
  const [showRejectReasonModal, setShowRejectReasonModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [allowedGrades, setAllowedGrades] = useState<number[]>([3,4,5,6,7,8,9,10,12,13,14,15,16,17]);

  // Form state
  const [formData, setFormData] = useState({
    staff_id: '',
    old_grade_level: 0,
    old_step: 0,
    new_grade_level: 0,
    new_step: 0,
    effective_date: '',
    justification: '',
  });

  // Arrears preview state
  const [arrearsPreview, setArrearsPreview] = useState<{
    monthlyDifference: number;
    monthsOwed: number;
    totalArrears: number;
    oldSalary: number;
    newSalary: number;
  } | null>(null);

  useEffect(() => {
    loadData();
    (async () => {
      try {
        const settings = await settingsAPI.getSettings();
        if (Array.isArray(settings?.allowed_grades)) {
          setAllowedGrades(settings.allowed_grades.map((n: any) => Number(n)).filter((n: number) => !isNaN(n)));
        }
      } catch {}
    })();
  }, []);

  const loadData = async () => {
    try {
      const [promotionsData, staffResponse] = await Promise.all([
        getAllPromotions(),
        staffAPI.getAllStaff(),
      ]);
      const rawStaffData = Array.isArray(staffResponse) ? staffResponse : (staffResponse.data || []);
      
      // Map flat data to nested structure
      const staffData = rawStaffData.map((item: any) => {
        if (item.bio_data) return item;
        return {
          id: item.id,
          staff_number: item.staff_number,
          bio_data: {
            first_name: item.first_name,
            last_name: item.surname || item.last_name,
            middle_name: item.other_names || item.middle_name,
            email: item.email,
            phone: item.phone,
          },
          appointment: {
            department: item.department_name || item.department,
          },
          salary_info: {
            grade_level: item.grade_level,
            step: item.step,
          },
          status: item.status,
        } as Staff;
      });

      setPromotions(promotionsData);
      setStaff(staffData);
    } catch (error) {
      showToast('error', 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const getAllPromotions = async (): Promise<Promotion[]> => {
    const response = await promotionAPI.getAll();
    const data = Array.isArray(response) ? response : (response.data || response);
    // Ensure created_at ordering desc
    return [...data].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const handleStaffSelect = (staffId: string) => {
    const selectedStaff = staff.find(s => s.id === staffId);
    if (selectedStaff) {
      setFormData({
        ...formData,
        staff_id: staffId,
        old_grade_level: selectedStaff.salary_info.grade_level,
        old_step: selectedStaff.salary_info.step,
      });
    }
  };

  const calculateArrearsPreview = async () => {
    if (!formData.effective_date || !formData.new_grade_level || !formData.new_step || !formData.staff_id) {
      setArrearsPreview(null);
      return;
    }

    try {
      const result = await promotionAPI.previewArrears(
        formData.staff_id,
        formData.new_grade_level,
        formData.new_step,
        formData.effective_date
      );

      setArrearsPreview({
        monthlyDifference: result.monthlyDifference,
        monthsOwed: result.monthsDiff,
        totalArrears: result.totalArrears,
        oldSalary: result.oldNetSalary,
        newSalary: result.newNetSalary,
      });
    } catch (error) {
      console.error('Failed to calculate arrears preview:', error);
      // Fallback or just clear preview on error
      setArrearsPreview(null);
    }
  };

  useEffect(() => {
    calculateArrearsPreview();
  }, [formData.new_grade_level, formData.new_step, formData.effective_date, formData.staff_id]);

  const handleCreatePromotion = async () => {
    if (!formData.staff_id || !formData.new_grade_level || !formData.new_step || !formData.effective_date) {
      showToast('error', 'Please fill all required fields');
      return;
    }
    if (!allowedGrades.includes(Number(formData.new_grade_level))) {
      showToast('error', 'Selected Grade Level is not permitted by system settings');
      return;
    }

    if (formData.new_grade_level < formData.old_grade_level || 
        (formData.new_grade_level === formData.old_grade_level && formData.new_step <= formData.old_step)) {
      showToast('error', 'New grade/step must be higher than current grade/step');
      return;
    }

    try {
      setIsSubmitting(true);
      await promotionAPI.createPromotion(
        {
          staff_id: formData.staff_id,
          old_grade_level: formData.old_grade_level,
          old_step: formData.old_step,
          new_grade_level: formData.new_grade_level,
          new_step: formData.new_step,
          effective_date: formData.effective_date,
          status: 'pending',
          arrears_calculated: false,
          created_by: user!.id,
          created_by_email: user!.email
        }
      );
      showToast('success', 'Promotion request created successfully');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      showToast('error', 'Failed to create promotion request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePromotion = async (promotionId: string) => {
    if (!await confirm('Are you sure you want to approve this promotion? This will update the staff record and calculate arrears if applicable.')) {
      return;
    }

    try {
      setProcessingPromotionId(promotionId);
      await promotionAPI.approvePromotion(promotionId, user!.id, user!.email);
      showToast('success', 'Promotion approved successfully. Staff record updated and arrears calculated.');
      setShowDetailsModal(false);
      loadData();
    } catch (error) {
      showToast('error', 'Failed to approve promotion');
    } finally {
      setProcessingPromotionId(null);
    }
  };

  const handleRejectPromotion = async (promotionId: string) => {
    if (!await confirm('Are you sure you want to reject this promotion?')) return;
    setRejectReason('');
    setShowRejectReasonModal(true);
    setSelectedPromotion(promotions.find(p => p.id === promotionId) || null);
  };

  const resetForm = () => {
    setFormData({
      staff_id: '',
      old_grade_level: 0,
      old_step: 0,
      new_grade_level: 0,
      new_step: 0,
      effective_date: '',
      justification: '',
    });
    setArrearsPreview(null);
  };

  const getStaffName = (staffId: string): string => {
    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return 'Unknown';
    return `${staffMember.bio_data.first_name} ${staffMember.bio_data.last_name}`;
  };

  const getStaffNumber = (staffId: string): string => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember?.staff_number || 'N/A';
  };

  const filteredPromotions = promotions.filter(p => 
    filter === 'all' ? true : p.status === filter
  );

  const columns = [
    {
      header: 'Staff',
      accessor: (row: Promotion) => (
        <div>
          <div className="font-medium text-foreground">{getStaffName(row.staff_id)}</div>
          <div className="text-xs text-muted-foreground">{getStaffNumber(row.staff_id)}</div>
        </div>
      ),
    },
    {
      header: 'Current Grade',
      accessor: (row: Promotion) => (
        <span className="text-foreground">GL {row.old_grade_level} / Step {row.old_step}</span>
      ),
    },
    {
      header: 'New Grade',
      accessor: (row: Promotion) => (
        <span className="font-medium text-primary">GL {row.new_grade_level} / Step {row.new_step}</span>
      ),
    },
    {
      header: 'Effective Date',
      accessor: (row: Promotion) => (
        <div>
          <div className="text-foreground">{new Date(row.effective_date).toLocaleDateString()}</div>
          {new Date(row.effective_date) < new Date() && row.status === 'approved' && (
            <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              Arrears Due
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row: Promotion) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Created',
      accessor: (row: Promotion) => (
        <span className="text-muted-foreground text-sm">{new Date(row.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: Promotion) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPromotion(row);
              setShowDetailsModal(true);
            }}
            className="p-1 hover:bg-accent rounded"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {row.status === 'pending' && (user?.role === 'admin' || user?.role === 'approver' || user?.role === 'hr_manager') && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleApprovePromotion(row.id);
                }}
                disabled={processingPromotionId === row.id}
                className="p-1 hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Approve"
              >
                {processingPromotionId === row.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRejectPromotion(row.id);
                }}
                disabled={processingPromotionId === row.id}
                className="p-1 hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reject"
              >
                {processingPromotionId === row.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const stats = {
    total: promotions.length,
    pending: promotions.filter(p => p.status === 'pending').length,
    approved: promotions.filter(p => p.status === 'approved').length,
    rejected: promotions.filter(p => p.status === 'rejected').length,
  };

  if (loading) {
    return <PageSkeleton mode="table" />;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Promotions Management' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="page-title">Staff Promotions</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage staff promotions, grade level changes, and automatic arrears calculation</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'payroll_officer' || user?.role === 'hr_manager') && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center sm:justify-start gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Promotion
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Promotions</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{stats.total}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400 mt-1">{stats.pending}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400 mt-1">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400 mt-1">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectReasonModal && selectedPromotion && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-lg p-6 bg-card border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3>Reject Promotion</h3>
              <button onClick={() => setShowRejectReasonModal(false)} className="p-1 hover:bg-accent rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Provide a brief reason for rejection"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRejectReasonModal(false)}
                  className="px-4 py-2 text-foreground hover:bg-accent rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!rejectReason.trim()) {
                      showToast('warning', 'Rejection reason is required');
                      return;
                    }
                    try {
                      setProcessingPromotionId(selectedPromotion.id);
                      await promotionAPI.rejectPromotion(selectedPromotion.id, user!.id, user!.email, rejectReason.trim());
                      showToast('success', 'Promotion rejected');
                      setShowRejectReasonModal(false);
                      setShowDetailsModal(false);
                      loadData();
                    } catch {
                      showToast('error', 'Failed to reject promotion');
                    } finally {
                      setProcessingPromotionId(null);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-400 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Automatic Arrears Processing
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          When a promotion with a backdated effective date is approved, the system automatically calculates salary arrears 
          and creates an arrears record. The staff's grade level and step are updated immediately upon approval.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              filter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Promotions Table */}
      <DataTable
        data={filteredPromotions}
        columns={columns}
        searchable
        searchPlaceholder="Search by staff name or number..."
      />

      {/* New Promotion Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title="Create Promotion Request"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-foreground hover:bg-accent rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePromotion}
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Promotion'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Staff Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Select Staff Member *
            </label>
            <select
              value={formData.staff_id}
              onChange={(e) => handleStaffSelect(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="">-- Select Staff --</option>
              {staff.filter(s => s.status === 'active').map((s) => (
                <option key={s.id} value={s.id}>
                  {s.bio_data.first_name} {s.bio_data.last_name} ({s.staff_number}) - GL {s.salary_info.grade_level}/Step {s.salary_info.step}
                </option>
              ))}
            </select>
          </div>

          {formData.staff_id && (
            <>
              {/* Current Grade */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Current Grade Level</label>
                  <div className="text-lg font-semibold text-foreground">Grade {formData.old_grade_level}</div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Current Step</label>
                  <div className="text-lg font-semibold text-foreground">Step {formData.old_step}</div>
                </div>
              </div>

              {/* New Grade */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    New Grade Level *
                  </label>
                  <select
                    value={formData.new_grade_level}
                    onChange={(e) => setFormData({ ...formData, new_grade_level: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value={0}>Select Grade</option>
                    {allowedGrades.map((level) => (
                      <option key={level} value={level}>
                        Grade Level {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    New Step *
                  </label>
                  <select
                    value={formData.new_step}
                    onChange={(e) => setFormData({ ...formData, new_step: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value={0}>Select Step</option>
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((step) => (
                      <option key={step} value={step}>
                        Step {step}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Effective Date */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Effective Date *
                </label>
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If backdated, arrears will be automatically calculated upon approval
                </p>
              </div>

              {/* Arrears Preview */}
              {arrearsPreview && arrearsPreview.monthsOwed > 0 && (
                <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg">
                  <h4 className="font-medium text-orange-900 dark:text-orange-400 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Arrears Preview
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Old Monthly Salary:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        ₦{arrearsPreview.oldSalary.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">New Monthly Salary:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        ₦{arrearsPreview.newSalary.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Monthly Difference:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        ₦{arrearsPreview.monthlyDifference.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Months Owed:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {arrearsPreview.monthsOwed} months
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                    <span className="text-orange-700 dark:text-orange-300 text-sm">Total Arrears:</span>
                    <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
                      ₦{arrearsPreview.totalArrears.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Justification */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Justification / Notes
                </label>
                <textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Optional: Provide reason for promotion..."
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Details Modal */}
      {selectedPromotion && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPromotion(null);
          }}
          title="Promotion Details"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPromotion(null);
                }}
                className="px-4 py-2 text-foreground hover:bg-accent rounded-lg"
              >
                Close
              </button>
              {selectedPromotion.status === 'pending' && (user?.role === 'admin' || user?.role === 'approver') && (
                <>
                  <button
                    onClick={() => handleRejectPromotion(selectedPromotion.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovePromotion(selectedPromotion.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve Promotion
                  </button>
                </>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {/* Staff Info */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium text-foreground mb-2">Staff Information</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <div className="font-medium text-foreground">{getStaffName(selectedPromotion.staff_id)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Staff Number:</span>
                  <div className="font-medium text-foreground">{getStaffNumber(selectedPromotion.staff_id)}</div>
                </div>
              </div>
            </div>

            {/* Grade Change */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h4 className="font-medium text-foreground mb-3">Grade Level Change</h4>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">From</div>
                  <div className="text-lg font-semibold text-foreground">
                    GL {selectedPromotion.old_grade_level} / Step {selectedPromotion.old_step}
                  </div>
                </div>
                <div className="text-2xl text-primary">→</div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">To</div>
                  <div className="text-lg font-semibold text-primary">
                    GL {selectedPromotion.new_grade_level} / Step {selectedPromotion.new_step}
                  </div>
                </div>
              </div>
            </div>

            {/* Dates & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Effective Date</label>
                <div className="text-sm font-medium text-foreground">
                  {new Date(selectedPromotion.effective_date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <StatusBadge status={selectedPromotion.status} />
              </div>
            </div>

            {/* Approval Info */}
            {selectedPromotion.status === 'approved' && (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
                <h4 className="font-medium text-green-900 dark:text-green-400 mb-2">Approval Information</h4>
                <div className="text-sm text-green-800 dark:text-green-300">
                  <div>Approved on: {selectedPromotion.approval_date ? new Date(selectedPromotion.approval_date).toLocaleString() : 'N/A'}</div>
                  <div>Arrears Calculated: {selectedPromotion.arrears_calculated ? 'Yes' : 'Pending'}</div>
                </div>
              </div>
            )}

            {/* Created Info */}
            <div className="text-xs text-muted-foreground">
              Created: {new Date(selectedPromotion.created_at).toLocaleString()}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
