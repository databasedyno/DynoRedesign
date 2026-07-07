import CloseIcon from "@/assets/Icons/close-icon.svg";
import EnvelopeIcon from "@/assets/Icons/envelope-icon.svg";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
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
 *
 * If `loadingSteps` is provided AND `loading === true`, the dialog swaps the
 * OTP form for a stepped-progress screen (spinner + rotating message +
 * step dots). Used by AddWalletModal to make the ~9-10s wallet-verify wait
 * feel intentional instead of frozen.
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
  /**
   * Optional. When set, the dialog switches to a stepped progress screen
   * while `loading === true`. The messages rotate every `loadingStepIntervalMs`
   * (default 2000 ms). Example:
   *   ["Verifying your OTP…", "Setting up your wallet…", "Almost done…"]
   */
  loadingSteps?: string[];
  /** Interval (ms) between step rotations. Default 2000. */
  loadingStepIntervalMs?: number;
  /** Heading shown above the progress spinner. Default "Almost done…". */
  loadingTitle?: string;
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
  loadingSteps,
  loadingStepIntervalMs = 2000,
  loadingTitle,
}) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  const dialogTitle = title || t("emailVerification");
  const dialogSubtitle = subtitle;

  // Should we swap the OTP form for the stepped-progress screen?
  const showSteppedProgress = loading && !!loadingSteps && loadingSteps.length > 0;
  const [stepIndex, setStepIndex] = React.useState(0);

  // When we ENTER the loading state, reset to step 0 and start rotating.
  // Stops rotating on the last step so we don't overshoot the array.
  React.useEffect(() => {
    if (!showSteppedProgress) {
      setStepIndex(0);
      return;
    }
    // If there's only one step, no rotation needed
    if ((loadingSteps?.length ?? 0) <= 1) return;
    const timer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, (loadingSteps?.length ?? 1) - 1));
    }, loadingStepIntervalMs);
    return () => clearInterval(timer);
  }, [showSteppedProgress, loadingStepIntervalMs, loadingSteps]);

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
          backgroundColor: theme.palette.mode === "dark" ? "rgba(14,15,18,0.92)" : "rgba(255,255,255,0.86)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
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
        {dialogSubtitle && !showSteppedProgress && (
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

        {showSteppedProgress ? (
          <Box
            data-testid="otp-stepped-progress"
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              py: isMobile ? 3 : 4,
              px: 1,
              gap: 2,
            }}
          >
            {/* Big animated spinner */}
            <Box
              sx={{
                position: "relative",
                width: 96,
                height: 96,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress
                size={96}
                thickness={3}
                sx={{ color: theme.palette.primary.main }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckRoundedIcon
                  sx={{
                    fontSize: 40,
                    color: theme.palette.primary.main,
                    opacity: 0.4,
                  }}
                />
              </Box>
            </Box>

            {/* Heading */}
            <Typography
              sx={{
                fontFamily: "UrbanistBold",
                fontWeight: 700,
                fontSize: isMobile ? "20px" : "22px",
                color: theme.palette.text.primary,
                lineHeight: 1.2,
              }}
            >
              {loadingTitle || (t("almostDone") as string) || "Almost done…"}
            </Typography>

            {/* Rotating step message */}
            <Typography
              data-testid="otp-stepped-progress-message"
              key={stepIndex}
              sx={{
                fontFamily: "UrbanistMedium",
                fontSize: isMobile ? "14px" : "15px",
                color: theme.palette.text.secondary,
                minHeight: "1.5em",
                lineHeight: 1.4,
                maxWidth: 360,
                animation: "otpStepFadeIn 240ms ease-out",
                "@keyframes otpStepFadeIn": {
                  "0%": { opacity: 0, transform: "translateY(6px)" },
                  "100%": { opacity: 1, transform: "translateY(0)" },
                },
              }}
            >
              {loadingSteps?.[stepIndex] ?? ""}
            </Typography>

            {/* Step dots */}
            {loadingSteps && loadingSteps.length > 1 && (
              <Box sx={{ display: "flex", gap: "6px", mt: 0.5 }}>
                {loadingSteps.map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: i === stepIndex ? 20 : 6,
                      height: 6,
                      borderRadius: "999px",
                      backgroundColor:
                        i <= stepIndex
                          ? theme.palette.primary.main
                          : theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.14)"
                            : "rgba(0,0,0,0.12)",
                      transition: "all 220ms ease-out",
                    }}
                  />
                ))}
              </Box>
            )}

            <Typography
              sx={{
                fontFamily: "UrbanistMedium",
                fontSize: "12px",
                color: theme.palette.text.disabled,
                mt: 1,
              }}
            >
              {(t("keepThisOpen") as string) ||
                "Please keep this window open — this takes a few seconds."}
            </Typography>
          </Box>
        ) : (
          /* Shared OTP block — same UX as inline OTP screens */
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
        )}
      </PanelCard>
    </PopupModal>
  );
};

export default OtpDialog;
