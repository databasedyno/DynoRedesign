import React from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL } from "./kit";
import { ASSETS, CHAINS_COUNT, COINS_COUNT } from "./platformFacts";
import { AssetGlyph } from "./AssetGlyph";

/* ============================================================================
 * Product bento visuals — four dense, dark mini-mockups that FILL their card
 * (flex column, space-between) so no panel ever reads as empty.
 * ========================================================================== */

const Tile: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ background: PANEL.surface, border: `1px solid ${PANEL.line}`, borderRadius: "12px", ...sx }}>{children}</Box>
);

const Label: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.12em", color: PANEL.ink3, textTransform: "uppercase", ...sx }}>{children}</Typography>
);

const Fill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 2 }}>{children}</Box>
);

/* ── Accept: the real asset picker + a confirmed payment row ──────────────── */
export const AcceptVisual: React.FC = () => (
  <Fill>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Label>Customer picks how to pay</Label>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PANEL.ink2 }}>{COINS_COUNT} coins & tokens · {CHAINS_COUNT} chains</Typography>
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
      {ASSETS.map((a, i) => (
        <Tile key={a.symbol} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.6, py: 1.4, borderColor: i === 0 ? "rgba(255,209,0,0.55)" : PANEL.line, background: i === 0 ? PANEL.goldSoft : PANEL.surface }}>
          <AssetGlyph asset={a} size={24} />
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: i === 0 ? PANEL.gold : PANEL.ink2 }}>{a.symbol}</Typography>
        </Tile>
      ))}
    </Box>
    <Tile sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.1, borderColor: "rgba(52,211,153,0.35)" }}>
      <Icon icon="cryptocurrency-color:btc" width={22} height={22} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: PANEL.ink }}>0.0021 BTC received</Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, color: PANEL.ink3 }}>Bitcoin · 2 confirmations</Typography>
      </Box>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.35, borderRadius: 999, background: PANEL.greenSoft }}>
        <Icon icon="mdi:check" width={12} height={12} color={PANEL.green} />
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, color: PANEL.green }}>Confirmed</Typography>
      </Box>
    </Tile>
  </Fill>
);

/* ── Convert: locked-rate conversion with a sparkline ─────────────────────── */
const SPARK = "M0 34 L18 30 L36 36 L54 24 L72 28 L90 18 L108 22 L126 12 L144 16 L162 8 L180 14 L198 6";

export const ConvertVisual: React.FC = () => (
  <Fill>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Label>Auto-convert</Label>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
        <Box sx={{ width: 30, height: 17, borderRadius: 999, background: PANEL.gold, position: "relative" }}>
          <Box sx={{ position: "absolute", top: 2, right: 2, width: 13, height: 13, borderRadius: "50%", background: "#0B0B0A" }} />
        </Box>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: PANEL.gold }}>ON</Typography>
      </Box>
    </Box>
    <Tile sx={{ p: 1.75, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Icon icon="cryptocurrency-color:btc" width={30} height={30} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: PANEL.ink, whiteSpace: "nowrap" }}>0.0042 BTC</Typography>
          <Label sx={{ fontSize: 9.5 }}>received</Label>
        </Box>
      </Box>
      <Box sx={{ width: 34, height: 34, borderRadius: "50%", background: PANEL.goldSoft, display: "grid", placeItems: "center" }}>
        <Icon icon="mdi:swap-horizontal" width={18} height={18} color={PANEL.gold} />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end", minWidth: 0 }}>
        <Box sx={{ textAlign: "right", minWidth: 0 }}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: PANEL.green, whiteSpace: "nowrap" }}>261.37 USDC</Typography>
          <Label sx={{ fontSize: 9.5 }}>settled</Label>
        </Box>
        <Icon icon="cryptocurrency-color:usdc" width={30} height={30} />
      </Box>
    </Tile>
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.8 }}>
        <Label>BTC / USD · last hour</Label>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PANEL.ink2 }}>
          Rate locked <Box component="span" sx={{ color: PANEL.gold, fontWeight: 700 }}>$62,230</Box>
        </Typography>
      </Box>
      <Box component="svg" viewBox="0 0 198 40" preserveAspectRatio="none" sx={{ width: "100%", height: 44, display: "block" }}>
        <defs>
          <linearGradient id="dyno-spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FFD100" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#FFD100" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${SPARK} L198 40 L0 40 Z`} fill="url(#dyno-spark-fill)" />
        <path d={SPARK} fill="none" stroke="#FFD100" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="126" cy="12" r="3.2" fill="#0B0B0A" stroke="#FFD100" strokeWidth="1.6" />
      </Box>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12, color: PANEL.ink2, mt: 1 }}>Volatility settled away the moment a payment lands.</Typography>
    </Box>
  </Fill>
);

