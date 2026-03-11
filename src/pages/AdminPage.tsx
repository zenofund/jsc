import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { userAPI, settingsAPI, auditAPI } from '../lib/api-client';
import { User, SystemSettings } from '../types/entities';
import { Users, Shield, Settings as SettingsIcon, Activity, Plus, Edit, Trash2, Loader2, Save, X, Eye, EyeOff, Lock, Image as ImageIcon } from 'lucide-react';
import { Building } from 'lucide-react';
import { showToast } from '../utils/toast';
import { Modal } from '../components/Modal';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSkeleton } from '../components/PageLoader';

import { Skeleton } from '../components/ui/skeleton';

export function AdminPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  // Removed conflicting useToast hook usage
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [allowedGradesInput, setAllowedGradesInput] = useState<string>('');
  const [allowedGradesError, setAllowedGradesError] = useState<string>('');
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [logoProcessing, setLogoProcessing] = useState(false);

  // User form state
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'staff' as User['role'],
    department: '',
    status: 'active' as User['status'],
  });

  // Approval Workflow Edit State
  const [isEditingWorkflow, setIsEditingWorkflow] = useState(false);
  const [workflowStages, setWorkflowStages] = useState<SystemSettings['approval_workflow']>([]);

  const normalizeRole = (role: any) => {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'reviewer') return 'checking';
    if (r === 'approver') return 'cpo';
    return r;
  };

  const formatRoleLabel = (role: any) => {
    const r = normalizeRole(role);
    if (r === 'cpo') return 'CPO';
    if (r === 'checking') return 'Checking';
    return String(r || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const handleEditWorkflow = () => {
    setWorkflowStages([...(settings?.approval_workflow || [])].map((s: any) => ({
      ...s,
      role: normalizeRole(s.role),
    })));
    setIsEditingWorkflow(true);
  };

  const handleCancelWorkflow = () => {
    setIsEditingWorkflow(false);
    setWorkflowStages([]);
  };

  const handleAddStage = () => {
    setWorkflowStages([
      ...workflowStages,
      {
        stage: workflowStages.length + 1,
        role: 'payroll_officer',
        name: 'New Approval Stage',
      },
    ]);
  };

  const handleRemoveStage = (index: number) => {
    const newStages = workflowStages.filter((_, i) => i !== index).map((stage, i) => ({
      ...stage,
      stage: i + 1
    }));
    setWorkflowStages(newStages);
  };

  const handleStageChange = (index: number, field: 'role' | 'name', value: string) => {
    const newStages = [...workflowStages];
    newStages[index] = { ...newStages[index], [field]: value };
    setWorkflowStages(newStages);
  };

  const handleSaveWorkflow = async () => {
    if (!settings || !user) return;
    setIsSubmitting(true);
    try {
      const updatedSettings = {
        ...settings,
        approval_workflow: workflowStages
      };
      await settingsAPI.updateSettings(updatedSettings, user!.id, user!.email);
      setSettings(updatedSettings);
      setIsEditingWorkflow(false);
      showToast.success('Approval workflow updated successfully');
    } catch (error) {
      console.error('Failed to update workflow:', error);
      showToast.error('Failed to update approval workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      if (activeTab === 'users') {
        const usersData = await userAPI.getAllUsers();
        setUsers(usersData);
      } else if (activeTab === 'settings') {
        const settingsData = await settingsAPI.getSettings();
        setSettings(settingsData);
        if (Array.isArray(settingsData?.allowed_grades)) {
          setAllowedGradesInput(settingsData.allowed_grades.join(', '));
        }
      }
    } catch (error) {
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    setIsSubmitting(true);
    try {
      await userAPI.createUser(
        {
          ...userForm,
          password_hash: userForm.password,
          permissions: getRolePermissions(userForm.role),
          must_change_password: true,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        }
      );
      showToast.success('User created successfully');
      setShowUserModal(false);
      resetUserForm();
      loadData();
    } catch (error: any) {
      if (error.message?.includes('403') || error.status === 403) {
         showToast.error('You do not have permission to create users.');
      } else {
         showToast.error('Failed to create user');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    setIsSubmitting(true);
    try {
      await userAPI.updateUser(
        editingUser.id,
        {
          ...userForm,
          permissions: getRolePermissions(userForm.role),
        }
      );
      showToast.success('User updated successfully');
      setShowUserModal(false);
      setEditingUser(null);
      resetUserForm();
      loadData();
    } catch (error) {
      showToast.error('Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await confirm('Are you sure you want to delete this user?');
    if (!confirmed) return;
    
    setDeletingUserId(userId);
    try {
      await userAPI.deleteUser(userId, user!.id, user!.email);
      showToast.success('User deleted successfully');
      loadData();
    } catch (error) {
      showToast.error('Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSaveSettings = async () => {
    setIsSubmitting(true);
    try {
      // Parse allowed grades from input
      const parsed = allowedGradesInput
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n > 0 && n <= 50);
      const uniqueSorted = Array.from(new Set(parsed)).sort((a, b) => a - b);
      if (uniqueSorted.length === 0) {
        setAllowedGradesError('Please enter at least one valid grade level (e.g., 3, 4, 5)');
        setIsSubmitting(false);
        return;
      }
      setAllowedGradesError('');

      const updated = { ...settings, allowed_grades: uniqueSorted } as any;
      await settingsAPI.updateSettings(updated, user!.id, user!.email);
      setSettings(updated);
      showToast.success('Settings updated successfully');
    } catch (error) {
      showToast.error('Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processLogoToSquare = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sourceSize = Math.min(img.width, img.height);
          const sourceX = (img.width - sourceSize) / 2;
          const sourceY = (img.height - sourceSize) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = 75;
          canvas.height = 75;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Unable to process logo'));
            return;
          }
          ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 75, 75);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = String(reader.result || '');
      };
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast.error('Please upload PNG, JPG, or WEBP image');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast.error('Logo file size must be 5MB or less');
      e.target.value = '';
      return;
    }
    try {
      setLogoProcessing(true);
      const logoDataUrl = await processLogoToSquare(file);
      setSettings({ ...settings, organization_logo: logoDataUrl });
      showToast.success('Logo processed to 75x75 square');
    } catch (error: any) {
      showToast.error(error.message || 'Failed to process logo');
    } finally {
      setLogoProcessing(false);
      e.target.value = '';
    }
  };

  const resetUserForm = () => {
    setUserForm({
      email: '',
      password: '',
      full_name: '',
      role: 'staff',
      department: '',
      status: 'active',
    });
  };

  const getRolePermissions = (role: User['role']): string[] => {
    const permissions: Record<User['role'], string[]> = {
      admin: ['*'],
      payroll_officer: ['payroll.create', 'payroll.edit', 'staff.view', 'staff.create', 'staff.edit'],
      hr_manager: ['staff.create', 'staff.edit', 'staff.view', 'department.manage'],
      reviewer: ['payroll.review', 'payroll.view', 'staff.view'],
      checking: ['payroll.review', 'payroll.view', 'staff.view'],
      approver: ['payroll.approve', 'payroll.view', 'staff.view'],
      cpo: ['payroll.approve', 'payroll.view', 'staff.view'],
      auditor: ['payroll.view', 'staff.view', 'audit.view'],
      cashier: ['payment.execute', 'payroll.view'],
      staff: ['payslip.view', 'profile.view'],
      payroll_loader: ['payroll.view', 'payroll.load'],
    };
    return permissions[role];
  };

  const userColumns = [
    {
      header: 'Name',
      accessor: 'full_name' as keyof User,
      sortable: true,
    },
    {
      header: 'Email',
      accessor: 'email' as keyof User,
      sortable: true,
    },
    {
      header: 'Role',
      accessor: (row: User) => (
        <span>{formatRoleLabel(row.role)}</span>
      ),
    },
    {
      header: 'Department',
      accessor: (row: User) => row.department || '-',
    },
    {
      header: 'Status',
      accessor: (row: User) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Last Login',
      accessor: (row: User) => row.last_login ? new Date(row.last_login).toLocaleDateString() : 'Never',
    },
    {
      header: 'Actions',
      accessor: (row: User) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingUser(row);
              setUserForm({
                email: row.email,
                password: '',
                full_name: row.full_name,
                role: normalizeRole(row.role) as User['role'],
                department: row.department || '',
                status: row.status,
              });
              setShowUserModal(true);
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Edit"
            disabled={deletingUserId === row.id}
          >
            <Edit className="w-4 h-4 text-blue-600" />
          </button>
          {row.id !== user?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteUser(row.id);
              }}
              className="p-1 hover:bg-gray-100 rounded"
              title="Delete"
              disabled={deletingUserId === row.id}
            >
              {deletingUserId === row.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
              ) : (
                <Trash2 className="w-4 h-4 text-red-600" />
              )}
            </button>
          )}
        </div>
      ),
    },
  ];

  const auditColumns: any[] = [];

  const tabs = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'settings', label: 'System Settings', icon: SettingsIcon },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'System Administration' }]} />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="page-title">System Administration</h1>
          <p className="text-muted-foreground">Manage users, system settings, and audit logs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIdempotencyKey(crypto.randomUUID());
              setShowUserModal(true);
            }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div>
          {loading ? (
            <PageSkeleton mode="table" />
          ) : (
            <DataTable
              data={users}
              columns={userColumns}
              searchable
              searchPlaceholder="Search users..."
            />
          )}
        </div>
      )}

      {/* System Settings Tab */}
      {activeTab === 'settings' && (
        <>
        {loading ? (
             <PageSkeleton mode="grid" />
        ) : (
        settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Organization Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={settings.organization_name}
                  onChange={(e) => setSettings({ ...settings, organization_name: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Organization Logo
                </label>
                <div className="flex items-start gap-3">
                  <div className="w-[75px] h-[75px] rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                    {settings.organization_logo ? (
                      <img src={settings.organization_logo} alt="Organization logo" className="w-[75px] h-[75px] object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      disabled={logoProcessing}
                      className="block text-sm text-foreground file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <div className="text-xs text-muted-foreground">Image is center-cropped to 1:1 and resized to 75x75px.</div>
                    {settings.organization_logo && (
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, organization_logo: '' })}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Payroll Prefix
                </label>
                <input
                  type="text"
                  value={settings.payroll_prefix}
                  onChange={(e) => setSettings({ ...settings, payroll_prefix: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., JSC"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Payroll Cutoff Day
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={settings.payday_day || 25}
                  onChange={(e) => setSettings({ ...settings, payday_day: parseInt(e.target.value) || 25 })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Day of month (1-31)"
                />
                <p className="text-xs text-muted-foreground mt-1">Day of the month to mark as payroll cutoff</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  App Version
                </label>
                <input
                  type="text"
                  value={settings.app_version || ''}
                  onChange={(e) => setSettings({ ...settings, app_version: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="e.g., 1.0.1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.auto_generate_payslips}
                  onChange={(e) => setSettings({ ...settings, auto_generate_payslips: e.target.checked })}
                  className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
                />
                <label className="text-sm text-foreground">
                  Automatically generate payslips after approval
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Allowed Grade Levels
                </label>
                <input
                  type="text"
                  value={allowedGradesInput}
                  onChange={(e) => setAllowedGradesInput(e.target.value)}
                  className={`w-full px-3 py-2 border ${allowedGradesError ? 'border-red-500' : 'border-border'} bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent`}
                  placeholder="e.g., 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17"
                />
                {allowedGradesError && <p className="text-xs text-red-600 mt-1">{allowedGradesError}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated list; UI and validations will use this list. Ensure corresponding salary structure rows exist.
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={isSubmitting}
              className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>

          {/* Approval Workflow */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Approval Workflow</h3>
              {!isEditingWorkflow ? (
                <button
                  onClick={handleEditWorkflow}
                  className="p-1 text-muted-foreground hover:text-primary rounded-full hover:bg-muted"
                  title="Edit Workflow"
                >
                  <Edit className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveWorkflow}
                    disabled={isSubmitting}
                    className="p-1 text-green-600 hover:text-green-700 rounded-full hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save Changes"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancelWorkflow}
                    className="p-1 text-red-600 hover:text-red-700 rounded-full hover:bg-red-50"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {isEditingWorkflow ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {workflowStages.map((stage, index) => (
                    <div key={index} className="p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-foreground">Stage {stage.stage}</span>
                        <button
                          onClick={() => handleRemoveStage(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove Stage"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
                          <select
                            value={stage.role}
                            onChange={(e) => handleStageChange(index, 'role', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-border bg-background text-foreground rounded focus:ring-1 focus:ring-primary"
                          >
                            <option value="hr_manager">HR Manager</option>
                            <option value="payroll_officer">Payroll Officer</option>
                            <option value="checking">Checking</option>
                            <option value="cpo">CPO</option>
                            <option value="auditor">Auditor</option>
                            <option value="admin">Administrator</option>
                            <option value="cashier">Cashier</option>
                            <option value="staff">Staff</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                          <input
                            type="text"
                            value={stage.name}
                            onChange={(e) => handleStageChange(index, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-border bg-background text-foreground rounded focus:ring-1 focus:ring-primary"
                            placeholder="Stage Name"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddStage}
                  className="w-full py-2 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:text-primary hover:border-primary hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Approval Stage
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {settings.approval_workflow.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No approval workflow defined.</p>
                ) : (
                  settings.approval_workflow.map((stage, index) => (
                    <div key={index} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">Stage {stage.stage}</span>
                        <span className="text-xs text-muted-foreground capitalize">{stage.role.replace('_', ' ')}</span>
                      </div>
                      <p className="text-sm text-foreground">{stage.name}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Tax Zones */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">Tax Zones</h3>
            <div className="space-y-2">
              {settings.tax_zones.map((zone, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm text-foreground">{zone.zone}</span>
                  <span className="text-sm font-medium text-foreground">{zone.rate}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">System Information</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Database:</dt>
                <dd className="text-foreground">NestJS + Supabase</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Version:</dt>
                <dd className="text-foreground">{settings.app_version || '1.0.1'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created:</dt>
                <dd className="text-foreground">{new Date(settings.created_at).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last Updated:</dt>
                <dd className="text-foreground">{new Date(settings.updated_at).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>
        </div>
        )
        )}
        </>
      )}

      {/* Audit Trail UI moved to dedicated page: Admin/AuditLogPage */}

      {/* User Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
          resetUserForm();
        }}
        title={editingUser ? 'Edit User' : 'Add New User'}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowUserModal(false);
                setEditingUser(null);
                resetUserForm();
              }}
              disabled={isSubmitting}
              className="px-4 py-2 text-foreground hover:bg-accent rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={editingUser ? handleUpdateUser : handleCreateUser}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          {!editingUser && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showUserPassword ? 'text' : 'password'}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full pl-9 pr-10 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword(!showUserPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showUserPassword ? 'Hide password' : 'Show password'}
                >
                  {showUserPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">User will be required to change password on first login</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Role *
            </label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User['role'] })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="staff">Staff</option>
              <option value="payroll_officer">Payroll Officer</option>
              <option value="checking">Checking</option>
              <option value="cpo">CPO</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Administrator</option>
              <option value="hr_manager">HR Manager</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Department
            </label>
            <input
              type="text"
              value={userForm.department}
              onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Status *
            </label>
            <select
              value={userForm.status}
              onChange={(e) => setUserForm({ ...userForm, status: e.target.value as User['status'] })}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {editingUser && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                <strong>Note:</strong> Password cannot be changed here. User must use password reset functionality.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
