import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, useTheme } from '@mui/material'
import { alpha, darken } from '@mui/material/styles'
import { readableOn } from '@/constants/creatorTheme'

const MONO = 'var(--font-tech), ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace'

interface Props {
  goal: number
  raised: number
  fmtMoney: (n: number) => string
  accent: string
  compact?: boolean
}

const daysLeftInMonth = () => {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86400000))
}

/** Monthly tip goal — "$X of $Y this month · N%", resets on the 1st. */
const TipGoalBar = ({ goal, raised, fmtMoney, accent, compact = false }: Props) => {
  const { t } = useTranslation('landing')
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const accentText = isDark ? accent : (readableOn(accent) === '#FFFFFF' ? accent : darken(accent, 0.38))
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
  const reached = raised >= goal
  const days = daysLeftInMonth()
  return (
    <Box data-testid="tip-goal-bar" data-pct={pct} sx={{ mt: compact ? 1 : 2.25, position: 'relative' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontFamily: MONO, fontSize: compact ? 12 : 13, fontWeight: 700, color: theme.palette.text.primary }} data-testid="tip-goal-label">
          {t('creator.goal.progress', { raised: fmtMoney(raised), goal: fmtMoney(goal), defaultValue: '{{raised}} of {{goal}} this month' })}
        </Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: compact ? 12 : 13, fontWeight: 800, color: accentText }} data-testid="tip-goal-pct">{pct}%</Typography>
      </Box>
      <Box role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} sx={{ height: compact ? 6 : 10, borderRadius: '999px', overflow: 'hidden', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(18,18,20,0.07)' }}>
        <Box
          sx={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: '999px',
            background: `linear-gradient(90deg, ${accent} 0%, #FFB300 100%)`,
            boxShadow: pct > 0 ? `0 0 14px ${alpha(accent, 0.55)}` : 'none',
            transition: 'width 700ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </Box>
      {!compact && (
        <Typography sx={{ fontSize: 12, color: theme.palette.text.disabled, mt: 0.6 }} data-testid="tip-goal-footer">
          {reached
            ? t('creator.goal.reached', { defaultValue: 'Goal reached — thank you! Every extra tip still goes straight to the creator.' })
            : t('creator.goal.resets', { count: days, defaultValue: `Resets in ${days} days` })}
        </Typography>
      )}
    </Box>
  )
}

export default TipGoalBar
