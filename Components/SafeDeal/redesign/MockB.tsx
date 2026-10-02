/**
 * Direction B — "The Handshake" (light & editorial).
 * Bright, airy, generous whitespace, soft gradients and card-based sections,
 * built around the friendly 3D handshake-shield. Friendlier / more approachable.
 * Preview mockup only — does not touch the live /safedeal landing.
 */
import React from "react";
import { Box, Button, Container, Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import HeroDealForm from "@/Components/SafeDeal/HeroDealForm";
import { ForBuyersSellers, Faq } from "@/Components/SafeDeal/LandingSections";
import { useSdHref } from "@/Components/SafeDeal/sdRouting";
import { SD_GOLD, SD_GOLD_DARK, SD_GOLD_DEEP, SD_GOLD_SOFT, SD_INK, SD_BORDER, SD_TEXT_MUTED, goldAlpha } from "@/Components/SafeDeal/sdTheme";
import {
  ART,
  CoinMarquee,
  Eyebrow,
  Floaty,
  Reveal,
  StatsStrip,
  StatusPill,
  STEPS,
  Testimonial,
  useSdConfig,
} from "./shared";

export default function MockB() {
  const cfg = useSdConfig();
  const href = useSdHref();
  const fee = cfg?.fee_percent ?? 5;
  const feeMin = cfg?.fee_min_usd ?? 10;
  const minDeal = cfg?.min_deal_usd ?? 30;
  const cancelFee = cfg?.cancellation_fee_percent ?? 5;

  return (
    <Box data-testid="sd-mock-b" sx={{ backgroundColor: "#FFFFFF", color: SD_INK }}>
      {/* ===== HERO ===== */}
      <Box sx={{ position: "relative", overflow: "hidden", background: "linear-gradient(180deg, #FFFBF1 0%, #FFFFFF 100%)" }} id="how">
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(680px 380px at 82% 18%, ${goldAlpha(0.16)}, transparent 60%)` }} />
        <Container maxWidth="lg" sx={{ position: "relative", pt: { xs: 5, md: 8 }, pb: { xs: 5, md: 7 } }}>
          <Reveal>
            <Stack alignItems="center" textAlign="center" spacing={2} sx={{ mb: { xs: 4, md: 6 } }}>
              <Eyebrow tone="light">Escrow for online deals</Eyebrow>
              <Typography component="h1" sx={{ fontSize: { xs: 38, sm: 50, lg: 62 }, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.8, maxWidth: 900 }}>
                Buy and sell with a<br /><span style={{ color: SD_GOLD_DEEP }}>handshake you can trust.</span>
              </Typography>
              <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: SD_TEXT_MUTED, lineHeight: 1.6, maxWidth: 620 }}>
                SafeDeal holds the buyer&apos;s payment safely in USDT until the seller delivers. No account to set up &mdash; both sides just sign in with an email code.
              </Typography>
              <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap justifyContent="center">
                {[["mdi:account-off-outline", "No account needed"], ["mdi:clock-fast", "Live in minutes"], ["mdi:earth", "Works worldwide"]].map(([ic, t]) => (
                  <Stack key={t} direction="row" spacing={0.7} alignItems="center" sx={{ px: 1.4, py: 0.7, borderRadius: 99, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
                    <Icon icon={ic} width={16} color={SD_GOLD_DEEP} aria-hidden />
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Reveal>

          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Reveal delay={0.1}>
                <Box sx={{ position: "relative", borderRadius: 6, p: { xs: 3, md: 4 }, background: `linear-gradient(160deg, ${SD_GOLD_SOFT}, #FFFFFF)`, border: `1px solid ${SD_BORDER}` }}>
                  <Box component="img" src={ART.handshake} alt="A friendly SafeDeal handshake inside a protective shield" sx={{ width: "100%", height: "auto", display: "block", borderRadius: 4 }} />
                  <Box sx={{ position: "absolute", top: { xs: 6, md: 16 }, right: { xs: -4, md: -18 } }}>
                    <Floaty><StatusPill tone="light" icon="mdi:cash-lock" label="Funded" state="gold" /></Floaty>
                  </Box>
                  <Box sx={{ position: "absolute", bottom: { xs: 8, md: 22 }, left: { xs: -4, md: -20 } }}>
                    <Floaty delay={1}><StatusPill tone="light" icon="mdi:check-decagram" label="Released" state="green" /></Floaty>
                  </Box>
                </Box>
              </Reveal>
            </Grid>
            <Grid item xs={12} md={6}>
              <Reveal delay={0.15}>
                <Box id="sd-start"><HeroDealForm cfg={cfg} /></Box>
                <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, textAlign: "center", mt: 1.6 }} data-testid="sd-hero-fee-line">
                  {fee}% escrow fee &middot; min ${feeMin} &middot; deals from ${minDeal}
                </Typography>
              </Reveal>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ===== COIN MARQUEE ===== */}
      <Box sx={{ borderTop: `1px solid ${SD_BORDER}`, borderBottom: `1px solid ${SD_BORDER}`, backgroundColor: "#FBFCFE" }}>
        <Container maxWidth="lg" sx={{ py: 2.5 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: SD_TEXT_MUTED, textAlign: "center", mb: 1 }}>Pay in any coin &middot; held as USDT</Typography>
          <CoinMarquee tone="light" />
        </Container>
      </Box>

      {/* ===== STATS ===== */}
      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 7 } }}>
        <Reveal><StatsStrip tone="light" cfg={cfg} /></Reveal>
      </Container>

      {/* ===== HOW IT WORKS ===== */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }} id="steps">
        <Reveal>
          <Stack alignItems="center" textAlign="center" spacing={1} sx={{ mb: 4 }}>
            <Eyebrow tone="light">How it works</Eyebrow>
            <Typography component="h2" sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 900, letterSpacing: -1 }}>Simple for both sides</Typography>
          </Stack>
        </Reveal>
        <Grid container spacing={{ xs: 2.5, md: 3 }}>
          {STEPS.map((s, i) => (
            <Grid item xs={12} md={4} key={s.title}>
              <Reveal delay={i * 0.1}>
                <Box data-testid={`sd-step-${i + 1}`} sx={{ p: { xs: 3, md: 3.4 }, borderRadius: 5, height: "100%", backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, textAlign: "center", transition: "transform .2s, box-shadow .2s", "&:hover": { transform: "translateY(-4px)", boxShadow: `0 22px 48px ${goldAlpha(0.16)}` } }}>
                  <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", display: "grid", placeItems: "center", backgroundColor: SD_GOLD_SOFT, position: "relative", mb: 2 }}>
                    <Icon icon={s.icon} width={30} color={SD_GOLD_DEEP} aria-hidden />
                    <Box sx={{ position: "absolute", top: -4, right: -4, width: 24, height: 24, borderRadius: "50%", backgroundColor: SD_GOLD, color: SD_INK, fontSize: 12, fontWeight: 900, display: "grid", placeItems: "center" }}>{i + 1}</Box>
                  </Box>
                  <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.3 }}>{s.title}</Typography>
                  <Typography sx={{ fontSize: 14, color: SD_TEXT_MUTED, lineHeight: 1.6, mt: 0.8 }}>{s.body}</Typography>
                </Box>
              </Reveal>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ===== FOR BUYERS & SELLERS (reused light section) ===== */}
      <Box sx={{ backgroundColor: "#FBFCFE" }}>
        <ForBuyersSellers />
      </Box>

      {/* ===== FEES ===== */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }} id="fees">
        <Reveal>
          <Box sx={{ p: { xs: 3, md: 5 }, borderRadius: 6, background: `linear-gradient(135deg, ${SD_GOLD_SOFT}, #FFFFFF 70%)`, border: `1px solid ${SD_BORDER}` }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7}>
                <Eyebrow tone="light">Fees, plainly</Eyebrow>
                <Typography sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mt: 1 }}>{fee}% of the deal, min ${feeMin}.</Typography>
                <Typography sx={{ fontSize: 14.5, color: SD_TEXT_MUTED, lineHeight: 1.6, mt: 1.4, maxWidth: 560 }}>
                  Paid by the buyer unless you choose otherwise. Nothing is charged until the buyer funds. A {cancelFee}% fee applies only if both sides cancel a funded deal. Network and exchange costs are shown up-front, at cost.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={1.4}>
                  {[["mdi:cash-remove", "$0 until funded"], ["mdi:swap-horizontal", "Pay in 40+ coins, settle in USDT"], ["mdi:gavel", "Human arbitration if you can't agree"]].map(([ic, t]) => (
                    <Stack key={t} direction="row" spacing={1.2} alignItems="center" sx={{ p: 1.7, borderRadius: 3, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
                      <Icon icon={ic} width={20} color={SD_GOLD_DEEP} aria-hidden />
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Reveal>
      </Container>

      {/* ===== TESTIMONIAL ===== */}
      <Container maxWidth="md" sx={{ pb: { xs: 6, md: 9 } }}>
        <Reveal><Testimonial tone="light" /></Reveal>
      </Container>

      {/* ===== FAQ (reused light section) ===== */}
      <Faq cfg={cfg} helpHref={href("/help")} />

      {/* ===== CLOSING CTA ===== */}
      <Box sx={{ background: `linear-gradient(180deg, #FFFFFF, ${SD_GOLD_SOFT})`, borderTop: `1px solid ${SD_BORDER}` }}>
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 }, textAlign: "center" }}>
          <Reveal>
            <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2.5, display: "grid", placeItems: "center", backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
              <Icon icon="mdi:handshake-outline" width={32} color={SD_GOLD_DEEP} aria-hidden />
            </Box>
            <Typography component="h2" sx={{ fontSize: { xs: 30, md: 44 }, fontWeight: 900, letterSpacing: -1.3, mb: 2 }}>Make your next deal a safe one.</Typography>
            <Typography sx={{ fontSize: 16, color: SD_TEXT_MUTED, maxWidth: 520, mx: "auto", mb: 4 }}>Set it up in under a minute. You only pay when a deal is funded.</Typography>
            <Button component="a" href="#sd-start" variant="contained" size="large" endIcon={<Icon icon="mdi:arrow-right" />} data-testid="sd-cta-start" sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 4, py: 1.4, fontSize: 16, color: SD_INK, backgroundColor: SD_GOLD, boxShadow: `0 14px 32px ${goldAlpha(0.35)}`, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>Start a deal</Button>
          </Reveal>
        </Container>
      </Box>
    </Box>
  );
}
