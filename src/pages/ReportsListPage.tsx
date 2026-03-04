import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
import { settingsAPI } from '../lib/api-client';
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
  Briefcase,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { PageSkeleton } from '../components/PageLoader';

// Initialize vfs for pdfmake
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
}

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

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: ReportTemplate | null }>({
    open: false,
    template: null,
  });

  const [organizationName, setOrganizationName] = useState('Nigerian Judicial Service Committee');
  const [organizationLogo, setOrganizationLogo] = useState('');

  // Execution results dialog
  const [resultsDialog, setResultsDialog] = useState<{
    open: boolean;
    result: ReportExecutionResult | null;
  }>({
    open: false,
    result: null,
  });

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    loadFavorites();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settings = await settingsAPI.getSettings();
      if (settings?.organization_name) {
        setOrganizationName(settings.organization_name);
      }
      if (settings?.organization_logo) {
        setOrganizationLogo(settings.organization_logo);
      } else {
        setOrganizationLogo('');
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await reportsAPI.getTemplates();
      setTemplates(data);
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
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Execute report
  const executeReport = async (template: ReportTemplate) => {
    try {
      setExecuting(template.id);
      const result = await reportsAPI.executeReport({
        templateId: template.id,
        exportFormat: 'json',
      });

      setResultsDialog({ open: true, result });
      toast.success('Report executed successfully', {
        description: `Retrieved ${result.meta.totalRows} rows`,
      });
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
  const exportData = (fileFormat: 'csv' | 'excel' | 'pdf') => {
    if (!resultsDialog.result) return;

    // Convert data to CSV
    if (fileFormat === 'csv' || fileFormat === 'excel') {
      if (!resultsDialog.result) return;
      const data = resultsDialog.result.data;
      if (data.length === 0) return;

      const headers = Object.keys(data[0]);
      const displayHeaders = headers.map(h => h.toUpperCase());
      const currentDate = new Date().toLocaleDateString();
      
      // Calculate totals for numeric columns
      const totals: Record<string, number> = {};
      const numericColumns = new Set<string>();

      const parseNumeric = (val: any) => {
        if (val === null || val === undefined || val === '') return null;
        const cleaned = String(val).replace(/[^0-9.-]+/g, '');
        if (!cleaned || !/[0-9]/.test(cleaned)) return null;
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
      };

      headers.forEach(header => {
        const isNumeric = data.every(row => {
          const val = row[header];
          if (val === null || val === undefined || val === '') return true;
          return parseNumeric(val) !== null;
        });
        
        if (isNumeric) {
          numericColumns.add(header);
          const sum = data.reduce((acc, row) => {
            const num = parseNumeric(row[header]);
            return acc + (num ?? 0);
          }, 0);
          totals[header] = sum;
        }
      });

      const reportHeader = `${organizationName.toUpperCase()}\n${resultsDialog.result.template.name.toUpperCase()}\nGENERATED: ${currentDate}\n\n`;

      const formatValue = (header: string, val: any) => {
        if (!numericColumns.has(header)) return `"${val ?? ''}"`;
        if (val === null || val === undefined || val === '') return '""';
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('id') || lowerHeader.includes('number') || lowerHeader.includes('year')) {
          return `"${val}"`;
        }
        const num = parseNumeric(val);
        if (num === null) return `"${val}"`;
        return `"${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`;
      };

      const csvContent = [
        displayHeaders.join(','),
        ...data.map(row => headers.map(h => formatValue(h, row[h])).join(',')),
        // Add total row if any numeric columns found
        Object.keys(totals).length > 0 ? '\nTOTALS,' + headers.map(h => {
            if (totals[h] !== undefined) {
                 const lowerHeader = h.toLowerCase();
                 if (lowerHeader.includes('id') || lowerHeader.includes('number') || lowerHeader.includes('year')) {
                     return '';
                 }
                 return `"${totals[h].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`;
            }
            return '';
        }).slice(1).join(',') : ''
      ].join('\n');
      
      const csv = reportHeader + csvContent;

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(resultsDialog.result.template.name).replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(fileFormat === 'csv' ? `Exported as CSV` : `Exported as Excel-compatible CSV`);
    } else if (fileFormat === 'pdf') {
      if (!resultsDialog.result) return;
      const data = resultsDialog.result.data;
      if (data.length === 0) return;

      const headers = Object.keys(data[0]);

      const tableLayout = {
        hLineWidth: function (i: number, node: any) { return 0; },
        vLineWidth: function (i: number, node: any) { return 0; },
        paddingLeft: function (i: number, node: any) { return 10; },
        paddingRight: function (i: number, node: any) { return 10; },
        paddingTop: function (i: number, node: any) { return 8; },
        paddingBottom: function (i: number, node: any) { return 8; },
        fillColor: function (i: number, node: any) {
          if (i === 0) return '#008000'; // Green header
          return (i % 2 === 0) ? '#F9FAFB' : null; // Zebra striping
        }
      };

      const tableBody = [
        headers.map(h => ({ text: h.toUpperCase(), style: 'tableHeader' }))
      ];

      data.forEach(row => {
        tableBody.push(
          headers.map(h => ({
            text: row[h] !== null && row[h] !== undefined ? String(row[h]) : '',
            style: 'tableCell'
          }))
        );
      });

      const docDefinition: any = {
        pageSize: 'A4',
        pageMargins: [20, 20, 20, 20],
        pageOrientation: headers.length > 6 ? 'landscape' : 'portrait',
        styles: {
          header: { fontSize: 16, bold: true, color: '#008000', alignment: 'center', margin: [0, 0, 0, 5] },
          subheader: { fontSize: 12, alignment: 'center', margin: [0, 0, 0, 2] },
          generated: { fontSize: 10, alignment: 'center', margin: [0, 0, 0, 10], color: '#666666' },
          tableHeader: { bold: true, color: 'white', fontSize: 10 },
          tableCell: { fontSize: 9 }
        },
        defaultStyle: { fontSize: 10, font: 'Roboto' },
        content: [
          ...(organizationLogo ? [{
            columns: [
              { width: 80, image: organizationLogo, fit: [75, 75] },
              { width: '*', text: organizationName, style: 'header', margin: [0, 20, 0, 0] },
              { width: 80, text: '' }
            ]
          }] : [{ text: organizationName, style: 'header' }]),
          { text: resultsDialog.result.template.name, style: 'subheader' },
          { text: `Generated: ${new Date().toLocaleDateString()}`, style: 'generated' },
          {
            table: {
              headerRows: 1,
              widths: Array(headers.length).fill('*'),
              body: tableBody
            },
            layout: tableLayout
          }
        ]
      };

      const filename = `${resultsDialog.result.template.name.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);

      toast.success(`Exported as PDF`);
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
            onClick={() => navigate('custom-report-builder')}
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
                    onClick={() => setSelectedCategory(category)}
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
              getCategoryIcon={getCategoryIcon}
            />
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

      {/* Results Dialog */}
      <Dialog 
        open={resultsDialog.open} 
        onOpenChange={(open: boolean) => setResultsDialog({ open, result: null })}
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
  getCategoryIcon: (category: string) => React.ReactNode;
}

const ReportGrid: React.FC<ReportGridProps> = ({
  templates,
  executing,
  onExecute,
  onToggleFavorite,
  onDelete,
  getCategoryIcon,
}) => {
  // Navigation helper
  const navigate = (view: string) => {
    (window as any).navigateTo(view);
  };

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
                    <DropdownMenuItem onClick={() => navigate('custom-report-builder')}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem>
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
