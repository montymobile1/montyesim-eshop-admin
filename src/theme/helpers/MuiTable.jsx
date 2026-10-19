import { alpha } from "@mui/system";

export const TableTheme = ({ theme }) => {
  return {
    MuiTableContainer: {
      styleOverrides: {
        root: {
          minHeight: "400px",
          backgroundColor: theme.palette.background.paper,
          borderRadius: "12px",
          border: `1px solid ${theme.palette.divider}`,
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          border: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: "12px 16px !important",
          borderBottom: `1px solid ${theme.palette.divider}`,
          fontSize: "0.875rem",
        },
        head: {
          fontWeight: 600,
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: theme.palette.text.secondary,
          backgroundColor: theme.palette.background.default,
          whiteSpace: "nowrap",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.background.paper,
          transition: "background-color 0.15s ease",
          "&:last-of-type td": {
            borderBottom: "none",
          },
          "&.MuiTableRow-hover:hover, &.tableRow:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.03),
          },
        },
        head: {
          backgroundColor: theme.palette.background.default,
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          borderBottom: "none",
          color: theme.palette.text.secondary,
        },
        selectLabel: {
          fontSize: "0.8125rem",
        },
        displayedRows: {
          fontSize: "0.8125rem",
        },
      },
    },
  };
};
