import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import useAccountProfile from "@/hooks/useAccountProfile";
import { PaymentLinkAction, PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { ApiAction, API_FETCH } from "@/Redux/Actions/ApiAction";
import { UserAction, USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import { useMfaEnforcement } from "@/Components/UI/MfaGate/useMfaEnforcement";
import { isSafeDealBrandId } from "@/helpers/safedealBrand";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";

export type SetupStepKey = "secure" | "about" | "payouts" | "link" | "share";
export const SETUP_STEPS: SetupStepKey[] = ["secure", "about", "payouts", "link", "share"];

/**
 * Which flavour of the 5-step setup a user gets (2026-10-01, extended for all
 * four signup verticals). Steps 1–3 (secure → about → payouts) are shared; the
 * last two swap per track so the vocabulary matches the pill the user picked:
 *   default     → first payment link → share it
 *   developers  → API key           → test payment
 *   creators    → claim @handle     → share your page
 *   fundraisers → first campaign    → share your campaign
 * Creators/fundraisers used to skip the wizard entirely (landing on a surface
 * they couldn't fully use) and never set up 2FA, a payout wallet or their first
 * artefact. Same step keys everywhere, so routing/analytics/progress stay shared.
 */
export type SetupTrack = "default" | "developers" | "creators" | "fundraisers";
const TRACK_VERTICALS = ["developers", "creators", "fundraisers"] as const;
export const PURPOSE_VERTICAL_KEY = "dyno_purpose_vertical";

/** Any success-like transaction status counts as "a payment received" (source-agnostic). */
const SETTLED_TX_STATUSES = ["confirmed", "completed", "settled", "success", "successful", "paid", "done"];

/** Session guards shared by the dashboard redirect and the wizard's "Do this later". */
export const GS_AUTO_OPEN_KEY = "gs_autoopen_seen";
export const GS_SUPPRESS_KEY = "dyno_suppress_onboarding";
/** H: after "Do this later", stop auto-redirecting into the wizard for 24h ACROSS sessions. */
export const GS_LATER_COOLDOWN_KEY = "dyno_gs_later_until";
export const GS_LATER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** A4: the Share step counts as done on the first copy / QR / share action, not only once money lands. */
const GS_SHARED_KEY = (companyId: number) => `dyno_gs_shared:${companyId}`;
const GS_SHARED_EVENT = "dynopay:gs-shared";
/** Developer track: step 5 counts as done once a sandbox payment was simulated to settled. */
const GS_TESTPAID_KEY = (companyId: number) => `dyno_gs_testpaid:${companyId}`;
const GS_TESTPAID_EVENT = "dynopay:gs-testpaid";

export const markTestPaymentDone = (companyId?: number | null) => {
  if (typeof window === "undefined" || !companyId) return;
  try {
    window.localStorage.setItem(GS_TESTPAID_KEY(companyId), "1");
  } catch { /* noop */ }
  window.dispatchEvent(new Event(GS_TESTPAID_EVENT));
};

const useHasTestPayment = (companyId?: number) => {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !companyId) return;
    const read = () => {
      try {
        setDone(window.localStorage.getItem(GS_TESTPAID_KEY(companyId)) === "1");
      } catch {
        setDone(false);
      }
    };
    read();
    window.addEventListener(GS_TESTPAID_EVENT, read);
    return () => window.removeEventListener(GS_TESTPAID_EVENT, read);
  }, [companyId]);
  return done;
};

