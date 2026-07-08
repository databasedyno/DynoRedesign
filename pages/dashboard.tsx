import DashboardLeftSection from "@/Components/Page/Dashboard/DashboardLeftSection";
import DashboardRightSection from "@/Components/Page/Dashboard/DashboardRightSection";
import CustomButton from "@/Components/UI/Buttons";
import MobileReferralBanner from "@/Components/UI/MobileReferralBanner";
import OnboardingFlow from "@/Components/UI/OnboardingFlow";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps, rootReducer } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import { Grid } from "@mui/material";
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
  // User has wallets if any wallet entries exist
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  const setupComplete = hasCompany && hasWallet;

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
        {isMobile && <MobileReferralBanner />}
        <Grid container spacing={2.5}>
          <Grid item xs={12} xl={8}>
            <DashboardLeftSection />
          </Grid>

          <Grid item xs={12} xl={4}>
            <DashboardRightSection />
          </Grid>
        </Grid>
      </main>
    </>
  );
}
