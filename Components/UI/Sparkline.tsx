import React, { useMemo } from "react";
import { Box, Typography, useTheme } from "@mui/material";

interface SparklineProps {
  /** Daily datapoints, oldest → newest. Falsy / non-numeric entries render as 0. */
  points: number[] | null | undefined;
  /** Rendered width (px). */
  width?: number;
  /** Rendered height (px). */
  height?: number;
  /** Stroke color override — defaults to the theme's primary accent. */
  color?: string;
  /** Label read by screen readers (defaults to point count + total sum). */
  ariaLabel?: string;
  /** Text shown when all datapoints are zero (defaults to "no data"). */
  noDataLabel?: string;
  "data-testid"?: string;
}

/**
 * Sparkline — a tiny SVG line chart for at-a-glance trend visualization.
 *
 * Deliberately dependency-free (no recharts) so it can render in tightly
 * packed table rows without dragging the recharts bundle onto every page.
 * Falls back to a flat baseline + "no data" hint when all points are zero,
 * so the row stays visually consistent between active and dormant companies.
 */
const Sparkline: React.FC<SparklineProps> = ({
  points,
  width = 120,
  height = 32,
  color,
  ariaLabel,
  noDataLabel = "no data",
  "data-testid": testId,
}) => {
  const theme = useTheme();
  const safe = useMemo(() => {
    const arr = Array.isArray(points) ? points : [];
    return arr.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
  }, [points]);

  const strokeColor = color || (theme.palette.mode === "dark" ? "#818CF8" : "#4F46E5");
  const emptyColor = theme.palette.divider;

  const { path, area, max, allZero } = useMemo(() => {
    const n = safe.length;
    if (n < 2) {
      return {
        path: "",
        area: "",
        max: 0,
        allZero: true,
      };
    }
    const maxV = Math.max(...safe);
    const minV = Math.min(...safe);
    const range = Math.max(maxV - minV, 1); // avoid divide-by-zero (all-flat)
    const stepX = width / (n - 1);
    // Reserve 2px of padding top/bottom so the line stroke isn't clipped.
    const yPad = 2;
    const usableH = height - yPad * 2;
    const coords = safe.map((v, i) => {
      const x = i * stepX;
      // Higher value = lower Y (SVG's Y grows down).
      const y = yPad + (usableH - ((v - minV) / range) * usableH);
      return [x, y] as const;
    });
    const p = coords
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    // Area path: line + close to baseline for the subtle fill under the line.
    const a =
      `${p} L${(coords[coords.length - 1][0]).toFixed(2)},${(height - yPad).toFixed(2)}` +
      ` L${coords[0][0].toFixed(2)},${(height - yPad).toFixed(2)} Z`;
    return { path: p, area: a, max: maxV, allZero: maxV === 0 };
  }, [safe, width, height]);

  const label =
    ariaLabel
    || `Trend line — ${safe.length} datapoints, total ${safe.reduce((a, b) => a + b, 0)}, peak ${max}`;

  // Hoisted above the early return — hooks must run unconditionally.
  const gradId = useMemo(
    () => `spark-fill-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  if (allZero) {
    return (
      <Box
        role="img"
        aria-label={label}
        data-testid={testId}
        sx={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: 1,
            borderTop: `1px dashed ${emptyColor}`,
          }}
        />
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 10,
            color: theme.palette.text.disabled,
            ml: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          {noDataLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      data-testid={testId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Sparkline;
