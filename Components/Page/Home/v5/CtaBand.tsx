import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { FONT_BODY, FONT_TECH } from "../v3/theme.v3";
import { HeadlineXL } from "../v3/styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";
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

/** Shared dark closing-CTA band (matches the landing FinalCTA). Reused across public pages. */
const CtaBand: React.FC<Props> = ({ title, body, actions, eyebrow, footnote, testId }) => (
  <Box component="section" data-testid={testId || "cta-band"} sx={{ bgcolor: "background.default", py: { xs: 8, md: 12 } }}>
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
      <Stagger step={0.1} sx={{ display: "grid" }}>
        <StaggerItem i={0} y={24}>
          <Box sx={{ position: "relative", overflow: "hidden", borderRadius: { xs: "24px", md: "32px" }, background: "#0A0A0A", px: { xs: 3, md: 8 }, py: { xs: 7, md: 10 }, textAlign: "center", border: "1px solid rgba(255,255,255,0.10)" }}>
            <Box aria-hidden sx={{ position: "absolute", top: "-40%", left: "-10%", width: 680, height: 680, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT}99 30%, transparent 70%)`, opacity: 0.2, pointerEvents: "none" }} />
            <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "60px 60px", maskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)", WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)", pointerEvents: "none" }} />
            <Box sx={{ position: "relative", zIndex: 1 }}>
              {eyebrow ? (
                <StaggerItem i={1} y={12}>
                  <Typography data-testid="cta-band-eyebrow" sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", mb: 3, fontWeight: 500 }}>{eyebrow}</Typography>
                </StaggerItem>
              ) : null}
              <StaggerItem i={1} y={16}>
                <HeadlineXL component="h2" sx={{ color: "#F5F5F5", fontSize: { xs: 30, sm: 42, md: 52 }, mb: 2.5 }}>{title}</HeadlineXL>
              </StaggerItem>
              <StaggerItem i={2} y={14}>
                <Typography sx={{ fontFamily: FONT_BODY, color: "rgba(255,255,255,0.68)", fontSize: { xs: 16, md: 18 }, maxWidth: 560, mx: "auto", mb: 4, lineHeight: 1.55 }}>{body}</Typography>
              </StaggerItem>
              <StaggerItem i={3} y={14}>
                <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1.5 }}>{actions}</Box>
              </StaggerItem>
              {footnote ? (
                <StaggerItem i={4} y={10}>
                  <Typography data-testid="cta-band-footnote" sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", mt: 4 }}>{footnote}</Typography>
                </StaggerItem>
              ) : null}
            </Box>
          </Box>
        </StaggerItem>
      </Stagger>
    </Box>
  </Box>
);

export default memo(CtaBand);
