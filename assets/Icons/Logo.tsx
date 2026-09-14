import React from 'react'
import { useTheme } from '@mui/material'
import { LOGO_MARK_ARROWS, LOGO_MARK_COIN, LOGO_MARK_VIEWBOX } from './logoMarkPaths'

interface LogoProps {
  width?: number
  height?: number
  color?: string
}

// Dynopay mark — the indigo "conversion coin" (crypto in → stablecoin out).
// Default: indigo coin with white arrows in both themes. `color` switches to a
// monochrome coin whose arrows are cut out (e.g. white on the dark checkout bar).
const Logo = ({ width = 64, height = 64, color }: LogoProps) => {
  const theme = useTheme()
  const coin = color || (theme.palette.mode === 'dark' ? '#6366F1' : '#4338CA')

  return (
    <svg
      width={width}
      height={height}
      viewBox={LOGO_MARK_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="dynopay-logo"
    >
      {color ? (
        <path d={`${LOGO_MARK_COIN}${LOGO_MARK_ARROWS}`} fill={coin} fillRule="evenodd" />
      ) : (
        <>
          <path d={LOGO_MARK_COIN} fill={coin} />
          <path d={LOGO_MARK_ARROWS} fill="#FFFFFF" />
        </>
      )}
    </svg>
  )
}

export default Logo
