import React from "react";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import RewardsPage from "@/Components/SafeDeal/Rewards/RewardsPage";

const Page: NextPageWithLayout = () => (
  <SafeDealShell title="Rewards" description="Invite friends to SafeDeal, earn fee credit and unlock lower escrow rates." noindex>
    <RewardsPage />
  </SafeDealShell>
);
Page.layout = "none";
export default Page;
