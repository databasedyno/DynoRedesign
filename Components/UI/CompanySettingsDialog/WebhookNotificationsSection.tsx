import CopyIcon from "@/assets/Icons/copy-icon.svg";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import RefreshIcon from "@/assets/Icons/refresh-icon.svg";
import { CopyButton } from "@/Components/Layout/NewSidebar/styled";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import SettingsAccordion from "@/Components/UI/SettingsAccordion";
import useIsMobile from "@/hooks/useIsMobile";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import SidebarIcon from "@/utils/customIcons/sidebar-icons";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import Image from "next/image";
import React, { useCallback, useState } from "react";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import copyToClipboard from "@/helpers/copyToClipboard";

const iconButtonSize = { width: 40, height: 40, minWidth: 40, minHeight: 40 };
const iconButtonSizeMobile = {
  width: 32,
  height: 32,
  minWidth: 32,
  minHeight: 32,
};

export type WebhookNotificationsSectionProps = {
  notificationUrl: string;
  secretKey: string;
  onNotificationUrlChange?: (value: string) => void;
  onSecretKeyChange?: (value: string) => void;
  onRegenerateSecret?: () => void;
  onSendTest?: () => void;
  isMobile?: boolean;
  expanded: boolean;
  onAccordionChange: (event: React.SyntheticEvent, isExpanded: boolean) => void;
};

