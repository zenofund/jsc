import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { reportsAPI, reportHelpers, ReportTemplate, ReportExecutionResult } from '../lib/reportsAPI';
import {
  Plus,
  Search,
  Play,
  Edit,
  Trash2,
  Share2,
  Star,
  Clock,
  Download,
  MoreVertical,
  FileText,
  Loader2,
  TrendingUp,
  Filter,
  Calendar,
  Users,
  Building2,
  DollarSign,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PageSkeleton } from '../components/PageLoader';

const REPORT_BUILDER_EDIT_KEY = 'jsc_report_builder_template_id';
const SHARE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'payroll_officer', label: 'Payroll Officer' },
  { value: 'hr_manager', label: 'HR Manager' },
];

const ReportsListPage: React.FC = () => {
  // Navigation helper
  const navigate = (view: string) => {
    (window as any).navigateTo(view);
  };

  // State
  const [activeTab, setActiveTab] = useState('all');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [favorites, setFavorites] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [executing, setExecuting] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageSize] = useState(12);
  const [templateMeta, setTemplateMeta] = useState({ total: 0, page: 1, pageSize: 12, totalPages: 1, hasNextPage: false });

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: ReportTemplate | null }>({
    open: false,
    template: null,
  });

  // Execution results dialog
  const [resultsDialog, setResultsDialog] = useState<{
    open: boolean;
    result: ReportExecutionResult | null;
    template: ReportTemplate | null;
    page: number;
    pageSize: number;
  }>({
    open: false,
    result: null,
    template: null,
    page: 1,
    pageSize: 25,
  });
  const [sharing, setSharing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [shareDialog, setShareDialog] = useState<{
    open: boolean;
    template: ReportTemplate | null;
    sharedWithRole: string;
    canView: boolean;
    canEdit: boolean;
    canExecute: boolean;
    canSchedule: boolean;
    expiresAt: string;
  }>({
    open: false,
    template: null,
    sharedWithRole: 'payroll_officer',
    canView: true,
    canEdit: false,
    canExecute: true,
    canSchedule: false,
    expiresAt: '',
  });
  const [scheduleDialog, setScheduleDialog] = useState<{
    open: boolean;
    template: ReportTemplate | null;
    scheduleType: 'daily' | 'weekly' | 'monthly' | 'custom';
    timeOfDay: string;
    dayOfWeek: string;
    dayOfMonth: string;
    recipients: string;
    exportFormat: 'pdf' | 'excel' | 'csv';
  }>({
    open: false,
    template: null,
    scheduleType: 'daily',
    timeOfDay: '08:00',
    dayOfWeek: '1',
    dayOfMonth: '1',
    recipients: '',
    exportFormat: 'csv',
  });

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [templatePage, selectedCategory]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getTemplates(
        selectedCategory === 'all' ? undefined : selectedCategory,
        templatePage,
        templatePageSize,
      );
      setTemplates(response.data);
      setTemplateMeta(response.meta);
    } catch (error: any) {
      toast.error('Failed to load reports', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      // Check if user is authenticated before loading favorites
      const token = localStorage.getItem('jsc_auth_token');
      if (!token) {
        // User not authenticated, skip loading favorites
        return;
      }
      
      const data = await reportsAPI.getFavorites();
      setFavorites(data);
    } catch (error: any) {
      // Only log error if it's not an authentication error
      if (!error.message?.includes('authentication')) {
        console.error('Failed to load favorites:', error);
      }
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Execute report
  const executeReport = async (template: ReportTemplate, page: number = 1, pageSize: number = resultsDialog.pageSize) => {
    try {
      setExecuting(template.id);
      const result = await reportsAPI.executeReport({
        templateId: template.id,
        exportFormat: 'json',
        page,
        pageSize,
      });

      setResultsDialog({ open: true, result, template, page, pageSize });
      if ((result.meta.totalRows || 0) === 0) {
        toast.info('Report executed with no matching rows', {
          description: 'The report ran successfully, but no records matched the saved configuration.',
        });
      } else {
        toast.success('Report executed successfully', {
          description: `Retrieved ${result.meta.returnedRows || result.data.length} of ${result.meta.totalRows} rows`,
        });
      }
    } catch (error: any) {
      toast.error('Failed to execute report', {
        description: error.message,
      });
    } finally {
      setExecuting(null);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (template: ReportTemplate) => {
    try {
      if (template.is_favorite) {
        await reportsAPI.removeFromFavorites(template.id);
        toast.success('Removed from favorites');
      } else {
        await reportsAPI.addToFavorites(template.id);
        toast.success('Added to favorites');
      }
      loadTemplates();
      loadFavorites();
    } catch (error: any) {
      toast.error('Failed to update favorites', {
        description: error.message,
      });
    }
  };

  // Delete report
  const deleteReport = async () => {
    if (!deleteDialog.template) return;

    try {
      setIsDeleting(true);
      await reportsAPI.deleteTemplate(deleteDialog.template.id);
      toast.success('Report deleted successfully');
      setDeleteDialog({ open: false, template: null });
      loadTemplates();
    } catch (error: any) {
      toast.error('Failed to delete report', {
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Export data
  const exportData = async (fileFormat: 'csv' | 'excel' | 'pdf') => {
    if (!resultsDialog.template) return;

    try {
      const result = await reportsAPI.executeReport({
        templateId: resultsDialog.template.id,
        exportFormat: fileFormat,
      });

      if (result.meta.executionId) {
        toast.success('Export queued', {
          description: `Preparing ${fileFormat.toUpperCase()} export in the background.`,
        });
        await pollForExecutionDownload(result.meta.executionId);
      }
    } catch (error: any) {
      toast.error('Failed to start export', {
        description: error.message,
      });
    }
  };

  const pollForExecutionDownload = async (executionId: string) => {
    const start = Date.now();
    const maxWaitMs = 30000;

    while (Date.now() - start < maxWaitMs) {
      const execution = await reportsAPI.getExecutionById(executionId);
      if (execution.status === 'completed' && execution.file_path) {
        const blob = await reportsAPI.downloadExecutionFile(executionId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = execution.file_path.split(/[\\/]/).pop() || `report-export-${executionId}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export ready', {
          description: 'Your export file has been downloaded.',
        });
        return;
      }
      if (execution.status === 'failed') {
        throw new Error(execution.error_message || 'Export failed');
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    toast.info('Export is still processing', {
      description: 'The export is running in the background. You can check back shortly.',
    });
  };

  const openEditBuilder = (templateId: string) => {
    sessionStorage.setItem(REPORT_BUILDER_EDIT_KEY, templateId);
    navigate('custom-report-builder');
  };

  const openNewBuilder = () => {
    sessionStorage.removeItem(REPORT_BUILDER_EDIT_KEY);
    navigate('custom-report-builder');
  };

  const openShareDialog = (template: ReportTemplate) => {
    setShareDialog({
      open: true,
      template,
      sharedWithRole: 'payroll_officer',
      canView: true,
      canEdit: false,
      canExecute: true,
      canSchedule: false,
      expiresAt: '',
    });
  };

  const submitShare = async () => {
    if (!shareDialog.template) return;

    try {
      setSharing(true);
      await reportsAPI.shareReport({
        templateId: shareDialog.template.id,
        sharedWithRole: shareDialog.sharedWithRole,
        canView: shareDialog.canView,
        canEdit: shareDialog.canEdit,
        canExecute: shareDialog.canExecute,
        canSchedule: shareDialog.canSchedule,
        expiresAt: shareDialog.expiresAt ? new Date(`${shareDialog.expiresAt}T23:59:59`).toISOString() : undefined,
      });
      toast.success('Report shared successfully');
      setShareDialog((prev) => ({ ...prev, open: false, template: null }));
      loadTemplates();
    } catch (error: any) {
      toast.error('Failed to share report', {
        description: error.message,
      });
    } finally {
      setSharing(false);
    }
  };

  const openScheduleDialog = (template: ReportTemplate) => {
    setScheduleDialog({
      open: true,
      template,
      scheduleType: 'daily',
      timeOfDay: '08:00',
      dayOfWeek: '1',
      dayOfMonth: '1',
      recipients: '',
      exportFormat: 'csv',
    });
  };

  const submitSchedule = async () => {
    if (!scheduleDialog.template) return;

    try {
      setScheduling(true);
      const recipients = scheduleDialog.recipients
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((email) => ({ email }));

      await reportsAPI.scheduleReport({
        templateId: scheduleDialog.template.id,
        scheduleType: scheduleDialog.scheduleType,
        timeOfDay: scheduleDialog.timeOfDay || undefined,
        dayOfWeek: scheduleDialog.scheduleType === 'weekly' ? [Number(scheduleDialog.dayOfWeek)] : undefined,
        dayOfMonth: scheduleDialog.scheduleType === 'monthly' ? [Number(scheduleDialog.dayOfMonth)] : undefined,
        recipients,
        exportFormat: scheduleDialog.exportFormat,
      });
      toast.success('Report schedule created successfully');
      setScheduleDialog((prev) => ({ ...prev, open: false, template: null }));
    } catch (error: any) {
      toast.error('Failed to schedule report', {
        description: error.message,
      });
    } finally {
      setScheduling(false);
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      payroll: DollarSign,
      staff: Users,
      loans: Briefcase,
      leave: Calendar,
      cooperative: Building2,
      deductions: TrendingUp,
      allowances: TrendingUp,
      audit: FileText,
      custom: Filter,
    };
    const Icon = icons[category] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="page-title font-semibold">Custom Reports</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create, execute, and manage custom reports with live data
            </p>
          </div>
          <Button
            onClick={openNewBuilder}
            className="bg-[#008000] hover:bg-[#006600] w-full sm:w-auto self-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Report
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                {['all', 'payroll', 'staff', 'loans', 'leave', 'cooperative'].map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(category);
                      setTemplatePage(1);
                    }}
                    className={`whitespace-nowrap ${selectedCategory === category ? 'bg-[#008000] hover:bg-[#006600]' : ''}`}
                  >
                    {category === 'all' ? 'All' : reportHelpers.getCategoryLabel(category)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <div className="space-y-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-4 overflow-x-auto">
              {[
                { id: 'all', label: `All Reports (${templates.length})` },
                { id: 'favorites', label: `Favorites (${favorites.length})`, icon: Star },
                { id: 'my-reports', label: `My Reports (${templates.filter(t => t.access_type === 'owner').length})` },
                { id: 'shared', label: `Shared with Me (${templates.filter(t => t.access_type === 'shared').length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#008000] text-[#008000]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.icon && <tab.icon className="h-4 w-4" />}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* All Reports */}
          {activeTab === 'all' && (
            <ReportGrid
              templates={filteredTemplates}
              executing={executing}
              onExecute={executeReport}
              onToggleFavorite={toggleFavorite}
              onDelete={(template) => setDeleteDialog({ open: true, template })}
              onEdit={openEditBuilder}
              onShare={openShareDialog}
              onSchedule={openScheduleDialog}
              getCategoryIcon={getCategoryIcon}
            />
          )}

          {/* Favorites */}
          {activeTab === 'favorites' && (
            <ReportGrid
              templates={favorites.filter(t => 
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                (selectedCategory === 'all' || t.category === selectedCategory)
              )}
              executing={executing}
              onExecute={executeReport}
              onToggleFavorite={toggleFavorite}
              onDelete={(template) => setDeleteDialog({ open: true, template })}
              onEdit={openEditBuilder}
              onShare={openShareDialog}
              onSchedule={openScheduleDialog}
              getCategoryIcon={getCategoryIcon}
            />
          )}

          {/* My Reports */}
          {activeTab === 'my-reports' && (
            <ReportGrid
              templates={filteredTemplates.filter(t => t.access_type === 'owner')}
              executing={executing}
              onExecute={executeReport}
              onToggleFavorite={toggleFavorite}
              onDelete={(template) => setDeleteDialog({ open: true, template })}
              onEdit={openEditBuilder}
              onShare={openShareDialog}
              onSchedule={openScheduleDialog}
              getCategoryIcon={getCategoryIcon}
            />
          )}

          {/* Shared */}
          {activeTab === 'shared' && (
            <ReportGrid
              templates={filteredTemplates.filter(t => t.access_type === 'shared')}
              executing={executing}
              onExecute={executeReport}
              onToggleFavorite={toggleFavorite}
              onDelete={(template) => setDeleteDialog({ open: true, template })}
              onEdit={openEditBuilder}
              onShare={openShareDialog}
              onSchedule={openScheduleDialog}
              getCategoryIcon={getCategoryIcon}
            />
          )}

          {activeTab === 'all' && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                Page {templateMeta.page} of {templateMeta.totalPages} • {templateMeta.total} total reports
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTemplatePage((prev) => Math.max(prev - 1, 1))}
                  disabled={templateMeta.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTemplatePage((prev) => prev + 1)}
                  disabled={!templateMeta.hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open: boolean) => setDeleteDialog({ open, template: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.template?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, template: null })} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteReport} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={shareDialog.open}
        onOpenChange={(open: boolean) => setShareDialog((prev) => ({ ...prev, open, template: open ? prev.template : null }))}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Report</DialogTitle>
            <DialogDescription>
              Grant access to "{shareDialog.template?.name}" by role and control what that role can do.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Share With Role</Label>
              <Select
                value={shareDialog.sharedWithRole}
                onValueChange={(value) => setShareDialog((prev) => ({ ...prev, sharedWithRole: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-expiry">Expiry Date</Label>
              <Input
                id="share-expiry"
                type="date"
                value={shareDialog.expiresAt}
                onChange={(e) => setShareDialog((prev) => ({ ...prev, expiresAt: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'canView', label: 'Can view' },
                { key: 'canExecute', label: 'Can execute' },
                { key: 'canEdit', label: 'Can edit' },
                { key: 'canSchedule', label: 'Can schedule' },
              ].map((permission) => (
                <label key={permission.key} className="flex items-center gap-2 rounded-md border p-3">
                  <Checkbox
                    checked={Boolean(shareDialog[permission.key as keyof typeof shareDialog])}
                    onCheckedChange={(checked) =>
                      setShareDialog((prev) => {
                        const next = { ...prev, [permission.key]: Boolean(checked) } as typeof prev;
                        if (permission.key === 'canView' && !checked) {
                          next.canEdit = false;
                          next.canExecute = false;
                          next.canSchedule = false;
                        }
                        if (permission.key !== 'canView' && checked) {
                          next.canView = true;
                        }
                        return next;
                      })
                    }
                  />
                  <span className="text-sm">{permission.label}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialog((prev) => ({ ...prev, open: false, template: null }))} disabled={sharing}>
              Cancel
            </Button>
            <Button onClick={submitShare} disabled={sharing}>
              {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Share Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={scheduleDialog.open}
        onOpenChange={(open: boolean) => setScheduleDialog((prev) => ({ ...prev, open, template: open ? prev.template : null }))}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Report</DialogTitle>
            <DialogDescription>
              Configure automatic delivery for "{scheduleDialog.template?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Schedule Type</Label>
                <Select
                  value={scheduleDialog.scheduleType}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'custom') =>
                    setScheduleDialog((prev) => ({ ...prev, scheduleType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-time">Time of Day</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleDialog.timeOfDay}
                  onChange={(e) => setScheduleDialog((prev) => ({ ...prev, timeOfDay: e.target.value }))}
                />
              </div>
            </div>
            {scheduleDialog.scheduleType === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={scheduleDialog.dayOfWeek}
                  onValueChange={(value) => setScheduleDialog((prev) => ({ ...prev, dayOfWeek: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: '0', label: 'Sunday' },
                      { value: '1', label: 'Monday' },
                      { value: '2', label: 'Tuesday' },
                      { value: '3', label: 'Wednesday' },
                      { value: '4', label: 'Thursday' },
                      { value: '5', label: 'Friday' },
                      { value: '6', label: 'Saturday' },
                    ].map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scheduleDialog.scheduleType === 'monthly' && (
              <div className="space-y-2">
                <Label htmlFor="schedule-day-of-month">Day of Month</Label>
                <Input
                  id="schedule-day-of-month"
                  type="number"
                  min={1}
                  max={31}
                  value={scheduleDialog.dayOfMonth}
                  onChange={(e) => setScheduleDialog((prev) => ({ ...prev, dayOfMonth: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select
                value={scheduleDialog.exportFormat}
                onValueChange={(value: 'pdf' | 'excel' | 'csv') => setScheduleDialog((prev) => ({ ...prev, exportFormat: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-recipients">Recipient Emails</Label>
              <Textarea
                id="schedule-recipients"
                rows={3}
                placeholder="finance@example.com, hr@example.com"
                value={scheduleDialog.recipients}
                onChange={(e) => setScheduleDialog((prev) => ({ ...prev, recipients: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Separate multiple recipients with commas.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog((prev) => ({ ...prev, open: false, template: null }))} disabled={scheduling}>
              Cancel
            </Button>
            <Button onClick={submitSchedule} disabled={scheduling}>
              {scheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              Schedule Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog 
        open={resultsDialog.open} 
        onOpenChange={(open: boolean) => setResultsDialog({ open, result: null, template: null, page: 1, pageSize: 25 })}
      >
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{resultsDialog.result?.template.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportData('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportData('excel')}>
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportData('pdf')}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              {resultsDialog.result?.meta.totalRows} rows • 
              Executed in {reportHelpers.formatExecutionTime(resultsDialog.result?.meta.executionTimeMs || 0)}
            </DialogDescription>
          </DialogHeader>

          {resultsDialog.result && resultsDialog.result.data.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(resultsDialog.result.meta.page || 1)} of {resultsDialog.result.meta.totalPages || 1} pages
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resultsDialog.template &&
                      executeReport(
                        resultsDialog.template,
                        Math.max((resultsDialog.result?.meta.page || 1) - 1, 1),
                        resultsDialog.pageSize,
                      )
                    }
                    disabled={(resultsDialog.result.meta.page || 1) <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      resultsDialog.template &&
                      executeReport(
                        resultsDialog.template,
                        (resultsDialog.result?.meta.page || 1) + 1,
                        resultsDialog.pageSize,
                      )
                    }
                    disabled={!resultsDialog.result.meta.hasNextPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
              <div className="overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    {Object.keys(resultsDialog.result.data[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {resultsDialog.result.data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      {Object.values(row).map((value: any, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                        >
                          {value !== null && value !== undefined ? String(value) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {resultsDialog.result && resultsDialog.result.data.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              <Play className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>No rows matched this report</p>
              <p className="mt-2 text-sm">
                The execution completed successfully, but the saved report returned no records.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Report Grid Component
interface ReportGridProps {
  templates: ReportTemplate[];
  executing: string | null;
  onExecute: (template: ReportTemplate) => void;
  onToggleFavorite: (template: ReportTemplate) => void;
  onDelete: (template: ReportTemplate) => void;
  onEdit: (templateId: string) => void;
  onShare: (template: ReportTemplate) => void;
  onSchedule: (template: ReportTemplate) => void;
  getCategoryIcon: (category: string) => React.ReactNode;
}

const ReportGrid: React.FC<ReportGridProps> = ({
  templates,
  executing,
  onExecute,
  onToggleFavorite,
  onDelete,
  onEdit,
  onShare,
  onSchedule,
  getCategoryIcon,
}) => {
  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No reports found</p>
            <p className="text-sm mt-2">Create your first custom report to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template) => (
        <Card key={template.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={reportHelpers.getCategoryColor(template.category)}>
                    {getCategoryIcon(template.category)}
                    <span className="ml-1">{reportHelpers.getCategoryLabel(template.category)}</span>
                  </Badge>
                  {template.is_public && (
                    <Badge variant="outline">Public</Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription className="mt-2 line-clamp-2">
                  {template.description || 'No description'}
                </CardDescription>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onExecute(template)}>
                    <Play className="h-4 w-4 mr-2" />
                    Execute
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleFavorite(template)}>
                    <Star className={`h-4 w-4 mr-2 ${template.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    {template.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  </DropdownMenuItem>
                  {template.can_edit !== false && (
                    <DropdownMenuItem onClick={() => onEdit(template.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onShare(template)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSchedule(template)}>
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {template.access_type === 'owner' && (
                    <DropdownMenuItem onClick={() => onDelete(template)} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Users className="h-4 w-4" />
                <span>Created by {template.created_by_name || 'Unknown'}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span>{format(new Date(template.created_at), 'MMM dd, yyyy')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Runs: {template.execution_count || 0}</div>
                <div>Failures: {template.failed_execution_count || 0}</div>
                <div>Avg Time: {template.average_execution_time_ms ? `${template.average_execution_time_ms}ms` : '-'}</div>
                <div>Last Run: {template.last_executed_at ? format(new Date(template.last_executed_at), 'MMM dd') : 'Never'}</div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 bg-[#008000] hover:bg-[#006600]"
                  onClick={() => onExecute(template)}
                  disabled={executing === template.id}
                >
                  {executing === template.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleFavorite(template)}
                >
                  <Star className={`h-4 w-4 ${template.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ReportsListPage;
