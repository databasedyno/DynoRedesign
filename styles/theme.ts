import { createTheme } from "@mui/material";
import { BRAND_ACCENT, DARK } from "@/constants/theme";

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
      black: "#12131C",
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
      main: "#E9ECF2",
      focus: "#A3A6AC",
      success: "#1C993D",
      error: "#E8484A",
    },
    primary: {
      main: BRAND_ACCENT, //Dark Blue
      dark: "#000000",
      light: "#EEF2FF", //Light Blue
      contrastText: "#fff",
    },
    secondary: {
      main: "#f4f6fa", //background color
      dark: "#E9ECF2",
      light: "#F4F6FA",
      contrastText: "#D9D9D9",
    },
    text: {
      primary: "#18181B",
      secondary: "#71717A",
      // FIX (2026-07-10): raised from #A1A1AA (~2.3:1) for legible tertiary text
      disabled: "#73737C",
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
            color: "#fff",
            padding: "12px 30px",
            background: BRAND_ACCENT,
            fontWeight: 400,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: BRAND_ACCENT,
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: `${BRAND_ACCENT}88`,
              color: "#fff",
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
              background: "#12131C",
              "&:hover": {
                color: "#12131C",
                background: "#fff",
              },
            },
            "&.MuiButton-roundedWhite": {
              background: "#fff",
              color: "#12131C",
              "&:hover": {
                color: "#fff",
                background: "#12131C",
              },
            },
          },
        },
        {
          props: { variant: "pills" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: BRAND_ACCENT,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#fff",
              background: BRAND_ACCENT,
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: "#fff",
            background: BRAND_ACCENT,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: BRAND_ACCENT,
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: `${BRAND_ACCENT}99`,
              color: "#fff",
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
          color: "#1034A6",
          padding: "10px 15px",
          borderRadius: "20px",
          [tempTheme.breakpoints.down("md")]: {
            minWidth: "75px",
          },
          border: "1px solid ",
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
            background: "#F8F8F8",
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
          color: "#fff",
          padding: "12px 30px",
          background: BRAND_ACCENT,
          fontWeight: 400,
          borderRadius: "50px",
          textTransform: "none" as const,
          cursor: "pointer",
          "&:hover": {
            color: BRAND_ACCENT,
            background: isDark ? DARK.raised : "#fff",
          },
          "&.Mui-disabled": {
            background: `${BRAND_ACCENT}88`,
            color: "#fff",
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
            background: isDark ? DARK.active : "#12131C",
            "&:hover": {
              color: isDark ? "#fff" : "#12131C",
              background: isDark ? DARK.raised : "#fff",
            },
          },
          "&.MuiButton-roundedWhite": {
            background: isDark ? DARK.active : "#fff",
            color: isDark ? "#fff" : "#12131C",
            "&:hover": {
              color: isDark ? "#12131C" : "#fff",
              background: isDark ? "#fff" : "#12131C",
            },
          },
        },
      },
      {
        props: { variant: "pills" as const },
        style: {
          border: "1px solid",
          padding: "10px 30px",
          color: "#1034A6",
          fontWeight: 600,
          borderRadius: "15px",
          fontSize: "16px",
          "&:hover": {
            color: "#fff",
            background: BRAND_ACCENT,
          },
        },
      },
      {
        props: { variant: "bluepill" as const },
        style: {
          border: "1px solid",
          padding: "10px 30px",
          color: "#fff",
          background: BRAND_ACCENT,
          fontWeight: 600,
          borderRadius: "15px",
          fontSize: "16px",
          "&:hover": {
            color: BRAND_ACCENT,
            background: isDark ? DARK.raised : "#fff",
          },
          "&.Mui-disabled": {
            background: `${BRAND_ACCENT}99`,
            color: "#fff",
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
        color: "#1034A6",
        padding: "10px 15px",
        borderRadius: "20px",
        [tempTheme.breakpoints.down("md")]: {
          minWidth: "75px",
        },
        border: "1px solid ",
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
          background: isDark ? DARK.raised : "#F8F8F8",
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
          backgroundColor: isDark ? DARK.active : "#F5F8FF",
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
    common: { black: "#242428", white: "#fff" },
    primary: { main: BRAND_ACCENT, dark: "#4338CA", light: "#EEF2FF", contrastText: "#fff" },
    secondary: { main: BRAND_ACCENT, dark: "#4338CA", light: "#EEF2FF" },
    text: { primary: "#18181B", secondary: "#71717A" },
    background: { default: "#F4F6FA", paper: "#FFFFFF" },
    surface: { main: "#F4F6FA", paper: "#FFFFFF", border: "#E9ECF2" },
    // Mirror of `surface.border` so that components that use `palette.border.main`
    // (the convention used in the rest of the app's theme tokens) keep working
    // when rendered inside the /pay route's lightTheme.
    border: { main: "#E9ECF2", focus: BRAND_ACCENT, success: "#10B981", error: "#E8484A" },
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
    common: { black: "#242428", white: "#fff" },
    primary: { main: DARK.accent, dark: "#4F46E5", light: "#A5B4FC", contrastText: "#fff" },
    secondary: { main: DARK.accent, dark: "#4F46E5", light: "#A5B4FC" },
    text: { primary: DARK.text, secondary: DARK.textSecondary, disabled: DARK.textMuted },
    background: { default: DARK.canvas, paper: DARK.surface },
    surface: { main: DARK.canvas, paper: DARK.surface, border: DARK.border },
    border: { main: DARK.border, focus: DARK.accent, success: DARK.success, error: DARK.error },
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
      black: "#12131C",
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
      focus: DARK.accent,
      success: DARK.success,
      error: DARK.error,
    },
    divider: DARK.border,
    primary: {
      main: DARK.accent,
      dark: "#4F46E5",
      light: DARK.accentSoft,
      contrastText: "#FFFFFF",
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
            color: "#fff",
            padding: "12px 30px",
            background: BRAND_ACCENT,
            fontWeight: 400,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: BRAND_ACCENT,
              background: DARK.raised,
            },
            "&.Mui-disabled": {
              background: "rgba(79,70,229,0.53)",
              color: "#fff",
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
                color: "#12131C",
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
            color: BRAND_ACCENT,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#fff",
              background: BRAND_ACCENT,
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: "#fff",
            background: BRAND_ACCENT,
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: BRAND_ACCENT,
              background: DARK.raised,
            },
            "&.Mui-disabled": {
              background: "rgba(79,70,229,0.6)",
              color: "#fff",
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
          color: BRAND_ACCENT,
          padding: "10px 15px",
          borderRadius: "20px",
          border: "1px solid ",
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
            backgroundColor: "rgba(129,140,248,0.08)",
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: "#E2E8F0",
          "&:hover": {
            backgroundColor: "rgba(129,140,248,0.10)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(129,140,248,0.14)",
            color: "#E2E8F0",
            "&:hover": {
              backgroundColor: "rgba(129,140,248,0.18)",
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
