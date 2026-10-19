export const TooltipTheme = ({ theme }) => {
  return {
    defaultProps: {
      arrow: true,
    },
    styleOverrides: {
      tooltip: {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        fontSize: "0.75rem",
        fontWeight: 500,
        padding: "6px 10px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
      },
      arrow: {
        color: theme.palette.primary.main,
      },
    },
  };
};
