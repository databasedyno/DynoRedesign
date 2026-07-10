import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import { ArrowBack, ArrowForward, CheckCircle } from "@mui/icons-material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";

import BTC from "@/assets/Icons/coins/BTC";
import ETH from "@/assets/Icons/coins/ETH";
import USDT from "@/assets/Icons/coins/USDT";
import SOL from "@/assets/Icons/coins/SOL";

/**
 * ProductShowcase — Emergent-style animated product story (2026-07-10).
 *
 * A soft-gradient section with a browser-window mockup that plays a looping,
 * 3-slide story of a crypto payment travelling through DynoPay:
 *   1. Checkout    — a customer picks USDT and pays (animated cursor bubble)
 *   2. Settlement  — funds land on the merchant dashboard and are forwarded
 *                    straight to their own wallet (toast + new tx row)
 *   3. Developers  — the same flow as ~10 lines of code (typewriter cURL)
 *
 * Design parallels to the Emergent reference: coin chips flank the heading
 * (their avatar chips), collaboration-style cursor bubbles ("Customer"/"You"),
 * rounded gradient canvas, arrows + elongated active dot.
 *
 * Motion rules: auto-advances every 9s, pauses on hover/focus, honours
 * prefers-reduced-motion (static frames, no auto-advance).
 */

const SLIDE_MS = 9000;
const EASE = [0.16, 1, 0.3, 1] as const;

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const CursorBubble: React.FC<{
  label: string;
  color: string;
  path: { x: (string | number)[]; y: (string | number)[]; times: number[] };
  duration: number;
  reduced: boolean;
  sx?: object;
}> = ({ label, color, path, duration, reduced, sx }) => (
  <motion.div
    initial={{ left: path.x[0], top: path.y[0], opacity: 0 }}
    animate={
      reduced
        ? { opacity: 1 }
        : { left: path.x as any, top: path.y as any, opacity: [0, 1, 1, 1] }
    }
    transition={{ duration, times: path.times, ease: "easeInOut" }}
    style={{ position: "absolute", zIndex: 6, pointerEvents: "none", ...sx }}
  >
    {/* cursor arrow */}
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ display: "block", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}>
      <path d="M5.5 3.2L19 11.5l-6.3 1.4-2.9 5.9L5.5 3.2z" fill={color} stroke="#fff" strokeWidth="1.4" />
    </svg>
    <Box
      sx={{
        mt: "2px",
        ml: "10px",
        px: 1.25,
        py: 0.4,
        borderRadius: "999px",
        backgroundColor: color,
        color: "#fff",
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: "var(--font-sans), sans-serif",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
      }}
    >
      {label}
    </Box>
  </motion.div>
);

const rise = (delay: number, reduced: boolean) => ({
  initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay: reduced ? 0 : delay, ease: EASE },
});

// ---------------------------------------------------------------------------
// Slide 1 — Checkout
// ---------------------------------------------------------------------------

