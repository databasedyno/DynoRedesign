import Toast from "@/Components/UI/Toast";
import { LayoutProps, rootReducer } from "@/utils/types";
import { Box } from "@mui/material";
import { useSelector } from "react-redux";

const LoginLayout = ({ children, pageName, pageDescription }: LayoutProps) => {
  const ToastState = useSelector((state: rootReducer) => state.toastReducer);

  return (
    <Box sx={{ width: "100%", minHeight: "100dvh" }}>
      <Toast
        open={ToastState.open}
        message={ToastState.message}
        severity={ToastState.severity ? ToastState.severity : "success"}
        loading={ToastState.loading}
      />
      {children}
    </Box>
  );
};

export default LoginLayout;
