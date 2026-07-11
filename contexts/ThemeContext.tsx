'use client';

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Apply theme side-effects BEFORE the browser paints on the client (prevents a
// one-frame background flash on toggle); fall back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Read the OS / device preference. Falls back to 'light' during SSR. */
function getSystemPreference(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Persist the theme to a cookie so the server can read it on the next
 * request and render the matching theme (prevents SSR hydration mismatch). */
function writeThemeCookie(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `theme-mode=${mode}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: 'light' as ThemeMode,
      toggleTheme: () => {},
      isDark: false,
    };
  }
  return context;
};

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  /** Theme resolved server-side from the Sec-CH-Prefers-Color-Scheme client
   * hint or the theme-mode cookie. Guarantees the first client render matches
   * the server render (no emotion className hydration mismatch). */
  initialMode?: ThemeMode;
}> = ({ children, initialMode }) => {
  // Initial state mirrors the server-provided value (default 'light').
  // Identical on server + first client render → no hydration mismatch.
  const [mode, setMode] = useState<ThemeMode>(initialMode ?? 'light');

  // Track whether the user has explicitly chosen a theme (manual toggle)
  const userOverrideRef = useRef(false);

  // ── On mount: reconcile with localStorage > system preference, and persist
  //    to the cookie so the NEXT SSR renders the correct theme. ──
  useEffect(() => {
    let resolved: ThemeMode | null = null;
    try {
      const saved = localStorage.getItem('theme-mode') as ThemeMode;
      if (saved === 'light' || saved === 'dark') {
        resolved = saved;
        userOverrideRef.current = true;
      }
    } catch (e) {
      console.log('Could not access localStorage');
    }
    if (!resolved) resolved = getSystemPreference();
    if (resolved !== mode) setMode(resolved);
    writeThemeCookie(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Keep data-theme attribute in sync so CSS always matches ──
  useIsomorphicLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
      // Clear inline bg so MUI/CSS takes over (blocking script bg was just for first paint)
      document.documentElement.style.backgroundColor = '';
    }
  }, [mode]);

  // ── 3. Listen for real-time OS theme changes ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (!userOverrideRef.current) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ── 4. Manual toggle (overrides system preference) ──
  const toggleTheme = useCallback(() => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      userOverrideRef.current = true;
      try {
        localStorage.setItem('theme-mode', newMode);
      } catch (e) {
        console.log('Could not save to localStorage');
      }
      writeThemeCookie(newMode);
      return newMode;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggleTheme,
      isDark: mode === 'dark',
    }),
    [mode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
