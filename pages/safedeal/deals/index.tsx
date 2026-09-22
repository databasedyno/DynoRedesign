import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import SafeDealHome from "@/Components/SafeDeal/Home/SafeDealHome";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Home" noindex>
    <SafeDealHome initialTab="overview" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
