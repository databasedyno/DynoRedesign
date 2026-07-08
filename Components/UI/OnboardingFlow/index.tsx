import { CompanyAction, WalletAction, PaymentLinkAction, DashboardAction } from "@/Redux/Actions";
import { COMPANY_FETCH } from "@/Redux/Actions/CompanyAction";
import { WALLET_FETCH } from "@/Redux/Actions/WalletAction";
import { PAYLINK_FETCH } from "@/Redux/Actions/PaymentLinkAction";
import { DASHBOARD_FETCH_ALL } from "@/Redux/Actions/DashboardAction";
import { rootReducer } from "@/utils/types";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import {
  BusinessRounded,
  AccountBalanceWalletRounded,
  LinkRounded,
  PaymentsRounded,
} from "@mui/icons-material";
import CreateCompanyModal from "./CreateCompanyModal";
import AddWalletModal from "@/Components/UI/AddWalletModal";
import CelebrationOverlay from "./CelebrationOverlay";
import StepIndicator from "./StepIndicator";
import OnboardingChecklist, { ChecklistStep } from "./OnboardingChecklist";
import { trackOnboarding } from "@/utils/trackOnboarding";

type ActiveModal = "company" | "wallet" | null;

// Per-session guard so the wizard doesn't auto-pop on every dashboard visit.
const AUTO_OPEN_SESSION_KEY = "onboarding_autoopen_seen";

/**
 * Onboarding orchestrator (non-blocking + resumable).
 *
 * - Renders a persistent checklist card (derived from real account data).
 * - Launches the company / wallet wizard modals from the checklist.
 * - Auto-opens the company step ONCE for brand-new users (closable).
 * - Surfaces "Create your first payment link" as the activation step.
 */
