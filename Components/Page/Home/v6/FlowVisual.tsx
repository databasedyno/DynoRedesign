import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Logo from "@/assets/Icons/Logo";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { LiveDot } from "../motion/accents";
import { EASE_OUT, useMotionOK } from "../motion/tokens";

const COINS = [
  { code: "BTC", icon: "cryptocurrency-color:btc", amount: "0.00082 BTC", net: "Bitcoin" },
  { code: "ETH", icon: "cryptocurrency-color:eth", amount: "0.0182 ETH", net: "Ethereum" },
  { code: "SOL", icon: "cryptocurrency-color:sol", amount: "0.31 SOL", net: "Solana" },
  { code: "USDT", icon: "cryptocurrency-color:usdt", amount: "49.00 USDT", net: "Tron" },
] as const;
const USDC = "cryptocurrency-color:usdc";
type Phase = "in" | "confirm" | "out" | "rest";
const DUR: Record<Phase, number> = { in: 1300, confirm: 1100, out: 1300, rest: 900 };
const NEXT: Record<Phase, Phase> = { in: "confirm", confirm: "out", out: "rest", rest: "in" };
type CoinRow = { c: (typeof COINS)[number]; id: number };
const SEED: CoinRow[] = [COINS[1], COINS[3], COINS[0]].map((c, id) => ({ c, id }));

const Coin: React.FC<{ icon: string; size?: number }> = ({ icon, size = 30 }) => (
  <Box sx={{ width: size, height: size, borderRadius: "50%", background: "#fff", boxShadow: "0 6px 18px -6px rgba(30,27,75,0.45)", display: "grid", placeItems: "center", flexShrink: 0 }}>
    <Icon icon={icon} width={Math.round(size * 0.66)} height={Math.round(size * 0.66)} />
  </Box>
);

