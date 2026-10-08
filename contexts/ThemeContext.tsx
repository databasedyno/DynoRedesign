'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import {
  THEME_KEY,
  THEME_EFFECTIVE_COOKIE,
  LEGACY_THEME_KEYS,
  parseMode,
  readCookieValue,
  resolveLegacyMode,
  isSafeDealLocation,
  type ThemeMode,
  type ThemeSource,
} from '@/utils/theme/routeContext';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setPreference: (pref: ThemeMode | 'system') => void;
  isDark: boolean;
  /** "manual" = remembered choice, "system" = following the device, "fixed" = SafeDeal. */
  source: ThemeSource;
}

interface ThemeState {
  mode: ThemeMode;
  source: ThemeSource;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Apply theme side-effects BEFORE the browser paints on the client (prevents
// a one-frame flash); fall back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const DARK_MQ = '(prefers-color-scheme: dark)';

function writeCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function readCookie(name: string): string | null {
  try {
    return readCookieValue(document.cookie, name);
  } catch {
    return null;
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function systemMode(): ThemeMode {
  try {
    return window.matchMedia(DARK_MQ).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function persistManual(mode: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
  writeCookie(THEME_KEY, mode);
}

/** The remembered choice: `dyno-theme` (storage → cookie), else a one-time
 *  migration from the legacy per-context keys (dashboard > legacy > public). */
function readManualChoice(): ThemeMode | null {
  const direct = parseMode(readStorage(THEME_KEY)) ?? parseMode(readCookie(THEME_KEY));
  if (direct) return direct;
  const legacy = resolveLegacyMode((k) => readStorage(k) ?? readCookie(k));
  if (legacy) persistManual(legacy);
  return legacy;
}

function clearLegacyKeys() {
  for (const key of LEGACY_THEME_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      document.cookie = `${key}=; path=/; max-age=0`;
    } catch {
      /* ignore */
    }
  }
}

function resolveTheme(): ThemeState {
  if (isSafeDealLocation(window.location)) return { mode: 'light', source: 'fixed' };
  const manual = readManualChoice();
  if (manual) return { mode: manual, source: 'manual' };
  return { mode: systemMode(), source: 'system' };
}

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: 'light' as ThemeMode,
      toggleTheme: () => {},
      setPreference: () => {},
      isDark: false,
      source: 'system' as ThemeSource,
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
  const [state, setState] = useState<ThemeState>({ mode: initialMode ?? 'light', source: 'system' });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Re-resolve from storage / device and record the effective mode for SSR.
  const apply = useCallback(() => {
    const next = resolveTheme();
    setState((prev) => (prev.mode === next.mode && prev.source === next.source ? prev : next));
    if (next.source !== 'fixed') writeCookie(THEME_EFFECTIVE_COOKIE, next.mode);
  }, []);

  // Mount: reconcile before paint (SSR may have fallen back to a default).
  useIsomorphicLayoutEffect(() => {
    apply();
    clearLegacyKeys();
  }, [apply]);

  // Client-side navigation (Next uses pushState, which emits no event — patch
  // it once), back/forward, tab focus and cross-tab storage changes.
  useEffect(() => {
    let disposed = false;
    const reconcile = () => {
      if (!disposed) apply();
    };
    const EVT = 'dynopay:routechange';
    type PatchedFn = typeof window.history.pushState & { __dynoPatched?: boolean };
    const patch = (name: 'pushState' | 'replaceState') => {
      const orig = window.history[name] as PatchedFn;
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

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === THEME_KEY) reconcile();
    };
    window.addEventListener(EVT, reconcile);
    window.addEventListener('popstate', reconcile);
    window.addEventListener('focus', reconcile);
    window.addEventListener('storage', onStorage);
    return () => {
      disposed = true;
      window.removeEventListener(EVT, reconcile);
      window.removeEventListener('popstate', reconcile);
      window.removeEventListener('focus', reconcile);
      window.removeEventListener('storage', onStorage);
    };
  }, [apply]);

  // Follow the device live until the first manual toggle.
  useEffect(() => {
    if (state.source !== 'system') return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(DARK_MQ);
    } catch {
      return;
    }
    const onChange = () => apply();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [state.source, apply]);

  // Keep data-theme + colorScheme in sync so CSS always matches.
  useIsomorphicLayoutEffect(() => {
    document.documentElement.dataset.theme = state.mode;
    document.documentElement.style.colorScheme = state.mode;
    // Clear the blocking script's first-paint bg so MUI/CSS takes over.
    document.documentElement.style.backgroundColor = '';
  }, [state.mode]);

  // Manual toggle → becomes the single remembered choice everywhere.
  const toggleTheme = useCallback(() => {
    if (stateRef.current.source === 'fixed') return;
    const next: ThemeMode = stateRef.current.mode === 'light' ? 'dark' : 'light';
    persistManual(next);
    writeCookie(THEME_EFFECTIVE_COOKIE, next);
    setState({ mode: next, source: 'manual' });
  }, []);

  // Explicit Light / Dark / System choice (account menu segmented control).
  const setPreference = useCallback((pref: ThemeMode | 'system') => {
    if (stateRef.current.source === 'fixed') return;
    if (pref === 'system') {
      try {
        window.localStorage.removeItem(THEME_KEY);
      } catch {
        /* ignore */
      }
      try {
        document.cookie = `${THEME_KEY}=; path=/; max-age=0`;
      } catch {
        /* ignore */
      }
      apply();
      return;
    }
    persistManual(pref);
    writeCookie(THEME_EFFECTIVE_COOKIE, pref);
    setState({ mode: pref, source: 'manual' });
  }, [apply]);

  const value = useMemo(
    () => ({
      mode: state.mode,
      toggleTheme,
      setPreference,
      isDark: state.mode === 'dark',
      source: state.source,
    }),
    [state.mode, state.source, toggleTheme, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
