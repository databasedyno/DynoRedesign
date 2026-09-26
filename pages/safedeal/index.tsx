import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import FlowLanding from "@/Components/SafeDeal/FlowLanding";

// Service structured data — describes SafeDeal's escrow offering so search
// engines understand the landing page's core product (provider = the base
// Organization graph emitted by SafeDealShell).
const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://safedeal.sh/#service",
  name: "SafeDeal escrow",
  serviceType: "Online escrow service",
  provider: { "@id": "https://safedeal.sh/#organization" },
  areaServed: "Worldwide",
  description:
    "SafeDeal holds the buyer's payment in USDT escrow until the seller delivers, and steps in only if there's a dispute. 5% fee, no account to set up — both sides sign in with an email code.",
  offers: {
    "@type": "Offer",
    price: "5",
    priceCurrency: "USD",
    description: "5% escrow fee (percentage of the deal amount, with a minimum), plus network and exchange costs.",
  },
};

const Page: NextPageWithLayout = () => (
  <SafeDealShell jsonLd={serviceJsonLd}>
    <FlowLanding />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
