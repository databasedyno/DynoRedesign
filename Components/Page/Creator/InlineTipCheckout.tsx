import { BRAND_ACCENT } from "@/constants/theme";
/**
 * InlineTipCheckout — self-contained inline crypto tip checkout for the
 * creator page Support Widget. Replaces the /pay full-page redirect so the
 * donor never leaves /{handle}.
 *
 * Handles: currency selection → address+QR → live status polling →
 *          confirmed / underpaid (with grace) / overpaid (treated as success) /
 *          expired / failed.
 *
 * Auth: uses the session JWT from POST /api/pay/getData as an EXPLICIT
 * Authorization: Bearer header via raw fetch — never touches localStorage,
 * so a merchant visitor's own token is not accidentally sent to customer
 * endpoints (which would 403 with "Customer account does not exist").
 *
 * Spec: /app/memory/INLINE_TIP_CHECKOUT_SPEC.md
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, CircularProgress, Collapse, TextField, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import { usePaymentNotification } from '@/hooks/usePaymentNotification'
import { ReceiptEmailField, NotifyMeInline } from '@/Components/Page/Pay3Components/checkoutExtras'
import { formatCryptoAmount, formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
import copyToClipboard from '@/helpers/copyToClipboard'
import fireConfettiBurst from '@/utils/confettiBurst'

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
// Aurora indigo — Landing v3 canonical accent (Session 82 migration).
const LIME = BRAND_ACCENT
const INK = '#0A0A0B'

type Phase =
  | 'loading_meta'
  | 'currency_select'
  | 'creating_payment'
  | 'awaiting_payment'
  | 'underpaid'
  | 'confirmed'
  | 'expired'
  | 'failed'
  | 'error'

interface Meta {
  amount: number
  base_currency: string
  available_currencies: string[]
  token: string
  contribution?: {
    campaign_title?: string | null
    donor_name?: string | null
    donor_message?: string | null
    is_anonymous?: boolean
    show_supporters?: boolean
    supporters_count?: number | null
    raised_amount?: number | null
    campaign_currency?: string | null
  } | null
  merchant?: { name?: string; company_logo?: string | null } | null
}

interface CryptoInfo {
  address: string
  qr_code: string
  memo: string
  expected_amount: number  // crypto amount to send
  crypto_display: string   // e.g. "USDT-TRC20"
  crypto_base: string      // e.g. "USDT"
  network: string          // e.g. "TRC20"
}

interface PartialPay {
  paidAmount: number
  expectedAmount: number
  remainingAmount: number
  currency: string
  paidAmountUsd?: number
  expectedAmountUsd?: number
  remainingAmountUsd?: number
  baseCurrency?: string
  graceMinutes?: number
}

const STYLE_META: Record<string, { title: string; icon: string; cta: string; successVerb: string }> = {
  coffee: { title: 'Buy me a coffee', icon: 'mdi:coffee', cta: 'Buy', successVerb: 'bought me a coffee' },
  tip: { title: 'Send a tip', icon: 'mdi:hand-coin', cta: 'Send', successVerb: 'sent a tip' },
  support: { title: 'Support me', icon: 'mdi:heart', cta: 'Support', successVerb: 'supported' },
}

// Mode-specific labels. 'tip' is the original creator-page behavior. 'link'
// is used when this component is mounted inline for a REGULAR payment link
// (no donor/creator concept — merchant + amount only). 'donation' is used
// when it's an inline checkout for a donation contribution (child link).
type InlineMode = 'tip' | 'link' | 'donation'

const MODE_COPY: Record<InlineMode, {
  preparing: string
  underpaidTail: string
  successTitle: (donorName: string, isAnon: boolean) => string
  successSubject: (creatorOrMerchantOrCampaign: string, verb: string) => string
  shareText: (target: string, verb: string, url: string) => string
  backLabel: (target: string) => string
  againLabel: string
}> = {
  tip: {
    preparing: 'Preparing your tip…',
    underpaidTail: 'more to the same address to complete your tip.',
    successTitle: (donorName, isAnon) => `Thank you${!isAnon && donorName ? `, ${donorName}` : ''}!`,
    successSubject: (creator, verb) => `You ${verb} ${creator}`,
    shareText: (target, verb, url) => `I just ${verb} ${target}! ${url}`,
    backLabel: (target) => `Back to ${target}`,
    againLabel: 'Send another tip',
  },
  link: {
    preparing: 'Preparing your payment…',
    underpaidTail: 'more to the same address to complete your payment.',
    successTitle: () => 'Payment successful!',
    successSubject: (merchant) => `Paid to ${merchant}`,
    shareText: (target, _verb, url) => `Just paid ${target} on Dynopay. ${url}`,
    backLabel: (target) => `Back to ${target}`,
    againLabel: 'New payment',
  },
  donation: {
    preparing: 'Preparing your donation…',
    underpaidTail: 'more to the same address to complete your donation.',
    successTitle: (donorName, isAnon) => `Thank you${!isAnon && donorName ? `, ${donorName}` : ''}!`,
    successSubject: (campaign) => `You supported ${campaign}`,
    shareText: (target, _verb, url) => `I just supported ${target}. ${url}`,
    backLabel: (target) => `Back to ${target}`,
    againLabel: 'Donate again',
  },
}

// Popular chain groups (kept simple — matches the payment router's supported list)
const CRYPTO_INFO: Record<string, { label: string; icon: string; iconColor?: string; symbol: string; network?: string }> = {
  BTC: { label: 'Bitcoin', icon: 'cryptocurrency-color:btc', symbol: 'BTC' },
  ETH: { label: 'Ethereum', icon: 'cryptocurrency-color:eth', symbol: 'ETH' },
  LTC: { label: 'Litecoin', icon: 'cryptocurrency-color:ltc', symbol: 'LTC' },
  DOGE: { label: 'Dogecoin', icon: 'cryptocurrency-color:doge', symbol: 'DOGE' },
  BCH: { label: 'Bitcoin Cash', icon: 'cryptocurrency-color:bch', symbol: 'BCH' },
  TRX: { label: 'Tron', icon: 'cryptocurrency-color:trx', symbol: 'TRX' },
  SOL: { label: 'Solana', icon: 'cryptocurrency-color:sol', symbol: 'SOL' },
  XRP: { label: 'XRP', icon: 'cryptocurrency-color:xrp', symbol: 'XRP' },
  POLYGON: { label: 'Polygon', icon: 'cryptocurrency-color:matic', symbol: 'POL' },
  'USDT-TRC20': { label: 'USDT (Tron)', icon: 'cryptocurrency-color:usdt', symbol: 'USDT', network: 'TRC20' },
  'USDT-ERC20': { label: 'USDT (Ethereum)', icon: 'cryptocurrency-color:usdt', symbol: 'USDT', network: 'ERC20' },
  'USDT-POLYGON': { label: 'USDT (Polygon)', icon: 'cryptocurrency-color:usdt', symbol: 'USDT', network: 'POLYGON' },
  'USDC-ERC20': { label: 'USDC (Ethereum)', icon: 'cryptocurrency-color:usdc', symbol: 'USDC', network: 'ERC20' },
  RLUSD: { label: 'RLUSD (XRPL)', icon: 'mdi:currency-usd', iconColor: '#22c55e', symbol: 'RLUSD' },
  'RLUSD-ERC20': { label: 'RLUSD (Ethereum)', icon: 'mdi:currency-usd', iconColor: '#22c55e', symbol: 'RLUSD', network: 'ERC20' },
}

function shortenAddr(a: string): string {
  if (!a) return ''
  if (a.length <= 20) return a
  return `${a.slice(0, 10)}…${a.slice(-8)}`
}

/**
 * fetch wrapper that always adds Authorization: Bearer if provided AND
 * never uses localStorage. Returns the parsed { message, data } envelope.
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

interface InlineTipCheckoutProps {
  d: string
  handle: string
  creatorName: string
  style: 'coffee' | 'tip' | 'support'
  siteUrl: string
  onNewTip: () => void
  onCancel: () => void
  /** Fired once the payment reaches the confirmed phase. The store checkout
   *  uses this to clear the cart only after a successful payment (so
   *  "Change amount" can return to the cart with items intact beforehand). */
  onConfirmed?: () => void
  /** Copy mode. Default 'tip' (original creator-page behavior). Use 'link'
   *  for a regular payment-link inline checkout on the creator page, or
   *  'donation' for a donation contribution inline checkout. */
  mode?: InlineMode
  /** Optional label shown in place of the creator handle (e.g. the link
   *  title or campaign title). Falls back to creatorName / @handle. */
  targetLabel?: string
  /** Show the optional "Email me a receipt" field. Default true. The store
   *  checkout sets this false because it already collects the buyer email. */
  collectReceiptEmail?: boolean
}

