export const lightPaletteText = {
  primary: "rgb(17, 24, 39)",
  secondary: "rgb(107, 114, 128)",
  disabled: "rgb(149, 156, 169)",
};

export const contrastText = "rgb(255,255,255)";

// Brand colors live in src/theme/brand.css; read them at runtime so MUI and Tailwind stay in sync.
const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const getThemesConfig = () => ({
  default: {
    palette: {
      mode: "light",
      divider: "#e2e8f0",
      text: lightPaletteText,
      common: {
        black: "rgb(17, 24, 39)",
        white: "rgb(255, 255, 255)",
      },
      primary: {
        main: cssVar("--color-primary"),
        contrastText,
      },
      secondary: {
        main: cssVar("--color-secondary"),
        contrastText,
      },
      background: {
        paper: "#FFFFFF",
        default: "#f1f5f9",
        hover: "#f1f5f9",
      },
      error: {
        main: "#f44336",
        contrastText,
      },
    },
  },
});

export default getThemesConfig;
