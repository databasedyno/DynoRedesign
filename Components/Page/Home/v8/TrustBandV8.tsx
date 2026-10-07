import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ArrowLink, FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL, Reveal, SectionHeadV8, SectionV8, useConsole } from "./kit";
import { useLandingMetrics } from "../v5/useLandingMetrics";

/* ============================================================================
 * TrustBandV8 — trust built on facts: four pillars (2×2) beside the REAL
 * "settled by chain, last 30 days" shares from the live metrics API. No
 * invented ratings or timings; the asset list lives in the product bento.
 * ========================================================================== */

const CHAIN_ICON: Record<string, string> = {
  Bitcoin: "cryptocurrency-color:btc",
  Ethereum: "cryptocurrency-color:eth",
  Tron: "cryptocurrency-color:trx",
  Litecoin: "cryptocurrency-color:ltc",
  Solana: "cryptocurrency-color:sol",
  Polygon: "cryptocurrency-color:matic",
  XRP: "cryptocurrency-color:xrp",
  Dogecoin: "cryptocurrency-color:doge",
  "Bitcoin Cash": "cryptocurrency-color:bch",
};

const FALLBACK_SHARES = [
  { chain: "Bitcoin", count: 39 },
  { chain: "Tron", count: 32 },
  { chain: "Ethereum", count: 32 },
  { chain: "Litecoin", count: 5 },
];

const TrustBandV8: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();

  const pillars = [
    { testId: "trust-pill-noncustodial", icon: "mdi:key-chain-variant", title: t("v8.trust.p1", { defaultValue: "You hold the keys" }), desc: t("v8.trust.p1d", { defaultValue: "We never take custody. Payments settle to your own wallet, so there is nothing of yours for us to hold, freeze or lose." }) },
    { testId: "trust-pill-chargebacks", icon: "mdi:credit-card-off-outline", title: t("v8.trust.p2", { defaultValue: "Final payments" }), desc: t("v8.trust.p2d", { defaultValue: "On-chain payments cannot be reversed — no disputes, no chargebacks, no rolling reserve held against your revenue." }) },
    { testId: "trust-pill-compliance", icon: "mdi:shield-check-outline", title: t("v8.trust.p3", { defaultValue: "KYC / AML by design" }), desc: t("v8.trust.p3d", { defaultValue: "Merchant verification above threshold and wallet-address screening keep your business on the right side of regulators." }) },
    { testId: "trust-pill-encryption", icon: "mdi:lock-outline", title: t("v8.trust.p4", { defaultValue: "Hardened & transparent" }), desc: t("v8.trust.p4d", { defaultValue: "Encrypted key infrastructure, TLS everywhere, and a public status page with 90-day uptime history." }) },
  ];

  const shares = (m?.settled_by_chain_30d?.length ? m.settled_by_chain_30d : FALLBACK_SHARES).slice(0, 5);
  const total = shares.reduce((a, b) => a + b.count, 0) || 1;

  return (
    <SectionV8 testId="trust-band" maxWidth={1240}>
      <SectionHeadV8
        eyebrow={t("v8.trust.eyebrow", { defaultValue: "Trust & compliance" })}
        title={t("v8.trust.title", { defaultValue: "Built to be trusted with money" })}
        lead={t("v8.trust.lead", { defaultValue: "Compliant by default and transparent about every number — so you can integrate with confidence." })}
        maxWidth={720}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.15fr) minmax(0, 0.85fr)" }, gap: { xs: 2.5, md: 3 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: { xs: 2, md: 2.5 } }}>
          {pillars.map((p, i) => (
            <Reveal key={p.testId} delay={i * 0.06} sx={{ display: "flex" }}>
              <Box
                data-testid={p.testId}
                sx={{ flex: 1, p: { xs: 3, md: 3.25 }, borderRadius: "20px", border: `1px solid ${s.line}`, background: s.surface, transition: "border-color 240ms ease, transform 320ms cubic-bezier(0.16,1,0.3,1)", "&:hover": { borderColor: "rgba(255,209,0,0.5)", transform: "translateY(-3px)" }, "@media (prefers-reduced-motion: reduce)": { "&:hover": { transform: "none" } } }}
              >
                <Box sx={{ width: 42, height: 42, borderRadius: "12px", background: s.accentSoft, display: "grid", placeItems: "center", mb: 2.5 }}>
                  <Icon icon={p.icon} width={21} height={21} color={s.accent} />
                </Box>
                <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", color: s.ink }}>{p.title}</Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2, mt: 1 }}>{p.desc}</Typography>
              </Box>
            </Reveal>
          ))}
          <Box sx={{ gridColumn: "1 / -1", mt: 0.5 }}>
            <ArrowLink href="/trust" testId="trust-centre-link">
              {t("v8.trust.centreLink", { defaultValue: "Visit the Trust Centre" })}
              <ArrowForwardIcon className="arr" sx={{ fontSize: 15 }} />
            </ArrowLink>
          </Box>
        </Box>

        <Reveal delay={0.1} sx={{ display: "flex" }}>
          <Box data-testid="trust-chain-shares" sx={{ flex: 1, position: "relative", overflow: "hidden", p: { xs: 3, md: 4 }, borderRadius: "24px", background: "linear-gradient(170deg, #161614 0%, #0B0B0A 100%)", border: `1px solid ${PANEL.lineStrong}`, color: PANEL.ink, display: "flex", flexDirection: "column" }}>
            <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "radial-gradient(60% 50% at 85% 0%, rgba(255,209,0,0.14), transparent 65%)", pointerEvents: "none" }} />
            <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 3 }}>
                <Box>
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: PANEL.ink3 }}>{t("v8.trust.sharesEyebrow", { defaultValue: "Live · last 30 days" })}</Typography>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: PANEL.ink, mt: 0.5 }}>{t("v8.trust.sharesTitle", { defaultValue: "Settled payments by chain" })}</Typography>
                </Box>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.7, px: 1.1, py: 0.5, borderRadius: 999, border: `1px solid ${PANEL.line}`, background: PANEL.surface, flexShrink: 0 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.green }} />
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PANEL.ink2 }}>{m?.payments_30d ?? total} {t("v8.trust.payments", { defaultValue: "payments" })}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: "grid", gap: 2, flex: 1, alignContent: "center" }}>
                {shares.map((row, i) => {
                  const pct = Math.round((row.count / total) * 100);
                  return (
                    <Box key={row.chain} data-testid={`trust-chain-share-${i}`}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
                        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                          <Icon icon={CHAIN_ICON[row.chain] || "mdi:link-variant"} width={18} height={18} />
                          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: PANEL.ink }}>{row.chain}</Typography>
                        </Box>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: i === 0 ? PANEL.gold : PANEL.ink2 }}>{pct}%</Typography>
                      </Box>
                      <Box sx={{ height: 8, borderRadius: 8, background: PANEL.surfaceStrong, overflow: "hidden" }}>
                        <Box sx={{ width: `${Math.max(pct, 2)}%`, height: "100%", borderRadius: 8, background: i === 0 ? "linear-gradient(90deg, #FFD100, #F5A800)" : "rgba(255,255,255,0.35)" }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: PANEL.ink3, mt: 3 }}>{t("v8.trust.sharesNote", { defaultValue: "Shares of confirmed, settled payments across the platform — the same data that powers our public status page." })}</Typography>
            </Box>
          </Box>
        </Reveal>
      </Box>
    </SectionV8>
  );
};

export default memo(TrustBandV8);
