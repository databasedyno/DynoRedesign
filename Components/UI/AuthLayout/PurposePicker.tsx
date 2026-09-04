import { Box, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
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
    merchants:   { color: dark ? "#818CF8" : BRAND_ACCENT, tint: dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.10)", contrast: "#FFFFFF" },
    fundraisers: { color: "#7C5CFF",                    tint: "rgba(124,92,255,0.14)",                                   contrast: "#FFFFFF" },
    creators:    { color: dark ? "#818CF8" : BRAND_ACCENT, tint: dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.10)", contrast: "#FFFFFF" },
    developers:  { color: dark ? "#F5F5F5" : "#0B0B0F", tint: dark ? "rgba(255,255,255,0.10)" : "rgba(11,11,15,0.06)",   contrast: dark ? "#0B0B0F" : "#FFFFFF" },
  };

  return (
    <Box data-testid="purpose-picker" sx={{ mb: 3 }}>
      <Typography
        sx={{
          fontFamily: "var(--font-tech), ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: theme.palette.text.secondary,
          mb: 1.25,
        }}
      >
        {t("purposeQuestion")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 1,
        }}
      >
        {OPTIONS.map((o) => {
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
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                padding: "12px 14px",
                borderRadius: "12px",
                border: `1px solid ${active
                  ? a.color
                  : (dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,15,0.10)")}`,
                backgroundColor: active
                  ? a.tint
                  : (dark ? "rgba(255,255,255,0.02)" : "#FFFFFF"),
                transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease",
                "&:hover": {
                  borderColor: a.color,
                  backgroundColor: a.tint,
                  transform: "translateY(-1px)",
                },
                "&:focus-visible": {
                  outline: `2px solid ${a.color}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  width: 30, height: 30, flexShrink: 0,
                  borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: active ? a.color : a.tint,
                  color: active ? a.contrast : a.color,
                  transition: "background-color 160ms ease, color 160ms ease",
                }}
              >
                <Icon icon={o.icon} width={18} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, lineHeight: 1.15, color: theme.palette.text.primary }}>
                  {t(`purposeOptions.${o.vertical}.label`)}
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: 12, lineHeight: 1.3, color: theme.palette.text.secondary, mt: 0.25 }}>
                  {t(`purposeOptions.${o.vertical}.hint`)}
                </Typography>
              </Box>
              {active && (
                <Icon icon="mdi:check-circle" width={16} color={a.color} />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
