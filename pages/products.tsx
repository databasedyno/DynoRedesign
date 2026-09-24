import React, { memo } from "react";
import Head from "next/head";
import { Box, Typography } from "@mui/material";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ShoppingCartCheckoutRoundedIcon from "@mui/icons-material/ShoppingCartCheckoutRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useRouter } from "next/router";
import { FONT_BODY, FONT_HERO, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { AuroraInk } from "@/Components/Page/Home/v3/styled.v3";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import PublicFinalCta from "@/Components/Page/Home/v5/PublicFinalCta";
import { Section, SectionHead, PrimaryBtn, SecondaryBtn, cardSx, goStart } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";

/**
 * /products — the seven Dynopay ways to get paid, moved off the homepage in the
 * 2026-06 Bybit-style revamp. Same public marketing shell + tokens as /fees so
 * the whole site reads as one product.
 */
const PRODUCTS = [
  {
    Icon: LinkRoundedIcon,
    title: "Payment Links",
    body: "Create a shareable payment link in seconds and get paid in crypto — no website or code required.",
    cta: "Create a link",
    href: "/create-pay-link",
  },
  {
    Icon: ShoppingCartCheckoutRoundedIcon,
    title: "Hosted Checkout",
    body: "A drop-in, conversion-optimised checkout that handles coins, live rates and confirmations for you.",
    cta: "See the demo",
    href: "/pay/demo",
  },
  {
    Icon: AutoAwesomeRoundedIcon,
    title: "Creator Pages",
    body: "A branded page where fans and customers can pay you directly — perfect for creators and freelancers.",
    cta: "Explore creator pages",
    href: "/for/creators",
  },
  {
    Icon: VolunteerActivismRoundedIcon,
    title: "Donations",
    body: "Accept one-off or recurring crypto donations with a simple, trustworthy donation page.",
    cta: "Try a donation page",
    href: "/pay/donation-demo",
  },
  {
    Icon: ReceiptLongRoundedIcon,
    title: "Invoices",
    body: "Send professional crypto invoices with due dates and automatic reconciliation when they’re paid.",
    cta: "See how invoicing works",
    href: "/documentation",
  },
  {
    Icon: PaymentsRoundedIcon,
    title: "Payouts",
    body: "Pay contractors, affiliates and suppliers in crypto — single or in bulk — straight from your balance.",
    cta: "Read the payouts guide",
    href: "/documentation",
  },
  {
    Icon: CodeRoundedIcon,
    title: "Developer API",
    body: "One clean REST API to create payments, run checkouts and receive webhooks. Built to ship fast.",
    cta: "Read the docs",
    href: "/documentation",
  },
];

const Products: React.FC = () => {
  const s = useAurora();
  const router = useRouter();

  return (
    <Box sx={{ width: "100%" }}>
      <Head>
        <title>Products — every way to accept crypto | Dynopay</title>
        <meta
          name="description"
          content="Payment links, hosted checkout, creator pages, donations, invoices, payouts and a developer API — seven ways to accept crypto payments with Dynopay."
        />
        <link rel="canonical" href="https://dynopay.com/products" />
      </Head>

      <PublicPageHero
        testId="products-hero"
        eyebrow="Products"
        title={
          <>
            Every way to <AuroraInk>accept crypto</AuroraInk>
          </>
        }
        body="From a no-code payment link to a full developer API — pick the surface that fits how you get paid, and settle to the currency or wallet you choose."
        actions={
          <>
            <PrimaryBtn data-testid="products-hero-start" onClick={() => goStart(router, "products_hero")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              Start free
            </PrimaryBtn>
            <SecondaryBtn onDark={s.dark} data-testid="products-hero-pricing" href="/fees">
              See pricing
            </SecondaryBtn>
          </>
        }
        note="No credit card · Your first payment is free"
      />

      <Section testId="products-grid">
        <SectionHead
          center
          eyebrow="Seven surfaces"
          headline="One platform, seven ways to get paid"
          body="Mix and match — start with a link today and add the API when you’re ready."
          maxWidth={720}
          testId="products-grid-head"
        />
        <Stagger step={0.08} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
          {PRODUCTS.map(({ Icon, title, body, cta, href }, i) => (
            <StaggerItem key={title} i={i} y={16}>
              <Box
                component="a"
                href={href}
                data-testid={`product-${title.toLowerCase().replace(/\s+/g, "-")}`}
                sx={{ ...cardSx(s), display: "flex", flexDirection: "column", p: { xs: 3, md: 3.5 }, height: "100%", textDecoration: "none" }}
              >
                <Box sx={{ width: 48, height: 48, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent, mb: 2.5 }}>
                  <Icon sx={{ fontSize: 24 }} />
                </Box>
                <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 18.5, md: 20 }, letterSpacing: "-0.01em", color: s.ink, mb: 1.25 }}>
                  {title}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2, flexGrow: 1 }}>{body}</Typography>
                <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: s.accent }}>
                  {cta} <ArrowForwardIcon sx={{ fontSize: 16 }} />
                </Typography>
              </Box>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>

      <PublicFinalCta attributionRef="products" />
    </Box>
  );
};

export default memo(Products);
