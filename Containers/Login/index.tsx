import Toast from "@/Components/UI/Toast";
import { LayoutProps } from "@/utils/types";
import { Box } from "@mui/material";

const LoginLayout = ({ children, pageName, pageDescription }: LayoutProps) => {
  return (
    <Box sx={{ width: "100%", minHeight: "100dvh" }}>
      <Toast />
      {children}
    </Box>
  );
};

export default LoginLayout;
