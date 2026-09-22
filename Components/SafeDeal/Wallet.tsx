import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton, MenuItem, Skeleton, Snackbar, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_GOLD, SD_GOLD_DARK, SD_NOTE_BG, SD_NOTE_FG } from "./sdTheme";
import safedealApi, { SdAddress, SdStatementRow, SdTopup, SdWallet, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR, absTime, relTime, useNow, withdrawalStatusLabel } from "./sdFormat";
import { explorerTxUrl, shortHash } from "@/helpers/explorerUrl";
import { useRequireSdSession, useSdHref } from "./sdRouting";
import { SD_AMBER, SD_INK, SD_INK_MUTED } from "./SafeDealShell";
import { StepUpDialog } from "./StepUpDialog";
import TopUpDialog from "./TopUpDialog";
import InvoicesCard from "./InvoicesCard";
import { CoinBadge, PayoutOptionLabel } from "./PayoutOptionLabel";

const card = { p: { xs: 2, md: 2.5 }, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB" } as const;
const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } } as const;

const KIND_LABEL: Record<string, string> = {
  escrow_funding: "Escrow funding received",
  escrow_hold: "Paid into escrow from balance",
  hold_released: "Escrow hold released",
  paid_to_seller: "Paid to seller",
  escrow_fee: "Escrow fee",
  exchange_fee: "Exchange fee",
  escrow_costs: "Network & conversion costs",
  release_received: "Release received",
  topup: "Top-up",
  payout: "Deal payout sent",
  withdrawal: "Cashout",
  withdrawal_reversed: "Cashout reversed",
  adjustment_credit: "Adjustment (credit)",
  adjustment_debit: "Adjustment (debit)",
  rounding: "Rounding",
};

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
// Internal bookkeeping refs (simulated payouts, exchange withdrawal ids) are not on-chain transactions — never show them as one.
/** Real blockchain hash for a cashout row: the backfilled column, or a legacy tx_hash that isn't an internal/exchange ref. */
const chainTx = (x: { chain_tx_hash?: string | null; tx_hash?: string | null }) => {
  if (x.chain_tx_hash) return x.chain_tx_hash;
  const h = x.tx_hash;
  return h && !/^(SIMULATED-|BINANCE-|WALLET-CREDIT|WITHDRAWAL-)/i.test(h) ? h : null;
};
/** Ledger rows written before the "cashout" vocabulary still say "Withdrawal …" — normalise on display. */
const cashoutWording = (d?: string | null) => (d || "").replace(/\bWithdrawal\b/g, "Cashout").replace(/\bwithdrawal\b/g, "cashout").replace(/\bauto-withdraw\b/gi, "auto-cashout");
/** payout_key ("USDT-TRON") → explorer helper code ("USDT-TRC20"). */
const explorerCode = (payoutKey: string) => payoutKey.toUpperCase().replace(/-TRON$/, "-TRC20");

/** Network/exchange fee in USD for a statement row, read from its stored meta (top-ups carry it). */
const rowFeeUsd = (meta?: Record<string, unknown> | null): number => {
  const m = (meta || {}) as Record<string, unknown>;
  const total = Number(m.total_fee_usd);
  if (isFinite(total) && total > 0) return total;
  const sum = Number(m.network_fee_usd || 0) + Number(m.conversion_fee_usd || 0) + Number(m.exchange_fee_usd || 0);
  return sum > 0 ? sum : 0;
};

