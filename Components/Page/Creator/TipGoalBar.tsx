import React from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography, useTheme } from '@mui/material'

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace'

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
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
  const reached = raised >= goal
  const days = daysLeftInMonth()
  return (
    <Box data-testid="tip-goal-bar" data-pct={pct} sx={{ mt: compact ? 1 : 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 0.6 }}>
        <Typography sx={{ fontFamily: MONO, fontSize: compact ? 11 : 12.5, fontWeight: 700, color: theme.palette.text.primary }} data-testid="tip-goal-label">
          {t('creator.goal.progress', { raised: fmtMoney(raised), goal: fmtMoney(goal), defaultValue: '{{raised}} of {{goal}} this month' })}
        </Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: compact ? 11 : 12.5, fontWeight: 700, color: accent }} data-testid="tip-goal-pct">{pct}%</Typography>
      </Box>
      <Box role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} sx={{ height: compact ? 6 : 8, borderRadius: '999px', overflow: 'hidden', backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: accent, transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)' }} />
      </Box>
      {!compact && (
        <Typography sx={{ fontSize: 11.5, color: theme.palette.text.disabled, mt: 0.5 }} data-testid="tip-goal-footer">
          {reached
            ? t('creator.goal.reached', { defaultValue: 'Goal reached — thank you! Every extra tip still goes straight to the creator.' })
            : t('creator.goal.resets', { count: days, defaultValue: `Resets in ${days} days` })}
        </Typography>
      )}
    </Box>
  )
}

export default TipGoalBar
