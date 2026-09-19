import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import LegalPage from "@/Components/SafeDeal/LegalPage";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Privacy">
    <LegalPage slug="privacy" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
