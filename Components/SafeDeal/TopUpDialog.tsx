import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { BRAND_ACCENT } from "@/constants/theme";
import safedealApi, { SdTopup, SdTopupQuote, SdWallet, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR } from "./sdFormat";
import { primaryBtn } from "./sdStyles";

const COIN_ICON: Record<string, string> = {
  BTC: "cryptocurrency-color:btc", ETH: "cryptocurrency-color:eth", LTC: "cryptocurrency-color:ltc", DOGE: "cryptocurrency-color:doge", BCH: "cryptocurrency-color:bch",
  TRX: "cryptocurrency-color:trx", SOL: "cryptocurrency-color:sol", XRP: "cryptocurrency-color:xrp", POLYGON: "cryptocurrency-color:matic",
  "USDT-TRC20": "cryptocurrency-color:usdt", "USDT-ERC20": "cryptocurrency-color:usdt", "USDT-POLYGON": "cryptocurrency-color:usdt", "USDC-ERC20": "cryptocurrency-color:usdc",
};

interface Props {
  wallet: SdWallet;
  /** Resume an open top-up (e.g. after reload) instead of starting a new one. */
  resume?: SdTopup | null;
  onClose: () => void;
  onCredited: (m: string) => Promise<void>;
  notify: (m: string, s?: "success" | "error") => void;
}

/** Top up the SafeDeal balance: amount → coin (with fees) → Dynopay address/QR → credited. */
export default function TopUpDialog({ wallet, resume, onClose, onCredited, notify }: Props) {
  const [amount, setAmount] = useState("50");
  const [quotes, setQuotes] = useState<SdTopupQuote[] | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [topup, setTopup] = useState<SdTopup | null>(resume || null);
  const amt = Number(amount);
  const { min_topup_usd: min, max_topup_usd: max } = wallet.limits;
  const valid = amt >= min && amt <= max;

  useEffect(() => {
    if (topup || !valid) return setQuotes(null);
    const t = setTimeout(() => safedealApi.topupCoins(amt).then((r) => setQuotes(r.coins)).catch((e) => notify(sdError(e), "error")), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amt, valid, !!topup]);

  const pick = async (coin: string) => {
    setCreating(coin);
    try {
      const r = await safedealApi.createTopup({ amount: amt, coin });
      setTopup(r.topup);
      notify(r.message);
    } catch (e) {
      notify(sdError(e), "error");
    } finally {
      setCreating(null);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Top up balance</DialogTitle>
      <DialogContent data-testid="sd-topup-dialog">
        {!topup ? (
          <Stack spacing={1.5}>
            <Typography sx={{ fontSize: 13.5, color: "#4B5563" }}>Deposit crypto and your SafeDeal balance is credited in USD — ready to fund any deal from balance, no per-deal payment needed.</Typography>
            <TextField size="small" fullWidth label="Amount to add (USD)" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} helperText={`Min $${min} · max $${max.toLocaleString()}`} error={amount !== "" && !valid} inputProps={{ "data-testid": "sd-topup-amount", inputMode: "decimal" }} />
            {valid && !quotes && <Box sx={{ py: 2, display: "grid", placeItems: "center" }}><CircularProgress size={20} sx={{ color: BRAND_ACCENT }} /></Box>}
            {quotes && <CoinQuotes quotes={quotes} creating={creating} onPick={(c) => void pick(c)} />}
          </Stack>
        ) : (
          <TopupPayment topup={topup} live={wallet.live} onUpdate={setTopup} onCredited={onCredited} notify={notify} />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }} data-testid="sd-topup-close">{topup?.status === "credited" ? "Done" : "Close"}</Button>
      </DialogActions>
    </Dialog>
  );
}

function CoinQuotes({ quotes, creating, onPick }: { quotes: SdTopupQuote[]; creating: string | null; onPick: (c: string) => void }) {
  const tile = (q: SdTopupQuote) => {
    const fees = q.network_fee + q.conversion_fee + q.exchange_fee;
    return (
      <Box key={q.coin} component="button" type="button" disabled={!!creating} onClick={() => onPick(q.coin)} data-testid={`sd-topup-coin-${q.coin}`}
        sx={{ textAlign: "left", cursor: creating ? "progress" : "pointer", font: "inherit", p: 1.2, borderRadius: 2.5, backgroundColor: "#fff", border: "1.5px solid #E5E7EB", display: "flex", alignItems: "center", gap: 1.2, width: "100%", transition: "border-color .15s, transform .15s", "&:hover": { borderColor: BRAND_ACCENT, transform: "translateY(-1px)" }, "&:disabled": { opacity: 0.6 } }}>
        <Icon icon={COIN_ICON[q.coin] || "mdi:circle-multiple-outline"} width={28} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.2 }}>{q.label} <Typography component="span" sx={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>· {q.network}</Typography></Typography>
          <Typography sx={{ fontSize: 11.5, color: "#6B7280", mt: 0.2 }}>
            {q.stable ? "No exchange fee" : `Exchange fee ${q.exchange_fee_percent}% (${money(q.exchange_fee)})`} · network {money(q.network_fee)}{q.conversion_fee > 0 ? ` · conversion ${money(q.conversion_fee)}` : ""}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 900, ...TABULAR }} data-testid={`sd-topup-pays-${q.coin}`}>{creating === q.coin ? "…" : money(q.pays)}</Typography>
          <Typography sx={{ fontSize: 11, color: "#9CA3AF" }}>you send · fees {money(fees)}</Typography>
        </Box>
      </Box>
    );
  };
  const stable = quotes.filter((q) => q.stable);
  const other = quotes.filter((q) => !q.stable);
  return (
    <Box data-testid="sd-topup-coins">
      {quotes.length === 0 && <Alert severity="warning" data-testid="sd-topup-no-coins">No deposit coins are enabled yet — please try again shortly.</Alert>}
      <Stack spacing={1}>{stable.map(tile)}</Stack>
      {other.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }}><Typography sx={{ fontSize: 11.5, color: "#9CA3AF" }}>other coins · converted to USDT on arrival</Typography></Divider>
          <Stack spacing={1}>{other.map(tile)}</Stack>
        </>
      )}
      <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1.5 }}>You always receive the full amount you entered — fees are added to what you send.</Typography>
    </Box>
  );
}

