import { brandFg } from "@/constants/theme";
import { formatDateI18n } from "@/utils/formatDate";
import {
  Box,
  Typography,
  useTheme,
  Chip,
  Skeleton,
} from "@mui/material";
import { Icon, MONO } from "@/styles/uiKit";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiSWR } from "@/hooks/useApiSWR";
import useIsMobile from "@/hooks/useIsMobile";
import Toast from "@/Components/UI/Toast";
import { pageProps } from "@/utils/types";
import copyToClipboard from "@/helpers/copyToClipboard";
import { API_ENDPOINTS } from "@/api/endpoints";
import PayoutCard from "@/Components/Page/Referrals/PayoutCard";
import ReferralLinkHero from "@/Components/Page/Referrals/ReferralLinkHero";
import ReferralZeroState from "@/Components/Page/Referrals/ReferralZeroState";
import ReferralEarningsCard from "@/Components/Page/Referrals/ReferralEarningsCard";
import { toFixedStr } from "@/utils/money";

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
  referred_email: string | null;
  referred_name: string | null;
  status: string;
  created_at: string;
  /** Wave 3d — reward status per referral. */
  reward_status?: "pending" | "earned" | "paid";
  accrued_usd?: number;
  paid_usd?: number;
  unpaid_usd?: number;
  commission_window_ends_at?: string | null;
};

