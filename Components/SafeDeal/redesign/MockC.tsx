/**
 * Direction C — "The Flow" (Dynopay-style product mockup).
 * Hero pairs a realistic SafeDeal "deal card" UI mockup (funded -> held ->
 * released) with the 3D accent art and floating notification cards — the most
 * direct nod to Dynopay's checkout-mockup hero.
 * Preview mockup only — does not touch the live /safedeal landing.
 */
import React from "react";
import Link from "next/link";
import { Box, Button, Container, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import HeroDealForm from "@/Components/SafeDeal/HeroDealForm";
import { Faq } from "@/Components/SafeDeal/LandingSections";
import { useSdHref } from "@/Components/SafeDeal/sdRouting";
import { SD_GOLD, SD_GOLD_DARK, SD_GOLD_DEEP, SD_INK, SD_INK_SOFT, SD_BORDER, SD_TEXT_MUTED, goldAlpha } from "@/Components/SafeDeal/sdTheme";
import {
  ART,
  CoinMarquee,
  Eyebrow,
  Floaty,
  NotifCard,
  Reveal,
  StatsStrip,
  STEPS,
  Testimonial,
  useSdConfig,
} from "./shared";

/* Realistic SafeDeal "deal card" — a deal moving through funded -> held -> released. */
function DealCardMock() {
  const timeline: Array<{ icon: string; label: string; meta: string; state: "done" | "active" | "todo" }> = [
    { icon: "mdi:email-check-outline", label: "Invite accepted", meta: "Both sides on board", state: "done" },
    { icon: "mdi:cash-lock", label: "Buyer funded the deal", meta: "$2,400 in USDT", state: "done" },
    { icon: "mdi:shield-lock-outline", label: "Held in escrow", meta: "Seller delivering now", state: "active" },
    { icon: "mdi:cash-check", label: "Release to seller", meta: "Auto-release in 3 days", state: "todo" },
  ];
  return (
    <Box sx={{ borderRadius: 5, overflow: "hidden", backgroundColor: SD_INK, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 40px 90px rgba(0,0,0,0.4)" }}>
      {/* browser chrome */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.4, borderBottom: "1px solid rgba(255,255,255,0.08)", backgroundColor: SD_INK_SOFT }}>
        <Stack direction="row" spacing={0.7}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (<Box key={c} sx={{ width: 11, height: 11, borderRadius: "50%", backgroundColor: c }} />))}
        </Stack>
        <Box sx={{ ml: 1, flex: 1, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.06)", px: 1.6, py: 0.5, display: "flex", alignItems: "center", gap: 0.7 }}>
          <Icon icon="mdi:lock" width={12} color="rgba(255,255,255,0.5)" aria-hidden />
          <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>safedeal.sh/deal/ac2f9b</Typography>
        </Box>
      </Stack>

      {/* card body */}
      <Box sx={{ p: { xs: 2.4, md: 3 }, color: "#fff" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1.4} alignItems="center">
            <Box sx={{ width: 40, height: 40, borderRadius: 2.5, backgroundColor: SD_GOLD, color: SD_INK, display: "grid", placeItems: "center", fontWeight: 900 }}>A</Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800 }}>Logo &amp; brand kit for Acme</Typography>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Seller &middot; you</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ px: 1.2, py: 0.5, borderRadius: 99, backgroundColor: goldAlpha(0.16), border: `1px solid ${goldAlpha(0.4)}` }}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: SD_GOLD, boxShadow: `0 0 8px ${SD_GOLD}` }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: SD_GOLD }}>In escrow</Typography>
          </Stack>
        </Stack>

        <Box sx={{ p: 2, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", mb: 2.2 }}>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Held in escrow</Typography>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>$2,400.00</Typography>
            <Typography sx={{ fontSize: 13, color: SD_GOLD, fontWeight: 800 }}>USDT</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={62} sx={{ mt: 1.4, height: 7, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.1)", "& .MuiLinearProgress-bar": { backgroundColor: SD_GOLD, borderRadius: 99 } }} />
        </Box>

        <Stack spacing={1.6}>
          {timeline.map((t) => {
            const done = t.state === "done";
            const active = t.state === "active";
            const c = active ? SD_GOLD : done ? "#12B76A" : "rgba(255,255,255,0.28)";
            return (
              <Stack key={t.label} direction="row" spacing={1.4} alignItems="center">
                <Box sx={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: active ? goldAlpha(0.18) : done ? "rgba(18,183,106,0.16)" : "rgba(255,255,255,0.05)", border: `1px solid ${c}` }}>
                  <Icon icon={done ? "mdi:check" : t.icon} width={16} color={c} aria-hidden />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: active || done ? "#fff" : "rgba(255,255,255,0.55)" }}>{t.label}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>{t.meta}</Typography>
                </Box>
                {active && <Typography sx={{ fontSize: 11, fontWeight: 800, color: SD_GOLD }}>NOW</Typography>}
              </Stack>
            );
          })}
        </Stack>

        <Stack direction="row" spacing={1.2} sx={{ mt: 2.4 }}>
          <Button fullWidth variant="contained" endIcon={<Icon icon="mdi:cash-check" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>Release funds</Button>
          <Button variant="outlined" sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, minWidth: 52, color: "#fff", borderColor: "rgba(255,255,255,0.24)" }} aria-label="Message"><Icon icon="mdi:message-outline" width={20} /></Button>
        </Stack>
      </Box>
    </Box>
  );
}

