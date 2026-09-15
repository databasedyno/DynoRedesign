/**
 * Checkout design tokens + the canonical crypto catalogue — extracted from
 * CleanCheckoutV2 (Session refactor). Pure constants, no runtime side-effects.
 */
import { BRAND_ACCENT } from '@/constants/theme'

// ─── Design tokens (Stripe-adjacent monochrome + indigo accent) ──────────
// IBM Plex Mono first (Blueprint §1.3: the single money/figure typeface) so the
// checkout figures match the merchant dashboard; robust system fallbacks after.
export const MONO = 'var(--font-tech), "IBM Plex Mono", ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, monospace'
// Aurora indigo — Landing v3 canonical accent (Session 82 migration).
// Constant name stays "LIME" for minimal-diff safety; only the value changed.
export const LIME = BRAND_ACCENT
export const INK = '#0A0A0B'
// Text/icon colour for content sitting ON the LIME (indigo) brand buttons.
export const ON_BRAND = '#FFFFFF'

// ── Customer checkout preferences (per-device, mirrors the language switcher) ──
export const PREF_NET_KEY = 'checkout_pref_network'
export const PREF_CUR_KEY = 'checkout_pref_currency'

/**
 * All supported crypto codes returned by the backend, plus display metadata.
 * The `network` field powers the Network dropdown; currencies without a
 * network are treated as their own network (Bitcoin, Ethereum, etc).
 */
export const CRYPTO_INFO: Record<string, {
  label: string
  icon: string
  iconColor?: string
  symbol: string
  network: string
  networkLabel: string
}> = {
  BTC:            { label: 'Bitcoin',      icon: 'cryptocurrency-color:btc',  symbol: 'BTC',   network: 'BTC',     networkLabel: 'Bitcoin' },
  ETH:            { label: 'Ethereum',     icon: 'cryptocurrency-color:eth',  symbol: 'ETH',   network: 'ERC20',   networkLabel: 'Ethereum' },
  LTC:            { label: 'Litecoin',     icon: 'cryptocurrency-color:ltc',  symbol: 'LTC',   network: 'LTC',     networkLabel: 'Litecoin' },
  DOGE:           { label: 'Dogecoin',     icon: 'cryptocurrency-color:doge', symbol: 'DOGE',  network: 'DOGE',    networkLabel: 'Dogecoin' },
  BCH:            { label: 'Bitcoin Cash', icon: 'cryptocurrency-color:bch',  symbol: 'BCH',   network: 'BCH',     networkLabel: 'Bitcoin Cash' },
  TRX:            { label: 'TRX',          icon: 'cryptocurrency-color:trx',  symbol: 'TRX',   network: 'TRC20',   networkLabel: 'Tron' },
  SOL:            { label: 'Solana',       icon: 'cryptocurrency-color:sol',  symbol: 'SOL',   network: 'SOL',     networkLabel: 'Solana' },
  XRP:            { label: 'XRP',          icon: 'cryptocurrency-color:xrp',  symbol: 'XRP',   network: 'XRPL',    networkLabel: 'XRP Ledger' },
  POLYGON:        { label: 'POL',          icon: 'cryptocurrency-color:matic',symbol: 'POL',   network: 'POLYGON', networkLabel: 'Polygon' },
  'USDT-TRC20':   { label: 'USDT',         icon: 'cryptocurrency-color:usdt', symbol: 'USDT',  network: 'TRC20',   networkLabel: 'Tron' },
  'USDT-ERC20':   { label: 'USDT',         icon: 'cryptocurrency-color:usdt', symbol: 'USDT',  network: 'ERC20',   networkLabel: 'Ethereum' },
  'USDT-POLYGON': { label: 'USDT',         icon: 'cryptocurrency-color:usdt', symbol: 'USDT',  network: 'POLYGON', networkLabel: 'Polygon' },
  'USDC-ERC20':   { label: 'USDC',         icon: 'cryptocurrency-color:usdc', symbol: 'USDC',  network: 'ERC20',   networkLabel: 'Ethereum' },
  RLUSD:          { label: 'RLUSD',        icon: 'mdi:currency-usd',          iconColor: '#22c55e', symbol: 'RLUSD', network: 'XRPL',   networkLabel: 'XRP Ledger' },
  'RLUSD-ERC20':  { label: 'RLUSD',        icon: 'mdi:currency-usd',          iconColor: '#22c55e', symbol: 'RLUSD', network: 'ERC20',  networkLabel: 'Ethereum' },
}

