import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, useTheme } from '@mui/material'
import { alpha, darken } from '@mui/material/styles'
import { Icon } from '@iconify/react'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'
import { readableOn } from '@/constants/creatorTheme'

export interface RecentSupporter {
  name: string | null
  message: string | null
  amount: number
  currency: string
  at: string
}

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'

const relTime = (iso: string, t: (k: string, o: Record<string, unknown>) => string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const d = Math.floor(diff / 86400000)
  if (d === 0) return t('creator.wall.today', { defaultValue: 'today' })
  if (d < 30) return t('creator.wall.daysAgo', { count: d, defaultValue: `${d}d ago` })
  const m = Math.floor(d / 30)
  return t('creator.wall.monthsAgo', { count: m, defaultValue: `${m}mo ago` })
}

/** Opt-in "supporter wall" — the most recent public tips (first name, amount, message). */
const SupporterWall = ({ supporters, accent }: { supporters: RecentSupporter[]; accent: string }) => {
  const { t } = useTranslation('landing')
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const accentText = isDark ? accent : (readableOn(accent) === '#FFFFFF' ? accent : darken(accent, 0.38))
  if (!supporters.length) return null
  return (
    <Box data-testid="creator-supporter-wall" sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${theme.palette.divider}`, position: 'relative' }}>
      <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1.5 }}>
        {t('creator.wall.title', { defaultValue: 'Recent supporters' })}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {supporters.map((s, i) => {
          const name = s.name || t('creator.wall.anonymous', { defaultValue: 'Someone' })
          return (
            <Box key={`${s.at}-${i}`} data-testid="creator-supporter-row" sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 1.25, borderRadius: '16px', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(18,18,20,0.025)', transition: 'background-color 140ms ease', '&:hover': { backgroundColor: alpha(accent, isDark ? 0.08 : 0.06) } }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${alpha(accent, 0.3)} 0%, ${alpha(accent, 0.1)} 100%)`, color: accentText }}>
                {s.name ? <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{s.name.charAt(0).toUpperCase()}</Typography> : <Icon icon="mdi:heart" width={16} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary }} noWrap>{name}</Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: accentText }}>
                    {getCurrencySymbolFromFormat(s.currency)}{formatWithSeparators(s.amount, s.currency)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled, ml: 'auto' }}>{relTime(s.at, t)}</Typography>
                </Box>
                {s.message && (
                  <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, lineHeight: 1.5, mt: 0.35, overflowWrap: 'anywhere' }}>
                    &ldquo;{s.message}&rdquo;
                  </Typography>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default SupporterWall
