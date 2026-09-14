/**
 * Aurora Shared UI Primitives (2026-08-05)
 * ─────────────────────────────────────────────────────────────
 * A single import surface that re-exports the design system's building
 * blocks so any page — public marketing, auth, in-app, buyer-facing, admin —
 * can adopt the Aurora / v2026 look with one import instead of hunting for
 * the right internal path.
 *
 * Before this file existed the tokens were split across:
 *   Components/Page/Home/v3/theme.v3.ts    (Aurora tokens + useAurora())
 *   Components/Page/Home/v3/styled.v3.tsx  (Eyebrow, HeadlineXL/L/S, Body, AuroraInk)
 *   Components/Page/Dashboard/coinbase/styled.tsx  (CB_TOKENS, SurfaceCard, PillButton)
 *   Components/Page/Dashboard/v2026/styled.tsx     (StatCard, GhostIconButton, SectionTitle)
 *
 * Now callers do:
 *   import { Eyebrow, HeadlineL, SurfaceCard, StatusPill, useVerticalAccent } from "@/Components/UI/_shared";
 *
 * NO new visual behaviour is introduced here — this is purely a re-export
 * hub. If you need to change a token, edit the source file it re-exports
 * from.
 */

// ── Aurora tokens & theme hook ────────────────────────────────
export {
  INDIGO,
  INDIGO_DEEP,
  CORAL,          // deprecated alias for INDIGO — kept for API back-compat
  CORAL_DEEP,     // deprecated alias
  VIOLET,
  VIOLET_DEEP,
  SKY,
  VOLT,
  VOLT_INK,
  PAPER,
  PAPER_ALT,
  INK,
  OBSIDIAN,
  FONT_HERO,
  FONT_BODY,
  FONT_TECH,
  AURORA_GRADIENT,
  AURORA_GRADIENT_SOFT,
  useAurora,
  type AuroraTokens,
} from "@/Components/Page/Home/v3/theme.v3";

// ── Coinbase-style dashboard tokens (light+dark parity) ──────
export { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

// ── Editorial + section primitives (from v3 styled) ──────────
export {
  SectionShell,
  Eyebrow,
  HeadlineXL,
  HeadlineL,
  HeadlineS,
  Body,
  AuroraInk,
} from "@/Components/Page/Home/v3/styled.v3";

// ── Local Aurora components (new, purpose-built for this migration) ──
export { StatusPill } from "./StatusPill";
export { SurfaceCard } from "./SurfaceCard";
export { PillButton } from "./PillButton";
export { useVerticalAccent } from "./useVerticalAccent";
export type { Vertical, VerticalAccent } from "./useVerticalAccent";
