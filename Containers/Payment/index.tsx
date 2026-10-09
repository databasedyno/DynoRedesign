import { LayoutProps } from "@/utils/types";
import { Box } from "@mui/material";
import React from "react";
import ToastHost from "@/Components/UI/Toast/ToastHost";

const PaymentLayout = ({ children, pageName, pageDescription }: LayoutProps) => {
  return (
    <>
      <ToastHost />

      <Box component="main">
        {/* Here Where the Pages will load */}
        {children}
      </Box>
    </>
  );
};

export default PaymentLayout;
