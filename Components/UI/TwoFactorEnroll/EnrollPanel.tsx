import React, { useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { QrCode2Rounded, MailOutlineRounded, VerifiedUserRounded, ArrowBackRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import BackupCodesList from "@/Components/Page/Profile/twoFactor/BackupCodesList";
import { brandFg } from "@/constants/theme";
import AuthenticatorEnroll from "./AuthenticatorEnroll";
import EmailCodeEnroll from "./EmailCodeEnroll";

export type EnrollMethod = "totp" | "email";

interface Props {
  /** Skip the picker and open a method directly. */
  initialMethod?: EnrollMethod | null;
  /** Hide the email option (e.g. upgrading an email baseline to an authenticator). */
  allowEmail?: boolean;
  /** Fired when the factor is verified (before the codes are acknowledged). */
  onEnrolled?: (method: EnrollMethod) => void;
  /** Fired when the user acknowledges the backup codes. */
  onDone: () => void;
  doneLabel?: string;
}

const MethodCard: React.FC<{ icon: React.ReactNode; title: string; body: string; badge?: string; testId: string; onClick: () => void }> = ({ icon, title, body, badge, testId, onClick }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      data-testid={testId}
      sx={{
        flex: 1, minWidth: 0, p: "16px", borderRadius: "12px", cursor: "pointer",
        border: `1px solid ${theme.palette.border.main}`, backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#FFFFFF",
        transition: "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
        "&:hover": { borderColor: brandFg(isDark), transform: "translateY(-1px)", boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.35)" : "0 8px 24px rgba(79,70,229,0.10)" },
        "&:focus-visible": { outline: `2px solid ${brandFg(isDark)}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "8px" }}>
        <Box sx={{ width: 36, height: 36, borderRadius: "10px", backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: brandFg(isDark) }}>{icon}</Box>
        <Typography sx={{ fontWeight: 600, fontSize: "14.5px", fontFamily: "var(--font-sans)" }}>{title}</Typography>
        {badge && (
          <Typography component="span" sx={{ ml: "auto", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#16A34A", backgroundColor: isDark ? "rgba(22,163,74,0.16)" : "#DCFCE7", px: "7px", py: "2px", borderRadius: "999px" }}>{badge}</Typography>
        )}
      </Box>
      <Typography sx={{ fontSize: "13px", lineHeight: 1.55, color: theme.palette.text.secondary }}>{body}</Typography>
    </Box>
  );
};

/** Method picker → inline enrolment → backup codes. The single enrolment surface for onboarding, the 2FA gate and Settings. */
const EnrollPanel: React.FC<Props> = ({ initialMethod = null, allowEmail = true, onEnrolled, onDone, doneLabel }) => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [method, setMethod] = useState<EnrollMethod | null>(initialMethod);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const handleEnrolled = (m: EnrollMethod) => (backupCodes: string[]) => {
    setCodes(backupCodes);
    onEnrolled?.(m);
  };

  if (codes) {
    return (
      <Box data-testid="twofa-enroll-done">
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: 1.5 }}>
          <VerifiedUserRounded sx={{ color: "#16A34A", fontSize: 22 }} />
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "16px" }}>
            {t("twoFactor.enabledTitle", { defaultValue: "Two-step verification is on" })}
          </Typography>
        </Box>
        <Typography data-testid="twofa-enabled-body" sx={{ fontSize: "14px", lineHeight: 1.6, color: theme.palette.text.secondary, mb: 2 }}>
          {t("twoFactor.enabledBody", { defaultValue: "Save these backup codes somewhere safe. If you lose access, each code lets you sign in once. They won't be shown again." })}
        </Typography>
        <BackupCodesList codes={codes} />
        <Button
          fullWidth
          onClick={onDone}
          data-testid="twofa-enroll-saved-codes"
          sx={{ mt: 2, fontWeight: 600, fontSize: "14px", color: "#FFFFFF", backgroundColor: "#4F46E5", py: "10px", borderRadius: "8px", textTransform: "none", "&:hover": { backgroundColor: "#4338CA" } }}
        >
          {doneLabel || t("twoFactor.savedCodes", { defaultValue: "I've saved my codes" })}
        </Button>
      </Box>
    );
  }

  if (!method) {
    return (
      <Box data-testid="twofa-method-picker" sx={{ display: "flex", gap: "12px", flexDirection: { xs: "column", sm: "row" } }}>
        <MethodCard
          icon={<QrCode2Rounded sx={{ fontSize: 20 }} />}
          title={t("twoFactor.methodApp", { defaultValue: "Authenticator app" })}
          body={t("twoFactor.methodAppBody", { defaultValue: "Google Authenticator, 1Password, Authy… Works offline and is the most secure option." })}
          badge={t("twoFactor.recommended", { defaultValue: "Recommended" })}
          testId="twofa-method-totp"
          onClick={() => setMethod("totp")}
        />
        {allowEmail && (
          <MethodCard
            icon={<MailOutlineRounded sx={{ fontSize: 20 }} />}
            title={t("twoFactor.methodEmail", { defaultValue: "Email codes" })}
            body={t("twoFactor.methodEmailBody", { defaultValue: "We email you a 6-digit code when you sign in on a new browser. No app needed." })}
            testId="twofa-method-email"
            onClick={() => setMethod("email")}
          />
        )}
      </Box>
    );
  }

  return (
    <Box>
      {!initialMethod && (
        <Button
          onClick={() => setMethod(null)}
          disabled={busy}
          startIcon={<ArrowBackRounded sx={{ fontSize: 16 }} />}
          data-testid="twofa-enroll-back"
          sx={{ mb: 1, px: 0.5, minWidth: 0, fontSize: "12.5px", textTransform: "none", color: brandFg(isDark), fontWeight: 600 }}
        >
          {t("twoFactor.chooseAnother", { defaultValue: "Choose another method" })}
        </Button>
      )}
      {method === "totp"
        ? <AuthenticatorEnroll onEnrolled={handleEnrolled("totp")} onBusyChange={setBusy} />
        : <EmailCodeEnroll onEnrolled={handleEnrolled("email")} onBusyChange={setBusy} />}
    </Box>
  );
};

export default EnrollPanel;
