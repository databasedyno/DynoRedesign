import { BRAND_ACCENT, BRAND_ON_ACCENT } from "@/constants/theme";
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, CircularProgress, Typography, useTheme } from '@mui/material'
import { alpha, darken } from '@mui/material/styles'
import { Icon } from '@iconify/react'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
import { GRAIN_URL, readableOn } from '@/constants/creatorTheme'
import InlineTipCheckout from './InlineTipCheckout'
import SupporterWall, { RecentSupporter } from './SupporterWall'
import TipGoalBar from './TipGoalBar'
import { getRuntimeFlags } from '@/helpers/runtimeFlags'

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace'
const HERO = 'var(--font-hero), var(--font-sans)'
// Dynopay signal gold — the ONE primary gradient on the page (CTA + active chip).
const LIME = BRAND_ACCENT
// Gold always carries ink text (WCAG AA) — never white on gold.
const INK = BRAND_ON_ACCENT

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
  monthly_goal?: number | null
  month_raised?: number | null
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
  accentColor,
}: {
  handle: string
  creatorName: string
  widget: SupportWidgetData
  siteUrl?: string
  accentColor?: string | null
}) => {
  const { t } = useTranslation('landing')
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const border = theme.palette.divider
  const surface = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)'
  // Merchant accent drives tints, focus rings, glows and the live dot; the
  // primary CTA stays Dynopay gold (guaranteed AA with ink text).
  const accent = accentColor || LIME
  const accentText = isDark ? accent : (readableOn(accent) === '#FFFFFF' ? accent : darken(accent, 0.38))
  const focusRing = `0 0 0 3px ${alpha(accent, isDark ? 0.35 : 0.28)}`

  const meta = STYLE_META[widget.style] || STYLE_META.coffee
  const title = (widget.label && widget.label.trim()) || meta.title
  // Signal-gold gradient — CTA + selected amount chip.
  const GRAD = `linear-gradient(135deg, ${LIME} 0%, #FFB300 100%)`
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
    minWidth: 68,
    minHeight: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    px: 1.25,
    borderRadius: '16px',
    border: `1.5px solid ${active ? 'transparent' : border}`,
    background: active ? GRAD : surface,
    color: active ? INK : theme.palette.text.primary,
    fontWeight: 800,
    fontSize: 16,
    fontFamily: MONO,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    userSelect: 'none' as const,
    textAlign: 'center' as const,
    boxShadow: active ? '0 10px 26px rgba(255,179,0,0.35)' : 'none',
    transform: active ? 'translateY(-2px)' : 'none',
    transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease',
    '&:hover': { borderColor: active ? 'transparent' : accent, transform: 'translateY(-2px)', boxShadow: active ? '0 12px 30px rgba(255,179,0,0.42)' : `0 8px 20px ${isDark ? 'rgba(0,0,0,0.35)' : alpha(accent, 0.14)}` },
    '&:active': { transform: 'translateY(0) scale(0.98)' },
    '&:focus-visible': { outline: 'none', boxShadow: focusRing },
  })

  const fieldSx = {
    width: '100%',
    minHeight: 48,
    padding: '13px 16px',
    borderRadius: '14px',
    border: `1px solid ${border}`,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    color: theme.palette.text.primary,
    fontFamily: 'var(--font-sans)',
    fontSize: 14.5,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
    '&::placeholder': { color: theme.palette.text.disabled },
    '&:hover': { borderColor: alpha(accent, 0.5) },
    '&:focus': { borderColor: accent, boxShadow: focusRing },
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
        borderRadius: '28px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,18,20,0.06)'}`,
        p: { xs: 2.5, sm: 3.5 },
        background: isDark
          ? 'linear-gradient(180deg, rgba(24,24,31,0.88) 0%, rgba(18,18,22,0.84) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.86) 100%)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        boxShadow: isDark
          ? '0 28px 70px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
          : `0 28px 70px ${alpha(accent, 0.12)}, inset 0 1px 0 rgba(255,255,255,0.95)`,
        // Soft accent aurora bleeding in from the top-right corner
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -160,
          right: -120,
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(accent, isDark ? 0.26 : 0.18)} 0%, transparent 68%)`,
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: GRAIN_URL,
          opacity: isDark ? 0.05 : 0.035,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, position: 'relative' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '16px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: GRAD,
            boxShadow: '0 12px 28px rgba(255,179,0,0.38)',
            transform: 'rotate(-4deg)',
          }}
        >
          <Icon icon={meta.icon} width={26} color={INK} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component='h2' fontWeight={800} fontSize={{ xs: 21, sm: 24 }} color={theme.palette.text.primary} lineHeight={1.15} sx={{ fontFamily: HERO, letterSpacing: '-0.025em' }}>
            {title}
          </Typography>
          {hasStats && (
            <Box data-testid="support-widget-stats" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mt: 0.6 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: accent, boxShadow: `0 0 0 3px ${alpha(accent, 0.22)}` }} />
              <Typography sx={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: theme.palette.text.secondary }}>
                {t(widget.supporters_count === 1 ? 'creator.support.statsOne' : 'creator.support.statsOther', { count: widget.supporters_count, raised: fmtMoney(widget.raised_amount), defaultValue: `${widget.supporters_count} supporters · ${fmtMoney(widget.raised_amount)} raised` })}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {widget.thanks_message && widget.thanks_message.trim() && (
        <Typography fontSize={14.5} color={theme.palette.text.secondary} mt={1.75} lineHeight={1.6} sx={{ position: 'relative' }}>
          {widget.thanks_message.trim()}
        </Typography>
      )}

      {/* Monthly tip goal — opt-in; progress = this calendar month's confirmed tips */}
      {typeof widget.monthly_goal === 'number' && widget.monthly_goal > 0 && (
        <TipGoalBar goal={widget.monthly_goal} raised={Number(widget.month_raised || 0)} fmtMoney={fmtMoney} accent={accent} />
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
            accentColor={accentColor}
            onNewTip={resetToForm}
            onCancel={resetToForm}
          />
        </Box>
      )}

      {phase === 'form' && (
      <>
      {/* Preset amount chips */}
      <Typography sx={{ mt: 3, mb: 1, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary, position: 'relative' }}>
        {t('creator.support.chooseAmount', { defaultValue: 'Choose an amount' })}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, position: 'relative' }} data-testid="support-widget-presets">
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
          sx={{ ...chipSx(selected === 'custom'), fontSize: 14, fontFamily: 'var(--font-sans)' }}
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
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 16,
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
            sx={{ ...fieldSx, paddingLeft: '34px', fontFamily: MONO, fontWeight: 700, fontSize: 16, minHeight: 52 }}
          />
        </Box>
      )}

      {/* Platform minimum helper (S4.4) — buyers see the $10 floor upfront */}
      <Box
        sx={{ mt: 1, fontSize: 12, color: theme.palette.text.secondary, fontFamily: 'var(--font-sans)', position: 'relative' }}
        data-testid="support-min-hint"
      >
        {t("creator.support.minHint", { min: fmtMoney(min), defaultValue: "{{min}} minimum" })}
      </Box>

      {/* C4: message first (the part supporters enjoy), then name */}
      {widget.allow_message && (
        <Box sx={{ mt: 2, position: 'relative' }}>
          <Box
            component="textarea"
            rows={2}
            maxLength={280}
            data-testid="support-donor-message"
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            placeholder={t('creator.support.messagePlaceholder', { name: firstName, defaultValue: `Say something nice to ${firstName} (optional)` })}
            sx={{ ...fieldSx, resize: 'vertical', minHeight: 68, display: 'block', lineHeight: 1.5 }}
          />
          {message.length > 0 && (
            <Typography sx={{ position: 'absolute', right: 12, bottom: 10, fontFamily: MONO, fontSize: 10.5, color: theme.palette.text.disabled, pointerEvents: 'none' }}>
              {message.length}/280
            </Typography>
          )}
        </Box>
      )}

      {/* Name */}
      <Box sx={{ mt: 1.5, position: 'relative' }}>
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
        sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mt: 1.75, cursor: 'pointer', userSelect: 'none', position: 'relative', minHeight: 44, '&:focus-visible': { outline: 'none', '& .support-anon-box': { boxShadow: focusRing } } }}
      >
        <Box
          className="support-anon-box"
          sx={{
            width: 22,
            height: 22,
            borderRadius: '7px',
            border: `1.5px solid ${anon ? LIME : border}`,
            backgroundColor: anon ? LIME : (isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: '1px',
            transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
          }}
        >
          {anon && <Icon icon="mdi:check-bold" width={15} color={INK} />}
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
      <Box sx={{ mt: 1.75, position: 'relative' }}>
        {!showEmail && !email ? (
          <Box
            component="button"
            type="button"
            data-testid="support-email-toggle"
            onClick={() => setShowEmail(true)}
            sx={{ background: 'none', border: 'none', p: 0, minHeight: 32, cursor: 'pointer', color: theme.palette.text.secondary, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.6, transition: 'color 140ms ease', '&:hover': { color: accentText } }}
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
          mt: 2.5,
          minHeight: 56,
          borderRadius: '18px',
          textTransform: 'none',
          fontWeight: 800,
          fontSize: 16.5,
          letterSpacing: '-0.01em',
          background: GRAD,
          color: INK,
          position: 'relative',
          boxShadow: '0 14px 34px rgba(255,179,0,0.36)',
          transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
          '&:hover': { background: GRAD, filter: 'brightness(1.06)', transform: 'translateY(-1px)', boxShadow: '0 18px 42px rgba(255,179,0,0.46)' },
          '&:active': { transform: 'translateY(0) scale(0.99)' },
          '&:focus-visible': { boxShadow: `${focusRing}, 0 14px 34px rgba(255,179,0,0.36)` },
          '&.Mui-disabled': { background: GRAD, opacity: 0.45, color: INK, boxShadow: 'none' },
        }}
      >
        {loading ? (
          <CircularProgress size={22} sx={{ color: INK }} />
        ) : (
          <>
            <Icon icon={meta.icon} width={19} style={{ marginRight: 10 }} />
            {valid
              ? t(`creator.support.cta.${widget.style}`, {
                  amount: fmtMoney(amount),
                  defaultValue: widget.style === 'coffee' ? `Buy a ${fmtMoney(amount)} coffee` : widget.style === 'tip' ? `Tip ${fmtMoney(amount)}` : `Support with ${fmtMoney(amount)}`,
                })
              : t(`creator.support.ctaEmpty.${widget.style}`, { defaultValue: meta.cta })}
          </>
        )}
      </Button>

      <Typography fontSize={11.5} color={theme.palette.text.secondary} textAlign="center" mt={1.5} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, position: 'relative' }}>
        <Icon icon="mdi:lock-outline" width={13} />
        {t("creator.support.trustLine")}
      </Typography>

      {/* Opt-in supporter wall — recent public tips (name · amount · message) */}
      {widget.show_wall && Array.isArray(widget.recent_supporters) && widget.recent_supporters.length > 0 && (
        <SupporterWall supporters={widget.recent_supporters} accent={accent} />
      )}
      </>
      )}
    </Box>
  )
}

export default SupportWidget
