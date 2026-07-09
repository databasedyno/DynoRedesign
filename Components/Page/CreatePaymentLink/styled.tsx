import { theme } from "@/styles/theme";
import styledEmotion from "@emotion/styled";
import { Box, IconButton, Switch, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const TabContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  background: theme.palette.primary.light,
  borderRadius: "50px",
  padding: theme.spacing(1),
  [theme.breakpoints.down("md")]: {
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.5),
  },
}));

export const TabItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => ({
  flex: 1,
  padding: theme.spacing(0.75, 1),
  borderRadius: "50px",
  background: active
    ? theme.palette.background.paper
    : theme.palette.primary.light,
  cursor: "pointer",
  "&:hover": {
    background: active
      ? theme.palette.background.paper
      : theme.palette.primary.light,
  },
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(1),
  },
  p: {
    fontSize: "20px",
    fontWeight: active ? 700 : 500,
    lineHeight: 1.2,
    color: theme.palette.text.primary,
    fontFamily: active ? "var(--font-sans)" : "var(--font-sans)",
    textTransform: "capitalize",
    textAlign: "center",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("md")]: {
      fontSize: "15px",
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "10px",
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  },
}));

export const TabContentContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 0, 0, 0),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(1.75, 0, 0),
    gap: theme.spacing(1.75),
  },
}));

export const PaymentSettingsLabel = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  "& img": {
    width: 14,
    height: 14,
  },
  "& span": {
    fontSize: "13px",
    fontWeight: 500,
    color: theme.palette.text.primary,
    lineHeight: "16px",
    fontFamily: "var(--font-sans)",
  },
  [theme.breakpoints.up("md")]: {
    gap: 8,
    "& img": {
      width: 16,
      height: 16,
    },
    "& span": {
      fontSize: "15px",
      lineHeight: "18px",
    },
  },
}));

export const ExpireTrigger = styled(Box, {
  shouldForwardProp: (prop) =>
    prop !== "error" &&
    prop !== "fullWidth" &&
    prop !== "isOpen" &&
    prop !== "isMobile",
})<{
  error?: boolean;
  fullWidth?: boolean;
  isOpen?: boolean;
  isMobile?: boolean;
}>(({ theme, error, fullWidth, isMobile }: any) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: isMobile ? "8px 12px" : "11px 14px",
  borderRadius: "6px",
  border: "1px solid",
  borderColor: error ? theme.palette.error.main : theme.palette.border.main,
  cursor: "pointer",
  background: theme.palette.background.paper,
  color: theme.palette.text.primary,
  width: fullWidth ? "100%" : "auto",
  height: isMobile ? "32px" : "40px",
  minHeight: isMobile ? "32px" : "40px",
  boxSizing: "border-box",
  transition: "all 0.3s ease",
  boxShadow: "rgba(16, 24, 40, 0.05) 0px 1px 2px 0px",
  fontFamily: "var(--font-sans)",
  position: "relative",
  "&:hover": {
    borderColor: error ? theme.palette.error.main : theme.palette.border.focus,
  },
  "&:focus": {
    outline: "none",
    borderColor: error ? theme.palette.error.main : theme.palette.border.focus,
  },
  "&::before": {
    content: '""',
    position: "absolute",
    right: isMobile ? "36px" : "40px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "1px",
    height: isMobile ? "16px" : "20px",
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "#E9ECF2",
    zIndex: 1,
    pointerEvents: "none",
  },
}));

export const ExpireText = styledEmotion.span<{ isMobile?: boolean }>(
  ({ isMobile }) => ({
    fontSize: isMobile ? "10px" : "13px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    color: theme.palette.text.primary,
    lineHeight: "1.5",
    textTransform: "capitalize",
  }),
);

export const ExpireDropdown = styled(Box)(({ theme }) => ({
  padding: "8px",
  background: theme.palette.background.paper,
  overflow: "auto",
  maxHeight: "200px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
}));

export const PaymentDetailsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  backgroundColor: theme.palette.secondary.light,
  padding: "16px",
  borderRadius: "6px",
}));

export const PaymentDetailsTitle = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  lineHeight: "1.2",
}));

export const Row = styled(Box)(() => ({
  display: "grid",
  gridTemplateColumns: "16px 120px 1fr",
  alignItems: "flex-start",
  columnGap: 8,
}));

export const LabelText = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  whiteSpace: "nowrap",
  fontSize: "13px",
  lineHeight: "1.2",
  [theme.breakpoints.down("md")]: {
    fontSize: "10px",
    lineHeight: "1.2",
  },
}));

export const Text = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  lineHeight: 1.2,
  letterSpacing: 0,
}));

export const ValueText = styled(Typography)(({ theme }) => ({
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  color: theme.palette.text.primary,
  wordBreak: "break-word",
  fontSize: "13px",
  lineHeight: "1.2",
  [theme.breakpoints.down("md")]: {
    fontSize: "10px",
    lineHeight: "1.2",
  },
}));

export const CloseIconButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: theme.spacing(1.5),
  right: theme.spacing(1.5),
  zIndex: 1,
  height: "40px",
  width: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  borderRadius: "50%",
  border: `1px solid ${theme.palette.border.main}`,
  backgroundColor: theme.palette.secondary.main,
  "&:hover": {
    backgroundColor: theme.palette.secondary.main,
  },
  [theme.breakpoints.down("sm")]: {
    height: "32px",
    width: "32px",
    top: theme.spacing(1),
    right: theme.spacing(1),
    "& img": {
      width: "12px",
      height: "12px",
    },
  },
}));

export const AppSwitch = styled(Switch)(({ theme }) => ({
  width: 45,
  height: 27,
  padding: 0,
  display: "flex",
  alignItems: "center",

  "& .MuiSwitch-switchBase": {
    padding: 3,
    transitionDuration: "200ms",
    "&.Mui-checked": {
      transform: "translateX(18px)",
      color: "#fff",
      "& + .MuiSwitch-track": {
        backgroundColor: theme.palette.primary.main,
        border: "1px solid #BDBDBD",
        opacity: 1,
      },
    },
  },

  "& .MuiSwitch-thumb": {
    width: 19,
    height: 19,
    backgroundColor: theme.palette.background.paper,
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
    borderRadius: "50%",
  },

  "& .MuiSwitch-track": {
    borderRadius: 63,
    backgroundColor: theme.palette.secondary.contrastText,
    border: "1px solid #BDBDBD",
    opacity: 1,
    boxSizing: "border-box",
  },
}));
