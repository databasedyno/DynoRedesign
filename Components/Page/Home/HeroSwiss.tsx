import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import useCountry from "@/hooks/useCountry";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";

const EASE = [0.16, 1, 0.3, 1] as const;
const container = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } } };

const CountUp: React.FC<{ end: number; delayMs?: number; suffix?: string }> = ({ end, delayMs = 500, suffix = "" }) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      setValue(end);
      return;
    }
    const DURATION = 1400;
    let start: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / DURATION, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * end));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      if (timer) clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, delayMs]);

  return <span className="tabular-nums">{value.toLocaleString("en-US")}{suffix}</span>;
};

interface TermLine {
  text: string;
  tone: "cmd" | "dim" | "blue" | "volt";
}

const TERMINAL_LINES: TermLine[] = [
  { text: "$ dynopay listen --wallet TXk4…9fQ2mAhR", tone: "cmd" },
  { text: "  watching 15+ chains for incoming payments…", tone: "dim" },
  { text: "→ payment_detected    250.00 USDT · TRC-20", tone: "blue" },
  { text: "✓ confirmed           block 61,204,117 · 4.2s", tone: "volt" },
  { text: "✓ forwarded_to_wallet TXk4…9fQ2mAhR · fee 0.7%", tone: "volt" },
  { text: "→ webhook_delivered   payment.completed · 200 OK", tone: "dim" },
];

const TerminalWindow: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const toneColor: Record<TermLine["tone"], string> = {
    cmd: "#E4E4E7",
    dim: "rgba(255,255,255,0.45)",
    blue: "#7CB1FF",
    volt: "#CCFF00",
  };

  return (
    <Box
      data-testid="hero-terminal"
      sx={{
        width: "100%",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        backgroundColor: "rgba(8,8,10,0.92)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 40px 90px -40px rgba(0,0,0,0.75), 0 0 60px rgba(204,255,0,0.06)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, borderBottom: "1px solid rgba(255,255,255,0.09)" }}>
        <Box sx={{ display: "flex", gap: 0.6 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: c }} />
          ))}
        </Box>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: FONT_TECH }}>
          settlement.log
        </Typography>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#CCFF00", animation: reduced ? "none" : "swiss-pulse 2.2s ease-in-out infinite" }} />
          <Typography sx={{ fontSize: 10.5, letterSpacing: "0.14em", color: "#CCFF00", fontFamily: FONT_TECH }}>LIVE</Typography>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 2.75 }, py: { xs: 2, sm: 2.5 } }}>
        {TERMINAL_LINES.map((l, i) => (
          <motion.div
            key={i}
            initial={reduced ? { opacity: 1 } : { opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: reduced ? 0 : 0.5 + i * 0.4, ease: EASE }}
          >
            <Typography
              component="pre"
              sx={{
                m: 0,
                py: 0.35,
                fontSize: { xs: 11.5, sm: 13 },
                lineHeight: 1.6,
                color: toneColor[l.tone],
                fontFamily: FONT_TECH,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {l.text}
            </Typography>
          </motion.div>
        ))}
        <Typography component="pre" sx={{ m: 0, pt: 0.5, fontSize: { xs: 11.5, sm: 13 }, fontFamily: FONT_TECH, color: "#CCFF00" }}>
          <Box component="span" sx={{ animation: reduced ? "none" : "swiss-blink 1.1s step-end infinite" }}>▮</Box>
        </Typography>
      </Box>

      <Box sx={{ px: 2.75, py: 1.1, borderTop: "1px solid rgba(255,255,255,0.09)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: FONT_TECH, letterSpacing: "0.06em" }}>
          NON-CUSTODIAL · FUNDS NEVER HELD
        </Typography>
        <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: FONT_TECH, letterSpacing: "0.06em" }}>
          SETTLED IN 4.2s
        </Typography>
      </Box>
    </Box>
  );
};

type AudienceKey = "merchant" | "creator" | "campaign" | "developer";

interface Audience {
  key: AudienceKey;
  accent: string;
  href: string;
}

// Audience tabs — order + accents mirror AudienceDoors (Merchants · Creators · Fundraisers · Developers).
const AUDIENCES: Audience[] = [
  { key: "merchant", accent: "#3B82F6", href: "/auth/register?ref=hero_merchant" },
  { key: "creator", accent: "#F472B6", href: "/auth/register?ref=hero_creator" },
  { key: "campaign", accent: "#CCFF00", href: "/auth/register?ref=hero_fundraiser" },
  { key: "developer", accent: "#7CB1FF", href: "/documentation" },
];

