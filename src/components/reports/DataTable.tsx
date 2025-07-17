import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { TableColumn, SortConfig } from '../../types/reports';

interface DataTableProps<T = any> {
  data: T[];
  columns: TableColumn[];
  title?: string;
  className?: string;
  rowsPerPage?: number;
  showPagination?: boolean;
}

export const DataTable = <T extends Record<string, any>>({
  data,
  columns,
  title,
  className = '',
  rowsPerPage = 10,
  showPagination = true,
}: DataTableProps<T>) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? result : -result;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const result = aValue - bValue;
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Fallback to string comparison
      const result = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [data, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, rowsPerPage, showPagination]);

  const totalPages = Math.ceil(data.length / rowsPerPage);

  const handleSort = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    setSortConfig(prevSort => {
      if (!prevSort || prevSort.key !== columnKey) {
        return { key: columnKey, direction: 'asc' };
      }
      if (prevSort.direction === 'asc') {
        return { key: columnKey, direction: 'desc' };
      }
      return null; // Remove sorting
    });
  };

  const getSortIcon = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return null;

    if (!sortConfig || sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }

    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-blue-600" />
      : <ChevronDown className="h-4 w-4 text-blue-600" />;
  };

  const formatCellValue = (value: any, column: TableColumn, row: any) => {
    if (value === null || value === undefined) return '-';
    
    if (column.formatter) {
      return column.formatter(value, row);
    }
    
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    return String(value);
  };

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-${column.align || 'left'} text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                  }`}
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-${column.align || 'left'}`}
                  >
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: formatCellValue(row[column.key], column, row) 
                      }} 
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, data.length)} of {data.length} results
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {/* Page numbers */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first page, last page, current page, and pages around current
                  return page === 1 || 
                         page === totalPages || 
                         Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, array) => {
                  // Add ellipsis if there's a gap
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && (
                        <span className="px-2 py-1 text-gray-500">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 border rounded-md text-sm font-medium ${
                          currentPage === page
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Table summary */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Total: {data.length} record{data.length !== 1 ? 's' : ''}
          {sortConfig && (
            <span className="ml-4">
              Sorted by {columns.find(col => col.key === sortConfig.key)?.label} ({sortConfig.direction})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};