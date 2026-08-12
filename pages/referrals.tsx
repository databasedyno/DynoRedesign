import { brandFg } from "@/constants/theme";
import {
  Box,
  Typography,
  useTheme,
  Chip,
  Skeleton,
  LinearProgress,
  linearProgressClasses,
} from "@mui/material";
import { Icon, MONO } from "@/styles/uiKit";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import useIsMobile from "@/hooks/useIsMobile";
import axiosBaseApi from "@/axiosConfig";
import PanelCard from "@/Components/UI/PanelCard";
import Toast from "@/Components/UI/Toast";
import { pageProps } from "@/utils/types";
import copyToClipboard from "@/helpers/copyToClipboard";
import { API_ENDPOINTS } from "@/api/endpoints";

type ReferralStats = {
  referral_code: string;
  referral_link: string;
  stats: {
    total_referrals: number;
    pending_referrals: number;
    active_referrals: number;
    rewarded_referrals: number;
    total_earnings: string;
  };
};

type Referral = {
  id: number;
  referred_email: string;
  referred_name: string;
  status: string;
  created_at: string;
};

type Earnings = {
  summary: {
    total_earnings: number;
    pending_earnings: number;
    credited_earnings: number;
    withdrawn_earnings: number;
  };
  rewards: Array<{
    id: number;
    amount: number;
    status: string;
    created_at: string;
    description: string;
  }>;
};

type DiscountStatus = {
  has_discount: boolean | null;
  discount_percent: number;
  expires_at: string | null;
  reason: string | null;
  days_remaining: number;
};

type LeaderboardEntry = {
  rank: number;
  name: string;
  referral_count: number;
  is_current_user: boolean;
};

