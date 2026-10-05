import { useEffect } from "react";

/**
 * Reliably drops the caret into a code / OTP field the instant it appears —
 * even inside MUI Dialogs / Modals, whose open transition + focus-trap would
 * otherwise swallow a single `requestAnimationFrame` focus() call (leaving the
 * user to click the box before they can type).
 *
 * It fires immediately, then re-asserts focus a few times across the dialog's
 * open-transition window. The later attempts are "gentle": they NEVER steal
 * focus if the user has already clicked into one of the fields.
 *
 * @param trigger     value that changes when the field becomes visible
 *                    (e.g. the dialog `open` flag, a `resetKey`, or the mode)
 * @param getTargets  returns the focusable element(s); the first present one
 *                    is focused. Return `null` to skip (e.g. field not mounted).
 */
export default function useAutoFocusField(
  trigger: unknown,
  getTargets: () => Array<HTMLElement | null> | HTMLElement | null,
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const resolve = (): HTMLElement[] => {
      const r = getTargets();
      return (Array.isArray(r) ? r : [r]).filter(
        (el): el is HTMLElement => !!el,
      );
    };

    const focusTarget = (respectUser: boolean) => {
      if (cancelled) return;
      const els = resolve();
      if (els.length === 0) return;
      const active = document.activeElement;
      // Don't yank focus back once the user is already typing in a field.
      if (respectUser && els.some((el) => el === active)) return;
      const target = els[0];
      if (active === target) return;
      target.focus();
      try {
        (target as HTMLInputElement).select?.();
      } catch {
        /* target isn't a text input — focus() is enough */
      }
    };

    // Assert early (before the user could type), then re-assert gently after
    // the transition + focus-trap settle.
    const raf = window.requestAnimationFrame(() => focusTarget(false));
    const t1 = window.setTimeout(() => focusTarget(false), 60);
    const t2 = window.setTimeout(() => focusTarget(true), 200);
    const t3 = window.setTimeout(() => focusTarget(true), 400);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}
