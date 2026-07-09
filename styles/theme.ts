import { createTheme } from "@mui/material";

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
export const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
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
      main: "#4F46E5", //Dark Blue
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
      disabled: "#A1A1AA",
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
            background: "#4F46E5",
            fontWeight: 400,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: "#4F46E5",
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: "#4F46E588",
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
            color: "#4F46E5",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#fff",
              background: "#4F46E5",
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: "#fff",
            background: "#4F46E5",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#4F46E5",
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: "#4F46E599",
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
          background: "#4F46E5",
          fontWeight: 400,
          borderRadius: "50px",
          textTransform: "none" as const,
          cursor: "pointer",
          "&:hover": {
            color: "#4F46E5",
            background: isDark ? "#1a1a2e" : "#fff",
          },
          "&.Mui-disabled": {
            background: "#4F46E588",
            color: "#fff",
            pointerEvents: "auto" as const,
            cursor: "not-allowed",
          },
          "&.MuiButton-roundedSuccess": {
            background: "#2e7d32",
            "&:hover": {
              color: "#2e7d32",
              background: isDark ? "#1a1a2e" : "#fff",
            },
          },
          "&.MuiButton-roundedError": {
            background: "#d32f2f",
            "&:hover": {
              color: "#d32f2f",
              background: isDark ? "#1a1a2e" : "#fff",
            },
          },
          "&.MuiButton-roundedSecondary": {
            background: isDark ? "#2a2a4a" : "#12131C",
            "&:hover": {
              color: isDark ? "#fff" : "#12131C",
              background: isDark ? "#1a1a2e" : "#fff",
            },
          },
          "&.MuiButton-roundedWhite": {
            background: isDark ? "#2a2a4a" : "#fff",
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
            background: "#4F46E5",
          },
        },
      },
      {
        props: { variant: "bluepill" as const },
        style: {
          border: "1px solid",
          padding: "10px 30px",
          color: "#fff",
          background: "#4F46E5",
          fontWeight: 600,
          borderRadius: "15px",
          fontSize: "16px",
          "&:hover": {
            color: "#4F46E5",
            background: isDark ? "#1a1a2e" : "#fff",
          },
          "&.Mui-disabled": {
            background: "#4F46E599",
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
          background: isDark ? "#1a1a2e" : "#F8F8F8",
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
        backgroundColor: isDark ? "#1a1a2e" : "#fff",
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        "&:hover": {
          backgroundColor: isDark ? "#2a2a4a" : "#F5F8FF",
        },
      },
    },
  },
});

export const lightTheme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1600 },
  },
  palette: {
    mode: "light",
    common: { black: "#242428", white: "#fff" },
    primary: { main: "#4F46E5", dark: "#4338CA", light: "#EEF2FF", contrastText: "#fff" },
    secondary: { main: "#4F46E5", dark: "#4338CA", light: "#EEF2FF" },
    text: { primary: "#18181B", secondary: "#71717A" },
    background: { default: "#F4F6FA", paper: "#FFFFFF" },
    surface: { main: "#F4F6FA", paper: "#FFFFFF", border: "#E9ECF2" },
    // Mirror of `surface.border` so that components that use `palette.border.main`
    // (the convention used in the rest of the app's theme tokens) keep working
    // when rendered inside the /pay route's lightTheme.
    border: { main: "#E9ECF2", focus: "#4F46E5", success: "#10B981", error: "#E8484A" },
  },
  typography: {
    fontFamily: "var(--font-sans), 'Manrope', sans-serif",
    allVariants: { fontFamily: "var(--font-sans), 'Manrope', sans-serif" },
  },
  components: getCheckoutComponentStyles(false),
});

export const darkTheme = createTheme({
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1600 },
  },
  palette: {
    mode: "dark",
    common: { black: "#242428", white: "#fff" },
    primary: { main: "#6C7BFF", dark: "#4A5AE8", light: "#8E9AFF", contrastText: "#fff" },
    secondary: { main: "#6C7BFF", dark: "#4A5AE8", light: "#8E9AFF" },
    text: { primary: "#FFFFFF", secondary: "#B0B8FF" },
    background: { default: "#0d0d1a", paper: "#1a1a2e" },
    surface: { main: "#0d0d1a", paper: "#1a1a2e", border: "#2a2a4a" },
    border: { main: "#2a2a4a", focus: "#6C7BFF", success: "#10B981", error: "#E8484A" },
  },
  typography: {
    fontFamily: "var(--font-sans), 'Manrope', sans-serif",
    allVariants: { fontFamily: "var(--font-sans), 'Manrope', sans-serif" },
  },
  components: getCheckoutComponentStyles(true),
});


// ─── Dark variant of the MAIN app theme (dashboard, etc.) ───────────
export const themeDark = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
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
      main: "#1B3A26",
      dark: "#47B464",
      light: "#1B3A26",
    },
    error: {
      main: "#E8484A",
    },
    border: {
      main: "#2A2D42",
      focus: "#6A6D80",
      success: "#1C993D",
      error: "#E8484A",
    },
    primary: {
      main: "#CCFF00",
      dark: "#FFFFFF",
      light: "#1A1F3D",
      contrastText: "#fff",
    },
    secondary: {
      main: "#141625",
      dark: "#2A2D42",
      light: "#1A1D30",
      contrastText: "#3A3D52",
    },
    text: {
      primary: "#FAFAFA",
      secondary: "#A1A1AA",
      disabled: "#52525B",
    },
    background: {
      default: "#0B0D17",
      paper: "#141625",
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
            background: "#CCFF00",
            fontWeight: 400,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: "#CCFF00",
              background: "#1a1a2e",
            },
            "&.Mui-disabled": {
              background: "#CCFF0088",
              color: "#fff",
              pointerEvents: "auto",
              cursor: "not-allowed",
            },
            "&.MuiButton-roundedSuccess": {
              background: "#2e7d32",
              "&:hover": {
                color: "#2e7d32",
                background: "#1a1a2e",
              },
            },
            "&.MuiButton-roundedError": {
              background: "#d32f2f",
              "&:hover": {
                color: "#d32f2f",
                background: "#1a1a2e",
              },
            },
            "&.MuiButton-roundedSecondary": {
              background: "#2a2a4a",
              "&:hover": {
                color: "#fff",
                background: "#1a1a2e",
              },
            },
            "&.MuiButton-roundedWhite": {
              background: "#2a2a4a",
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
            color: "#CCFF00",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#fff",
              background: "#CCFF00",
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: "#fff",
            background: "#CCFF00",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#CCFF00",
              background: "#1a1a2e",
            },
            "&.Mui-disabled": {
              background: "#CCFF0099",
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
            color: "#A0A1A5",
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
          color: "#CCFF00",
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
            background: "#1a1a2e",
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
          color: "#E8E8EC",
          borderBottomColor: "#2A2D42",
        },
        head: {
          color: "#A0A1A5",
          fontWeight: 600,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: "rgba(204,255,0,0.06)",
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: "#E8E8EC",
          "&:hover": {
            backgroundColor: "rgba(204,255,0,0.08)",
          },
          "&.Mui-selected": {
            backgroundColor: "rgba(204,255,0,0.12)",
            color: "#E8E8EC",
            "&:hover": {
              backgroundColor: "rgba(204,255,0,0.16)",
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "#2A2D42",
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          color: "#E8E8EC",
        },
        secondary: {
          color: "#A0A1A5",
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
          backgroundColor: "#141625",
        },
      },
    },
  },
});
