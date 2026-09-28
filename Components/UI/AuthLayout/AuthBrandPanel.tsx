import React, { useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import LocalCafeRounded from "@mui/icons-material/LocalCafeRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import { GRAIN_URL } from "@/constants/creatorTheme";

const FONT_DISPLAY = "var(--font-hero), var(--font-sans), sans-serif";
const FONT_BODY = "var(--font-body), var(--font-sans), sans-serif";
const FONT_MONO = "var(--font-tech), var(--font-mono), monospace";

const GOLD = "#FFD100";
const AQUA = "#2BD4C4";

const COINS = [
  { s: "BTC", c: "#F7931A" },
  { s: "ETH", c: "#627EEA" },
  { s: "USDT", c: "#26A17B" },
  { s: "USDC", c: "#2775CA" },
  { s: "SOL", c: "#9945FF" },
  { s: "BNB", c: "#F0B90B" },
  { s: "XRP", c: "#23292F" },
  { s: "TRX", c: "#EF0027" },
];

type Scene = {
  key: "tip" | "order" | "donation";
  kind: string;
  title: string;
  sub: string;
  amount: number;
  coin: string;
  coinColor: string;
  detail: string;
  progress?: number;
  Icon: typeof LocalCafeRounded;
  hue: string;
};

const SCENES: Scene[] = [
  {
    key: "tip",
    kind: "Tip",
    title: "@ariana.codes",
    sub: "Creator page · Buy me a coffee",
    amount: 25,
    coin: "USDT",
    coinColor: "#26A17B",
    detail: "“Your tutorials got me my first dev job — thank you!”",
    Icon: LocalCafeRounded,
    hue: GOLD,
  },
  {
    key: "order",
    kind: "Order",
    title: "Nova Store · #1042",
    sub: "Storefront checkout · Digital download",
    amount: 42,
    coin: "ETH",
    coinColor: "#627EEA",
    detail: "Hosted checkout · PDF receipt sent",
    Icon: StorefrontRounded,
    hue: AQUA,
  },
  {
    key: "donation",
    kind: "Donation",
    title: "Clean Water Fund",
    sub: "Crowdfunding campaign · 64% of goal",
    amount: 100,
    coin: "BTC",
    coinColor: "#F7931A",
    detail: "Donor wall · Goal $5,000",
    progress: 64,
    Icon: FavoriteRounded,
    hue: "#FF7A59",
  },
];

const CYCLE_MS = 4200;
const BASE_BALANCE = 1198.5;

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/**
 * Editorial auth hero panel (login + register, desktop lg+).
 * An animated "money flows straight to your wallet" scene: rotating
 * creator-tip / storefront-order / donation cards drop through the Dynopay
 * rail into a non-custodial wallet card whose balance counts up on every
 * settlement. Below: honest stats and the supported-coin marquee.
 */
const AuthBrandPanel = () => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const accent = dark ? GOLD : "#8B5E00";
  const sub = dark ? "rgba(255,255,255,0.62)" : "rgba(10,10,10,0.6)";
  const ink = theme.palette.text.primary;
  const line = dark ? "rgba(255,255,255,0.09)" : "rgba(10,10,10,0.08)";
  const glass = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)";
  const positive = dark ? "#3FD98A" : "#05936A";

  const [slide, setSlide] = useState(0);
  const [balance, setBalance] = useState(BASE_BALANCE);
  const [landed, setLanded] = useState(false);
  const reduceRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    reduceRef.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceRef.current) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % SCENES.length), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  // Count the incoming amount into the wallet balance ~1.1s after the card enters (the "settled" beat).
  useEffect(() => {
    const scene = SCENES[slide];
    setLanded(false);
    const settle = window.setTimeout(() => {
      setLanded(true);
      const from = balance;
      const to = (balance > 99_000 ? BASE_BALANCE : balance) + scene.amount;
      if (reduceRef.current) {
        setBalance(to);
        return;
      }
      const start = performance.now();
      const dur = 720;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setBalance(from + (to - from) * eased);
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 1100);
    return () => {
      window.clearTimeout(settle);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide]);

  const scene = SCENES[slide];

  const label = {
    fontFamily: FONT_MONO,
    fontSize: "10px",
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    fontWeight: 700,
    color: sub,
  };

  const miniCard = {
    position: "relative" as const,
    borderRadius: "18px",
    border: `1px solid ${line}`,
    background: dark
      ? "linear-gradient(180deg, rgba(24,24,31,0.92) 0%, rgba(16,16,20,0.9) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.9) 100%)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow: dark
      ? "0 24px 50px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)"
      : "0 24px 50px -32px rgba(139,94,0,0.35), inset 0 1px 0 rgba(255,255,255,0.9)",
  };

  const captions: Record<Scene["key"], string> = {
    tip: t("brandSceneTip", { defaultValue: "Tips & memberships from fans" }),
    order: t("brandSceneOrder", { defaultValue: "Storefront & payment-link orders" }),
    donation: t("brandSceneDonation", { defaultValue: "Donations & crowdfunding" }),
  };

  return (
    <Box
      component="aside"
      aria-label="Dynopay"
      data-testid="auth-brand-panel"
      sx={{
        position: "relative",
        overflow: "hidden",
        flex: "1 1 0",
        maxWidth: 600,
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        borderRadius: "28px",
        padding: "34px 34px 30px",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(139,94,0,0.12)"}`,
        background: dark
          ? "radial-gradient(120% 90% at 100% 0%, rgba(255,209,0,0.22) 0%, transparent 48%), radial-gradient(90% 90% at 0% 100%, rgba(43,212,196,0.16) 0%, transparent 52%), linear-gradient(160deg, #121216 0%, #0A0A0D 100%)"
          : "radial-gradient(120% 90% at 100% 0%, rgba(255,209,0,0.20) 0%, transparent 48%), radial-gradient(90% 90% at 0% 100%, rgba(43,212,196,0.14) 0%, transparent 52%), linear-gradient(160deg, #FFFFFF 0%, #EEF1F5 100%)",
        boxShadow: dark
          ? "0 40px 90px -50px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)"
          : "0 46px 100px -56px rgba(139,94,0,0.4), inset 0 1px 0 rgba(255,255,255,0.9)",
        animation: "authRise 560ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both",
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        "@keyframes authRise": {
          from: { opacity: 0, transform: "translateY(14px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes authFlowDot": {
          "0%": { transform: "translateY(-6px) scale(0.6)", opacity: 0 },
          "15%": { opacity: 1, transform: "translateY(0) scale(1)" },
          "85%": { opacity: 1 },
          "100%": { transform: "translateY(64px) scale(0.7)", opacity: 0 },
        },
        "@keyframes authSceneIn": {
          from: { opacity: 0, transform: "translateY(-14px) scale(0.98)" },
          to: { opacity: 1, transform: "none" },
        },
        "@keyframes authLanded": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "none" },
        },
        "@keyframes authPulse": {
          "0%,100%": { boxShadow: `0 0 0 0 ${dark ? "rgba(255,209,0,0.5)" : "rgba(139,94,0,0.45)"}` },
          "50%": { boxShadow: "0 0 0 7px rgba(255,209,0,0)" },
        },
        "@keyframes coinMarquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      }}
    >
      {/* Film grain */}
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRAIN_URL, opacity: dark ? 0.08 : 0.05, mixBlendMode: "overlay", pointerEvents: "none" }} />

      <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Non-custodial badge */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            alignSelf: "flex-start",
            px: "13px",
            py: "7px",
            borderRadius: "999px",
            background: glass,
            border: `1px solid ${line}`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: accent, animation: "authPulse 2.2s ease-in-out infinite" }} />
          <Typography sx={{ ...label, color: dark ? "rgba(255,255,255,0.82)" : "rgba(10,10,10,0.72)", fontSize: "11px", letterSpacing: "0.12em", fontWeight: 600 }}>
            {t("brandTrustBadge", { defaultValue: "Non-custodial · funds go straight to you" })}
          </Typography>
        </Box>

        {/* Headline */}
        <Typography
          component="h2"
          sx={{
            m: 0,
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: "30px",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: ink,
            textShadow: dark ? "0 0 44px rgba(255,209,0,0.28)" : "none",
          }}
        >
          {t("brandHeadlineLine1")}{" "}
          <Box component="span" sx={{ color: accent }}>
            {t("brandHeadlineLine2")}
          </Box>
        </Typography>

        {/* ── Flow scene: source card → Dynopay rail → wallet ── */}
        <Box data-testid="auth-brand-carousel" data-scene={scene.key} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 56px minmax(0, 1fr)", alignItems: "stretch", gap: "6px", minHeight: 236 }}>
          {/* Source card (keyed → re-enters on each cycle) */}
          <Box
            key={scene.key}
            data-testid={`auth-brand-scene-${scene.key}`}
            sx={{
              ...miniCard,
              p: "16px 16px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              animation: "authSceneIn 520ms cubic-bezier(0.22,1,0.36,1) both",
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            <Box aria-hidden sx={{ position: "absolute", top: -60, right: -50, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${scene.hue}${dark ? "38" : "2E"} 0%, transparent 70%)`, pointerEvents: "none" }} />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "10px", flexShrink: 0, display: "grid", placeItems: "center", background: `linear-gradient(135deg, ${scene.hue} 0%, ${scene.hue}99 100%)`, color: scene.hue === GOLD ? "#121214" : "#FFFFFF", boxShadow: `0 8px 18px -8px ${scene.hue}` }}>
                  <scene.Icon sx={{ fontSize: 17 }} />
                </Box>
                <Typography sx={{ ...label, color: ink, fontSize: "10.5px" }}>{scene.kind}</Typography>
              </Box>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: "5px", px: "8px", py: "3px", borderRadius: "999px", border: `1px solid ${line}`, background: dark ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.03)" }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: scene.coinColor }} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: "10.5px", fontWeight: 700, color: sub }}>{scene.coin}</Typography>
              </Box>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "14px", letterSpacing: "-0.01em", color: ink }}>
                {scene.title}
              </Typography>
              <Typography noWrap sx={{ fontFamily: FONT_BODY, fontSize: "12px", color: sub, mt: "2px" }}>
                {scene.sub}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: FONT_MONO, fontWeight: 800, fontSize: "28px", letterSpacing: "-0.03em", lineHeight: 1, color: ink, fontVariantNumeric: "tabular-nums" }}>
              {money(scene.amount)}
            </Typography>
            {scene.progress != null ? (
              <Box sx={{ mt: "auto" }}>
                <Box sx={{ height: 6, borderRadius: 999, background: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)", overflow: "hidden" }}>
                  <Box sx={{ width: `${scene.progress}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${scene.hue} 0%, ${GOLD} 100%)` }} />
                </Box>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: "10.5px", color: sub, mt: "6px" }}>{scene.detail}</Typography>
              </Box>
            ) : (
              <Typography sx={{ mt: 0.25, fontFamily: FONT_BODY, fontSize: "11.5px", lineHeight: 1.4, color: sub, fontStyle: scene.key === "tip" ? "italic" : "normal", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {scene.detail}
              </Typography>
            )}
          </Box>

          {/* Dynopay rail — coins drop through, no custody */}
          <Box aria-hidden sx={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Box sx={{ position: "absolute", top: 18, bottom: 18, width: 2, borderRadius: 2, background: `linear-gradient(180deg, transparent 0%, ${dark ? "rgba(255,209,0,0.55)" : "rgba(139,94,0,0.45)"} 50%, transparent 100%)` }} />
            <Box sx={{ position: "relative", zIndex: 1, width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: GOLD, color: "#121214", boxShadow: dark ? "0 0 0 6px rgba(255,209,0,0.14), 0 10px 26px -8px rgba(255,209,0,0.8)" : "0 0 0 6px rgba(255,209,0,0.22), 0 10px 26px -10px rgba(139,94,0,0.7)" }}>
              <BoltRounded sx={{ fontSize: 18 }} />
            </Box>
            {[0, 1, 2].map((i) => (
              <Box
                key={`${slide}-${i}`}
                sx={{
                  position: "absolute",
                  top: "calc(50% - 4px)",
                  left: "calc(50% - 4px)",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: scene.coinColor,
                  boxShadow: `0 0 10px ${scene.coinColor}`,
                  animation: `authFlowDot 1100ms cubic-bezier(0.4,0,0.6,1) ${i * 170}ms both`,
                  "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0 },
                }}
              />
            ))}
            <ArrowDownwardRounded sx={{ position: "absolute", bottom: 4, fontSize: 14, color: sub, opacity: 0.7 }} />
          </Box>

          {/* Wallet card */}
          <Box data-testid="auth-brand-wallet" sx={{ ...miniCard, p: "16px 16px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <Box aria-hidden sx={{ position: "absolute", bottom: -70, left: -50, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${dark ? "rgba(43,212,196,0.22)" : "rgba(43,212,196,0.18)"} 0%, transparent 70%)`, pointerEvents: "none" }} />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "10px", display: "grid", placeItems: "center", background: dark ? "rgba(43,212,196,0.16)" : "rgba(43,212,196,0.18)", color: dark ? AQUA : "#0E8F84" }}>
                  <AccountBalanceWalletRounded sx={{ fontSize: 17 }} />
                </Box>
                <Typography sx={{ ...label, color: ink, fontSize: "10.5px" }}>{t("brandWalletLabel", { defaultValue: "Your wallet" })}</Typography>
              </Box>
              <LockRoundedIcon sx={{ fontSize: 13, color: sub }} />
            </Box>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: "6px", px: "9px", py: "6px", borderRadius: "9px", border: `1px solid ${line}`, background: dark ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.03)", alignSelf: "flex-start", maxWidth: "100%" }}>
              <Typography noWrap sx={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 600, color: sub }}>0x9a72…b5e1</Typography>
            </Box>
            <Box>
              <Typography sx={{ ...label, fontSize: "9.5px" }}>{t("brandWalletBalance", { defaultValue: "Settled balance" })}</Typography>
              <Typography data-testid="auth-brand-balance" sx={{ mt: "3px", fontFamily: FONT_MONO, fontWeight: 800, fontSize: "26px", letterSpacing: "-0.03em", lineHeight: 1, color: ink, fontVariantNumeric: "tabular-nums" }}>
                {money(balance)}
              </Typography>
            </Box>
            <Box sx={{ mt: "auto", minHeight: 26 }}>
              {landed && (
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: "6px", px: "9px", py: "5px", borderRadius: "999px", background: dark ? "rgba(63,217,138,0.14)" : "rgba(5,147,106,0.10)", color: positive, animation: "authLanded 360ms cubic-bezier(0.22,1,0.36,1) both", "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
                  <CheckCircleRounded sx={{ fontSize: 13 }} />
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 700 }}>
                    +{money(scene.amount)} · {t("brandSettled", { defaultValue: "settled on-chain" })}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Caption + scene indicators */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: "13px", color: sub }}>{captions[scene.key]}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: "7px" }}>
            {SCENES.map((s, i) => (
              <Box
                key={s.key}
                component="button"
                type="button"
                aria-label={`Show ${s.key}`}
                data-testid={`auth-brand-dot-${i}`}
                onClick={() => setSlide(i)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  width: slide === i ? 22 : 6,
                  height: 6,
                  borderRadius: "999px",
                  background: slide === i ? accent : dark ? "rgba(255,255,255,0.22)" : "rgba(10,10,10,0.16)",
                  transition: "width .3s ease, background-color .3s ease",
                  "&:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: 2 },
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Honest stat row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {[
            `9 ${t("brandStatBusinessesLabel")}`,
            t("brandStatFee", { defaultValue: "fees from 0.5%" }),
            t("brandStatSettle", { defaultValue: "instant settlement" }),
          ].map((txt, i) => (
            <React.Fragment key={txt}>
              {i > 0 && <Box sx={{ width: 3, height: 3, borderRadius: "50%", background: sub }} />}
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11.5px", fontWeight: 600, letterSpacing: "0.02em", color: dark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.62)" }}>
                {txt}
              </Typography>
            </React.Fragment>
          ))}
        </Box>

        {/* Coin marquee */}
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "14px",
            border: `1px solid ${line}`,
            background: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.66)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            py: "12px",
            maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          }}
        >
          <Box sx={{ display: "flex", gap: "28px", width: "max-content", animation: "coinMarquee 22s linear infinite", "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
            {[...COINS, ...COINS].map((coin, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: coin.s === "XRP" && dark ? "#B8C1CC" : coin.c }} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: "13px", fontWeight: 600, color: ink, opacity: 0.85 }}>
                  {coin.s}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AuthBrandPanel;
