import React, { memo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {
  EyebrowV8,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GradientText,
  MockPanelV8,
  PANEL,
  PANEL_GLOW,
  PrimaryBtn,
  SecondaryBtn,
  Reveal,
  SectionV8,
  SectionHeadV8,
  goStart,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";

/* ============================================================================
 * ProductPageV8 — data-driven template for DynoPay's product detail pages,
 * mirroring the Checkout flagship so the whole /products/* family reads as one
 * premium system. Pass copy + a dark mockup node; everything else is shared.
 * ========================================================================== */

export interface ProductPageConfig {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  titleLead: string;
  titleHighlight: string;
  body: string;
  trust: string[];
  demo?: { label: string; href: string };
  mockup: React.ReactNode;
  featuresEyebrow: string;
  featuresTitle: string;
  featuresLead: string;
  features: { icon: string; title: string; body: string }[];
  stats: { v: string; l: string }[];
  finalTitle: string;
  finalHighlight: string;
  finalBody: string;
}

const ProductPageV8: React.FC<{ config: ProductPageConfig }> = ({ config: c }) => {
  const s = useConsole();
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{c.seoTitle}</title>
        <meta name="description" content={c.seoDescription} />
        <link rel="canonical" href={`https://dynopay.com/products/${c.slug}`} />
      </Head>

      <Box sx={{ width: "100%", background: s.canvas }}>
        {/* ===== SPLIT HERO ===== */}
        <Box component="section" data-testid={`${c.slug}-hero`} sx={{ position: "relative", background: s.canvas, overflow: "hidden", pt: { xs: 6, md: 9 }, pb: { xs: 8, md: 12 } }}>
          <Box aria-hidden sx={{ position: "absolute", top: -140, right: -120, width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,209,0,0.14), transparent 62%)", pointerEvents: "none" }} />
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              maxWidth: 1200,
              mx: "auto",
              px: { xs: 3, md: 6 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) minmax(0,1fr)" },
              gap: { xs: 7, lg: 8 },
              alignItems: "center",
            }}
          >
            <Box sx={{ maxWidth: 560 }}>
              <EyebrowV8 sx={{ mb: 2.5 }}>{c.eyebrow}</EyebrowV8>
              <Typography component="h1" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.04, letterSpacing: "-0.03em", color: s.ink }}>
                {c.titleLead} <GradientText>{c.titleHighlight}</GradientText>
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.62, mt: 3, maxWidth: 500 }}>
                {c.body}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4.5 }}>
                <PrimaryBtn data-testid={`${c.slug}-hero-start`} onClick={() => goStart(router, `${c.slug}_hero`)} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
                  Start free
                </PrimaryBtn>
                {c.demo ? (
                  <SecondaryBtn data-testid={`${c.slug}-hero-demo`} href={c.demo.href} startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 20 }} />} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
                    {c.demo.label}
                  </SecondaryBtn>
                ) : null}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mt: 4 }}>
                {c.trust.map((x) => (
                  <Box key={x} sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
                    <Icon icon="mdi:check-circle" width={16} height={16} color={s.accent} />
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.ink2 }}>{x}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <MockPanelV8>{c.mockup}</MockPanelV8>
          </Box>
        </Box>

        {/* ===== FEATURES ===== */}
        <SectionV8 testId={`${c.slug}-features`} sx={{ background: s.surface }}>
          <SectionHeadV8 center eyebrow={c.featuresEyebrow} title={c.featuresTitle} lead={c.featuresLead} maxWidth={720} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
            {c.features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.08}>
                <Box sx={{ height: "100%", p: { xs: 3, md: 3.5 }, borderRadius: "18px", border: `1px solid ${s.line}`, background: s.canvas }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent, mb: 2.5 }}>
                    <Icon icon={f.icon} width={24} height={24} />
                  </Box>
                  <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 18, md: 19.5 }, letterSpacing: "-0.01em", color: s.ink, mb: 1.25 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2 }}>{f.body}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>
        </SectionV8>

        {/* ===== STATS BAND (dark) ===== */}
        <Box component="section" data-testid={`${c.slug}-stats`} sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 7, md: 10 } }}>
          <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, opacity: 0.6, pointerEvents: "none" }} />
          <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1000, mx: "auto", px: { xs: 3, md: 6 }, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: `repeat(${c.stats.length}, 1fr)` }, gap: { xs: 4, md: 2 }, textAlign: "center" }}>
            {c.stats.map((x, i) => (
              <Box key={x.l} sx={{ px: { md: 2 }, borderLeft: { md: i === 0 ? "none" : `1px solid ${PANEL.line}` } }}>
                <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 32, md: 46 }, lineHeight: 1, letterSpacing: "-0.03em", color: PANEL.gold }}>{x.v}</Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: PANEL.ink3, mt: 1.5 }}>{x.l}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <CtaBandV8
          testId={`${c.slug}-final-cta`}
          badge="Live in minutes · no credit card"
          title={c.finalTitle}
          highlight={c.finalHighlight}
          body={c.finalBody}
          primaryLabel="Start free"
          primaryRef={`${c.slug}_final`}
          secondaryLabel="See pricing"
          secondaryHref="/fees"
        />
      </Box>
    </>
  );
};

export default memo(ProductPageV8);
