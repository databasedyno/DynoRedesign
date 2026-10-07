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
  /** One-shot entrance reveal (ring scales+fades in, arrow slides in). Off by default. */
  animate?: boolean
  /** Delay before the reveal starts, ms. */
  animateDelayMs?: number
}

// Dynopay mark — the "Settle-D": a bold geometric D with a right-pointing arrow in the
// counter (payment flow settling straight into the owned form). Single colour:
// gold on dark grounds, espresso on light; `color` forces a one-colour cut.
// `animate` plays a one-shot, reduced-motion-aware entrance reveal (opt-in; off by default
// so every existing <Logo> usage is byte-identical to before).
const Logo = ({ width = 64, height = 64, color, variant, animate = false, animateDelayMs = 0 }: LogoProps) => {
  const theme = useTheme()
  const onDark = variant ? variant === 'onDark' : theme.palette.mode === 'dark'
  const fill = color || (onDark ? BRAND_ACCENT : ESPRESSO)
  const uid = React.useId().replace(/:/g, '') // SSR-safe, unique per instance
  const cls = `dyno-logo-${uid}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={LOGO_MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="dynopay-logo"
      className={animate ? cls : undefined}
    >
      {animate && (
        <style>{`
          .${cls} .dyno-ring { transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(0.82);
            animation: dynoRing-${uid} 460ms cubic-bezier(0.22,1,0.36,1) ${animateDelayMs}ms both; }
          .${cls} .dyno-arrow { transform-box: fill-box; transform-origin: left center; opacity: 0; transform: translateX(-5px);
            animation: dynoArrow-${uid} 420ms cubic-bezier(0.22,1,0.36,1) ${animateDelayMs + 150}ms both; }
          @keyframes dynoRing-${uid} { to { opacity: 1; transform: scale(1); } }
          @keyframes dynoArrow-${uid} { to { opacity: 1; transform: translateX(0); } }
          @media (prefers-reduced-motion: reduce) {
            .${cls} .dyno-ring, .${cls} .dyno-arrow { animation: none !important; opacity: 1 !important; transform: none !important; }
          }
        `}</style>
      )}
      <path className="dyno-ring" d={LOGO_MARK_RING} fill={fill} fillRule="evenodd" clipRule="evenodd" />
      <path className="dyno-arrow" d={LOGO_MARK_ARROW} fill={fill} />
    </svg>
  )
}

export default Logo
