import React from "react";
import { Box } from "@mui/material";
import HeroKPI from "./HeroKPI";
import LivePaymentFeed from "./LivePaymentFeed";
import AttentionCardsRow from "./AttentionCardsRow";
import AssetBreakdownRows from "./AssetBreakdownRows";
import QuickActionsPanel from "./QuickActionsPanel";
import FeeTierProgress from "../FeeTierProgress";
import RecentTransactionsWidget from "../RecentTransactionsWidget";
import CreatorPageCard from "../CreatorPageCard";
import ReferralAndKnowledge from "@/Components/Layout/ReferralAndKnowledge";
import useIsMobile from "@/hooks/useIsMobile";

/**
 * CoinbaseDashboard — the Coinbase-style dashboard composition.
 *
 * Grid (desktop ≥ lg): 2 columns — [ 8fr LEFT | 4fr RIGHT ]
 * Grid (mobile / md):   single column — LEFT stack then RIGHT stack
 *
 * LEFT column (main fold):
 *   1. HeroKPI            — Lifetime volume + delta + sparkline + timeframes
 *   2. LivePaymentFeed    — Stripe-style live payments strip (20s polling)
 *   3. AttentionCardsRow  — dismissible referral + setup cards
 *   4. AssetBreakdownRows — Crypto / Fiat / Pending / Payments rows
 *   5. RecentTransactionsWidget — existing compact table
 *   6. FeeTierProgress    — existing tier bar
 *
 * RIGHT column (aside):
 *   1. QuickActionsPanel  — Receive/Convert/Invoice tabs + shortcut stack
 *   2. CreatorPageCard    — existing creator preview
 *   3. ReferralAndKnowledge — existing help block
 */

const CoinbaseDashboard: React.FC = () => {
  const isMobile = useIsMobile("md");
  return (
    <Box
      data-testid="cb-dashboard-root"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          lg: "minmax(0, 8fr) minmax(0, 4fr)",
        },
        gap: { xs: 2, md: 2.5, lg: 3 },
        alignItems: "start",
      }}
    >
      {/* LEFT column */}
      <Box
        data-testid="cb-dashboard-main"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, md: 2.5 },
          minWidth: 0,
        }}
      >
        <HeroKPI />
        <LivePaymentFeed />
        <AttentionCardsRow />
        <AssetBreakdownRows />
        <RecentTransactionsWidget />
        {!isMobile && <FeeTierProgress />}
      </Box>

      {/* RIGHT column */}
      <Box
        data-testid="cb-dashboard-aside"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: 2, md: 2.5 },
          minWidth: 0,
          position: { lg: "sticky" },
          top: { lg: 96 },
        }}
      >
        <QuickActionsPanel />
        {isMobile && <FeeTierProgress />}
        <CreatorPageCard />
        <ReferralAndKnowledge isMobile={isMobile} />
      </Box>
    </Box>
  );
};

export default CoinbaseDashboard;
