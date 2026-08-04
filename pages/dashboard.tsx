import DashboardLeftSection from "@/Components/Page/Dashboard/DashboardLeftSection";
import DashboardRightSection from "@/Components/Page/Dashboard/DashboardRightSection";
import ClaimHandleBanner from "@/Components/Page/Dashboard/ClaimHandleBanner";
import AutoClaimHandle from "@/Components/Page/Dashboard/AutoClaimHandle";
import CustomButton from "@/Components/UI/Buttons";
import MobileReferralBanner from "@/Components/UI/MobileReferralBanner";
import OnboardingFlow from "@/Components/UI/OnboardingFlow";
import Dashboard2026 from "@/Components/Page/Dashboard/v2026";
import useDashboardLayout from "@/hooks/useDashboardLayout";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps, rootReducer } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { Box, Grid } from "@mui/material";
import Head from "next/head";
import router from "next/router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

/**
 * Dashboard — restored to the pre-Session-97 two-column layout on 2025-07.
 *
 * User feedback: the Coinbase-style refresh introduced consumer-app features
 * (Receive / Convert / Invoice tabbed panel, big amount input, coin chips,
 * live-payments strip, attention-cards row, asset-breakdown rows) that don't
 * belong in a merchant payment gateway. The immediate-previous dashboard
 * composed HeroMetrics + RecentTransactionsWidget + Active Wallets +
 * Transaction Volume chart on the left, and FeeTierProgress + CreatorPageCard
 * + GrowPanel on the right — this file restores that composition.
 *
 * All the auxiliary chrome (OnboardingFlow, AutoClaimHandle,
 * MobileReferralBanner, ClaimHandleBanner) and the zero-payment
 * EmptyStatePanel branching still work — they live inside
 * DashboardLeftSection where they always did.
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
  const { layout, setLayout } = useDashboardLayout();

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

        {layout === "v2026" ? (
          <Dashboard2026 onSwitchClassic={() => setLayout("classic")} />
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                mb: 2,
                px: { xs: "16px", md: 0 },
              }}
            >
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setLayout("v2026")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setLayout("v2026");
                }}
                data-testid="dashboard-try-2026"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.75,
                  py: 0.85,
                  borderRadius: 999,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  background: (th) =>
                    th.palette.mode === "dark" ? "#818CF8" : "#4F46E5",
                  transition: "opacity 150ms ease, transform 150ms ease",
                  "&:hover": { opacity: 0.92, transform: "translateY(-1px)" },
                }}
              >
                {tDashboard("tryNewDashboard") === "tryNewDashboard"
                  ? "Try the new dashboard →"
                  : (tDashboard("tryNewDashboard") as string)}
              </Box>
            </Box>
            <Grid
              container
              spacing={{ xs: 2, md: 2.5, lg: 3 }}
              alignItems="flex-start"
              data-testid="dashboard-root"
            >
              <Grid item xs={12} lg={8}>
                <DashboardLeftSection />
              </Grid>
              <Grid item xs={12} lg={4}>
                <DashboardRightSection />
              </Grid>
            </Grid>
          </>
        )}
      </main>
    </>
  );
}
