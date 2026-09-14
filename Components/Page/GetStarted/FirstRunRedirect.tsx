import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { GS_AUTO_OPEN_KEY, GS_SUPPRESS_KEY, useSetupProgress } from "./useSetupProgress";

/**
 * FirstRunRedirect — replaces the auto-popping CreateCompanyModal (plan 1.18).
 * A brand-new merchant (single auto-provisioned account, no payout wallet, no
 * payment link, no payment) is taken to the guided /get-started wizard ONCE per
 * session. Team members and invitees never see it; multi-brand owners get the
 * dashboard hero instead of a redirect.
 */
const FirstRunRedirect = (): null => {
  const router = useRouter();
  const { isMember } = useCompanyStore();
  const { ready, companyCount, hasWallet, hasLink, hasPayment } = useSetupProgress();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !ready || isMember) return;
    if (typeof window === "undefined") return;
    const ss = window.sessionStorage;
    if (ss.getItem(GS_SUPPRESS_KEY) === "1" || ss.getItem(GS_AUTO_OPEN_KEY) === "1") return;
    if (companyCount !== 1 || hasWallet || hasLink || hasPayment) return;
    fired.current = true;
    ss.setItem(GS_AUTO_OPEN_KEY, "1");
    trackOnboarding({ event_type: "checklist_shown", metadata: { surface: "wizard_autoopen" } });
    router.replace("/get-started");
  }, [ready, isMember, companyCount, hasWallet, hasLink, hasPayment, router]);

  return null;
};

export default FirstRunRedirect;
