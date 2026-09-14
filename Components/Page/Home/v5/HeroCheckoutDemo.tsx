import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography, keyframes } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { CRYPTO_INFO } from "@/Components/Page/Pay3Components/checkout/checkoutConstants";
import useLocalPrice from "@/hooks/useLocalPrice";
import { BRAND_ACCENT } from "@/constants/theme";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { DEMO_COINS, DEMO_ORDER_USD, DEMO_SETTLE, DEMO_STORE, cryptoAmount, demoNetworkEta, demoNetworkLabel, fetchDemoPrices } from "./demoCoins";

type Phase = "idle" | "waiting" | "confirming" | "confirmed";

const pulse = keyframes`0%,100%{opacity:1}50%{opacity:.35}`;
const spin = keyframes`to{transform:rotate(360deg)}`;

/**
 * Interactive hosted-checkout demo for the hero. Same visual grammar as the
 * real checkout (brand row, amount, coin picker, exact amount, QR, status
 * strip). Sandbox only: prices are live, addresses are placeholders and
 * "Pay" walks Waiting → Confirming → Confirmed without touching a chain.
 */
const HeroCheckoutDemo: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const { fmt } = useLocalPrice();
  const [coinIdx, setCoinIdx] = useState(0);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let alive = true;
    const pending = timers.current;
    fetchDemoPrices().then((p) => alive && setPrices(p));
    return () => {
      alive = false;
      pending.forEach(clearTimeout);
    };
  }, []);

  const coin = DEMO_COINS[coinIdx];
  const info = CRYPTO_INFO[coin.code];
  const price = prices?.[coin.ticker] ?? coin.fallbackUsd;
  const amount = cryptoAmount(DEMO_ORDER_USD, price, coin.decimals);
  const network = demoNetworkLabel(coin.code);
  const busy = phase === "waiting" || phase === "confirming";

  const pay = () => {
    if (busy) return;
    setPhase("waiting");
    timers.current.push(setTimeout(() => setPhase("confirming"), 1600));
    timers.current.push(setTimeout(() => setPhase("confirmed"), 3800));
  };
  const reset = () => {
    timers.current.forEach(clearTimeout);
    setPhase("idle");
  };
  const pick = (i: number) => {
    if (busy) return;
    setCoinIdx(i);
    if (phase === "confirmed") setPhase("idle");
  };

  const card = { background: s.dark ? "#111114" : "#FFFFFF", border: `1px solid ${s.lineStrong}`, color: s.ink };
  const muted = s.ink3;
  const label = { fontFamily: FONT_TECH, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: muted };

  return (
    <Box
      data-testid="hero-checkout-demo"
      data-phase={phase}
      data-coin={coin.code}
      sx={{ ...card, position: "relative", width: "100%", maxWidth: 430, borderRadius: "22px", p: { xs: 2.5, sm: 3 }, boxShadow: s.dark ? "0 40px 80px -40px rgba(0,0,0,0.8)" : "0 40px 80px -36px rgba(10,10,10,0.28), 0 12px 24px -14px rgba(79,70,229,0.18)" }}
    >
      {/* status strip */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2, px: 1.5, py: 0.9, borderRadius: "10px", border: `1px solid ${s.line}`, background: s.dark ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.025)" }}>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
          {phase === "confirming" ? (
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${BRAND_ACCENT}`, borderTopColor: "transparent", animation: `${spin} 0.8s linear infinite`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }} />
          ) : (
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: phase === "confirmed" ? "#10B981" : phase === "waiting" ? BRAND_ACCENT : muted, animation: phase === "waiting" ? `${pulse} 1.4s ease-in-out infinite` : "none", "@media (prefers-reduced-motion: reduce)": { animation: "none" } }} />
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={phase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: "easeOut" }} style={{ display: "inline-flex" }}>
              <Typography data-testid="hero-demo-status" sx={{ ...label, color: s.ink2 }}>
                {phase === "idle" && t("v5.demo.sandbox")}
                {phase === "waiting" && t("v5.demo.waiting")}
                {phase === "confirming" && t("v5.demo.confirming", { network })}
                {phase === "confirmed" && t("v5.demo.confirmedTitle")}
              </Typography>
            </motion.span>
          </AnimatePresence>
        </Box>
        <Typography sx={{ ...label, display: "inline-flex", alignItems: "center", gap: 0.5 }}><LockRoundedIcon sx={{ fontSize: 11 }} /> DYNOPAY</Typography>
      </Box>

      {phase === "confirmed" ? (
        <Box component={motion.div} data-testid="hero-demo-confirmed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} sx={{ textAlign: "center", py: 3 }}>
          <Box component={motion.div} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 420, damping: 22, delay: 0.05 }} sx={{ width: 56, height: 56, borderRadius: "50%", mx: "auto", mb: 2, display: "grid", placeItems: "center", background: "#10B981", color: "#fff", boxShadow: "0 0 0 8px rgba(16,185,129,0.14)" }}>
            <CheckRoundedIcon sx={{ fontSize: 30 }} />
          </Box>
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: s.ink }}>{t("v5.demo.confirmedTitle")}</Typography>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.ink2, mt: 0.75 }}>{t("v5.demo.confirmedBody", { coin: DEMO_SETTLE })}</Typography>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: muted, mt: 1 }}>{amount} {coin.ticker} · {fmt(DEMO_ORDER_USD)}</Typography>
          <Box component="button" type="button" onClick={reset} data-testid="hero-demo-reset" sx={{ mt: 3, all: "unset", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: BRAND_ACCENT, "&:hover": { textDecoration: "underline" } }}>
            {t("v5.demo.again")}
          </Box>
        </Box>
      ) : (
        <>
          <Typography component="p" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", lineHeight: 1.1, color: s.ink }}>{t("v5.demo.pay", { store: DEMO_STORE })}</Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mt: 1.25, mb: 2 }}>
            <Typography data-testid="hero-demo-total" sx={{ fontFamily: FONT_TECH, fontVariantNumeric: "tabular-nums", fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: s.ink }}>{fmt(DEMO_ORDER_USD)}</Typography>
            <Typography sx={{ ...label }}>{t("v5.demo.settles", { coin: DEMO_SETTLE })}</Typography>
          </Box>

          <Typography sx={{ ...label, mb: 1 }}>{t("v5.demo.chooseCoin")}</Typography>
          <Box role="radiogroup" aria-label={t("v5.demo.chooseCoin")} sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
            {DEMO_COINS.map((c, i) => {
              const active = i === coinIdx;
              const ci = CRYPTO_INFO[c.code];
              return (
                <Box
                  key={c.code}
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`hero-demo-coin-${c.code}`}
                  onClick={() => pick(i)}
                  disabled={busy}
                  sx={{ all: "unset", cursor: busy ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.1, py: 0.55, borderRadius: "999px", border: `1px solid ${active ? BRAND_ACCENT : s.line}`, background: active ? (s.dark ? "rgba(129,140,248,0.16)" : "rgba(79,70,229,0.09)") : "transparent", color: active ? (s.dark ? "#C7D2FE" : "#3730A3") : s.ink2, fontFamily: FONT_TECH, fontSize: 12.5, fontWeight: 600, transition: "border-color 160ms ease, background-color 160ms ease, color 160ms ease", "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 2 } }}
                >
                  <Icon icon={ci.icon} width={15} height={15} color={ci.iconColor} />
                  {c.ticker}
                  {ci.symbol !== ci.networkLabel && c.ticker === "USDT" ? <Box component="span" sx={{ fontSize: 10, color: muted }}>· {ci.networkLabel}</Box> : null}
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2, alignItems: "center" }}>
            <Box>
              <Typography sx={{ ...label, mb: 0.5 }}>{t("v5.demo.send")}</Typography>
              <Typography data-testid="hero-demo-crypto-amount" sx={{ fontFamily: FONT_TECH, fontVariantNumeric: "tabular-nums", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: s.ink, wordBreak: "break-word" }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={coin.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16, ease: "easeOut" }} style={{ display: "inline-block" }}>
                    {amount} {coin.ticker}
                  </motion.span>
                </AnimatePresence>
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: muted, mt: 0.25 }}>
                {t("v5.demo.on", { network })} · {t(`v5.eta.${info.network}`, { defaultValue: demoNetworkEta(coin.code) })}
              </Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: muted, mt: 1 }}>
                {prices ? t("v5.demo.liveRate") : "…"} · 1 {coin.ticker} ≈ {fmt(price)}
              </Typography>
            </Box>
            <Box aria-hidden sx={{ p: 1, borderRadius: "12px", background: "#fff", border: `1px solid ${s.line}`, lineHeight: 0 }}>
              <QRCodeSVG value={`${coin.scheme}:${coin.address}?amount=${amount}`} size={96} level="M" bgColor="#FFFFFF" fgColor="#0A0A0A" />
            </Box>
          </Box>

          <Box
            component="button"
            type="button"
            onClick={pay}
            disabled={busy}
            data-testid="hero-demo-pay"
            sx={{ all: "unset", boxSizing: "border-box", mt: 2.5, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: "12px", py: 1.35, fontFamily: FONT_BODY, fontSize: 15, fontWeight: 600, color: "#fff", background: busy ? (s.dark ? "rgba(129,140,248,0.4)" : "rgba(79,70,229,0.55)") : BRAND_ACCENT, cursor: busy ? "default" : "pointer", transition: "background-color 180ms ease", "&:hover": { background: busy ? undefined : "#4338CA" }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 } }}
          >
            {busy ? (phase === "waiting" ? t("v5.demo.waiting") : t("v5.demo.confirming", { network })) : t("v5.demo.payBtn", { amount: fmt(DEMO_ORDER_USD) })}
          </Box>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: muted, textAlign: "center", mt: 1.25 }}>{t("v5.demo.sandbox")}</Typography>
        </>
      )}
    </Box>
  );
};

export default memo(HeroCheckoutDemo);
