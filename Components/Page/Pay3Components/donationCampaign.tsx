import { BRAND_ACCENT, BRAND_ON_ACCENT } from "@/constants/theme";
import { GRAIN_URL, RISE_KEYFRAMES, buildCoverBackground, readableOn, rise } from "@/constants/creatorTheme";
import { toNumber } from "@/utils/money";
/**
 * DonationCampaign — public checkout view for donation / crowdfunding links.
 *
 * Rendered by pages/pay/index.tsx when getData returns is_donation:true.
 * The donor picks (or types) an amount, optionally adds a name/message,
 * and "Donate" calls POST /pay/startDonation via the onDonate callback —
 * the page then continues with the regular crypto checkout flow using the
 * returned child payment reference.
 *
 * Visual system mirrors the redesigned creator / shop surfaces: merchant
 * accent drives the ambient glow, avatar ring and progress fill; the primary
 * CTA keeps the Dynopay gold gradient; content sits in glass cards on canvas.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Typography,
  useTheme,
} from '@mui/material'
import { alpha, darken } from '@mui/material/styles'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import Logo from '@/assets/Icons/Logo'
import { useRelativeTime } from '@/hooks/useRelativeTime'
import useStickyCtaFootprint from '@/hooks/useStickyCtaFootprint'
import {
  formatWithSeparators,
  getCurrencyDecimals,
  getCurrencySymbolFromFormat,
} from '@/utils/currencyFormat'
import { formatWithSymbol } from '@/utils/locale'
import {
  GoalProgressBar,
  CountdownPill,
  RewardTierShelf,
  DonorWallV2,
  CampaignShareTray,
  CampaignTrustInfo,
  AcceptedCoinsStrip,
} from './campaign'

/**
 * Minimal, XSS-safe Markdown → HTML renderer for the campaign story.
 *
 * Supports: headings (#, ##, ###), bold (`**`), italic (`*`), inline code
 * (`` ` ``), links (`[text](url)`), unordered lists (`- `), ordered lists
 * (`1. `), blockquotes (`> `), paragraphs (empty-line separated),
 * horizontal rules (`---`), and inline images (`![alt](url)`).
 *
 * Everything else is HTML-escaped. Raw HTML tags in the source are
 * ALWAYS neutralised — a defence-in-depth against a compromised author
 * or a bug in the sanitizer.
 */
function renderMarkdownSafe(raw: string): string {
  if (!raw) return ''
  // The API's xss() input sanitizer stores `>` / `"` as entities — decode them
  // first; every fragment is re-escaped below before it reaches the DOM.
  const src = raw
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&')
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const safeUrl = (u: string) => {
    const url = String(u || '').trim()
    if (/^(https?:|mailto:|\/)/i.test(url)) return escape(url)
    return '#'
  }
  const inline = (escaped: string): string => {
    let p = escaped
    p = p.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, u) => `<img src="${safeUrl(u)}" alt="${escape(alt)}" loading="lazy" decoding="async" style="max-width:100%;height:auto;"/>`)
    p = p.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, tx, u) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener noreferrer">${escape(tx)}</a>`)
    p = p.replace(/`([^`]+)`/g, (_m, code) => `<code>${escape(code)}</code>`)
    p = p.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    p = p.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    return p
  }

  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inList: 'ul' | 'ol' | null = null
  let paraBuf: string[] = []
  const flushPara = () => {
    if (paraBuf.length === 0) return
    out.push(`<p>${inline(paraBuf.join(' '))}</p>`)
    paraBuf = []
  }
  const closeList = () => {
    if (inList) { out.push(`</${inList}>`); inList = null }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') { flushPara(); closeList(); continue }
    if (/^---+$/.test(line)) { flushPara(); closeList(); out.push('<hr/>'); continue }
    let m
    if ((m = /^###\s+(.*)$/.exec(line))) { flushPara(); closeList(); out.push(`<h3>${inline(escape(m[1]))}</h3>`); continue }
    if ((m = /^##\s+(.*)$/.exec(line)))  { flushPara(); closeList(); out.push(`<h2>${inline(escape(m[1]))}</h2>`); continue }
    if ((m = /^#\s+(.*)$/.exec(line)))   { flushPara(); closeList(); out.push(`<h1>${inline(escape(m[1]))}</h1>`); continue }
    if ((m = /^>\s+(.*)$/.exec(line)))   { flushPara(); closeList(); out.push(`<blockquote>${inline(escape(m[1]))}</blockquote>`); continue }
    if ((m = /^\d+\.\s+(.*)$/.exec(line))) {
      flushPara()
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol' }
      out.push(`<li>${inline(escape(m[1]))}</li>`)
      continue
    }
    if ((m = /^[-*+]\s+(.*)$/.exec(line))) {
      flushPara()
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul' }
      out.push(`<li>${inline(escape(m[1]))}</li>`)
      continue
    }
    paraBuf.push(escape(line))
  }
  flushPara()
  closeList()
  return out.join('\n')
}

export interface DonationCampaignData {
  title: string | null
  purpose: string | null
  campaign_image: string | null
  currency: string
  goal_amount: number | null
  raised_amount: number
  supporters_count: number
  progress_percent: number | null
  min_amount: number
  preset_amounts: number[]
  allow_custom_amount: boolean
  show_progress: boolean
  show_supporters: boolean
  campaign_closed: boolean
  closed_reason: 'goal_reached' | 'expired' | null
  recent_supporters: Array<{
    name: string | null
    message: string | null
    amount: number
    currency: string
    at: string
  }>
  // ── Crowdfunding v2 (Phase 3 — GoFundMe-lite) ──
  story_md?: string | null
  gallery?: Array<{ url: string; caption?: string }>
  ends_at?: string | null
  category?: string | null
  organizer_thanks?: string | null
  beneficiary?: { name: string; description?: string } | null
  // Phase 3.2
  tiers?: Array<{ tier_id: number; min_amount: number; title: string; description?: string | null; image_url?: string | null }>
  updates?: Array<{ update_id: number; title: string; body_md: string; image_url?: string | null; created_at: string }>
}

interface DonationCampaignProps {
  donation: DonationCampaignData
  merchant: { name: string; company_logo: string | null; accent_color?: string | null; handle?: string | null } | null
  submitting: boolean
  onDonate: (p: {
    amount: number
    donor_name?: string
    donor_message?: string
    is_anonymous?: boolean
    email?: string
  }) => void
}

const MESSAGE_MAX = 280
const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace'
const HERO = 'var(--font-hero), var(--font-sans)'
const GRAD = `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #FFB300 100%)`

