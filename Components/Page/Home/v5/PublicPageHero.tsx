import React, { memo } from "react";
import { Box } from "@mui/material";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { Body, Eyebrow, HeadlineXL } from "../v3/styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Stagger, StaggerItem } from "../motion/Stagger";

interface Props {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  actions?: React.ReactNode;
  /** Small technical line under the actions (e.g. "No cap on referrals…"). */
  note?: string;
  /** Rendered above the eyebrow, inside the hero (breadcrumbs, back links). */
  topSlot?: React.ReactNode;
  /** Optional right-hand column on desktop (device frame, status card…). */
  aside?: React.ReactNode;
  /** Trims the bottom padding when the next block should sit tight under the hero. */
  compact?: boolean;
  testId?: string;
}

/** Shared premium hero for the public marketing pages (about, press, fees, docs, …). Same aurora
 *  backdrop treatment as the landing hero so the whole site reads as one product, not two tiers. */
const PublicPageHero: React.FC<Props> = ({ eyebrow, title, body, actions, note, topSlot, aside, compact, testId }) => {
  const s = useAurora();
  return (
    <Box component="section" data-testid={testId || "public-page-hero"} sx={{ position: "relative", overflow: "hidden", background: s.bg, pt: { xs: 13, md: 17 }, pb: compact ? { xs: 4, md: 6 } : { xs: 7, md: 10 } }}>
      <Box aria-hidden sx={{ position: "absolute", top: "-34%", right: "-12%", width: { xs: 640, md: 1000 }, height: { xs: 640, md: 1000 }, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT}99 30%, transparent 70%)`, opacity: s.dark ? 0.10 : 0.07, pointerEvents: "none" }} />
      <Box aria-hidden sx={{ position: "absolute", bottom: "-40%", left: "-14%", width: { xs: 520, md: 820 }, height: { xs: 520, md: 820 }, borderRadius: "50%", background: "radial-gradient(circle, #7C5CFF 0%, #4FD1FF88 34%, transparent 70%)", opacity: s.dark ? 0.09 : 0.05, pointerEvents: "none" }} />
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: s.dark ? "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)" : "linear-gradient(rgba(10,10,10,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.028) 1px, transparent 1px)", backgroundSize: "72px 72px", maskImage: "radial-gradient(ellipse 90% 80% at 60% 20%, black 10%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 60% 20%, black 10%, transparent 75%)", pointerEvents: "none" }} />
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        {topSlot ? <Box sx={{ mb: { xs: 3, md: 4 } }}>{topSlot}</Box> : null}
        <Box sx={{ display: "grid", gridTemplateColumns: aside ? { xs: "1fr", md: "minmax(0, 1.1fr) minmax(0, 0.9fr)" } : "1fr", gap: { xs: 5, md: 8 }, alignItems: "center" }}>
          <Stagger step={0.09} sx={{ maxWidth: 780, minWidth: 0 }}>
            <StaggerItem i={0} y={12}><Eyebrow component="p" sx={{ mb: 2.5 }}>{eyebrow}</Eyebrow></StaggerItem>
            <StaggerItem i={1} y={16}><HeadlineXL component="h1" sx={{ color: s.ink, fontSize: "clamp(36px, 5.2vw, 68px)" }}>{title}</HeadlineXL></StaggerItem>
            <StaggerItem i={2} y={14}><Body sx={{ color: s.ink2, fontSize: { xs: 16, md: 18.5 }, mt: 3, maxWidth: 620, fontFamily: FONT_BODY }}>{body}</Body></StaggerItem>
            {actions ? (
              <StaggerItem i={3} y={14}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 4 }}>{actions}</Box>
              </StaggerItem>
            ) : null}
            {note ? (
              <StaggerItem i={4} y={10}>
                <Body data-testid="public-page-hero-note" sx={{ fontFamily: FONT_TECH, fontSize: 12.5, letterSpacing: "0.04em", color: s.ink3, mt: 2.5, maxWidth: 560 }}>{note}</Body>
              </StaggerItem>
            ) : null}
          </Stagger>
          {aside ? (
            <Stagger step={0.1} sx={{ minWidth: 0 }}>
              <StaggerItem i={2} y={20}>{aside}</StaggerItem>
            </Stagger>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(PublicPageHero);