const Referrals = ({ setPageName, setPageDescription }: pageProps) => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("referrals");
  const { t: tCommon } = useTranslation("common");

  const [toast, setToast] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const referralFetcher = (url: string) =>
    axiosBaseApi.get(url).then((r) => r.data?.data);

  // Each referral endpoint gets its own SWR key → cached + deduped across
  // remounts (and shared with anything else that reads the same endpoint).
  const { data: codeRaw, isLoading: codeLoading } = useSWR<ReferralStats>(
    API_ENDPOINTS.referral.myCode,
    referralFetcher
  );
  const codeData = codeRaw ?? null;
  const { data: listData } = useSWR(API_ENDPOINTS.referral.list, referralFetcher);
  const referrals: Referral[] = listData?.referrals || [];
  const { data: earningsRaw } = useSWR<Earnings>(
    API_ENDPOINTS.referral.earnings,
    referralFetcher
  );
  const earnings = earningsRaw ?? null;
  const { data: discountRaw } = useSWR<DiscountStatus>(
    API_ENDPOINTS.referral.discountStatus,
    referralFetcher
  );
  const discount = discountRaw ?? null;
  const { data: leaderboardData } = useSWR(
    API_ENDPOINTS.referral.leaderboard,
    referralFetcher
  );
  const leaderboard: LeaderboardEntry[] = leaderboardData?.leaderboard || [];
  const loading = codeLoading && codeRaw === undefined;

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("pageTitle"));
      setPageDescription(t("pageDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  const handleCopy = useCallback((text: string, label: string) => {
    copyToClipboard(text);
    setToast({ open: true, message: label === "Referral code" ? t("referralCodeCopied") : t("referralLinkCopied"), severity: "success" });
    setTimeout(() => setToast((p) => ({ ...p, open: false })), 2000);
  }, [t]);

  const handleShare = useCallback(async () => {
    const referralLink = codeData?.referral_link;
    if (!referralLink) return;

    const shareData = {
      title: t("joinDynopay"),
      text: t("shareMessage"),
      url: referralLink,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await copyToClipboard(referralLink);
        setToast({ open: true, message: t("referralLinkCopied"), severity: "success" });
        setTimeout(() => setToast((p) => ({ ...p, open: false })), 2000);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        await copyToClipboard(referralLink);
        setToast({ open: true, message: t("referralLinkCopied"), severity: "success" });
        setTimeout(() => setToast((p) => ({ ...p, open: false })), 2000);
      }
    }
  }, [codeData?.referral_link, t]);

  // One-tap channel sharing (WhatsApp / Telegram / X) with a localized,
  // pre-filled invite message + the referral link. Pure client-side deep links.
  const shareTo = useCallback(
    (channel: "whatsapp" | "telegram" | "x") => {
      const link = codeData?.referral_link;
      if (!link) return;
      const msg = t("shareMessage");
      const urls: Record<typeof channel, string> = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`${msg} ${link}`)}`,
        telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`,
        x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(link)}`,
      };
      window.open(urls[channel], "_blank", "noopener,noreferrer");
    },
    [codeData?.referral_link, t]
  );

  const stats = codeData?.stats;

  const statCards = [
    { label: t("totalReferrals"), value: stats?.total_referrals ?? 0, icon: "users", color: brandFg(theme.palette.mode === "dark") },
    { label: t("active"), value: stats?.active_referrals ?? 0, icon: "user-plus", color: theme.palette.border.success },
    { label: t("pending"), value: stats?.pending_referrals ?? 0, icon: "users", color: "#F59E0B" },
    { label: t("totalEarnings"), value: `$${stats?.total_earnings ?? "0.00"}`, icon: "circle-dollar-sign", color: brandFg(theme.palette.mode === "dark") },
  ];

  return (
    <>
      <Head>
        <meta name="description" content="Referral program" />
      </Head>
      <Box sx={{ px: isMobile ? "16px" : 0 }}>
        {/* Referral Code Card */}
        <Box
          data-testid="referral-code-card"
          sx={{
            mb: 2.5,
            p: isMobile ? 2.5 : 3,
            borderRadius: "14px",
            border: `1px solid ${theme.palette.border.main}`,
            bgcolor: theme.palette.background.paper,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 2,
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: isMobile ? "16px" : "18px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                color: theme.palette.text.primary,
                mb: 0.5,
              }}
            >
              {t("yourReferralCode")}
            </Typography>
            {loading ? (
              <Skeleton width={200} height={32} />
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography
                  data-testid="referral-code-value"
                  sx={{
                    fontSize: isMobile ? "18px" : "22px",
                    fontFamily: MONO,
                    fontWeight: 700,
                    color: brandFg(theme.palette.mode === "dark"),
                    letterSpacing: "1px",
                  }}
                >
                  {codeData?.referral_code || "—"}
                </Typography>
                <Box
                  data-testid="copy-referral-code-btn"
                  onClick={() => handleCopy(codeData?.referral_code || "", "Referral code")}
                  sx={{
                    cursor: "pointer",
                    p: 0.75,
                    borderRadius: "8px",
                    display: "flex",
                    "&:hover": { bgcolor: theme.palette.secondary.main },
                  }}
                >
                  <Icon name="copy" size={18} color={theme.palette.text.secondary} />
                </Box>
              </Box>
            )}
          </Box>
          {!loading && codeData?.referral_link && (
            <Box sx={{ display: "flex", gap: 1.5, alignSelf: isMobile ? "flex-start" : "center", flexWrap: "wrap" }}>
              <Box
                data-testid="copy-referral-link-btn"
                onClick={() => handleCopy(codeData.referral_link, "Referral link")}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2.5,
                  py: 1.25,
                  borderRadius: "10px",
                  border: `1px solid ${theme.palette.border.main}`,
                  bgcolor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  "&:hover": { bgcolor: theme.palette.secondary.main },
                }}
              >
                <Icon name="copy" size={18} />
                <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
                  {t("copyLink")}
                </Typography>
              </Box>
              <Box
                data-testid="share-referral-btn"
                onClick={handleShare}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2.5,
                  py: 1.25,
                  borderRadius: "10px",
                  bgcolor: theme.palette.primary.main,
                  color: (theme.palette.primary as any).contrastText || "#fff",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  "&:hover": { opacity: 0.9 },
                }}
              >
                <Icon name="share-2" size={18} />
                <Typography sx={{ fontSize: "14px", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
                  {t("shareLink")}
                </Typography>
              </Box>

              {/* One-tap channel share (WhatsApp / Telegram / X) */}
              {[
                { key: "whatsapp" as const, iconName: "ri:whatsapp-fill", bg: "#25D366", label: "WhatsApp" },
                { key: "telegram" as const, iconName: "ri:telegram-fill", bg: "#229ED9", label: "Telegram" },
                { key: "x" as const, iconName: "ri:twitter-x-fill", bg: theme.palette.mode === "dark" ? "#1D1D1F" : "#000000", label: "X" },
              ].map(({ key, iconName, bg, label }) => (
                <Box
                  key={key}
                  data-testid={`share-${key}-btn`}
                  role="button"
                  aria-label={`Share on ${label}`}
                  onClick={() => shareTo(key)}
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: bg,
                    color: "#fff",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, opacity 0.15s ease",
                    "&:hover": { opacity: 0.9, transform: "translateY(-2px)" },
                  }}
                >
                  <Icon name={iconName} size={20} />
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* How It Works - Reward Explanation */}
        <Box
          data-testid="referral-how-it-works"
          sx={{
            mb: 2.5,
            p: isMobile ? 2 : 3,
            borderRadius: "14px",
            border: `1px solid ${theme.palette.border.main}`,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Typography
            sx={{
              fontSize: isMobile ? "15px" : "17px",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 2,
            }}
          >
            {t("howItWorks")}
          </Typography>

          {/* 3-step flow */}
          <Box
            sx={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 1.5 : 2,
              mb: 2.5,
            }}
          >
            {[
              { step: "1", title: t("step1Title"), desc: t("step1Desc") },
              { step: "2", title: t("step2Title"), desc: t("step2Desc") },
              { step: "3", title: t("step3Title"), desc: t("step3Desc") },
            ].map((item) => (
              <Box
                key={item.step}
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: isMobile ? "row" : "column",
                  alignItems: isMobile ? "center" : "flex-start",
                  gap: isMobile ? 1.5 : 1,
                  p: isMobile ? 1.5 : 2,
                  borderRadius: "10px",
                  bgcolor: theme.palette.secondary.main,
                }}
              >
                <Box
                  sx={{
                    width: isMobile ? 32 : 36,
                    height: isMobile ? 32 : 36,
                    borderRadius: "50%",
                    bgcolor: `${theme.palette.primary.main}14`,
                    color: brandFg(theme.palette.mode === "dark"),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 700,
                    fontSize: isMobile ? "13px" : "15px",
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: isMobile ? "13px" : "14px", fontFamily: "var(--font-sans)", fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? "11px" : "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, lineHeight: 1.4, mt: 0.25 }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Reward cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: isMobile ? 1.5 : 2,
            }}
          >
            <Box
              sx={{
                p: isMobile ? 2 : 2.5,
                borderRadius: "10px",
                border: `1px solid ${theme.palette.primary.main}30`,
                bgcolor: `${theme.palette.primary.main}08`,
              }}
            >
              <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mb: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("youGetReferrer")}
              </Typography>
              <Typography sx={{ fontSize: isMobile ? "22px" : "26px", fontFamily: "var(--font-sans)", fontWeight: 700, color: brandFg(theme.palette.mode === "dark"), lineHeight: 1.2 }}>
                {t("referrerReward")}
              </Typography>
              <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mt: 0.5 }}>
                {t("referrerRewardDesc")}
              </Typography>
            </Box>
            <Box
              sx={{
                p: isMobile ? 2 : 2.5,
                borderRadius: "10px",
                border: `1px solid ${theme.palette.border.success}30`,
                bgcolor: `${theme.palette.border.success}08`,
              }}
            >
              <Typography sx={{ fontSize: "12px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mb: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("theyGetNewUser")}
              </Typography>
              <Typography sx={{ fontSize: isMobile ? "22px" : "26px", fontFamily: "var(--font-sans)", fontWeight: 700, color: theme.palette.border.success, lineHeight: 1.2 }}>
                {t("refereeReward")}
              </Typography>
              <Typography sx={{ fontSize: "13px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mt: 0.5 }}>
                {t("refereeRewardDesc")}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Stats Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: isMobile ? 1.5 : 2,
            mb: 2.5,
          }}
        >
          {statCards.map((card) => (
            <Box
              key={card.label}
              data-testid={`referral-stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
              sx={{
                p: isMobile ? 2 : 2.5,
                borderRadius: "12px",
                border: `1px solid ${theme.palette.border.main}`,
                bgcolor: theme.palette.background.paper,
              }}
            >
              <Box
                sx={{
                  width: isMobile ? 32 : 38,
                  height: isMobile ? 32 : 38,
                  borderRadius: "10px",
                  bgcolor: `${card.color}14`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1.5,
                }}
              >
                <Icon name={card.icon} size={isMobile ? 16 : 20} color={card.color} />
              </Box>
              {loading ? (
                <Skeleton width={60} height={28} />
              ) : (
                <Typography
                  sx={{
                    fontSize: isMobile ? "20px" : "24px",
                    fontFamily: MONO,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: theme.palette.text.primary,
                    lineHeight: 1.2,
                  }}
                >
                  {card.value}
                </Typography>
              )}
              <Typography
                sx={{
                  fontSize: isMobile ? "11px" : "13px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  mt: 0.5,
                }}
              >
                {card.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Two-column layout */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? 2 : 2.5,
          }}
        >
          {/* Discount Status */}
          <Box
            data-testid="referral-discount-card"
            sx={{
              p: isMobile ? 2 : 2.5,
              borderRadius: "12px",
              border: `1px solid ${theme.palette.border.main}`,
              bgcolor: theme.palette.background.paper,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Icon name="ticket-percent" size={20} color={brandFg(theme.palette.mode === "dark")} />
              <Typography
                sx={{
                  fontSize: isMobile ? "14px" : "16px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                }}
              >
                {t("feeDiscount")}
              </Typography>
            </Box>
            {loading ? (
              <Skeleton width="100%" height={60} />
            ) : discount?.has_discount ? (
              <Box>
                <Typography
                  sx={{
                    fontSize: isMobile ? "28px" : "34px",
                    fontFamily: MONO,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    color: theme.palette.border.success,
                    lineHeight: 1.2,
                  }}
                >
                  {discount.discount_percent}% OFF
                </Typography>
                <Typography
                  sx={{
                    fontSize: "13px",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                    color: theme.palette.text.secondary,
                    mt: 0.5,
                  }}
                >
                  {discount.days_remaining > 0
                    ? t("daysRemaining", { count: discount.days_remaining })
                    : t("active")}
                  {discount.reason && ` — ${discount.reason}`}
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography
                  sx={{
                    fontSize: "14px",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                    color: theme.palette.text.secondary,
                    lineHeight: 1.5,
                  }}
                >
                  {t("noActiveFeeDiscount")}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Earnings Breakdown */}
          <Box
            data-testid="referral-earnings-card"
            sx={{
              p: isMobile ? 2 : 2.5,
              borderRadius: "12px",
              border: `1px solid ${theme.palette.border.main}`,
              bgcolor: theme.palette.background.paper,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Icon name="circle-dollar-sign" size={20} color={brandFg(theme.palette.mode === "dark")} />
              <Typography
                sx={{
                  fontSize: isMobile ? "14px" : "16px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                }}
              >
                {t("earningsBreakdown")}
              </Typography>
            </Box>
            {loading ? (
              <Skeleton width="100%" height={60} />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[
                  { label: t("credited"), value: earnings?.summary.credited_earnings ?? 0 },
                  { label: t("pending"), value: earnings?.summary.pending_earnings ?? 0 },
                  { label: t("withdrawn"), value: earnings?.summary.withdrawn_earnings ?? 0 },
                ].map((row) => (
                  <Box
                    key={row.label}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "13px",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 500,
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {row.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontFamily: MONO,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      ${typeof row.value === "number" ? row.value.toFixed(2) : row.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Referral List */}
        <Box
          data-testid="referral-list"
          sx={{
            mt: 2.5,
            p: isMobile ? 2 : 2.5,
            borderRadius: "12px",
            border: `1px solid ${theme.palette.border.main}`,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Icon name="users" size={20} color={brandFg(theme.palette.mode === "dark")} />
            <Typography
              sx={{
                fontSize: isMobile ? "14px" : "16px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              {t("myReferrals")}
            </Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Skeleton width="100%" height={40} />
              <Skeleton width="100%" height={40} />
            </Box>
          ) : referrals.length === 0 ? (
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                color: theme.palette.text.secondary,
                py: 3,
                textAlign: "center",
              }}
            >
              {t("noReferralsYet")}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {referrals.map((r, i) => (
                <Box
                  key={r.id || i}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    p: isMobile ? "10px 12px" : "12px 16px",
                    borderRadius: "10px",
                    bgcolor: theme.palette.secondary.main,
                  }}
                >
                  <Box>
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {r.referred_name || r.referred_email}
                    </Typography>
                    {r.referred_name && (
                      <Typography
                        sx={{
                          fontSize: "12px",
                          fontFamily: "var(--font-sans)",
                          color: theme.palette.text.secondary,
                        }}
                      >
                        {r.referred_email}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={r.status}
                    size="small"
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      fontWeight: 600,
                      bgcolor:
                        r.status === "active"
                          ? theme.palette.success.main
                          : r.status === "pending"
                            ? "#FEF3CD"
                            : theme.palette.secondary.main,
                      color:
                        r.status === "active"
                          ? theme.palette.border.success
                          : r.status === "pending"
                            ? "#856404"
                            : theme.palette.text.secondary,
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Leaderboard */}
        <Box
          data-testid="referral-leaderboard"
          sx={{
            mt: 2.5,
            mb: 4,
            p: isMobile ? 2 : 2.5,
            borderRadius: "12px",
            border: `1px solid ${theme.palette.border.main}`,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Icon name="trophy" size={20} color="#F59E0B" />
            <Typography
              sx={{
                fontSize: isMobile ? "14px" : "16px",
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              {t("leaderboard")}
            </Typography>
          </Box>
          {loading ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Skeleton width="100%" height={40} />
              <Skeleton width="100%" height={40} />
            </Box>
          ) : leaderboard.length === 0 ? (
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                color: theme.palette.text.secondary,
                py: 3,
                textAlign: "center",
              }}
            >
              {t("leaderboardEmpty")}
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {leaderboard.map((entry, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: isMobile ? "10px 12px" : "12px 16px",
                    borderRadius: "10px",
                    bgcolor: entry.is_current_user
                      ? theme.palette.primary.light
                      : theme.palette.secondary.main,
                    border: entry.is_current_user
                      ? `1px solid ${theme.palette.primary.main}`
                      : "none",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "15px",
                      fontFamily: MONO,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                      color: entry.rank <= 3 ? "#F59E0B" : theme.palette.text.secondary,
                      minWidth: 24,
                    }}
                  >
                    #{entry.rank}
                  </Typography>
                  <Typography
                    sx={{
                      flex: 1,
                      fontSize: "14px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                    }}
                  >
                    {entry.name}
                    {entry.is_current_user && ` ${t("you")}`}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 600,
                      color: brandFg(theme.palette.mode === "dark"),
                    }}
                  >
                    {t("referralsCount", { count: entry.referral_count })}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} />
    </>
  );
};

export default Referrals;
