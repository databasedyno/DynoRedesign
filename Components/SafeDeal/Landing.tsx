import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Container, Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import safedealApi, { SdConfig } from "@/api/safedeal";
import { useSdHref } from "./sdRouting";
import { SD_INK, SD_INK_MUTED } from "./SafeDealShell";
import { SD_GOLD, SD_GOLD_SOFT, SD_GOLD_DEEP, SD_TEXT_MUTED, SD_BORDER, goldAlpha, sdPrimaryBtn, sdGhostBtnDark } from "./sdTheme";
import Hero3D from "./Hero3D";
import FeeCalculator from "./FeeCalculator";
import { Faq, ForBuyersSellers } from "./LandingSections";

const STEPS = [
  { icon: "mdi:email-fast-outline", title: "Invite", body: "Describe the deal, set the price and invite the other party by email. They accept the terms in one click." },
  { icon: "mdi:lock-outline", title: "Fund", body: "The buyer pays in any supported coin (processed by Dynopay). SafeDeal converts it to USDT and holds it safely in escrow." },
  { icon: "mdi:package-variant-closed-check", title: "Deliver", body: "The seller delivers and marks the deal done. The buyer has a set number of days to check the work." },
  { icon: "mdi:cash-check", title: "Release", body: "The buyer releases — or the timer does. SafeDeal credits the seller's wallet instantly. Withdraw any time." },
];

