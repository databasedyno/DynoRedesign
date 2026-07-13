import React, { useState } from 'react'
import { Box, Button, CircularProgress, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
import InlineTipCheckout from './InlineTipCheckout'

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
const LIME = '#CCFF00'
const INK = '#0A0A0B'

export interface SupportWidgetData {
  enabled: boolean
  style: 'coffee' | 'tip' | 'support'
  label: string | null
  preset_amounts: number[]
  currency: string
  min_amount: number
  allow_message: boolean
  thanks_message: string | null
  show_supporters: boolean
  supporters_count: number
  raised_amount: number
}

export const STYLE_META: Record<string, { title: string; icon: string; cta: string }> = {
  coffee: { title: 'Buy me a coffee', icon: 'mdi:coffee', cta: 'Buy' },
  tip: { title: 'Send a tip', icon: 'mdi:hand-coin', cta: 'Send' },
  support: { title: 'Support me', icon: 'mdi:heart', cta: 'Support' },
}

const SupportWidget = ({
  handle,
  creatorName,
  widget,
  siteUrl,
}: {
  handle: string
  creatorName: string
  widget: SupportWidgetData
  siteUrl?: string
}) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const border = theme.palette.divider
  const limeTint = isDark ? 'rgba(204,255,0,0.10)' : 'rgba(204,255,0,0.16)'
  const surface = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'

  const meta = STYLE_META[widget.style] || STYLE_META.coffee
  const title = (widget.label && widget.label.trim()) || meta.title
  const presets =
    Array.isArray(widget.preset_amounts) && widget.preset_amounts.length
      ? widget.preset_amounts
      : [3, 5, 10, 25]
  const currency = widget.currency || 'USD'
  const sym = getCurrencySymbolFromFormat(currency)
  const min = Number(widget.min_amount) > 0 ? Number(widget.min_amount) : 1
  const firstName = (creatorName || handle).split(' ')[0]

  const [selected, setSelected] = useState<number | 'custom'>(presets[0] ?? 'custom')
  const [customAmount, setCustomAmount] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [anon, setAnon] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline checkout state — Session 42: replaces the /pay redirect so the
  // donor completes the tip without leaving the creator page.
  const [phase, setPhase] = useState<'form' | 'checkout'>('form')
  const [paymentRef, setPaymentRef] = useState<string>('')

  const amount = selected === 'custom' ? parseFloat(customAmount || '0') : selected
  const valid = Number.isFinite(amount) && amount >= min

  const fmtMoney = (n: number) => `${sym}${formatWithSeparators(n, currency)}`

  const chipSx = (active: boolean) => ({
    flex: '1 1 auto',
    minWidth: 64,
    py: 1.05,
    px: 1,
    borderRadius: '12px',
    border: `1.5px solid ${active ? LIME : border}`,
    backgroundColor: active ? limeTint : surface,
    color: theme.palette.text.primary,
    fontWeight: 800,
    fontSize: 15,
    fontFamily: MONO,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'border-color 140ms ease, transform 140ms ease',
    '&:hover': { borderColor: LIME, transform: 'translateY(-1px)' },
  })

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: '10px',
    border: `1px solid ${border}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const submit = async () => {
    setError(null)
    if (!valid) {
      setError(`Please enter at least ${fmtMoney(min)}.`)
      return
    }
    setLoading(true)
    try {
      const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
      const res = await fetch(`${base}/api/pay/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          amount,
          donor_name: anon ? null : name.trim() || null,
          donor_message: widget.allow_message ? message.trim() || null : null,
          is_anonymous: anon,
        }),
      })
      const json = await res.json().catch(() => null)
      const d = json?.data?.d
      if (!res.ok || !d) {
        setError(json?.message || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      // Session 42: keep the donor on the creator page and complete the
      // tip inline. If NEXT_PUBLIC_INLINE_TIP_CHECKOUT=false the widget
      // falls back to the pre-Session-42 full-page redirect (safety valve).
      const inlineDisabled = process.env.NEXT_PUBLIC_INLINE_TIP_CHECKOUT === 'false'
      if (inlineDisabled) {
        if (typeof window !== 'undefined') {
          window.location.href = `/pay?d=${encodeURIComponent(d)}`
        }
        return
      }
      setPaymentRef(String(d))
      setPhase('checkout')
      setLoading(false)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const resetToForm = () => {
    setPhase('form')
    setPaymentRef('')
    // Reset form state for a fresh tip
    setSelected(presets[0] ?? 'custom')
    setCustomAmount('')
    setError(null)
    setLoading(false)
  }

  const hasStats = widget.show_supporters && (widget.supporters_count > 0 || widget.raised_amount > 0)

  return (
    <Box
      data-testid="creator-support-widget"
      sx={{
        borderRadius: '20px',
        border: `1px solid ${LIME}`,
        p: { xs: 2.5, sm: 3 },
        backgroundColor: limeTint,
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: LIME,
          }}
        >
          <Icon icon={meta.icon} width={22} color={INK} />
        </Box>
        <Typography fontWeight={800} fontSize={19} color={theme.palette.text.primary} lineHeight={1.2}>
          {title}
        </Typography>
      </Box>

      {widget.thanks_message && widget.thanks_message.trim() && (
        <Typography fontSize={13.5} color={theme.palette.text.secondary} mt={0.75} lineHeight={1.5}>
          {widget.thanks_message.trim()}
        </Typography>
      )}

      {hasStats && (
        <Typography sx={{ fontFamily: MONO, fontSize: 12, color: theme.palette.text.secondary, mt: 1 }}>
          {widget.supporters_count} supporter{widget.supporters_count === 1 ? '' : 's'} · {fmtMoney(widget.raised_amount)} raised
        </Typography>
      )}

      {/* Session 42: inline crypto checkout replaces the /pay redirect */}
      {phase === 'checkout' && paymentRef && (
        <Box sx={{ mt: 2 }}>
          <InlineTipCheckout
            d={paymentRef}
            handle={handle}
            creatorName={creatorName}
            style={widget.style}
            siteUrl={siteUrl || (typeof window !== 'undefined' ? window.location.href : '')}
            onNewTip={resetToForm}
            onCancel={resetToForm}
          />
        </Box>
      )}

      {phase === 'form' && (
      <>
      {/* Preset amount chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }} data-testid="support-widget-presets">
        {presets.slice(0, 5).map((p) => (
          <Box
            key={p}
            role="button"
            tabIndex={0}
            data-testid={`support-preset-${p}`}
            onClick={() => setSelected(p)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSelected(p)
              }
            }}
            sx={chipSx(selected === p)}
          >
            {sym}
            {p}
          </Box>
        ))}
        <Box
          role="button"
          tabIndex={0}
          data-testid="support-preset-custom"
          onClick={() => setSelected('custom')}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSelected('custom')
            }
          }}
          sx={{ ...chipSx(selected === 'custom'), fontSize: 13.5, fontFamily: 'var(--font-sans)' }}
        >
          Custom
        </Box>
      </Box>

      {/* Custom amount input */}
      {selected === 'custom' && (
        <Box sx={{ mt: 1.5, position: 'relative' }}>
          <Box
            sx={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: MONO,
              fontWeight: 700,
              color: theme.palette.text.secondary,
              pointerEvents: 'none',
            }}
          >
            {sym}
          </Box>
          <input
            type="number"
            inputMode="decimal"
            min={min}
            step="any"
            data-testid="support-custom-amount"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={`Amount (min ${min})`}
            style={{ ...fieldStyle, paddingLeft: 26, fontFamily: MONO, fontWeight: 700 }}
          />
        </Box>
      )}

      {/* Name */}
      <Box sx={{ mt: 1.5 }}>
        <input
          type="text"
          maxLength={100}
          data-testid="support-donor-name"
          value={name}
          disabled={anon}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          style={{ ...fieldStyle, opacity: anon ? 0.5 : 1 }}
        />
      </Box>

      {/* Message */}
      {widget.allow_message && (
        <Box sx={{ mt: 1.5 }}>
          <textarea
            rows={2}
            maxLength={280}
            data-testid="support-donor-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Say something nice to ${firstName} (optional)`}
            style={{ ...fieldStyle, resize: 'vertical', minHeight: 56, display: 'block' }}
          />
        </Box>
      )}

      {/* Anonymous */}
      <Box
        role="button"
        tabIndex={0}
        data-testid="support-anonymous"
        onClick={() => setAnon((v) => !v)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setAnon((v) => !v)
          }
        }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '6px',
            border: `1.5px solid ${anon ? LIME : border}`,
            backgroundColor: anon ? LIME : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {anon && <Icon icon="mdi:check" width={15} color={INK} />}
        </Box>
        <Typography fontSize={13} color={theme.palette.text.secondary}>
          Make my support anonymous
        </Typography>
      </Box>

      {error && (
        <Typography fontSize={12.5} color={theme.palette.error.main} mt={1.25} data-testid="support-widget-error">
          {error}
        </Typography>
      )}

      {/* CTA */}
      <Button
        fullWidth
        disableElevation
        variant="contained"
        disabled={loading || !valid}
        data-testid="support-widget-submit"
        onClick={submit}
        sx={{
          mt: 2,
          py: 1.4,
          borderRadius: '12px',
          textTransform: 'none',
          fontWeight: 800,
          fontSize: 15.5,
          backgroundColor: LIME,
          color: INK,
          '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
          '&.Mui-disabled': { backgroundColor: LIME, opacity: 0.45, color: INK },
        }}
      >
        {loading ? (
          <CircularProgress size={20} sx={{ color: INK }} />
        ) : (
          `${meta.cta} ${valid ? fmtMoney(amount) : ''}`.trim()
        )}
      </Button>

      <Typography fontSize={11} color={theme.palette.text.secondary} textAlign="center" mt={1}>
        Secure crypto checkout · no account needed
      </Typography>
      </>
      )}
    </Box>
  )
}

export default SupportWidget
