import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaPlatform = "android" | "ios" | "other";

/** True when the page runs as an installed home-screen app (iOS + Android/desktop). */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function detectPwaPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const ipadOs = navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || ipadOs) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const DISMISS_DAYS = 30;
const MIN_VISITS = 2;

/**
 * Add-to-home-screen state for one brand (`storageKey` namespaces the dismissal + visit counter).
 * Android/Chrome: captures `beforeinstallprompt` so we can open the native sheet from our own button.
 * iOS: no API — we surface the Share → "Add to Home Screen" hint instead.
 * Shown from the 2nd visit onwards, never inside an installed app, snoozed 30 days on dismiss.
 */
export function usePwaInstall(storageKey: string) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<PwaPlatform>("other");
  const [standalone, setStandalone] = useState(true);
  const [snoozed, setSnoozed] = useState(true);
  const [visits, setVisits] = useState(0);

  useEffect(() => {
    setStandalone(isStandaloneApp());
    setPlatform(detectPwaPlatform());
    try {
      const until = Number(localStorage.getItem(`${storageKey}:snooze`) || 0);
      setSnoozed(until > Date.now());
      const visitsKey = `${storageKey}:visits`;
      let n = Number(localStorage.getItem(visitsKey) || 0);
      if (!sessionStorage.getItem(visitsKey)) {
        n += 1;
        localStorage.setItem(visitsKey, String(n));
        sessionStorage.setItem(visitsKey, "1");
      }
      setVisits(n);
    } catch {
      setSnoozed(false);
      setVisits(MIN_VISITS);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __bipEvent?: Event }).__bipEvent = e;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      (window as unknown as { __bipEvent?: Event | null }).__bipEvent = null;
      setDeferred(null);
      setStandalone(true);
    };
    // Seed from the event captured in _document before this hook mounted (Chrome
    // fires beforeinstallprompt once, early — it is otherwise lost on late mounts).
    const early = (window as unknown as { __bipEvent?: Event | null }).__bipEvent;
    if (early) setDeferred(early as BeforeInstallPromptEvent);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [storageKey]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(`${storageKey}:snooze`, String(Date.now() + DISMISS_DAYS * 86400000));
    } catch { /* snooze persistence is best-effort */ }
    setSnoozed(true);
  }, [storageKey]);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    (window as unknown as { __bipEvent?: Event | null }).__bipEvent = null;
    setDeferred(null);
    if (outcome !== "accepted") dismiss();
    return outcome === "accepted";
  }, [deferred, dismiss]);

  const canPrompt = !!deferred;
  const eligible = !standalone && !snoozed && visits >= MIN_VISITS && (canPrompt || platform === "ios");
  return { eligible, canPrompt, platform, standalone, install, dismiss };
}

export default usePwaInstall;
