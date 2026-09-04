import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useInView } from "framer-motion";
import { Reveal } from "./Reveal";
import { useTranslation } from "react-i18next";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { toFixedStr } from "@/utils/money";

interface Stat {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  /** When set, renders this string verbatim instead of the CountUp number. */
  display?: string;
  label: string;
  sub: string;
  color: string;
}

const CountUp: React.FC<{ end: number; decimals?: number; delayMs?: number }> = ({ end, decimals = 0, delayMs = 200 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      setVal(end);
      return;
    }
    const DURATION = 1400;
    let raf = 0;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / DURATION, 1);
      setVal((1 - Math.pow(1 - p, 3)) * end);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [inView, end, delayMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {decimals > 0 ? toFixedStr(val, decimals) : Math.round(val).toLocaleString("en-US")}
    </span>
  );
};

const NumbersTrustBand: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");

  const STATS: Stat[] = [
    { value: 1.5, suffix: "%", decimals: 1, label: t("v3.numbers.feeLabel"), sub: t("v3.numbers.feeSub"), color: BRAND_ACCENT },
    { value: 9, display: "9", suffix: "", label: t("v3.numbers.chainsLabel"), sub: t("v3.numbers.chainsSub"), color: BRAND_ACCENT },
    { value: 0, display: "0", label: t("v3.numbers.chargebacksLabel"), sub: t("v3.numbers.chargebacksSub"), color: BRAND_ACCENT },
    { value: 0, display: "24/7", label: t("v3.numbers.alwaysOnLabel"), sub: t("v3.numbers.alwaysOnSub"), color: BRAND_ACCENT },
  ];

  const BADGES = [
    { icon: SecurityRoundedIcon, label: t("v3.numbers.badgeEncrypted"), ink: "#0A0A0A" },
    { icon: VerifiedUserRoundedIcon, label: t("v3.numbers.badgeKYC"), ink: "#0A0A0A" },
    { icon: GavelRoundedIcon, label: t("v3.numbers.badgeGDPR"), ink: "#0A0A0A" },
    { icon: PolicyRoundedIcon, label: t("v3.numbers.badgeNonCustodial"), ink: "#0A0A0A" },
  ];

  return (
    <Box component="section" sx={{ background: s.bg, py: { xs: 10, md: 16 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: { xs: 5, md: 8 } }}>
          <Box sx={{ maxWidth: 620 }}>
            <Eyebrow sx={{ mb: 2 }}>{t("v3.numbers.eyebrow")}</Eyebrow>
            <HeadlineL component="h2" sx={{ color: s.ink }}>
              {t("v3.numbers.headline")}
            </HeadlineL>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, maxWidth: 360, fontSize: 16, lineHeight: 1.55 }}>
            {t("v3.numbers.body")}
          </Typography>
        </Box>

        {/* Stats grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            gap: 0,
            border: `1px solid ${s.line}`,
            borderRadius: "20px",
            overflow: "hidden",
            background: s.surface,
          }}
        >
          {STATS.map((stat, idx) => (
            <Reveal
              key={stat.label}
              delay={idx * 0.08}
            >
              <Box
                sx={{
                  height: "100%",
                  p: { xs: 3, md: 4.5 },
                  borderRight: {
                    xs: idx % 2 === 0 ? `1px solid ${s.line}` : "none",
                    md: idx < STATS.length - 1 ? `1px solid ${s.line}` : "none",
                  },
                  borderBottom: {
                    xs: idx < 2 ? `1px solid ${s.line}` : "none",
                    md: "none",
                  },
                  position: "relative",
                  transition: "background .3s ease",
                  "&:hover": { background: s.bgAlt },
                }}
              >
                <Box
                  sx={{
                    display: "inline-block",
                    width: 28,
                    height: 3,
                    borderRadius: "2px",
                    background: stat.color,
                    mb: 2,
                  }}
                />
                <Typography
                  sx={{
                    fontFamily: FONT_HERO,
                    fontWeight: 700,
                    fontSize: { xs: 34, md: 54 },
                    letterSpacing: "-0.035em",
                    lineHeight: 1,
                    color: s.ink,
                  }}
                >
                  {stat.prefix}
                  {stat.display != null ? stat.display : <CountUp end={stat.value} decimals={stat.decimals} />}
                  {stat.suffix}
                </Typography>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 15, color: s.ink, mt: 1.5 }}>
                  {stat.label}
                </Typography>
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, mt: 0.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {stat.sub}
                </Typography>
              </Box>
            </Reveal>
          ))}
        </Box>

        {/* Trust badges row */}
        <Box
          sx={{
            mt: 4,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {BADGES.map((b) => {
            const Icon = b.icon;
            return (
              <Box
                key={b.label}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderRadius: "999px",
                  border: `1px solid ${s.line}`,
                  background: s.surface,
                }}
              >
                <Icon sx={{ fontSize: 15, color: s.ink }} />
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: s.ink, fontWeight: 500, letterSpacing: "0.06em" }}>
                  {b.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(NumbersTrustBand);
