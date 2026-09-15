import { BRAND_ACCENT } from "@/constants/theme";
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, CircularProgress, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
import InlineTipCheckout from './InlineTipCheckout'
import SupporterWall, { RecentSupporter } from './SupporterWall'
import { getRuntimeFlags } from '@/helpers/runtimeFlags'

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
// Aurora indigo — Landing v3 canonical accent (Session 82 migration).
const LIME = BRAND_ACCENT
// Text/icons rendered ON the solid indigo accent (CTA label, heart chip,
// anon check) — the accent is dark indigo, so the readable on-accent colour
// is white, not near-black. (Every INK usage in this file sits on the accent.)
const INK = '#FFFFFF'

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
  show_wall?: boolean
  recent_supporters?: RecentSupporter[]
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
  const { t } = useTranslation('landing')
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const border = theme.palette.divider
  const limeTint = isDark ? 'rgba(79,70,229,0.10)' : 'rgba(79,70,229,0.16)'
  const surface = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'

  const meta = STYLE_META[widget.style] || STYLE_META.coffee
  const title = (widget.label && widget.label.trim()) || meta.title
  // Premium gradient pair — Aurora indigo → violet (Quiet Money public surfaces)
  const GRAD = `linear-gradient(135deg, ${LIME} 0%, #7C3AED 100%)`
  // Platform floor: the minimum supportable amount is $10 everywhere
  // (tip / coffee / support / donation / store), regardless of the stored
  // per-creator setting. Guarantees the floor even for legacy widgets saved
  // with a lower minimum.
  const MIN_FLOOR = 10
  const presets = (
    Array.isArray(widget.preset_amounts) && widget.preset_amounts.length
      ? widget.preset_amounts
      : [10, 25, 50]
  ).filter((p) => Number(p) >= MIN_FLOOR)
  const currency = widget.currency || 'USD'
  const sym = getCurrencySymbolFromFormat(currency)
  const min = Math.max(MIN_FLOOR, Number(widget.min_amount) || 0)
  const firstName = creatorName || handle

  const [selected, setSelected] = useState<number | 'custom'>(presets[0] ?? 'custom')
  const [customAmount, setCustomAmount] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [anon, setAnon] = useState(false)
  // C4: email is progressive — most tippers never need it (the success screen asks again).
  const [showEmail, setShowEmail] = useState(false)
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
    py: 1.25,
    px: 1,
    borderRadius: '14px',
    border: `1.5px solid ${active ? 'transparent' : border}`,
    background: active ? GRAD : surface,
    color: active ? '#FFFFFF' : theme.palette.text.primary,
    fontWeight: 800,
    fontSize: 15,
    fontFamily: MONO,
    cursor: 'pointer',
    textAlign: 'center' as const,
    boxShadow: active ? '0 8px 22px rgba(79,70,229,0.35)' : 'none',
    transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
    '&:hover': { borderColor: LIME, transform: 'translateY(-2px)', boxShadow: active ? '0 10px 26px rgba(79,70,229,0.42)' : `0 6px 18px ${isDark ? 'rgba(0,0,0,0.35)' : 'rgba(67,56,202,0.12)'}` },
  })

  const fieldSx = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: `1px solid ${border}`,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
    color: theme.palette.text.primary,
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
    '&::placeholder': { color: theme.palette.text.disabled },
    '&:focus': { borderColor: LIME, boxShadow: `0 0 0 3px ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(67,56,202,0.14)'}` },
  }

  const submit = async () => {
    setError(null)
    if (!valid) {
      setError(t("creator.support.minError", { min: fmtMoney(min), defaultValue: "Please enter at least {{min}}." }))
      return
    }
    const trimmedEmail = email.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t('creator.support.emailInvalid', { defaultValue: 'Please enter a valid email address, or leave it blank.' }))
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
          email: trimmedEmail || null,
        }),
      })
      const json = await res.json().catch(() => null)
      const d = json?.data?.d
      if (!res.ok || !d) {
        setError(json?.message || t('creator.support.genericError', { defaultValue: 'Something went wrong. Please try again.' }))
        setLoading(false)
        return
      }
      // Session 42: keep the donor on the creator page and complete the
      // tip inline. If NEXT_PUBLIC_INLINE_TIP_CHECKOUT=false the widget
      // falls back to the pre-Session-42 full-page redirect (safety valve).
      const inlineDisabled = !getRuntimeFlags().inlineTipCheckout
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
      setError(t('creator.support.networkError', { defaultValue: 'Network error. Please try again.' }))
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
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '24px',
        border: `1px solid ${border}`,
        p: { xs: 2.5, sm: 3 },
        background: isDark
          ? 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,255,0.85) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: isDark
          ? '0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 24px 70px rgba(67,56,202,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
        // Soft accent aurora bleeding in from the top edge
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 420,
          height: 220,
          background: `radial-gradient(50% 50% at 50% 50%, ${isDark ? 'rgba(99,102,241,0.22)' : 'rgba(79,70,229,0.14)'} 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, position: 'relative' }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: GRAD,
            boxShadow: '0 10px 24px rgba(79,70,229,0.38)',
          }}
        >
          <Icon icon={meta.icon} width={23} color={INK} />
        </Box>
        <Typography fontWeight={800} fontSize={20} color={theme.palette.text.primary} lineHeight={1.2} sx={{ fontFamily: 'var(--font-hero), var(--font-sans)', letterSpacing: '-0.02em' }}>
          {title}
        </Typography>
      </Box>

      {widget.thanks_message && widget.thanks_message.trim() && (
        <Typography fontSize={13.5} color={theme.palette.text.secondary} mt={0.75} lineHeight={1.5}>
          {widget.thanks_message.trim()}
        </Typography>
      )}

      {hasStats && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mt: 1.25, px: 1.25, py: 0.5, borderRadius: '999px', border: `1px solid ${border}`, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(67,56,202,0.05)' }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: GRAD, boxShadow: '0 0 8px rgba(99,102,241,0.8)' }} />
          <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: theme.palette.text.secondary }}>
            {t(widget.supporters_count === 1 ? 'creator.support.statsOne' : 'creator.support.statsOther', { count: widget.supporters_count, raised: fmtMoney(widget.raised_amount), defaultValue: `${widget.supporters_count} supporters · ${fmtMoney(widget.raised_amount)} raised` })}
          </Typography>
        </Box>
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
          {t('creator.support.custom', { defaultValue: 'Custom' })}
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
          <Box
            component="input"
            type="number"
            inputMode="decimal"
            min={min}
            step="any"
            data-testid="support-custom-amount"
            value={customAmount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomAmount(e.target.value)}
            placeholder={t("creator.support.amountPlaceholder", { min, defaultValue: "Amount (min {{min}})" })}
            sx={{ ...fieldSx, paddingLeft: '28px', fontFamily: MONO, fontWeight: 700 }}
          />
        </Box>
      )}

      {/* Platform minimum helper (S4.4) — buyers see the $10 floor upfront */}
      <Box
        sx={{ mt: 1, fontSize: 12, color: theme.palette.text.secondary, fontFamily: 'var(--font-sans)' }}
        data-testid="support-min-hint"
      >
        {t("creator.support.minHint", { min: fmtMoney(min), defaultValue: "{{min}} minimum" })}
      </Box>

      {/* C4: message first (the part supporters enjoy), then name */}
      {widget.allow_message && (
        <Box sx={{ mt: 1.5 }}>
          <Box
            component="textarea"
            rows={2}
            maxLength={280}
            data-testid="support-donor-message"
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            placeholder={t('creator.support.messagePlaceholder', { name: firstName, defaultValue: `Say something nice to ${firstName} (optional)` })}
            sx={{ ...fieldSx, resize: 'vertical', minHeight: 56, display: 'block' }}
          />
        </Box>
      )}

      {/* Name */}
      <Box sx={{ mt: 1.5 }}>
        <Box
          component="input"
          type="text"
          maxLength={100}
          data-testid="support-donor-name"
          value={name}
          disabled={anon}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder={t("creator.support.namePlaceholder")}
          sx={{ ...fieldSx, opacity: anon ? 0.5 : 1 }}
        />
      </Box>

      {/* Anonymous — C9: say what "public" means right here */}
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
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1.5, cursor: 'pointer', userSelect: 'none' }}
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
            mt: '1px',
          }}
        >
          {anon && <Icon icon="mdi:check" width={15} color={INK} />}
        </Box>
        <Box>
          <Typography fontSize={13} color={theme.palette.text.secondary}>
            {t('creator.support.anonymous')}
          </Typography>
          {widget.show_supporters && (
            <Typography fontSize={11.5} color={theme.palette.text.disabled} data-testid="support-public-note">
              {t('creator.support.publicNote', { defaultValue: 'Your first name and amount may appear on this page unless you tick this.' })}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Email (optional, progressive) — donor's own receipt / updates */}
      <Box sx={{ mt: 1.5 }}>
        {!showEmail && !email ? (
          <Box
            component="button"
            type="button"
            data-testid="support-email-toggle"
            onClick={() => setShowEmail(true)}
            sx={{ background: 'none', border: 'none', p: 0, cursor: 'pointer', color: theme.palette.text.secondary, fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            <Icon icon="mdi:email-outline" width={15} />
            {t('creator.support.addEmail', { defaultValue: 'Want a receipt? Add your email' })}
          </Box>
        ) : (
          <Box
            component="input"
            type="email"
            maxLength={160}
            autoFocus={showEmail}
            data-testid="support-donor-email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder={t('creator.support.emailPlaceholder', { defaultValue: 'Email for your receipt (optional)' })}
            sx={fieldSx}
          />
        )}
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
          py: 1.5,
          borderRadius: '14px',
          textTransform: 'none',
          fontWeight: 800,
          fontSize: 15.5,
          letterSpacing: '-0.01em',
          background: GRAD,
          color: INK,
          boxShadow: '0 12px 30px rgba(79,70,229,0.35)',
          transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
          '&:hover': { background: GRAD, filter: 'brightness(1.07)', transform: 'translateY(-1px)', boxShadow: '0 16px 38px rgba(79,70,229,0.45)' },
          '&:active': { transform: 'translateY(0)' },
          '&.Mui-disabled': { background: GRAD, opacity: 0.45, color: INK, boxShadow: 'none' },
        }}
      >
        {loading ? (
          <CircularProgress size={20} sx={{ color: INK }} />
        ) : (
          <>
            <Icon icon={meta.icon} width={17} style={{ marginRight: 8 }} />
            {valid
              ? t(`creator.support.cta.${widget.style}`, {
                  amount: fmtMoney(amount),
                  defaultValue: widget.style === 'coffee' ? `Buy a ${fmtMoney(amount)} coffee` : widget.style === 'tip' ? `Tip ${fmtMoney(amount)}` : `Support with ${fmtMoney(amount)}`,
                })
              : t(`creator.support.ctaEmpty.${widget.style}`, { defaultValue: meta.cta })}
          </>
        )}
      </Button>

      <Typography fontSize={11} color={theme.palette.text.secondary} textAlign="center" mt={1.25} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        <Icon icon="mdi:lock-outline" width={12} />
        {t("creator.support.trustLine")}
      </Typography>

      {/* Opt-in supporter wall — recent public tips (name · amount · message) */}
      {widget.show_wall && Array.isArray(widget.recent_supporters) && widget.recent_supporters.length > 0 && (
        <SupporterWall supporters={widget.recent_supporters} accent={LIME} />
      )}
      </>
      )}
    </Box>
  )
}

export default SupportWidget
