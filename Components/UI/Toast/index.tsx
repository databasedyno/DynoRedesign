import { useToast, hideToast } from "@/helpers/toastStore";
import React, { useEffect } from "react";
import {Box, Typography, IconButton, useTheme} from "@mui/material";
import { IToastProps } from "@/utils/types";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";
import useIsMobile from "@/hooks/useIsMobile";
import BgImage from "@/assets/Images/toast-bg.png";
import Image from "next/image";
import SuccessIcon from "@/assets/Icons/success-icon.svg";
const Toast = (props: Partial<IToastProps> = {}) => {
  const theme = useTheme();
  const store = useToast();
  // Backward-compatible: some screens still drive a LOCAL toast by passing
  // props; when no `open` prop is given we read the global toast store.
  const controlled = props.open !== undefined;
  const open = controlled ? !!props.open : store.open;
  const message = controlled ? props.message ?? "" : store.message;
  const severity = controlled ? props.severity ?? "success" : store.severity;
  const loading = controlled ? !!props.loading : store.loading;
  const isMobile = useIsMobile("sm");

  // Auto-hide only the GLOBAL (store-driven) toast; controlled/prop-driven
  // toasts are managed by their parent (same as before).
  useEffect(() => {
    if (open && !loading && !controlled) {
      const timer = setTimeout(() => {
        hideToast();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [open, loading, message, severity, controlled]);

  if (!open) return null;

  // Determine colors and icon based on severity
  const getToastStyles = () => {
    if (loading) {
      return {
        borderColor: "#4CAF50",
        icon: <LoadingIcon size={14} fill="#4CAF50" />,
      };
    }

    // Explicitly check for error severity
    if (severity === "error") {
      return {
        borderColor: theme.palette.border.error,
        textColor: theme.palette.border.error,
        icon: (
          <ErrorOutlineIcon
            sx={{ color: theme.palette.border.error, fontSize: "14px" }}
          />
        ),
      };
    }

    // Default to success (green)
    return {
      borderColor: theme.palette.border.success,
      textColor: theme.palette.border.success,
      icon: <Image src={SuccessIcon} alt="success" width={14} height={14} />,
    };
  };

  const toastStyles = getToastStyles();

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: isMobile ? "16px" : "24px",
        right: isMobile ? "16px" : "24px",
        zIndex: 99999,
        backgroundColor: theme.palette.secondary.light,
        border: `1px solid ${toastStyles.borderColor}`,
        borderRadius: "14px",
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)",
        padding: isMobile ? "15px 24px" : "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        overflow: "hidden",
        animation: "slideInRight 0.3s ease-out",
        "@keyframes slideInRight": {
          "0%": {
            transform: "translateX(100%)",
            opacity: 0,
          },
          "100%": {
            transform: "translateX(0)",
            opacity: 1,
          },
        },
      }}
    >
      {/* Background Image */}
      <Box
        sx={{
          position: "absolute",
          top: isMobile ? "0px" : "6px",
          left: isMobile ? "-6px" : "0px",
          right: 0,
          bottom: 0,
          zIndex: -1,
          width: "276px",
          height: "100%",
        }}
      >
        <Image
          src={BgImage}
          alt="background"
          style={{
            objectFit: "contain",
            width: "100%",
            height: "100%",
          }}
          draggable={false}
        />
      </Box>

      {/* Content */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: isMobile ? "8px" : "12px",
          width: "100%",
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {toastStyles.icon}
        </Box>

        {/* Message */}
        <Typography
          sx={{
            flex: 1,
            fontSize: isMobile ? "13px" : "15px",
            fontFamily: "var(--font-sans)",
            color: toastStyles.textColor,
            lineHeight: "1.5",
          }}
        >
          {message}
        </Typography>

        {/* Close Button */}
        {/* <IconButton
          onClick={handleClose}
          sx={{
            padding: "4px",
            color: theme.palette.text.secondary,
            flexShrink: 0,
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.04)",
            },
          }}
          size="small"
        >
          <CloseIcon sx={{ fontSize: "18px" }} />
        </IconButton> */}
      </Box>
    </Box>
  );
};

export default Toast;
