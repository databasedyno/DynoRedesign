import React, { memo, useEffect, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { keyframes } from "@mui/system";
import { useRouter } from "next/router";
import { useTranslation, Trans } from "react-i18next";
import ArrowForward from "@mui/icons-material/ArrowForward";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import CardGiftcardRoundedIcon from "@mui/icons-material/CardGiftcardRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { AuroraInk, HeadlineXL, Eyebrow, Body } from "./styled.v3";
import { jumpToSection } from "./landingSections";
import useLocalPrice from "@/hooks/useLocalPrice";
import { BRAND_ACCENT } from "@/constants/theme";

// Order-total demo amounts (merchant checkout, not tip jar) + the stablecoin
// each auto-settles into. Rotates so the mock reads as a real store checkout.
const AMOUNTS = [12, 29, 49, 84, 120, 250];
const STORES = ["Acme Store", "Nova Goods", "Bean & Co.", "Studio Ky", "Lumen Shop", "Peak Gear"];
const SETTLE_COINS = ["USDC", "USDT", "USDT", "USDC", "USDT", "USDC"];

// Lightweight CSS entrances (replaces framer-motion — keeps it out of the
// landing's initial JS bundle). Disabled under prefers-reduced-motion at the
// call site via a CSS media query.
const heroCardIn = keyframes`
  from { opacity: 0; transform: translateY(30px) rotate(-2deg); }
  to   { opacity: 1; transform: translateY(0) rotate(-2deg); }
`;
const heroAmountIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const heroCopyIn = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const heroArrowBob = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(3px); }
`;
const HERO_JUMP_LINKS = [
  { id: "how-it-works", key: "howitworks" },
  { id: "compare", key: "compare" },
  { id: "developers", key: "developers" },
  { id: "faq", key: "faq" },
] as const;
// Staggered load-in for the hero copy column (CSS-only: paints before hydration).
const heroIn = (delay: number) => ({
  animation: `${heroCopyIn} 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const HeroPlayground: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  // Country-aware ceremonial prices (PT → EUR, etc.).
  const { fmt, code } = useLocalPrice();
  // Respect prefers-reduced-motion without framer-motion (gates the cycling timer).
  const [reduced, setReduced] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const iv = setInterval(() => setIdx((i) => (i + 1) % AMOUNTS.length), 2400);
    return () => clearInterval(iv);
  }, [reduced]);

  const scrollTo = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const store = STORES[idx];
  const coin = SETTLE_COINS[idx % SETTLE_COINS.length];

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        overflow: "hidden",
        background: s.bg,
        pt: { xs: 12, md: 17 },
        pb: { xs: 10, md: 12 },
      }}
    >
      {/* Soft indigo orb behind hero (minimal single-accent) */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: { xs: "-20%", md: "-30%" },
          right: { xs: "-30%", md: "-10%" },
          width: { xs: 620, md: 900 },
          height: { xs: 620, md: 900 },
          borderRadius: "50%",
          background: BRAND_ACCENT,
          filter: "blur(140px)",
          opacity: s.dark ? 0.06 : 0.045,
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1280,
          mx: "auto",
          px: { xs: 3, md: 5 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
          alignItems: "center",
          gap: { xs: 8, md: 12 },
        }}
      >
        {/* LEFT — one clear promise + one primary action */}
        <Box>
          <Eyebrow tone="coral" sx={{ mb: 3, display: "inline-flex", alignItems: "center", gap: 1, ...heroIn(0) }}>
            <Box
              component="span"
              sx={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: BRAND_ACCENT,
                boxShadow: "0 0 0 4px rgba(79, 70, 229,0.18)",
              }}
            />
            {t("v3.hero.eyebrow")}
          </Eyebrow>

          <HeadlineXL component="h1" sx={{ color: s.ink, mb: 3, ...heroIn(0.08) }}>
            {t("v3.hero.headline1")}
            <br />
            <AuroraInk>{t("v3.hero.headlineHighlight")}</AuroraInk> {t("v3.hero.headline2")}
          </HeadlineXL>

          <Body sx={{ color: s.ink2, maxWidth: 520, mb: 4.5, fontSize: { xs: 16, md: 18 }, ...heroIn(0.16) }}>
            <Trans i18nKey="v3.hero.body" ns="landing" components={{ b: <b style={{ color: s.ink }} /> }} />
          </Body>

          {/* ONE primary action + a quiet secondary */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", ...heroIn(0.24) }}>
            <Button
              data-testid="hero-primary-cta"
              onClick={() => router.push("/auth/register?ref=hero_primary")}
              endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
              sx={{
                borderRadius: "999px",
                px: 3.5,
                py: 1.5,
                textTransform: "none",
                fontFamily: FONT_BODY,
                fontSize: 16,
                fontWeight: 600,
                color: "#fff",
                background: `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #4338CA 100%)`,
                boxShadow: "0 12px 30px -10px rgba(79, 70, 229,0.6)",
                "&:hover": {
                  background: "linear-gradient(135deg, #6366F1 0%, #4338CA 100%)",
                  boxShadow: "0 14px 34px -10px rgba(79, 70, 229,0.72)",
                },
              }}
            >
              {t("v3.hero.primaryCta")}
            </Button>
            <Button
              data-testid="hero-secondary-cta"
              onClick={() => scrollTo("how-it-works")}
              sx={{
                borderRadius: "999px",
                px: 2.5,
                py: 1.4,
                textTransform: "none",
                fontFamily: FONT_BODY,
                fontSize: 15,
                fontWeight: 500,
                color: s.ink,
                border: `1px solid ${s.lineStrong}`,
                background: "transparent",
                "&:hover": { borderColor: BRAND_ACCENT, background: "transparent", color: BRAND_ACCENT },
              }}
            >
              {t("v3.hero.secondaryCta")}
            </Button>
          </Box>

          {/* Reward hook — the real "first payment fee-free" offer (bookended in the closing CTA) */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              mt: 3,
              px: 1.75,
              py: 0.9,
              borderRadius: "999px",
              background: s.dark ? "rgba(79, 70, 229,0.14)" : "rgba(79, 70, 229,0.09)",
              border: "1px solid rgba(79, 70, 229,0.35)",
              ...heroIn(0.32),
            }}
          >
            <CardGiftcardRoundedIcon sx={{ fontSize: 17, color: BRAND_ACCENT }} />
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: s.dark ? "#818CF8" : "#4338CA" }}>
              <Trans i18nKey="v3.hero.rewardBadge" ns="landing" components={{ b: <b /> }} />
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 3, mt: 3, flexWrap: "wrap", ...heroIn(0.38) }}>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: s.ink3, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {t("v3.hero.bullets")}
            </Typography>
          </Box>

          {/* Trust microcopy — honest legitimacy signals */}
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mt: 1.75, ...heroIn(0.42) }}>
            <ShieldRoundedIcon sx={{ fontSize: 14, color: s.ink3 }} />
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, letterSpacing: "0.1em" }}>
              {t("v3.hero.trustLine")}
            </Typography>
          </Box>

          {/* Quiet secondary path for creators — kept, but not competing */}
          <Typography
            data-testid="hero-creator-link"
            onClick={() => router.push("/for/creators")}
            sx={{
              mt: 2.5,
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              color: s.ink3,
              cursor: "pointer",
              "&:hover": { color: BRAND_ACCENT },
              "& span": { color: BRAND_ACCENT, fontWeight: 600 },
              ...heroIn(0.46),
            }}
          >
            <Trans i18nKey="v3.hero.creatorLink" ns="landing" components={{ s: <span /> }} />
          </Typography>

          {/* Quick jump links — the page is long; let visitors skip straight to what they came for. */}
          <Box
            component="nav"
            aria-label={t("v3.nav.explore")}
            data-testid="hero-jump-links"
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: { xs: 1.25, sm: 2 },
              mt: 4,
              pt: 3,
              borderTop: `1px solid ${s.line}`,
              ...heroIn(0.54),
            }}
          >
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                fontFamily: FONT_TECH,
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: s.ink3,
                mr: 0.5,
              }}
            >
              {t("v3.nav.explore")}
              <ArrowDownwardRoundedIcon
                sx={{
                  fontSize: 14,
                  animation: `${heroArrowBob} 1.8s ease-in-out infinite`,
                  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
              />
            </Box>
            {HERO_JUMP_LINKS.map(({ id, key }) => (
              <Box
                key={id}
                component="a"
                href={`#${id}`}
                data-testid={`hero-jump-${id}`}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  jumpToSection(id);
                }}
                sx={{
                  fontFamily: FONT_TECH,
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  color: s.ink2,
                  textDecoration: "none",
                  pb: "2px",
                  borderBottom: `1px solid ${s.line}`,
                  transition: "color 160ms ease, border-color 160ms ease",
                  "&:hover": { color: s.indigo, borderColor: s.indigo },
                  "&:focus-visible": { outline: `2px solid ${s.indigo}`, outlineOffset: 3, borderRadius: 2 },
                }}
              >
                {t(`v3.nav.${key}`)}
              </Box>
            ))}
          </Box>
        </Box>

        {/* RIGHT — checkout demo card (supporting visual, clearly a demo) */}
        <Box sx={{ position: "relative", display: "flex", justifyContent: "center", perspective: "1200px" }}>
          <Box
            sx={{
              width: "100%",
              maxWidth: 420,
              transform: "rotate(-2deg)",
              animation: `${heroCardIn} 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s both`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            <Box
              data-testid="hero-checkout-demo"
              sx={{
                position: "relative",
                borderRadius: "28px",
                background: "linear-gradient(180deg, #FFFFFF 0%, #FDFDFB 100%)",
                border: `1px solid ${s.lineStrong}`,
                boxShadow: "0 40px 80px -30px rgba(10,10,10,0.35), 0 12px 24px -14px rgba(79, 70, 229,0.25)",
                p: 3.5,
                overflow: "hidden",
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  top: -80,
                  right: -80,
                  width: 240,
                  height: 240,
                  borderRadius: "50%",
                  background: BRAND_ACCENT,
                  filter: "blur(60px)",
                  opacity: 0.1,
                }}
              />
              <Box sx={{ position: "relative", zIndex: 1 }}>
                {/* Header — store identity + "Live demo" chip */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "12px",
                      background: "#0A0A0A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontFamily: FONT_HERO,
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {store[0]}
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 16, color: "#0A0A0A", lineHeight: 1.1 }}>
                      {store}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: "#71717A", mt: 0.25, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      <LockRoundedIcon sx={{ fontSize: 12 }} /> {t("v3.hero.demoCheckout")}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Box
                    data-testid="hero-demo-pill"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      px: 1,
                      py: 0.4,
                      borderRadius: "999px",
                      background: "rgba(10,10,10,0.05)",
                      border: "1px solid rgba(10,10,10,0.10)",
                    }}
                  >
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10, color: "#52525B", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {t("v3.hero.demoLabel")}
                    </Typography>
                  </Box>
                </Box>

                {/* Amount due */}
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#71717A", mb: 1 }}>
                  {t("v3.hero.amountDueLabel")}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 2.5 }}>
                  <Box
                    key={idx}
                    sx={{
                      animation: `${heroAmountIn} 0.4s cubic-bezier(0.16,1,0.3,1) both`,
                      "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                    }}
                  >
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 44, color: "#0A0A0A", letterSpacing: "-0.03em", lineHeight: 1 }}>
                      {fmt(AMOUNTS[idx])}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, color: "#71717A", fontWeight: 500 }} data-testid="hero-settle-path">
                    {code} → {coin}
                  </Typography>
                </Box>

                {/* Example order chips */}
                <Box sx={{ display: "flex", gap: 0.75, mb: 2.5, flexWrap: "wrap" }}>
                  {AMOUNTS.map((val, i) => (
                    <Box
                      key={val}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        borderRadius: "999px",
                        border: `1px solid ${i === idx ? BRAND_ACCENT : "rgba(10,10,10,0.10)"}`,
                        background: i === idx ? "rgba(79, 70, 229,0.10)" : "transparent",
                        color: i === idx ? "#4338CA" : "#3F3F46",
                        fontFamily: FONT_TECH,
                        fontSize: 12.5,
                        fontWeight: 600,
                        transition: "all .3s ease",
                      }}
                    >
                      {fmt(val)}
                    </Box>
                  ))}
                </Box>

                {/* Demo "Pay" button — visual only, not a competing action */}
                <Box
                  aria-hidden
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    borderRadius: "14px",
                    py: 1.4,
                    fontFamily: FONT_BODY,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #4338CA 100%)`,
                    boxShadow: "0 10px 22px -8px rgba(79, 70, 229,0.55)",
                    userSelect: "none",
                    cursor: "default",
                  }}
                >
                  <LockRoundedIcon sx={{ fontSize: 17 }} />
                  {t("v3.hero.payBtn")} {fmt(AMOUNTS[idx])}
                </Box>

                {/* Meta row — honest settlement line */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2.5, pt: 2, borderTop: `1px dashed ${s.line}` }}>
                  <BoltRoundedIcon sx={{ fontSize: 15, color: "#5A6B00" }} />
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: "#3F3F46" }}>
                    <Trans i18nKey="v3.hero.metaSettle" ns="landing" components={{ b: <b /> }} />
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HeroPlayground);