type Earnings = {
  summary: {
    total_earnings: number;
    pending_earnings: number;
    credited_earnings: number;
    withdrawn_earnings: number;
  };
  commission?: {
    rate_percent: number;
    window_months: number;
    total_accrued_usd: number;
    total_paid_usd: number;
    unpaid_balance_usd: number;
    active_windows: number;
    referrals: Array<{
      referral_id: number;
      referred_user_id: number;
      referred_name?: string | null;
      referred_email?: string | null;
      status: string;
      accrued_usd: number;
      paid_usd: number;
      unpaid_usd: number;
      commission_rate: number;
      window_ends_at: string | null;
      days_remaining: number | null;
    }>;
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

  const [toast, setToast] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  /* Wave 3d — reward status per referral: pending (nothing earned yet) →
     earned (accrued, unpaid balance) → paid (everything accrued was paid/credited). */
  const renderRewardChip = (r: Referral) => {
    const rs = r.reward_status || "pending";
    const isDark = theme.palette.mode === "dark";
    const palette = {
      pending: { fg: isDark ? "#FBBF24" : "#B45309", bg: isDark ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.12)", icon: "clock" },
      earned: { fg: isDark ? "#5AC8FA" : "#2775CA", bg: isDark ? "rgba(39,117,202,0.18)" : "rgba(39,117,202,0.10)", icon: "coins" },
      paid: { fg: isDark ? "#3FD98A" : "#05936A", bg: isDark ? "rgba(5,177,105,0.16)" : "rgba(5,177,105,0.10)", icon: "circle-check" },
    }[rs];
    const amount = rs === "earned" ? r.unpaid_usd : rs === "paid" ? r.paid_usd : undefined;
    const label =
      rs === "pending"
        ? t("rewardPending", { defaultValue: "Reward pending" })
        : rs === "earned"
          ? t("rewardEarned", { amount: toFixedStr(amount || 0, 2), defaultValue: "Earned ${{amount}}" })
          : t("rewardPaid", { amount: toFixedStr(amount || 0, 2), defaultValue: "Paid ${{amount}}" });
    return (
      <Box
        component="span"
        data-testid={`referral-reward-${r.id}`}
        data-reward={rs}
        title={rs === "pending" ? (t("rewardPendingTip", { defaultValue: "Earns once they complete a qualifying payment." }) as string) : undefined}
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: 999, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 700, color: palette.fg, backgroundColor: palette.bg, whiteSpace: "nowrap" }}
      >
        <Icon name={palette.icon} size={12} />
        {label}
      </Box>
    );
  };

  // Each referral endpoint gets its own SWR key → cached + deduped across
  // remounts (and shared with anything else that reads the same endpoint).
  const { data: codeRaw, isLoading: codeLoading } = useApiSWR<ReferralStats>(
    API_ENDPOINTS.referral.myCode,
    { unwrap: true }
  );
  const codeData = codeRaw ?? null;
  const { data: listData } = useApiSWR<{ referrals?: Referral[] }>(API_ENDPOINTS.referral.list, { unwrap: true });
  const referrals: Referral[] = listData?.referrals || [];
  const { data: earningsRaw } = useApiSWR<Earnings>(
    API_ENDPOINTS.referral.earnings,
    { unwrap: true }
  );
  const earnings = earningsRaw ?? null;
  const { data: discountRaw } = useApiSWR<DiscountStatus>(
    API_ENDPOINTS.referral.discountStatus,
    { unwrap: true }
  );
  const discount = discountRaw ?? null;
  const { data: leaderboardData } = useApiSWR<{ leaderboard?: LeaderboardEntry[] }>(
    API_ENDPOINTS.referral.leaderboard,
    { unwrap: true }
  );
  const leaderboard: LeaderboardEntry[] = leaderboardData?.leaderboard || [];
  const loading = codeLoading && codeRaw === undefined;

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("pageTitle"));
      setPageDescription(t("pageDescription"));
    }
  }, [setPageName, setPageDescription, t]);

  const handleCopy = useCallback((text: string, label: "Referral code" | "Referral link") => {
    copyToClipboard(text);
    setToast({ open: true, message: label === "Referral code" ? t("referralCodeCopied") : t("referralLinkCopied"), severity: "success" });
    setTimeout(() => setToast((p) => ({ ...p, open: false })), 2000);
  }, [t]);

  const showToast = useCallback((message: string, severity: "success" | "error") => {
    setToast({ open: true, message, severity });
    setTimeout(() => setToast((p) => ({ ...p, open: false })), 3500);
  }, []);

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

  const hasActivity =
    (stats?.total_referrals ?? 0) > 0 ||
    referrals.length > 0 ||
    (earnings?.commission?.total_accrued_usd ?? 0) > 0 ||
    Number(earnings?.summary?.total_earnings ?? 0) > 0;
  const zeroState = !loading && !hasActivity;

  return (
    <>
      <Box sx={{ px: isMobile ? "16px" : 0 }} style={{ "--font-sans": "var(--font-inter)", fontFamily: "var(--font-inter)" } as any}>
        <ReferralLinkHero
          code={codeData?.referral_code}
          link={codeData?.referral_link}
          loading={loading}
          showHowToggle={!zeroState}
          onCopy={handleCopy}
          onShare={handleShare}
          onShareTo={shareTo}
        />

        {/* Your own sign-up discount (only when one is running) */}
        {discount?.has_discount && (
          <Box
            data-testid="referral-discount-card"
            sx={{ mb: 2.5, display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", px: 2, py: 1.5, borderRadius: "12px", border: `1px solid ${theme.palette.border.main}`, bgcolor: theme.palette.background.paper }}
          >
            <Icon name="ticket-percent" size={18} color={theme.palette.border.success} />
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>
              {t("feeDiscount")}: <Box component="span" sx={{ fontFamily: MONO, color: theme.palette.border.success }}>{discount.discount_percent}% OFF</Box>
            </Typography>
            <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary }}>
              {discount.days_remaining > 0 ? t("daysRemaining", { count: discount.days_remaining }) : t("active")}
              {discount.reason && ` — ${discount.reason}`}
            </Typography>
          </Box>
        )}

        {zeroState ? (
          <ReferralZeroState />
        ) : (
          <>
            <ReferralEarningsCard earnings={earnings} stats={stats} loading={loading} />
        {/* Cash-out — opt-in USDT (TRC-20) payout (Phase 2) */}
        <PayoutCard isMobile={isMobile} onToast={showToast} />

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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                py: 4,
                px: 2,
                textAlign: "center",
              }}
              data-testid="referrals-list-empty"
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: theme.palette.secondary.main,
                  color: brandFg(theme.palette.mode === "dark"),
                }}
              >
                <Icon name="user-plus" size={22} />
              </Box>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  maxWidth: 320,
                  lineHeight: 1.5,
                }}
              >
                {t("noReferralsYet")}
              </Typography>
            </Box>
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
                    <Typography
                      sx={{
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        color: theme.palette.text.secondary,
                      }}
                    >
                      {[r.referred_name ? r.referred_email : null, r.created_at ? t("joinedOn", { date: formatDateI18n(r.created_at), defaultValue: "Joined {{date}}" }) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Chip
                      label={t(`refStatus_${r.status}`, { defaultValue: r.status })}
                      size="small"
                      data-testid={`referral-status-${r.id}`}
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
                    {renderRewardChip(r)}
                  </Box>
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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                py: 4,
                px: 2,
                textAlign: "center",
              }}
              data-testid="referrals-leaderboard-empty"
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: theme.palette.secondary.main,
                  color: "#F59E0B",
                }}
              >
                <Icon name="trophy" size={22} />
              </Box>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  maxWidth: 320,
                  lineHeight: 1.5,
                }}
              >
                {t("leaderboardEmpty")}
              </Typography>
            </Box>
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
          </>
        )}
      </Box>

      <Toast open={toast.open} message={toast.message} severity={toast.severity} />
    </>
  );
};

export default Referrals;
