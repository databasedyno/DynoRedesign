import React, { memo } from "react";
import ProductPageV8, { type ProductPageConfig } from "@/Components/Page/Product/ProductPageV8";
import { InvoiceMock } from "@/Components/Page/Product/mocks";

const config: ProductPageConfig = {
  slug: "invoices",
  seoTitle: "Crypto Invoices — send and get paid | DynoPay",
  seoDescription:
    "Send professional crypto invoices with due dates and automatic reconciliation when they're paid. Line items, taxes and multi-coin settlement.",
  eyebrow: "Invoices",
  titleLead: "Professional crypto invoices that",
  titleHighlight: "pay themselves.",
  body: "Send a clean, branded invoice with due dates and line items. Clients pay in any coin, and we reconcile it automatically the moment it lands.",
  trust: ["Due dates", "Auto-reconciled", "Any coin"],
  mockup: <InvoiceMock />,
  featuresEyebrow: "For businesses",
  featuresTitle: "Invoicing without the chasing",
  featuresLead: "From draft to paid-and-booked — every step handled, so you spend less time on admin.",
  features: [
    { icon: "mdi:file-document-edit-outline", title: "Branded & itemised", body: "Add line items, taxes and notes on an invoice that carries your brand." },
    { icon: "mdi:calendar-clock", title: "Due dates & reminders", body: "Set terms and let automatic nudges do the follow-up for you." },
    { icon: "mdi:sync", title: "Auto-reconciliation", body: "Payments match to the right invoice automatically — your books stay tidy." },
    { icon: "mdi:currency-usd", title: "Multi-coin, one total", body: "Clients pay in their coin; you see one clear total in your currency." },
    { icon: "mdi:swap-horizontal-bold", title: "Settle to stablecoin", body: "Lock in value on arrival so an invoice is worth what you billed." },
    { icon: "mdi:download-outline", title: "Records & exports", body: "Every paid invoice is on-chain and exportable for accounting." },
  ],
  stats: [
    { v: "40+", l: "coins accepted" },
    { v: "< 2 min", l: "median settle" },
    { v: "0", l: "chargebacks" },
  ],
  finalTitle: "Send an invoice, get paid in",
  finalHighlight: "crypto.",
  finalBody: "Create your first crypto invoice free and watch it reconcile itself — no monthly fees.",
};

const InvoicesPage: React.FC = () => <ProductPageV8 config={config} />;
export default memo(InvoicesPage);
