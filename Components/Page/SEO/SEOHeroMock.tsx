import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, MockPanelV8, PANEL } from "@/Components/Page/Home/v8/kit";
import CheckoutCard from "@/Components/Page/Home/v8/CheckoutCard";
import { ApiMock, CreatorPageMock, DonationMock, InvoiceMock, PayoutMock } from "@/Components/Page/Product/mocks";
import { NETWORK_META, VERTICAL_PAYMENTS, fmtCoin, fmtUsd, usePrices } from "@/Components/Page/Home/v7/mock/payments";
import type { SEOPageContent } from "@/utils/seoContent";

/* Per-audience hero mockup for the /for/* and /compare/* landing pages. */

type Group = "checkout" | "invoice" | "donation" | "creator" | "payout" | "api" | "compare";

const SLUG_GROUP: Record<string, Group> = {
  freelancers: "invoice",
  agencies: "invoice",
  consultants: "invoice",
  nonprofits: "donation",
  fundraisers: "donation",
  "web3-daos": "donation",
  creators: "creator",
  "affiliate-marketing": "payout",
  remittance: "payout",
  developers: "api",
  saas: "api",
};

const VerticalCheckout: React.FC<{ slug: string }> = ({ slug }) => {
  const prices = usePrices();
  const p = VERTICAL_PAYMENTS[slug] || VERTICAL_PAYMENTS.ecommerce;
  return (
    <CheckoutCard
      merchant={p.merchant}
      reference={p.ref}
      totalUsd={fmtUsd(p.usd)}
      asset={p.coin}
      amount={fmtCoin(p, prices).split(" ")[0]}
      network={p.network}
      address={NETWORK_META[p.network].addr}
    />
  );
};

const COMPARE_ROWS: [string, string][] = [
  ["Custody", "Your own wallet"],
  ["Settlement", "On-chain, direct to you"],
  ["Auto-convert", "USDC / USDT"],
  ["Chargebacks", "None"],
  ["Fees", "1.5% → 0.5% by volume"],
  ["First payment", "Free"],
];

const CompareMock: React.FC<{ competitor: string }> = ({ competitor }) => (
  <Box data-testid="seo-compare-mock">
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.12em", color: PANEL.ink3, textTransform: "uppercase" }}>
        Switching from {competitor}
      </Typography>
      <Box sx={{ px: 1, py: 0.4, borderRadius: 999, background: PANEL.goldSoft, border: "1px solid rgba(255,209,0,0.35)" }}>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, color: PANEL.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Dynopay</Typography>
      </Box>
    </Box>
    <Box sx={{ borderRadius: "12px", border: `1px solid ${PANEL.line}`, background: PANEL.surface, overflow: "hidden" }}>
      {COMPARE_ROWS.map(([k, v], i) => (
        <Box key={k} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, px: 1.75, py: 1.2, borderTop: i ? `1px solid ${PANEL.line}` : "none" }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: PANEL.ink2 }}>{k}</Typography>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
            <Icon icon="mdi:check-circle" width={14} height={14} color={PANEL.gold} />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, color: PANEL.ink, textAlign: "right" }}>{v}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
    <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: "10px", background: PANEL.greenSoft, border: "1px solid rgba(52,211,153,0.3)" }}>
      <Icon icon="mdi:lightning-bolt" width={15} height={15} color={PANEL.green} />
      <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 12.5, fontWeight: 600, color: PANEL.ink }}>Live in under 10 minutes</Typography>
    </Box>
  </Box>
);

const MOCKS: Record<Exclude<Group, "checkout" | "compare">, React.FC> = {
  invoice: InvoiceMock,
  donation: DonationMock,
  creator: CreatorPageMock,
  payout: PayoutMock,
  api: ApiMock,
};

const SEOHeroMock: React.FC<{ content: SEOPageContent }> = ({ content }) => {
  const slug = content._slug || "";
  const group: Group = content._kind === "comparison" ? "compare" : SLUG_GROUP[slug] || "checkout";
  let node: React.ReactNode;
  if (group === "compare") node = <CompareMock competitor={content._display_name} />;
  else if (group === "checkout") node = <VerticalCheckout slug={slug} />;
  else {
    const Mock = MOCKS[group];
    node = <Mock />;
  }
  return (
    <Box data-testid="seo-hero-illustration" data-mock={group}>
      <MockPanelV8>{node}</MockPanelV8>
    </Box>
  );
};

export default memo(SEOHeroMock);
