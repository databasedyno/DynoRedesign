/**
 * Transparent price breakdown — "you pay / merchant receives / Dynopay fee".
 * Pure presentational rows; the caller decides the numbers (fiat pre-selection,
 * exact crypto once a coin is reserved, settled figures on the success card).
 *
 * `framed` wraps the rows in a premium bordered card and `trustNote` renders a
 * small reassurance line under a hairline — both used to turn the breakdown
 * into a checkout trust cue without changing any of the row semantics.
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
  /** Wrap the rows in a bordered, tinted card for a premium trust-cue look. */
  framed?: boolean
  /** Card background when framed (falls back to transparent). */
  surface?: string
  /** Small reassurance line rendered under a hairline (icon + copy). */
  trustNote?: React.ReactNode
}

export const PriceBreakdown = ({
  rows,
  muted,
  border,
  textColor,
  mono,
  title,
  testId,
  compact,
  framed,
  surface,
  trustNote,
}: Props) => {
  const inner = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.5 : 0.65 }}>
      {title && (
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: muted, letterSpacing: '0.04em', textTransform: 'uppercase', mb: 0.35 }}>
          {title}
        </Typography>
      )}
      {rows.map((r) => (
        <React.Fragment key={r.key}>
          {r.dividerBefore && <Box sx={{ height: '1px', backgroundColor: border, my: 0.5 }} />}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1.5 }}>
            <Typography
              component="span"
              sx={{ fontSize: r.emphasis ? 14 : 13, fontWeight: r.emphasis ? 700 : 400, color: r.emphasis ? textColor : muted, minWidth: 0, lineHeight: 1.35 }}
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
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.value}
              </Typography>
              {r.sub && (
                <Typography component="span" sx={{ fontFamily: mono, fontSize: 11, color: muted, opacity: 0.8, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                  {r.sub}
                </Typography>
              )}
            </Box>
          </Box>
        </React.Fragment>
      ))}
      {trustNote && (
        <Box
          sx={{
            mt: 0.85,
            pt: 0.85,
            borderTop: `1px dashed ${border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: muted,
            fontSize: 11,
            lineHeight: 1.4,
            '& svg': { flexShrink: 0 },
          }}
        >
          {trustNote}
        </Box>
      )}
    </Box>
  )

  if (!framed) return <Box data-testid={testId}>{inner}</Box>

  return (
    <Box
      data-testid={testId}
      sx={{
        p: compact ? 1.5 : 1.75,
        borderRadius: '14px',
        border: `1px solid ${border}`,
        backgroundColor: surface || 'transparent',
      }}
    >
      {inner}
    </Box>
  )
}
