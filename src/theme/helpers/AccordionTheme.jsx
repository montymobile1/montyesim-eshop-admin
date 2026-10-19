export const AccordionTheme = ({ theme }) => {
  return {
    MuiAccordion: {
      defaultProps: {
        elevation: 0,
        disableGutters: true,
      },
      styleOverrides: {
        root: {
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          borderRadius: "12px",
          overflow: "hidden",
          marginTop: "10px",
          "&:first-of-type, &:last-of-type": {
            borderRadius: "12px",
          },
          ".Mui-disabled": {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.disabled,
          },
          "&::before": {
            display: "none",
          },

          "@media (max-width:400px)": {
            marginTop: "20px",
            width: "100%",
            margin: "auto",
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          background: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          padding: "2px 16px",
          minHeight: "48px",
          "@media (max-width:900px)": {
            padding: "2px 12px",
          },
          "& .MuiAccordionSummary-expandIconWrapper": {
            color: theme.palette.primary.contrastText,
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: "16px",
        },
      },
    },
  };
};
