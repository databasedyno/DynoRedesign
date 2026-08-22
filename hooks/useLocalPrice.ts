import { useEffect, useState } from 'react';
import useCountry from './useCountry';

/**
 * useLocalPrice — country-aware price formatter for landing showcases.
 *
 * Maps the visitor's ISO-2 country code → a currency preset (symbol + rate
 * relative to USD). The USD→local rate is refreshed from a lightweight daily
 * FX feed (GET /api/public/fx-rates, cached in the browser for 24h) so large
 * converted figures stay believable; the bundled `rate` is a static fallback
 * used until the feed loads or if it's unavailable. Round ceremonial tip/tier
 * chips (CLEAN_TIER_MAP) are intentionally kept — a €10 tip reads better than
 * an exact €9.17 conversion. Fallback currency is USD. INR uses the lakh
 * convention ("₹8.3L") for large amounts to feel native.
 *
 * Usage:
 *   const { fmt } = useLocalPrice();
 *   fmt(10000);   // "$10,000" / "€9,200" / "₹8.3L" / …
 *   fmt(0.30);    // "$0.30"   / "€0.28"  / "₹25"  / …
 */

interface CurrencyPreset {
  symbol: string;
  code: string;                        // ISO 4217
  rate: number;                        // 1 USD = rate * localUnit
  position: 'prefix' | 'suffix';
  decimalSep: '.' | ',';
  thousandSep: ',' | '.' | ' ';
  useLakh?: boolean;                   // Indian numbering for ≥100k
}

const USD: CurrencyPreset = { symbol: '$',   code: 'USD', rate: 1,      position: 'prefix', decimalSep: '.', thousandSep: ',' };
const EUR: CurrencyPreset = { symbol: '€',   code: 'EUR', rate: 0.92,   position: 'prefix', decimalSep: ',', thousandSep: '.' };
const GBP: CurrencyPreset = { symbol: '£',   code: 'GBP', rate: 0.79,   position: 'prefix', decimalSep: '.', thousandSep: ',' };
const INR: CurrencyPreset = { symbol: '₹',   code: 'INR', rate: 83,     position: 'prefix', decimalSep: '.', thousandSep: ',', useLakh: true };
const AUD: CurrencyPreset = { symbol: 'A$',  code: 'AUD', rate: 1.5,    position: 'prefix', decimalSep: '.', thousandSep: ',' };
const CAD: CurrencyPreset = { symbol: 'C$',  code: 'CAD', rate: 1.36,   position: 'prefix', decimalSep: '.', thousandSep: ',' };
const JPY: CurrencyPreset = { symbol: '¥',   code: 'JPY', rate: 150,    position: 'prefix', decimalSep: '.', thousandSep: ',' };
const MXN: CurrencyPreset = { symbol: 'MX$', code: 'MXN', rate: 17,     position: 'prefix', decimalSep: '.', thousandSep: ',' };
const BRL: CurrencyPreset = { symbol: 'R$',  code: 'BRL', rate: 5,      position: 'prefix', decimalSep: ',', thousandSep: '.' };
const ZAR: CurrencyPreset = { symbol: 'R',   code: 'ZAR', rate: 18,     position: 'prefix', decimalSep: '.', thousandSep: ',' };
const NGN: CurrencyPreset = { symbol: '₦',   code: 'NGN', rate: 1500,   position: 'prefix', decimalSep: '.', thousandSep: ',' };

const EU_CODES = new Set([
  'AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT','LT','LU','LV',
  'MT','NL','PT','SI','SK'
]);

const codeToPreset = (iso?: string | null): CurrencyPreset => {
  const c = (iso || '').toUpperCase();
  if (!c) return USD;
  if (EU_CODES.has(c)) return EUR;
  switch (c) {
    case 'GB': return GBP;
    case 'IN': return INR;
    case 'AU': return AUD;
    case 'CA': return CAD;
    case 'JP': return JPY;
    case 'MX': return MXN;
    case 'BR': return BRL;
    case 'ZA': return ZAR;
    case 'NG': return NGN;
    default:   return USD;
  }
};

const insertThousands = (whole: string, sep: string): string =>
  whole.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

const insertIndianThousands = (whole: string, sep: string): string => {
  // Last 3 digits, then groups of 2 (Indian lakh/crore grouping)
  if (whole.length <= 3) return whole;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, sep) + sep + last3;
};

const formatAmount = (usd: number, p: CurrencyPreset): string => {
  const local = usd * p.rate;
  const abs = Math.abs(local);

  // Indian lakh convention for large values (≥1 lakh = 100k)
  if (p.useLakh && abs >= 100000) {
    const lakhs = local / 100000;
    const shown = lakhs >= 10 ? Math.round(lakhs).toString() : lakhs.toFixed(1);
    return `${p.symbol}${shown}L`;
  }

  // Zero-decimal currencies (JPY, INR ≥ 1) — no cents
  const skipDecimals = p.code === 'JPY' || (p.code === 'INR' && abs >= 1);

  // Small/fractional values keep 2 decimals (fee strip: $0.30, €0.28)
  const shouldShowCents = abs < 100 && !skipDecimals;
  const fixed = shouldShowCents ? local.toFixed(2) : Math.round(local).toString();

  let [whole, decimals] = fixed.split('.');
  const isNegative = whole.startsWith('-');
  if (isNegative) whole = whole.slice(1);

  const grouped = p.code === 'INR'
    ? insertIndianThousands(whole, p.thousandSep)
    : insertThousands(whole, p.thousandSep);

  const numStr = decimals ? `${grouped}${p.decimalSep}${decimals}` : grouped;
  const sign = isNegative ? '-' : '';
  return p.position === 'prefix' ? `${sign}${p.symbol}${numStr}` : `${sign}${numStr}${p.symbol}`;
};

