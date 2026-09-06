import React, { useCallback } from "react";
import { Box, Typography, IconButton, Skeleton, useTheme, Tooltip } from "@mui/material";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { useApiSWR } from "@/hooks/useApiSWR";
import {
  CardGiftcardRounded,
  ContentCopyRounded,
  IosShareRounded,
  ArrowOutward,
} from "@mui/icons-material";

import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { MONO } from "@/styles/uiKit";
import copyToClipboard from "@/helpers/copyToClipboard";
import { API_ENDPOINTS } from "@/api/endpoints";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { brandFg } from "@/constants/theme";
import { CB_TOKENS } from "./coinbase/styled";
import { DASH_PANEL_SX, DASH_PANEL_HEADER_SX } from "./v2026/styled";

/**
 * ReferralCodeCard — a persistent dashboard card that ALWAYS surfaces the
 * merchant's referral code + one-tap copy/share, independent of the rotating
 * "Grow with Dynopay" slot (which only shows the referral *offer* when no
 * higher-priority offer wins, and never the code itself).
 *
 * Data comes from GET /api/referral/my-code (same SWR key the /referrals page
 * uses, so it's cached + deduped across both surfaces).
 */

type ReferralCode = {
  referral_code: string;
  referral_link: string;
  stats?: {
    total_referrals?: number;
    total_earnings?: string;
  };
};

const ReferralCodeCard: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  // Quiet Money: brand indigo instead of the old referral pink so the rail
  // carries ONE accent.
  const ACCENT = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const hairline = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation(["referrals", "dashboardLayout"]);

  const { data, isLoading } = useApiSWR<ReferralCode>(
    API_ENDPOINTS.referral.myCode,
    { unwrap: true, revalidateOnFocus: false }
  );

  const code = data?.referral_code || "";
  const link = data?.referral_link || "";
  const loading = isLoading && data === undefined;

  const notify = useCallback(
    (message: string, severity: "success" | "error" = "success") => {
      dispatch({ type: TOAST_SHOW, payload: { message, severity } });
    },
    [dispatch]
  );

  const handleCopyCode = useCallback(async () => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    notify(
      ok ? t("referralCodeCopied") : t("copyCode"),
      ok ? "success" : "error"
    );
  }, [code, notify, t]);

  const handleShare = useCallback(async () => {
    if (!link) return;
    const shareData = {
      title: t("joinDynopay"),
      text: t("shareMessage"),
      url: link,
    };
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.(shareData)
      ) {
        await navigator.share(shareData);
        return;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
    const ok = await copyToClipboard(link);
    notify(
      ok ? t("referralLinkCopied") : t("copyLink"),
      ok ? "success" : "error"
    );
  }, [link, notify, t]);

  const totalReferrals = Number(data?.stats?.total_referrals ?? 0);
  const totalEarnings = data?.stats?.total_earnings ?? "0.00";

  return (
    <Box sx={{ px: { xs: 2, md: 0 } }} data-testid="dashboard-referral-card">
      <PanelCard
        sx={DASH_PANEL_SX}
        headerSx={DASH_PANEL_HEADER_SX}
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
        bodyPadding={theme.spacing(2, 2.5, 2.5, 2.5)}
        title={t("yourReferralCode")}
        subTitle={t("shareYourCode")}
        headerIcon={
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow,
              color: ACCENT,
              flexShrink: 0,
            }}
          >
            <CardGiftcardRounded sx={{ fontSize: 20 }} />
          </Box>
        }
        headerAction={
          <Typography
            component="button"
            onClick={() => router.push("/referrals")}
            data-testid="referral-card-view-program"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: 600,
              color: theme.palette.text.secondary,
              p: 0,
              "&:hover": {
                color: brandFg(isDark),
                textDecoration: "underline",
              },
            }}
          >
            {t("pageTitle")}
            <ArrowOutward sx={{ fontSize: 13 }} />
          </Typography>
        }
        headerActionLayout="inline"
      >
        {/* Referral code + copy */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.25,
            borderRadius: "12px",
            px: 1.75,
            py: 1.25,
            border: `1px solid ${hairline}`,
            backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "#FAFAFC",
          }}
        >
          {loading ? (
            <Skeleton
              variant="text"
              width={140}
              height={28}
              sx={{ bgcolor: isDark ? "rgba(255,255,255,0.08)" : undefined }}
            />
          ) : (
            <Typography
              data-testid="referral-card-code"
              sx={{
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: "17px",
                letterSpacing: "0.04em",
                fontVariantNumeric: "tabular-nums",
                color: theme.palette.text.primary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {code || "—"}
            </Typography>
          )}
          <Tooltip title={t("copyCode")}>
            <span>
              <IconButton
                aria-label={t("copyCode")}
                onClick={handleCopyCode}
                disabled={!code}
                size="small"
                data-testid="referral-card-copy-code"
                sx={{ color: ACCENT }}
              >
                <ContentCopyRounded sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
          <CustomButton
            label={t("copyLink")}
            variant="outlined"
            size="small"
            fullWidth
            startIcon={<ContentCopyRounded sx={{ fontSize: 15 }} />}
            onClick={async () => {
              if (!link) return;
              const ok = await copyToClipboard(link);
              notify(
                ok ? t("referralLinkCopied") : t("copyLink"),
                ok ? "success" : "error"
              );
            }}
            disabled={!link}
          />
          <CustomButton
            label={t("shareLink")}
            variant="primary"
            size="small"
            fullWidth
            startIcon={<IosShareRounded sx={{ fontSize: 15 }} />}
            onClick={handleShare}
            disabled={!link}
          />
        </Box>

        {/* Tiny stats caption */}
        <Typography
          sx={{
            mt: 1.5,
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: theme.palette.text.secondary,
            textAlign: "center",
          }}
        >
          {t("totalReferrals")}: <b>{totalReferrals}</b> &nbsp;·&nbsp;{" "}
          {t("totalEarnings")}: <b>${totalEarnings}</b>
        </Typography>
      </PanelCard>
    </Box>
  );
};

export default ReferralCodeCard;
