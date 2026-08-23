import { Box, Typography, useTheme, keyframes } from "@mui/material";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVerticalAccent, StatusPill, AURORA_GRADIENT_SOFT } from "@/Components/UI/_shared";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * CheckoutShell — the 5-state animated wrapper for every buyer-facing
 * checkout screen (`/pay/*`, `/order/*`, `/[handle]` tip flow, donation
 * confirmation). Shipped as part of the 2026-08-05 design audit Phase 5.
 *
 * The five states mirror the on-chain payment lifecycle:
 *
 *   pending    — buyer just committed; we're waiting for their wallet to
 *                broadcast. Subtle aurora pulse behind the amount so it
 *                doesn't feel frozen.
 *   confirming — tx is in the mempool / early confirmations. Sky-blue
 *                animated progress ring around the coin logo.
 *   confirmed  — enough confirmations, funds recognised but not yet swept.
 *                Volt-lime fade-in on the status strip.
 *   settled    — funds cleared to the merchant's account. Volt-lime
 *                CONFETTI burst (canvas, ~60 particles, 1.6s single shot,
 *                respects prefers-reduced-motion) + a big check-mark.
 *   failed     — unrecoverable failure (dust, expired, refunded, chain
 *                error). One-shot coral horizontal shake on the container.
 *
 * The shell is purposely presentational — it doesn't call any APIs or
 * subscribe to sockets. Parent checkout pages own the state machine and
 * pass the current state as a prop. This keeps the animations decoupled
 * from the polling / WS logic in `/pay/index.tsx`.
 *
 * Motion is disabled entirely when the OS reports `prefers-reduced-motion`.
 */

export type CheckoutState = "pending" | "confirming" | "confirmed" | "settled" | "failed";

interface CheckoutShellProps {
  state: CheckoutState;
  children: React.ReactNode;
  /** Optional headline shown in the status strip. Defaults per state. */
  title?: string;
  /** Optional supporting caption below the headline. */
  caption?: string;
  /** Test hook. */
  "data-testid"?: string;
}

/* ── keyframes ───────────────────────────────────────────────────────── */

const auroraPulse = keyframes`
  0%   { opacity: 0.35; transform: scale(1);   }
  50%  { opacity: 0.62; transform: scale(1.08); }
  100% { opacity: 0.35; transform: scale(1);   }
`;

const skySpin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const coralShake = keyframes`
  0%   { transform: translateX(0); }
  20%  { transform: translateX(-10px); }
  40%  { transform: translateX(10px); }
  60%  { transform: translateX(-6px); }
  80%  { transform: translateX(6px); }
  100% { transform: translateX(0); }
`;

const voltFadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0);   }
`;

/* ── copy defaults per state ─────────────────────────────────────────── */
/**
 * English fallbacks — used when a locale file is missing the strip keys.
 * Should match `langs/locales/en/landing.json → checkout.strip.*`.
 * The shell picks up localised copy through `useTranslation("landing")`
 * so QA can review the full-shell playground in any of the 6 preview
 * locales alongside the compact strip variant.
 */
const STATE_META: Record<CheckoutState, { icon: string; pillTone: "settled" | "pending" | "failed" | "info"; label: string; title: string; caption: string }> = {
  pending:    { icon: "mdi:clock-outline",        pillTone: "pending", label: "PENDING",    title: "Waiting for your payment",      caption: "Send the exact amount to the address below. We'll confirm automatically once it hits the mempool." },
  confirming: { icon: "mdi:progress-clock",       pillTone: "pending", label: "CONFIRMING", title: "Broadcasting on-chain",         caption: "Your transaction is in the mempool. Confirmations usually take under a minute." },
  confirmed:  { icon: "mdi:check-decagram",       pillTone: "info",    label: "CONFIRMED",  title: "Payment confirmed",             caption: "The network confirmed your transaction. Funds are being settled to the merchant right now." },
  settled:    { icon: "mdi:check-circle-outline", pillTone: "settled", label: "SETTLED",    title: "You're all set 🎉",             caption: "Funds have cleared. A receipt is on its way to your email." },
  failed:     { icon: "mdi:alert-circle-outline", pillTone: "failed",  label: "FAILED",     title: "Something went wrong",          caption: "The payment didn't complete. Nothing was charged — you can try again below." },
};

/* ── confetti canvas (one-shot on settle) ────────────────────────────── */

interface Particle { x: number; y: number; vx: number; vy: number; size: number; rot: number; vr: number; color: string; life: number; }

function ConfettiCanvas({ trigger }: { trigger: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!trigger) return;
    if (typeof window === "undefined") return;
    // Respect reduced-motion preference — skip the confetti entirely.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Size to parent
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    ctx.scale(dpr, dpr);

    const colors = ["#3FD98A", "#7C5CFF", BRAND_ACCENT, "#4FD1FF", "#FFFFFF"];
    const particles: Particle[] = [];
    const originX = parent.clientWidth / 2;
    const originY = parent.clientHeight / 3.2;
    for (let i = 0; i < 70; i++) {
      const angle = (Math.PI * 2 * i) / 70 + (Math.random() - 0.5) * 0.4;
      const speed = 6 + Math.random() * 6;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // slight upward bias
        size: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }

    let raf: number;
    let elapsed = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      elapsed = now - startedAt;
      ctx.clearRect(0, 0, parent.clientWidth, parent.clientHeight);
      particles.forEach((p) => {
        p.vy += 0.22; // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - elapsed / 1600);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (elapsed < 1600) {
        raf = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, parent.clientWidth, parent.clientHeight);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); };
  }, [trigger]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 3,
      }}
    />
  );
}

/* ── main component ─────────────────────────────────────────────────── */

export default function CheckoutShell({ state, children, title, caption, ...rest }: CheckoutShellProps) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const accent = useVerticalAccent();
  const { t } = useTranslation("landing");
  const meta = STATE_META[state];
  const [confettiTick, setConfettiTick] = useState(0);

  // Localised copy — reuses the same `checkout.strip.*` block that the
  // compact CheckoutStatusStrip variant reads, so QA can review either
  // shell in any of the 6 preview locales without duplicating keys.
  // For the `settled` state we prefer the English 🎉 emoji title because
  // the celebratory microcopy diverges from the strip's clinical "SETTLED"
  // — locales use `settled.title` in the strip; the shell falls back to
  // that too but keeps the emoji when locale keys are missing.
  const localisedTitle   = title   ?? t(`checkout.strip.${state}.title`,   { defaultValue: meta.title });
  const localisedCaption = caption ?? t(`checkout.strip.${state}.caption`, { defaultValue: meta.caption });
  const localisedPill    =           t(`checkout.strip.${state}.pill`,    { defaultValue: meta.label });

  // Fire the confetti once per settle transition (not on every re-render
  // that happens to have `state === "settled"`).
  const prevState = useRef<CheckoutState>(state);
  useEffect(() => {
    if (prevState.current !== "settled" && state === "settled") {
      setConfettiTick((n) => n + 1);
    }
    prevState.current = state;
  }, [state]);

  const shellSx = useMemo(() => ({
    position: "relative",
    overflow: "hidden",
    borderRadius: "20px",
    background: dark ? "#0F1015" : "#FFFFFF",
    border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.06)"}`,
    boxShadow: dark
      ? "0 20px 60px rgba(0,0,0,0.36)"
      : "0 20px 60px rgba(10,10,15,0.08)",
    animation: state === "failed" ? `${coralShake} 520ms cubic-bezier(0.36, 0.07, 0.19, 0.97) 1` : "none",
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  }), [state, dark]);

  return (
    <Box data-testid={rest["data-testid"] || "checkout-shell"} data-state={state} sx={shellSx}>
      {/* Aurora pulse blob — only during pending / confirming */}
      {(state === "pending" || state === "confirming") && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: -160,
            right: -160,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: AURORA_GRADIENT_SOFT,
            filter: "blur(80px)",
            opacity: dark ? 0.4 : 0.55,
            pointerEvents: "none",
            zIndex: 0,
            animation: `${auroraPulse} 3.2s ease-in-out infinite`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
      )}

      {/* Confetti canvas — mounted only on settle transitions */}
      {confettiTick > 0 && state === "settled" && (
        <ConfettiCanvas key={confettiTick} trigger />
      )}

      {/* Status strip (top) */}
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          padding: { xs: "16px 18px", md: "18px 24px" },
          borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)"}`,
          animation: state === "confirmed" || state === "settled"
            ? `${voltFadeIn} 380ms ease-out both`
            : "none",
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        {/* State icon */}
        <Box
          sx={{
            position: "relative",
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              state === "settled" ? "rgba(5,177,105,0.16)"
              : state === "failed" ? "rgba(255,91,73,0.14)"
              : state === "confirmed" ? "rgba(129,140,248,0.14)"
              : "rgba(79,70,229,0.10)",
            color:
              state === "settled" ? (dark ? "#3FD98A" : "#05936A")
              : state === "failed" ? (dark ? "#FF7A6B" : "#B91C1C")
              : state === "confirmed" ? (dark ? "#818CF8" : BRAND_ACCENT)
              : (dark ? "#818CF8" : accent.color),
          }}
        >
          {/* Sky-blue spinning ring during confirming */}
          {state === "confirming" && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: -3,
                borderRadius: "13px",
                border: "2px solid transparent",
                borderTopColor: "#4FD1FF",
                borderRightColor: "#4FD1FF",
                animation: `${skySpin} 1.1s linear infinite`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none", borderColor: "#4FD1FF" },
              }}
            />
          )}
          <Icon icon={meta.icon} width={24} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <StatusPill tone={meta.pillTone}>{localisedPill}</StatusPill>
          </Box>
          <Typography
            sx={{
              fontFamily: "var(--font-hero), var(--font-body)",
              fontSize: { xs: 15, md: 17 },
              fontWeight: 700,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              color: theme.palette.text.primary,
            }}
          >
            {localisedTitle}
          </Typography>
          <Typography
            sx={{
              fontFamily: "var(--font-body)",
              fontSize: { xs: 12.5, md: 13.5 },
              color: theme.palette.text.secondary,
              lineHeight: 1.5,
              mt: 0.3,
            }}
          >
            {localisedCaption}
          </Typography>
        </Box>
      </Box>

      {/* Content slot */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          padding: { xs: "18px", md: "24px" },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
