import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Vertical } from "@/Components/UI/_shared";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * PurposePicker — the "why are you here?" pill row that opens registration.
 *
 * Ships as PART OF Phase 2 of the 2026-08-05 design audit. Design goal: the
 * moment we know a user's vertical, we can (a) tint the whole app with the
 * matching accent (via `useVerticalAccent()`), (b) route them into the right
 * post-signup onboarding flow (creator handle claim / fundraiser goal setup
 * / merchant store setup / developer API-key start), and (c) start
 * measuring per-vertical activation.
 *
 * Behaviour:
 *   • Auto-detects the vertical from three sources, in priority order:
 *       1. `dyno_seo_attr` localStorage (`{ kind: "vertical", page: "creators" }`)
 *          set by the SEO attribution capture in `pages/auth/register.tsx`
 *       2. `dyno_purpose_vertical` localStorage (previous manual pick)
 *       3. URL query `?vertical=creators`
 *     If ANY of these produces a valid vertical, we call `onDetected(v)` and
 *     RENDER NOTHING — the register form starts directly on the input step.
 *   • Otherwise renders the 4 pills for the user to pick from. Selecting a
 *     pill fires `onSelect(v)` which the parent uses to (i) persist the
 *     choice, (ii) override the vertical accent, and (iii) advance to the
 *     email/phone input step.
 *
 * Persistence key: `dyno_purpose_vertical`. Backend column will be added
 * in Phase 3 of the audit; for now this is a client-side signal only, but
 * `useVerticalAccent(override)` reads it directly via the parent page.
 */

const OPTIONS: Array<{ vertical: Vertical; icon: string }> = [
  { vertical: "merchants",   icon: "mdi:storefront-outline" },
  { vertical: "fundraisers", icon: "mdi:hand-heart-outline" },
  { vertical: "creators",    icon: "mdi:sparkles-outline" },
  { vertical: "developers",  icon: "mdi:code-tags" },
];

const VALID_VERTICALS: Vertical[] = ["merchants", "fundraisers", "creators", "developers"];
const isVertical = (v: unknown): v is Vertical =>
  typeof v === "string" && (VALID_VERTICALS as string[]).includes(v);

export interface PurposePickerProps {
  /** Fired once when a vertical is picked from the pills. */
  onSelect: (v: Vertical) => void;
  /** Fired once when the component auto-detects a vertical (SEO attr / prior
   *  pick / URL query) and decides NOT to render its pills. Same payload. */
  onDetected?: (v: Vertical) => void;
  /** Optional URL query object (e.g. `router.query`) for vertical detection. */
  routerQuery?: Record<string, unknown>;
}

