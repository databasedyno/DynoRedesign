import { BRAND_ACCENT } from "@/constants/theme";
/**
 * CleanCheckoutV2 — Stripe-inspired single-panel crypto checkout.
 *
 * Session 44 Phase 1 deliverable.
 *
 * ### Design principles (from Stripe reference in `/app/memory/UX_ROADMAP.md`)
 * 1. Merchant name is the H1 (not "Complete your payment").
 * 2. Amount is the mono/prominent subheadline.
 * 3. Network + Currency as two side-by-side selects (not a chip grid).
 * 4. One clear instruction sentence between selects and QR.
 * 5. QR + address + amount + refund-method all in ONE scrollable panel —
 *    no stepper, no tabs.
 * 6. Warning callout is soft yellow; never blocks the QR.
 * 7. Monochrome palette; lime only on the primary CTA.
 * 8. Massive whitespace — the QR sits in ~40% of vertical space.
 *
 * ### Why a new component (not editing the stepper)
 * The existing `/pay` route (`pages/pay/index.tsx`) is 1738 LOC of tightly
 * coupled Redux + local state driving a multi-step FSM (Order → Payment →
 * Done). Rewriting it in place risked regressions across the entire
 * checkout surface. This component is a self-contained V2 mounted behind
 * `NEXT_PUBLIC_CLEAN_CHECKOUT_V2` (default `true`). When the flag is off,
 * the pay page falls back to the legacy stepper. All backend endpoints are
 * reused as-is — this is a pure presentational rewrite.
 *
 * ### FSM
 *   loading_meta → currency_select → creating_payment → awaiting_payment
 *                                                     → confirmed
 *                                                     → underpaid
 *                                                     → expired
 *                                                     → failed
 *
 * ### Auth
 * Uses the session JWT from `POST /api/pay/getData` as an explicit
 * `Authorization: Bearer <token>` header on subsequent calls. Never touches
 * `localStorage.token` — so a merchant with an active session in another
 * tab isn't accidentally sending their JWT to customer endpoints.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Box,
  Button,
  Collapse,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import { Icon } from '@iconify/react'
import { usePaymentNotification } from '@/hooks/usePaymentNotification'
import { ReceiptEmailField, NotifyMeInline } from './checkoutExtras'
import { QRCodeSVG } from 'qrcode.react'
import Logo from '@/assets/Icons/Logo'
import CheckoutStatusStrip from '@/Components/UI/CheckoutStatusStrip'
import RateFreshness from '@/Components/UI/RateFreshness'
import type { CheckoutState } from '@/Components/UI/CheckoutShell'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'

// ─── Design tokens (Stripe-adjacent monochrome + lime accent) ────────────
const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
// Aurora indigo — Landing v3 canonical accent (Session 82 migration).
// Constant name stays "LIME" for minimal-diff safety; only the value changed.
const LIME = BRAND_ACCENT
const INK = '#0A0A0B'
// Text/icon colour for content sitting ON the LIME (indigo) brand buttons.
// Kept separate from INK (which is correct dark text on light surfaces) so
// the indigo CTAs get legible WHITE text after the lime→indigo rebrand.
const ON_BRAND = '#FFFFFF'

// ── Customer checkout preferences (per-device, mirrors the language switcher) ──
// Remembers the coin/network a returning customer paid with last time so they
// don't have to reselect. Stored client-side only (no server/profile write).
const PREF_NET_KEY = 'checkout_pref_network'
const PREF_CUR_KEY = 'checkout_pref_currency'
const readCheckoutPref = (k: string): string => {
  try { return typeof window !== 'undefined' ? localStorage.getItem(k) || '' : '' } catch { return '' }
}
const writeCheckoutPref = (k: string, v: string) => {
  try { if (typeof window !== 'undefined' && v) localStorage.setItem(k, v) } catch { /* ignore */ }
}

/** Payload we hold in local state after `/pay/getData` resolves. */
type Meta = {
  amount: number
  base_currency: string
  // Who covers the processing fee — 'company' (merchant absorbs) or 'customer'
  // (added on top). MUST be forwarded to /pay/getCurrencyRates so the charged
  // crypto amount includes fees for customer-pays links; otherwise the merchant
  // silently eats the fee (addPayment deducts it from the settled amount).
  fee_payer?: string
  // Tax amount in base_currency (0 when the link has no tax / not applicable).
  tax_amount?: number
  // Estimated processing fee (base_currency) returned by getData for customer-pays
  // links, shown before the exact per-coin fee is known after crypto selection.
  estimated_fee?: number
  available_currencies: string[]
  token: string
  link_type?: string
  description?: string | null
  order_reference?: string | null
  customer_name?: string | null
  contribution?: {
    campaign_title?: string | null
    parent_link_id?: number | null
    donor_name?: string | null
    donor_message?: string | null
    is_anonymous?: boolean | null
  } | null
  merchant?: {
    name?: string | null
    company_name?: string | null
    company_logo?: string | null
  } | null
}

type CryptoInfo = {
  address: string
  qr_code: string
  memo: string
  expected_amount: number
  crypto_display: string
  crypto_base: string
  network: string
}

type Phase =
  | 'loading_meta'
  | 'currency_select'
  | 'creating_payment'
  | 'awaiting_payment'
  | 'confirmed'
  | 'underpaid'
  | 'expired'
  | 'failed'
  | 'error'

/**
 * All supported crypto codes returned by the backend, plus display metadata.
 * Kept in sync with `Components/Page/Creator/InlineTipCheckout.tsx`.
 * The `network` field is what powers the Network dropdown; currencies without
 * a network are treated as their own network (Bitcoin, Ethereum, etc).
 */
