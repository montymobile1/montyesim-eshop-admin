import { TablePagination } from "@mui/material";

/**
 * Reusable TablePagination component
 * @param {Object} props
 * @param {number} props.totalRows - Total number of rows
 * @param {number} props.page - Current page number
 * @param {number} props.pageSize - Number of rows per page
 * @param {Function} props.onPageChange - Callback when page changes: (event, newPage) => void
 * @param {Function} props.onRowsPerPageChange - Callback when rows per page changes: (event) => void
 */
const TablePaginationComponent = ({
  totalRows = 0,
  page = 0,
  pageSize = 10,
  onPageChange,
  onRowsPerPageChange,
}) => {
  return (
    <TablePagination
      component="div"
      count={totalRows || 0}
      page={page}
      onPageChange={onPageChange}
      rowsPerPage={pageSize}
      onRowsPerPageChange={onRowsPerPageChange}
    />
  );
};

export default TablePaginationComponent;

