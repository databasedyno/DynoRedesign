import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
  Snackbar
} from '@mui/material'
import React, { useEffect, useState, useCallback } from 'react'
import { Icon } from '@iconify/react'
import BitCoinGreenIcon from '@/assets/Icons/BitCoinGreenIcon'
import Logo from '@/assets/Icons/Logo'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import CopyIcon from '@/assets/Icons/CopyIcon'
import { useTranslation } from 'react-i18next'
import ProgressBar from '@/Components/UI/ProgressBar'

const MOCK_DATA = {
  description: 'Monthly Pro Subscription',
  orderReference: 'INV-2026-A1B2C3',
  customerName: 'John Doe',
  merchantInfo: { name: 'Acme Store', company_logo: null },
  feeInfo: { processing_fee: 2.50, fee_payer: 'merchant' as const },
  taxInfo: { rate: 23, amount: 23.00, country: 'Portugal', type: 'VAT' },
  expiryInfo: { expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
  walletState: { amount: 100.00, currency: 'EUR' },
  totalAmount: 125.50
}

const PaymentDemo = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')
  const [copySnackbar, setCopySnackbar] = useState(false)
  const [countdown, setCountdown] = useState('')

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
      const parts = []
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

  const handleCopyInvoice = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(MOCK_DATA.orderReference)
      } else {
        const ta = document.createElement('textarea')
        ta.value = MOCK_DATA.orderReference
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopySnackbar(true)
    } catch {
      setCopySnackbar(true)
    }
  }, [])

  return (
    <Pay3Layout>
      <Box>
        <ProgressBar activeStep={0} />

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
                : '0 8px 32px rgba(0,4,255,0.06), 0 2px 8px rgba(0,0,0,0.04)',
              backgroundColor: theme.palette.background.paper,
              transition: 'box-shadow 0.3s ease, transform 0.3s ease',
              '&:hover': {
                boxShadow: isDark
                  ? '0 16px 48px rgba(0,0,0,0.4)'
                  : '0 12px 40px rgba(0,4,255,0.08), 0 4px 12px rgba(0,0,0,0.06)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            {/* Gradient accent bar */}
            <Box
              sx={{
                height: '3px',
                background: 'linear-gradient(90deg, #0004FF 0%, #3D40FF 40%, #6C6FFF 100%)',
              }}
            />

            <Box px={{ xs: 2, sm: 2.5 }} py={{ xs: 2, sm: 2.5 }}>
              {/* Logo */}
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

              {/* Title */}
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

              {/* Subtitle */}
              <Typography
                color={theme.palette.text.secondary}
                fontWeight={400}
                fontSize={12.5}
                lineHeight={1.5}
                mb={2}
                mt={0.5}
                data-testid="checkout-subtitle"
              >
                Hi {MOCK_DATA.customerName}, complete your payment to{' '}
                <Box component="span" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                  {MOCK_DATA.merchantInfo.name}
                </Box>
              </Typography>

              {/* Order Details */}
              <Box
                sx={{
                  border: `1px solid ${theme.palette.border.main}`,
                  borderRadius: '12px',
                  p: 1.5,
                  mb: 1.5,
                  textAlign: 'left',
                  backgroundColor: theme.palette.action.hover,
                  transition: 'background-color 0.3s ease',
                }}
                data-testid="order-details-section"
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
                  <Typography fontWeight={500} fontSize={12} color={theme.palette.text.primary} data-testid="customer-name">
                    {MOCK_DATA.customerName}
                  </Typography>
                </Box>

                <Box display='flex' alignItems='center' justifyContent='space-between'>
                  <Box>
                    <Typography fontWeight={700} fontSize={9} color={theme.palette.text.secondary} letterSpacing={0.8} textTransform='uppercase'>
                      {t('checkout.invoice')}
                    </Typography>
                    <Typography fontWeight={500} fontSize={12} color={theme.palette.text.primary} sx={{ fontFamily: "'Urbanist', monospace" }} data-testid="invoice-number">
                      {MOCK_DATA.orderReference}
                    </Typography>
                  </Box>
                  <Tooltip title={t('checkout.copyInvoice')} arrow>
                    <IconButton
                      size='small'
                      onClick={handleCopyInvoice}
                      data-testid="copy-invoice-btn"
                      sx={{
                        bgcolor: theme.palette.border.main,
                        p: 0.5,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: theme.palette.action.selected,
                          transform: 'scale(1.05)',
                        }
                      }}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Fee Breakdown */}
              <Box
                border={`1px solid ${theme.palette.border.main}`}
                borderRadius='12px'
                px={1.5}
                py={1.5}
                data-testid="fee-breakdown-section"
                sx={{ transition: 'border-color 0.3s ease' }}
              >
                {/* Subtotal */}
                <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.75}>
                  <Typography fontSize={12.5} color={theme.palette.text.secondary} fontWeight={500}>
                    {t('checkout.subtotal')}
                  </Typography>
                  <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>
                    €{MOCK_DATA.walletState.amount.toFixed(2)}
                  </Typography>
                </Box>

                {/* Tax */}
                <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.75}>
                  <Typography fontSize={12.5} color={theme.palette.text.secondary} fontWeight={500}>
                    {t('checkout.vatRate', { rate: MOCK_DATA.taxInfo.rate, country: MOCK_DATA.taxInfo.country })}
                  </Typography>
                  <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>
                    €{MOCK_DATA.taxInfo.amount.toFixed(2)}
                  </Typography>
                </Box>

                {/* Processing Fee */}
                <Box display='flex' justifyContent='space-between' alignItems='center' mb={0.25}>
                  <Box display='flex' alignItems='center' gap={0.5}>
                    <Typography fontSize={12.5} color={theme.palette.text.secondary} fontWeight={500}>
                      {t('checkout.processingFee')}
                    </Typography>
                    {MOCK_DATA.feeInfo.fee_payer === 'merchant' && (
                      <Icon icon="mdi:check-circle" color="#12B76A" width={14} />
                    )}
                  </Box>
                  <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.primary}>
                    €{MOCK_DATA.feeInfo.processing_fee.toFixed(2)}
                  </Typography>
                </Box>

                <Typography fontSize={10.5} color="#12B76A" fontWeight={500} textAlign='left' mb={0.5}>
                  {t('checkout.processingFeesIncluded')}
                </Typography>

                <Divider sx={{ my: 1, borderColor: theme.palette.border.main }} />

                {/* Total — highlighted */}
                <Box
                  display='flex'
                  justifyContent='space-between'
                  alignItems='center'
                  mb={1.5}
                  sx={{
                    backgroundColor: isDark ? 'rgba(0,4,255,0.06)' : 'rgba(0,4,255,0.03)',
                    borderRadius: '8px',
                    mx: -0.75,
                    px: 0.75,
                    py: 0.75,
                    transition: 'background-color 0.3s ease',
                  }}
                >
                  <Typography fontWeight={700} fontSize={{ xs: 13, sm: 14 }} color={theme.palette.text.primary} letterSpacing='-0.2px'>
                    {t('checkout.total')}
                  </Typography>
                  <Box display='flex' alignItems='center' gap={0.5}>
                    <Typography fontWeight={800} fontSize={{ xs: 16, sm: 18 }} color={theme.palette.text.primary} letterSpacing='-0.3px' data-testid="total-amount">
                      €{MOCK_DATA.totalAmount.toFixed(2)}
                    </Typography>
                    <Typography fontWeight={500} fontSize={11} color={theme.palette.text.secondary}>
                      EUR
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ mb: 1.5, borderColor: theme.palette.border.main }} />

                {/* CTA — Filled gradient green button */}
                <Button
                  fullWidth
                  variant='contained'
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
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #0E9F5C 0%, #0C8A50 100%)',
                      boxShadow: '0 6px 20px rgba(18, 183, 106, 0.4)',
                      transform: 'translateY(-1px)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                      boxShadow: '0 2px 8px rgba(18, 183, 106, 0.3)',
                    },
                  }}
                >
                  {t('checkout.cryptocurrency')}
                </Button>
              </Box>

              {/* Expiry + Security row */}
              <Box
                display='flex'
                alignItems='center'
                justifyContent='space-between'
                mt={1.5}
                px={0.25}
              >
                <Box display='flex' alignItems='center' gap={0.5} data-testid="expiry-countdown">
                  <Icon icon="mdi:clock-outline" width={13} color={theme.palette.text.secondary} />
                  <Typography fontSize={10.5} color={theme.palette.text.secondary} fontWeight={500}>
                    {t('checkout.expiresIn')}{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                      {countdown}
                    </Box>
                  </Typography>
                </Box>
                <Box display='flex' alignItems='center' gap={0.5} data-testid="security-badge">
                  <Icon icon="mdi:shield-check" width={13} color={theme.palette.primary.main} />
                  <Typography fontSize={10.5} color={theme.palette.primary.main} fontWeight={700} letterSpacing='0.2px'>
                    {t('checkout.securePayment')}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Snackbar
          open={copySnackbar}
          autoHideDuration={2000}
          onClose={() => setCopySnackbar(false)}
          message={t('checkout.copied')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Pay3Layout>
  )
}

export default PaymentDemo
