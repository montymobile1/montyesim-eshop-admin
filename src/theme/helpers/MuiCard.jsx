export const CardTheme = ({ theme }) => {
  return {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: {
        borderRadius: "16px",
        border: `1px solid ${theme.palette.divider}`,
        boxShadow:
          "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -8px rgba(15, 23, 42, 0.08)",
      },
    },
  };
};
