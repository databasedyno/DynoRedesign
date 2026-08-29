/**
 * Checkout design tokens + the canonical crypto catalogue — extracted from
 * CleanCheckoutV2 (Session refactor). Pure constants, no runtime side-effects.
 */
import { BRAND_ACCENT } from '@/constants/theme'

// ─── Design tokens (Stripe-adjacent monochrome + lime accent) ────────────
export const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
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
