import { createTheme } from "@mui/material";
import { GOLD, GOLD_DEEP, BRAND_ACCENT, BRAND_ON_ACCENT, DARK, LIGHT } from "@/constants/theme";

declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    rounded: true;
    pills: true;
    bluepill: true;
  }
  interface ButtonPropsColorOverrides {
    white: true;
  }
}

declare module "@mui/material/styles" {
  interface Palette {
    border: {
      focus: any;
      main: string;
      success: string;
      error: string;
    };
    surface?: {
      main: string;
      paper: string;
      border: string;
    };
  }
  interface PaletteOptions {
    border?: {
      main?: string;
      focus?: string;
      success?: string;
      error?: string;
    };
    surface?: {
      main?: string;
      paper?: string;
      border?: string;
    };
  }
}

export const toolbarHeight = 70;
export const drawerWidth = 64;

const tempTheme = createTheme();

// UX plan 4.2 — one motion scale for every MUI component (Paper/Chip/Switch/Tabs/Drawer…):
// micro-interactions 150–250ms, ease-out. Anything longer must be an explicit data animation.
const appTransitions = {
  duration: { shortest: 120, shorter: 160, short: 200, standard: 250, complex: 250, enteringScreen: 225, leavingScreen: 195 },
  easing: {
    easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    easeIn: "cubic-bezier(0.4, 0, 1, 1)",
    sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
  },
};
export const theme = createTheme({
  transitions: appTransitions,
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1024,
      xl: 1600,
    },
  },
  palette: {
    common: {
      black: "#0A0A0D",
      white: "#fff",
    },
    success: {
      main: "#EAFFF0",
      dark: "#47B464",
      light: "#DCF6E4",
    },
    error: {
      main: "#E8484A",
    },
    border: {
      main: LIGHT.border,
      focus: GOLD_DEEP,
      success: "#1C993D",
      error: "#E8484A",
    },
    primary: {
      main: BRAND_ACCENT, // signal yellow — always with dark-brown text
      dark: "#F0C300",
      light: LIGHT.accentSoft,
      contrastText: BRAND_ON_ACCENT,
    },
    secondary: {
      main: LIGHT.raised, //background color
      dark: LIGHT.border,
      light: LIGHT.canvas,
      contrastText: LIGHT.textSecondary,
    },
    text: {
      primary: LIGHT.text,
      secondary: LIGHT.textSecondary,
      disabled: LIGHT.textMuted,
    },
  },
  typography: {
    fontFamily: "var(--font-sans), 'Manrope', sans-serif",
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "48px",
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "40px",
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "32px",
      lineHeight: 1.25,
      letterSpacing: "-0.015em",
    },
    h4: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "28px",
      lineHeight: 1.3,
    },
    h5: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "22px",
      lineHeight: 1.35,
    },
    h6: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "18px",
      lineHeight: 1.4,
    },
    subtitle1: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 500,
      fontSize: "16px",
      lineHeight: 1.5,
    },
    subtitle2: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "14px",
      lineHeight: 1.45,
    },
    body1: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 400,
      fontSize: "16px",
      lineHeight: 1.6,
    },
    body2: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 400,
      fontSize: "14px",
      lineHeight: 1.6,
    },
    button: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "16px",
      lineHeight: 1.2,
      textTransform: "none",
    },
    caption: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 500,
      fontSize: "12px",
      lineHeight: 1.4,
    },
    overline: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "11px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          lineHeight: 1,
        },
      },
      variants: [
        {
          props: { variant: "contained" },
          style: {
            padding: "12px 24px",
          },
        },
        {
          props: { variant: "rounded" },
          style: {
            border: "1px solid transparent",
            color: BRAND_ON_ACCENT,
            padding: "12px 30px",
            background: BRAND_ACCENT,
            fontWeight: 600,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: BRAND_ON_ACCENT,
              background: "#F0C300",
            },
            "&.Mui-disabled": {
              background: `${BRAND_ACCENT}88`,
              color: BRAND_ON_ACCENT,
              pointerEvents: "auto",
              cursor: "not-allowed",
            },
            "&.MuiButton-roundedSuccess": {
              background: "#2e7d32",
              "&:hover": {
                color: "#2e7d32",
                background: "#fff",
              },
            },
            "&.MuiButton-roundedError": {
              background: "#d32f2f",
              "&:hover": {
                color: "#d32f2f",
                background: "#fff",
              },
            },
            "&.MuiButton-roundedSecondary": {
              background: "#121214",
              "&:hover": {
                color: "#121214",
                background: "#fff",
              },
            },
            "&.MuiButton-roundedWhite": {
              background: "#fff",
              color: "#121214",
              "&:hover": {
                color: "#fff",
                background: "#121214",
              },
            },
          },
        },
        {
          props: { variant: "pills" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: GOLD_DEEP,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: BRAND_ON_ACCENT,
              background: BRAND_ACCENT,
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: BRAND_ON_ACCENT,
            background: BRAND_ACCENT,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: BRAND_ON_ACCENT,
              background: "#F0C300",
            },
            "&.Mui-disabled": {
              background: `${BRAND_ACCENT}88`,
              color: BRAND_ON_ACCENT,
            },
          },
        },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            cursor: "not-allowed",
            pointerEvents: "auto",
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: "20px",
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        MenuProps: {
          PaperProps: {
            sx: {
              maxHeight: "270px",
            },
          },
        },
      },
      styleOverrides: {
        outlined: {
          padding: "10px 15px",
          borderRadius: "20px",
          [tempTheme.breakpoints.down("md")]: {
            minWidth: "75px",
          },
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: `${toolbarHeight}px !important`,
          alignItems: "center",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "30px",
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            background: "#E9ECF0",
          },

          borderRadius: "20px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "& .MuiChip-label": {
            paddingLeft: "4px",
            paddingRight: "8px",
          },
        },
      },
    },
  },
});


