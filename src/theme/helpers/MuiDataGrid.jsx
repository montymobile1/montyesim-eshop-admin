import { alpha } from "@mui/system";

export const DataGridTheme = ({ theme }) => {
  return {
    MuiDataGrid: {
      styleOverrides: {
        root: {
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: "12px",
          "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
            outline: "none !important",
          },
          "& .MuiDataGrid-cell": {
            borderColor: theme.palette.divider,
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.background.default,
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
            overflow: "hidden",
          },
          "& .MuiDataGrid-columnHeaderTitle": {
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: theme.palette.text.secondary,
          },
          "& .MuiDataGrid-columnSeparator": {
            display: "none",
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: `1px solid ${theme.palette.divider}`,
          },
        },
        columnHeader: {
          backgroundColor: theme.palette.background.default,
        },
        row: {
          "&:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.03),
          },
        },
      },
    },
  };
};
