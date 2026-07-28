/**
 * GoalProgressBar — the crowdfunding goal display.
 *
 * Improvements over the plain <LinearProgress>:
 *   • Gradient fill (aurora indigo → emerald when goalReached; Session 82 migration)
 *   • Milestone tick marks at 25/50/75%, subtle when unreached, brighter when passed
 *   • Floating percentage pill that rides along the leading edge of the fill
 *   • Shimmer animation on the leading edge while in-progress
 *   • Emerald "🏆 Goal reached" celebration state when 100 %+
 *
 * Non-breaking: same props (percent, raised, goal, currency-formatter) so the
 * parent can drop it in place of the previous LinearProgress + label pair.
 */
import React, { useEffect, useState } from "react";
import { Box, Typography, useTheme, keyframes } from "@mui/material";

interface Props {
  /** Actual percent, uncapped for display but capped visually at 100. */
  percent: number;
  raised: number;
  goal: number;
  formatCurrency: (n: number) => string;
  /** Label under the raised number, e.g. "raised of $10,000 goal". */
  raisedLabel?: string;
  goalReached?: boolean;
}

const MONO = 'ui-monospace, "Roboto Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';

const shimmer = keyframes`
  0%   { transform: translateX(-100%); opacity: 0.0; }
  40%  { opacity: 0.9; }
  100% { transform: translateX(400%); opacity: 0.0; }
`;

const pulse = keyframes`
  0%,100% { transform: scale(1);   opacity: 0.85; }
  50%     { transform: scale(1.03); opacity: 1;    }
`;

const MILESTONES = [25, 50, 75];

export default function GoalProgressBar({
  percent,
  raised,
  goal,
  formatCurrency,
  raisedLabel,
  goalReached,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [barValue, setBarValue] = useState(0);
  const target = Math.min(100, Math.max(0, percent || 0));

  useEffect(() => {
    const t = setTimeout(() => setBarValue(target), 120);
    return () => clearTimeout(t);
  }, [target]);

  const accent = "#4F46E5";
  const accentDim = "#5a6b00";
  const success = "#10B981";
  const trackBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const pillBg = goalReached ? success : accent;
  const pillFg = goalReached ? "#fff" : "#0A0A0B";
  const fillGradient = goalReached
    ? `linear-gradient(90deg, #34D399 0%, ${success} 100%)`
    : `linear-gradient(90deg, ${accent} 0%, #4338CA 100%)`;

  return (
    <Box data-testid="goal-progress-bar" sx={{ width: "100%" }}>
      {/* Header row: raised amount + % pill */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: MONO,
              fontWeight: 800,
              fontSize: { xs: 26, sm: 32 },
              lineHeight: 1,
              color: theme.palette.text.primary,
            }}
          >
            {formatCurrency(raised)}
          </Typography>
          {raisedLabel && (
            <Typography
              fontSize={13}
              color={theme.palette.text.secondary}
              mt={0.75}
            >
              {raisedLabel}
            </Typography>
          )}
        </Box>

        {goal > 0 && (
          <Box
            data-testid="goal-percent-pill"
            sx={{
              px: 1.5,
              py: 0.6,
              borderRadius: "999px",
              backgroundColor: pillBg,
              color: pillFg,
              fontFamily: MONO,
              fontWeight: 800,
              fontSize: 13,
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              boxShadow: goalReached ? `0 4px 14px ${success}66` : "none",
              animation: goalReached ? `${pulse} 1.8s ease-in-out infinite` : "none",
            }}
          >
            {goalReached ? "🏆" : ""}
            {Math.round(percent)}% funded
          </Box>
        )}
      </Box>

      {/* Bar track with milestones + gradient fill + shimmer */}
      {goal > 0 && (
        <Box
          sx={{
            position: "relative",
            mt: 1.5,
            height: 12,
            borderRadius: 999,
            backgroundColor: trackBg,
            overflow: "hidden",
          }}
          data-testid="goal-progress-track"
        >
          {/* Milestone tick marks (below the fill visually) */}
          {MILESTONES.map((m) => (
            <Box
              key={m}
              aria-hidden
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${m}%`,
                width: 2,
                bgcolor:
                  target >= m
                    ? isDark
                      ? "rgba(0,0,0,0.35)"
                      : "rgba(255,255,255,0.6)"
                    : isDark
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(0,0,0,0.12)",
                zIndex: 1,
              }}
              data-testid={`goal-milestone-${m}`}
            />
          ))}

          {/* Fill */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${barValue}%`,
              background: fillGradient,
              borderRadius: 999,
              transition: "width 900ms cubic-bezier(0.16,1,0.3,1)",
              zIndex: 2,
              overflow: "hidden",
            }}
            data-testid="goal-progress-fill"
          >
            {/* Shimmer ribbon inside fill (skip when goal reached) */}
            {!goalReached && barValue > 3 && (
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: "25%",
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
                  animation: `${shimmer} 2.4s ease-in-out infinite`,
                }}
              />
            )}
          </Box>
        </Box>
      )}

      {/* Milestone labels row (tiny, subtle) */}
      {goal > 0 && (
        <Box
          sx={{
            position: "relative",
            mt: 0.5,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontSize: 10.5,
            color: theme.palette.text.disabled,
            letterSpacing: "0.03em",
          }}
        >
          <Box>0</Box>
          <Box sx={{ opacity: target >= 25 ? 1 : 0.5 }}>25%</Box>
          <Box sx={{ opacity: target >= 50 ? 1 : 0.5 }}>50%</Box>
          <Box sx={{ opacity: target >= 75 ? 1 : 0.5 }}>75%</Box>
          <Box sx={{ opacity: target >= 100 ? 1 : 0.5 }}>{formatCurrency(goal)}</Box>
        </Box>
      )}
    </Box>
  );
}
