import { useRouter } from "next/router";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { INDIGO, VIOLET, VOLT, OBSIDIAN, AURORA_GRADIENT } from "@/Components/Page/Home/v3/theme.v3";

/**
 * useVerticalAccent — the audit's cross-cutting primitive.
 *
 * Dynopay serves four product verticals:
 *   • merchants   → INDIGO (default, sell-a-product, storefront, invoices)
 *   • fundraisers → VIOLET (crowdfunding pay-links, donation checkout, goal bars)
 *   • creators    → VOLT-LIME (@handle page, tip checkout, creator settings)
 *   • developers  → OBSIDIAN + VOLT hits (API keys, docs, cURL playground)
 *
 * Today only the @handle public page routes correctly reflect the creator
 * vertical (`/[handle]`, `/[handle]/shop`). Everything else defaults to
 * indigo regardless of intent.
 *
 * This hook returns the accent set for the CURRENT route (via `useRouter`).
 * Callers can override with an explicit `vertical` arg — e.g. the
 * create-pay-link page passes `"fundraisers"` when the Crowdfunding tab is
 * active even though the route itself is still `/create-pay-link`.
 *
 * The returned object is memoised so consumers can safely spread it into
 * `styled()` args or MUI's `sx` prop without re-renders.
 */

export type Vertical = "merchants" | "fundraisers" | "creators" | "developers";

export interface VerticalAccent {
  vertical: Vertical;
  /** Solid brand colour to use for text ("Get paid **in crypto**") + button fills. */
  color: string;
  /** Deeper shade for hover / pressed states. */
  colorDeep: string;
  /** rgba(..) tint used for card backgrounds / hairline glows. */
  tint: string;
  /** Full aurora gradient — always identical (indigo → violet → sky) so the
   *  brand stays coherent across verticals; individual accents differentiate. */
  gradient: string;
  /** Contrast text colour for buttons filled with `color`. */
  onColor: string;
}

const ACCENTS: Record<Vertical, VerticalAccent> = {
  merchants: {
    vertical: "merchants",
    color: INDIGO,          // #4F46E5
    colorDeep: "#4338CA",
    tint: "rgba(79,70,229,0.10)",
    gradient: AURORA_GRADIENT,
    onColor: "#FFFFFF",
  },
  fundraisers: {
    vertical: "fundraisers",
    color: VIOLET,          // #7C5CFF
    colorDeep: "#5A3EFF",
    tint: "rgba(124,92,255,0.10)",
    gradient: AURORA_GRADIENT,
    onColor: "#FFFFFF",
  },
  creators: {
    vertical: "creators",
    color: INDIGO,          // unified indigo look (was VOLT #CCFF00)
    colorDeep: "#4338CA",
    tint: "rgba(79,70,229,0.10)",
    gradient: AURORA_GRADIENT,
    onColor: "#FFFFFF",
  },
  developers: {
    vertical: "developers",
    color: OBSIDIAN,        // #0B0B0F
    colorDeep: "#000000",
    tint: "rgba(11,11,15,0.06)",
    gradient: AURORA_GRADIENT,
    onColor: VOLT,          // volt lime on obsidian fill
  },
};

const VALID_VERTICALS: Vertical[] = ["merchants", "fundraisers", "creators", "developers"];

const ROUTE_MAP: Array<{ test: (path: string) => boolean; vertical: Vertical }> = [
  // Public marketing
  { test: (p) => p === "/for/creators" || p === "/creator", vertical: "creators" },
  { test: (p) => p === "/for/fundraisers", vertical: "fundraisers" },
  { test: (p) => p === "/for/developers", vertical: "developers" },
  { test: (p) => p === "/for/merchants", vertical: "merchants" },
  // In-app: creator settings + public @handle pages
  { test: (p) => p.startsWith("/[handle]") || p.startsWith("/@"), vertical: "creators" },
  // Developer surfaces
  { test: (p) => p === "/developer-keys" || p === "/documentation", vertical: "developers" },
];

/** Pick the accent for the current route unless the caller provides an override.
 *
 * Resolution priority (highest first):
 *   1. explicit `override` arg
 *   2. `user.purpose_vertical` from Redux (persisted at signup by PurposePicker → backend `tbl_user.purpose_vertical`)
 *   3. `dyno_purpose_vertical` from localStorage (client-side signal for logged-out or legacy users)
 *   4. route heuristic (matches `/for/*`, `/creator`, `/[handle]`, `/developer-keys`, `/documentation`)
 *   5. INDIGO merchants fallback
 */
export function useVerticalAccent(override?: Vertical): VerticalAccent {
  const router = useRouter();
  const profileVertical = useSelector((s: any) => {
    const raw = s?.userReducer?.profile?.purpose_vertical;
    return isVertical(raw) ? raw : null;
  });
  return useMemo(() => {
    if (override) return ACCENTS[override];
    if (profileVertical) return ACCENTS[profileVertical];
    // Client-only localStorage read — safe because `useMemo` runs on the
    // client; SSR pre-hydration will just show the route-heuristic accent
    // and swap seamlessly on first client render.
    let stored: Vertical | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("dyno_purpose_vertical");
        if (isVertical(raw)) stored = raw;
      } catch { /* noop */ }
    }
    if (stored) return ACCENTS[stored];
    const path = router?.pathname || "/";
    const match = ROUTE_MAP.find((r) => r.test(path));
    return ACCENTS[match?.vertical ?? "merchants"];
  }, [override, profileVertical, router?.pathname]);
}

const isVertical = (v: unknown): v is Vertical =>
  typeof v === "string" && (VALID_VERTICALS as string[]).includes(v);
