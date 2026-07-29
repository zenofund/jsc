import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Portal } from '../components/Portal';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { arrearsAPI, promotionAPI, staffAPI, settingsAPI } from '../lib/api-client';
import { formatStaffLabelWithId, formatStaffName } from '../lib/name-utils';
import { Promotion, Staff } from '../types/entities';
import { PageSkeleton } from '../components/PageLoader';
import { TrendingUp, Plus, CheckCircle, XCircle, Eye, AlertCircle, Calendar, Loader2, MoreVertical } from 'lucide-react';
import { formatCurrency } from '../utils/format';

function normalizePromotionDate(value: string | null | undefined): string {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const plainDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plainDateMatch) {
    return `${plainDateMatch[1]}-${plainDateMatch[2]}-${plainDateMatch[3]}`;
  }

  const slashIsoMatch = rawValue.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (slashIsoMatch) {
    return `${slashIsoMatch[1]}-${String(Number(slashIsoMatch[2])).padStart(2, '0')}-${String(Number(slashIsoMatch[3])).padStart(2, '0')}`;
  }

  const localeDateMatch = rawValue.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (localeDateMatch) {
    const first = Number(localeDateMatch[1]);
    const second = Number(localeDateMatch[2]);
    const year = localeDateMatch[3];
    const month = second > 12 ? first : second <= 12 && first > 12 ? second : first;
    const day = second > 12 ? second : second <= 12 && first > 12 ? first : second;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const isoLikeMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoLikeMatch) {
    return isoLikeMatch[1];
  }

  return rawValue;
}

