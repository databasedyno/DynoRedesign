import { BRAND_ACCENT } from "@/constants/theme";
/**
 * DonationCampaign — public checkout view for donation / crowdfunding links.
 *
 * Rendered by pages/pay/index.tsx when getData returns is_donation:true.
 * The donor picks (or types) an amount, optionally adds a name/message,
 * and "Donate" calls POST /pay/startDonation via the onDonate callback —
 * the page then continues with the regular crypto checkout flow using the
 * returned child payment reference.
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
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import Logo from '@/assets/Icons/Logo'
import {
  formatWithSeparators,
  getCurrencySymbolFromFormat,
} from '@/utils/currencyFormat'
import {
  GoalProgressBar,
  CountdownPill,
  RewardTierShelf,
  DonorWallV2,
  CampaignShareTray,
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
function renderMarkdownSafe(src: string): string {
  if (!src) return ''
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Sanitize URL — only allow http(s), mailto, and absolute paths.
  const safeUrl = (u: string) => {
    const url = String(u || '').trim()
    if (/^(https?:|mailto:|\/)/i.test(url)) return escape(url)
    return '#'
  }
  // Apply inline formatting to an ALREADY-ESCAPED string. Order matters:
  // images → links → inline-code → bold → italic. Bold BEFORE italic so
  // `**foo**` isn't mis-parsed as italic-star-italic.
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
    // Blank → flush paragraph, close list
    if (line === '') { flushPara(); closeList(); continue }
    // Horizontal rule
    if (/^---+$/.test(line)) { flushPara(); closeList(); out.push('<hr/>'); continue }
    // Headings — apply inline formatting to the escaped heading text
    let m
    if ((m = /^###\s+(.*)$/.exec(line))) { flushPara(); closeList(); out.push(`<h3>${inline(escape(m[1]))}</h3>`); continue }
    if ((m = /^##\s+(.*)$/.exec(line)))  { flushPara(); closeList(); out.push(`<h2>${inline(escape(m[1]))}</h2>`); continue }
    if ((m = /^#\s+(.*)$/.exec(line)))   { flushPara(); closeList(); out.push(`<h1>${inline(escape(m[1]))}</h1>`); continue }
    // Blockquote
    if ((m = /^>\s+(.*)$/.exec(line)))   { flushPara(); closeList(); out.push(`<blockquote>${inline(escape(m[1]))}</blockquote>`); continue }
    // Ordered list
    if ((m = /^\d+\.\s+(.*)$/.exec(line))) {
      flushPara()
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol' }
      out.push(`<li>${inline(escape(m[1]))}</li>`)
      continue
    }
    // Unordered list
    if ((m = /^[-*+]\s+(.*)$/.exec(line))) {
      flushPara()
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul' }
      out.push(`<li>${inline(escape(m[1]))}</li>`)
      continue
    }
    // Paragraph line — accumulate; inline processing runs when the paragraph flushes.
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
  merchant: { name: string; company_logo: string | null } | null
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
const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'

const timeAgo = (iso: string): string => {
  const d = new Date(iso).getTime()
  if (!Number.isFinite(d)) return ''
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24)
  return dd < 30 ? `${dd}d ago` : `${Math.floor(dd / 30)}mo ago`
}

const DonationCampaign = ({ donation, merchant, submitting, onDonate }: DonationCampaignProps) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')

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
  // Relative "time ago" labels depend on the current clock, which differs
  // between the SSR render and client hydration → React hydration mismatch
  // (#418/#425). Render them only after mount so SSR and first client paint
  // agree. (F11)
  const [mounted, setMounted] = useState(false)
  // Ref to the donate form card so tier "Pledge" CTAs can scroll it into view.
  const donateFormRef = useRef<HTMLDivElement | null>(null)

  const fmt = (n: number) => `${symbol}${formatWithSeparators(n, currency)}`

  const accent = BRAND_ACCENT // aurora indigo — Landing v3 (Session 82 migration; was: #CCFF00 brand lime)
  const onAccent = '#FFFFFF'
  // Premium gradient pair — shared with the creator Support widget
  const GRAD = `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #7C3AED 100%)`
  const surfaceGlass = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = theme.palette.border.main
  const limeTint = isDark ? 'rgba(79,70,229,0.10)' : 'rgba(79,70,229,0.16)'

  const progressPct = donation.progress_percent
  const hasGoal = donation.goal_amount != null && donation.goal_amount > 0
  const goalReached = donation.closed_reason === 'goal_reached' ||
    (hasGoal && donation.raised_amount >= (donation.goal_amount as number))

  useEffect(() => { setMounted(true) }, [])

  const effectiveAmount = useMemo(() => {
    if (selectedPreset != null) return selectedPreset
    const n = parseFloat(customAmount)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
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

  /**
   * When a donor clicks "Pledge $X" on a reward tier we set the amount
   * (as a custom amount so the user can adjust upward if they want) and
   * smooth-scroll the donate form into view. We use scrollIntoView instead
   * of jumping anchors so the transition feels natural on mobile.
   */
  const handlePledgeTier = (tier: { min_amount: number }) => {
    setSelectedPreset(null)
    setCustomAmount(String(tier.min_amount))
    setAmountError('')
    // Wait one tick so React has committed the amount before we scroll.
    setTimeout(() => {
      donateFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  const inputSx = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: `1px solid ${border}`,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
    fontFamily: 'var(--font-sans)',
    fontSize: 14.5,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 140ms ease',
    '&:focus': { borderColor: accent },
    '&::placeholder': { color: theme.palette.text.disabled },
  }

  const overlineSx = {
    fontFamily: MONO,
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
    mb: 1.25,
    display: 'block',
  }

  const renderStat = (value: React.ReactNode, label: string, mono: boolean = true) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontFamily: mono ? MONO : 'var(--font-sans)', fontWeight: 700, fontSize: { xs: 18, sm: 20 }, lineHeight: 1.1, color: theme.palette.text.primary }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: theme.palette.text.secondary, mt: 0.5 }}>{label}</Typography>
    </Box>
  )

  // ── Amount + donor form (right column / mobile top) ──
  const donateForm = (
    <Box
      ref={donateFormRef}
      data-testid='donation-form-card'
      sx={{
        overflow: 'hidden',
        borderRadius: '22px',
        border: `1px solid ${border}`,
        background: isDark
          ? 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,250,255,0.88) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: isDark
          ? '0 20px 55px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 20px 55px rgba(67,56,202,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -110,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 380,
          height: 200,
          background: `radial-gradient(50% 50% at 50% 50%, ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(79,70,229,0.12)'} 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
        p: { xs: 2, sm: 2.5 },
        position: { xs: 'relative', md: 'sticky' },
        top: { md: 16 },
      }}
    >
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
                  padding: '13px 6px',
                  borderRadius: '14px',
                  fontFamily: MONO,
                  fontSize: 15,
                  fontWeight: 700,
                  border: `1.5px solid ${active ? 'transparent' : border}`,
                  color: active ? onAccent : theme.palette.text.primary,
                  background: active ? GRAD : 'transparent',
                  boxShadow: active ? '0 8px 22px rgba(79,70,229,0.35)' : 'none',
                  transition: 'border-color 120ms ease, background-color 120ms ease, transform 120ms ease, box-shadow 120ms ease',
                  '&:hover': { borderColor: accent, transform: 'translateY(-2px)' },
                  '&:active': { transform: 'scale(0.98)' },
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
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: MONO,
              fontSize: 14.5,
              fontWeight: 600,
              color: theme.palette.text.secondary,
              pointerEvents: 'none',
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
            sx={{ ...inputSx, paddingLeft: `${14 + symbol.length * 10 + 6}px`, fontFamily: MONO }}
          />
        </Box>
      )}

      <Box display='flex' justifyContent='space-between' alignItems='center' mt={0.75}>
        <Typography fontSize={11.5} color={amountError ? theme.palette.error.main : theme.palette.text.secondary} data-testid='donation-amount-hint'>
          {amountError ||
            t('donation.minAmountHint', { defaultValue: `Minimum ${fmt(minAmount)}`, amount: fmt(minAmount) })}
        </Typography>
        <Typography fontSize={11.5} fontFamily={MONO} color={theme.palette.text.secondary}>
          {currency}
        </Typography>
      </Box>

      {/* Donor details */}
      <Box mt={2}>
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
            sx={{ ...inputSx, resize: 'vertical', minHeight: 56, display: 'block' }}
          />
          {donorMessage.length > 0 && (
            <Typography fontSize={10.5} color={theme.palette.text.disabled} textAlign='right' mt={0.25}>
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
              sx={{ '&.Mui-checked': { color: accent } }}
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
          py: 1.5,
          borderRadius: '14px',
          textTransform: 'none',
          fontSize: 15.5,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          background: GRAD,
          color: onAccent,
          boxShadow: '0 12px 30px rgba(79,70,229,0.35)',
          transition: 'filter 140ms ease, transform 120ms ease, box-shadow 140ms ease',
          '&:hover': { background: GRAD, filter: 'brightness(1.07)', transform: 'translateY(-1px)', boxShadow: '0 16px 38px rgba(79,70,229,0.45)' },
          '&:active': { transform: 'scale(0.99)' },
          '&.Mui-disabled': {
            background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
            color: theme.palette.text.disabled,
            boxShadow: 'none',
          },
        }}
      >
        {submitting ? (
          <CircularProgress size={20} sx={{ color: onAccent }} />
        ) : effectiveAmount != null && effectiveAmount > 0 ? (
          <>
            <Icon icon='mdi:heart' width={16} style={{ marginRight: 8 }} />
            {t('donation.donateAmount', { defaultValue: `Donate ${fmt(effectiveAmount)}`, amount: fmt(effectiveAmount) })}
          </>
        ) : (
          t('donation.donate', { defaultValue: 'Donate' })
        )}
      </Button>
      <Typography fontSize={11.5} color={theme.palette.text.disabled} textAlign='center' mt={1.25}>
        <Icon icon='mdi:lock-outline' width={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />
        {t('donation.secureNote', { defaultValue: 'Secure crypto payment — you will pick a coin on the next step.' })}
      </Typography>
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
    />
  ) : null

  return (
    <Box display='flex' justifyContent='center' px={{ xs: 1.5, sm: 2 }} pt={{ xs: 1, sm: 2 }} pb={{ xs: '104px', sm: '104px', md: 2 }} width='100%'>
      <Box
        data-testid='donation-campaign-card'
        sx={{
          width: '100%',
          maxWidth: 960,
          borderRadius: '24px',
          overflow: 'hidden',
          border: `1px solid ${border}`,
          backgroundColor: theme.palette.background.paper,
          boxShadow: isDark
            ? '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 30px 80px rgba(67,56,202,0.12), 0 4px 16px rgba(10,10,10,0.05)',
        }}
      >
        {/* ── Hero: cover + title + progress ── */}
        <Box>
          {donation.campaign_image ? (
            <Box
              component='img'
              src={donation.campaign_image}
              alt={donation.title || 'Campaign'}
              data-testid='donation-cover-image'
              sx={{ width: '100%', height: { xs: 170, sm: 240 }, objectFit: 'cover', display: 'block' }}
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <Box
              sx={{
                height: { xs: 130, sm: 170 },
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `radial-gradient(90% 130% at 15% 0%, rgba(79,70,229,0.5) 0%, transparent 55%), radial-gradient(80% 110% at 88% 15%, rgba(124,58,237,0.42) 0%, transparent 58%), radial-gradient(70% 90% at 55% 105%, rgba(14,165,233,0.22) 0%, transparent 60%), #0A0A14`,
              }}
            >
              <Logo width={44} height={52} />
            </Box>
          )}
        </Box>

        <Box px={{ xs: 2, sm: 4 }} py={{ xs: 2.5, sm: 3 }}>
          {/* Merchant */}
          <Box display='flex' alignItems='center' gap={1} mb={1.5}>
            {merchant?.company_logo ? (
              <Box
                component='img'
                src={merchant.company_logo}
                alt={merchant?.name || 'Merchant'}
                sx={{ maxHeight: 26, maxWidth: 90, objectFit: 'contain' }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <Logo width={22} height={26} />
            )}
            {merchant?.name && (
              <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.secondary}>
                {merchant.name}
              </Typography>
            )}
          </Box>

          {/* Title + purpose */}
          <Typography
            fontWeight={800}
            fontSize={{ xs: 26, sm: 34 }}
            lineHeight={1.12}
            letterSpacing='-0.03em'
            color={theme.palette.text.primary}
            data-testid='donation-title'
            sx={{ fontFamily: 'var(--font-hero), var(--font-sans)' }}
          >
            {donation.title || t('donation.defaultTitle', { defaultValue: 'Support this campaign' })}
          </Typography>
          {donation.purpose && (
            <Typography
              color={theme.palette.text.secondary}
              fontSize={14.5}
              lineHeight={1.6}
              mt={1}
              data-testid='donation-purpose'
              sx={{ whiteSpace: 'pre-line', maxWidth: 640 }}
            >
              {donation.purpose}
            </Typography>
          )}

          {/* ── Crowdfunding v2 pills: category + countdown ── */}
          {(donation.category || donation.ends_at) && (
            <Box mt={1.5} display='flex' flexWrap='wrap' gap={0.75} data-testid='donation-v2-pills'>
              {donation.category && (
                <Box
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    px: 1, py: 0.35, borderRadius: '999px',
                    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                  data-testid='donation-category-pill'
                >
                  <Icon icon='mdi:tag-outline' width={13} />
                  {donation.category}
                </Box>
              )}
              {donation.ends_at && <CountdownPill endsAt={donation.ends_at} />}
            </Box>
          )}

          {/* ── Beneficiary block (trust signal — separate from organizer) ── */}
          {donation.beneficiary?.name && (
            <Box
              mt={2}
              sx={{
                p: 1.5, borderRadius: '10px',
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              }}
              data-testid='donation-beneficiary'
            >
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 0.5 }}>
                Beneficiary
              </Typography>
              <Typography fontSize={14} fontWeight={700} color={theme.palette.text.primary}>
                {donation.beneficiary.name}
              </Typography>
              {donation.beneficiary.description && (
                <Typography fontSize={13} color={theme.palette.text.secondary} sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>
                  {donation.beneficiary.description}
                </Typography>
              )}
            </Box>
          )}

          {/* Progress + stats */}
          {donation.show_progress && (
            <Box mt={2.5} data-testid='donation-progress'>
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
                />
              ) : (
                <Box>
                  <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: { xs: 26, sm: 32 }, lineHeight: 1, color: theme.palette.text.primary }}>
                    {fmt(donation.raised_amount)}
                  </Typography>
                  <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.75}>
                    {t('donation.raised', { defaultValue: 'raised' })}
                  </Typography>
                </Box>
              )}

              <Box display='flex' gap={{ xs: 3, sm: 5 }} mt={2} flexWrap='wrap'>
                {renderStat(donation.supporters_count, t('donation.supportersLabel', { defaultValue: 'supporters' }))}
                {hasGoal && progressPct != null && (
                  renderStat(`${progressPct}%`, t('donation.funded', { defaultValue: 'funded' }))
                )}
                {hasGoal && (
                  renderStat(fmt(Math.max(0, (donation.goal_amount as number) - donation.raised_amount)), t('donation.toGo', { defaultValue: 'to go' }))
                )}
              </Box>

              {/* Share tray — small, restrained, sits below the stats.
                  Gated on `mounted` (not typeof window) so SSR + first client
                  render both output the same empty container → no hydration
                  mismatch — the tray then fades in after hydration. */}
              {mounted && (
                <Box mt={2} display='flex' alignItems='center' gap={1} flexWrap='wrap' data-testid='donation-share-row'>
                  <Typography fontSize={11.5} color={theme.palette.text.disabled} sx={{ fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Share
                  </Typography>
                  <CampaignShareTray
                    title={donation.title || 'this campaign'}
                    url={window.location.href}
                  />
                </Box>
              )}
            </Box>
          )}

          {/* Closed banner */}
          {donation.campaign_closed && (
            <Box
              mt={3} p={2} borderRadius='14px' data-testid='donation-closed-banner'
              sx={{
                backgroundColor: goalReached ? limeTint : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                border: `1px solid ${goalReached ? accent : border}`,
                textAlign: 'center',
              }}
            >
              <Typography fontSize={16} fontWeight={800} color={theme.palette.text.primary}>
                {goalReached
                  ? t('donation.closedGoalReached', { defaultValue: 'Goal reached — thank you!' })
                  : t('donation.closedExpired', { defaultValue: 'This campaign has ended' })}
              </Typography>
              <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.5}>
                {t('donation.closedSubtitle', { defaultValue: 'This campaign is no longer accepting donations.' })}
              </Typography>
            </Box>
          )}

          {/* ── Two-column: story/gallery/supporters (left) + donate form (right) ── */}
          {!donation.campaign_closed && (
            <Box
              mt={3}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column-reverse', md: 'row' },
                gap: { xs: 2.5, md: 4 },
                alignItems: 'flex-start',
              }}
            >
              <Box sx={{ flex: { md: '1.25 1 0' }, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Story (Markdown → HTML via a minimal safe renderer) */}
                {donation.story_md && (
                  <Box data-testid='donation-story'>
                    <Typography component='span' sx={overlineSx}>
                      {t('donation.story', { defaultValue: 'Our story' })}
                    </Typography>
                    <Box
                      sx={{
                        color: theme.palette.text.primary,
                        fontSize: 14.5,
                        lineHeight: 1.7,
                        '& h1, & h2, & h3': { fontWeight: 800, letterSpacing: '-0.01em', mt: 1.5, mb: 1 },
                        '& h1': { fontSize: 22 },
                        '& h2': { fontSize: 19 },
                        '& h3': { fontSize: 17 },
                        '& p': { mb: 1.5, whiteSpace: 'pre-wrap' },
                        '& ul, & ol': { pl: 3, mb: 1.5 },
                        '& li': { mb: 0.5 },
                        '& a': { color: accent, textDecoration: 'underline' },
                        '& strong': { fontWeight: 700 },
                        '& em': { fontStyle: 'italic' },
                        '& img': { maxWidth: '100%', borderRadius: '10px', my: 1 },
                        '& blockquote': {
                          borderLeft: `3px solid ${accent}`,
                          pl: 2, ml: 0, my: 1.5,
                          color: theme.palette.text.secondary,
                          fontStyle: 'italic',
                        },
                        '& code': {
                          fontFamily: MONO, fontSize: 13,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                          px: 0.5, borderRadius: '4px',
                        },
                      }}
                      // Minimal, safe Markdown → HTML — headings, bold, italic, links, lists,
                      // paragraphs. Rejects raw HTML tags to avoid XSS.
                      dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(donation.story_md) }}
                    />
                  </Box>
                )}

                {/* Gallery — supporting photos */}
                {donation.gallery && donation.gallery.length > 0 && (
                  <Box data-testid='donation-gallery'>
                    <Typography component='span' sx={overlineSx}>
                      {t('donation.gallery', { defaultValue: 'Photos' })}
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
                        gap: 1,
                      }}
                    >
                      {donation.gallery.slice(0, 12).map((photo, idx) => (
                        <Box
                          key={`${photo.url}-${idx}`}
                          data-testid={`donation-gallery-item-${idx}`}
                          sx={{
                            position: 'relative',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            aspectRatio: '1 / 1',
                            border: `1px solid ${border}`,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
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
                            <Box
                              sx={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                px: 1, py: 0.5,
                                background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
                                color: '#FFFFFF', fontSize: 11, fontWeight: 600,
                              }}
                            >
                              {photo.caption}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Tiers — milestone rewards (Phase 3.2, redesigned Phase B) */}
                {donation.tiers && donation.tiers.length > 0 && (
                  <RewardTierShelf
                    tiers={donation.tiers}
                    currencySymbol={symbol}
                    formatAmount={(n) => formatWithSeparators(n, currency)}
                    onPledge={handlePledgeTier}
                  />
                )}

                {/* Updates feed — organizer posts (Phase 3.2) */}
                {donation.updates && donation.updates.length > 0 && (
                  <Box data-testid='donation-updates'>
                    <Typography component='span' sx={overlineSx}>
                      {t('donation.updates', { defaultValue: 'Updates' })}
                      {' '}
                      <Box component='span' sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                        · {donation.updates.length}
                      </Box>
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {donation.updates.map((upd) => (
                        <Box
                          key={upd.update_id}
                          data-testid={`donation-update-${upd.update_id}`}
                          sx={{
                            p: 1.75, borderRadius: '10px',
                            border: `1px solid ${border}`,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                          }}
                        >
                          <Typography fontWeight={800} fontSize={15.5} color={theme.palette.text.primary}>
                            {upd.title}
                          </Typography>
                          <Typography fontSize={11.5} color={theme.palette.text.secondary} sx={{ mt: 0.25, mb: 1 }}>
                            {timeAgo(upd.created_at)}
                          </Typography>
                          {upd.image_url && (
                            <Box
                              component='img'
                              src={upd.image_url}
                              alt=''
                              sx={{ width: '100%', borderRadius: '8px', mb: 1, maxHeight: 320, objectFit: 'cover' }}
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <Box
                            sx={{
                              color: theme.palette.text.primary,
                              fontSize: 13.5,
                              lineHeight: 1.6,
                              '& h1, & h2, & h3': { fontWeight: 800, letterSpacing: '-0.01em', mt: 1, mb: 0.5 },
                              '& h1': { fontSize: 17 },
                              '& h2': { fontSize: 15 },
                              '& h3': { fontSize: 14 },
                              '& p': { mb: 1, whiteSpace: 'pre-wrap' },
                              '& ul, & ol': { pl: 2.5, mb: 1 },
                              '& li': { mb: 0.35 },
                              '& a': { color: accent, textDecoration: 'underline' },
                              '& strong': { fontWeight: 700 },
                              '& em': { fontStyle: 'italic' },
                              '& blockquote': {
                                borderLeft: `3px solid ${accent}`,
                                pl: 1.5, ml: 0, my: 1,
                                color: theme.palette.text.secondary,
                                fontStyle: 'italic',
                              },
                            }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(upd.body_md) }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {supportersWall}
              </Box>
              <Box sx={{ flex: { md: '1 1 0' }, width: '100%', minWidth: 0, maxWidth: { md: 400 }, mx: { md: 0 } }}>
                {donateForm}
              </Box>
            </Box>
          )}

          {/* When closed, still show supporters below */}
          {donation.campaign_closed && supportersWall && (
            <Box mt={3}>{supportersWall}</Box>
          )}
        </Box>
      </Box>

      {/* ── Mobile sticky Donate bar (app-like) — portal to body so it stays
          pinned to the viewport regardless of any transformed ancestor. ── */}
      {mounted && !donation.campaign_closed && createPortal(
        <Box
          data-testid='donation-sticky-cta'
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1300,
            display: { xs: 'block', md: 'none' },
            px: 2,
            pt: 1.25,
            pb: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
            backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: `1px solid ${border}`,
            boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
          }}
        >
          <Button
            fullWidth
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
              minHeight: 52,
              borderRadius: '999px',
              textTransform: 'none',
              fontSize: 16,
              fontWeight: 800,
              background: GRAD,
              color: onAccent,
              boxShadow: '0 10px 26px rgba(79,70,229,0.4)',
              '&:hover': { background: GRAD, filter: 'brightness(1.07)' },
              '&:active': { transform: 'scale(0.99)' },
              '&.Mui-disabled': {
                background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                color: theme.palette.text.disabled,
                boxShadow: 'none',
              },
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
    </Box>
  )
}

export default DonationCampaign
