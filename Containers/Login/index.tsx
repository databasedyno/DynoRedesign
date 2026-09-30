import ToastHost from "@/Components/UI/Toast/ToastHost";
import { LayoutProps } from "@/utils/types";
import { Box } from "@mui/material";

const LoginLayout = ({ children, pageName, pageDescription }: LayoutProps) => {
  return (
    <Box sx={{ width: "100%", minHeight: "100dvh" }}>
      <ToastHost />
      {children}
    </Box>
  );
};

export default LoginLayout;
