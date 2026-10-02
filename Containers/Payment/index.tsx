import { LayoutProps } from "@/utils/types";
import { Box, useTheme } from "@mui/material";
import React from "react";
import useTokenData from "@/hooks/useTokenData";
import ToastHost from "@/Components/UI/Toast/ToastHost";

const PaymentLayout = ({ children, pageName, pageDescription }: LayoutProps) => {
  const theme = useTheme();
  const tokenData = useTokenData();
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
