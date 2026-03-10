import { useState, useEffect } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { salaryStructureAPI, allowanceAPI, deductionAPI } from '../lib/api-client';
import { Plus, Edit, Trash2, Table, X, Save, Download, Check, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { showToast } from '../utils/toast';
import { SalaryStructureUpload } from '../components/SalaryStructureUpload';
import { PageSkeleton } from '../components/PageLoader';

type TabType = 'structures' | 'allowances' | 'deductions';

// CONMESS 2024 Salary Structure (17 Levels, 15 Steps each)
const CONMESS_2024_STRUCTURE = {
  1: [70000, 73200, 76580, 80140, 83870, 87780, 91870, 96130, 100580, 105220, 110050, 115060, 120260, 125650, 131230],
  2: [75000, 78450, 82070, 85860, 89820, 93950, 98260, 102750, 107420, 112280, 117330, 122570, 128010, 133650, 139500],
  3: [80000, 83680, 87570, 91670, 95990, 100530, 105300, 110300, 115540, 121020, 126750, 132730, 138970, 145470, 152230],
  4: [90000, 94140, 98510, 103110, 107940, 113010, 118320, 123870, 129670, 135720, 142030, 148600, 155440, 162550, 169940],
  5: [100000, 104600, 109420, 114460, 119730, 125230, 131000, 136980, 143230, 149760, 156580, 163700, 171120, 178860, 186920],
  6: [120000, 125520, 131300, 137350, 143680, 150300, 157210, 164430, 171960, 179810, 188000, 196530, 205410, 214650, 224260],
  7: [145000, 151670, 158750, 166250, 174180, 182550, 191370, 200660, 210430, 220690, 231450, 242730, 254540, 266900, 279820],
  8: [175000, 183050, 191590, 200630, 210180, 220250, 230860, 242020, 253750, 266060, 278970, 292500, 306670, 321500, 337010],
  9: [210000, 219660, 229790, 240410, 251530, 263160, 275310, 288000, 301240, 315040, 329420, 344400, 360000, 376240, 393140],
  10: [250000, 261500, 273570, 286230, 299500, 313400, 327950, 343170, 359080, 375700, 393050, 411150, 430020, 449680, 470150],
  11: [300000, 313800, 328440, 343940, 360320, 377600, 395800, 414940, 435040, 456120, 478200, 501300, 525440, 550640, 576920],
  12: [360000, 376560, 394070, 412560, 432060, 452600, 474220, 496950, 520830, 545890, 572160, 599680, 628490, 658620, 690110],
  13: [430000, 449780, 470550, 492340, 515180, 539100, 564130, 590310, 617670, 646250, 676080, 707200, 739650, 773470, 808700],
  14: [515000, 538690, 563900, 590690, 619110, 649210, 681040, 714660, 750130, 787500, 826840, 868210, 911680, 957310, 1005170],
  15: [620000, 648920, 679090, 710550, 743370, 777610, 813340, 850620, 889520, 930100, 972430, 1016580, 1062620, 1110630, 1160680],
  16: [745000, 779670, 815650, 853010, 891830, 932180, 974130, 1017780, 1063200, 1110490, 1159730, 1211020, 1264460, 1320150, 1378200],
  17: [895000, 936170, 979540, 1025190, 1073200, 1123650, 1176620, 1232210, 1290510, 1351630, 1415700, 1482840, 1553180, 1626850, 1703980],
};

export function PayrollSetupPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('structures');
  const [structures, setStructures] = useState<any[]>([]);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Salary Structure editing states
  const [selectedStructure, setSelectedStructure] = useState<any>(null);
  const [editedSalaries, setEditedSalaries] = useState<{ [key: string]: number }>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedData, setUploadedData] = useState<any>(null);
  
  // Modal states
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form states
  const [structureForm, setStructureForm] = useState({
    name: '',
    effective_date: '',
  });

  const [allowanceForm, setAllowanceForm] = useState({
    name: '',
    code: '',
    type: 'fixed' as 'fixed' | 'percentage',
    amount: 0,
    percentage: 0,
    is_taxable: true,
    is_pensionable: false,
    appliesToAll: true,
    status: 'active' as 'active' | 'inactive',
  });

  const [deductionForm, setDeductionForm] = useState({
    name: '',
    code: '',
    type: 'fixed' as 'fixed' | 'percentage',
    amount: 0,
    percentage: 0,
    is_statutory: false,
    appliesToAll: true,
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    // Auto-select first structure when structures load
    if (structures.length > 0 && !selectedStructure) {
      setSelectedStructure(structures[0]);
    }
  }, [structures]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'structures') {
        const data = await salaryStructureAPI.getAllStructures();
        setStructures(data);
      } else if (activeTab === 'allowances') {
        const data = await allowanceAPI.getAllAllowances();
        setAllowances(data);
      } else if (activeTab === 'deductions') {
        const data = await deductionAPI.getAllDeductions();
        setDeductions(data);
      }
    } catch (error) {
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // SALARY STRUCTURE HANDLERS
  // ========================================
  const handleCreateStructure = async () => {
    // Use unified function that handles both uploaded and default data
    await handleCreateStructureWithUpload();
  };

  const handleEditStructureDetails = async () => {
    if (!selectedStructure) return;
    try {
      await salaryStructureAPI.updateStructure(selectedStructure.id, {
        name: structureForm.name,
        effective_date: structureForm.effective_date,
      }, user!.id, user!.email);
      showToast.success('Structure details updated successfully');
      setShowStructureModal(false);
      setEditingItem(null);
      resetStructureForm();
      loadData();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to update structure');
    }
  };

  const handleDeleteStructure = async (id: string, name: string) => {
    const confirmed = await confirm(`Are you sure you want to delete "${name}"?`);
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await salaryStructureAPI.deleteStructure(id, user!.id, user!.email);
      showToast.success('Salary structure deleted successfully');
      setSelectedStructure(null);
      loadData();
    } catch (error: any) {
      showToast.error('Failed to delete structure', error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCellEdit = (level: string | number, step: number, value: string) => {
    const key = `${String(level)}-${step}`;
    const numValue = parseFloat(value) || 0;
    setEditedSalaries(prev => ({
      ...prev,
      [key]: numValue
    }));
  };

  const getSalaryValue = (level: string | number, step: number): number => {
    const key = `${String(level)}-${step}`;
    if (editedSalaries[key] !== undefined) {
      return editedSalaries[key];
    }
    
    const gradeLevel = selectedStructure?.grade_levels.find((gl: any) => String(gl.level) === String(level));
    const stepData = gradeLevel?.steps.find((s: any) => s.step === step);
    return stepData?.basic_salary || 0;
  };

  const handleSaveChanges = async () => {
    if (!selectedStructure || Object.keys(editedSalaries).length === 0) return;
    
    setSaving(true);
    try {
      const updatedGradeLevels = selectedStructure.grade_levels.map((gl: any) => ({
        ...gl,
        steps: gl.steps.map((s: any) => {
          const key = `${gl.level}-${s.step}`;
          return {
            ...s,
            basic_salary: editedSalaries[key] !== undefined ? editedSalaries[key] : s.basic_salary,
          };
        }),
      }));

      await salaryStructureAPI.updateStructure(
        selectedStructure.id,
        { grade_levels: updatedGradeLevels },
        user!.id,
        user!.email
      );

      showToast.success(`Updated ${Object.keys(editedSalaries).length} salary entries`);
      setEditedSalaries({});
      setIsEditMode(false);
      loadData();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedSalaries({});
    setIsEditMode(false);
  };

  const resetStructureForm = () => {
    setStructureForm({ name: '', effective_date: '' });
  };

  const handleUploadedData = (parsedData: any) => {
    // Store uploaded data to be used when creating structure
    setUploadedData(parsedData);
    setShowUploadModal(false);
    // Open structure modal to get name and effective date
    setShowStructureModal(true);
  };

  const handleCreateStructureWithUpload = async () => {
    try {
      const newStructure = {
        name: structureForm.name,
        effective_date: structureForm.effective_date,
        grade_levels: uploadedData?.gradeLevels || Object.entries(CONMESS_2024_STRUCTURE).map(([level, steps]) => ({
          level,
          steps: steps.map((salary, index) => ({
            step: index + 1,
            basic_salary: salary,
          })),
        })),
      };

      const created = await salaryStructureAPI.createStructure(newStructure, user!.id, user!.email);
      showToast.success('Salary structure created successfully');
      setShowStructureModal(false);
      resetStructureForm();
      setUploadedData(null);
      loadData();
      setSelectedStructure(created);
    } catch (error: any) {
      if (error.message?.includes('403') || error.status === 403) {
         showToast.error('You do not have permission to create salary structures.');
      } else {
         showToast.error(error.message || 'Failed to create salary structure');
      }
    }
  };

  // ========================================
  // ALLOWANCE HANDLERS
  // ========================================
  const handleCreateAllowance = async () => {
    setSaving(true);
    try {
      await allowanceAPI.createAllowance(allowanceForm);
      showToast.success('Allowance created successfully');
      setShowAllowanceModal(false);
      resetAllowanceForm();
      loadData();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to create allowance');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAllowance = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      await allowanceAPI.updateAllowance(editingItem.id, allowanceForm);
      showToast.success('Allowance updated successfully');
      setShowAllowanceModal(false);
      setEditingItem(null);
      resetAllowanceForm();
      loadData();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to update allowance');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllowance = async (id: string, name: string) => {
    const confirmed = await confirm(`Are you sure you want to delete "${name}"?`);
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await allowanceAPI.deleteAllowance(id);
      showToast.success('Allowance deleted successfully');
      loadData();
    } catch (error: any) {
      showToast.error('Failed to delete allowance', error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const resetAllowanceForm = () => {
    setAllowanceForm({
      name: '',
      code: '',
      type: 'fixed',
      amount: 0,
      percentage: 0,
      is_taxable: true,
      is_pensionable: false,
      status: 'active',
      appliesToAll: true,
    });
  };

  // ========================================
  // DEDUCTION HANDLERS
  // ========================================
  const handleCreateDeduction = async () => {
    setSaving(true);
    try {
      await deductionAPI.createDeduction(deductionForm, user!.id, user!.email);
      showToast.success('Deduction created successfully');
      setShowDeductionModal(false);
      resetDeductionForm();
      loadData();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to create deduction');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDeduction = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      await deductionAPI.updateDeduction(editingItem.id, deductionForm, user!.id, user!.email);
      showToast.success('Deduction updated successfully');
      setShowDeductionModal(false);
      setEditingItem(null);
      resetDeductionForm();
      loadData();
    } catch (error: any) {
      showToast.error(error.message || 'Failed to update deduction');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeduction = async (id: string, name: string) => {
    const confirmed = await confirm(`Are you sure you want to delete "${name}"?`);
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await deductionAPI.deleteDeduction(id, user!.id, user!.email);
      showToast.success('Deduction deleted successfully');
      loadData();
    } catch (error: any) {
      showToast.error('Failed to delete deduction', error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const resetDeductionForm = () => {
    setDeductionForm({
      name: '',
      code: '',
      type: 'fixed',
      amount: 0,
      percentage: 0,
      is_statutory: false,
      status: 'active',
      appliesToAll: true,
    });
  };

  const exportStructureToCSV = (structure: any) => {
    let csv = 'Grade Level,Step,Basic Salary\n';
    structure.grade_levels.forEach((gl: any) => {
      gl.steps.forEach((s: any) => {
        csv += `${gl.level},${s.step},${s.basic_salary}\n`;
      });
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure.name.replace(/\s+/g, '_')}_Salary_Structure.csv`;
    a.click();
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Payroll Setup' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Payroll Setup</h1>
          <p className="text-muted-foreground">
            Configure salary structures, allowances, and deductions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {['structures', 'allowances', 'deductions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as TabType)}
              className={`px-4 py-2 -mb-px transition-colors capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Salary Structures Tab */}
      {activeTab === 'structures' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              {structures.length > 0 && (
                <div>
                  <label className="block text-sm mb-1 text-muted-foreground">Select Structure</label>
                  <select
                    value={selectedStructure?.id || ''}
                    onChange={(e) => {
                      const struct = structures.find(s => s.id === e.target.value);
                      setSelectedStructure(struct);
                      setEditedSalaries({});
                      setIsEditMode(false);
                    }}
                    className="px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {structures.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {selectedStructure && !isEditMode && (
                <>
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit Salaries</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(selectedStructure);
                      setStructureForm({
                        name: selectedStructure.name,
                        effective_date: selectedStructure.effective_date,
                      });
                      setShowStructureModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit Details</span>
                  </button>
                  <button
                    onClick={() => exportStructureToCSV(selectedStructure)}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                    title="Export CSV"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                  <button
                    onClick={() => handleDeleteStructure(selectedStructure.id, selectedStructure.name)}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                    disabled={deletingId === selectedStructure.id}
                  >
                    {deletingId === selectedStructure.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </>
              )}
              
              {isEditMode && (
                <>
                  <button
                    onClick={handleSaveChanges}
                    disabled={saving || Object.keys(editedSalaries).length === 0}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">{saving ? 'Saving...' : `Save Changes (${Object.keys(editedSalaries).length})`}</span>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setEditingItem(null);
                  resetStructureForm();
                  setShowStructureModal(true);
                }}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Structure</span>
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload Structure</span>
              </button>
            </div>
          </div>

          {selectedStructure ? (
            <>
              {/* Structure Info */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Structure Name</span>
                    <p className="text-card-foreground">{selectedStructure.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Effective Date</span>
                    <p className="text-card-foreground">
                      {new Date(selectedStructure.effective_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Grade Levels</span>
                    <p className="text-card-foreground">{selectedStructure.grade_levels?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Steps per Level</span>
                    <p className="text-card-foreground">
                      {selectedStructure.grade_levels?.[0]?.steps?.length || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Edit Mode Notice */}
              {isEditMode && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">Edit Mode Active</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Click on any salary cell to edit. Changes are highlighted in yellow. Click "Save Changes" when done.
                    </p>
                  </div>
                </div>
              )}

              {/* Editable Salary Table */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs text-muted-foreground uppercase border border-border sticky left-0 bg-muted/50 z-10">
                          Level
                        </th>
                        {Array.from({ length: 15 }, (_, i) => (
                          <th
                            key={i}
                            className="px-3 py-3 text-center text-xs text-muted-foreground uppercase border border-border whitespace-nowrap"
                          >
                            Step {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStructure.grade_levels?.map((level: any) => (
                        <tr key={level.level} className="hover:bg-accent transition-colors">
                          <td className="px-3 py-2 border border-border text-card-foreground sticky left-0 bg-card font-medium">
                            Level {level.level}
                          </td>
                          {Array.from({ length: 15 }, (_, stepIndex) => {
                            const step = stepIndex + 1;
                            const key = `${level.level}-${step}`;
                            const value = getSalaryValue(level.level, step);
                            const isEdited = editedSalaries[key] !== undefined;
                            
                            return (
                              <td
                                key={step}
                                className={`px-2 py-2 text-center border border-border ${
                                  isEdited ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''
                                }`}
                              >
                                {isEditMode ? (
                                  <input
                                    type="number"
                                    value={value}
                                    onChange={(e) => handleCellEdit(level.level, step, e.target.value)}
                                    className={`w-full px-2 py-1 text-center rounded border ${
                                      isEdited 
                                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' 
                                        : 'border-border bg-input-background'
                                    } text-foreground focus:outline-none focus:ring-2 focus:ring-ring`}
                                    min="0"
                                  />
                                ) : (
                                  <span className="text-card-foreground">
                                    ₦{value.toLocaleString()}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-card border border-border rounded-lg">
              <Table className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No salary structures found. Create one to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Allowances Tab */}
      {activeTab === 'allowances' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {allowances.length} allowance(s) configured
            </p>
            <button
              onClick={() => {
                setEditingItem(null);
                resetAllowanceForm();
                setShowAllowanceModal(true);
              }}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Allowance
            </button>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Code</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Name</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Type</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Amount/Rate</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Taxable</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Pensionable</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Global</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allowances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                        No allowances configured
                      </td>
                    </tr>
                  ) : (
                    allowances.map((allowance) => (
                      <tr key={allowance.id} className="hover:bg-accent transition-colors">
                        <td className="px-6 py-4 text-sm text-card-foreground">{allowance.code}</td>
                        <td className="px-6 py-4 text-sm text-card-foreground">{allowance.name}</td>
                        <td className="px-6 py-4 text-sm text-card-foreground capitalize">
                          {allowance.type}
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">
                          {allowance.type === 'fixed'
                            ? `₦${allowance.amount?.toLocaleString() || 0}`
                            : `${allowance.percentage || 0}%`}
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">
                          {allowance.is_taxable ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">
                          {allowance.is_pensionable ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">
                          {allowance.applies_to_all ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={allowance.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(allowance);
                                setAllowanceForm({
                                  name: allowance.name,
                                  code: allowance.code,
                                  type: allowance.type,
                                  amount: allowance.amount || 0,
                                  percentage: allowance.percentage || 0,
                                  is_taxable: allowance.is_taxable,
                                  is_pensionable: allowance.is_pensionable,
                                  appliesToAll: allowance.applies_to_all,
                                  status: allowance.status,
                                });
                                setShowAllowanceModal(true);
                              }}
                              className="p-2 hover:bg-accent rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              onClick={() => handleDeleteAllowance(allowance.id, allowance.name)}
                              className="p-2 hover:bg-destructive/10 rounded transition-colors"
                              title="Delete"
                              disabled={deletingId === allowance.id}
                            >
                              {deletingId === allowance.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-destructive" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Deductions Tab */}
      {activeTab === 'deductions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {deductions.length} deduction(s) configured
            </p>
            <button
              onClick={() => {
                setEditingItem(null);
                resetDeductionForm();
                setShowDeductionModal(true);
              }}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Deduction
            </button>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Code</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Name</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Type</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Amount/Rate</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Statutory</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Global</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deductions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                        No deductions configured
                      </td>
                    </tr>
                  ) : (
                    deductions.map((deduction) => (
                      <tr key={deduction.id} className="hover:bg-accent transition-colors">
                        <td className="px-6 py-4 text-sm text-card-foreground">{deduction.code}</td>
                        <td className="px-6 py-4 text-sm text-card-foreground">{deduction.name}</td>
                        <td className="px-6 py-4 text-sm text-card-foreground capitalize">
                          {deduction.type}
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">
                          {deduction.type === 'fixed'
                            ? `₦${deduction.amount?.toLocaleString() || 0}`
                            : `${deduction.percentage || 0}%`}
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">
                          {deduction.is_statutory ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-card-foreground">
                          {deduction.applies_to_all ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-600" />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={deduction.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(deduction);
                                setDeductionForm({
                                  name: deduction.name,
                                  code: deduction.code,
                                  type: deduction.type,
                                  amount: deduction.amount || 0,
                                  percentage: deduction.percentage || 0,
                                  is_statutory: deduction.is_statutory,
                                  appliesToAll: deduction.applies_to_all ?? true,
                                  status: deduction.status,
                                });
                                setShowDeductionModal(true);
                              }}
                              className="p-2 hover:bg-accent rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              onClick={() => handleDeleteDeduction(deduction.id, deduction.name)}
                              className="p-2 hover:bg-destructive/10 rounded transition-colors"
                              title="Delete"
                              disabled={deletingId === deduction.id}
                            >
                              {deletingId === deduction.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-destructive" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Salary Structure Modal */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-lg p-6 bg-card border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3>{editingItem ? 'Edit Structure Details' : 'Create Salary Structure'}</h3>
              <button
                onClick={() => {
                  setShowStructureModal(false);
                  setEditingItem(null);
                }}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                editingItem ? handleEditStructureDetails() : handleCreateStructure();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm mb-1 text-card-foreground">Structure Name *</label>
                <input
                  type="text"
                  required
                  value={structureForm.name}
                  onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., CONMESS 2024"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-card-foreground">Effective Date *</label>
                <input
                  type="date"
                  required
                  value={structureForm.effective_date}
                  onChange={(e) =>
                    setStructureForm({ ...structureForm, effective_date: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {!editingItem && uploadedData && (
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    ✓ Uploaded salary structure data:
                  </p>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>• {uploadedData.gradeLevels.length} Grade Levels</li>
                    <li>• {uploadedData.gradeLevels.reduce((sum: number, gl: any) => sum + gl.steps.length, 0)} Total salary entries</li>
                    <li>• From uploaded CSV/Excel file</li>
                  </ul>
                </div>
              )}

              {!editingItem && !uploadedData && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    This will create a salary structure with:
                  </p>
                  <ul className="mt-2 text-sm text-card-foreground space-y-1">
                    <li>• 17 Grade Levels</li>
                    <li>• 15 Steps per level</li>
                    <li>• CONMESS 2024 salary scales</li>
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded transition-colors"
                >
                  {editingItem ? 'Update Details' : 'Create Structure'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStructureModal(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 py-2 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allowance Modal */}
      {showAllowanceModal && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-lg p-6 bg-card border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3>{editingItem ? 'Edit Allowance' : 'Create Allowance'}</h3>
              <button
                onClick={() => {
                  setShowAllowanceModal(false);
                  setEditingItem(null);
                }}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                editingItem ? handleUpdateAllowance() : handleCreateAllowance();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Code *</label>
                  <input
                    type="text"
                    required
                    value={allowanceForm.code}
                    onChange={(e) =>
                      setAllowanceForm({ ...allowanceForm, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., HOU"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Type *</label>
                  <select
                    required
                    value={allowanceForm.type}
                    onChange={(e) =>
                      setAllowanceForm({
                        ...allowanceForm,
                        type: e.target.value as 'fixed' | 'percentage',
                      })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1 text-card-foreground">Name *</label>
                <input
                  type="text"
                  required
                  value={allowanceForm.name}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., Housing Allowance"
                />
              </div>

              {allowanceForm.type === 'fixed' ? (
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Amount (₦) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={allowanceForm.amount}
                    onChange={(e) =>
                      setAllowanceForm({ ...allowanceForm, amount: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Percentage (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="1000"
                    step="0.01"
                    value={allowanceForm.percentage}
                    onChange={(e) =>
                      setAllowanceForm({ ...allowanceForm, percentage: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowanceForm.is_taxable}
                      onChange={(e) =>
                        setAllowanceForm({ ...allowanceForm, is_taxable: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-card-foreground">Taxable</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowanceForm.is_pensionable}
                      onChange={(e) =>
                        setAllowanceForm({ ...allowanceForm, is_pensionable: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-card-foreground">Pensionable</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowanceForm.appliesToAll ?? true}
                      onChange={(e) =>
                        setAllowanceForm({ ...allowanceForm, appliesToAll: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-card-foreground">Applies to All Staff</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1 text-card-foreground">Status *</label>
                <select
                  required
                  value={allowanceForm.status}
                  onChange={(e) =>
                    setAllowanceForm({
                      ...allowanceForm,
                      status: e.target.value as 'active' | 'inactive',
                    })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? 'Update Allowance' : 'Create Allowance'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAllowanceModal(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 py-2 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deduction Modal */}
      {showDeductionModal && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-lg p-6 bg-card border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3>{editingItem ? 'Edit Deduction' : 'Create Deduction'}</h3>
              <button
                onClick={() => {
                  setShowDeductionModal(false);
                  setEditingItem(null);
                }}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                editingItem ? handleUpdateDeduction() : handleCreateDeduction();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Code *</label>
                  <input
                    type="text"
                    required
                    value={deductionForm.code}
                    onChange={(e) =>
                      setDeductionForm({ ...deductionForm, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., TAX"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Type *</label>
                  <select
                    required
                    value={deductionForm.type}
                    onChange={(e) =>
                      setDeductionForm({
                        ...deductionForm,
                        type: e.target.value as 'fixed' | 'percentage',
                      })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1 text-card-foreground">Name *</label>
                <input
                  type="text"
                  required
                  value={deductionForm.name}
                  onChange={(e) => setDeductionForm({ ...deductionForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., Income Tax"
                />
              </div>

              {deductionForm.type === 'fixed' ? (
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Amount (₦) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={deductionForm.amount}
                    onChange={(e) =>
                      setDeductionForm({ ...deductionForm, amount: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Percentage (%) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={deductionForm.percentage}
                    onChange={(e) =>
                      setDeductionForm({ ...deductionForm, percentage: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deductionForm.is_statutory}
                      onChange={(e) =>
                        setDeductionForm({ ...deductionForm, is_statutory: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-card-foreground">Statutory</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deductionForm.appliesToAll ?? true}
                      onChange={(e) =>
                        setDeductionForm({ ...deductionForm, appliesToAll: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-card-foreground">Applies to All Staff</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1 text-card-foreground">Status *</label>
                <select
                  required
                  value={deductionForm.status}
                  onChange={(e) =>
                    setDeductionForm({
                      ...deductionForm,
                      status: e.target.value as 'active' | 'inactive',
                    })
                  }
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? 'Update Deduction' : 'Create Deduction'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeductionModal(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 py-2 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <SalaryStructureUpload
          onDataParsed={handleUploadedData}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
}
