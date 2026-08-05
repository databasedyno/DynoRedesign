import React, { useMemo } from 'react'
import { Area, AreaChart, Bar, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Box, Chip, Skeleton, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import { formatWithSeparators, getCurrencySymbolFromFormat } from '@/utils/currencyFormat'

/**
 * AnalyticsWidget — 30-day tips chart + top supporters for a creator.
 *
 * Two variants:
 *   • variant="compact"  → renders on the PUBLIC creator page ({handle}) under
 *                          the SupportWidget. Small chart + top-3 supporters
 *                          as inline chips. Social-proof, not a full report.
 *   • variant="full"     → renders on the /creator settings page. Larger chart
 *                          with tooltips + top-5 supporters list + lifetime
 *                          totals card. Shown to the merchant regardless of
 *                          the public toggle.
 *
 * Colour: Aurora Indigo (matches Dashboard 2026). If an `accentColor` prop is
 * supplied (e.g. the creator's chosen theme accent for the public page), the
 * chart line + supporter chip accent use that instead; the fills remain
 * neutral so contrast stays predictable across any hue.
 *
 * The widget renders nothing when no data (chart all-zeros, no supporters).
 * The parent (public page) decides visibility via `data.enabled`; this
 * component just renders whatever data it's given.
 */

export interface AnalyticsBucket {
  date: string
  amount: number
  count: number
}

export interface AnalyticsSupporter {
  name: string
  amount: number
  currency: string
  count: number
}

export interface CreatorAnalyticsData {
  chart: AnalyticsBucket[]
  top_supporters: AnalyticsSupporter[]
  totals: {
    amount_30d: number
    count_30d: number
    supporters_30d: number
    amount_lifetime: number
    supporters_lifetime: number
  }
  currency: string
  window_days: number
}

interface Props {
  variant: 'compact' | 'full'
  data: CreatorAnalyticsData | null
  loading?: boolean
  accentColor?: string | null
  onToggle?: () => void
  toggleState?: 'shown' | 'hidden'
  toggleBusy?: boolean
}

const INDIGO_LIGHT = '#4F46E5'
const INDIGO_DARK = '#818CF8'

const formatDayLabel = (ymd: string) => {
  // "2026-08-05" → "Aug 5"
  const d = new Date(ymd + 'T00:00:00Z')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const CustomTooltip = ({ active, payload, currency }: {
  active?: boolean
  payload?: Array<{ payload: AnalyticsBucket }>
  currency: string
}) => {
  const theme = useTheme()
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <Box
      sx={{
        px: 1.5, py: 1,
        borderRadius: '10px',
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(20,20,28,0.95)' : 'rgba(255,255,255,0.98)',
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        minWidth: 140,
      }}
    >
      <Typography fontSize={11.5} fontWeight={600} color={theme.palette.text.secondary} mb={0.25}>
        {formatDayLabel(p.date)}
      </Typography>
      <Typography fontSize={14} fontWeight={800} color={theme.palette.text.primary}>
        {formatWithSeparators(p.amount, currency, 2)}
      </Typography>
      <Typography fontSize={11.5} color={theme.palette.text.secondary}>
        {p.count === 1 ? '1 tip' : `${p.count} tips`}
      </Typography>
    </Box>
  )
}

const AnalyticsWidget: React.FC<Props> = ({
  variant, data, loading, accentColor, onToggle, toggleState, toggleBusy,
}) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const indigo = isDark ? INDIGO_DARK : INDIGO_LIGHT
  const barColor = accentColor || indigo
  // Neutral fill so ANY accent colour reads well underneath the line
  const areaFill = isDark ? 'rgba(129,140,248,0.18)' : 'rgba(79,70,229,0.12)'
  const border = theme.palette.divider
  const cardBg = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(10,10,15,0.02)'

  const hasChartData = useMemo(() => (data?.chart || []).some((b) => b.count > 0), [data])
  const hasSupporters = (data?.top_supporters?.length || 0) > 0
  const currency = data?.currency || 'USD'
  const symbol = getCurrencySymbolFromFormat(currency)

  // Empty state (used by both variants when we have no tips at all in 30d)
  const isEmpty = !loading && !hasChartData && !hasSupporters

  if (loading) {
    return (
      <Box
        data-testid={`creator-analytics-${variant}`}
        sx={{
          p: { xs: 1.75, sm: 2.25 }, mt: 2.5,
          borderRadius: '14px', border: `1px solid ${border}`, backgroundColor: cardBg,
        }}
      >
        <Skeleton variant="text" width={160} height={22} />
        <Skeleton variant="rectangular" height={variant === 'compact' ? 80 : 160} sx={{ mt: 1, borderRadius: '10px' }} />
        <Skeleton variant="text" width={100} height={18} sx={{ mt: 1.5 }} />
      </Box>
    )
  }

  const supporterChips = (data?.top_supporters || []).slice(0, variant === 'compact' ? 3 : 5)
  const supporterRows = data?.top_supporters || []

  // ─── COMPACT (public page) ──────────────────────────────────────────────
  if (variant === 'compact') {
    if (isEmpty) return null // hide from public page when nothing to show
    return (
      <Box
        data-testid="creator-analytics-compact"
        sx={{
          p: { xs: 1.75, sm: 2.25 }, mt: 2.5,
          borderRadius: '14px', border: `1px solid ${border}`, backgroundColor: cardBg,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Icon icon="mdi:chart-line" width={16} color={indigo} />
            <Typography fontSize={13} fontWeight={700} color={theme.palette.text.primary}>
              Momentum
            </Typography>
          </Box>
          <Typography fontSize={11.5} color={theme.palette.text.secondary}>
            Last {data?.window_days ?? 30} days
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <Box>
            <Typography fontSize={11} color={theme.palette.text.secondary}>Total tips</Typography>
            <Typography fontSize={16} fontWeight={800} color={theme.palette.text.primary} data-testid="analytics-total-30d">
              {formatWithSeparators(data?.totals.amount_30d || 0, currency, 2)}
            </Typography>
          </Box>
          <Box>
            <Typography fontSize={11} color={theme.palette.text.secondary}>Tips</Typography>
            <Typography fontSize={16} fontWeight={800} color={theme.palette.text.primary} data-testid="analytics-count-30d">
              {data?.totals.count_30d || 0}
            </Typography>
          </Box>
          <Box>
            <Typography fontSize={11} color={theme.palette.text.secondary}>Supporters</Typography>
            <Typography fontSize={16} fontWeight={800} color={theme.palette.text.primary} data-testid="analytics-supporters-30d">
              {data?.totals.supporters_30d || 0}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ height: 60, mx: -0.5 }} data-testid="analytics-chart-compact">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chart || []} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`analytics-grad-c-${accentColor?.slice(1) || 'indigo'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={barColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={barColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="amount"
                stroke={barColor}
                strokeWidth={2}
                fill={`url(#analytics-grad-c-${accentColor?.slice(1) || 'indigo'})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>

        {supporterChips.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
            {supporterChips.map((s) => (
              <Chip
                key={s.name}
                size="small"
                data-testid="analytics-supporter-chip"
                label={
                  <>
                    <Typography component="span" fontWeight={700} fontSize={12}>{s.name}</Typography>
                    <Typography component="span" fontSize={12} color={theme.palette.text.secondary} sx={{ ml: 0.75 }}>
                      · {symbol}{formatWithSeparators(s.amount, currency, s.amount % 1 === 0 ? 0 : 2).replace(/^[^\d]+/, '')}
                    </Typography>
                  </>
                }
                sx={{
                  borderRadius: '999px',
                  backgroundColor: isDark ? 'rgba(129,140,248,0.10)' : 'rgba(79,70,229,0.08)',
                  border: `1px solid ${isDark ? 'rgba(129,140,248,0.24)' : 'rgba(79,70,229,0.22)'}`,
                  '.MuiChip-label': { px: 1.25 },
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    )
  }

  // ─── FULL (settings page) ───────────────────────────────────────────────
  return (
    <Box
      data-testid="creator-analytics-full"
      sx={{
        p: { xs: 2, sm: 2.5 }, mt: 1,
        borderRadius: '14px', border: `1px solid ${border}`, backgroundColor: cardBg,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Icon icon="mdi:chart-timeline-variant" width={18} color={indigo} />
            <Typography fontSize={14.5} fontWeight={800} color={theme.palette.text.primary}>
              Tips & supporters
            </Typography>
          </Box>
          <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.25}>
            Last 30 days of activity across your tip jar and donation campaigns.
          </Typography>
        </Box>
        {onToggle && (
          <Box
            component="button"
            onClick={onToggle}
            disabled={toggleBusy}
            data-testid="creator-analytics-toggle-public"
            sx={{
              cursor: toggleBusy ? 'wait' : 'pointer',
              border: `1px solid ${border}`, borderRadius: '10px',
              px: 1.5, py: 0.6, background: 'transparent',
              display: 'inline-flex', alignItems: 'center', gap: 0.6,
              fontSize: 12, fontWeight: 700,
              color: toggleState === 'shown' ? indigo : theme.palette.text.secondary,
              '&:hover': { borderColor: indigo, color: indigo },
            }}
          >
            <Icon icon={toggleState === 'shown' ? 'mdi:eye-outline' : 'mdi:eye-off-outline'} width={14} />
            {toggleState === 'shown' ? 'Shown on public page' : 'Hidden from public'}
          </Box>
        )}
      </Box>

      {/* KPI strip */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.25, mt: 2 }}>
        <KpiTile label="Tips (30d)" value={formatWithSeparators(data?.totals.amount_30d || 0, currency, 2)} border={border} testid="analytics-kpi-30d-amount" />
        <KpiTile label="# tips (30d)" value={String(data?.totals.count_30d || 0)} border={border} testid="analytics-kpi-30d-count" />
        <KpiTile label="Lifetime tips" value={formatWithSeparators(data?.totals.amount_lifetime || 0, currency, 2)} border={border} testid="analytics-kpi-lifetime-amount" />
        <KpiTile label="Lifetime supporters" value={String(data?.totals.supporters_lifetime || 0)} border={border} testid="analytics-kpi-lifetime-count" />
      </Box>

      {/* Chart */}
      <Box sx={{ height: 220, mx: -1, mt: 2 }} data-testid="analytics-chart-full">
        {hasChartData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data?.chart || []} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="analytics-grad-full" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={indigo} stopOpacity={0.30} />
                  <stop offset="100%" stopColor={indigo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke={border} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayLabel}
                stroke={theme.palette.text.secondary}
                fontSize={10.5}
                tickLine={false}
                axisLine={{ stroke: border }}
                interval={4}
                minTickGap={16}
              />
              <YAxis
                yAxisId="amount"
                stroke={theme.palette.text.secondary}
                fontSize={10.5}
                tickLine={false}
                axisLine={{ stroke: border }}
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `${symbol}${(v / 1000).toFixed(1)}k` : `${symbol}${v}`)}
              />
              <YAxis yAxisId="count" orientation="right" hide />
              <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: areaFill }} />
              <Bar yAxisId="count" dataKey="count" fill={indigo} opacity={0.35} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              <Area yAxisId="amount" type="monotone" dataKey="amount" stroke={indigo} strokeWidth={2.5} fill="url(#analytics-grad-full)" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <Box
            sx={{
              height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 0.75, color: theme.palette.text.disabled,
            }}
          >
            <Icon icon="mdi:chart-timeline-variant-shimmer" width={32} />
            <Typography fontSize={13} fontWeight={600}>No tips yet in the last 30 days.</Typography>
            <Typography fontSize={12}>When someone tips you, you&apos;ll see the momentum here.</Typography>
          </Box>
        )}
      </Box>

      {/* Top supporters list */}
      <Box sx={{ mt: 2 }}>
        <Typography fontSize={12.5} fontWeight={700} color={theme.palette.text.secondary} mb={1} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Top supporters
        </Typography>
        {supporterRows.length === 0 ? (
          <Typography fontSize={13} color={theme.palette.text.secondary}>
            Supporters who leave a name will appear here. Anonymous tips still count in the chart.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {supporterRows.map((s, i) => (
              <Box
                key={s.name}
                data-testid="analytics-supporter-row"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: 1, borderRadius: '10px',
                  border: `1px solid ${border}`, backgroundColor: cardBg,
                }}
              >
                <Box
                  sx={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11.5, fontWeight: 800,
                    backgroundColor: isDark ? 'rgba(129,140,248,0.16)' : 'rgba(79,70,229,0.10)',
                    color: indigo,
                  }}
                >
                  {i + 1}
                </Box>
                <Typography fontSize={13.5} fontWeight={700} color={theme.palette.text.primary} sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.name}
                </Typography>
                <Typography fontSize={12} color={theme.palette.text.secondary} sx={{ whiteSpace: 'nowrap' }}>
                  {s.count === 1 ? '1 tip' : `${s.count} tips`}
                </Typography>
                <Typography fontSize={13.5} fontWeight={800} color={theme.palette.text.primary} sx={{ whiteSpace: 'nowrap' }}>
                  {formatWithSeparators(s.amount, s.currency, s.amount % 1 === 0 ? 0 : 2)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

const KpiTile: React.FC<{ label: string; value: string; border: string; testid?: string }> = ({ label, value, border, testid }) => {
  const theme = useTheme()
  return (
    <Box
      data-testid={testid}
      sx={{
        p: 1.25, borderRadius: '10px', border: `1px solid ${border}`,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(10,10,15,0.02)',
      }}
    >
      <Typography fontSize={10.5} color={theme.palette.text.secondary} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography fontSize={16} fontWeight={800} color={theme.palette.text.primary} sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  )
}

export default AnalyticsWidget
