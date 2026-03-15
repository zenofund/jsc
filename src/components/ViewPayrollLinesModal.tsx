import React from 'react';
import { Modal } from './Modal';
import { PayrollBatch, PayrollLine } from '../types/entities';
import { User, Calculator, CalendarClock, Loader2, Download, FileText, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getProrationBadgeText } from '../lib/proration-calculator';
import { formatCurrency } from '../utils/format';
import { payrollAPI } from '../lib/api-client';
import { getBankByName } from '../constants/banks';
import { loadPdfMake } from '../utils/loadPdfMake';

interface ViewPayrollLinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  batch: PayrollBatch | null;
  lines: PayrollLine[];
  isLoading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (direction: 'asc' | 'desc') => void;
  sortDirection?: 'asc' | 'desc';
}

export function ViewPayrollLinesModal({
  isOpen,
  onClose,
  title,
  size = 'xl',
  batch,
  lines,
  isLoading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onSortChange,
  sortDirection = 'desc',
}: ViewPayrollLinesModalProps) {
  const [exporting, setExporting] = React.useState<'csv' | 'pdf' | null>(null);

  const getGradeKey = (gradeLevel: unknown) => {
    const raw = String(gradeLevel ?? '').trim().toUpperCase();
    const isNumeric = /^\d+$/.test(raw);
    const digits = raw.match(/\d+/g)?.join('') ?? '';
    const num = digits ? Number(digits) : null;
    const prefix = raw.replace(/\d+/g, '').trim();
    return { isNumeric, num: Number.isFinite(num as number) ? (num as number) : null, prefix, raw };
  };

  const compareLines = (a: PayrollLine, b: PayrollLine, direction: 'asc' | 'desc') => {
    const dir = direction === 'asc' ? 1 : -1;
    const aGrade = getGradeKey(a.grade_level);
    const bGrade = getGradeKey(b.grade_level);

    if (aGrade.isNumeric !== bGrade.isNumeric) return aGrade.isNumeric ? -1 : 1;

    if (aGrade.num !== null && bGrade.num !== null && aGrade.num !== bGrade.num) {
      return (aGrade.num - bGrade.num) * dir;
    }

    if (aGrade.prefix !== bGrade.prefix) return aGrade.prefix.localeCompare(bGrade.prefix) * dir;
    if (aGrade.raw !== bGrade.raw) return aGrade.raw.localeCompare(bGrade.raw) * dir;

    const aStep = Number(a.step ?? 0);
    const bStep = Number(b.step ?? 0);
    if (aStep !== bStep) return (aStep - bStep) * dir;

    return String(a.staff_number ?? '').localeCompare(String(b.staff_number ?? ''));
  };

  const displayLines = React.useMemo(() => {
    const sorted = [...lines];
    sorted.sort((a, b) => compareLines(a, b, sortDirection));
    return sorted;
  }, [lines, sortDirection]);

  const csvCell = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const toNumber = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const round2 = (value: number) => Math.round(value * 100) / 100;

  const toCsvMoney = (value: unknown) => round2(toNumber(value)).toFixed(2);

  const lineTotalAllowances = (line: PayrollLine) => {
    const hasExplicit = (line as any).total_allowances !== undefined && (line as any).total_allowances !== null;
    if (hasExplicit) return toNumber((line as any).total_allowances);
    const gross = toNumber(line.gross_pay);
    const basic = toNumber(line.basic_salary);
    const derived = gross - basic;
    return Number.isFinite(derived) ? derived : 0;
  };

  const getBankCode = (bankNameOrCode: unknown) => {
    const raw = String(bankNameOrCode ?? '').trim();
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return raw;
    return getBankByName(raw)?.code || '';
  };

  const gradeStepText = (line: PayrollLine) => `${String(line.grade_level ?? '').trim()}/${String(line.step ?? '').trim()}`;

  const itemKey = (item: any) => {
    const code = String(item?.code ?? '').trim();
    const name = String(item?.name ?? '').trim();
    if (code && name) return `${code}__${name}`;
    if (code) return code;
    return name;
  };

  const itemBaseLabel = (item: any) => {
    const code = String(item?.code ?? '').trim();
    const name = String(item?.name ?? '').trim();
    return name || code;
  };

  const buildItemLabels = (items: any[]) => {
    const keyToBase = new Map<string, string>();
    const baseCounts = new Map<string, number>();
    for (const item of items) {
      const key = itemKey(item);
      if (!key) continue;
      const base = itemBaseLabel(item);
      keyToBase.set(key, base);
      baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
    }
    const keyToLabel = new Map<string, string>();
    for (const item of items) {
      const key = itemKey(item);
      if (!key) continue;
      const base = keyToBase.get(key) ?? '';
      const count = baseCounts.get(base) ?? 0;
      if (count <= 1) {
        keyToLabel.set(key, base);
        continue;
      }
      const code = String(item?.code ?? '').trim();
      keyToLabel.set(key, code ? `${base} (${code})` : base);
    }
    return keyToLabel;
  };

  const collectExportModel = (allLines: PayrollLine[]) => {
    const allowanceItems: any[] = [];
    const deductionItems: any[] = [];

    for (const line of allLines) {
      const allowances = Array.isArray((line as any).allowances) ? (line as any).allowances : [];
      const deductions = Array.isArray((line as any).deductions) ? (line as any).deductions : [];
      for (const a of allowances) allowanceItems.push(a);
      for (const d of deductions) deductionItems.push(d);
    }

    const allowanceKeyToLabel = buildItemLabels(allowanceItems);
    const deductionKeyToLabel = buildItemLabels(deductionItems);

    const allowanceKeys = Array.from(allowanceKeyToLabel.keys()).sort((a, b) => {
      const la = allowanceKeyToLabel.get(a) ?? a;
      const lb = allowanceKeyToLabel.get(b) ?? b;
      return la.localeCompare(lb);
    });
    const deductionKeys = Array.from(deductionKeyToLabel.keys()).sort((a, b) => {
      const la = deductionKeyToLabel.get(a) ?? a;
      const lb = deductionKeyToLabel.get(b) ?? b;
      return la.localeCompare(lb);
    });

    const getItemAmount = (items: any[], key: string) => {
      if (!Array.isArray(items)) return 0;
      let sum = 0;
      for (const i of items) {
        if (itemKey(i) === key) sum += toNumber(i?.amount);
      }
      return sum;
    };

    const columns: Array<{
      id: string;
      header: string;
      isMoney: boolean;
      get: (line: PayrollLine, index: number) => string;
    }> = [
      { id: 'sn', header: 'S/N', isMoney: false, get: (_line, index) => String(index + 1) },
      { id: 'staff_number', header: 'Staff Number', isMoney: false, get: (line) => String(line.staff_number ?? '') },
      { id: 'staff_name', header: 'Staff Name', isMoney: false, get: (line) => String(line.staff_name ?? '') },
      { id: 'grade_step', header: 'Grade/Step', isMoney: false, get: (line) => gradeStepText(line) },
      { id: 'basic_salary', header: 'Basic Salary', isMoney: true, get: (line) => toCsvMoney(line.basic_salary) },
      ...allowanceKeys.map((key) => ({
        id: `allowance:${key}`,
        header: allowanceKeyToLabel.get(key) ?? key,
        isMoney: true,
        get: (line: PayrollLine) => toCsvMoney(getItemAmount((line as any).allowances, key)),
      })),
      { id: 'total_allowances', header: 'Total Allowances', isMoney: true, get: (line) => toCsvMoney(lineTotalAllowances(line)) },
      { id: 'gross_pay', header: 'Gross Pay', isMoney: true, get: (line) => toCsvMoney(line.gross_pay) },
      ...deductionKeys.map((key) => ({
        id: `deduction:${key}`,
        header: deductionKeyToLabel.get(key) ?? key,
        isMoney: true,
        get: (line: PayrollLine) => toCsvMoney(getItemAmount((line as any).deductions, key)),
      })),
      { id: 'total_deductions', header: 'Total Deductions', isMoney: true, get: (line) => toCsvMoney(line.total_deductions) },
      { id: 'net_pay', header: 'Net Pay', isMoney: true, get: (line) => toCsvMoney(line.net_pay) },
      { id: 'bank_code', header: 'Bank Code', isMoney: false, get: (line) => getBankCode((line as any).bank_name) },
      { id: 'account_number', header: 'Account Number', isMoney: false, get: (line) => String((line as any).account_number ?? '') },
    ];

    const moneyTotals = new Map<string, number>();
    for (const col of columns) {
      if (!col.isMoney) continue;
      moneyTotals.set(col.id, 0);
    }
    allLines.forEach((line, index) => {
      for (const col of columns) {
        if (!col.isMoney) continue;
        const raw = col.get(line, index);
        moneyTotals.set(col.id, (moneyTotals.get(col.id) ?? 0) + toNumber(raw));
      }
    });

    return { columns, moneyTotals };
  };

  if (!batch) return null;

  const handleExportCSV = async () => {
    try {
      setExporting('csv');
      // Fetch all lines for export
      const response = await payrollAPI.getPayrollLines(batch.id, { limit: 100000, sort: sortDirection });
      const allLinesRaw = Array.isArray(response) ? response : (response.data || []);
      const allLines = [...allLinesRaw].sort((a, b) => compareLines(a, b, sortDirection));

      if (allLines.length === 0) {
        setExporting(null);
        return;
      }

      const { columns, moneyTotals } = collectExportModel(allLines);

      const headers = columns.map((c) => csvCell(c.header)).join(',');

      const rows = allLines.map((line, index) => {
        const cells = columns.map((c) => csvCell(c.get(line, index)));
        return cells.join(',');
      });

      const totalRow = columns
        .map((c) => {
          if (c.id === 'staff_name') return csvCell('TOTAL');
          if (!c.isMoney) return csvCell('');
          return csvCell(round2(moneyTotals.get(c.id) ?? 0).toFixed(2));
        })
        .join(',');

      const csvContent = [
        headers,
        ...rows,
        '', // Empty line
        totalRow
      ].join('\n');

      // Create Download Link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `payroll_lines_${batch.batch_number}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed', error);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting('pdf');
      const response = await payrollAPI.getPayrollLines(batch.id, { limit: 100000, sort: sortDirection });
      const allLinesRaw = Array.isArray(response) ? response : (response.data || []);
      const allLines = [...allLinesRaw].sort((a, b) => compareLines(a, b, sortDirection));

      if (allLines.length === 0) {
        setExporting(null);
        return;
      }

      const { columns, moneyTotals } = collectExportModel(allLines);

      const formatPDFMoney = (amount: number) =>
        '₦' + round2(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const tableBody: any[] = [];
      tableBody.push(
        columns.map((c) => ({
          text: c.header,
          bold: true,
          color: 'white',
          fillColor: '#008000',
          fontSize: 8,
          margin: [3, 3, 3, 3],
        })),
      );

      allLines.forEach((line, index) => {
        tableBody.push(
          columns.map((c) => {
            const value = c.get(line, index);
            if (!c.isMoney) {
              return { text: value || '', fontSize: 7, margin: [3, 2, 3, 2] };
            }
            return { text: formatPDFMoney(toNumber(value)), alignment: 'right', fontSize: 7, margin: [3, 2, 3, 2] };
          }),
        );
      });

      tableBody.push(
        columns.map((c) => {
          if (c.id === 'staff_name') {
            return { text: 'TOTAL', bold: true, fontSize: 8, margin: [3, 3, 3, 3] };
          }
          if (!c.isMoney) {
            return { text: '', fontSize: 8, margin: [3, 3, 3, 3] };
          }
          return {
            text: formatPDFMoney(moneyTotals.get(c.id) ?? 0),
            alignment: 'right',
            bold: true,
            fontSize: 8,
            margin: [3, 3, 3, 3],
          };
        }),
      );

      const docDefinition = {
        pageOrientation: 'landscape',
        pageMargins: [20, 20, 20, 20],
        content: [
          { text: 'Nigerian Judicial Service Committee', fontSize: 14, bold: true, color: '#008000', margin: [0, 0, 0, 4] },
          { text: `Payroll Lines - Batch ${batch.batch_number}`, fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
          { text: `Generated: ${new Date().toLocaleDateString()}`, fontSize: 9, color: '#6b7280', margin: [0, 0, 0, 10] },
          {
            table: {
              headerRows: 1,
              widths: Array(columns.length).fill('*'),
              body: tableBody,
            },
            layout: {
              fillColor: (rowIndex: number) => {
                if (rowIndex === 0) return '#008000';
                return rowIndex % 2 === 0 ? '#F9FAFB' : null;
              },
              hLineColor: () => '#e5e7eb',
              vLineColor: () => '#e5e7eb',
              paddingLeft: () => 2,
              paddingRight: () => 2,
              paddingTop: () => 2,
              paddingBottom: () => 2,
            },
          },
        ],
      };

      const pdfMake = await loadPdfMake();
      const filename = `payroll_lines_${batch.batch_number}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);
    } catch (error) {
      console.error('PDF export failed', error);
    } finally {
      setExporting(null);
    }
  };


  const toggleSort = () => {
    if (onSortChange) {
      onSortChange(sortDirection === 'desc' ? 'asc' : 'desc');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
      <div className="space-y-4">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             {/* Batch Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg w-full">
              <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Staff</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{batch.total_staff}</p>
              </div>
              <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Gross Pay</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground truncate">{formatCurrency(batch.total_gross)}</p>
              </div>
              <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Deductions</p>
                  <p className="text-lg sm:text-xl font-bold text-red-600 truncate">{formatCurrency(batch.total_deductions)}</p>
              </div>
              <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Net Pay</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600 truncate">{formatCurrency(batch.total_net)}</p>
              </div>
            </div>
            
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
              <button
                  onClick={handleExportCSV}
                  disabled={exporting !== null || isLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                  {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export CSV
              </button>
              <button
                  onClick={handleExportPDF}
                  disabled={exporting !== null || isLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 border border-border text-foreground rounded-md hover:bg-accent disabled:opacity-50"
              >
                  {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Export PDF
              </button>
            </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading payroll lines...</span>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Staff
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase cursor-pointer hover:bg-muted/80" onClick={toggleSort}>
                      <div className="flex items-center gap-1">
                        Grade/Step
                        {sortDirection === 'desc' ? (
                           <ArrowDown className="w-3 h-3" />
                        ) : (
                           <ArrowUp className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Basic Salary
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Allowances
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Gross Pay
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Deductions
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                      Net Pay
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {displayLines.map((line) => (
                    <tr key={line.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{line.staff_name}</p>
                              {line.is_prorated && line.proration_details && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                  <CalendarClock className="w-3 h-3" />
                                  {getProrationBadgeText(line.proration_details.proration_reason)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{line.staff_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        GL {line.grade_level} / {line.step}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatCurrency(line.basic_salary)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {formatCurrency(line.total_allowances || (line.gross_pay - line.basic_salary))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        {formatCurrency(line.gross_pay)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {formatCurrency(line.total_deductions)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary">
                        {formatCurrency(line.net_pay)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="bg-muted/30 px-3 sm:px-6 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-lg">
            <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
              <span className="hidden sm:inline">Page {currentPage} of {totalPages}</span>
              <span className="sm:hidden">{currentPage}/{totalPages}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
              <button
                onClick={() => onPageChange?.(1)}
                disabled={currentPage === 1 || isLoading}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange?.(pageNum)}
                      disabled={isLoading}
                      className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent text-card-foreground'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => onPageChange?.(totalPages)}
                disabled={currentPage === totalPages || isLoading}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}

        {!isLoading && lines.length === 0 && (
          <div className="text-center py-12">
            <Calculator className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No payroll lines found</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
