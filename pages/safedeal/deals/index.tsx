import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import SafeDealHome from "@/Components/SafeDeal/Home/SafeDealHome";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="My deals" description="Your SafeDeal escrow deals, balance and activity in one place — every payment held in USDT until delivery is confirmed." noindex>
    <SafeDealHome initialTab="overview" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
