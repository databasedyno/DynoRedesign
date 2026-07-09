import { theme } from "@/styles/theme";
import styled from "@emotion/styled";
import { Box, Typography } from "@mui/material";

export const DeleteModelContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    gap: theme.spacing(1.5),
  },
});

export const DeleteModelTitle = styled(Typography)({
  fontSize: "15px",
  fontWeight: 500,
  lineHeight: 1.15,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
  [theme.breakpoints.down("sm")]: {
    fontSize: "13px",
  },
});