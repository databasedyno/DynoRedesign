import { Box, Typography, useTheme, keyframes } from "@mui/material";
import { Icon } from "@iconify/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StatusPill } from "@/Components/UI/_shared";
import type { CheckoutState } from "@/Components/UI/CheckoutShell";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * Format a whole-second countdown as `MM:SS`. Negative or non-finite input
 * collapses to "0:00" so the pill never renders NaN / minus signs.
 * Kept as a pure helper for testability.
 */
export const formatCountdown = (seconds: number | undefined | null): string => {
  const n = Math.max(0, Math.floor(Number.isFinite(Number(seconds)) ? Number(seconds) : 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/**
 * CheckoutStatusStrip — the compact "just the header strip" variant of
 * CheckoutShell, purpose-built to slot into surfaces that already own
 * their outer panel (notably CleanCheckoutV2 on `/pay/[id]`).
 *
 * CheckoutShell wraps its children in a full aurora-tinted panel — that's
 * fine for demos and the state playground, but the live v2 checkout has
 * its own PanelShell containing brand + amount + QR + confirmations. Two
 * nested panels would double-outline the card. This strip gives the same
 * status treatment (mono eyebrow · StatusPill · state icon · aurora pulse
 * for waiting states · sky spinner for confirming · coral shake for
 * failed) WITHOUT a wrapper — so v2 owns its own container and we contribute
 * only the top status row.
 *
 * ── Urgency ──
 * When `secondsRemaining` is passed and drops to ≤ 60 (while still > 0),
 * the strip switches into an "urgent" visual mode:
 *   • Border + tint shift to soft coral
 *   • A subtle coral pulse ripples across the container (2.4s ease-in-out
 *     loop, honours prefers-reduced-motion)
 *   • Title + caption are replaced with the localised urgent copy
 *     ("Only {{seconds}}s left · Complete your transfer now")
 * The base state (pending/confirming/etc.) is preserved so if the buyer
 * completes the tx in the last 30 seconds we still show the confirming
 * ring on top of the urgent framing.
 *
 * ── Localisation ──
 * Titles + captions + pill labels are pulled from the `landing` i18n
 * namespace under `checkout.strip.{state}.{title|caption|pill}`. English,
 * Portuguese, Spanish and French are shipped; other languages fall back
 * to the English defaultValue so nothing renders blank.
 *
 * The `settled` case is intentionally NOT rendered here — v2 already
 * navigates to its own success view when phase === 'confirmed', and fires
 * canvas-confetti there. Passing "settled" collapses this component to
 * `null` so pages don't need a conditional guard at the callsite.
 *
 * Motion honours `prefers-reduced-motion` (keyframes disabled in that MQ).
 */

interface Props {
  state: CheckoutState;
  /** Optional override; defaults to the localised per-state copy. */
  title?: string;
  /** Optional override for the caption. */
  caption?: string;
  /** Seconds remaining on the pay-link timer. Undefined = urgency logic disabled. */
  secondsRemaining?: number;
  /** Total reservation window (seconds). When > 0 a thin countdown progress bar
   *  runs along the strip's bottom edge and the MM:SS timer is always visible. */
  totalSeconds?: number;
  /** Test hook. */
  "data-testid"?: string;
}

const auroraPulse = keyframes`
  0%   { opacity: 0.35; transform: scale(1);   }
  50%  { opacity: 0.10; transform: scale(1.06); }
  100% { opacity: 0.35; transform: scale(1);   }
`;

const skySpin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const coralShake = keyframes`
  0%   { transform: translateX(0); }
  20%  { transform: translateX(-8px); }
  40%  { transform: translateX(8px); }
  60%  { transform: translateX(-4px); }
  80%  { transform: translateX(4px); }
  100% { transform: translateX(0); }
`;

// Soft coral urgency pulse — used when the pay link is within 60s of
// expiring. Ripples the border-color and background-color subtly so the
// buyer feels the pressure to finish without the whole card flashing.
const coralUrgent = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(255,91,73,0.32); }
  60%  { box-shadow: 0 0 0 10px rgba(255,91,73,0);  }
  100% { box-shadow: 0 0 0 0 rgba(255,91,73,0);    }
`;

/** Icon + pill tone per state. Copy comes from i18n at render time. */
const STATE_STYLE: Record<CheckoutState, { icon: string; pill: "settled" | "pending" | "failed" | "info" }> = {
  pending:    { icon: "mdi:clock-outline",        pill: "pending" },
  confirming: { icon: "mdi:progress-clock",       pill: "pending" },
  confirmed:  { icon: "mdi:check-decagram",       pill: "info"    },
  settled:    { icon: "mdi:check-circle-outline", pill: "settled" },
  failed:     { icon: "mdi:alert-circle-outline", pill: "failed"  },
};

// English fallbacks — used when a locale file is missing the strip keys.
// Should match `langs/locales/en/landing.json → checkout.strip.*`.
const FALLBACK_COPY: Record<CheckoutState, { pill: string; title: string; caption: string }> = {
  pending:    { pill: "WAITING",    title: "Waiting for your payment",  caption: "Send the exact amount below. Confirmation is automatic once we detect the transaction." },
  confirming: { pill: "CONFIRMING", title: "Broadcasting on-chain",     caption: "We saw your transaction. Confirmations usually take under a minute." },
  confirmed:  { pill: "CONFIRMED",  title: "Payment confirmed",         caption: "The network confirmed it. Settlement is in progress." },
  settled:    { pill: "SETTLED",    title: "You're all set",            caption: "Funds have cleared. A receipt is on its way." },
  failed:     { pill: "FAILED",     title: "Something went wrong",      caption: "The payment didn't complete. Nothing was charged — you can try again below." },
};

export default function CheckoutStatusStrip({ state, title, caption, secondsRemaining, totalSeconds, ...rest }: Props) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("landing");

  const style = STATE_STYLE[state];
  const fallback = FALLBACK_COPY[state];

  // ── Urgency: 0 < secondsRemaining ≤ 60 ────────────────────────────
  // We use `secondsRemaining` as passed by CleanCheckoutV2's timeLeft.
  // A `null` / `undefined` value disables the urgency logic entirely (the
  // pay-link either has no timer or hasn't been set up yet). Once the
  // timer reaches 0 the parent transitions to phase='expired' and the
  // strip returns null (state='failed' handled by parent branches).
  const isUrgent =
    typeof secondsRemaining === "number" &&
    secondsRemaining > 0 &&
    secondsRemaining <= 60;

  // ── Analytics: fire ONCE per urgent-open transition ────────────────
  // The `checkout_urgent_shown` telemetry event fires the first moment
  // urgency flips from off→on. If the buyer's timer resets (rare) and
  // urgency triggers again, we fire again — that's still meaningful
  // signal ("second urgent moment shown"). We do NOT refire on every
  // tick while urgent is active — that would flood analytics with N=60
  // events per checkout. `prevUrgentRef` gates the transition.
  //
  // Two channels are used simultaneously:
  //   1. `window.dispatchEvent(new CustomEvent("dynopay:checkout_urgent_shown", ...))`
  //      — for first-party analytics scripts loaded in the same window
  //   2. `window.parent.postMessage({ source: "dynopay", v: 1, type: "dynopay:checkout_urgent_shown", ... })`
  //      — for merchants who embed the checkout in an iframe on their own
  //        page (they can subscribe to this bus via their existing
  //        `dynopay:success` / `dynopay:resize` listeners).
  const prevUrgentRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isUrgent && !prevUrgentRef.current) {
      const payload = {
        state,
        secondsRemaining: typeof secondsRemaining === "number" ? secondsRemaining : null,
        at: Date.now(),
      };
      try {
        window.dispatchEvent(new CustomEvent("dynopay:checkout_urgent_shown", { detail: payload }));
      } catch { /* CustomEvent unsupported in ancient browsers — noop */ }
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { source: "dynopay", v: 1, type: "dynopay:checkout_urgent_shown", ...payload },
            "*",
          );
        }
      } catch { /* cross-origin postMessage may throw on some sandboxes */ }
    }
    prevUrgentRef.current = isUrgent;
  }, [isUrgent, state, secondsRemaining]);

  // v2 has its own success view; skip this strip to avoid duplicated copy.
  // Placed AFTER all hooks so hook order stays stable (react-hooks/rules-of-hooks).
  if (state === "settled") return null;

  // Base copy — either the caller override, the localised value, or the
  // English fallback (defaultValue on t()) so nothing renders blank.
  const baseTitle   = title   ?? t(`checkout.strip.${state}.title`,   { defaultValue: fallback.title });
  const baseCaption = caption ?? t(`checkout.strip.${state}.caption`, { defaultValue: fallback.caption });
  const pillLabel   =           t(`checkout.strip.${state}.pill`,     { defaultValue: fallback.pill });

  // Urgent copy overrides the base copy — the buyer needs to see the
  // countdown pressure immediately regardless of confirming/pending.
  const urgentTitle   = t("checkout.strip.urgent.title",   { defaultValue: `Only ${secondsRemaining ?? 0}s left`, seconds: secondsRemaining ?? 0 });
  const urgentCaption = t("checkout.strip.urgent.caption", { defaultValue: "Complete your transfer now — this pay link expires soon." });
  const urgentPill    = t("checkout.strip.urgent.pill",    { defaultValue: "HURRY" });

  const displayTitle   = isUrgent ? urgentTitle   : baseTitle;
  const displayCaption = isUrgent ? urgentCaption : baseCaption;
  const displayPill    = isUrgent ? urgentPill    : pillLabel;
  const displayPillTone: "settled" | "pending" | "failed" | "info" = isUrgent ? "failed" : style.pill;

  const showPulse = !isUrgent && (state === "pending" || state === "confirming");

  // Countdown progress (0–100) — only when the parent supplies a window.
  const hasTimer =
    typeof secondsRemaining === "number" && secondsRemaining > 0 && state !== "failed" && state !== "confirmed";
  const hasBar = hasTimer && typeof totalSeconds === "number" && totalSeconds > 0;
  const barPct = hasBar
    ? Math.max(0, Math.min(100, ((secondsRemaining as number) / (totalSeconds as number)) * 100))
    : 0;

  const coral = dark ? "#FF7A6B" : "#B91C1C";
  const indigo = dark ? "#818CF8" : BRAND_ACCENT;
  const hairline = dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,15,0.08)";
  const quietSurface = dark ? "rgba(255,255,255,0.03)" : "#FAFAFC";

  return (
    <Box
      data-testid={rest["data-testid"] || "checkout-status-strip"}
      data-state={state}
      data-urgent={isUrgent ? "1" : "0"}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "12px",
        padding: { xs: "12px 14px", md: "14px 16px" },
        paddingBottom: hasBar ? { xs: "15px", md: "17px" } : undefined,
        marginBottom: { xs: 2, md: 2.5 },
        border: `1px solid ${
          isUrgent
            ? (dark ? "rgba(255,91,73,0.42)" : "rgba(255,91,73,0.34)")
            : state === "failed"
              ? (dark ? "rgba(255,91,73,0.28)" : "rgba(255,91,73,0.22)")
              : hairline
        }`,
        backgroundColor:
          isUrgent
            ? (dark ? "rgba(255,91,73,0.08)" : "rgba(255,91,73,0.06)")
            : state === "failed"
              ? (dark ? "rgba(255,91,73,0.06)" : "rgba(255,91,73,0.05)")
              : quietSurface,
        animation: isUrgent
          ? `${coralUrgent} 2.4s ease-in-out infinite`
          : state === "failed" ? `${coralShake} 520ms cubic-bezier(0.36, 0.07, 0.19, 0.97) 1` : "none",
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        display: "flex",
        alignItems: "center",
        gap: { xs: 1.25, md: 1.5 },
      }}
    >
      {/* State icon */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            isUrgent ? "rgba(255,91,73,0.14)"
            : state === "failed" ? "rgba(255,91,73,0.14)"
            : (dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.10)"),
          color: isUrgent || state === "failed" ? coral : indigo,
        }}
      >
        {/* Gentle breathing ring while we wait — replaces the old blurred aurora blob. */}
        {showPulse && state === "pending" && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: -3,
              borderRadius: "12px",
              border: `1.5px solid ${indigo}`,
              opacity: 0.35,
              animation: `${auroraPulse} 2.4s ease-in-out infinite`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          />
        )}
        {state === "confirming" && !isUrgent && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: -3,
              borderRadius: "11px",
              border: "2px solid transparent",
              borderTopColor: indigo,
              borderRightColor: indigo,
              animation: `${skySpin} 1.1s linear infinite`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none", borderColor: indigo },
            }}
          />
        )}
        <Icon icon={isUrgent ? "mdi:timer-sand" : style.icon} width={20} />
      </Box>

      {/* Copy */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.35 }}>
          <StatusPill tone={displayPillTone} sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>
            {displayPill}
          </StatusPill>
        </Box>
        <Typography
          sx={{
            fontFamily: "var(--font-hero), var(--font-body)",
            fontSize: { xs: 14, md: 15 },
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            color: theme.palette.text.primary,
          }}
        >
          {displayTitle}
        </Typography>
        <Typography
          sx={{
            fontFamily: "var(--font-body)",
            fontSize: { xs: 12, md: 12.5 },
            color: theme.palette.text.secondary,
            lineHeight: 1.45,
            mt: 0.2,
          }}
        >
          {displayCaption}
        </Typography>
      </Box>

      {/* MM:SS live countdown — always visible while the window is open; quiet
          mono when calm, coral-framed once urgent (≤ 60s). Tabular-nums keeps
          the width stable between "1:00" and "0:59". */}
      {hasTimer && (
        <Box
          data-testid={isUrgent ? "checkout-strip-countdown" : "checkout-strip-timer"}
          sx={{
            position: "relative",
            zIndex: 1,
            flexShrink: 0,
            minWidth: isUrgent ? { xs: 58, md: 70 } : undefined,
            padding: isUrgent ? { xs: "6px 10px", md: "8px 14px" } : "0 2px",
            borderRadius: "10px",
            border: isUrgent ? `1px solid ${dark ? "rgba(255,91,73,0.42)" : "rgba(255,91,73,0.34)"}` : "none",
            backgroundColor: isUrgent ? (dark ? "rgba(255,91,73,0.10)" : "rgba(255,91,73,0.06)") : "transparent",
            textAlign: "center",
            fontFamily: "var(--font-tech), ui-monospace, SFMono-Regular, Menlo, monospace",
            fontVariantNumeric: "tabular-nums",
            fontWeight: isUrgent ? 700 : 600,
            fontSize: isUrgent ? { xs: 16, md: 20 } : { xs: 13, md: 14 },
            letterSpacing: "0.02em",
            color: isUrgent ? coral : theme.palette.text.secondary,
            lineHeight: 1,
            userSelect: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
          }}
          aria-live="polite"
          aria-label={`${formatCountdown(secondsRemaining)} remaining`}
        >
          {!isUrgent && <Icon icon="mdi:timer-outline" width={14} />}
          {formatCountdown(secondsRemaining)}
        </Box>
      )}

      {/* Countdown progress — thin bar hugging the strip's bottom edge. */}
      {hasBar && (
        <Box
          aria-hidden
          data-testid="checkout-strip-progress"
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.06)",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${barPct}%`,
              backgroundColor: isUrgent || barPct <= 20 ? coral : indigo,
              transition: "width 1s linear, background-color 300ms ease",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
