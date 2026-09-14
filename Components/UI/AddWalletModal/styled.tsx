import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ModalHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(0.5),
}));

export const ModalHeaderContent = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.5),
}));

export const ModalSubtitle = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

export const WarningContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "rgba(204, 255, 0, 0.1)" : theme.palette.primary.light,
  padding: theme.spacing(1),
  borderRadius: "7px",
  border: `1px solid ${theme.palette.border.main}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: theme.spacing(1.5),
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(1, "14px"),
  },
}));

export const WarningIconContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  marginTop: "2px",
});

export const WarningContent = styled(Box)(({ theme }) => ({
  flex: 1,
  "& > p": {
    maxWidth: "300px",
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    lineHeight: "15px",
    color: theme.palette.text.primary,
    [theme.breakpoints.down("md")]: {
      fontSize: "10px",
      lineHeight: "12px",
    },
  },
}));

export const ModalActions = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    "& > *": {
      width: "100%",
    },
  },
}));