/** Typical time-to-confirmation per network, shown while a detected payment confirms. */
export const NETWORK_ETA: Record<string, string> = {
  BTC: '10–60 min',
  ERC20: '1–5 min',
  LTC: '5–15 min',
  DOGE: '2–10 min',
  BCH: '10–30 min',
  TRC20: 'under a minute',
  SOL: 'a few seconds',
  XRPL: 'a few seconds',
  POLYGON: 'under a minute',
}

export const networkEta = (code?: string | null): string =>
  NETWORK_ETA[CRYPTO_INFO[code || '']?.network || code || ''] || '5–15 min'

/** Coin-first view of the catalogue: unique symbols → the display codes (one per network). */
export const coinGroups = (available: string[]): Array<{ symbol: string; codes: string[] }> => {
  const out: Array<{ symbol: string; codes: string[] }> = []
  for (const code of available) {
    const info = CRYPTO_INFO[code]
    if (!info) continue
    const g = out.find((x) => x.symbol === info.symbol)
    if (g) g.codes.push(code)
    else out.push({ symbol: info.symbol, codes: [code] })
  }
  return out
}

// ── Network-cost hints (C1: approx fee + confirmation time next to each coin) ──
export const STABLE_SYMBOLS = ['USDT', 'USDC', 'RLUSD']
export const isStableSymbol = (symbol: string): boolean => STABLE_SYMBOLS.includes(symbol)

/** Chain key used by GET /api/pay/network-fees ("USDT-TRC20" → "USDT_TRC20"). */
export const feeChainKey = (code: string): string => code.replace('-', '_').toUpperCase()

/** Live network fee (USD) for a display code, if the fee map has it. */
export const networkFeeUsd = (code: string, fees: Record<string, number>): number | undefined => {
  const v = fees[feeChainKey(code)]
  return Number.isFinite(v) ? v : undefined
}

/** "≈ $0.42" / "under $0.01" — approximate on-chain fee for the buyer. */
export const fmtNetworkFee = (usd: number | undefined): string | null => {
  if (usd == null || !Number.isFinite(usd)) return null
  if (usd < 0.01) return 'under $0.01'
  return `≈ $${usd.toFixed(2)}`
}

/** Cheapest network for a coin by live fee; original order when fees are unknown. */
export const cheapestCode = (codes: string[], fees: Record<string, number>): string =>
  [...codes].sort((a, b) => (networkFeeUsd(a, fees) ?? Infinity) - (networkFeeUsd(b, fees) ?? Infinity))[0]

const minFee = (codes: string[], fees: Record<string, number>): number =>
  Math.min(...codes.map((c) => networkFeeUsd(c, fees) ?? Infinity))

/**
 * Stablecoins first (cheapest network first, USDT/USDC/RLUSD when fees are
 * unknown), then the rest in catalogue order so the list never jumps around.
 */
export const sortCoinGroups = <G extends { symbol: string; codes: string[] }>(groups: G[], fees: Record<string, number>): G[] => {
  const stables = groups.filter((g) => isStableSymbol(g.symbol))
  const others = groups.filter((g) => !isStableSymbol(g.symbol))
  stables.sort((a, b) => {
    const fa = minFee(a.codes, fees), fb = minFee(b.codes, fees)
    if (fa !== fb) return fa - fb
    return STABLE_SYMBOLS.indexOf(a.symbol) - STABLE_SYMBOLS.indexOf(b.symbol)
  })
  return [...stables, ...others]
}
