import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStepUpStatus, revokeStepUp } from "./stepUpApi";
import { emitStepUpSession, requestStepUp, StepUpScope, subscribeStepUp } from "./stepUpBus";

export const STEP_UP_DEFAULT_TTL = 600;

/**
 * Tracks the step-up session for `scope` while `open` is true. On open it checks
 * the server session and, when locked, immediately raises the shared dialog;
 * `onCancelled` fires if the user dismisses it. Stays in sync with sessions
 * unlocked elsewhere (e.g. by the axios interceptor's auto-retry).
 */
export function useStepUpSession(scope: StepUpScope, open: boolean, onCancelled?: () => void) {
  const [checking, setChecking] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [totalSecs, setTotalSecs] = useState(STEP_UP_DEFAULT_TTL);
  const onCancelledRef = useRef(onCancelled);
  onCancelledRef.current = onCancelled;

  useEffect(() => {
    if (!open) {
      setExpiresAt(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    (async () => {
      try {
        const s = await fetchStepUpStatus(scope);
        if (cancelled) return;
        if (s.active && s.expires_at) {
          setExpiresAt(s.expires_at);
          setTotalSecs(Math.max(s.ttl_seconds || STEP_UP_DEFAULT_TTL, Math.round((s.expires_at - Date.now()) / 1000)));
          return;
        }
        setChecking(false);
        const ok = await requestStepUp(scope);
        if (!cancelled && !ok) onCancelledRef.current?.();
      } catch {
        if (!cancelled) onCancelledRef.current?.();
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, scope]);

  useEffect(
    () =>
      subscribeStepUp((e) => {
        if (e.scope !== scope) return;
        setExpiresAt(e.active ? e.expires_at : null);
        if (e.active) setTotalSecs(STEP_UP_DEFAULT_TTL);
      }),
    [scope],
  );

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) setExpiresAt(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const lockNow = useCallback(async () => {
    try {
      await revokeStepUp(scope);
    } catch {
      /* best-effort */
    }
    setExpiresAt(null);
    emitStepUpSession({ scope, active: false, expires_at: null });
  }, [scope]);

  const unlock = useCallback(() => requestStepUp(scope), [scope]);

  const active = expiresAt !== null && expiresAt > Date.now();
  return { checking, active, remaining, totalSecs, lowTime: active && remaining <= 120, lockNow, unlock };
}

export default useStepUpSession;
