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
 * `localStorage.token` (the merchant login) — the buyer token lives under
 * helpers/checkoutSession CHECKOUT_TOKEN_KEY.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
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
import PublicVerifiedBadge from '@/Components/UI/PublicVerifiedBadge'
import MerchantTrustRow from '@/Components/UI/MerchantTrustRow'
import type { CheckoutState } from '@/Components/UI/CheckoutShell'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
// ─── Extracted checkout modules (Session refactor) ───────────────────────
import type { Meta, CryptoInfo, Phase, CryptoSplit } from './checkout/checkoutTypes'
import { PriceBreakdown } from './checkout/PriceBreakdown'
import { buildFiatRows, hasBreakdownRows } from './checkout/breakdownRows'
import { toNumber } from '@/utils/money'
import {
  MONO, LIME, INK, ON_BRAND, PREF_NET_KEY, PREF_CUR_KEY, CRYPTO_INFO, networkEta, coinGroups,
} from './checkout/checkoutConstants'
import {
  formatCryptoAmount, buildPaymentUri, copyToClipboard, readCheckoutPref, writeCheckoutPref,
} from './checkout/checkoutHelpers'
import { checkoutApi as api, fetchReceiptBlob, fetchReceiptLink, checkoutStreamUrl } from './checkout/checkoutApi'
import { clearCheckoutToken } from '@/helpers/checkoutSession'
import useStickyCtaFootprint from '@/hooks/useStickyCtaFootprint'
import SaveMerchantButton from '@/Components/UI/SaveMerchantButton'
import { PanelShell, CheckoutStatusTimeline, AssetNetworkChip } from './checkout/checkoutPrimitives'
import { getRuntimeFlags } from '@/helpers/runtimeFlags'

// Preserve existing external import contracts (scripts/qa + legacy importers).
export { CheckoutStatusTimeline } from './checkout/checkoutPrimitives'
export { buildPaymentUri } from './checkout/checkoutHelpers'



interface CleanCheckoutV2Props {
  /** Payment reference (`?d=<xxx>`) — required. */
  d: string
  /** Called after payment confirms so the parent page can react (e.g. show
   *  a share sheet, refresh a campaign progress bar, etc). Optional. */
  onSuccess?: () => void
  /** Raw `pay/getData` response already fetched by the parent page for this
   *  same ref — when provided, the meta fetch is skipped entirely (collapses
   *  the duplicate getData round-trip on checkout open). */
  initialMeta?: Record<string, any>
  /** Merchant redirect URL (from getData). Shown as "Return to {merchant}" on
   *  the paid card and auto-followed after a short countdown (B5/B6). */
  redirectUrl?: string | null
  /** True when rendered inside the embed iframe — the parent handles redirects. */
  embed?: boolean
  /** Buyer Auto-Invite prefill: pre-fills the "email me a receipt" field so a
   *  returning buyer (from the receipt email's "Buy again" link) checks out faster. */
  prefillEmail?: string
}

