import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Container, Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { SdConfig } from "@/api/safedeal";
import { useSdHref, useSdSession } from "./sdRouting";
import { SD_INK, SD_AMBER } from "./SafeDealShell";

const STEPS = [
  { icon: "mdi:email-fast-outline", title: "Invite", body: "Describe the deal, set the price and invite the other party by email. They accept the terms in one click." },
  { icon: "mdi:lock-outline", title: "Fund", body: "The buyer pays through Dynopay in any supported coin. Funds are converted to USDT and held safely." },
  { icon: "mdi:package-variant-closed-check", title: "Deliver", body: "The seller delivers and marks the deal done. The buyer has a set number of days to check." },
  { icon: "mdi:cash-check", title: "Release", body: "The buyer releases — or the timer does. The seller's wallet is credited instantly. Withdraw any time." },
];

export default function Landing() {
  const href = useSdHref();
  const { user } = useSdSession();
  const [cfg, setCfg] = useState<SdConfig | null>(null);
  useEffect(() => {
    safedealApi.config().then(setCfg).catch(() => undefined);
  }, []);
  const fee = cfg?.fee_percent ?? 5;
  const feeMin = cfg?.fee_min_usd ?? 10;
  const minDeal = cfg?.min_deal_usd ?? 30;
  const cta = href(user ? "/deals/new" : "/signin?next=%2Fdeals%2Fnew");

  return (
    <Box data-testid="sd-landing">
      {/* Hero */}
      <Box sx={{ backgroundColor: SD_INK, color: "#fff", position: "relative", overflow: "hidden" }}>
        <Box sx={{ position: "absolute", inset: 0, background: "radial-gradient(800px 400px at 15% 0%, rgba(99,102,241,0.35), transparent 60%), radial-gradient(600px 300px at 90% 100%, rgba(245,158,11,0.18), transparent 60%)" }} />
        <Container maxWidth="lg" sx={{ position: "relative", py: { xs: 8, md: 12 } }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                <Box sx={{ px: 1.2, py: 0.4, borderRadius: 99, backgroundColor: "rgba(165,180,252,0.15)", border: "1px solid rgba(165,180,252,0.35)", fontSize: 12, fontWeight: 800, color: "#C7D2FE" }}>
                  Escrow for online deals
                </Box>
                <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Powered by Dynopay</Typography>
              </Stack>
              <Typography component="h1" sx={{ fontSize: { xs: 38, sm: 48, lg: 60 }, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.5, mb: 2.5 }}>
                Pay when it&apos;s delivered.
                <br />
                <span style={{ color: "#A5B4FC" }}>Get paid when it&apos;s done.</span>
              </Typography>
              <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: "rgba(255,255,255,0.75)", maxWidth: 560, mb: 4, lineHeight: 1.6 }}>
                SafeDeal holds the buyer&apos;s money in USDT until the seller delivers. No accounts to set up — both sides sign in with
                an email code. If something goes wrong, you sort it out together first; Dynopay steps in only if you can&apos;t.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
                <Link href={cta} data-testid="sd-start-deal" style={{ textDecoration: "none" }}>
                  <Button size="large" variant="contained" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 3.2, py: 1.3, fontSize: 16, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }}>
                    Start a deal
                  </Button>
                </Link>
                <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                  {fee}% escrow fee · min ${feeMin} · deals from ${minDeal}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ borderRadius: 4, p: 2.5, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(14px)" }} data-testid="sd-hero-card">
                <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", mb: 1.5 }}>Example deal</Typography>
                <Stack spacing={1.2}>
                  {[
                    ["Logo & brand kit", "$500.00", "#fff"],
                    ["Escrow fee (5%)", "$25.00", "rgba(255,255,255,0.7)"],
                    ["Network & exchange (est.)", "$2.50", "rgba(255,255,255,0.7)"],
                  ].map(([l, v, c]) => (
                    <Stack key={l} direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 14, color: c }}>{l}</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</Typography>
                    </Stack>
                  ))}
                  <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.12)", pt: 1.2 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Buyer pays</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#A5B4FC" }}>$527.50</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Seller receives</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#6EE7B7" }}>$500.00</Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Icon icon="mdi:timer-sand" width={16} color={SD_AMBER} />
                    <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Held in USDT · auto-releases 5 days after delivery unless the buyer objects</Typography>
                  </Stack>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* How it works */}
      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }} id="how">
        <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 1 }}>How it works</Typography>
        <Typography sx={{ color: "#6B7280", mb: 4, maxWidth: 620 }}>Four steps. Both sides see the same deal page, the same numbers and the same timeline.</Typography>
        <Grid container spacing={2.5}>
          {STEPS.map((s, i) => (
            <Grid item xs={12} sm={6} md={3} key={s.title}>
              <Box sx={{ p: 2.5, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB", height: "100%", transition: "transform .18s, box-shadow .18s", "&:hover": { transform: "translateY(-3px)", boxShadow: "0 14px 30px rgba(15,23,42,0.08)" } }} data-testid={`sd-step-${i + 1}`}>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", backgroundColor: `${BRAND_ACCENT}14` }}>
                    <Icon icon={s.icon} width={20} color={BRAND_ACCENT} />
                  </Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: "#9CA3AF" }}>STEP {i + 1}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 17, fontWeight: 800, mb: 0.6 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.55 }}>{s.body}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Fees + policy */}
      <Box sx={{ backgroundColor: "#fff", borderTop: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }} id="fees">
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 } }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Box sx={{ p: 3, borderRadius: 3, backgroundColor: SD_INK, color: "#fff", height: "100%" }} data-testid="sd-fee-card">
                <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", mb: 1 }}>Pricing</Typography>
                <Typography sx={{ fontSize: 44, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1 }}>{fee}%</Typography>
                <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.7)", mt: 0.8, mb: 2 }}>escrow fee per deal · minimum ${feeMin} · deals from ${minDeal}</Typography>
                <Stack spacing={1}>
                  {[
                    "Buyer, seller or a 50/50 split can cover the fee — you choose when creating the deal.",
                    "Network & exchange costs are shown up-front and folded into the quote.",
                    "The fee is charged on every outcome — release, refund, split or agreed cancellation.",
                    "Custody is always in USDT. Payouts in USDT or USDC on Tron, Ethereum or Polygon.",
                  ].map((t) => (
                    <Stack key={t} direction="row" spacing={1} alignItems="flex-start">
                      <Icon icon="mdi:check-circle" width={16} color="#6EE7B7" style={{ marginTop: 2 }} />
                      <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.8)" }}>{t}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} md={7}>
              <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 2 }}>Cancellations & disputes, in plain words</Typography>
              <Stack spacing={2}>
                {[
                  { icon: "mdi:cancel", title: "Cancel before funding — free", body: "Either side can cancel instantly while nothing has been paid." },
                  { icon: "mdi:handshake-outline", title: "Cancel after funding — both agree", body: "One side requests it, the other agrees. The buyer gets the held amount back to their SafeDeal wallet, minus the escrow fee and costs." },
                  { icon: "mdi:gavel", title: "Disputes — you propose, they respond", body: "Raise a dispute with a proposal (release, refund or a split). The other party accepts, counters or adds messages. Accepted proposals settle automatically." },
                  { icon: "mdi:account-tie", title: "Dynopay decides only as a last resort", body: `Either side can escalate at any time, and a proposal that gets no answer for ${cfg?.dispute_auto_escalate_hours ?? 72} hours escalates automatically.` },
                ].map((p) => (
                  <Stack key={p.title} direction="row" spacing={1.6} alignItems="flex-start" data-testid="sd-policy-item">
                    <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: `${SD_AMBER}1F` }}>
                      <Icon icon={p.icon} width={18} color="#B45309" />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 15.5, fontWeight: 800 }}>{p.title}</Typography>
                      <Typography sx={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.55 }}>{p.body}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 9 }, textAlign: { xs: "left", md: "center" } }}>
        <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 1 }}>Ready when you are</Typography>
        <Typography sx={{ color: "#6B7280", mb: 3 }}>Create a deal in under a minute. The other party just needs an email address.</Typography>
        <Link href={cta} data-testid="sd-start-deal-bottom" style={{ textDecoration: "none" }}>
          <Button size="large" variant="contained" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 3.2, py: 1.2, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } }}>
            Start a deal
          </Button>
        </Link>
      </Container>
    </Box>
  );
}
