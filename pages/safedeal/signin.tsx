import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import SignIn from "@/Components/SafeDeal/SignIn";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Sign in" noindex>
    <SignIn />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
