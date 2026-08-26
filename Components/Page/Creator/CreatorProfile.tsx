import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Box, Button, Typography, useTheme } from '@mui/material'
import { alpha, darken } from '@mui/material/styles'
import { Icon } from '@iconify/react'
import Logo from '@/assets/Icons/Logo'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
import copyToClipboard from '@/helpers/copyToClipboard'
import { BRAND_ACCENT } from '@/constants/theme'
import { GRADIENT_STOPS } from '@/constants/creatorTheme'
import SupportWidget, { SupportWidgetData } from './SupportWidget'
import InlineTipCheckout from './InlineTipCheckout'
import type { CreatorAnalyticsData } from './AnalyticsWidget'
import CreatorShopSection, { CreatorShopProduct } from './CreatorShopSection'

// Lazy-load the analytics chart (recharts is heavy) so it stays out of the
// public creator page's initial JS bundle. Client-only: it's below-the-fold
// and only renders when analytics data is present.
const AnalyticsWidget = dynamic(() => import('./AnalyticsWidget'), { ssr: false })

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
// Aurora indigo — Landing v3 canonical accent (Session 82 migration).
// Only the DEFAULT accent; creators can still override via theme.accent_color.
const LIME = BRAND_ACCENT
const INK = '#0A0A0B'

// Contrast-guard for merchant-chosen accents (§5.13): pick a readable text
// colour to sit ON a solid accent fill. Light accents → near-black ink,
// dark accents → white. Falls back to white for non-hex/gradient values.
const readableOn = (hex: string): string => {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec((hex || '').trim())
  if (!m) return '#FFFFFF'
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return L > 0.6 ? '#0A0A0B' : '#FFFFFF'
}

export interface CreatorLink {
  type: 'donation' | 'link'
  link_id: number
  title: string
  description: string | null
  image: string | null
  amount: number | null
  currency: string
  goal_amount: number | null
  raised_amount: number
  supporters_count: number
  progress_percent: number | null
  closed: boolean
  url: string | null
}

export interface CreatorData {
  name: string
  handle: string
  bio: string | null
  photo: string | null
  cover_image?: string | null
  social_links?: Record<string, string> | null
  theme?: {
    accent_color?: string | null
    cover_style?: string | null
    cover_gradient?: string | null
  } | null
  public_analytics_enabled?: boolean
}

const SOCIAL_ICONS: Record<string, string> = {
  twitter: 'mdi:twitter',
  instagram: 'mdi:instagram',
  youtube: 'mdi:youtube',
  tiktok: 'mdi:music-note',
  telegram: 'mdi:telegram',
  facebook: 'mdi:facebook',
  website: 'mdi:web',
}

