import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import LegalPage from "@/Components/SafeDeal/LegalPage";

const Page: NextPageWithLayout = () => (
  <SafeDealShell
    title="Privacy"
    description="How SafeDeal handles your data — what we collect, why we collect it, and the choices you have."
  >
    <LegalPage slug="privacy" />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
