import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { trackOnboarding } from "@/utils/trackOnboarding";
import { GS_AUTO_OPEN_KEY, GS_LATER_COOLDOWN_KEY, GS_SUPPRESS_KEY, useSetupProgress } from "./useSetupProgress";

/**
 * FirstRunRedirect — replaces the auto-popping CreateCompanyModal (plan 1.18).
 * The owner of a single brand that is still SETTING UP (any of the 5 steps
 * undone, no live payment yet) is taken to the guided /get-started wizard on
 * landing — this is what makes "Save & exit setup" (= sign out) resume on the
 * next login, on any device. Soft gate: only this landing route redirects;
 * typed URLs stay reachable. Once per tab-session, and never while the 24h
 * "Do this later" snooze is active. Team members / invitees and multi-brand
 * owners never see it; they get the dashboard hero instead.
 */
const FirstRunRedirect = (): null => {
  const router = useRouter();
  const { isMember } = useCompanyStore();
  const { ready, companyCount, brandPhase, isSafeDealBrand } = useSetupProgress();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !ready || isMember) return;
    if (typeof window === "undefined") return;
    const ss = window.sessionStorage;
    if (ss.getItem(GS_SUPPRESS_KEY) === "1" || ss.getItem(GS_AUTO_OPEN_KEY) === "1") return;
    // H: respect the 24h cross-session cooldown set by the wizard's "Do this later".
    try {
      const until = Number(window.localStorage.getItem(GS_LATER_COOLDOWN_KEY) || 0);
      if (until && Date.now() < until) return;
    } catch { /* noop */ }
    if (companyCount !== 1 || brandPhase !== "setup" || isSafeDealBrand) return;
    fired.current = true;
    ss.setItem(GS_AUTO_OPEN_KEY, "1");
    trackOnboarding({ event_type: "checklist_shown", metadata: { surface: "wizard_autoopen" } });
    router.replace("/get-started");
  }, [ready, isMember, companyCount, brandPhase, isSafeDealBrand, router]);

  return null;
};

export default FirstRunRedirect;
