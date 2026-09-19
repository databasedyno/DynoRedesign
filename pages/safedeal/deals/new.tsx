import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import NewDeal from "@/Components/SafeDeal/NewDeal";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Create a deal">
    <NewDeal />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
