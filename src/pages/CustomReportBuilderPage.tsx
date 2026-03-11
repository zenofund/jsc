import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { reportsAPI, reportHelpers, DataSource, ReportField, ReportFilter, ReportJoin, ReportGroupBy, ReportOrderBy, ReportConfig, ReportTemplate, ApiError } from '../lib/reportsAPI';
import { 
  Plus, 
  Trash2, 
  Play, 
  Save, 
  Database, 
  Filter, 
  Link2, 
  ArrowUpDown,
  Group,
  Eye,
  X,
  Info,
  ChevronRight,
  Table as TableIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '../components/PageLoader';

const CustomReportBuilderPage: React.FC = () => {
  // Navigation helper
  const navigate = (view: string) => {
    (window as any).navigateTo(view);
  };

  // State
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Report configuration
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportCategory, setReportCategory] = useState<ReportTemplate['category']>('custom');
  const [isPublic, setIsPublic] = useState(false);
  const [reportLimit, setReportLimit] = useState('500');

  // Selected base table
  const [baseTable, setBaseTable] = useState<string>('');

  // Fields, filters, joins, etc.
  const [selectedFields, setSelectedFields] = useState<ReportField[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [joins, setJoins] = useState<ReportJoin[]>([]);
  const [groupByFields, setGroupByFields] = useState<ReportGroupBy[]>([]);
  const [orderByFields, setOrderByFields] = useState<ReportOrderBy[]>([]);

  // Preview data
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewMeta, setPreviewMeta] = useState<any>(null);

  // Load data sources on mount
  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      setLoading(true);
      const sources = await reportsAPI.getDataSources();
      setDataSources(sources);
    } catch (error: any) {
      toast.error('Failed to load data sources', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get selected data source
  const selectedDataSource = dataSources.find(ds => ds.table === baseTable);

  // Get available tables for joins
  const availableJoinTables = dataSources.filter(ds => 
    ds.table !== baseTable && 
    selectedDataSource?.relationships.some(rel => rel.table === ds.table)
  );

  // Add field
  const addField = (table: string, field: string, label: string, aggregate?: ReportField['aggregate']) => {
    const newField: ReportField = {
      table,
      field,
      alias: label,
      aggregate,
      visible: true,
    };

    setSelectedFields(prev => [...prev, newField]);
  };

  // Remove field
  const removeField = (index: number) => {
    setSelectedFields(prev => prev.filter((_, i) => i !== index));
  };

  // Add filter
  const addFilter = () => {
    if (!selectedDataSource) return;

    const newFilter: ReportFilter = {
      table: baseTable,
      field: selectedDataSource.fields[0].field,
      operator: '=',
      value: '',
    };

    setFilters(prev => [...prev, newFilter]);
  };

  // Update filter
  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    setFilters(prev => prev.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
  };

  // Remove filter
  const removeFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  // Add join
  const addJoin = () => {
    if (!selectedDataSource || availableJoinTables.length === 0) return;

    const firstJoinTable = availableJoinTables[0];
    const relationship = selectedDataSource.relationships.find(rel => rel.table === firstJoinTable.table);

    if (!relationship) return;

    const newJoin: ReportJoin = {
      table: firstJoinTable.table,
      type: 'LEFT',
      onField: relationship.field,
      joinField: relationship.foreignKey,
    };

    setJoins(prev => [...prev, newJoin]);
  };

  // Remove join
  const removeJoin = (index: number) => {
    setJoins(prev => prev.filter((_, i) => i !== index));
  };

  // Add group by
  const addGroupBy = () => {
    if (!selectedDataSource) return;

    const newGroupBy: ReportGroupBy = {
      table: baseTable,
      field: selectedDataSource.fields[0].field,
    };

    setGroupByFields(prev => [...prev, newGroupBy]);
  };

  // Remove group by
  const removeGroupBy = (index: number) => {
    setGroupByFields(prev => prev.filter((_, i) => i !== index));
  };

  // Add order by
  const addOrderBy = () => {
    if (!selectedDataSource) return;

    const newOrderBy: ReportOrderBy = {
      table: baseTable,
      field: selectedDataSource.fields[0].field,
      direction: 'ASC',
    };

    setOrderByFields(prev => [...prev, newOrderBy]);
  };

  // Remove order by
  const removeOrderBy = (index: number) => {
    setOrderByFields(prev => prev.filter((_, i) => i !== index));
  };

  // Build report configuration
  const buildReportConfig = (): ReportConfig => {
    const parsedLimit = parseInt(reportLimit, 10);
    const limitValue = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
    return {
      fields: selectedFields,
      filters: filters.length > 0 ? filters : undefined,
      joins: joins.length > 0 ? joins : undefined,
      groupBy: groupByFields.length > 0 ? groupByFields : undefined,
      orderBy: orderByFields.length > 0 ? orderByFields : undefined,
      limit: limitValue,
    };
  };

  // Execute report (preview)
  const executeReport = async () => {
    if (selectedFields.length === 0) {
      toast.error('No fields selected', {
        description: 'Please select at least one field to include in the report',
      });
      return;
    }

    try {
      setExecuting(true);

      // First save as temporary template
      const config = buildReportConfig();
      const tempTemplate = await reportsAPI.createTemplate({
        name: reportName || `Temp Report ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: reportDescription,
        category: reportCategory,
        config,
        isPublic: false,
      });

      // Execute the report
      const result = await reportsAPI.executeReport({
        templateId: tempTemplate.id,
        exportFormat: 'json',
      });

      setPreviewData(result.data);
      setPreviewMeta(result.meta);

      toast.success('Report executed successfully', {
        description: `Retrieved ${result.meta.totalRows} rows in ${reportHelpers.formatExecutionTime(result.meta.executionTimeMs)}`,
      });

      // Delete temp template if name was auto-generated
      if (!reportName) {
        await reportsAPI.deleteTemplate(tempTemplate.id);
      }
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('Template name already exists', {
          description: 'Please change the report name and try again.',
        });
        return;
      }
      toast.error('Failed to execute report', {
        description: error.message,
      });
    } finally {
      setExecuting(false);
    }
  };

  // Save report template
  const saveReport = async () => {
    if (!reportName) {
      toast.error('Report name required', {
        description: 'Please enter a name for this report',
      });
      return;
    }

    if (selectedFields.length === 0) {
      toast.error('No fields selected', {
        description: 'Please select at least one field to include in the report',
      });
      return;
    }

    try {
      setSaving(true);

      const config = buildReportConfig();
      await reportsAPI.createTemplate({
        name: reportName,
        description: reportDescription,
        category: reportCategory,
        config,
        isPublic,
      });

      toast.success('Report saved successfully', {
        description: 'You can now access this report from the Reports page',
      });

      // Navigate to reports page
      navigate('reports-list');
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('Template name already exists', {
          description: 'Please use a different report name (or delete/rename the existing template).',
        });
        return;
      }
      toast.error('Failed to save report', {
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageSkeleton mode="grid" />;
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="page-title font-semibold">Custom Report Builder</h1>
          <p className="text-muted-foreground">Create custom reports by selecting fields and filters</p>
        </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('reports-list')}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={executeReport}
              disabled={executing || selectedFields.length === 0}
            >
              {executing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            <Button
              onClick={saveReport}
              disabled={saving || !reportName || selectedFields.length === 0}
              className="bg-[#008000] hover:bg-[#006600]"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Build your custom report by selecting a table, choosing fields, adding filters, and configuring joins.
            Click "Preview" to see results with live data, then "Save Report" to keep it for future use.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-3 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Report Information</CardTitle>
                <CardDescription>Basic details about your report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reportName">Report Name *</Label>
                    <Input
                      id="reportName"
                      placeholder="e.g., Monthly Staff Report"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={reportCategory} onValueChange={(value: any) => setReportCategory(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payroll">Payroll</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="loans">Loans</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                        <SelectItem value="cooperative">Cooperative</SelectItem>
                        <SelectItem value="deductions">Deductions</SelectItem>
                        <SelectItem value="allowances">Allowances</SelectItem>
                        <SelectItem value="audit">Audit Trail</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of what this report shows..."
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportLimit">Row Limit</Label>
                    <Input
                      id="reportLimit"
                      type="number"
                      min={0}
                      placeholder="e.g., 800 (leave empty for no limit)"
                      value={reportLimit}
                      onChange={(e) => setReportLimit(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Set to 0 or leave empty to return all rows.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPublic"
                    checked={isPublic}
                    onCheckedChange={(checked: boolean | "indeterminate") => setIsPublic(checked as boolean)}
                  />
                  <Label htmlFor="isPublic" className="cursor-pointer">
                    Make this report public (visible to all users)
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Table Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Select Data Source
                </CardTitle>
                <CardDescription>Choose the primary table for your report</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={baseTable} onValueChange={setBaseTable}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources.map((source) => (
                      <SelectItem key={source.table} value={source.table}>
                        <div className="flex items-center gap-2">
                          <TableIcon className="h-4 w-4" />
                          {source.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedDataSource && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium mb-2">Available Fields:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDataSource.fields.map((field) => (
                        <Badge
                          key={field.field}
                          variant="outline"
                          className="cursor-pointer hover:bg-[#008000] hover:text-white transition-colors"
                          onClick={() => addField(baseTable, field.field, field.label)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {field.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuration Tabs */}
            {baseTable && (
              <Card>
                <Tabs defaultValue="fields" className="w-full">
                  <CardHeader>
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="fields">
                        <Eye className="h-4 w-4 mr-2" />
                        Fields ({selectedFields.length})
                      </TabsTrigger>
                      <TabsTrigger value="filters">
                        <Filter className="h-4 w-4 mr-2" />
                        Filters ({filters.length})
                      </TabsTrigger>
                      <TabsTrigger value="joins">
                        <Link2 className="h-4 w-4 mr-2" />
                        Joins ({joins.length})
                      </TabsTrigger>
                      <TabsTrigger value="groupby">
                        <Group className="h-4 w-4 mr-2" />
                        Group ({groupByFields.length})
                      </TabsTrigger>
                      <TabsTrigger value="orderby">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Sort ({orderByFields.length})
                      </TabsTrigger>
                    </TabsList>
                  </CardHeader>

                  <CardContent>
                    {/* Fields Tab */}
                    <TabsContent value="fields" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Selected fields that will appear in your report
                        </p>
                      </div>

                      {selectedFields.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Eye className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No fields selected</p>
                          <p className="text-sm">Click on field badges above to add them</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedFields.map((field, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium">{field.alias || field.field}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {field.table}.{field.field}
                                  {field.aggregate && ` (${field.aggregate})`}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeField(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* Filters Tab */}
                    <TabsContent value="filters" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Add conditions to filter your data
                        </p>
                        <Button size="sm" onClick={addFilter}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Filter
                        </Button>
                      </div>

                      {filters.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Filter className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No filters added</p>
                          <p className="text-sm">Click "Add Filter" to filter your data</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filters.map((filter, index) => (
                            <FilterRow
                              key={index}
                              filter={filter}
                              dataSources={dataSources}
                              onUpdate={(updates) => updateFilter(index, updates)}
                              onRemove={() => removeFilter(index)}
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* Joins Tab */}
                    <TabsContent value="joins" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Join related tables to include additional data
                        </p>
                        <Button 
                          size="sm" 
                          onClick={addJoin}
                          disabled={availableJoinTables.length === 0}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Join
                        </Button>
                      </div>

                      {joins.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Link2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No joins configured</p>
                          <p className="text-sm">
                            {availableJoinTables.length === 0 
                              ? 'No related tables available for this data source'
                              : 'Click "Add Join" to include data from related tables'
                            }
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {joins.map((join, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium">
                                  {join.type} JOIN {join.table}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  ON {baseTable}.{join.onField} = {join.table}.{join.joinField}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeJoin(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* Group By Tab */}
                    <TabsContent value="groupby" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Group results by specific fields (required when using aggregates)
                        </p>
                        <Button size="sm" onClick={addGroupBy}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Group By
                        </Button>
                      </div>

                      {groupByFields.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Group className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No grouping configured</p>
                          <p className="text-sm">Add grouping when using SUM, AVG, COUNT, etc.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {groupByFields.map((groupBy, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium">
                                  {groupBy.table}.{groupBy.field}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeGroupBy(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* Order By Tab */}
                    <TabsContent value="orderby" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sort your results by specific fields
                        </p>
                        <Button size="sm" onClick={addOrderBy}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Sort
                        </Button>
                      </div>

                      {orderByFields.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <ArrowUpDown className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No sorting configured</p>
                          <p className="text-sm">Click "Add Sort" to order your results</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {orderByFields.map((orderBy, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium">
                                  {orderBy.table}.{orderBy.field} ({orderBy.direction})
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOrderBy(index)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            )}
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Report Preview</CardTitle>
                <CardDescription>
                  {previewMeta 
                    ? `${previewMeta.totalRows} rows in ${reportHelpers.formatExecutionTime(previewMeta.executionTimeMs)}`
                    : 'Click "Preview" to see results'
                  }
                </CardDescription>
                <div className="text-xs text-muted-foreground">
                  {(() => {
                    const parsedLimit = parseInt(reportLimit, 10);
                    const isLimited = Number.isFinite(parsedLimit) && parsedLimit > 0;
                    return isLimited ? `Limit: ${parsedLimit}` : 'Limit: none';
                  })()}
                </div>
              </CardHeader>
              <CardContent>
                {previewData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Play className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No preview data</p>
                    <p className="text-sm mt-2">
                      Configure your report and click "Preview" to see live data
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-[600px] overflow-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                          <tr>
                            {Object.keys(previewData[0] || {}).map((key) => (
                              <th
                                key={key}
                                className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {previewData.slice(0, 10).map((row, idx) => (
                            <tr key={idx}>
                              {Object.values(row).map((value: any, cellIdx) => (
                                <td
                                  key={cellIdx}
                                  className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                                >
                                  {value !== null && value !== undefined ? String(value) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {previewData.length > 10 && (
                      <p className="text-xs text-gray-500 text-center">
                        Showing first 10 of {previewData.length} rows
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
};

// Filter Row Component
interface FilterRowProps {
  filter: ReportFilter;
  dataSources: DataSource[];
  onUpdate: (updates: Partial<ReportFilter>) => void;
  onRemove: () => void;
}

const FilterRow: React.FC<FilterRowProps> = ({ filter, dataSources, onUpdate, onRemove }) => {
  const table = dataSources.find(ds => ds.table === filter.table);
  const field = table?.fields.find(f => f.field === filter.field);
  const operators = reportHelpers.getOperatorsForType(field?.type || 'string');

  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="grid grid-cols-3 gap-2 flex-1">
        <div>
          <Label className="text-xs">Field</Label>
          <Select value={filter.field} onValueChange={(value: any) => onUpdate({ field: value })}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {table?.fields.map(f => (
                <SelectItem key={f.field} value={f.field}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Operator</Label>
          <Select value={filter.operator} onValueChange={(value: any) => onUpdate({ operator: value })}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map(op => (
                <SelectItem key={op} value={op}>
                  {reportHelpers.getOperatorLabel(op)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Value</Label>
          {!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && (
            <Input
              className="h-8 text-sm"
              placeholder="Enter value..."
              value={filter.value || ''}
              onChange={(e) => onUpdate({ value: e.target.value })}
            />
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="mt-5"
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
};

export default CustomReportBuilderPage;
