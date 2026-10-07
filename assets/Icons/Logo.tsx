import React from 'react'
import { useTheme } from '@mui/material'
import { BRAND_ACCENT, ESPRESSO } from '@/constants/theme'
import { LOGO_MARK_ARROW, LOGO_MARK_RING, LOGO_MARK_VIEWBOX } from './logoMarkPaths'

interface LogoProps {
  width?: number
  height?: number
  /** Monochrome override: the whole mark in this colour. */
  color?: string
  /** Force the ground the mark sits on; defaults to the current theme mode. */
  variant?: 'onDark' | 'onLight'
}

// Dynopay mark — the "Settle-D": a bold geometric D with a right-pointing arrow in the
// counter (payment flow settling straight into the owned form). Single colour:
// gold on dark grounds, espresso on light; `color` forces a one-colour cut.
const Logo = ({ width = 64, height = 64, color, variant }: LogoProps) => {
  const theme = useTheme()
  const onDark = variant ? variant === 'onDark' : theme.palette.mode === 'dark'
  const fill = color || (onDark ? BRAND_ACCENT : ESPRESSO)

  return (
    <svg
      width={width}
      height={height}
      viewBox={LOGO_MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="dynopay-logo"
    >
      <path d={LOGO_MARK_RING} fill={fill} fillRule="evenodd" clipRule="evenodd" />
      <path d={LOGO_MARK_ARROW} fill={fill} />
    </svg>
  )
}

export default Logo
