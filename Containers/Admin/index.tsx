import withAuth from "@/Components/Page/Common/HOC/withAuth";
import { drawerWidth, toolbarHeight } from "@/styles/theme";
import { LayoutProps, rootReducer } from "@/utils/types";
import { Box, Drawer, useTheme } from "@mui/material";
import React from "react";
import useTokenData from "@/hooks/useTokenData";
import Header from "@/Components/Layout/Header";
import SideBar from "@/Components/Layout/Sidebar";
import Toast from "@/Components/UI/Toast";
import { useSelector } from "react-redux";
import adminAuth from "@/Components/Page/Common/HOC/adminAuth";
import AdminHeader from "@/Components/Layout/AdminHeader";

const AdminLayout = ({ children, pageName, pageDescription, }: LayoutProps) => {
  const theme = useTheme();
  const tokenData = useTokenData();
  const ToastState = useSelector((state: rootReducer) => state.toastReducer);
  return (
    <>
      <Toast
        open={ToastState.open}
        message={ToastState.message}
        severity={ToastState.severity || "success"}
        loading={ToastState.loading}
      />
      <Box component="nav" sx={{ sm: "block", xs: "none" }}>
        <Drawer
          variant="permanent"
          sx={{
            display: { lg: "block", xs: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              overflow: "hidden",
              background: theme.palette.primary.main,
              "&::-webkit-scrollbar": {
                width: 0,
              },
            },
          }}
        >
          <SideBar handleDrawerToggle={() => {}} type="admin" />
        </Drawer>
      </Box>
      <Box
        sx={{
          width: { lg: `calc(100vw - ${drawerWidth}px)`, xs: "100vw" },
          ml: { lg: `${drawerWidth}px`, xs: 0 },
          mt: { sm: `${toolbarHeight}px`, xs: `${toolbarHeight * 2 - 5}px` },
        }}
      >
        <AdminHeader pageName={pageName} pageDescription={pageDescription} />
        <Box
          component="main"
          sx={{
            pt: 2.5,
            px: { lg: 3, sm: 2.5, xs: 1.5 },
          }}
        >
          {/* Here Where the Pages will load */}
          {children}
        </Box>
      </Box>
    </>
  );
};

export default adminAuth(AdminLayout);
