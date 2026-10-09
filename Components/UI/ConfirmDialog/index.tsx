import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import PopupModal from "../PopupModal";
import PanelCard from "../PanelCard";
import CustomButton from "../Buttons";
import useIsMobile from "@/hooks/useIsMobile";

export type ConfirmTone = "danger" | "primary";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  testIdPrefix?: string;
}

/** Shared modern confirm dialog (replaces native window.confirm across the app). */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
  testIdPrefix = "confirm",
}) => {
  const { t } = useTranslation("common");
  const isMobile = useIsMobile("sm");
  const theme = useTheme();
  const headerPadding = isMobile ? theme.spacing(1.875, 1.875, 0, 1.875) : theme.spacing(3.75, 3.75, 0, 3.75);
  const bodyPadding = isMobile ? theme.spacing(1.5, 1.875, 1.875, 1.875) : theme.spacing(3, 3.75, 3.75, 3.75);

  return (
    <PopupModal
      open={open}
      handleClose={onClose}
      showHeader={false}
      transparent={true}
      sx={{
        "& .MuiDialog-paper": {
          width: "100%",
          maxWidth: "460px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          p: 2,
        },
      }}
    >
      <PanelCard
        title={title}
        showHeaderBorder={false}
        headerPadding={headerPadding}
        bodyPadding={bodyPadding}
        sx={{ width: "100%", borderRadius: "14px", mx: "auto", maxWidth: isMobile ? "340px" : "460px" }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {message && (
            <Typography
              data-testid={`${testIdPrefix}-message`}
              sx={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.5, color: theme.palette.text.secondary }}
            >
              {message}
            </Typography>
          )}
          <Box sx={{ display: "flex", gap: 1 }}>
            <CustomButton
              variant="outlined"
              size="medium"
              label={cancelLabel ?? t("actions.cancel", { defaultValue: "Cancel" })}
              onClick={onClose}
              data-testid={`${testIdPrefix}-cancel`}
              sx={{ flex: 1 }}
            />
            <CustomButton
              variant={tone === "danger" ? "danger" : "primary"}
              size="medium"
              loading={busy}
              label={confirmLabel ?? t("actions.confirm", { defaultValue: "Confirm" })}
              onClick={onConfirm}
              data-testid={`${testIdPrefix}-confirm`}
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>
      </PanelCard>
    </PopupModal>
  );
};

export default ConfirmDialog;
