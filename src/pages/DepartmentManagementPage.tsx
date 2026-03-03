import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { departmentAPI } from '../lib/api-client';
import { Department } from '../types/entities';
import { Building2, Plus, Edit2, Trash2, Users, X, Search, Loader2 } from 'lucide-react';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageSkeleton } from '../components/PageLoader';

export function DepartmentManagementPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    head_of_department: '',
    budget_code: '',
    location: '',
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await departmentAPI.getAllDepartments();
      setDepartments(data);
    } catch (error) {
      showToast('error', 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingDepartment(null);
    setIdempotencyKey(crypto.randomUUID());
    setFormData({
      name: '',
      code: '',
      description: '',
      head_of_department: '',
      budget_code: '',
      location: '',
      status: 'active' as 'active' | 'inactive',
    });
    setShowModal(true);
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      code: department.code,
      description: department.description || '',
      head_of_department: department.head_of_department || '',
      budget_code: department.budget_code || '',
      location: department.location || '',
      status: department.status,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingDepartment) {
        await departmentAPI.updateDepartment(editingDepartment.id, formData);
        showToast('success', 'Department updated successfully');
      } else {
        await departmentAPI.createDepartment(formData, {
          headers: {
            'Idempotency-Key': idempotencyKey
          }
        });
        showToast('success', 'Department created successfully');
      }
      setShowModal(false);
      loadDepartments();
    } catch (error: any) {
      showToast('error', error.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!await confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    
    setDeletingId(id);
    try {
      await departmentAPI.deleteDepartment(id);
      showToast('success', 'Department deleted successfully');
      loadDepartments();
    } catch (error: any) {
      showToast('error', error.message || 'Failed to delete department');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: departments.length,
    active: departments.filter(d => d.status === 'active').length,
    inactive: departments.filter(d => d.status === 'inactive').length,
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Human Resources' }, { label: 'Department Management' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title font-bold">Department Management</h1>
          <p className="text-muted-foreground">
            Manage organizational departments and units
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-muted">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-sm mb-1 text-muted-foreground">Total Departments</p>
          <p className="text-2xl text-card-foreground">{stats.total}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-muted">
              <Users className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <p className="text-sm mb-1 text-muted-foreground">Active Departments</p>
          <p className="text-2xl text-card-foreground">{stats.active}</p>
        </div>
        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-muted">
              <Building2 className="w-6 h-6 text-gray-500" />
            </div>
          </div>
          <p className="text-sm mb-1 text-muted-foreground">Inactive Departments</p>
          <p className="text-2xl text-card-foreground">{stats.inactive}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search departments by name, code, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDepartments.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No departments found
          </div>
        ) : (
          filteredDepartments.map((department) => (
            <div
              key={department.id}
              className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-card-foreground">{department.name}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        department.status === 'active'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}
                    >
                      {department.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Code: {department.code}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(department)}
                    className="p-2 hover:bg-accent rounded transition-colors"
                    title="Edit"
                    disabled={deletingId === department.id}
                  >
                    <Edit2 className="w-4 h-4 text-primary" />
                  </button>
                  <button
                    onClick={() => handleDelete(department.id, department.name)}
                    className="p-2 hover:bg-destructive/10 rounded transition-colors"
                    title="Delete"
                    disabled={deletingId === department.id}
                  >
                    {deletingId === department.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-destructive" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-destructive" />
                    )}
                  </button>
                </div>
              </div>

              {department.description && (
                <p className="text-sm mb-4 text-muted-foreground line-clamp-2">
                  {department.description}
                </p>
              )}

              <div className="space-y-2 text-sm">
                {department.head_of_department && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-card-foreground">{department.head_of_department}</span>
                  </div>
                )}
                {department.location && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-card-foreground">{department.location}</span>
                  </div>
                )}
                {department.budget_code && (
                  <div className="text-xs text-muted-foreground">
                    Budget Code: {department.budget_code}
                  </div>
                )}
              </div>

              {department.created_at && (
                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                  Created: {new Date(department.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full rounded-lg p-6 max-h-[90vh] overflow-y-auto bg-card border border-border">
            <div className="flex justify-between items-center mb-6">
              <h3>{editingDepartment ? 'Edit Department' : 'Create Department'}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., Human Resources"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">
                    Department Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g., HR"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1 text-card-foreground">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={3}
                  placeholder="Brief description of the department's role and responsibilities"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">
                    Head of Department
                  </label>
                  <input
                    type="text"
                    value={formData.head_of_department}
                    onChange={(e) => setFormData({ ...formData, head_of_department: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Name of department head"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Office location or building"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Budget Code</label>
                  <input
                    type="text"
                    value={formData.budget_code}
                    onChange={(e) => setFormData({ ...formData, budget_code: e.target.value })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Budget/cost center code"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-card-foreground">Status *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 rounded border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingDepartment ? 'Update Department' : 'Create Department'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
