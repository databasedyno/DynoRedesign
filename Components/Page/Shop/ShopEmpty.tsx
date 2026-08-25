/**
 * ShopEmpty — enhanced empty state for a merchant with 0 live products.
 *
 * Rendered when `products.length === 0`. Instead of a plain line of text,
 * we surface an inline SVG illustration + a friendly headline + three tile
 * CTAs that route to the closest "adjacent" revenue actions available on
 * Dynopay (add a product, launch a campaign, enable tips). The CTAs work
 * whether the merchant is the shop owner or just a supporter — the URLs
 * are public and self-explanatory.
 *
 * No external image dependencies — the illustration is inline SVG.
 */
import React from "react";
import Link from "next/link";
import { Box, Typography, Button, Stack, useTheme } from "@mui/material";
import type { ShopMerchant } from "./types";
import { brandFg } from "@/constants/theme";

interface Props {
  merchant: ShopMerchant;
  isOwner?: boolean;
}

const ILLUSTRATION = (
  <svg width="180" height="120" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <rect x="24" y="30" width="132" height="80" rx="10" fill="currentColor" opacity="0.06" />
    <rect x="34" y="42" width="36" height="56" rx="6" fill="currentColor" opacity="0.14" />
    <rect x="74" y="42" width="36" height="56" rx="6" fill="currentColor" opacity="0.10" />
    <rect x="114" y="42" width="36" height="56" rx="6" fill="currentColor" opacity="0.14" />
    <circle cx="52" cy="60" r="6" fill="currentColor" opacity="0.35" />
    <rect x="42" y="76" width="20" height="4" rx="2" fill="currentColor" opacity="0.30" />
    <rect x="42" y="84" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.22" />
    <circle cx="92" cy="60" r="6" fill="currentColor" opacity="0.30" />
    <rect x="82" y="76" width="20" height="4" rx="2" fill="currentColor" opacity="0.25" />
    <rect x="82" y="84" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.18" />
    <circle cx="132" cy="60" r="6" fill="currentColor" opacity="0.35" />
    <rect x="122" y="76" width="20" height="4" rx="2" fill="currentColor" opacity="0.30" />
    <rect x="122" y="84" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.22" />
    <path d="M18 30 L162 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.20" />
    <circle cx="152" cy="22" r="8" fill="#05936A" opacity="0.9" />
    <path d="M150 22 L152 24 L156 20" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export default function ShopEmpty({ merchant, isOwner }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const cards = [
    {
      title: "Add your first product",
      body: "List a digital download, ebook or service. Get paid in crypto, direct to your wallet.",
      cta: isOwner ? "Add product" : "Learn more",
      href: isOwner ? "/pay-links/products/new" : "/documentation",
      testid: "shop-empty-cta-add-product",
      icon: "📦",
    },
    {
      title: "Launch a crowdfunding campaign",
      body: "Story, gallery, reward tiers, deadline — everything a GoFundMe page has, settled in crypto.",
      cta: "Start campaign",
      href: "/create-pay-link?type=donation",
      testid: "shop-empty-cta-campaign",
      icon: "🚀",
    },
    {
      title: "Enable tips on your handle",
      body: "Turn on the Creator page tip jar — supporters send any amount, you keep it all.",
      cta: "Open Creator",
      href: "/creator",
      testid: "shop-empty-cta-tips",
      icon: "☕",
    },
  ];

  return (
    <Box
      data-testid="shop-empty"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        py: { xs: 5, md: 8 },
        px: 2,
        color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)",
      }}
    >
      <Box sx={{ color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.75)", mb: 2 }}>
        {ILLUSTRATION}
      </Box>

      <Typography
        component="h2"
        sx={{
          fontWeight: 800,
          fontSize: { xs: "1.5rem", md: "1.85rem" },
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          fontFamily: "var(--font-hero), var(--font-sans)",
          mb: 1,
        }}
      >
        {isOwner
          ? "Your shop is a blank canvas — let's fix that."
          : `${merchant.name} is setting up their shop.`}
      </Typography>

      <Typography
        variant="body1"
        sx={{
          maxWidth: 560,
          color: isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)",
          mb: 4,
          lineHeight: 1.55,
        }}
      >
        {isOwner
          ? "You can list products, launch a crowdfunding page, or turn on tips — each brings a different kind of supporter to your handle."
          : "In the meantime, explore what creators on Dynopay build — a full product catalog, campaign pages, tips, and inline crypto checkout."}
      </Typography>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ maxWidth: 960, width: "100%" }}
      >
        {cards.map((c) => (
          <Box
            key={c.testid}
            data-testid={c.testid}
            sx={{
              flex: 1,
              borderRadius: "18px",
              p: 3,
              textAlign: "left",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "background.paper",
              transition: "border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
              "&:hover": {
                borderColor: isDark ? "rgba(99,102,241,0.5)" : "rgba(79,70,229,0.4)",
                transform: "translateY(-3px)",
                boxShadow: isDark
                  ? "0 14px 34px rgba(0,0,0,0.45)"
                  : "0 14px 34px rgba(67,56,202,0.14)",
              },
            }}
          >
            <Box
              sx={{
                fontSize: 26,
                mb: 1.5,
                width: 52,
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "14px",
                background: isDark
                  ? "linear-gradient(135deg, rgba(79,70,229,0.25) 0%, rgba(124,58,237,0.18) 100%)"
                  : "linear-gradient(135deg, rgba(79,70,229,0.10) 0%, rgba(124,58,237,0.08) 100%)",
                border: `1px solid ${isDark ? "rgba(99,102,241,0.3)" : "rgba(79,70,229,0.18)"}`,
              }}
              aria-hidden
            >
              {c.icon}
            </Box>
            <Typography
              component="h3"
              sx={{
                fontWeight: 700,
                fontSize: "1.05rem",
                mb: 0.75,
                color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.9)",
              }}
            >
              {c.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                mb: 2,
                lineHeight: 1.5,
              }}
            >
              {c.body}
            </Typography>
            <Button
              component={Link as any}
              href={c.href}
              variant="outlined"
              size="small"
              sx={{
                fontWeight: 600,
                borderRadius: 999,
                textTransform: "none",
                borderColor: isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)",
                color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                "&:hover": {
                  borderColor: isDark ? "#818CF8" : "#4F46E5",
                  bgcolor: isDark ? "rgba(129,140,248,0.10)" : "rgba(79,70,229,0.06)",
                  color: brandFg(isDark),
                },
              }}
            >
              {c.cta} →
            </Button>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
