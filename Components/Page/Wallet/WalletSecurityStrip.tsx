import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

const get = async <T,>(url: string): Promise<T> => (await axiosBaseApi.get(url)).data?.data as T;

/** Slim status line: how payout wallets are protected right now + the door to Settings → Security. */
const WalletSecurityStrip: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const { t } = useTranslation("walletScreen");
  const twoFa = useSWR(API_ENDPOINTS.user.twoFaStatus, () => get<{ enabled: boolean }>(API_ENDPOINTS.user.twoFaStatus));
  const freeze = useSWR(API_ENDPOINTS.wallet.securityStatus, () => get<{ frozen: boolean }>(API_ENDPOINTS.wallet.securityStatus));
  const loading = (twoFa.isLoading && !twoFa.data) || (freeze.isLoading && !freeze.data);
  const frozen = !!freeze.data?.frozen;
  const twoFaOn = !!twoFa.data?.enabled;
  const level = frozen ? "locked" : twoFaOn ? "strong" : "standard";
  const tone = level === "locked"
    ? (isDark ? CB_TOKENS.semantic.negative.dark : CB_TOKENS.semantic.negative.light)
    : level === "strong"
      ? (isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light)
      : (isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light);
  const label = level === "locked"
    ? t("security.levelLocked", { defaultValue: "Locked" })
    : level === "strong"
      ? t("security.levelStrong", { defaultValue: "Strong" })
      : t("security.levelStandard", { defaultValue: "Standard" });
  const detail = level === "locked"
    ? t("security.stripLocked", { defaultValue: "Payout address changes are frozen after a “this wasn't me” report." })
    : level === "strong"
      ? t("security.stripStrong", { defaultValue: "One-time code on every change · undo link by email · two-factor sign-in on." })
      : t("security.stripStandard", { defaultValue: "One-time code on every change · undo link by email. Turn on two-factor sign-in to reach Strong." });
  const href = "/settings?section=security";

  return (
    <Box
      data-testid="wallet-security-strip"
      data-level={level}
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href); } }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        borderRadius: "12px",
        border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
        backgroundColor: isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
        cursor: "pointer",
        transition: "border-color 150ms ease, background-color 150ms ease",
        "&:hover": { borderColor: tone, backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(10,10,15,0.015)" },
        "&:focus-visible": { outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ width: 32, height: 32, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: `${tone}22`, color: tone }}>
        <Icon name={level === "locked" ? "lock" : "shield-check"} size={17} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <Skeleton width={220} height={18} />
        ) : (
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: theme.palette.text.primary, display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap" }}>
            <Box component="span" sx={{ fontWeight: 700 }}>{t("security.stripTitle", { defaultValue: "Payout address protection" })}:</Box>
            <Box component="span" data-testid="wallet-security-strip-level" sx={{ fontWeight: 700, color: tone }}>{label}</Box>
            <Box component="span" sx={{ color: theme.palette.text.secondary, fontSize: 12.5, display: { xs: "none", sm: "inline" } }}>· {detail}</Box>
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light, whiteSpace: "nowrap" }}>
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{t("security.stripManage", { defaultValue: "Manage in Settings" })}</Box>
        <Icon name="arrow-right" size={15} />
      </Box>
    </Box>
  );
};

export default WalletSecurityStrip;
