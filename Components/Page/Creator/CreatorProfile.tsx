import React from 'react'
import { Box, Button, LinearProgress, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import Logo from '@/assets/Icons/Logo'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'
const LIME = '#CCFF00'
const INK = '#0A0A0B'

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
}

const SOCIAL_ICONS: Record<string, string> = {
  twitter: 'mdi:twitter',
  instagram: 'mdi:instagram',
  youtube: 'mdi:youtube',
  tiktok: 'mdi:music-note',
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
    case 'youtube':   return v.startsWith('http') ? v : `https://youtube.com/${stripped}`
    case 'website':   return v.startsWith('http') ? v : `https://${v}`
    default:          return v
  }
}

const fmt = (n: number, currency: string) =>
  `${getCurrencySymbolFromFormat(currency)}${formatWithSeparators(n, currency)}`

const CreatorProfile = ({ creator, links }: { creator: CreatorData; links: CreatorLink[] }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const border = theme.palette.divider
  const surface = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
  const limeTint = isDark ? 'rgba(204,255,0,0.10)' : 'rgba(204,255,0,0.16)'

  const featured = links.find((l) => l.type === 'donation' && !l.closed) || null
  const rest = links.filter((l) => l !== featured)
  const initial = (creator.name || creator.handle || '?').charAt(0).toUpperCase()

  const go = (url: string | null) => {
    if (url && typeof window !== 'undefined') window.location.href = url
  }

  const LinkCard = ({ l }: { l: CreatorLink }) => (
    <Box
      role='button'
      tabIndex={0}
      data-testid={`creator-link-${l.link_id}`}
      onClick={() => go(l.url)}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') go(l.url) }}
      sx={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        p: 1.75,
        borderRadius: '16px',
        border: `1px solid ${border}`,
        backgroundColor: surface,
        transition: 'border-color 160ms ease, transform 160ms ease',
        '&:hover': { borderColor: LIME, transform: 'translateY(-2px)' },
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
          <Icon icon={l.type === 'donation' ? 'mdi:heart' : 'mdi:link-variant'} width={22} color={isDark ? LIME : '#0A0A0B'} />
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
      <Icon icon='mdi:arrow-top-right' width={20} color={theme.palette.text.secondary} />
    </Box>
  )

  return (
    <Box sx={{ minHeight: '70vh', display: 'flex', justifyContent: 'center', px: { xs: 0, sm: 3 }, py: { xs: 0, sm: 4 } }}>
      <Box sx={{ width: '100%', maxWidth: 620 }}>
        {/* ── Cover / hero image (optional) ── */}
        {creator.cover_image && (
          <Box
            data-testid='creator-cover'
            sx={{
              height: { xs: 140, sm: 180 },
              borderRadius: { xs: 0, sm: '20px' },
              overflow: 'hidden',
              backgroundImage: `url(${creator.cover_image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              mb: { xs: 0, sm: -6 },
            }}
          />
        )}

        {/* ── Header ── */}
        {/* F10: On mobile without a cover image, the header sits flush with
            the fixed navbar which clips the avatar. Add generous top padding
            to guarantee ~64px clearance below any sticky header. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 4, px: { xs: 2, sm: 3 }, pt: { xs: creator.cover_image ? 3 : 6, sm: 0 } }}>
          <Box
            data-testid='creator-avatar'
            sx={{
              width: 104, height: 104, borderRadius: '50%', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: creator.cover_image ? theme.palette.background.paper : limeTint,
              border: `3px solid ${LIME}`,
              boxShadow: isDark ? '0 10px 40px rgba(204,255,0,0.12)' : '0 10px 30px rgba(10,10,10,0.10)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {creator.photo ? (
              <Box component='img' src={creator.photo} alt={creator.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Typography sx={{ fontFamily: MONO, fontWeight: 800, fontSize: 40, color: theme.palette.text.primary }}>
                {initial}
              </Typography>
            )}
          </Box>
          <Typography data-testid='creator-name' fontWeight={800} fontSize={{ xs: 24, sm: 28 }} letterSpacing='-0.02em' color={theme.palette.text.primary} mt={2}>
            {creator.name}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 14, color: theme.palette.text.secondary, mt: 0.25 }}>
            @{creator.handle}
          </Typography>
          {creator.bio && (
            <Typography fontSize={14.5} lineHeight={1.6} color={theme.palette.text.secondary} mt={1.5} sx={{ maxWidth: 460 }}>
              {creator.bio}
            </Typography>
          )}

          {/* ── Social links row (optional) ── */}
          {creator.social_links && Object.keys(creator.social_links).length > 0 && (
            <Box
              data-testid='creator-socials'
              sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}
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
                      width: 40, height: 40, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${border}`,
                      backgroundColor: surface,
                      color: theme.palette.text.primary,
                      transition: 'border-color 160ms ease, transform 160ms ease',
                      textDecoration: 'none',
                      '&:hover': { borderColor: LIME, transform: 'translateY(-1px)' },
                    }}
                    aria-label={platform}
                  >
                    <Icon icon={SOCIAL_ICONS[platform] || 'mdi:link-variant'} width={18} />
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>

        <Box sx={{ px: { xs: 2, sm: 3 } }}>
        {/* ── Featured donation / tip box ── */}
        {featured && (
          <Box
            data-testid='creator-featured'
            sx={{
              borderRadius: '20px', border: `1px solid ${LIME}`, p: { xs: 2.5, sm: 3 }, mb: 3,
              backgroundColor: limeTint,
            }}
          >
            <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1 }}>
              Support {creator.name.split(' ')[0]}
            </Typography>
            <Typography fontWeight={800} fontSize={19} color={theme.palette.text.primary} lineHeight={1.25}>
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
              <LinearProgress
                variant='determinate'
                value={Math.min(100, featured.progress_percent)}
                sx={{
                  mt: 1.25, height: 9, borderRadius: 999,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                  '& .MuiLinearProgress-bar': { backgroundColor: LIME, borderRadius: 999 },
                }}
              />
            )}
            <Typography fontSize={12} color={theme.palette.text.secondary} mt={1}>
              {featured.supporters_count} supporters
            </Typography>
            <Button
              fullWidth
              disableElevation
              variant='contained'
              data-testid='creator-support-btn'
              onClick={() => go(featured.url)}
              sx={{
                mt: 2, py: 1.4, borderRadius: '12px', textTransform: 'none',
                fontWeight: 800, fontSize: 15.5, backgroundColor: LIME, color: INK,
                '&:hover': { backgroundColor: LIME, filter: 'brightness(1.05)' },
              }}
            >
              Support this campaign
            </Button>
          </Box>
        )}

        {/* ── Links ── */}
        {rest.length > 0 && (
          <Box display='flex' flexDirection='column' gap={1.5} data-testid='creator-links'>
            {rest.map((l) => <LinkCard key={l.link_id} l={l} />)}
          </Box>
        )}

        {/* ── Empty state ── */}
        {links.length === 0 && (
          <Box
            data-testid='creator-empty'
            sx={{ textAlign: 'center', py: 5, px: 3, borderRadius: '18px', border: `1px dashed ${border}`, backgroundColor: surface }}
          >
            <Icon icon='mdi:sparkles-outline' width={30} color={theme.palette.text.secondary} />
            <Typography fontSize={15} fontWeight={600} color={theme.palette.text.primary} mt={1}>
              Nothing here yet
            </Typography>
            <Typography fontSize={13} color={theme.palette.text.secondary} mt={0.5} mb={2}>
              {creator.name.split(' ')[0]} hasn&apos;t published any links yet — check back soon.
            </Typography>
            {/* F10: give visitors a fallback action so this isn't a dead end */}
            <Button
              data-testid="creator-explore-cta"
              disableElevation
              variant='outlined'
              onClick={() => { if (typeof window !== 'undefined') window.location.href = '/' }}
              sx={{
                mt: 1, px: 3, py: 1.1, borderRadius: '10px', textTransform: 'none',
                fontWeight: 700, fontSize: 13.5, borderColor: LIME, color: theme.palette.text.primary,
                '&:hover': { borderColor: LIME, backgroundColor: limeTint },
              }}
            >
              Explore Dynopay creators →
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
    </Box>
  )
}

export default CreatorProfile
