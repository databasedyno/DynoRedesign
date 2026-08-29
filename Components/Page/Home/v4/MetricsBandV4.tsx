import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { BG0, FONT_DISPLAY, FONT_MONO, INK0, INK3, LINE } from "./theme.v4";
import { ShellV4 } from "./styled.v4";

const METRICS = [
  { v: "m1v", l: "m1l" },
  { v: "m2v", l: "m2l" },
  { v: "m3v", l: "m3l" },
  { v: "m4v", l: "m4l" },
] as const;

const MetricsBandV4: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <Box component="section" data-testid="metrics-band" sx={{ background: BG0, borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>
      <ShellV4 sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
      }}>
        {METRICS.map((m, i) => (
          <Box key={m.v} sx={{
            py: { xs: 3.5, md: 4.5 },
            px: { xs: 1, md: 4 },
            borderLeft: { md: i > 0 ? `1px solid ${LINE}` : "none" },
            borderTop: { xs: i > 1 ? `1px solid ${LINE}` : "none", md: "none" },
          }}>
            <Typography sx={{
              fontFamily: FONT_DISPLAY, fontWeight: 700, color: INK0,
              fontSize: { xs: 30, md: 40 }, letterSpacing: "-0.02em", lineHeight: 1.1,
            }}>
              {t(`v4.metrics.${m.v}`)}
            </Typography>
            <Typography sx={{
              fontFamily: FONT_MONO, fontSize: 11.5, color: INK3,
              letterSpacing: "0.14em", textTransform: "uppercase", mt: 0.75,
            }}>
              {t(`v4.metrics.${m.l}`)}
            </Typography>
          </Box>
        ))}
      </ShellV4>
    </Box>
  );
};

export default memo(MetricsBandV4);
