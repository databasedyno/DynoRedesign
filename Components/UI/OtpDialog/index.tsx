import CloseIcon from "@/assets/Icons/close-icon.svg";
import EnvelopeIcon from "@/assets/Icons/envelope-icon.svg";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import React from "react";
import { useTranslation } from "react-i18next";
import { DialogCloseButton } from "./styled";

/**
 * OtpDialog — modal wrapper around the shared <OtpInputPanel/>.
 *
 * The actual OTP form, auto-submit, paste, resend countdown, and styling all
 * live in `OtpInputPanel` so the OTP UX is byte-identical between this modal
 * and inline OTP screens (e.g. /auth/register).
 */

export interface OtpDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  contactInfo?: string;
  contactType?: "email" | "phone";
  otpLength?: number;
  resendCodeLabel?: string;
  resendCodeCountdownLabel?: (seconds: number) => string;
  primaryButtonLabel?: string;
  onResendCode?: () => void;
  onVerify?: (otp: string) => void;
  onClearError?: () => void;
  countdown?: number;
  loading?: boolean;
  error?: string;
  preventClose?: boolean;
}

const OtpDialog: React.FC<OtpDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  contactInfo = "",
  contactType = "email",
  otpLength = 6,
  resendCodeLabel,
  resendCodeCountdownLabel,
  primaryButtonLabel,
  onResendCode,
  onVerify,
  onClearError,
  countdown = 0,
  loading = false,
  error,
  preventClose = false,
}) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  const dialogTitle = title || t("emailVerification") || "Verification";
  const dialogSubtitle = subtitle;

  const handleClose = () => {
    if (!preventClose) onClose();
  };

  return (
    <PopupModal
      open={open}
      handleClose={handleClose}
      showHeader={false}
      transparent
      role="dialog"
      aria-modal="true"
      disableEscapeKeyDown={preventClose}
      onClose={(reason) => {
        if (preventClose) return;
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          onClose();
        }
      }}
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: "14px",
          maxWidth: isMobile ? "358px" : "495px",
          width: "100%",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          margin: 0,
          position: "fixed",
          overflow: "visible",
        },
      }}
    >
      <PanelCard
        title={dialogTitle}
        headerIcon={
          contactType === "email" ? (
            <Image
              src={EnvelopeIcon}
              alt="email icon"
              width={isMobile ? 18 : 24}
              height={isMobile ? 11 : 24}
              draggable={false}
              className="themed-icon"
            />
          ) : undefined
        }
        headerAction={
          <DialogCloseButton
            onClick={handleClose}
            sx={{
              position: "absolute",
              right: isMobile ? "-16px" : "-30px",
              top: isMobile ? "-16px" : "-30px",
              cursor: preventClose ? "not-allowed" : "pointer",
              opacity: preventClose ? 0.5 : 1,
            }}
          >
            <Image
              src={CloseIcon.src}
              alt="close icon"
              width={isMobile ? 10 : 16}
              height={isMobile ? 10 : 16}
              draggable={false}
            />
          </DialogCloseButton>
        }
        showHeaderBorder={false}
        bodyPadding="0"
        headerPadding="0 !important"
        sx={{
          backgroundColor: "background.paper",
          borderRadius: "14px",
          padding: "30px",
          boxShadow: "none",
          outline: "none",
          [theme.breakpoints.down("sm")]: {
            padding: "16px",
          },
        }}
        bodySx={{
          padding: "0",
        }}
      >
        {/* Subtitle */}
        {dialogSubtitle && (
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              color: theme.palette.text.secondary,
              fontFamily: "UrbanistMedium",
              marginBottom: isMobile ? "14px" : "16px",
              marginTop: isMobile ? "10px" : "12px",
              lineHeight: "1.2",
              letterSpacing: 0,
            }}
          >
            {dialogSubtitle}
          </Typography>
        )}

        {/* Shared OTP block — same UX as inline OTP screens */}
        <OtpInputPanel
          contactInfo={contactInfo}
          contactType={contactType}
          otpLength={otpLength}
          resendCodeLabel={resendCodeLabel}
          resendCodeCountdownLabel={resendCodeCountdownLabel}
          primaryButtonLabel={primaryButtonLabel}
          onResendCode={onResendCode}
          onVerify={onVerify || (() => {})}
          onClearError={onClearError}
          countdown={countdown}
          loading={loading}
          error={error}
          showInfoChip
          showLabel
          showActions
          actionsLayout="row"
          resetKey={open ? "open" : "closed"}
        />
      </PanelCard>
    </PopupModal>
  );
};

export default OtpDialog;