/** Stored purpose pick (PurposePicker writes it at signup) — fallback until the profile loads. */
const useStoredVertical = () => {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => {
    try {
      setV(window.localStorage.getItem(PURPOSE_VERTICAL_KEY));
    } catch {
      setV(null);
    }
  }, []);
  return v;
};

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
// Same for the developer track's API-key probe + the one-off profile fetch.
let lastKeysFetch: { companyId: number; at: number } | null = null;
let profileRequested = false;

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
  const userProfile: any = useSelector((s: rootReducer) => (s.userReducer as any)?.profile);
  const apiState = useSelector((s: rootReducer) => s.apiReducer);
  const storedVertical = useStoredVertical();
  // Creator track: the @handle lives on the per-company storefront profile
  // (not the generic user profile). SWR-deduped, so this is shared with the
  // storefront pages and adds at most one lightweight GET elsewhere.
  const { profile: storefrontProfile } = useStorefrontProfile();

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

  // Fundraiser track: a "campaign" is a donation-type payment link.
  const campaignLinks = useMemo(
    () => paymentLinks.filter((l) => String(l?.link_type ?? "") === "donation"),
    [paymentLinks],
  );
  const hasCampaign = campaignLinks.length > 0;
  const newestCampaign = campaignLinks[0] ?? null;

  // Creator track: the reserved public @handle (storefront profile).
  const handle: string | null = (storefrontProfile?.handle as string | null) ?? null;
  const hasHandle = Boolean(handle && String(handle).trim().length > 0);

  const stats: any = dashboardState.stats;
  // Dashboard stats only exist after /dashboard has loaded; the wallet list
  // (fetched on every in-shell page) carries a per-wallet processed total, so
  // the sidebar ring can tell an established brand apart on ANY route.
  const walletProcessed = useMemo(
    () => (walletList ?? []).some((w: any) => Number(w?.amount_in_usd ?? 0) > 0),
    [walletList],
  );
  // "A payment is a payment" — any settled transaction, regardless of how it
  // arrived (payment link, API, product order, donation, tip…), graduates the
  // brand out of onboarding. recentTransactions carries the raw status per row.
  const recentSettled = useMemo(
    () =>
      ((dashboardState.recentTransactions as any[]) ?? []).some((tx) =>
        SETTLED_TX_STATUSES.includes(String(tx?.status || "").toLowerCase()),
      ),
    [dashboardState.recentTransactions],
  );
  const hasPayment =
    Number(stats?.totalTransactions ?? 0) > 0 ||
    Number(stats?.totalVolume ?? 0) > 0 ||
    walletProcessed ||
    recentSettled;
  const hasShared = useHasShared(companyId);
  const hasTestPayment = useHasTestPayment(companyId);

  // ── Track: the signup purpose decides the last two steps ───────────────
  // The persisted tbl_user.purpose_vertical wins once the profile is loaded;
  // until then the purpose picked on this browser at signup is used.
  const profileLoaded = Boolean(userProfile?.user_id);
  const vertical: string | null = profileLoaded ? (userProfile?.purpose_vertical ?? null) : storedVertical;
  const track: SetupTrack = (TRACK_VERTICALS as readonly string[]).includes(vertical ?? "")
    ? (vertical as SetupTrack)
    : "default";

  useEffect(() => {
    if (profileLoaded || profileRequested || !hasAccount) return;
    profileRequested = true;
    dispatch(UserAction(USER_PROFILE_FETCH));
  }, [profileLoaded, hasAccount, dispatch]);

  // Developer track only: does this brand have an active API key (sandbox or live)?
  useEffect(() => {
    if (track !== "developers" || !companyId || !hasAccount) return;
    const now = Date.now();
    if (lastKeysFetch && lastKeysFetch.companyId === companyId && now - lastKeysFetch.at < 10_000) return;
    lastKeysFetch = { companyId, at: now };
    dispatch(ApiAction(API_FETCH, { company_id: companyId }));
  }, [track, companyId, hasAccount, dispatch]);

  const activeKeys = useMemo(
    () =>
      ((apiState?.apiList as any[]) ?? []).filter(
        (k) =>
          k?.status === "active" &&
          (!companyId || k?.company_id == null || Number(k.company_id) === Number(companyId)),
      ),
    [apiState?.apiList, companyId],
  );
  const hasApiKey = activeKeys.length > 0;
  const hasTestKey = activeKeys.some((k) => k?.environment === "development");

  useEffect(() => {
    if (!companyId || !hasAccount) return;
    const now = Date.now();
    if (lastLinksFetch && lastLinksFetch.companyId === companyId && now - lastLinksFetch.at < 10_000) {
      return;
    }
    lastLinksFetch = { companyId, at: now };
    dispatch(PaymentLinkAction(PAYLINK_FETCH, { company_id: companyId }));
  }, [companyId, hasAccount, dispatch]);

  const step4and5 = (): [SetupStep, SetupStep] => {
    switch (track) {
      case "developers":
        return [
          { key: "link", done: hasApiKey },
          { key: "share", done: hasPayment || hasTestPayment },
        ];
      case "creators":
        return [
          { key: "link", done: hasHandle },
          { key: "share", done: hasPayment || (hasHandle && hasShared) },
        ];
      case "fundraisers":
        return [
          { key: "link", done: hasCampaign },
          { key: "share", done: hasPayment || (hasCampaign && hasShared) },
        ];
      default:
        return [
          { key: "link", done: hasLink },
          { key: "share", done: hasPayment || (hasLink && hasShared) },
        ];
    }
  };

  const steps: SetupStep[] = useMemo(
    () => [
      { key: "secure", done: twoFaEnrolled },
      { key: "about", done: profileComplete },
      { key: "payouts", done: hasWallet },
      ...step4and5(),
    ],
    [twoFaEnrolled, profileComplete, hasWallet, hasLink, hasPayment, hasShared, track, hasApiKey, hasTestPayment, hasHandle, hasCampaign],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const firstIncomplete: SetupStepKey = steps.find((s) => !s.done)?.key ?? "share";

  // The SafeDeal operator brand is an escrow product, not a payment-links
  // merchant — its onboarding checklist never applies (its activity lives in
  // the escrow ledger, not the merchant payment stats).
  const isSafeDealBrand = isSafeDealBrandId(companyId);

  const coreReady = Boolean(companyState.fetched && walletState.fetched && mfaSettled);
  const linksSettled = Boolean(payLinkState.fetched) || (!hasAccount && coreReady);
  // Developer track also waits for the key list so step 4 doesn't flash "to do".
  const keysSettled = track !== "developers" || Boolean(apiState?.fetched) || (!hasAccount && coreReady);
  // Creator track waits for the storefront profile so step 4 (claim @handle)
  // resumes correctly instead of flashing "to do" for someone who already has one.
  const handleSettled = track !== "creators" || storefrontProfile !== undefined || (!hasAccount && coreReady);

  // ── Three brand states (UX 2026-10) ──────────────────────────────────────
  // setup  : still working through the 5 steps
  // waiting: all 5 steps done but no live payment yet (dev = sandbox settled)
  // live   : first settled payment landed
  // `onboardingActive` is the single signal the global chrome (fee-free modal /
  // banner, header nudge chips) uses to stand down while a brand-new brand is
  // being set up, so the dashboard isn't buried under a competing CTA stack.
  const onboardingActive = coreReady && !hasPayment && !isSafeDealBrand && Boolean(companyId);
  const brandPhase: "setup" | "waiting" | "live" = hasPayment
    ? "live"
    : doneCount >= steps.length
      ? "waiting"
      : "setup";

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
    hasCampaign,
    newestCampaign,
    hasHandle,
    handle,
    hasPayment,
    hasShared,
    track,
    hasApiKey,
    hasTestKey,
    hasTestPayment,
    isSafeDealBrand,
    steps,
    doneCount,
    total: steps.length,
    firstIncomplete,
    coreReady,
    onboardingActive,
    brandPhase,
    linksSettled,
    ready: coreReady && linksSettled && keysSettled && handleSettled,
  };
};

export type SetupProgress = ReturnType<typeof useSetupProgress>;
export default useSetupProgress;
