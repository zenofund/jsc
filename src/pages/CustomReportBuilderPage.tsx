import React, { useEffect, useMemo, useState } from 'react';
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
import { format } from 'date-fns';
import { PageSkeleton } from '../components/PageLoader';

const REPORT_BUILDER_EDIT_KEY = 'jsc_report_builder_template_id';
const REPORTS_LIST_FOCUS_TEMPLATE_KEY = 'jsc_reports_list_focus_template_id';
const REPORT_BUILDER_MODES = ['create', 'edit'] as const;
type BuilderMode = typeof REPORT_BUILDER_MODES[number];
type RelationshipEdge = NonNullable<DataSource['relationshipGraph']>[number];

const CustomReportBuilderPage: React.FC = () => {
  // Navigation helper
  const navigate = (view: string) => {
    (window as any).navigateTo(view);
  };

  const humanizeLabel = (value: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const spaced = raw
      .replace(/_/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
    return spaced.replace(/\b\w/g, (match) => match.toUpperCase());
  };

  const isIsoDateString = (value: string) => {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return false;
    const parsed = new Date(raw);
    return !Number.isNaN(parsed.getTime());
  };

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return format(value, 'MMM dd, yyyy, h:mm a');
    }

    if (typeof value === 'string' && isIsoDateString(value)) {
      const date = new Date(value);
      const hasTime = /T|\d{2}:\d{2}/.test(value);
      return format(date, hasTime ? 'MMM dd, yyyy, h:mm a' : 'MMM dd, yyyy');
    }

    return String(value);
  };

  // State
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('create');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [builderView, setBuilderView] = useState<'guided' | 'advanced'>('guided');
  const [userRole, setUserRole] = useState<'accountant' | 'analyst' | 'admin'>('accountant');
  const [selectedReportType, setSelectedReportType] = useState('payroll-summary');
  const [selectedBusinessArea, setSelectedBusinessArea] = useState('payroll');
  const [guideStep, setGuideStep] = useState<'type' | 'business' | 'columns' | 'filters' | 'preview'>('type');
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [guidedStatus, setGuidedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [guidedPeriod, setGuidedPeriod] = useState('all');

  const guidedTemplates = useMemo(() => ({
    staff: {
      label: 'Staff directory',
      description: 'A simple list of staff with key personal and payroll details.',
      candidates: ['staff_number', 'first_name', 'last_name', 'designation', 'employment_type', 'current_basic_salary', 'status'],
      businessArea: 'staff',
    },
    payroll: {
      label: 'Payroll summary',
      description: 'See payroll values, deductions, and net pay in one view.',
      candidates: ['staff_number', 'first_name', 'last_name', 'gross_pay', 'total_deductions', 'net_pay', 'basic_salary'],
      businessArea: 'payroll',
    },
    deductions: {
      label: 'Deductions review',
      description: 'Review deduction values and final pay for each employee.',
      candidates: ['staff_number', 'first_name', 'last_name', 'gross_pay', 'total_deductions', 'net_pay'],
      businessArea: 'deductions',
    },
    allowances: {
      label: 'Allowance review',
      description: 'Track total pay, deductions, and final take-home for each employee.',
      candidates: ['staff_number', 'first_name', 'last_name', 'gross_pay', 'total_deductions', 'net_pay'],
      businessArea: 'allowances',
    },
  }), []);

  const guidedQuestionPresets = useMemo(() => ({
    'payroll-summary': {
      label: 'Payroll summary',
      description: 'See monthly payroll totals, deductions and net pay in one report.',
      businessArea: 'payroll',
      recommendedFieldHints: ['staff', 'payroll', 'gross', 'deduction', 'net', 'status'],
      defaultFilters: [{ field: 'status', operator: '=', value: 'active' }],
    },
    'staff-cost-analysis': {
      label: 'Staff cost analysis',
      description: 'Understand staff cost by role, grade, and payroll value.',
      businessArea: 'staff',
      recommendedFieldHints: ['staff', 'salary', 'basic', 'designation', 'employment', 'status'],
      defaultFilters: [{ field: 'status', operator: '=', value: 'active' }],
    },
    'tax-deduction-report': {
      label: 'Tax deductions report',
      description: 'Review deductions and final take-home clearly for a chosen period.',
      businessArea: 'deductions',
      recommendedFieldHints: ['staff', 'gross', 'deduction', 'net', 'tax', 'status'],
      defaultFilters: [{ field: 'status', operator: '=', value: 'active' }],
    },
    'bank-payment-report': {
      label: 'Bank payment report',
      description: 'Prepare the actual payment list and bank details for payroll.',
      businessArea: 'bank',
      recommendedFieldHints: ['staff', 'bank', 'account', 'net', 'payment', 'status'],
      defaultFilters: [{ field: 'status', operator: '=', value: 'active' }],
    },
    'allowance-review': {
      label: 'Allowance and deduction review',
      description: 'Compare allowances against deductions and final pay.',
      businessArea: 'allowances',
      recommendedFieldHints: ['staff', 'allowance', 'gross', 'deduction', 'net', 'status'],
      defaultFilters: [{ field: 'status', operator: '=', value: 'active' }],
    },
  }), []);

  const guidedRoleCopy = useMemo(() => ({
    accountant: {
      title: 'Accountant view',
      subtitle: 'Keep it simple and focused on payroll decisions.',
    },
    analyst: {
      title: 'Analyst view',
      subtitle: 'More controls for deeper review and comparisons.',
    },
    admin: {
      title: 'Admin / IT view',
      subtitle: 'Expert tools and raw relationship settings are available.',
    },
  }), []);

  const inferRecommendedReport = (questionId: string) => {
    const preset = guidedQuestionPresets[questionId as keyof typeof guidedQuestionPresets] || guidedQuestionPresets['payroll-summary'];

    const preferredSource = dataSources
      .map((source) => {
        const matches = source.fields.filter((field) => {
          const haystack = `${field.field} ${field.label}`.toLowerCase();
          return preset.recommendedFieldHints.some((hint) => haystack.includes(hint.toLowerCase()));
        });
        return { source, score: matches.length };
      })
      .sort((a, b) => b.score - a.score)[0]?.source || dataSources[0];

    if (!preferredSource) return;

    const fieldScore = (field: DataSource['fields'][number]) => {
      const haystack = `${field.field} ${field.label}`.toLowerCase();
      return preset.recommendedFieldHints.reduce((total, hint) => total + (haystack.includes(hint.toLowerCase()) ? 1 : 0), 0);
    };

    const recommendedFieldMatches = preferredSource.fields
      .map((field) => ({ field, score: fieldScore(field) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.field)
      .slice(0, 6);

    const fieldsToUse = recommendedFieldMatches.length > 0
      ? recommendedFieldMatches
      : preferredSource.fields.slice(0, 6);

    const inferredFilters = preset.defaultFilters
      .map((candidate) => {
        const matches = preferredSource.fields.find((field) => {
          const candidateText = `${field.label} ${field.field}`.toLowerCase();
          return candidateText.includes(candidate.field.toLowerCase()) || candidate.field.toLowerCase().includes(candidateText);
        });

        if (!matches) return null;

        return {
          table: preferredSource.table,
          field: matches.field,
          operator: candidate.operator as ReportFilter['operator'],
          value: candidate.value,
        } as ReportFilter;
      })
      .filter(Boolean) as ReportFilter[];

    const baseSelectedFields = fieldsToUse.map((field) => ({
      table: preferredSource.table,
      field: field.field,
      alias: field.label,
      aggregate: undefined,
      visible: true,
    }));

    setBaseTable(preferredSource.table);
    setSelectedDatasets((previous) => Array.from(new Set([...previous, preferredSource.table])));
    setSelectedReportType(questionId);
    setSelectedBusinessArea(preset.businessArea);
    setGuideStep('columns');
    setReportName(preset.label);
    setReportDescription(preset.description);
    setSelectedFields(baseSelectedFields);
    setFilters(inferredFilters);
    setPreviewData([]);
    setPreviewMeta(null);
  };

  const guidedReportTypes = [
    { id: 'payroll-summary', label: 'Payroll summary', description: 'Monthly payroll totals and employee pay status', businessArea: 'payroll' },
    { id: 'staff-cost-analysis', label: 'Staff cost analysis', description: 'Compare cost drivers by team, grade, and salary band', businessArea: 'staff' },
    { id: 'tax-deduction-report', label: 'Tax deductions report', description: 'Review PAYE and tax-related deductions clearly', businessArea: 'deductions' },
    { id: 'bank-payment-report', label: 'Bank payment report', description: 'See who should be paid and how much', businessArea: 'bank' },
    { id: 'allowance-review', label: 'Allowance and deduction review', description: 'Check total allowances against deductions and pay', businessArea: 'allowances' },
  ];

  const guidedBusinessAreas = [
    { id: 'staff', label: 'Staff', description: 'Employee and job details' },
    { id: 'payroll', label: 'Payroll', description: 'Gross, net and monthly totals' },
    { id: 'allowances', label: 'Allowances', description: 'Bonus and allowance components' },
    { id: 'deductions', label: 'Deductions', description: 'Taxes, loans and employee deductions' },
    { id: 'bank', label: 'Bank details', description: 'Payment and account information' },
    { id: 'tax', label: 'Tax', description: 'Tax calculations and records' },
  ];

  const currentGuideStepIndex = ['type', 'business', 'columns', 'filters', 'preview'].indexOf(guideStep);

  const activeReportType = guidedReportTypes.find((reportType) => reportType.id === selectedReportType) || guidedReportTypes[0];

  const resolveCommonField = (table: string, candidateNames: string[]) => {
    const source = dataSourceMap.get(table);
    if (!source) return '';
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedCandidates = candidateNames.map(normalize);
    const field = source.fields.find((item) => {
      const fieldKey = normalize(item.field || '');
      const fieldLabel = normalize(item.label || '');
      return normalizedCandidates.some((candidate) => fieldKey === candidate || fieldLabel.includes(candidate));
    });
    return field?.field || source.fields[0]?.field || '';
  };

  const applyGuidedTemplate = (templateKey: keyof typeof guidedTemplates) => {
    const template = guidedTemplates[templateKey];
    const matchingType = guidedReportTypes.find((reportType) => reportType.businessArea === template.businessArea) || guidedReportTypes[0];
    setSelectedReportType(matchingType.id);
    setSelectedBusinessArea(template.businessArea);
    setGuideStep('business');
    setReportName(matchingType.label);
    setReportDescription(template.description);

    if (!baseTable && dataSources.length > 0) {
      setBaseTable(dataSources[0]?.table || '');
      setSelectedDatasets([dataSources[0]?.table || '']);
    }
    const targetTable = baseTable || dataSources[0]?.table || '';
    if (!targetTable) return;
    const candidates = template.candidates;
    const source = dataSourceMap.get(targetTable);
    const selected = (source?.fields || [])
      .filter((field) => candidates.some((candidate) => {
        const normalizedField = (field.field || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedLabel = (field.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedField === candidate.replace(/[^a-z0-9]/g, '') || normalizedLabel.includes(candidate.replace(/[^a-z0-9]/g, ''));
      }))
      .slice(0, 6)
      .map((field) => ({
        table: targetTable,
        field: field.field,
        alias: field.label,
        aggregate: undefined,
        visible: true,
      }));

    setSelectedFields(selected);

    if (templateKey === 'staff') {
      setFilters((prev) => prev.length ? prev : [{ table: targetTable, field: resolveCommonField(targetTable, ['status']), operator: '=', value: 'active' }]);
    }
    if (templateKey === 'payroll') {
      setFilters((prev) => prev.length ? prev : [{ table: targetTable, field: resolveCommonField(targetTable, ['payroll_month', 'month']), operator: '=', value: 'current month' }]);
    }
    setPreviewData([]);
    setPreviewMeta(null);
  };

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
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize] = useState(25);

  // Load data sources on mount
  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      setLoading(true);
      const sources = await reportsAPI.getDataSources();
      setDataSources(sources);
      const templateId = sessionStorage.getItem(REPORT_BUILDER_EDIT_KEY);
      if (templateId) {
        await loadTemplate(templateId);
      }
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
  const dataSourceMap = useMemo(
    () => new Map(dataSources.map((source) => [source.table, source])),
    [dataSources],
  );
  const relationshipEdges = useMemo(
    () => dataSources.flatMap((source) => source.relationshipGraph || []),
    [dataSources],
  );

  const getUsedTables = () =>
    Array.from(
      new Set([
        ...selectedFields.map((field) => field.table),
        ...filters.map((filter) => filter.table),
        ...groupByFields.map((groupBy) => groupBy.table),
        ...orderByFields.map((orderBy) => orderBy.table),
      ]),
    );

  const connectedTables = useMemo(() => {
    if (!baseTable) return [];
    const resolved = new Set<string>([baseTable]);
    let updated = true;

    while (updated) {
      updated = false;
      joins.forEach((join) => {
        const joinSource = join.fromTable || baseTable;
        if (resolved.has(joinSource) && !resolved.has(join.table)) {
          resolved.add(join.table);
          updated = true;
        }
      });
    }

    return Array.from(resolved);
  }, [baseTable, joins]);

  const tableOptions = useMemo(() => {
    if (!baseTable) return [];
    return Array.from(new Set([baseTable, ...selectedDatasets, ...connectedTables, ...getUsedTables()]));
  }, [baseTable, selectedDatasets, connectedTables, selectedFields, filters, groupByFields, orderByFields]);

  const fieldTableOptions = useMemo(
    () =>
      tableOptions
        .map((table) => dataSourceMap.get(table))
        .filter((source): source is DataSource => Boolean(source)),
    [tableOptions, dataSourceMap],
  );

  const availableJoinOptions = useMemo(() => {
    const activeSources = connectedTables.length > 0 ? connectedTables : baseTable ? [baseTable] : [];
    return activeSources.flatMap((sourceTable) =>
      relationshipEdges
        .filter((edge) => edge.sourceTable === sourceTable && !connectedTables.includes(edge.targetTable))
        .map((edge) => ({
          fromTable: sourceTable,
          table: edge.targetTable,
          type: (edge.defaultJoinType || 'LEFT') as ReportJoin['type'],
          label: edge.label,
          joinTypes: edge.joinTypes,
        })),
    );
  }, [baseTable, connectedTables, relationshipEdges]);

  const resetDependentConfig = () => {
    setSelectedFields([]);
    setFilters([]);
    setJoins([]);
    setGroupByFields([]);
    setOrderByFields([]);
    setPreviewData([]);
    setPreviewMeta(null);
    setPreviewPage(1);
  };

  const toggleRecommendedField = (table: string, field: string, label: string) => {
    const existingIndex = selectedFields.findIndex((selectedField) => selectedField.table === table && selectedField.field === field);

    if (existingIndex >= 0) {
      removeField(existingIndex);
      return;
    }

    addField(table, field, label);
  };

  const getDefaultField = (table: string) => dataSourceMap.get(table)?.fields[0]?.field || '';

  const pruneToConnectedTables = (nextBaseTable: string, nextJoins: ReportJoin[]) => {
    const resolved = new Set<string>([nextBaseTable]);
    let updated = true;
    while (updated) {
      updated = false;
      nextJoins.forEach((join) => {
        const joinSource = join.fromTable || nextBaseTable;
        if (resolved.has(joinSource) && !resolved.has(join.table)) {
          resolved.add(join.table);
          updated = true;
        }
      });
    }

    setSelectedFields((prev) => prev.filter((field) => resolved.has(field.table)));
    setFilters((prev) => prev.filter((filter) => resolved.has(filter.table)));
    setGroupByFields((prev) => prev.filter((groupBy) => resolved.has(groupBy.table)));
    setOrderByFields((prev) => prev.filter((orderBy) => resolved.has(orderBy.table)));
  };

  const handleBaseTableChange = (nextBaseTable: string) => {
    if (nextBaseTable === baseTable) return;
    setBaseTable(nextBaseTable);
    setSelectedDatasets([nextBaseTable]);
    resetDependentConfig();
    if (editingTemplateId) {
      toast.info('Data source changed', {
        description: 'Fields, joins, filters, grouping, sorting, and preview were reset for the new source.',
      });
    }
  };

  // Dataset selection is intentionally expressed in business terms in the UI.
  // The relationship graph is used here to build the technical join path.
  const selectDataset = (datasetTable: string) => {
    if (!baseTable) {
      setBaseTable(datasetTable);
      setSelectedDatasets([datasetTable]);
      resetDependentConfig();
      return;
    }

    if (selectedDatasets.includes(datasetTable)) {
      setSelectedDatasets((previous) => previous.filter((table) => table !== datasetTable));
      setSelectedFields((previous) => previous.filter((field) => field.table !== datasetTable));
      setFilters((previous) => previous.filter((filter) => filter.table !== datasetTable));
      return;
    }

    const visited = new Set<string>([baseTable]);
    const queue: Array<{ table: string; path: RelationshipEdge[] }> = [{ table: baseTable, path: [] }];
    let foundPath: RelationshipEdge[] | null = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.table === datasetTable) {
        foundPath = current.path;
        break;
      }
      relationshipEdges
        .filter((edge) => edge.sourceTable === current.table)
        .forEach((edge) => {
          if (visited.has(edge.targetTable)) return;
          visited.add(edge.targetTable);
          queue.push({ table: edge.targetTable, path: [...current.path, edge] });
        });
    }

    if (!foundPath) {
      toast.error('These datasets cannot be combined', {
        description: 'There is no safe connection between the selected business areas.',
      });
      return;
    }

    setJoins((previous) => {
      const next = [...previous];
      foundPath!.forEach((edge) => {
        if (!next.some((join) => join.table === edge.targetTable)) {
          next.push({
            table: edge.targetTable,
            fromTable: edge.sourceTable,
            type: (edge.defaultJoinType || 'LEFT') as ReportJoin['type'],
          });
        }
      });
      return next;
    });
    setSelectedDatasets((previous) => Array.from(new Set([...previous, datasetTable, ...foundPath!.map((edge) => edge.targetTable)])));
  };

  const updateGuidedFilter = (kind: 'status' | 'period', value: string) => {
    if (kind === 'status') setGuidedStatus(value as 'all' | 'active' | 'inactive');
    if (kind === 'period') setGuidedPeriod(value);

    const preferredTables = [baseTable, ...selectedDatasets];
    const statusTable = preferredTables.find((table) => resolveCommonField(table, ['status']));
    const periodTable = preferredTables.find((table) => resolveCommonField(table, ['payroll_month', 'month', 'contribution_month']));
    const nextStatus = kind === 'status' ? value : guidedStatus;
    const nextPeriod = kind === 'period' ? value : guidedPeriod;

    setFilters((previous) => {
      const withoutGuidedFilters = previous.filter((filter) => {
        const isStatus = filter.field === resolveCommonField(filter.table, ['status']);
        const isPeriod = filter.field === resolveCommonField(filter.table, ['payroll_month', 'month', 'contribution_month']);
        return !isStatus && !isPeriod;
      });
      if (nextStatus !== 'all' && statusTable) {
        withoutGuidedFilters.push({ table: statusTable, field: resolveCommonField(statusTable, ['status']), operator: '=', value: nextStatus });
      }
      if (nextPeriod !== 'all' && periodTable) {
        withoutGuidedFilters.push({ table: periodTable, field: resolveCommonField(periodTable, ['payroll_month', 'month', 'contribution_month']), operator: '=', value: nextPeriod });
      }
      return withoutGuidedFilters;
    });
    setPreviewData([]);
    setPreviewMeta(null);
  };

  const loadTemplate = async (templateId: string) => {
    try {
      const template = await reportsAPI.getTemplate(templateId);
      setBuilderMode('edit');
      setEditingTemplateId(template.id);
      setReportName(template.name);
      setReportDescription(template.description || '');
      setReportCategory(template.category);
      setIsPublic(Boolean(template.is_public));
      setBaseTable(template.config.fields[0]?.table || '');
      setSelectedDatasets(Array.from(new Set((template.config.fields || []).map((field) => field.table))));
      setSelectedFields(template.config.fields || []);
      setFilters(template.config.filters || []);
      setJoins(template.config.joins || []);
      setGroupByFields(template.config.groupBy || []);
      setOrderByFields(template.config.orderBy || []);
      setReportLimit(String(template.config.limit || 500));
      setPreviewData([]);
      setPreviewMeta(null);
      setPreviewPage(1);
    } catch (error: any) {
      sessionStorage.removeItem(REPORT_BUILDER_EDIT_KEY);
      setBuilderMode('create');
      setEditingTemplateId(null);
      toast.error('Failed to load report for editing', {
        description: error.message,
      });
    }
  };

  // Add field
  const addField = (table: string, field: string, label: string, aggregate?: ReportField['aggregate']) => {
    const existingField = selectedFields.some(
      (selectedField) =>
        selectedField.table === table &&
        selectedField.field === field &&
        selectedField.aggregate === aggregate,
    );
    if (existingField) {
      return;
    }

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
    if (!baseTable) return;

    const newFilter: ReportFilter = {
      table: baseTable,
      field: getDefaultField(baseTable),
      operator: '=',
      value: '',
    };

    setFilters(prev => [...prev, newFilter]);
    setPreviewData([]);
    setPreviewMeta(null);
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
    if (availableJoinOptions.length === 0) return;
    const firstOption = availableJoinOptions[0];
    setJoins((prev) => [
      ...prev,
      {
        table: firstOption.table,
        fromTable: firstOption.fromTable,
        type: firstOption.type,
      },
    ]);
    setPreviewData([]);
    setPreviewMeta(null);
  };

  const updateJoin = (index: number, updates: Partial<ReportJoin>) => {
    setJoins((prev) => {
      const nextJoins = prev.map((join, joinIndex) => {
        if (joinIndex !== index) return join;
        return { ...join, ...updates, onField: undefined, joinField: undefined };
      });
      pruneToConnectedTables(baseTable, nextJoins);
      return nextJoins;
    });
    setPreviewData([]);
    setPreviewMeta(null);
  };

  // Remove join
  const removeJoin = (index: number) => {
    setJoins(prev => {
      const nextJoins = prev.filter((_, i) => i !== index);
      pruneToConnectedTables(baseTable, nextJoins);
      return nextJoins;
    });
    setPreviewData([]);
    setPreviewMeta(null);
  };

  // Add group by
  const addGroupBy = () => {
    if (!baseTable) return;

    const newGroupBy: ReportGroupBy = {
      table: baseTable,
      field: getDefaultField(baseTable),
    };

    setGroupByFields(prev => [...prev, newGroupBy]);
    setPreviewData([]);
    setPreviewMeta(null);
  };

  // Remove group by
  const removeGroupBy = (index: number) => {
    setGroupByFields(prev => prev.filter((_, i) => i !== index));
  };

  // Add order by
  const addOrderBy = () => {
    if (!baseTable) return;

    const newOrderBy: ReportOrderBy = {
      table: baseTable,
      field: getDefaultField(baseTable),
      direction: 'ASC',
    };

    setOrderByFields(prev => [...prev, newOrderBy]);
    setPreviewData([]);
    setPreviewMeta(null);
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

  const exportCurrentPreview = () => {
    if (!previewData.length) {
      toast.info('No data to export', {
        description: 'Run a preview first so there is something to export.',
      });
      return;
    }

    const rows = previewData;
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(',')].concat(
      rows.map((row) => headers.map((header) => {
        const raw = row[header];
        const value = raw === null || raw === undefined ? '' : String(raw).replace(/"/g, '""');
        return `"${value}"`;
      }).join(',')),
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(reportName || 'report').toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Export started', {
      description: 'Your preview has been exported as a CSV file.',
    });
  };

  // Execute report (preview)
  const executeReport = async (page: number = previewPage) => {
    if (selectedFields.length === 0) {
      toast.error('No fields selected', {
        description: 'Please select at least one field to include in the report',
      });
      return;
    }

    try {
      setExecuting(true);
      const config = buildReportConfig();
      const result = await reportsAPI.previewReport({
        config,
        name: reportName || 'Preview Report',
        category: reportCategory,
        page,
        pageSize: previewPageSize,
      });

      setPreviewData(result.data);
      setPreviewMeta(result.meta);
      setPreviewPage(page);

      if ((result.meta.totalRows || 0) === 0) {
        toast.info('Report executed with no matching rows', {
          description: 'The report ran successfully, but no records matched the current fields and filters.',
        });
      } else {
        toast.success('Report preview ready', {
          description: `Retrieved ${result.meta.returnedRows || result.data.length} of ${result.meta.totalRows} rows in ${reportHelpers.formatExecutionTime(result.meta.executionTimeMs)}`,
        });
      }
    } catch (error: any) {
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
      if (editingTemplateId) {
        const updated = await reportsAPI.updateTemplate(editingTemplateId, {
          name: reportName,
          description: reportDescription,
          category: reportCategory,
          config,
          isPublic,
        });
        sessionStorage.setItem(REPORTS_LIST_FOCUS_TEMPLATE_KEY, updated.id);
      } else {
        const created = await reportsAPI.createTemplate({
          name: reportName,
          description: reportDescription,
          category: reportCategory,
          config,
          isPublic,
        });
        sessionStorage.setItem(REPORTS_LIST_FOCUS_TEMPLATE_KEY, created.id);
      }

      sessionStorage.removeItem(REPORT_BUILDER_EDIT_KEY);
      toast.success(editingTemplateId ? 'Report updated successfully' : 'Report saved successfully', {
        description: editingTemplateId
          ? 'Your changes are now available in the report list.'
          : 'You can now access this report from the Reports page',
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

  const guidedSetupCards = Object.entries(guidedTemplates).map(([key, template]) => ({
    key: key as keyof typeof guidedTemplates,
    label: template.label,
    description: template.description,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="page-title font-semibold">Custom Report Builder</h1>
          <p className="text-muted-foreground">
            {builderMode === 'edit'
              ? 'Update an existing report template with live preview'
              : 'Choose information from one or more business areas and create the report you need.'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('reports-list')}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button variant="outline" onClick={() => executeReport()} disabled={executing || selectedFields.length === 0}>
              {executing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            <Button onClick={saveReport} disabled={saving || !reportName || selectedFields.length === 0} className="bg-[#008000] hover:bg-[#006600]">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {builderMode === 'edit' ? 'Update Report' : 'Save Report'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Choose a report goal, select the business information you need, and the system will connect related records automatically.
        </AlertDescription>
      </Alert>

      {builderView === 'guided' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Choose the information you need</CardTitle>
              <CardDescription>You can combine information from more than one business area.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {dataSources.map((source) => {
                  const selected = selectedDatasets.includes(source.table);
                  return (
                  <button
                    key={source.table}
                    type="button"
                    onClick={() => selectDataset(source.table)}
                    className={`text-left rounded-xl border p-4 transition-colors ${selected ? 'border-[#008000] bg-[#008000]/5' : 'border-border bg-muted/20 hover:border-primary/60'}`}
                  >
                    <div className="font-semibold text-foreground">{source.label}</div>
                    <div className="text-sm text-muted-foreground mt-1">{selected ? 'Included in this report' : 'Add this information'}</div>
                  </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Choose the columns to show</CardTitle>
              <CardDescription>Select only the information that should appear in your report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDatasets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Choose a business area above to see the available information.</p>
              ) : selectedDatasets.map((table) => {
                const source = dataSourceMap.get(table);
                if (!source) return null;
                return (
                  <div key={table} className="rounded-lg border p-4">
                    <div className="font-medium mb-3">{source.label}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {source.fields.map((field) => {
                        const selected = selectedFields.some((item) => item.table === table && item.field === field.field);
                        return (
                          <button
                            key={`${table}.${field.field}`}
                            type="button"
                            onClick={() => toggleRecommendedField(table, field.field, field.label)}
                            className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${selected ? 'border-[#008000] bg-[#008000]/10 text-[#006600]' : 'border-border hover:border-primary/60'}`}
                          >
                            <span className="mr-2">{selected ? '✓' : '＋'}</span>{field.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.15fr_0.95fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Choose the business question</CardTitle>
                <CardDescription>Start with the decision you need to make.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {guidedReportTypes.map((reportType) => (
                  <button
                    key={reportType.id}
                    type="button"
                    onClick={() => {
                      setSelectedReportType(reportType.id);
                      setSelectedBusinessArea(reportType.businessArea);
                      setGuideStep('business');
                      setPreviewData([]);
                      setPreviewMeta(null);
                      inferRecommendedReport(reportType.id);
                    }}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedReportType === reportType.id ? 'border-[#008000] bg-[#008000]/5' : 'border-border hover:border-primary/60'}`}
                  >
                    <div className="font-medium text-foreground">{reportType.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{reportType.description}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Step 2: Recommended report</CardTitle>
                <CardDescription>The system suggests the best fit for that question.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                  <div className="text-sm font-semibold text-foreground">{activeReportType.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{activeReportType.description}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommended columns</div>
                  <div className="flex flex-wrap gap-2">
                    {(function () {
                      const source = dataSourceMap.get(baseTable) || dataSources[0];
                      const preset = guidedQuestionPresets[selectedReportType as keyof typeof guidedQuestionPresets] || guidedQuestionPresets['payroll-summary'];
                      const hintMatches = source?.fields
                        .map((field) => {
                          const haystack = `${field.field} ${field.label}`.toLowerCase();
                          const score = preset.recommendedFieldHints.reduce((total, hint) => total + (haystack.includes(hint.toLowerCase()) ? 1 : 0), 0);
                          return { field, score };
                        })
                        .filter((entry) => entry.score > 0)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 6)
                        .map((entry) => entry.field) || [];

                      const visibleFields = hintMatches.length > 0 ? hintMatches : (source?.fields || []).slice(0, 6);

                      return visibleFields.map((field) => {
                        const isSelected = selectedFields.some((selectedField) => selectedField.table === (source?.table || baseTable) && selectedField.field === field.field);
                        return (
                          <button
                            key={`${source?.table || baseTable}:${field.field}`}
                            type="button"
                            onClick={() => toggleRecommendedField(source?.table || baseTable, field.field, field.label)}
                            className={`rounded-full border px-2 py-1 text-xs transition-colors ${isSelected ? 'border-[#008000] bg-[#008000]/10 text-[#006600]' : 'border-border bg-muted/30 hover:border-primary/60'}`}
                          >
                            {field.label}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Suggested filters</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Only active staff where relevant</li>
                    <li>Focus on the current period</li>
                    <li>Keep totals and final pay visible</li>
                  </ul>
                </div>
                <Button className="w-full" onClick={() => {
                  inferRecommendedReport(selectedReportType);
                  setGuideStep('preview');
                }}>
                  Use recommended report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
              <CardTitle>3. Refine your report</CardTitle>
              <CardDescription>Use everyday options to narrow the information shown.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guidedReportName">Report name</Label>
                  <Input id="guidedReportName" value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="My payroll report" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guidedPeriod">Period</Label>
                  <Select value={guidedPeriod} onValueChange={(value) => updateGuidedFilter('period', value)}>
                    <SelectTrigger id="guidedPeriod">
                      <SelectValue placeholder="Current month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any period</SelectItem>
                      <SelectItem value="current month">Current month</SelectItem>
                      <SelectItem value="last month">Last month</SelectItem>
                      <SelectItem value="quarter to date">Quarter to date</SelectItem>
                      <SelectItem value="year to date">Year to date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guidedStatus">Staff status</Label>
                  <Select value={guidedStatus} onValueChange={(value) => updateGuidedFilter('status', value)}>
                    <SelectTrigger id="guidedStatus">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="inactive">Inactive only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  The report will automatically connect related information behind the scenes.
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Step 4: Preview the outcome</CardTitle>
              <CardDescription>Review the report before saving or exporting it.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => executeReport()} disabled={executing || selectedFields.length === 0}>
                  {executing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Generating preview...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Preview report
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={exportCurrentPreview} disabled={!previewData.length}>
                  Export CSV
                </Button>
                <Button onClick={saveReport} disabled={saving || !reportName || selectedFields.length === 0} className="bg-[#008000] hover:bg-[#006600]">
                  Save report
                </Button>
              </div>

              {previewData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Play className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No preview yet</p>
                  <p className="text-sm mt-2">Press “Preview report” to generate the report output for review.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Page {previewMeta?.page || 1} of {previewMeta?.totalPages || 1}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => executeReport(Math.max((previewMeta?.page || 1) - 1, 1))} disabled={(previewMeta?.page || 1) <= 1 || executing}>Previous</Button>
                      <Button size="sm" variant="outline" onClick={() => executeReport((previewMeta?.page || 1) + 1)} disabled={!previewMeta?.hasNextPage || executing}>Next</Button>
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          {Object.keys(previewData[0] || {}).map((key) => (
                            <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{humanizeLabel(key)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {previewData.map((row, idx) => (
                          <tr key={idx}>
                            {Object.values(row).map((value: any, cellIdx) => (
                              <td key={cellIdx} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatCellValue(value)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Information</CardTitle>
                <CardDescription>Basic details about your report</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reportNameAdvanced">Report Name *</Label>
                    <Input id="reportNameAdvanced" placeholder="e.g., Monthly Staff Report" value={reportName} onChange={(e) => setReportName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoryAdvanced">Category</Label>
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
                    <Label htmlFor="descriptionAdvanced">Description</Label>
                    <Textarea id="descriptionAdvanced" placeholder="Brief description of what this report shows..." value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportLimitAdvanced">Row Limit</Label>
                    <Input id="reportLimitAdvanced" type="number" min={0} placeholder="e.g., 800 (leave empty for no limit)" value={reportLimit} onChange={(e) => setReportLimit(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Set to 0 or leave empty to return all rows.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="isPublicAdvanced" checked={isPublic} onCheckedChange={(checked: boolean | 'indeterminate') => setIsPublic(checked as boolean)} />
                  <Label htmlFor="isPublicAdvanced" className="cursor-pointer">Make this report public (visible to all users)</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Select Data Source</CardTitle>
                <CardDescription>Choose the primary table for your report</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={baseTable} onValueChange={handleBaseTableChange}>
                  <SelectTrigger><SelectValue placeholder="Select a table..." /></SelectTrigger>
                  <SelectContent>
                    {dataSources.map((source) => (
                      <SelectItem key={source.table} value={source.table}>
                        <div className="flex items-center gap-2"><TableIcon className="h-4 w-4" />{source.label}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {fieldTableOptions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium">Available Fields By Connected Table:</p>
                    {fieldTableOptions.map((source) => (
                      <div key={source.table} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={source.table === baseTable ? 'default' : 'secondary'}>{source.label}</Badge>
                          <span className="text-xs text-muted-foreground">{source.table}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {source.fields.map((field) => (
                            <Badge key={`${source.table}.${field.field}`} variant="outline" className="cursor-pointer hover:bg-[#008000] hover:text-white transition-colors" onClick={() => addField(source.table, field.field, field.label)}>
                              <Plus className="h-3 w-3 mr-1" />{field.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {baseTable && (
              <Card>
                <Tabs defaultValue="fields" className="w-full">
                  <CardHeader>
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="fields"><Eye className="h-4 w-4 mr-2" />Fields ({selectedFields.length})</TabsTrigger>
                      <TabsTrigger value="filters"><Filter className="h-4 w-4 mr-2" />Filters ({filters.length})</TabsTrigger>
                      <TabsTrigger value="joins"><Link2 className="h-4 w-4 mr-2" />Joins ({joins.length})</TabsTrigger>
                      <TabsTrigger value="groupby"><Group className="h-4 w-4 mr-2" />Group ({groupByFields.length})</TabsTrigger>
                      <TabsTrigger value="orderby"><ArrowUpDown className="h-4 w-4 mr-2" />Sort ({orderByFields.length})</TabsTrigger>
                    </TabsList>
                  </CardHeader>
                  <CardContent>
                    <TabsContent value="fields" className="space-y-4">
                      <div className="flex items-center justify-between"><p className="text-sm text-gray-600 dark:text-gray-400">Selected fields that will appear in your report</p></div>
                      {selectedFields.length === 0 ? (<div className="text-center py-8 text-gray-500"><Eye className="h-12 w-12 mx-auto mb-2 opacity-20" /><p>No fields selected</p><p className="text-sm">Click on field badges above to add them</p></div>) : (
                        <div className="space-y-2">{selectedFields.map((field, index) => (
                          <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex-1"><p className="font-medium">{field.alias || field.field}</p><p className="text-sm text-gray-600 dark:text-gray-400">{field.table}.{field.field}{field.aggregate && ` (${field.aggregate})`}</p></div>
                            <Button variant="ghost" size="sm" onClick={() => removeField(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          </div>
                        ))}</div>
                      )}
                    </TabsContent>
                    <TabsContent value="filters" className="space-y-4">
                      <div className="flex items-center justify-between"><p className="text-sm text-gray-600 dark:text-gray-400">Add conditions to filter your data</p><Button size="sm" onClick={addFilter}><Plus className="h-4 w-4 mr-2" />Add Filter</Button></div>
                      {filters.length === 0 ? (<div className="text-center py-8 text-gray-500"><Filter className="h-12 w-12 mx-auto mb-2 opacity-20" /><p>No filters added</p><p className="text-sm">Click "Add Filter" to filter your data</p></div>) : (
                        <div className="space-y-4">{filters.map((filter, index) => (<FilterRow key={index} filter={filter} tables={tableOptions} dataSourceMap={dataSourceMap} onUpdate={(updates) => updateFilter(index, updates)} onRemove={() => removeFilter(index)} />))}</div>
                      )}
                    </TabsContent>
                    <TabsContent value="joins" className="space-y-4">
                      <div className="flex items-center justify-between"><p className="text-sm text-gray-600 dark:text-gray-400">Join related tables to include additional data</p><Button size="sm" onClick={addJoin} disabled={availableJoinOptions.length === 0}><Plus className="h-4 w-4 mr-2" />Add Join</Button></div>
                      {joins.length === 0 ? (<div className="text-center py-8 text-gray-500"><Link2 className="h-12 w-12 mx-auto mb-2 opacity-20" /><p>No joins configured</p><p className="text-sm">{availableJoinOptions.length === 0 ? 'No related tables available for this data source' : 'Click "Add Join" to include data from related tables'}</p></div>) : (
                        <div className="space-y-2">{joins.map((join, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_160px_auto] gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div><Label className="text-xs">From Table</Label><Select value={join.fromTable || baseTable} onValueChange={(value) => updateJoin(index, { fromTable: value, table: '' })}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{connectedTables.map((table) => (<SelectItem key={`${index}-${table}`} value={table}>{dataSourceMap.get(table)?.label || table}</SelectItem>))}</SelectContent></Select></div>
                            <div><Label className="text-xs">Join Table</Label><Select value={join.table} onValueChange={(value) => updateJoin(index, { table: value })}><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select join table" /></SelectTrigger><SelectContent>{relationshipEdges.filter((edge) => edge.sourceTable === (join.fromTable || baseTable)).map((edge) => (<SelectItem key={`${index}-${edge.sourceTable}-${edge.targetTable}`} value={edge.targetTable}>{dataSourceMap.get(edge.targetTable)?.label || edge.targetTable}</SelectItem>))}</SelectContent></Select></div>
                            <div><Label className="text-xs">Join Type</Label><Select value={join.type} onValueChange={(value: ReportJoin['type']) => updateJoin(index, { type: value })}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{(relationshipEdges.find((edge) => edge.sourceTable === (join.fromTable || baseTable) && edge.targetTable === join.table)?.joinTypes || ['LEFT', 'INNER', 'RIGHT']).map((joinType) => (<SelectItem key={`${index}-${joinType}`} value={joinType}>{joinType}</SelectItem>))}</SelectContent></Select></div>
                            <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => removeJoin(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
                            <div className="md:col-span-4 text-sm text-gray-600 dark:text-gray-400">{join.table ? `${join.type} JOIN ${dataSourceMap.get(join.table)?.label || join.table} from ${dataSourceMap.get(join.fromTable || baseTable)?.label || (join.fromTable || baseTable)}` : 'Select the table you want to join'}</div>
                          </div>
                        ))}</div>
                      )}
                    </TabsContent>
                    <TabsContent value="groupby" className="space-y-4">
                      <div className="flex items-center justify-between"><p className="text-sm text-gray-600 dark:text-gray-400">Group results by specific fields (required when using aggregates)</p><Button size="sm" onClick={addGroupBy}><Plus className="h-4 w-4 mr-2" />Add Group By</Button></div>
                      {groupByFields.length === 0 ? (<div className="text-center py-8 text-gray-500"><Group className="h-12 w-12 mx-auto mb-2 opacity-20" /><p>No grouping configured</p><p className="text-sm">Add grouping when using SUM, AVG, COUNT, etc.</p></div>) : (
                        <div className="space-y-2">{groupByFields.map((groupBy, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div><Label className="text-xs">Table</Label><Select value={groupBy.table} onValueChange={(value) => setGroupByFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { table: value, field: getDefaultField(value) } : item))}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{tableOptions.map((table) => (<SelectItem key={`${index}-group-${table}`} value={table}>{dataSourceMap.get(table)?.label || table}</SelectItem>))}</SelectContent></Select></div>
                            <div><Label className="text-xs">Field</Label><Select value={groupBy.field} onValueChange={(value) => setGroupByFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, field: value } : item))}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{(dataSourceMap.get(groupBy.table)?.fields || []).map((field) => (<SelectItem key={`${index}-group-field-${field.field}`} value={field.field}>{field.label}</SelectItem>))}</SelectContent></Select></div>
                            <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => removeGroupBy(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
                          </div>
                        ))}</div>
                      )}
                    </TabsContent>
                    <TabsContent value="orderby" className="space-y-4">
                      <div className="flex items-center justify-between"><p className="text-sm text-gray-600 dark:text-gray-400">Sort your results by specific fields</p><Button size="sm" onClick={addOrderBy}><Plus className="h-4 w-4 mr-2" />Add Sort</Button></div>
                      {orderByFields.length === 0 ? (<div className="text-center py-8 text-gray-500"><ArrowUpDown className="h-12 w-12 mx-auto mb-2 opacity-20" /><p>No sorting configured</p><p className="text-sm">Click "Add Sort" to order your results</p></div>) : (
                        <div className="space-y-2">{orderByFields.map((orderBy, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_160px_auto] gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div><Label className="text-xs">Table</Label><Select value={orderBy.table} onValueChange={(value) => setOrderByFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { table: value, field: getDefaultField(value), direction: item.direction } : item))}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{tableOptions.map((table) => (<SelectItem key={`${index}-order-${table}`} value={table}>{dataSourceMap.get(table)?.label || table}</SelectItem>))}</SelectContent></Select></div>
                            <div><Label className="text-xs">Field</Label><Select value={orderBy.field} onValueChange={(value) => setOrderByFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, field: value } : item))}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{(dataSourceMap.get(orderBy.table)?.fields || []).map((field) => (<SelectItem key={`${index}-order-field-${field.field}`} value={field.field}>{field.label}</SelectItem>))}</SelectContent></Select></div>
                            <div><Label className="text-xs">Direction</Label><Select value={orderBy.direction} onValueChange={(value: ReportOrderBy['direction']) => setOrderByFields((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, direction: value } : item))}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ASC">Ascending</SelectItem><SelectItem value="DESC">Descending</SelectItem></SelectContent></Select></div>
                            <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => removeOrderBy(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
                          </div>
                        ))}</div>
                      )}
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Report Preview</CardTitle>
                <CardDescription>{previewMeta ? `${previewMeta.totalRows} rows in ${reportHelpers.formatExecutionTime(previewMeta.executionTimeMs)}` : 'Click "Preview" to see results'}</CardDescription>
                {reportName && <div className="text-sm font-semibold text-card-foreground">{reportName}</div>}
                <div className="text-xs text-muted-foreground">{(() => { const parsedLimit = parseInt(reportLimit, 10); const isLimited = Number.isFinite(parsedLimit) && parsedLimit > 0; return isLimited ? `Limit: ${parsedLimit}` : 'Limit: none'; })()}</div>
              </CardHeader>
              <CardContent>
                {previewData.length === 0 ? (
                  <div className="text-center py-12 text-gray-500"><Play className="h-12 w-12 mx-auto mb-2 opacity-20" /><p>{previewMeta ? 'No rows matched this preview' : 'No preview data'}</p><p className="text-sm mt-2">{previewMeta ? 'The query completed successfully, but your current filters returned no records.' : 'Configure your report and click "Preview" to see live data'}</p></div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Page {previewMeta?.page || 1} of {previewMeta?.totalPages || 1}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => executeReport(Math.max((previewMeta?.page || 1) - 1, 1))} disabled={(previewMeta?.page || 1) <= 1 || executing}>Previous</Button><Button size="sm" variant="outline" onClick={() => executeReport((previewMeta?.page || 1) + 1)} disabled={!previewMeta?.hasNextPage || executing}>Next</Button></div></div>
                    <div className="max-h-[600px] overflow-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-800 sticky top-0"><tr>{Object.keys(previewData[0] || {}).map((key) => (<th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{humanizeLabel(key)}</th>))}</tr></thead><tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">{previewData.map((row, idx) => (<tr key={idx}>{Object.values(row).map((value: any, cellIdx) => (<td key={cellIdx} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{formatCellValue(value)}</td>))}</tr>))}</tbody></table></div>
                    <p className="text-xs text-gray-500 text-center">Showing {previewMeta?.returnedRows || previewData.length} rows for this page</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

// Filter Row Component
interface FilterRowProps {
  filter: ReportFilter;
  tables: string[];
  dataSourceMap: Map<string, DataSource>;
  onUpdate: (updates: Partial<ReportFilter>) => void;
  onRemove: () => void;
}

const FilterRow: React.FC<FilterRowProps> = ({ filter, tables, dataSourceMap, onUpdate, onRemove }) => {
  const table = dataSourceMap.get(filter.table);
  const field = table?.fields.find(f => f.field === filter.field);
  const operators = reportHelpers.getOperatorsForType(field?.type || 'string');
  const supportsListValues = ['IN', 'NOT IN', 'BETWEEN'].includes(filter.operator);

  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 flex-1">
        <div>
          <Label className="text-xs">Table</Label>
          <Select
            value={filter.table}
            onValueChange={(value: string) =>
              onUpdate({
                table: value,
                field: dataSourceMap.get(value)?.fields[0]?.field || '',
                value: '',
                values: undefined,
              })
            }
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tables.map((tableName) => (
                <SelectItem key={tableName} value={tableName}>
                  {dataSourceMap.get(tableName)?.label || tableName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              placeholder={supportsListValues ? 'Use commas to separate values' : 'Enter value...'}
              value={supportsListValues ? (filter.values || []).join(', ') : (filter.value || '')}
              onChange={(e) => {
                const rawValue = e.target.value;
                if (supportsListValues) {
                  const values = rawValue
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean);
                  onUpdate({ values, value: undefined });
                  return;
                }
                onUpdate({ value: rawValue, values: undefined });
              }}
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
