import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import MockA from "@/Components/SafeDeal/redesign/MockA";

// Private preview — Direction A "The Vault" (dark & premium). noindex, unlinked.
const Page: NextPageWithLayout = () => (
  <SafeDealShell noindex dark title="Redesign A · The Vault">
    <MockA />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
