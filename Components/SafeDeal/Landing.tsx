import React, { useEffect, useState } from "react";
import { Box, Container, Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import safedealApi, { SdConfig } from "@/api/safedeal";
import { useSdHref } from "./sdRouting";
import { SD_INK, SD_INK_MUTED } from "./SafeDealShell";
import { SD_GOLD, SD_GOLD_DEEP, SD_TEXT_MUTED, SD_BORDER, SD_PAGE, goldAlpha } from "./sdTheme";
import HeroDealForm from "./HeroDealForm";
import EscrowScene from "./EscrowScene";
import { Faq } from "./LandingSections";

const STEPS = [
  { icon: "mdi:email-fast-outline", title: "Invite", body: "Name the deal, set the price, invite the other side. They accept in one click." },
  { icon: "mdi:lock-outline", title: "Fund & hold", body: "The buyer pays in any supported coin. SafeDeal holds it as USDT until the work is done." },
  { icon: "mdi:cash-check", title: "Deliver & release", body: "The seller delivers, the buyer checks and releases — or the timer does. Cash out any time." },
];

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

/** SafeDeal landing — one screen: the deal form on the left, the escrow flow on the right. */
export default function Landing() {
  const href = useSdHref();
  const [cfg, setCfg] = useState<SdConfig | null>(null);
  useEffect(() => {
    safedealApi.config().then(setCfg).catch(() => undefined);
  }, []);
  const fee = cfg?.fee_percent ?? 5;
  const feeMin = cfg?.fee_min_usd ?? 10;
  const minDeal = cfg?.min_deal_usd ?? 30;

  return (
    <Box data-testid="sd-landing">
      {/* ===== Hero: form + 3D flow ===== */}
      <Box sx={{ backgroundColor: SD_INK, color: "#fff", position: "relative", overflow: "hidden" }} id="how">
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(900px 480px at 8% -10%, ${goldAlpha(0.18)}, transparent 60%), radial-gradient(700px 420px at 100% 110%, ${goldAlpha(0.10)}, transparent 60%)` }} />
        <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.05, backgroundImage: "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)", backgroundSize: "52px 52px", maskImage: "radial-gradient(circle at 60% 40%, black, transparent 78%)" }} />
        <Container maxWidth="lg" sx={{ position: "relative", pt: { xs: 5, md: 7 }, pb: { xs: 6, md: 8 } }}>
          <Reveal>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <Box sx={{ px: 1.2, py: 0.4, borderRadius: 99, backgroundColor: goldAlpha(0.16), border: `1px solid ${goldAlpha(0.45)}`, fontSize: 12, fontWeight: 800, color: SD_GOLD }}>Escrow for online deals</Box>
              <Typography sx={{ fontSize: 12.5, color: SD_INK_MUTED }} data-testid="sd-hero-fee-line">{fee}% escrow fee · min ${feeMin} · deals from ${minDeal}</Typography>
            </Stack>
            <Typography component="h1" sx={{ fontSize: { xs: 34, sm: 44, lg: 56 }, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.4, mb: { xs: 3, md: 4 }, maxWidth: 820 }}>
              Pay when it&apos;s delivered. <span style={{ color: SD_GOLD }}>Get paid when it&apos;s done.</span>
            </Typography>
          </Reveal>
          <Grid container spacing={{ xs: 4, md: 5 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Reveal delay={0.1}>
                <HeroDealForm cfg={cfg} />
              </Reveal>
            </Grid>
            <Grid item xs={12} md={7}>
              <Reveal delay={0.2}>
                <EscrowScene />
              </Reveal>
              <Stack direction="row" spacing={{ xs: 1.5, sm: 3 }} flexWrap="wrap" useFlexGap justifyContent="center" sx={{ mt: 2.5 }} data-testid="sd-trust-strip">
                {[
                  ["mdi:lock-check-outline", "Held in USDT by SafeDeal"],
                  ["mdi:timer-check-outline", "Deadlines on every step"],
                  ["mdi:account-check-outline", "Human arbitration if you can't agree"],
                ].map(([ic, t]) => (
                  <Stack key={t} direction="row" spacing={0.8} alignItems="center">
                    <Icon icon={ic} width={16} color={SD_GOLD} aria-hidden />
                    <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>{t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ===== 3 steps ===== */}
      <Box sx={{ backgroundColor: SD_PAGE, borderBottom: `1px solid ${SD_BORDER}` }} id="steps">
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {STEPS.map((s, i) => (
              <Grid item xs={12} md={4} key={s.title}>
                <Stack direction="row" spacing={2} alignItems="flex-start" data-testid={`sd-step-${i + 1}`} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, height: "100%", transition: "transform .18s, box-shadow .18s, border-color .18s", "&:hover": { transform: "translateY(-3px)", boxShadow: `0 16px 34px ${goldAlpha(0.16)}`, borderColor: goldAlpha(0.5) } }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 3, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: SD_INK, color: SD_GOLD, position: "relative" }}>
                    <Icon icon={s.icon} width={22} aria-hidden />
                    <Box sx={{ position: "absolute", top: -8, left: -8, width: 20, height: 20, borderRadius: "50%", backgroundColor: SD_GOLD, color: SD_INK, fontSize: 11, fontWeight: 900, display: "grid", placeItems: "center" }}>{i + 1}</Box>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>{s.title}</Typography>
                    <Typography sx={{ fontSize: 13.5, color: SD_TEXT_MUTED, lineHeight: 1.55, mt: 0.3 }}>{s.body}</Typography>
                  </Box>
                </Stack>
              </Grid>
            ))}
          </Grid>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.6, sm: 3 }} alignItems={{ sm: "center" }} sx={{ mt: 3.5 }} id="fees" data-testid="sd-fee-card">
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: SD_GOLD_DEEP }}>Fees, plainly</Typography>
            <Typography sx={{ fontSize: 13.5, color: SD_TEXT_MUTED }}>
              {fee}% of the deal (min ${feeMin}), paid by the buyer unless you choose otherwise · no charge until the buyer funds · {cfg?.cancellation_fee_percent ?? 5}% if both sides cancel a funded deal · network costs at cost.
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Faq cfg={cfg} helpHref={href("/help")} />
    </Box>
  );
}
