import { styled } from "@mui/material";
import { brandFg } from "@/constants/theme";

export const UserTrigger = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: theme.palette.background.paper,
  padding: "6px 14px",
  borderRadius: 14,
  cursor: "pointer",
  transition: "0.2s ease",
  border: `1px solid ${theme.palette.mode === "dark" ? theme.palette.divider : "transparent"}`,

  [theme.breakpoints.down("md")]: {
    padding: "0px",
    gap: "8px",
    border: "none",
    background: "transparent",
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  [theme.breakpoints.down("sm")]: {
    minWidth: 40,
  },
}));

export const UserName = styled("span")(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.text.primary,
  fontFamily: "var(--font-sans)",
  whiteSpace: "nowrap",
  display: "inline-block",
  maxWidth: "130px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  [theme.breakpoints.down("xl")]: {
    maxWidth: "100px",
  },
}));

export const PopWrapper = styled("div")(({ theme }) => ({
  padding: "16px 18px",
  background: theme.palette.background.paper,
}));

export const UserRow = styled("div")(() => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "18px",
}));

export const MenuItemRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 500,

  "&:hover": {
    background: theme.palette.action.hover,
    borderRadius: 6,
  },
}));

export const LogoutButton = styled("button")(({ theme }) => ({
  width: "100%",
  marginTop: "18px",
  padding: "12px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",

  background: "transparent",
  color: brandFg(theme.palette.mode === "dark"),
  border: `2px solid ${theme.palette.primary.main}`,
  fontSize: "16px",
  fontWeight: 600,
  borderRadius: "6px",
  cursor: "pointer",
  transition: "0.2s",

  "&:hover": {
    background: theme.palette.primary.light,
  },
}));
