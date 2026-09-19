import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import Wallet from "@/Components/SafeDeal/Wallet";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Wallet">
    <Wallet />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
