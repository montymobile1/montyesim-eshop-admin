//UTILITIES
import React from "react";
//COMPONENT
import {
  TableSortLabel,
  TableRow,
  TableCell,
  TableHead,
} from "@mui/material";

// Page-level actions (onAdd / onEdit / onLogs) are rendered above the table
// by TableComponent's toolbar; the actions cell here only keeps row action
// columns aligned.
export function TableCustomHeader(props) {
  const { headers, actions } = props;

  const { sortDirection, sortedBy, requestSort } = props;

  const handleRequestSort = (item) => {
    requestSort(item);
  };

  return (
    <TableHead>
      <TableRow>
        {headers?.map((item, index) => (
          <TableCell
            key={index} // NOSONAR
            sortDirection={sortedBy === item.sorted ? sortDirection : false}
          >
            {item.sorted ? (
              <TableSortLabel
                direction={sortedBy === item.sorted ? sortDirection : "desc"}
                active={sortedBy === item.sorted}
                onClick={(e) => handleRequestSort(item.sorted)}
              >
                {item.name}
              </TableSortLabel>
            ) : (
              item.name
            )}
          </TableCell>
        ))}
        {actions && <TableCell align="right" />}
      </TableRow>
    </TableHead>
  );
}

export default TableCustomHeader;
