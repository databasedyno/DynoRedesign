import type { Vertical } from "@/Components/UI/_shared";

/**
 * Vertical → first-run onboarding destination map.
 *
 * Shipped as part of the 2026-08-05 design audit — vertical-specific
 * onboarding routing. After a new user signs up with a purpose pill
 * selection (creators / merchants / fundraisers / developers), we drop them
 * into the setup surface most relevant to their intent instead of a
 * one-size-fits-all "/dashboard".
 *
 *   creators    → /get-started                 (guided wizard — secure → about → payouts →
 *                                               claim @handle → share your page)
 *   merchants   → /get-started                 (guided 5-step wizard — secure → about → payout wallet → first link → share)
 *   fundraisers → /get-started                 (guided wizard — secure → about → payouts →
 *                                               first campaign → share your campaign)
 *   developers  → /get-started                 (same guided wizard — secure → about → payouts →
 *                                               API key → test payment)
 *
 * Before 2026-10-01 only merchants/developers got the wizard; creators were
 * sent to /creator (→ /storefront) and fundraisers to /create-pay-link, both
 * skipping 2FA / payout / first-artefact setup. Now all four share it.
 *
 * `null` = unknown vertical → falls through to /dashboard (safe default,
 * matches pre-audit behaviour).
 *
 * The `?onboarding=1` query param is appended so downstream pages can:
 *   • show a compact "Welcome — let's set up your …" eyebrow
 *   • surface a "Skip setup, go to dashboard →" link
 *   • fire an analytics event scoped to first-run
 */

export interface OnboardingDestination {
  path: string;
  /** Short label used by pages to show the first-run eyebrow. */
  label: string;
}

const DESTINATIONS: Record<Vertical, OnboardingDestination> = {
  creators: {
    // The wizard reads purpose_vertical and swaps its last two steps for
    // "Claim your @handle" + "Share your page" (Components/Page/GetStarted).
    path: "/get-started",
    label: "creator page",
  },
  merchants: {
    path: "/get-started",
    label: "first payment link",
  },
  fundraisers: {
    // The wizard swaps its last two steps for "Your first campaign" +
    // "Share your campaign" (Components/Page/GetStarted).
    path: "/get-started",
    label: "campaign page",
  },
  developers: {
    // The wizard reads purpose_vertical and swaps its last two steps for
    // "Your API key" + "Make a test payment" (Components/Page/GetStarted).
    path: "/get-started",
    label: "API access",
  },
};

/**
 * Returns the onboarding destination for a given vertical.
 *
 * @param vertical The user's declared purpose_vertical (from the PurposePicker),
 *                 or null/undefined for legacy users who signed up before the
 *                 picker existed.
 * @returns {OnboardingDestination | null} — null means "no vertical-specific
 *          route, use /dashboard".
 */
export function verticalToOnboarding(vertical: Vertical | null | undefined): OnboardingDestination | null {
  if (!vertical) return null;
  return DESTINATIONS[vertical] || null;
}

/**
 * Convenience: given a vertical (which may be null), returns the path to
 * navigate to after signup. Always returns a valid path — falls back to
 * /dashboard for unknown / missing verticals.
 */
export function verticalToNextPath(vertical: Vertical | null | undefined): string {
  return verticalToOnboarding(vertical)?.path ?? "/dashboard";
}
