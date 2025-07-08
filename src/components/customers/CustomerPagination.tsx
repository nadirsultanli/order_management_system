import React from 'react';
import { Pagination } from '../ui/Pagination';

interface CustomerPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
}

export const CustomerPagination: React.FC<CustomerPaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
  itemsPerPage = 15, // Default to 15 items per page
}) => {
  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      totalItems={totalCount}
      itemsPerPage={itemsPerPage}
      onPageChange={onPageChange}
      showItemCount={true}
    />
  );
};