export default function Wallet() {
  const { ready } = useRequireSdSession();
  const href = useSdHref();
  const now = useNow(30000);
  const [w, setW] = useState<SdWallet | null>(null);
  const [rows, setRows] = useState<SdStatementRow[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [toast, setToast] = useState<{ msg: string; severity: "success" | "error" } | null>(null);
  const [dialog, setDialog] = useState<null | "address" | "withdraw" | "topup" | { remove: SdAddress } | { resume: SdTopup }>(null);
  const notify = (msg: string, severity: "success" | "error" = "success") => setToast({ msg, severity });

  const load = useCallback(async () => {
    try {
      const [wallet, st] = await Promise.all([safedealApi.wallet(), safedealApi.statement({ from: from || undefined, to: to ? `${to}T23:59:59` : undefined })]);
      setW(wallet);
      setRows(st.entries);
    } catch (e) {
      notify(sdError(e), "error");
    }
  }, [from, to]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const exportCsv = async () => {
    try {
      const blob = await safedealApi.downloadStatementCsv({ from: from || undefined, to: to ? `${to}T23:59:59` : undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `safedeal-statement-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(sdError(e), "error");
    }
  };

  const toggleAutoWithdraw = async (on: boolean) => {
    if (!w) return;
    const addr = w.profile.auto_withdraw_address_id || w.addresses[0]?.address_id;
    if (on && !addr) return notify("Save a payout address first.", "error");
    try {
      await safedealApi.updateProfile({ auto_withdraw: on, auto_withdraw_address_id: on ? addr : null });
      notify(on ? "Auto-cashout is on — future releases and refunds are sent straight to your saved address." : "Auto-cashout is off — released funds stay in your balance until you cash out.");
      await load();
    } catch (e) {
      notify(sdError(e), "error");
    }
  };

  const setAutoAddress = async (id: number) => {
    try {
      await safedealApi.updateProfile({ auto_withdraw: true, auto_withdraw_address_id: id });
      await load();
    } catch (e) {
      notify(sdError(e), "error");
    }
  };

  if (!ready || !w) {
    return (
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={320} />
      </Container>
    );
  }

  const openTopup = (w.topups || []).find((t) => ["waiting", "pending", "underpaid"].includes(t.status)) || null;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }} data-testid="sd-wallet-page">
      <Typography component="h1" sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 900, letterSpacing: -0.8, mb: 0.5 }}>Wallet</Typography>
      <Typography sx={{ fontSize: 13.5, color: "#6B7280", mb: 3 }}>Shown in USD · funds are held securely in escrow as USDT.</Typography>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Box sx={{ ...card, backgroundColor: SD_INK, color: "#fff", border: "none" }} data-testid="sd-wallet-balance">
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: SD_INK_MUTED }}>Available</Typography>
            <Typography sx={{ fontSize: 38, fontWeight: 900, letterSpacing: -1, lineHeight: 1.1, my: 0.5, ...TABULAR }} data-testid="sd-wallet-available">{money(w.wallet.available)}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Icon icon="mdi:lock-outline" width={15} color={SD_AMBER} />
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.85)", ...TABULAR }} data-testid="sd-wallet-held">Held in escrow: <b>{money(w.wallet.held)}</b></Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="contained" onClick={() => setDialog("topup")} data-testid="sd-topup-open" sx={{ ...primaryBtn, backgroundColor: "#fff", color: SD_INK, "&:hover": { backgroundColor: "#E5E7EB" } }} startIcon={<Icon icon="mdi:plus-circle-outline" />}>
                Top up
              </Button>
              <Button fullWidth variant="contained" disabled={w.wallet.available < w.limits.min_withdrawal_usd} onClick={() => setDialog("withdraw")} data-testid="sd-withdraw-open" sx={{ ...primaryBtn, "&.Mui-disabled": { backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" } }} startIcon={<Icon icon="mdi:bank-transfer-out" />}>
                Cash out
              </Button>
            </Stack>
            <Typography sx={{ fontSize: 11.5, color: SD_INK_MUTED, mt: 1 }}>Top up from ${w.limits.min_topup_usd} · cash out min ${w.limits.min_withdrawal_usd} · above ${w.limits.approval_threshold_usd.toLocaleString()} reviewed first</Typography>
          </Box>
          {openTopup && (
            <Alert severity="info" icon={<Icon icon="mdi:qrcode-scan" />} sx={{ mt: 1.5, borderRadius: 2.5 }} data-testid="sd-topup-open-banner"
              action={<Button size="small" onClick={() => setDialog({ resume: openTopup })} data-testid="sd-topup-resume" sx={{ textTransform: "none", fontWeight: 800 }}>Show address</Button>}>
              Top-up of <b>{money(Number(openTopup.amount_usd))}</b> in {openTopup.coin} is {openTopup.status === "pending" ? "confirming" : "waiting for your transfer"}.
            </Alert>
          )}
          {(w.profile.parked_payout_usd || 0) > 0 && (
            <Alert severity="info" icon={<Icon icon="mdi:clock-fast" />} sx={{ mt: 1.5, borderRadius: 2.5 }} data-testid="sd-parked-payout">
              <b>{money(w.profile.parked_payout_usd || 0)}</b> from a closed deal is waiting to be paid out.{" "}
              {w.addresses.length === 0 ? "Add a payout address and it's sent automatically — the network fee is already covered." : "It goes out automatically to your payout address — the network fee is already covered."}
            </Alert>
          )}
          {(w.profile.deposit_reserved_usd || 0) > 0 && (
            <Alert severity="success" icon={<Icon icon="mdi:shield-check-outline" />} sx={{ mt: 1.5, borderRadius: 2.5 }} data-testid="sd-deposit-reserved">
              <b>{money(w.profile.deposit_reserved_usd || 0)}</b> of your balance is kept for funding deals — it won&apos;t be auto-cashed-out. Cash it out any time yourself.
            </Alert>
          )}

          <Box sx={{ ...card, mt: 2.5 }} data-testid="sd-addresses">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Payout addresses</Typography>
              <Button size="small" onClick={() => setDialog("address")} data-testid="sd-address-add-open" sx={{ textTransform: "none", fontWeight: 700 }} startIcon={<Icon icon="mdi:plus" />}>Add</Button>
            </Stack>
            {w.addresses.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: "#6B7280" }}>Save a USDT or USDC address to cash out to. Adding one needs a fresh email code.</Typography>
            ) : (
              <Stack spacing={1}>
                {w.addresses.map((a) => (
                  <Stack key={a.address_id} direction="row" spacing={1} alignItems="center" data-testid={`sd-address-${a.address_id}`} sx={{ p: 1.2, borderRadius: 2, border: "1px solid #F3F4F6", backgroundColor: "#FAFAFA" }}>
                    <CoinBadge coin={a.coin} network={a.network} size={30} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{a.label || `${a.coin} · ${a.network}`}</Typography>
                      <Typography sx={{ fontSize: 12, color: "#6B7280", fontFamily: "monospace" }}>{shortAddr(a.address)} · {a.network}</Typography>
                    </Box>
                    {w.profile.auto_withdraw && w.profile.auto_withdraw_address_id === a.address_id && <Chip size="small" label="Auto" sx={{ fontWeight: 800, fontSize: 10.5, backgroundColor: "#FEF3C7", color: "#92400E" }} />}
                    <Tooltip title="Remove">
                      <IconButton size="small" onClick={() => setDialog({ remove: a })} data-testid={`sd-address-remove-${a.address_id}`}><Icon icon="mdi:trash-can-outline" width={18} /></IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            )}
            <Divider sx={{ my: 1.5 }} />
            <FormControlLabel
              control={<Switch checked={w.profile.auto_withdraw} onChange={(e) => void toggleAutoWithdraw(e.target.checked)} data-testid="sd-auto-withdraw-toggle" />}
              label={<Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Auto-cashout when funds are released to me</Typography>}
            />
            <Typography sx={{ fontSize: 12, color: "#6B7280", ml: 0.5 }} data-testid="sd-auto-withdraw-help">
              {w.profile.auto_withdraw ? "On — each release or refund is sent to your saved address the moment a deal closes (network fee covered by the deal)." : "Off — released funds stay in your SafeDeal balance (custodied as USDT) until you press Cash out."}
            </Typography>
            {w.profile.auto_withdraw && w.addresses.length > 1 && (
              <TextField select size="small" fullWidth label="Send to" value={w.profile.auto_withdraw_address_id || ""} onChange={(e) => void setAutoAddress(Number(e.target.value))} sx={{ mt: 1 }} inputProps={{ "data-testid": "sd-auto-withdraw-address" }}>
                {w.addresses.map((a) => <MenuItem key={a.address_id} value={a.address_id}>{a.label || a.coin} · {shortAddr(a.address)}</MenuItem>)}
              </TextField>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={8}>
          <Box sx={card} data-testid="sd-statement">
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Statement</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} inputProps={{ "data-testid": "sd-statement-from" }} sx={{ width: 150 }} />
                <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} inputProps={{ "data-testid": "sd-statement-to" }} sx={{ width: 150 }} />
                <Button size="small" variant="outlined" onClick={() => void exportCsv()} data-testid="sd-statement-csv" sx={{ textTransform: "none", fontWeight: 700, borderRadius: 99, whiteSpace: "nowrap" }} startIcon={<Icon icon="mdi:download" />}>CSV</Button>
              </Stack>
            </Stack>
            {!rows ? (
              <Skeleton variant="rounded" height={200} />
            ) : rows.length === 0 ? (
              <Typography sx={{ fontSize: 13.5, color: "#6B7280", py: 3, textAlign: "center" }} data-testid="sd-statement-empty">No entries yet. Funding, releases, refunds, fees and cashouts all show up here with a running balance.</Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, "& th": { textAlign: "left", fontSize: 11.5, color: "#6B7280", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, py: 0.8, px: 0.8, borderBottom: "1px solid #E5E7EB" }, "& td": { py: 1, px: 0.8, borderBottom: "1px solid #F3F4F6", verticalAlign: "top" } }}>
                  <thead>
                    <tr><th>Date</th><th>Deal</th><th>Type</th><th style={{ textAlign: "right" }}>Amount</th><th style={{ textAlign: "right" }}>Fees</th><th style={{ textAlign: "right" }}>Balance</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id || r.reference} data-testid={`sd-statement-row-${r.kind}`}>
                        <td style={{ whiteSpace: "nowrap", color: "#6B7280" }}><Tooltip title={absTime(r.at)}><time dateTime={r.at}>{relTime(r.at, now)}</time></Tooltip></td>
                        <td>{r.escrow_id ? <><b>#{r.escrow_id}</b><br /><span style={{ color: "#6B7280" }}>{r.deal_title}</span></> : <span style={{ color: "#9CA3AF" }}>—</span>}</td>
                        <td>
                          <b>{KIND_LABEL[r.kind] || r.kind}</b>
                          <br />
                          <span style={{ color: "#6B7280", fontSize: 12 }}>{cashoutWording(r.description)}</span>
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: r.signed > 0 ? "#047857" : r.signed < 0 ? "#B91C1C" : "#6B7280" }}>
                          {r.signed !== 0 ? `${r.signed > 0 ? "+" : "−"}${money(Math.abs(r.signed))}` : <Tooltip title={r.type === "HOLD" ? "Moved from Available to Held" : "Moved from Held to Available"}><span>{r.type === "HOLD" ? "→ held" : "→ available"} {money(r.amount)}</span></Tooltip>}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: rowFeeUsd(r.meta) > 0 ? "#6B7280" : "#D1D5DB" }} data-testid={`sd-statement-fee-${r.kind}`}>
                          {rowFeeUsd(r.meta) > 0 ? money(rowFeeUsd(r.meta)) : "—"}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{money(r.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            )}
          </Box>

          <InvoicesCard now={now} dealHref={(t) => href(`/deal/${t}`)} notify={notify} />

          {w.withdrawals.length > 0 && (
            <Box sx={{ ...card, mt: 2.5 }} data-testid="sd-withdrawals">
              <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1 }}>Cashouts &amp; payouts</Typography>
              <Stack spacing={0.8}>
                {w.withdrawals.map((x) => (
                  <Stack key={x.withdrawal_id} direction="row" spacing={1.5} alignItems="center" data-testid={`sd-withdrawal-${x.withdrawal_id}`} data-source={x.source || "manual"} sx={{ py: 0.8, borderBottom: "1px solid #F3F4F6" }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography component="div" sx={{ fontSize: 13.5, fontWeight: 700, ...TABULAR }}>
                        {x.source === "settlement" && <Chip size="small" label={x.escrow_id ? `Deal #${x.escrow_id} payout` : "Deal payout"} sx={{ mr: 0.8, fontSize: 10.5, fontWeight: 800, height: 20, backgroundColor: SD_NOTE_BG, color: SD_NOTE_FG }} />}
                        #{x.withdrawal_id} · {money(Number(x.amount_usd))} → {shortAddr(x.address)} <span style={{ color: "#6B7280", fontWeight: 500 }}>({x.payout_key})</span>
                      </Typography>
                      <Typography component="div" sx={{ fontSize: 12, color: "#6B7280", ...TABULAR }}>
                        <Tooltip title={absTime(x.created_at)}><time dateTime={x.created_at}>{relTime(x.created_at, now)}</time></Tooltip> · {x.source === "settlement" ? "network fee covered by the deal" : `fee ${money(Number(x.fee_usd))}`} · you receive {money(Number(x.net_usd))}{x.rejected_reason ? ` · ${x.rejected_reason}` : ""}
                        {x.status === "sent" && (chainTx(x) ? (
                          <> · <a href={explorerTxUrl(explorerCode(x.payout_key), chainTx(x)!)} target="_blank" rel="noopener noreferrer" data-testid={`sd-withdrawal-tx-${x.withdrawal_id}`} style={{ color: "#B77E00", fontWeight: 700, fontFamily: "monospace" }}>tx {shortHash(chainTx(x)!, 8, 6)}</a></>
                        ) : (
                          <> · <span data-testid={`sd-withdrawal-tx-pending-${x.withdrawal_id}`}>SafeDeal is sending it — blockchain tx follows in a few minutes</span></>
                        ))}
                      </Typography>
                    </Box>
                    <Chip size="small" label={withdrawalStatusLabel(x.status)} data-testid={`sd-withdrawal-status-${x.withdrawal_id}`} data-status={x.status} sx={{ fontWeight: 800, fontSize: 11, backgroundColor: x.status === "sent" ? "#ECFDF5" : x.status === "rejected" ? "#FEF2F2" : "#FEF3C7", color: x.status === "sent" ? "#047857" : x.status === "rejected" ? "#B91C1C" : "#92400E" }} />
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </Grid>
      </Grid>

      {dialog === "address" && <AddAddressDialog wallet={w} onClose={() => setDialog(null)} onDone={async (m) => { notify(m); setDialog(null); await load(); }} onError={(m) => notify(m, "error")} />}
      {dialog === "withdraw" && <WithdrawDialog wallet={w} onClose={() => setDialog(null)} onDone={async (m) => { notify(m); setDialog(null); await load(); }} onError={(m) => notify(m, "error")} />}
      {dialog === "topup" && <TopUpDialog wallet={w} onClose={async () => { setDialog(null); await load(); }} onCredited={async (m) => { notify(m); await load(); }} notify={notify} />}
      {dialog && typeof dialog === "object" && "resume" in dialog && (
        <TopUpDialog wallet={w} resume={dialog.resume} onClose={async () => { setDialog(null); await load(); }} onCredited={async (m) => { notify(m); await load(); }} notify={notify} />
      )}
      {dialog && typeof dialog === "object" && "remove" in dialog && (
        <StepUpDialog
          title="Remove this payout address?"
          body={`${dialog.remove.label || dialog.remove.coin} · ${shortAddr(dialog.remove.address)} will be removed. Confirm with a fresh email code.`}
          confirmLabel="Remove address"
          testid="sd-address-remove"
          action="address_remove"
          onClose={() => setDialog(null)}
          onConfirm={async (code) => { await safedealApi.removeAddress(dialog.remove.address_id, code); notify("Address removed."); setDialog(null); await load(); }}
          onError={(m) => notify(m, "error")}
        />
      )}

      <Snackbar open={!!toast} autoHideDuration={4500} onClose={() => setToast(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast?.severity || "success"} onClose={() => setToast(null)} data-testid="sd-toast" sx={{ fontWeight: 600 }}>{toast?.msg}</Alert>
      </Snackbar>
    </Container>
  );
}

function AddAddressDialog({ wallet, onClose, onDone, onError }: { wallet: SdWallet; onClose: () => void; onDone: (m: string) => Promise<void>; onError: (m: string) => void }) {
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

function WithdrawDialog({ wallet, onClose, onDone, onError }: { wallet: SdWallet; onClose: () => void; onDone: (m: string) => Promise<void>; onError: (m: string) => void }) {
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
            <Box sx={{ p: 1.4, borderRadius: 2, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }} data-testid="sd-withdraw-quote">
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 13 }}>Network fee</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }} data-testid="sd-withdraw-fee">{money(quote.fee)}</Typography></Stack>
              {Number(quote.fee_waived) > 0 && (
                <Typography sx={{ fontSize: 12, color: "#047857", mb: 0.4 }} data-testid="sd-withdraw-fee-credit">
                  {money(Number(quote.fee_waived))} covered by the cashout fee already reserved in your closed deal — not charged twice.
                </Typography>
              )}
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 13, fontWeight: 800 }}>You receive</Typography><Typography sx={{ fontSize: 13, fontWeight: 900, color: "#047857" }} data-testid="sd-withdraw-net">{money(quote.net)}</Typography></Stack>
              {quote.below_min && <Typography sx={{ fontSize: 12, color: "#B45309", mt: 0.6 }} data-testid="sd-withdraw-below-min">Minimum cashout is ${wallet.limits.min_withdrawal_usd}.</Typography>}
              {quote.requires_approval && <Typography sx={{ fontSize: 12, color: "#92400E", mt: 0.6 }}>Above ${wallet.limits.approval_threshold_usd.toLocaleString()} — reviewed by our team before it&apos;s sent (usually within a few hours).</Typography>}
            </Box>
          )}
        </Stack>
      )}
    </StepUpDialog>
  );
}