export default function WebhookNotificationsSection({
  notificationUrl,
  secretKey,
  onNotificationUrlChange,
  onSecretKeyChange,
  onRegenerateSecret,
  onSendTest,
  isMobile: isMobileProp = false,
  expanded,
  onAccordionChange,
}: WebhookNotificationsSectionProps) {
  const { t: tSettings } = useTranslation("companySettings");
  const theme = useTheme();
  const isMobile = useIsMobile("sm") ?? isMobileProp;
  const dispatch = useDispatch();
  const [showSecret, setShowSecret] = useState(false);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);

  const handleRegenerateClick = useCallback(() => {
    setRegenerateConfirmOpen(true);
  }, []);

  const handleRegenerateConfirm = useCallback(() => {
    onRegenerateSecret?.();
    setRegenerateConfirmOpen(false);
  }, [onRegenerateSecret]);

  const handleRegenerateCancel = useCallback(() => {
    setRegenerateConfirmOpen(false);
  }, []);

  const handleCopyUrl = useCallback(() => {
    if (notificationUrl) {
      copyToClipboard(notificationUrl);
      dispatch({ type: TOAST_SHOW, payload: { message: "Webhook URL copied!", severity: "success" } });
    }
  }, [notificationUrl, dispatch]);

  const handleCopySecret = useCallback(() => {
    if (secretKey) {
      copyToClipboard(secretKey);
      dispatch({ type: TOAST_SHOW, payload: { message: "Secret key copied!", severity: "success" } });
    }
  }, [secretKey, dispatch]);

  const sizeSx = isMobile ? iconButtonSizeMobile : iconButtonSize;
  const primaryBorder = theme.palette.primary.main;
  const outlineBorder = "1px solid rgba(0, 0, 0, 0.23)";

  return (
    <SettingsAccordion
      icon={
        <SidebarIcon
          name="notifications"
          size={16}
          color={theme.palette.text.primary}
        />
        // <NotificationsIcon sx={{ color: "text.primary", height: 16, width: 16 }} />
      }
      title={tSettings("webhookNotifications")}
      subtitle={tSettings("webhookSubtitle")}
      expanded={expanded}
      onChange={onAccordionChange}
      isMobile={isMobile}
    >
      {/* Notification URL */}
      <Box sx={{ mb: 2.5, width: "100%" }}>
        <InputField
          fullWidth
          label={tSettings("webhookNotificationUrl")}
          placeholder="https://example.com/webhooks/dynopay"
          name="webhook_notification_url"
          value={notificationUrl}
          onChange={(e) => onNotificationUrlChange?.(e.target.value)}
          onBlur={() => {}}
          helperText={tSettings("webhookNotificationUrlHelper")}
          inputHeight={isMobile ? "32px" : "38px"}
          data-testid="settings-webhook-url-input"
          sideButton
          onSideButtonClick={handleCopyUrl}
          sideButtonIcon={
            <Image
              src={CopyIcon}
              alt="Copy Icon"
              width={isMobile ? 12 : 14}
              height={isMobile ? 12 : 14}
              draggable={false}
              className="themed-icon-primary"
            />
          }
          sideButtonType="secondary"
        />
      </Box>

      {/* Secret Key */}
      <Box sx={{ mb: 2.5 }}>
        <Typography
          component="label"
          sx={{
            display: "block",
            fontWeight: 500,
            fontSize: isMobile ? "13px" : "15px",
            fontFamily: "var(--font-sans)",
            color: "text.primary",
            lineHeight: "18px",
            mb: "12px",
          }}
        >
          {tSettings("webhookSecretKey")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
          }}
        >
          <InputField
            fullWidth
            placeholder="whsec_…  (generate one with the refresh button)"
            name="webhook_secret_key"
            type={showSecret ? "text" : "password"}
            value={secretKey}
            onChange={(e) => onSecretKeyChange?.(e.target.value)}
            onBlur={() => {}}
            readOnly={!onSecretKeyChange}
            inputHeight={isMobile ? "32px" : "38px"}
            sx={{ flex: 1 }}
          />
          <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
            <Tooltip title={tSettings("webhookCopy")}>
              <CopyButton type="button" onClick={handleCopySecret}>
                <Image
                  src={CopyIcon}
                  alt="Copy Icon"
                  width={isMobile ? 12 : 14}
                  height={isMobile ? 12 : 14}
                  draggable={false}
                />
              </CopyButton>
            </Tooltip>
            <Tooltip
              title={
                showSecret
                  ? tSettings("webhookHide")
                  : tSettings("webhookReveal")
              }
            >
              <IconButton
                onClick={() => setShowSecret((prev) => !prev)}
                aria-label={showSecret ? "Hide" : "Reveal"}
                sx={{
                  ...sizeSx,
                  borderRadius: "6px",
                  border: `1px solid ${theme.palette.text.primary}`,
                  color: "text.primary",
                  backgroundColor: theme.palette.background.paper,
                  "&:hover": {
                    backgroundColor: "#F5F5F5",
                  },
                }}
              >
                {showSecret ? (
                  <VisibilityOffIcon sx={{ fontSize: 22 }} />
                ) : (
                  <VisibilityIcon sx={{ fontSize: 22 }} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title={tSettings("webhookRegenerate")}>
              <IconButton
                onClick={handleRegenerateClick}
                aria-label={tSettings("webhookRegenerate")}
                sx={{
                  ...sizeSx,
                  borderRadius: "6px",
                  border: `1px solid ${theme.palette.text.primary}`,
                  color: "text.primary",
                  backgroundColor: theme.palette.background.paper,
                  "&:hover": {
                    backgroundColor: "#F5F5F5",
                  },
                }}
              >
                <Image
                  src={RefreshIcon}
                  alt="Refresh Icon"
                  width={isMobile ? 12 : 22}
                  height={isMobile ? 12 : 16}
                  draggable={false}
                  className="themed-icon"
                />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography
          sx={{
            mt: 0.75,
            fontSize: isMobile ? "10px" : "13px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            color: "text.secondary",
            lineHeight: 1.2,
          }}
        >
          {tSettings("webhookSecretKeyHelper")}
        </Typography>
      </Box>

      {/* Send Test */}
      <CustomButton
        label={tSettings("webhookSendTest")}
        variant="secondary"
        size="medium"
        endIcon={<OpenInNewIcon sx={{ fontSize: 18 }} />}
        onClick={onSendTest}
        sx={{
          width: "100%",
          fontSize: isMobile ? "13px" : "15px",
        }}
      />

      {/* Regenerate Secret Key Confirmation Dialog */}
      <Dialog
        open={regenerateConfirmOpen}
        onClose={handleRegenerateCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 0,
            maxWidth: 576,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pb: 0,
            pt: "30px",
            px: "30px",
          }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1, mb: "24px" }}
          >
            <Image
              src={InfoIcon}
              alt="Info Icon"
              width={isMobile ? 12 : 22}
              height={isMobile ? 12 : 16}
              draggable={false}
              className="themed-icon"
            />
            <Typography
              sx={{
                fontWeight: 500,
                fontSize: isMobile ? "16px" : "20px",
                fontFamily: "var(--font-sans)",
                color: "text.primary",
                lineHeight: "24px",
              }}
            >
              {tSettings("webhookRegenerateConfirmTitle")}
            </Typography>
          </Box>
          <IconButton
            onClick={handleRegenerateCancel}
            aria-label="Close"
            sx={{
              position: "absolute",
              top: 15,
              right: 15,
              width: 32,
              height: 32,
              borderRadius: "50%",
              bgcolor: "action.hover",
              "&:hover": { bgcolor: "action.selected" },
              border: `1px solid ${theme.palette.border.main}`,
              color: "text.primary",
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Image
              src={RefreshIcon}
              alt="Refresh Icon"
              width={isMobile ? 12 : 22}
              height={isMobile ? 12 : 16}
              draggable={false}
              className="themed-icon"
            />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: "30px", pt: 1.5, pb: 0 }}>
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              color: "text.secondary",
              lineHeight: "18px",
              fontFamily: "var(--font-sans)",
            }}
          >
            {tSettings("webhookRegenerateConfirmMessage")}
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: "flex-end",
            gap: 1,
            px: 2.5,
            pb: 2.5,
            pt: 3,
          }}
        >
          <CustomButton
            label={tSettings("actions.cancel")}
            variant="outlined"
            size="medium"
            onClick={handleRegenerateCancel}
            sx={{ fontSize: isMobile ? "13px" : "14px", width: "100%" }}
          />
          <CustomButton
            label={tSettings("webhookRegenerateConfirmButton")}
            variant="danger"
            size="medium"
            onClick={handleRegenerateConfirm}
            sx={{ fontSize: isMobile ? "13px" : "14px", width: "100%" }}
          />
        </DialogActions>
      </Dialog>
    </SettingsAccordion>
  );
}
