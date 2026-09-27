import React from "react";
import { Box, Button, Chip, Divider, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SdAddress, SdWallet } from "@/api/safedeal";
import { CoinBadge } from "../PayoutOptionLabel";
import { SD_BORDER, SD_GOLD_DEEP, SD_NOTE_BG, SD_NOTE_FG, SD_PAGE, SD_TEXT_MUTED } from "../sdTheme";
import { shortAddr } from "./WalletDialogs";
import { AddressVerifyChip } from "./AddressVerify";

interface Props {
  wallet: SdWallet;
  onAdd: () => void;
  onRemove: (a: SdAddress) => void;
  onToggleAuto: (on: boolean) => void;
  onAutoAddress: (id: number) => void;
  onVerified: () => void;
}

/** Where cashouts go: saved payout addresses + the auto-cashout switch. */
export default function PayoutSettings({ wallet: w, onAdd, onRemove, onToggleAuto, onAutoAddress, onVerified }: Props) {
  return (
    <Box data-testid="sd-addresses" sx={{ p: { xs: 2, md: 2.2 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>Payout addresses</Typography>
          <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED }}>Stablecoin addresses your cashouts are sent to.</Typography>
        </Box>
        <Button size="small" onClick={onAdd} data-testid="sd-address-add-open" startIcon={<Icon icon="mdi:plus" />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_GOLD_DEEP, whiteSpace: "nowrap" }}>Add</Button>
      </Stack>
      {w.addresses.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED, py: 1 }} data-testid="sd-addresses-empty">Save a USDT or USDC address to cash out to. Adding one needs a fresh email code.</Typography>
      ) : (
        <Stack spacing={1}>
          {w.addresses.map((a) => (
            <Box key={a.address_id} data-testid={`sd-address-${a.address_id}`} sx={{ p: 1.2, borderRadius: 3, border: `1px solid ${SD_BORDER}`, backgroundColor: SD_PAGE }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <CoinBadge coin={a.coin} network={a.network} size={30} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800 }} noWrap>{a.label || `${a.coin} · ${a.network}`}</Typography>
                  <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, fontFamily: "monospace" }} noWrap>{shortAddr(a.address)} · {a.network}</Typography>
                </Box>
                <AddressVerifyChip address={a} />
                {w.profile.auto_withdraw && w.profile.auto_withdraw_address_id === a.address_id && <Chip size="small" label="Auto" sx={{ fontWeight: 800, fontSize: 10.5, backgroundColor: SD_NOTE_BG, color: SD_NOTE_FG }} />}
                <Tooltip title="Remove">
                  <IconButton size="small" onClick={() => onRemove(a)} data-testid={`sd-address-remove-${a.address_id}`} aria-label={`Remove address ${a.label || a.coin}`}><Icon icon="mdi:trash-can-outline" width={18} /></IconButton>
                </Tooltip>
              </Stack>
              {/* HIDDEN per request — WalletConnect "Verify it's yours" ownership check removed.
                  Payout addresses are verified by the OTP step-up on add + address-format
                  validation; on-chain wallet-signature verification is no longer required. */}
              {/* <AddressVerifyAction address={a} onVerified={onVerified} /> */}
            </Box>
          ))}
        </Stack>
      )}
      <Divider sx={{ my: 1.5, borderColor: SD_BORDER }} />
      <FormControlLabel
        control={<Switch checked={w.profile.auto_withdraw} onChange={(e) => onToggleAuto(e.target.checked)} data-testid="sd-auto-withdraw-toggle" />}
        label={<Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>Auto-cashout when funds are released to me</Typography>}
      />
      <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, ml: 0.5 }} data-testid="sd-auto-withdraw-help">
        {w.profile.auto_withdraw ? "On — each release or refund is sent to your saved address the moment a deal closes (network fee covered by the deal)." : "Off — released funds stay in your SafeDeal balance (custodied as USDT) until you press Cash out."}
      </Typography>
      {w.profile.auto_withdraw && w.addresses.length > 1 && (
        <TextField select size="small" fullWidth label="Send to" value={w.profile.auto_withdraw_address_id || ""} onChange={(e) => onAutoAddress(Number(e.target.value))} sx={{ mt: 1.2 }} inputProps={{ "data-testid": "sd-auto-withdraw-address" }}>
          {w.addresses.map((a) => <MenuItem key={a.address_id} value={a.address_id}>{a.label || a.coin} · {shortAddr(a.address)}</MenuItem>)}
        </TextField>
      )}
    </Box>
  );
}