const HeroSwiss: React.FC = () => {
  const s = useSwiss();
  const router = useRouter();
  const { country } = useCountry();
  const { t } = useTranslation("landing");
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const [active, setActive] = useState<AudienceKey>("merchant");
  const activeAudience = AUDIENCES.find((a) => a.key === active) || AUDIENCES[0];

  const goPrimary = useCallback(() => {
    router.push(activeAudience.href);
  }, [router, activeAudience.href]);

  const goCalculator = useCallback(() => {
    document.getElementById("fee-calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const trustLine =
    country?.country && country?.flag
      ? `${country.flag} ${t("heroTrustCountry", { country: country.country })}`
      : t("heroTrustGeneric");

  const gridLine = s.dark ? "rgba(255,255,255,0.055)" : "rgba(10,10,10,0.055)";

  return (
    <Box component="section" id="hero" aria-labelledby="hero-heading" sx={{ position: "relative", overflow: "hidden" }}>
      {/* Geometric grid backdrop */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
          backgroundSize: "54px 54px",
          maskImage: "radial-gradient(ellipse 95% 80% at 50% 0%, black 25%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 95% 80% at 50% 0%, black 25%, transparent 78%)",
        }}
      />
      {/* Tracing beams */}
      {!reduced && (
        <>
          <Box aria-hidden className="swiss-beam" sx={{ position: "absolute", top: 107, width: 260, height: "1px", background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`, animation: "swiss-beam 7s linear infinite", pointerEvents: "none" }} />
          <Box aria-hidden className="swiss-beam" sx={{ position: "absolute", top: 323, width: 200, height: "1px", opacity: 0.55, background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`, animation: "swiss-beam 9s linear infinite", animationDelay: "3.2s", pointerEvents: "none" }} />
        </>
      )}

      <Box
        component={motion.div}
        initial="hidden"
        animate="show"
        variants={container}
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1400,
          mx: "auto",
          px: { xs: 3, md: 6 },
          pt: { xs: 6, md: 11 },
          pb: { xs: 7, md: 12 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.08fr 0.92fr" },
          gap: { xs: 6, lg: 8 },
          alignItems: "center",
        }}
      >
        {/* ==== LEFT: type ==== */}
        <Box sx={{ textAlign: "left" }}>
          <motion.div variants={item}>
            <Typography
              component="p"
              sx={{
                fontFamily: FONT_TECH,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: s.accentText,
                mb: 3,
              }}
            >
              [ {t("heroCleanEyebrow")} ]
            </Typography>
          </motion.div>

          <Box
            component={motion.div}
            variants={item}
            data-testid="hero-audience-tabs"
            role="tablist"
            aria-label={t("doors.eyebrow", { defaultValue: "Who's this for?" })}
            sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 2, md: 3 }, mb: 3 }}
          >
            {AUDIENCES.map((a) => {
              const isActive = a.key === active;
              return (
                <Box
                  key={a.key}
                  component="button"
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`hero-tab-${a.key}`}
                  onClick={() => setActive(a.key)}
                  sx={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    p: 0,
                    pb: 0.75,
                    fontFamily: FONT_TECH,
                    fontSize: { xs: 11.5, md: 12.5 },
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: isActive ? s.txt : s.faint,
                    fontWeight: isActive ? 600 : 500,
                    borderBottom: "2px solid",
                    borderColor: isActive ? a.accent : "transparent",
                    transition: "color 0.2s ease, border-color 0.2s ease",
                    "&:hover": { color: isActive ? s.txt : s.sub },
                  }}
                >
                  {t(`heroTabs.${a.key}`, { defaultValue: a.key })}
                </Box>
              );
            })}
          </Box>

          <Typography id="hero-heading" component={motion.h1} variants={item} sx={{ m: 0 }}>
            <Box
              component="span"
              sx={{
                display: "block",
                fontFamily: FONT_HERO,
                fontWeight: 800,
                fontSize: { xs: 34, sm: 46, md: 54 },
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                color: s.txt,
              }}
            >
              {t("heroSwissTitle1")}
            </Box>
            <Box
              component="span"
              sx={{
                display: "block",
                fontFamily: FONT_HERO,
                fontWeight: 300,
                fontSize: { xs: 26, sm: 36, md: 42 },
                lineHeight: 1.18,
                letterSpacing: "-0.02em",
                color: s.txt,
                mt: 1.25,
                minHeight: { xs: 62, sm: 86, md: 100 },
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <Box
                  key={active}
                  component={motion.span}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  sx={{ display: "inline" }}
                >
                  {t(`heroAudience.${active}.title2`, { defaultValue: "" })}
                </Box>
              </AnimatePresence>
              <Box component="span" sx={{ color: activeAudience.accent, ml: 0.75, animation: reduced ? "none" : "swiss-blink 1.1s step-end infinite" }}>▮</Box>
            </Box>
          </Typography>

          <Typography
            component={motion.p}
            variants={item}
            sx={{
              fontFamily: FONT_BODY,
              fontSize: { xs: 15, md: 17 },
              lineHeight: 1.65,
              color: s.sub,
              maxWidth: 560,
              mt: 3,
              mb: 4.5,
              minHeight: { xs: 80, md: 56 },
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <Box
                key={active}
                component={motion.span}
                initial={reduced ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                sx={{ display: "block" }}
              >
                {t(`heroAudience.${active}.subtitle`, { defaultValue: t("heroCleanSubtitle") })}
              </Box>
            </AnimatePresence>
          </Typography>

          <Box component={motion.div} variants={item} sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mb: 5 }}>
            <Box
              component="button"
              type="button"
              onClick={goPrimary}
              data-testid="hero-cta-primary"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 4,
                py: 1.9,
                borderRadius: "999px",
                border: "none",
                cursor: "pointer",
                backgroundColor: s.accent,
                color: "#0A0A0A",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 16,
                boxShadow: s.dark
                  ? "0 10px 30px -10px rgba(204,255,0,0.5)"
                  : "0 10px 30px -12px rgba(10,10,10,0.45)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  filter: "brightness(1.03)",
                  boxShadow: s.dark
                    ? "0 16px 40px -12px rgba(204,255,0,0.6)"
                    : "0 16px 40px -12px rgba(10,10,10,0.55)",
                },
              }}
            >
              {t(`heroAudience.${active}.cta`, { defaultValue: t("startAcceptingCrypto") })} <ArrowForward sx={{ fontSize: 18 }} />
            </Box>
            <Box
              component="button"
              type="button"
              onClick={goCalculator}
              data-testid="hero-cta-secondary"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 3.25,
                py: 1.75,
                borderRadius: "999px",
                border: `1.5px solid ${s.line}`,
                background: "none",
                cursor: "pointer",
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 15,
                color: s.txt,
                transition: "border-color 0.2s ease, color 0.2s ease, background 0.2s ease",
                "&:hover": {
                  borderColor: s.accent,
                  color: s.accentText,
                  background: s.dark ? "rgba(204,255,0,0.06)" : "rgba(10,10,10,0.03)",
                },
              }}
            >
              {t("heroSwissCtaSecondary")} ↓
            </Box>
          </Box>

          {/* Stats — mono, left-aligned, divided */}
          <Box component={motion.div} variants={item} data-testid="hero-stats-row" sx={{ display: "flex", alignItems: "stretch", flexWrap: "wrap" }}>
            {[
              { value: <CountUp end={1000} suffix="+" delayMs={600} />, label: t("heroStatBusinesses"), testId: "hero-stat-businesses" },
              { value: <CountUp end={15} suffix="+" delayMs={750} />, label: t("heroStatChains"), testId: "hero-stat-chains" },
              { value: <span>{"<1 min"}</span>, label: t("heroStatSettlement"), testId: "hero-stat-settlement" },
            ].map((st, i) => (
              <Box
                key={st.testId}
                data-testid={st.testId}
                sx={{
                  pr: { xs: 2.5, md: 4 },
                  mr: { xs: 2.5, md: 4 },
                  borderRight: i < 2 ? `1px solid ${s.line}` : "none",
                }}
              >
                <Typography component="span" sx={{ display: "block", fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 20, md: 24 }, letterSpacing: "-0.02em", color: s.txt, lineHeight: 1.2 }}>
                  {st.value}
                </Typography>
                <Typography component="span" sx={{ display: "block", fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: s.faint, mt: 0.5 }}>
                  {st.label}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography component={motion.p} variants={item} sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: s.faint, mt: 3 }}>
            {trustLine}
          </Typography>
        </Box>

        {/* ==== RIGHT: settlement terminal ==== */}
        <Box component={motion.div} variants={item} sx={{ width: "100%", maxWidth: { xs: 560, lg: "none" }, mx: { xs: "auto", lg: 0 } }}>
          <TerminalWindow reduced={reduced} />
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.1em", color: s.faint, mt: 1.5, textAlign: "center" }}>
            // REAL SETTLEMENT FLOW · REPLAYED
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HeroSwiss);