/**
 * Snap small ceremonial amounts ($5, $10, $25, $100) to memorable "clean"
 * local numbers so the copy still reads well ($5 → €5 not €4.60).
 * Only applied to values < 200 (the tier chips + tip presets).
 */
const CLEAN_TIER_MAP: Partial<Record<string, Partial<Record<number, string>>>> = {
  USD: { 3: '$3', 5: '$5', 10: '$10', 25: '$25', 50: '$50', 100: '$100' },
  EUR: { 3: '€3', 5: '€5', 10: '€10', 25: '€25', 50: '€50', 100: '€100' },
  GBP: { 3: '£3', 5: '£5', 10: '£10', 25: '£25', 50: '£50', 100: '£100' },
  INR: { 3: '₹250', 5: '₹500', 10: '₹1K', 25: '₹2K', 50: '₹5K', 100: '₹10K' },
  AUD: { 3: 'A$5', 5: 'A$8', 10: 'A$15', 25: 'A$40', 50: 'A$75', 100: 'A$150' },
  CAD: { 3: 'C$4', 5: 'C$7', 10: 'C$15', 25: 'C$35', 50: 'C$70', 100: 'C$140' },
  JPY: { 3: '¥450', 5: '¥800', 10: '¥1500', 25: '¥3800', 50: '¥7500', 100: '¥15,000' },
  MXN: { 3: 'MX$50', 5: 'MX$85', 10: 'MX$170', 25: 'MX$425', 50: 'MX$850', 100: 'MX$1,700' },
  BRL: { 3: 'R$15', 5: 'R$25', 10: 'R$50', 25: 'R$125', 50: 'R$250', 100: 'R$500' },
  ZAR: { 3: 'R55', 5: 'R90', 10: 'R180', 25: 'R450', 50: 'R900', 100: 'R1,800' },
  NGN: { 3: '₦4,500', 5: '₦7,500', 10: '₦15K', 25: '₦37K', 50: '₦75K', 100: '₦150K' },
};

// ── Live daily FX feed ────────────────────────────────────────────────────
// Shared across every useLocalPrice() instance so we fetch at most once per
// session (and at most once per 24h thanks to the localStorage cache). Never
// throws — any failure leaves the static preset rates in place.
const FX_LS_KEY = 'dyno_fx_rates_v1';
const FX_TTL_MS = 24 * 60 * 60 * 1000; // 24h
let liveRatesCache: Record<string, number> | null = null;
let liveRatesPromise: Promise<Record<string, number> | null> | null = null;

const loadFxRates = (): Promise<Record<string, number> | null> => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (liveRatesCache) return Promise.resolve(liveRatesCache);
  if (liveRatesPromise) return liveRatesPromise;
  liveRatesPromise = (async () => {
    try {
      const raw = window.localStorage.getItem(FX_LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.rates && parsed?.ts && Date.now() - parsed.ts < FX_TTL_MS) {
          liveRatesCache = parsed.rates;
          return liveRatesCache;
        }
      }
    } catch {
      /* corrupt cache — ignore and refetch */
    }
    try {
      const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
      const resp = await fetch(`${base}/api/public/fx-rates`);
      const json = await resp.json();
      const rates = json?.data?.rates;
      if (rates && typeof rates === 'object') {
        liveRatesCache = rates as Record<string, number>;
        try {
          window.localStorage.setItem(FX_LS_KEY, JSON.stringify({ ts: Date.now(), rates }));
        } catch {
          /* storage full/blocked — in-memory cache still applies */
        }
        return liveRatesCache;
      }
    } catch {
      /* offline / feed down — keep static fallback rates */
    }
    return null;
  })();
  return liveRatesPromise;
};

export function useLocalPrice() {
  const { country } = useCountry();
  const [live, setLive] = useState<Record<string, number> | null>(liveRatesCache);

  useEffect(() => {
    let active = true;
    loadFxRates().then((r) => {
      if (active && r) setLive(r);
    });
    return () => {
      active = false;
    };
  }, []);

  const base = codeToPreset(country?.countryCode);
  const liveRate = live?.[base.code];
  // Blend the live rate into the preset; keep the static rate until the feed
  // resolves (or if this currency isn't in the feed).
  const preset =
    typeof liveRate === 'number' && liveRate > 0 ? { ...base, rate: liveRate } : base;

  const fmt = (usd: number): string => {
    const clean = CLEAN_TIER_MAP[preset.code]?.[usd];
    if (clean) return clean;
    return formatAmount(usd, preset);
  };

  return { fmt, code: preset.code, symbol: preset.symbol };
}

export default useLocalPrice;
