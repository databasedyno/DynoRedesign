import { brandFg } from "@/constants/theme";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import React, { useEffect, useState } from "react";

/**
 * SteppedProgressPanel — friendly loading UI for operations that take > 3s.
 *
 * Shows a large centered spinner, a heading, a rotating step message and
 * animated pill-shaped step dots. Used by OtpDialog (via inline duplication
 * for now) and by CreateCompanyModal / any other slow flow.
 *
 * Behavior:
 * - Rotates messages every `intervalMs` (default 2000).
 * - Stops rotation on the LAST step so the array is never overshot.
 * - When `active` toggles from false → true, restarts from step 0.
 * - `active=false` renders nothing so callers can wrap it in `{active && ...}`
 *   or use the panel as a swap target inside their own container.
 */
export interface SteppedProgressPanelProps {
  /** When true, the rotation is running. Set false to freeze. */
  active: boolean;
  /** Ordered list of messages to rotate through. */
  steps: string[];
  /** Milliseconds between rotations. Default 2000. */
  intervalMs?: number;
  /** Heading rendered above the spinner. Default "Almost done…". */
  title?: string;
  /** Optional footer hint. Default: reassuring copy about keeping the window open. */
  hint?: string;
  /** Data-testid on the outer container for automated tests. */
  "data-testid"?: string;
  /** Size preset. Default "md". "sm" → 72px spinner, "md" → 96px. */
  size?: "sm" | "md";
}

const SteppedProgressPanel: React.FC<SteppedProgressPanelProps> = ({
  active,
  steps,
  intervalMs = 2000,
  title = "Almost done…",
  hint = "Please keep this window open — this takes a few seconds.",
  "data-testid": testId = "stepped-progress-panel",
  size = "md",
}) => {
  const theme = useTheme();
  const [stepIndex, setStepIndex] = useState(0);

  const spinnerSize = size === "sm" ? 72 : 96;
  const iconSize = size === "sm" ? 32 : 40;

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    if (steps.length <= 1) return;
    const timer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, steps]);

  if (!active) return null;

  return (
    <Box
      data-testid={testId}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        py: 3,
        px: 1,
        gap: 2,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: spinnerSize,
          height: spinnerSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress
          size={spinnerSize}
          thickness={3}
          sx={{ color: brandFg(theme.palette.mode === "dark") }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckRoundedIcon
            sx={{
              fontSize: iconSize,
              color: brandFg(theme.palette.mode === "dark"),
              opacity: 0.4,
            }}
          />
        </Box>
      </Box>

      <Typography
        sx={{
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: size === "sm" ? "18px" : "22px",
          color: theme.palette.text.primary,
          lineHeight: 1.2,
        }}
      >
        {title}
      </Typography>

      <Typography
        data-testid={`${testId}-message`}
        key={stepIndex}
        sx={{
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          color: theme.palette.text.secondary,
          minHeight: "1.5em",
          lineHeight: 1.4,
          maxWidth: 360,
          animation: "steppedFadeIn 240ms ease-out",
          "@keyframes steppedFadeIn": {
            "0%": { opacity: 0, transform: "translateY(6px)" },
            "100%": { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        {steps[stepIndex] ?? ""}
      </Typography>

      {steps.length > 1 && (
        <Box sx={{ display: "flex", gap: "6px", mt: 0.5 }}>
          {steps.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: i === stepIndex ? 20 : 6,
                height: 6,
                borderRadius: "999px",
                backgroundColor:
                  i <= stepIndex
                    ? theme.palette.primary.main
                    : theme.palette.mode === "dark"
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(0,0,0,0.12)",
                transition: "all 220ms ease-out",
              }}
            />
          ))}
        </Box>
      )}

      {hint && (
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: theme.palette.text.disabled,
            mt: 1,
          }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
};

export default SteppedProgressPanel;
