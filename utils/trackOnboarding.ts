import axiosBaseApi from "@/axiosConfig";

export type OnboardingEventType =
  | "checklist_shown"
  | "step_clicked"
  | "step_completed"
  | "dismissed"
  | "collapsed"
  | "expanded";

export type OnboardingStepKey = "company" | "wallet" | "link" | "payment";

export interface OnboardingEventPayload {
  event_type: OnboardingEventType;
  step_key?: OnboardingStepKey;
  completed_count?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget onboarding analytics event. Never throws and never blocks UI.
 * Only sends for authenticated users (the backend ties events to user_id).
 */
export const trackOnboarding = (payload: OnboardingEventPayload): void => {
  try {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("token")) return;
    axiosBaseApi.post("track/onboarding", payload).catch(() => {});
  } catch {
    /* analytics must never break the app */
  }
};
