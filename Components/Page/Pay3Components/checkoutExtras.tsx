import React from 'react'
import { Box, TextField, Typography, Button } from '@mui/material'
import { Icon } from '@iconify/react'

const OK = '#12B76A'
const ERR = '#B91C1C'

/**
 * ReceiptEmailField — optional "Email me a receipt" input for the public
 * checkout surfaces. The parent owns the value + the save call (POST
 * /pay/setCustomerEmail); this component is presentational only.
 */
export const ReceiptEmailField: React.FC<{
  value: string
  onChange: (v: string) => void
  onSave: () => void
  saved: boolean
  invalid: boolean
  label: string
  helper: string
  savedLabel: string
  invalidLabel: string
  muted: string
  border: string
}> = ({ value, onChange, onSave, saved, invalid, label, helper, savedLabel, invalidLabel, muted, border }) => (
  <Box sx={{ mb: 2.5 }} data-testid="checkout-receipt-email-field">
    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, mb: 0.5, letterSpacing: '0.02em' }}>
      {label}
    </Typography>
    <TextField
      fullWidth
      size="small"
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder="you@example.com"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      error={invalid}
      inputProps={{ 'data-testid': 'checkout-receipt-email-input', 'aria-label': label }}
      sx={{
        '& .MuiOutlinedInput-root': { borderRadius: '8px', minHeight: 46 },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: border },
      }}
    />
    {invalid ? (
      <Typography data-testid="checkout-receipt-email-error" sx={{ fontSize: 11.5, color: ERR, mt: 0.5 }}>
        {invalidLabel}
      </Typography>
    ) : saved ? (
      <Typography
        data-testid="checkout-receipt-email-saved"
        sx={{ fontSize: 11.5, color: OK, mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <Icon icon="mdi:check-circle" width={13} /> {savedLabel}
      </Typography>
    ) : (
      <Typography sx={{ fontSize: 11.5, color: muted, mt: 0.5 }}>{helper}</Typography>
    )}
  </Box>
)

/**
 * NotifyMeInline — opt-in control for a browser "Payment confirmed" alert.
 * - permission 'default'  → shows the enable button (click = user gesture → prompt)
 * - permission 'granted'  → shows a subtle "you'll be alerted" confirmation
 * - 'denied' / unsupported → renders nothing (parent still shows on-page status)
 */
export const NotifyMeInline: React.FC<{
  supported: boolean
  permission: 'default' | 'granted' | 'denied' | 'unsupported'
  onEnable: () => void
  ctaLabel: string
  enabledLabel: string
  muted: string
  border: string
  accent: string
}> = ({ supported, permission, onEnable, ctaLabel, enabledLabel, muted, border, accent }) => {
  if (!supported || permission === 'denied') return null
  if (permission === 'granted') {
    return (
      <Typography
        data-testid="checkout-notify-enabled"
        sx={{ fontSize: 12, color: muted, mt: 1.5, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}
      >
        <Icon icon="mdi:bell-check-outline" width={14} color={accent} /> {enabledLabel}
      </Typography>
    )
  }
  return (
    <Button
      fullWidth
      variant="outlined"
      disableElevation
      data-testid="checkout-notify-btn"
      onClick={onEnable}
      startIcon={<Icon icon="mdi:bell-outline" width={18} />}
      sx={{
        mt: 1.5,
        textTransform: 'none',
        borderRadius: '999px',
        fontWeight: 600,
        fontSize: 13,
        minHeight: 44,
        color: muted,
        borderColor: border,
        '&:hover': { borderColor: accent, color: accent, backgroundColor: 'transparent' },
      }}
    >
      {ctaLabel}
    </Button>
  )
}
