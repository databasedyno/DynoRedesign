import { drawerWidth } from "@/styles/theme";
import { AppBar, styled } from "@mui/material";
import { brandFg } from "@/constants/theme";

export const CustomAppBar = styled(AppBar)(({ theme }) => ({
  top: 0,
  zIndex: 999,
  width: `calc(100vw - ${drawerWidth}px)`,
  boxShadow: "none",
  background: theme.palette.background.paper,
  color: brandFg(theme.palette.mode === "dark"),
  borderBottom: "1px solid #EAEAEA",
  [theme.breakpoints.down("sm")]: {
    width: "100vw",
  },
}));
