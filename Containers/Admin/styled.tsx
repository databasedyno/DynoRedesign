import { Box, styled } from "@mui/material";

export const FixedBottomWrapper = styled(Box)(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  right: 0,
  padding: theme.spacing(1.5),
  background: "transparent",
  zIndex: 999,
}));
