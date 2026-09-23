/**
 * WalletActionButton — lazy shell for "Pay with wallet" / "Verify with wallet".
 * Renders a plain brand button; on first click it loads the Reown AppKit bundle
 * (`ensureAppKit`) and mounts <WalletAction autoStart/>. Nothing wallet-related
 * is downloaded until the user asks for it.
 */
import React, { lazy, Suspense, useCallback, useState } from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { ensureAppKit, isWalletKitConfigured } from "@/lib/wallet/appkit";
import { isWalletPayable } from "@/lib/wallet/rails";
import type { WalletActionBrand, WalletActionProps } from "./WalletAction";

const WalletAction = lazy(() => import("./WalletAction"));

export const DYNOPAY_WALLET_BRAND = (dark: boolean): WalletActionBrand => ({
  accent: "#FFD100",
  onAccent: "#2B1D14",
  ink: dark ? "#FAF6EF" : "#1F140D",
  muted: dark ? "rgba(250,246,239,0.66)" : "#6B5E52",
  border: dark ? "rgba(255,255,255,0.14)" : "#E8DFD2",
  surface: dark ? "#111114" : "#FFFFFF",
  success: "#10B981",
  danger: dark ? "#F87171" : "#B42318",
  radius: "999px",
});

export const SAFEDEAL_WALLET_BRAND: WalletActionBrand = {
  accent: "#FFC61A",
  onAccent: "#0A0A0B",
  ink: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  surface: "#FFFFFF",
  success: "#059669",
  danger: "#B91C1C",
  radius: 99,
};

export type WalletActionButtonProps = Omit<WalletActionProps, "autoStart" | "brand"> & {
  brand?: WalletActionBrand;
  /** Small caption under the button in idle state. */
  hint?: string;
};

const WalletActionButton: React.FC<WalletActionButtonProps> = ({ brand, hint, ...rest }) => {
  const compact = !!rest.compact;
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const b = brand || DYNOPAY_WALLET_BRAND(dark);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");

  const load = useCallback(async () => {
    setState("loading");
    try {
      await ensureAppKit(dark ? "dark" : "light");
      setState("ready");
    } catch (e) {
      console.error("[wallet] AppKit failed to load", e);
      setState("failed");
    }
  }, [dark]);

  if (!isWalletKitConfigured() || !isWalletPayable(rest.code)) return null;

  if (state === "ready") {
    return (
      <Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", py: 1 }}><CircularProgress size={18} sx={{ color: b.accent }} /></Box>}>
        <WalletAction {...rest} brand={b} autoStart />
      </Suspense>
    );
  }

  const label = rest.mode === "pay" ? (rest.labels?.pay || `Pay ${rest.amount ? `${rest.amount} ` : ""}with wallet`) : (rest.labels?.verify || "Verify with wallet");
  return (
    <Box data-testid={rest.testId} data-phase={state} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box
        component="button"
        type="button"
        onClick={() => void load()}
        disabled={state === "loading"}
        data-testid={`${rest.testId}-btn`}
        sx={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, width: "100%", minHeight: compact ? 40 : 48,
          borderRadius: b.radius, border: "none", cursor: "pointer", fontSize: compact ? 13 : 14, fontWeight: 700, fontFamily: b.font || "inherit",
          backgroundColor: b.accent, color: b.onAccent, transition: "filter .15s ease, transform .05s ease",
          "&:hover": { filter: "brightness(1.05)" }, "&:active": { transform: "scale(0.99)" }, "&:disabled": { opacity: 0.75, cursor: "progress" },
          "&:focus-visible": { outline: `2px solid ${b.accent}`, outlineOffset: 3 },
        }}
      >
        {state === "loading" ? <CircularProgress size={16} thickness={5} sx={{ color: b.onAccent }} /> : <Icon icon="mdi:wallet-outline" width={18} />}
        {state === "loading" ? "Loading wallets…" : label}
      </Box>
      {state === "failed" ? (
        <Typography role="alert" data-testid={`${rest.testId}-error`} sx={{ fontSize: 12, color: b.danger, textAlign: "center" }}>Wallet connection is unavailable right now — use the QR code or copy the address instead.</Typography>
      ) : hint ? (
        <Typography sx={{ fontSize: 11.5, color: b.muted, textAlign: "center" }}>{hint}</Typography>
      ) : null}
    </Box>
  );
};

export default WalletActionButton;
