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
    primary: {
      main: "#12131C",
      dark: "#000000",
      light: "#383943",
      contrastText: "#fff",
    },
    secondary: {
      main: "#1034A6",
      dark: "#001076",
      light: "#585ed8",
    },
    text: {
      primary: "#12131C",
      secondary: "#1034A6",
    },
  },
  typography: {
    allVariants: {
      fontFamily: "var(--font-sans), 'Manrope', sans-serif",
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
            background: "#1034A6",
            fontWeight: 400,
            borderRadius: "50px",
            textTransform: "none",
            cursor: "pointer",
            "&:hover": {
              color: "#1034A6",
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: "#1034A688",
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
            color: "#1034A6",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#fff",
              background: "#1034A6",
            },
          },
        },
        {
          props: { variant: "bluepill" },
          style: {
            border: "1px solid",
            padding: "10px 30px",
            color: "#fff",
            background: "#1034A6",
            fontWeight: 600,
            borderRadius: "15px",
            fontSize: "16px",
            "&:hover": {
              color: "#1034A6",
              background: "#fff",
            },
            "&.Mui-disabled": {
              background: "#1034A699",
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
