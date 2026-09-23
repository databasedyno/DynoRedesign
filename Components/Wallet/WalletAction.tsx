/**
 * WalletAction — the interactive half of "Pay with wallet" / "Verify with wallet".
 * Only mounted after `ensureAppKit()` resolved (see WalletActionButton), so AppKit hooks are safe.
 *
 *   mode="pay"    → connect (right namespace) → switch chain (EVM) → send the exact amount → hash
 *   mode="verify" → connect → connected address must equal `address` → sign nonce message → submit
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAppKit, useAppKitAccount, useAppKitProvider, useAppKitState, useDisconnect, useWalletInfo } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { CAIP_NAMESPACE, walletRailFor } from "@/lib/wallet/rails";
import { sendEvmPayment, sendSolanaPayment, sendTronPayment, signEvmMessage, signSolanaMessage, signTronMessage } from "@/lib/wallet/actions";
import type { EvmProvider, SolanaProvider, TronProvider } from "@/lib/wallet/actions";

export interface WalletActionBrand {
  accent: string;
  onAccent: string;
  ink: string;
  muted: string;
  border: string;
  surface: string;
  success: string;
  danger: string;
  radius: number | string;
  font?: string;
}

export interface WalletActionProps {
  mode: "pay" | "verify";
  code: string;
  address: string;
  amount?: string;
  brand: WalletActionBrand;
  testId: string;
  autoStart?: boolean;
  /** Inline / smaller variant (settings rows). */
  compact?: boolean;
  requestNonce?: () => Promise<{ nonce: string; message: string }>;
  submitSignature?: (p: { nonce: string; signature: string; wallet_name: string; connected_address: string }) => Promise<void>;
  onSubmitted?: (p: { hash: string; from: string; wallet_name: string; explorer: string }) => void;
  onVerified?: () => void;
  labels?: Partial<{ pay: string; verify: string; connecting: string; working: string; sent: string; verified: string; switchWallet: string }>;
}

type Phase = "idle" | "connecting" | "working" | "sent" | "verified" | "error";

