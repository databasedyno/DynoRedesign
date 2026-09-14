import React from "react";
import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { useTranslation } from "react-i18next";
import { brandFg } from "@/constants/theme";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";

/**
 * CopyInline — the single premium copy affordance for the app.
 *
 * Blueprint §3/§5: "copy-to-clipboard confirmations" / "copy fields with a
 * confirm tick". An icon button that copies `value` and briefly flips to a
 * green check (the confirmation the merchant needs), backed by the robust
 * `useCopyToClipboard` hook (async Clipboard API + execCommand fallback, so
 * it works in non-secure/iframe contexts too).
 *
 * Accessible: the aria-label reflects state and a polite live region
 * announces "Copied" to screen readers. Motion honours reduced-motion. The
 * `onCopied` hook lets callers keep any existing toast without duplicating
 * copy logic.
 */
export interface CopyInlineProps {
  /** The text placed on the clipboard. */
  value: string;
  /** Icon size in px (default 18). */
  size?: number;
  /** Resting icon colour (defaults to the brand accent). */
  color?: string;
  disabled?: boolean;
  /** Called after a copy attempt with whether it succeeded. */
  onCopied?: (ok: boolean) => void;
  copyLabel?: string;
  copiedLabel?: string;
  testId?: string;
  className?: string;
  /** `ghost` = bare icon button; `boxed` = 40px bordered square (hash rows, key fields). */
  variant?: "ghost" | "boxed";
  sx?: SxProps<Theme>;
}

const CopyInline: React.FC<CopyInlineProps> = ({
  value,
  size = 18,
  color,
  disabled,
  onCopied,
  copyLabel,
  copiedLabel,
  testId,
  className,
  variant = "ghost",
  sx,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");
  const { copied, copy } = useCopyToClipboard(1500);

  const accent = color || brandFg(isDark);
  const green = isDark ? "#3FD98A" : "#05936A";
  const lblCopy = copyLabel || t("clipboardCopy", { defaultValue: "Copy" });
  const lblCopied =
    copiedLabel || t("clipboardCopied", { defaultValue: "Copied" });

  const handle = async () => {
    if (!value || disabled) return;
    const ok = await copy(value);
    onCopied?.(ok);
  };

  const boxedSx =
    variant === "boxed"
      ? {
          width: 40,
          height: 40,
          borderRadius: "7px",
          border: `1px solid ${copied ? green : theme.palette.primary.main}`,
          backgroundColor: theme.palette.background.paper,
          flexShrink: 0,
          "&:hover": { backgroundColor: theme.palette.primary.light },
          "&:active": { transform: "scale(0.95)" },
        }
      : {};

  return (
    <Tooltip title={copied ? lblCopied : lblCopy}>
      <span>
        <IconButton
          onClick={handle}
          disabled={disabled || !value}
          size="small"
          aria-label={copied ? lblCopied : lblCopy}
          data-testid={testId}
          data-copied={copied ? "true" : "false"}
          className={className}
          sx={[
            {
              color: copied ? green : accent,
              transition: "color 150ms ease, transform 150ms ease, border-color 150ms ease",
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
              "&:focus-visible": {
                outline: `2px solid ${accent}`,
                outlineOffset: 1,
              },
              ...boxedSx,
            },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
        >
          {copied ? (
            <CheckRounded sx={{ fontSize: size }} />
          ) : (
            <ContentCopyRounded sx={{ fontSize: size }} />
          )}
          <Box
            component="span"
            aria-live="polite"
            sx={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? lblCopied : ""}
          </Box>
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default CopyInline;