const OnboardingFlow: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [celebrate, setCelebrate] = useState(false);

  const autoOpened = useRef(false);
  const dismissed = useRef(false);
  const payLinkRequested = useRef(false);
  const dashboardRequested = useRef(false);
  const shownTracked = useRef(false);

  const companyState = useSelector((state: rootReducer) => state.companyReducer);
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const payLinkState = useSelector(
    (state: rootReducer) => state.paymentLinkReducer,
  );
  const dashboardState = useSelector(
    (state: rootReducer) => state.dashboardReducer,
  );

  const companyList = companyState.companyList ?? [];
  const walletList = walletState.walletList ?? [];
  const hasCompany = companyList.length > 0;
  // UX-2026-07-08: Only count wallets that ACTUALLY have an address set. The
  // walletReducer sometimes carries placeholder rows for supported chains
  // even when the user hasn't configured them yet — those must not falsely
  // mark the "Add payout wallet" step as complete.
  const hasWallet = walletList.some(
    (w: any) => Boolean(w?.wallet_address && String(w.wallet_address).trim().length > 0),
  );
  const hasLink = (payLinkState.paymentLinks?.length ?? 0) > 0;
  // "First payment received" milestone — derived from real dashboard stats.
  const dashboardFetched = Boolean(dashboardState.fetched);
  const hasPayment = (dashboardState.stats?.totalTransactions ?? 0) > 0;

  const companyId =
    companyState.selectedCompanyId || companyList?.[0]?.company_id;

  // Core readiness is derived from real Redux fetch flags (set on success OR
  // error). This avoids SSR hydration mismatches and fragile loading-timing refs.
  const coreReady = Boolean(companyState.fetched && walletState.fetched);
  const payLinkFetched = Boolean(payLinkState.fetched);

  // Initial fetch — skip if data was already loaded by the Client layout
  // (the saga debounce + cooldown guard will also prevent duplicate API calls)
  useEffect(() => {
    if (!companyState.fetched && !companyState.loading) {
      dispatch(CompanyAction(COMPANY_FETCH));
    }
    if (!walletState.fetched && !walletState.loading) {
      dispatch(WalletAction(WALLET_FETCH));
    }
  }, [dispatch, companyState.fetched, companyState.loading, walletState.fetched, walletState.loading]);

  // Restore the per-session auto-open guard (survives reloads within a session
  // so the wizard doesn't re-pop on every dashboard visit).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(AUTO_OPEN_SESSION_KEY) === "1") {
      autoOpened.current = true;
    }
  }, []);

  // Once a company exists, fetch payment links once to know if step 3 is done
  useEffect(() => {
    if (hasCompany && companyId && !payLinkRequested.current) {
      payLinkRequested.current = true;
      dispatch(PaymentLinkAction(PAYLINK_FETCH, { company_id: companyId }));
    }
  }, [hasCompany, companyId, dispatch]);

  // Once a payment link exists, fetch dashboard stats once so the "first
  // payment" milestone reflects reality (skip if the dashboard already loaded them).
  //
  // IMPORTANT: dispatch DASHBOARD_FETCH_ALL (not DASHBOARD_FETCH) — the saga
  // watches DASHBOARD_INIT with a 400ms debounce. If this fired AFTER
  // `useDashboardData` already dispatched DASHBOARD_FETCH_ALL, the two
  // dispatches would collapse and the LAST one (DASHBOARD_FETCH — stats only)
  // would win, silently dropping the parallel fetches for fee-tiers and
  // recent-transactions. That left the Recent Transactions widget empty.
  useEffect(() => {
    if (hasLink && !dashboardFetched && !dashboardRequested.current) {
      dashboardRequested.current = true;
      dispatch(
        DashboardAction(
          DASHBOARD_FETCH_ALL,
          companyId ? { company_id: companyId } : undefined,
        ),
      );
    }
  }, [hasLink, dashboardFetched, companyId, dispatch]);

  // Auto-open the company step ONCE per session for brand-new users (closable, non-blocking)
  useEffect(() => {
    if (autoOpened.current || dismissed.current) return;
    if (!coreReady) return;
    if (!hasCompany && !hasWallet && !activeModal && !celebrate) {
      autoOpened.current = true;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(AUTO_OPEN_SESSION_KEY, "1");
      }
      setActiveModal("company");
    }
  }, [coreReady, hasCompany, hasWallet, activeModal, celebrate]);

  // Company created -> refresh wallets and guide to wallet step
  const handleCompanyCreated = useCallback(() => {
    trackOnboarding({
      event_type: "step_completed",
      step_key: "company",
      completed_count: 1 + (hasWallet ? 1 : 0) + (hasLink ? 1 : 0),
    });
    dispatch(WalletAction(WALLET_FETCH, { force: true }));
    setActiveModal("wallet");
  }, [dispatch, hasWallet, hasLink]);

  // Wallet added -> refresh and celebrate
  const handleWalletAdded = useCallback(() => {
    trackOnboarding({
      event_type: "step_completed",
      step_key: "wallet",
      completed_count: (hasCompany ? 1 : 0) + 1 + (hasLink ? 1 : 0),
    });
    dispatch(WalletAction(WALLET_FETCH, { force: true }));
    setActiveModal(null);
    setCelebrate(true);
  }, [dispatch, hasCompany, hasLink]);

  const handleCelebrationDismiss = useCallback(() => {
    setCelebrate(false);
  }, []);

  // Closing a wizard modal should not re-trigger the auto-open this session
  const handleModalClose = useCallback(() => {
    trackOnboarding({ event_type: "dismissed", step_key: activeModal ?? undefined });
    dismissed.current = true;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(AUTO_OPEN_SESSION_KEY, "1");
    }
    setActiveModal(null);
  }, [activeModal]);

  const openCompany = useCallback(() => {
    trackOnboarding({ event_type: "step_clicked", step_key: "company" });
    setActiveModal("company");
  }, []);
  const openWallet = useCallback(() => {
    trackOnboarding({ event_type: "step_clicked", step_key: "wallet" });
    // wallet requires a company first
    if (!hasCompany) setActiveModal("company");
    else setActiveModal("wallet");
  }, [hasCompany]);
  const openFirstLink = useCallback(() => {
    trackOnboarding({ event_type: "step_clicked", step_key: "link" });
    // UX-2026-07-08: previously we blocked navigation until company + wallet
    // existed. That kills momentum — users lose the "aha" of seeing the link
    // form. Now we ALWAYS navigate to /create-pay-link; the page itself shows
    // an "Activate before accepting real payments" banner + gates the Save
    // action for users missing the prerequisites.
    router.push("/create-pay-link");
  }, [router]);

  const openFirstPayment = useCallback(() => {
    trackOnboarding({ event_type: "step_clicked", step_key: "payment" });
    if (!hasCompany) setActiveModal("company");
    else if (!hasWallet) setActiveModal("wallet");
    else if (!hasLink) router.push("/create-pay-link");
    else router.push("/pay-links");
  }, [hasCompany, hasWallet, hasLink, router]);

  const steps: ChecklistStep[] = useMemo(
    () => [
      {
        key: "company",
        label: t("obCompanyLabel"),
        description: t("obCompanyDesc"),
        icon: BusinessRounded,
        done: hasCompany,
        onClick: openCompany,
      },
      {
        key: "wallet",
        label: t("obWalletLabel"),
        description: t("obWalletDesc"),
        icon: AccountBalanceWalletRounded,
        done: hasWallet,
        onClick: openWallet,
      },
      {
        key: "link",
        label: t("obLinkLabel"),
        description: t("obLinkDesc"),
        icon: LinkRounded,
        done: hasLink,
        onClick: openFirstLink,
      },
      {
        key: "payment",
        label: t("obPaymentLabel"),
        description: t("obPaymentDesc"),
        icon: PaymentsRounded,
        done: hasPayment,
        onClick: openFirstPayment,
      },
    ],
    [hasCompany, hasWallet, hasLink, hasPayment, openCompany, openWallet, openFirstLink, openFirstPayment, t],
  );

  // Decide whether to show the checklist card
  const allCoreDone = hasCompany && hasWallet;
  let showChecklist = false;
  if (coreReady) {
    if (!allCoreDone) {
      showChecklist = true;
    } else if (payLinkFetched && !hasLink) {
      // company + wallet done, but no payment link yet
      showChecklist = true;
    } else if (hasLink && dashboardFetched && !hasPayment) {
      // everything set up, but no payment received yet — nudge to first payment
      showChecklist = true;
    }
  }

  // Track that the checklist was shown (deduped server-side per user/6h)
  useEffect(() => {
    if (showChecklist && !shownTracked.current) {
      shownTracked.current = true;
      trackOnboarding({
        event_type: "checklist_shown",
        completed_count:
          (hasCompany ? 1 : 0) + (hasWallet ? 1 : 0) + (hasLink ? 1 : 0),
      });
    }
  }, [showChecklist, hasCompany, hasWallet, hasLink]);

  return (
    <>
      {showChecklist && <OnboardingChecklist steps={steps} />}

      <CreateCompanyModal
        open={activeModal === "company"}
        onSuccess={handleCompanyCreated}
        onClose={handleModalClose}
      />

      <AddWalletModal
        open={activeModal === "wallet"}
        onClose={handleModalClose}
        onWalletAdded={handleWalletAdded}
        headerExtra={<StepIndicator currentStep={2} totalSteps={2} />}
      />

      <CelebrationOverlay
        open={celebrate}
        onDismiss={handleCelebrationDismiss}
      />
    </>
  );
};

export default OnboardingFlow;
