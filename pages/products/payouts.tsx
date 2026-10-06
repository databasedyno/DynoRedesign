import React, { memo } from "react";
import ProductPageV8, { type ProductPageConfig } from "@/Components/Page/Product/ProductPageV8";
import { PayoutMock } from "@/Components/Page/Product/mocks";

const config: ProductPageConfig = {
  slug: "payouts",
  seoTitle: "Crypto Payouts — pay teams and suppliers | DynoPay",
  seoDescription:
    "Pay contractors, affiliates and suppliers in crypto — single sends or batched in one click — straight from your DynoPay balance, anywhere.",
  eyebrow: "Payouts",
  titleLead: "Pay anyone, anywhere, in",
  titleHighlight: "crypto.",
  body: "Send to contractors, suppliers and affiliates in the coin they want — one at a time or thousands in a single batch — straight from your balance.",
  trust: ["Single or batch", "Any supported coin", "Low, flat fees"],
  mockup: <PayoutMock />,
  featuresEyebrow: "For operators",
  featuresTitle: "Mass payouts without the pain",
  featuresLead: "Move money to a lot of people, fast — with the controls finance teams expect.",
  features: [
    { icon: "mdi:account-multiple-outline", title: "Batch in one click", body: "Upload a list or pick recipients and send thousands of payouts at once." },
    { icon: "mdi:earth", title: "Borderless", body: "Reach anyone with a wallet — no bank rails, no cross-border delays." },
    { icon: "mdi:cash-check", title: "Transparent fees", body: "See the exact network fee per payout before you send — no surprises." },
    { icon: "mdi:shield-account-outline", title: "Approvals", body: "Require a second approver on big batches to keep funds safe." },
    { icon: "mdi:file-chart-outline", title: "Clean records", body: "Every payout is on-chain and exportable for reconciliation." },
    { icon: "mdi:api", title: "API & webhooks", body: "Trigger payouts programmatically and get notified when they settle." },
  ],
  stats: [
    { v: "40+", l: "coins supported" },
    { v: "190+", l: "countries" },
    { v: "1-click", l: "batch sends" },
  ],
  finalTitle: "Pay your people in",
  finalHighlight: "minutes.",
  finalBody: "Fund your balance and send your first crypto payout free — single or batched, anywhere in the world.",
};

const PayoutsPage: React.FC = () => <ProductPageV8 config={config} />;
export default memo(PayoutsPage);
