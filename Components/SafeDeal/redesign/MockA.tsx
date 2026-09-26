/**
 * Direction A — "The Vault" (dark & premium).
 * A dramatic, near-black landing built around the glowing 3D vault, floating
 * escrow-status pills, a coin marquee and a tight stats strip.
 * Preview mockup only — does not touch the live /safedeal landing.
 */
import React from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";
import HeroDealForm from "@/Components/SafeDeal/HeroDealForm";
import { faqItems } from "@/Components/SafeDeal/LandingSections";
import { useSdHref } from "@/Components/SafeDeal/sdRouting";
import { SD_GOLD, SD_GOLD_DARK, SD_INK, SD_INK_SOFT, goldAlpha } from "@/Components/SafeDeal/sdTheme";
import {
  ART,
  CoinMarquee,
  Eyebrow,
  Floaty,
  NotifCard,
  Reveal,
  StatsStrip,
  StatusPill,
  STEPS,
  Testimonial,
  useSdConfig,
} from "./shared";

export default function MockA() {
  const cfg = useSdConfig();
  const href = useSdHref();
  const fee = cfg?.fee_percent ?? 5;
  const feeMin = cfg?.fee_min_usd ?? 10;
  const minDeal = cfg?.min_deal_usd ?? 30;
  const cancelFee = cfg?.cancellation_fee_percent ?? 5;
  const items = faqItems(cfg, href("/help")).slice(0, 6);

  return (
    <Box data-testid="sd-mock-a" sx={{ backgroundColor: SD_INK, color: "#fff" }}>
      {/* ===== HERO ===== */}
      <Box sx={{ position: "relative", overflow: "hidden" }} id="how">
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(1000px 520px at 12% -12%, ${goldAlpha(0.22)}, transparent 60%), radial-gradient(760px 460px at 100% 0%, ${goldAlpha(0.12)}, transparent 62%)` }} />
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06, backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "54px 54px", maskImage: "radial-gradient(circle at 60% 30%, black, transparent 76%)", WebkitMaskImage: "radial-gradient(circle at 60% 30%, black, transparent 76%)" }} />
        <Container maxWidth="lg" sx={{ position: "relative", pt: { xs: 5, md: 8 }, pb: { xs: 6, md: 9 } }}>
          <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Reveal>
                <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2.2 }}>
                  <Box sx={{ px: 1.3, py: 0.5, borderRadius: 99, backgroundColor: goldAlpha(0.16), border: `1px solid ${goldAlpha(0.5)}`, fontSize: 12, fontWeight: 800, color: SD_GOLD }}>Escrow for online deals</Box>
                  <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)" }} data-testid="sd-hero-fee-line">{fee}% fee &middot; min ${feeMin} &middot; deals from ${minDeal}</Typography>
                </Stack>
                <Typography component="h1" sx={{ fontSize: { xs: 40, sm: 52, lg: 64 }, fontWeight: 900, lineHeight: 0.98, letterSpacing: -2, mb: 2.4 }}>
                  Your money,<br />in a <span style={{ color: SD_GOLD }}>vault</span>—<br />until it&apos;s done.
                </Typography>
                <Typography sx={{ fontSize: { xs: 15.5, md: 17 }, color: "rgba(255,255,255,0.72)", lineHeight: 1.6, maxWidth: 480, mb: 3.5 }}>
                  SafeDeal holds the buyer&apos;s payment in USDT and releases it to the seller the moment the deal is delivered. No account, no chargebacks, no trust required.
                </Typography>
              </Reveal>
              <Reveal delay={0.1}>
                <Box id="sd-start"><HeroDealForm cfg={cfg} /></Box>
              </Reveal>
            </Grid>

            <Grid item xs={12} md={6}>
              <Reveal delay={0.15}>
                <Box sx={{ position: "relative", mx: "auto", maxWidth: 560 }}>
                  <Box
                    component="img"
                    src={ART.vault}
                    alt="A glowing gold-and-black SafeDeal escrow vault"
                    sx={{ width: "100%", height: "auto", display: "block", borderRadius: 5, filter: `drop-shadow(0 40px 80px ${goldAlpha(0.28)})` }}
                  />
                  {/* Floating escrow-status pills */}
                  <Box sx={{ position: "absolute", top: { xs: 6, md: 24 }, left: { xs: -6, md: -26 } }}>
                    <Floaty><StatusPill icon="mdi:cash-lock" label="Funded" state="gold" /></Floaty>
                  </Box>
                  <Box sx={{ position: "absolute", bottom: { xs: 44, md: 72 }, left: { xs: -6, md: -34 } }}>
                    <Floaty delay={0.8}><StatusPill icon="mdi:shield-lock-outline" label="In escrow" state="gold" /></Floaty>
                  </Box>
                  <Box sx={{ position: "absolute", top: { xs: 8, md: 40 }, right: { xs: -6, md: -22 } }}>
                    <Floaty delay={1.4}><StatusPill icon="mdi:check-decagram" label="Released" state="green" /></Floaty>
                  </Box>
                  <Box sx={{ position: "absolute", bottom: { xs: -14, md: -6 }, right: { xs: -2, md: -18 }, display: { xs: "none", sm: "block" } }}>
                    <Floaty delay={0.4} distance={12}>
                      <NotifCard icon="mdi:bank-transfer-out" title="Payout sent" body="$2,400 released to the seller's USDT wallet." />
                    </Floaty>
                  </Box>
                </Box>
              </Reveal>
            </Grid>
          </Grid>

          <Box sx={{ mt: { xs: 5, md: 7 } }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", textAlign: "center", mb: 1.2 }}>Pay in any coin &middot; held as USDT</Typography>
            <CoinMarquee tone="dark" />
          </Box>
          <Box sx={{ mt: { xs: 3, md: 4 } }}>
            <StatsStrip tone="dark" cfg={cfg} />
          </Box>
        </Container>
      </Box>

      {/* ===== HOW IT WORKS ===== */}
      <Box sx={{ backgroundColor: SD_INK_SOFT, borderTop: "1px solid rgba(255,255,255,0.06)" }} id="steps">
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Reveal><Eyebrow tone="dark">How it works</Eyebrow>
            <Typography component="h2" sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 900, letterSpacing: -1, mt: 1, mb: 4 }}>Three steps. Zero guesswork.</Typography>
          </Reveal>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {STEPS.map((s, i) => (
              <Grid item xs={12} md={4} key={s.title}>
                <Reveal delay={i * 0.1}>
                  <Box data-testid={`sd-step-${i + 1}`} sx={{ p: { xs: 2.6, md: 3 }, borderRadius: 4, height: "100%", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", transition: "transform .2s, border-color .2s, box-shadow .2s", "&:hover": { transform: "translateY(-4px)", borderColor: goldAlpha(0.5), boxShadow: `0 24px 50px ${goldAlpha(0.14)}` } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                      <Box sx={{ width: 50, height: 50, borderRadius: 3, display: "grid", placeItems: "center", backgroundColor: SD_GOLD, color: SD_INK }}>
                        <Icon icon={s.icon} width={25} aria-hidden />
                      </Box>
                      <Typography sx={{ fontSize: 44, fontWeight: 900, color: "rgba(255,255,255,0.08)", lineHeight: 1 }}>{i + 1}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4 }}>{s.title}</Typography>
                    <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.66)", lineHeight: 1.6, mt: 0.6 }}>{s.body}</Typography>
                  </Box>
                </Reveal>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ===== SECURITY BAND ===== */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center">
          <Grid item xs={12} md={5}>
            <Reveal>
              <Box component="img" src={ART.shield} alt="SafeDeal protection shield" sx={{ width: "100%", maxWidth: 420, mx: "auto", display: "block", borderRadius: 5, filter: `drop-shadow(0 30px 70px ${goldAlpha(0.2)})` }} />
            </Reveal>
          </Grid>
          <Grid item xs={12} md={7}>
            <Reveal delay={0.1}>
              <Eyebrow tone="dark">Protected end to end</Eyebrow>
              <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mt: 1, mb: 2.5 }}>Neither side has to trust the other &mdash; only the process.</Typography>
              <Stack spacing={2}>
                {[
                  ["mdi:lock-check-outline", "Held, not sent", "Funds sit in SafeDeal escrow as USDT. The seller can't touch them until you release."],
                  ["mdi:timer-check-outline", "Deadlines on every step", "An inspection window protects the buyer; automatic release protects the seller."],
                  ["mdi:gavel", "Human arbitration", "Can't agree? The SafeDeal team decides on the terms and the evidence in the deal."],
                ].map(([ic, t, b]) => (
                  <Stack key={t} direction="row" spacing={1.6} alignItems="flex-start">
                    <Box sx={{ width: 38, height: 38, borderRadius: 2.5, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: goldAlpha(0.16), border: `1px solid ${goldAlpha(0.4)}` }}>
                      <Icon icon={ic} width={20} color={SD_GOLD} aria-hidden />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{t}</Typography>
                      <Typography sx={{ fontSize: 13.8, color: "rgba(255,255,255,0.66)", lineHeight: 1.55 }}>{b}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Reveal>
          </Grid>
        </Grid>
      </Container>

      {/* ===== FEES ===== */}
      <Box sx={{ backgroundColor: SD_INK_SOFT, borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }} id="fees">
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Reveal>
            <Box sx={{ p: { xs: 3, md: 5 }, borderRadius: 5, background: `linear-gradient(135deg, ${goldAlpha(0.14)}, transparent 60%)`, border: `1px solid ${goldAlpha(0.3)}` }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={7}>
                  <Eyebrow tone="dark">Fees, plainly</Eyebrow>
                  <Typography sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mt: 1 }}>
                    {fee}% of the deal, min ${feeMin}.
                  </Typography>
                  <Typography sx={{ fontSize: 14.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, mt: 1.4, maxWidth: 560 }}>
                    Paid by the buyer unless you choose otherwise. Nothing is charged until the buyer funds. A {cancelFee}% fee applies only if both sides cancel a funded deal. Network and exchange costs are shown up-front, at cost.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Stack spacing={1.4}>
                    {[
                      ["mdi:cash-remove", "$0 until funded"],
                      ["mdi:swap-horizontal", "Pay in 40+ coins, settle in USDT"],
                      ["mdi:earth", "Works worldwide"],
                    ].map(([ic, t]) => (
                      <Stack key={t} direction="row" spacing={1.2} alignItems="center" sx={{ p: 1.6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Icon icon={ic} width={20} color={SD_GOLD} aria-hidden />
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          </Reveal>
        </Container>
      </Box>

      {/* ===== TESTIMONIAL ===== */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
        <Reveal><Testimonial tone="dark" /></Reveal>
      </Container>

      {/* ===== FAQ (dark) ===== */}
      <Box sx={{ backgroundColor: SD_INK_SOFT, borderTop: "1px solid rgba(255,255,255,0.06)" }} id="faq">
        <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
          <Reveal>
            <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 3 }}>Questions people ask first</Typography>
          </Reveal>
          <Stack spacing={1.2} data-testid="sd-faq">
            {items.map((f, i) => (
              <Accordion key={f.q} disableGutters elevation={0} sx={{ backgroundColor: "rgba(255,255,255,0.03)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px !important", "&:before": { display: "none" } }} data-testid={`sd-faq-item-${i + 1}`}>
                <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" width={22} color={SD_GOLD} />} sx={{ px: 2.2, "& .MuiAccordionSummary-content": { my: 1.4 } }}>
                  <Typography component="h3" sx={{ fontSize: 15.5, fontWeight: 800 }}>{f.q}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.2, pt: 0, pb: 2.2 }}>
                  <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.68)", lineHeight: 1.65 }}>{f.a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ===== CLOSING CTA ===== */}
      <Box sx={{ position: "relative", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(700px 340px at 50% 120%, ${goldAlpha(0.2)}, transparent 60%)` }} />
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 }, textAlign: "center", position: "relative" }}>
          <Reveal>
            <Typography component="h2" sx={{ fontSize: { xs: 32, md: 46 }, fontWeight: 900, letterSpacing: -1.4, mb: 2 }}>
              Ready when you are.
            </Typography>
            <Typography sx={{ fontSize: 16, color: "rgba(255,255,255,0.72)", maxWidth: 520, mx: "auto", mb: 4 }}>
              Start a deal in under a minute. You only pay when a deal is funded.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.6} justifyContent="center">
              <Button
                component="a"
                href="#sd-start"
                variant="contained"
                size="large"
                endIcon={<Icon icon="mdi:arrow-right" />}
                data-testid="sd-cta-start"
                sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 4, py: 1.4, fontSize: 16, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } }}
              >
                Start a deal
              </Button>
              <Link href={href("/help")} style={{ textDecoration: "none" }}>
                <Button variant="outlined" size="large" sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, px: 4, py: 1.4, fontSize: 16, color: "#fff", borderColor: "rgba(255,255,255,0.28)", "&:hover": { borderColor: SD_GOLD } }}>
                  How it works
                </Button>
              </Link>
            </Stack>
          </Reveal>
        </Container>
      </Box>
    </Box>
  );
}