const STATUS_LABEL: Record<string, string> = { waiting: "Waiting for your transfer", pending: "Seen on the blockchain — confirming", underpaid: "Underpaid — send the remainder", credited: "Credited to your balance", expired: "Address expired" };

function TopupPayment({ topup, live, onUpdate, onCredited, notify }: { topup: SdTopup; live: boolean; onUpdate: (t: SdTopup) => void; onCredited: (m: string) => Promise<void>; notify: Props["notify"] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cb = useRef(onCredited);
  cb.current = onCredited;
  const open = ["waiting", "pending", "underpaid"].includes(topup.status);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(async () => {
      try {
        const r = await safedealApi.getTopup(topup.topup_id);
        onUpdate(r.topup);
        if (r.topup.status === "credited") await cb.current(`${money(Number(r.topup.amount_usd))} added to your balance.`);
      } catch { /* transient */ }
    }, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topup.topup_id, open]);

  const copy = async (k: string, v: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(null), 1600); } catch { notify("Couldn't copy — select it manually.", "error"); }
  };
  const simulate = async () => {
    setBusy(true);
    try {
      const r = await safedealApi.simulateTopup(topup.topup_id);
      onUpdate(r.topup);
      await onCredited(r.message);
    } catch (e) {
      notify(sdError(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const fees = Number(topup.network_fee_usd) + Number(topup.conversion_fee_usd) + Number(topup.exchange_fee_usd);
  return (
    <Box data-testid="sd-topup-payment" data-status={topup.status}>
      <Chip size="small" label={STATUS_LABEL[topup.status] || topup.status} data-testid="sd-topup-status" sx={{ fontWeight: 800, mb: 1.5, backgroundColor: topup.status === "credited" ? "#ECFDF5" : topup.status === "expired" ? "#FEF2F2" : "#EEF2FF", color: topup.status === "credited" ? "#047857" : topup.status === "expired" ? "#B91C1C" : "#3730A3" }} />
      {topup.status === "credited" ? (
        <Alert severity="success" data-testid="sd-topup-credited"><b>{money(Number(topup.amount_usd))}</b> is now in your available balance{topup.simulated ? " (simulated)" : ""}. You can fund deals from balance right away.</Alert>
      ) : (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
          <Box sx={{ flexShrink: 0, alignSelf: { xs: "center", sm: "flex-start" }, p: 1, borderRadius: 2.5, border: "1px solid #E5E7EB" }}>
            {topup.qr_code ? <img src={topup.qr_code} alt="QR code" width={150} height={150} style={{ display: "block", borderRadius: 8 }} data-testid="sd-topup-qr" /> : <Box sx={{ width: 150, height: 150, display: "grid", placeItems: "center", color: "#9CA3AF" }}><Icon icon="mdi:qrcode" width={56} /></Box>}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6B7280" }}>Send exactly</Typography>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Typography sx={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, ...TABULAR }} data-testid="sd-topup-crypto-amount">{topup.crypto_amount} {topup.coin}</Typography>
              <Tooltip title={copied === "amount" ? "Copied" : "Copy"}><IconButton size="small" onClick={() => void copy("amount", topup.crypto_amount || "")} data-testid="sd-topup-copy-amount"><Icon icon={copied === "amount" ? "mdi:check" : "mdi:content-copy"} width={16} /></IconButton></Tooltip>
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: "#6B7280", mb: 1 }}>= {money(Number(topup.pays_usd))} · credits <b>{money(Number(topup.amount_usd))}</b> (fees {money(fees)})</Typography>
            <Box sx={{ p: 1.2, borderRadius: 2, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 0.6 }}>
              <Typography sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, wordBreak: "break-all", flex: 1 }} data-testid="sd-topup-address">{topup.address}</Typography>
              <Tooltip title={copied === "address" ? "Copied" : "Copy"}><IconButton size="small" onClick={() => void copy("address", topup.address || "")} data-testid="sd-topup-copy-address"><Icon icon={copied === "address" ? "mdi:check" : "mdi:content-copy"} width={16} /></IconButton></Tooltip>
            </Box>
            {topup.destination_tag != null && <Typography sx={{ fontSize: 12.5, color: "#B45309", fontWeight: 700, mt: 0.8 }} data-testid="sd-topup-tag">Destination tag / memo: {topup.destination_tag} — required</Typography>}
            <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1 }}>Address valid until {new Date(topup.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Powered by Dynopay — held as USDT in your SafeDeal balance.</Typography>
          </Box>
        </Stack>
      )}
      {open && !live && (
        <Box sx={{ mt: 1.6, p: 1.4, borderRadius: 2, border: "1px dashed #C7D2FE", backgroundColor: "#EEF2FF" }} data-testid="sd-topup-simulate-box">
          <Typography sx={{ fontSize: 12.5, color: "#3730A3", mb: 0.8 }}><b>Preview environment.</b> Live settlement is off — simulate the deposit to credit your balance.</Typography>
          <Button size="small" variant="contained" disabled={busy} onClick={() => void simulate()} data-testid="sd-topup-simulate" sx={primaryBtn} startIcon={<Icon icon="mdi:flash-outline" />}>Simulate deposit received</Button>
        </Box>
      )}
      {topup.status === "expired" && <Typography sx={{ fontSize: 12.5, color: "#B91C1C", mt: 1 }} data-testid="sd-topup-expired-note">This address expired unused — close and start a new top-up.</Typography>}
    </Box>
  );
}
