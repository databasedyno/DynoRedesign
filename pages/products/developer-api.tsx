import React, { memo } from "react";
import ProductPageV8, { type ProductPageConfig } from "@/Components/Page/Product/ProductPageV8";
import { ApiMock } from "@/Components/Page/Product/mocks";

const config: ProductPageConfig = {
  slug: "developer-api",
  seoTitle: "Developer API — crypto payments API | DynoPay",
  seoDescription:
    "One clean REST API to create payments, run checkouts and receive webhooks. Built to ship fast, with clear docs and predictable responses.",
  eyebrow: "Developer API",
  titleLead: "A crypto payments API you'll",
  titleHighlight: "actually enjoy.",
  body: "One clean REST API to create payments, spin up checkouts and receive webhooks. Predictable responses, clear docs, and SDKs that get out of your way.",
  trust: ["REST + webhooks", "Test mode", "Ship in a day"],
  demo: { label: "Read the docs", href: "/documentation" },
  mockup: <ApiMock />,
  featuresEyebrow: "Built for builders",
  featuresTitle: "Everything you need to integrate",
  featuresLead: "A focused API surface, sensible defaults and the tooling to go from idea to live payment fast.",
  features: [
    { icon: "mdi:code-json", title: "Clean REST API", body: "Predictable endpoints and JSON responses for payments, checkouts and payouts." },
    { icon: "mdi:webhook", title: "Reliable webhooks", body: "Signed, retried events so your backend always knows what happened." },
    { icon: "mdi:test-tube", title: "Test mode", body: "Build and verify end-to-end with test keys before you touch real funds." },
    { icon: "mdi:book-open-page-variant-outline", title: "Clear docs", body: "Copy-paste examples, a full reference, and auth you can grok in minutes." },
    { icon: "mdi:language-javascript", title: "Snippets & SDKs", body: "Ready-to-run examples in the languages your team already uses." },
    { icon: "mdi:shield-key-outline", title: "Scoped keys", body: "Publishable and secret keys with the right access, rotatable anytime." },
  ],
  stats: [
    { v: "1 API", l: "payments to payouts" },
    { v: "< 1 day", l: "typical integration" },
    { v: "99.9%", l: "API uptime" },
  ],
  finalTitle: "Start building in",
  finalHighlight: "minutes.",
  finalBody: "Grab a test key, create your first payment, and go live when you're ready — free to start.",
};

const DeveloperApiPage: React.FC = () => <ProductPageV8 config={config} />;
export default memo(DeveloperApiPage);