/** A rail between two nodes; the token travels its full length during `active`. */
const Rail: React.FC<{ active: boolean; icon: string; vertical: boolean; testId: string }> = ({ active, icon, vertical, testId }) => {
  const s = useAurora();
  const ref = useRef<HTMLDivElement>(null);
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (!active || !ref.current) return;
    setLen((vertical ? ref.current.offsetHeight : ref.current.offsetWidth) - 30);
  }, [active, vertical]);
  const line = active ? (s.dark ? "rgba(165,180,252,0.9)" : "#4F46E5") : s.lineStrong;
  return (
    <Box ref={ref} data-testid={testId} data-active={active ? "true" : "false"} sx={{ position: "relative", flex: vertical ? "0 0 44px" : "1 1 0", minWidth: vertical ? 0 : 28, height: vertical ? 44 : 30, alignSelf: "center", width: vertical ? 30 : "auto" }}>
      <Box sx={{ position: "absolute", ...(vertical ? { left: 14, top: 0, bottom: 0, width: 2 } : { top: 14, left: 0, right: 0, height: 2 }), backgroundImage: `repeating-linear-gradient(${vertical ? "180deg" : "90deg"}, ${line} 0 6px, transparent 6px 12px)`, opacity: active ? 1 : 0.6, transition: "opacity 300ms ease" }} />
      <AnimatePresence>
        {active && len > 0 ? (
          <motion.div key="tok" initial={vertical ? { y: 0, opacity: 0 } : { x: 0, opacity: 0 }} animate={vertical ? { y: len, opacity: 1 } : { x: len, opacity: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: DUR.in / 1000 - 0.15, ease: EASE_OUT, opacity: { duration: 0.2 } }} style={{ position: "absolute", top: 0, left: 0 }}>
            <Coin icon={icon} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Box>
  );
};

/**
 * The conversion story as a living diagram: buyer pays any coin → the network
 * confirms → USDC lands in the merchant's own wallet. Cycles through four coins;
 * static (mid-cycle frame) under reduced motion and before hydration.
 */
const FlowVisual: React.FC = () => {
  const s = useAurora();
  const theme = useTheme();
  const vertical = !useMediaQuery(theme.breakpoints.up("md"));
  const ok = useMotionOK();
  const { t } = useTranslation("landing");
  const [phase, setPhase] = useState<Phase>("confirm");
  const [ci, setCi] = useState(0);
  const [rows, setRows] = useState<CoinRow[]>(SEED);
  const ciRef = useRef(0);
  const idRef = useRef(SEED.length);

  useEffect(() => {
    if (!ok) return;
    let p: Phase = "in";
    setPhase(p);
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const nxt = NEXT[p];
      id = setTimeout(() => {
        p = nxt;
        setPhase(p);
        if (p === "rest") {
          const landed = COINS[ciRef.current];
          idRef.current += 1;
          setRows((r) => [{ c: landed, id: idRef.current }, ...r].slice(0, 3));
        }
        if (p === "in") {
          ciRef.current = (ciRef.current + 1) % COINS.length;
          setCi(ciRef.current);
        }
        tick();
      }, DUR[p]);
    };
    tick();
    return () => clearTimeout(id);
  }, [ok]);

  const coin = COINS[ci];
  const live = ok;
  const inFlight = live && phase === "in";
  const outFlight = live && phase === "out";
  const confirmed = !live || phase === "confirm" || phase === "out" || phase === "rest";
  const node = { borderRadius: "20px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 2, md: 2.25, lg: 2.75 }, minWidth: 0, flex: vertical ? "0 0 auto" : "1 1 0", width: vertical ? "100%" : "auto", maxWidth: vertical ? 360 : "none", mx: vertical ? "auto" : 0 } as const;
  const label = { fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: s.ink3, whiteSpace: "nowrap" } as const;
  const green = "#10B981";

  return (
    <Box data-testid="flow-visual" data-phase={live ? phase : "static"} sx={{ position: "relative", borderRadius: "28px", p: { xs: 2, md: 3 }, background: s.dark ? "linear-gradient(160deg, rgba(79,70,229,0.16), rgba(52,211,153,0.05) 70%, transparent)" : "linear-gradient(160deg, rgba(79,70,229,0.08), rgba(52,211,153,0.09))", border: `1px solid ${s.line}` }}>
      <Box sx={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "stretch", gap: vertical ? 0 : 1.5 }}>
        {/* buyer */}
        <Box data-testid="flow-buyer" sx={{ ...node, display: "flex", flexDirection: "column" }}>
          <Typography sx={label}>{t("v6.story.buyerPays")}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 1.5 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={coin.code} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: inFlight ? 0.35 : 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
                <Coin icon={coin.icon} size={40} />
              </motion.div>
            </AnimatePresence>
            <Box sx={{ minWidth: 0 }}>
              <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 18, md: 17, lg: 20 }, letterSpacing: "-0.02em", color: s.ink, lineHeight: 1.1, whiteSpace: "nowrap" }}>{coin.amount}</Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, mt: 0.4, whiteSpace: "nowrap" }}>{coin.net} · ≈ $49.00</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink2, mt: 1.75, lineHeight: 1.45 }}>{t("v6.story.anyWallet")}</Typography>
          <Box data-testid="flow-coin-cycle" sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", mt: "auto", pt: 2 }}>
            {COINS.map((c, i) => (
              <Box key={c.code} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.35, borderRadius: 999, fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.06em", color: i === ci ? s.ink : s.ink3, background: i === ci ? (s.dark ? "rgba(99,102,241,0.22)" : "rgba(79,70,229,0.10)") : "transparent", border: `1px solid ${i === ci ? "rgba(79,70,229,0.45)" : s.line}`, transition: "background-color 300ms ease, border-color 300ms ease, color 300ms ease" }}>
                <Icon icon={c.icon} width={12} height={12} /> {c.code}
              </Box>
            ))}
          </Box>
        </Box>

        <Rail active={inFlight} icon={coin.icon} vertical={vertical} testId="flow-rail-in" />

        {/* dynopay */}
        <Box data-testid="flow-core" sx={{ ...node, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <Box aria-hidden sx={{ position: "absolute", inset: 0, background: s.dark ? "radial-gradient(circle at 50% 30%, rgba(99,102,241,0.25), transparent 60%)" : "radial-gradient(circle at 50% 30%, rgba(79,70,229,0.10), transparent 60%)", pointerEvents: "none" }} />
          <Box sx={{ position: "relative" }}>
            <Box sx={{ display: "grid", placeItems: "center", mx: "auto", width: 56, height: 56, borderRadius: "50%", background: s.dark ? "rgba(99,102,241,0.14)" : "rgba(79,70,229,0.08)", boxShadow: confirmed && live ? `0 0 0 8px ${s.dark ? "rgba(99,102,241,0.14)" : "rgba(79,70,229,0.08)"}` : "none", transition: "box-shadow 400ms ease" }}>
              <Logo width={34} height={34} />
            </Box>
            <Box data-testid="flow-status" sx={{ display: "inline-flex", alignItems: "center", gap: 0.7, mt: 1.5, px: 1.2, py: 0.45, borderRadius: 999, background: confirmed ? (s.dark ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)") : s.bgAlt, border: `1px solid ${confirmed ? "rgba(16,185,129,0.45)" : s.line}`, fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: confirmed ? green : s.ink2, transition: "background-color 300ms ease, color 300ms ease" }}>
              {confirmed ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : <LiveDot color="#4F46E5" size={6} />}
              {confirmed ? t("v6.story.confirmed") : t("v6.story.detected")}
            </Box>
            <Box data-testid="flow-convert" sx={{ mt: 1.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.8 }}>
              <Coin icon={coin.icon} size={22} />
              <Box component="span" aria-hidden sx={{ fontFamily: FONT_TECH, color: s.ink3, fontSize: 13 }}>→</Box>
              <Coin icon={USDC} size={22} />
            </Box>
            <Typography sx={{ ...label, mt: 1, letterSpacing: "0.1em" }}>{t("v6.story.autoConvert")} · <Box component="span" sx={{ color: green }}>{t("v6.story.on")}</Box></Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 11.5, color: s.ink3, mt: 0.5 }}>{t("v6.story.keepCoin")}</Typography>
          </Box>
        </Box>

        <Rail active={outFlight} icon={USDC} vertical={vertical} testId="flow-rail-out" />

        {/* merchant wallet */}
        <Box data-testid="flow-wallet" sx={{ ...node, display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
            <Typography sx={label}>{t("v6.story.yourWallet")}</Typography>
            <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.ink3 }}>0x9f3a…c21e</Typography>
          </Box>
          <Box sx={{ mt: 1.5, display: "grid", gap: 0.75, minHeight: 3 * 42 + 12 }}>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.div key={r.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1 - i * 0.28, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.1, py: 0.8, borderRadius: "12px", background: s.bgAlt, border: `1px solid ${s.line}` }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: "50%", background: green, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><CheckRoundedIcon sx={{ fontSize: 13 }} /></Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 13.5, color: s.ink, lineHeight: 1.1, whiteSpace: "nowrap" }}>+49.00 USDC</Typography>
                      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.ink3, mt: 0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.c.code} → USDC · {t("v6.story.settled")}</Typography>
                    </Box>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink2, mt: 1.5, lineHeight: 1.45 }}>{t("v6.story.nonCustodial")}</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FlowVisual);
