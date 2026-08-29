/**
 * Checkout presentational primitives — extracted from CleanCheckoutV2
 * (Session refactor). Pure/presentational so they can be rendered & verified
 * in isolation. `CheckoutStatusTimeline` is re-exported from CleanCheckoutV2
 * to preserve its existing external import path.
 */
import React from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import { MONO, LIME, ON_BRAND } from './checkoutConstants'

/**
 * Live payment status: pill + "Waiting → Detected → Confirmed" step timeline.
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
export const PanelShell: React.FC<{
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