const CRYPTO_INFO: Record<string, {
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

/** Format a crypto amount with reasonable precision per chain. */
function formatCryptoAmount(amt: number, code: string): string {
  const precision =
    ['USDT', 'USDC', 'RLUSD', 'BUSD', 'DAI'].includes(code) ? 2
      : ['BTC', 'ETH', 'BCH', 'LTC'].includes(code) ? 8
      : 6
  return amt.toFixed(precision).replace(/\.?0+$/, '')
}

/**
 * Build a one-tap "open in wallet" payment URI (used for the deep-link button
 * AND to encode the QR so a scanning wallet app pre-fills address + amount).
 *
 * SAFETY: we ONLY emit a URI for native-coin chains whose amount is
 * unambiguously the coin's whole unit (BIP-21 for BTC/LTC/DOGE/BCH, Solana Pay
 * for SOL). Token / EVM / TRON chains (USDT, USDC, ETH, POL, TRX, XRP…) are
 * intentionally left null — their URI amount encoding (wei / smallest-unit /
 * token-transfer) is error-prone, and a wrong amount could cause an
 * underpayment. Those chains keep the existing copy-address + QR flow.
 *
 * The amount uses the SAME formatter as the on-screen "AMOUNT" row, so the
 * deep link and the displayed value can never drift apart.
 */
type PaymentUri = { uri: string } | null
export function buildPaymentUri(
  networkCode: string,
  address: string,
  amount: number,
  cryptoBase: string,
): PaymentUri {
  if (!address) return null
  const amt = formatCryptoAmount(amount, cryptoBase)
  switch ((networkCode || '').toUpperCase()) {
    case 'BTC':
      return { uri: `bitcoin:${address}?amount=${amt}` }
    case 'LTC':
      return { uri: `litecoin:${address}?amount=${amt}` }
    case 'DOGE':
      return { uri: `dogecoin:${address}?amount=${amt}` }
    case 'BCH':
      return { uri: `bitcoincash:${address.replace(/^bitcoincash:/i, '')}?amount=${amt}` }
    case 'SOL':
      return { uri: `solana:${address}?amount=${amt}` }
    default:
      return null
  }
}

/** Copy to clipboard with a legacy fallback for insecure contexts. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-999999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch {
    return false
  }
}

/**
 * fetch wrapper — always adds Authorization: Bearer if provided AND never
 * uses localStorage. Returns the parsed { message, data } envelope.
 */
async function api(
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<{ ok: boolean; status: number; message?: string; data?: any }> {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    const res = await fetch(`${base}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, message: json?.message, data: json?.data }
  } catch (e: any) {
    return { ok: false, status: 0, message: e?.message || 'Network error' }
  }
}

interface CleanCheckoutV2Props {
  /** Payment reference (`?d=<xxx>`) — required. */
  d: string
  /** Called after payment confirms so the parent page can react (e.g. show
   *  a share sheet, refresh a campaign progress bar, etc). Optional. */
  onSuccess?: () => void
}

const CleanCheckoutV2: React.FC<CleanCheckoutV2Props> = ({ d, onSuccess }) => {
  const theme = useTheme()
  const { t } = useTranslation('landing')
  const isDark = theme.palette.mode === 'dark'

  // Design tokens resolved per-theme
  const border   = isDark ? 'rgba(255,255,255,0.10)' : '#E4E4E7'
  const surface  = isDark ? 'rgba(255,255,255,0.03)' : '#F6F6F7'
  const muted    = isDark ? '#A1A1AA' : '#71717A'
  const warnBg   = isDark ? 'rgba(245,158,11,0.10)' : '#FEF3C7'
  const warnFg   = '#B45309'
  const errBg    = isDark ? 'rgba(239,68,68,0.10)' : '#FEE2E2'
  const errFg    = '#B91C1C'

  // ─── State ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading_meta')
  // True once the backend reports the on-chain tx has been SEEN (status
  // 'pending' = "Payment detected, awaiting confirmation") — drives the
  // Waiting → Detected → Confirmed timeline. Backend does NOT expose a numeric
  // confirmation count, so we show discrete steps rather than a fake "n of m".
  const [detected, setDetected] = useState(false)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [selectedNetwork, setSelectedNetwork] = useState<string>('')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [cryptoInfo, setCryptoInfo] = useState<CryptoInfo | null>(null)
  // Exact fee + total (in base_currency) for the SELECTED coin, captured from
  // getCurrencyRates after reservation. Null until a coin is reserved → the
  // header shows the getData estimate first, then the exact figure.
  const [feeExact, setFeeExact] = useState<{ fee: number; total: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  // Total reservation window (seconds) — the denominator for the countdown
  // progress bar (§5.12). Tracks the largest window seen so the bar never
  // exceeds 100% even if the backend re-issues a fresh remaining_seconds.
  const [totalSeconds, setTotalSeconds] = useState<number>(0)
  const [rateFetchedAt, setRateFetchedAt] = useState<number | null>(null)
  const [copiedFlag, setCopiedFlag] = useState<'addr' | 'amt' | ''>('')
  const [portalReady, setPortalReady] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  // "Download receipt" on the paid card — proof of payment for the customer.
  const [receiptState, setReceiptState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [showRefundInput, setShowRefundInput] = useState<boolean>(false)
  const [refundAddress, setRefundAddress] = useState<string>('')
  // Optional buyer receipt email ("Email me a receipt"). Saved to the checkout
  // session so the existing post-payment receipt email fires for anonymous
  // payers. Contact info only — never affects amounts / addresses / fees.
  const [receiptEmail, setReceiptEmail] = useState<string>('')
  const [emailSaved, setEmailSaved] = useState<boolean>(false)
  const [confirmedAmount, setConfirmedAmount] = useState<{
    crypto: number
    fiat: number
    fiatCurrency: string
  } | null>(null)
  // Partial-payment (underpaid) details so the buyer is told exactly how much
  // MORE to send to the SAME address to complete the payment.
  const [partial, setPartial] = useState<{
    paidAmount: number
    remainingAmount: number
    remainingAmountUsd: number
    currency: string
    baseCurrency: string
  } | null>(null)

  const mountedRef = useRef(true)
  const pollRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  // Browser "Payment confirmed" alert (opt-in). Lets the buyer switch tabs
  // while the network confirms and still get pinged on settlement.
  const notif = usePaymentNotification()
  const notifiedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ─── Celebration: confetti burst when payment / contribution confirms ──
  // Fires exactly once (ref-guarded) the moment the checkout reaches the
  // 'confirmed' phase — covers both standard crypto payments AND donation
  // contributions (both land on this success view). On-brand palette
  // (lime + white + ink) and fully skipped for reduced-motion users.
  // canvas-confetti is loaded lazily so it never touches the SSR bundle.
  const confettiFiredRef = useRef(false)
  useEffect(() => {
    if (phase !== 'confirmed' || confettiFiredRef.current) return
    if (typeof window === 'undefined') return
    const prefersReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (prefersReduced) return
    confettiFiredRef.current = true
    let cancelled = false
    void import('canvas-confetti')
      .then((mod) => {
        if (cancelled) return
        const confetti = mod.default
        const colors = ['#5A6BEF', '#7C5CFF', '#4FD1FF', '#3FD98A', '#FFFFFF']
        const fire = (particleRatio: number, opts: Record<string, unknown>) => {
          confetti({
            origin: { y: 0.7 },
            colors,
            disableForReducedMotion: true,
            zIndex: 2000,
            particleCount: Math.floor(200 * particleRatio),
            ...opts,
          })
        }
        // Staggered multi-burst — lively but tasteful.
        fire(0.25, { spread: 26, startVelocity: 55 })
        fire(0.2, { spread: 60 })
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 })
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
        fire(0.1, { spread: 120, startVelocity: 45 })
      })
      .catch(() => {
        /* confetti is non-critical — ignore load failures */
      })
    return () => {
      cancelled = true
    }
  }, [phase])

  // ─── Step 1: fetch meta via /pay/getData ──────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPhase('loading_meta')
      setErrorMsg('')
      // Clear any stale customer token from a previous checkout on this device.
      // getData will hand us a fresh one below.
      try { if (typeof window !== 'undefined') localStorage.removeItem('token') } catch { /* ignore */ }

      const r = await api('/pay/getData', { data: d, language: 'en' }, undefined)
      if (cancelled || !mountedRef.current) return
      if (!r.ok || !r.data) {
        setErrorMsg(r.message || 'Failed to load payment.')
        setPhase('error')
        return
      }
      const raw = r.data
      const available: string[] = Array.isArray(raw.available_currencies)
        ? raw.available_currencies
        : Array.isArray(raw.allowedModes)
          ? String(raw.allowedModes).split(',')
          : (typeof raw.allowedModes === 'string' ? String(raw.allowedModes).split(',') : [])
      const filtered = available.map((s) => s.trim()).filter(Boolean).filter((c) => CRYPTO_INFO[c])
      setMeta({
        amount: Number(raw.amount) || 0,
        base_currency: raw.base_currency || 'USD',
        fee_payer: raw.fee_payer || raw.fee_info?.fee_payer || 'company',
        tax_amount: Number(raw.tax_info?.tax_amount ?? raw.fee_info?.tax_amount ?? 0) || 0,
        estimated_fee: Number(raw.fee_info?.estimated_processing_fee ?? 0) || 0,
        available_currencies: filtered,
        token: String(raw.token || ''),
        link_type: raw.link_type,
        description: raw.description || null,
        order_reference: raw.order_reference || raw.reference || null,
        customer_name: raw.customer_name || null,
        contribution: raw.contribution || null,
        // Backend sends { company_name, company_logo } — normalise to .name so
        // the headline can show "Pay <company>" instead of "Pay Merchant".
        merchant: (() => {
          const m = raw.merchant || raw.merchant_info || null
          return m ? { ...m, name: m.name || m.company_name || null } : null
        })(),
      })
      setPhase('currency_select')
    })()
    return () => { cancelled = true }
  }, [d])

  // ─── Networks + currencies derived from meta ──────────────────────
  // Build a UNIQUE list of networks that have at least one supported currency
  // for THIS payment link. The first network is auto-selected.
  const meta_ = meta // shorthand (must be declared BEFORE the useMemo below to avoid TDZ)
  const { networks, currenciesInNetwork } = useMemo(() => {
    if (!meta_) return { networks: [] as string[], currenciesInNetwork: [] as string[] }
    const nets: string[] = []
    const map: Record<string, string[]> = {}
    for (const code of meta_.available_currencies) {
      const info = CRYPTO_INFO[code]
      if (!info) continue
      if (!map[info.network]) {
        map[info.network] = []
        nets.push(info.network)
      }
      map[info.network].push(code)
    }
    const inNet = selectedNetwork ? (map[selectedNetwork] || []) : []
    return { networks: nets, currenciesInNetwork: inNet }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta_, selectedNetwork])

  // One-tap wallet deep-link + URI-QR value (null for token/EVM/TRON chains).
  // Uses the OUTSTANDING amount during an underpayment so the machine-readable
  // QR / deep link never disagrees with the human-readable instruction.
  const paymentUri = useMemo(() => {
    if (!cryptoInfo) return null
    const netCode = CRYPTO_INFO[cryptoInfo.crypto_display]?.network || cryptoInfo.network
    const amt = phase === 'underpaid' && partial ? partial.remainingAmount : cryptoInfo.expected_amount
    return buildPaymentUri(netCode, cryptoInfo.address, amt, cryptoInfo.crypto_base)
  }, [cryptoInfo, phase, partial])

  // Exact crypto amount the buyer must still send NOW — the outstanding
  // remainder during an underpayment, else the full expected amount. Every
  // amount surface (instruction, AMOUNT row, copy, sticky bar) uses this.
  const amountToSend = phase === 'underpaid' && partial ? partial.remainingAmount : (cryptoInfo?.expected_amount ?? 0)

  // Auto-select network when meta loads — prefer the customer's remembered
  // choice (per-device) so a returning visitor lands on their usual coin.
  useEffect(() => {
    if (!meta_) return
    if (selectedNetwork) return
    if (networks.length === 0) return
    const saved = readCheckoutPref(PREF_NET_KEY)
    setSelectedNetwork(saved && networks.includes(saved) ? saved : networks[0])
  }, [meta_, networks, selectedNetwork])

  // Auto-select the currency in the chosen network — prefer the remembered one
  useEffect(() => {
    if (!selectedNetwork) return
    if (currenciesInNetwork.length === 0) {
      setSelectedCurrency('')
      return
    }
    if (!currenciesInNetwork.includes(selectedCurrency)) {
      const saved = readCheckoutPref(PREF_CUR_KEY)
      setSelectedCurrency(saved && currenciesInNetwork.includes(saved) ? saved : currenciesInNetwork[0])
    }
  }, [selectedNetwork, currenciesInNetwork, selectedCurrency])

  // Persist the customer's chosen network + currency (per-device).
  useEffect(() => {
    if (selectedNetwork) writeCheckoutPref(PREF_NET_KEY, selectedNetwork)
  }, [selectedNetwork])
  useEffect(() => {
    if (selectedCurrency) writeCheckoutPref(PREF_CUR_KEY, selectedCurrency)
  }, [selectedCurrency])

  // ─── Step 2: reserve address via /pay/addPayment ──────────────────
  const reservePayment = useCallback(async (code: string) => {
    if (!meta_) return
    const info = CRYPTO_INFO[code]
    if (!info) {
      setErrorMsg(`Unsupported currency: ${code}`)
      setPhase('error')
      return
    }
    setPhase('creating_payment')
    setErrorMsg('')

    const token = meta_.token

    // 1. get the crypto rate.
    //    IMPORTANT: forward fee_payer + tax_amount exactly like the legacy
    //    checkout (cryptoTransfer.tsx). For customer-pays links the backend
    //    then returns `total_amount` = base + tax + fees (in crypto) so the
    //    customer is charged the full amount and the merchant is settled the
    //    full base. Omitting these made getCurrencyRates return base-only,
    //    which addPayment later fee-deducted from the merchant (revenue leak).
    const feePayer = meta_.fee_payer || 'company'
    const taxAmount = Number(meta_.tax_amount) || 0
    const baseAmount = Number(meta_.amount) || 0
    // customer pays fees → send base only (backend adds tax + fees);
    // company pays fees → send tax-inclusive amount (backend returns raw conversion).
    const amountForRates = feePayer === 'customer' ? baseAmount : baseAmount + taxAmount
    const rateRes = await api('/pay/getCurrencyRates', {
      source: meta_.base_currency,
      amount: amountForRates,
      currencyList: [info.symbol],
      fixedDecimal: false,
      fee_payer: feePayer,
      tax_amount: taxAmount,
    }, token)
    if (!mountedRef.current) return
    if (!rateRes.ok || !Array.isArray(rateRes.data) || !rateRes.data[0]) {
      setErrorMsg(rateRes.message || 'Failed to get exchange rate.')
      setPhase('error')
      return
    }
    const rateRow: any = rateRes.data[0]
    // Money-safety: for customer-pays links the backend MUST return a
    // fee-inclusive `total_amount`. If the per-currency fee calc failed
    // (fee_error) or total_amount is missing, fail CLOSED rather than falling
    // back to the base-only `amount` — undercharging here would make the
    // merchant silently absorb the processing fee.
    if (feePayer === 'customer' && (rateRow.fee_error || rateRow.total_amount == null)) {
      setErrorMsg('Could not calculate the network fee for this coin. Please try again or choose a different coin.')
      setPhase('error')
      return
    }
    const cryptoAmount: number = Number(rateRow.total_amount ?? rateRow.amount) || 0
    if (!cryptoAmount) {
      setErrorMsg('Rate unavailable for this currency.')
      setPhase('error')
      return
    }
    // Timestamp the moment we locked this live rate — surfaced to the customer
    // as a subtle "Rate updated Xs ago" hint so the amount feels live/trusted.
    setRateFetchedAt(Date.now())

    // Capture the exact fee + total (in base currency) for the header breakdown.
    // Backend returns these in SOURCE currency for customer-pays links.
    if (feePayer === 'customer') {
      const exactFee = Number(rateRow.processing_fee) || 0
      const exactTotal = Number(rateRow.total_amount_source ?? rateRow.total_amount_usd) || (baseAmount + taxAmount + exactFee)
      setFeeExact({ fee: exactFee, total: exactTotal })
    }

    // 2. encrypt payload
    const payload = { currency: code, amount: cryptoAmount, paymentType: 'CRYPTO' }
    const encRes = await api('/pay/encrypt-payload', { payload: JSON.stringify(payload) }, undefined)
    if (!mountedRef.current) return
    if (!encRes.ok || !encRes.data?.data) {
      setErrorMsg(encRes.message || 'Failed to encrypt payment.')
      setPhase('error')
      return
    }
    const encrypted = encRes.data.data

    // 3. addPayment → reserves an address from the merchant pool
    const addRes = await api('/pay/addPayment', { data: encrypted }, token)
    if (!mountedRef.current) return
    if (!addRes.ok || !addRes.data) {
      setErrorMsg(addRes.message || 'Failed to create payment.')
      setPhase('error')
      return
    }
    const r: any = addRes.data
    const address = String(r.address || '')
    if (!address) {
      setErrorMsg('No payment address received.')
      setPhase('error')
      return
    }
    setCryptoInfo({
      address,
      qr_code: String(r.qr_code || ''),
      memo: String(r.memo || r.tag || r.destination_tag || r.dt || ''),
      expected_amount: cryptoAmount,
      crypto_display: code,
      crypto_base: info.symbol,
      network: info.network,
    })
    const timerMins: number =
      Number(r.remaining_minutes) || Number(r.expires_in_minutes) || Number(r.expiration_minutes) || 30
    setTimeLeft(timerMins * 60)
    setTotalSeconds(timerMins * 60)
    setDetected(false)
    setPhase('awaiting_payment')
  }, [meta_])

  // Auto-reserve when both selects are populated
  useEffect(() => {
    if (phase !== 'currency_select') return
    if (!selectedCurrency) return
    reservePayment(selectedCurrency)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCurrency])

  // ─── Step 3: poll /pay/verifyCryptoPayment ────────────────────────
  useEffect(() => {
    if (phase !== 'awaiting_payment' && phase !== 'underpaid') return
    if (!cryptoInfo?.address || !meta_?.token) return

    const poll = async () => {
      const r = await api('/pay/verifyCryptoPayment', { address: cryptoInfo.address }, meta_.token)
      if (!mountedRef.current) return
      if (!r.ok || !r.data) return
      const s = String(r.data.status || 'waiting')
      const d_: any = r.data
      if (d_.remaining_seconds !== undefined && d_.remaining_seconds > 0) {
        setTimeLeft(Number(d_.remaining_seconds))
        setTotalSeconds((prev) => Math.max(prev, Number(d_.remaining_seconds)))
      }
      // Live "detected" signal: backend 'pending' = tx seen, awaiting
      // confirmation; 'underpaid' also means funds were received (partial).
      if (s === 'pending') {
        setDetected(true)
      } else if (s === 'underpaid') {
        setDetected(true)
        setPhase('underpaid')
        setPartial({
          paidAmount: Number(d_.paidAmount || 0),
          remainingAmount: Number(d_.remainingAmount || 0),
          remainingAmountUsd: Number(d_.remainingAmountUsd || 0),
          currency: String(d_.currency || cryptoInfo.crypto_base),
          baseCurrency: String(d_.baseCurrency || meta_.base_currency),
        })
      } else if (s === 'waiting') {
        setDetected(false)
      }
      if (s === 'confirmed' || s === 'overpaid') {
        setConfirmedAmount({
          crypto: Number(d_.paidAmount || d_.expectedAmount || cryptoInfo.expected_amount),
          fiat: Number(d_.paidAmountUsd || meta_.amount),
          fiatCurrency: String(d_.baseCurrency || meta_.base_currency),
        })
        setPhase('confirmed')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
        if (onSuccess) { try { onSuccess() } catch { /* ignore */ } }
        return
      }
      if (s === 'expired') {
        setPhase('expired')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
    }
    poll()
    pollRef.current = setInterval(poll, 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cryptoInfo, meta_])

  // ─── Timer countdown ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'awaiting_payment' && phase !== 'underpaid') return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          setPhase('expired')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  // ─── Submit refund address to backend (best-effort, non-blocking) ──
  const saveRefundAddress = useCallback(async (addr: string) => {
    if (!meta_?.token || !addr.trim()) return
    // Fire and forget — backend endpoint is idempotent per ref.
    await api('/pay/setRefundAddress', { data: d, refund_address: addr.trim() }, meta_.token)
  }, [d, meta_])

  // ─── Save the optional receipt email (best-effort, non-blocking) ──
  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const emailInvalid = receiptEmail.trim().length > 0 && !emailValid(receiptEmail)
  const saveReceiptEmail = useCallback(async () => {
    const v = receiptEmail.trim().toLowerCase()
    if (!v || !emailValid(v) || !meta_?.token) return
    const r = await api('/pay/setCustomerEmail', { data: d, email: v }, meta_.token)
    if (r.ok && mountedRef.current) setEmailSaved(true)
  }, [receiptEmail, d, meta_])

  const timerLabel = useMemo(() => {
    const m = Math.floor(timeLeft / 60)
    const s = timeLeft % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [timeLeft])

  const doCopy = async (text: string, flag: 'addr' | 'amt') => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedFlag(flag)
      setTimeout(() => setCopiedFlag(''), 1600)
    }
  }

  // ─── Merchant + campaign name resolution ──────────────────────────
  const rawMerchantName = meta_?.merchant?.name || ''
  const merchantName = rawMerchantName || 'Merchant'
  const campaignTitle = meta_?.contribution?.campaign_title || ''
  const isContribution = meta_?.link_type === 'contribution' || !!meta_?.contribution
  // Headline: prefer merchant NAME on payment links; campaign TITLE on contribs.
  // When the backend has no name, "Pay Merchant" read as broken copy (UI/UX
  // audit) — fall back to an action headline instead.
  const headline = isContribution
    ? (campaignTitle || (rawMerchantName ? `Support ${rawMerchantName}` : t('checkout.supportFallbackTitle', { defaultValue: 'Support this campaign' })))
    : (rawMerchantName ? `Pay ${rawMerchantName}` : t('checkout.completePaymentTitle', { defaultValue: 'Complete your payment' }))

  // Portal-mount guard for the mobile sticky pay bar (SSR-safe).
  useEffect(() => setPortalReady(true), [])

  // Share the checkout/campaign link — Web Share API with clipboard fallback.
  // Helps a happy buyer/contributor pull more people in ("I just supported …").
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const who = isContribution ? campaignTitle || merchantName : merchantName
    const title = isContribution
      ? `I just supported ${who}`
      : `I just paid ${who} with crypto`
    const text = isContribution
      ? `${title} on Dynopay — join me and chip in!`
      : `${title} on Dynopay.`
    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator) : null
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title, text, url })
        return
      }
    } catch {
      /* user dismissed the share sheet or it failed → fall through to copy */
    }
    const ok = await copyToClipboard(url ? `${text} ${url}` : text)
    if (ok) {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  // Download a branded PDF receipt for the confirmed payment (POST /pay/receipt).
  // Authoritative, server-generated — same PDF the confirmation email attaches.
  const handleDownloadReceipt = async () => {
    if (receiptState === 'busy') return
    if (!cryptoInfo?.address || !meta_?.token) {
      setReceiptState('error')
      return
    }
    setReceiptState('busy')
    try {
      const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
      const res = await fetch(`${base}/api/pay/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${meta_.token}`,
        },
        body: JSON.stringify({ address: cryptoInfo.address }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const dispo = res.headers.get('Content-Disposition') || ''
      const nameMatch = dispo.match(/filename="?([^";]+)"?/)
      const filename = nameMatch?.[1] || `Dynopay_Receipt_${Date.now()}.pdf`
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
      setReceiptState('done')
      setTimeout(() => setReceiptState('idle'), 2500)
    } catch {
      setReceiptState('error')
      setTimeout(() => setReceiptState('idle'), 4000)
    }
  }

  // Fiat amount formatted using the same helper as the rest of the app
  const fiatSymbol = meta_ ? getCurrencySymbolFromFormat(meta_.base_currency) : '$'
  const fiatAmount = meta_ ? formatWithSeparators(Number(meta_.amount || 0), meta_.base_currency) : '0.00'

  // ── Transparent fee/total breakdown (customer-pays links + tax) ──
  // Shows "Amount + Network fee = Total" so customer-pays totals are explicit.
  const feePayerIsCustomer = (meta_?.fee_payer || 'company') === 'customer'
  const baseAmt = Number(meta_?.amount) || 0
  const taxAmt = Number(meta_?.tax_amount) || 0
  const feeAmt = feeExact ? feeExact.fee : (Number(meta_?.estimated_fee) || 0)
  const totalAmt = feeExact ? feeExact.total : (baseAmt + taxAmt + feeAmt)
  const feeIsEstimate = feePayerIsCustomer && !feeExact
  const showBreakdown = !!meta_ && (feePayerIsCustomer || taxAmt > 0)
  const fmtFiat = (n: number) => `${fiatSymbol}${formatWithSeparators(n, meta_?.base_currency || 'USD')}`

  // Fire the opt-in browser alert the instant the payment confirms so a buyer
  // who switched tabs is pinged. Ref-guarded so it fires exactly once.
  useEffect(() => {
    if (phase !== 'confirmed' || notifiedRef.current) return
    notifiedRef.current = true
    const who = isContribution ? (campaignTitle || merchantName) : merchantName
    notif.notify(
      t('checkout.notify.title', { defaultValue: 'Payment confirmed \u2713' }),
      t('checkout.notify.body', { defaultValue: 'Your payment to {{name}} is confirmed.', name: who }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ─── LOADING ──────────────────────────────────────────────────────
  if (phase === 'loading_meta' || phase === 'creating_payment') {
    return (
      <PanelShell isDark={isDark} border={border} muted={muted}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2} py={8}>
          <Box
            sx={{
              width: 28, height: 28, borderRadius: '50%',
              border: `3px solid ${border}`, borderTopColor: INK,
              animation: 'spin 800ms linear infinite',
              '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
            }}
          />
          <Typography fontSize={13.5} color={muted}>
            {phase === 'loading_meta' ? 'Loading checkout…' : 'Preparing payment address…'}
          </Typography>
        </Box>
      </PanelShell>
    )
  }

  // ─── ERROR ────────────────────────────────────────────────────────
  if (phase === 'error' || phase === 'failed') {
    return (
      <PanelShell isDark={isDark} border={border} muted={muted}>
        <Alert severity="error" sx={{ borderRadius: '10px' }} data-testid="clean-checkout-error">
          {errorMsg || 'Something went wrong.'}
        </Alert>
      </PanelShell>
    )
  }

  // ─── CONFIRMED ────────────────────────────────────────────────────
  if (phase === 'confirmed' && confirmedAmount && meta_) {
    return (
      <PanelShell isDark={isDark} border={border} muted={muted}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 3 }}>
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: LIME,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mb: 2,
            }}
            data-testid="clean-checkout-success-icon"
          >
            <Icon icon="mdi:check-bold" width={36} color={ON_BRAND} />
          </Box>
          <Typography fontWeight={700} fontSize={22} letterSpacing="-0.5px" color={theme.palette.text.primary}>
            {isContribution ? t('checkout.success.titleContribution', { defaultValue: 'Thank you for contributing!' }) : t('checkout.success.title', { defaultValue: 'Payment successful' })}
          </Typography>
          <Typography fontSize={14} color={muted} mt={1}>
            {isContribution ? campaignTitle || merchantName : t('checkout.success.paidTo', { defaultValue: 'Paid to {{name}}', name: merchantName })} — {feePayerIsCustomer ? fmtFiat(totalAmt) : `${fiatSymbol}${fiatAmount}`}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: muted, mt: 0.5 }}>
            {formatCryptoAmount(confirmedAmount.crypto, cryptoInfo?.crypto_base || 'BTC')} {cryptoInfo?.crypto_base}
          </Typography>

          {/* Download receipt — proof of payment the customer can keep */}
          <Button
            variant="outlined"
            disableElevation
            data-testid="clean-checkout-receipt-btn"
            onClick={handleDownloadReceipt}
            disabled={receiptState === 'busy'}
            startIcon={
              receiptState === 'busy'
                ? <Icon icon="mdi:loading" width={18} className="dyno-spin" />
                : <Icon icon={receiptState === 'done' ? 'mdi:check' : 'mdi:file-download-outline'} width={18} />
            }
            sx={{
              mt: 2.25,
              textTransform: 'none',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: 13.5,
              px: 2.5,
              minHeight: 40,
              color: theme.palette.text.primary,
              borderColor: border,
              '&:hover': { borderColor: theme.palette.text.primary, backgroundColor: 'transparent' },
              '& .dyno-spin': { animation: 'dynospin 800ms linear infinite' },
              '@keyframes dynospin': { to: { transform: 'rotate(360deg)' } },
            }}
          >
            {receiptState === 'busy'
              ? t('checkout.receipt.preparing', { defaultValue: 'Preparing receipt…' })
              : receiptState === 'done'
                ? t('checkout.receipt.downloaded', { defaultValue: 'Receipt downloaded' })
                : t('checkout.receipt.download', { defaultValue: 'Download receipt' })}
          </Button>
          {receiptState === 'error' && (
            <Typography data-testid="clean-checkout-receipt-error" sx={{ fontSize: 12, color: errFg, mt: 0.75 }}>
              {t('checkout.receipt.error', { defaultValue: 'Could not fetch the receipt — please try again.' })}
            </Typography>
          )}
        </Box>

        {/* ── Share card — turn a happy buyer/contributor into a promoter ── */}
        <Box
          data-testid="clean-checkout-share"
          sx={{
            mt: 1,
            p: 2,
            borderRadius: '12px',
            border: `1px solid ${border}`,
            backgroundColor: isDark ? 'rgba(79,70,229,0.06)' : 'rgba(10,10,10,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          <Typography fontSize={13} color={muted} textAlign="center">
            {isContribution
              ? t('checkout.share.promptContribution', { defaultValue: 'Help {{name}} reach more people', name: campaignTitle || merchantName })
              : t('checkout.share.prompt', { defaultValue: 'Enjoyed paying with crypto? Spread the word' })}
          </Typography>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            data-testid="clean-checkout-share-btn"
            onClick={handleShare}
            startIcon={<Icon icon={shareCopied ? 'mdi:check' : 'mdi:share-variant'} width={20} />}
            sx={{
              backgroundColor: LIME,
              color: ON_BRAND,
              textTransform: 'none',
              borderRadius: '999px',
              fontWeight: 800,
              fontSize: 15,
              minHeight: 48,
              '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
            }}
          >
            {shareCopied
              ? t('checkout.share.copied', { defaultValue: 'Link copied!' })
              : isContribution
                ? t('checkout.share.fundraiser', { defaultValue: 'Share this fundraiser' })
                : t('checkout.share.dynopay', { defaultValue: 'Share Dynopay' })}
          </Button>
        </Box>
      </PanelShell>
    )
  }

  // ─── EXPIRED ──────────────────────────────────────────────────────
  if (phase === 'expired') {
    return (
      <PanelShell isDark={isDark} border={border} muted={muted}>
        <Box sx={{ p: 2.5, borderRadius: '10px', border: `1px solid ${border}`, backgroundColor: errBg, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icon icon="mdi:timer-off-outline" width={22} color={errFg} />
            <Typography fontWeight={700} fontSize={15}>{t('checkout.expired.title')}</Typography>
          </Box>
          <Typography fontSize={13} color={muted} mt={0.5}>
            {t('checkout.expired.body')}
          </Typography>
        </Box>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          data-testid="clean-checkout-retry"
          onClick={() => {
            setCryptoInfo(null)
            setSelectedCurrency('')
            setTimeLeft(0)
            setPhase('currency_select')
            // Trigger cascade: setSelectedCurrency will refire the effect.
          }}
          sx={{
            backgroundColor: LIME, color: ON_BRAND, textTransform: 'none',
            borderRadius: '10px', fontWeight: 700, py: 1.2,
            '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
          }}
        >
          {t('checkout.expired.startNew')}
        </Button>
      </PanelShell>
    )
  }

  // ─── MAIN VIEW (currency_select | awaiting_payment | underpaid) ───
  //
  // Aurora status strip (design audit 2026-08-05, session 4).
  // Maps v2's compressed FSM to the CheckoutShell 5-state visual language:
  //   currency_select               → no strip (buyer still picking a coin)
  //   awaiting_payment (!detected)  → pending    (aurora pulse blob)
  //   awaiting_payment (detected)   → confirming (sky-blue spinning ring)
  //   underpaid                     → confirming (funds arrived, partial)
  //   confirmed                     → HANDLED IN THE EARLIER `phase === 'confirmed'` BRANCH
  //                                   (own success view + canvas-confetti)
  //   expired | failed | error      → HANDLED IN EARLIER RETURN BRANCHES so
  //                                   TypeScript's control-flow narrowing
  //                                   confirms they're unreachable here.
  //
  // The strip renders NOTHING for currency_select — buyers who haven't
  // picked a coin yet don't need a "waiting" prompt.
  const stripState: CheckoutState | null = (() => {
    if (phase === 'awaiting_payment') return detected ? 'confirming' : 'pending';
    // 'underpaid' intentionally shows NO top strip — the dedicated amber
    // "action required" banner below carries the message + remaining amount,
    // avoiding a misleading "Broadcasting on-chain / confirming" header.
    return null;
  })();

  return (
    <>
    <PanelShell isDark={isDark} border={border} muted={muted}>
      {stripState && (
        <CheckoutStatusStrip
          state={stripState}
          secondsRemaining={timeLeft}
          data-testid="pay-status-strip"
        />
      )}
      {/* Brand row (small, top) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        {meta_?.merchant?.company_logo ? (
          <Box component="img" src={meta_.merchant.company_logo} alt="" sx={{ height: 24, objectFit: 'contain' }} />
        ) : (
          <Logo width={22} height={26} />
        )}
        <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: muted }}>
          DYNOPAY
        </Typography>
      </Box>

      {/* H1: Merchant / Campaign name */}
      <Typography
        component="h1"
        data-testid="clean-checkout-h1"
        sx={{
          fontSize: { xs: 26, sm: 32 },
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          color: theme.palette.text.primary,
        }}
      >
        {headline}
      </Typography>

      {/* Amount subheadline — single line, OR a transparent breakdown when the
          customer pays fees / tax applies (Amount + Network fee = Total). */}
      {showBreakdown ? (
        <Box
          data-testid="clean-checkout-fee-breakdown"
          sx={{ mt: 0.75, mb: 3.5, display: 'flex', flexDirection: 'column', gap: 0.6 }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography sx={{ fontSize: 13, color: muted }}>
              {t('checkout.amount', { defaultValue: 'Amount' })}
            </Typography>
            <Typography data-testid="clean-checkout-breakdown-base" sx={{ fontFamily: MONO, fontSize: 13.5, color: muted }}>
              {fmtFiat(baseAmt)}
            </Typography>
          </Box>
          {taxAmt > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: 13, color: muted }}>
                {t('checkout.tax', { defaultValue: 'Tax' })}
              </Typography>
              <Typography data-testid="clean-checkout-breakdown-tax" sx={{ fontFamily: MONO, fontSize: 13.5, color: muted }}>
                +{fmtFiat(taxAmt)}
              </Typography>
            </Box>
          )}
          {feePayerIsCustomer && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: 13, color: muted }}>
                {t('checkout.processingFee', { defaultValue: 'Processing fee' })}
                {feeIsEstimate && (
                  <Typography component="span" sx={{ fontSize: 11, color: muted, ml: 0.5, opacity: 0.75 }}>
                    ({t('checkout.estimated', { defaultValue: 'est.' })})
                  </Typography>
                )}
              </Typography>
              <Typography data-testid="clean-checkout-breakdown-fee" sx={{ fontFamily: MONO, fontSize: 13.5, color: muted }}>
                +{fmtFiat(feeAmt)}
              </Typography>
            </Box>
          )}
          <Box sx={{ height: '1px', backgroundColor: border, my: 0.4 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>
              {feePayerIsCustomer
                ? t('checkout.totalYouPay', { defaultValue: 'Total you pay' })
                : t('checkout.total', { defaultValue: 'Total' })}
            </Typography>
            <Typography
              data-testid="clean-checkout-amount"
              sx={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: theme.palette.text.primary }}
            >
              {fmtFiat(totalAmt)} {meta_?.base_currency || ''}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Typography
          data-testid="clean-checkout-amount"
          sx={{
            fontFamily: MONO,
            fontSize: 18,
            fontWeight: 500,
            color: muted,
            mt: 0.75,
            mb: 3.5,
          }}
        >
          {fiatSymbol}{fiatAmount} {meta_?.base_currency || ''}
        </Typography>
      )}

      {/* Reference row (invoice / campaign / description) */}
      {(meta_?.order_reference || meta_?.description) && (
        <Box
          sx={{
            display: 'flex', flexDirection: 'column', gap: 0.5,
            p: 1.5, borderRadius: '10px',
            border: `1px solid ${border}`,
            backgroundColor: surface, mb: 2.5,
          }}
        >
          {meta_.description && (
            <Typography fontSize={13} color={theme.palette.text.primary} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {meta_.description}
            </Typography>
          )}
          {meta_.order_reference && (
            <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: muted }}>
              {t('checkout.reference', { defaultValue: 'REFERENCE' })} · {meta_.order_reference}
            </Typography>
          )}
        </Box>
      )}

      {/* Network + Currency selects */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, mb: 0.5, letterSpacing: '0.02em' }}>
            {t('checkout.networkLabel', { defaultValue: 'NETWORK' })}
          </Typography>
          <Select
            fullWidth
            size="small"
            data-testid="clean-checkout-network-select"
            value={selectedNetwork || ''}
            onChange={(e) => {
              // Changing network resets any in-flight address reservation.
              // The child currency select will auto-pick the first available.
              setCryptoInfo(null)
              setSelectedCurrency('')
              setSelectedNetwork(String(e.target.value))
              setPhase('currency_select')
            }}
            sx={{
              borderRadius: '8px',
              minHeight: 46,
              '& .MuiSelect-select': { paddingTop: '11px', paddingBottom: '11px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: border },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: muted },
            }}
          >
            {networks.map((n) => {
              // Grab any currency in this network to get the network label / icon
              const anyCode = meta_!.available_currencies.find((c) => CRYPTO_INFO[c]?.network === n)
              const info = anyCode ? CRYPTO_INFO[anyCode] : null
              return (
                <MenuItem key={n} value={n}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {info && <Icon icon={info.icon} width={18} color={info.iconColor} />}
                    <span>{info?.networkLabel || n}</span>
                  </Box>
                </MenuItem>
              )
            })}
          </Select>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, mb: 0.5, letterSpacing: '0.02em' }}>
            {t('checkout.currencyLabel', { defaultValue: 'CURRENCY' })}
          </Typography>
          <Select
            fullWidth
            size="small"
            data-testid="clean-checkout-currency-select"
            value={selectedCurrency || ''}
            onChange={(e) => {
              setCryptoInfo(null)
              const code = String(e.target.value)
              setSelectedCurrency(code)
              setPhase('currency_select')
            }}
            sx={{
              borderRadius: '8px',
              minHeight: 46,
              '& .MuiSelect-select': { paddingTop: '11px', paddingBottom: '11px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: border },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: muted },
            }}
          >
            {currenciesInNetwork.map((code) => {
              const info = CRYPTO_INFO[code]
              return (
                <MenuItem key={code} value={code}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon icon={info.icon} width={18} color={info.iconColor} />
                    <span>{info.symbol}</span>
                  </Box>
                </MenuItem>
              )
            })}
          </Select>
        </Box>
      </Box>

      {/* Optional "Email me a receipt" — attaches a recipient to the checkout
          session so the post-payment receipt email fires for anonymous payers. */}
      <ReceiptEmailField
        value={receiptEmail}
        onChange={(v) => { setReceiptEmail(v); setEmailSaved(false) }}
        onSave={saveReceiptEmail}
        saved={emailSaved}
        invalid={emailInvalid}
        label={t('checkout.receiptEmail.label', { defaultValue: 'Email me a receipt (optional)' })}
        helper={t('checkout.receiptEmail.helper', { defaultValue: "We'll email your receipt the moment this payment confirms." })}
        savedLabel={t('checkout.receiptEmail.saved', { defaultValue: "Receipt will be sent to this email." })}
        invalidLabel={t('checkout.receiptEmail.invalid', { defaultValue: 'Enter a valid email address.' })}
        muted={muted}
        border={border}
      />

      {/* Partial-payment (underpaid) banner — tells the buyer exactly how much
          MORE to send to the SAME address shown below to complete the payment. */}
      {phase === 'underpaid' && partial && cryptoInfo && (
        <Box
          data-testid="clean-checkout-underpaid-banner"
          sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5, mb: 2,
            borderRadius: '10px', border: `1px solid ${warnFg}55`, backgroundColor: warnBg,
          }}
        >
          <Icon icon="mdi:alert-circle-outline" width={20} color={warnFg} style={{ flexShrink: 0, marginTop: 1 }} />
          <Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: theme.palette.text.primary, mb: 0.25 }}>
              {t('checkout.status.underpaid', { defaultValue: 'Underpayment detected' })}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.primary, lineHeight: 1.5 }}>
              {t('checkout.underpaid.gotPrefix', { defaultValue: 'We received' })}{' '}
              {formatCryptoAmount(partial.paidAmount, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}.{' '}
              {t('checkout.underpaid.sendPrefix', { defaultValue: 'Send' })}{' '}
              <strong data-testid="clean-checkout-underpaid-remaining">
                {formatCryptoAmount(partial.remainingAmount, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}
              </strong>
              {partial.remainingAmountUsd > 0 && (
                <> (≈ {fmtFiat(partial.remainingAmountUsd)} {partial.baseCurrency})</>
              )}{' '}
              {t('checkout.underpaid.sameAddressTail', { defaultValue: 'more to the same address below to complete your payment.' })}
            </Typography>
            <Typography
              data-testid="clean-checkout-underpaid-timer"
              sx={{ fontSize: 11.5, color: theme.palette.text.secondary, mt: 0.6, display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Icon icon="mdi:timer-outline" width={13} />
              {t('checkout.underpaid.graceTimer', { defaultValue: 'Time left to complete' })}:{' '}
              <Box component="span" sx={{ fontFamily: MONO, fontWeight: 700, color: theme.palette.text.primary }}>{timerLabel}</Box>
            </Typography>
          </Box>
        </Box>
      )}

      {/* Instruction sentence */}
      {cryptoInfo && (
        <Typography
          data-testid="clean-checkout-instruction"
          sx={{ fontSize: 14, color: theme.palette.text.primary, textAlign: 'center', mb: 2 }}
        >
          {t('checkout.payPrefix', { defaultValue: 'Pay' })} <strong>{formatCryptoAmount(amountToSend, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}</strong> {t('checkout.payOn', { defaultValue: 'on' })} {CRYPTO_INFO[cryptoInfo.crypto_display]?.networkLabel || cryptoInfo.network}
        </Typography>
      )}

      {/* Opt-in browser alert while waiting on confirmations */}
      {cryptoInfo && (phase === 'awaiting_payment' || phase === 'underpaid') && (
        <NotifyMeInline
          supported={notif.supported}
          permission={notif.permission}
          onEnable={() => { void notif.requestPermission() }}
          ctaLabel={t('checkout.notify.cta', { defaultValue: 'Notify me when it confirms' })}
          enabledLabel={t('checkout.notify.enabled', { defaultValue: "You'll get a browser alert when it confirms." })}
          muted={muted}
          border={border}
          accent={LIME}
        />
      )}

      {/* QR code — crisp & responsive; tap the QR to copy the address */}
      {cryptoInfo && (cryptoInfo.qr_code || paymentUri) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <Box
            component="button"
            type="button"
            onClick={() => doCopy(cryptoInfo.address, 'addr')}
            aria-label="Tap to copy payment address"
            data-testid="clean-checkout-qr-panel"
            sx={{
              p: 2, borderRadius: '16px',
              border: `1px solid ${border}`, backgroundColor: '#FFFFFF',
              boxShadow: '0 4px 22px rgba(0,0,0,0.08)',
              width: '100%', maxWidth: 264, mx: 'auto', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              transition: 'transform .15s ease, box-shadow .15s ease',
              '&:hover': { boxShadow: '0 6px 28px rgba(0,0,0,0.13)' },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            {paymentUri ? (
              // URI-encoded QR — scanning with a wallet app pre-fills the
              // address AND amount (BIP-21 / Solana Pay).
              <QRCodeSVG
                value={paymentUri.uri}
                size={220}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#000000"
                style={{ width: '100%', maxWidth: 220, height: 'auto', display: 'block' }}
                data-testid="clean-checkout-qr-svg"
              />
            ) : (
              <Box
                component="img"
                src={cryptoInfo.qr_code.startsWith('data:') ? cryptoInfo.qr_code : `data:image/png;base64,${cryptoInfo.qr_code}`}
                alt="Payment QR code"
                sx={{
                  width: '100%', maxWidth: 220, height: 'auto',
                  aspectRatio: '1 / 1', objectFit: 'contain',
                  imageRendering: 'pixelated', display: 'block',
                }}
                data-testid="clean-checkout-qr-img"
              />
            )}
          </Box>
          <Typography
            data-testid="clean-checkout-qr-hint"
            sx={{ mt: 1, fontSize: 12, fontWeight: 600, color: copiedFlag === 'addr' ? LIME : muted, display: 'flex', alignItems: 'center', gap: 0.4 }}
          >
            <Icon icon={copiedFlag === 'addr' ? 'mdi:check-circle' : 'mdi:content-copy'} width={13} />
            {copiedFlag === 'addr' ? t('checkout.addressCopied', { defaultValue: 'Address copied' }) : t('checkout.tapQr', { defaultValue: 'Tap the QR to copy the address' })}
          </Typography>
        </Box>
      )}

      {/* Warning callout */}
      {cryptoInfo && (
        <Box
          sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5, mb: 2,
            borderRadius: '10px', border: `1px solid ${warnFg}33`, backgroundColor: warnBg,
          }}
          data-testid="clean-checkout-warn"
        >
          <Icon icon="mdi:alert-outline" width={18} color={warnFg} style={{ flexShrink: 0, marginTop: 2 }} />
          <Typography sx={{ fontSize: 12.5, color: theme.palette.text.primary, lineHeight: 1.5 }}>
            {t('checkout.sendWarning.line')} <strong>{cryptoInfo.crypto_base}</strong> {t('checkout.sendWarning.orNetwork', { defaultValue: 'or using any network other than' })} <strong>{CRYPTO_INFO[cryptoInfo.crypto_display]?.networkLabel || cryptoInfo.network}</strong> {t('checkout.sendWarning.willResult', { defaultValue: 'will result in the permanent and irreversible loss of the funds.' })}
          </Typography>
        </Box>
      )}

      {/* Address row */}
      {cryptoInfo && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, mb: 0.5, letterSpacing: '0.02em' }}>
            {t('checkout.addressLabel', { defaultValue: 'ADDRESS' })}
          </Typography>
          <Box
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 1, p: 1.25, borderRadius: '8px',
              border: `1px solid ${border}`, backgroundColor: surface,
            }}
          >
            <Typography
              data-testid="clean-checkout-address"
              sx={{ fontFamily: MONO, fontSize: 12.5, flex: 1, minWidth: 0, wordBreak: 'break-all', color: theme.palette.text.primary }}
            >
              {cryptoInfo.address}
            </Typography>
            <Box
              component="button"
              data-testid="clean-checkout-copy-address"
              onClick={() => doCopy(cryptoInfo.address, 'addr')}
              sx={{
                background: 'none', border: `1px solid ${border}`, borderRadius: '8px',
                px: 1.5, py: 0.9, minHeight: 44, minWidth: 86, cursor: 'pointer', color: theme.palette.text.primary,
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.35,
              }}
            >
              <Icon icon={copiedFlag === 'addr' ? 'mdi:check' : 'mdi:content-copy'} width={12} />
              {copiedFlag === 'addr' ? t('checkout.copied', { defaultValue: 'Copied' }) : t('checkout.copy', { defaultValue: 'Copy' })}
            </Box>
          </Box>
        </Box>
      )}

      {/* Amount row */}
      {cryptoInfo && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, mb: 0.5, letterSpacing: '0.02em' }}>
            {t('checkout.amountLabel', { defaultValue: 'AMOUNT' })}
          </Typography>
          <Box
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 1, p: 1.25, borderRadius: '8px',
              border: `1px solid ${border}`, backgroundColor: surface,
            }}
          >
            <Typography sx={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }}>
              {formatCryptoAmount(amountToSend, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}
            </Typography>
            <Box
              component="button"
              data-testid="clean-checkout-copy-amount"
              onClick={() => doCopy(formatCryptoAmount(amountToSend, cryptoInfo.crypto_base), 'amt')}
              sx={{
                background: 'none', border: `1px solid ${border}`, borderRadius: '8px',
                px: 1.5, py: 0.9, minHeight: 44, minWidth: 86, cursor: 'pointer', color: theme.palette.text.primary,
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.35,
              }}
            >
              <Icon icon={copiedFlag === 'amt' ? 'mdi:check' : 'mdi:content-copy'} width={12} />
              {copiedFlag === 'amt' ? t('checkout.copied', { defaultValue: 'Copied' }) : t('checkout.copy', { defaultValue: 'Copy' })}
            </Box>
          </Box>
          <RateFreshness updatedAt={rateFetchedAt} color={muted} />
        </Box>
      )}

      {/* Open in wallet app — one-tap deep link (BIP-21 / Solana Pay). Only
          shown for native-coin chains where the amount is unambiguously
          encoded; token / EVM / TRON chains keep the copy + QR flow above. */}
      {paymentUri && (
        <Box sx={{ mb: 2 }}>
          <Box
            component="a"
            href={paymentUri.uri}
            data-testid="clean-checkout-open-wallet"
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6,
              width: '100%', minHeight: 48, borderRadius: '999px',
              border: `1px solid ${LIME}`, color: LIME, textDecoration: 'none',
              fontSize: 14, fontWeight: 700,
              backgroundColor: isDark ? 'rgba(79,70,229,0.06)' : 'rgba(79,70,229,0.05)',
              transition: 'filter .15s ease, transform .05s ease',
              '&:hover': { filter: 'brightness(1.06)' },
              '&:active': { transform: 'scale(0.99)' },
            }}
          >
            <Icon icon="mdi:wallet-outline" width={18} />
            {t('checkout.openInWallet', { defaultValue: 'Open in wallet app' })}
          </Box>
          <Typography sx={{ mt: 0.75, fontSize: 11.5, color: muted, textAlign: 'center' }}>
            {t('checkout.openInWalletHint', { defaultValue: 'Opens your crypto wallet with the address and amount pre-filled.' })}
          </Typography>
        </Box>
      )}

      {/* Memo / tag (XRP, XLM) — only if present */}
      {cryptoInfo?.memo && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: warnFg, mb: 0.5, letterSpacing: '0.02em' }}>
            {t('checkout.memoRequired.label')}
          </Typography>
          <Box
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 1, p: 1.25, borderRadius: '8px',
              border: `1px solid ${warnFg}55`, backgroundColor: warnBg,
            }}
          >
            <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: theme.palette.text.primary }}>
              {cryptoInfo.memo}
            </Typography>
            <Box
              component="button"
              onClick={() => doCopy(cryptoInfo.memo, 'amt')}
              sx={{
                background: 'none', border: `1px solid ${border}`, borderRadius: '8px',
                px: 1.5, py: 0.9, minHeight: 44, cursor: 'pointer', color: theme.palette.text.primary,
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.35,
              }}
            >
              <Icon icon="mdi:content-copy" width={12} /> {t('checkout.copy', { defaultValue: 'Copy' })}
            </Box>
          </Box>
        </Box>
      )}

      {/* Refund address (collapsible) */}
      {cryptoInfo && (
        <Box sx={{ mb: 2 }}>
          <Box
            component="button"
            data-testid="clean-checkout-refund-toggle"
            onClick={() => setShowRefundInput((v) => !v)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              background: 'none', border: 'none', p: 0, cursor: 'pointer',
              color: muted, fontSize: 12.5, fontWeight: 600,
              minHeight: { xs: 44, md: 'auto' },
            }}
          >
            <Icon icon={showRefundInput ? 'mdi:chevron-down' : 'mdi:chevron-right'} width={16} />
            {t('checkout.refund.label')}
          </Box>
          <Collapse in={showRefundInput}>
            <Typography fontSize={12} color={muted} mt={1}>
              {t('checkout.refund.help')}
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder={t('checkout.refundPlaceholder', { defaultValue: 'Your {{coin}} address for refunds', coin: cryptoInfo.crypto_base }) as string}
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              onBlur={(e) => saveRefundAddress(e.target.value)}
              data-testid="clean-checkout-refund-input"
              sx={{
                mt: 1,
                '& .MuiOutlinedInput-root': {
                  fontFamily: MONO, fontSize: 13, borderRadius: '8px',
                  '& fieldset': { borderColor: border },
                },
              }}
            />
          </Collapse>
        </Box>
      )}

      {/* Live status: Waiting → Detected → Confirmed timeline + pill + timer */}
      {cryptoInfo && (
        <CheckoutStatusTimeline
          phase={phase}
          detected={detected}
          timerLabel={timerLabel}
          secondsRemaining={timeLeft}
          totalSeconds={totalSeconds}
          isDark={isDark}
          t={t}
        />
      )}

      {/* Footer links */}
      <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography fontSize={11} color={muted}>
          {t('checkout.poweredBy', { defaultValue: 'Powered by' })} <strong style={{ color: theme.palette.text.primary }}>DYNOPAY</strong>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <a href="/pay/terms-of-service" target="_blank" rel="noopener noreferrer" style={{ color: muted, fontSize: 11, textDecoration: 'none' }}>
            {t('checkout.terms', { defaultValue: 'Terms' })}
          </a>
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: muted, fontSize: 11, textDecoration: 'none' }}>
            {t('checkout.privacy', { defaultValue: 'Privacy' })}
          </a>
        </Box>
      </Box>

      {/* Spacer so the mobile sticky pay bar never covers the footer/content */}
      {cryptoInfo && <Box sx={{ display: { xs: 'block', md: 'none' }, height: 92 }} />}
    </PanelShell>

      {/* ── Mobile sticky pay bar — amount + copy-address always in thumb reach.
          Rendered as a FRAGMENT sibling of PanelShell (not a Box child) so the
          portal node never trips MUI Box's PropTypes `children` check. ── */}
      {portalReady && cryptoInfo && phase !== 'confirmed' && createPortal(
        <Box
          data-testid="checkout-sticky-bar"
          sx={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1300,
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center', gap: 1.25,
            px: 2, pt: 1.25,
            pb: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
            backgroundColor: isDark ? 'rgba(15,15,16,0.94)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            borderTop: `1px solid ${border}`,
            boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
          }}
        >
          <Box sx={{ minWidth: 0, flexShrink: 1 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: muted, textTransform: 'uppercase', lineHeight: 1 }}>
              {t('checkout.sendExactly', { defaultValue: 'Send exactly' })}
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formatCryptoAmount(amountToSend, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}
            </Typography>
          </Box>
          {paymentUri ? (
            <>
              <Button
                component="a"
                href={paymentUri.uri}
                data-testid="checkout-sticky-open-wallet"
                disableElevation
                variant="contained"
                startIcon={<Icon icon="mdi:wallet-outline" width={18} />}
                sx={{
                  flex: 1, minHeight: 48, borderRadius: '999px', textTransform: 'none',
                  fontSize: 15, fontWeight: 800, backgroundColor: LIME, color: ON_BRAND,
                  whiteSpace: 'nowrap',
                  '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
                  '&:active': { transform: 'scale(0.99)' },
                }}
              >
                {t('checkout.openInWallet', { defaultValue: 'Open in wallet app' })}
              </Button>
              <Button
                data-testid="checkout-sticky-copy-address"
                onClick={() => doCopy(cryptoInfo.address, 'addr')}
                aria-label="Copy address"
                disableElevation
                variant="outlined"
                sx={{
                  minWidth: 48, width: 48, minHeight: 48, p: 0, borderRadius: '999px',
                  flexShrink: 0, borderColor: border, color: theme.palette.text.primary,
                  '&:hover': { borderColor: muted, backgroundColor: 'transparent' },
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                <Icon icon={copiedFlag === 'addr' ? 'mdi:check' : 'mdi:content-copy'} width={20} />
              </Button>
            </>
          ) : (
            <Button
              data-testid="checkout-sticky-copy-address"
              onClick={() => doCopy(cryptoInfo.address, 'addr')}
              disableElevation
              variant="contained"
              startIcon={<Icon icon={copiedFlag === 'addr' ? 'mdi:check' : 'mdi:content-copy'} width={18} />}
              sx={{
                flex: 1, minHeight: 48, borderRadius: '999px', textTransform: 'none',
                fontSize: 15, fontWeight: 800, backgroundColor: LIME, color: ON_BRAND,
                whiteSpace: 'nowrap',
                '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
                '&:active': { transform: 'scale(0.99)' },
              }}
            >
              {copiedFlag === 'addr' ? t('checkout.copiedExclaim', { defaultValue: 'Copied!' }) : t('checkout.copyAddress', { defaultValue: 'Copy address' })}
            </Button>
          )}
        </Box>,
        document.body,
      )}
    </>
  )
}

/**
 * Live payment status: pill + "Waiting → Detected → Confirmed" step timeline.
 * Pure/presentational so it can be rendered & verified in isolation.
 * NOTE: the backend does not expose a numeric confirmation count, so we show
 * discrete steps (never a fabricated "n of m").
 */
export const CheckoutStatusTimeline: React.FC<{
  phase: string
  detected: boolean
  timerLabel: string
  secondsRemaining?: number
  totalSeconds?: number
  isDark: boolean
  t: (key: string, opts?: { defaultValue?: string }) => string
}> = ({ phase, detected, timerLabel, secondsRemaining = 0, totalSeconds = 0, isDark, t }) => {
  const theme = useTheme()
  const border = isDark ? 'rgba(255,255,255,0.10)' : '#E4E4E7'
  const muted = isDark ? '#A1A1AA' : '#71717A'
  const warnFg = '#B45309'
  // Countdown progress (§5.12): a thin bar makes the time pressure legible at a
  // glance instead of only the mm:ss text. Turns amber in the final stretch.
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100)) : 0
  const barColor = pct <= 20 ? warnFg : LIME
  const showTimerBar = phase !== 'confirmed' && phase !== 'expired' && totalSeconds > 0
  const stepIndex = phase === 'confirmed' ? 2 : detected ? 1 : 0
  const isUnderpaid = phase === 'underpaid'
  const dotColor = isUnderpaid ? warnFg : detected ? LIME : '#22c55e'
  const statusText = isUnderpaid
    ? t('checkout.status.underpaid', { defaultValue: 'Underpayment detected' })
    : detected
      ? t('checkout.status.confirming', { defaultValue: 'Payment detected — confirming…' })
      : t('checkout.status.waiting', { defaultValue: 'Waiting for payment' })
  const steps = [
    t('checkout.step.waiting', { defaultValue: 'Waiting' }),
    t('checkout.step.detected', { defaultValue: 'Detected' }),
    t('checkout.step.confirmed', { defaultValue: 'Confirmed' }),
  ]
  return (
    <Box sx={{ mt: 2 }} data-testid="checkout-status">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.5, borderRadius: '999px',
          backgroundColor: 'transparent',
          border: `1px solid ${border}`,
        }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor,
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
          }} />
          <Typography data-testid="checkout-status-text" sx={{ fontSize: 11.5, fontWeight: 700 }}>
            {statusText}
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: MONO, fontSize: 12, color: muted, fontWeight: 600 }}>
          <Icon icon="mdi:timer-outline" width={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {timerLabel}
        </Typography>
      </Box>
      {/* Public-surfaces clarity pass: one plain-English line under the
          technical status while the network confirms. */}
      {detected && !isUnderpaid && phase !== 'confirmed' && (
        <Typography data-testid="checkout-human-confirming" sx={{ fontSize: 12, color: muted, mb: 1.25 }}>
          {t('checkout.humanConfirming', { defaultValue: 'We can see your payment — waiting for network confirmations (usually 5–15 min).' })}
        </Typography>
      )}
      {showTimerBar && (
        <Box
          data-testid="checkout-countdown-bar"
          sx={{
            position: 'relative',
            height: 3,
            mb: 1.75,
            borderRadius: 999,
            overflow: 'hidden',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: `${pct}%`,
              borderRadius: 999,
              backgroundColor: barColor,
              transition: 'width 1s linear, background-color 300ms ease',
            }}
          />
        </Box>
      )}
      <Box data-testid="checkout-status-timeline" sx={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((label, i) => {
          const done = i < stepIndex
          const active = i === stepIndex
          const reached = done || active
          const stepColor = reached ? (isUnderpaid && active ? warnFg : LIME) : muted
          return (
            <React.Fragment key={label}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 52 }}>
                <Box sx={{
                  width: 20, height: 20, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${stepColor}`,
                  backgroundColor: done ? LIME : 'transparent',
                  ...(active ? {
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                  } : {}),
                }}>
                  {done
                    ? <Icon icon="mdi:check" width={13} color={ON_BRAND} />
                    : <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: stepColor }} />}
                </Box>
                <Typography sx={{ fontSize: 10.5, fontWeight: reached ? 700 : 500, color: reached ? theme.palette.text.primary : muted }}>
                  {label}
                </Typography>
              </Box>
              {i < steps.length - 1 && (
                <Box sx={{ flex: 1, height: 2, mx: 0.5, mb: 2.25, borderRadius: 1, backgroundColor: i < stepIndex ? LIME : border }} />
              )}
            </React.Fragment>
          )
        })}
      </Box>
    </Box>
  )
}

/** Panel container shell — Stripe-style single card. */
const PanelShell: React.FC<{
  children: React.ReactNode
  isDark: boolean
  border: string
  muted: string
}> = ({ children, isDark, border }) => (
  <Box
    sx={{
      minHeight: '70vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      px: { xs: 2, sm: 3 },
      py: { xs: 3, sm: 6 },
    }}
  >
    <Box
      data-testid="clean-checkout-panel"
      sx={{
        width: '100%',
        maxWidth: 440,
        p: { xs: 2.5, sm: 4 },
        borderRadius: '14px',
        border: `1px solid ${border}`,
        backgroundColor: isDark ? '#0F0F10' : '#FFFFFF',
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.4)'
          : '0 4px 20px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {children}
    </Box>
  </Box>
)

export default CleanCheckoutV2
