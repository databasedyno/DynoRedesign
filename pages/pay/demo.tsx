import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
  Snackbar,
  CircularProgress,
  Chip,
} from '@mui/material'
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/router'
import { Icon } from '@iconify/react'
import BitCoinGreenIcon from '@/assets/Icons/BitCoinGreenIcon'
import Logo from '@/assets/Icons/Logo'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import CopyIcon from '@/assets/Icons/CopyIcon'
import { useTranslation } from 'react-i18next'
import ProgressBar from '@/Components/UI/ProgressBar'

/**
 * PaymentDemo — the sandbox-mode checkout used in TWO places:
 *   1. Standalone at /pay/demo (full site chrome)
 *   2. Embedded on the landing page's TryItNow section via /pay/demo?embed=1
 *
 * 2026-07-05: made the whole thing actually INTERACTIVE. The primary
 * "Cryptocurrency" button previously had no onClick — the button was purely
 * cosmetic and clicking it did nothing, which contradicted the "INTERACTIVE"
 * badge on the parent iframe. Now clicking walks the user through the full
 * 3-step flow: Order → Payment → Done, with mock coin selection, a fake
 * wallet address + QR, and an auto-confirmation timer.
 *
 * Nothing here talks to any real backend — everything is client-side mock
 * state. The whole flow resets when the user clicks "Try again" on Done, or
 * when they reload the iframe.
 */

