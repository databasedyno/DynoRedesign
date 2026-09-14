import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import useAccountProfile from "@/hooks/useAccountProfile";
import { PaymentLinkAction, PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { rootReducer } from "@/utils/types";
import { useMfaEnforcement } from "@/Components/UI/MfaGate/useMfaEnforcement";

export type SetupStepKey = "secure" | "about" | "payouts" | "link" | "share";
export const SETUP_STEPS: SetupStepKey[] = ["secure", "about", "payouts", "link", "share"];

/** Session guards shared by the dashboard redirect and the wizard's "Do this later". */
export const GS_AUTO_OPEN_KEY = "gs_autoopen_seen";
export const GS_SUPPRESS_KEY = "dyno_suppress_onboarding";
/** A4: the Share step counts as done on the first copy / QR / share action, not only once money lands. */
const GS_SHARED_KEY = (companyId: number) => `dyno_gs_shared:${companyId}`;
const GS_SHARED_EVENT = "dynopay:gs-shared";

export const markLinkShared = (companyId?: number | null) => {
  if (typeof window === "undefined" || !companyId) return;
  window.localStorage.setItem(GS_SHARED_KEY(companyId), "1");
  window.dispatchEvent(new Event(GS_SHARED_EVENT));
};

const useHasShared = (companyId?: number) => {
  const [shared, setShared] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !companyId) return;
    const read = () => setShared(window.localStorage.getItem(GS_SHARED_KEY(companyId)) === "1");
    read();
    window.addEventListener(GS_SHARED_EVENT, read);
    return () => window.removeEventListener(GS_SHARED_EVENT, read);
  }, [companyId]);
  return shared;
};

export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
}

// Module-level dedupe so several mounted consumers only fetch links once per company.
let lastLinksFetch: { companyId: number; at: number } | null = null;

/**
 * Single source of truth for first-run progress, derived from REAL data
 * (account profile, payout wallets, payment links, dashboard stats).
 * Used by the /get-started wizard, the new-merchant dashboard hero and the
 * once-per-session first-run redirect so they can never disagree.
 */
export const useSetupProgress = () => {
  const dispatch = useDispatch();
  const companyState = useCompanyStore();
  const walletState = useWalletStore();
  const { account, hasAccount, profileComplete, isIndividual } = useAccountProfile();
  const payLinkState = useSelector((s: rootReducer) => s.paymentLinkReducer);
  const dashboardState = useSelector((s: rootReducer) => s.dashboardReducer);
  const { enforcement, settled: mfaSettled, refresh: refreshMfa } = useMfaEnforcement();
  const twoFaEnrolled = !!enforcement?.enrolled;

  const companyList = companyState.companyList ?? [];
  const companyId: number | undefined =
    companyState.selectedCompanyId || companyList[0]?.company_id || undefined;

  const walletList = walletState.walletList;
  const configuredWallets = useMemo(
    () =>
      (walletList ?? []).filter(
        (w: any) => Boolean(w?.wallet_address && String(w.wallet_address).trim().length > 0),
      ),
    [walletList],
  );
  const hasWallet = configuredWallets.length > 0;

  // The reducer is not company-keyed (two brand fetches can race), so scope
  // links to the selected brand here whenever the rows carry a company_id.
  const allLinks: any[] | undefined = payLinkState.paymentLinks;
  const paymentLinks = useMemo(
    () =>
      (allLinks ?? []).filter(
        (l) => !companyId || l?.company_id == null || Number(l.company_id) === Number(companyId),
      ),
    [allLinks, companyId],
  );
  const hasLink = paymentLinks.length > 0;
  const newestLink = paymentLinks[0] ?? null;

  const stats: any = dashboardState.stats;
  // Dashboard stats only exist after /dashboard has loaded; the wallet list
  // (fetched on every in-shell page) carries a per-wallet processed total, so
  // the sidebar ring can tell an established brand apart on ANY route.
  const walletProcessed = useMemo(
    () => (walletList ?? []).some((w: any) => Number(w?.amount_in_usd ?? 0) > 0),
    [walletList],
  );
  const hasPayment =
    Number(stats?.totalTransactions ?? 0) > 0 || Number(stats?.totalVolume ?? 0) > 0 || walletProcessed;
  const hasShared = useHasShared(companyId);

  useEffect(() => {
    if (!companyId || !hasAccount) return;
    const now = Date.now();
    if (lastLinksFetch && lastLinksFetch.companyId === companyId && now - lastLinksFetch.at < 10_000) {
      return;
    }
    lastLinksFetch = { companyId, at: now };
    dispatch(PaymentLinkAction(PAYLINK_FETCH, { company_id: companyId }));
  }, [companyId, hasAccount, dispatch]);

  const steps: SetupStep[] = useMemo(
    () => [
      { key: "secure", done: twoFaEnrolled },
      { key: "about", done: profileComplete },
      { key: "payouts", done: hasWallet },
      { key: "link", done: hasLink },
      { key: "share", done: hasPayment || (hasLink && hasShared) },
    ],
    [twoFaEnrolled, profileComplete, hasWallet, hasLink, hasPayment, hasShared],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const firstIncomplete: SetupStepKey = steps.find((s) => !s.done)?.key ?? "share";

  const coreReady = Boolean(companyState.fetched && walletState.fetched && mfaSettled);
  const linksSettled = Boolean(payLinkState.fetched) || (!hasAccount && coreReady);

  return {
    account,
    companyId,
    companyCount: companyList.length,
    hasAccount,
    isIndividual,
    profileComplete,
    twoFaEnrolled,
    refreshMfa,
    hasWallet,
    configuredWallets,
    hasLink,
    newestLink,
    hasPayment,
    hasShared,
    steps,
    doneCount,
    total: steps.length,
    firstIncomplete,
    coreReady,
    linksSettled,
    ready: coreReady && linksSettled,
  };
};

export type SetupProgress = ReturnType<typeof useSetupProgress>;
export default useSetupProgress;
