import { Box, Typography, useTheme, keyframes } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { StatusPill, AURORA_GRADIENT_SOFT } from "@/Components/UI/_shared";
import type { CheckoutState } from "@/Components/UI/CheckoutShell";

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
  /** Test hook. */
  "data-testid"?: string;
}

const auroraPulse = keyframes`
  0%   { opacity: 0.30; transform: scale(1);   }
  50%  { opacity: 0.55; transform: scale(1.08); }
  100% { opacity: 0.30; transform: scale(1);   }
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
  pending:    { pill: "WAITING",    title: "Waiting for your wallet",   caption: "Send the exact amount below. Confirmation is automatic once it hits the mempool." },
  confirming: { pill: "CONFIRMING", title: "Broadcasting on-chain",     caption: "We saw your transaction. Confirmations usually take under a minute." },
  confirmed:  { pill: "CONFIRMED",  title: "Payment confirmed",         caption: "The network confirmed it. Settlement is in progress." },
  settled:    { pill: "SETTLED",    title: "You're all set",            caption: "Funds have cleared. A receipt is on its way." },
  failed:     { pill: "FAILED",     title: "Something went wrong",      caption: "The payment didn't complete. Nothing was charged — you can try again below." },
};

export default function CheckoutStatusStrip({ state, title, caption, secondsRemaining, ...rest }: Props) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("landing");

  // v2 has its own success view; skip this strip to avoid duplicated copy.
  if (state === "settled") return null;

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

  return (
    <Box
      data-testid={rest["data-testid"] || "checkout-status-strip"}
      data-state={state}
      data-urgent={isUrgent ? "1" : "0"}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "14px",
        padding: { xs: "12px 14px", md: "14px 18px" },
        marginBottom: { xs: 2, md: 2.5 },
        border: `1px solid ${
          isUrgent
            ? (dark ? "rgba(255,91,73,0.42)" : "rgba(255,91,73,0.34)")
            : state === "failed"
              ? (dark ? "rgba(255,91,73,0.28)" : "rgba(255,91,73,0.22)")
              : (dark ? "rgba(129,140,248,0.22)" : "rgba(79,70,229,0.14)")
        }`,
        backgroundColor:
          isUrgent
            ? (dark ? "rgba(255,91,73,0.08)" : "rgba(255,91,73,0.06)")
            : state === "failed"
              ? (dark ? "rgba(255,91,73,0.06)" : "rgba(255,91,73,0.05)")
              : (dark ? "rgba(129,140,248,0.05)" : "rgba(79,70,229,0.03)"),
        animation: isUrgent
          ? `${coralUrgent} 2.4s ease-in-out infinite`
          : state === "failed" ? `${coralShake} 520ms cubic-bezier(0.36, 0.07, 0.19, 0.97) 1` : "none",
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        display: "flex",
        alignItems: "center",
        gap: { xs: 1.25, md: 1.5 },
      }}
    >
      {/* Aurora pulse blob — only during waiting states + only when not urgent
          (the urgent coral pulse takes over the visual channel). */}
      {showPulse && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: -110,
            right: -110,
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: AURORA_GRADIENT_SOFT,
            filter: "blur(50px)",
            opacity: dark ? 0.4 : 0.5,
            pointerEvents: "none",
            zIndex: 0,
            animation: `${auroraPulse} 3.2s ease-in-out infinite`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
      )}

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
            : state === "confirmed" ? "rgba(129,140,248,0.14)"
            : (dark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.10)"),
          color:
            isUrgent ? (dark ? "#FF7A6B" : "#B91C1C")
            : state === "failed" ? (dark ? "#FF7A6B" : "#B91C1C")
            : (dark ? "#818CF8" : "#4F46E5"),
        }}
      >
        {state === "confirming" && !isUrgent && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: -3,
              borderRadius: "11px",
              border: "2px solid transparent",
              borderTopColor: "#4FD1FF",
              borderRightColor: "#4FD1FF",
              animation: `${skySpin} 1.1s linear infinite`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none", borderColor: "#4FD1FF" },
            }}
          />
        )}
        <Icon icon={isUrgent ? "mdi:timer-sand" : style.icon} width={20} />
      </Box>

      {/* Copy */}
      <Box sx={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.35 }}>
          <StatusPill tone={displayPillTone}>{displayPill}</StatusPill>
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
    </Box>
  );
}
