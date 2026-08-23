'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import {
  getRouteContext,
  getDefaultThemeForContext,
  getStorageKeyForContext,
  getCookieNameForContext,
  getDefaultThemeForPath,
  isAuthPath,
  isHelpSupportPath,
  type ThemeMode,
  type ThemeContext as ThemeCtxKind,
} from '@/utils/theme/routeContext';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
  /** Which context ("inapp" | "public") is currently active for this route. */
  routeContext: ThemeCtxKind;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Apply theme side-effects BEFORE the browser paints on the client (prevents
// a one-frame flash); fall back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Persist the preference to the context-scoped cookie so the server can
 *  render the correct theme on the next request. */
function writeThemeCookie(ctx: ThemeCtxKind, mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  try {
    const name = getCookieNameForContext(ctx);
    document.cookie = `${name}=${mode}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

/** Resolve the current context from window.location. Safe to call in effects. */
function currentRouteContext(): ThemeCtxKind {
  if (typeof window === 'undefined') return 'public';
  return getRouteContext(window.location.pathname);
}

/** Read a cookie value by name (client only). Used as a fallback signal for
 *  the merchant's in-app theme on /help-support, since a default-DARK merchant
 *  who never manually toggled has no `theme-mode-inapp` in localStorage but
 *  DOES have the cookie (written on every in-app page visit). */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const m = document.cookie.match(
      new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]+)'),
    );
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/** Read the merchant's in-app theme preference from localStorage first, then
 *  the cookie fallback. Returns null when there is no in-app signal at all
 *  (e.g. a first-time visitor who has never opened the dashboard). */
function readInappPreference(): ThemeMode | null {
  try {
    const ls = typeof window !== 'undefined'
      ? window.localStorage.getItem('theme-mode-inapp')
      : null;
    if (ls === 'light' || ls === 'dark') return ls;
  } catch {
    /* ignore */
  }
  const ck = readCookie('theme-mode-inapp');
  if (ck === 'light' || ck === 'dark') return ck;
  return null;
}

/** Read the preferred mode for a context — localStorage first, else route default.
 *  Auth paths additionally inherit an explicit in-app DARK preference when
 *  they don't have their own public preference stored yet, so a merchant
 *  who's chosen dark on the dashboard doesn't get a jarring white flash
 *  when clicking a link back to the login card. */
function readPreferredMode(ctx: ThemeCtxKind, pathname?: string): ThemeMode {
  if (typeof window === 'undefined') return getDefaultThemeForContext(ctx);
  const resolvedPath = pathname ?? window.location.pathname;
  // Help & Support (dual-purpose): FOLLOW the in-app theme preference so a
  // signed-in merchant on dark keeps dark instead of flipping to light, but
  // fall back to the LIGHT public default for first-time / logged-out visitors
  // (who have no in-app signal at all).
  if (isHelpSupportPath(resolvedPath)) {
    const inapp = readInappPreference();
    if (inapp) return inapp;
    return getDefaultThemeForPath(resolvedPath); // light
  }
  try {
    const key = getStorageKeyForContext(ctx);
    const saved = window.localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') return saved;
    // Auth-path inheritance (Public Auth Card feature, 2025-07 pass).
    if (ctx === 'public' && isAuthPath(resolvedPath)) {
      const inappSaved = window.localStorage.getItem('theme-mode-inapp');
      if (inappSaved === 'dark') return 'dark';
    }
    // One-time migration from the legacy single-key 'theme-mode'. Only
    // seeds the CURRENT context so we don't overwrite the other one.
    const legacy = window.localStorage.getItem('theme-mode');
    if (legacy === 'light' || legacy === 'dark') {
      try { window.localStorage.setItem(key, legacy); } catch { /* ignore */ }
      return legacy;
    }
  } catch {
    /* ignore quota / privacy-mode failures */
  }
  return getDefaultThemeForContext(ctx);
}

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: 'light' as ThemeMode,
      toggleTheme: () => {},
      isDark: false,
      routeContext: 'public' as ThemeCtxKind,
    };
  }
  return context;
};

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  /** Theme resolved server-side. Guarantees the first client render matches
   *  the server render so emotion doesn't hydrate-mismatch. */
  initialMode?: ThemeMode;
}> = ({ children, initialMode }) => {
  // Initial state mirrors the server-provided value. Identical on server +
  // first client render → no hydration mismatch.
  const [mode, setMode] = useState<ThemeMode>(initialMode ?? 'light');
  const [routeCtx, setRouteCtx] = useState<ThemeCtxKind>(() =>
    typeof window === 'undefined' ? 'public' : currentRouteContext(),
  );

  // Track whether the user has explicitly chosen a theme (manual toggle) —
  // kept for parity with earlier sessions; no longer used for gating.
  const userOverrideRef = useRef(false);

  // ── On mount: reconcile with localStorage > route default, and persist
  //    to the context cookie so the NEXT SSR renders the correct theme. ──
  //    Runs in a LAYOUT effect (before the browser paints) so a visitor
  //    whose SSR fell back to the route default (e.g. cookie absent while
  //    localStorage says something else) never sees a one-frame flash of
  //    the wrong theme. The first client render still matches SSR (mode =
  //    initialMode) so there is no hydration mismatch — the switch to the
  //    stored theme happens after hydration commits but before paint.
  useIsomorphicLayoutEffect(() => {
    const ctx = currentRouteContext();
    const resolved = readPreferredMode(ctx);
    if (resolved !== mode) setMode(resolved);
    if (ctx !== routeCtx) setRouteCtx(ctx);
    // Help & Support follows the in-app theme but must NOT auto-persist a
    // cookie here: writing the public cookie would bleed dark onto the
    // marketing site, and writing the in-app cookie would bleed a visitor's
    // light default into the merchant app. It only persists on explicit toggle.
    if (!isHelpSupportPath(window.location.pathname)) {
      writeThemeCookie(ctx, resolved);
    }
    // Record whether we picked up an explicit override.
    try {
      const stored = window.localStorage.getItem(getStorageKeyForContext(ctx));
      if (stored === 'light' || stored === 'dark') userOverrideRef.current = true;
    } catch { /* ignore */ }
  }, []);

  // ── Watch for client-side navigations. Next.js pushes with history.pushState
  //    → the History API doesn't emit a 'popstate' event, so we patch push
  //    once at mount to detect route changes and re-evaluate the active
  //    context/preference. Also listen to popstate for back/forward. ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let disposed = false;

    const reconcile = () => {
      if (disposed) return;
      const ctx = currentRouteContext();
      const resolved = readPreferredMode(ctx);
      // If ONLY the context changed but the current mode already matches the
      // context's stored preference, we still update routeCtx so consumers
      // (e.g. debug tooling) see the right value. Cheap set — React bails
      // out when the value is referentially equal, but not for primitives.
      setRouteCtx((prev) => (prev === ctx ? prev : ctx));
      setMode((prev) => (prev === resolved ? prev : resolved));
      // See mount-effect note: never auto-persist the theme cookie on /help-support.
      if (!isHelpSupportPath(window.location.pathname)) {
        writeThemeCookie(ctx, resolved);
      }
    };

    // Patch history.pushState / replaceState to fire an event on each call.
    const EVT = 'dynopay:routechange';
    type PatchedFn = typeof window.history.pushState & { __dynoPatched?: boolean };
    const patch = (name: 'pushState' | 'replaceState') => {
      const orig = window.history[name] as PatchedFn;
      // Guard against double-patching (Fast Refresh) — the orig itself is
      // stashed on the fn so subsequent mounts can detect + skip.
      if (orig.__dynoPatched) return;
      const wrapped = function (this: History, ...args: unknown[]) {
        const ret = orig.apply(this, args as Parameters<typeof orig>);
        try { window.dispatchEvent(new Event(EVT)); } catch { /* ignore */ }
        return ret;
      };
      (wrapped as PatchedFn).__dynoPatched = true;
      window.history[name] = wrapped as History['pushState'];
    };
    try { patch('pushState'); patch('replaceState'); } catch { /* ignore */ }

    window.addEventListener(EVT, reconcile);
    window.addEventListener('popstate', reconcile);
    // Also re-check when tab regains focus — user may have toggled on the
    // other tab in the same context.
    window.addEventListener('focus', reconcile);
    return () => {
      disposed = true;
      window.removeEventListener(EVT, reconcile);
      window.removeEventListener('popstate', reconcile);
      window.removeEventListener('focus', reconcile);
    };
  }, []);

  // ── Keep data-theme attribute + colorScheme in sync so CSS always matches ──
  useIsomorphicLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
      // Clear inline bg so MUI/CSS takes over (blocking script bg was just
      // for first paint).
      document.documentElement.style.backgroundColor = '';
    }
  }, [mode]);

  // ── OS-preference listener neutralised (Session 44 legacy). Kept as a
  //    no-op stub in case we ever add an "Auto — follow OS" mode. ──
  useEffect(() => {
    return;
  }, []);

  // ── Manual toggle: mutates the CURRENT context's preference only. ──
  const toggleTheme = useCallback(() => {
    setMode((prevMode) => {
      const newMode: ThemeMode = prevMode === 'light' ? 'dark' : 'light';
      userOverrideRef.current = true;
      const ctx = currentRouteContext();
      // On /help-support (dual-purpose) the theme follows the IN-APP
      // preference, so an explicit toggle here persists to the in-app key +
      // cookie — keeping Help & Support and the dashboard in lockstep.
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const storageKey = isHelpSupportPath(path)
        ? 'theme-mode-inapp'
        : getStorageKeyForContext(ctx);
      const cookieName = isHelpSupportPath(path)
        ? ('theme-mode-inapp' as const)
        : getCookieNameForContext(ctx);
      try {
        window.localStorage.setItem(storageKey, newMode);
      } catch (e) {
        console.log('Could not save theme preference');
      }
      try {
        document.cookie = `${cookieName}=${newMode}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        /* ignore */
      }
      return newMode;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggleTheme,
      isDark: mode === 'dark',
      routeContext: routeCtx,
    }),
    [mode, toggleTheme, routeCtx],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
