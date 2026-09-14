import { Box, styled } from "@mui/material";

// HomeLayout
export const MainBox = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.primary,
  transition: "background-color 0.3s ease, color 0.3s ease",
}));

export const MainSection = styled("main")(() => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
}));
