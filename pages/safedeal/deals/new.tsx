import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import NewDeal from "@/Components/SafeDeal/NewDeal";

const Page: NextPageWithLayout = () => (
  <SafeDealShell
    title="Create a deal"
    description="Set up an escrow deal in under a minute. Name it, set the price and invite the other party by email or link — SafeDeal holds the payment in USDT until it's delivered."
  >
    <NewDeal />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
