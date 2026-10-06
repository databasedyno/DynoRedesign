import React, { memo, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  EyebrowV8,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  PANEL,
  PrimaryBtn,
  SectionHeadV8,
  SectionV8,
  goStart,
  useConsole,
} from "./kit";
import { useMotionOK } from "../motion/tokens";

/* ============================================================================
 * ProductShowcaseV8 — interactive, auto-advancing tabbed showcase of DynoPay's
 * four pillars (SafeDeal escrow is a separate product, intentionally excluded).
 * Click a pillar → its dark visual panel switches with motion. Auto-advances
 * until the first manual interaction. Reduced-motion → instant switch.
 * ========================================================================== */

type PillarKey = "accept" | "convert" | "payouts" | "checkout";

interface Pillar {
  key: PillarKey;
  icon: string;
  title: string;
  desc: string;
  bullets: string[];
}

/* ── Dark mini-mockups (one per pillar) ───────────────────────────────────── */
const Tile: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ background: PANEL.surface, border: `1px solid ${PANEL.line}`, borderRadius: "12px", p: 1.5, ...sx }}>{children}</Box>
);

const AcceptVisual: React.FC = () => {
  const coins = [
    "cryptocurrency-color:btc",
    "cryptocurrency-color:eth",
    "cryptocurrency-color:usdt",
    "cryptocurrency-color:usdc",
    "cryptocurrency-color:sol",
    "cryptocurrency-color:xrp",
    "cryptocurrency-color:bnb",
    "cryptocurrency-color:ltc",
    "cryptocurrency-color:doge",
    "cryptocurrency-color:trx",
    "cryptocurrency-color:bch",
    "cryptocurrency-color:matic",
  ];
  return (
    <Box>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase" }}>
        Choose how to pay
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, mt: 1.5 }}>
        {coins.map((c, i) => (
          <Tile key={c} sx={{ display: "grid", placeItems: "center", py: 1.5, borderColor: i === 0 ? "rgba(255,209,0,0.5)" : PANEL.line }}>
            <Icon icon={c} width={26} height={26} />
          </Tile>
        ))}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2 }}>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: PANEL.ink2 }}>Bitcoin · Ethereum · Lightning · 8 chains</Typography>
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 800, color: PANEL.gold }}>40+</Typography>
      </Box>
    </Box>
  );
};

const ConvertVisual: React.FC = () => (
  <Box>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase" }}>
        Auto-convert
      </Typography>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
        <Box sx={{ width: 30, height: 17, borderRadius: 999, background: PANEL.gold, position: "relative" }}>
          <Box sx={{ position: "absolute", top: 2, right: 2, width: 13, height: 13, borderRadius: "50%", background: "#0B0B0A" }} />
        </Box>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PANEL.gold }}>ON</Typography>
      </Box>
    </Box>
    <Tile sx={{ mt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon icon="cryptocurrency-color:btc" width={28} height={28} />
        <Box>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: PANEL.ink }}>0.00092 BTC</Typography>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, color: PANEL.ink3 }}>received</Typography>
        </Box>
      </Box>
      <Icon icon="mdi:arrow-right-thin" width={22} height={22} color={PANEL.ink3} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: PANEL.green }}>79.00 USDC</Typography>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, color: PANEL.ink3 }}>settled</Typography>
        </Box>
        <Icon icon="cryptocurrency-color:usdc" width={28} height={28} />
      </Box>
    </Tile>
    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12, color: PANEL.ink2, mt: 1.5 }}>
      Volatility settled away the moment a payment lands — at a locked rate.
    </Typography>
  </Box>
);

const PayoutsVisual: React.FC = () => {
  const rows = [
    { name: "Amara O.", role: "Contractor", amt: "1,250.00 USDT", icon: "cryptocurrency-color:usdt" },
    { name: "Studio Nine", role: "Supplier", amt: "0.42 ETH", icon: "cryptocurrency-color:eth" },
    { name: "Lee W.", role: "Affiliate", amt: "320.00 USDC", icon: "cryptocurrency-color:usdc" },
  ];
  return (
    <Box>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase" }}>
        Batch payout · 3 recipients
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1.5 }}>
        {rows.map((r) => (
          <Tile key={r.name} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: "50%", background: PANEL.surfaceStrong, display: "grid", placeItems: "center" }}>
                <Icon icon="mdi:account" width={16} height={16} color={PANEL.ink2} />
              </Box>
              <Box>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: PANEL.ink }}>{r.name}</Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PANEL.ink3 }}>{r.role}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Icon icon={r.icon} width={18} height={18} />
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PANEL.ink }}>{r.amt}</Typography>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.3, borderRadius: 999, background: PANEL.greenSoft }}>
                <Icon icon="mdi:check" width={11} height={11} color={PANEL.green} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: PANEL.green }}>Sent</Typography>
              </Box>
            </Box>
          </Tile>
        ))}
      </Box>
    </Box>
  );
};