// ─── Checkout Page Themes (Light / Dark) ────────────────────────────
const getCheckoutComponentStyles = (isDark: boolean) => ({
  MuiButton: {
    styleOverrides: {
      root: {
        lineHeight: 1,
      },
    },
    variants: [
      {
        props: { variant: "contained" as const },
        style: {
          padding: "12px 24px",
        },
      },
      {
        props: { variant: "rounded" as const },
        style: {
          border: "1px solid",
          color: BRAND_ON_ACCENT,
          padding: "12px 30px",
          background: BRAND_ACCENT,
          fontWeight: 400,
          borderRadius: "50px",
          textTransform: "none" as const,
          cursor: "pointer",
          "&:hover": {
            color: BRAND_ON_ACCENT,
            background: "#F0C300",
          },
          "&.Mui-disabled": {
            background: `${BRAND_ACCENT}88`,
            color: BRAND_ON_ACCENT,
            pointerEvents: "auto" as const,
            cursor: "not-allowed",
          },
          "&.MuiButton-roundedSuccess": {
            background: "#2e7d32",
            "&:hover": {
              color: "#2e7d32",
              background: isDark ? DARK.raised : "#fff",
            },
          },
          "&.MuiButton-roundedError": {
            background: "#d32f2f",
            "&:hover": {
              color: "#d32f2f",
              background: isDark ? DARK.raised : "#fff",
            },
          },
          "&.MuiButton-roundedSecondary": {
            background: isDark ? DARK.active : "#121214",
            "&:hover": {
              color: isDark ? "#fff" : "#121214",
              background: isDark ? DARK.raised : "#fff",
            },
          },
          "&.MuiButton-roundedWhite": {
            background: isDark ? DARK.active : "#fff",
            color: isDark ? "#fff" : "#121214",
            "&:hover": {
              color: isDark ? "#121214" : "#fff",
              background: isDark ? "#fff" : "#121214",
            },
          },
        },
      },
      {
        props: { variant: "pills" as const },
        style: {
          border: "1px solid",
          padding: "10px 30px",
          color: GOLD_DEEP,
          fontWeight: 600,
          borderRadius: "15px",
          fontSize: "16px",
          "&:hover": {
            color: BRAND_ON_ACCENT,
            background: BRAND_ACCENT,
          },
        },
      },
      {
        props: { variant: "bluepill" as const },
        style: {
          border: "1px solid",
          padding: "10px 30px",
          color: BRAND_ON_ACCENT,
          background: BRAND_ACCENT,
          fontWeight: 600,
          borderRadius: "15px",
          fontSize: "16px",
          "&:hover": {
            color: BRAND_ON_ACCENT,
            background: "#F0C300",
          },
          "&.Mui-disabled": {
            background: `${BRAND_ACCENT}88`,
            color: BRAND_ON_ACCENT,
          },
        },
      },
    ],
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        "&.Mui-disabled": {
          cursor: "not-allowed",
          pointerEvents: "auto" as const,
        },
      },
    },
  },
  MuiInputBase: {
    styleOverrides: {
      root: {
        borderRadius: "20px !important",
      },
    },
  },
  MuiSelect: {
    defaultProps: {
      MenuProps: {
        PaperProps: {
          sx: {
            maxHeight: "270px",
          },
        },
      },
    },
    styleOverrides: {
      outlined: {
        padding: "10px 15px",
        borderRadius: "20px",
        [tempTheme.breakpoints.down("md")]: {
          minWidth: "75px",
        },
      },
    },
  },
  MuiToolbar: {
    styleOverrides: {
      root: {
        minHeight: `${toolbarHeight}px !important`,
        alignItems: "center",
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontSize: "30px",
        fontWeight: 600,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          background: isDark ? DARK.raised : "#E9ECF0",
        },
        borderRadius: "20px",
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        "& .MuiChip-label": {
          paddingLeft: "4px",
          paddingRight: "8px",
        },
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        backgroundColor: isDark ? DARK.raised : "#fff",
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        "&:hover": {
          backgroundColor: isDark ? DARK.active : "#FFF6CC",
        },
      },
    },
  },
});

