import { styled, Box } from "@mui/material";

export const BottomBullets = styled(Box)(({ theme }) => ({
  background: "#222632",
  padding: theme.spacing(1.75),
  width: "fit-content",
  borderRadius: "100%",
  lineHeight: 0,
  cursor: "pointer",
}));
