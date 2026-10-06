import React, { memo } from "react";
import ProductPageV8, { type ProductPageConfig } from "@/Components/Page/Product/ProductPageV8";
import { CreatorPageMock } from "@/Components/Page/Product/mocks";

const config: ProductPageConfig = {
  slug: "creator-pages",
  seoTitle: "Creator Pages — a branded crypto pay page | DynoPay",
  seoDescription:
    "A branded page where fans and clients pay you directly in crypto. Perfect for creators and freelancers — tips, support and one-off payments.",
  eyebrow: "Creator Pages",
  titleLead: "A branded page your fans",
  titleHighlight: "pay you on.",
  body: "Give supporters and clients one beautiful, trustworthy page to pay you directly in crypto — your logo, your handle, your currency.",
  trust: ["Your branding", "Tips & one-offs", "Non-custodial"],
  demo: { label: "See creator solutions", href: "/for/creators" },
  mockup: <CreatorPageMock />,
  featuresEyebrow: "Made for creators",
  featuresTitle: "Built to turn an audience into income",
  featuresLead: "A page that feels like you — and makes paying you effortless from anywhere in the world.",
  features: [
    { icon: "mdi:palette-outline", title: "On-brand", body: "Your logo, colours and handle on a page that looks like part of your world." },
    { icon: "mdi:hand-heart-outline", title: "Tips & support", body: "Preset amounts and custom tips make supporting you a one-tap decision." },
    { icon: "mdi:earth", title: "Global by default", body: "Fans anywhere can pay in the coin they already hold — no borders, no banks." },
    { icon: "mdi:message-text-outline", title: "Messages", body: "Let supporters leave a note with their payment so you know who to thank." },
    { icon: "mdi:swap-horizontal-bold", title: "Auto-convert", body: "Settle to a stablecoin automatically so your earnings hold their value." },
    { icon: "mdi:shield-check-outline", title: "Safe & direct", body: "Payments land straight in your wallet — you're always in control." },
  ],
  stats: [
    { v: "40+", l: "coins supported" },
    { v: "190+", l: "countries" },
    { v: "0%", l: "platform lock-in" },
  ],
  finalTitle: "Launch your creator page",
  finalHighlight: "today.",
  finalBody: "Set up a branded crypto page in minutes and start getting supported — free to start.",
};

const CreatorPagesPage: React.FC = () => <ProductPageV8 config={config} />;
export default memo(CreatorPagesPage);
