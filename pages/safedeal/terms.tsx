import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import LegalPage from "@/Components/SafeDeal/LegalPage";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Terms of use">
    <LegalPage slug="terms" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
