import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const PercentageChip = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: 4,
  backgroundColor: theme.palette.success.light,
  color: theme.palette.border.success,
  padding: "6px 8px",
  borderRadius: 50,
  fontSize: 13,
  lineHeight: 1.54,
  fontWeight: 500,
  border: `1px solid ${theme.palette.success.main}`,
  fontFamily: "UrbanistMedium",
  width: "fit-content",
  [theme.breakpoints.down("md")]: {
    gap: 2,
  },
}));

export const PremiumTierCard = styled(Box)(({ theme }) => ({
  position: "relative",
  border: `1px solid ${theme.palette.border.main}`,
  borderRadius: "6px",
  background: theme.palette.secondary.light,
  padding: theme.spacing(3),
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing("14px"),
  },
  zIndex: 2,
}));
