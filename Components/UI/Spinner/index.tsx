import { Box } from "@mui/material";
import { SxProps, Theme } from "@mui/system";
import React from "react";
import { BRAND_ACCENT } from "@/constants/theme";

export interface SpinnerProps {
  /** Diameter in px. Default 44. */
  size?: number;
  /** Ring thickness in px. Default 4. */
  thickness?: number;
  /** Track (base ring) colour. Default "white". */
  trackColor?: string;
  /** Accent (moving arc) colour. Default BRAND_ACCENT. */
  color?: string;
  /** Rotation duration. Default "0.9s". */
  speed?: string;
  /** Extra styles merged onto the spinner element. */
  sx?: SxProps<Theme>;
  /** Accessible label. Default "Loading". */
  label?: string;
}

/**
 * Shared brand spinner — a single rotating ring. One source of truth for the
 * inline "border spinner" that was hand-rolled with per-component `@keyframes`
 * across the app. Every knob is a prop so callers can reproduce their exact
 * previous look (size / thickness / colours / speed). At its defaults it is
 * byte-for-byte the former `Components/UI/Loading.tsx` spinner.
 *
 * Respects `prefers-reduced-motion` by slowing (not stopping) the rotation.
 */
const Spinner: React.FC<SpinnerProps> = ({
  size = 44,
  thickness = 4,
  trackColor = "white",
  color = BRAND_ACCENT,
  speed = "0.9s",
  sx,
  label = "Loading",
}) => (
  <Box
    role="status"
    aria-label={label}
    sx={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `${thickness}px solid ${trackColor}`,
      borderTop: `${thickness}px solid ${color}`,
      animation: `dp-spin ${speed} linear infinite`,
      "@keyframes dp-spin": {
        "0%": { transform: "rotate(0deg)" },
        "100%": { transform: "rotate(360deg)" },
      },
      "@media (prefers-reduced-motion: reduce)": {
        animationDuration: "2.4s",
      },
      ...sx,
    }}
  />
);

export default Spinner;
