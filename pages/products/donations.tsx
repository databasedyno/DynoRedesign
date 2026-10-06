import React, { memo } from "react";
import ProductPageV8, { type ProductPageConfig } from "@/Components/Page/Product/ProductPageV8";
import { DonationMock } from "@/Components/Page/Product/mocks";

const config: ProductPageConfig = {
  slug: "donations",
  seoTitle: "Donations — accept crypto donations | DynoPay",
  seoDescription:
    "Accept one-off or recurring crypto donations with a simple, trustworthy page. Goals, preset amounts and instant settlement for nonprofits and causes.",
  eyebrow: "Donations",
  titleLead: "Fund your cause with",
  titleHighlight: "crypto donations.",
  body: "A clean, trustworthy donation page with goals and preset amounts. Accept one-off or recurring gifts in 40+ coins and settle instantly.",
  trust: ["One-off or recurring", "Fundraising goals", "Non-custodial"],
  demo: { label: "See a donation page", href: "/pay/donation-demo" },
  mockup: <DonationMock />,
  featuresEyebrow: "For causes",
  featuresTitle: "Everything a fundraiser needs",
  featuresLead: "Make giving feel effortless and transparent — from the first donation to the goal.",
  features: [
    { icon: "mdi:target", title: "Goals & progress", body: "Show a live funding bar that builds momentum and encourages bigger gifts." },
    { icon: "mdi:repeat", title: "Recurring giving", body: "Let supporters set up monthly crypto donations in a couple of taps." },
    { icon: "mdi:cash-multiple", title: "Preset amounts", body: "Suggested tiers plus a custom option to maximise every contribution." },
    { icon: "mdi:file-chart-outline", title: "Transparent records", body: "Every gift is on-chain and reconciled, so your books stay clean." },
    { icon: "mdi:swap-horizontal-bold", title: "Auto-convert", body: "Convert to a stablecoin on arrival so budgets aren't hit by volatility." },
    { icon: "mdi:earth", title: "Global reach", body: "Accept gifts from anywhere, in the coin donors already hold." },
  ],
  stats: [
    { v: "40+", l: "coins accepted" },
    { v: "190+", l: "countries" },
    { v: "0", l: "monthly fees" },
  ],
  finalTitle: "Start raising in crypto",
  finalHighlight: "today.",
  finalBody: "Launch a donation page in minutes and accept your first gift free — no setup fees, no lock-in.",
};

const DonationsPage: React.FC = () => <ProductPageV8 config={config} />;
export default memo(DonationsPage);
