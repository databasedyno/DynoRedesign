import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import SafeDealHome from "@/Components/SafeDeal/Home/SafeDealHome";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Wallet" description="Your SafeDeal balance, escrow holds, cashouts and statement — funds held as USDT, released only when a deal completes." noindex>
    <SafeDealHome initialTab="activity" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
