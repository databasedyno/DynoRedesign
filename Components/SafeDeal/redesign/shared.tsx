/**
 * Shared building blocks for the SafeDeal landing-redesign mockups (A/B/C).
 * Phase-1 preview only — none of this touches the live /safedeal landing page.
 *
 * Everything is on-brand SafeDeal gold (#FFC61A) + ink (#0A0A0B). The 3D art is
 * AI-generated (Nano Banana) and lives in /public/safedeal/redesign.
 */
import React, { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { motion, useReducedMotion } from "framer-motion";
import safedealApi, { SdConfig } from "@/api/safedeal";
import {
  SD_GOLD,
  SD_GOLD_DEEP,
  SD_INK,
  SD_BORDER,
  SD_TEXT_MUTED,
  goldAlpha,
} from "@/Components/SafeDeal/sdTheme";

/* ---- Generated 3D artwork (served statically from /public) ---- */
export const ART = {
  vault: "/safedeal/redesign/vault.jpg",
  handshake: "/safedeal/redesign/handshake.jpg",
  flowAccent: "/safedeal/redesign/flow-accent.jpg",
  shield: "/safedeal/redesign/shield.jpg",
} as const;

/** Live SafeDeal config (real fee / minimums) — same source the live landing uses. */
export function useSdConfig(): SdConfig | null {
  const [cfg, setCfg] = useState<SdConfig | null>(null);
  useEffect(() => {
    safedealApi.config().then(setCfg).catch(() => undefined);
  }, []);
  return cfg;
}

export type Tone = "dark" | "light";

/* ---- Supported coins (SafeDeal accepts any, settles to USDT) ---- */
export const COINS: Array<{ id: string; label: string }> = [
  { id: "btc", label: "Bitcoin" },
  { id: "eth", label: "Ethereum" },
  { id: "usdt", label: "Tether" },
  { id: "usdc", label: "USD Coin" },
  { id: "ltc", label: "Litecoin" },
  { id: "trx", label: "Tron" },
  { id: "sol", label: "Solana" },
  { id: "doge", label: "Dogecoin" },
  { id: "xrp", label: "XRP" },
  { id: "bnb", label: "BNB" },
  { id: "matic", label: "Polygon" },
];

/* Motion helpers.
   Reveal is a CSS keyframe animation (NOT JS-gated): it runs at first paint, so
   content is never held invisible while the heavy app bundle hydrates, and it
   always ends fully visible. Respects prefers-reduced-motion via CSS. */
export function Reveal({ children, delay = 0, y = 20 }: { children: React.ReactNode; delay?: number; y?: number }) {
  return (
    <Box
      sx={{
        animation: `sdReveal 0.6s ease-out ${delay}s both`,
        "@keyframes sdReveal": {
          from: { opacity: 0, transform: `translateY(${y}px)` },
          to: { opacity: 1, transform: "none" },
        },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      {children}
    </Box>
  );
}

export function Floaty({ children, delay = 0, distance = 10, duration = 5 }: { children: React.ReactNode; delay?: number; distance?: number; duration?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      animate={{ y: [0, -distance, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
      style={{ willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}

/* ---- Small eyebrow label ---- */
export function Eyebrow({ tone = "light", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: tone === "dark" ? SD_GOLD : SD_GOLD_DEEP,
      }}
    >
      {children}
    </Typography>
  );
}

/* ---- Scrolling row of supported coins ---- */
export function CoinMarquee({ tone = "dark" }: { tone?: Tone }) {
  const dark = tone === "dark";
  const chipBg = dark ? "rgba(255,255,255,0.05)" : "#fff";
  const chipBorder = dark ? "rgba(255,255,255,0.10)" : SD_BORDER;
  const fg = dark ? "rgba(255,255,255,0.86)" : SD_INK;
  const row = [...COINS, ...COINS];
  return (
    <Box
      data-testid="sd-coin-marquee"
      aria-hidden
      sx={{
        overflow: "hidden",
        py: 1,
        maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          width: "max-content",
          gap: 1.5,
          animation: "sdCoinScroll 34s linear infinite",
          "@keyframes sdCoinScroll": { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
          "@media (prefers-reduced-motion: reduce)": { animation: "none", flexWrap: "wrap", width: "auto", justifyContent: "center" },
        }}
      >
        {row.map((c, i) => (
          <Stack
            key={`${c.id}-${i}`}
            direction="row"
            spacing={0.9}
            alignItems="center"
            sx={{ px: 1.6, py: 0.9, borderRadius: 99, backgroundColor: chipBg, border: `1px solid ${chipBorder}`, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <Icon icon={`cryptocurrency-color:${c.id}`} width={20} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: fg }}>{c.label}</Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

/* ---- Compact stats / trust strip ---- */
export function StatsStrip({ tone = "dark", cfg }: { tone?: Tone; cfg: SdConfig | null }) {
  const dark = tone === "dark";
  const fee = cfg?.fee_percent ?? 5;
  const items = [
    { big: "40+", small: "coins accepted" },
    { big: "100%", small: "held in USDT" },
    { big: `${fee}%`, small: "flat escrow fee" },
    { big: "24/7", small: "human arbitration" },
  ];
  const fg = dark ? "#fff" : SD_INK;
  const muted = dark ? "rgba(255,255,255,0.62)" : SD_TEXT_MUTED;
  const divider = dark ? "rgba(255,255,255,0.10)" : SD_BORDER;
  return (
    <Stack
      direction="row"
      data-testid="sd-stats-strip"
      sx={{
        borderRadius: 4,
        border: `1px solid ${divider}`,
        backgroundColor: dark ? "rgba(255,255,255,0.03)" : "#fff",
        overflow: "hidden",
        flexWrap: { xs: "wrap", sm: "nowrap" },
      }}
    >
      {items.map((it, i) => (
        <Box
          key={it.small}
          sx={{
            flex: { xs: "1 1 50%", sm: "1 1 0" },
            px: { xs: 2, md: 3 },
            py: { xs: 2, md: 2.4 },
            textAlign: "center",
            borderLeft: { sm: i === 0 ? "none" : `1px solid ${divider}` },
            borderTop: { xs: i >= 2 ? `1px solid ${divider}` : "none", sm: "none" },
          }}
        >
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 900, letterSpacing: -0.8, color: fg, lineHeight: 1 }}>{it.big}</Typography>
          <Typography sx={{ fontSize: 12.5, color: muted, mt: 0.6, fontWeight: 600 }}>{it.small}</Typography>
        </Box>
      ))}
    </Stack>
  );
}

/* ---- Floating glassy status pill (Funded / In escrow / Released) ---- */
export function StatusPill({ icon, label, state = "gold", tone = "dark" }: { icon: string; label: string; state?: "gold" | "green"; tone?: Tone }) {
  const dark = tone === "dark";
  const accent = state === "green" ? "#12B76A" : SD_GOLD;
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        px: 1.6,
        py: 0.9,
        borderRadius: 99,
        backgroundColor: dark ? "rgba(20,20,23,0.82)" : "rgba(255,255,255,0.94)",
        backdropFilter: "blur(14px)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : SD_BORDER}`,
        boxShadow: dark ? "0 18px 40px rgba(0,0,0,0.45)" : "0 18px 40px rgba(15,23,42,0.12)",
        whiteSpace: "nowrap",
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: accent, boxShadow: `0 0 10px ${accent}` }} />
      <Icon icon={icon} width={16} color={dark ? "#fff" : SD_INK} aria-hidden />
      <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: dark ? "#fff" : SD_INK }}>{label}</Typography>
    </Stack>
  );
}

/* ---- Floating notification card (live-product feel) ---- */
export function NotifCard({ title, body, icon = "mdi:bell-ring-outline", tone = "dark" }: { title: string; body: string; icon?: string; tone?: Tone }) {
  const dark = tone === "dark";
  return (
    <Stack
      direction="row"
      spacing={1.3}
      alignItems="flex-start"
      sx={{
        p: 1.6,
        borderRadius: 3,
        maxWidth: 260,
        backgroundColor: dark ? "rgba(20,20,23,0.86)" : "rgba(255,255,255,0.96)",
        backdropFilter: "blur(14px)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : SD_BORDER}`,
        boxShadow: dark ? "0 22px 48px rgba(0,0,0,0.5)" : "0 22px 48px rgba(15,23,42,0.14)",
      }}
    >
      <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, display: "grid", placeItems: "center", backgroundColor: goldAlpha(0.18) }}>
        <Icon icon={icon} width={19} color={dark ? SD_GOLD : SD_GOLD_DEEP} aria-hidden />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: dark ? "#fff" : SD_INK, lineHeight: 1.2 }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.66)" : SD_TEXT_MUTED, mt: 0.3, lineHeight: 1.4 }}>{body}</Typography>
      </Box>
    </Stack>
  );
}

/* ---- Testimonial block (illustrative placeholder for the mockup round) ---- */
export function Testimonial({ tone = "light" }: { tone?: Tone }) {
  const dark = tone === "dark";
  const cardBg = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const border = dark ? "rgba(255,255,255,0.12)" : SD_BORDER;
  return (
    <Box
      data-testid="sd-testimonial"
      sx={{ p: { xs: 3, md: 5 }, borderRadius: 5, backgroundColor: cardBg, border: `1px solid ${border}`, position: "relative", overflow: "hidden" }}
    >
      <Icon icon="mdi:format-quote-open" width={54} color={goldAlpha(0.5)} aria-hidden />
      <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.4, color: dark ? "#fff" : SD_INK, mt: -1, maxWidth: 760 }}>
        SafeDeal took the fear out of selling to someone I&apos;d never met. The payment was already locked in escrow before I started &mdash; I just did the work and got paid.
      </Typography>
      <Stack direction="row" spacing={1.6} alignItems="center" sx={{ mt: 3 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: SD_GOLD, color: SD_INK, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 17 }}>M</Box>
        <Box>
          <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: dark ? "#fff" : SD_INK }}>Maya R.</Typography>
          <Typography sx={{ fontSize: 12.5, color: dark ? "rgba(255,255,255,0.6)" : SD_TEXT_MUTED }}>Freelance designer &middot; illustrative</Typography>
        </Box>
        <Stack direction="row" spacing={0.2} sx={{ ml: "auto" }} aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon key={i} icon="mdi:star" width={18} color={SD_GOLD} />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}

/* ---- Shared "how it works" content ---- */
export const STEPS: Array<{ icon: string; title: string; body: string }> = [
  { icon: "mdi:email-fast-outline", title: "Invite", body: "Name the deal, set the price and invite the other side. They accept in one click — no account setup." },
  { icon: "mdi:lock-outline", title: "Fund & hold", body: "The buyer pays in any supported coin. SafeDeal converts and holds it as USDT until the work is done." },
  { icon: "mdi:cash-check", title: "Deliver & release", body: "The seller delivers, the buyer checks and releases — or the timer does. Cash out to your wallet anytime." },
];
