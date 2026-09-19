import React, { useMemo, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { SD_GOLD, SD_GOLD_DARK, SD_INK } from "./sdTheme";
import type { SdAmendBody, SdConfig, SdDeal, SdDealType } from "@/api/safedeal";
import SdChoice from "./SdChoice";
import { DEAL_TYPES, toDateInput } from "./sdDealTypes";

const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;

/** Creator edits the terms before funding; only changed fields are sent. */
export default function AmendDialog({ open, deal, cfg, busy, onClose, onSubmit }: {
  open: boolean; deal: SdDeal; cfg: SdConfig | null; busy: boolean; onClose: () => void; onSubmit: (body: SdAmendBody) => void;
}) {
  const [title, setTitle] = useState(deal.title);
  const [amount, setAmount] = useState(String(deal.price_amount ?? deal.amount));
  const [currency, setCurrency] = useState(deal.price_currency || "USD");
  const [feePayer, setFeePayer] = useState(deal.fee_payer);
  const [days, setDays] = useState<number>(deal.auto_release_days);
  const [type, setType] = useState<SdDealType | null>((deal.deal_type as SdDealType) || null);
  const [due, setDue] = useState(toDateInput(deal.delivery_due_at));
  const [terms, setTerms] = useState(deal.terms || "");

  const body = useMemo<SdAmendBody>(() => {
    const b: SdAmendBody = {};
    if (title.trim() !== deal.title) b.title = title.trim();
    if (Number(amount) !== Number(deal.price_amount ?? deal.amount) || currency !== (deal.price_currency || "USD")) { b.amount = Number(amount); b.price_currency = currency; }
    if (feePayer !== deal.fee_payer) b.fee_payer = feePayer;
    if (days !== deal.auto_release_days) b.auto_release_days = days;
    if ((type || null) !== (deal.deal_type || null)) b.deal_type = type || undefined;
    if (due !== toDateInput(deal.delivery_due_at)) b.delivery_due_at = due || null;
    if (terms.trim() !== (deal.terms || "").trim()) b.terms = terms.trim();
    return b;
  }, [title, amount, currency, feePayer, days, type, due, terms, deal]);
  const changed = Object.keys(body).length > 0;
  const reaccept = deal.status === "awaiting_payment";

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Change the terms</DialogTitle>
      <DialogContent data-testid="sd-amend-dialog">
        {reaccept ? (
          <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }} data-testid="sd-amend-reaccept-note">The other party already accepted — any change resets the deal to <b>Invited</b> and they must accept again.</Alert>
        ) : (
          <Typography sx={{ fontSize: 13.5, color: "#4B5563", mb: 1.5 }}>The other party will be emailed a summary of what changed.</Typography>
        )}
        <Stack spacing={1.5}>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} size="small" fullWidth inputProps={{ "data-testid": "sd-amend-title", maxLength: 255 }} />
          <Stack direction="row" spacing={1}>
            <TextField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} size="small" fullWidth InputProps={{ startAdornment: <InputAdornment position="start">{currency}</InputAdornment> }} inputProps={{ "data-testid": "sd-amend-amount", inputMode: "decimal" }} />
            <TextField select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} size="small" sx={{ minWidth: 110 }} inputProps={{ "data-testid": "sd-amend-currency" }}>
              {(cfg?.price_currencies || ["USD"]).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
          <SdChoice value={type} onChange={setType} testid="sd-amend-type" options={DEAL_TYPES} columns={4} />
          <Stack direction="row" spacing={1}>
            <TextField select label="Escrow fee paid by" value={feePayer} onChange={(e) => setFeePayer(e.target.value as SdDeal["fee_payer"])} size="small" fullWidth inputProps={{ "data-testid": "sd-amend-fee" }}>
              <MenuItem value="buyer">Buyer</MenuItem><MenuItem value="seller">Seller</MenuItem><MenuItem value="split">Split 50/50</MenuItem>
            </TextField>
            <TextField select label="Inspection period" value={days} onChange={(e) => setDays(Number(e.target.value))} size="small" fullWidth inputProps={{ "data-testid": "sd-amend-days" }}>
              {(cfg?.auto_release_presets || [3, 5, 7, 14]).map((d) => <MenuItem key={d} value={d}>{d} days</MenuItem>)}
            </TextField>
          </Stack>
          <TextField type="date" label="Delivery due (optional)" value={due} onChange={(e) => setDue(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} inputProps={{ "data-testid": "sd-amend-due", min: new Date().toISOString().slice(0, 10) }} />
          <TextField label="Terms" value={terms} onChange={(e) => setTerms(e.target.value)} size="small" fullWidth multiline minRows={3} inputProps={{ "data-testid": "sd-amend-terms", maxLength: 10000 }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={busy || !changed || title.trim().length < 2 || !(Number(amount) > 0)} onClick={() => onSubmit(body)} data-testid="sd-act-amend" sx={primaryBtn}>
          {busy ? "Saving…" : reaccept ? "Save & ask to re-accept" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
