import CoinbaseDashboard from "@/Components/Page/Dashboard/coinbase";
import ClaimHandleBanner from "@/Components/Page/Dashboard/ClaimHandleBanner";
import AutoClaimHandle from "@/Components/Page/Dashboard/AutoClaimHandle";
import EmptyStatePanel from "@/Components/Page/Dashboard/EmptyStatePanel";
import CustomButton from "@/Components/UI/Buttons";
import MobileReferralBanner from "@/Components/UI/MobileReferralBanner";
import OnboardingFlow from "@/Components/UI/OnboardingFlow";
import useIsMobile from "@/hooks/useIsMobile";
import { useDashboardData } from "@/hooks/useDashboardData";
import { pageProps, rootReducer } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { Box } from "@mui/material";
import Head from "next/head";
import router from "next/router";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

/**
 * Dashboard — Coinbase-style refresh (Session 97, 2026-08-02).
 *
 * Replaces the older DashboardLeftSection / DashboardRightSection two-column
 * Grid with the CoinbaseDashboard composition (`Components/Page/Dashboard/coinbase/`).
 * All prior widgets (FeeTierProgress, CreatorPageCard, ReferralAndKnowledge,
 * RecentTransactionsWidget, ClaimHandleBanner, OnboardingFlow, AutoClaimHandle,
 * MobileReferralBanner, EmptyStatePanel) are preserved in place — nothing was
 * deleted, only recomposed into the new fold.
 *
 * EmptyStatePanel still handles the zero-payment merchant case: if a merchant
 * has set up (company + wallet) but has never received a confirmed payment,
 * we show the guide instead of the Coinbase hero. This preserves the
 * "first payment" onboarding funnel.
 */
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
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  const setupComplete = hasCompany && hasWallet;

  // Zero-payment gate: use aggregate stats + a fallback scan of recentTransactions
  const { stats, recentTransactions, loading } = useDashboardData();
  const hasAnyConfirmedTxn = useMemo(() => {
    const totalTx = Number(stats?.totalTransactions ?? 0);
    const totalVol = Number(stats?.totalVolume ?? 0);
    if (totalTx > 0 || totalVol > 0) return true;
    const list = (recentTransactions as any[]) || [];
    return list.some((tx) => {
      const status = String(tx?.status || "").toLowerCase();
      return ["confirmed", "completed", "settled", "success", "successful", "paid"].includes(
        status,
      );
    });
  }, [stats?.totalTransactions, stats?.totalVolume, recentTransactions]);
  const showEmptyState = setupComplete && !hasAnyConfirmedTxn && !loading;

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
        <meta name="description" content="Dynopay - Cryptocurrency Payment Gateway" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <main>
        <OnboardingFlow />
        <AutoClaimHandle />
        {isMobile && <MobileReferralBanner />}
        {setupComplete && <ClaimHandleBanner />}

        {showEmptyState ? (
          <Box sx={{ mt: { xs: 1, md: 2 } }}>
            <EmptyStatePanel
              hasCompany={hasCompany}
              hasWallet={hasWallet}
              onCreateLink={() => router.push("/create-pay-link")}
            />
          </Box>
        ) : (
          <CoinbaseDashboard />
        )}
      </main>
    </>
  );
}