const CleanCheckoutV2: React.FC<CleanCheckoutV2Props> = ({ d, onSuccess, initialMeta, redirectUrl, embed, prefillEmail }) => {
  const theme = useTheme()
  const { t, i18n } = useTranslation('landing')
  const isDark = theme.palette.mode === 'dark'

  // Design tokens resolved per-theme
  const border   = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)'
  const surface  = isDark ? 'rgba(255,255,255,0.03)' : '#FAFAFC'
  const muted    = isDark ? '#A1A1AA' : '#6B6B76'
  const warnBg   = isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)'
  const warnFg   = '#B45309'
  const errFg    = '#B91C1C'
  // Quiet Money: one overline style for every field label in the card.
  const labelSx  = { fontSize: 11, fontWeight: 700, color: muted, mb: 0.75, letterSpacing: '0.08em', textTransform: 'uppercase' as const }

  // ─── State ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading_meta')
  // True once the backend reports the on-chain tx has been SEEN (status
  // 'pending' = "Payment detected, awaiting confirmation") — drives the
  // Waiting → Detected → Confirmed timeline. Backend does NOT expose a numeric
  // confirmation count, so we show discrete steps rather than a fake "n of m".
  const [detected, setDetected] = useState(false)
  // How far the detected payment has got: 'mempool' = broadcast but not yet in a
  // block (from the mempool probe), 'confirming' = on-chain, settlement running.
  const [detectStage, setDetectStage] = useState<'mempool' | 'confirming'>('confirming')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [selectedNetwork, setSelectedNetwork] = useState<string>('')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [cryptoInfo, setCryptoInfo] = useState<CryptoInfo | null>(null)
  // Exact fee + total (in base_currency) for the SELECTED coin, captured from
  // getCurrencyRates after reservation. Null until a coin is reserved → the
  // header shows the getData estimate first, then the exact figure.
  const [feeExact, setFeeExact] = useState<{ fee: number; total: number; platformFee: number; networkFee: number } | null>(null)
  // Exact crypto split (customer / merchant / Dynopay fee) from /pay/addPayment —
  // the authoritative figures once an address is reserved.
  const [split, setSplit] = useState<CryptoSplit | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  // Total reservation window (seconds) — the denominator for the countdown
  // progress bar (§5.12). Tracks the largest window seen so the bar never
  // exceeds 100% even if the backend re-issues a fresh remaining_seconds.
  const [totalSeconds, setTotalSeconds] = useState<number>(0)
  const [rateFetchedAt, setRateFetchedAt] = useState<number | null>(null)
  const [copiedFlag, setCopiedFlag] = useState<'addr' | 'amt' | 'memo' | ''>('')
  const [portalReady, setPortalReady] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  // B5/B6: seconds until we follow the merchant redirect on the paid card.
  const [redirectIn, setRedirectIn] = useState<number | null>(null)
  // "Download receipt" on the paid card — proof of payment for the customer.
  const [receiptState, setReceiptState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  // "Copy receipt link" — a shareable /receipt/<token> URL (proof of payment without a file).
  const [receiptLinkState, setReceiptLinkState] = useState<'idle' | 'busy' | 'copied' | 'error'>('idle')
  const [showRefundInput, setShowRefundInput] = useState<boolean>(false)
  const [refundAddress, setRefundAddress] = useState<string>('')
  const [refundSaved, setRefundSaved] = useState<boolean>(false)
  // Optional buyer receipt email ("Email me a receipt"). Saved to the checkout
  // session so the existing post-payment receipt email fires for anonymous
  // payers. Contact info only — never affects amounts / addresses / fees.
  const [receiptEmail, setReceiptEmail] = useState<string>('')
  const [emailSaved, setEmailSaved] = useState<boolean>(false)
  // Buyer Auto-Invite: pre-fill the receipt email from the "Buy again" link
  // (`?be=`). Only fills while the field is still empty (never clobbers typing).
  useEffect(() => {
    const v = (prefillEmail || '').trim()
    if (v) setReceiptEmail((cur) => cur || v)
  }, [prefillEmail])
  const [confirmedAmount, setConfirmedAmount] = useState<{
    crypto: number
    fiat: number
    fiatCurrency: string
    merchant?: number
    fee?: number
    feePayer?: 'customer' | 'company'
    // B8: excess sent on an overpayment (crypto + fiat) — shown with a refund hint.
    excess?: number
    excessFiat?: number
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
  // Mirror of `detected` for the 1s countdown closure (B1: never expire a
  // checkout whose payment is already on-chain).
  const detectedRef = useRef(false)
  useEffect(() => { detectedRef.current = detected }, [detected])
  // Real-time status (2026-09): the webhook pipeline goes detected → confirmed in
  // ~3s while polling ran every 10s, so buyers jumped straight to the paid card.
  // We now (a) subscribe to the per-address SSE stream and re-verify on every
  // hint, and (b) keep the "Payment detected — confirming" step on screen for a
  // minimum dwell so the transition is actually visible.
  const MIN_DETECTED_DWELL_MS = 4000
  const detectedAtRef = useRef<number | null>(null)
  // Monotonic stage guard: once the payment has reached 'confirming' (on-chain)
  // we never drop the label back to 'mempool'/broadcast, even if a later probe
  // momentarily reports it unconfirmed again. Reset per new payment attempt.
  const reachedConfirmingRef = useRef(false)
  const confirmTimerRef = useRef<any>(null)
  const [sseConnected, setSseConnected] = useState(false)
  // Browser "Payment confirmed" alert (opt-in). Lets the buyer switch tabs
  // while the network confirms and still get pinged on settlement.
  const notif = usePaymentNotification()
  const notifiedRef = useRef(false)

  // ── Phase C: single server-state (SWR) data layer — flag-gated ─────────
  // Default OFF → the legacy manual-fetch + setInterval paths below run
  // UNCHANGED (zero production risk). Opt in per-visit with `?swr=1` (easy
  // real-payment validation, no rebuild) or globally via
  // NEXT_PUBLIC_CHECKOUT_SWR=true. Both paths share the SAME result handlers
  // (applyMeta / applyVerifyResult) so behaviour is identical either way.
  const SWR_ON = useMemo(() => {
    const envOn = getRuntimeFlags().checkoutSwr
    let queryOn = false
    if (typeof window !== 'undefined') {
      try { queryOn = new URLSearchParams(window.location.search).get('swr') === '1' } catch { /* ignore */ }
    }
    return envOn || queryOn
  }, [])

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
  // Shared result handler — BOTH the legacy manual fetch AND the SWR path
  // funnel through this, so meta processing is byte-identical either way.
  const applyMeta = useCallback((r: Awaited<ReturnType<typeof api>>) => {
    if (!mountedRef.current) return
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
      estimated_platform_fee: Number(raw.fee_info?.estimated_platform_fee ?? 0) || 0,
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
  }, [])

  // Collapsed round-trip: when the parent page (/pay) already fetched
  // pay/getData for this exact ref, reuse it — skip BOTH meta fetch paths.
  useEffect(() => {
    if (!initialMeta) return
    applyMeta({ ok: true, status: 200, data: initialMeta })
  }, [initialMeta, applyMeta])

  // Legacy path (flag OFF): manual fetch on mount / when `d` changes.
  useEffect(() => {
    if (SWR_ON) return // SWR drives the meta load — see metaSwr below.
    if (initialMeta) return // parent already provided the meta — no refetch.
    let cancelled = false
    ;(async () => {
      setPhase('loading_meta')
      setErrorMsg('')
      // Clear any stale customer token from a previous checkout on this device.
      // getData will hand us a fresh one below.
      clearCheckoutToken()

      const r = await api('/pay/getData', { data: d, language: i18n.language || 'en' }, undefined)
      if (cancelled || !mountedRef.current) return
      applyMeta(r)
    })()
    return () => { cancelled = true }
    // i18n.language intentionally omitted — a language switch must not reset the checkout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, SWR_ON, initialMeta, applyMeta])

  // Phase C (flag ON): single server-state layer for the meta load. The key
  // is null when the flag is off (or the parent already provided the meta),
  // so the fetcher never runs on those paths.
  const metaSwr = useSWR(
    SWR_ON && !initialMeta ? ['checkout/getData', d] : null,
    async () => {
      clearCheckoutToken()
      return api('/pay/getData', { data: d, language: i18n.language || 'en' }, undefined)
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false, shouldRetryOnError: false },
  )
  useEffect(() => {
    if (!SWR_ON) return
    if (metaSwr.data) applyMeta(metaSwr.data)
    else if (metaSwr.error) { setErrorMsg('Failed to load payment.'); setPhase('error') }
  }, [SWR_ON, metaSwr.data, metaSwr.error, applyMeta])

  // ─── Coin-first catalogue derived from meta (B3) ──────────────────
  // Buyers think "USDT" before "Tron": group the available display codes by
  // symbol; a network choice is only shown when a coin exists on >1 network.
  const meta_ = meta // shorthand (must be declared BEFORE the useMemo below to avoid TDZ)
  const groups = useMemo(() => (meta_ ? coinGroups(meta_.available_currencies) : []), [meta_])
  const selectedSymbol = CRYPTO_INFO[selectedCurrency]?.symbol || ''
  const networkOptions = useMemo(
    () => (groups.find((g) => g.symbol === selectedSymbol)?.codes || []),
    [groups, selectedSymbol],
  )

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

  // Preselect (never reserve) when meta loads — prefer the customer's remembered
  // coin (per-device) so a returning visitor lands on their usual choice (B4).
  useEffect(() => {
    if (!meta_ || selectedCurrency || groups.length === 0) return
    const savedCode = readCheckoutPref(PREF_CUR_KEY)
    const savedNet = readCheckoutPref(PREF_NET_KEY)
    const all = groups.flatMap((g) => g.codes)
    if (savedCode && all.includes(savedCode)) { setSelectedCurrency(savedCode); return }
    const first = groups[0]
    const byNet = savedNet ? first.codes.find((c) => CRYPTO_INFO[c]?.network === savedNet) : undefined
    setSelectedCurrency(byNet || first.codes[0])
  }, [meta_, groups, selectedCurrency])

  // Keep the network mirror + per-device preferences in sync with the coin.
  useEffect(() => {
    if (!selectedCurrency) return
    const net = CRYPTO_INFO[selectedCurrency]?.network || ''
    setSelectedNetwork(net)
    writeCheckoutPref(PREF_CUR_KEY, selectedCurrency)
    if (net) writeCheckoutPref(PREF_NET_KEY, net)
  }, [selectedCurrency])

  // Coin picked from the coin-first list → choose the code on the remembered
  // network when that coin exists there, else the first network.
  const pickSymbol = (symbol: string) => {
    const g = groups.find((x) => x.symbol === symbol)
    if (!g) return
    const savedNet = readCheckoutPref(PREF_NET_KEY)
    const preferred = g.codes.find((c) => CRYPTO_INFO[c]?.network === (selectedNetwork || savedNet)) || g.codes[0]
    setCryptoInfo(null)
    setSplit(null)
    setFeeExact(null)
    setSelectedCurrency(preferred)
    setPhase('currency_select')
  }
  const pickNetworkCode = (code: string) => {
    setCryptoInfo(null)
    setSplit(null)
    setFeeExact(null)
    setSelectedCurrency(code)
    setPhase('currency_select')
  }

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
    setSplit(null)

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
      // Backend splits the processing fee into Dynopay tier fee + network buffer (source currency).
      const platformFee = Number(rateRow.platform_fee)
      const networkFee = Number(rateRow.network_fee)
      const hasParts = Number.isFinite(platformFee) && Number.isFinite(networkFee)
      setFeeExact({
        fee: exactFee,
        total: exactTotal,
        platformFee: hasParts ? platformFee : exactFee,
        networkFee: hasParts ? Math.max(networkFee, 0) : 0,
      })
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
    // Exact split (merchant + fee === customer at 8 dp) — powers the breakdown rows.
    const merchantAmt = Number(r.merchant_amount)
    const feeAmt = Number(r.fees)
    setSplit(
      Number.isFinite(merchantAmt) && merchantAmt > 0 && Number.isFinite(feeAmt) && feeAmt >= 0
        ? { customer: Number(r.amount) || cryptoAmount, merchant: merchantAmt, fee: feeAmt, feePayer: r.fee_payer === 'customer' ? 'customer' : 'company' }
        : null,
    )
    // Keep this payment id so a post-settlement email catch (success screen) can
    // be linked to THIS transaction for the referral invite.
    paymentIdRef.current = String(r.transaction_id || '')
    const timerMins: number =
      Number(r.remaining_minutes) || Number(r.expires_in_minutes) || Number(r.expiration_minutes) || 30
    setTimeLeft(timerMins * 60)
    setTotalSeconds(timerMins * 60)
    setDetected(false)
    setPhase('awaiting_payment')
  }, [meta_])

  // B4: reservation happens on an explicit "Continue" — never on load — so the
  // 30-minute window only starts once the buyer has actually chosen to pay.
  const handleContinue = () => { if (selectedCurrency && phase === 'currency_select') reservePayment(selectedCurrency) }

  // ─── Step 3: poll /pay/verifyCryptoPayment ────────────────────────
  // Shared status handler — BOTH the legacy setInterval poll AND the SWR poll
  // funnel through this, so settlement processing is byte-identical either way.
  const applyVerifyResult = useCallback((r: Awaited<ReturnType<typeof api>>) => {
    if (!mountedRef.current) return
    if (!r.ok || !r.data) return
    if (!cryptoInfo || !meta_) return
    const s = String(r.data.status || 'waiting')
    const d_: any = r.data
    if (d_.remaining_seconds !== undefined && d_.remaining_seconds > 0) {
      setTimeLeft(Number(d_.remaining_seconds))
      setTotalSeconds((prev) => Math.max(prev, Number(d_.remaining_seconds)))
    }
    // Live "detected" signal: backend 'pending' = tx seen, awaiting
    // confirmation; 'underpaid' also means funds were received (partial).
    if (s === 'pending' || s === 'processing') {
      setDetected(true)
      // Mempool probe → 'mempool' (0 confirmations); webhook-driven pending/processing → on-chain.
      // Stage is MONOTONIC: once we've shown 'confirming' we never drop back to
      // 'mempool', even if a later probe momentarily reports it unconfirmed again.
      if (d_.unconfirmed === true && !reachedConfirmingRef.current) {
        setDetectStage('mempool')
      } else {
        reachedConfirmingRef.current = true
        setDetectStage('confirming')
      }
      if (detectedAtRef.current == null) detectedAtRef.current = Date.now()
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
      // Detection is MONOTONIC within a payment attempt. Once the buyer's tx has
      // been seen (mempool or on-chain), a later 'waiting' poll — which happens
      // when the mempool probe intermittently misses an already-detected tx
      // before it is mined — must NOT regress the UI back to "Waiting for
      // payment". This caused the waiting → broadcast → waiting → broadcast
      // flicker. `detected` is reset only when a brand-new payment is reserved
      // (reservePayment / address change), never here.
    }
    if (s === 'confirmed' || s === 'overpaid') {
      if (confirmTimerRef.current) return // already committing after the dwell
      const settledMerchant = Number(d_.merchantAmount)
      const settledFee = Number(d_.feeAmount)
      const hasSettled = Number.isFinite(settledMerchant) && settledMerchant > 0 && Number.isFinite(settledFee) && settledFee >= 0
      const commitConfirmed = () => {
        if (!mountedRef.current) return
        const excess = Number(d_.excessAmount)
        setConfirmedAmount({
          crypto: Number(d_.paidAmount || d_.expectedAmount || cryptoInfo.expected_amount),
          fiat: Number(d_.paidAmountUsd || meta_.amount),
          fiatCurrency: String(d_.baseCurrency || meta_.base_currency),
          merchant: hasSettled ? settledMerchant : split?.merchant,
          fee: hasSettled ? settledFee : split?.fee,
          feePayer: d_.feePayer === 'customer' || d_.feePayer === 'company' ? d_.feePayer : split?.feePayer,
          excess: s === 'overpaid' && Number.isFinite(excess) && excess > 0 ? excess : undefined,
          excessFiat: s === 'overpaid' && Number.isFinite(Number(d_.excessAmountUsd)) ? Number(d_.excessAmountUsd) : undefined,
        })
        setPhase('confirmed')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
        if (onSuccess) { try { onSuccess() } catch { /* ignore */ } }
      }
      // Always walk the buyer through "detected → confirming" before the paid
      // card, even when the network already confirmed between two checks.
      setDetected(true)
      setDetectStage('confirming')
      if (detectedAtRef.current == null) detectedAtRef.current = Date.now()
      const elapsed = Date.now() - detectedAtRef.current
      const wait = Math.max(0, MIN_DETECTED_DWELL_MS - elapsed)
      if (wait === 0) {
        commitConfirmed()
      } else {
        confirmTimerRef.current = setTimeout(() => {
          confirmTimerRef.current = null
          commitConfirmed()
        }, wait)
      }
      return
    }
    if (s === 'expired') {
      setPhase('expired')
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
  }, [cryptoInfo, meta_, onSuccess, split])

  // Legacy path (flag OFF): setInterval polling every 10s.
  useEffect(() => {
    if (SWR_ON) return // SWR drives the verify poll — see verifySwr below.
    if (phase !== 'awaiting_payment' && phase !== 'underpaid') return
    if (!cryptoInfo?.address || !meta_?.token) return

    const poll = async () => {
      const r = await api('/pay/verifyCryptoPayment', { address: cryptoInfo.address }, meta_.token)
      applyVerifyResult(r)
    }
    poll()
    pollRef.current = setInterval(poll, sseConnected ? 10_000 : 4_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cryptoInfo, meta_, SWR_ON, sseConnected])

  // Phase C (flag ON): SWR drives the verify polling with the SAME 10s cadence.
  // The key nulls out the moment we leave awaiting/underpaid (or lose the
  // address/token) so SWR stops automatically on confirmed / expired — no
  // manual clearInterval needed. refreshWhenHidden keeps polling while the
  // buyer is on another tab (matching the legacy setInterval + the notify UX).
  const verifyActive =
    SWR_ON &&
    (phase === 'awaiting_payment' || phase === 'underpaid') &&
    !!cryptoInfo?.address &&
    !!meta_?.token
  const verifySwr = useSWR(
    verifyActive ? ['checkout/verify', cryptoInfo!.address, meta_!.token] : null,
    async () => api('/pay/verifyCryptoPayment', { address: cryptoInfo!.address }, meta_!.token),
    { refreshInterval: sseConnected ? 10_000 : 4_000, refreshWhenHidden: true, revalidateOnFocus: false, shouldRetryOnError: false },
  )
  useEffect(() => {
    if (!SWR_ON) return
    if (verifySwr.data) applyVerifyResult(verifySwr.data)
  }, [SWR_ON, verifySwr.data, applyVerifyResult])

  // ─── Real-time status stream (SSE) ────────────────────────────────
  // Every hint triggers an immediate re-verify against verifyCryptoPayment (the
  // source of truth); polling stays on as a fallback (4s without SSE, 10s with).
  const streamActive =
    (phase === 'awaiting_payment' || phase === 'underpaid') &&
    !!cryptoInfo?.address &&
    !!meta_?.token
  const verifyNow = useCallback(async () => {
    if (!cryptoInfo?.address || !meta_?.token) return
    if (SWR_ON) { try { await verifySwr.mutate() } catch { /* ignore */ } ; return }
    const r = await api('/pay/verifyCryptoPayment', { address: cryptoInfo.address }, meta_.token)
    applyVerifyResult(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cryptoInfo?.address, meta_?.token, SWR_ON, applyVerifyResult, verifySwr.mutate])
  useEffect(() => {
    if (!streamActive || typeof window === 'undefined' || typeof EventSource === 'undefined') return
    let es: EventSource | null = null
    let closed = false
    try {
      es = new EventSource(checkoutStreamUrl(cryptoInfo!.address, meta_!.token, cryptoInfo!.memo || null))
    } catch {
      return
    }
    const onHint = (ev: MessageEvent) => {
      let status = ''
      try { status = String(JSON.parse(ev.data || '{}').status || '') } catch { /* ignore */ }
      if (status === 'pending' || status === 'processing') {
        setDetected(true)
        setDetectStage('confirming') // stream hints come from the chain watcher → already on-chain
        if (detectedAtRef.current == null) detectedAtRef.current = Date.now()
      }
      if (status && status !== 'waiting') void verifyNow()
    }
    es.addEventListener('connected', () => { if (!closed) setSseConnected(true) })
    es.addEventListener('ready', onHint as EventListener)
    es.addEventListener('status', onHint as EventListener)
    es.onerror = () => { if (!closed) setSseConnected(false) }
    return () => {
      closed = true
      setSseConnected(false)
      try { es?.close() } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamActive, cryptoInfo?.address, meta_?.token])

  // Reset the dwell tracker whenever a new address/payment attempt starts.
  useEffect(() => {
    detectedAtRef.current = null
    reachedConfirmingRef.current = false
    setDetectStage('confirming')
    if (confirmTimerRef.current) { clearTimeout(confirmTimerRef.current); confirmTimerRef.current = null }
  }, [cryptoInfo?.address])
  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current) }, [])

  // ─── Timer countdown ──────────────────────────────────────────────
  // B1: once a payment is DETECTED the window is irrelevant — the network will
  // confirm it whether or not the reservation timer has run out — so we hold
  // at 0:00, keep polling and never flip to `expired`.
  useEffect(() => {
    if (phase !== 'awaiting_payment' && phase !== 'underpaid') return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (detectedRef.current) return 0
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
    const r = await api('/pay/setRefundAddress', { data: d, refund_address: addr.trim() }, meta_.token)
    if (r.ok && mountedRef.current) setRefundSaved(true)
  }, [d, meta_])

  // ─── Save the optional receipt email (best-effort, non-blocking) ──
  // paymentIdRef lets the success-screen "leave your email" catch feed the
  // referral engine even AFTER settlement — the backend links this payment id to
  // a real customer row so the post-payment invite cron can reach the payer.
  const paymentIdRef = useRef<string>('')
  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const emailInvalid = receiptEmail.trim().length > 0 && !emailValid(receiptEmail)
  const saveReceiptEmail = useCallback(async () => {
    const v = receiptEmail.trim().toLowerCase()
    if (!v || !emailValid(v) || !meta_?.token) return
    const r = await api('/pay/setCustomerEmail', { data: d, email: v, payment_id: paymentIdRef.current || undefined }, meta_.token)
    if (r.ok && mountedRef.current) setEmailSaved(true)
  }, [receiptEmail, d, meta_])

  const timerLabel = useMemo(() => {
    const m = Math.floor(timeLeft / 60)
    const s = timeLeft % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [timeLeft])

  const doCopy = async (text: string, flag: 'addr' | 'amt' | 'memo') => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedFlag(flag)
      setTimeout(() => setCopiedFlag(''), 1600)
    }
  }

  // "Copied" feedback lives ON the row (not in a toast): a soft one-shot ring +
  // tint that fades over 1.6s, and the row border turns brand-colour. Payers
  // see the confirmation exactly where they clicked. Honors reduced-motion.
  const copyRowSx = (flag: 'addr' | 'amt') => {
    const active = copiedFlag === flag
    return {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 1, p: 1.25, borderRadius: '10px',
      border: `1px solid ${active ? LIME : border}`,
      transition: 'border-color 200ms ease',
      ...(active
        ? {
            animation: 'checkoutCopyPulse 1.6s ease-out 1',
            '@keyframes checkoutCopyPulse': {
              '0%': { boxShadow: `0 0 0 0 ${isDark ? 'rgba(129,140,248,0.55)' : 'rgba(67,56,202,0.40)'}`, backgroundColor: isDark ? 'rgba(129,140,248,0.16)' : 'rgba(67,56,202,0.10)' },
              '60%': { boxShadow: `0 0 0 8px ${isDark ? 'rgba(129,140,248,0)' : 'rgba(67,56,202,0)'}`, backgroundColor: isDark ? 'rgba(129,140,248,0.08)' : 'rgba(67,56,202,0.05)' },
              '100%': { boxShadow: `0 0 0 0 ${isDark ? 'rgba(129,140,248,0)' : 'rgba(67,56,202,0)'}`, backgroundColor: 'transparent' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', backgroundColor: isDark ? 'rgba(129,140,248,0.10)' : 'rgba(67,56,202,0.06)' },
          }
        : {}),
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
  useStickyCtaFootprint(portalReady && !!cryptoInfo && phase !== 'confirmed', 72)

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
      const { blob, filename } = await fetchReceiptBlob(cryptoInfo.address, meta_.token)
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

  // Copy a shareable receipt link (POST /pay/receipt/link → clipboard). The link
  // is minted once per payment and reused — the same URL the receipt email carries.
  const handleCopyReceiptLink = async () => {
    if (receiptLinkState === 'busy') return
    if (!cryptoInfo?.address || !meta_?.token) {
      setReceiptLinkState('error')
      setTimeout(() => setReceiptLinkState('idle'), 4000)
      return
    }
    setReceiptLinkState('busy')
    try {
      const { url } = await fetchReceiptLink(cryptoInfo.address, meta_.token)
      try {
        await navigator.clipboard.writeText(url)
        setReceiptLinkState('copied')
        setTimeout(() => setReceiptLinkState('idle'), 2500)
      } catch {
        // Clipboard blocked (no user gesture / insecure context) — open the receipt instead.
        window.open(url, '_blank', 'noopener,noreferrer')
        setReceiptLinkState('idle')
      }
    } catch {
      setReceiptLinkState('error')
      setTimeout(() => setReceiptLinkState('idle'), 4000)
    }
  }

  // Fiat amount formatted using the same helper as the rest of the app
  const fiatSymbol = meta_ ? getCurrencySymbolFromFormat(meta_.base_currency) : '$'
  const fiatAmount = meta_ ? formatWithSeparators(Number(meta_.amount || 0), meta_.base_currency) : '0.00'

  // ── Order summary (Amount [+ Tax] [+ Processing fee] → Total) ──
  // Shown only when there is something to itemise. Fiat figures are estimates
  // until a coin is reserved, then the exact addPayment split drives the fee row.
  const feePayerIsCustomer = (meta_?.fee_payer || 'company') === 'customer'
  const baseAmt = Number(meta_?.amount) || 0
  const taxAmt = Number(meta_?.tax_amount) || 0
  const platformFeeEst = Number(meta_?.estimated_platform_fee) || 0
  // Customer-pays quote = Dynopay tier fee + network buffer; getData's estimate lumps them.
  const processingFeeEst = Number(meta_?.estimated_fee) || 0
  const platformFeeAmt = feePayerIsCustomer ? (feeExact ? feeExact.platformFee : platformFeeEst) : platformFeeEst
  const networkFeeAmt = feePayerIsCustomer
    ? (feeExact ? feeExact.networkFee : Math.max(toNumber(processingFeeEst - platformFeeEst, 2), 0))
    : 0
  const feeAmt = feePayerIsCustomer ? (feeExact ? feeExact.fee : processingFeeEst) : platformFeeEst
  const totalAmt = feePayerIsCustomer
    ? (feeExact ? feeExact.total : (baseAmt + taxAmt + feeAmt))
    : baseAmt + taxAmt
  const feeIsEstimate = feePayerIsCustomer && !feeExact
  const fmtFiat = (n: number) => `${fiatSymbol}${formatWithSeparators(n, meta_?.base_currency || 'USD')}`
  const fiatRows = meta_
    ? buildFiatRows({ t, fmtFiat, baseAmt, taxAmt, feePayerIsCustomer, feeFiat: platformFeeAmt, networkFeeFiat: networkFeeAmt, feeIsEstimate, totalFiat: totalAmt, split, code: cryptoInfo?.crypto_base })
    : []
  const showSummary = !!meta_ && hasBreakdownRows({ taxAmt, feePayerIsCustomer })

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

  // B5/B6: merchant redirect after a confirmed payment. Inside the embed the
  // parent page owns navigation (it receives `dynopay:redirect`), so we only
  // count down on the hosted page. 6s gives the buyer time to grab the receipt.
  const REDIRECT_SECONDS = 6
  const hasReturn = !!redirectUrl && !embed
  const returnToMerchant = useCallback(() => {
    if (!redirectUrl || typeof window === 'undefined') return
    try { window.location.assign(redirectUrl) } catch { /* ignore */ }
  }, [redirectUrl])
  useEffect(() => {
    if (phase !== 'confirmed' || !hasReturn) return
    setRedirectIn(REDIRECT_SECONDS)
    const id = setInterval(() => {
      setRedirectIn((n) => {
        if (n == null) return n
        if (n <= 1) { clearInterval(id); returnToMerchant(); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hasReturn])
  const cancelRedirect = () => setRedirectIn(null)

  // Recoverable error (B2): retry the reservation for the same coin instead of
  // forcing the buyer to reload the page.
  const retryReservation = () => {
    setErrorMsg('')
    if (selectedCurrency && meta_) reservePayment(selectedCurrency)
    else if (typeof window !== 'undefined') window.location.reload()
  }

  // ─── LOADING (meta only) ──────────────────────────────────────────
  // Full-panel loader is used ONLY before the checkout meta is known — there
  // is genuinely nothing to show yet. The `creating_payment` (address
  // reservation) state deliberately does NOT blank the panel: it keeps the
  // header + amount + coin selects mounted and shows an inline "Preparing
  // payment address…" spinner in the address area, so the checkout no longer
  // flashes in-then-out while addPayment runs (see the main render below).
  if (phase === 'loading_meta') {
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
            {t('checkout.loadingCheckout', { defaultValue: 'Loading checkout…' })}
          </Typography>
        </Box>
      </PanelShell>
    )
  }

  // ─── ERROR (no meta yet — nothing else to show) ───────────────────
  // B2: when the meta IS loaded (coin/amount known) we fall through to the main
  // view and render the error inline beneath the selects with a retry button,
  // so the buyer keeps the brand, amount and coin picker.
  const inlineError = (phase === 'error' || phase === 'failed') && !!meta_
  if ((phase === 'error' || phase === 'failed') && !meta_) {
    return (
      <PanelShell isDark={isDark} border={border} muted={muted}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Logo width={22} height={26} />
          <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: muted }}>DYNOPAY</Typography>
        </Box>
        <Alert severity="error" sx={{ borderRadius: '10px' }} data-testid="clean-checkout-error">
          {errorMsg || t('checkout.genericError', { defaultValue: 'Something went wrong.' })}
        </Alert>
        <Button
          fullWidth
          variant="outlined"
          onClick={() => { if (typeof window !== 'undefined') window.location.reload() }}
          data-testid="clean-checkout-error-retry"
          sx={{ mt: 2, textTransform: 'none', borderRadius: '999px', fontWeight: 700, minHeight: 44, borderColor: border, color: theme.palette.text.primary }}
        >
          {t('checkout.tryAgain', { defaultValue: 'Try again' })}
        </Button>
      </PanelShell>
    )
  }

  // ─── EXPIRED (payment window elapsed) ─────────────────────────────
  // The reservation timer hit zero (or the backend reported 'expired') before
  // funds arrived. Show a clear terminal state instead of a stale QR/address.
  if (phase === 'expired') {
    return (
      <PanelShell isDark={isDark} border={border} muted={muted}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 3 }} data-testid="clean-checkout-expired">
          <Box
            sx={{
              width: 56, height: 56, borderRadius: '50%', mb: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: warnBg, color: warnFg,
            }}
          >
            <Icon icon="mdi:timer-off-outline" width={28} />
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: theme.palette.text.primary, mb: 1 }}>
            {t('checkout.expiredTitle', { defaultValue: 'This payment window expired' })}
          </Typography>
          <Typography sx={{ fontSize: 14, color: muted, lineHeight: 1.5, mb: 2 }}>
            {selectedCurrency
              ? t('checkout.expiredBodyRefresh', { defaultValue: 'The price-lock window ran out. Your coin and amount are saved — just refresh the quote to get a fresh address and timer. If you already sent funds, contact the merchant.' })
              : t('checkout.expiredBody', { defaultValue: 'The time to complete this payment ran out. If you already sent funds, contact the merchant. Otherwise, ask them for a fresh payment link.' })}
          </Typography>
          {/* B13: a citable reference so the buyer can ask the merchant about this exact attempt */}
          <Box
            data-testid="clean-checkout-expired-ref"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, mb: 3, borderRadius: '8px', border: `1px solid ${border}`, backgroundColor: surface }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('checkout.reference', { defaultValue: 'Reference' })}
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: 12, color: theme.palette.text.primary }}>
              {meta_?.order_reference || d.slice(0, 12)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
            {selectedCurrency && (
              <Button
                variant="contained"
                disableElevation
                onClick={() => reservePayment(selectedCurrency)}
                data-testid="checkout-refresh-quote-btn"
                startIcon={<Icon icon="mdi:refresh" width={18} />}
                sx={{
                  textTransform: 'none', borderRadius: '999px', fontWeight: 700, minHeight: 44, px: 3,
                  backgroundColor: LIME, color: ON_BRAND, '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
                }}
              >
                {t('checkout.refreshQuote', { defaultValue: 'Refresh quote' })}
              </Button>
            )}
            <Button
              variant={selectedCurrency ? 'outlined' : 'contained'}
              disableElevation
              onClick={() => { if (typeof window !== 'undefined') window.location.reload() }}
              data-testid="clean-checkout-expired-retry"
              sx={selectedCurrency
                ? { textTransform: 'none', borderRadius: '999px', fontWeight: 600, minHeight: 44, px: 3, borderColor: border, color: theme.palette.text.primary }
                : { textTransform: 'none', borderRadius: '999px', fontWeight: 700, minHeight: 44, px: 3, backgroundColor: LIME, color: ON_BRAND, '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' } }}
            >
              {t('checkout.expiredRetry', { defaultValue: 'Start over' })}
            </Button>
            {hasReturn && (
              <Button
                variant="outlined"
                onClick={returnToMerchant}
                data-testid="clean-checkout-expired-return"
                sx={{ textTransform: 'none', borderRadius: '999px', fontWeight: 600, minHeight: 44, px: 3, borderColor: border, color: theme.palette.text.primary }}
              >
                {t('checkout.returnToMerchant', { defaultValue: 'Return to {{name}}', name: merchantName })}
              </Button>
            )}
          </Box>
        </Box>
      </PanelShell>
    )
  }

  // ─── CONFIRMED ────────────────────────────────────────────────────
  if (phase === 'confirmed' && confirmedAmount && meta_) {
    return (
      <PanelShell isDark={isDark} border={border} muted={muted}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 3 }}>
          {/* One-time celebration: the disc pops in, then the check-mark draws
              itself (stroke-dashoffset). CSS-only, runs once on mount, and is
              disabled under prefers-reduced-motion. */}
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: LIME,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mb: 2,
              animation: 'checkoutSuccessPop 520ms cubic-bezier(0.22, 1.2, 0.36, 1) 1 both',
              '@keyframes checkoutSuccessPop': {
                '0%': { transform: 'scale(0.55)', opacity: 0, boxShadow: `0 0 0 0 ${isDark ? 'rgba(129,140,248,0.45)' : 'rgba(67,56,202,0.35)'}` },
                '60%': { transform: 'scale(1.06)', opacity: 1 },
                '100%': { transform: 'scale(1)', opacity: 1, boxShadow: `0 0 0 12px ${isDark ? 'rgba(129,140,248,0)' : 'rgba(67,56,202,0)'}` },
              },
              '& .check-path': {
                strokeDasharray: 40,
                strokeDashoffset: 40,
                animation: 'checkoutCheckDraw 560ms cubic-bezier(0.65, 0, 0.35, 1) 320ms 1 forwards',
              },
              '@keyframes checkoutCheckDraw': { to: { strokeDashoffset: 0 } },
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
                '& .check-path': { animation: 'none', strokeDashoffset: 0 },
              },
            }}
            data-testid="clean-checkout-success-icon"
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden focusable="false">
              <path
                className="check-path"
                d="M9 18.5 L15.5 25 L27 12"
                stroke={ON_BRAND}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Box>
          <Typography fontWeight={700} fontSize={22} letterSpacing="-0.5px" color={theme.palette.text.primary}>
            {isContribution ? t('checkout.success.titleContribution', { defaultValue: 'Thank you for contributing!' }) : t('checkout.success.title', { defaultValue: 'Payment successful' })}
          </Typography>
          <Typography fontSize={14} color={muted} mt={1}>
            {isContribution ? campaignTitle || merchantName : t('checkout.success.paidTo', { defaultValue: 'Paid to {{name}}', name: merchantName })} — {feePayerIsCustomer ? fmtFiat(totalAmt) : `${fiatSymbol}${fiatAmount}`}
          </Typography>
          {/* Identity-verified merchant trust signal on the on-screen receipt */}
          <Box sx={{ mt: 1 }}>
            <PublicVerifiedBadge linkRef={d} showLabel size={15} ml={0} />
          </Box>
          {/* What was sent — the crypto amount behind the fiat total above */}
          <Typography data-testid="clean-checkout-success-paid" sx={{ fontFamily: MONO, fontSize: 12.5, color: muted, mt: 0.5 }}>
            {formatCryptoAmount(confirmedAmount.crypto, cryptoInfo?.crypto_base || 'BTC')} {cryptoInfo?.crypto_base}
          </Typography>

          {/* B8: overpayment — say what happened to the excess */}
          {confirmedAmount.excess != null && confirmedAmount.excess > 0 && (
            <Box
              data-testid="clean-checkout-overpaid-note"
              sx={{ mt: 1.5, width: '100%', display: 'flex', gap: 1, alignItems: 'flex-start', p: 1.25, borderRadius: '10px', border: `1px solid ${warnFg}33`, backgroundColor: warnBg, textAlign: 'left' }}
            >
              <Icon icon="mdi:information-outline" width={18} color={warnFg} style={{ flexShrink: 0, marginTop: 1 }} />
              <Typography sx={{ fontSize: 12.5, color: theme.palette.text.primary, lineHeight: 1.5 }}>
                {t('checkout.overpaid.note', {
                  defaultValue: 'You sent {{amount}} more than needed{{fiat}}. The extra has been credited to the merchant along with your payment — contact them if you need an adjustment.',
                  amount: `${formatCryptoAmount(confirmedAmount.excess, cryptoInfo?.crypto_base || '')} ${cryptoInfo?.crypto_base || ''}`,
                  fiat: confirmedAmount.excessFiat ? ` (≈ ${fmtFiat(confirmedAmount.excessFiat)})` : '',
                })}
              </Typography>
            </Box>
          )}

          {/* What happens next — one plain line so the buyer knows they're done */}
          <Typography data-testid="clean-checkout-success-next" sx={{ fontSize: 12.5, color: muted, mt: 1.5, maxWidth: 360, lineHeight: 1.5 }}>
            {isContribution
              ? t('checkout.success.nextContribution', { defaultValue: 'Your contribution is confirmed on the network — nothing else to do.' })
              : t('checkout.success.next', { defaultValue: '{{name}} has been notified and will fulfil your order. Keep the receipt as your proof of payment.', name: merchantName })}
          </Typography>

          {/* B5/B6: return to the merchant is the primary action when a redirect exists */}
          {hasReturn && (
            <Box sx={{ width: '100%', mt: 2.25 }}>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                data-testid="clean-checkout-return-btn"
                onClick={returnToMerchant}
                endIcon={<Icon icon="mdi:arrow-right" width={18} />}
                sx={{
                  backgroundColor: LIME, color: ON_BRAND, textTransform: 'none', borderRadius: '999px',
                  fontWeight: 800, fontSize: 15, minHeight: 48,
                  '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
                }}
              >
                {t('checkout.returnToMerchant', { defaultValue: 'Return to {{name}}', name: merchantName })}
              </Button>
              {redirectIn != null && redirectIn > 0 && (
                <Typography data-testid="clean-checkout-redirect-countdown" sx={{ fontSize: 12, color: muted, mt: 0.75, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.75 }}>
                  {t('checkout.redirectingIn', { defaultValue: 'Taking you back in {{s}}s', s: redirectIn })}
                  <Box component="button" type="button" onClick={cancelRedirect} data-testid="clean-checkout-redirect-cancel" sx={{ background: 'none', border: 'none', p: 0, cursor: 'pointer', color: theme.palette.text.primary, fontSize: 12, fontWeight: 700, textDecoration: 'underline' }}>
                    {t('checkout.stayHere', { defaultValue: 'Stay here' })}
                  </Box>
                </Typography>
              )}
            </Box>
          )}

          {/* Download receipt — proof of payment the customer can keep */}
          <Button
            variant={hasReturn ? 'outlined' : 'contained'}
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
              mt: hasReturn ? 1.25 : 2.25,
              textTransform: 'none',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: 13.5,
              px: 2.5,
              minHeight: hasReturn ? 40 : 46,
              width: hasReturn ? 'auto' : '100%',
              ...(hasReturn
                ? { color: theme.palette.text.primary, borderColor: border, '&:hover': { borderColor: theme.palette.text.primary, backgroundColor: 'transparent' } }
                : { backgroundColor: LIME, color: ON_BRAND, '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' } }),
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

          {/* Copy receipt link — shareable proof of payment, no file needed */}
          <Button
            variant="text"
            disableElevation
            data-testid="clean-checkout-receipt-link-btn"
            onClick={handleCopyReceiptLink}
            disabled={receiptLinkState === 'busy'}
            startIcon={
              receiptLinkState === 'busy'
                ? <Icon icon="mdi:loading" width={17} className="dyno-spin" />
                : <Icon icon={receiptLinkState === 'copied' ? 'mdi:check' : 'mdi:link-variant'} width={17} />
            }
            sx={{
              mt: 0.75,
              textTransform: 'none',
              borderRadius: '999px',
              fontWeight: 600,
              fontSize: 13,
              px: 1.75,
              minHeight: 36,
              color: receiptLinkState === 'copied' ? LIME : muted,
              '&:hover': { backgroundColor: 'transparent', color: theme.palette.text.primary },
              '& .dyno-spin': { animation: 'dynospin 800ms linear infinite' },
              '@keyframes dynospin': { to: { transform: 'rotate(360deg)' } },
            }}
          >
            {receiptLinkState === 'busy'
              ? t('checkout.receipt.copying', { defaultValue: 'Creating link…' })
              : receiptLinkState === 'copied'
                ? t('checkout.receipt.linkCopied', { defaultValue: 'Receipt link copied' })
                : t('checkout.receipt.copyLink', { defaultValue: 'Copy receipt link' })}
          </Button>
          {receiptLinkState === 'error' && (
            <Typography data-testid="clean-checkout-receipt-link-error" sx={{ fontSize: 12, color: errFg, mt: 0.5 }}>
              {t('checkout.receipt.linkError', { defaultValue: 'Could not create the link — please try again.' })}
            </Typography>
          )}

          {/* Keep this merchant for next time — device-local, no account (hidden when the merchant has no public page) */}
          <SaveMerchantButton handle={meta_?.merchant?.handle} name={merchantName} avatar={meta_?.merchant?.company_logo} accent={LIME} />
        </Box>

        {/* Success-screen email catch — capture an email for the receipt AND the
            referral invite when the payer didn't leave one during checkout. */}
        {emailSaved ? (
          <Box sx={{ mt: 1.5, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }} data-testid="clean-checkout-success-email-saved">
            <Icon icon="mdi:check-circle" width={16} color={LIME} />
            <Typography sx={{ fontSize: 12.5, color: muted }}>
              {t('checkout.receiptEmail.savedShort', { defaultValue: 'Receipt is on its way to your inbox.' })}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 1.5 }} data-testid="clean-checkout-success-email-catch">
            <ReceiptEmailField
              value={receiptEmail}
              onChange={(v) => { setReceiptEmail(v); setEmailSaved(false) }}
              onSave={saveReceiptEmail}
              saved={emailSaved}
              invalid={emailInvalid}
              label={t('checkout.receiptEmail.successLabel', { defaultValue: 'Want a copy of your receipt?' })}
              helper={t('checkout.receiptEmail.successHelper', { defaultValue: "Add your email and we'll send your receipt — no account needed." })}
              savedLabel={t('checkout.receiptEmail.saved', { defaultValue: 'Receipt will be sent to this email.' })}
              invalidLabel={t('checkout.receiptEmail.invalid', { defaultValue: 'Enter a valid email address.' })}
              muted={muted}
              border={border}
              accent={LIME}
            />
          </Box>
        )}

        {/* ── Share — a quiet text link, never the primary action on a
            merchant's checkout (B6). Hidden when we have no name to share (B16). */}
        {(rawMerchantName || campaignTitle) && (
          <Box data-testid="clean-checkout-share" sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
            <Box
              component="button"
              type="button"
              data-testid="clean-checkout-share-btn"
              onClick={handleShare}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer', p: 0.5,
                display: 'inline-flex', alignItems: 'center', gap: 0.6,
                fontSize: 12.5, fontWeight: 600, color: shareCopied ? LIME : muted,
                '&:hover': { color: theme.palette.text.primary },
              }}
            >
              <Icon icon={shareCopied ? 'mdi:check' : 'mdi:share-variant-outline'} width={15} />
              {shareCopied
                ? t('checkout.share.copied', { defaultValue: 'Link copied!' })
                : isContribution
                  ? t('checkout.share.fundraiser', { defaultValue: 'Share this fundraiser' })
                  : t('checkout.share.paidWithCrypto', { defaultValue: 'Share that you paid with crypto' })}
            </Box>
          </Box>
        )}
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

  // ─── ORDER SUMMARY (left panel ≥1024px · collapsible bar below) ───
  const summaryNode = (
    <>
      {/* Brand row (small, top). Merchant logo sits alone on the left — the
          Dynopay mark moves to the far right so the two brands never read as one. */}
      {meta_?.merchant?.company_logo ? (
        <Box data-testid="clean-checkout-brand-row" data-variant="merchant" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
          <Box component="img" src={meta_.merchant.company_logo} alt={merchantName || ''} data-testid="clean-checkout-merchant-logo" sx={{ height: 28, maxWidth: 160, objectFit: 'contain', objectPosition: 'left' }} />
          <Box data-testid="clean-checkout-psp-mark" sx={{ display: 'flex', alignItems: 'center', gap: 0.6, opacity: 0.75, flexShrink: 0 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.02em', color: muted }}>
              {t('checkout.poweredBy', { defaultValue: 'Powered by' })}
            </Typography>
            <Logo width={14} height={17} />
            <Typography sx={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', color: muted }}>DYNOPAY</Typography>
          </Box>
        </Box>
      ) : (
        <Box data-testid="clean-checkout-brand-row" data-variant="dynopay" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Logo width={22} height={26} />
          <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: muted }}>
            DYNOPAY
          </Typography>
        </Box>
      )}

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

      {/* Identity-verified badge — buyer-trust signal shown when the merchant
          behind this payment link is KYC-approved (resolved by the link ref).
          Renders nothing for unverified/unknown merchants. */}
      <Box sx={{ mt: 0.75 }}>
        <PublicVerifiedBadge linkRef={d} showLabel size={16} ml={0} />
      </Box>

      {/* Amount hero — the total the buyer pays is the mono headline. An order
          summary (Amount [+ Tax] [+ Processing fee]) appears beneath it only when
          there is something to itemise — never the merchant share or who pays. */}
      <Box data-testid="clean-checkout-fee-breakdown" sx={{ mt: 2.25, mb: 3 }}>
        <Typography sx={labelSx}>
          {t('checkout.totalYouPay', { defaultValue: 'Total you pay' })}
        </Typography>
        <Typography
          data-testid="clean-checkout-amount"
          sx={{
            fontFamily: MONO,
            fontVariantNumeric: 'tabular-nums',
            fontSize: { xs: 34, sm: 40 },
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: theme.palette.text.primary,
            mb: showSummary ? 1.75 : 0,
          }}
        >
          {fmtFiat(totalAmt)}
          <Box component="span" sx={{ fontSize: '0.42em', fontWeight: 500, color: muted, ml: 1, verticalAlign: 'middle', letterSpacing: 0 }}>
            {meta_?.base_currency || 'USD'}
          </Box>
        </Typography>
        {showSummary && (
          <Box sx={{ pt: 1.5, borderTop: `1px solid ${border}` }}>
            <PriceBreakdown
              rows={fiatRows.filter((r) => !r.emphasis).map((r) => ({ ...r, dividerBefore: false }))}
              muted={muted}
              border={border}
              textColor={theme.palette.text.primary}
              mono={MONO}
              compact
            />
            {/* B10: the total moves once from estimate → exact; say so instead of changing silently */}
            {feePayerIsCustomer && feeExact && cryptoInfo && (
              <Typography data-testid="clean-checkout-fee-updated" sx={{ mt: 0.75, fontSize: 11.5, color: muted, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Icon icon="mdi:check-circle-outline" width={13} />
                {t('checkout.feeUpdatedExact', { defaultValue: 'Updated with the exact {{coin}} network fee.', coin: cryptoInfo.crypto_base })}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Reference row (invoice / campaign / description) */}
      {(meta_?.order_reference || meta_?.description) && (
        <Box
          data-testid="clean-checkout-reference"
          sx={{
            display: 'flex', flexDirection: 'column', gap: 0.5,
            pt: 2,
            borderTop: `1px solid ${border}`,
          }}
        >
          {meta_.description && (
            <Typography fontSize={13} color={theme.palette.text.primary} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {meta_.description}
            </Typography>
          )}
          {meta_.order_reference && (
            <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: muted, letterSpacing: '0.04em' }}>
              {t('checkout.reference', { defaultValue: 'REFERENCE' })} · {meta_.order_reference}
            </Typography>
          )}
        </Box>
      )}

      {/* Trust row — "Payments secured by Dynopay · Verified merchant" (the
          verified segment shows only for a KYC-verified merchant). Pinned to
          the bottom of the summary column on desktop. */}
      <Box sx={{ mt: "auto", pt: 3 }}>
        <Box sx={{ pt: 2, borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <MerchantTrustRow linkRef={d} color={muted} justify="flex-start" />
          <Box data-testid="clean-checkout-legal-links" sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
            <a href="/pay/terms-of-service" target="_blank" rel="noopener noreferrer" style={{ color: muted, fontSize: 11, textDecoration: 'none' }}>
              {t('checkout.terms', { defaultValue: 'Terms' })}
            </a>
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: muted, fontSize: 11, textDecoration: 'none' }}>
              {t('checkout.privacy', { defaultValue: 'Privacy' })}
            </a>
          </Box>
        </Box>
      </Box>
    </>
  )

  return (
    <>
    <PanelShell
      isDark={isDark}
      border={border}
      muted={muted}
      summary={summaryNode}
      summaryBar={{
        label: headline,
        amount: `${fmtFiat(totalAmt)} ${meta_?.base_currency || 'USD'}`,
        toggleLabel: t('checkout.orderSummary', { defaultValue: 'Order summary' }),
      }}
    >
      {stripState && (
        <CheckoutStatusStrip
          state={stripState}
          // B1/B7: once detected, the reservation window no longer applies —
          // drop the countdown and quote the per-network confirmation ETA.
          secondsRemaining={detected ? undefined : timeLeft}
          totalSeconds={detected ? undefined : totalSeconds}
          caption={detected && cryptoInfo
            ? (detectStage === 'mempool'
              ? t('checkout.strip.confirming.captionMempool', { defaultValue: 'Your transaction is in the {{network}} queue (0 confirmations). It usually confirms within {{eta}}.', network: CRYPTO_INFO[cryptoInfo.crypto_display]?.networkLabel || cryptoInfo.network, eta: networkEta(cryptoInfo.crypto_display) })
              : t('checkout.strip.confirming.captionOnChain', { defaultValue: 'Confirmed on {{network}} — finalizing your payment now.', network: CRYPTO_INFO[cryptoInfo.crypto_display]?.networkLabel || cryptoInfo.network }))
            : undefined}
          data-testid="pay-status-strip"
          data-detect-stage={detected ? detectStage : 'none'}
        />
      )}

      {/* Coin-first picker (B3): pick the coin, then a network only if needed */}
      <Box sx={{ mb: 2.5 }} data-testid="clean-checkout-coin-picker">
        <Typography sx={labelSx}>
          {t('checkout.payWithLabel', { defaultValue: 'PAY WITH' })}
        </Typography>
        <Select
          fullWidth
          size="small"
          data-testid="clean-checkout-currency-select"
          value={selectedSymbol || ''}
          renderValue={(val) => {
            const sym = String(val)
            const g = groups.find((x) => x.symbol === sym)
            const headInfo = g ? CRYPTO_INFO[g.codes[0]] : undefined
            const selInfo = CRYPTO_INFO[selectedCurrency]
            const netLbl = selInfo?.networkLabel || ''
            const multi = !!g && g.codes.length > 1
            // Confirm the exact chain the buyer will pay on (e.g. "RLUSD · XRP Ledger").
            // Hidden for coins whose network name is redundant with the coin (BTC/ETH/SOL).
            const showNet = !!netLbl && netLbl !== sym && (multi || netLbl !== headInfo?.label)
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {headInfo && <Icon icon={headInfo.icon} width={18} color={headInfo.iconColor} />}
                <span style={{ fontWeight: 700 }}>{sym}</span>
                {showNet && (
                  <Box component="span" sx={{ color: muted, fontSize: 12.5, fontWeight: 500 }} data-testid="clean-checkout-selected-network">
                    · {netLbl}
                  </Box>
                )}
              </Box>
            )
          }}
          onChange={(e) => pickSymbol(String(e.target.value))}
          disabled={phase === 'creating_payment'}
          sx={{
            borderRadius: '10px',
            minHeight: 46,
            fontWeight: 600,
            '& .MuiSelect-select': { paddingTop: '11px', paddingBottom: '11px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: border, transition: 'border-color 150ms ease' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: muted },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: LIME, borderWidth: 1.5 },
          }}
        >
          {groups.map((g) => {
            const info = CRYPTO_INFO[g.codes[0]]
            // Surface the network(s) at a glance so buyers pick the right chain —
            // e.g. RLUSD shows "XRP Ledger · Ethereum". For single-network coins we
            // only show the network when it adds info beyond the coin name (so TRX
            // shows "Tron" and XRP shows "XRP Ledger", but BTC/ETH stay clean).
            const netHint = g.codes.length > 1
              ? g.codes.map((c) => CRYPTO_INFO[c]?.networkLabel).filter(Boolean).join(' · ')
              : ((): string => {
                  const nl = CRYPTO_INFO[g.codes[0]]?.networkLabel || ''
                  return nl && nl !== g.symbol && nl !== info.label ? nl : ''
                })()
            return (
              <MenuItem key={g.symbol} value={g.symbol} data-testid={`clean-checkout-coin-${g.symbol}`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Icon icon={info.icon} width={18} color={info.iconColor} />
                  <span style={{ fontWeight: 700 }}>{g.symbol}</span>
                  <Box component="span" sx={{ color: muted, fontSize: 12.5, fontWeight: 500 }}>{info.label !== g.symbol ? info.label : ''}</Box>
                  {netHint && (
                    <Box component="span" sx={{ ml: 'auto', color: muted, fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap' }} data-testid={`clean-checkout-coin-net-${g.symbol}`}>
                      {netHint}
                    </Box>
                  )}
                </Box>
              </MenuItem>
            )
          })}
        </Select>

        {networkOptions.length > 1 && (
          <Box sx={{ mt: 1.5 }} data-testid="clean-checkout-network-chips">
            <Typography sx={labelSx}>
              {t('checkout.networkLabel', { defaultValue: 'NETWORK' })}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {networkOptions.map((code) => {
                const info = CRYPTO_INFO[code]
                const active = code === selectedCurrency
                return (
                  <Box
                    key={code}
                    component="button"
                    type="button"
                    onClick={() => pickNetworkCode(code)}
                    disabled={phase === 'creating_payment'}
                    data-testid={`clean-checkout-network-${info.network}`}
                    aria-pressed={active}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.75,
                      px: 1.5, minHeight: 40, borderRadius: '999px', cursor: 'pointer',
                      border: `1.5px solid ${active ? LIME : border}`,
                      backgroundColor: active ? (isDark ? 'rgba(129,140,248,0.12)' : 'rgba(67,56,202,0.06)') : 'transparent',
                      color: theme.palette.text.primary, fontSize: 13, fontWeight: active ? 700 : 600,
                      transition: 'border-color 150ms ease, background-color 150ms ease',
                      '&:hover': { borderColor: LIME },
                      '&:focus-visible': { outline: `2px solid ${LIME}`, outlineOffset: 2 },
                    }}
                  >
                    {info.networkLabel}
                    <Box component="span" sx={{ color: muted, fontSize: 11.5, fontWeight: 500 }}>· {networkEta(code)}</Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}

        {/* B4: explicit continue — the address is reserved and the timer
            starts only now, after the buyer has read the page. */}
        {phase === 'currency_select' && selectedCurrency && (
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={handleContinue}
            data-testid="clean-checkout-continue-btn"
            endIcon={<Icon icon="mdi:arrow-right" width={18} />}
            sx={{
              mt: 2, minHeight: 48, borderRadius: '999px', textTransform: 'none',
              fontSize: 15, fontWeight: 800, backgroundColor: LIME, color: ON_BRAND,
              '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
            }}
          >
            {t('checkout.continueWith', {
              defaultValue: 'Continue with {{coin}} on {{network}}',
              coin: selectedSymbol,
              network: CRYPTO_INFO[selectedCurrency]?.networkLabel || '',
            })}
          </Button>
        )}
        {phase === 'currency_select' && selectedCurrency && (
          <Typography sx={{ mt: 1, fontSize: 11.5, color: muted, textAlign: 'center' }} data-testid="clean-checkout-continue-hint">
            {t('checkout.continueHint', { defaultValue: "You'll get a payment address and 30 minutes to send." })}
          </Typography>
        )}
      </Box>

      {/* B2: recoverable error — brand, amount and selects stay mounted above */}
      {inlineError && (
        <Box data-testid="clean-checkout-error" sx={{ mb: 2.5 }}>
          <Alert
            severity="error"
            sx={{ borderRadius: '10px', alignItems: 'flex-start' }}
            action={
              <Button
                size="small"
                color="inherit"
                onClick={retryReservation}
                data-testid="clean-checkout-error-retry"
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                {t('checkout.tryAgain', { defaultValue: 'Try again' })}
              </Button>
            }
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              {t('checkout.errorTitle', { defaultValue: "We couldn't prepare this payment" })}
            </Typography>
            <Typography sx={{ fontSize: 12.5, mt: 0.25 }}>
              {errorMsg || t('checkout.genericError', { defaultValue: 'Something went wrong.' })}{' '}
              {t('checkout.errorHint', { defaultValue: 'Try again, or pick a different coin or network above.' })}
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Reserving an address — inline loader. Keeps the header, amount and
          coin selects steady (no full-panel flash) while /pay/addPayment runs.
          Replaces the old full-panel `creating_payment` blank that made the
          checkout appear to load, vanish, then reappear. */}
      {phase === 'creating_payment' && (
        <Box
          data-testid="clean-checkout-preparing"
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, py: 4 }}
        >
          <Box
            sx={{
              width: 26, height: 26, borderRadius: '50%',
              border: `3px solid ${border}`, borderTopColor: INK,
              animation: 'spin 800ms linear infinite',
              '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
            }}
          />
          <Typography fontSize={13.5} color={muted}>
            {t('checkout.preparingAddress', { defaultValue: 'Preparing payment address…' })}
          </Typography>
        </Box>
      )}

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
            <Typography data-testid="clean-checkout-underpaid-fee-note" sx={{ fontSize: 11.5, color: theme.palette.text.secondary, mt: 0.5, lineHeight: 1.5 }}>
              {t('checkout.underpaid.secondFeeNote', { defaultValue: "Your wallet will charge a second network fee for this top-up — that's normal and doesn't change the amount above." })}
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
        <Box data-testid="clean-checkout-instruction" sx={{ textAlign: { xs: 'center', sm: 'left' }, mb: 2, mt: 0.5 }}>
          <Typography sx={{ ...labelSx, mb: 0.5 }}>
            {t('checkout.sendExactly', { defaultValue: 'Send exactly' })}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: { xs: 'center', sm: 'flex-start' }, columnGap: 1, rowGap: 0.25 }}>
            <Typography
              component="strong"
              data-testid="clean-checkout-instruction-amount"
              sx={{
                display: 'block',
                fontFamily: MONO,
                fontVariantNumeric: 'tabular-nums',
                fontSize: { xs: 24, sm: 26 },
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                color: theme.palette.text.primary,
                wordBreak: 'break-word',
              }}
            >
              {formatCryptoAmount(amountToSend, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}
            </Typography>
            <Typography sx={{ fontSize: 13, color: muted }}>
              {t('checkout.payOn', { defaultValue: 'on' })} {CRYPTO_INFO[cryptoInfo.crypto_display]?.networkLabel || cryptoInfo.network}
            </Typography>
            <AssetNetworkChip
              symbol={cryptoInfo.crypto_base}
              networkLabel={CRYPTO_INFO[cryptoInfo.crypto_display]?.networkLabel || cryptoInfo.network}
              isDark={isDark}
            />
          </Box>
        </Box>
      )}

      {/* Pay grid — QR on the left, address / amount / wallet deep-link on the
          right (≥600px) so the whole payment step fits without scrolling. */}
      {cryptoInfo && (
        <Box
          data-testid="clean-checkout-pay-grid"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: (cryptoInfo.qr_code || paymentUri) ? 'minmax(0, 232px) minmax(0, 1fr)' : 'minmax(0, 1fr)' },
            columnGap: 3,
            alignItems: 'start',
            mb: 0.5,
          }}
        >
        <Box sx={{ minWidth: 0 }}>
      {/* QR code — crisp & responsive; tap the QR to copy the address */}
      {cryptoInfo && (cryptoInfo.qr_code || paymentUri) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
          <Box
            component="button"
            type="button"
            onClick={() => doCopy(cryptoInfo.address, 'addr')}
            aria-label={t('checkout.tapToCopyAddress', { defaultValue: 'Tap to copy payment address' })}
            data-testid="clean-checkout-qr-panel"
            sx={{
              p: 2, borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : border}`, backgroundColor: '#FFFFFF',
              width: '100%', maxWidth: { xs: 264, sm: 232 }, mx: 'auto', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              transition: 'transform .15s ease, border-color .15s ease',
              '&:hover': { borderColor: LIME },
              '&:active': { transform: 'scale(0.98)' },
              '&:focus-visible': { outline: `2px solid ${LIME}`, outlineOffset: 3 },
            }}
          >
            {paymentUri ? (
              // URI-encoded QR — scanning with a wallet app pre-fills the
              // address AND amount (BIP-21 / Solana Pay).
              <QRCodeSVG
                value={paymentUri.uri}
                size={200}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#000000"
                style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block' }}
                data-testid="clean-checkout-qr-svg"
              />
            ) : (
              <Box
                component="img"
                src={cryptoInfo.qr_code.startsWith('data:') ? cryptoInfo.qr_code : `data:image/png;base64,${cryptoInfo.qr_code}`}
                alt={t('checkout.qrAlt', { defaultValue: 'Payment QR code' })}
                sx={{
                  width: '100%', maxWidth: 200, height: 'auto',
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
        </Box>
        <Box sx={{ minWidth: 0 }}>
      {/* Address row */}
      {cryptoInfo && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={labelSx}>
            {t('checkout.addressLabel', { defaultValue: 'ADDRESS' })}
          </Typography>
          <Box data-testid="clean-checkout-address-row" data-copied={copiedFlag === 'addr' ? 'true' : 'false'} sx={copyRowSx('addr')}>
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
                transition: 'border-color 150ms ease, color 150ms ease, background-color 150ms ease',
                ...(copiedFlag === 'addr' ? { borderColor: LIME, color: ON_BRAND, backgroundColor: LIME } : {}),
                '&:hover': { borderColor: LIME, color: copiedFlag === 'addr' ? ON_BRAND : LIME },
                '&:focus-visible': { outline: `2px solid ${LIME}`, outlineOffset: 2 },
              }}
            >
              <Icon icon={copiedFlag === 'addr' ? 'mdi:check' : 'mdi:content-copy'} width={12} />
              <span aria-live="polite">{copiedFlag === 'addr' ? t('checkout.copied', { defaultValue: 'Copied' }) : t('checkout.copy', { defaultValue: 'Copy' })}</span>
            </Box>
          </Box>
        </Box>
      )}

      {/* Amount row */}
      {cryptoInfo && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={labelSx}>
            {t('checkout.amountLabel', { defaultValue: 'AMOUNT' })}
          </Typography>
          <Box data-testid="clean-checkout-amount-row" data-copied={copiedFlag === 'amt' ? 'true' : 'false'} sx={copyRowSx('amt')}>
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
                transition: 'border-color 150ms ease, color 150ms ease, background-color 150ms ease',
                ...(copiedFlag === 'amt' ? { borderColor: LIME, color: ON_BRAND, backgroundColor: LIME } : {}),
                '&:hover': { borderColor: LIME, color: copiedFlag === 'amt' ? ON_BRAND : LIME },
                '&:focus-visible': { outline: `2px solid ${LIME}`, outlineOffset: 2 },
              }}
            >
              <Icon icon={copiedFlag === 'amt' ? 'mdi:check' : 'mdi:content-copy'} width={12} />
              <span aria-live="polite">{copiedFlag === 'amt' ? t('checkout.copied', { defaultValue: 'Copied' }) : t('checkout.copy', { defaultValue: 'Copy' })}</span>
            </Box>
          </Box>
          <RateFreshness updatedAt={rateFetchedAt} color={muted} />
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
              data-testid="clean-checkout-copy-memo"
              onClick={() => doCopy(cryptoInfo.memo, 'memo')}
              sx={{
                background: 'none', border: `1px solid ${border}`, borderRadius: '8px',
                px: 1.5, py: 0.9, minHeight: 44, cursor: 'pointer', color: theme.palette.text.primary,
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.35,
                ...(copiedFlag === 'memo' ? { borderColor: LIME, color: ON_BRAND, backgroundColor: LIME } : {}),
              }}
            >
              <Icon icon={copiedFlag === 'memo' ? 'mdi:check' : 'mdi:content-copy'} width={12} /> {copiedFlag === 'memo' ? t('checkout.copied', { defaultValue: 'Copied' }) : t('checkout.copy', { defaultValue: 'Copy' })}
            </Box>
          </Box>
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
        </Box>
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

      {/* Optional "Email me a receipt" — after the payment details so it never
          sits between the coin picker and the QR (audit 2.2 step 3). */}
      {cryptoInfo && (
        <Box sx={{ mb: 2 }}>
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
            accent={LIME}
          />
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
              onChange={(e) => { setRefundAddress(e.target.value); setRefundSaved(false) }}
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
            {refundSaved && (
              <Typography data-testid="clean-checkout-refund-saved" sx={{ fontSize: 11.5, color: LIME, mt: 0.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <Icon icon="mdi:check-circle" width={13} />
                {t('checkout.refund.saved', { defaultValue: 'Refund address saved' })}
              </Typography>
            )}
          </Collapse>
        </Box>
      )}

      {/* Live status: Waiting → Detected → Confirmed timeline + pill + timer */}
      {cryptoInfo && (
        <CheckoutStatusTimeline
          phase={phase}
          detected={detected}
          detectStage={detectStage}
          timerLabel={timerLabel}
          secondsRemaining={timeLeft}
          totalSeconds={totalSeconds}
          isDark={isDark}
          hideBar={!!stripState}
          etaLabel={networkEta(cryptoInfo.crypto_display)}
          t={t}
        />
      )}

      {/* Spacer so the mobile sticky pay bar never covers the footer/content */}
      {cryptoInfo && <Box sx={{ display: { xs: 'block', md: 'none' }, height: 'calc(92px + var(--dp-lang-bar, 0px))' }} />}
    </PanelShell>

      {/* ── Mobile sticky pay bar — amount + copy-address always in thumb reach.
          Rendered as a FRAGMENT sibling of PanelShell (not a Box child) so the
          portal node never trips MUI Box's PropTypes `children` check. ── */}
      {portalReady && cryptoInfo && phase !== 'confirmed' && createPortal(
        <Box
          data-testid="checkout-sticky-bar"
          sx={{
            // Lift above the first-visit language chooser (--dp-lang-bar) so the
            // pay CTA is never buried under it.
            position: 'fixed', left: 0, right: 0, bottom: 'var(--dp-lang-bar, 0px)', zIndex: 1300,
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
                aria-label={t('checkout.copyAddress', { defaultValue: 'Copy address' })}
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


export default CleanCheckoutV2
