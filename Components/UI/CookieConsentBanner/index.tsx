import { Box, Button, Link as MuiLink, Typography, useTheme } from "@mui/material";
import CookieOutlinedIcon from "@mui/icons-material/CookieOutlined";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const ACK_KEY = "dp_cookie_notice_ack";
const ACK_VALUE = "1";

/**
 * Lightweight, dismissible cookie notice (public/marketing + checkout + SafeDeal).
 * The app only sets strictly-necessary (CSRF, 2FA trusted-device) and functional
 * (theme, language) cookies, so this is an acknowledgement — not a blocking
 * consent gate. SSR-safe: renders nothing until mounted to avoid hydration drift.
 */
export default function CookieConsentBanner() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const router = useRouter();
  const policyHref = router.pathname.startsWith("/safedeal") ? "/safedeal/privacy" : "/privacy-policy";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ACK_KEY) !== ACK_VALUE) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(ACK_KEY, ACK_VALUE);
    } catch {
      /* storage unavailable — dismiss for this session only */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Box
      role="region"
      aria-label={t("cookieNotice.aria", { defaultValue: "Cookie notice" })}
      data-testid="cookie-consent-banner"
      sx={{
        position: "fixed",
        zIndex: 1300,
        left: 16,
        right: { xs: 88, sm: "auto" },
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        width: { xs: "auto", sm: 420 },
        maxWidth: "calc(100vw - 32px)",
        p: 2,
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.border?.main || theme.palette.divider}`,
        boxShadow: isDark ? "0 12px 32px rgba(0,0,0,0.5)" : "0 12px 32px rgba(10,10,15,0.16)",
        animation: "cookieNoticeIn 240ms ease both",
        "@keyframes cookieNoticeIn": {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
        <CookieOutlinedIcon sx={{ fontSize: 22, color: theme.palette.primary.main, mt: "1px", flexShrink: 0 }} aria-hidden />
        <Typography
          sx={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.5, color: theme.palette.text.primary }}
        >
          {t("cookieNotice.text", {
            defaultValue:
              "We use cookies for security and to remember your preferences. We don\u2019t use tracking or advertising cookies.",
          })}{" "}
          <MuiLink
            component={NextLink}
            href={policyHref}
            data-testid="cookie-consent-policy-link"
            sx={{
              color: theme.palette.primary.main,
              textDecoration: "underline",
              fontWeight: 600,
              "&:hover": { color: theme.palette.primary.dark || theme.palette.primary.main },
            }}
          >
            {t("cookieNotice.policy", { defaultValue: "Privacy Policy" })}
          </MuiLink>
        </Typography>
      </Box>
      <Button
        type="button"
        variant="contained"
        onClick={accept}
        data-testid="cookie-consent-accept"
        sx={{
          alignSelf: "flex-end",
          minHeight: 44,
          px: 2.5,
          borderRadius: "10px",
          textTransform: "none",
          fontWeight: 700,
          fontFamily: "var(--font-sans)",
          boxShadow: "none",
        }}
      >
        {t("cookieNotice.accept", { defaultValue: "Got it" })}
      </Button>
    </Box>
  );
}
