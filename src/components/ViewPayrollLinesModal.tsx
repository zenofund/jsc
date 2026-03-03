import React from 'react';
import { Modal } from './Modal';
import { PayrollBatch, PayrollLine } from '../types/entities';
import { User, Calculator, CalendarClock, Loader2, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getProrationBadgeText } from '../lib/proration-calculator';
import { formatCurrency } from '../utils/format';
import { payrollAPI } from '../lib/api-client';

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
  const [isExporting, setIsExporting] = React.useState(false);

  if (!batch) return null;

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      // Fetch all lines for export
      const response = await payrollAPI.getPayrollLines(batch.id, { limit: 100000 });
      const allLines = Array.isArray(response) ? response : (response.data || []);

      if (allLines.length === 0) {
        setIsExporting(false);
        return;
      }

      // Define CSV Headers
      const headers = [
        'Staff Number',
        'Staff Name',
        'Grade Level',
        'Step',
        'Basic Salary',
        'Total Allowances',
        'Gross Pay',
        'Total Deductions',
        'Net Pay',
        'Bank Name',
        'Account Number'
      ];

      // Format Rows
      const rows = allLines.map((line: PayrollLine) => [
        line.staff_number,
        `"${line.staff_name}"`, // Quote name to handle commas
        line.grade_level,
        line.step,
        line.basic_salary,
        line.total_allowances || (line.gross_pay - line.basic_salary),
        line.gross_pay,
        line.total_deductions,
        line.net_pay,
        line.bank_name || '',
        line.account_number || '',
      ].join(','));

      // Add Total Row
      const totalRow = [
        'TOTAL',
        '',
        '',
        '',
        batch.total_gross - (batch.total_gross - batch.total_deductions - batch.total_net), // Approximation or use batch totals
        // Better to use batch totals directly
        formatCurrency(allLines.reduce((sum: number, l: PayrollLine) => sum + l.basic_salary, 0)).replace(/[^0-9.-]+/g,""),
        formatCurrency(allLines.reduce((sum: number, l: PayrollLine) => sum + (l.total_allowances || 0), 0)).replace(/[^0-9.-]+/g,""),
        formatCurrency(batch.total_gross).replace(/[^0-9.-]+/g,""),
        formatCurrency(batch.total_deductions).replace(/[^0-9.-]+/g,""),
        formatCurrency(batch.total_net).replace(/[^0-9.-]+/g,""),
      ].join(',');

      const csvContent = [
        headers.join(','),
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
      setIsExporting(false);
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
            
            <button
                onClick={handleExportCSV}
                disabled={isExporting || isLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export CSV
            </button>
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
                  {lines.map((line) => (
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
