import { Button, keyframes, styled, Theme } from "@mui/material";

/* ================= ANIMATION ================= */

export const bounceUpDown = keyframes`
  0%, 100% {
    transform: translate3d(0, 0, 0);
  }
  50% {
    transform: translate3d(0, -4px, 0);
  }
`;

/* ================= STYLED BUTTON ================= */

export const StyledHomeButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "intent",
})<{ intent?: "primary" | "outlined" }>(
  ({
    theme,
    intent = "primary",
  }: {
    theme: Theme;
    intent?: "primary" | "outlined";
  }) => {
    const isDark = theme.palette.mode === "dark";
    return {
      padding: "12px 32px",
      fontSize: "14px",
      maxHeight: 44,
      lineHeight: "20px",
      fontWeight: 500,
      fontFamily: "var(--font-sans)",
      borderRadius: 10,
      letterSpacing: 0,
      textTransform: "none" as const,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxShadow: "none",
      transition:
        "background-color 0.3s ease, color 0.3s ease, transform 0.2s ease",
      whiteSpace: "nowrap" as const,
      minWidth: 0,

      [theme.breakpoints.down("md")]: {
        padding: "10px 20px",
        fontSize: "13px",
        maxHeight: 40,
      },

      ...(intent === "primary"
        ? {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,

            "& .MuiSvgIcon-root": {
              animation: `${bounceUpDown} 1.5s ease-in-out infinite`,
              transition: "transform 0.3s ease",
            },

            "&:hover": {
              backgroundColor:
                (theme.palette.primary as any).hover || theme.palette.primary.dark,
              boxShadow: "none",

              "& .MuiSvgIcon-root": {
                animation: "none",
                transform: "translateX(4px)",
              },
            },

            "&:active": {
              backgroundColor: theme.palette.primary.dark,
              transform: "scale(0.97)",

              "& .MuiSvgIcon-root": {
                animation: "none",
                transform: "translateX(2px)",
              },
            },

            "&:disabled": {
              backgroundColor: theme.palette.action.disabledBackground,
              color: theme.palette.action.disabled,
            },
          }
        : {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(255,255,255,0.72)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: theme.palette.text.primary,
            border: `1px solid ${(theme.palette as any).border?.main || theme.palette.divider}`,

            "&:hover": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.09)"
                : "rgba(255,255,255,0.92)",
              borderColor: theme.palette.primary.main,
              boxShadow: "none",
            },

            "&:active": {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(255,255,255,0.72)",
            },

            "&:disabled": {
              backgroundColor: theme.palette.action.disabledBackground,
              color: theme.palette.action.disabled,
              borderColor: theme.palette.action.disabledBackground,
            },
          }),
    };
  },
);
