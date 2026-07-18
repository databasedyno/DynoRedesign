// Dashboard \u2014 Aurora v3 overview (2026-07-18).
// Answers four questions in the fold:
//   1. How much did I make?            \u2192 AuroraKPIHero (big number + sparkline)
//   2. Settled in which coin?          \u2192 SettledMixDonut
//   3. Where's it flowing? (live)      \u2192 LiveActivityFeed
//   4. What needs my attention?        \u2192 AttentionCardsRow
// Below fold: GettingStartedChecklist (< 30 day accounts) + RecentOrdersMiniTable.
import ClaimHandleBanner from "@/Components/Page/Dashboard/ClaimHandleBanner";
import CreatorPageCard from "@/Components/Page/Dashboard/CreatorPageCard";
import AttentionCardsRow from "@/Components/Page/Dashboard/aurora/AttentionCardsRow";
import AuroraKPIHero from "@/Components/Page/Dashboard/aurora/AuroraKPIHero";
import FeeTierLevelCard from "@/Components/Page/Dashboard/aurora/FeeTierLevelCard";
import GettingStartedChecklist from "@/Components/Page/Dashboard/aurora/GettingStartedChecklist";
import LiveActivityFeed from "@/Components/Page/Dashboard/aurora/LiveActivityFeed";
import RecentOrdersMiniTable from "@/Components/Page/Dashboard/aurora/RecentOrdersMiniTable";
import SettledMixDonut from "@/Components/Page/Dashboard/aurora/SettledMixDonut";
import CustomButton from "@/Components/UI/Buttons";
import MobileReferralBanner from "@/Components/UI/MobileReferralBanner";
import OnboardingFlow from "@/Components/UI/OnboardingFlow";
import { useDashboardData } from "@/hooks/useDashboardData";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps, rootReducer } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { Box, Grid } from "@mui/material";
import Head from "next/head";
import router from "next/router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

export default function Home({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) {
  const namespaces = ["dashboardLayout", "common"];

  const isMobile = useIsMobile("md");
  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );

  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const hasCompany = companyState.companyList?.length > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  const setupComplete = hasCompany && hasWallet;

  // Dashboard data hook \u2014 same source of truth used by the legacy left/right
  // sections. Redux-cached, so no double-fetch when both live on the page.
  const { stats, chartData, loading, recentTransactions, fetchChartData } =
    useDashboardData();

  // Kick off the 7-day chart fetch on mount so AuroraKPIHero's sparkline
  // has real data. Previously this dispatch lived in DashboardLeftSection.
  useEffect(() => {
    fetchChartData("7d");
  }, [fetchChartData]);

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(tDashboard("dashboard"));
      setPageDescription(tDashboard("dashboardDescription"));
    }
  }, [setPageName, setPageDescription, tDashboard]);

  useEffect(() => {
    if (!setPageAction) return;
    if (setupComplete) {
      setPageAction(
        <CustomButton
          data-testid="create-payment-link-btn"
          label={
            isMobile ? tDashboard("create") : tDashboard("createPaymentLink")
          }
          variant="primary"
          size="medium"
          endIcon={<AddRounded sx={{ fontSize: isMobile ? 18 : 20 }} />}
          onClick={() => router.push("/create-pay-link")}
          sx={{
            height: isMobile ? 34 : 40,
            px: isMobile ? 1.5 : 2.5,
            fontSize: isMobile ? 13 : 15,
          }}
          labelSx={{
            fontSize: "15px !important",
          }}
        />,
      );
    } else {
      setPageAction(null);
    }
    return () => setPageAction(null);
  }, [setPageAction, tDashboard, isMobile, setupComplete]);

  return (
    <>
      <Head>
        <meta
          name="description"
          content="Dynopay - Cryptocurrency Payment Gateway"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>

      <main>
        <OnboardingFlow />
        {isMobile && <MobileReferralBanner />}
        {setupComplete && <ClaimHandleBanner />}

        {/* ============================================================
            AURORA FOLD 1 \u2014 KPI hero + coin-mix donut (side-by-side lg+)
            ============================================================ */}
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12} lg={8}>
            <AuroraKPIHero
              loading={loading}
              stats={stats}
              chartData={chartData}
            />
          </Grid>
          <Grid item xs={12} lg={4}>
            <SettledMixDonut
              loading={loading}
              recentTransactions={recentTransactions}
            />
          </Grid>
        </Grid>

        {/* ============================================================
            AURORA FOLD 2 \u2014 Live activity feed (full width)
            ============================================================ */}
        <Box sx={{ mb: 2.5 }}>
          <LiveActivityFeed
            loading={loading}
            recentTransactions={recentTransactions}
          />
        </Box>

        {/* ============================================================
            AURORA FOLD 3 \u2014 Attention cards row (dismissible tasks)
            ============================================================ */}
        <Box sx={{ mb: 2.5 }}>
          <AttentionCardsRow />
        </Box>

        {/* ============================================================
            AURORA FOLD 4 - Fee-tier level ladder + Creator analytics
            (restored 2026-07-18 - dropped in the Aurora rewrite)
            ============================================================ */}
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12} lg={5}>
            <FeeTierLevelCard />
          </Grid>
          <Grid item xs={12} lg={7}>
            <CreatorPageCard />
          </Grid>
        </Grid>

        {/* ============================================================
            BELOW FOLD \u2014 Getting started (new users) + Recent orders
            ============================================================ */}
        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={5}>
            <GettingStartedChecklist />
          </Grid>
          <Grid item xs={12} lg={7}>
            <RecentOrdersMiniTable
              loading={loading}
              recentTransactions={recentTransactions}
            />
          </Grid>
        </Grid>
      </main>
    </>
  );
}