const DonationCampaign = ({ donation, merchant, submitting, onDonate }: DonationCampaignProps) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')
  const rel = useRelativeTime()

  const currency = donation.currency || 'USD'
  const symbol = getCurrencySymbolFromFormat(currency)
  const minAmount = donation.min_amount > 0 ? donation.min_amount : 1
  const presets = donation.preset_amounts || []
  const allowCustom = donation.allow_custom_amount !== false

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [donorName, setDonorName] = useState<string>('')
  const [donorEmail, setDonorEmail] = useState<string>('')
  const [donorMessage, setDonorMessage] = useState<string>('')
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false)
  const [amountError, setAmountError] = useState<string>('')
  const [emailError, setEmailError] = useState<string>('')
  // Relative "time ago" labels depend on the clock → render only after mount
  // so SSR and the first client paint agree (hydration #418/#425).
  const [mounted, setMounted] = useState(false)
  const donateFormRef = useRef<HTMLDivElement | null>(null)

  const fmt = (n: number) => formatWithSymbol(n, symbol, getCurrencyDecimals(currency))

  // Merchant accent drives glow / ring / progress; CTAs stay Dynopay gold.
  const accent = merchant?.accent_color || BRAND_ACCENT
  const accentText = isDark ? accent : (readableOn(accent) === '#FFFFFF' ? accent : darken(accent, 0.38))
  const onAccent = BRAND_ON_ACCENT
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,18,20,0.06)'
  const glass = {
    position: 'relative' as const,
    overflow: 'hidden',
    borderRadius: '24px',
    border: `1px solid ${border}`,
    background: isDark
      ? 'linear-gradient(180deg, rgba(24,24,31,0.86) 0%, rgba(18,18,22,0.82) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.84) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: isDark
      ? '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
      : `0 20px 50px ${alpha(accent, 0.10)}, inset 0 1px 0 rgba(255,255,255,0.9)`,
  }
  const subtleSurface = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(18,18,20,0.025)'

  const progressPct = donation.progress_percent
  const hasGoal = donation.goal_amount != null && donation.goal_amount > 0
  const goalReached = donation.closed_reason === 'goal_reached' ||
    (hasGoal && donation.raised_amount >= (donation.goal_amount as number))

  useEffect(() => { setMounted(true) }, [])
  useStickyCtaFootprint(mounted && !donation.campaign_closed)

  const effectiveAmount = useMemo(() => {
    if (selectedPreset != null) return selectedPreset
    const n = parseFloat(customAmount)
    return Number.isFinite(n) && n > 0 ? toNumber(n, 2) : null
  }, [selectedPreset, customAmount])

  const canDonate = effectiveAmount != null && effectiveAmount >= minAmount && !submitting

  const handlePreset = (v: number) => {
    setSelectedPreset(v)
    setCustomAmount('')
    setAmountError('')
  }

  const handleCustomChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    const safe = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned
    const limited = parts[1]?.length > 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : safe
    setCustomAmount(limited)
    setSelectedPreset(null)
    setAmountError('')
  }

  const handleDonate = () => {
    if (submitting) return
    if (effectiveAmount == null || effectiveAmount <= 0) {
      setAmountError(t('donation.enterAmount', { defaultValue: 'Please choose or enter a donation amount.' }))
      return
    }
    if (effectiveAmount < minAmount) {
      setAmountError(
        t('donation.minAmountError', {
          defaultValue: `Minimum donation is ${fmt(minAmount)}.`,
          amount: fmt(minAmount),
        })
      )
      return
    }
    const trimmedEmail = donorEmail.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError(t('donation.invalidEmail', { defaultValue: 'Please enter a valid email address, or leave it blank.' }))
      return
    }
    setEmailError('')
    onDonate({
      amount: effectiveAmount,
      donor_name: donorName.trim() || undefined,
      donor_message: donorMessage.trim() || undefined,
      is_anonymous: isAnonymous,
      email: trimmedEmail || undefined,
    })
  }

  // Tier "Pledge" sets a custom amount (so the donor can adjust upward) and
  // scrolls the form into view.
  const handlePledgeTier = (tier: { min_amount: number }) => {
    setSelectedPreset(null)
    setCustomAmount(String(tier.min_amount))
    setAmountError('')
    setTimeout(() => {
      donateFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  const inputSx = {
    width: '100%',
    minHeight: 48,
    padding: '12px 14px',
    borderRadius: '14px',
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
    color: theme.palette.text.primary,
    fontFamily: 'var(--font-sans)',
    fontSize: 14.5,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
    '&:focus': { borderColor: accent, boxShadow: `0 0 0 3px ${alpha(accent, 0.18)}` },
    '&::placeholder': { color: theme.palette.text.disabled },
  }

  const overlineSx = {
    fontFamily: MONO,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
    mb: 1.25,
    display: 'block',
  }

  const renderStat = (value: React.ReactNode, label: string, testid: string, icon: string) => (
    <Box
      data-testid={testid}
      sx={{
        minWidth: 0, p: { xs: 1.25, sm: 1.75 }, borderRadius: '16px',
        border: `1px solid ${theme.palette.divider}`, backgroundColor: subtleSurface,
        display: 'flex', alignItems: 'center', gap: 1.25,
      }}
    >
      <Box sx={{ width: 34, height: 34, borderRadius: '11px', flexShrink: 0, display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'center', bgcolor: alpha(accent, isDark ? 0.16 : 0.12), color: accentText }}>
        <Icon icon={icon} width={17} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: { xs: 16, sm: 19 }, lineHeight: 1.1, letterSpacing: '-0.02em', color: theme.palette.text.primary, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, mt: 0.35, lineHeight: 1.2 }}>{label}</Typography>
      </Box>
    </Box>
  )

  const organizerName = merchant?.name || ''
  const organizerInitial = (organizerName || '?').slice(0, 1).toUpperCase()

  // ── Organizer chip (glass) ──
  const organizerChip = (
    <Box
      component={merchant?.handle ? 'a' : 'div'}
      href={merchant?.handle ? `/${merchant.handle}` : undefined}
      data-testid='donation-organizer-chip'
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1, pl: 0.5, pr: 1.5, minHeight: 42, borderRadius: '999px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)'}`,
        backgroundColor: isDark ? 'rgba(12,12,16,0.62)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        color: theme.palette.text.primary, textDecoration: 'none', maxWidth: '100%',
        transition: 'border-color 140ms ease, transform 140ms ease',
        ...(merchant?.handle ? { '&:hover': { borderColor: accent, transform: 'translateY(-1px)' } } : {}),
      }}
    >
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: accent, color: readableOn(accent), fontFamily: HERO, fontWeight: 800, fontSize: 14, border: `2px solid ${alpha(accent, 0.55)}` }}>
        {merchant?.company_logo ? (
          <Box component='img' src={merchant.company_logo} alt={organizerName || 'Organizer'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : organizerName ? organizerInitial : <Logo width={16} height={18} />}
      </Box>
      <Box sx={{ minWidth: 0, lineHeight: 1.1 }}>
        <Typography sx={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
          {t('donation.organizer', { defaultValue: 'Organizer' })}
        </Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap data-testid='donation-organizer-name'>
          {organizerName || 'Dynopay'}
        </Typography>
      </Box>
    </Box>
  )

  // ── Amount + donor form (right column / mobile top) ──
  const donateForm = (
    <Box
      ref={donateFormRef}
      data-testid='donation-form-card'
      sx={{ ...glass, p: { xs: 2.5, sm: 3 }, position: { xs: 'relative', md: 'sticky' }, top: { md: 96 } }}
    >
      <Box aria-hidden sx={{ position: 'absolute', top: -140, right: -110, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(accent, isDark ? 0.22 : 0.16)} 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '14px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: GRAD, color: onAccent, boxShadow: '0 10px 24px rgba(255,179,0,0.35)' }}>
            <Icon icon='mdi:hand-heart-outline' width={22} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: HERO, fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {t('donation.backThis', { defaultValue: 'Back this campaign' })}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary }}>
              {t('donation.secureShort', { defaultValue: 'Crypto checkout · no account needed' })}
            </Typography>
          </Box>
        </Box>

        <Typography component='span' sx={overlineSx}>
          {t('donation.chooseAmount', { defaultValue: 'Choose an amount' })}
        </Typography>

        {presets.length > 0 && (
          <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={1} mb={allowCustom ? 1.25 : 0}>
            {presets.map((p) => {
              const active = selectedPreset === p
              return (
                <Box
                  key={p}
                  role='button'
                  tabIndex={0}
                  data-testid={`donation-preset-${p}`}
                  onClick={() => handlePreset(p)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handlePreset(p)
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    textAlign: 'center',
                    minHeight: 48,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '10px 6px',
                    borderRadius: '14px',
                    fontFamily: MONO,
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    border: `1.5px solid ${active ? 'transparent' : theme.palette.divider}`,
                    color: active ? onAccent : theme.palette.text.primary,
                    background: active ? GRAD : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)'),
                    boxShadow: active ? '0 10px 24px rgba(255,179,0,0.35)' : 'none',
                    transform: active ? 'translateY(-2px)' : 'none',
                    transition: 'border-color 140ms ease, background-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
                    '&:hover': { borderColor: accent, transform: 'translateY(-2px)' },
                    '&:active': { transform: 'scale(0.98)' },
                    '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
                  }}
                >
                  {fmt(p)}
                </Box>
              )
            })}
          </Box>
        )}

        {allowCustom && (
          <Box position='relative'>
            <Typography
              component='span'
              sx={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontFamily: MONO, fontSize: 14.5, fontWeight: 700, color: theme.palette.text.secondary, pointerEvents: 'none',
              }}
            >
              {symbol}
            </Typography>
            <Box
              component='input'
              inputMode='decimal'
              data-testid='donation-custom-amount'
              value={customAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomChange(e.target.value)}
              placeholder={t('donation.customAmountPlaceholder', { defaultValue: 'Other amount' })}
              sx={{ ...inputSx, paddingLeft: `${14 + symbol.length * 10 + 6}px`, fontFamily: MONO, fontWeight: 700 }}
            />
          </Box>
        )}

        <Box display='flex' justifyContent='space-between' alignItems='center' mt={0.75}>
          <Typography fontSize={11.5} color={amountError ? theme.palette.error.main : theme.palette.text.secondary} data-testid='donation-amount-hint'>
            {amountError ||
              t('donation.minAmountHint', { defaultValue: `Minimum ${fmt(minAmount)}`, amount: fmt(minAmount) })}
          </Typography>
          <Typography fontSize={11.5} fontFamily={MONO} fontWeight={700} color={theme.palette.text.secondary}>
            {currency}
          </Typography>
        </Box>

        {/* Donor details */}
        <Box mt={2.25}>
          <Typography component='span' sx={overlineSx}>
            {t('donation.donorDetails', { defaultValue: 'Your details' })}{' '}
            <Typography component='span' sx={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: theme.palette.text.disabled }}>
              ({t('donation.optional', { defaultValue: 'optional' })})
            </Typography>
          </Typography>
          <Box
            component='input'
            type='text'
            maxLength={100}
            data-testid='donation-donor-name'
            value={donorName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDonorName(e.target.value)}
            placeholder={t('donation.namePlaceholder', { defaultValue: 'Your name' })}
            sx={{ ...inputSx, mb: 1 }}
          />
          <Box
            component='input'
            type='email'
            maxLength={160}
            data-testid='donation-donor-email'
            value={donorEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDonorEmail(e.target.value); if (emailError) setEmailError('') }}
            placeholder={t('donation.emailPlaceholder', { defaultValue: 'Email for updates (optional)' })}
            sx={{ ...inputSx, mb: emailError ? 0.25 : 1 }}
          />
          {emailError && (
            <Typography fontSize={11.5} color={theme.palette.error.main} mb={1} data-testid='donation-email-error'>
              {emailError}
            </Typography>
          )}
          <Box position='relative'>
            <Box
              component='textarea'
              rows={2}
              maxLength={MESSAGE_MAX}
              data-testid='donation-donor-message'
              value={donorMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDonorMessage(e.target.value)}
              placeholder={t('donation.messagePlaceholder', { defaultValue: 'Leave a message of support…' })}
              sx={{ ...inputSx, resize: 'vertical', minHeight: 64, display: 'block' }}
            />
            {donorMessage.length > 0 && (
              <Typography fontSize={10.5} fontFamily={MONO} color={theme.palette.text.disabled} textAlign='right' mt={0.25}>
                {donorMessage.length}/{MESSAGE_MAX}
              </Typography>
            )}
          </Box>
          <FormControlLabel
            sx={{ mt: 0.25, ml: '-9px', '& .MuiFormControlLabel-label': { fontSize: 12.5, color: theme.palette.text.secondary } }}
            control={
              <Checkbox
                size='small'
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                data-testid='donation-anonymous-checkbox'
                sx={{ '&.Mui-checked': { color: accentText } }}
              />
            }
            label={t('donation.donateAnonymously', { defaultValue: 'Donate anonymously' })}
          />
        </Box>

        <Button
          fullWidth
          disableElevation
          variant='contained'
          data-testid='donation-donate-btn'
          onClick={handleDonate}
          disabled={!canDonate}
          sx={{
            mt: 1.5,
            minHeight: 54,
            borderRadius: '16px',
            textTransform: 'none',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            background: GRAD,
            color: onAccent,
            boxShadow: '0 14px 34px rgba(255,179,0,0.36)',
            transition: 'filter 140ms ease, transform 140ms ease, box-shadow 140ms ease',
            '&:hover': { background: GRAD, filter: 'brightness(1.06)', transform: 'translateY(-1px)', boxShadow: '0 18px 42px rgba(255,179,0,0.46)' },
            '&:active': { transform: 'translateY(0) scale(0.99)' },
            '&.Mui-disabled': { background: GRAD, opacity: 0.45, color: onAccent, boxShadow: 'none' },
          }}
        >
          {submitting ? (
            <CircularProgress size={20} sx={{ color: onAccent }} />
          ) : effectiveAmount != null && effectiveAmount > 0 ? (
            <>
              <Icon icon='mdi:heart' width={17} style={{ marginRight: 8 }} />
              {t('donation.donateAmount', { defaultValue: `Donate ${fmt(effectiveAmount)}`, amount: fmt(effectiveAmount) })}
            </>
          ) : (
            t('donation.donate', { defaultValue: 'Donate' })
          )}
        </Button>
        <Typography fontSize={11.5} color={theme.palette.text.secondary} textAlign='center' mt={1.25} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <Icon icon='mdi:lock-outline' width={12} />
          {t('donation.secureNote', { defaultValue: 'Secure crypto payment — you will pick a coin on the next step.' })}
        </Typography>
        <AcceptedCoinsStrip />
      </Box>
    </Box>
  )

  // ── Supporters wall ──
  const supportersWall = donation.show_supporters && donation.recent_supporters?.length > 0 ? (
    <DonorWallV2
      supporters={donation.recent_supporters as any}
      defaultCurrency={currency}
      formatWithSeparators={(n, ccy) => formatWithSeparators(n, ccy || currency)}
      getCurrencySymbolFromFormat={getCurrencySymbolFromFormat}
      anonymousLabel={t('donation.anonymous', { defaultValue: 'Anonymous' }) as string}
      headerLabel={t('donation.recentSupporters', { defaultValue: 'Recent supporters' }) as string}
      accent={accent}
    />
  ) : null

  const urgencyMs = mounted && donation.ends_at && !donation.campaign_closed
    ? new Date(donation.ends_at).getTime() - Date.now()
    : NaN
  const showUrgency = Number.isFinite(urgencyMs) && urgencyMs > 0 && urgencyMs <= 24 * 3600 * 1000
  const urgencyTime = showUrgency
    ? (() => {
        const h = Math.floor(urgencyMs / 3600000)
        const m = Math.floor((urgencyMs % 3600000) / 60000)
        return h >= 1
          ? `${h}${t('donation.countdown.h', { defaultValue: 'h' })}`
          : `${Math.max(1, m)}${t('donation.countdown.m', { defaultValue: 'm' })}`
      })()
    : ''

  const coverFallback = buildCoverBackground({ accentColor: accent, coverStyle: 'solid', coverGradient: null })

  const sectionCard = (children: React.ReactNode, testid: string, delay: number) => (
    <Box data-testid={testid} sx={{ ...glass, p: { xs: 2.25, sm: 3 }, ...rise(delay) }}>{children}</Box>
  )

  return (
    <>
    <Box sx={{ position: 'relative', width: '100%', ...RISE_KEYFRAMES }}>
      {/* Ambient accent glow — the organizer's colour bleeds softly into the canvas */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(55% 32% at 50% 0%, ${alpha(accent, isDark ? 0.22 : 0.14)} 0%, transparent 70%), radial-gradient(34% 26% at 92% 62%, ${alpha('#0EA5E9', isDark ? 0.08 : 0.05)} 0%, transparent 70%)`,
        }}
      />
      <Box display='flex' justifyContent='center' px={{ xs: 1.5, sm: 2.5 }} pt={{ xs: 1, sm: 2 }} pb={{ xs: '104px', sm: '104px', md: 4 }} width='100%' sx={{ position: 'relative' }}>
        <Box data-testid='donation-campaign-card' sx={{ width: '100%', maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>

          {/* ── Hero cover ── */}
          <Box
            data-testid='donation-hero'
            sx={{
              position: 'relative', overflow: 'hidden',
              borderRadius: { xs: '22px', md: '28px' },
              height: { xs: 220, sm: 300, md: 360 },
              background: coverFallback,
              border: `1px solid ${border}`,
              boxShadow: isDark ? '0 30px 70px rgba(0,0,0,0.55)' : `0 30px 70px ${alpha(accent, 0.18)}`,
              ...rise(0),
            }}
          >
            {donation.campaign_image ? (
              <Box
                component='img'
                src={donation.campaign_image}
                alt={donation.title || 'Campaign'}
                data-testid='donation-cover-image'
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9 }}>
                <Logo width={64} height={76} />
              </Box>
            )}
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, backgroundImage: GRAIN_URL, opacity: 0.09, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.62) 100%)', pointerEvents: 'none' }} />

            {/* Top-right: category + countdown */}
            {(donation.category || donation.ends_at) && (
              <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.75, maxWidth: '70%' }} data-testid='donation-v2-pills'>
                {donation.category && (
                  <Box
                    data-testid='donation-category-pill'
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.25, minHeight: 30, borderRadius: '999px',
                      fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: '#FFFFFF', bgcolor: 'rgba(10,10,13,0.62)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                    }}
                  >
                    <Icon icon='mdi:tag-outline' width={13} />
                    {donation.category}
                  </Box>
                )}
                {donation.ends_at && <CountdownPill endsAt={donation.ends_at} variant='onCover' />}
              </Box>
            )}

            {/* Bottom-left: organizer chip */}
            <Box sx={{ position: 'absolute', left: { xs: 14, sm: 20 }, bottom: { xs: 14, sm: 20 }, maxWidth: 'calc(100% - 28px)' }}>
              {organizerChip}
            </Box>
          </Box>

          {/* ── Title + purpose ── */}
          <Box sx={{ px: { xs: 0.5, sm: 1 }, ...rise(60) }} data-testid='donation-header'>
            <Typography
              component='h1'
              data-testid='donation-title'
              sx={{ fontFamily: HERO, fontWeight: 800, fontSize: { xs: 28, sm: 36, md: 44 }, lineHeight: 1.08, letterSpacing: '-0.035em', color: theme.palette.text.primary, overflowWrap: 'anywhere' }}
            >
              {donation.title || t('donation.defaultTitle', { defaultValue: 'Support this campaign' })}
            </Typography>
            {donation.purpose && (
              <Typography
                data-testid='donation-purpose'
                sx={{ color: theme.palette.text.secondary, fontSize: { xs: 15, sm: 16.5 }, lineHeight: 1.6, mt: 1.5, whiteSpace: 'pre-line', maxWidth: 760 }}
              >
                {donation.purpose}
              </Typography>
            )}
            {donation.beneficiary?.name && (
              <Box
                mt={2}
                data-testid='donation-beneficiary'
                sx={{ display: 'inline-flex', alignItems: 'flex-start', gap: 1.25, p: 1.5, pr: 2, borderRadius: '16px', border: `1px solid ${alpha(accent, 0.3)}`, backgroundColor: alpha(accent, isDark ? 0.08 : 0.06), maxWidth: 640 }}
              >
                <Box sx={{ width: 34, height: 34, borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(accent, isDark ? 0.18 : 0.14), color: accentText }}>
                  <Icon icon='mdi:account-heart-outline' width={18} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
                    {t('donation.beneficiary', { defaultValue: 'Beneficiary' })}
                  </Typography>
                  <Typography fontSize={14.5} fontWeight={700} color={theme.palette.text.primary}>{donation.beneficiary.name}</Typography>
                  {donation.beneficiary.description && (
                    <Typography fontSize={13} color={theme.palette.text.secondary} sx={{ whiteSpace: 'pre-line', mt: 0.35, lineHeight: 1.5 }}>
                      {donation.beneficiary.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {/* ── Progress + stats + share ── */}
          {donation.show_progress && sectionCard(
            <Box data-testid='donation-progress'>
              {showUrgency && (
                <Box
                  mb={2} px={1.5} py={1.25} borderRadius='14px' data-testid='donation-urgency-banner'
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${isDark ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  <Icon icon='mdi:clock-alert-outline' width={18} color={isDark ? '#F87171' : '#DC2626'} />
                  <Typography fontSize={13.5} fontWeight={700} sx={{ color: isDark ? '#FCA5A5' : '#B91C1C' }}>
                    {t(hasGoal ? 'donation.urgency' : 'donation.urgencyNoGoal', { time: urgencyTime, defaultValue: `Only ${urgencyTime} left — help it reach the goal` })}
                  </Typography>
                </Box>
              )}
              {hasGoal ? (
                <GoalProgressBar
                  percent={progressPct ?? 0}
                  raised={donation.raised_amount}
                  goal={donation.goal_amount as number}
                  formatCurrency={fmt}
                  raisedLabel={
                    t('donation.raisedOfGoal', {
                      defaultValue: `raised of ${fmt(donation.goal_amount as number)} goal`,
                      goal: fmt(donation.goal_amount as number),
                    }) as string
                  }
                  goalReached={goalReached}
                  accent={accent}
                  fundedLabel={t('donation.funded', { defaultValue: 'funded' }) as string}
                />
              ) : (
                <Box>
                  <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: { xs: 30, sm: 40 }, lineHeight: 1, letterSpacing: '-0.03em', color: theme.palette.text.primary, fontVariantNumeric: 'tabular-nums' }} data-testid='donation-raised-nogoal'>
                    {fmt(donation.raised_amount)}
                  </Typography>
                  <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.75}>
                    {t('donation.raised', { defaultValue: 'raised' })}
                  </Typography>
                </Box>
              )}

              <Box data-testid='donation-stats' sx={{ display: 'grid', gap: 1.25, mt: 2.5, gridTemplateColumns: hasGoal ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}>
                {renderStat(donation.supporters_count, t('donation.supportersLabel', { defaultValue: 'supporters' }), 'donation-stat-supporters', 'mdi:account-group-outline')}
                {hasGoal && progressPct != null && renderStat(`${progressPct}%`, t('donation.funded', { defaultValue: 'funded' }), 'donation-stat-funded', 'mdi:chart-donut')}
                {hasGoal && renderStat(fmt(Math.max(0, (donation.goal_amount as number) - donation.raised_amount)), t('donation.toGo', { defaultValue: 'to go' }), 'donation-stat-togo', 'mdi:flag-checkered')}
              </Box>

              {/* Share tray — gated on `mounted` so SSR + first client render match. */}
              {mounted && (
                <Box mt={2.5} pt={2} display='flex' alignItems='center' gap={1.25} flexWrap='wrap' data-testid='donation-share-row' sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
                  <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
                    {t('donation.share', { defaultValue: 'Share' })}
                  </Typography>
                  <CampaignShareTray
                    title={donation.title || 'this campaign'}
                    url={window.location.href}
                    accent={accent}
                  />
                </Box>
              )}
            </Box>,
            'donation-progress-card',
            120,
          )}

          {/* Closed banner */}
          {donation.campaign_closed && (
            <Box
              p={3} borderRadius='24px' data-testid='donation-closed-banner'
              sx={{
                ...glass,
                textAlign: 'center',
                border: `1px solid ${goalReached ? alpha('#10B981', 0.5) : border}`,
                ...rise(160),
              }}
            >
              <Box sx={{ width: 52, height: 52, mx: 'auto', mb: 1.5, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: goalReached ? alpha('#10B981', 0.14) : subtleSurface, color: goalReached ? '#10B981' : theme.palette.text.secondary }}>
                <Icon icon={goalReached ? 'mdi:trophy-outline' : 'mdi:flag-checkered'} width={26} />
              </Box>
              <Typography sx={{ fontFamily: HERO, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: theme.palette.text.primary }}>
                {goalReached
                  ? t('donation.closedGoalReached', { defaultValue: 'Goal reached — thank you!' })
                  : t('donation.closedExpired', { defaultValue: 'This campaign has ended' })}
              </Typography>
              <Typography fontSize={13.5} color={theme.palette.text.secondary} mt={0.5}>
                {t('donation.closedSubtitle', { defaultValue: 'This campaign is no longer accepting donations.' })}
              </Typography>
            </Box>
          )}

          {/* ── Two-column: story/gallery/tiers/updates/supporters (left) + donate form (right) ── */}
          {!donation.campaign_closed && (
            <Box
              sx={{
                display: 'grid',
                gap: { xs: 2, md: 3 },
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(360px, 0.8fr)' },
                alignItems: 'start',
                ...rise(180),
              }}
            >
              <Box sx={{ order: { xs: 2, md: 1 }, minWidth: 0, display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 } }}>
                {donation.story_md && sectionCard(
                  <Box data-testid='donation-story'>
                    <Typography component='span' sx={overlineSx}>
                      {t('donation.story', { defaultValue: 'Our story' })}
                    </Typography>
                    <Box
                      sx={{
                        color: theme.palette.text.primary,
                        fontSize: 15,
                        lineHeight: 1.7,
                        '& h1, & h2, & h3': { fontFamily: HERO, fontWeight: 800, letterSpacing: '-0.02em', mt: 2, mb: 1, lineHeight: 1.25 },
                        '& h1': { fontSize: 24 },
                        '& h2': { fontSize: 20 },
                        '& h3': { fontSize: 17 },
                        '& p': { mb: 1.5, whiteSpace: 'pre-wrap' },
                        '& p:last-child': { mb: 0 },
                        '& ul, & ol': { pl: 3, mb: 1.5 },
                        '& li': { mb: 0.5 },
                        '& a': { color: accentText, textDecoration: 'underline' },
                        '& strong': { fontWeight: 700 },
                        '& em': { fontStyle: 'italic' },
                        '& img': { maxWidth: '100%', borderRadius: '14px', my: 1 },
                        '& hr': { border: 0, borderTop: `1px solid ${theme.palette.divider}`, my: 2.5 },
                        '& blockquote': {
                          borderLeft: `3px solid ${alpha(accent, 0.7)}`,
                          pl: 2, ml: 0, my: 1.5,
                          color: theme.palette.text.secondary,
                          fontStyle: 'italic',
                        },
                        '& code': {
                          fontFamily: MONO, fontSize: 13,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                          px: 0.6, borderRadius: '6px',
                        },
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(donation.story_md) }}
                    />
                  </Box>,
                  'donation-story-card',
                  0,
                )}

                {donation.gallery && donation.gallery.length > 0 && sectionCard(
                  <Box data-testid='donation-gallery'>
                    <Typography component='span' sx={overlineSx}>
                      {t('donation.gallery', { defaultValue: 'Photos' })}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.25 }}>
                      {donation.gallery.slice(0, 12).map((photo, idx) => (
                        <Box
                          key={`${photo.url}-${idx}`}
                          data-testid={`donation-gallery-item-${idx}`}
                          sx={{
                            position: 'relative', borderRadius: '16px', overflow: 'hidden', aspectRatio: '1 / 1',
                            border: `1px solid ${theme.palette.divider}`, backgroundColor: alpha(accent, 0.08),
                            transition: 'transform 160ms ease, box-shadow 160ms ease',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 14px 30px ${alpha(accent, 0.18)}` },
                          }}
                        >
                          <Box
                            component='img'
                            src={photo.url}
                            alt={photo.caption || ''}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                          {photo.caption && (
                            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 1.25, py: 0.75, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)', color: '#FFFFFF', fontSize: 11.5, fontWeight: 600 }}>
                              {photo.caption}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>,
                  'donation-gallery-card',
                  0,
                )}

                {donation.tiers && donation.tiers.length > 0 && sectionCard(
                  <RewardTierShelf
                    tiers={donation.tiers}
                    currencySymbol={symbol}
                    formatAmount={(n) => formatWithSeparators(n, currency)}
                    onPledge={handlePledgeTier}
                  />,
                  'donation-tiers-card',
                  0,
                )}

                {donation.updates && donation.updates.length > 0 && sectionCard(
                  <Box data-testid='donation-updates'>
                    <Typography component='span' sx={overlineSx}>
                      {t('donation.updates', { defaultValue: 'Updates' })}
                      {' '}
                      <Box component='span' sx={{ color: theme.palette.text.disabled, fontWeight: 700 }}>· {donation.updates.length}</Box>
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {donation.updates.map((upd) => (
                        <Box
                          key={upd.update_id}
                          data-testid={`donation-update-${upd.update_id}`}
                          sx={{ p: 2, borderRadius: '16px', border: `1px solid ${theme.palette.divider}`, backgroundColor: subtleSurface }}
                        >
                          <Typography sx={{ fontFamily: HERO, fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em', color: theme.palette.text.primary }}>
                            {upd.title}
                          </Typography>
                          <Typography sx={{ fontFamily: MONO, fontSize: 11, color: theme.palette.text.secondary, mt: 0.25, mb: 1 }}>
                            {mounted ? rel(upd.created_at) : ''}
                          </Typography>
                          {upd.image_url && (
                            <Box
                              component='img'
                              src={upd.image_url}
                              alt=''
                              sx={{ width: '100%', borderRadius: '12px', mb: 1, maxHeight: 320, objectFit: 'cover' }}
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <Box
                            sx={{
                              color: theme.palette.text.primary,
                              fontSize: 14,
                              lineHeight: 1.6,
                              '& h1, & h2, & h3': { fontWeight: 800, letterSpacing: '-0.01em', mt: 1, mb: 0.5 },
                              '& h1': { fontSize: 17 },
                              '& h2': { fontSize: 15 },
                              '& h3': { fontSize: 14 },
                              '& p': { mb: 1, whiteSpace: 'pre-wrap' },
                              '& p:last-child': { mb: 0 },
                              '& ul, & ol': { pl: 2.5, mb: 1 },
                              '& li': { mb: 0.35 },
                              '& a': { color: accentText, textDecoration: 'underline' },
                              '& strong': { fontWeight: 700 },
                              '& em': { fontStyle: 'italic' },
                              '& blockquote': { borderLeft: `3px solid ${alpha(accent, 0.7)}`, pl: 1.5, ml: 0, my: 1, color: theme.palette.text.secondary, fontStyle: 'italic' },
                            }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(upd.body_md) }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>,
                  'donation-updates-card',
                  0,
                )}

                {supportersWall && sectionCard(supportersWall, 'donation-supporters-card', 0)}
              </Box>

              <Box sx={{ order: { xs: 1, md: 2 }, minWidth: 0 }}>
                {donateForm}
              </Box>
            </Box>
          )}

          {/* When closed, still show supporters below */}
          {donation.campaign_closed && supportersWall && sectionCard(supportersWall, 'donation-supporters-card', 200)}

          {/* ── Trust & compliance: fund-handling, tax/refund, FAQ ── */}
          <Box sx={rise(240)}>
            <CampaignTrustInfo merchantName={merchant?.name || null} minAmountLabel={fmt(minAmount)} accent={accent} />
          </Box>
        </Box>
      </Box>
    </Box>

      {/* ── Mobile sticky Donate bar — portal to body so it stays pinned to the
          viewport regardless of any transformed ancestor. ── */}
      {mounted && !donation.campaign_closed && createPortal(
        <Box
          data-testid='donation-sticky-cta'
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'var(--dp-lang-bar, 0px)',
            zIndex: 1300,
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            pt: 1.25,
            pb: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
            backgroundColor: isDark ? 'rgba(12,12,14,0.94)' : 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: `1px solid ${theme.palette.divider}`,
            boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, lineHeight: 1.2 }} noWrap>
              {donation.title || t('donation.defaultTitle', { defaultValue: 'Support this campaign' })}
            </Typography>
            <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 18, lineHeight: 1.2, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }} data-testid='donation-sticky-amount'>
              {effectiveAmount != null && effectiveAmount > 0
                ? fmt(effectiveAmount)
                : (hasGoal && progressPct != null ? `${progressPct}% ${t('donation.funded', { defaultValue: 'funded' })}` : fmt(donation.raised_amount))}
            </Typography>
          </Box>
          <Button
            disableElevation
            variant='contained'
            data-testid='donation-sticky-donate-btn'
            disabled={submitting}
            onClick={() => {
              if (canDonate) {
                handleDonate()
              } else {
                donateFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }}
            sx={{
              minHeight: 50,
              px: 3,
              borderRadius: '14px',
              textTransform: 'none',
              fontSize: 15.5,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              background: GRAD,
              color: onAccent,
              boxShadow: '0 10px 26px rgba(255,179,0,0.36)',
              '&:hover': { background: GRAD, filter: 'brightness(1.06)' },
              '&:active': { transform: 'scale(0.99)' },
              '&.Mui-disabled': { background: GRAD, opacity: 0.45, color: onAccent, boxShadow: 'none' },
            }}
          >
            {submitting ? (
              <CircularProgress size={20} sx={{ color: onAccent }} />
            ) : effectiveAmount != null && effectiveAmount > 0 ? (
              t('donation.donateAmount', { defaultValue: `Donate ${fmt(effectiveAmount)}`, amount: fmt(effectiveAmount) })
            ) : (
              t('donation.donate', { defaultValue: 'Donate' })
            )}
          </Button>
        </Box>,
        document.body,
      )}
    </>
  )
}

export default DonationCampaign
