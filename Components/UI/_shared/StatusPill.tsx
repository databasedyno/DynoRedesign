import { Box, styled } from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

/**
 * StatusPill — small monospace status label used across tables, transaction
 * rows, invoice status columns, wallet cards, and command bars.
 *
 * Tones map to the semantic states of the payments product:
 *   settled  → volt-lime green (money confirmed on chain, funds cleared)
 *   pending  → amber (waiting for blockchain confirmation)
 *   failed   → coral red (unrecoverable failure)
 *   info     → indigo (neutral information — e.g. "auto-converted")
 *   neutral  → grey (fallback, unknown state)
 *
 * Radius, padding, letter-spacing, and dark-mode contrast all match the
 * shipped v2026 dashboard chips so plugging this into pages outside the
 * dashboard doesn't require any surface-specific overrides.
 */
export type StatusPillTone = "settled" | "pending" | "failed" | "info" | "neutral" | "draft" | "overdue";

export const StatusPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "tone",
})<{ tone?: StatusPillTone }>(({ theme, tone = "neutral" }) => {
  const dark = theme.palette.mode === "dark";
  const S = CB_TOKENS.semantic;
  // Each tone maps to a v2026 semantic accent so pills match the dashboard,
  // Transactions, and Wallet everywhere StatusPill is used.
  const bySemantic = (s: { dark: string; light: string; glowDark: string; glowLight: string }) => ({
    bg: dark ? s.glowDark : s.glowLight,
    fg: dark ? s.dark : s.light,
    ring: `${dark ? s.dark : s.light}${dark ? "38" : "29"}`,
  });
  const greyTone = {
    bg: dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)",
    fg: dark ? "rgba(255,255,255,0.72)" : "rgba(10,10,15,0.62)",
    ring: dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.12)",
  };
  const palettes: Record<StatusPillTone, { bg: string; fg: string; ring: string }> = {
    settled: bySemantic(S.positive), // paid / confirmed / cleared
    pending: bySemantic(S.warning),
    overdue: bySemantic(S.negative),
    failed: bySemantic(S.negative),
    info: bySemantic(S.info),
    draft: greyTone,
    neutral: greyTone,
  };
  const { bg, fg, ring } = palettes[tone];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    fontFamily: "var(--font-tech), ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: fg,
    backgroundColor: bg,
    border: `1px solid ${ring}`,
    whiteSpace: "nowrap",
    userSelect: "none",
  };
});