export default function PurposePicker({ onSelect, onDetected, routerQuery }: PurposePickerProps) {
  const theme = useTheme();
  const { t } = useTranslation("auth");
  const dark = theme.palette.mode === "dark";
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [selected, setSelected] = useState<Vertical | null>(null);

  // Detect existing vertical from SEO attr / prior pick / URL query.
  // Runs once on mount so SSR stays neutral (no localStorage on server).
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const readSeoVertical = (): Vertical | null => {
      try {
        const raw = window.localStorage.getItem("dyno_seo_attr");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.kind === "vertical" && isVertical(parsed?.page)) return parsed.page;
        // /for/{slug} pages use singular slugs; normalise a few common ones
        const slug = String(parsed?.page || "").toLowerCase();
        const map: Record<string, Vertical> = {
          merchant: "merchants", merchants: "merchants",
          creator: "creators", creators: "creators",
          fundraiser: "fundraisers", fundraisers: "fundraisers", donation: "fundraisers",
          developer: "developers", developers: "developers", api: "developers",
        };
        return map[slug] ?? null;
      } catch { return null; }
    };
    const readStoredPick = (): Vertical | null => {
      try {
        const raw = window.localStorage.getItem("dyno_purpose_vertical");
        return isVertical(raw) ? raw : null;
      } catch { return null; }
    };
    const readQueryVertical = (): Vertical | null => {
      const q = routerQuery?.vertical;
      return isVertical(q) ? q : null;
    };

    const detected = readSeoVertical() || readStoredPick() || readQueryVertical();
    if (detected) {
      setHidden(true);
      onDetected?.(detected);
    }
  }, [onDetected, routerQuery]);

  const handlePick = (v: Vertical) => {
    setSelected(v);
    try { window.localStorage.setItem("dyno_purpose_vertical", v); } catch { /* noop */ }
    // Small pause so the highlighted pill is visible before we advance,
    // otherwise the transition feels abrupt.
    window.setTimeout(() => onSelect(v), 220);
  };

  // Nothing to render on the server or once auto-detected.
  if (!mounted || hidden) return null;

  const accents: Record<Vertical, { color: string; tint: string; contrast: string }> = {
    merchants:   { color: BRAND_ACCENT, tint: "rgba(255,209,0,0.16)", contrast: "#121214" },
    fundraisers: { color: dark ? "#FFD100" : "#8B5E00", tint: dark ? "rgba(255,209,0,0.14)" : "rgba(139,94,0,0.10)", contrast: dark ? "#0A0A0D" : "#FFFFFF" },
    creators:    { color: BRAND_ACCENT, tint: "rgba(255,209,0,0.16)", contrast: "#121214" },
    developers:  { color: dark ? "#F5F5F5" : "#0B0B0F", tint: dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,15,0.06)",   contrast: dark ? "#0B0B0F" : "#FFFFFF" },
  };

  return (
    <Box data-testid="purpose-picker" sx={{ mb: 3 }}>
      <Typography
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          fontFamily: "var(--font-tech), ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: theme.palette.text.secondary,
          mb: 1.5,
          "&::before": {
            content: '""',
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: BRAND_ACCENT,
            boxShadow: `0 0 10px ${BRAND_ACCENT}`,
          },
        }}
      >
        {t("purposeQuestion")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1.25,
        }}
      >
        {OPTIONS.map((o, idx) => {
          const active = selected === o.vertical;
          const a = accents[o.vertical];
          return (
            <Box
              key={o.vertical}
              role="button"
              tabIndex={0}
              data-testid={`purpose-pill-${o.vertical}`}
              onClick={() => handlePick(o.vertical)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePick(o.vertical); }
              }}
              sx={{
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                minHeight: 64,
                padding: "12px 14px",
                borderRadius: "16px",
                border: `1px solid ${active
                  ? a.color
                  : (dark ? "rgba(255,255,255,0.10)" : "rgba(18,18,20,0.08)")}`,
                background: active
                  ? a.tint
                  : (dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.72)"),
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: active
                  ? `0 12px 30px -14px ${a.color}`
                  : (dark ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "0 1px 2px rgba(18,18,20,0.04)"),
                transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
                animation: `authRise 480ms cubic-bezier(0.22, 1, 0.36, 1) ${120 + idx * 60}ms both`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                "&:hover": {
                  borderColor: a.color,
                  backgroundColor: a.tint,
                  transform: "translateY(-2px)",
                  boxShadow: `0 14px 30px -14px ${a.color}`,
                },
                "&:active": { transform: "translateY(0) scale(0.98)" },
                "&:focus-visible": {
                  outline: `2px solid ${a.color}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  width: 38, height: 38, flexShrink: 0,
                  borderRadius: "12px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: active
                    ? `linear-gradient(135deg, ${a.color} 0%, ${a.color}CC 100%)`
                    : a.tint,
                  color: active ? a.contrast : a.color,
                  boxShadow: active ? `0 8px 18px -8px ${a.color}` : "none",
                  transition: "background-color 160ms ease, color 160ms ease, box-shadow 160ms ease",
                }}
              >
                <Icon icon={o.icon} width={20} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontFamily: "var(--font-hero), var(--font-sans)", fontWeight: 700, fontSize: 14, lineHeight: 1.15, letterSpacing: "-0.01em", color: theme.palette.text.primary }}>
                  {t(`purposeOptions.${o.vertical}.label`)}
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 12, lineHeight: 1.35, color: theme.palette.text.secondary, mt: 0.375 }}>
                  {t(`purposeOptions.${o.vertical}.hint`)}
                </Typography>
              </Box>
              {active && (
                <Icon icon="mdi:check-circle" width={18} color={a.color} />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
