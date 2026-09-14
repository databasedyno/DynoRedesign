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
import paymentAuth from "@/Components/Page/Common/HOC/paymentAuth";

const PaymentLayout = ({ children, pageName, pageDescription }: LayoutProps) => {
  const theme = useTheme();
  const tokenData = useTokenData();
  const ToastState = useSelector((state: rootReducer) => state.toastReducer);
  return (
    <>
      <Toast
        open={ToastState.open}
        message={ToastState.message}
        severity={ToastState.severity ?? "success"}
        loading={ToastState.loading}
      />

      <Box component="main">
        {/* Here Where the Pages will load */}
        {children}
      </Box>
    </>
  );
};

export default PaymentLayout;
