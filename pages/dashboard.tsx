import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import ClaimHandleBanner from "@/Components/Page/Dashboard/ClaimHandleBanner";
import AutoClaimHandle from "@/Components/Page/Dashboard/AutoClaimHandle";
import CustomButton from "@/Components/UI/Buttons";
import OnboardingFlow from "@/Components/UI/OnboardingFlow";
import Dashboard2026 from "@/Components/Page/Dashboard/v2026";
import useIsMobile from "@/hooks/useIsMobile";
import { pageProps, rootReducer } from "@/utils/types";
import { AddRounded } from "@mui/icons-material";
import Head from "next/head";
import router from "next/router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Dashboard — 2026 merchant command center (default & only layout).
 *
 * The dashboard renders `Dashboard2026` (Components/Page/Dashboard/v2026),
 * a bento command center: a personalised CommandBar (greeting + global time
 * range + settings), a Volume hero, a KPI strip, recent activity, an assets
 * breakdown, a merchant quick-actions dock, the fee-tier card, grow/storefront
 * slots, and a first-run activation checklist.
 *
 * The classic two-column layout (and its localStorage feature flag) was
 * retired once the 2026 design was approved. Auxiliary chrome
 * (OnboardingFlow, AutoClaimHandle, ClaimHandleBanner) still lives here. The
 * mobile-only referral banner was removed (Aug 2026) so the balance stays the
 * hero on mobile — referral/invite still lives in the "Grow with Dynopay" slot.
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

  const companyState = useCompanyStore();
  const walletState = useWalletStore();
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
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
        <AutoClaimHandle />
        {setupComplete && <ClaimHandleBanner />}

        {/* Coinbase look: scope Inter to the dashboard by redefining --font-sans
            here (every dashboard text uses var(--font-sans)); numbers already
            render in Roboto Mono via the UI-Kit MONO stack. */}
        <div
          style={
            {
              "--font-sans": "var(--font-inter)",
              fontFamily: "var(--font-inter)",
            } as React.CSSProperties
          }
        >
          <Dashboard2026 />
        </div>
      </main>
    </>
  );
}
