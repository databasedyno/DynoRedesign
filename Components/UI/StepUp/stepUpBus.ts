/**
 * Step-up (sudo mode) event bus — lets the axios interceptor ask the UI to run a
 * verification without importing React. StepUpHost registers the handler once.
 */
export type StepUpScope = "apikey" | "wallet" | "brand_delete" | "security" | "payout" | "team" | "settlement";

type Handler = (scope: StepUpScope) => Promise<boolean>;

let handler: Handler | null = null;

export const registerStepUpHandler = (h: Handler): (() => void) => {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
};

/** Resolve true once the user verified for `scope`, false if they cancelled. */
export const requestStepUp = (scope: StepUpScope): Promise<boolean> =>
  handler ? handler(scope) : Promise.resolve(false);

export const isStepUpChallenge = (error: unknown): { scope: StepUpScope } | null => {
  const e = error as { response?: { status?: number; data?: { code?: string; scope?: string } } };
  if (e?.response?.status === 403 && e.response.data?.code === "STEPUP_REQUIRED") {
    return { scope: (e.response.data.scope || "security") as StepUpScope };
  }
  return null;
};

/** True when a request failed only because the user dismissed the step-up dialog. */
export const isStepUpCancelled = (error: unknown): boolean => !!(error as { stepUpCancelled?: boolean })?.stepUpCancelled;

// ---- session change notifications (verified / revoked) ----
export type StepUpSessionEvent = { scope: StepUpScope; active: boolean; expires_at: number | null };
type Listener = (e: StepUpSessionEvent) => void;
const listeners = new Set<Listener>();

export const subscribeStepUp = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const emitStepUpSession = (e: StepUpSessionEvent) => {
  Array.from(listeners).forEach((l) => l(e));
};
