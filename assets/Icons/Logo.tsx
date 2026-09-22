import React from 'react'
import { useTheme } from '@mui/material'
import { AQUA, BLACK, BRAND_ACCENT } from '@/constants/theme'
import {
  LOGO_MARK_SPARK,
  LOGO_MARK_STROKES,
  LOGO_MARK_STROKE_WIDTH,
  LOGO_MARK_TICKS,
  LOGO_MARK_TICK_DASH,
  LOGO_MARK_TICK_WIDTH,
  LOGO_MARK_VIEWBOX,
} from './logoMarkPaths'

interface LogoProps {
  width?: number
  height?: number
  /** Monochrome: every part (D, coin edge, spark) in this colour. */
  color?: string
  /** Force the ground the mark sits on; defaults to the current theme mode. */
  variant?: 'onDark' | 'onLight'
}

// Dynopay mark — the "coin-arc D": two concentric outlined D's, a reeded coin edge,
// a slot through the stem and one aqua spark for the on-chain moment.
// Yellow on dark grounds, black on light; `color` renders a single-colour cut.
const Logo = ({ width = 64, height = 64, color, variant }: LogoProps) => {
  const theme = useTheme()
  const onDark = variant ? variant === 'onDark' : theme.palette.mode === 'dark'
  const body = color || (onDark ? BRAND_ACCENT : BLACK)
  const spark = color || AQUA

  return (
    <svg
      width={width}
      height={height}
      viewBox={LOGO_MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="dynopay-logo"
    >
      <path d={LOGO_MARK_STROKES} stroke={body} strokeWidth={LOGO_MARK_STROKE_WIDTH} strokeLinejoin="miter" fill="none" />
      <path d={LOGO_MARK_TICKS} stroke={body} strokeWidth={LOGO_MARK_TICK_WIDTH} strokeDasharray={LOGO_MARK_TICK_DASH} fill="none" />
      <path d={LOGO_MARK_SPARK} fill={spark} />
    </svg>
  )
}

export default Logo
