import { BRAND_ACCENT } from "@/constants/theme";
import { toFixedStr } from "@/utils/money";
import {
  Box,
  Button,
  MenuItem,
  Select,
  Snackbar,
  Typography,
  useTheme,
} from '@mui/material'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Icon } from '@iconify/react'
import { QRCodeSVG } from 'qrcode.react'
import Logo from '@/assets/Icons/Logo'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import CheckoutStatusStrip from '@/Components/UI/CheckoutStatusStrip'
import { ReceiptEmailField, NotifyMeInline } from '@/Components/Page/Pay3Components/checkoutExtras'
import usePaymentNotification from '@/hooks/usePaymentNotification'

/**
 * PaymentDemo — the sandbox checkout used in TWO places:
 *   1. Standalone at /pay/demo (full site chrome)
 *   2. Embedded on the landing page's TryItNow section via /pay/demo?embed=1
 *
 * 2026-08 REBUILD: this now MIRRORS the real production checkout (CleanCheckoutV2
 * on /pay?d=…) so the landing page shows what customers actually see — the same
 * WAITING status strip, DYNOPAY brand row, "Pay {merchant}" headline, amount,
 * REFERENCE row, NETWORK/CURRENCY selects, "Email me a receipt" field, "Pay X on
 * Y" instruction, a REAL QR code, and the opt-in browser-alert control. It reuses
 * the exact same components (CheckoutStatusStrip / ReceiptEmailField /
 * NotifyMeInline / usePaymentNotification / QRCodeSVG) as the live checkout.
 *
 * Everything is client-side mock state — nothing talks to a real backend and no
 * real payment is created. "Simulate payment received" walks Waiting → Confirming
 * → Confirmed and fires the SAME real browser notification the live checkout uses,
 * so the demo doubles as a working demonstration of the confirm alert.
 */

// Design tokens — kept identical to CleanCheckoutV2 so the demo matches 1:1.
const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
const LIME = BRAND_ACCENT

type Cur = { symbol: string; amount: number; address: string; scheme: string }
type Net = { label: string; icon: string; iconColor: string; currencies: Record<string, Cur> }

// Mock merchant + order (mirrors the "Pay The Dev Store · $20 USD" example).
const MERCHANT = 'The Dev Store'
const ORDER_REFERENCE = 'INV-2026-273'
const ORDER_DESCRIPTION = 'final'
const FIAT_AMOUNT = 20
const FIAT_CURRENCY = 'USD'
const FIAT_SYMBOL = '$'

// Mock networks/currencies with format-correct (but demo-only) addresses.
const NETWORKS: Record<string, Net> = {
  Litecoin: {
    label: 'Litecoin', icon: 'cryptocurrency:ltc', iconColor: '#345D9D',
    currencies: {
      LTC: { symbol: 'LTC', amount: 0.40707496, address: 'LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm', scheme: 'litecoin' },
    },
  },
  Bitcoin: {
    label: 'Bitcoin', icon: 'cryptocurrency:btc', iconColor: '#F7931A',
    currencies: {
      BTC: { symbol: 'BTC', amount: 0.00025612, address: '1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7', scheme: 'bitcoin' },
    },
  },
  Ethereum: {
    label: 'Ethereum', icon: 'cryptocurrency:eth', iconColor: '#627EEA',
    currencies: {
      ETH: { symbol: 'ETH', amount: 0.00642, address: '0x9a7221b5e32D5f99e8DA95585835442E29AfB38F', scheme: 'ethereum' },
      USDT: { symbol: 'USDT', amount: 20, address: '0x9a7221b5e32D5f99e8DA95585835442E29AfB38F', scheme: 'ethereum' },
      USDC: { symbol: 'USDC', amount: 20, address: '0x9a7221b5e32D5f99e8DA95585835442E29AfB38F', scheme: 'ethereum' },
    },
  },
  Tron: {
    label: 'Tron', icon: 'cryptocurrency:trx', iconColor: '#EF0027',
    currencies: {
      USDT: { symbol: 'USDT', amount: 20, address: 'TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR', scheme: 'tron' },
    },
  },
}

type Phase = 'awaiting' | 'confirming' | 'confirmed'

