import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import LegalPage from "@/Components/SafeDeal/LegalPage";

const Page: NextPageWithLayout = () => (
  <SafeDealShell
    title="Terms of use"
    description="The terms of use for SafeDeal escrow — how deals, funding, payouts, fees, cancellations and disputes work."
  >
    <LegalPage slug="terms" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