export const lightTheme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1024, xl: 1600 },
  },
  palette: {
    mode: "light",
    common: { black: "#0A0A0D", white: "#fff" },
    primary: { main: BRAND_ACCENT, dark: "#F0C300", light: LIGHT.accentSoft, contrastText: BRAND_ON_ACCENT },
    secondary: { main: GOLD_DEEP, dark: "#6B4800", light: "#FFF6CC", contrastText: "#fff" },
    text: { primary: LIGHT.text, secondary: LIGHT.textSecondary },
    background: { default: LIGHT.canvas, paper: LIGHT.surface },
    surface: { main: LIGHT.canvas, paper: LIGHT.surface, border: LIGHT.border },
    // Mirror of `surface.border` so that components that use `palette.border.main`
    // (the convention used in the rest of the app's theme tokens) keep working
    // when rendered inside the /pay route's lightTheme.
    border: { main: LIGHT.border, focus: GOLD_DEEP, success: "#10B981", error: "#E8484A" },
  },
  typography: {
    fontFamily: "var(--font-sans), 'Manrope', sans-serif",
    allVariants: { fontFamily: "var(--font-sans), 'Manrope', sans-serif" },
  },
  components: getCheckoutComponentStyles(false),
});

export const darkTheme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1024, xl: 1600 },
  },
  palette: {
    mode: "dark",
    common: { black: "#0A0A0D", white: "#fff" },
    primary: { main: DARK.accent, dark: "#F0C300", light: DARK.accentSoft, contrastText: BRAND_ON_ACCENT },
    secondary: { main: GOLD, dark: GOLD_DEEP, light: "rgba(255,209,0,0.16)", contrastText: "#0A0A0D" },
    text: { primary: DARK.text, secondary: DARK.textSecondary, disabled: DARK.textMuted },
    background: { default: DARK.canvas, paper: DARK.surface },
    surface: { main: DARK.canvas, paper: DARK.surface, border: DARK.border },
    border: { main: DARK.border, focus: GOLD, success: DARK.success, error: DARK.error },
    divider: DARK.border,
  },
  typography: {
    fontFamily: "var(--font-sans), 'Manrope', sans-serif",
    allVariants: { fontFamily: "var(--font-sans), 'Manrope', sans-serif" },
  },
  components: getCheckoutComponentStyles(true),
});


