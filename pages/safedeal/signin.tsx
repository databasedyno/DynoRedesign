import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import SignIn from "@/Components/SafeDeal/SignIn";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Sign in" description="Sign in to SafeDeal with a one-time email code — no password, no account setup. Accept a deal, fund escrow or get paid in minutes." noindex>
    <SignIn />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
