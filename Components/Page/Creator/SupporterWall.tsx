import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'

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
  if (!supporters.length) return null
  return (
    <Box data-testid="creator-supporter-wall" sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
      <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1.25 }}>
        {t('creator.wall.title', { defaultValue: 'Recent supporters' })}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {supporters.map((s, i) => {
          const name = s.name || t('creator.wall.anonymous', { defaultValue: 'Someone' })
          return (
            <Box key={`${s.at}-${i}`} data-testid="creator-supporter-row" sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: accent }}>
                {s.name ? <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{s.name.charAt(0).toUpperCase()}</Typography> : <Icon icon="mdi:heart" width={15} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: theme.palette.text.primary }} noWrap>{name}</Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: accent }}>
                    {getCurrencySymbolFromFormat(s.currency)}{formatWithSeparators(s.amount, s.currency)}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled, ml: 'auto' }}>{relTime(s.at, t)}</Typography>
                </Box>
                {s.message && (
                  <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, lineHeight: 1.45, mt: 0.25, overflowWrap: 'anywhere' }}>
                    {s.message}
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
