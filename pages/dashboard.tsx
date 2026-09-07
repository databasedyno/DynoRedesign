import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import ClaimHandleBanner from "@/Components/Page/Dashboard/ClaimHandleBanner";
import KycGraceBanner from "@/Components/Page/Dashboard/KycGraceBanner";
import WalletSetupNudge from "@/Components/Page/Dashboard/WalletSetupNudge";
import AutoClaimHandle from "@/Components/Page/Dashboard/AutoClaimHandle";
import OnboardingFlow from "@/Components/UI/OnboardingFlow";
import Dashboard2026 from "@/Components/Page/Dashboard/v2026";
import { pageProps, rootReducer } from "@/utils/types";
import Head from "next/head";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

/**
 * Dashboard — 2026 merchant command center (default & only layout).
 *
 * The dashboard renders `Dashboard2026` (Components/Page/Dashboard/v2026),
 * a bento command center: a BalanceStrip (metric + global time range +
 * settings + big mono volume), a quiet ActionsRow, the Volume chart, a KPI
 * strip, recent activity, an assets breakdown, the fee-tier card, grow /
 * storefront slots, and a first-run activation checklist.
 *
 * Top-area polish (Jun 2026): the page H1 IS the personalised greeting (with
 * today's date as the description) — the old "Dashboard / Overview of…" title
 * pair and the in-card greeting eyebrow were three competing headers. The
 * page-level "Create payment link" button was retired: the header's `+ New`
 * is the ONE create control (IA audit Law 3). The dismissible referral banner
 * left the dashboard too — the referral offer already lives in the right rail
 * (Grow slot + Referral code card).
 */
export default function Home({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) {
  const namespaces = ["dashboardLayout", "common"];
  const { t, i18n } = useTranslation(namespaces);

  const companyState = useCompanyStore();
  const walletState = useWalletStore();
  const isMember = companyState.isMember; // teammate viewing the OWNER's business
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  // A team member never sees merchant onboarding — the business is already set up.
  const setupComplete = isMember || (hasCompany && hasWallet);

  const firstName = useSelector(
    (s: rootReducer) => (s as any).userReducer?.profile?.first_name,
  ) as string | undefined;
  const name = useSelector(
    (s: rootReducer) => (s as any).userReducer?.profile?.name,
  ) as string | undefined;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const base =
      h < 12
        ? t("greetMorning", { ns: "dashboardLayout", defaultValue: "Good morning" })
        : h < 18
          ? t("greetAfternoon", { ns: "dashboardLayout", defaultValue: "Good afternoon" })
          : t("greetEvening", { ns: "dashboardLayout", defaultValue: "Good evening" });
    // Prefer the dedicated first_name column; fall back to splitting `name`.
    const first = firstName && firstName.trim()
      ? firstName.trim()
      : name ? String(name).trim().split(/\s+/)[0] : "";
    return first ? `${base}, ${first}` : base;
  }, [t, firstName, name]);

  const dateLine = useMemo(() => {
    try {
      return new Date().toLocaleDateString(i18n.language || "en", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return "";
    }
  }, [i18n.language]);

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(greeting);
      setPageDescription(dateLine);
    }
  }, [setPageName, setPageDescription, greeting, dateLine]);

  useEffect(() => {
    if (!setPageAction) return;
    setPageAction(null);
    return () => setPageAction(null);
  }, [setPageAction]);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <main>
        {!isMember && <KycGraceBanner />}
        {!isMember && <WalletSetupNudge />}
        {!isMember && <OnboardingFlow />}
        {!isMember && <AutoClaimHandle />}
        {!isMember && setupComplete && <ClaimHandleBanner />}

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
