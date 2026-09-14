import { useEffect, useState } from 'react';

/**
 * useCountry — resolves the visitor's country via /api/geo-detect (backed by
 * ip-api server-side). Cached in sessionStorage so we don't hit the endpoint
 * more than once per tab. Falls back to US.
 *
 * SSR-safe: returns `null` on the server and until the first client fetch
 * resolves, so consumers should render a stable default while `loading`.
 */

export interface CountryInfo {
  country: string;      // "Brazil"
  countryCode: string;  // "BR"
  flag: string;         // "🇧🇷"
}

const STORAGE_KEY = 'dyno_country_v1';

const flagFromCode = (iso: string): string => {
  if (!iso || iso.length !== 2) return '🌐';
  const base = 0x1f1e6;
  const [a, b] = iso.toUpperCase().split('');
  return String.fromCodePoint(base + (a.charCodeAt(0) - 65), base + (b.charCodeAt(0) - 65));
};

const readCache = (): CountryInfo | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.countryCode) return parsed;
  } catch {}
  return null;
};

export function useCountry() {
  const [country, setCountry] = useState<CountryInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const cached = readCache();
    if (cached) {
      setCountry(cached);
      setLoading(false);
      return;
    }

    const backendBase =
      (process.env.NEXT_PUBLIC_SERVER_URL as string | undefined) ||
      (process.env.NEXT_PUBLIC_BASE_URL as string | undefined) ||
      '';
    const url = `${backendBase.replace(/\/+$/, '')}/api/geo-detect`;

    fetch(url, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const iso = String(data.countryCode || 'US').toUpperCase();
        const info: CountryInfo = {
          country: String(data.country || 'United States'),
          countryCode: iso,
          flag: flagFromCode(iso),
        };
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
        } catch {}
        setCountry(info);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { country, loading };
}

export default useCountry;