const CheckoutSlide: React.FC<{ dark: boolean; reduced: boolean }> = ({ dark, reduced }) => {
  const [status, setStatus] = useState<"awaiting" | "detected" | "forwarded">(reduced ? "forwarded" : "awaiting");
  const [usdtSelected, setUsdtSelected] = useState(reduced);
  const [payPressed, setPayPressed] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const t1 = setTimeout(() => setUsdtSelected(true), 2300);
    const t2 = setTimeout(() => setPayPressed(true), 3900);
    const t3 = setTimeout(() => setStatus("detected"), 4600);
    const t4 = setTimeout(() => setStatus("forwarded"), 6400);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, [reduced]);

  const cardBg = dark ? "#15161B" : "#FFFFFF";
  const line = dark ? "rgba(255,255,255,0.09)" : "rgba(10,10,10,0.08)";
  const sub = dark ? "rgba(255,255,255,0.6)" : "rgba(10,10,10,0.55)";
  const txt = dark ? "#FAFAFA" : "#0A0A0B";

  const coins = [
    { label: "USDT", Icon: USDT, selected: usdtSelected },
    { label: "BTC", Icon: BTC, selected: false },
    { label: "ETH", Icon: ETH, selected: false },
    { label: "SOL", Icon: SOL, selected: false },
  ];

  const statusStyles: Record<string, { bg: string; fg: string; label: string }> = {
    awaiting: { bg: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.06)", fg: sub, label: "Awaiting payment" },
    detected: { bg: "rgba(59,130,246,0.15)", fg: "#3B82F6", label: "Payment detected" },
    forwarded: { bg: dark ? "rgba(204,255,0,0.14)" : "rgba(90,107,0,0.12)", fg: dark ? "#CCFF00" : "#5A6B00", label: "Forwarded to wallet ✓" },
  };
  const st = statusStyles[status];

  return (
    <Box sx={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", minHeight: { xs: 380, sm: 420 }, px: { xs: 1.5, sm: 4 }, py: { xs: 2.5, sm: 4 } }}>
      {/* Checkout card */}
      <motion.div {...rise(0.15, reduced)} style={{ width: "100%", maxWidth: 460 }}>
        <Box sx={{ backgroundColor: cardBg, border: `1px solid ${line}`, borderRadius: "18px", p: { xs: 2, sm: 3 }, boxShadow: dark ? "0 30px 60px -30px rgba(0,0,0,0.7)" : "0 30px 60px -35px rgba(31,41,55,0.35)" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 12, letterSpacing: "0.08em", color: sub, fontWeight: 600 }}>NORDIC SUPPLY CO.</Typography>
              <Typography sx={{ fontSize: 13, color: sub }}>Invoice INV-2026-7</Typography>
            </Box>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={status}
                initial={reduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.3 }}
              >
                <Box data-testid="showcase-status-pill" sx={{ px: 1.25, py: 0.5, borderRadius: "999px", fontSize: 12, fontWeight: 600, backgroundColor: st.bg, color: st.fg, whiteSpace: "nowrap" }}>
                  {st.label}
                </Box>
              </motion.div>
            </AnimatePresence>
          </Box>

          <Typography sx={{ fontSize: { xs: 30, sm: 36 }, fontWeight: 700, color: txt, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            $250.00
          </Typography>
          <Typography sx={{ fontSize: 13, color: sub, mb: 2 }}>≈ 250.00 USDT · 1 USDT = $1.00</Typography>

          {/* Coin selector */}
          <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
            {coins.map(({ label, Icon, selected }) => (
              <motion.div key={label} animate={selected && !reduced ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 0.35 }}>
                <Box
                  sx={{
                    display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.75, borderRadius: "12px",
                    border: selected ? `2px solid ${dark ? "#CCFF00" : "#5A6B00"}` : `1px solid ${line}`,
                    backgroundColor: selected ? (dark ? "rgba(204,255,0,0.08)" : "rgba(90,107,0,0.06)") : "transparent",
                    transition: "border-color 0.25s, background-color 0.25s",
                  }}
                >
                  <Icon width={20} height={20} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: txt }}>{label}</Typography>
                </Box>
              </motion.div>
            ))}
          </Box>

          {/* Address row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.25, borderRadius: "12px", border: `1px dashed ${line}`, mb: 2 }}>
            {/* Mini QR */}
            <Box sx={{ width: 44, height: 44, borderRadius: "6px", flexShrink: 0, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "2px", p: "4px", border: `1px solid ${line}` }}>
              {[1,0,1,1,0,0,1,0,1,1,1,0,1,0,0,1,1,0,1,0,0,1,0,1,1].map((v, i) => (
                <Box key={i} sx={{ backgroundColor: v ? txt : "transparent", borderRadius: "1px" }} />
              ))}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11.5, color: sub }}>Send exactly 250.00 USDT (TRC-20) to</Typography>
              <Typography className="address" sx={{ fontSize: 12.5, color: txt, fontFamily: "var(--font-mono), monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                TXk4…9fQ2mAhR
              </Typography>
            </Box>
          </Box>

          {/* Pay button */}
          <motion.div animate={payPressed && !reduced ? { scale: [1, 0.96, 1] } : {}} transition={{ duration: 0.3 }}>
            <Box sx={{ py: 1.4, borderRadius: "12px", textAlign: "center", backgroundColor: dark ? "#CCFF00" : "#0A0A0B", color: dark ? "#050505" : "#CCFF00", fontWeight: 700, fontSize: 15 }}>
              I've sent the payment
            </Box>
          </motion.div>
        </Box>
      </motion.div>

      {/* Customer cursor */}
      <CursorBubble
        label="Customer"
        color="#3B82F6"
        reduced={reduced}
        duration={4}
        path={{ x: ["72%", "38%", "36%", "50%"], y: ["18%", "48%", "50%", "84%"], times: [0, 0.45, 0.6, 1] }}
        sx={{}}
      />
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Slide 2 — Settlement / dashboard
// ---------------------------------------------------------------------------

const SettlementSlide: React.FC<{ dark: boolean; reduced: boolean }> = ({ dark, reduced }) => {
  const [balance, setBalance] = useState(reduced ? 12480 : 12230);
  const [rowIn, setRowIn] = useState(reduced);
  const [toastIn, setToastIn] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const tRow = setTimeout(() => setRowIn(true), 1800);
    const tToast = setTimeout(() => setToastIn(true), 2600);
    // Count-up 12,230 -> 12,480 starting when the row lands
    const start = 12230, end = 12480, dur = 900, t0 = Date.now() + 1900;
    const iv = setInterval(() => {
      const p = Math.min(1, Math.max(0, (Date.now() - t0) / dur));
      setBalance(Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(iv);
    }, 40);
    return () => { clearTimeout(tRow); clearTimeout(tToast); clearInterval(iv); };
  }, [reduced]);

  const cardBg = dark ? "#15161B" : "#FFFFFF";
  const line = dark ? "rgba(255,255,255,0.09)" : "rgba(10,10,10,0.08)";
  const sub = dark ? "rgba(255,255,255,0.6)" : "rgba(10,10,10,0.55)";
  const txt = dark ? "#FAFAFA" : "#0A0A0B";
  const lime = dark ? "#CCFF00" : "#5A6B00";

  const bars = [34, 52, 40, 66, 48, 78, 92];
  const rows = [
    { amt: "+120.00 USDC", who: "orbit.store", time: "2m ago" },
    { amt: "+0.0041 BTC", who: "atlas-digital.io", time: "18m ago" },
  ];

  return (
    <Box sx={{ position: "relative", px: { xs: 1.5, sm: 4 }, py: { xs: 2.5, sm: 4 }, display: "flex", justifyContent: "center", alignItems: "center", minHeight: { xs: 380, sm: 420 } }}>
      <Box sx={{ width: "100%", maxWidth: 640, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "220px 1fr" }, gap: 2 }}>
        {/* Balance card */}
        <motion.div {...rise(0.15, reduced)}>
          <Box sx={{ backgroundColor: cardBg, border: `1px solid ${line}`, borderRadius: "16px", p: 2.25, height: "100%" }}>
            <Typography sx={{ fontSize: 12, color: sub, fontWeight: 600, letterSpacing: "0.06em" }}>TODAY'S VOLUME</Typography>
            <Typography data-testid="showcase-balance" className="tabular-nums" sx={{ fontSize: 30, fontWeight: 700, color: txt, letterSpacing: "-0.02em", my: 0.5 }}>
              ${balance.toLocaleString("en-US")}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: lime, fontWeight: 600 }}>▲ 12.4% vs yesterday</Typography>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.75, mt: 2, height: 56 }}>
              {bars.map((h, i) => (
                <motion.div
                  key={i}
                  initial={reduced ? { height: `${h}%` } : { height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.6, delay: reduced ? 0 : 0.3 + i * 0.08, ease: EASE }}
                  style={{ flex: 1, borderRadius: 4, backgroundColor: i === bars.length - 1 ? (dark ? "#CCFF00" : "#5A6B00") : (dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.12)") }}
                />
              ))}
            </Box>
          </Box>
        </motion.div>

        {/* Transactions */}
        <motion.div {...rise(0.25, reduced)}>
          <Box sx={{ backgroundColor: cardBg, border: `1px solid ${line}`, borderRadius: "16px", p: 2.25 }}>
            <Typography sx={{ fontSize: 12, color: sub, fontWeight: 600, letterSpacing: "0.06em", mb: 1.25 }}>RECENT PAYMENTS</Typography>

            {/* Incoming animated row */}
            <AnimatePresence>
              {rowIn && (
                <motion.div
                  data-testid="showcase-new-row"
                  initial={reduced ? false : { opacity: 0, y: -16, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.25, mb: 1, borderRadius: "10px", backgroundColor: dark ? "rgba(204,255,0,0.08)" : "rgba(90,107,0,0.07)", border: `1px solid ${dark ? "rgba(204,255,0,0.25)" : "rgba(90,107,0,0.2)"}` }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <USDT width={22} height={22} />
                      <Box>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: txt }}>+250.00 USDT</Typography>
                        <Typography sx={{ fontSize: 11.5, color: sub }}>nordic-supply.co · just now</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: lime, whiteSpace: "nowrap" }}>Forwarded ✓</Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>

            {rows.map((r) => (
              <Box key={r.who} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.25, borderRadius: "10px", "& + &": { mt: 0.5 } }}>
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: txt }}>{r.amt}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: sub }}>{r.who} · {r.time}</Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: sub }}>Settled</Typography>
              </Box>
            ))}
          </Box>
        </motion.div>
      </Box>

      {/* Forward toast */}
      <AnimatePresence>
        {toastIn && (
          <motion.div
            data-testid="showcase-toast"
            initial={reduced ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ position: "absolute", top: "8%", right: "4%", zIndex: 6 }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: "12px", backgroundColor: dark ? "#1B1D14" : "#0A0A0B", border: `1px solid ${dark ? "rgba(204,255,0,0.3)" : "rgba(204,255,0,0.5)"}`, boxShadow: "0 12px 30px rgba(0,0,0,0.3)" }}>
              <CheckCircle sx={{ fontSize: 18, color: "#CCFF00" }} />
              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#FAFAFA", lineHeight: 1.2 }}>250 USDT forwarded</Typography>
                <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontFamily: "var(--font-mono), monospace" }}>to TXk4…9fQ2mAhR</Typography>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "You" cursor */}
      <CursorBubble
        label="You"
        color="#22C55E"
        reduced={reduced}
        duration={3.5}
        path={{ x: ["18%", "60%", "58%"], y: ["80%", "38%", "42%"], times: [0, 0.7, 1] }}
      />
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Slide 3 — Developers
// ---------------------------------------------------------------------------