const InlineTipCheckout: React.FC<InlineTipCheckoutProps> = ({
  d,
  handle,
  creatorName,
  style,
  siteUrl,
  onNewTip,
  onCancel,
  onConfirmed,
  mode = 'tip',
  targetLabel,
  collectReceiptEmail = true,
}) => {
  const { t } = useTranslation('landing')
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const border = theme.palette.divider
  const surface = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const limeTint = isDark ? 'rgba(79,70,229,0.10)' : 'rgba(79,70,229,0.16)'
  const warnTint = isDark ? 'rgba(255,190,50,0.10)' : 'rgba(255,190,50,0.18)'
  const errTint = isDark ? 'rgba(255,80,80,0.10)' : 'rgba(255,80,80,0.14)'
  const meta = STYLE_META[style] || STYLE_META.coffee
  const modeCopy = MODE_COPY[mode] || MODE_COPY.tip
  // Effective label used in success/share/back copy: prefer explicit
  // targetLabel (e.g. link title), then creatorName, then @handle.
  const effectiveTarget = targetLabel || creatorName || `@${handle}`

  const [phase, setPhase] = useState<Phase>('loading_meta')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [meta_, setMeta] = useState<Meta | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [cryptoInfo, setCryptoInfo] = useState<CryptoInfo | null>(null)
  const [partial, setPartial] = useState<PartialPay | null>(null)
  const [confirmedAmount, setConfirmedAmount] = useState<{ crypto: number; cryptoLabel: string; fiat: number; fiatCurrency: string } | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0) // seconds
  const [copiedFlag, setCopiedFlag] = useState<string>('')
  const [qrExpanded, setQrExpanded] = useState<boolean>(false)
  // Optional buyer refund address — if they send the wrong asset/network we
  // try to refund here (minus network fees). Mirrors CleanCheckoutV2.
  const [showRefundInput, setShowRefundInput] = useState<boolean>(false)
  const [refundAddress, setRefundAddress] = useState<string>('')
  const [refundSaved, setRefundSaved] = useState<boolean>(false)
  // Optional buyer receipt email ("Email me a receipt") — attaches a recipient
  // to the checkout session so the post-payment receipt email fires.
  const [receiptEmail, setReceiptEmail] = useState<string>('')
  const [emailSaved, setEmailSaved] = useState<boolean>(false)

  // Browser "Payment confirmed" alert (opt-in) so the supporter can tab away.
  const notif = usePaymentNotification()
  const notifiedRef = useRef<boolean>(false)

  // Best-effort, non-blocking. Backend endpoint is idempotent per ref.
  const saveRefundAddress = useCallback(async (addr: string) => {
    if (!meta_?.token || !addr.trim()) return
    const r = await api('/pay/setRefundAddress', { data: d, refund_address: addr.trim() }, meta_.token)
    if (r.ok) setRefundSaved(true)
  }, [d, meta_])

  // Save the optional receipt email (best-effort, non-blocking).
  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const emailInvalid = receiptEmail.trim().length > 0 && !emailValid(receiptEmail)
  const saveReceiptEmail = useCallback(async () => {
    const v = receiptEmail.trim().toLowerCase()
    if (!v || !emailValid(v) || !meta_?.token) return
    const r = await api('/pay/setCustomerEmail', { data: d, email: v }, meta_.token)
    if (r.ok) setEmailSaved(true)
  }, [receiptEmail, d, meta_])

  const pollRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const mountedRef = useRef<boolean>(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ─── Step 1: fetch meta via /pay/getData ─────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPhase('loading_meta')
      setErrorMsg('')
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
          : []
      setMeta({
        amount: Number(raw.amount) || 0,
        base_currency: raw.base_currency || 'USD',
        available_currencies: available,
        token: String(raw.token || ''),
        contribution: raw.contribution || null,
        merchant: raw.merchant || null,
      })
      setPhase('currency_select')
    })()
    return () => {
      cancelled = true
    }
  }, [d])

  // ─── Step 2: user picks a crypto → addPayment ────────────────────────
  const pickCurrency = useCallback(
    async (code: string) => {
      if (!meta_) return
      const info = CRYPTO_INFO[code]
      if (!info) {
        setErrorMsg(`Unsupported currency: ${code}`)
        setPhase('error')
        return
      }
      setSelectedCurrency(code)
      setPhase('creating_payment')
      setErrorMsg('')

      const token = meta_.token
      // 1. Fetch the crypto rate to know the expected crypto amount
      const rateRes = await api(
        '/pay/getCurrencyRates',
        {
          source: meta_.base_currency,
          amount: meta_.amount,
          currencyList: [info.symbol],
          fixedDecimal: false,
        },
        token,
      )
      if (!mountedRef.current) return
      if (!rateRes.ok || !Array.isArray(rateRes.data) || !rateRes.data[0]) {
        setErrorMsg(rateRes.message || 'Failed to get exchange rate.')
        setPhase('error')
        return
      }
      const rateRow: any = rateRes.data[0]
      const cryptoAmount: number = Number(rateRow.total_amount ?? rateRow.amount) || 0
      if (!cryptoAmount) {
        setErrorMsg('Rate unavailable for this currency.')
        setPhase('error')
        return
      }

      // 2. encrypt the payload
      const payload = { currency: code, amount: cryptoAmount, paymentType: 'CRYPTO' }
      const encRes = await api('/pay/encrypt-payload', { payload: JSON.stringify(payload) }, undefined)
      if (!mountedRef.current) return
      if (!encRes.ok || !encRes.data?.data) {
        setErrorMsg(encRes.message || 'Failed to encrypt payment.')
        setPhase('error')
        return
      }
      const encrypted = encRes.data.data

      // 3. addPayment — reserves an address from the merchant pool
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
        network: info.network || '',
      })
      const timerMins: number =
        Number(r.remaining_minutes) || Number(r.expires_in_minutes) || Number(r.expiration_minutes) || 30
      setTimeLeft(timerMins * 60)
      setPhase('awaiting_payment')
    },
    [meta_],
  )

  // ─── Step 3: poll verifyCryptoPayment ────────────────────────────────
  useEffect(() => {
    // Celebration burst the moment the supporter's payment is CONFIRMED.
    // Decorative only (never throws), skipped for reduced-motion users.
    if (phase === 'confirmed') {
      fireConfettiBurst(); onConfirmed?.()
      if (!notifiedRef.current) {
        notifiedRef.current = true
        notif.notify(
          t('checkout.notify.title', { defaultValue: 'Payment confirmed \u2713' }),
          t('checkout.notify.body', { defaultValue: 'Your payment to {{name}} is confirmed.', name: effectiveTarget }),
        )
      }
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'awaiting_payment' && phase !== 'underpaid') return
    if (!cryptoInfo?.address || !meta_?.token) return

    const poll = async () => {
      const r = await api('/pay/verifyCryptoPayment', { address: cryptoInfo.address }, meta_.token)
      if (!mountedRef.current) return
      if (!r.ok || !r.data) return // silent — try again next tick

      const s = String(r.data.status || 'waiting')
      const d_: any = r.data

      // Update remaining timer from backend if provided
      if (d_.remaining_seconds !== undefined && d_.remaining_seconds > 0) {
        setTimeLeft(Number(d_.remaining_seconds))
      }

      if (s === 'confirmed' || s === 'overpaid') {
        // Q2b user decision: overpaid → treat as success, no refund message.
        // Use paidAmount when we have it; else fall back to expected.
        setConfirmedAmount({
          crypto: Number(d_.paidAmount || d_.expectedAmount || cryptoInfo.expected_amount),
          cryptoLabel: cryptoInfo.crypto_display,
          fiat: Number(d_.paidAmountUsd || meta_.amount),
          fiatCurrency: String(d_.baseCurrency || meta_.base_currency),
        })
        setPhase('confirmed')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      if (s === 'underpaid') {
        setPartial({
          paidAmount: Number(d_.paidAmount || 0),
          expectedAmount: Number(d_.expectedAmount || cryptoInfo.expected_amount),
          remainingAmount: Number(d_.remainingAmount || 0),
          currency: String(d_.currency || cryptoInfo.crypto_display),
          paidAmountUsd: Number(d_.paidAmountUsd || 0),
          expectedAmountUsd: Number(d_.expectedAmountUsd || meta_.amount),
          remainingAmountUsd: Number(d_.remainingAmountUsd || 0),
          baseCurrency: String(d_.baseCurrency || meta_.base_currency),
          graceMinutes: Number(d_.grace_period_minutes || d_.merchant_settings?.grace_period_minutes || 30),
        })
        setPhase('underpaid')
        // Keep polling — user might send the remainder to the same address
        return
      }
      if (s === 'expired') {
        setPhase('expired')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      if (s === 'failed') {
        setPhase('failed')
        if (pollRef.current) clearInterval(pollRef.current)
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      // waiting / pending → keep polling silently
    }

    // Kick off first poll immediately then every 10s
    poll()
    pollRef.current = setInterval(poll, 10000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [phase, cryptoInfo?.address, meta_?.token, cryptoInfo, meta_])

  // ─── Countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'awaiting_payment' && phase !== 'underpaid') return
    if (timeLeft <= 0) return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          if (pollRef.current) clearInterval(pollRef.current)
          setPhase('expired')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, timeLeft > 0])

  const doCopy = (val: string, flag: string) => {
    copyToClipboard(val)
    setCopiedFlag(flag)
    setTimeout(() => setCopiedFlag(''), 1600)
  }

  const timerLabel = useMemo(() => {
    if (timeLeft <= 0) return '—'
    const m = Math.floor(timeLeft / 60)
    const s = timeLeft % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }, [timeLeft])

  const sym = meta_ ? getCurrencySymbolFromFormat(meta_.base_currency) : '$'
  const donorName = meta_?.contribution?.donor_name || ''
  const donorMessage = meta_?.contribution?.donor_message || ''
  const isAnon = !!meta_?.contribution?.is_anonymous

  // ─── Render helpers ──────────────────────────────────────────────────

  const backLink = (label = 'Cancel') => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
      <Box
        component="button"
        onClick={onCancel}
        sx={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: theme.palette.text.secondary,
          fontSize: 12.5,
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        ← {label}
      </Box>
      <Box
        component="a"
        href={`/pay?d=${encodeURIComponent(d)}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="inline-tip-fallback-fullpage"
        sx={{
          color: theme.palette.text.secondary,
          fontSize: 12,
          textDecoration: 'underline',
        }}
      >
        {t("creator.inline.preferFullPage")}
      </Box>
    </Box>
  )

  // ─── LOADING META ────────────────────────────────────────────────────
  if (phase === 'loading_meta') {
    return (
      <Box data-testid="inline-tip-loading" sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={26} />
        <Typography fontSize={13} color={theme.palette.text.secondary}>
          {modeCopy.preparing}
        </Typography>
      </Box>
    )
  }

  // ─── ERROR ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <Box
        data-testid="inline-tip-error"
        sx={{ p: 2.5, borderRadius: '14px', border: `1px solid ${border}`, backgroundColor: errTint }}
      >
        <Typography fontWeight={700} color={theme.palette.error.main} fontSize={14}>
          {t("creator.inline.somethingWrong")}
        </Typography>
        <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.5}>
          {errorMsg || 'Please try again.'}
        </Typography>
        <Button
          fullWidth
          variant="outlined"
          onClick={onNewTip}
          data-testid="inline-tip-retry-btn"
          sx={{ mt: 2, textTransform: 'none', borderRadius: '10px', fontWeight: 700 }}
        >
          Try again
        </Button>
      </Box>
    )
  }

  // ─── CURRENCY SELECT ─────────────────────────────────────────────────
  if (phase === 'currency_select' && meta_) {
    const currencies = meta_.available_currencies.filter((c) => CRYPTO_INFO[c])
    return (
      <Box>
        <Typography fontWeight={800} fontSize={16} color={theme.palette.text.primary}>
          {t('creator.inline.pickCrypto', { amount: `${sym}${formatWithSeparators(meta_.amount, meta_.base_currency)}`, defaultValue: `Pick a crypto to pay ${sym}${formatWithSeparators(meta_.amount, meta_.base_currency)}` })}
        </Typography>
        <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.5}>
          {creatorName
            ? t('creator.inline.accepts', { name: creatorName, defaultValue: `${creatorName} accepts:` })
            : (mode === 'link'
                ? t('creator.inline.merchantAccepts', { defaultValue: 'This merchant accepts:' })
                : t('creator.inline.creatorAccepts', { defaultValue: 'This creator accepts:' }))}
        </Typography>
        <Box
          data-testid="inline-tip-currency-picker"
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 1, mt: 1.75 }}
        >
          {currencies.map((code) => {
            const info = CRYPTO_INFO[code]
            return (
              <Box
                key={code}
                role="button"
                tabIndex={0}
                data-testid={`inline-tip-currency-${code}`}
                onClick={() => pickCurrency(code)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pickCurrency(code)
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.9,
                  px: 1.25,
                  py: 1.1,
                  borderRadius: '12px',
                  border: `1.5px solid ${border}`,
                  backgroundColor: surface,
                  color: theme.palette.text.primary,
                  cursor: 'pointer',
                  transition: 'border-color 140ms ease, transform 140ms ease',
                  '&:hover': { borderColor: LIME, transform: 'translateY(-1px)' },
                }}
              >
                <Icon icon={info.icon} width={22} color={info.iconColor} />
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <Typography fontSize={13.5} fontWeight={800} lineHeight={1.15} noWrap>
                    {info.label}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
        {collectReceiptEmail && (
          <Box sx={{ mt: 2 }}>
            <ReceiptEmailField
              value={receiptEmail}
              onChange={(v) => { setReceiptEmail(v); setEmailSaved(false) }}
              onSave={saveReceiptEmail}
              saved={emailSaved}
              invalid={emailInvalid}
              label={t('checkout.receiptEmail.label', { defaultValue: 'Email me a receipt (optional)' })}
              helper={t('checkout.receiptEmail.helper', { defaultValue: "We'll email your receipt the moment this payment confirms." })}
              savedLabel={t('checkout.receiptEmail.saved', { defaultValue: 'Receipt will be sent to this email.' })}
              invalidLabel={t('checkout.receiptEmail.invalid', { defaultValue: 'Enter a valid email address.' })}
              muted={theme.palette.text.secondary}
              border={border}
            />
          </Box>
        )}
        {backLink(t('creator.inline.back', { defaultValue: 'Back' }))}
      </Box>
    )
  }

  // ─── CREATING PAYMENT ────────────────────────────────────────────────
  if (phase === 'creating_payment') {
    return (
      <Box sx={{ py: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={26} />
        <Typography fontSize={13} color={theme.palette.text.secondary}>
          {t('creator.inline.generatingAddress', { coin: selectedCurrency, defaultValue: `Generating your ${selectedCurrency} address…` })}
        </Typography>
      </Box>
    )
  }

  // ─── AWAITING PAYMENT ────────────────────────────────────────────────
  if (phase === 'awaiting_payment' && cryptoInfo && meta_) {
    const info = CRYPTO_INFO[cryptoInfo.crypto_display]
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Icon icon={info?.icon || 'mdi:coin'} width={22} color={info?.iconColor} />
            <Typography fontWeight={800} fontSize={15}>
              {t('creator.inline.sendAmount', { amount: formatCryptoAmount(cryptoInfo.expected_amount, cryptoInfo.crypto_base), coin: cryptoInfo.crypto_base, defaultValue: `Send ${formatCryptoAmount(cryptoInfo.expected_amount, cryptoInfo.crypto_base)} ${cryptoInfo.crypto_base}` })}
            </Typography>
          </Box>
          <Typography
            data-testid="inline-tip-timer"
            sx={{ fontFamily: MONO, fontSize: 13, color: theme.palette.text.secondary, fontWeight: 700 }}
          >
            {timerLabel}
          </Typography>
        </Box>
        <Typography fontSize={12} color={theme.palette.text.secondary} mb={1.5}>
          ≈ {sym}{formatWithSeparators(meta_.amount, meta_.base_currency)} — {info?.label || cryptoInfo.crypto_display}
        </Typography>

        {/* Address row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            p: 1.25,
            borderRadius: '10px',
            border: `1px solid ${border}`,
            backgroundColor: surface,
          }}
        >
          <Typography
            data-testid="inline-tip-address"
            sx={{ fontFamily: MONO, fontSize: 12.5, flex: 1, minWidth: 0, wordBreak: 'break-all' }}
          >
            {cryptoInfo.address}
          </Typography>
          <Box
            component="button"
            onClick={() => doCopy(cryptoInfo.address, 'addr')}
            data-testid="inline-tip-copy"
            sx={{
              background: 'none',
              border: `1px solid ${border}`,
              borderRadius: '8px',
              px: 1,
              py: 0.5,
              cursor: 'pointer',
              color: theme.palette.text.primary,
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
            }}
          >
            <Icon icon={copiedFlag === 'addr' ? 'mdi:check' : 'mdi:content-copy'} width={13} />
            {copiedFlag === 'addr' ? t('creator.inline.copied', { defaultValue: 'Copied' }) : t('creator.inline.copy', { defaultValue: 'Copy' })}
          </Box>
        </Box>

        {cryptoInfo.memo && (
          <Box sx={{ mt: 1, p: 1, borderRadius: '8px', backgroundColor: warnTint }}>
            <Typography fontSize={11.5} color={theme.palette.text.primary}>
              <strong>{t("creator.inline.includeMemo")}</strong>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>{cryptoInfo.memo}</Typography>
              <Box
                component="button"
                onClick={() => doCopy(cryptoInfo.memo, 'memo')}
                sx={{ background: 'none', border: 'none', p: 0, cursor: 'pointer', color: theme.palette.text.secondary }}
              >
                <Icon icon={copiedFlag === 'memo' ? 'mdi:check' : 'mdi:content-copy'} width={14} />
              </Box>
            </Box>
          </Box>
        )}

        {/* QR toggle */}
        {cryptoInfo.qr_code && (
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              component="button"
              onClick={() => setQrExpanded((v) => !v)}
              data-testid="inline-tip-qr-toggle"
              sx={{
                background: 'none',
                border: `1px solid ${border}`,
                borderRadius: '8px',
                px: 1,
                py: 0.5,
                fontSize: 11.5,
                color: theme.palette.text.secondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.4,
              }}
            >
              <Icon icon="mdi:qrcode" width={14} />
              {qrExpanded ? t('creator.inline.hideQr', { defaultValue: 'Hide QR' }) : t('creator.inline.showQr', { defaultValue: 'Show QR code' })}
            </Box>
            {qrExpanded && (
              <Box sx={{ mt: 1.25, p: 1.25, borderRadius: '10px', backgroundColor: '#FFFFFF' }}>
                <Box
                  component="img"
                  src={cryptoInfo.qr_code}
                  alt={`${cryptoInfo.crypto_display} payment QR`}
                  sx={{ display: 'block', width: 168, height: 168 }}
                />
              </Box>
            )}
          </Box>
        )}

        <Box
          data-testid="inline-tip-status-pill"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            mt: 1.75,
            px: 1.25,
            py: 0.75,
            borderRadius: '999px',
            backgroundColor: limeTint,
            border: `1px solid ${LIME}`,
          }}
        >
          <CircularProgress size={12} sx={{ color: INK }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
            {t("creator.inline.waitingPayment")}
          </Typography>
        </Box>

        {/* Opt-in browser alert while waiting on confirmations */}
        <NotifyMeInline
          supported={notif.supported}
          permission={notif.permission}
          onEnable={() => { void notif.requestPermission() }}
          ctaLabel={t('checkout.notify.cta', { defaultValue: 'Notify me when it confirms' })}
          enabledLabel={t('checkout.notify.enabled', { defaultValue: "You'll get a browser alert when it confirms." })}
          muted={theme.palette.text.secondary}
          border={border}
          accent={LIME}
        />

        {/* Optional refund address (#3) — where to refund if the buyer sends
            the wrong asset/network. Collapsed by default to keep the flow clean. */}
        <Box sx={{ mt: 1.5 }} data-testid="inline-refund-block">
          <Button
            variant="text"
            size="small"
            onClick={() => setShowRefundInput((v) => !v)}
            data-testid="inline-refund-toggle"
            sx={{ textTransform: 'none', fontSize: 12.5, color: theme.palette.text.secondary, fontWeight: 600 }}
          >
            <Icon icon={showRefundInput ? 'mdi:chevron-up' : 'mdi:chevron-down'} width={16} style={{ marginRight: 4 }} />
            {t('checkout.refund.toggle', { defaultValue: 'Add a refund address (optional)' })}
          </Button>
          <Collapse in={showRefundInput}>
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, mb: 0.75, lineHeight: 1.5 }}>
                {t('checkout.refund.help', { defaultValue: 'If your payment can’t be completed, we’ll refund to this address (minus network fees). Use an address on the same network you’re paying with.' })}
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={refundAddress}
                onChange={(e) => { setRefundAddress(e.target.value); setRefundSaved(false); }}
                onBlur={() => saveRefundAddress(refundAddress)}
                placeholder={t('checkout.refund.placeholder', { defaultValue: 'Your wallet address for refunds' })}
                inputProps={{ 'data-testid': 'inline-refund-input', spellCheck: false, style: { fontFamily: MONO, fontSize: 12.5 } }}
              />
              {refundSaved && (
                <Typography sx={{ fontSize: 11.5, color: LIME, mt: 0.5, fontWeight: 700 }} data-testid="inline-refund-saved">
                  <Icon icon="mdi:check-circle" width={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  {t('checkout.refund.saved', { defaultValue: 'Refund address saved' })}
                </Typography>
              )}
            </Box>
          </Collapse>
        </Box>

        {backLink(t('creator.inline.changeAmount', { defaultValue: 'Change amount' }))}
      </Box>
    )
  }

  // ─── UNDERPAID ───────────────────────────────────────────────────────
  if (phase === 'underpaid' && cryptoInfo && partial && meta_) {
    const info = CRYPTO_INFO[cryptoInfo.crypto_display]
    return (
      <Box
        data-testid="inline-tip-underpaid"
        sx={{ p: 2, borderRadius: '14px', border: `1px solid #FF9900`, backgroundColor: warnTint }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
          <Icon icon="mdi:alert-circle-outline" width={20} color="#FF9900" />
          <Typography fontWeight={800} fontSize={15.5}>
            {t("creator.inline.partialReceived")}
          </Typography>
        </Box>
        <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.5}>
          We got {formatCryptoAmount(partial.paidAmount, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}. Send{' '}
          <strong data-testid="inline-tip-underpaid-remaining">
            {formatCryptoAmount(partial.remainingAmount, cryptoInfo.crypto_base)} {cryptoInfo.crypto_base}
          </strong>{' '}
          more to the same address to complete your {mode === 'link' ? 'payment' : mode === 'donation' ? 'donation' : 'tip'}.
        </Typography>

        {/* Address row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            p: 1.1,
            borderRadius: '10px',
            border: `1px solid ${border}`,
            backgroundColor: theme.palette.background.paper,
            mt: 1.25,
          }}
        >
          <Typography sx={{ fontFamily: MONO, fontSize: 12, flex: 1, minWidth: 0, wordBreak: 'break-all' }} data-testid="inline-tip-underpaid-address">
            {cryptoInfo.address}
          </Typography>
          <Box
            component="button"
            onClick={() => doCopy(cryptoInfo.address, 'addr2')}
            data-testid="inline-tip-underpaid-copy"
            sx={{
              background: 'none',
              border: `1px solid ${border}`,
              borderRadius: '8px',
              px: 0.9,
              py: 0.4,
              cursor: 'pointer',
              color: theme.palette.text.primary,
              fontSize: 11.5,
              fontWeight: 700,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.35,
            }}
          >
            <Icon icon={copiedFlag === 'addr2' ? 'mdi:check' : 'mdi:content-copy'} width={12} />
            {copiedFlag === 'addr2' ? t('creator.inline.copied', { defaultValue: 'Copied' }) : t('creator.inline.copy', { defaultValue: 'Copy' })}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
          <Typography fontSize={11.5} color={theme.palette.text.secondary}>
            <Icon icon="mdi:timer-outline" width={12} style={{ verticalAlign: 'middle' }} /> {partial.graceMinutes || 30}-min grace period
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: theme.palette.text.secondary }}>
            {timerLabel}
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 1.25,
            px: 1,
            py: 0.5,
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            backgroundColor: limeTint,
            border: `1px solid ${LIME}`,
          }}
        >
          <CircularProgress size={10} sx={{ color: INK }} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{t("creator.inline.monitoringRemainder")}</Typography>
        </Box>

        {backLink(t('creator.inline.changeAmount', { defaultValue: 'Change amount' }))}
      </Box>
    )
  }

  // ─── CONFIRMED (also handles overpaid → per Q2b treat as success) ────
  if (phase === 'confirmed' && confirmedAmount && meta_) {
    const shareUrl = siteUrl
    const shareText = modeCopy.shareText(effectiveTarget, meta.successVerb, shareUrl)
    const showDonorMsg = !isAnon && donorMessage && donorMessage.trim().length > 0
    return (
      <Box data-testid="inline-tip-success">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: LIME,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1.25,
            }}
          >
            <Icon icon="mdi:check-bold" width={30} color={INK} />
          </Box>
          <Typography fontWeight={800} fontSize={19} color={theme.palette.text.primary}>
            {modeCopy.successTitle(donorName, isAnon)}
          </Typography>
          <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.5}>
            {mode === 'tip'
              ? `You ${meta.successVerb} ${effectiveTarget} — ${sym}${formatWithSeparators(confirmedAmount.fiat || meta_.amount, confirmedAmount.fiatCurrency || meta_.base_currency)}.`
              : `${modeCopy.successSubject(effectiveTarget, meta.successVerb)} — ${sym}${formatWithSeparators(confirmedAmount.fiat || meta_.amount, confirmedAmount.fiatCurrency || meta_.base_currency)}.`}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 12, color: theme.palette.text.secondary, mt: 0.5 }}>
            {formatCryptoAmount(confirmedAmount.crypto, cryptoInfo?.crypto_base || 'BTC')}{' '}
            {cryptoInfo?.crypto_base || confirmedAmount.cryptoLabel}
          </Typography>
          {/* Public-surfaces clarity pass: one plain-English line on what
              happens next — supporters know the moment is truly done. */}
          <Typography
            data-testid="inline-tip-success-next"
            fontSize={12.5}
            color={theme.palette.text.secondary}
            mt={1}
            sx={{ maxWidth: 340 }}
          >
            {t('creator.inline.successNext', {
              defaultValue:
                'Your payment is confirmed on the network — nothing else to do. {{name}} sees your support right away.',
              name: effectiveTarget,
            })}
          </Typography>
        </Box>

        {showDonorMsg && (
          <Box
            data-testid="inline-tip-success-message"
            sx={{
              mt: 1.75,
              p: 1.25,
              borderRadius: '10px',
              border: `1px solid ${border}`,
              backgroundColor: surface,
              fontStyle: 'italic',
            }}
          >
            <Typography fontSize={13} color={theme.palette.text.primary}>
              “{donorMessage}”
            </Typography>
            {!isAnon && donorName && (
              <Typography fontSize={11.5} color={theme.palette.text.secondary} mt={0.25}>
                — {donorName}
              </Typography>
            )}
          </Box>
        )}

        {meta_?.contribution?.show_supporters && (meta_?.contribution?.supporters_count || meta_?.contribution?.raised_amount) ? (
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 12,
              color: theme.palette.text.secondary,
              mt: 1.25,
              textAlign: 'center',
            }}
          >
            {meta_.contribution?.supporters_count || 0} supporters · {sym}
            {formatWithSeparators(Number(meta_.contribution?.raised_amount || 0), meta_.contribution?.campaign_currency || meta_.base_currency)} raised
          </Typography>
        ) : null}

        {/* Share row */}
        <Box sx={{ mt: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Box
            component="a"
            data-testid="inline-tip-success-share-x"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.1,
              py: 0.55,
              borderRadius: '999px',
              border: `1px solid ${border}`,
              color: theme.palette.text.primary,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <Icon icon="mdi:twitter" width={14} /> Share
          </Box>
          <Box
            component="a"
            data-testid="inline-tip-success-share-whatsapp"
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.1,
              py: 0.55,
              borderRadius: '999px',
              border: `1px solid ${border}`,
              color: theme.palette.text.primary,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <Icon icon="mdi:whatsapp" width={14} /> WhatsApp
          </Box>
          <Box
            component="button"
            data-testid="inline-tip-success-share-copy"
            onClick={() => doCopy(shareUrl, 'share')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.1,
              py: 0.55,
              borderRadius: '999px',
              border: `1px solid ${border}`,
              background: 'none',
              color: theme.palette.text.primary,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon icon={copiedFlag === 'share' ? 'mdi:check' : 'mdi:link-variant'} width={14} />
            {copiedFlag === 'share' ? 'Copied!' : 'Copy link'}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            data-testid="inline-tip-success-back-btn"
            onClick={onCancel}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 700, fontSize: 13.5 }}
          >
            {modeCopy.backLabel(mode === 'tip' ? `@${handle}` : (creatorName || `@${handle}`))}
          </Button>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            data-testid="inline-tip-success-new-tip-btn"
            onClick={onNewTip}
            sx={{
              backgroundColor: LIME,
              color: INK,
              textTransform: 'none',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: 13.5,
              '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
            }}
          >
            {modeCopy.againLabel}
          </Button>
        </Box>
      </Box>
    )
  }

  // ─── EXPIRED / FAILED ────────────────────────────────────────────────
  if (phase === 'expired' || phase === 'failed') {
    const isExpired = phase === 'expired'
    return (
      <Box
        data-testid="inline-tip-expired"
        sx={{ p: 2.5, borderRadius: '14px', border: `1px solid ${border}`, backgroundColor: errTint }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Icon icon={isExpired ? 'mdi:timer-off-outline' : 'mdi:alert-circle-outline'} width={20} color="#EF4444" />
          <Typography fontWeight={800} fontSize={15}>
            {isExpired ? 'Payment window expired' : 'Payment failed'}
          </Typography>
        </Box>
        <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.5}>
          {isExpired
            ? "No payment was received in time. Nothing was charged — you can try again."
            : "We couldn't process your payment. Please try again."}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onCancel}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={onNewTip}
            data-testid="inline-tip-retry-btn"
            sx={{
              backgroundColor: LIME,
              color: INK,
              textTransform: 'none',
              borderRadius: '10px',
              fontWeight: 800,
              '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
            }}
          >
            Try again
          </Button>
        </Box>
      </Box>
    )
  }

  return null
}

export default InlineTipCheckout
