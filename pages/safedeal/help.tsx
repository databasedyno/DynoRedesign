import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import LegalPage from "@/Components/SafeDeal/LegalPage";
import { LEGAL_DOCS } from "@/Components/SafeDeal/legalContent";

// FAQPage structured data — each help section becomes a Question/Answer so
// Google/Bing can show rich FAQ results for SafeDeal's help centre.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LEGAL_DOCS.help.sections.map((s) => ({
    "@type": "Question",
    name: s.h,
    acceptedAnswer: { "@type": "Answer", text: s.p.join(" ") },
  })),
};

const Page: NextPageWithLayout = () => (
  <SafeDealShell
    title="Help centre"
    description="SafeDeal help centre — clear answers on escrow, funding, delivery, payouts, fees, cancellations and disputes."
    jsonLd={faqJsonLd}
  >
    <LegalPage slug="help" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