// Normalize bare handles into URLs so socials always open externally.
const socialHref = (platform: string, raw: string): string => {
  const v = raw.trim()
  if (/^https?:\/\//i.test(v)) return v
  const stripped = v.replace(/^@/, '')
  switch (platform) {
    case 'twitter':   return `https://twitter.com/${stripped}`
    case 'instagram': return `https://instagram.com/${stripped}`
    case 'tiktok':    return `https://www.tiktok.com/@${stripped}`
    case 'telegram':  return `https://t.me/${stripped}`
    case 'facebook':  return v.startsWith('http') ? v : `https://facebook.com/${stripped}`
    case 'youtube':   return v.startsWith('http') ? v : `https://youtube.com/${stripped}`
    case 'website':   return v.startsWith('http') ? v : `https://${v}`
    default:          return v
  }
}

const fmt = (n: number, currency: string) =>
  `${getCurrencySymbolFromFormat(currency)}${formatWithSeparators(n, currency)}`

const CreatorProfile = ({ creator, links, siteUrl, supportWidget, analytics, products = [] }: { creator: CreatorData; links: CreatorLink[]; siteUrl?: string; supportWidget?: SupportWidgetData | null; analytics?: CreatorAnalyticsData | null; products?: CreatorShopProduct[] }) => {
  const { t } = useTranslation('landing')
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const border = theme.palette.divider
  const surface = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'

  // ── Custom theme (Session 60) ──
  // Falls back to the DynoPay Lime when the creator hasn't customized.
  const accent = creator.theme?.accent_color || LIME
  const coverStyle = creator.theme?.cover_style || (creator.cover_image ? 'image' : 'solid')
  const coverGradient = creator.theme?.cover_gradient || 'sunset'
  const limeTint = isDark
    ? `${accent}1A`  // ~10% alpha
    : `${accent}29`  // ~16% alpha

  // Preset gradient stops sourced from the shared creatorTheme module.
  const coverBackground = (() => {
    if (coverStyle === 'image' && creator.cover_image) {
      return `url(${creator.cover_image}) center/cover no-repeat`
    }
    if (coverStyle === 'gradient') {
      const stops = GRADIENT_STOPS[coverGradient]
      if (stops) return `linear-gradient(135deg, ${stops})`
      if (/^#[0-9a-f]{6},#[0-9a-f]{6}$/i.test(coverGradient)) {
        const [a, b] = coverGradient.split(',')
        return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
      }
      return `linear-gradient(135deg, ${accent} 0%, #0A0A0B 100%)`
    }
    if (coverStyle === 'pattern') {
      return `${accent}18 radial-gradient(${accent}44 1px, transparent 1px) 0 0/16px 16px`
    }
    // solid (or fallback) — premium aurora: deep ink base with layered accent glows
    return `radial-gradient(90% 120% at 18% 0%, ${alpha(accent, 0.55)} 0%, transparent 55%), radial-gradient(80% 110% at 85% 12%, rgba(124,58,237,0.5) 0%, transparent 58%), radial-gradient(70% 90% at 55% 100%, rgba(14,165,233,0.25) 0%, transparent 60%), #0A0A14`
  })()
  const hasCustomCover = coverStyle !== 'solid' || creator.theme?.accent_color != null
  // A "rich" hero band exists when the creator has an uploaded cover image or
  // any custom cover treatment; otherwise we render an ambient accent glow.
  const hasCover = !!(creator.cover_image || hasCustomCover)

  const featured = links.find((l) => l.type === 'donation' && !l.closed) || null
  const rest = links.filter((l) => l !== featured)
  const initial = (creator.name || creator.handle || '?').charAt(0).toUpperCase()

  // ── Share sheet ────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  // Portal-mount guard for the mobile sticky Support bar (SSR-safe).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Hide the sticky Support bar while its scroll target (featured campaign /
  // support widget) is already visible — otherwise mobile shows TWO support
  // CTAs at once (the inline "Support me" form + the sticky bar).
  const [supportTargetInView, setSupportTargetInView] = useState(false)
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function')
  }, [])
  const shareUrl = siteUrl
    ? `${siteUrl.replace(/\/+$/, '')}/${creator.handle}`
    : typeof window !== 'undefined'
      ? window.location.href
      : `/${creator.handle}`
  const shareText = `Support ${creator.name} on Dynopay — pay or tip in crypto, no signup needed.`
  const handleCopy = async () => {
    const ok = await copyToClipboard(shareUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }
  const handleNativeShare = async () => {
    try {
      await (navigator as any).share({ title: shareText, text: shareText, url: shareUrl })
    } catch {
      /* user cancelled or unsupported — ignore */
    }
  }
  const SHARE_TARGETS: Array<{ key: string; icon: string; label: string; href: string }> = [
    { key: 'x', icon: 'mdi:twitter', label: 'Share on X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { key: 'whatsapp', icon: 'mdi:whatsapp', label: 'Share on WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
    { key: 'telegram', icon: 'mdi:telegram', label: 'Share on Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
    { key: 'facebook', icon: 'mdi:facebook', label: 'Share on Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
  ]
  const shareBtnSx = (active: boolean) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${active ? accent : border}`,
    backgroundColor: active ? limeTint : surface,
    color: active ? (isDark ? accent : '#0A0A0B') : theme.palette.text.primary,
    cursor: 'pointer',
    transition: 'border-color 160ms ease, transform 160ms ease',
    '&:hover': { borderColor: accent, transform: 'translateY(-1px)' },
  })

  const go = (url: string | null) => {
    if (url && typeof window !== 'undefined') window.location.href = url
  }

  // ── Inline checkout state (Phase 5) ─────────────────────────────
  // When a payment link is clicked in the creator page, we don't navigate
  // away — we expand an inline crypto checkout in place (same pattern as
  // the SupportWidget). The URL stays at the creator page, and cancel
  // returns to the links list.
  const [activeLink, setActiveLink] = useState<CreatorLink | null>(null)
  // Extract the payment ref `d=<xxx>` from an absolute or relative URL. If
  // the URL is unparseable (or doesn't carry a d= param) we fall back to a
  // full-page navigation for that link so we never break the flow.
  const extractPaymentRef = (url: string | null): string | null => {
    if (!url) return null
    try {
      const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      const d = u.searchParams.get('d')
      return d && d.length > 0 ? d : null
    } catch {
      return null
    }
  }
  const handleLinkClick = (l: CreatorLink) => {
    // Donations still route to /pay?d=<parent> (donation campaign page).
    // The inline expansion in the creator page is scoped to REGULAR
    // payment links per user request; donation inline checkout is on the
    // /pay page itself (Phase 4).
    if (l.type === 'donation') {
      go(l.url)
      return
    }
    const ref = extractPaymentRef(l.url)
    if (!ref) {
      go(l.url)
      return
    }
    setActiveLink(l)
    // Scroll to the inline checkout so it's visible on smaller viewports.
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-testid="creator-link-inline-checkout"]')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }
  const closeInlineCheckout = () => setActiveLink(null)

  // Observe the sticky bar's scroll target so the bar auto-hides while the
  // support form / featured campaign is on screen (no duplicate CTAs).
  useEffect(() => {
    if (!mounted || activeLink || typeof document === 'undefined') return
    const sel = featured
      ? '[data-testid="creator-featured"]'
      : '[data-testid="creator-support-section"]'
    const el = document.querySelector(sel)
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setSupportTargetInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [mounted, activeLink, featured, supportWidget?.enabled])

  const renderLinkCard = (l: CreatorLink) => (
    <Box
      key={l.link_id}
      role='button'
      tabIndex={0}
      data-testid={`creator-link-${l.link_id}`}
      onClick={() => handleLinkClick(l)}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleLinkClick(l) }}
      sx={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        p: 1.75,
        borderRadius: '18px',
        border: `1px solid ${border}`,
        backgroundColor: surface,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          borderColor: alpha(accent, 0.6),
          transform: 'translateY(-2px)',
          boxShadow: `0 14px 34px ${isDark ? 'rgba(0,0,0,0.4)' : alpha(accent, 0.14)}`,
          '& .creator-link-arrow': { transform: 'translate(2px, -2px)', color: accent },
        },
      }}
    >
      <Box
        sx={{
          width: 52, height: 52, borderRadius: '12px', flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: limeTint,
        }}
      >
        {l.image ? (
          <Box component='img' src={l.image} alt='' sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon icon={l.type === 'donation' ? 'mdi:heart' : 'mdi:link-variant'} width={22} color={isDark ? accent : '#0A0A0B'} />
        )}
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography fontWeight={700} fontSize={15} color={theme.palette.text.primary} noWrap>
          {l.title}
        </Typography>
        <Typography fontSize={12.5} color={theme.palette.text.secondary} sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {l.type === 'donation'
            ? `${fmt(l.raised_amount, l.currency)} raised${l.goal_amount ? ` · ${l.progress_percent}% of goal` : ''}`
            : l.amount
              ? fmt(l.amount, l.currency)
              : (l.description || 'Payment link')}
        </Typography>
      </Box>
      <Icon className='creator-link-arrow' icon='mdi:arrow-top-right' width={20} color={theme.palette.text.secondary} style={{ transition: 'transform 160ms ease, color 160ms ease' }} />
    </Box>
  )

  return (
    <Box sx={{ position: 'relative', minHeight: '70vh', display: 'flex', justifyContent: 'center', px: { xs: 0, sm: 3 }, pt: { xs: '64px', sm: '88px' }, pb: { xs: '104px', sm: 4 }, overflow: 'hidden' }}>
      {/* Ambient aurora backdrop — quiet, premium depth behind the column */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(46% 34% at 50% 0%, ${alpha(accent, isDark ? 0.22 : 0.10)} 0%, transparent 70%), radial-gradient(38% 30% at 12% 42%, ${alpha('#7C3AED', isDark ? 0.14 : 0.06)} 0%, transparent 70%), radial-gradient(38% 30% at 88% 68%, ${alpha('#0EA5E9', isDark ? 0.11 : 0.05)} 0%, transparent 70%)`,
        }}
      />
      <Box sx={{ width: '100%', maxWidth: 620, position: 'relative', zIndex: 1 }}>
        {/* ── Hero band: rich cover OR bare ambient accent glow ──
            Reserves clearance for the FIXED marketing header via the outer
            container's top padding, so the avatar below is never clipped. */}
        {hasCover ? (
          <Box
            data-testid='creator-cover'
            sx={{
              position: 'relative',
              height: { xs: 180, sm: 224 },
              borderRadius: { xs: 0, sm: '24px' },
              overflow: 'hidden',
              background: coverBackground,
            }}
          >
            {/* Scrim blends the cover bottom into the page background and
                guarantees AA contrast for the avatar/name that overlap it. */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0)} 34%, ${alpha(theme.palette.background.default, 0.55)} 76%, ${theme.palette.background.default} 100%)`,
              }}
            />
          </Box>
        ) : (
          <Box
            data-testid='creator-hero-glow'
            aria-hidden
            sx={{
              height: { xs: 180, sm: 224 },
              background: `radial-gradient(ellipse 78% 82% at 50% 34%, ${alpha(accent, isDark ? 0.3 : 0.22)} 0%, ${alpha(accent, 0)} 70%)`,
            }}
          />
        )}

        {/* ── Identity: avatar + name + handle + bio + socials ──
            Pulled up with a negative margin so the avatar straddles the hero
            band; the outer top padding keeps it clear of the fixed header. */}
        <Box
          data-testid='creator-hero'
          sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            position: 'relative', zIndex: 2, mb: 4, px: { xs: 2, sm: 3 },
            mt: { xs: '-64px', sm: '-80px' },
            animation: 'creatorHeroIn 0.55s cubic-bezier(0.22,1,0.36,1) both',
            '@keyframes creatorHeroIn': {
              from: { opacity: 0, transform: 'translateY(10px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Box
            data-testid='creator-avatar'
            sx={{
              width: { xs: 104, sm: 120 }, height: { xs: 104, sm: 120 },
              borderRadius: '50%',
              p: '3.5px',
              background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 55%, ${alpha('#0EA5E9', 0.85)} 100%)`,
              boxShadow: `0 16px 48px ${alpha(accent, isDark ? 0.4 : 0.28)}`,
              position: 'relative', zIndex: 1,
            }}
          >
            <Box
              sx={{
                width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `3px solid ${theme.palette.background.default}`,
                background: creator.photo
                  ? theme.palette.background.paper
                  : `linear-gradient(135deg, ${accent} 0%, ${darken(accent, 0.28)} 100%)`,
              }}
            >
              {creator.photo ? (
                <Box component='img' src={creator.photo} alt={creator.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: { xs: 42, sm: 48 }, lineHeight: 1, color: '#FFFFFF' }}>
                  {initial}
                </Typography>
              )}
            </Box>
          </Box>
          <Typography data-testid='creator-name' fontWeight={800} fontSize={{ xs: 26, sm: 30 }} letterSpacing='-0.03em' color={theme.palette.text.primary} mt={2} sx={{ fontFamily: 'var(--font-hero), var(--font-sans)' }}>
            {creator.name}
          </Typography>
          <Box
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.75,
              px: 1.25, py: 0.4, borderRadius: '999px',
              border: `1px solid ${alpha(accent, 0.35)}`,
              backgroundColor: alpha(accent, isDark ? 0.12 : 0.07),
            }}
          >
            <Typography sx={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: isDark ? '#A5B4FC' : (readableOn(accent) === '#FFFFFF' ? accent : darken(accent, 0.35)) }}>
              @{creator.handle}
            </Typography>
          </Box>
          {creator.bio && (
            <Typography fontSize={15} lineHeight={1.6} color={theme.palette.text.secondary} mt={2} sx={{ maxWidth: 460 }}>
              {creator.bio}
            </Typography>
          )}

          {/* ── Social links row (optional) ── */}
          {creator.social_links && Object.keys(creator.social_links).filter((k) => (creator.social_links as Record<string,string>)[k]).length > 0 && (
            <Box data-testid='creator-socials-block' sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1 }}>
                {t('creator.socials.label', { defaultValue: `Find ${creator.name} on` })}
              </Typography>
              <Box
                data-testid='creator-socials'
                sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', justifyContent: 'center' }}
              >
              {Object.entries(creator.social_links).map(([platform, url]) => {
                if (!url) return null
                return (
                  <Box
                    key={platform}
                    component='a'
                    href={socialHref(platform, url)}
                    target='_blank'
                    rel='noopener noreferrer'
                    data-testid={`creator-social-${platform}`}
                    sx={{
                      width: 42, height: 42, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${border}`,
                      backgroundColor: surface,
                      color: theme.palette.text.primary,
                      transition: 'border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease',
                      textDecoration: 'none',
                      '&:hover': { borderColor: accent, transform: 'translateY(-2px)', backgroundColor: alpha(accent, 0.06) },
                    }}
                    aria-label={platform}
                  >
                    <Icon icon={SOCIAL_ICONS[platform] || 'mdi:link-variant'} width={18} />
                  </Box>
                )
              })}
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ px: { xs: 2, sm: 3 } }}>
        {/* ── Share sheet ── */}
        <Box data-testid='creator-share' sx={{ mb: 3 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1, textAlign: 'center' }}>
            {copied ? 'Link copied!' : 'Share this page'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Box
              role='button'
              tabIndex={0}
              data-testid='creator-share-copy'
              aria-label={copied ? 'Link copied' : 'Copy link'}
              onClick={handleCopy}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopy() } }}
              sx={shareBtnSx(copied)}
            >
              <Icon icon={copied ? 'mdi:check' : 'mdi:link-variant'} width={18} />
            </Box>
            {canNativeShare && (
              <Box
                role='button'
                tabIndex={0}
                data-testid='creator-share-native'
                aria-label='Share'
                onClick={handleNativeShare}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNativeShare() } }}
                sx={shareBtnSx(false)}
              >
                <Icon icon='mdi:share-variant' width={18} />
              </Box>
            )}
            {SHARE_TARGETS.map((s) => (
              <Box
                key={s.key}
                component='a'
                href={s.href}
                target='_blank'
                rel='noopener noreferrer'
                data-testid={`creator-share-${s.key}`}
                aria-label={s.label}
                sx={{ ...shareBtnSx(false), textDecoration: 'none' }}
              >
                <Icon icon={s.icon} width={18} />
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Support Widget (always-on tip / coffee / support) ── */}
        {supportWidget?.enabled && !activeLink && (
          <Box data-testid='creator-support-section' sx={{ mb: 3 }}>
            <SupportWidget handle={creator.handle} creatorName={creator.name} widget={supportWidget} siteUrl={siteUrl ? `${siteUrl.replace(/\/+$/, '')}/${creator.handle}` : undefined} />
            {/* Compact 30-day momentum widget — shown when the creator's
                public_analytics_enabled toggle is on AND we have data.
                Session 2026-08-05. */}
            {creator.public_analytics_enabled !== false && analytics && (
              <AnalyticsWidget
                variant="compact"
                data={analytics}
                accentColor={accent === LIME ? null : accent}
              />
            )}
          </Box>
        )}

        {/* ── Featured donation / tip box ── */}
        {featured && !activeLink && (
          <Box
            data-testid='creator-featured'
            sx={{
              position: 'relative', overflow: 'hidden',
              borderRadius: '24px', border: `1px solid ${border}`, p: { xs: 2.5, sm: 3 }, mb: 3,
              background: isDark
                ? 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,255,0.85) 100%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: isDark
                ? '0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 24px 70px rgba(67,56,202,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
            }}
          >
            <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1 }}>
              Support {creator.name.split(' ')[0]}
            </Typography>
            <Typography fontWeight={800} fontSize={20} color={theme.palette.text.primary} lineHeight={1.25} sx={{ fontFamily: 'var(--font-hero), var(--font-sans)', letterSpacing: '-0.02em' }}>
              {featured.title}
            </Typography>
            {featured.description && (
              <Typography fontSize={13.5} color={theme.palette.text.secondary} mt={0.75} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {featured.description}
              </Typography>
            )}
            <Box display='flex' alignItems='baseline' gap={1} mt={2}>
              <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 24, color: theme.palette.text.primary }}>
                {fmt(featured.raised_amount, featured.currency)}
              </Typography>
              {featured.goal_amount ? (
                <Typography fontSize={13} color={theme.palette.text.secondary}>
                  raised of {fmt(featured.goal_amount, featured.currency)}
                </Typography>
              ) : (
                <Typography fontSize={13} color={theme.palette.text.secondary}>raised</Typography>
              )}
            </Box>
            {featured.goal_amount && featured.progress_percent != null && (
              <Box sx={{ position: 'relative', mt: 1.25 }}>
                <Box sx={{ height: 10, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${Math.min(100, featured.progress_percent)}%`,
                      height: '100%', borderRadius: 999,
                      background: `linear-gradient(90deg, ${accent} 0%, #7C3AED 100%)`,
                      boxShadow: `0 0 12px ${alpha(accent, 0.55)}`,
                      transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)',
                    }}
                  />
                </Box>
              </Box>
            )}
            <Typography fontSize={12} color={theme.palette.text.secondary} mt={1}>
              {featured.supporters_count} {featured.supporters_count === 1 ? 'supporter' : 'supporters'}
            </Typography>
            <Button
              fullWidth
              disableElevation
              variant='contained'
              data-testid='creator-support-btn'
              onClick={() => go(featured.url)}
              sx={{
                mt: 2, py: 1.5, borderRadius: '14px', textTransform: 'none',
                fontWeight: 800, fontSize: 15.5, letterSpacing: '-0.01em',
                background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 100%)`, color: readableOn(accent),
                boxShadow: `0 12px 30px ${alpha(accent, 0.35)}`,
                transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
                '&:hover': { background: `linear-gradient(135deg, ${accent} 0%, #7C3AED 100%)`, filter: 'brightness(1.07)', transform: 'translateY(-1px)', boxShadow: `0 16px 38px ${alpha(accent, 0.45)}` },
              }}
            >
              {t('creator.card.supportCampaign')}
            </Button>
          </Box>
        )}

        {/* ── Shop (live products, inline so one shared link covers everything) ── */}
        {!activeLink && (
          <CreatorShopSection handle={creator.handle} products={products} accent={accent} />
        )}

        {/* ── Links ── */}
        {rest.length > 0 && !activeLink && (
          <Box display='flex' flexDirection='column' gap={1.5} data-testid='creator-links'>
            {rest.map((l) => renderLinkCard(l))}
          </Box>
        )}

        {/* ── Inline payment checkout (Phase 5) ── */}
        {activeLink && (() => {
          const ref = extractPaymentRef(activeLink.url)
          if (!ref) return null
          return (
            <Box
              data-testid='creator-link-inline-checkout'
              sx={{
                borderRadius: '20px',
                border: `1px solid ${border}`,
                backgroundColor: theme.palette.background.paper,
                p: { xs: 2, sm: 2.5 },
              }}
            >
              {/* Header row: link title + close */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                <Box
                  sx={{
                    width: 42, height: 42, borderRadius: '10px', flexShrink: 0, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: limeTint,
                  }}
                >
                  {activeLink.image ? (
                    <Box component='img' src={activeLink.image} alt='' sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon icon='mdi:link-variant' width={20} color={isDark ? accent : '#0A0A0B'} />
                  )}
                </Box>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={700} fontSize={15} color={theme.palette.text.primary} noWrap>
                    {activeLink.title}
                  </Typography>
                  <Typography fontSize={12} color={theme.palette.text.secondary} noWrap>
                    {activeLink.amount ? fmt(activeLink.amount, activeLink.currency) : (activeLink.description || 'Payment link')}
                  </Typography>
                </Box>
                <Box
                  component='button'
                  data-testid='creator-link-inline-close'
                  onClick={closeInlineCheckout}
                  aria-label='Close inline checkout'
                  sx={{
                    width: 34, height: 34, borderRadius: '50%',
                    border: `1px solid ${border}`, backgroundColor: surface,
                    color: theme.palette.text.secondary, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    '&:hover': { borderColor: accent, color: theme.palette.text.primary },
                  }}
                >
                  <Icon icon='mdi:close' width={16} />
                </Box>
              </Box>

              <InlineTipCheckout
                d={ref}
                handle={creator.handle}
                creatorName={creator.name}
                style='support'
                siteUrl={shareUrl}
                mode='link'
                targetLabel={activeLink.title}
                onCancel={closeInlineCheckout}
                onNewTip={closeInlineCheckout}
              />
            </Box>
          )
        })()}

        {/* ── Empty state ── */}
        {links.length === 0 && !supportWidget?.enabled && products.length === 0 && (
          <Box
            data-testid='creator-empty'
            sx={{ textAlign: 'center', py: 5, px: 3, borderRadius: '18px', border: `1px dashed ${border}`, backgroundColor: surface }}
          >
            <Icon icon='mdi:sparkles-outline' width={30} color={theme.palette.text.secondary} />
            <Typography fontSize={15} fontWeight={600} color={theme.palette.text.primary} mt={1}>
              {t("creator.card.emptyTitle")}
            </Typography>
            <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.5} mb={2}>
              {creator.name.split(' ')[0]} hasn&apos;t added any ways to pay yet — check back soon to show your support.
            </Typography>
            {/* F10: give visitors a fallback action so this isn't a dead end */}
            <Button
              data-testid="creator-explore-cta"
              disableElevation
              variant='outlined'
              onClick={() => { if (typeof window !== 'undefined') window.location.href = '/' }}
              sx={{
                mt: 1, px: 3, py: 1.1, borderRadius: '10px', textTransform: 'none',
                fontWeight: 700, fontSize: 13.5, borderColor: accent, color: theme.palette.text.primary,
                '&:hover': { borderColor: accent, backgroundColor: limeTint },
              }}
            >
              {t("creator.card.exploreLink")}
            </Button>
          </Box>
        )}

        {/* ── Powered by ── */}
        <Box display='flex' alignItems='center' justifyContent='center' gap={0.75} mt={5} sx={{ opacity: 0.7 }}>
          <Typography fontSize={12} color={theme.palette.text.secondary}>Powered by</Typography>
          <Logo width={15} height={18} />
          <Typography fontSize={12} fontWeight={700} color={theme.palette.text.primary}>Dynopay</Typography>
        </Box>
        </Box>
      </Box>

      {/* ── Mobile sticky Support bar (app-like) — portal to body, pinned to
          the viewport. Scrolls to the featured campaign / support widget.
          Wrapped in a Fragment because a raw portal object fails MUI's
          `children: PropTypes.node` check on the parent Box (dev warning). ── */}
      {mounted && !activeLink && !supportTargetInView && (featured || supportWidget?.enabled) && (
        <>
          {createPortal(
        <Box
          data-testid='creator-sticky-cta'
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
            data-testid='creator-sticky-support-btn'
            onClick={() => {
              const sel = featured
                ? '[data-testid="creator-featured"]'
                : '[data-testid="creator-support-section"]'
              const el = typeof document !== 'undefined' ? document.querySelector(sel) : null
              if (el) {
                // scrollIntoView({behavior:'smooth'}) can silently no-op when
                // invoked from a position:fixed portal on mobile — compute the
                // centered offset and drive window.scrollTo directly instead.
                const rect = el.getBoundingClientRect()
                const top = Math.max(
                  0,
                  window.scrollY + rect.top - Math.max(0, (window.innerHeight - rect.height) / 2),
                )
                window.scrollTo({ top, behavior: 'smooth' })
              } else if (featured) {
                go(featured.url)
              }
            }}
            sx={{
              minHeight: 52,
              borderRadius: '999px',
              textTransform: 'none',
              fontSize: 16,
              fontWeight: 800,
              backgroundColor: accent,
              color: INK,
              // Long creator names ("The Dev Store", brands…) must never wrap
              // or get cut mid-word — ellipsize inside the pill instead.
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
              '&:hover': { backgroundColor: accent, filter: 'brightness(1.05)' },
              '&:active': { transform: 'scale(0.99)' },
            }}
          >
            {t('creator.sticky.supportName', { name: creator.name, defaultValue: 'Support {{name}}' })}
          </Button>
        </Box>,
        document.body,
          )}
        </>
      )}
    </Box>
  )
}

export default CreatorProfile
