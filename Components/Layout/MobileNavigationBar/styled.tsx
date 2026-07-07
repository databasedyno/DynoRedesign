import { styled } from "@mui/material";
import { Box } from "@mui/material";

export const NavigationBarContainer = styled(Box)(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  padding: "0px 16px 8px",
  paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
  zIndex: 1000,
  background: "transparent",

}));

export const NavigationBar = styled(Box, {
  shouldForwardProp: (prop) => prop !== "expanded",
})<{ expanded?: boolean }>(
  ({ expanded, theme }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: expanded ? "16px" : "6px",
    background: theme.palette.primary.light,
    borderRadius: expanded ? "30px" : "50px",
    padding: expanded ? "20px" : "8px",
    maxWidth: "100%",
    pointerEvents: "auto",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    maxHeight: expanded ? "500px" : "100px",
    transitionProperty: "background, border-radius, padding, gap, max-height",
    border: `1px solid ${theme.palette.border.main}`,
  })
);

export const NavItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active" && prop !== "isSecondRow",
})<{ active?: boolean; isSecondRow?: boolean }>(
  ({ active, theme, isSecondRow }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    cursor: "pointer",
    padding: "0",
    minWidth: "60px",
    transition: "all 0.2s ease",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    "&:active": {
      backgroundColor: "transparent",
    },
    "&:focus": {
      outline: "none",
    },
    ...(isSecondRow && {
      gridColumn: "span 1",
    }),
  })
);

export const IconButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background:
      theme.palette.mode === "dark"
        ? active
          ? "rgba(204, 255, 0, 0.22)"
          : "#2A2D42"
        : theme.palette.common.white,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 2px 4px rgba(0, 0, 0, 0.35)"
        : "0 2px 4px rgba(0, 0, 0, 0.1)",
    transition: "all 0.2s ease",
    "& img": {
      filter: active
        ? "brightness(0) saturate(100%) invert(13%) sepia(94%) saturate(7151%) hue-rotate(240deg) brightness(101%) contrast(150%)"
        : theme.palette.mode === "dark"
          ? "brightness(0) saturate(100%) invert(85%) sepia(0%) saturate(0%) brightness(105%) contrast(85%)"
          : "brightness(0) saturate(100%) invert(0%)",
    },
    "& svg": {
      color: active ? theme.palette.primary.main : theme.palette.text.primary,
      fontSize: "24px",
    },
  })
);

export const NavLabel = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ active, theme }) => ({
    fontSize: "13px",
    fontFamily: "UrbanistMedium",
    fontWeight: 500,
    color: active ? theme.palette.primary.main : theme.palette.text.primary,
    textAlign: "center",
    lineHeight: 1.2,
  })
);

export const MainNavRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== "expanded",
})<{ expanded?: boolean }>(
  ({ expanded }) => ({
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  })
);

export const FirstRow = styled(Box)({
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "8px",
  width: "100%",
  alignItems: "center",
  justifyContent: "center",
});

export const SecondRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
});

export const MenuRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  flexWrap: "wrap",
  width: "100%",
});

export const ExpandedContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isExpanding",
})<{ isExpanding?: boolean }>(
  ({ isExpanding }) => ({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "fit-content",
    opacity: isExpanding ? 1 : 0,
    transform: isExpanding ? "translateY(0)" : "translateY(-10px)",
    maxHeight: isExpanding ? "400px" : "0",
    marginTop: isExpanding ? "0" : "-8px",
    overflow: "hidden",
    transition:
      "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    pointerEvents: isExpanding ? "auto" : "none",
  })
);

export const AlertBanner = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: theme.palette.common.white,
  borderRadius: "40px",
  padding: "10px 15px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  outline: `1px solid ${theme.palette.border.main}`,
}));

export const AlertIcon = styled(Box)(({ theme }) => ({
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: theme.palette.error.main,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  "& svg": {
    color: theme.palette.common.white,
    fontSize: "16px",
  },
}));

export const AlertText = styled(Box)(({ theme }) => ({
  fontSize: "13px",
  fontFamily: "UrbanistMedium",
  fontWeight: 500,
  color: theme.palette.error.main,
  flex: 1,
}));
