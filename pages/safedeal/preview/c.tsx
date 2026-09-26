import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import MockC from "@/Components/SafeDeal/redesign/MockC";

// Private preview — Direction C "The Flow" (Dynopay-style product mockup). noindex, unlinked.
const Page: NextPageWithLayout = () => (
  <SafeDealShell noindex title="Redesign C · The Flow">
    <MockC />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
