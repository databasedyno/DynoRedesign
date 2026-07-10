import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FONT_HERO, FONT_TECH, useSwiss } from "./swiss";

interface Stat {
  value: string;
  labelKey: string;
  testId: string;
}

const STATS: Stat[] = [
  { value: "$0", labelKey: "statSetupLabel", testId: "stat-setup" },
  { value: "0.5%", labelKey: "statFeeLabel", testId: "stat-fee" },
  { value: "<5min", labelKey: "statSettlementLabel", testId: "stat-settlement" },
  { value: "13", labelKey: "statChainsLabel", testId: "stat-chains" },
];

const StatWall: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box component="section" ref={ref} aria-label="DynoPay by the numbers" data-testid="stat-wall" sx={{ py: { xs: 9, md: 15 }, px: { xs: 3, md: 6 }, maxWidth: 1400, mx: "auto" }}>
      <Typography
        sx={{
          fontFamily: FONT_TECH,
          fontSize: 12,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: s.accentText,
          textAlign: "center",
          mb: { xs: 5, md: 8 },
        }}
      >
        [ {t("statWallEyebrow")} ]
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          rowGap: { xs: 5, md: 0 },
        }}
      >
        {STATS.map((st, i) => (
          <Box
            key={st.testId}
            data-testid={st.testId}
            sx={{
              textAlign: "center",
              px: { xs: 1.5, md: 3 },
              borderLeft: { md: i > 0 ? `1px solid ${s.line}` : "none" },
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.6s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)",
              transitionDelay: `${i * 120}ms`,
            }}
          >
            <Typography
              component="p"
              sx={{
                fontFamily: FONT_HERO,
                fontWeight: 800,
                fontSize: { xs: "clamp(36px, 10vw, 52px)", md: "clamp(44px, 4.6vw, 72px)" },
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: s.txt,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {st.value}
            </Typography>
            <Typography
              component="p"
              sx={{
                fontFamily: FONT_TECH,
                fontSize: 11.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: s.sub,
                mt: 1.5,
                maxWidth: 220,
                mx: "auto",
                lineHeight: 1.6,
              }}
            >
              {t(st.labelKey)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(StatWall);
