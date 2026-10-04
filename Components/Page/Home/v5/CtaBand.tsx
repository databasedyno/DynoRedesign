import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { HeadlineXL } from "../v3/styled.v3";
import { Stagger, StaggerItem } from "../motion/Stagger";

interface Props {
  title: React.ReactNode;
  body: string;
  actions: React.ReactNode;
  eyebrow?: string;
  /** Small trust row under the buttons (e.g. "Non-custodial · 9 blockchains · …"). */
  footnote?: string;
  testId?: string;
}

/**
 * Shared closing-CTA band for the public pages. 2026-10: flattened to the
 * operations-console look — a calm, always-dark panel on the page canvas,
 * hairline border, no aurora glow / grid overlay. Stays dark in both themes so
 * the single gold highlight word in the headline remains legible.
 */
const CtaBand: React.FC<Props> = ({ title, body, actions, eyebrow, footnote, testId }) => {
  const s = useAurora();
  return (
    <Box component="section" data-testid={testId || "cta-band"} sx={{ background: s.bg, borderTop: `1px solid ${s.line}`, py: { xs: 8, md: 12 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Stagger step={0.1} sx={{ display: "grid" }}>
          <StaggerItem i={0} y={24}>
            <Box sx={{ borderRadius: { xs: "20px", md: "24px" }, background: "#0E0E0D", px: { xs: 3, md: 8 }, py: { xs: 7, md: 10 }, textAlign: "center", border: "1px solid rgba(255,255,255,0.09)" }}>
              {eyebrow ? (
                <StaggerItem i={1} y={12}>
                  <Typography data-testid="cta-band-eyebrow" sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "#FFD100", mb: 3, fontWeight: 600 }}>{eyebrow}</Typography>
                </StaggerItem>
              ) : null}
              <StaggerItem i={1} y={16}>
                <HeadlineXL component="h2" sx={{ color: "#F5F5F3", fontSize: { xs: 28, sm: 38, md: 46 }, mb: 2.5 }}>{title}</HeadlineXL>
              </StaggerItem>
              <StaggerItem i={2} y={14}>
                <Typography sx={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.68)", fontSize: { xs: 16, md: 17.5 }, maxWidth: 560, mx: "auto", mb: 4, lineHeight: 1.55 }}>{body}</Typography>
              </StaggerItem>
              <StaggerItem i={3} y={14}>
                <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1.5 }}>{actions}</Box>
              </StaggerItem>
              {footnote ? (
                <StaggerItem i={4} y={10}>
                  <Typography data-testid="cta-band-footnote" sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", mt: 4 }}>{footnote}</Typography>
                </StaggerItem>
              ) : null}
            </Box>
          </StaggerItem>
        </Stagger>
      </Box>
    </Box>
  );
};

export default memo(CtaBand);
