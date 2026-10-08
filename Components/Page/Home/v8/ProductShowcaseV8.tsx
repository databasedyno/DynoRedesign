import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ArrowLink, FONT_BODY, FONT_DISPLAY, PANEL, PrimaryBtn, Reveal, SectionHeadV8, SectionV8, goStart, useConsole } from "./kit";
import { AcceptVisual, CheckoutVisual, ConvertVisual, SettleVisual } from "./ProductVisuals";

/* ============================================================================
 * ProductShowcaseV8 — "One platform" bento: four product cards, each with copy
 * on top and a dense dark visual that fills the rest of the card. Hover lifts
 * the card, warms the border to gold and nudges the visual. SafeDeal escrow
 * is a separate product and is intentionally excluded.
 * ========================================================================== */

interface Card {
  key: "accept" | "convert" | "settle" | "checkout";
  icon: string;
  title: string;
  desc: string;
  href: string;
  Visual: React.FC;
}

const ProductShowcaseV8: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("landing");

  const cards: Card[] = [
    {
      key: "accept",
      icon: "mdi:qrcode-scan",
      title: t("v8.product.accept.title", { defaultValue: "Accept payments" }),
      desc: t("v8.product.accept.desc", { defaultValue: "Bitcoin, Ethereum, USDT, USDC and every major coin your customers already hold — on a checkout page that confirms in real time." }),
      href: "/products/checkout",
      Visual: AcceptVisual,
    },
    {
      key: "convert",
      icon: "mdi:swap-horizontal-bold",
      title: t("v8.product.convert.title", { defaultValue: "Auto-convert" }),
      desc: t("v8.product.convert.desc", { defaultValue: "Opt in to convert incoming crypto to USDT or USDC the instant it lands, at a locked rate — or keep the coin you're paid." }),
      href: "/fees",
      Visual: ConvertVisual,
    },
    {
      key: "settle",
      icon: "mdi:bank-transfer-in",
      title: t("v8.product.settle.title", { defaultValue: "Settlement" }),
      desc: t("v8.product.settle.desc", { defaultValue: "Your money settles straight to a wallet you control — keep the crypto or auto-convert to USDT/USDC. Non-custodial, on-chain, instant." }),
      href: "/products/payouts",
      Visual: SettleVisual,
    },
    {
      key: "checkout",
      icon: "mdi:link-variant",
      title: t("v8.product.checkout.title", { defaultValue: "Checkout & links" }),
      desc: t("v8.product.checkout.desc", { defaultValue: "A hosted checkout, shareable payment links, buy buttons and invoices — live in seconds, no code required." }),
      href: "/products/payment-links",
      Visual: CheckoutVisual,
    },
  ];

  return (
    <SectionV8 id="products" testId="product-showcase" maxWidth={1240}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { md: "flex-end" }, justifyContent: "space-between", gap: 3, mb: { xs: 5, md: 7 } }}>
        <SectionHeadV8
          eyebrow={t("v8.product.eyebrow", { defaultValue: "One platform" })}
          title={
            <>
              {t("v8.product.title1", { defaultValue: "Everything you need to " })}
              <Box component="span" sx={{ color: s.accent }}>{t("v8.product.title2", { defaultValue: "get paid in crypto" })}</Box>
            </>
          }
          lead={t("v8.product.lead", { defaultValue: "Accept, convert, settle and check out — from a single non-custodial platform built for businesses and creators." })}
          maxWidth={720}
          sx={{ mb: 0 }}
        />
        <PrimaryBtn data-testid="product-showcase-cta" onClick={() => goStart(router, "products")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", md: "auto" } }}>
          {t("v8.product.cta", { defaultValue: "Start free" })}
        </PrimaryBtn>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2.5, md: 3 } }}>
        {cards.map((c, i) => (
          <Reveal key={c.key} delay={i * 0.08} sx={{ display: "flex", minWidth: 0 }}>
            <Box
              data-testid={`product-card-${c.key}`}
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                borderRadius: "24px",
                border: `1px solid ${s.line}`,
                background: s.surface,
                overflow: "hidden",
                transition: "transform 320ms cubic-bezier(0.16,1,0.3,1), border-color 240ms ease, box-shadow 320ms ease",
                boxShadow: s.dark ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                "&:hover": { transform: "translateY(-4px)", borderColor: "rgba(255,209,0,0.55)", boxShadow: s.dark ? "0 30px 60px -30px rgba(255,209,0,0.18)" : "0 30px 60px -28px rgba(0,0,0,0.28)" },
                "&:hover .visual": { transform: "scale(1.015)" },
                "@media (prefers-reduced-motion: reduce)": { "&:hover": { transform: "none" }, "&:hover .visual": { transform: "none" } },
              }}
            >
              <Box sx={{ p: { xs: 3, md: 3.5 }, pb: { xs: 2.5, md: 3 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, flexShrink: 0 }}>
                    <Icon icon={c.icon} width={20} height={20} color={s.accent} />
                  </Box>
                  <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontSize: { xs: 21, md: 24 }, fontWeight: 700, letterSpacing: "-0.015em", color: s.ink }}>
                    {c.title}
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 14.5, md: 15.5 }, lineHeight: 1.6, color: s.ink2, maxWidth: 520 }}>{c.desc}</Typography>
                <Box sx={{ mt: 2 }}>
                  <ArrowLink href={c.href} testId={`product-card-${c.key}-link`}>
                    {t("v8.product.learn", { defaultValue: "Learn more" })}
                    <ArrowForwardIcon className="arr" sx={{ fontSize: 15 }} />
                  </ArrowLink>
                </Box>
              </Box>
              <Box sx={{ flex: 1, position: "relative", mx: { xs: 2, md: 2.5 }, mb: { xs: 2, md: 2.5 }, borderRadius: "18px", overflow: "hidden", background: "linear-gradient(170deg, #161614 0%, #0B0B0A 100%)", border: `1px solid ${PANEL.line}`, minHeight: 300 }}>
                <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "radial-gradient(60% 50% at 80% 0%, rgba(255,209,0,0.13), transparent 65%)", pointerEvents: "none" }} />
                <Box className="visual" sx={{ position: "relative", zIndex: 1, height: "100%", p: { xs: 2, md: 2.5 }, transition: "transform 420ms cubic-bezier(0.16,1,0.3,1)" }}>
                  <c.Visual />
                </Box>
              </Box>
            </Box>
          </Reveal>
        ))}
      </Box>
    </SectionV8>
  );
};

export default memo(ProductShowcaseV8);
