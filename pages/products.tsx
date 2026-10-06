import React, { memo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  FONT_BODY,
  FONT_DISPLAY,
  GradientText,
  PrimaryBtn,
  SecondaryBtn,
  Reveal,
  SectionV8,
  SectionHeadV8,
  goStart,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import PageHeroV8 from "@/Components/Page/Home/v8/PageHeroV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";

/**
 * /products — every DynoPay way to get paid, rebuilt on the 2026-10 "v8"
 * marketing system (same tokens/motion as the homepage). SafeDeal escrow is a
 * separate product and intentionally excluded. Real product list + routes kept.
 */
const PRODUCTS = [
  {
    icon: "mdi:link-variant",
    title: "Payment Links",
    body: "Create a shareable payment link in seconds and get paid in crypto — no website or code required.",
    cta: "Explore Payment Links",
    href: "/products/payment-links",
  },
  {
    icon: "mdi:cart-outline",
    title: "Hosted Checkout",
    body: "A drop-in, conversion-optimised checkout that handles coins, live rates and confirmations for you.",
    cta: "Explore Checkout",
    href: "/products/checkout",
  },
  {
    icon: "mdi:account-star-outline",
    title: "Creator Pages",
    body: "A branded page where fans and customers can pay you directly — perfect for creators and freelancers.",
    cta: "Explore Creator Pages",
    href: "/products/creator-pages",
  },
  {
    icon: "mdi:hand-heart-outline",
    title: "Donations",
    body: "Accept one-off or recurring crypto donations with a simple, trustworthy donation page.",
    cta: "Explore Donations",
    href: "/products/donations",
  },
  {
    icon: "mdi:receipt-text-outline",
    title: "Invoices",
    body: "Send professional crypto invoices with due dates and automatic reconciliation when they're paid.",
    cta: "Explore Invoices",
    href: "/products/invoices",
  },
  {
    icon: "mdi:send-outline",
    title: "Payouts",
    body: "Pay contractors, affiliates and suppliers in crypto — single or in bulk — straight from your balance.",
    cta: "Explore Payouts",
    href: "/products/payouts",
  },
  {
    icon: "mdi:code-tags",
    title: "Developer API",
    body: "One clean REST API to create payments, run checkouts and receive webhooks. Built to ship fast.",
    cta: "Explore the API",
    href: "/products/developer-api",
  },
];

const Products: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("pageTitles");

  return (
    <Box sx={{ width: "100%", background: s.canvas }}>
      <Head>
        <title>{t("products_title", { defaultValue: "Products — every way to accept crypto | Dynopay" })}</title>
        <meta
          name="description"
          content="Payment links, hosted checkout, creator pages, donations, invoices, payouts and a developer API — seven ways to accept crypto payments with Dynopay."
        />
        <link rel="canonical" href="https://dynopay.com/products" />
      </Head>

      <PageHeroV8
        testId="products-hero"
        eyebrow="Products"
        title={
          <>
            Every way to <GradientText>accept crypto</GradientText>
          </>
        }
        body="From a no-code payment link to a full developer API — pick the surface that fits how you get paid, and settle to the currency or wallet you choose."
        actions={
          <>
            <PrimaryBtn data-testid="products-hero-start" onClick={() => goStart(router, "products_hero")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
              Start free
            </PrimaryBtn>
            <SecondaryBtn data-testid="products-hero-pricing" href="/fees" sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
              See pricing
            </SecondaryBtn>
          </>
        }
        note="No credit card · Your first payment is free"
      />

      <SectionV8 testId="products-grid">
        <SectionHeadV8
          center
          eyebrow="Seven surfaces"
          title="One platform, seven ways to get paid"
          lead="Mix and match — start with a link today and add the API when you're ready."
          maxWidth={720}
          testId="products-grid-head"
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            gap: { xs: 2.5, md: 3 },
          }}
        >
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.title} delay={(i % 3) * 0.08}>
              <Box
                component="a"
                href={p.href}
                data-testid={`product-${p.title.toLowerCase().replace(/\s+/g, "-")}`}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  p: { xs: 3, md: 3.5 },
                  height: "100%",
                  borderRadius: "18px",
                  textDecoration: "none",
                  border: `1px solid ${s.line}`,
                  background: s.surface,
                  transition: "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    borderColor: s.lineStrong,
                    boxShadow: s.dark ? "0 24px 50px -30px rgba(0,0,0,0.6)" : "0 24px 50px -28px rgba(0,0,0,0.25)",
                  },
                  "&:hover .pcta": { gap: 1 },
                }}
              >
                <Box sx={{ width: 48, height: 48, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent, mb: 2.5 }}>
                  <Icon icon={p.icon} width={24} height={24} />
                </Box>
                <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 18.5, md: 20 }, letterSpacing: "-0.01em", color: s.ink, mb: 1.25 }}>
                  {p.title}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2, flexGrow: 1 }}>{p.body}</Typography>
                <Typography className="pcta" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 700, color: s.accent, transition: "gap 180ms ease" }}>
                  {p.cta} <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Typography>
              </Box>
            </Reveal>
          ))}
        </Box>
      </SectionV8>

      <CtaBandV8
        testId="products-cta"
        badge="Live in minutes · no credit card"
        title="Pick a surface and"
        highlight="start getting paid."
        body="Start with a no-code link and add the API when you scale — all from one non-custodial platform."
        primaryLabel="Start free"
        primaryRef="products_final"
        secondaryLabel="See pricing"
        secondaryHref="/fees"
      />
    </Box>
  );
};

export default memo(Products);
