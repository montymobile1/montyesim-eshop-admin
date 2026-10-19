import { alpha } from "@mui/system";

// Shared look for the floating and container surfaces: dialogs, menus,
// popovers, chips and icon buttons.
export const SurfacesTheme = ({ theme }) => {
  const floatingShadow = "0 16px 40px -12px rgba(15, 23, 42, 0.18)";

  return {
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: "12px",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: "16px",
          boxShadow: floatingShadow,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          fontSize: "1.125rem",
          padding: "20px 24px 12px",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: "12px 24px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: "12px 24px 20px",
          gap: "8px",
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          "&:not(.MuiBackdrop-invisible)": {
            backgroundColor: alpha(theme.palette.primary.main, 0.35),
            backdropFilter: "blur(2px)",
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          marginTop: "6px",
          borderRadius: "12px",
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: floatingShadow,
        },
        list: {
          padding: "4px",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          fontSize: "0.875rem",
          padding: "8px 12px",
          "&:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
          },
          "&.Mui-selected, &.Mui-selected:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: "12px",
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: floatingShadow,
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        inputRoot: {
          padding: "0px 8px",
        },
        paper: {
          marginTop: "6px",
          borderRadius: "12px",
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: floatingShadow,
        },
        listbox: {
          padding: "4px",
          "& .MuiAutocomplete-option": {
            borderRadius: "8px",
            fontSize: "0.875rem",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "0.75rem",
        },
        filled: {
          "&.MuiChip-colorDefault": {
            backgroundColor: alpha(theme.palette.primary.main, 0.06),
            color: theme.palette.text.primary,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: "10px",
          transition: "background-color 0.2s ease",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: theme.palette.divider,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
        },
        rounded: {
          borderRadius: "8px",
        },
      },
    },
  };
};