const CODE_LINES = [
  "$ curl -X POST https://dynopay.com/api/user/createPayment \\",
  "    -H \"x-api-key: your_api_key\" \\",
  "    -H \"Content-Type: application/json\" \\",
  "    -d '{\"amount\": 250, \"redirect_uri\": \"https://yoursite.com/thanks\"}'",
];

const DevSlide: React.FC<{ dark: boolean; reduced: boolean }> = ({ dark, reduced }) => {
  const full = CODE_LINES.join("\n");
  const [chars, setChars] = useState(reduced ? full.length : 0);
  const [respIn, setRespIn] = useState(reduced);
  const [hookIn, setHookIn] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    let i = 0;
    const iv = setInterval(() => {
      i += 3;
      setChars(Math.min(i, full.length));
      if (i >= full.length) {
        clearInterval(iv);
        setTimeout(() => setRespIn(true), 400);
        setTimeout(() => setHookIn(true), 1400);
      }
    }, 24);
    return () => clearInterval(iv);
  }, [reduced, full.length]);

  const sub = "rgba(255,255,255,0.55)";

  return (
    <Box sx={{ position: "relative", px: { xs: 1.5, sm: 4 }, py: { xs: 2.5, sm: 4 }, display: "flex", justifyContent: "center", alignItems: "center", minHeight: { xs: 380, sm: 420 } }}>
      <motion.div {...rise(0.15, reduced)} style={{ width: "100%", maxWidth: 620 }}>
        <Box sx={{ backgroundColor: "#101014", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", overflow: "hidden", boxShadow: dark ? "0 30px 60px -30px rgba(0,0,0,0.8)" : "0 30px 60px -35px rgba(31,41,55,0.45)" }}>
          {/* Editor tab bar */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <Box sx={{ display: "flex", gap: 0.6 }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: c }} />
              ))}
            </Box>
            <Typography sx={{ fontSize: 12, color: sub, fontFamily: "var(--font-mono), monospace" }}>create-payment.sh</Typography>
          </Box>

          {/* Code area */}
          <Box sx={{ p: { xs: 1.75, sm: 2.5 }, minHeight: 210 }}>
            <Typography component="pre" sx={{ m: 0, fontSize: { xs: 11.5, sm: 13 }, lineHeight: 1.7, color: "#E4E4E7", fontFamily: "var(--font-mono), monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {full.slice(0, chars)}
              {!reduced && chars < full.length && <Box component="span" sx={{ opacity: 0.9, color: "#CCFF00" }}>▌</Box>}
            </Typography>

            <AnimatePresence>
              {respIn && (
                <motion.div initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
                  <Box sx={{ mt: 2, p: 1.5, borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                      <Box sx={{ px: 1, py: 0.25, borderRadius: "6px", fontSize: 11, fontWeight: 700, backgroundColor: "rgba(204,255,0,0.15)", color: "#CCFF00" }}>201 Created</Box>
                    </Box>
                    <Typography component="pre" sx={{ m: 0, fontSize: { xs: 11, sm: 12.5 }, lineHeight: 1.65, color: "#A1A1AA", fontFamily: "var(--font-mono), monospace", whiteSpace: "pre-wrap" }}>
{`{ "id": "pay_8Yx2…", "status": "pending",
  "checkout_url": "https://checkout.dynopay.com/pay?d=…" }`}
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>
      </motion.div>

      {/* Webhook delivered pill */}
      <AnimatePresence>
        {hookIn && (
          <motion.div
            data-testid="showcase-webhook-pill"
            initial={reduced ? false : { opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            style={{ position: "absolute", bottom: "12%", right: "6%", zIndex: 6 }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.9, borderRadius: "999px", backgroundColor: "#0A0A0B", border: "1px solid rgba(204,255,0,0.45)", boxShadow: "0 12px 30px rgba(0,0,0,0.35)" }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#CCFF00", boxShadow: "0 0 8px #CCFF00" }} />
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#FAFAFA", fontFamily: "var(--font-mono), monospace" }}>
                webhook payment.completed · 200 OK
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

const ProductShowcase: React.FC = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("landing");
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slides = [
    { key: "checkout", label: t("showcase.slide1Label", "Checkout"), caption: t("showcase.slide1Caption", "Your customer pays in any major coin"), Comp: CheckoutSlide },
    { key: "settlement", label: t("showcase.slide2Label", "Settlement"), caption: t("showcase.slide2Caption", "Funds are forwarded straight to your own wallet"), Comp: SettlementSlide },
    { key: "developers", label: t("showcase.slide3Label", "Developers"), caption: t("showcase.slide3Caption", "Integrate in an afternoon with a simple API"), Comp: DevSlide },
  ];

  const go = useCallback((dir: 1 | -1) => {
    setIndex((i) => (i + dir + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (reduced || paused) return;
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [reduced, paused, slides.length]);

  const sub = dark ? "rgba(255,255,255,0.65)" : "rgba(10,10,10,0.6)";
  const txt = dark ? "#FAFAFA" : "#0A0A0B";
  const chipBg = dark ? "#15161B" : "#FFFFFF";
  const chipLine = dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.08)";

  const CoinChip: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <Box sx={{ width: { xs: 38, sm: 46 }, height: { xs: 38, sm: 46 }, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: chipBg, border: `1px solid ${chipLine}`, boxShadow: dark ? "0 8px 20px rgba(0,0,0,0.4)" : "0 8px 20px rgba(31,41,55,0.12)" }}>
        {children}
      </Box>
    </motion.div>
  );

  const ActiveSlide = slides[index].Comp;

  return (
    <Box
      component="section"
      aria-label="Product showcase"
      data-testid="product-showcase-section"
      sx={{ px: { xs: 2, sm: 4 }, py: { xs: 4, sm: 7 } }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Box
        sx={{
          maxWidth: 1120,
          mx: "auto",
          borderRadius: { xs: "24px", sm: "36px" },
          border: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(10,10,10,0.06)"}`,
          background: dark
            ? "radial-gradient(90% 70% at 50% 0%, rgba(204,255,0,0.09) 0%, rgba(204,255,0,0.02) 45%, transparent 100%), linear-gradient(180deg, #101208 0%, #0B0C09 100%)"
            : "radial-gradient(90% 70% at 50% 0%, rgba(204,255,0,0.22) 0%, rgba(204,255,0,0.06) 45%, transparent 100%), linear-gradient(180deg, #F7F9EC 0%, #EFF3DE 100%)",
          px: { xs: 2, sm: 6 },
          pt: { xs: 4, sm: 6 },
          pb: { xs: 3, sm: 4 },
          overflow: "hidden",
        }}
      >
        {/* Heading with coin chips (Emergent avatar-chip parallel) */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: { xs: 1, sm: 2 }, flexWrap: "wrap", mb: 1.5 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <CoinChip delay={0.1}><BTC width={24} height={24} /></CoinChip>
            <CoinChip delay={0.2}><ETH width={24} height={24} /></CoinChip>
          </Box>
          <Typography component="h2" sx={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 700, fontSize: { xs: 30, sm: 44 }, letterSpacing: "-0.02em", color: txt, textAlign: "center" }}>
            {t("showcase.title", "Built for crypto commerce")}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <CoinChip delay={0.3}><USDT width={24} height={24} /></CoinChip>
            <CoinChip delay={0.4}><SOL width={24} height={24} /></CoinChip>
          </Box>
        </Box>

        <Typography sx={{ textAlign: "center", color: sub, fontSize: { xs: 15, sm: 17 }, maxWidth: 620, mx: "auto", mb: { xs: 3, sm: 4 }, lineHeight: 1.55 }}>
          {t("showcase.subtitle", "Watch a payment travel from your customer's checkout to your wallet — settled in seconds, not days.")}
        </Typography>

        {/* Browser mockup */}
        <Box
          sx={{
            maxWidth: 880,
            mx: "auto",
            borderRadius: "18px",
            overflow: "hidden",
            border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.1)"}`,
            backgroundColor: dark ? "#0E0F13" : "#FBFCF7",
            boxShadow: dark ? "0 50px 100px -40px rgba(0,0,0,0.8)" : "0 50px 100px -45px rgba(31,41,55,0.4)",
          }}
        >
          {/* Chrome bar */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)"}`, backgroundColor: dark ? "#14151A" : "#FFFFFF" }}>
            <Box sx={{ display: "flex", gap: 0.6 }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c }} />
              ))}
            </Box>
            <Box sx={{ flex: 1, maxWidth: 380, mx: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, px: 2, py: 0.5, borderRadius: "8px", backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.05)" }}>
              <Box component="span" sx={{ fontSize: 11, color: sub }}>🔒</Box>
              <Typography sx={{ fontSize: 12.5, color: sub, fontFamily: "var(--font-mono), monospace" }}>
                {index === 0 ? "checkout.dynopay.com" : index === 1 ? "dynopay.com/dashboard" : "dynopay.com/api"}
              </Typography>
            </Box>
            <Box sx={{ width: 44 }} />
          </Box>

          {/* Slide viewport */}
          <Box sx={{ position: "relative", minHeight: { xs: 380, sm: 420 } }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={slides[index].key}
                data-testid={`showcase-slide-${index}`}
                initial={reduced ? { opacity: 1 } : { opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -40 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <ActiveSlide dark={dark} reduced={reduced} />
              </motion.div>
            </AnimatePresence>
          </Box>
        </Box>

        {/* Caption */}
        <Typography sx={{ textAlign: "center", color: sub, fontSize: 14, mt: 2.5, fontWeight: 500 }}>
          {slides[index].caption}
        </Typography>

        {/* Controls — arrows + elongated active dot (Emergent style) */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mt: 2 }}>
          <IconButton
            aria-label={t("showcase.prev", "Previous slide")}
            data-testid="showcase-prev"
            onClick={() => go(-1)}
            sx={{ width: 40, height: 40, backgroundColor: dark ? "rgba(255,255,255,0.07)" : "#FFFFFF", border: `1px solid ${chipLine}`, color: txt, "&:hover": { backgroundColor: dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.05)" } }}
          >
            <ArrowBack sx={{ fontSize: 19 }} />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {slides.map((s, i) => (
              <Box
                key={s.key}
                component="button"
                aria-label={s.label}
                data-testid={`showcase-dot-${i}`}
                onClick={() => setIndex(i)}
                sx={{
                  height: 8,
                  width: i === index ? 34 : 8,
                  borderRadius: "999px",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  backgroundColor: i === index ? (dark ? "#CCFF00" : "#0A0A0B") : (dark ? "rgba(255,255,255,0.25)" : "rgba(10,10,10,0.2)"),
                  transition: "width 0.35s cubic-bezier(0.16,1,0.3,1), background-color 0.25s",
                }}
              />
            ))}
          </Box>

          <IconButton
            aria-label={t("showcase.next", "Next slide")}
            data-testid="showcase-next"
            onClick={() => go(1)}
            sx={{ width: 40, height: 40, backgroundColor: dark ? "rgba(255,255,255,0.07)" : "#FFFFFF", border: `1px solid ${chipLine}`, color: txt, "&:hover": { backgroundColor: dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.05)" } }}
          >
            <ArrowForward sx={{ fontSize: 19 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ProductShowcase);
