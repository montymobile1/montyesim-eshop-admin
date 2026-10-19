import { alpha } from "@mui/system";

export const ButtonTheme = ({ theme }) => {
  return {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        borderRadius: "10px",
        textTransform: "none",
        fontWeight: 600,
        padding: "8px 18px",
        transition: "all 0.2s ease",
      },
      sizeSmall: {
        padding: "5px 12px",
        fontSize: "0.8125rem",
      },
      sizeLarge: {
        padding: "11px 22px",
      },
      containedPrimary: {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        "&:hover": {
          backgroundColor: theme.palette.primary.main,
          boxShadow: `0 6px 16px -6px ${alpha(theme.palette.primary.main, 0.55)}`,
          transform: "translateY(-1px)",
        },
      },
      containedSecondary: {
        backgroundColor: theme.palette.secondary.main,
        color: theme.palette.secondary.contrastText,
        "&:hover": {
          backgroundColor: theme.palette.secondary.main,
          boxShadow: `0 6px 16px -6px ${alpha(theme.palette.secondary.main, 0.55)}`,
          transform: "translateY(-1px)",
        },
      },
      outlinedPrimary: {
        border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        color: theme.palette.primary.main,
        "&:hover": {
          border: `1px solid ${theme.palette.primary.main}`,
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
        },
      },
      outlinedSecondary: {
        border: `1px solid ${alpha(theme.palette.secondary.main, 0.4)}`,
        color: theme.palette.secondary.main,
        "&:hover": {
          border: `1px solid ${theme.palette.secondary.main}`,
          backgroundColor: alpha(theme.palette.secondary.main, 0.04),
        },
      },
      textPrimary: {
        color: theme.palette.primary.main,
        "&:hover": {
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
        },
      },
      textSecondary: {
        color: theme.palette.secondary.main,
        "&:hover": {
          backgroundColor: alpha(theme.palette.secondary.main, 0.06),
        },
      },
    },
  };
};
