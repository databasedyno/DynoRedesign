/**
 * DynoPay UI Kit — shared design primitives that bring the clean, modern
 * checkout (CleanCheckoutV2) aesthetic into the rest of the app:
 *   • Monospace, tabular numerals for money/metrics (fintech feel)
 *   • Lucide line-icons via a single <Icon> wrapper (consistent, theme-safe)
 *   • Re-exports the theme-aware CB_TOKENS so light & dark stay in sync.
 *
 * This is the foundation for the app-wide restyle; the Dashboard is the pilot.
 */
import React from "react";
import { Box, styled } from "@mui/material";
import { Icon as Iconify } from "@iconify/react";

export { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/** Monospace stack — IBM Plex Mono (Blueprint §1.3: the single money/figure
 *  typeface), matching the checkout's fintech feel, with robust system fallbacks. */
export const MONO =
  'var(--font-tech), "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace';

export interface IconProps {
  /** Bare Lucide name ("wallet") or a full Iconify id ("lucide:wallet", "mdi:..."). */
  name: string;
  size?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

/**
 * Icon — the single line-icon primitive for the app. Defaults to the Lucide
 * set (loaded on-demand via the Iconify API, same mechanism already used
 * across the app). Colour follows `currentColor` so it is always theme-safe
 * in both light and dark mode.
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color,
  className,
  style,
}) => {
  const icon = name.includes(":") ? name : `lucide:${name}`;
  return (
    <Iconify
      icon={icon}
      width={size}
      height={size}
      className={className}
      style={{ color: color || "currentColor", flexShrink: 0, ...style }}
    />
  );
};

/**
 * MonoAmount — a money value rendered in tabular monospace. Colour is inherited
 * (set it via `color` on the parent or the sx prop) so it stays theme-aware.
 */
export const MonoAmount = styled(Box)({
  fontFamily: MONO,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.01em",
  fontFeatureSettings: '"tnum" 1',
});

const uiKit = { Icon, MonoAmount, MONO };
export default uiKit;