/* ── Settle: routing graph → the merchant's own wallet ────────────────────── */
const Node: React.FC<{ icon: string; title: string; sub: string; accent?: boolean; sx?: object }> = ({ icon, title, sub, accent, sx }) => (
  <Tile sx={{ display: "flex", alignItems: "center", gap: 1.2, px: 1.5, py: 1.2, borderColor: accent ? "rgba(255,209,0,0.5)" : PANEL.line, ...sx }}>
    <Box sx={{ width: 30, height: 30, borderRadius: "50%", background: accent ? PANEL.goldSoft : PANEL.surfaceStrong, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon icon={icon} width={16} height={16} color={accent ? PANEL.gold : PANEL.ink2} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: PANEL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</Typography>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PANEL.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</Typography>
    </Box>
  </Tile>
);

const Wire: React.FC = () => (
  <Box sx={{ position: "relative", height: 18, ml: 2.6, width: 2, background: PANEL.line, overflow: "hidden" }}>
    <Box
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 8,
        background: PANEL.gold,
        borderRadius: 2,
        animation: "dyno-wire 1.6s linear infinite",
        "@keyframes dyno-wire": { from: { transform: "translateY(-10px)" }, to: { transform: "translateY(20px)" } },
        "@media (prefers-reduced-motion: reduce)": { animation: "none", top: 5 },
      }}
    />
  </Box>
);

export const SettleVisual: React.FC = () => (
  <Fill>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Label>Where the money goes</Label>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PANEL.ink2 }}>No custody · no holds</Typography>
    </Box>
    <Box>
      <Node icon="mdi:account-arrow-right-outline" title="Customer pays" sub="0.0042 BTC · Bitcoin" />
      <Wire />
      <Node icon="mdi:swap-horizontal" title="Optional auto-convert" sub="→ 261.37 USDC at a locked rate" />
      <Wire />
      <Node icon="mdi:wallet-outline" title="Your wallet" sub="0x1a2b…9f3c · you hold the keys" accent />
    </Box>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
      {["On-chain", "No holds", "Keep the coin or convert"].map((c) => (
        <Box key={c} sx={{ px: 1.1, py: 0.45, borderRadius: 999, border: `1px solid ${PANEL.line}`, background: PANEL.surface }}>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PANEL.ink2 }}>{c}</Typography>
        </Box>
      ))}
    </Box>
  </Fill>
);

/* ── Checkout & links: the link generator preview ─────────────────────────── */
export const CheckoutVisual: React.FC = () => (
  <Fill>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Label>New payment link</Label>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PANEL.ink2 }}>No code · 30 seconds</Typography>
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 1.5, alignItems: "stretch" }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[
          { l: "Title", v: "Pro plan · monthly" },
          { l: "Amount", v: "$49.00 USD" },
        ].map((f) => (
          <Tile key={f.l} sx={{ px: 1.5, py: 1 }}>
            <Label sx={{ fontSize: 9 }}>{f.l}</Label>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: PANEL.ink, mt: 0.3 }}>{f.v}</Typography>
          </Tile>
        ))}
        <Tile sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderColor: "rgba(255,209,0,0.4)" }}>
          <Icon icon="mdi:link-variant" width={15} height={15} color={PANEL.gold} />
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>dynopay.com/pay/acme-pro</Typography>
          <Icon icon="mdi:content-copy" width={14} height={14} color={PANEL.ink3} />
        </Tile>
      </Box>
      <Box sx={{ p: 1, background: "#FFFFFF", borderRadius: "12px", lineHeight: 0, alignSelf: "center" }}>
        <QRCodeSVG value="https://dynopay.com/pay/demo" size={96} bgColor="#FFFFFF" fgColor="#0B0B0A" level="M" />
      </Box>
    </Box>
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, py: 1.3, borderRadius: "999px", background: PANEL.gold }}>
        <Icon icon="mdi:bitcoin" width={17} height={17} color="#0B0B0A" />
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 800, color: "#0B0B0A" }}>Pay with crypto</Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.8, mt: 1.25 }}>
        {["Hosted page", "Buy button", "Invoice", "API"].map((c) => (
          <Box key={c} sx={{ textAlign: "center", py: 0.7, borderRadius: "8px", border: `1px solid ${PANEL.line}` }}>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PANEL.ink2, whiteSpace: "nowrap" }}>{c}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  </Fill>
);
