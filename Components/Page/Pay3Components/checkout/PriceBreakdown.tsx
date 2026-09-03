/**
 * Transparent price breakdown — "you pay / merchant receives / Dynopay fee".
 * Pure presentational rows; the caller decides the numbers (fiat pre-selection,
 * exact crypto once a coin is reserved, settled figures on the success card).
 */
import React from 'react'
import { Box, Typography } from '@mui/material'

export type BreakdownRow = {
  key: string
  label: React.ReactNode
  value: string
  /** Secondary value, e.g. "≈ $1.65" */
  sub?: string
  /** Small muted note after the label, e.g. "paid by the merchant" */
  note?: string
  /** Bold total row */
  emphasis?: boolean
  /** Insert a hairline above this row */
  dividerBefore?: boolean
  testId?: string
}

type Props = {
  rows: BreakdownRow[]
  muted: string
  border: string
  textColor: string
  mono: string
  title?: string
  testId?: string
  compact?: boolean
}

export const PriceBreakdown = ({ rows, muted, border, textColor, mono, title, testId, compact }: Props) => (
  <Box data-testid={testId} sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.45 : 0.6 }}>
    {title && (
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: muted, letterSpacing: '0.02em', mb: 0.25 }}>
        {title}
      </Typography>
    )}
    {rows.map((r) => (
      <React.Fragment key={r.key}>
        {r.dividerBefore && <Box sx={{ height: '1px', backgroundColor: border, my: 0.4 }} />}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1.5 }}>
          <Typography
            component="span"
            sx={{ fontSize: r.emphasis ? 14 : 13, fontWeight: r.emphasis ? 700 : 400, color: r.emphasis ? textColor : muted, minWidth: 0 }}
          >
            {r.label}
            {r.note && (
              <Typography component="span" sx={{ fontSize: 11, color: muted, ml: 0.5, opacity: 0.75 }}>
                · {r.note}
              </Typography>
            )}
          </Typography>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              data-testid={r.testId}
              component="span"
              sx={{
                fontFamily: mono,
                fontSize: r.emphasis ? 18 : 13.5,
                fontWeight: r.emphasis ? 700 : 500,
                color: r.emphasis ? textColor : muted,
                display: 'block',
              }}
            >
              {r.value}
            </Typography>
            {r.sub && (
              <Typography component="span" sx={{ fontFamily: mono, fontSize: 11, color: muted, opacity: 0.8, display: 'block' }}>
                {r.sub}
              </Typography>
            )}
          </Box>
        </Box>
      </React.Fragment>
    ))}
  </Box>
)