// ─── Dark variant of the MAIN app theme (dashboard, etc.) ───────────
export const themeDark = createTheme({
  transitions: appTransitions,
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1024,
      xl: 1600,
    },
  },
  palette: {
    mode: "dark",
    common: {
      black: "#0A0A0D",
      white: "#fff",
    },
    success: {
      main: "#12301F",
      dark: DARK.success,
      light: "#12301F",
    },
    error: {
      main: DARK.error,
    },
    warning: {
      main: DARK.warning,
    },
    border: {
      main: DARK.border,
      focus: GOLD,
      success: DARK.success,
      error: DARK.error,
    },
    divider: DARK.border,
    primary: {
      main: DARK.accent,
      dark: "#F0C300",
      light: DARK.accentSoft,
      contrastText: BRAND_ON_ACCENT,
    },
    secondary: {
      main: DARK.canvas,
      dark: DARK.border,
      light: DARK.raised,
      contrastText: DARK.textSecondary,
    },
    text: {
      primary: DARK.text,
      secondary: DARK.textSecondary,
      disabled: DARK.textMuted,
    },
    background: {
      default: DARK.canvas,
      paper: DARK.surface,
    },
  },
  typography: {
    fontFamily: "var(--font-sans), 'Manrope', sans-serif",
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "48px",
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "40px",
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "32px",
      lineHeight: 1.25,
      letterSpacing: "-0.015em",
    },
    h4: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "28px",
      lineHeight: 1.3,
    },
    h5: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "22px",
      lineHeight: 1.35,
    },
    h6: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "18px",
      lineHeight: 1.4,
    },
    subtitle1: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 500,
      fontSize: "16px",
      lineHeight: 1.5,
    },
    subtitle2: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "14px",
      lineHeight: 1.45,
    },
    body1: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 400,
      fontSize: "16px",
      lineHeight: 1.6,
    },
    body2: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 400,
      fontSize: "14px",
      lineHeight: 1.6,
    },
    button: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 600,
      fontSize: "16px",
      lineHeight: 1.2,
      textTransform: "none",
    },
    caption: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 500,
      fontSize: "12px",
      lineHeight: 1.4,
    },
    overline: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
      fontWeight: 700,
      fontSize: "11px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          lineHeight: 1,
        },
      },
      variants: [
        {
          props: { variant: "contained" },
          style: {
            padding: "12px 24px",
          },
        },
        {
          props: { variant: "rounded" },
          style: {
            border: "1px solid",
            color: BRAND_ON_ACCENT,
            padding: "12px 30px",
            background: BRAND_ACCENT,
            fontWeight: 400,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: BRAND_ON_ACCENT,
              background: "#F0C300",
            },
            "&.Mui-disabled": {
              background: `${BRAND_ACCENT}88`,
              color: BRAND_ON_ACCENT,
              pointerEvents: "auto",
              cursor: "not-allowed",
            },
            "&.MuiButton-roundedSuccess": {
              background: "#2e7d32",
              "&:hover": {
                color: "#2e7d32",
                background: DARK.raised,
              },
            },
            "&.MuiButton-roundedError": {
              background: "#d32f2f",
              "&:hover": {
                color: "#d32f2f",
                background: DARK.raised,
              },
            },
            "&.MuiButton-roundedSecondary": {
              background: DARK.active,
              "&:hover": {
                color: "#fff",
                background: DARK.raised,
              },
            },
            "&.MuiButton-roundedWhite": {
              background: DARK.active,
              color: "#fff",
              "&:hover": {
                color: "#121214",
                background: "#fff",
              },
            },
          },
        },
        {
          props: { variant: "pills" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: GOLD,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: BRAND_ON_ACCENT,
              background: BRAND_ACCENT,
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: BRAND_ON_ACCENT,
            background: BRAND_ACCENT,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: BRAND_ON_ACCENT,
              background: "#F0C300",
            },
            "&.Mui-disabled": {
              background: `${BRAND_ACCENT}88`,
              color: BRAND_ON_ACCENT,
            },
          },
        },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            cursor: "not-allowed",
            pointerEvents: "auto",
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: "20px",
        },
        input: {
          "&::placeholder": {
            color: DARK.textSecondary,
            opacity: 1,
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        MenuProps: {
          PaperProps: {
            sx: {
              maxHeight: "270px",
            },
          },
        },
      },
      styleOverrides: {
        outlined: {
          padding: "10px 15px",
          borderRadius: "20px",
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: `${toolbarHeight}px !important`,
          alignItems: "center",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "30px",
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            background: DARK.raised,
          },
          borderRadius: "20px",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "& .MuiChip-label": {
            paddingLeft: "4px",
            paddingRight: "8px",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          color: "#E2E8F0",
          borderBottomColor: DARK.border,
        },
        head: {
          color: DARK.textSecondary,
          fontWeight: 600,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "rgba(255,209,0,0.08)",
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: "#E2E8F0",
          "&:hover": {
            backgroundColor: "rgba(255,209,0,0.10)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(255,209,0,0.14)",
            color: "#E2E8F0",
            "&:hover": {
              backgroundColor: "rgba(255,209,0,0.18)",
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: DARK.border,
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: "#E2E8F0",
        },
        secondary: {
          color: DARK.textSecondary,
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          color: "inherit",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: DARK.surface,
          border: `1px solid ${DARK.border}`,
        },
      },
    },
  },
});