function toDateOnly(value: string | null | undefined): Date | null {
  const normalized = normalizePromotionDate(value);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function PromotionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
  const canReviewPromotions = normalizedUserRole === 'admin' || ['cpo', 'approver'].includes(normalizedUserRole) || user?.role === 'hr_manager';
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingPromotionId, setProcessingPromotionId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [selectedPromotionIds, setSelectedPromotionIds] = useState<string[]>([]);
  const [allowedGrades, setAllowedGrades] = useState<number[]>([3,4,5,6,7,8,9,10,12,13,14,15,16,17]);
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const staffSelectRef = useRef<HTMLDivElement>(null);

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
    oldGrossSalary: number;
    newGrossSalary: number;
    oldAllowances: { total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string }> };
    newAllowances: { total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string }> };
    oldDeductions: { total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string }> };
    newDeductions: { total: number; items: Array<{ code: string; name: string; amount: number; type: string; source: string }> };
    proratedFirstMonth: number;
    fullMonthsAfter: number;
  } | null>(null);
  const [detailsArrearsPreview, setDetailsArrearsPreview] = useState<typeof arrearsPreview | null>(null);
  const [detailsPreviewLoading, setDetailsPreviewLoading] = useState(false);
  const [detailsStoredArrearsTotal, setDetailsStoredArrearsTotal] = useState<number | null>(null);
  const [arrearsPreviewLoading, setArrearsPreviewLoading] = useState(false);

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

  useEffect(() => {
    const updatePosition = () => {
      if (showStaffDropdown && !formData.staff_id && staffSelectRef.current) {
        const rect = staffSelectRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showStaffDropdown, formData.staff_id]);

  const loadData = async () => {
    try {
      const [promotionsData, staffResponse] = await Promise.all([
        getAllPromotions(),
        staffAPI.getAllStaff({ fetchAll: true, limit: 1000 }),
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
    const staffKey = String(staffId);
    const selectedStaff = staff.find((s) => String(s.id) === staffKey);
    if (selectedStaff) {
      setFormData((prev) => ({
        ...prev,
        staff_id: staffKey,
        old_grade_level: Number(selectedStaff.salary_info.grade_level) || 0,
        old_step: selectedStaff.salary_info.step,
      }));
    }
  };

  const calculateArrearsPreview = async () => {
    if (!formData.effective_date || !formData.new_grade_level || !formData.new_step || !formData.staff_id) {
      setArrearsPreview(null);
      setArrearsPreviewLoading(false);
      return;
    }

    try {
      setArrearsPreviewLoading(true);
      const result = await promotionAPI.previewArrears(
        formData.staff_id,
        formData.new_grade_level,
        formData.new_step,
        formData.effective_date,
        formData.old_grade_level,
        formData.old_step,
      );

      setArrearsPreview({
        monthlyDifference: result.monthlyDifference,
        monthsOwed: result.monthsDiff,
        totalArrears: result.totalArrears,
        oldSalary: result.oldBasicSalary,
        newSalary: result.newBasicSalary,
        oldGrossSalary: result.oldGrossSalary,
        newGrossSalary: result.newGrossSalary,
        oldAllowances: result.oldAllowances,
        newAllowances: result.newAllowances,
        oldDeductions: result.oldDeductions,
        newDeductions: result.newDeductions,
        proratedFirstMonth: result.proratedFirstMonth,
        fullMonthsAfter: result.fullMonthsAfter,
      });
    } catch (error) {
      console.error('Failed to calculate arrears preview:', error);
      // Fallback or just clear preview on error
      setArrearsPreview(null);
    } finally {
      setArrearsPreviewLoading(false);
    }
  };

  useEffect(() => {
    calculateArrearsPreview();
  }, [formData.new_grade_level, formData.new_step, formData.effective_date, formData.staff_id]);

  useEffect(() => {
    const loadDetailsPreview = async () => {
      if (!showDetailsModal || !selectedPromotion) {
        setDetailsArrearsPreview(null);
        setDetailsStoredArrearsTotal(null);
        return;
      }
      try {
        setDetailsPreviewLoading(true);
        const normalizedEffectiveDate = normalizePromotionDate(selectedPromotion.effective_date);
        const effectiveDateKey = normalizedEffectiveDate || String(selectedPromotion.effective_date || '').slice(0, 10);
        const result = await promotionAPI.previewArrears(
          selectedPromotion.staff_id,
          selectedPromotion.new_grade_level,
          selectedPromotion.new_step,
          normalizedEffectiveDate || String(selectedPromotion.effective_date || ''),
          selectedPromotion.old_grade_level,
          selectedPromotion.old_step,
        );
        setDetailsArrearsPreview({
          monthlyDifference: result.monthlyDifference,
          monthsOwed: result.monthsDiff,
          totalArrears: result.totalArrears,
          oldSalary: result.oldBasicSalary,
          newSalary: result.newBasicSalary,
          oldGrossSalary: result.oldGrossSalary,
          newGrossSalary: result.newGrossSalary,
          oldAllowances: result.oldAllowances,
          newAllowances: result.newAllowances,
          oldDeductions: result.oldDeductions,
          newDeductions: result.newDeductions,
          proratedFirstMonth: result.proratedFirstMonth,
          fullMonthsAfter: result.fullMonthsAfter,
        });

        if (selectedPromotion.status === 'approved') {
          try {
            const arrearsResponse = await arrearsAPI.getPendingArrears();
            if (Array.isArray(arrearsResponse)) {
              const matchedArrears = arrearsResponse
                .filter((arrears: any) =>
                  arrears?.reason === 'promotion' &&
                  String(arrears?.staff_id || '') === String(selectedPromotion.staff_id) &&
                  String(arrears?.effective_date || '').slice(0, 10) === effectiveDateKey
                )
                .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

              setDetailsStoredArrearsTotal(
                matchedArrears ? Number(matchedArrears.total_arrears ?? matchedArrears.totalArrears ?? 0) : null,
              );
            } else {
              setDetailsStoredArrearsTotal(null);
            }
          } catch {
            setDetailsStoredArrearsTotal(null);
          }
        } else {
          setDetailsStoredArrearsTotal(null);
        }
      } catch {
        setDetailsArrearsPreview(null);
        setDetailsStoredArrearsTotal(null);
      } finally {
        setDetailsPreviewLoading(false);
      }
    };
    loadDetailsPreview();
  }, [showDetailsModal, selectedPromotion]);

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
      await promotionAPI.approvePromotion(promotionId, user!.id, user!.email, approvalComment.trim());
      showToast('success', 'Promotion approved successfully. Staff record updated and arrears calculated.');
      setShowDetailsModal(false);
      setApprovalComment('');
      loadData();
    } catch (error) {
      showToast('error', 'Failed to approve promotion');
    } finally {
      setProcessingPromotionId(null);
    }
  };

  const handleRejectPromotion = async (promotionId: string) => {
    if (!await confirm('Are you sure you want to reject this promotion?')) return;
    try {
      setProcessingPromotionId(promotionId);
      await promotionAPI.rejectPromotion(promotionId, user!.id, user!.email, approvalComment.trim());
      showToast('success', 'Promotion rejected');
      setShowDetailsModal(false);
      setApprovalComment('');
      loadData();
    } catch {
      showToast('error', 'Failed to reject promotion');
    } finally {
      setProcessingPromotionId(null);
    }
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
    setApprovalComment('');
  };

  const getStaffName = (staffId: string): string => {
    const staffMember = staff.find((s) => String(s.id) === String(staffId));
    if (!staffMember) return 'Unknown';
    return formatStaffName(staffMember);
  };

  const getStaffNumber = (staffId: string): string => {
    const staffMember = staff.find((s) => String(s.id) === String(staffId));
    return staffMember?.staff_number || 'N/A';
  };

  const getSelectedStaffLabel = (staffId: string): string => {
    const staffMember = staff.find((s) => String(s.id) === String(staffId));
    if (!staffMember) return '';
    return `${formatStaffLabelWithId(staffMember)} - GL ${staffMember.salary_info.grade_level}/Step ${staffMember.salary_info.step}`;
  };

  const getStaffSearchScore = (staffMember: Staff, searchValue: string): number => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return 0;

    const staffNumber = (staffMember.staff_number || '').toLowerCase();
    const fullName = formatStaffName(staffMember).toLowerCase();
    const searchableLabel = formatStaffLabelWithId(staffMember).toLowerCase();
    const nameParts = [
      staffMember.bio_data?.first_name,
      staffMember.bio_data?.middle_name,
      staffMember.bio_data?.last_name,
    ]
      .map((part) => String(part || '').trim().toLowerCase())
      .filter(Boolean);

    if (staffNumber === query) return 1000;
    if (fullName === query) return 950;
    if (nameParts.some((part) => part === query)) return 900;
    if (staffNumber.startsWith(query)) return 850;
    if (fullName.startsWith(query)) return 800;
    if (nameParts.some((part) => part.startsWith(query))) return 750;
    if (searchableLabel.includes(query)) return 500;

    return 0;
  };

  const filteredStaff = useMemo(() => {
    const query = staffSearch.trim();
    const eligibleStatuses = new Set(['active', 'secondment', 'suspended']);

    return staff
      .filter((s) => eligibleStatuses.has(String(s.status || '').toLowerCase()))
      .map((s, index) => ({
        staffMember: s,
        index,
        score: getStaffSearchScore(s, query),
      }))
      .filter(({ score }) => !query || score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      })
      .map(({ staffMember }) => staffMember);
  }, [staff, staffSearch]);

  const filteredPromotions = promotions.filter(p => 
    filter === 'all' ? true : p.status === filter
  );
  const arrearsEvaluationComplete =
    selectedPromotion?.status === 'approved' &&
    (selectedPromotion.arrears_calculated || (!!detailsArrearsPreview && !detailsPreviewLoading));

  const selectablePromotionIds = useMemo(
    () => filteredPromotions.filter((promotion) => promotion.status === 'pending').map((promotion) => promotion.id),
    [filteredPromotions],
  );

  const selectedPendingPromotions = useMemo(
    () => promotions.filter((promotion) => selectedPromotionIds.includes(promotion.id) && promotion.status === 'pending'),
    [promotions, selectedPromotionIds],
  );

  const selectedBackdatedCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedPendingPromotions.filter((promotion) => {
      const effectiveDate = toDateOnly(promotion.effective_date);
      return effectiveDate ? effectiveDate < today : false;
    }).length;
  }, [selectedPendingPromotions]);

  useEffect(() => {
    setSelectedPromotionIds((currentSelection) => {
      const allowedIds = new Set(promotions.filter((promotion) => promotion.status === 'pending').map((promotion) => promotion.id));
      return currentSelection.filter((id) => allowedIds.has(id));
    });
  }, [promotions]);

  const togglePromotionSelection = (promotionId: string) => {
    setSelectedPromotionIds((currentSelection) =>
      currentSelection.includes(promotionId)
        ? currentSelection.filter((id) => id !== promotionId)
        : [...currentSelection, promotionId],
    );
  };

  const toggleSelectAllPending = () => {
    if (selectablePromotionIds.length === 0) {
      setSelectedPromotionIds([]);
      return;
    }

    const allSelected = selectablePromotionIds.every((id) => selectedPromotionIds.includes(id));
    setSelectedPromotionIds((currentSelection) => {
      const nonSelectable = currentSelection.filter((id) => !selectablePromotionIds.includes(id));
      return allSelected ? nonSelectable : [...nonSelectable, ...selectablePromotionIds];
    });
  };

  const columns = [
    ...(canReviewPromotions
      ? [
          {
            header: (
              <input
                type="checkbox"
                checked={selectablePromotionIds.length > 0 && selectablePromotionIds.every((id) => selectedPromotionIds.includes(id))}
                onChange={toggleSelectAllPending}
                disabled={selectablePromotionIds.length === 0 || bulkActionLoading}
                aria-label="Select all pending promotions"
                className="h-4 w-4 rounded border-border"
              />
            ),
            accessor: (row: Promotion) =>
              row.status === 'pending' ? (
                <input
                  type="checkbox"
                  checked={selectedPromotionIds.includes(row.id)}
                  onChange={() => togglePromotionSelection(row.id)}
                  disabled={bulkActionLoading}
                  aria-label={`Select promotion for ${getStaffName(row.staff_id)}`}
                  className="h-4 w-4 rounded border-border"
                />
              ) : null,
          },
        ]
      : []),
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
      accessor: (row: Promotion) => {
        const canApprovePromotion = row.status === 'pending' && canReviewPromotions;
        const canRejectPromotion = row.status === 'pending' && canReviewPromotions;
        const isProcessing = processingPromotionId === row.id || bulkActionLoading;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                disabled={isProcessing}
                className="p-2 hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Open actions for promotion ${row.id}`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelectedPromotion(row);
                  setApprovalComment('');
                  setShowDetailsModal(true);
                }}
              >
                <Eye className="w-4 h-4 mr-2 text-blue-600" />
                View Details
              </DropdownMenuItem>
              {canApprovePromotion && (
                <DropdownMenuItem onClick={() => handleApprovePromotion(row.id)}>
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                  Approve
                </DropdownMenuItem>
              )}
              {canRejectPromotion && (
                <DropdownMenuItem
                  onClick={() => handleRejectPromotion(row.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <XCircle className="w-4 h-4 mr-2 text-red-600" />
                  Reject
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
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

  const handleBulkPromotionAction = async (action: 'approve' | 'reject') => {
    if (!canReviewPromotions || selectedPendingPromotions.length === 0) {
      return;
    }

    const actionLabel = action === 'approve' ? 'approve' : 'reject';
    const title = action === 'approve' ? 'Bulk Approve Promotions?' : 'Bulk Reject Promotions?';
    const confirmed = await confirm({
      title,
      message:
        `${selectedPendingPromotions.length} pending promotion${selectedPendingPromotions.length === 1 ? '' : 's'} will be ${actionLabel}d.` +
        (selectedBackdatedCount > 0
          ? ` ${selectedBackdatedCount} selected case${selectedBackdatedCount === 1 ? '' : 's'} ${selectedBackdatedCount === 1 ? 'is' : 'are'} backdated and may generate arrears.`
          : '') +
        ' Continue?',
    });

    if (!confirmed) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const result =
        action === 'approve'
          ? await promotionAPI.bulkApprovePromotions(selectedPendingPromotions.map((promotion) => promotion.id))
          : await promotionAPI.bulkRejectPromotions(
              selectedPendingPromotions.map((promotion) => promotion.id),
              approvalComment.trim(),
            );

      const successfulIds = Array.isArray(result?.successes)
        ? result.successes.map((item: any) => item.id).filter(Boolean)
        : [];
      const failedPromotions = Array.isArray(result?.failures) ? result.failures : [];

      setApprovalComment('');
      setSelectedPromotionIds((currentSelection) => currentSelection.filter((id) => !successfulIds.includes(id)));
      await loadData();

      if (successfulIds.length > 0) {
        showToast(
          'success',
          `${action === 'approve' ? 'Approved' : 'Rejected'} ${successfulIds.length} promotion${successfulIds.length === 1 ? '' : 's'} successfully.`,
        );
      }

      if (failedPromotions.length > 0) {
        const failedSummary = failedPromotions
          .slice(0, 3)
          .map((promotion: any) => {
            const staffLabel = [promotion.staff_number, promotion.staff_name].filter(Boolean).join(' ');
            return staffLabel || promotion.id;
          })
          .join(', ');
        showToast(
          successfulIds.length > 0 ? 'warning' : 'error',
          `${failedPromotions.length} promotion${failedPromotions.length === 1 ? '' : 's'} failed${failedSummary ? `: ${failedSummary}` : ''}${failedPromotions.length > 3 ? '...' : ''}`,
        );
      }
    } catch (error: any) {
      showToast('error', error?.message || `Failed to ${actionLabel} promotions.`);
    } finally {
      setBulkActionLoading(false);
    }
  };

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

      {canReviewPromotions && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">
                {selectedPendingPromotions.length} pending promotion{selectedPendingPromotions.length === 1 ? '' : 's'} selected
              </div>
              <div className="text-xs text-muted-foreground">
                Bulk actions apply only to pending rows. Review details individually when needed before approval.
              </div>
              {selectedBackdatedCount > 0 && (
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  Warning: {selectedBackdatedCount} selected promotion{selectedBackdatedCount === 1 ? '' : 's'} may generate arrears because the effective date is backdated.
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setSelectedPromotionIds([])}
                disabled={selectedPendingPromotions.length === 0 || bulkActionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={() => handleBulkPromotionAction('approve')}
                disabled={selectedPendingPromotions.length === 0 || bulkActionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Bulk Approve
              </button>
              <button
                type="button"
                onClick={() => handleBulkPromotionAction('reject')}
                disabled={selectedPendingPromotions.length === 0 || bulkActionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Bulk Reject
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div ref={staffSelectRef} className="relative">
            <label className="block text-sm font-medium text-foreground mb-1">
              Select Staff Member *
            </label>
            <input
              type="text"
              value={formData.staff_id ? getSelectedStaffLabel(formData.staff_id) : staffSearch}
              onChange={(e) => {
                if (!formData.staff_id) {
                  setStaffSearch(e.target.value);
                  setShowStaffDropdown(true);
                }
              }}
              onFocus={() => {
                if (!formData.staff_id) {
                  setShowStaffDropdown(true);
                  if (staffSelectRef.current) {
                    const rect = staffSelectRef.current.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + window.scrollY + 4,
                      left: rect.left + window.scrollX,
                      width: rect.width,
                    });
                  }
                }
              }}
              onBlur={() => setTimeout(() => setShowStaffDropdown(false), 200)}
              placeholder="Search staff by name or staff number..."
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
            {formData.staff_id && (
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, staff_id: '', old_grade_level: 0, old_step: 0 }));
                  setStaffSearch('');
                }}
                className="absolute right-2 top-9 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
          {showStaffDropdown && !formData.staff_id && dropdownPosition && (
            <Portal>
              <div
                style={{
                  position: 'absolute',
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                  zIndex: 9999,
                }}
                className="max-h-60 overflow-auto bg-card border border-border rounded-lg shadow-xl"
              >
                {filteredStaff.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">No staff found</div>
                ) : (
                  filteredStaff.map((s) => (
                    <div
                      key={s.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStaffSelect(String(s.id));
                        setStaffSearch('');
                        setShowStaffDropdown(false);
                      }}
                      className="px-4 py-2 cursor-pointer hover:bg-accent text-sm"
                    >
                      {formatStaffLabelWithId(s)} - GL {s.salary_info.grade_level}/Step {s.salary_info.step}
                    </div>
                  ))
                )}
              </div>
            </Portal>
          )}

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
              {(arrearsPreviewLoading || arrearsPreview) && (
                <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg">
                  <h4 className="font-medium text-orange-900 dark:text-orange-400 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Arrears Preview
                  </h4>
                  {arrearsPreviewLoading ? (
                    <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating preview...
                    </div>
                  ) : arrearsPreview ? (
                    <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Old Basic Salary:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(arrearsPreview.oldSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">New Basic Salary:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(arrearsPreview.newSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Monthly Difference:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(arrearsPreview.monthlyDifference)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Months Owed:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {arrearsPreview.monthsOwed} months
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Old Gross:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(arrearsPreview.oldGrossSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">New Gross:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(arrearsPreview.newGrossSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Old Deductions:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(arrearsPreview.oldDeductions.total)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">New Deductions:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(arrearsPreview.newDeductions.total)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-orange-700 dark:text-orange-300">
                    Prorated first month: {formatCurrency(arrearsPreview.proratedFirstMonth)} · Full months after: {arrearsPreview.fullMonthsAfter}
                  </div>
                  {arrearsPreview.monthsOwed === 0 && (
                    <div className="mt-2 text-xs text-orange-700 dark:text-orange-300">
                      No arrears are currently owed for the selected effective date, but the salary difference is shown for review.
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">Old Allowances</div>
                      <div className="space-y-1 text-sm">
                        {arrearsPreview.oldAllowances.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {arrearsPreview.oldAllowances.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No allowances</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">New Allowances</div>
                      <div className="space-y-1 text-sm">
                        {arrearsPreview.newAllowances.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {arrearsPreview.newAllowances.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No allowances</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">Old Deductions</div>
                      <div className="space-y-1 text-sm">
                        {arrearsPreview.oldDeductions.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {arrearsPreview.oldDeductions.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No deductions</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">New Deductions</div>
                      <div className="space-y-1 text-sm">
                        {arrearsPreview.newDeductions.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {arrearsPreview.newDeductions.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No deductions</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                    <span className="text-orange-700 dark:text-orange-300 text-sm">Total Arrears:</span>
                    <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
                      {formatCurrency(arrearsPreview.totalArrears)}
                    </div>
                  </div>
                    </>
                  ) : null}
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
            setApprovalComment('');
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
              {selectedPromotion.status === 'pending' && (user?.role === 'admin' || user?.role === 'hr_manager') && (
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
                  <div>Arrears Calculated: {detailsPreviewLoading ? 'Checking...' : arrearsEvaluationComplete ? 'Yes' : 'Pending'}</div>
                </div>
              </div>
            )}

            {selectedPromotion.status === 'pending' && (user?.role === 'admin' || user?.role === 'hr_manager') && (
              <div className="p-4 bg-muted/30 rounded-lg">
                <label className="block text-xs text-muted-foreground mb-2">Approval / Rejection Comment (Optional)</label>
                <textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Add an optional comment for approval or rejection"
                />
              </div>
            )}


            <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg">
              <h4 className="font-medium text-orange-900 dark:text-orange-400 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Arrears Preview (Audit)
              </h4>
              {detailsPreviewLoading ? (
                <div className="text-sm text-orange-700 dark:text-orange-300">Loading preview...</div>
              ) : detailsArrearsPreview ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Old Basic Salary:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(detailsArrearsPreview.oldSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">New Basic Salary:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(detailsArrearsPreview.newSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Monthly Difference:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(detailsArrearsPreview.monthlyDifference)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Months Owed:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {detailsArrearsPreview.monthsOwed} months
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Old Gross:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(detailsArrearsPreview.oldGrossSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">New Gross:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(detailsArrearsPreview.newGrossSalary)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">Old Deductions:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(detailsArrearsPreview.oldDeductions.total)}
                      </div>
                    </div>
                    <div>
                      <span className="text-orange-700 dark:text-orange-300">New Deductions:</span>
                      <div className="font-semibold text-orange-900 dark:text-orange-200">
                        {formatCurrency(detailsArrearsPreview.newDeductions.total)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-300">
                    Prorated first month: {formatCurrency(detailsArrearsPreview.proratedFirstMonth)} · Full months after: {detailsArrearsPreview.fullMonthsAfter}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">Old Allowances</div>
                      <div className="space-y-1 text-sm">
                        {detailsArrearsPreview.oldAllowances.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {detailsArrearsPreview.oldAllowances.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No allowances</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">New Allowances</div>
                      <div className="space-y-1 text-sm">
                        {detailsArrearsPreview.newAllowances.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {detailsArrearsPreview.newAllowances.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No allowances</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">Old Deductions</div>
                      <div className="space-y-1 text-sm">
                        {detailsArrearsPreview.oldDeductions.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {detailsArrearsPreview.oldDeductions.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No deductions</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-white/60 dark:bg-orange-950/40 p-3">
                      <div className="text-xs text-orange-800 dark:text-orange-300 mb-2">New Deductions</div>
                      <div className="space-y-1 text-sm">
                        {detailsArrearsPreview.newDeductions.items.map((item, idx) => (
                          <div key={`${item.code}-${idx}`} className="flex items-center justify-between">
                            <span className="text-orange-900 dark:text-orange-100">{item.name}</span>
                            <span className="text-orange-900 dark:text-orange-100">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                        {detailsArrearsPreview.newDeductions.items.length === 0 && (
                          <div className="text-orange-700 dark:text-orange-300">No deductions</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-orange-200 dark:border-orange-900">
                    <span className="text-orange-700 dark:text-orange-300">Total Arrears:</span>
                    <div className="text-lg font-bold text-orange-900 dark:text-orange-100">
                      {formatCurrency(detailsStoredArrearsTotal ?? detailsArrearsPreview.totalArrears)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-orange-700 dark:text-orange-300">No preview available</div>
              )}
            </div>

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
