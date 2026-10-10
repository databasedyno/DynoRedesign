import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";

interface Props {
  size: number;
  stroke: number;
  /** 0–1 share of the ring to fill (clockwise from 12 o'clock). */
  value: number;
  color: string;
  track: string;
  /** Evenly spaced tick marks inside the ring (e.g. 3 → every 30 days of 90). */
  ticks?: number;
  tickColor?: string;
  /** Dashed track = "not started yet". */
  dashedTrack?: boolean;
  /** Accessible description of what the ring shows. */
  label: string;
  children?: React.ReactNode;
  testId?: string;
}

/** Animated SVG progress ring used by the KYC grace countdown + dashboard card. */
const KycRing: React.FC<Props> = ({ size, stroke, value, color, track, ticks = 0, tickColor, dashedTrack, label, children, testId }) => {
  const [shown, setShown] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    try {
      setReduceMotion(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    } catch {
      /* ignore */
    }
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const offset = c * (1 - (shown || reduceMotion ? v : 0));
  const mid = size / 2;
  const inner = r - stroke / 2 - 3;
  const tickLen = Math.max(3, stroke * 0.5);

  return (
    <Box data-testid={testId} role="img" aria-label={label} sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false" style={{ display: "block", transform: "rotate(-90deg)" }}>
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeDasharray={dashedTrack ? `${Math.max(2, stroke * 0.45)} ${Math.max(3, stroke * 0.75)}` : undefined}
        />
        {v > 0 && (
          <circle
            cx={mid}
            cy={mid}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap={v >= 1 ? "butt" : "round"}
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: reduceMotion ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        )}
        {ticks > 0 &&
          Array.from({ length: ticks }).map((_, i) => {
            const a = (i / ticks) * 2 * Math.PI;
            return (
              <line
                key={i}
                x1={mid + Math.cos(a) * inner}
                y1={mid + Math.sin(a) * inner}
                x2={mid + Math.cos(a) * (inner - tickLen)}
                y2={mid + Math.sin(a) * (inner - tickLen)}
                stroke={tickColor || track}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}
      </svg>
      <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", px: 1 }}>{children}</Box>
    </Box>
  );
};

export default KycRing;
