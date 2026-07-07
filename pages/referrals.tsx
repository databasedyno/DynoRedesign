import {
  Box,
  Typography,
  useTheme,
  Chip,
  Skeleton,
  LinearProgress,
  linearProgressClasses,
} from "@mui/material";
import {
  PeopleAltRounded,
  EmojiEventsRounded,
  MonetizationOnRounded,
  DiscountRounded,
  ContentCopyRounded,
  ShareRounded,
  PersonAddRounded,
  WhatsApp,
  Telegram,
  Twitter,
} from "@mui/icons-material";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useIsMobile from "@/hooks/useIsMobile";
import axiosBaseApi from "@/axiosConfig";
import PanelCard from "@/Components/UI/PanelCard";
import Toast from "@/Components/UI/Toast";
import { pageProps } from "@/utils/types";

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

  const [loading, setLoading] = useState(true);
  const [codeData, setCodeData] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [discount, setDiscount] = useState<DiscountStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("pageTitle"));
      setPageDescription(t("pageDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [codeRes, listRes, earningsRes, discountRes, leaderboardRes] =
          await Promise.allSettled([
            axiosBaseApi.get("/referral/my-code"),
            axiosBaseApi.get("/referral/list"),
            axiosBaseApi.get("/referral/earnings"),
            axiosBaseApi.get("/referral/discount-status"),
            axiosBaseApi.get("/referral/leaderboard"),
          ]);

        if (codeRes.status === "fulfilled") setCodeData(codeRes.value.data.data);
        if (listRes.status === "fulfilled") setReferrals(listRes.value.data.data.referrals || []);
        if (earningsRes.status === "fulfilled") setEarnings(earningsRes.value.data.data);
        if (discountRes.status === "fulfilled") setDiscount(discountRes.value.data.data);
        if (leaderboardRes.status === "fulfilled") setLeaderboard(leaderboardRes.value.data.data.leaderboard || []);
      } catch {
        // Individual errors handled by allSettled
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
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
        await navigator.clipboard.writeText(referralLink);
        setToast({ open: true, message: t("referralLinkCopied"), severity: "success" });
        setTimeout(() => setToast((p) => ({ ...p, open: false })), 2000);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        await navigator.clipboard.writeText(referralLink);
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
    { label: t("totalReferrals"), value: stats?.total_referrals ?? 0, icon: PeopleAltRounded, color: theme.palette.primary.main },
    { label: t("active"), value: stats?.active_referrals ?? 0, icon: PersonAddRounded, color: theme.palette.border.success },
    { label: t("pending"), value: stats?.pending_referrals ?? 0, icon: PeopleAltRounded, color: "#F59E0B" },
    { label: t("totalEarnings"), value: `$${stats?.total_earnings ?? "0.00"}`, icon: MonetizationOnRounded, color: theme.palette.primary.main },
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
                fontFamily: "UrbanistSemibold",
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
                    fontFamily: "UrbanistSemibold",
                    fontWeight: 700,
                    color: theme.palette.primary.main,
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
                  <ContentCopyRounded sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
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
                <ContentCopyRounded sx={{ fontSize: 18 }} />
                <Typography sx={{ fontSize: "14px", fontFamily: "UrbanistSemibold", fontWeight: 600 }}>
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
                <ShareRounded sx={{ fontSize: 18 }} />
                <Typography sx={{ fontSize: "14px", fontFamily: "UrbanistSemibold", fontWeight: 600 }}>
                  {t("shareLink")}
                </Typography>
              </Box>

              {/* One-tap channel share (WhatsApp / Telegram / X) */}
              {[
                { key: "whatsapp" as const, Icon: WhatsApp, bg: "#25D366", label: "WhatsApp" },
                { key: "telegram" as const, Icon: Telegram, bg: "#229ED9", label: "Telegram" },
                { key: "x" as const, Icon: Twitter, bg: theme.palette.mode === "dark" ? "#1D1D1F" : "#000000", label: "X" },
              ].map(({ key, Icon, bg, label }) => (
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
                  <Icon sx={{ fontSize: 20 }} />
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
              fontFamily: "UrbanistSemibold",
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
                    color: theme.palette.primary.main,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "UrbanistSemibold",
                    fontWeight: 700,
                    fontSize: isMobile ? "13px" : "15px",
                    flexShrink: 0,
                  }}
                >
                  {item.step}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: isMobile ? "13px" : "14px", fontFamily: "UrbanistSemibold", fontWeight: 600, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: isMobile ? "11px" : "12px", fontFamily: "UrbanistMedium", color: theme.palette.text.secondary, lineHeight: 1.4, mt: 0.25 }}>
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
              <Typography sx={{ fontSize: "12px", fontFamily: "UrbanistMedium", color: theme.palette.text.secondary, mb: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("youGetReferrer")}
              </Typography>
              <Typography sx={{ fontSize: isMobile ? "22px" : "26px", fontFamily: "UrbanistSemibold", fontWeight: 700, color: theme.palette.primary.main, lineHeight: 1.2 }}>
                {t("referrerReward")}
              </Typography>
              <Typography sx={{ fontSize: "13px", fontFamily: "UrbanistMedium", color: theme.palette.text.secondary, mt: 0.5 }}>
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
              <Typography sx={{ fontSize: "12px", fontFamily: "UrbanistMedium", color: theme.palette.text.secondary, mb: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("theyGetNewUser")}
              </Typography>
              <Typography sx={{ fontSize: isMobile ? "22px" : "26px", fontFamily: "UrbanistSemibold", fontWeight: 700, color: theme.palette.border.success, lineHeight: 1.2 }}>
                {t("refereeReward")}
              </Typography>
              <Typography sx={{ fontSize: "13px", fontFamily: "UrbanistMedium", color: theme.palette.text.secondary, mt: 0.5 }}>
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
                <card.icon sx={{ fontSize: isMobile ? 16 : 20, color: card.color }} />
              </Box>
              {loading ? (
                <Skeleton width={60} height={28} />
              ) : (
                <Typography
                  sx={{
                    fontSize: isMobile ? "20px" : "24px",
                    fontFamily: "UrbanistSemibold",
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
                  fontFamily: "UrbanistMedium",
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
              <DiscountRounded sx={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography
                sx={{
                  fontSize: isMobile ? "14px" : "16px",
                  fontFamily: "UrbanistSemibold",
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
                    fontFamily: "UrbanistSemibold",
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
                    fontFamily: "UrbanistMedium",
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
                    fontFamily: "UrbanistMedium",
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
              <MonetizationOnRounded sx={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography
                sx={{
                  fontSize: isMobile ? "14px" : "16px",
                  fontFamily: "UrbanistSemibold",
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
                        fontFamily: "UrbanistMedium",
                        fontWeight: 500,
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {row.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontFamily: "UrbanistSemibold",
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
            <PeopleAltRounded sx={{ fontSize: 20, color: theme.palette.primary.main }} />
            <Typography
              sx={{
                fontSize: isMobile ? "14px" : "16px",
                fontFamily: "UrbanistSemibold",
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
                fontFamily: "UrbanistMedium",
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
                        fontFamily: "UrbanistSemibold",
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
                          fontFamily: "UrbanistMedium",
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
                      fontFamily: "UrbanistSemibold",
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
            <EmojiEventsRounded sx={{ fontSize: 20, color: "#F59E0B" }} />
            <Typography
              sx={{
                fontSize: isMobile ? "14px" : "16px",
                fontFamily: "UrbanistSemibold",
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
                fontFamily: "UrbanistMedium",
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
                      fontFamily: "UrbanistSemibold",
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
                      fontFamily: "UrbanistSemibold",
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
                      fontFamily: "UrbanistSemibold",
                      fontWeight: 600,
                      color: theme.palette.primary.main,
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
