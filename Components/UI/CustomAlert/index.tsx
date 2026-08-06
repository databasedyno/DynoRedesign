import { CheckCircleRounded, WarningRounded } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import React from "react";
import PopupModal from "../PopupModal";

interface CusotmAlertProps {
  open: boolean;
  handleClose: () => void;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  message: string | JSX.Element;
  heading?: string;
  hideCancel?: boolean;
  successIcon?: boolean;
  disableConfirm?: boolean;
}

const CustomAlert = ({
  confirmText,
  handleClose,
  onConfirm,
  open,
  heading,
  cancelText,
  message,
  hideCancel = false,
  successIcon,
  disableConfirm = false,
}: CusotmAlertProps) => {
  return (
    <PopupModal
      open={open}
      handleClose={handleClose}
      headerText={
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {successIcon ? (
            <CheckCircleRounded fontSize="large" color="success" />
          ) : (
            <WarningRounded fontSize="large" sx={{ color: "#E5484D" }} />
          )}

          <Typography variant="h4" fontWeight={700} marginLeft={1.5}>
            {heading ?? "Are you sure?"}
          </Typography>
        </Box>
      }
      sx={{ zIndex: 10000 }}
      onConfirm={onConfirm}
      confirmText={confirmText}
      cancelText={cancelText}
      hasFooter
      hideCancel={hideCancel}
      disableConfirm={disableConfirm}
    >
      <Box
        sx={{
          minWidth: { sm: "400px", xs: "300px" },
          maxWidth: "550px",
          my: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: "15px",
            fontWeight: 400,
            color: "text.secondary",
            lineHeight: 1.6,
          }}
        >
          {message}
        </Typography>
      </Box>
    </PopupModal>
  );
};

export default CustomAlert;
