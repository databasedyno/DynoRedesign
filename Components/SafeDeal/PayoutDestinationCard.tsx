import React, { useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, MenuItem, Radio, Stack, TextField, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_ACCENT } from "./sdTheme";
import safedealApi, { SdConfig, SdDeal, sdError } from "@/api/safedeal";
import { absTime, relTime } from "./sdFormat";
import { StepUpDialog } from "./StepUpDialog";
import { card, ghostBtn } from "./sdStyles";
import { PayoutOptionLabel } from "./PayoutOptionLabel";

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface Props {
  deal: SdDeal;
  cfg: SdConfig | null;
  now: number;
  walletHref: string;
  onUpdated: (d: SdDeal, msg: string) => void;
  onError: (m: string) => void;
}

/**
 * Where this party's money goes when the deal closes: release → seller, refund → buyer.
 * Paid straight from custody at close (exchange withdrawal); no address yet → parked in their balance.
 */
export default function PayoutDestinationCard({ deal, cfg, now, walletHref, onUpdated, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const me = deal.my_role as "buyer" | "seller";
  const closed = ["completed", "refunded", "split", "cancelled", "declined", "expired"].includes(deal.status);
  if (closed) return null;
  const pref = deal.my_payout_pref || null;
  const addrs = deal.my_addresses || [];
  const label = (k: string) => cfg?.payout_options.find((o) => o.key === k)?.label || k;
  const holdUntil = pref?.address?.usable_at && new Date(pref.address.usable_at).getTime() > now && !pref.before_funding ? pref.address.usable_at : null;

  const choose = async (address_id: number) => {
    setBusy(true);
    try {
      const r = await safedealApi.setPayoutDestination(deal.deal_token, { address_id });
      onUpdated(r.deal, r.message);
      setOpen(false);
    } catch (e) {
      onError(sdError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={card} data-testid="sd-payout-destination">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#9CA3AF" }}>{me === "seller" ? "Your payout" : "Refund destination"}</Typography>
        {pref && !open && <Button size="small" onClick={() => setOpen(true)} sx={{ ...ghostBtn, fontSize: 12.5 }} data-testid="sd-payout-change">Change</Button>}
      </Stack>
      {pref?.address ? (
        <Box data-testid="sd-payout-current">
          <Stack direction="row" spacing={1} alignItems="center">
            <Icon icon="mdi:bank-transfer-out" width={20} color={SD_ACCENT} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{pref.address.label || label(pref.address.payout_key)}</Typography>
              <Typography sx={{ fontSize: 12.5, color: "#6B7280", fontFamily: "ui-monospace, Menlo, monospace" }}>{label(pref.address.payout_key)} · {shortAddr(pref.address.address)}</Typography>
            </Box>
          </Stack>
          <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1 }}>
            {me === "seller" ? "When the buyer releases, your payout is sent here automatically" : "If this deal is refunded, the money is sent here automatically"} — the network fee is covered by the deal.
            {holdUntil ? ` This address is in its new-address safety hold until ${absTime(holdUntil)} (${relTime(holdUntil, now)}); a payout before then waits in your balance and goes out automatically.` : pref.before_funding ? " Chosen before funding, so it's ready to use right away." : ""}
          </Typography>
        </Box>
      ) : !open ? (
        <Box data-testid="sd-payout-none">
          <Typography sx={{ fontSize: 13.5, color: "#374151", mb: 1.2 }}>
            {me === "seller" ? "Add a USDT/USDC address now and your payout is sent the moment the buyer releases." : "Optional: choose where a refund should go if this deal is cancelled or settled in your favour."}
            {" "}Without one, the money waits in your <Link href={walletHref} style={{ color: SD_ACCENT, fontWeight: 700 }}>SafeDeal balance</Link>.
          </Typography>
          <Button size="small" variant="outlined" onClick={() => setOpen(true)} sx={ghostBtn} data-testid="sd-payout-choose" startIcon={<Icon icon="mdi:wallet-plus-outline" />}>{me === "seller" ? "Choose payout address" : "Choose refund address"}</Button>
        </Box>
      ) : null}

      {open && (
        <Stack spacing={0.8} sx={{ mt: 1.2 }} data-testid="sd-payout-picker">
          {addrs.map((a) => (
            <Box key={a.address_id} component="button" type="button" disabled={busy} onClick={() => void choose(a.address_id)} data-testid={`sd-payout-pick-${a.address_id}`} sx={{ font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 0.6, p: 0.8, borderRadius: 2, border: `1px solid ${pref?.address_id === a.address_id ? SD_ACCENT : "#E5E7EB"}`, backgroundColor: "#fff", "&:hover": { borderColor: SD_ACCENT } }}>
              <Radio size="small" checked={pref?.address_id === a.address_id} tabIndex={-1} sx={{ p: 0.3 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{a.label || label(a.payout_key)}</Typography>
                <Typography sx={{ fontSize: 12, color: "#6B7280", fontFamily: "ui-monospace, Menlo, monospace" }}>{label(a.payout_key)} · {shortAddr(a.address)}</Typography>
              </Box>
            </Box>
          ))}
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setAdding(true)} sx={{ ...ghostBtn, color: SD_ACCENT }} data-testid="sd-payout-add-new" startIcon={<Icon icon="mdi:plus" />}>New address</Button>
            <Button size="small" onClick={() => setOpen(false)} sx={{ ...ghostBtn, color: "#6B7280" }} data-testid="sd-payout-cancel">Cancel</Button>
          </Stack>
        </Stack>
      )}

      {adding && <AddDealAddress deal={deal} cfg={cfg} onClose={() => setAdding(false)} onError={onError} onDone={(d, m) => { onUpdated(d, m); setAdding(false); setOpen(false); }} />}
    </Box>
  );
}

function AddDealAddress({ deal, cfg, onClose, onDone, onError }: { deal: SdDeal; cfg: SdConfig | null; onClose: () => void; onDone: (d: SdDeal, m: string) => void; onError: (m: string) => void }) {
  const options = cfg?.payout_options || [];
  const [key, setKey] = useState(options[0]?.key || "USDT-TRON");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const beforeFunding = !deal.funded_at;
  return (
    <StepUpDialog
      title={deal.my_role === "seller" ? "Where should your payout go?" : "Where should a refund go?"}
      body="Stablecoins only. Double-check the network — funds sent to the wrong network can't be recovered."
      confirmLabel="Save & use for this deal"
      testid="sd-payout-address"
      onClose={onClose}
      disabled={address.trim().length < 20}
      onError={onError}
      onConfirm={async (code) => {
        const r = await safedealApi.setPayoutDestination(deal.deal_token, { payout_key: key, address: address.trim(), label: label.trim() || undefined, code });
        onDone(r.deal, r.message);
      }}
    >
      <Stack spacing={1.5}>
        <TextField select size="small" fullWidth label="Coin & network" value={key} onChange={(e) => setKey(e.target.value)} inputProps={{ "data-testid": "sd-payout-address-key" }}>
          {options.map((o) => <MenuItem key={o.key} value={o.key} data-testid={`sd-payout-address-key-${o.key}`}><PayoutOptionLabel option={o} /></MenuItem>)}
        </TextField>
        <TextField size="small" fullWidth label="Wallet address" value={address} onChange={(e) => setAddress(e.target.value)} inputProps={{ "data-testid": "sd-payout-address-input", spellCheck: false }} />
        <TextField size="small" fullWidth label="Label (optional)" placeholder="e.g. Ledger, Trust Wallet" value={label} onChange={(e) => setLabel(e.target.value)} inputProps={{ "data-testid": "sd-payout-address-label", maxLength: 80 }} />
        <Alert severity={beforeFunding ? "success" : "info"} sx={{ py: 0.3 }} data-testid="sd-payout-address-hold-note">
          {beforeFunding ? "Set before funding: no waiting period — usable the moment the deal closes." : (cfg?.address_cooling_hours ?? 0) > 0 ? `New addresses have a ${cfg?.address_cooling_hours}h safety hold. A payout before then waits in your balance and is sent automatically once the hold ends.` : "Usable right away — payouts go out as soon as the deal closes."}
        </Alert>
      </Stack>
    </StepUpDialog>
  );
}
