/**
 * DonationCampaign — public checkout view for donation / crowdfunding links.
 *
 * Rendered by pages/pay/index.tsx when getData returns is_donation:true.
 * The donor picks (or types) an amount, optionally adds a name/message,
 * and "Donate" calls POST /pay/startDonation via the onDonate callback —
 * the page then continues with the regular crypto checkout flow using the
 * returned child payment reference.
 */
import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
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
    p = p.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, u) => `<img src="${safeUrl(u)}" alt="${escape(alt)}"/>`)
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
  const [donorMessage, setDonorMessage] = useState<string>('')
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false)
  const [amountError, setAmountError] = useState<string>('')
  const [barValue, setBarValue] = useState(0) // animate progress on mount
  // Relative "time ago" labels depend on the current clock, which differs
  // between the SSR render and client hydration → React hydration mismatch
  // (#418/#425). Render them only after mount so SSR and first client paint
  // agree. (F11)
  const [mounted, setMounted] = useState(false)

  const fmt = (n: number) => `${symbol}${formatWithSeparators(n, currency)}`

  const accent = '#CCFF00' // brand lime (pay theme palette.primary is ink, not lime)
  const onAccent = '#0A0A0B'
  const surfaceGlass = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const border = theme.palette.border.main
  const limeTint = isDark ? 'rgba(204,255,0,0.10)' : 'rgba(204,255,0,0.16)'

  const progressPct = donation.progress_percent
  const hasGoal = donation.goal_amount != null && donation.goal_amount > 0
  const goalReached = donation.closed_reason === 'goal_reached' ||
    (hasGoal && donation.raised_amount >= (donation.goal_amount as number))

  useEffect(() => {
    const target = Math.min(100, progressPct ?? 0)
    const id = setTimeout(() => setBarValue(target), 120)
    return () => clearTimeout(id)
  }, [progressPct])

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
    onDonate({
      amount: effectiveAmount,
      donor_name: donorName.trim() || undefined,
      donor_message: donorMessage.trim() || undefined,
      is_anonymous: isAnonymous,
    })
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

  const Stat = ({ value, label, mono = true }: { value: React.ReactNode; label: string; mono?: boolean }) => (
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
      data-testid='donation-form-card'
      sx={{
        borderRadius: '18px',
        border: `1px solid ${border}`,
        backgroundColor: surfaceGlass,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        p: { xs: 2, sm: 2.5 },
        position: { md: 'sticky' },
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
                  padding: '12px 6px',
                  borderRadius: '12px',
                  fontFamily: MONO,
                  fontSize: 15,
                  fontWeight: 700,
                  border: `1.5px solid ${active ? accent : border}`,
                  color: theme.palette.text.primary,
                  backgroundColor: active ? limeTint : 'transparent',
                  transition: 'border-color 120ms ease, background-color 120ms ease, transform 120ms ease',
                  '&:hover': { borderColor: accent },
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
          borderRadius: '12px',
          textTransform: 'none',
          fontSize: 15.5,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          backgroundColor: accent,
          color: onAccent,
          transition: 'filter 140ms ease, transform 120ms ease',
          '&:hover': { backgroundColor: accent, filter: 'brightness(1.05)' },
          '&:active': { transform: 'scale(0.99)' },
          '&.Mui-disabled': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
            color: theme.palette.text.disabled,
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
      <Typography fontSize={11.5} color={theme.palette.text.disabled} textAlign='center' mt={1.25}>
        <Icon icon='mdi:lock-outline' width={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />
        {t('donation.secureNote', { defaultValue: 'Secure crypto payment — you will pick a coin on the next step.' })}
      </Typography>
    </Box>
  )

  // ── Supporters wall ──
  const supportersWall = donation.show_supporters && donation.recent_supporters?.length > 0 ? (
    <Box data-testid='donation-supporter-wall'>
      <Typography component='span' sx={overlineSx}>
        {t('donation.recentSupporters', { defaultValue: 'Recent supporters' })}
      </Typography>
      <Box display='flex' flexDirection='column' gap={1}>
        {donation.recent_supporters.slice(0, 12).map((s, i) => {
          const displayName = s.name || t('donation.anonymous', { defaultValue: 'Anonymous' })
          return (
            <Box
              key={`${s.at}-${i}`}
              display='flex'
              alignItems='flex-start'
              gap={1.25}
              p={1.5}
              borderRadius='14px'
              sx={{ border: `1px solid ${border}`, backgroundColor: surfaceGlass, textAlign: 'left' }}
            >
              <Box
                sx={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: limeTint, color: theme.palette.text.primary,
                  fontFamily: MONO, fontSize: 14, fontWeight: 700,
                }}
              >
                {s.name ? s.name.charAt(0).toUpperCase() : <Icon icon='mdi:heart' width={15} color={accent} />}
              </Box>
              <Box flex={1} minWidth={0}>
                <Box display='flex' alignItems='baseline' justifyContent='space-between' gap={1}>
                  <Typography fontSize={13.5} fontWeight={600} color={theme.palette.text.primary} noWrap>
                    {displayName}
                  </Typography>
                  <Typography fontSize={13} fontWeight={700} fontFamily={MONO} color={theme.palette.text.primary} sx={{ flexShrink: 0 }}>
                    {getCurrencySymbolFromFormat(s.currency || currency)}
                    {formatWithSeparators(s.amount, s.currency || currency)}
                  </Typography>
                </Box>
                {s.message && (
                  <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25} sx={{ wordBreak: 'break-word' }}>
                    {s.message}
                  </Typography>
                )}
                {s.at && mounted && (
                  <Typography fontSize={11} fontFamily={MONO} color={theme.palette.text.disabled} mt={0.25}>
                    {timeAgo(s.at)}
                  </Typography>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  ) : null

  return (
    <Box display='flex' justifyContent='center' px={{ xs: 1.5, sm: 2 }} py={{ xs: 1, sm: 2 }} width='100%'>
      <Box
        data-testid='donation-campaign-card'
        sx={{
          width: '100%',
          maxWidth: 960,
          borderRadius: '20px',
          overflow: 'hidden',
          border: `1px solid ${border}`,
          backgroundColor: theme.palette.background.paper,
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.4)' : '0 12px 40px rgba(10,10,10,0.08)',
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
                height: { xs: 120, sm: 150 },
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `radial-gradient(120% 140% at 85% 0%, rgba(204,255,0,0.16) 0%, rgba(204,255,0,0) 55%), #0A0A0B`,
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
            fontSize={{ xs: 24, sm: 30 }}
            lineHeight={1.15}
            letterSpacing='-0.02em'
            color={theme.palette.text.primary}
            data-testid='donation-title'
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
              {donation.ends_at && (() => {
                const endDate = new Date(donation.ends_at)
                const now = Date.now()
                const msLeft = endDate.getTime() - now
                if (isNaN(endDate.getTime()) || msLeft <= 0) return null
                const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
                const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60))
                const label = daysLeft > 1 ? `Ends in ${daysLeft} days` : hoursLeft > 1 ? `Ends in ${hoursLeft} hours` : 'Ends soon'
                const urgent = daysLeft <= 3
                return (
                  <Box
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      px: 1, py: 0.35, borderRadius: '999px',
                      fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em',
                      color: urgent ? '#B45309' : theme.palette.text.primary,
                      backgroundColor: urgent
                        ? (theme.palette.mode === 'dark' ? 'rgba(245,158,11,0.15)' : '#FEF3C7')
                        : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      border: `1px solid ${urgent ? '#F59E0B' : theme.palette.divider}`,
                    }}
                    data-testid='donation-countdown-pill'
                  >
                    <Icon icon='mdi:timer-outline' width={13} />
                    {label}
                  </Box>
                )
              })()}
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
              <Box display='flex' alignItems='flex-end' justifyContent='space-between' gap={2} flexWrap='wrap'>
                <Box>
                  <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: { xs: 26, sm: 32 }, lineHeight: 1, color: theme.palette.text.primary }}>
                    {fmt(donation.raised_amount)}
                  </Typography>
                  <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.75}>
                    {hasGoal
                      ? t('donation.raisedOfGoal', { defaultValue: `raised of ${fmt(donation.goal_amount as number)} goal`, goal: fmt(donation.goal_amount as number) })
                      : t('donation.raised', { defaultValue: 'raised' })}
                  </Typography>
                </Box>
                {progressPct != null && hasGoal && (
                  <Box
                    sx={{
                      px: 1.5, py: 0.6, borderRadius: '999px',
                      backgroundColor: accent, color: onAccent,
                      fontFamily: MONO, fontWeight: 800, fontSize: 13, lineHeight: 1,
                    }}
                  >
                    {t('donation.percentFunded', { defaultValue: `${progressPct}% funded`, percent: progressPct })}
                  </Box>
                )}
              </Box>

              {hasGoal && (
                <LinearProgress
                  variant='determinate'
                  value={barValue}
                  sx={{
                    mt: 1.5, height: 10, borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                    '& .MuiLinearProgress-bar': { backgroundColor: accent, borderRadius: 999, transition: 'transform 900ms cubic-bezier(0.16,1,0.3,1)' },
                  }}
                />
              )}

              <Box display='flex' gap={{ xs: 3, sm: 5 }} mt={2} flexWrap='wrap'>
                <Stat value={donation.supporters_count} label={t('donation.supportersLabel', { defaultValue: 'supporters' })} />
                {hasGoal && progressPct != null && (
                  <Stat value={`${progressPct}%`} label={t('donation.funded', { defaultValue: 'funded' })} />
                )}
                {hasGoal && (
                  <Stat value={fmt(Math.max(0, (donation.goal_amount as number) - donation.raised_amount))} label={t('donation.toGo', { defaultValue: 'to go' })} />
                )}
              </Box>
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

                {/* Tiers — milestone rewards (Phase 3.2) */}
                {donation.tiers && donation.tiers.length > 0 && (
                  <Box data-testid='donation-tiers'>
                    <Typography component='span' sx={overlineSx}>
                      {t('donation.tiers', { defaultValue: 'Reward tiers' })}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {donation.tiers.map((tier) => (
                        <Box
                          key={tier.tier_id}
                          data-testid={`donation-tier-${tier.tier_id}`}
                          sx={{
                            display: 'flex', alignItems: 'flex-start', gap: 1.25,
                            p: 1.5, borderRadius: '10px',
                            border: `1px solid ${border}`,
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                          }}
                        >
                          {tier.image_url ? (
                            <Box
                              component='img'
                              src={tier.image_url}
                              alt=''
                              sx={{
                                width: 56, height: 56, borderRadius: '8px', objectFit: 'cover',
                                flexShrink: 0, border: `1px solid ${border}`,
                              }}
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 56, height: 56, borderRadius: '8px', flexShrink: 0,
                                backgroundColor: accent + '22',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Icon icon='mdi:gift-outline' width={26} color={accent} />
                            </Box>
                          )}
                          <Box flex={1} minWidth={0}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap', mb: 0.25 }}>
                              <Typography fontWeight={800} fontSize={15} color={theme.palette.text.primary}>
                                {tier.title}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: accent,
                                }}
                              >
                                {getCurrencySymbolFromFormat(donation.currency)}{formatWithSeparators(tier.min_amount, donation.currency)}+
                              </Typography>
                            </Box>
                            {tier.description && (
                              <Typography fontSize={13} color={theme.palette.text.secondary} sx={{ whiteSpace: 'pre-line' }}>
                                {tier.description}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
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
    </Box>
  )
}

export default DonationCampaign
