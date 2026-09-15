import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import type { ProtectionLevel } from "./useWalletSecurity";

interface Props {
  level: ProtectionLevel;
  loading: boolean;
  twoFaOn: boolean;
  frozenSince?: string | null;
}

const LEVEL_SEGMENTS: Record<ProtectionLevel, number> = { locked: 3, strong: 3, standard: 2 };

/** Hero: how protected are this merchant's payout wallets right now, and the one thing that raises it. */
const ProtectionLevelCard: React.FC<Props> = ({ level, loading, twoFaOn, frozenSince }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("walletScreen");
  const positive = isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light;
  const warning = isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light;
  const negative = isDark ? CB_TOKENS.semantic.negative.dark : CB_TOKENS.semantic.negative.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const accent = level === "locked" ? negative : level === "strong" ? positive : warning;

  const label =
    level === "locked"
      ? t("security.levelLocked", { defaultValue: "Locked" })
      : level === "strong"
        ? t("security.levelStrong", { defaultValue: "Strong" })
        : t("security.levelStandard", { defaultValue: "Standard" });
  const summary =
    level === "locked"
      ? t("security.levelLockedBody", { defaultValue: "Payout address changes are frozen after a “this wasn’t me” report. Contact support to unlock." })
      : level === "strong"
        ? t("security.levelStrongBody", { defaultValue: "Every payout address change needs a one-time code, emails you an undo link, and your sign-in has two-factor protection." })
        : t("security.levelStandardBody", { defaultValue: "Every payout address change needs a one-time code and emails you an undo link. Turn on two-factor sign-in to reach Strong." });

  const checks = [
    { key: "otp", ok: true, text: t("security.checkOtp", { defaultValue: "A one-time code is required for every payout address change" }) },
    { key: "alerts", ok: true, text: t("security.checkAlerts", { defaultValue: "Every change emails you with a one-tap undo" }) },
    { key: "2fa", ok: twoFaOn, text: twoFaOn ? t("security.check2faOn", { defaultValue: "Two-factor sign-in is on" }) : t("security.check2faOff", { defaultValue: "Two-factor sign-in is off" }) },
  ];

  return (
    <PanelCard
      title={t("security.levelTitle", { defaultValue: "Protection level" })}
      subTitle={t("security.levelSubtitle", { defaultValue: "How your payout addresses are protected right now." })}
      showHeaderBorder={false}
    >
      <Box data-testid="wallet-security-level" data-level={level} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "220px 1fr" }, gap: { xs: 2.5, md: 4 }, alignItems: "start", pt: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "flex-start", md: "center" }, gap: 1.25 }}>
          {loading ? (
            <Skeleton variant="rounded" width={200} height={72} />
          ) : (
            <>
              <Box sx={{ display: "flex", gap: 0.75, width: 200 }}>
                {[1, 2, 3].map((seg) => (
                  <Box key={seg} sx={{ flex: 1, height: 10, borderRadius: 999, backgroundColor: seg <= LEVEL_SEGMENTS[level] ? accent : isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.08)", transition: "background-color 200ms ease" }} />
                ))}
              </Box>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <Icon name={level === "locked" ? "lucide:lock" : "lucide:shield-check"} size={22} style={{ color: accent }} />
                <Typography data-testid="wallet-security-level-label" sx={{ fontFamily: "var(--font-sans)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: theme.palette.text.primary, lineHeight: 1 }}>
                  {label}
                </Typography>
              </Box>
              {level === "locked" && frozenSince && (
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: muted }}>
                  {t("security.lockedSince", { date: formatDateI18n(frozenSince, { day: "2-digit", month: "short", year: "numeric" }), defaultValue: "Locked since {{date}}" })}
                </Typography>
              )}
            </>
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: theme.palette.text.secondary }}>{summary}</Typography>
          <Box component="ul" sx={{ listStyle: "none", m: 0, mt: 2, p: 0, display: "grid", gap: 1 }}>
            {checks.map((c) => (
              <Box component="li" key={c.key} data-testid={`wallet-security-check-${c.key}`} data-ok={c.ok ? "true" : "false"} sx={{ display: "flex", alignItems: "center", gap: 1.25, fontFamily: "var(--font-sans)", fontSize: 13.5, color: theme.palette.text.primary }}>
                <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: c.ok ? positive : warning, backgroundColor: c.ok ? (isDark ? CB_TOKENS.semantic.positive.glowDark : CB_TOKENS.semantic.positive.glowLight) : (isDark ? CB_TOKENS.semantic.warning.glowDark : CB_TOKENS.semantic.warning.glowLight) }}>
                  <Icon name={c.ok ? "lucide:check" : "lucide:triangle-alert"} size={13} />
                </Box>
                {c.text}
              </Box>
            ))}
          </Box>
          {!twoFaOn && !loading && (
            <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${border}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
              <Typography sx={{ flex: 1, minWidth: 200, fontFamily: "var(--font-sans)", fontSize: 13, color: muted }}>
                {t("security.turnOn2faHint", { defaultValue: "Two-factor sign-in protects your payouts even if your password leaks." })}
              </Typography>
              <CustomButton
                label={t("security.turnOn2fa", { defaultValue: "Turn on two-factor" })}
                variant="primary"
                size="small"
                data-testid="wallet-security-2fa-cta"
                onClick={() => router.push("/settings?section=profile")}
              />
            </Box>
          )}
        </Box>
      </Box>
    </PanelCard>
  );
};

export default ProtectionLevelCard;
