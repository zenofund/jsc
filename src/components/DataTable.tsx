import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  onEdit?: (row: T) => void;
}

// Helper for deep recursive search
const deepSearch = (obj: any, query: string): boolean => {
  if (obj === null || obj === undefined) return false;
  
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj).toLowerCase().includes(query);
  }
  
  if (Array.isArray(obj)) {
    return obj.some(item => deepSearch(item, query));
  }
  
  if (typeof obj === 'object') {
    return Object.values(obj).some(val => deepSearch(val, query));
  }
  
  return false;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  searchable = false,
  searchPlaceholder = 'Search...',
  onEdit,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ index: number; direction: 'asc' | 'desc' } | null>(null);

  // Filter data based on search
  const filteredData = searchable
    ? (data || []).filter((row) => deepSearch(row, searchQuery.toLowerCase()))
    : (data || []);

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    
    const column = columns[sortConfig.index];
    const getValue = (row: T) => {
      if (typeof column.accessor === 'function') {
        const val = column.accessor(row);
        // If it's a React element, try to get its props.children or string representation if possible, 
        // but sorting by ReactNode is generally not supported well.
        // Assuming accessors for sortable columns return primitives.
        return val;
      }
      return row[column.accessor as keyof T];
    };

    const aValue = getValue(a) as any;
    const bValue = getValue(b) as any;

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  const handleSort = (index: number) => {
    setSortConfig((current) => {
      if (!current || current.index !== index) {
        return { index, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { index, direction: 'desc' };
      }
      return null;
    });
  };

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm border border-border rounded-lg bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-muted/80 hover:text-foreground transition-colors' : ''
                    }`}
                    onClick={() => column.sortable && handleSort(index)}
                  >
                    <div className="flex items-center gap-1">
                      {column.header}
                      {column.sortable && (
                        <span className="inline-block ml-1">
                          {sortConfig?.index === index ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {onEdit && <th className="px-3 sm:px-6 py-3 sm:py-4"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 sm:px-6 py-8 sm:py-12 text-center text-sm text-muted-foreground">
                    No data available
                  </td>
                </tr>
              ) : (
                currentData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? 'hover:bg-accent cursor-pointer transition-colors' : ''}
                  >
                    {columns.map((column, colIndex) => (
                      <td key={colIndex} className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-card-foreground">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {typeof column.accessor === 'function'
                            ? column.accessor(row)
                            : row[column.accessor]}
                        </div>
                      </td>
                    ))}
                    {onEdit && (
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <button
                          onClick={() => onEdit(row)}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-muted/30 px-3 sm:px-6 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1">
              <span className="hidden sm:inline">Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} results</span>
              <span className="sm:hidden">{startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm whitespace-nowrap text-card-foreground">
                <span className="hidden sm:inline">Page {currentPage} of {totalPages}</span>
                <span className="sm:hidden">{currentPage}/{totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 sm:p-1.5 rounded hover:bg-accent text-card-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}