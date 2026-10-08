import { useCallback, useEffect, useRef } from "react";

/**
 * Back gesture / browser back closes the open overlay instead of leaving the
 * page (UX audit S11). Opening pushes a history entry that copies the current
 * Next.js state; Back pops it and closes the overlay. `installOverlayPopGuard`
 * (ClientLayout) tells the Next router to ignore those pops.
 */
const openOverlays: string[] = [];

export const hasOpenOverlay = (): boolean => openOverlays.length > 0;

export default function useBackToClose(open: boolean, onClose: () => void, key = "overlay") {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const releasedRef = useRef(false);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const marker = `${key}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    releasedRef.current = false;
    window.history.pushState({ ...(window.history.state || {}), __overlay: marker }, "");
    openOverlays.push(marker);
    let popped = false;
    const onPop = () => {
      if (popped) return;
      popped = true;
      const i = openOverlays.lastIndexOf(marker);
      if (i >= 0) openOverlays.splice(i, 1);
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (popped) return;
      const i = openOverlays.lastIndexOf(marker);
      if (i >= 0) openOverlays.splice(i, 1);
      if (releasedRef.current) return;
      if (window.history.state?.__overlay === marker) {
        // Closed by the UI: drop our entry, and swallow that pop in the router.
        openOverlays.push(`${marker}:closing`);
        const done = () => {
          const j = openOverlays.indexOf(`${marker}:closing`);
          if (j >= 0) openOverlays.splice(j, 1);
          window.removeEventListener("popstate", done);
        };
        window.addEventListener("popstate", done);
        window.history.back();
      }
    };
  }, [open, key]);

  /** Call before navigating from inside the overlay (pair with router.replace). */
  return useCallback(() => {
    releasedRef.current = true;
  }, []);
}
