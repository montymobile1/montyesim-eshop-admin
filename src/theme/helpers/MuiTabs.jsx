import { alpha } from "@mui/system";

export const TabsTheme = ({ theme }) => {
  return {
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${theme.palette.divider}`,
          minHeight: "44px",
          "& .MuiTab-root": {
            textTransform: "none",
          },
        },
        indicator: {
          backgroundColor: theme.palette.primary.main,
          height: "3px",
          borderRadius: "3px 3px 0 0",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          minHeight: "44px",
          padding: "10px 16px",
          textTransform: "none",
          color: theme.palette.text.secondary,
          borderRadius: "10px 10px 0 0",
          transition: "color 0.2s ease, background-color 0.2s ease",
          "&.Mui-selected": {
            color: theme.palette.primary.main,
          },
          "&:hover": {
            color: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
          },
        },
      },
    },
    MuiTabPanel: {
      styleOverrides: {
        root: {
          padding: "16px 0px",
        },
      },
    },
  };
};
