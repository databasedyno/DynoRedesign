import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import Landing from "@/Components/SafeDeal/Landing";

const Page: NextPageWithLayout = () => (
  <SafeDealShell>
    <Landing />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
