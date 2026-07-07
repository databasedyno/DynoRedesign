import { Box, IconButton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ApiKeyCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));

export const ApiKeyCardSubTitle = styled(Typography)(({ theme }) => ({
  paddingTop: "7px",
  fontSize: 14,
  color: theme.palette.text.primary,
  fontWeight: 500,
  lineHeight: "17px",
  fontFamily: "UrbanistMedium",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  "& .flag": {
    display: "inline-flex",
    alignItems: "center",
  },
  "& img": {
    display: "block",
    position: "relative",
  },
  [theme.breakpoints.down("md")]: {
    fontSize: 11,
    lineHeight: "13px",
  },
}));

export const ApiKeyCardBody = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 14,
}));

export const ApiKeyCardTopRow = styled(Box)(() => ({
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
}));

export const ApiKeyViewButton = styled(IconButton)(({ theme }) => ({
  border: `1px solid ${theme.palette.text.primary}`,
  borderRadius: 6,
  width: 40,
  height: 40,
  backgroundColor: theme.palette.background.paper,
  [theme.breakpoints.down("md")]: {
    width: 32,
    height: 32,
  },
  "& img": {
    width: 20,
    height: 14,
    [theme.breakpoints.down("md")]: {
      width: 14,
      height: 10,
    },
  },
}));

export const ApiKeyCopyButton = styled(IconButton)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  padding: "6px",
  borderRadius: "7px",
  border: `1px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.background.paper,
  cursor: "pointer",
  transition: "all 0.2s ease",
  "&:hover": {
    backgroundColor: theme.palette.primary.light,
  },
  "&:active": {
    transform: "scale(0.95)",
  },
  [theme.breakpoints.down("md")]: {
    width: "32px",
    height: "32px",
    padding: "6px",
  },
}));

export const ApiKeyDeleteButton = styled(IconButton)(({ theme }) => ({
  marginTop: "6px",
  border: `1px solid ${theme.palette.border.main}`,
  borderRadius: 6,
  width: 40,
  height: 40,
  backgroundColor: theme.palette.background.paper,
  [theme.breakpoints.down("md")]: {
    width: 32,
    height: 32,
  },
  "& img": {
    width: 16,
    height: 16,
    [theme.breakpoints.down("md")]: {
      width: 12,
      height: 12,
    },
  },
}));

export const ApiKeyCreatedText = styled(Typography)(({ theme }) => ({
  marginTop: "6px",
  color: theme.palette.text.secondary,
  display: "flex",
  alignItems: "center",
  gap: "7px",
  "& .created-on-text": {
    fontSize: 13,
    fontFamily: "UrbanistMedium",
  },
  [theme.breakpoints.down("md")]: {
    "& .created-on-text": {
      fontSize: 10,
    },
  },
}));

export const Tags = styled(Typography)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  backgroundColor: theme.palette.success.light,
  color: theme.palette.success.dark,
  padding: "4px 8px",
  borderRadius: 50,
  fontSize: 13,
  lineHeight: 1.54,
  fontWeight: 500,
  border: `1px solid ${theme.palette.success.main}`,
  textTransform: "capitalize",
  fontFamily: "UrbanistMedium",
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 1,
}));

// ApiDocsCardRoot
export const ApiDocsCardRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));

export const InfoText = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  color: theme.palette.text.primary,
  fontWeight: 500,
  lineHeight: "18px",
  fontFamily: "UrbanistMedium",
  [theme.breakpoints.down("md")]: {
    fontSize: "10px",
    lineHeight: "12px",
  },
}));

export const ApiDocumentationCardDescription = styled(Typography)(
  ({ theme }) => ({
    fontFamily: "UrbanistMedium",
    fontSize: 13,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    lineHeight: "16px",
    maxWidth: "309px",
    [theme.breakpoints.down("md")]: {
      fontSize: 10,
      lineHeight: "12px",
    },
  }),
);
