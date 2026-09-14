/**
 * Checkout presentational primitives — extracted from CleanCheckoutV2
 * (Session refactor). Pure/presentational so they can be rendered & verified
 * in isolation. `CheckoutStatusTimeline` is re-exported from CleanCheckoutV2
 * to preserve its existing external import path.
 */
import React from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
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
  /** 'mempool' = broadcast, 0 confirmations · 'confirming' = in a block, settling. */
  detectStage?: 'mempool' | 'confirming'
  timerLabel: string
  secondsRemaining?: number
  totalSeconds?: number
  isDark: boolean
  /** Hide the countdown bar here when the top status strip already shows one. */
  hideBar?: boolean
  /** Per-network confirmation ETA, e.g. "under a minute" (B7). */
  etaLabel?: string
  t: (key: string, opts?: Record<string, unknown>) => string
}> = ({ phase, detected, detectStage = 'confirming', timerLabel, secondsRemaining = 0, totalSeconds = 0, isDark, hideBar = false, etaLabel, t }) => {
  const theme = useTheme()
  const border = isDark ? 'rgba(255,255,255,0.10)' : '#E4E4E7'
  const muted = isDark ? '#A1A1AA' : '#71717A'
  const warnFg = '#B45309'
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(100, (secondsRemaining / totalSeconds) * 100)) : 0
  const barColor = pct <= 20 ? warnFg : LIME
  // Once the payment is detected the window no longer matters — the network
  // will confirm regardless — so the countdown is hidden (B1).
  const timerHidden = detected && phase !== 'underpaid'
  const showTimerBar = !hideBar && !timerHidden && phase !== 'confirmed' && phase !== 'expired' && totalSeconds > 0
  const stepIndex = phase === 'confirmed' ? 2 : detected ? 1 : 0
  const isUnderpaid = phase === 'underpaid'
  const dotColor = isUnderpaid ? warnFg : detected ? LIME : '#22c55e'
  const statusText = isUnderpaid
    ? t('checkout.status.underpaid', { defaultValue: 'Underpayment detected' })
    : detected
      ? (detectStage === 'mempool'
        ? t('checkout.status.detectedMempool', { defaultValue: 'Payment detected — awaiting confirmation' })
        : t('checkout.status.confirming', { defaultValue: 'Payment detected — confirming…' }))
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
        {!timerHidden && (
          <Typography sx={{ fontFamily: MONO, fontSize: 12, color: muted, fontWeight: 600 }} data-testid="checkout-timer-label">
            <Icon icon="mdi:timer-outline" width={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {timerLabel}
          </Typography>
        )}
      </Box>
      {detected && !isUnderpaid && phase !== 'confirmed' && (
        <Typography data-testid="checkout-human-confirming" data-detect-stage={detectStage} sx={{ fontSize: 12, color: muted, mb: 1.25 }}>
          {detectStage === 'mempool'
            ? t('checkout.humanDetectedMempool', {
              defaultValue: 'Your transaction has been broadcast and is waiting to be included in a block (usually {{eta}}). You can keep this page open or close it; your payment will still complete.',
              eta: etaLabel || '5–15 min',
            })
            : t('checkout.humanConfirmingEta', {
              defaultValue: 'We can see your payment — waiting for network confirmations (usually {{eta}}). You can keep this page open or close it; your payment will still complete.',
              eta: etaLabel || '5–15 min',
            })}
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

/** Panel container shell — Stripe-style flat card (hairline border, no drop shadow). */
export interface PanelSummaryBar {
  label: string
  amount: string
  /** Accessible name for the collapse toggle, e.g. "Order summary". */
  toggleLabel?: string
}

/**
 * PanelShell — the checkout card.
 *
 * Without `summary` it is the classic single 440px column (loading / error /
 * expired / success phases). With `summary` it becomes the TWO-PANEL layout
 * (design_guidelines 2026-06): ≥1024px the order summary (merchant, amount,
 * line items, trust) sits on the left (5/12, tinted canvas) and the payment
 * action (coin picker, QR, address, timer, CTA) on the right (7/12). Below
 * 1024px the summary folds behind a sticky, tappable bar ("Merchant · $49.00")
 * above the action panel. The summary node is rendered ONCE (no hidden
 * duplicate DOM / data-testids) — breakpoints only change how it is displayed.
 */
export const PanelShell: React.FC<{
  children: React.ReactNode
  isDark: boolean
  border: string
  muted: string
  summary?: React.ReactNode
  summaryBar?: PanelSummaryBar
  /** Offset for the sticky summary bar when the page has a fixed header. */
  stickyTop?: number | string
  /** Override the outer wrapper (min-height / paddings) for embedded use. */
  outerSx?: SxProps<Theme>
}> = ({ children, isDark, border, muted, summary, summaryBar, stickyTop = 0, outerSx }) => {
  const [summaryOpen, setSummaryOpen] = React.useState(false)
  const surface = isDark ? '#111827' : '#FFFFFF'
  const canvasTint = isDark ? '#0B0F19' : '#F8FAFC'
  const ink = isDark ? '#F8FAFC' : '#0F172A'

  if (!summary) {
    return (
      <Box
        sx={{
          minHeight: '70vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          px: { xs: 2, sm: 3 },
          py: { xs: 3, sm: 6 },
          ...(outerSx as object),
        }}
      >
        <Box
          data-testid="clean-checkout-panel"
          data-layout="single"
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 2.5, sm: 4 },
            borderRadius: '16px',
            border: `1px solid ${border}`,
            backgroundColor: surface,
            boxShadow: 'none',
            '@keyframes checkoutRise': {
              from: { opacity: 0, transform: 'translateY(6px)' },
              to: { opacity: 1, transform: 'none' },
            },
            animation: 'checkoutRise 260ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          {children}
        </Box>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        px: { xs: 0, sm: 3 },
        py: { xs: 0, sm: 4 },
        ...(outerSx as object),
      }}
    >
      <Box
        data-testid="clean-checkout-panel"
        data-layout="split"
        data-summary-open={summaryOpen ? 'true' : 'false'}
        sx={{
          width: '100%',
          maxWidth: 1080,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 5fr) minmax(0, 7fr)' },
          alignItems: 'stretch',
          borderRadius: { xs: 0, sm: '16px' },
          border: { xs: 'none', sm: `1px solid ${border}` },
          // `clip` (not `hidden`) keeps the rounded corners without turning the
          // card into a scroll container, so the summary bar can stay sticky.
          overflow: 'clip',
          backgroundColor: surface,
          '@keyframes checkoutRise': {
            from: { opacity: 0, transform: 'translateY(6px)' },
            to: { opacity: 1, transform: 'none' },
          },
          animation: 'checkoutRise 260ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        {/* Phone / tablet: sticky summary bar (merchant · total) toggling the summary */}
        <Box
          component="button"
          type="button"
          data-testid="clean-checkout-summary-toggle"
          aria-expanded={summaryOpen}
          aria-controls="clean-checkout-summary"
          aria-label={summaryBar?.toggleLabel}
          onClick={() => setSummaryOpen((v) => !v)}
          sx={{
            all: 'unset',
            boxSizing: 'border-box',
            display: { xs: 'flex', lg: 'none' },
            position: 'sticky',
            top: stickyTop,
            zIndex: 6,
            width: '100%',
            minHeight: 56,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: { xs: 2, sm: 3 },
            cursor: 'pointer',
            backgroundColor: canvasTint,
            borderBottom: `1px solid ${border}`,
            borderRadius: { xs: 0, sm: '16px 16px 0 0' },
            '&:focus-visible': { outline: `2px solid ${LIME}`, outlineOffset: -2 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Typography
              data-testid="clean-checkout-summary-bar-label"
              sx={{ fontSize: 14, fontWeight: 700, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}
            >
              {summaryBar?.label}
            </Typography>
            <Icon
              icon="mdi:chevron-down"
              width={18}
              style={{ color: muted, flexShrink: 0, transition: 'transform 160ms ease', transform: summaryOpen ? 'rotate(180deg)' : 'none' }}
            />
          </Box>
          <Typography
            data-testid="clean-checkout-summary-bar-amount"
            sx={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', color: ink, flexShrink: 0 }}
          >
            {summaryBar?.amount}
          </Typography>
        </Box>

        {/* Summary — left column ≥lg, collapsible drawer body below */}
        <Box
          id="clean-checkout-summary"
          data-testid="clean-checkout-summary"
          sx={{
            display: { xs: 'grid', lg: 'flex' },
            gridTemplateRows: { xs: summaryOpen ? '1fr' : '0fr', lg: 'none' },
            transition: 'grid-template-rows 220ms cubic-bezier(0.2, 0.7, 0.2, 1)',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            flexDirection: 'column',
            minWidth: 0,
            backgroundColor: canvasTint,
            borderRight: { xs: 'none', lg: `1px solid ${border}` },
            borderBottom: { xs: summaryOpen ? `1px solid ${border}` : 'none', lg: 'none' },
          }}
        >
          <Box sx={{ overflow: { xs: 'hidden', lg: 'visible' }, minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, px: { xs: 2, sm: 3, lg: 4 }, pt: { xs: 2, lg: 4 }, pb: { xs: 2.5, lg: 4 } }}>
              {summary}
            </Box>
          </Box>
        </Box>

        {/* Action panel */}
        <Box
          data-testid="clean-checkout-action"
          sx={{ minWidth: 0, p: { xs: 2.5, sm: 3.5, lg: 4 }, display: 'flex', flexDirection: 'column' }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * AssetNetworkChip — presents the coin + chain as ONE glanceable unit
 * ("USDT · TRC-20") so non-technical buyers aren't parsing two separate
 * fields (Area 4). Accent-tinted, theme-aware, inline badge.
 */
export const AssetNetworkChip: React.FC<{
  symbol: string
  networkLabel: string
  isDark: boolean
  testId?: string
}> = ({ symbol, networkLabel, isDark, testId = 'checkout-asset-network-unit' }) => (
  <Box
    component="span"
    data-testid={testId}
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      px: 1,
      py: '3px',
      borderRadius: '6px',
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
      color: isDark ? '#818CF8' : '#4338CA',
      backgroundColor: isDark ? 'rgba(129,140,248,0.14)' : 'rgba(67,56,202,0.08)',
      border: `1px solid ${isDark ? 'rgba(129,140,248,0.25)' : 'rgba(67,56,202,0.20)'}`,
    }}
  >
    {symbol} · {networkLabel}
  </Box>
)