export default function MockC() {
  const cfg = useSdConfig();
  const href = useSdHref();
  const fee = cfg?.fee_percent ?? 5;
  const feeMin = cfg?.fee_min_usd ?? 10;
  const minDeal = cfg?.min_deal_usd ?? 30;
  const cancelFee = cfg?.cancellation_fee_percent ?? 5;

  return (
    <Box data-testid="sd-mock-c" sx={{ backgroundColor: "#F7F8FB", color: SD_INK }}>
      {/* ===== HERO ===== */}
      <Box sx={{ position: "relative", overflow: "hidden", background: "linear-gradient(180deg, #FFFFFF 0%, #F7F8FB 100%)" }} id="how">
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(720px 420px at 88% 8%, ${goldAlpha(0.14)}, transparent 60%)` }} />
        <Container maxWidth="lg" sx={{ position: "relative", pt: { xs: 5, md: 8 }, pb: { xs: 6, md: 9 } }}>
          <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Reveal>
                <Eyebrow tone="light">Crypto escrow, live</Eyebrow>
                <Typography component="h1" sx={{ fontSize: { xs: 38, sm: 48, lg: 58 }, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.8, mt: 1.4, mb: 2.4 }}>
                  Watch a deal go from <span style={{ color: SD_GOLD_DEEP }}>funded</span> to <span style={{ color: SD_GOLD_DEEP }}>done.</span>
                </Typography>
                <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: SD_TEXT_MUTED, lineHeight: 1.6, maxWidth: 460, mb: 3.5 }}>
                  Every SafeDeal has one clear page: the money held in USDT, a live status, and one button to release. No account, no chargebacks, no chasing.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.4}>
                  <Button component="a" href="#sd-start" variant="contained" size="large" endIcon={<Icon icon="mdi:arrow-right" />} data-testid="sd-cta-start" sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 3.5, py: 1.3, fontSize: 15.5, color: SD_INK, backgroundColor: SD_GOLD, boxShadow: `0 14px 32px ${goldAlpha(0.35)}`, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>Start a deal</Button>
                  <Link href={href("/help")} style={{ textDecoration: "none" }}>
                    <Button variant="outlined" size="large" startIcon={<Icon icon="mdi:play-circle-outline" />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, px: 3.5, py: 1.3, fontSize: 15.5, color: SD_INK, borderColor: SD_BORDER, "&:hover": { borderColor: SD_GOLD_DEEP } }}>See how it works</Button>
                  </Link>
                </Stack>
                <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, mt: 2 }} data-testid="sd-hero-fee-line">{fee}% escrow fee &middot; min ${feeMin} &middot; deals from ${minDeal}</Typography>
              </Reveal>
            </Grid>

            <Grid item xs={12} md={7}>
              <Reveal delay={0.15}>
                <Box sx={{ position: "relative", maxWidth: 520, mx: "auto" }}>
                  <Box aria-hidden sx={{ position: "absolute", inset: "-8% -6%", background: `radial-gradient(closest-side, ${goldAlpha(0.18)}, transparent)`, filter: "blur(8px)" }} />
                  <Box sx={{ position: "relative" }}><DealCardMock /></Box>
                  {/* accent art */}
                  <Box sx={{ position: "absolute", bottom: -34, left: -30, width: { xs: 120, md: 168 }, display: { xs: "none", sm: "block" } }}>
                    <Floaty distance={12}>
                      <Box component="img" src={ART.flowAccent} alt="Gold coins secured by a padlock" sx={{ width: "100%", height: "auto", borderRadius: 4, filter: `drop-shadow(0 24px 50px ${goldAlpha(0.3)})` }} />
                    </Floaty>
                  </Box>
                  {/* floating notif */}
                  <Box sx={{ position: "absolute", top: -22, right: { xs: -6, md: -28 }, display: { xs: "none", sm: "block" } }}>
                    <Floaty delay={0.6}><NotifCard tone="light" icon="mdi:cash-lock" title="Deal funded" body="Buyer sent $2,400 — now held in escrow." /></Floaty>
                  </Box>
                </Box>
              </Reveal>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ===== COIN MARQUEE ===== */}
      <Box sx={{ borderTop: `1px solid ${SD_BORDER}`, borderBottom: `1px solid ${SD_BORDER}`, backgroundColor: "#fff" }}>
        <Container maxWidth="lg" sx={{ py: 2.5 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: SD_TEXT_MUTED, textAlign: "center", mb: 1 }}>Pay in any coin &middot; held as USDT</Typography>
          <CoinMarquee tone="light" />
        </Container>
      </Box>

      {/* ===== STATS ===== */}
      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 7 } }}>
        <Reveal><StatsStrip tone="light" cfg={cfg} /></Reveal>
      </Container>

      {/* ===== START A DEAL (working form on dark panel) ===== */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Box id="sd-start" sx={{ borderRadius: 6, p: { xs: 3, md: 5 }, backgroundColor: SD_INK, position: "relative", overflow: "hidden" }}>
          <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(600px 300px at 12% 0%, ${goldAlpha(0.18)}, transparent 60%)` }} />
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center" sx={{ position: "relative" }}>
            <Grid item xs={12} md={6}>
              <Eyebrow tone="dark">Start now</Eyebrow>
              <Typography component="h2" sx={{ fontSize: { xs: 26, md: 36 }, fontWeight: 900, letterSpacing: -1, color: "#fff", mt: 1, mb: 2 }}>Your deal, live in under a minute.</Typography>
              <Typography sx={{ fontSize: 15, color: "rgba(255,255,255,0.72)", lineHeight: 1.6, maxWidth: 420, mb: 3 }}>Name it, price it, invite the other side. They accept in one click and the money is only ever held in escrow &mdash; never sent early.</Typography>
              <Stack spacing={1.4}>
                {[["mdi:account-off-outline", "No account — sign in with an email code"], ["mdi:shield-lock-outline", "Funds held in USDT, released on your say-so"], ["mdi:gavel", "Human arbitration if you can't agree"]].map(([ic, t]) => (
                  <Stack key={t} direction="row" spacing={1.2} alignItems="center">
                    <Icon icon={ic} width={20} color={SD_GOLD} aria-hidden />
                    <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <HeroDealForm cfg={cfg} />
            </Grid>
          </Grid>
        </Box>
      </Container>

      {/* ===== HOW IT WORKS ===== */}
      <Container maxWidth="lg" sx={{ pb: { xs: 6, md: 9 } }} id="steps">
        <Reveal>
          <Stack alignItems="center" textAlign="center" spacing={1} sx={{ mb: 4 }}>
            <Eyebrow tone="light">How it works</Eyebrow>
            <Typography component="h2" sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 900, letterSpacing: -1 }}>From invite to payout</Typography>
          </Stack>
        </Reveal>
        <Grid container spacing={{ xs: 2.5, md: 3 }}>
          {STEPS.map((s, i) => (
            <Grid item xs={12} md={4} key={s.title}>
              <Reveal delay={i * 0.1}>
                <Box data-testid={`sd-step-${i + 1}`} sx={{ p: { xs: 3, md: 3.2 }, borderRadius: 5, height: "100%", backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, transition: "transform .2s, box-shadow .2s", "&:hover": { transform: "translateY(-4px)", boxShadow: `0 22px 48px ${goldAlpha(0.16)}` } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.6 }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: 3, display: "grid", placeItems: "center", backgroundColor: SD_INK, color: SD_GOLD }}>
                      <Icon icon={s.icon} width={24} aria-hidden />
                    </Box>
                    <Typography sx={{ fontSize: 40, fontWeight: 900, color: goldAlpha(0.28), lineHeight: 1 }}>{i + 1}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.3 }}>{s.title}</Typography>
                  <Typography sx={{ fontSize: 14, color: SD_TEXT_MUTED, lineHeight: 1.6, mt: 0.6 }}>{s.body}</Typography>
                </Box>
              </Reveal>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ===== FEES ===== */}
      <Box sx={{ backgroundColor: "#fff", borderTop: `1px solid ${SD_BORDER}`, borderBottom: `1px solid ${SD_BORDER}` }} id="fees">
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Reveal>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={7}>
                <Eyebrow tone="light">Fees, plainly</Eyebrow>
                <Typography sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mt: 1 }}>{fee}% of the deal, min ${feeMin}.</Typography>
                <Typography sx={{ fontSize: 14.5, color: SD_TEXT_MUTED, lineHeight: 1.6, mt: 1.4, maxWidth: 560 }}>
                  Paid by the buyer unless you choose otherwise. Nothing is charged until the buyer funds. A {cancelFee}% fee applies only if both sides cancel a funded deal. Network and exchange costs are shown up-front, at cost.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={1.4}>
                  {[["mdi:cash-remove", "$0 until funded"], ["mdi:swap-horizontal", "Pay in 40+ coins, settle in USDT"], ["mdi:earth", "Works worldwide"]].map(([ic, t]) => (
                    <Stack key={t} direction="row" spacing={1.2} alignItems="center" sx={{ p: 1.7, borderRadius: 3, backgroundColor: "#F7F8FB", border: `1px solid ${SD_BORDER}` }}>
                      <Icon icon={ic} width={20} color={SD_GOLD_DEEP} aria-hidden />
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Reveal>
        </Container>
      </Box>

      {/* ===== TESTIMONIAL ===== */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
        <Reveal><Testimonial tone="light" /></Reveal>
      </Container>

      {/* ===== FAQ (reused light section) ===== */}
      <Faq cfg={cfg} helpHref={href("/help")} />

      {/* ===== CLOSING CTA ===== */}
      <Box sx={{ backgroundColor: SD_INK, position: "relative", overflow: "hidden" }}>
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(700px 340px at 50% 120%, ${goldAlpha(0.2)}, transparent 60%)` }} />
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 }, textAlign: "center", position: "relative" }}>
          <Reveal>
            <Typography component="h2" sx={{ fontSize: { xs: 32, md: 46 }, fontWeight: 900, letterSpacing: -1.4, color: "#fff", mb: 2 }}>Put your next deal on rails.</Typography>
            <Typography sx={{ fontSize: 16, color: "rgba(255,255,255,0.72)", maxWidth: 520, mx: "auto", mb: 4 }}>Start a deal in under a minute. You only pay when it&apos;s funded.</Typography>
            <Button component="a" href="#sd-start" variant="contained" size="large" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, px: 4, py: 1.4, fontSize: 16, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>Start a deal</Button>
          </Reveal>
        </Container>
      </Box>
    </Box>
  );
}
