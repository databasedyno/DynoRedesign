import React, { useEffect, useState } from "react";
import { Alert, Box, MenuItem, Stack, TextField, Typography } from "@mui/material";
import safedealApi, { SdWallet } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { StepUpDialog } from "../StepUpDialog";
import { PayoutOptionLabel } from "../PayoutOptionLabel";
import { SD_BORDER, SD_PAGE } from "../sdTheme";

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface DialogProps {
  wallet: SdWallet;
  onClose: () => void;
  onDone: (m: string) => Promise<void>;
  onError: (m: string) => void;
}

export function AddAddressDialog({ wallet, onClose, onDone, onError }: DialogProps) {
  const [key, setKey] = useState(wallet.payout_options[0]?.key || "USDT-TRON");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  return (
    <StepUpDialog
      title="Add a payout address"
      body="Stablecoins only. Double-check the network — funds sent to the wrong network can't be recovered."
      confirmLabel="Save address"
      testid="sd-address-add"
      action="address_add"
      onClose={onClose}
      disabled={address.trim().length < 20}
      onError={onError}
      onConfirm={async (code) => {
        await safedealApi.addAddress({ payout_key: key, address: address.trim(), label: label.trim() || undefined, code });
        await onDone("Payout address saved. We emailed you a confirmation.");
      }}
    >
      <Stack spacing={1.5}>
        <TextField select size="small" fullWidth label="Coin & network" value={key} onChange={(e) => setKey(e.target.value)} inputProps={{ "data-testid": "sd-address-key" }}>
          {wallet.payout_options.map((o) => <MenuItem key={o.key} value={o.key} data-testid={`sd-address-key-${o.key}`}><PayoutOptionLabel option={o} /></MenuItem>)}
        </TextField>
        <TextField size="small" fullWidth label="Wallet address" value={address} onChange={(e) => setAddress(e.target.value)} inputProps={{ "data-testid": "sd-address-input", spellCheck: false }} />
        <TextField size="small" fullWidth label="Label (optional)" placeholder="e.g. Ledger, Trust Wallet" value={label} onChange={(e) => setLabel(e.target.value)} inputProps={{ "data-testid": "sd-address-label", maxLength: 80 }} />
      </Stack>
    </StepUpDialog>
  );
}

export function WithdrawDialog({ wallet, onClose, onDone, onError }: DialogProps) {
  const [addressId, setAddressId] = useState<number | "">(wallet.addresses[0]?.address_id ?? "");
  const [amount, setAmount] = useState(String(wallet.wallet.available.toFixed(2)));
  const [quote, setQuote] = useState<{ fee: number; fee_waived?: number; net: number; requires_approval: boolean; below_min?: boolean } | null>(null);
  const amt = Number(amount);
  useEffect(() => {
    if (!addressId || !(amt > 0)) return setQuote(null);
    const t = setTimeout(() => safedealApi.withdrawQuote({ address_id: Number(addressId), amount: amt }).then(setQuote).catch(() => setQuote(null)), 200);
    return () => clearTimeout(t);
  }, [addressId, amt]);
  const invalid = !addressId || !(amt >= wallet.limits.min_withdrawal_usd) || amt > wallet.wallet.available || (quote ? quote.net <= 0 : false);
  return (
    <StepUpDialog
      title="Cash out"
      body="Send money from your SafeDeal balance to a saved payout address. Confirm with a fresh email code."
      confirmLabel="Cash out"
      testid="sd-withdraw"
      action="cashout"
      onClose={onClose}
      disabled={invalid}
      onError={onError}
      onConfirm={async (code) => {
        const r = await safedealApi.withdraw({ address_id: Number(addressId), amount: amt, code });
        await onDone(r.message || "Cashout submitted.");
      }}
    >
      {wallet.addresses.length === 0 ? (
        <Alert severity="warning" data-testid="sd-withdraw-no-address">Save a payout address first.</Alert>
      ) : (
        <Stack spacing={1.5}>
          <TextField select size="small" fullWidth label="To" value={addressId} onChange={(e) => setAddressId(Number(e.target.value))} inputProps={{ "data-testid": "sd-withdraw-address" }}>
            {wallet.addresses.map((a) => <MenuItem key={a.address_id} value={a.address_id}><PayoutOptionLabel option={{ coin: a.coin, network: a.network, label: a.label || `${a.coin} · ${a.network}` }} sub={shortAddr(a.address)} /></MenuItem>)}
          </TextField>
          <TextField size="small" fullWidth label="Amount (USD)" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} helperText={`Available ${money(wallet.wallet.available)} · min $${wallet.limits.min_withdrawal_usd}`} inputProps={{ "data-testid": "sd-withdraw-amount", inputMode: "decimal" }} />
          {quote && (
            <Box sx={{ p: 1.4, borderRadius: 2, backgroundColor: SD_PAGE, border: `1px solid ${SD_BORDER}` }} data-testid="sd-withdraw-quote">
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 13 }}>Network fee</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }} data-testid="sd-withdraw-fee">{money(quote.fee)}</Typography></Stack>
              {Number(quote.fee_waived) > 0 && (
                <Typography sx={{ fontSize: 12, color: "#047857", mb: 0.4 }} data-testid="sd-withdraw-fee-credit">
                  {money(Number(quote.fee_waived))} covered by the cashout fee already reserved in your closed deal — not charged twice.
                </Typography>
              )}
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 13, fontWeight: 800 }}>You receive</Typography><Typography sx={{ fontSize: 13, fontWeight: 900, color: "#047857" }} data-testid="sd-withdraw-net">{money(quote.net)}</Typography></Stack>
              {quote.below_min && <Typography sx={{ fontSize: 12, color: "#B45309", mt: 0.6 }} data-testid="sd-withdraw-below-min">Minimum cashout is ${wallet.limits.min_withdrawal_usd}.</Typography>}
            </Box>
          )}
        </Stack>
      )}
    </StepUpDialog>
  );
}