const CheckoutVisual: React.FC = () => (
  <Box>
    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.1em", color: PANEL.ink3, textTransform: "uppercase" }}>
      One payment link · drop-in anywhere
    </Typography>
    <Tile sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
      <Icon icon="mdi:link-variant" width={16} height={16} color={PANEL.gold} />
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PANEL.ink2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        dynopay.com/pay/metricly
      </Typography>
      <Icon icon="mdi:content-copy" width={14} height={14} color={PANEL.ink3} />
    </Tile>
    <Box
      sx={{
        mt: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        py: 1.4,
        borderRadius: "12px",
        background: PANEL.gold,
      }}
    >
      <Icon icon="mdi:bitcoin" width={18} height={18} color="#0B0B0A" />
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 800, color: "#0B0B0A" }}>Pay with crypto</Typography>
    </Box>
    <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
      {["Hosted page", "Buy button", "Invoices", "API"].map((c) => (
        <Box key={c} sx={{ flex: 1, textAlign: "center", py: 0.8, borderRadius: "8px", border: `1px solid ${PANEL.line}` }}>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9, color: PANEL.ink2 }}>{c}</Typography>
        </Box>
      ))}
    </Box>
  </Box>
);

const VISUALS: Record<PillarKey, React.FC> = {
  accept: AcceptVisual,
  convert: ConvertVisual,
  payouts: PayoutsVisual,
  checkout: CheckoutVisual,
};

