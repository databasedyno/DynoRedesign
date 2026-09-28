import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Divider, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_ACCENT, SD_NOTE_BG, SD_NOTE_FG, SD_NOTE_BORDER, SD_ACCENT_GLOW } from "./sdTheme";
import safedealApi, { SdDeal, SdFunding, SdFundingCoin, SdFundingPayment, sdError } from "@/api/safedeal";
// WalletConnect "Pay with wallet" retired from SafeDeal funding — QR + copy-address only.
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR, relTime } from "./sdFormat";
import { ghostBtn, primaryBtn } from "./sdStyles";

const COIN_ICON: Record<string, string> = {
  BTC: "cryptocurrency-color:btc", ETH: "cryptocurrency-color:eth", LTC: "cryptocurrency-color:ltc", DOGE: "cryptocurrency-color:doge", BCH: "cryptocurrency-color:bch",
  TRX: "cryptocurrency-color:trx", SOL: "cryptocurrency-color:sol", XRP: "cryptocurrency-color:xrp", POLYGON: "cryptocurrency-color:matic",
  "USDT-TRC20": "cryptocurrency-color:usdt", "USDT-ERC20": "cryptocurrency-color:usdt", "USDT-POLYGON": "cryptocurrency-color:usdt", "USDC-ERC20": "cryptocurrency-color:usdc",
};

interface Props {
  deal: SdDeal;
  live: boolean;
  busy: string | null;
  now: number;
  onSimulate: (coin: string) => void;
  onFunded: () => void;
  notify: (m: string, s?: "success" | "error") => void;
}

/** Buyer's in-page pay screen: pick a coin → Dynopay merchant-pool address + QR → live status until Funded. */
export default function FundPanel({ deal, live, busy, now, onSimulate, onFunded, notify }: Props) {
  const [funding, setFunding] = useState<SdFunding | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Parent callbacks change identity on every render — keep them in refs so polling doesn't restart each tick.
  const cb = useRef({ onFunded, notify });
  cb.current = { onFunded, notify };

  const load = useCallback(async () => {
    try {
      const f = await safedealApi.funding(deal.deal_token);
      setFunding(f);
      if (f.status !== "awaiting_payment") cb.current.onFunded();
    } catch (e) {
      cb.current.notify(sdError(e), "error");
    }
  }, [deal.deal_token]);

  useEffect(() => { void load(); }, [load]);

  const payment = funding?.payment && ["waiting", "pending", "underpaid", "confirmed"].includes(funding.payment.status) && new Date(funding.payment.expires_at).getTime() > now ? funding.payment : null;
  const expired = funding?.payment && !payment && funding.payment.status !== "confirmed" ? funding.payment : null;

  const paymentId = payment?.payment_id || null;
  useEffect(() => {
    if (!paymentId) return;
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [paymentId, load]);

  const pick = async (coin: string) => {
    setCreating(coin);
    try {
      const r = await safedealApi.createFunding(deal.deal_token, coin);
      setFunding(r.funding);
      setPicking(false);
      notify(r.message);
      onFunded(); // deal breakdown now reflects the chosen coin
    } catch (e) {
      notify(sdError(e), "error");
    } finally {
      setCreating(null);
    }
  };

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      notify("Couldn't copy — select it manually.", "error");
    }
  };

  if (!funding) return <Box sx={{ py: 3, display: "grid", placeItems: "center" }} data-testid="sd-fund-loading"><CircularProgress size={22} sx={{ color: SD_ACCENT }} /></Box>;

  if (!payment || picking) {
    return (
      <CoinPicker coins={funding.coins} current={payment?.coin || null} creating={creating} onPick={(c) => void pick(c)} onCancel={payment ? () => setPicking(false) : undefined} expired={expired} />
    );
  }

  return (
    <PaymentView deal={deal} payment={payment} coin={funding.coins.find((c) => c.coin === payment.coin)} now={now} live={live} busy={busy} copied={copied} onCopy={(k, v) => void copy(k, v)} onSwitch={() => setPicking(true)} onSimulate={() => onSimulate(payment.coin)} />
  );
}

