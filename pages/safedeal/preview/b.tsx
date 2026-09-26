import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import MockB from "@/Components/SafeDeal/redesign/MockB";

// Private preview — Direction B "The Handshake" (light & editorial). noindex, unlinked.
const Page: NextPageWithLayout = () => (
  <SafeDealShell noindex title="Redesign B · The Handshake">
    <MockB />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
