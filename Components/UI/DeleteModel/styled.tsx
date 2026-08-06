import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

export const DeleteModelContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    gap: theme.spacing(1.5),
  },
}));

export const DeleteModelTitle = styled(Typography)(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 500,
  lineHeight: 1.15,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
  [theme.breakpoints.down("sm")]: {
    fontSize: "13px",
  },
}));