/** Scroll-reveal wrapper (disabled under prefers-reduced-motion). */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const href = useSdHref();
  const [cfg, setCfg] = useState<SdConfig | null>(null);
  useEffect(() => {
    safedealApi.config().then(setCfg).catch(() => undefined);
  }, []);
  const fee = cfg?.fee_percent ?? 5;
  const feeMin = cfg?.fee_min_usd ?? 10;
  const minDeal = cfg?.min_deal_usd ?? 30;
  // Guests can draft a deal without signing in first; sign-in is only asked at "Send invite".
  const cta = href("/deals/new");

  return (
    <Box data-testid="sd-landing">
      {/* ===== Hero ===== */}
      <Box sx={{ backgroundColor: SD_INK, color: "#fff", position: "relative", overflow: "hidden" }}>
        <Box aria-hidden sx={{ position: "absolute", inset: 0, background: `radial-gradient(760px 420px at 12% -5%, ${goldAlpha(0.20)}, transparent 60%), radial-gradient(560px 320px at 95% 110%, ${goldAlpha(0.12)}, transparent 60%)` }} />
        <Box aria-hidden sx={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "46px 46px", maskImage: "radial-gradient(circle at 50% 30%, black, transparent 75%)" }} />
        <Container maxWidth="lg" sx={{ position: "relative", py: { xs: 7, md: 11 } }}>
          <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                <Box sx={{ px: 1.2, py: 0.4, borderRadius: 99, backgroundColor: goldAlpha(0.16), border: `1px solid ${goldAlpha(0.45)}`, fontSize: 12, fontWeight: 800, color: SD_GOLD }}>
                  Escrow for online deals
                </Box>
                <Typography sx={{ fontSize: 12.5, color: SD_INK_MUTED }}>Payments by Dynopay</Typography>
              </Stack>
              <Typography component="h1" sx={{ fontSize: { xs: 38, sm: 48, lg: 60 }, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.5, mb: 2.5 }}>
                Pay when it&apos;s delivered.
                <br />
                <span style={{ color: SD_GOLD }}>Get paid when it&apos;s done.</span>
              </Typography>
              <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: "rgba(255,255,255,0.82)", maxWidth: 560, mb: 4, lineHeight: 1.6 }}>
                SafeDeal holds the buyer&apos;s payment in USDT until the seller delivers. No accounts to set up — both sides sign in with
                an email code. If something goes wrong, you sort it out together first; SafeDeal steps in only if you can&apos;t.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
                <Link href={cta} data-testid="sd-start-deal" style={{ textDecoration: "none" }}>
                  <Button size="large" variant="contained" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ ...sdPrimaryBtn, px: 3.2, py: 1.3, fontSize: 16 }}>
                    Start a deal
                  </Button>
                </Link>
                <Link href={href("/signin?invited=1")} data-testid="sd-invited-cta" style={{ textDecoration: "none" }}>
                  <Button size="large" variant="outlined" startIcon={<Icon icon="mdi:email-open-outline" />} sx={{ ...sdGhostBtnDark, px: 2.6, py: 1.2, fontSize: 15 }}>
                    I was invited to a deal
                  </Button>
                </Link>
              </Stack>
              <Typography sx={{ fontSize: 13, color: SD_INK_MUTED, mt: 2 }} data-testid="sd-hero-fee-line">
                {fee}% escrow fee · min ${feeMin} · deals from ${minDeal}
              </Typography>
              <Stack direction="row" spacing={{ xs: 1.5, sm: 3 }} flexWrap="wrap" useFlexGap sx={{ mt: 3 }} data-testid="sd-trust-strip">
                {[
                  ["mdi:lock-check-outline", "Held in USDT escrow by SafeDeal"],
                  ["mdi:timer-check-outline", "Deadlines on every step"],
                  ["mdi:account-check-outline", "Human arbitration if you can't agree"],
                ].map(([ic, t]) => (
                  <Stack key={t} direction="row" spacing={0.8} alignItems="center">
                    <Icon icon={ic} width={16} color={SD_GOLD} aria-hidden />
                    <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Hero3D />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ===== Fee calculator (dark band so the glass calculator reads correctly) ===== */}
      <Box sx={{ backgroundColor: SD_INK, color: "#fff", position: "relative", overflow: "hidden" }}>
        <Box aria-hidden sx={{ position: "absolute", inset: 0, background: `radial-gradient(560px 300px at 50% -10%, ${goldAlpha(0.14)}, transparent 65%)` }} />
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 }, position: "relative" }}>
          <Reveal>
            <Box sx={{ textAlign: "center", mb: 3 }}>
              <Typography component="h2" sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 900, letterSpacing: -0.6 }}>See the exact fee before you commit</Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.72)", mt: 0.6 }}>No surprises — network and exchange costs are folded into the quote.</Typography>
            </Box>
            <Box sx={{ maxWidth: 460, mx: "auto" }}>
              <FeeCalculator minDeal={minDeal} autoReleaseDefault={cfg?.auto_release_default ?? 5} maxDealUsd={cfg?.max_deal_usd ?? null} maxDealEur={cfg?.max_deal_eur ?? 2999} />
            </Box>
          </Reveal>
        </Container>
      </Box>

      {/* ===== How it works ===== */}
      <Container maxWidth="lg" sx={{ pb: { xs: 7, md: 10 } }} id="how">
        <Reveal>
          <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 1 }}>How it works</Typography>
          <Typography sx={{ color: SD_TEXT_MUTED, mb: 4, maxWidth: 620 }}>Four steps. Both sides see the same deal page, the same numbers and the same timeline.</Typography>
        </Reveal>
        <Grid container spacing={2.5}>
          {STEPS.map((s, i) => (
            <Grid item xs={12} sm={6} md={3} key={s.title}>
              <Reveal delay={i * 0.08}>
                <Box sx={{ p: 2.5, borderRadius: 3, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, height: "100%", transition: "transform .18s, box-shadow .18s", "&:hover": { transform: "translateY(-4px)", boxShadow: `0 16px 34px ${goldAlpha(0.18)}`, borderColor: goldAlpha(0.5) } }} data-testid={`sd-step-${i + 1}`}>
                  <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", backgroundColor: SD_INK }}>
                      <Icon icon={s.icon} width={20} color={SD_GOLD} />
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 900, color: SD_GOLD_DEEP }}>STEP {i + 1}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 17, fontWeight: 800, mb: 0.6 }}>{s.title}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#4B4B52", lineHeight: 1.55 }}>{s.body}</Typography>
                </Box>
              </Reveal>
            </Grid>
          ))}
        </Grid>
      </Container>

      <ForBuyersSellers />

      {/* ===== Fees + policy ===== */}
      <Box sx={{ backgroundColor: "#fff", borderTop: `1px solid ${SD_BORDER}`, borderBottom: `1px solid ${SD_BORDER}` }} id="fees">
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Reveal>
                <Box sx={{ p: 3, borderRadius: 3, background: `linear-gradient(165deg, ${SD_INK} 0%, #17130A 100%)`, color: "#fff", height: "100%", border: `1px solid ${goldAlpha(0.22)}` }} data-testid="sd-fee-card">
                  <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: SD_GOLD, mb: 1 }}>Pricing</Typography>
                  <Typography sx={{ fontSize: 44, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1 }}>{fee}%</Typography>
                  <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.8)", mt: 0.8, mb: 2 }}>escrow fee per deal · minimum ${feeMin} · deals from ${minDeal}</Typography>
                  <Stack spacing={1}>
                    {[
                      "Buyer, seller or a 50/50 split can cover the fee — you choose when creating the deal.",
                      "Network & exchange costs are shown up-front and folded into the quote.",
                      "The fee applies on release, refund and split. On a mutually-agreed cancellation it's waived — only network and exchange costs are kept.",
                      "SafeDeal holds every deal in USDT. Payouts in USDT or USDC on Tron, Ethereum or Polygon.",
                    ].map((t) => (
                      <Stack key={t} direction="row" spacing={1} alignItems="flex-start">
                        <Icon icon="mdi:check-circle" width={16} color={SD_GOLD} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
                        <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.88)" }}>{t}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Reveal>
            </Grid>
            <Grid item xs={12} md={7}>
              <Reveal delay={0.1}>
                <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 2 }}>Cancellations & disputes, in plain words</Typography>
                <Stack spacing={2}>
                  {[
                    { icon: "mdi:cancel", title: "Cancel before funding — free", body: "Either side can cancel instantly while nothing has been paid." },
                    { icon: "mdi:handshake-outline", title: "Cancel after funding — both agree", body: "One side requests it, the other agrees. The buyer gets the held amount back to their SafeDeal wallet, minus only the network and exchange costs — the escrow fee is waived." },
                    { icon: "mdi:gavel", title: "Disputes — you propose, they respond", body: "Raise a dispute with a proposal (release, refund or a split). The other party accepts, counters or adds messages. Accepted proposals settle automatically." },
                    { icon: "mdi:account-tie", title: "SafeDeal decides only as a last resort", body: `Either side can escalate at any time, and a proposal that gets no answer for ${cfg?.dispute_auto_escalate_hours ?? 72} hours escalates automatically to SafeDeal.` },
                  ].map((p) => (
                    <Stack key={p.title} direction="row" spacing={1.6} alignItems="flex-start" data-testid="sd-policy-item">
                      <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: SD_GOLD_SOFT }}>
                        <Icon icon={p.icon} width={18} color={SD_GOLD_DEEP} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 15.5, fontWeight: 800 }}>{p.title}</Typography>
                        <Typography sx={{ fontSize: 13.5, color: "#4B4B52", lineHeight: 1.55 }}>{p.body}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Reveal>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Faq cfg={cfg} helpHref={href("/help")} />

      {/* ===== Bottom CTA ===== */}
      <Box sx={{ position: "relative", overflow: "hidden", backgroundColor: SD_INK, color: "#fff" }}>
        <Box aria-hidden sx={{ position: "absolute", inset: 0, background: `radial-gradient(600px 300px at 50% 120%, ${goldAlpha(0.22)}, transparent 65%)` }} />
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 }, textAlign: "center", position: "relative" }}>
          <Reveal>
            <Typography component="h2" sx={{ fontSize: { xs: 28, md: 40 }, fontWeight: 900, letterSpacing: -1, mb: 1 }}>Ready when you are</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.75)", mb: 3.5, maxWidth: 520, mx: "auto" }}>Create a deal in under a minute. The other party just needs an email address.</Typography>
            <Link href={cta} data-testid="sd-start-deal-bottom" style={{ textDecoration: "none" }}>
              <Button size="large" variant="contained" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ ...sdPrimaryBtn, px: 3.6, py: 1.4, fontSize: 16 }}>
                Start a deal
              </Button>
            </Link>
          </Reveal>
        </Container>
      </Box>
    </Box>
  );
}