// ─── Static mock data (unchanged) ──────────────────────────────────────────
const MOCK_DATA = {
  description: 'Monthly Pro Subscription',
  orderReference: 'INV-2026-A1B2C3',
  customerName: 'John Doe',
  merchantInfo: { name: 'Acme Store', company_logo: null as string | null },
  feeInfo: { processing_fee: 2.5, fee_payer: 'merchant' as const },
  taxInfo: { rate: 23, amount: 23.0, country: 'Portugal', type: 'VAT' },
  expiryInfo: { expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
  walletState: { amount: 100.0, currency: 'EUR' },
  totalAmount: 125.5,
}

// Mock coins the "customer" can pick to pay with. Rates are hardcoded — this
// is a demo, not a live price feed.
type Coin = {
  id: string
  label: string
  short: string
  iconIcon: string           // iconify icon name
  address: string            // fake but format-correct wallet address
  amountCrypto: number       // total in this coin (mocked from €125.50)
  color: string
}

const COINS: Coin[] = [
  { id: 'USDT_TRC20', label: 'USDT (Tron)',       short: 'USDT',  iconIcon: 'cryptocurrency:usdt', color: '#26A17B', amountCrypto: 125.50, address: 'TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR' },
  { id: 'USDC_ERC20', label: 'USDC (Ethereum)',   short: 'USDC',  iconIcon: 'cryptocurrency:usdc', color: '#2775CA', amountCrypto: 125.50, address: '0x9a7221b5e32D5f99e8DA95585835442E29AfB38F' },
  { id: 'BTC',        label: 'Bitcoin',           short: 'BTC',   iconIcon: 'cryptocurrency:btc',  color: '#F7931A', amountCrypto: 0.00189, address: '1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7' },
  { id: 'ETH',        label: 'Ethereum',          short: 'ETH',   iconIcon: 'cryptocurrency:eth',  color: '#627EEA', amountCrypto: 0.0512,  address: '0x9a7221b5e32D5f99e8DA95585835442E29AfB38F' },
  { id: 'SOL',        label: 'Solana',            short: 'SOL',   iconIcon: 'cryptocurrency:sol',  color: '#14F195', amountCrypto: 0.7841,  address: 'Gjjphdxe26tayH3PBQcqXYt3R2gt7phEdCAFfxZB63U8' },
]

// After this many seconds on the Payment step the demo auto-advances to Done.
// If the user impatiently clicks "Simulate payment received" we advance right away.
const AUTO_CONFIRM_SECONDS = 8

type Step = 0 | 1 | 2  // 0 = Order, 1 = Payment, 2 = Done

const PaymentDemo = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')
  const router = useRouter()
  const [copySnackbar, setCopySnackbar] = useState<string | null>(null)
  const [countdown, setCountdown] = useState('')

  const [step, setStep] = useState<Step>(0)
  const [selectedCoinId, setSelectedCoinId] = useState<string>(COINS[0].id)
  const [confirmSeconds, setConfirmSeconds] = useState<number>(AUTO_CONFIRM_SECONDS)
  const confirmTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedCoin = useMemo(
    () => COINS.find((c) => c.id === selectedCoinId) || COINS[0],
    [selectedCoinId]
  )

  const isEmbed = useMemo(() => {
    const q = router?.query?.embed
    return q === '1' || q === 'true'
  }, [router?.query?.embed])

  // ─── Invoice-expiry countdown (Step 0 only, cosmetic) ───────────────────
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime()
      const expiry = new Date(MOCK_DATA.expiryInfo.expires_at).getTime()
      const diff = expiry - now
      if (diff <= 0) { setCountdown('Expired'); return }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24))
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((diff % (1000 * 60)) / 1000)
      const parts: string[] = []
      if (d > 0) parts.push(`${d}${t('checkout.days')}`)
      if (h > 0 || d > 0) parts.push(`${h}${t('checkout.hours')}`)
      if (m > 0 || h > 0 || d > 0) parts.push(`${m}${t('checkout.minutes')}`)
      parts.push(`${s}${t('checkout.seconds')}`)
      setCountdown(parts.join(' : '))
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [t])

  // ─── Copy helper (used by invoice # and wallet address) ─────────────────
  const copyToClipboard = useCallback(async (value: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch { /* silently — snackbar still shows */ }
    setCopySnackbar(label)
  }, [])

  // ─── Step transitions ───────────────────────────────────────────────────
  const goToPayment = useCallback(() => {
    setStep(1)
    setConfirmSeconds(AUTO_CONFIRM_SECONDS)
  }, [])

  const goToDone = useCallback(() => {
    if (confirmTimerRef.current) {
      clearInterval(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    setStep(2)
  }, [])

  const resetDemo = useCallback(() => {
    if (confirmTimerRef.current) {
      clearInterval(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    setStep(0)
    setConfirmSeconds(AUTO_CONFIRM_SECONDS)
    setSelectedCoinId(COINS[0].id)
  }, [])

  // Run the auto-confirm countdown whenever we enter step 1
  useEffect(() => {
    if (step !== 1) return
    if (confirmTimerRef.current) clearInterval(confirmTimerRef.current)
    confirmTimerRef.current = setInterval(() => {
      setConfirmSeconds((prev) => {
        if (prev <= 1) {
          if (confirmTimerRef.current) {
            clearInterval(confirmTimerRef.current)
            confirmTimerRef.current = null
          }
          setStep(2)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (confirmTimerRef.current) {
        clearInterval(confirmTimerRef.current)
        confirmTimerRef.current = null
      }
    }
  }, [step])

  // Truncate long addresses for display (keep first 8 + last 6, "…" in middle).
  const truncAddr = useCallback((s: string) => {
    if (!s || s.length <= 16) return s
    return `${s.slice(0, 8)}…${s.slice(-6)}`
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <Pay3Layout embed={isEmbed}>
      <Box>
        <ProgressBar activeStep={step} />

        <Box
          display='flex'
          alignItems='flex-start'
          justifyContent='center'
          px={{ xs: 1.5, sm: 2 }}
          py={{ xs: 1, sm: 1.5 }}
        >
          <Paper
            elevation={0}
            data-testid="checkout-card"
            sx={{
              borderRadius: '16px',
              overflow: 'hidden',
              width: '100%',
              maxWidth: 440,
              textAlign: 'center',
              border: `1px solid ${theme.palette.border.main}`,
              boxShadow: isDark
                ? '0 12px 40px rgba(0,0,0,0.35)'
                : '0 8px 32px rgba(10,10,10,0.06), 0 2px 8px rgba(0,0,0,0.04)',
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <Box
              sx={{
                height: '3px',
                background: 'linear-gradient(90deg, #CCFF00 0%, #7A8BFF 55%, #5865F2 100%)',
              }}
            />

            <Box px={{ xs: 2, sm: 2.5 }} py={{ xs: 2, sm: 2.5 }}>
              {/* Logo (all steps) */}
              <Box display='flex' justifyContent='center' mb={1}>
                {MOCK_DATA.merchantInfo.company_logo ? (
                  <Box
                    component="img"
                    src={MOCK_DATA.merchantInfo.company_logo}
                    alt={MOCK_DATA.merchantInfo.name}
                    sx={{ maxHeight: 36, maxWidth: 120, objectFit: 'contain' }}
                  />
                ) : (
                  <Logo width={32} height={38} />
                )}
              </Box>

              {/* ═══ STEP 0 — ORDER REVIEW ═══════════════════════════════ */}
              {step === 0 && (
                <>
                  <Typography
                    fontWeight={700}
                    fontSize={{ xs: 17, sm: 19 }}
                    lineHeight={1.2}
                    color={theme.palette.text.primary}
                    letterSpacing='-0.3px'
                    data-testid="checkout-title"
                  >
                    {t('checkout.title')}
                  </Typography>

                  <Typography
                    color={theme.palette.text.secondary}
                    fontWeight={400}
                    fontSize={12.5}
                    lineHeight={1.5}
                    mb={2}
                    mt={0.5}
                  >
                    Hi {MOCK_DATA.customerName}, complete your payment to{' '}
                    <Box component="span" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                      {MOCK_DATA.merchantInfo.name}
                    </Box>
                  </Typography>

                  {/* Order details block (unchanged) */}
                  <Box
                    sx={{
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: '12px',
                      p: 1.5,
                      mb: 1.5,
                      textAlign: 'left',
                      backgroundColor: theme.palette.action.hover,
                    }}
                  >
                    <Typography
                      fontWeight={700}
                      fontSize={9.5}
                      color={theme.palette.text.secondary}
                      letterSpacing={1}
                      textTransform='uppercase'
                      mb={0.5}
                    >
                      {t('checkout.orderDetails')}
                    </Typography>
                    <Typography fontWeight={600} fontSize={13} color={theme.palette.text.primary} mb={0.75}>
                      {MOCK_DATA.description}
                    </Typography>
                    <Box display='flex' alignItems='center' gap={0.5} mb={0.75}>
                      <Icon icon="mdi:account-outline" width={14} color={theme.palette.text.secondary} />
                      <Typography fontWeight={500} fontSize={12} color={theme.palette.text.primary}>
                        {MOCK_DATA.customerName}
                      </Typography>
                    </Box>
                    <Box display='flex' alignItems='center' justifyContent='space-between'>
                      <Box>
                        <Typography fontWeight={700} fontSize={9} color={theme.palette.text.secondary} letterSpacing={0.8} textTransform='uppercase'>
                          {t('checkout.invoice')}
                        </Typography>
                        <Typography fontWeight={500} fontSize={12} color={theme.palette.text.primary} sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {MOCK_DATA.orderReference}
                        </Typography>
                      </Box>
                      <Tooltip title={t('checkout.copyInvoice')} arrow>
                        <IconButton
                          size='small'
                          onClick={() => copyToClipboard(MOCK_DATA.orderReference, 'Invoice copied')}
                          sx={{
                            bgcolor: theme.palette.border.main,
                            p: 0.5,
                            borderRadius: '8px',
                            '&:hover': { bgcolor: theme.palette.action.selected },
                          }}
                        >
                          <CopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Fee breakdown (unchanged) */}
                  <Box
                    border={`1px solid ${theme.palette.border.main}`}
                    borderRadius='12px'
                    px={1.5}
                    py={1.5}
                  >
                    <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.75}>
                      <Typography fontSize={12.5} color={theme.palette.text.secondary} fontWeight={500}>
                        {t('checkout.subtotal')}
                      </Typography>
                      <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>
                        €{MOCK_DATA.walletState.amount.toFixed(2)}
                      </Typography>
                    </Box>
                    <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.75}>
                      <Typography fontSize={12.5} color={theme.palette.text.secondary} fontWeight={500}>
                        {t('checkout.vatRate', { rate: MOCK_DATA.taxInfo.rate, country: MOCK_DATA.taxInfo.country })}
                      </Typography>
                      <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>
                        €{MOCK_DATA.taxInfo.amount.toFixed(2)}
                      </Typography>
                    </Box>
                    <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.25}>
                      <Box display='flex' alignItems='center' gap={0.5}>
                        <Typography fontSize={12.5} color={theme.palette.text.secondary} fontWeight={500}>
                          {t('checkout.processingFee')}
                        </Typography>
                        <Icon icon="mdi:check-circle" color="#12B76A" width={14} />
                      </Box>
                      <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>
                        €{MOCK_DATA.feeInfo.processing_fee.toFixed(2)}
                      </Typography>
                    </Box>
                    <Typography fontSize={10.5} color="#12B76A" fontWeight={500} textAlign='left' mb={0.5}>
                      {t('checkout.processingFeesIncluded')}
                    </Typography>
                    <Divider sx={{ my: 1, borderColor: theme.palette.border.main }} />
                    <Box
                      display='flex'
                      justifyContent='space-between'
                      alignItems='center'
                      mb={1.5}
                      sx={{
                        backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(10,10,10,0.04)',
                        borderRadius: '8px',
                        mx: -0.75,
                        px: 0.75,
                        py: 0.75,
                      }}
                    >
                      <Typography fontWeight={700} fontSize={{ xs: 13, sm: 14 }} color={theme.palette.text.primary}>
                        {t('checkout.total')}
                      </Typography>
                      <Box display='flex' alignItems='center' gap={0.5}>
                        <Typography fontWeight={800} fontSize={{ xs: 16, sm: 18 }} color={theme.palette.text.primary}>
                          €{MOCK_DATA.totalAmount.toFixed(2)}
                        </Typography>
                        <Typography fontWeight={500} fontSize={11} color={theme.palette.text.secondary}>EUR</Typography>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 1.5, borderColor: theme.palette.border.main }} />

                    <Button
                      fullWidth
                      variant='contained'
                      onClick={goToPayment}
                      startIcon={<BitCoinGreenIcon width={7} />}
                      data-testid="crypto-payment-btn"
                      sx={{
                        background: 'linear-gradient(135deg, #12B76A 0%, #0E9F5C 100%)',
                        color: '#fff',
                        textTransform: 'none',
                        borderRadius: '12px',
                        fontWeight: 700,
                        py: 1.25,
                        fontSize: '14px',
                        minHeight: 46,
                        letterSpacing: '0.2px',
                        boxShadow: '0 4px 14px rgba(18, 183, 106, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #0E9F5C 0%, #0C8A50 100%)',
                          boxShadow: '0 6px 20px rgba(18, 183, 106, 0.4)',
                        },
                      }}
                    >
                      {t('checkout.cryptocurrency')}
                    </Button>
                  </Box>

                  <Box display='flex' alignItems='center' justifyContent='space-between' mt={1.5} px={0.25}>
                    <Box display='flex' alignItems='center' gap={0.5}>
                      <Icon icon="mdi:clock-outline" width={13} color={theme.palette.text.secondary} />
                      <Typography fontSize={10.5} color={theme.palette.text.secondary} fontWeight={500}>
                        {t('checkout.expiresIn')}{' '}
                        <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                          {countdown}
                        </Box>
                      </Typography>
                    </Box>
                    <Box display='flex' alignItems='center' gap={0.5}>
                      <Icon icon="mdi:shield-check" width={13} color={theme.palette.primary.main} />
                      <Typography fontSize={10.5} color={theme.palette.primary.main} fontWeight={700}>
                        {t('checkout.securePayment')}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}

              {/* ═══ STEP 1 — PAYMENT (coin picker + address + auto-confirm) ═══ */}
              {step === 1 && (
                <>
                  <Typography fontWeight={700} fontSize={{ xs: 16, sm: 18 }} color={theme.palette.text.primary} letterSpacing='-0.3px'>
                    {t('demoChooseHowToPay')}
                  </Typography>
                  <Typography color={theme.palette.text.secondary} fontSize={12.5} lineHeight={1.5} mb={2} mt={0.5}>
                    Total <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>€{MOCK_DATA.totalAmount.toFixed(2)} EUR</Box>{' '}— pick a network and send from your wallet.
                  </Typography>

                  {/* Coin chip picker */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mb: 2 }}>
                    {COINS.map((c) => {
                      const active = c.id === selectedCoinId
                      return (
                        <Chip
                          key={c.id}
                          onClick={() => setSelectedCoinId(c.id)}
                          icon={<Icon icon={c.iconIcon} width={16} />}
                          label={c.short}
                          data-testid={`demo-coin-${c.id}`}
                          sx={{
                            fontWeight: 600,
                            fontSize: 12,
                            borderRadius: '8px',
                            px: 0.5,
                            border: `1px solid ${active ? c.color : theme.palette.border.main}`,
                            bgcolor: active ? `${c.color}18` : 'transparent',
                            color: active ? c.color : theme.palette.text.primary,
                            '&:hover': { bgcolor: active ? `${c.color}22` : theme.palette.action.hover, borderColor: c.color },
                          }}
                        />
                      )
                    })}
                  </Box>

                  {/* Amount in selected coin */}
                  <Box
                    sx={{
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: '12px',
                      p: 1.5,
                      mb: 1.5,
                      textAlign: 'center',
                      backgroundColor: theme.palette.action.hover,
                    }}
                  >
                    <Typography fontSize={10.5} color={theme.palette.text.secondary} fontWeight={700} letterSpacing={1} textTransform='uppercase' mb={0.5}>
                      {t('demoSendExactly')}
                    </Typography>
                    <Typography fontWeight={800} fontSize={{ xs: 20, sm: 24 }} color={theme.palette.text.primary} letterSpacing='-0.5px'>
                      {selectedCoin.amountCrypto}{' '}
                      <Box component="span" sx={{ color: selectedCoin.color }}>{selectedCoin.short}</Box>
                    </Typography>
                    <Typography fontSize={11} color={theme.palette.text.secondary} mt={0.5}>
                      ≈ €{MOCK_DATA.totalAmount.toFixed(2)} EUR · Rate locked for 15:00
                    </Typography>
                  </Box>

                  {/* Wallet address + fake QR + copy */}
                  <Box
                    sx={{
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: '12px',
                      p: 1.5,
                      mb: 1.5,
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'center',
                      textAlign: 'left',
                    }}
                  >
                    {/* Mock QR — a stylised SVG that looks QR-shaped without being a real one */}
                    <Box
                      component="svg"
                      viewBox="0 0 40 40"
                      sx={{
                        width: 72,
                        height: 72,
                        flexShrink: 0,
                        borderRadius: '8px',
                        bgcolor: isDark ? '#0f0f22' : '#fff',
                        border: `1px solid ${theme.palette.border.main}`,
                        p: 0.5,
                      }}
                    >
                      {/* Corner markers */}
                      <rect x="2" y="2" width="10" height="10" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="1.5" />
                      <rect x="5" y="5" width="4" height="4" fill={isDark ? '#fff' : '#000'} />
                      <rect x="28" y="2" width="10" height="10" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="1.5" />
                      <rect x="31" y="5" width="4" height="4" fill={isDark ? '#fff' : '#000'} />
                      <rect x="2" y="28" width="10" height="10" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="1.5" />
                      <rect x="5" y="31" width="4" height="4" fill={isDark ? '#fff' : '#000'} />
                      {/* Random-ish middle pixels for QR feel */}
                      {[
                        [14, 4],[16, 4],[20, 6],[24, 4],[14, 6],[18, 8],[22, 10],
                        [4, 14],[6, 16],[8, 20],[10, 24],[6, 18],[8, 22],
                        [14, 14],[16, 16],[18, 14],[20, 18],[22, 16],[24, 20],
                        [14, 22],[16, 24],[18, 26],[20, 22],[22, 24],
                        [30, 14],[32, 16],[34, 20],[30, 24],[32, 22],
                        [14, 30],[16, 32],[20, 34],[24, 30],[26, 34],
                      ].map(([x, y], i) => (
                        <rect key={i} x={x} y={y} width="2" height="2" fill={isDark ? '#fff' : '#000'} />
                      ))}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontSize={10.5} color={theme.palette.text.secondary} fontWeight={700} letterSpacing={1} textTransform='uppercase' mb={0.5}>
                        {t('walletAddressLabel')}
                      </Typography>
                      <Tooltip title={selectedCoin.address} arrow>
                        <Typography
                          fontFamily="'JetBrains Mono', monospace"
                          fontSize={13}
                          fontWeight={600}
                          color={theme.palette.text.primary}
                          sx={{ wordBreak: 'break-all', lineHeight: 1.35 }}
                          data-testid="demo-wallet-address"
                        >
                          {truncAddr(selectedCoin.address)}
                        </Typography>
                      </Tooltip>
                      <Button
                        onClick={() => copyToClipboard(selectedCoin.address, 'Address copied')}
                        size='small'
                        startIcon={<Icon icon="mdi:content-copy" width={13} />}
                        sx={{
                          mt: 0.5,
                          textTransform: 'none',
                          fontSize: 11.5,
                          color: theme.palette.primary.main,
                          fontWeight: 600,
                          px: 0.5,
                          py: 0.25,
                        }}
                      >
                        {t('copyAddress')}
                      </Button>
                    </Box>
                  </Box>

                  {/* Awaiting on-chain confirmation */}
                  <Box
                    sx={{
                      border: `1px solid ${isDark ? 'rgba(0, 4, 255, 0.35)' : 'rgba(0, 4, 255, 0.20)'}`,
                      borderRadius: '12px',
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      bgcolor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(10,10,10,0.04)',
                      mb: 1.5,
                    }}
                    data-testid="demo-awaiting-confirmation"
                  >
                    <CircularProgress size={20} sx={{ color: theme.palette.primary.main }} />
                    <Box sx={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <Typography fontSize={12.5} fontWeight={700} color={theme.palette.text.primary} letterSpacing='-0.1px'>
                        Waiting for confirmation on {selectedCoin.label}
                      </Typography>
                      <Typography fontSize={11} color={theme.palette.text.secondary}>
                        Simulating on-chain block time · auto-confirms in {confirmSeconds}s
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      fullWidth
                      variant='outlined'
                      onClick={() => setStep(0)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: '12px',
                        fontWeight: 600,
                        py: 1,
                        fontSize: '13px',
                        borderColor: theme.palette.border.main,
                        color: theme.palette.text.primary,
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      fullWidth
                      variant='contained'
                      onClick={goToDone}
                      data-testid="demo-simulate-received-btn"
                      sx={{
                        textTransform: 'none',
                        borderRadius: '12px',
                        fontWeight: 700,
                        py: 1,
                        fontSize: '13px',
                        background: 'linear-gradient(135deg, #12B76A 0%, #0E9F5C 100%)',
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(18, 183, 106, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #0E9F5C 0%, #0C8A50 100%)',
                          boxShadow: '0 6px 20px rgba(18, 183, 106, 0.4)',
                        },
                      }}
                    >
                      {t('demoSimulatePayment')}
                    </Button>
                  </Box>
                </>
              )}

              {/* ═══ STEP 2 — DONE (success) ═══════════════════════════════ */}
              {step === 2 && (
                <>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      mx: 'auto',
                      my: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #12B76A 0%, #0E9F5C 100%)',
                      boxShadow: '0 8px 24px rgba(18, 183, 106, 0.35)',
                    }}
                    data-testid="demo-success-icon"
                  >
                    <Icon icon="mdi:check-bold" width={32} color="#fff" />
                  </Box>

                  <Typography fontWeight={700} fontSize={{ xs: 18, sm: 20 }} color={theme.palette.text.primary} letterSpacing='-0.3px'>
                    {t('paymentReceived')}
                  </Typography>
                  <Typography color={theme.palette.text.secondary} fontSize={12.5} lineHeight={1.5} mt={0.5} mb={2}>
                    {selectedCoin.amountCrypto} {selectedCoin.short} · <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>€{MOCK_DATA.totalAmount.toFixed(2)} EUR</Box> settled to the merchant wallet.
                  </Typography>

                  <Box
                    sx={{
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: '12px',
                      p: 1.5,
                      mb: 1.5,
                      textAlign: 'left',
                      backgroundColor: theme.palette.action.hover,
                    }}
                  >
                    <Box display='flex' justifyContent='space-between' mb={0.75}>
                      <Typography fontSize={12} color={theme.palette.text.secondary}>Merchant</Typography>
                      <Typography fontSize={12} fontWeight={600} color={theme.palette.text.primary}>{MOCK_DATA.merchantInfo.name}</Typography>
                    </Box>
                    <Box display='flex' justifyContent='space-between' mb={0.75}>
                      <Typography fontSize={12} color={theme.palette.text.secondary}>Invoice</Typography>
                      <Typography fontSize={12} fontWeight={600} color={theme.palette.text.primary} fontFamily="'JetBrains Mono', monospace">{MOCK_DATA.orderReference}</Typography>
                    </Box>
                    <Box display='flex' justifyContent='space-between'>
                      <Typography fontSize={12} color={theme.palette.text.secondary}>Network</Typography>
                      <Typography fontSize={12} fontWeight={600} color={selectedCoin.color}>{selectedCoin.label}</Typography>
                    </Box>
                  </Box>

                  <Button
                    fullWidth
                    variant='outlined'
                    onClick={resetDemo}
                    startIcon={<Icon icon="mdi:restart" width={16} />}
                    data-testid="demo-reset-btn"
                    sx={{
                      textTransform: 'none',
                      borderRadius: '12px',
                      fontWeight: 600,
                      py: 1,
                      fontSize: '13px',
                      borderColor: theme.palette.border.main,
                      color: theme.palette.text.primary,
                    }}
                  >
                    {t('tryDemoAgain')}
                  </Button>
                </>
              )}
            </Box>
          </Paper>
        </Box>

        <Snackbar
          open={!!copySnackbar}
          autoHideDuration={2000}
          onClose={() => setCopySnackbar(null)}
          message={copySnackbar || ''}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Pay3Layout>
  )
}

export default PaymentDemo
