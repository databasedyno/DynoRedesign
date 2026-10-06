import React, { memo } from "react";
import ProductPageV8, { type ProductPageConfig } from "@/Components/Page/Product/ProductPageV8";
import { PaymentLinkMock } from "@/Components/Page/Product/mocks";

const config: ProductPageConfig = {
  slug: "payment-links",
  seoTitle: "Payment Links — get paid in crypto with a link | DynoPay",
  seoDescription:
    "Create a shareable crypto payment link in seconds. No website, no code. Take 40+ coins, set any amount, and settle to the currency you choose.",
  eyebrow: "Payment Links",
  titleLead: "Get paid in crypto with a",
  titleHighlight: "single link.",
  body: "Spin up a shareable payment link in seconds — no website or code. Set an amount, drop it in a DM, invoice or bio, and get paid in 40+ coins.",
  trust: ["No code", "Reusable or one-time", "Any coin"],
  demo: { label: "See live demo", href: "/pay/demo" },
  mockup: <PaymentLinkMock />,
  featuresEyebrow: "Why links",
  featuresTitle: "The fastest way to accept crypto",
  featuresLead: "Everything you need to request a payment and get it confirmed — in the time it takes to paste a link.",
  features: [
    { icon: "mdi:lightning-bolt-outline", title: "Live in seconds", body: "Name it, set an amount, share it. No integration, no approval wait." },
    { icon: "mdi:qrcode", title: "Link + QR", body: "Every link comes with a scannable QR for in-person and mobile payments." },
    { icon: "mdi:repeat-variant", title: "One-time or reusable", body: "Use a fixed-amount link once, or a reusable link for tips and repeat buyers." },
    { icon: "mdi:swap-horizontal-bold", title: "Settle your way", body: "Keep the coin you're paid or auto-convert to a stablecoin on arrival." },
    { icon: "mdi:bell-ring-outline", title: "Instant alerts", body: "Get notified the moment a payment is detected and confirmed on-chain." },
    { icon: "mdi:key-chain-variant", title: "Non-custodial", body: "Funds settle straight to you — no chargebacks, you hold the keys." },
  ],
  stats: [
    { v: "40+", l: "coins accepted" },
    { v: "10 sec", l: "to create a link" },
    { v: "0", l: "chargebacks" },
  ],
  finalTitle: "Your next payment is one",
  finalHighlight: "link away.",
  finalBody: "Create your first payment link free and share it in seconds — your first payment is on us.",
};

const PaymentLinksPage: React.FC = () => <ProductPageV8 config={config} />;
export default memo(PaymentLinksPage);
