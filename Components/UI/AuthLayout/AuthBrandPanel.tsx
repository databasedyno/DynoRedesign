import React, { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import { BRAND_ACCENT } from "@/constants/theme";

const FONT_DISPLAY = "var(--font-hero), sans-serif";
const FONT_BODY = "var(--font-body), sans-serif";
const FONT_MONO = "var(--font-tech), monospace";

const COINS = [
  { s: "BTC", c: "#F7931A" },
  { s: "ETH", c: "#627EEA" },
  { s: "USDT", c: "#26A17B" },
  { s: "USDC", c: "#2775CA" },
  { s: "SOL", c: "#9945FF" },
  { s: "BNB", c: "#F0B90B" },
  { s: "XRP", c: "#23292F" },
  { s: "TRX", c: "#EF0027" },
];

const SLIDES = ["checkout", "dashboard", "link"] as const;
const BARS = [30, 46, 38, 60, 52, 76, 92];

/**
 * Expressive auth hero panel (login + register only, desktop lg+).
 * Reserved indigo→violet aurora surface with a glass social-proof badge, a
 * glowing headline, and a cycling DEVICE-MOCKUP carousel (hosted checkout →
 * live dashboard → payment link) so new merchants see the product in action.
 * The pill dots double as carousel indicators. Hidden below lg.
 */
const AuthBrandPanel = () => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const accent = dark ? "#818CF8" : BRAND_ACCENT;
  const accentPulse = dark ? "rgba(129,140,248,0.55)" : "rgba(79,70,229,0.5)";
  const sub = dark ? "rgba(255,255,255,0.62)" : "rgba(10,10,10,0.6)";
  const ink = theme.palette.text.primary;

  const [slide, setSlide] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 3600);
    return () => clearInterval(id);
  }, []);

  // Panel surface — kept subtle in light so the dark headline/body stays AA.
  const panelBg = dark
    ? "radial-gradient(135% 120% at 100% 0%, rgba(139,92,246,0.22) 0%, transparent 46%), radial-gradient(120% 120% at 0% 100%, rgba(99,102,241,0.24) 0%, transparent 52%), linear-gradient(158deg, #0C1022 0%, #090C16 100%)"
    : "radial-gradient(135% 120% at 100% 0%, rgba(139,92,246,0.13) 0%, transparent 46%), radial-gradient(120% 120% at 0% 100%, rgba(99,102,241,0.14) 0%, transparent 52%), linear-gradient(158deg, #FBFAFF 0%, #F0F1FE 100%)";
  const panelBorder = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(67,56,202,0.12)";
  const panelShadow = dark
    ? "0 40px 90px -50px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)"
    : "0 46px 100px -56px rgba(67,56,202,0.4), inset 0 1px 0 rgba(255,255,255,0.9)";

  // Device-mockup screen tokens.
  const frameBg = dark ? "#0C1020" : "#FFFFFF";
  const frameBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.08)";
  const chipBg = dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.035)";
  const line = dark ? "rgba(255,255,255,0.09)" : "rgba(10,10,10,0.07)";
  const label = {
    fontFamily: FONT_MONO,
    fontSize: "9.5px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: sub,
  };

  const urls = ["pay.dynopay.io/nova-store", "app.dynopay.io/dashboard", "dynopay.io/pay/nova"];

  const CoinChip: React.FC<{ label: string; active?: boolean }> = ({ label: l, active }) => (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: "9px",
        py: "5px",
        borderRadius: "999px",
        border: `1px solid ${active ? accent : line}`,
        background: active ? (dark ? "rgba(129,140,248,0.16)" : "rgba(79,70,229,0.09)") : "transparent",
        color: active ? accent : sub,
        fontFamily: FONT_MONO,
        fontSize: "11px",
        fontWeight: 600,
      }}
    >
      {l}
    </Box>
  );

  const renderSlide = (key: (typeof SLIDES)[number]) => {
    if (key === "checkout") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "11px", height: "100%" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "13px", color: ink }}>
              Nova Store
            </Typography>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: "4px", ...label }}>
              <LockRoundedIcon sx={{ fontSize: 11 }} /> SECURE
            </Box>
          </Box>
          <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: "30px", letterSpacing: "-0.03em", color: ink, lineHeight: 1 }}>
            $42.00
          </Typography>
          <Box sx={{ display: "flex", gap: "7px" }}>
            <CoinChip label="BTC" />
            <CoinChip label="ETH" />
            <CoinChip label="USDT" active />
          </Box>
          <Box
            sx={{
              mt: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              borderRadius: "11px",
              py: "11px",
              background: BRAND_ACCENT,
              color: "#fff",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: "13.5px",
              boxShadow: "0 10px 24px -12px rgba(79,70,229,0.7)",
            }}
          >
            {t("brandSlidePayBtn", { defaultValue: "Pay $42.00" })}
          </Box>
        </Box>
      );
    }
    if (key === "dashboard") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%" }}>
          <Typography sx={label}>{t("brandSlideVolume", { defaultValue: "Total volume" })}</Typography>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
            <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: "27px", letterSpacing: "-0.03em", color: ink, lineHeight: 1 }}>
              $128,940
            </Typography>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: "2px", color: dark ? "#4ADE80" : "#15803D", fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700, mb: "2px" }}>
              <ArrowUpwardRounded sx={{ fontSize: 13 }} /> 18%
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: "8px", height: 62, mt: "2px" }}>
            {BARS.map((h, i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  height: `${h}%`,
                  borderRadius: "5px 5px 3px 3px",
                  background: i === BARS.length - 1 ? accent : dark ? "rgba(129,140,248,0.28)" : "rgba(79,70,229,0.22)",
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: "flex", gap: "8px", mt: "auto" }}>
            {[
              t("brandSlidePayments", { defaultValue: "217 payments" }),
              t("brandSlideChains", { defaultValue: "9 chains live" }),
            ].map((txt) => (
              <Box key={txt} sx={{ flex: 1, px: "10px", py: "7px", borderRadius: "9px", background: chipBg, border: `1px solid ${line}`, fontFamily: FONT_MONO, fontSize: "10.5px", fontWeight: 600, color: sub }}>
                {txt}
              </Box>
            ))}
          </Box>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
        <Typography sx={label}>{t("brandSlideLinkLabel", { defaultValue: "Payment link" })}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", px: "12px", py: "10px", borderRadius: "11px", background: chipBg, border: `1px solid ${line}` }}>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: "12px", fontWeight: 600, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            dynopay.io/pay/nova
          </Typography>
          <ContentCopyRounded sx={{ fontSize: 15, color: accent }} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "12px", mt: "auto" }}>
          <Box sx={{ p: "6px", borderRadius: "10px", background: "#fff", border: `1px solid ${line}`, lineHeight: 0 }}>
            <QRCodeSVG value="https://dynopay.io/pay/nova" size={56} level="M" bgColor="#FFFFFF" fgColor="#0A0A0A" />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "14px", color: ink }}>
              {t("brandSlideScan", { defaultValue: "Scan or share to get paid" })}
            </Typography>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: "4px", mt: "6px", color: accent, fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 600 }}>
              <BoltRounded sx={{ fontSize: 13 }} /> {t("brandSlideInstant", { defaultValue: "Instant settlement" })}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      component="aside"
      aria-label="Dynopay"
      data-testid="auth-brand-panel"
      sx={{
        position: "relative",
        overflow: "hidden",
        flex: "1 1 0",
        maxWidth: 560,
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        gap: "18px",
        borderRadius: "28px",
        padding: "34px 34px 30px",
        background: panelBg,
        border: panelBorder,
        boxShadow: panelShadow,
      }}
    >
      {/* Drifting aurora blobs */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "-14%",
          right: "-10%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${dark ? "rgba(129,140,248,0.4)" : "rgba(99,102,241,0.18)"} 0%, transparent 68%)`,
          filter: "blur(14px)",
          pointerEvents: "none",
          animation: "auroraA 16s ease-in-out infinite alternate",
          "@keyframes auroraA": {
            "0%": { transform: "translate(0,0) scale(1)" },
            "100%": { transform: "translate(-30px,26px) scale(1.12)" },
          },
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: "-16%",
          left: "-12%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${dark ? "rgba(139,92,246,0.34)" : "rgba(139,92,246,0.16)"} 0%, transparent 68%)`,
          filter: "blur(16px)",
          pointerEvents: "none",
          animation: "auroraB 20s ease-in-out infinite alternate",
          "@keyframes auroraB": {
            "0%": { transform: "translate(0,0) scale(1.05)" },
            "100%": { transform: "translate(34px,-22px) scale(1)" },
          },
        }}
      />

      {/* Content */}
      <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Social-proof glass badge */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            alignSelf: "flex-start",
            px: "13px",
            py: "7px",
            borderRadius: "999px",
            background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)",
            border: `1px solid ${frameBorder}`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: dark ? "none" : "0 12px 30px -20px rgba(31,41,55,0.4)",
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 10px ${accent}`,
              animation: "badgePulse 2.2s ease-in-out infinite",
              "@keyframes badgePulse": {
                "0%,100%": { boxShadow: `0 0 0 0 ${accentPulse}` },
                "50%": { boxShadow: "0 0 0 6px rgba(129,140,248,0)" },
              },
            }}
          />
          <Typography
            sx={{
              fontFamily: FONT_MONO,
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: dark ? "rgba(255,255,255,0.82)" : "rgba(10,10,10,0.72)",
            }}
          >
            {t("brandTrustBadge", { defaultValue: "Non-custodial · funds go straight to you" })}
          </Typography>
        </Box>

        {/* Headline */}
        <Box>
          <Typography
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: "30px",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              color: ink,
              textShadow: dark ? "0 0 44px rgba(129,140,248,0.28)" : "none",
            }}
          >
            {t("brandHeadlineLine1")}{" "}
            <Box component="span" sx={{ color: accent }}>
              {t("brandHeadlineLine2")}
            </Box>
          </Typography>
        </Box>

        {/* Device-mockup carousel */}
        <Box
          data-testid="auth-brand-carousel"
          sx={{
            position: "relative",
            height: 250,
            borderRadius: "18px",
            overflow: "hidden",
            background: frameBg,
            border: `1px solid ${frameBorder}`,
            boxShadow: dark
              ? "0 30px 60px -34px rgba(0,0,0,0.8)"
              : "0 30px 60px -34px rgba(31,41,55,0.28)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Browser chrome */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px", px: "14px", py: "10px", borderBottom: `1px solid ${line}` }}>
            <Box sx={{ display: "flex", gap: "6px" }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: dark ? 0.9 : 1 }} />
              ))}
            </Box>
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", px: "10px", py: "5px", borderRadius: "7px", background: chipBg, border: `1px solid ${line}` }}>
              <LockRoundedIcon sx={{ fontSize: 10, color: sub }} />
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "10.5px", color: sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {urls[slide]}
              </Typography>
            </Box>
          </Box>

          {/* Screen — one slide at a time with a keyed fade-in (no ghosting) */}
          <Box sx={{ position: "relative", flex: 1 }}>
            <Box
              key={slide}
              sx={{
                position: "absolute",
                inset: 0,
                p: "15px 17px",
                background: frameBg,
                animation: "brandSlideIn .5s cubic-bezier(0.16,1,0.3,1) both",
                "@keyframes brandSlideIn": {
                  from: { opacity: 0, transform: "translateY(10px)" },
                  to: { opacity: 1, transform: "none" },
                },
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                pointerEvents: "none",
              }}
            >
              {renderSlide(SLIDES[slide])}
            </Box>
          </Box>
        </Box>

        {/* Caption + pill-dot indicators */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: "13px", color: sub }}>
            {slide === 0 && t("brandSlideCheckout", { defaultValue: "Hosted crypto checkout" })}
            {slide === 1 && t("brandSlideDashboard", { defaultValue: "Real-time settlement dashboard" })}
            {slide === 2 && t("brandSlideLinkCap", { defaultValue: "Shareable payment links" })}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px" }}>
            {SLIDES.map((key, i) => (
              <Box
                key={key}
                component="button"
                type="button"
                aria-label={`Show ${key}`}
                data-testid={`auth-brand-dot-${i}`}
                onClick={() => setSlide(i)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  width: slide === i ? 22 : 6,
                  height: 6,
                  borderRadius: "999px",
                  background: slide === i ? accent : dark ? "rgba(255,255,255,0.22)" : "rgba(10,10,10,0.16)",
                  transition: "width .3s ease, background-color .3s ease",
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Compact stat row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {[
            `9 ${t("brandStatBusinessesLabel")}`,
            t("brandStatFee", { defaultValue: "fees from 0.5%" }),
            t("brandStatSettle", { defaultValue: "instant settlement" }),
          ].map((txt, i) => (
            <React.Fragment key={txt}>
              {i > 0 && <Box sx={{ width: 3, height: 3, borderRadius: "50%", background: sub }} />}
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11.5px", fontWeight: 600, letterSpacing: "0.02em", color: dark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.62)" }}>
                {txt}
              </Typography>
            </React.Fragment>
          ))}
        </Box>

        {/* Coin marquee */}
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "14px",
            border: `1px solid ${frameBorder}`,
            background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.66)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            py: "12px",
            maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: "28px",
              width: "max-content",
              animation: "coinMarquee 22s linear infinite",
              "@keyframes coinMarquee": {
                "0%": { transform: "translateX(0)" },
                "100%": { transform: "translateX(-50%)" },
              },
            }}
          >
            {[...COINS, ...COINS].map((coin, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: coin.c }} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: "13px", fontWeight: 600, color: ink, opacity: 0.85 }}>
                  {coin.s}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AuthBrandPanel;