const ProductShowcaseV8: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const ok = useMotionOK();
  const [active, setActive] = useState(0);
  const locked = useRef(false);

  const pillars: Pillar[] = [
    {
      key: "accept",
      icon: "mdi:wallet-plus-outline",
      title: t("v8.product.accept.title", { defaultValue: "Accept payments" }),
      desc: t("v8.product.accept.desc", { defaultValue: "Take Bitcoin, Ethereum, USDT and 40+ assets across every major chain — on a page that converts." }),
      bullets: ["40+ assets, 8 chains", "QR, wallet & Lightning", "Real-time confirmation"],
    },
    {
      key: "convert",
      icon: "mdi:swap-horizontal-bold",
      title: t("v8.product.convert.title", { defaultValue: "Auto-convert" }),
      desc: t("v8.product.convert.desc", { defaultValue: "Settle volatility away: convert incoming crypto to a stablecoin the instant it lands, at a locked rate." }),
      bullets: ["Instant to USDT / USDC", "Locked settlement rate", "Keep the coin, or convert"],
    },
    {
      key: "payouts",
      icon: "mdi:send-outline",
      title: t("v8.product.payouts.title", { defaultValue: "Payouts" }),
      desc: t("v8.product.payouts.desc", { defaultValue: "Pay contractors, suppliers and affiliates in crypto, anywhere — single sends or batched in one click." }),
      bullets: ["Single or batch sends", "Any supported asset", "Low, transparent fees"],
    },
    {
      key: "checkout",
      icon: "mdi:credit-card-outline",
      title: t("v8.product.checkout.title", { defaultValue: "Checkout" }),
      desc: t("v8.product.checkout.desc", { defaultValue: "A drop-in hosted checkout, shareable links, buy buttons and invoices — no code required." }),
      bullets: ["Hosted page & links", "Buy button & embeds", "Invoices & API"],
    },
  ];

  // Auto-advance until the first manual interaction.
  useEffect(() => {
    if (!ok) return;
    const id = setInterval(() => {
      if (locked.current) return;
      setActive((a) => (a + 1) % pillars.length);
    }, 4500);
    return () => clearInterval(id);
  }, [ok, pillars.length]);

  const select = (i: number) => {
    locked.current = true;
    setActive(i);
  };

  const ActiveVisual = VISUALS[pillars[active].key];

  return (
    <SectionV8 id="products" testId="product-showcase">
      <SectionHeadV8
        eyebrow={t("v8.product.eyebrow", { defaultValue: "One platform" })}
        title={
          <>
            {t("v8.product.title1", { defaultValue: "Everything you need to " })}
            <Box component="span" sx={{ color: s.accent }}>{t("v8.product.title2", { defaultValue: "get paid in crypto" })}</Box>
          </>
        }
        lead={t("v8.product.lead", { defaultValue: "Accept, convert, pay out and check out — from a single non-custodial platform built for businesses and creators." })}
        maxWidth={760}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.9fr) minmax(0, 1.1fr)" },
          gap: { xs: 3, md: 6 },
          alignItems: "stretch",
        }}
      >
        {/* Tab list */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
          {pillars.map((p, i) => {
            const isActive = i === active;
            return (
              <Box
                key={p.key}
                role="button"
                tabIndex={0}
                data-testid={`product-tab-${p.key}`}
                aria-pressed={isActive}
                onClick={() => select(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(i);
                  }
                }}
                sx={{
                  position: "relative",
                  cursor: "pointer",
                  borderRadius: "14px",
                  p: { xs: 2, md: 2.5 },
                  border: `1px solid ${isActive ? s.lineStrong : s.line}`,
                  background: isActive ? s.surface : "transparent",
                  boxShadow: isActive ? (s.dark ? "none" : "0 10px 30px -18px rgba(0,0,0,0.3)") : "none",
                  transition: "border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease",
                  "&:hover": { borderColor: s.lineStrong },
                  outline: "none",
                  "&:focus-visible": { borderColor: s.accent, boxShadow: `0 0 0 3px ${s.accentSoft}` },
                }}
              >
                {isActive ? (
                  <Box
                    sx={{
                      position: "absolute",
                      left: 0,
                      top: 12,
                      bottom: 12,
                      width: 3,
                      borderRadius: 3,
                      background: "#FFD100",
                    }}
                  />
                ) : null}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "10px",
                      display: "grid",
                      placeItems: "center",
                      background: isActive ? s.accentSoft : s.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={p.icon} width={20} height={20} color={isActive ? s.accent : s.ink2} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: { xs: 17, md: 19 }, fontWeight: 700, color: s.ink }}>
                    {p.title}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateRows: isActive ? "1fr" : "0fr",
                    transition: "grid-template-rows 260ms ease",
                  }}
                >
                  <Box sx={{ overflow: "hidden" }}>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: s.ink2, mt: 1.5 }}>
                      {p.desc}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
                      {p.bullets.map((b) => (
                        <Box key={b} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
                          <Icon icon="mdi:check-circle" width={14} height={14} color={s.accent} />
                          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink2 }}>{b}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            );
          })}
          <Box sx={{ mt: 1 }}>
            <PrimaryBtn onClick={() => goStart(router, "products")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              {t("v8.product.cta", { defaultValue: "Start free" })}
            </PrimaryBtn>
          </Box>
        </Box>

        {/* Visual panel (dark) */}
        <Box
          sx={{
            position: "relative",
            minHeight: { xs: 320, md: 420 },
            borderRadius: "22px",
            p: { xs: 3, md: 4 },
            background: "linear-gradient(170deg, #161614 0%, #0B0B0A 100%)",
            border: `1px solid ${PANEL.lineStrong}`,
            boxShadow: "0 40px 90px -30px rgba(0,0,0,0.5)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "radial-gradient(60% 60% at 70% 15%, rgba(255,209,0,0.14), transparent 65%)", pointerEvents: "none" }} />
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ mb: 2.5 }}>
              <EyebrowV8 dark>{pillars[active].title}</EyebrowV8>
            </Box>
            {ok ? (
              <AnimatePresence mode="wait">
                <Box
                  key={pillars[active].key}
                  component={motion.div}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.32 }}
                >
                  <ActiveVisual />
                </Box>
              </AnimatePresence>
            ) : (
              <ActiveVisual />
            )}
          </Box>

          {/* progress dots */}
          <Box sx={{ position: "absolute", bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 0.8, zIndex: 1 }}>
            {pillars.map((p, i) => (
              <Box
                key={p.key}
                onClick={() => select(i)}
                sx={{
                  width: i === active ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  cursor: "pointer",
                  background: i === active ? PANEL.gold : PANEL.lineStrong,
                  transition: "width 240ms ease, background-color 240ms ease",
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </SectionV8>
  );
};

export default memo(ProductShowcaseV8);
