import { styled } from "@mui/material";

export const SelectorTrigger = styled("div")(({ theme }) => ({
  height: "40px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0px",
  padding: "11px 14px",
  borderRadius: "6px",
  border: "1px solid ",
  borderColor: theme?.palette?.border?.main,
  cursor: "pointer",
  background: theme.palette.background.paper,
  zIndex: 2,
  position: "relative",
  color: theme?.palette?.text?.primary,
  [theme.breakpoints.down("md")]: {
    minHeight: "44px",
    padding: "0px",
    gap: "4px",
    border: "none",
  },
}));

export const TriggerText = styled("span")(({ theme }) => ({
  fontWeight: 500,
  whiteSpace: "nowrap",
  fontSize: "15px",
  fontFamily: "var(--font-sans)",
  lineHeight: "100%",
  letterSpacing: 0,
  [theme.breakpoints.down("md")]: {
    fontSize: "13px",
    display: "inline-block",
    maxWidth: "34vw",
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "middle",
  },
}));

export const CompanyListWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginTop: "6px",
}));

export const CompanyItem = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active: boolean }>(
  ({ active, theme }) => ({
    display: "flex",
    justifyContent: "space-between",
    padding: "6px",
    borderRadius: "6px",
    cursor: "pointer",
    background: active ? theme.palette.primary.light : "transparent",
    transition: "0.2s ease-in-out",

    "&:hover": {
      background: theme.palette.mode === "dark" ? "rgba(129,140,248,0.10)" : "#eef2ff",
    },

    ".info": {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },

    ".name": {
      fontSize: "15px",
      fontWeight: 500,
      color: theme.palette.text.primary,
      [theme.breakpoints.down("md")]: {
        fontSize: "13px",
      },
    },

    ".email": {
      fontSize: "13px",
      color: theme.palette.text.secondary,
      [theme.breakpoints.down("md")]: {
        fontSize: "10px",
      },
    },
  })
);

export const ItemLeft = styled("div")(() => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
}));

export const ItemRight = styled("div", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active: boolean }>(
  ({ active, theme }) => ({
    background: active ? theme.palette.primary.light : "transparent",
    border: active ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.primary.main : "#fff"}` : `1px solid ${theme.palette.mode === "dark" ? "#2A2D42" : "#d1d5db"}`,
    display: "flex",
    width: "40px",
    height: "40px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "0.15s ease-in-out",

    "&:hover": {
      background: active ? theme.palette.primary.light : (theme.palette.mode === "dark" ? "rgba(129,140,248,0.08)" : "#f4f6f9"),
      borderColor: theme.palette.primary.main,

      "& img": {
        filter: "brightness(0) saturate(100%) invert(13%) sepia(94%) saturate(7151%) hue-rotate(240deg) brightness(101%) contrast(150%)",
      },
    },
    [theme.breakpoints.down("md")]: {
      width: "32px",
      height: "32px",
    },
  })
);
