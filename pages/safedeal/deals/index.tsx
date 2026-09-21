import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import DealsList from "@/Components/SafeDeal/DealsList";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="My deals" noindex>
    <DealsList />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
