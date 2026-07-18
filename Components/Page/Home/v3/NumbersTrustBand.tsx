import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { motion, useInView } from "framer-motion";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";

interface Stat {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
  sub: string;
  color: string;
}

const STATS: Stat[] = [
  { value: 42, suffix: "M+", prefix: "$", label: "Settled", sub: "Since launch", color: "#FF5B49" },
  { value: 15, suffix: "+", label: "Chains", sub: "BTC, ETH, TRON, XRP, SOL", color: "#7C5CFF" },
  { value: 0.5, suffix: "%", decimals: 1, label: "Lowest fee", sub: "At Enterprise volume", color: "#5A6B00" },
  { value: 4.2, suffix: "s", decimals: 1, label: "Median settle", sub: "On-chain confirmation", color: "#4FD1FF" },
];

const BADGES = [
  { icon: SecurityRoundedIcon, label: "SOC2 track", ink: "#0A0A0A" },
  { icon: VerifiedUserRoundedIcon, label: "KYC / AML", ink: "#0A0A0A" },
  { icon: GavelRoundedIcon, label: "GDPR", ink: "#0A0A0A" },
  { icon: PolicyRoundedIcon, label: "Non-custodial", ink: "#0A0A0A" },
];

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
      {decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-US")}
    </span>
  );
};

const NumbersTrustBand: React.FC = () => {
  const s = useAurora();

  return (
    <Box component="section" sx={{ background: s.bg, py: { xs: 9, md: 13 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: { xs: 5, md: 8 } }}>
          <Box sx={{ maxWidth: 620 }}>
            <Eyebrow sx={{ mb: 2 }}>[ Numbers &amp; Trust ]</Eyebrow>
            <HeadlineL sx={{ color: s.ink }}>
              Small fees. Big movement.
            </HeadlineL>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, maxWidth: 360, fontSize: 16, lineHeight: 1.55 }}>
            Non-custodial by design. Compliant by choice. Fast because it’s
            written to be.
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
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "contents" }}
            >
              <Box
                sx={{
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
                  <CountUp end={stat.value} decimals={stat.decimals} />
                  {stat.suffix}
                </Typography>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 15, color: s.ink, mt: 1.5 }}>
                  {stat.label}
                </Typography>
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, mt: 0.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {stat.sub}
                </Typography>
              </Box>
            </motion.div>
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
