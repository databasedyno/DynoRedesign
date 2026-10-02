import React from "react";
import { Box, Chip, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import { ContentCopyRounded, KeyRounded, KeyOffRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { copyToClipboard } from "@/helpers/copyToClipboard";
import { GasLevel, GasWalletReadiness } from "@/api/chainReadiness";
import { formatCrypto } from "../adminUi";

export const GAS_LEVEL_CHIP: Record<GasLevel, { label: string; color: "success" | "warning" | "error" | "default" }> = {
  healthy: { label: "Healthy", color: "success" },
  warning: { label: "Low", color: "warning" },
  critical: { label: "Critical", color: "error" },
  empty: { label: "Empty", color: "error" },
  unknown: { label: "Unknown", color: "default" },
};

export const GasLevelChip = ({ level, testid }: { level: GasLevel; testid?: string }) => {
  const c = GAS_LEVEL_CHIP[level];
  return <Chip size="small" label={c.label} color={c.color} variant={c.color === "default" ? "outlined" : "filled"} data-testid={testid} data-level={level} sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />;
};

/** One gas / fee wallet: live balance vs thresholds + the exact address and amount to top up. */
const GasWalletCard: React.FC<{ wallet: GasWalletReadiness }> = ({ wallet }) => {
  const dispatch = useDispatch();
  const needsTopUp = wallet.level !== "healthy";
  const borderColor = wallet.level === "empty" || wallet.level === "critical" ? "error.main" : wallet.level === "warning" ? "warning.main" : "divider";

  const copy = async () => {
    const ok = await copyToClipboard(wallet.address);
    dispatch({ type: TOAST_SHOW, payload: { message: ok ? `${wallet.symbol} funding address copied` : "Copy failed — select the address manually", severity: ok ? "success" : "error" } });
  };

  return (
    <Paper variant="outlined" data-testid={`gas-wallet-${wallet.id}`} data-level={wallet.level} sx={{ p: 2.25, borderRadius: "16px", height: "100%", borderColor, display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "text.secondary" }}>
          {wallet.id === "XRP_MASTER" ? "XRP master" : `${wallet.symbol} gas`}
        </Typography>
        <GasLevelChip level={wallet.level} testid={`gas-wallet-${wallet.id}-level`} />
      </Box>
      <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, fontFamily: "var(--font-mono)" }} data-testid={`gas-wallet-${wallet.id}-balance`}>
        {wallet.balance === null ? "—" : formatCrypto(wallet.balance)} <Box component="span" sx={{ fontSize: 14, fontWeight: 600, color: "text.secondary" }}>{wallet.symbol}</Box>
      </Typography>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        healthy ≥ {wallet.thresholds.healthy} · warn &lt; {wallet.thresholds.warning} · critical &lt; {wallet.thresholds.critical}
      </Typography>
      {needsTopUp && wallet.top_up_needed > 0 && (
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: wallet.level === "warning" ? "warning.main" : "error.main" }} data-testid={`gas-wallet-${wallet.id}-topup`}>
          Send {formatCrypto(wallet.top_up_needed)} {wallet.symbol} to reach {wallet.thresholds.healthy} {wallet.symbol}
        </Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
        <Typography noWrap sx={{ fontSize: 12, fontFamily: "var(--font-mono)", flex: 1, minWidth: 0 }} title={wallet.address} data-testid={`gas-wallet-${wallet.id}-address`}>
          {wallet.address || `${wallet.env_key} not set`}
        </Typography>
        {wallet.address && (
          <Tooltip title="Copy funding address">
            <IconButton size="small" onClick={copy} data-testid={`gas-wallet-${wallet.id}-copy`}><ContentCopyRounded sx={{ fontSize: 15 }} /></IconButton>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Tooltip title={wallet.signing_key_in_db ? "Encrypted signing key present in tbl_admin_fee_wallet" : "No signing key in tbl_admin_fee_wallet — cannot sign gas transfers"}>
          <Chip size="small" variant="outlined" icon={wallet.signing_key_in_db ? <KeyRounded sx={{ fontSize: 14 }} /> : <KeyOffRounded sx={{ fontSize: 14 }} />} label={wallet.signing_key_in_db ? "Key in DB" : "Key missing"} color={wallet.signing_key_in_db ? "default" : "error"} sx={{ height: 22, fontSize: 11 }} data-testid={`gas-wallet-${wallet.id}-key`} />
        </Tooltip>
        {wallet.serves.map((c) => <Chip key={c} size="small" variant="outlined" label={c} sx={{ height: 22, fontSize: 11 }} />)}
      </Box>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{wallet.role}</Typography>
      {wallet.impact && (
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "error.main" }} data-testid={`gas-wallet-${wallet.id}-impact`}>{wallet.impact}</Typography>
      )}
    </Paper>
  );
};

export default GasWalletCard;