function CoinPicker({ coins, current, creating, onPick, onCancel, expired }: { coins: SdFundingCoin[]; current: string | null; creating: string | null; onPick: (c: string) => void; onCancel?: () => void; expired: SdFundingPayment | null }) {
  const stable = coins.filter((c) => c.stable);
  const other = coins.filter((c) => !c.stable);
  const tile = (c: SdFundingCoin) => (
    <Box
      key={c.coin}
      component="button"
      type="button"
      disabled={!!creating}
      onClick={() => onPick(c.coin)}
      data-testid={`sd-fund-coin-${c.coin}`}
      sx={{
        textAlign: "left", cursor: creating ? "progress" : "pointer", font: "inherit", p: 1.4, borderRadius: 2.5, backgroundColor: "#fff",
        border: `1.5px solid ${current === c.coin ? SD_ACCENT : "#E5E7EB"}`, display: "flex", alignItems: "center", gap: 1.2, width: "100%",
        transition: "border-color .15s, transform .15s, box-shadow .15s", "&:hover": { borderColor: SD_ACCENT, transform: "translateY(-1px)", boxShadow: `0 6px 18px ${SD_ACCENT_GLOW}` },
        "&:disabled": { opacity: 0.6 },
      }}
    >
      <Icon icon={COIN_ICON[c.coin] || "mdi:circle-multiple-outline"} width={30} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>{c.label} <Typography component="span" sx={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>· {c.network}</Typography></Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 0.2 }}>{c.stable ? "No conversion · no exchange fee" : `Auto-converted to USDT · incl. ${money(c.exchange_fee)} exchange fee`}{c.cheap ? " · low network fee" : ""}</Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 900, ...TABULAR }}>{creating === c.coin ? "…" : money(c.buyer_pays)}</Typography>
        <Typography sx={{ fontSize: 11, color: (c.surcharge || 0) > 0 ? "#B45309" : "#9CA3AF" }} data-testid={`sd-fund-coin-surcharge-${c.coin}`}>{(c.surcharge || 0) > 0 ? `+${money(c.surcharge || 0)} vs quote` : "you pay"}</Typography>
      </Box>
    </Box>
  );
  return (
    <Box data-testid="sd-fund-picker">
      {expired && <Alert severity="warning" sx={{ mb: 1.5 }} data-testid="sd-fund-expired">Your previous payment address expired unused — pick a coin to get a fresh one.</Alert>}
      <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6B7280", mb: 1 }}>Pay with</Typography>
      {coins.length === 0 && <Alert severity="warning" data-testid="sd-fund-no-coins">No funding coins are enabled yet — please try again shortly.</Alert>}
      <Stack spacing={1}>{stable.map(tile)}</Stack>
      {other.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }}><Typography sx={{ fontSize: 11.5, color: "#9CA3AF" }}>other coins · converted to USDT the moment they arrive</Typography></Divider>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>{other.map(tile)}</Box>
        </>
      )}
      <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1.5 }}>The price includes the escrow fee and the real network cost of your chosen coin. Non-stablecoins also carry a small exchange fee for converting them to USDT — that&apos;s why the total differs per coin.</Typography>
      {onCancel && <Button size="small" onClick={onCancel} sx={{ ...ghostBtn, mt: 1 }} data-testid="sd-fund-picker-back">Back to my payment</Button>}
    </Box>
  );
}

const STEPS = ["waiting", "pending", "confirmed", "settled"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], [string, string]> = {
  waiting: ["Waiting for your transfer", "Send the exact amount to the address below."],
  pending: ["Seen on the blockchain", "Waiting for network confirmations."],
  confirmed: ["Confirmed — escrow funded", "The seller has been notified."],
  settled: ["Secured in custody", "Held as USDT in escrow until you release it."],
};

