import React from "react";
import Link from "next/link";
import { Accordion, AccordionDetails, AccordionSummary, Box, Container, Grid, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdConfig } from "@/api/safedeal";
import { SD_GOLD, SD_GOLD_DEEP, SD_GOLD_SOFT, SD_INK, SD_BORDER, SD_TEXT_MUTED } from "./sdTheme";

const BUYER = [
  { icon: "mdi:lock-check-outline", t: "Your money is held, not sent", b: "SafeDeal keeps it in USDT. The seller can't touch it until you release — or the inspection period ends without an objection." },
  { icon: "mdi:magnify-scan", t: "You get time to check", b: "After the seller marks it delivered you have a set number of days to inspect. Raise an issue in that window and the timer stops." },
  { icon: "mdi:cash-refund", t: "If it never arrives, you're refunded", b: "A deal that's disputed and decided in your favour is refunded straight to your wallet address — or to your SafeDeal balance until you add one." },
];
const SELLER = [
  { icon: "mdi:shield-check-outline", t: "Start only when it's funded", b: "You see 'Funded' before you lift a finger. The money is already in escrow — no chasing invoices." },
  { icon: "mdi:timer-check-outline", t: "Silence means you get paid", b: "If the buyer does nothing during the inspection period, the funds release to you automatically." },
  { icon: "mdi:bank-transfer-out", t: "Withdraw in stablecoin", b: "Your wallet is credited in USD value, paid out as USDT or USDC on Tron, Ethereum or Polygon." },
];

export function ForBuyersSellers() {
  const col = (title: string, icon: string, items: typeof BUYER, testid: string) => (
    <Grid item xs={12} md={6}>
      <Box sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, height: "100%" }} data-testid={testid}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", backgroundColor: SD_INK }} aria-hidden>
            <Icon icon={icon} width={20} color={SD_GOLD} />
          </Box>
          <Typography component="h3" sx={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>{title}</Typography>
        </Stack>
        <Stack spacing={2}>
          {items.map((i) => (
            <Stack key={i.t} direction="row" spacing={1.4} alignItems="flex-start">
              <Box sx={{ width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: SD_GOLD_SOFT }} aria-hidden>
                <Icon icon={i.icon} width={17} color={SD_GOLD_DEEP} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{i.t}</Typography>
                <Typography sx={{ fontSize: 13.5, color: "#4B4B52", lineHeight: 1.55 }}>{i.b}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Grid>
  );
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }} id="who">
      <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 1 }}>Built for both sides</Typography>
      <Typography sx={{ color: SD_TEXT_MUTED, mb: 4, maxWidth: 620 }}>Neither party has to trust the other — only the process.</Typography>
      <Grid container spacing={2.5}>
        {col("For buyers", "mdi:cart-outline", BUYER, "sd-for-buyers")}
        {col("For sellers", "mdi:storefront-outline", SELLER, "sd-for-sellers")}
      </Grid>
    </Container>
  );
}

export function faqItems(cfg: SdConfig | null, helpHref: string) {
  const fee = cfg?.fee_percent ?? 5;
  const feeMin = cfg?.fee_min_usd ?? 10;
  const hours = cfg?.dispute_auto_escalate_hours ?? 72;
  return [
    { q: "Who holds my money?", a: "SafeDeal does, in USDT (a US-dollar stablecoin), in escrow. Payments are processed by Dynopay, but the funds are held by SafeDeal — they never sit with the other party or a third-party marketplace." },
    { q: "What if the seller disappears after I pay?", a: "Nothing releases without your action or the end of the inspection period — and the inspection period only starts once the seller marks the deal delivered. If they never deliver, open a dispute from the deal page; an unanswered dispute escalates to the SafeDeal team automatically." },
    { q: "What if I get nothing, or not what was agreed?", a: "Raise an issue during the inspection period. You propose an outcome (refund, partial refund or release), the seller responds, and most cases settle between the two of you. If you can't agree, the SafeDeal team decides based on the terms and the evidence in the deal." },
    { q: "How do I get paid out?", a: "Set a payout address (USDT or USDC on Tron, Ethereum or Polygon) on the deal and the money is sent there automatically the moment the buyer releases — network fee covered by the deal. No address yet? It waits in your SafeDeal balance and goes out as soon as you add one." },
    { q: "What does it cost?", a: `${fee}% of the deal amount, minimum $${feeMin}, plus network and exchange costs shown up-front in the quote. You choose whether the buyer, the seller or both cover the fee. Fees are charged on every outcome, including refunds and agreed cancellations.` },
    { q: "Can I cancel?", a: `Before funding, either side can cancel for free. After funding, one side requests it and the other agrees; the buyer is refunded minus fees and costs. A request that gets no answer for ${hours} hours escalates to the SafeDeal team.` },
    { q: "Do I need an account or a crypto wallet?", a: "No. You sign in with an email code, and a SafeDeal wallet is created for you. Buyers pay from any wallet or exchange in the coin they choose — the deal page shows the address, amount and live status; sellers only need a payout address to get paid." },
  ].concat([{ q: "Where can I read the full rules?", a: `See the help centre and terms linked in the footer, or go to ${helpHref}.` }]).slice(0, 7);
}

export function Faq({ cfg, helpHref }: { cfg: SdConfig | null; helpHref: string }) {
  const items = faqItems(cfg, helpHref).slice(0, 6);
  return (
    <Box sx={{ backgroundColor: "#fff", borderTop: `1px solid ${SD_BORDER}` }} id="faq">
      <Container maxWidth="md" sx={{ py: { xs: 7, md: 9 } }}>
        <Typography component="h2" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: -0.8, mb: 3 }}>Questions people ask first</Typography>
        <Stack spacing={1} data-testid="sd-faq">
          {items.map((f, i) => (
            <Accordion key={f.q} disableGutters elevation={0} sx={{ border: `1px solid ${SD_BORDER}`, borderRadius: "12px !important", "&:before": { display: "none" } }} data-testid={`sd-faq-item-${i + 1}`}>
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" width={22} />} sx={{ px: 2, "& .MuiAccordionSummary-content": { my: 1.2 } }}>
                <Typography component="h3" sx={{ fontSize: 15.5, fontWeight: 800 }}>{f.q}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                <Typography sx={{ fontSize: 14, color: "#4B4B52", lineHeight: 1.6 }}>{f.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
        <Typography sx={{ fontSize: 13.5, color: SD_TEXT_MUTED, mt: 2 }}>
          More in the <Link href={helpHref} style={{ color: SD_GOLD_DEEP, fontWeight: 700 }} data-testid="sd-faq-help-link">help centre</Link>.
        </Typography>
      </Container>
    </Box>
  );
}
