import { Box, Card, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

export const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: "16px",
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border.main}`,
  boxShadow: "none !important",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
}));

export const CardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(2.5, 2.5, 0, 2.5),
  borderBottom: `1px solid ${theme.palette.border.main}`,
  gap: theme.spacing(2),
  position: "relative",
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(2, 2, 0, 2),
  },
}));

export const HeaderContent = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flex: 1,
  [theme.breakpoints.down("md")]: {
    gap: "6px",
  },
}));

export const HeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: "20px",
  fontWeight: 500,
  lineHeight: "1.2",
  letterSpacing: 0,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("md")]: {
    fontSize: "15px",
  },
}));

export const HeaderIcon = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: theme.palette.grey[100],
  color: theme.palette.text.secondary,
  "& svg": {
    fontSize: "20px",
  },
}));
export const CardBody = styled(Box)(({ theme }) => ({
  flex: 1,
}));

export const CardFooter = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.border.main}`,
  gap: theme.spacing(1.5),
}));

export const HeaderSubTitle = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: 0,
  color: theme.palette.text.secondary,
  fontFamily: "var(--font-sans)",
}));