function PaymentView({ deal, payment, coin, now, live, busy, copied, onCopy, onSwitch, onSimulate }: {
  deal: SdDeal; payment: SdFundingPayment; coin?: SdFundingCoin; now: number; live: boolean; busy: string | null; copied: string | null;
  onCopy: (k: string, v: string) => void; onSwitch: () => void; onSimulate: () => void;
}) {
  const idx = Math.max(0, STEPS.indexOf(payment.status === "underpaid" ? "pending" : (payment.status as (typeof STEPS)[number])));
  const left = new Date(payment.expires_at).getTime() - now;
  const mins = Math.max(0, Math.floor(left / 60000));
  const label = coin?.label || payment.coin;
  const network = coin?.network || payment.coin;
  const qr = useMemo(() => payment.qr_code || null, [payment.qr_code]);
  return (
    <Box data-testid="sd-fund-payment" data-status={payment.status}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} alignItems={{ sm: "flex-start" }}>
        <Box sx={{ flexShrink: 0, alignSelf: { xs: "center", sm: "flex-start" }, p: 1, borderRadius: 2.5, border: "1px solid #E5E7EB", backgroundColor: "#fff" }}>
          {qr ? <img src={qr} alt={`QR code for ${label} payment`} width={168} height={168} style={{ display: "block", borderRadius: 8 }} data-testid="sd-fund-qr" /> : <Box sx={{ width: 168, height: 168, display: "grid", placeItems: "center", color: "#9CA3AF" }}><Icon icon="mdi:qrcode" width={64} /></Box>}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#6B7280" }}>Send exactly</Typography>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 900, letterSpacing: -0.5, ...TABULAR }} data-testid="sd-fund-amount">{payment.crypto_amount} {label}</Typography>
            <CopyBtn k="amount" v={payment.crypto_amount} copied={copied} onCopy={onCopy} />
          </Stack>
          <Typography sx={{ fontSize: 12.5, color: "#6B7280", mb: 0.3 }}>= {money(payment.base_amount, payment.base_currency)} · on <b>{network}</b> only</Typography>
          <Box sx={{ p: 1.2, borderRadius: 2, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 0.6, mt: 1 }}>
            <Typography sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, wordBreak: "break-all", flex: 1 }} data-testid="sd-fund-address">{payment.address}</Typography>
            <CopyBtn k="address" v={payment.address} copied={copied} onCopy={onCopy} />
          </Box>
          {/* WalletConnect "Pay with wallet" retired from SafeDeal funding — QR + copy-address only. */}
          {payment.destination_tag != null && (
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.8 }}>
              <Typography sx={{ fontSize: 12.5, color: "#B45309", fontWeight: 700 }} data-testid="sd-fund-tag">Destination tag / memo: {payment.destination_tag} — required</Typography>
              <CopyBtn k="tag" v={String(payment.destination_tag)} copied={copied} onCopy={onCopy} />
            </Stack>
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
            <Chip size="small" icon={<Icon icon="mdi:timer-sand" width={14} />} label={left > 0 ? `Address valid ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}` : "Expired"} sx={{ fontWeight: 700 }} data-testid="sd-fund-expiry" />
            <Button size="small" onClick={onSwitch} disabled={payment.status !== "waiting"} sx={{ ...ghostBtn, fontSize: 12.5 }} data-testid="sd-fund-switch" startIcon={<Icon icon="mdi:swap-horizontal" width={16} />}>Pay with a different coin</Button>
          </Stack>
        </Box>
      </Stack>

      {payment.status === "underpaid" && (
        <Alert severity="warning" sx={{ mt: 2 }} data-testid="sd-fund-underpaid">
          We received {payment.received_crypto} {label} — less than the {payment.crypto_amount} {label} due. Send the remaining amount to the same address; the escrow funds once the full amount arrives.
        </Alert>
      )}

      <Stack spacing={0} sx={{ mt: 2.2 }} data-testid="sd-fund-timeline">
        {STEPS.map((s, i) => {
          const done = i < idx || (i === idx && payment.status === "confirmed");
          const active = i === idx && payment.status !== "confirmed";
          return (
            <Stack key={s} direction="row" spacing={1.2} alignItems="flex-start" sx={{ position: "relative", pb: i < STEPS.length - 1 ? 1.4 : 0 }} data-testid={`sd-fund-step-${s}`} data-state={done ? "done" : active ? "active" : "todo"}>
              <Box sx={{ width: 22, display: "grid", placeItems: "center", flexShrink: 0 }}>
                {done ? <Icon icon="mdi:check-circle" width={20} color="#059669" /> : active ? <CircularProgress size={16} thickness={5} sx={{ color: SD_ACCENT, mt: 0.3 }} /> : <Box sx={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #D1D5DB", mt: 0.7 }} />}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: done || active ? 800 : 600, color: done || active ? "#111827" : "#9CA3AF" }}>{STEP_LABEL[s][0]}</Typography>
                {(active || done) && <Typography sx={{ fontSize: 12, color: "#6B7280" }}>{STEP_LABEL[s][1]}{s === "pending" && payment.seen_tx && active ? ` Tx ${payment.seen_tx.slice(0, 10)}…` : ""}</Typography>}
              </Box>
            </Stack>
          );
        })}
      </Stack>

      <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1.6 }}>
        Your payment lands in secure SafeDeal escrow custody{coin?.stable ? "" : ", is converted to USDT"} and stays locked until you release it or the inspection timer runs out. Created {relTime(payment.created_at, now)}.
      </Typography>

      {!live && (
        <Box sx={{ mt: 1.6, p: 1.4, borderRadius: 2, border: `1px dashed ${SD_NOTE_BORDER}`, backgroundColor: SD_NOTE_BG }} data-testid="sd-fund-simulate-box">
          <Typography sx={{ fontSize: 12.5, color: SD_NOTE_FG, mb: 0.8 }}><b>Preview environment.</b> The address above is real but live settlement is off — simulate the transfer to move on.</Typography>
          <Button size="small" variant="contained" disabled={!!busy} onClick={onSimulate} data-testid="sd-act-fund" sx={primaryBtn} startIcon={<Icon icon="mdi:flash-outline" />}>Simulate payment received</Button>
        </Box>
      )}
      <Typography sx={{ display: "none" }} data-testid="sd-fund-deal">{deal.escrow_id}</Typography>
    </Box>
  );
}

function CopyBtn({ k, v, copied, onCopy }: { k: string; v: string; copied: string | null; onCopy: (k: string, v: string) => void }) {
  return (
    <Tooltip title={copied === k ? "Copied" : "Copy"} arrow>
      <IconButton size="small" onClick={() => onCopy(k, v)} data-testid={`sd-fund-copy-${k}`} sx={{ color: copied === k ? "#059669" : SD_ACCENT }}>
        <Icon icon={copied === k ? "mdi:check" : "mdi:content-copy"} width={16} />
      </IconButton>
    </Tooltip>
  );
}