const short = (a: string) => (a && a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const same = (family: string, a: string, b: string) => (family === "evm" ? a.toLowerCase() === b.toLowerCase() : a === b);

function friendlyError(e: any): string {
  const m = String(e?.shortMessage || e?.message || e || "");
  if (/reject|denied|cancel/i.test(m)) return "Request cancelled in the wallet.";
  if (/insufficient|exceeds balance|not enough/i.test(m)) return "Not enough balance in the connected wallet (amount + network fee).";
  if (/chain|network/i.test(m) && /switch|unsupported|not added/i.test(m)) return "Your wallet couldn't switch to the required network. Switch it manually and try again.";
  if (/Unsupported method|not supported/i.test(m)) return "This wallet doesn't support that action — try a different wallet.";
  return m.length > 160 ? `${m.slice(0, 157)}…` : m || "Something went wrong.";
}

const WalletAction: React.FC<WalletActionProps> = ({ mode, code, address, amount, brand, testId, autoStart = true, compact = false, requestNonce, submitSignature, onSubmitted, onVerified, labels = {} }) => {
  const rail = walletRailFor(code);
  const ns = rail ? CAIP_NAMESPACE[rail.family] : "eip155";
  const { open } = useAppKit();
  const { open: modalOpen } = useAppKitState();
  const { address: connected, isConnected } = useAppKitAccount({ namespace: ns });
  const { walletProvider } = useAppKitProvider<EvmProvider & SolanaProvider & TronProvider>(ns);
  const { walletInfo } = useWalletInfo(ns);
  const { connection } = useAppKitConnection();
  const { disconnect } = useDisconnect();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<{ hash: string; explorer: string } | null>(null);
  const pending = useRef(false);
  const started = useRef(false);
  const busy = useRef(false);

  const walletName = walletInfo?.name || "wallet";

  const run = useCallback(async () => {
    if (!rail || !walletProvider || !connected || busy.current) return;
    busy.current = true;
    setError("");
    setPhase("working");
    try {
      if (mode === "pay") {
        const amt = String(amount || "");
        let hash = "";
        if (rail.family === "evm") hash = await sendEvmPayment(walletProvider, rail, connected, address, amt);
        else if (rail.family === "solana") hash = await sendSolanaPayment(walletProvider, connection, rail, connected, address, amt);
        else hash = await sendTronPayment(walletProvider, rail, connected, address, amt, walletInfo?.type === "WALLET_CONNECT");
        const explorer = rail.explorerTx(hash);
        setResult({ hash, explorer });
        setPhase("sent");
        onSubmitted?.({ hash, from: connected, wallet_name: walletName, explorer });
      } else {
        if (!same(rail.family, connected, address)) {
          setPhase("error");
          setError(`Connected wallet is ${short(connected)} — this address belongs to a different wallet. Switch to the wallet that owns ${short(address)}.`);
          return;
        }
        const { nonce, message } = await requestNonce!();
        let signature = "";
        if (rail.family === "evm") signature = await signEvmMessage(walletProvider, connected, message);
        else if (rail.family === "solana") signature = await signSolanaMessage(walletProvider, message);
        else signature = await signTronMessage(walletProvider, connected, message);
        await submitSignature!({ nonce, signature, wallet_name: walletName, connected_address: connected });
        setPhase("verified");
        onVerified?.();
      }
    } catch (e: any) {
      setPhase("error");
      setError(friendlyError(e?.response?.data?.message ? { message: e.response.data.message } : e));
    } finally {
      busy.current = false;
    }
  }, [rail, walletProvider, connected, mode, amount, address, connection, onSubmitted, walletName, walletInfo?.type, requestNonce, submitSignature, onVerified]);

  const start = useCallback(async () => {
    setError("");
    if (isConnected && walletProvider) {
      void run();
      return;
    }
    pending.current = true;
    setPhase("connecting");
    await open({ view: "Connect", namespace: ns });
  }, [isConnected, walletProvider, run, open, ns]);

  // Auto-run once after the connection arrives; reset if the modal closed without connecting.
  useEffect(() => {
    if (pending.current && isConnected && walletProvider) {
      pending.current = false;
      void run();
    } else if (pending.current && !modalOpen && !isConnected) {
      pending.current = false;
      setPhase("idle");
    }
  }, [isConnected, walletProvider, modalOpen, run]);

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void start();
    }
  }, [autoStart, start]);

  const switchWallet = useCallback(async () => {
    try { await disconnect({ namespace: ns }); } catch { /* ignore */ }
    setPhase("idle");
    setError("");
    void start();
  }, [disconnect, ns, start]);

  if (!rail) return null;

  const btnBase = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, width: "100%", minHeight: compact ? 40 : 48,
    borderRadius: brand.radius, border: "none", cursor: "pointer", fontSize: compact ? 13 : 14, fontWeight: 700, fontFamily: brand.font || "inherit",
    backgroundColor: brand.accent, color: brand.onAccent, transition: "filter .15s ease, transform .05s ease",
    "&:hover": { filter: "brightness(1.05)" }, "&:active": { transform: "scale(0.99)" }, "&:disabled": { opacity: 0.7, cursor: "progress" },
  } as const;

  const label = phase === "connecting" ? (labels.connecting || "Connect your wallet…")
    : phase === "working" ? (labels.working || (mode === "pay" ? `Confirm in ${walletName}…` : `Sign in ${walletName}…`))
    : mode === "pay" ? (labels.pay || `Pay ${amount} ${rail.symbol} with wallet`) : (labels.verify || "Verify with wallet");

  return (
    <Box data-testid={testId} data-phase={phase} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {phase === "sent" && result ? (
        <Box data-testid={`${testId}-sent`} sx={{ p: 1.5, borderRadius: brand.radius, border: `1px solid ${brand.success}55`, backgroundColor: `${brand.success}14`, display: "flex", gap: 1, alignItems: "flex-start" }}>
          <Icon icon="mdi:check-circle" width={20} color={brand.success} style={{ flexShrink: 0, marginTop: 1 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: brand.ink }}>{labels.sent || "Transaction sent from your wallet"}</Typography>
            <Typography sx={{ fontSize: 12, color: brand.muted, mt: 0.25 }}>
              We&apos;ll confirm automatically once the {rail.networkLabel} network does.{" "}
              <Box component="a" href={result.explorer} target="_blank" rel="noopener noreferrer" data-testid={`${testId}-explorer`} sx={{ color: brand.ink, fontFamily: "monospace", textDecoration: "underline" }}>{short(result.hash)}</Box>
            </Typography>
          </Box>
        </Box>
      ) : phase === "verified" ? (
        <Box data-testid={`${testId}-verified`} sx={{ display: "flex", alignItems: "center", gap: 0.75, color: brand.success, fontSize: 13.5, fontWeight: 700 }}>
          <Icon icon="mdi:shield-check" width={20} /> {labels.verified || `Verified with ${walletName}`}
        </Box>
      ) : (
        <>
          <Box component="button" type="button" onClick={() => void start()} disabled={phase === "connecting" || phase === "working"} data-testid={`${testId}-btn`} sx={btnBase}>
            {phase === "connecting" || phase === "working" ? <CircularProgress size={16} thickness={5} sx={{ color: brand.onAccent }} /> : <Icon icon="mdi:wallet-outline" width={18} />}
            {label}
          </Box>
          {isConnected && connected && phase !== "working" && (
            <Typography data-testid={`${testId}-connected`} sx={{ fontSize: 11.5, color: brand.muted, textAlign: "center" }}>
              {walletName} · <Box component="span" sx={{ fontFamily: "monospace" }}>{short(connected)}</Box> ·{" "}
              <Box component="button" type="button" onClick={() => void switchWallet()} data-testid={`${testId}-switch`} sx={{ all: "unset", cursor: "pointer", textDecoration: "underline", color: brand.ink }}>
                {labels.switchWallet || "Switch wallet"}
              </Box>
            </Typography>
          )}
        </>
      )}
      {phase === "error" && error && (
        <Typography role="alert" data-testid={`${testId}-error`} sx={{ fontSize: 12.5, color: brand.danger, lineHeight: 1.45 }}>{error}</Typography>
      )}
    </Box>
  );
};

export default WalletAction;
