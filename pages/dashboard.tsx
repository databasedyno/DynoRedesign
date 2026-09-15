import { useCompanyStore } from "@/contexts/CompanyDataContext";
import AutoClaimHandle from "@/Components/Page/Dashboard/AutoClaimHandle";
import FirstRunRedirect from "@/Components/Page/GetStarted/FirstRunRedirect";
import Dashboard2026 from "@/Components/Page/Dashboard/v2026";
import { pageProps, rootReducer } from "@/utils/types";
import Head from "next/head";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

/**
 * Dashboard — the merchant command centre (Components/Page/Dashboard/v2026).
 *
 * State → Attention → Money → Trend → Activity: a live pulse chip + global
 * range control, ONE "Needs attention" task feed (which replaced the KYC,
 * underpaid, password, claim-handle and 2FA banners), three money-in-motion
 * tiles, the trend card with checkout health, recent payments + top links /
 * products, and a collapsed plan & fees line. Until the first payment lands the
 * Getting-started checklist owns the page (`FirstRunRedirect` sends a brand-new
 * merchant to /get-started once per session).
 *
 * The page H1 IS the personalised greeting; the header's `+ New` is the ONE
 * create control, so the home carries no navigation tiles.
 */
export default function Home({
  setPageName,
  setPageDescription,
  setPageAction,
}: pageProps) {
  const namespaces = ["dashboardLayout", "common"];
  const { t, i18n } = useTranslation(namespaces);

  const companyState = useCompanyStore();
  const isMember = companyState.isMember; // teammate viewing the OWNER's business

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
        {!isMember && <FirstRunRedirect />}
        {!isMember && <AutoClaimHandle />}

        <div
          style={
            {
              "--font-sans": "var(--font-inter)",
              fontFamily: "var(--font-inter)",
            } as React.CSSProperties
          }
        >
          <Dashboard2026 onboarding={!isMember} />
        </div>
      </main>
    </>
  );
}
