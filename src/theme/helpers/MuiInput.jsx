import { alpha } from "@mui/system";

export const InputTheme = ({ theme }) => {
  return {
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          backgroundColor: theme.palette.background.paper,
          borderRadius: "10px",
          transition: "box-shadow 0.2s ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.divider,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(theme.palette.primary.main, 0.4),
          },
          "&.Mui-focused": {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.primary.main,
            borderWidth: "1px",
          },
          "&.Mui-disabled": {
            backgroundColor: theme.palette.background.default,
          },
        },
        "& .MuiInputLabel-root": {
          fontWeight: 500,
        },
        "& .MuiInputLabel-root.Mui-focused": {
          fontWeight: 600,
        },
      },
      input: {
        color: theme.palette.text.secondary,
        "&:-webkit-autofill": {
          WebkitBoxShadow: "0 0 0px 1000px transparent inset !important",
          backgroundColor: "transparent !important",
          color: "inherit !important",
        },
      },
      paper: {
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.secondary,
      },
    },
  };
};