const PaymentDemo = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const router = useRouter()
  const notif = usePaymentNotification()

  // Theme tokens — mirror CleanCheckoutV2.
  const border = isDark ? 'rgba(255,255,255,0.10)' : '#E4E4E7'
  const surface = isDark ? 'rgba(255,255,255,0.03)' : '#F6F6F7'
  const muted = isDark ? '#A1A1AA' : '#71717A'

  const [phase, setPhase] = useState<Phase>('awaiting')
  const [selectedNetwork, setSelectedNetwork] = useState<string>('Litecoin')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('LTC')
  const [receiptEmail, setReceiptEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [snack, setSnack] = useState<string | null>(null)
  const notifiedRef = useRef(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isEmbed = useMemo(() => {
    const q = router?.query?.embed
    return q === '1' || q === 'true'
  }, [router?.query?.embed])

  const net = NETWORKS[selectedNetwork]
  const coin = net.currencies[selectedCurrency] || Object.values(net.currencies)[0]
  const currenciesInNetwork = Object.keys(net.currencies)

  const paymentUri = useMemo(
    () => `${coin.scheme}:${coin.address}?amount=${coin.amount}`,
    [coin]
  )

  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  const emailInvalid = receiptEmail.trim().length > 0 && !emailValid(receiptEmail)

  // Fire the REAL browser notification once we hit "confirmed" — same call the
  // live checkout makes, so this demo genuinely proves the confirm alert works.
  useEffect(() => {
    if (phase !== 'confirmed' || notifiedRef.current) return
    notifiedRef.current = true
    notif.notify('Payment confirmed \u2713', `Your payment to ${MERCHANT} is confirmed.`)
  }, [phase, notif])

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current) }, [])

  const onNetworkChange = useCallback((value: string) => {
    setSelectedNetwork(value)
    setSelectedCurrency(Object.keys(NETWORKS[value].currencies)[0])
    setPhase('awaiting')
    notifiedRef.current = false
  }, [])

  const copyAddress = useCallback(async () => {
    try { await navigator.clipboard?.writeText(coin.address) } catch { /* ignore */ }
    setCopied(true)
    setSnack('Address copied')
    setTimeout(() => setCopied(false), 2000)
  }, [coin.address])

  const simulatePayment = useCallback(() => {
    setPhase('confirming')
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setPhase('confirmed'), 2600)
  }, [])

  const resetDemo = useCallback(() => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    notifiedRef.current = false
    setPhase('awaiting')
    setReceiptEmail('')
    setEmailSaved(false)
  }, [])

  const stripState = phase === 'confirming' ? 'confirming' : 'pending'

  return (
    <Pay3Layout embed={isEmbed}>
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
          data-testid="demo-checkout-panel"
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
          {/* ═══ CONFIRMED (success) ═══════════════════════════════════ */}
          {phase === 'confirmed' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 2 }} data-testid="demo-confirmed">
              <Box
                sx={{
                  width: 64, height: 64, borderRadius: '50%', mb: 2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: LIME,
                }}
              >
                <Icon icon="mdi:check-bold" width={32} color="#fff" />
              </Box>
              <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: theme.palette.text.primary }}>
                Payment successful
              </Typography>
              <Typography sx={{ fontSize: 14, color: muted, mt: 0.75 }}>
                Paid to {MERCHANT} — {FIAT_SYMBOL}{toFixedStr(FIAT_AMOUNT, 2)} {FIAT_CURRENCY}
              </Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: 12, color: muted, mt: 1 }}>
                {coin.amount} {coin.symbol} · REFERENCE · {ORDER_REFERENCE}
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={resetDemo}
                data-testid="demo-reset-btn"
                startIcon={<Icon icon="mdi:restart" width={16} />}
                sx={{
                  mt: 3, textTransform: 'none', borderRadius: '999px', fontWeight: 600,
                  minHeight: 44, color: muted, borderColor: border,
                  '&:hover': { borderColor: LIME, color: LIME },
                }}
              >
                Run the demo again
              </Button>
            </Box>
          ) : (
            <>
              {/* Status strip — the exact WAITING / CONFIRMING pill from the live checkout */}
              <CheckoutStatusStrip state={stripState} data-testid="demo-status-strip" />

              {/* Brand row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <Logo width={22} height={26} />
                <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: muted }}>
                  DYNOPAY
                </Typography>
              </Box>

              {/* H1 — merchant name */}
              <Typography
                component="h1"
                data-testid="demo-checkout-h1"
                sx={{ fontSize: { xs: 26, sm: 32 }, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.15, color: theme.palette.text.primary }}
              >
                Pay {MERCHANT}
              </Typography>

              {/* Amount */}
              <Typography sx={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: muted, mt: 0.75, mb: 3.5 }} data-testid="demo-amount">
                {FIAT_SYMBOL}{toFixedStr(FIAT_AMOUNT, 2)} {FIAT_CURRENCY}
              </Typography>

              {/* Reference row */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 1.5, borderRadius: '10px', border: `1px solid ${border}`, backgroundColor: surface, mb: 2.5 }}>
                <Typography fontSize={13} color={theme.palette.text.primary}>{ORDER_DESCRIPTION}</Typography>
                <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: muted }}>
                  REFERENCE · {ORDER_REFERENCE}
                </Typography>
              </Box>

              {/* Network + Currency selects */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mb: 2.5 }}>
                <Box>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, mb: 0.5, letterSpacing: '0.02em' }}>NETWORK</Typography>
                  <Select
                    fullWidth
                    size="small"
                    data-testid="demo-network-select"
                    value={selectedNetwork}
                    onChange={(e) => onNetworkChange(String(e.target.value))}
                    sx={{
                      borderRadius: '8px', minHeight: 46,
                      '& .MuiSelect-select': { paddingTop: '11px', paddingBottom: '11px' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: border },
                    }}
                  >
                    {Object.keys(NETWORKS).map((n) => (
                      <MenuItem key={n} value={n}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Icon icon={NETWORKS[n].icon} width={18} color={NETWORKS[n].iconColor} />
                          <span>{NETWORKS[n].label}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, mb: 0.5, letterSpacing: '0.02em' }}>CURRENCY</Typography>
                  <Select
                    fullWidth
                    size="small"
                    data-testid="demo-currency-select"
                    value={selectedCurrency}
                    onChange={(e) => { setSelectedCurrency(String(e.target.value)); setPhase('awaiting') }}
                    sx={{
                      borderRadius: '8px', minHeight: 46,
                      '& .MuiSelect-select': { paddingTop: '11px', paddingBottom: '11px' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: border },
                    }}
                  >
                    {currenciesInNetwork.map((code) => (
                      <MenuItem key={code} value={code}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Icon icon={net.icon} width={18} color={net.iconColor} />
                          <span>{code}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>

              {/* Optional receipt email */}
              <ReceiptEmailField
                value={receiptEmail}
                onChange={(v) => { setReceiptEmail(v); setEmailSaved(false) }}
                onSave={() => { if (receiptEmail && emailValid(receiptEmail)) setEmailSaved(true) }}
                saved={emailSaved}
                invalid={emailInvalid}
                label="Email me a receipt (optional)"
                helper="We'll email your receipt the moment this payment confirms."
                savedLabel="Receipt will be sent to this email."
                invalidLabel="Enter a valid email address."
                muted={muted}
                border={border}
              />

              {/* Instruction sentence */}
              <Typography data-testid="demo-instruction" sx={{ fontSize: 14, color: theme.palette.text.primary, textAlign: 'center', mb: 2 }}>
                Pay <strong>{coin.amount} {coin.symbol}</strong> on {net.label}
              </Typography>

              {/* Opt-in browser alert */}
              <NotifyMeInline
                supported={notif.supported}
                permission={notif.permission}
                onEnable={() => { void notif.requestPermission() }}
                ctaLabel="Notify me when it confirms"
                enabledLabel="You'll get a browser alert when it confirms."
                muted={muted}
                border={border}
                accent={LIME}
              />

              {/* QR code — a real QR encoding the (mock) payment URI */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2, mb: 2 }}>
                <Box
                  component="button"
                  type="button"
                  onClick={copyAddress}
                  aria-label="Tap to copy payment address"
                  data-testid="demo-qr-panel"
                  sx={{
                    p: 2, borderRadius: '16px', border: `1px solid ${border}`, backgroundColor: '#FFFFFF',
                    boxShadow: '0 4px 22px rgba(0,0,0,0.08)', width: '100%', maxWidth: 264, mx: 'auto', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}
                >
                  <QRCodeSVG
                    value={paymentUri}
                    size={220}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    style={{ width: '100%', maxWidth: 220, height: 'auto', display: 'block' }}
                  />
                </Box>
                <Typography sx={{ mt: 1, fontSize: 12, fontWeight: 600, color: copied ? LIME : muted, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                  <Icon icon={copied ? 'mdi:check-circle' : 'mdi:content-copy'} width={13} />
                  {copied ? 'Address copied' : 'Tap the QR to copy the address'}
                </Typography>
              </Box>

              {/* Sandbox action — advances the mock flow to confirmed */}
              <Button
                fullWidth
                variant="contained"
                onClick={simulatePayment}
                disabled={phase === 'confirming'}
                data-testid="demo-simulate-btn"
                sx={{
                  mt: 1, textTransform: 'none', borderRadius: '999px', fontWeight: 700, minHeight: 46,
                  backgroundColor: LIME, color: '#fff', boxShadow: '0 4px 14px rgba(79,70,229,0.28)',
                  '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
                }}
              >
                {phase === 'confirming' ? 'Confirming…' : 'Simulate payment received'}
              </Button>
              <Typography sx={{ mt: 1, fontSize: 11, color: muted, textAlign: 'center' }}>
                Sandbox demo · no real payment is created
              </Typography>
            </>
          )}
        </Box>
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2000}
        onClose={() => setSnack(null)}
        message={snack || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Pay3Layout>
  )
}

export default PaymentDemo
