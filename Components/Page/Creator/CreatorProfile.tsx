import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { lazyLoading } from "@/Components/UI/DynamicFallback";
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { Box, Button, Typography, useTheme } from '@mui/material'
import { alpha, darken } from '@mui/material/styles'
import { Icon } from '@iconify/react'
import Logo from '@/assets/Icons/Logo'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
import copyToClipboard from '@/helpers/copyToClipboard'
import { BRAND_ACCENT } from '@/constants/theme'
import { GRADIENT_STOPS, GRAIN_URL, RISE_KEYFRAMES, readableOn, rise } from '@/constants/creatorTheme'
import SupportWidget, { SupportWidgetData } from './SupportWidget'
import InlineTipCheckout from './InlineTipCheckout'
import PublicVerifiedBadge from '@/Components/UI/PublicVerifiedBadge'
import MerchantTrustRow from '@/Components/UI/MerchantTrustRow'
import type { CreatorAnalyticsData } from './AnalyticsWidget'
import CreatorShopSection, { CreatorShopProduct } from './CreatorShopSection'
import useStickyCtaFootprint from '@/hooks/useStickyCtaFootprint'

// Lazy-load the analytics chart (recharts is heavy) so it stays out of the
// public creator page's initial JS bundle. Client-only: it's below-the-fold
// and only renders when analytics data is present.
const AnalyticsWidget = dynamic(() => import('./AnalyticsWidget'), { ssr: false, loading: lazyLoading(null, { silent: true }) })

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace'
const HERO = 'var(--font-hero), var(--font-sans)'
const LIME = BRAND_ACCENT
// Editorial two-column layout kicks in from 1024px (sticky identity rail + action stack).
const WIDE = '@media (min-width: 1024px)'

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
  const surface = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)'
  const canvas = theme.palette.background.default

  // ── Custom theme (Session 60) ──
  // Falls back to the Dynopay gold when the creator hasn't customized.
  const accent = creator.theme?.accent_color || LIME
  const coverStyle = creator.theme?.cover_style || (creator.cover_image ? 'image' : 'solid')
  const coverGradient = creator.theme?.cover_gradient || 'sunset'
  const limeTint = alpha(accent, isDark ? 0.14 : 0.16)
  // Accent as TEXT must stay readable on the page surface: very light accents
  // (lime, electric) are darkened on light mode; on dark mode they can glow.
  const accentText = isDark ? accent : (readableOn(accent) === '#FFFFFF' ? accent : darken(accent, 0.38))

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
  // Round glass buttons — socials, share targets, header share.
  const roundBtnSx = (active: boolean, size = 44) => ({
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${active ? accent : border}`,
    backgroundColor: active ? limeTint : surface,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: active ? accentText : theme.palette.text.primary,
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'border-color 160ms ease, transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
    '&:hover': { borderColor: accent, transform: 'translateY(-2px)', backgroundColor: alpha(accent, 0.08), boxShadow: `0 10px 24px ${alpha(accent, isDark ? 0.22 : 0.16)}` },
    '&:active': { transform: 'translateY(0) scale(0.97)' },
    '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
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
  useStickyCtaFootprint(mounted && !activeLink && !supportTargetInView && !!(featured || supportWidget?.enabled))
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

  // Shared glass card treatment for the action stack.
  const glassCard = {
    position: 'relative' as const,
    overflow: 'hidden',
    borderRadius: '24px',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,18,20,0.06)'}`,
    background: isDark
      ? 'linear-gradient(180deg, rgba(24,24,31,0.86) 0%, rgba(18,18,22,0.82) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.84) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: isDark
      ? '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
      : '0 20px 50px rgba(139,94,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
  }

  const sectionLabelSx = {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
  }

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
        gap: 2,
        p: 2,
        minHeight: 76,
        borderRadius: '20px',
        border: `1px solid ${border}`,
        backgroundColor: surface,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        transition: 'border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          borderColor: alpha(accent, 0.6),
          transform: 'translateY(-2px)',
          boxShadow: `0 14px 34px ${isDark ? 'rgba(0,0,0,0.4)' : alpha(accent, 0.14)}`,
          '& .creator-link-arrow': { transform: 'translate(2px, -2px)', color: accentText },
        },
        '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          width: 56, height: 56, borderRadius: '16px', flexShrink: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${alpha(accent, 0.28)} 0%, ${alpha(accent, 0.08)} 100%)`,
        }}
      >
        {l.image ? (
          <Box component='img' src={l.image} alt='' sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon icon={l.type === 'donation' ? 'mdi:heart' : 'mdi:link-variant'} width={22} color={accentText} />
        )}
      </Box>
      <Box flex={1} minWidth={0}>
        <Typography fontWeight={700} fontSize={15.5} color={theme.palette.text.primary} noWrap sx={{ letterSpacing: '-0.01em' }}>
          {l.title}
        </Typography>
        <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.25} sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: l.amount ? MONO : undefined }}>
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

  const socialEntries = Object.entries(creator.social_links || {}).filter(([, url]) => !!url)

  return (
    <Box sx={{ position: 'relative', minHeight: '70vh', pt: { xs: '64px', md: '84px' }, pb: { xs: '112px', sm: 8 }, overflow: 'hidden', ...RISE_KEYFRAMES }}>
      {/* Ambient aurora backdrop — the merchant accent bleeds softly into the canvas */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `radial-gradient(60% 40% at 50% 0%, ${alpha(accent, isDark ? 0.26 : 0.14)} 0%, transparent 70%), radial-gradient(38% 30% at 8% 46%, ${alpha('#FFB300', isDark ? 0.12 : 0.06)} 0%, transparent 70%), radial-gradient(38% 30% at 92% 70%, ${alpha('#0EA5E9', isDark ? 0.10 : 0.05)} 0%, transparent 70%)`,
        }}
      />

      <Box sx={{ width: '100%', maxWidth: 1180, mx: 'auto', position: 'relative', zIndex: 1, px: { xs: 0, sm: 3 } }}>
        {/* ── Cover band: rich cover OR bare ambient accent glow ── */}
        {hasCover ? (
          <Box
            data-testid='creator-cover'
            sx={{
              position: 'relative',
              height: { xs: 188, sm: 236, md: 264 },
              [WIDE]: { height: 300 },
              borderRadius: { xs: 0, sm: '28px' },
              overflow: 'hidden',
              background: coverBackground,
              boxShadow: isDark ? '0 30px 80px rgba(0,0,0,0.55)' : `0 30px 80px ${alpha(accent, 0.18)}`,
              ...rise(0),
            }}
          >
            {/* Film grain keeps flat gradients from banding and adds tactility */}
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, backgroundImage: GRAIN_URL, opacity: 0.09, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
            {/* Scrim blends the cover bottom into the page background and
                guarantees AA contrast for the avatar/name that overlap it. */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(to bottom, ${alpha(canvas, 0)} 40%, ${alpha(canvas, 0.55)} 82%, ${canvas} 100%)`,
              }}
            />
          </Box>
        ) : (
          <Box
            data-testid='creator-hero-glow'
            aria-hidden
            sx={{
              height: { xs: 188, sm: 236, md: 264 },
              [WIDE]: { height: 300 },
              background: `radial-gradient(ellipse 70% 78% at 50% 40%, ${alpha(accent, isDark ? 0.34 : 0.24)} 0%, ${alpha(accent, 0)} 72%)`,
            }}
          />
        )}

        {/* ── Editorial grid: sticky identity rail (left) + action stack (right) on ≥1024px ── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            px: { xs: 2, sm: 1 },
            [WIDE]: { gridTemplateColumns: '400px minmax(0, 1fr)', columnGap: 7, alignItems: 'start', px: 1 },
          }}
        >
          {/* Rail wrapper: `display: contents` on small screens lets its children
              order themselves around the content column; on wide screens it
              becomes the sticky left rail. */}
          <Box sx={{ display: 'contents', [WIDE]: { display: 'flex', flexDirection: 'column', position: 'sticky', top: 96, alignSelf: 'start' } }}>
            {/* Identity block — straddles the cover via negative margin */}
            <Box
              data-testid='creator-hero'
              sx={{
                order: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                position: 'relative', zIndex: 2,
                mt: { xs: '-60px', sm: '-68px' },
                [WIDE]: { alignItems: 'flex-start', textAlign: 'left', mt: '-72px' },
                ...rise(60),
              }}
            >
              <Box
                data-testid='creator-avatar'
                sx={{
                  width: { xs: 112, sm: 124 }, height: { xs: 112, sm: 124 },
                  [WIDE]: { width: 136, height: 136 },
                  borderRadius: '50%',
                  p: '4px',
                  background: `conic-gradient(from 210deg, ${accent} 0%, #FFB300 42%, ${alpha('#0EA5E9', 0.9)} 70%, ${accent} 100%)`,
                  boxShadow: `0 18px 50px ${alpha(accent, isDark ? 0.42 : 0.3)}`,
                  position: 'relative', zIndex: 1,
                }}
              >
                <Box
                  sx={{
                    width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `4px solid ${canvas}`,
                    background: creator.photo
                      ? theme.palette.background.paper
                      : `linear-gradient(135deg, ${accent} 0%, ${darken(accent, 0.28)} 100%)`,
                  }}
                >
                  {creator.photo ? (
                    <Box component='img' src={creator.photo} alt={creator.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography sx={{ fontFamily: HERO, fontWeight: 800, fontSize: { xs: 44, sm: 52 }, lineHeight: 1, color: readableOn(accent) }}>
                      {initial}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2.25, flexWrap: 'wrap', [WIDE]: { justifyContent: 'flex-start' } }}>
                <Typography component='h1' data-testid='creator-name' fontWeight={800} fontSize={{ xs: 26, sm: 30 }} letterSpacing='-0.03em' lineHeight={1.1} color={theme.palette.text.primary} sx={{ fontFamily: HERO, [WIDE]: { fontSize: 34 }, overflowWrap: 'anywhere' }}>
                  {creator.name}
                </Typography>
                <PublicVerifiedBadge handle={creator.handle} size={22} ml={0} />
                <Box
                  role='button'
                  tabIndex={0}
                  data-testid='creator-share-header'
                  aria-label={copied ? t('creator.share.copied', { defaultValue: 'Link copied!' }) : t('creator.shareLabel', { defaultValue: 'Share' })}
                  title={t('creator.shareLabel', { defaultValue: 'Share' })}
                  onClick={() => (canNativeShare ? handleNativeShare() : handleCopy())}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); canNativeShare ? handleNativeShare() : handleCopy() } }}
                  sx={{ ...roundBtnSx(copied, 36), color: copied ? accentText : theme.palette.text.secondary }}
                >
                  <Icon icon={copied ? 'mdi:check' : 'mdi:share-variant-outline'} width={16} />
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1,
                  px: 1.4, py: 0.5, borderRadius: '999px',
                  border: `1px solid ${alpha(accent, 0.38)}`,
                  backgroundColor: alpha(accent, isDark ? 0.12 : 0.08),
                }}
              >
                <Typography sx={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: accentText }}>
                  @{creator.handle}
                </Typography>
              </Box>

              {creator.bio && (
                <Typography fontSize={15.5} lineHeight={1.65} color={theme.palette.text.secondary} mt={2} sx={{ maxWidth: 480, whiteSpace: 'pre-line' }}>
                  {creator.bio}
                </Typography>
              )}

              {/* ── Social links row (optional) ── */}
              {socialEntries.length > 0 && (
                <Box data-testid='creator-socials-block' sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', [WIDE]: { alignItems: 'flex-start' } }}>
                  <Typography sx={{ ...sectionLabelSx, mb: 1.25 }}>
                    {t('creator.socials.label', { name: creator.name, defaultValue: `Find ${creator.name} on` })}
                  </Typography>
                  <Box data-testid='creator-socials' sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', justifyContent: 'center', [WIDE]: { justifyContent: 'flex-start' } }}>
                    {socialEntries.map(([platform, url]) => (
                      <Box
                        key={platform}
                        component='a'
                        href={socialHref(platform, url)}
                        target='_blank'
                        rel='noopener noreferrer'
                        data-testid={`creator-social-${platform}`}
                        aria-label={platform}
                        sx={roundBtnSx(false, 44)}
                      >
                        <Icon icon={SOCIAL_ICONS[platform] || 'mdi:link-variant'} width={19} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            {/* Meta block: share sheet + trust + powered-by. Last on mobile
                (after the content worth sharing), under the identity on wide. */}
            <Box
              data-testid='creator-meta'
              sx={{
                order: 2, mt: 6, pt: 3, borderTop: `1px solid ${border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                [WIDE]: { order: 0, mt: 4, alignItems: 'flex-start' },
              }}
            >
              <Box data-testid='creator-share' sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', [WIDE]: { alignItems: 'flex-start' } }}>
                <Typography sx={{ ...sectionLabelSx, mb: 1.25, textAlign: 'center', [WIDE]: { textAlign: 'left' } }}>
                  {copied ? t('creator.share.copied', { defaultValue: 'Link copied!' }) : t('creator.share.pageOf', { name: creator.name, defaultValue: `Share ${creator.name}'s page` })}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center', [WIDE]: { justifyContent: 'flex-start' } }}>
                  <Box
                    role='button'
                    tabIndex={0}
                    data-testid='creator-share-copy'
                    aria-label={copied ? t('creator.share.copied', { defaultValue: 'Link copied!' }) : t('creator.share.copyLink', { defaultValue: 'Copy link' })}
                    onClick={handleCopy}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopy() } }}
                    sx={roundBtnSx(copied)}
                  >
                    <Icon icon={copied ? 'mdi:check' : 'mdi:link-variant'} width={18} />
                  </Box>
                  {canNativeShare && (
                    <Box
                      role='button'
                      tabIndex={0}
                      data-testid='creator-share-native'
                      aria-label={t('creator.shareLabel', { defaultValue: 'Share' })}
                      onClick={handleNativeShare}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNativeShare() } }}
                      sx={roundBtnSx(false)}
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
                      sx={roundBtnSx(false)}
                    >
                      <Icon icon={s.icon} width={18} />
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Trust row — "Payments secured by Dynopay". */}
              <MerchantTrustRow handle={creator.handle} justify='flex-start' sx={{ mt: 3, color: theme.palette.text.secondary }} />

              {/* ── Powered by + non-custodial note ── */}
              <Box display='flex' alignItems='center' gap={0.75} mt={1.5} sx={{ opacity: 0.8 }}>
                <Typography fontSize={12} color={theme.palette.text.secondary}>{t('creator.poweredBy', { defaultValue: 'Powered by' })}</Typography>
                <Logo width={15} height={18} />
                <Typography fontSize={12} fontWeight={700} color={theme.palette.text.primary}>Dynopay</Typography>
              </Box>
              <Typography fontSize={11.5} color={theme.palette.text.secondary} mt={0.75} data-testid='creator-noncustodial-note' sx={{ opacity: 0.85, textAlign: 'center', [WIDE]: { textAlign: 'left' } }}>
                {t('creator.nonCustodial', { name: creator.name, defaultValue: 'Paid straight to {{name}} — Dynopay never holds your funds.' })}
              </Typography>
            </Box>
          </Box>

          {/* ── Action stack ── */}
          <Box
            data-testid='creator-content'
            sx={{
              order: 1, mt: 4, display: 'flex', flexDirection: 'column', gap: 3,
              [WIDE]: { order: 0, mt: 0, pt: 4, gap: 3.5 },
            }}
          >
            {/* ── Support Widget (always-on tip / coffee / support) ── */}
            {supportWidget?.enabled && !activeLink && (
              <Box data-testid='creator-support-section' sx={rise(140)}>
                <SupportWidget handle={creator.handle} creatorName={creator.name} widget={supportWidget} accentColor={accent} siteUrl={siteUrl ? `${siteUrl.replace(/\/+$/, '')}/${creator.handle}` : undefined} />
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
              <Box data-testid='creator-featured' sx={{ ...glassCard, p: { xs: 2.5, sm: 3.5 }, ...rise(200) }}>
                <Box aria-hidden sx={{ position: 'absolute', top: -140, right: -80, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(accent, isDark ? 0.22 : 0.16)} 0%, transparent 70%)`, pointerEvents: 'none' }} />
                <Typography sx={{ ...sectionLabelSx, mb: 1 }}>
                  {t('creator.featured.supportName', { name: creator.name.split(' ')[0], defaultValue: `Support ${creator.name.split(' ')[0]}` })}
                </Typography>
                <Typography fontWeight={800} fontSize={{ xs: 20, sm: 22 }} color={theme.palette.text.primary} lineHeight={1.2} sx={{ fontFamily: HERO, letterSpacing: '-0.02em' }}>
                  {featured.title}
                </Typography>
                {featured.description && (
                  <Typography fontSize={14} color={theme.palette.text.secondary} mt={1} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {featured.description}
                  </Typography>
                )}
                <Box display='flex' alignItems='baseline' gap={1} mt={2.5}>
                  <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', color: theme.palette.text.primary }}>
                    {fmt(featured.raised_amount, featured.currency)}
                  </Typography>
                  {featured.goal_amount ? (
                    <Typography fontSize={13} color={theme.palette.text.secondary}>
                      {t('creator.featured.raisedOf', { goal: fmt(featured.goal_amount, featured.currency), defaultValue: `raised of ${fmt(featured.goal_amount, featured.currency)}` })}
                    </Typography>
                  ) : (
                    <Typography fontSize={13} color={theme.palette.text.secondary}>{t('creator.raised', { defaultValue: 'raised' })}</Typography>
                  )}
                </Box>
                {featured.goal_amount && featured.progress_percent != null && (
                  <Box sx={{ position: 'relative', mt: 1.5 }}>
                    <Box sx={{ height: 10, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                      <Box
                        sx={{
                          width: `${Math.min(100, featured.progress_percent)}%`,
                          height: '100%', borderRadius: 999,
                          background: `linear-gradient(90deg, ${accent} 0%, #FFB300 100%)`,
                          boxShadow: `0 0 12px ${alpha(accent, 0.55)}`,
                          transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)',
                        }}
                      />
                    </Box>
                  </Box>
                )}
                <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={1}>
                  {t(featured.supporters_count === 1 ? 'creator.supportersOne' : 'creator.supportersOther', { count: featured.supporters_count, defaultValue: `${featured.supporters_count} ${featured.supporters_count === 1 ? 'supporter' : 'supporters'}` })}
                </Typography>
                <Button
                  fullWidth
                  disableElevation
                  variant='contained'
                  data-testid='creator-support-btn'
                  onClick={() => go(featured.url)}
                  sx={supportWidget?.enabled
                    // One primary gradient per page — when the tip widget is the
                    // primary CTA, the campaign card takes the quieter outlined style.
                    ? {
                        mt: 2.5, minHeight: 52, borderRadius: '16px', textTransform: 'none',
                        fontWeight: 800, fontSize: 15.5, letterSpacing: '-0.01em',
                        background: 'transparent', color: theme.palette.text.primary, border: `1.5px solid ${alpha(accent, 0.6)}`,
                        boxShadow: 'none',
                        transition: 'background-color 140ms ease, border-color 140ms ease',
                        '&:hover': { background: alpha(accent, 0.08), borderColor: accent },
                      }
                    : {
                        mt: 2.5, minHeight: 52, borderRadius: '16px', textTransform: 'none',
                        fontWeight: 800, fontSize: 15.5, letterSpacing: '-0.01em',
                        background: `linear-gradient(135deg, ${accent} 0%, #FFB300 100%)`, color: readableOn(accent),
                        boxShadow: `0 12px 30px ${alpha(accent, 0.35)}`,
                        transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
                        '&:hover': { background: `linear-gradient(135deg, ${accent} 0%, #FFB300 100%)`, filter: 'brightness(1.07)', transform: 'translateY(-1px)', boxShadow: `0 16px 38px ${alpha(accent, 0.45)}` },
                      }}
                >
                  {t('creator.card.supportCampaign')}
                </Button>
              </Box>
            )}

            {/* ── Shop (live products, inline so one shared link covers everything) ── */}
            {!activeLink && (
              <Box sx={rise(260)}>
                <CreatorShopSection handle={creator.handle} products={products} accent={accent} />
              </Box>
            )}

            {/* ── Links ── */}
            {rest.length > 0 && !activeLink && (
              <Box data-testid='creator-links' sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, ...rise(320) }}>
                <Typography sx={sectionLabelSx}>
                  {t('creator.links.label', { defaultValue: 'Pay' })}
                </Typography>
                {rest.map((l) => renderLinkCard(l))}
              </Box>
            )}

            {/* ── Inline payment checkout (Phase 5) ── */}
            {activeLink && (() => {
              const ref = extractPaymentRef(activeLink.url)
              if (!ref) return null
              return (
                <Box data-testid='creator-link-inline-checkout' sx={{ ...glassCard, p: { xs: 2, sm: 3 } }}>
                  {/* Header row: link title + close */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box
                      sx={{
                        width: 46, height: 46, borderRadius: '14px', flexShrink: 0, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `linear-gradient(135deg, ${alpha(accent, 0.28)} 0%, ${alpha(accent, 0.08)} 100%)`,
                      }}
                    >
                      {activeLink.image ? (
                        <Box component='img' src={activeLink.image} alt='' sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Icon icon='mdi:link-variant' width={20} color={accentText} />
                      )}
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Typography fontWeight={700} fontSize={15.5} color={theme.palette.text.primary} noWrap>
                        {activeLink.title}
                      </Typography>
                      <Typography fontSize={12.5} color={theme.palette.text.secondary} noWrap sx={{ fontFamily: activeLink.amount ? MONO : undefined }}>
                        {activeLink.amount ? fmt(activeLink.amount, activeLink.currency) : (activeLink.description || 'Payment link')}
                      </Typography>
                    </Box>
                    <Box
                      component='button'
                      data-testid='creator-link-inline-close'
                      onClick={closeInlineCheckout}
                      aria-label='Close inline checkout'
                      sx={{ ...roundBtnSx(false, 40), color: theme.palette.text.secondary, p: 0 }}
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
                    accentColor={accent}
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
                sx={{ textAlign: 'center', py: 6, px: 3, borderRadius: '24px', border: `1px dashed ${alpha(accent, 0.45)}`, backgroundColor: surface, ...rise(140) }}
              >
                <Box sx={{ width: 56, height: 56, borderRadius: '18px', mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${alpha(accent, 0.3)} 0%, ${alpha(accent, 0.08)} 100%)` }}>
                  <Icon icon='mdi:sparkles-outline' width={28} color={accentText} />
                </Box>
                <Typography fontSize={17} fontWeight={800} color={theme.palette.text.primary} mt={2} sx={{ fontFamily: HERO, letterSpacing: '-0.02em' }}>
                  {t("creator.card.emptyTitle")}
                </Typography>
                <Typography fontSize={13.5} color={theme.palette.text.secondary} mt={0.75} mb={2.5} sx={{ maxWidth: 380, mx: 'auto' }}>
                  {creator.name.split(' ')[0]} hasn&apos;t added any ways to pay yet — check back soon to show your support.
                </Typography>
                <Button
                  data-testid="creator-explore-cta"
                  disableElevation
                  variant='outlined'
                  onClick={() => { if (typeof window !== 'undefined') window.location.href = '/' }}
                  sx={{
                    px: 3, minHeight: 44, borderRadius: '999px', textTransform: 'none',
                    fontWeight: 700, fontSize: 13.5, borderColor: accent, color: theme.palette.text.primary,
                    '&:hover': { borderColor: accent, backgroundColor: limeTint },
                  }}
                >
                  {t("creator.card.exploreLink")}
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Mobile sticky Support bar (app-like) — portal to body, pinned to
          the viewport. Scrolls to the featured campaign / support widget. ── */}
      {mounted && !activeLink && !supportTargetInView && (featured || supportWidget?.enabled) && (
        <>
          {createPortal(
        <Box
          data-testid='creator-sticky-cta'
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'var(--dp-lang-bar, 0px)',
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
              minHeight: 54,
              borderRadius: '999px',
              textTransform: 'none',
              fontSize: 16,
              fontWeight: 800,
              backgroundColor: accent,
              color: readableOn(accent),
              boxShadow: `0 10px 28px ${alpha(accent, 0.35)}`,
              // Long creator names ("The Dev Store", brands…) must never wrap
              // or get cut mid-word — ellipsize inside the pill instead.
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
              transition: 'filter 140ms ease, transform 140ms ease',
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
