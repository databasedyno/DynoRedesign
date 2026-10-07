import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import { GRAIN_URL } from "@/constants/creatorTheme";

const FONT_DISPLAY = "var(--font-hero), var(--font-sans), sans-serif";
const FONT_BODY = "var(--font-body), var(--font-sans), sans-serif";
const FONT_MONO = "var(--font-tech), var(--font-mono), monospace";

const GOLD = "#FFD100";

type Signal = {
  key: "custody" | "chains" | "settlement" | "compliance";
  Icon: typeof LockRoundedIcon;
  title: string;
  desc: string;
};

/**
 * Auth trust panel (login + register, desktop lg+).
 *
 * Restrained, mostly-static "trust split" (Bybit/Stripe style). Replaces the
 * old animated marketing reel (rotating scenes, wallet count-up, coin marquee)
 * with a calm typographic block + concrete, HONEST trust signals. A single
 * entrance reveal is the only motion; nothing loops. Hidden on mobile — the
 * form column renders its own TrustStrip there.
 */
const AuthBrandPanel = () => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";

  const accent = dark ? GOLD : "#8B5E00";
  const ink = theme.palette.text.primary;
  const sub = dark ? "rgba(255,255,255,0.62)" : "rgba(10,10,10,0.6)";
  const line = dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.85)";
  const glass = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)";

  const label = {
    fontFamily: FONT_MONO,
    fontSize: "11px",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
  };

  const signals: Signal[] = [
    {
      key: "custody",
      Icon: LockRoundedIcon,
      title: t("brandTrustCustodyTitle", { defaultValue: "Non-custodial" }),
      desc: t("brandTrustCustodyDesc", { defaultValue: "Payments settle straight to a wallet you control — we never hold your funds." }),
    },
    {
      key: "chains",
      Icon: HubRoundedIcon,
      title: t("brandTrustChainsTitle", { defaultValue: "9 chains · 15 assets" }),
      desc: t("brandTrustChainsDesc", { defaultValue: "BTC, ETH, SOL, USDT, USDC, XRP, BNB, TRX & Polygon." }),
    },
    {
      key: "settlement",
      Icon: BoltRoundedIcon,
      title: t("brandTrustSettlementTitle", { defaultValue: "Instant settlement" }),
      desc: t("brandTrustSettlementDesc", { defaultValue: "On-chain, with no holding periods. Fees from 0.5%." }),
    },
    {
      key: "compliance",
      Icon: VerifiedUserRoundedIcon,
      title: t("brandTrustComplianceTitle", { defaultValue: "Security & compliance" }),
      desc: t("brandTrustComplianceDesc", { defaultValue: "KYC/AML above threshold, encrypted & hardened key infrastructure." }),
    },
  ];

  const footerItems = [
    t("brandFooterStatus", { defaultValue: "Public status page" }),
    t("brandFooterCompliance", { defaultValue: "KYC/AML compliant" }),
    t("brandFooterFee", { defaultValue: "Fees from 0.5%" }),
  ];

  return (
    <Box
      component="aside"
      aria-label="Dynopay"
      data-testid="auth-brand-panel"
      sx={{
        position: "relative",
        overflow: "hidden",
        flex: "1 1 0",
        maxWidth: 600,
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        justifyContent: "center",
        borderRadius: "28px",
        padding: "40px",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(139,94,0,0.12)"}`,
        background: dark
          ? "radial-gradient(130% 100% at 100% 0%, rgba(255,209,0,0.10) 0%, transparent 46%), linear-gradient(160deg, #121216 0%, #0A0A0D 100%)"
          : "radial-gradient(130% 100% at 100% 0%, rgba(255,209,0,0.10) 0%, transparent 46%), linear-gradient(160deg, #FFFFFF 0%, #EEF1F5 100%)",
        boxShadow: dark
          ? "0 40px 90px -56px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)"
          : "0 46px 100px -60px rgba(139,94,0,0.3), inset 0 1px 0 rgba(255,255,255,0.9)",
        animation: "authRise 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both",
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        "@keyframes authRise": {
          from: { opacity: 0, transform: "translateY(14px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      {/* Subtle film grain for depth */}
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN_URL, opacity: dark ? 0.06 : 0.04, mixBlendMode: "overlay", pointerEvents: "none" }} />

      <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "26px" }}>
        {/* Eyebrow — static non-custodial pill */}
        <Box
          data-testid="auth-trust-eyebrow"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            alignSelf: "flex-start",
            px: "13px",
            py: "7px",
            borderRadius: "999px",
            background: glass,
            border: `1px solid ${line}`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
          <Typography sx={{ ...label, color: dark ? "rgba(255,255,255,0.82)" : "rgba(10,10,10,0.72)", fontWeight: 600 }}>
            {t("brandTrustBadge", { defaultValue: "Non-custodial · direct settlement" })}
          </Typography>
        </Box>

        {/* Headline + value line */}
        <Box>
          <Typography
            component="h2"
            data-testid="auth-trust-headline"
            sx={{
              m: 0,
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: "30px",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              color: ink,
            }}
          >
            {t("brandHeadlineLine1", { defaultValue: "Accept crypto." })}{" "}
            <Box component="span" sx={{ color: accent }}>
              {t("brandHeadlineLine2", { defaultValue: "Settled straight to your wallet." })}
            </Box>
          </Typography>
          <Typography
            data-testid="auth-trust-subheadline"
            sx={{ mt: "14px", maxWidth: 460, fontFamily: FONT_BODY, fontSize: "14px", lineHeight: 1.55, color: sub }}
          >
            {t("brandSubheadline", {
              defaultValue:
                "Funds settle on-chain, straight to a wallet you control — across 9 blockchains and 15 assets. No custody. No lock-ups.",
            })}
          </Typography>
        </Box>

        {/* Trust signals — 2x2, static */}
        <Box data-testid="auth-trust-grid" sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
          {signals.map((s) => (
            <Box
              key={s.key}
              data-testid={`auth-trust-card-${s.key}`}
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                p: "18px",
                borderRadius: "16px",
                border: `1px solid ${line}`,
                background: cardBg,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "11px",
                  display: "grid",
                  placeItems: "center",
                  background: dark ? "rgba(255,209,0,0.12)" : "rgba(255,209,0,0.16)",
                  color: accent,
                }}
              >
                <s.Icon sx={{ fontSize: 19 }} />
              </Box>
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "14.5px", letterSpacing: "-0.01em", color: ink }}>
                {s.title}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: "12.5px", lineHeight: 1.45, color: sub }}>
                {s.desc}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Transparency footer bar */}
        <Box
          data-testid="auth-trust-footer"
          sx={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", borderTop: `1px solid ${line}`, pt: "18px" }}
        >
          {footerItems.map((txt, i) => (
            <React.Fragment key={txt}>
              {i > 0 && <Box sx={{ width: 3, height: 3, borderRadius: "50%", background: sub }} />}
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11.5px", fontWeight: 600, letterSpacing: "0.02em", color: dark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.62)" }}>
                {txt}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default AuthBrandPanel;
