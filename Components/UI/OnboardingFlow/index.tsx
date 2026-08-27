import { useCompanyStore } from "@/contexts/CompanyDataContext";
import useAccountProfile from "@/hooks/useAccountProfile";
import { useWalletStore } from "@/contexts/WalletDataContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { usePaymentLinks } from "@/hooks/usePaymentLinks";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [celebrate, setCelebrate] = useState(false);

  const autoOpened = useRef(false);
  const dismissed = useRef(false);
  const shownTracked = useRef(false);

  const companyState = useCompanyStore();
  const walletState = useWalletStore();
  // Payment links now flow through SWR (keyed on the selected company); auto-
  // fetches on mount here (dashboard), so no manual PAYLINK_FETCH dispatch.
  const payLinkState = usePaymentLinks();
  // Dashboard stats now flow through SWR (keyed on the selected company); this
  // hook auto-fetches on mount, so no manual DASHBOARD_FETCH_ALL trigger.
  const { stats: dashboardStats } = useDashboardData();

  const companyList = companyState.companyList ?? [];
  const walletList = walletState.walletList ?? [];
  // An Account row is auto-provisioned at signup, so its EXISTENCE says nothing
  // about onboarding. `profileComplete` (name + country) is the real signal —
  // without a country, invoices and VAT reporting are wrong.
  const { hasAccount, profileComplete, isIndividual } = useAccountProfile();
  // UX-2026-07-08: Only count wallets that ACTUALLY have an address set. The
  // walletReducer sometimes carries placeholder rows for supported chains
  // even when the user hasn't configured them yet — those must not falsely
  // mark the "Add payout wallet" step as complete.
  const hasWallet = walletList.some(
    (w: any) => Boolean(w?.wallet_address && String(w.wallet_address).trim().length > 0),
  );
  const hasLink = (payLinkState.paymentLinks?.length ?? 0) > 0;
  // "First payment received" milestone — derived from real dashboard stats.
  // NOTE: mirrors the old redux `dashboardReducer.fetched`, which was never set
  // to true, so this stays false — behaviour preserved during the SWR migration.
  const dashboardFetched = false;
  const hasPayment = (dashboardStats?.totalTransactions ?? 0) > 0;

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
      companyState.refetchCompanies();
    }
    if (!walletState.fetched && !walletState.loading) {
      walletState.refetchWallets();
    }
  }, [companyState, walletState]);

  // Restore the per-session auto-open guard (survives reloads within a session
  // so the wizard doesn't re-pop on every dashboard visit).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(AUTO_OPEN_SESSION_KEY) === "1") {
      autoOpened.current = true;
    }
  }, []);

  // Payment links load automatically via usePaymentLinks() above (SWR, keyed on
  // the selected company), so we always know if the "first link" step is done —
  // no manual fetch trigger needed.

  // Auto-open the company step ONCE per session for brand-new users (closable, non-blocking)
  useEffect(() => {
    if (autoOpened.current || dismissed.current) return;
    if (!coreReady) return;
    if (!hasAccount && !hasWallet && !activeModal && !celebrate) {
      autoOpened.current = true;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(AUTO_OPEN_SESSION_KEY, "1");
      }
      setActiveModal("company");
    }
  }, [coreReady, hasAccount, hasWallet, activeModal, celebrate]);

  // Company created -> refresh wallets and guide to wallet step
  const handleCompanyCreated = useCallback(() => {
    trackOnboarding({
      event_type: "step_completed",
      step_key: "company",
      completed_count: 1 + (hasWallet ? 1 : 0) + (hasLink ? 1 : 0),
    });
    walletState.refetchWallets();
    setActiveModal("wallet");
  }, [walletState, hasWallet, hasLink]);

  // Wallet added -> refresh and celebrate
  const handleWalletAdded = useCallback(() => {
    trackOnboarding({
      event_type: "step_completed",
      step_key: "wallet",
      completed_count: (profileComplete ? 1 : 0) + 1 + (hasLink ? 1 : 0),
    });
    walletState.refetchWallets();
    setActiveModal(null);
    setCelebrate(true);
  }, [walletState, profileComplete, hasLink]);

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
    // With an Account already provisioned there is nothing to CREATE — the
    // merchant just needs to fill in the missing details, which live in Settings.
    if (hasAccount) router.push("/settings?section=company");
    else setActiveModal("company");
  }, [hasAccount, router]);
  const openWallet = useCallback(() => {
    trackOnboarding({ event_type: "step_clicked", step_key: "wallet" });
    // wallet requires an account first
    if (!hasAccount) setActiveModal("company");
    else setActiveModal("wallet");
  }, [hasAccount]);
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
    if (!hasAccount) setActiveModal("company");
    else if (!hasWallet) setActiveModal("wallet");
    else if (!hasLink) router.push("/create-pay-link");
    else router.push("/pay-links");
  }, [hasAccount, hasWallet, hasLink, router]);

  const steps: ChecklistStep[] = useMemo(
    () => [
      {
        key: "company",
        label: !hasAccount
          ? t("obCompanyLabel")
          : isIndividual
            ? t("obAccountLabel", { defaultValue: "Complete your account details" })
            : t("obBusinessProfileLabel", {
                defaultValue: "Complete your business profile",
              }),
        description: !hasAccount
          ? t("obCompanyDesc")
          : isIndividual
            ? t("obAccountDesc", {
                defaultValue: "Add your country so invoices and tax are correct.",
              })
            : t("obBusinessProfileDesc", {
                defaultValue:
                  "Add your country and address so invoices and VAT are correct.",
              }),
        icon: BusinessRounded,
        done: profileComplete,
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
    [profileComplete, hasAccount, isIndividual, hasWallet, hasLink, hasPayment, openCompany, openWallet, openFirstLink, openFirstPayment, t],
  );

  // Decide whether to show the checklist card
  const allCoreDone = profileComplete && hasWallet;
  let showChecklist = false;
  // Two guards:
  //  • A merchant who has already been paid is past onboarding — an incomplete
  //    account detail is nudged by the header warning, not by a card.
  //  • Once an account + wallet exist, the 2026 dashboard's own Activation
  //    checklist owns that state, so this legacy card must stand down or the
  //    merchant sees two competing checklists.
  if (coreReady && !hasPayment && !(hasAccount && hasWallet)) {
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
          (profileComplete ? 1 : 0) + (hasWallet ? 1 : 0) + (hasLink ? 1 : 0),
      });
    }
  }, [showChecklist, profileComplete, hasWallet, hasLink]);

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
