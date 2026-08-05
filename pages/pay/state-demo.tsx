import { Box, Typography, useTheme } from "@mui/material";
import Head from "next/head";
import { useEffect, useState } from "react";
import Pay3Layout from "@/Components/Layout/Pay3Layout";
import CheckoutShell, { CheckoutState } from "@/Components/UI/CheckoutShell";
import { Eyebrow, PillButton } from "@/Components/UI/_shared";

/**
 * /pay/state-demo — the 5-state playground for CheckoutShell.
 *
 * Consolidates what were previously three separate demo URLs
 * (`/pay/demo`, `/pay/donation-demo`, `/pay/success-demo`, `/pay/payment-states-demo`)
 * into a single URL with a state-picker at the top. Loading this URL with
 * `?state=settled` etc. jumps straight to that state — useful for
 * screenshots, marketing shots, and pen-testing per-state copy.
 *
 * The page is intentionally *not* linked from the app nav — it's an
 * internal demo surface for QA + design review, gated only by the URL.
 */

const STATES: CheckoutState[] = ["pending", "confirming", "confirmed", "settled", "failed"];

const CheckoutStateDemo = () => {
  const theme = useTheme();
  // SSR-safe default. The URL query is read after mount to avoid the
  // `window is not defined` / server-vs-client mismatch (React #418) that
  // fires on Next.js pages when useState-init touches `window.location`.
  const [state, setState] = useState<CheckoutState>("pending");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("state");
    if (q && (STATES as string[]).includes(q)) setState(q as CheckoutState);
  }, []);

  return (
    <Pay3Layout>
      <Head>
        <title>Checkout state demo · Dynopay</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <Box sx={{ maxWidth: 640, mx: "auto", px: { xs: 2, md: 3 }, pt: { xs: 3, md: 5 }, pb: 8 }}>
        {/* Eyebrow */}
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <Eyebrow tone="ink" sx={{ letterSpacing: "0.28em" }}>Checkout state playground</Eyebrow>
        </Box>
        <Typography
          sx={{
            fontFamily: "var(--font-hero), var(--font-body)",
            fontSize: { xs: 22, md: 28 },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            textAlign: "center",
            lineHeight: 1.15,
            mb: 2.5,
          }}
        >
          The five states of a Dynopay checkout
        </Typography>

        {/* State picker */}
        <Box
          data-testid="state-picker"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            justifyContent: "center",
            mb: 3,
          }}
        >
          {STATES.map((s) => (
            <PillButton
              key={s}
              active={s === state}
              data-testid={`pick-${s}`}
              onClick={() => setState(s)}
              sx={{ textTransform: "capitalize" }}
            >
              {s}
            </PillButton>
          ))}
        </Box>

        {/* The shell + a mock body */}
        <CheckoutShell state={state} data-testid="demo-checkout-shell">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 2 }}>
              <Typography sx={{ fontFamily: "var(--font-body)", fontSize: 13, color: theme.palette.text.secondary }}>
                Total due
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-hero), var(--font-body)",
                  fontSize: { xs: 30, md: 40 },
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: theme.palette.text.primary,
                }}
              >
                $50.00
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-tech), monospace", fontSize: 12.5, color: theme.palette.text.secondary }}>
              <span>0.00077975 BTC</span>
              <span>bc1q…hkru</span>
            </Box>
            <Box
              sx={{
                mt: 1,
                p: 2,
                borderRadius: "12px",
                border: `1px dashed ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(10,10,15,0.10)"}`,
                fontFamily: "var(--font-body)",
                fontSize: 12.5,
                color: theme.palette.text.secondary,
                lineHeight: 1.55,
                textAlign: "center",
              }}
            >
              This block simulates the checkout body (QR, address, timer). The animation, headline
              and status pill above are all provided by <code>&lt;CheckoutShell state=&quot;{state}&quot;&gt;</code>.
            </Box>
          </Box>
        </CheckoutShell>
      </Box>
    </Pay3Layout>
  );
};

CheckoutStateDemo.displayName = "CheckoutStateDemo";
export default CheckoutStateDemo;
