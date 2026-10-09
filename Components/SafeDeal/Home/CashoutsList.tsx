import React from "react";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SdWithdrawal } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { explorerTxUrl, shortHash } from "@/helpers/explorerUrl";
import { TABULAR, absTime, relTime, withdrawalStatusLabel } from "../sdFormat";
import { SD_BORDER, SD_GOLD_DEEP, SD_NOTE_BG, SD_NOTE_FG, SD_PAGE, SD_TEXT_MUTED } from "../sdTheme";
import { shortAddr } from "./WalletDialogs";

/** Real blockchain hash for a cashout row: the backfilled column, or a legacy tx_hash that isn't an internal/exchange ref. */
const chainTx = (x: { chain_tx_hash?: string | null; tx_hash?: string | null }) => {
  if (x.chain_tx_hash) return x.chain_tx_hash;
  const h = x.tx_hash;
  return h && !/^(SIMULATED-|BINANCE-|WALLET-CREDIT|WITHDRAWAL-)/i.test(h) ? h : null;
};
/** payout_key ("USDT-TRON") → explorer helper code ("USDT-TRC20"). */
const explorerCode = (payoutKey: string) => payoutKey.toUpperCase().replace(/-TRON$/, "-TRC20");

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  sent: { bg: "#ECFDF5", fg: "#047857" },
  rejected: { bg: "#FEF2F2", fg: "#B91C1C" },
};

/** Every cashout and deal payout, with the on-chain transaction once it's confirmed. */
export default function CashoutsList({ withdrawals, now }: { withdrawals: SdWithdrawal[]; now: number }) {
  if (withdrawals.length === 0) return null;
  return (
    <Box data-testid="sd-withdrawals" sx={{ borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, p: { xs: 1.5, md: 2.2 } }}>
      <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>Cashouts &amp; payouts</Typography>
      <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, mb: 1.2 }}>Money that left SafeDeal to your addresses, with the blockchain transaction.</Typography>
      <Stack spacing={0.4}>
        {withdrawals.map((x) => {
          const tx = chainTx(x);
          const st = STATUS_STYLE[x.status] || { bg: SD_NOTE_BG, fg: SD_NOTE_FG };
          return (
            <Stack key={x.withdrawal_id} direction="row" spacing={1.2} alignItems="center" data-testid={`sd-withdrawal-${x.withdrawal_id}`} data-source={x.source || "manual"} sx={{ px: { xs: 1, md: 1.5 }, py: 1.1, borderRadius: 3, "&:hover": { backgroundColor: SD_PAGE } }}>
              <Box sx={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", backgroundColor: "#F3F5F7", flexShrink: 0 }} aria-hidden>
                <Icon icon="mdi:bank-transfer-out" width={19} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, ...TABULAR }}>{money(Number(x.amount_usd))} → {shortAddr(x.address)}</Typography>
                  <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED }}>{x.payout_key}</Typography>
                  {x.source === "settlement" && <Chip size="small" label={x.escrow_id ? `Deal #${x.escrow_id} payout` : "Deal payout"} sx={{ fontSize: 12, fontWeight: 800, height: 20, backgroundColor: SD_NOTE_BG, color: SD_NOTE_FG }} />}
                </Stack>
                <Typography component="div" sx={{ fontSize: 12, color: SD_TEXT_MUTED, ...TABULAR }}>
                  <Tooltip title={absTime(x.created_at)}><time dateTime={x.created_at}>{relTime(x.created_at, now)}</time></Tooltip>
                  {" · "}#{x.withdrawal_id} · {x.source === "settlement" ? "network fee covered by the deal" : `fee ${money(Number(x.fee_usd))}`} · you receive {money(Number(x.net_usd))}{x.rejected_reason ? ` · ${x.rejected_reason}` : ""}
                  {x.status === "sent" && (tx ? (
                    <> · <a href={explorerTxUrl(explorerCode(x.payout_key), tx)} target="_blank" rel="noopener noreferrer" data-testid={`sd-withdrawal-tx-${x.withdrawal_id}`} style={{ color: SD_GOLD_DEEP, fontWeight: 700, fontFamily: "monospace" }}>tx {shortHash(tx, 8, 6)}</a></>
                  ) : (
                    <> · <span data-testid={`sd-withdrawal-tx-pending-${x.withdrawal_id}`}>SafeDeal is sending it — blockchain tx follows in a few minutes</span></>
                  ))}
                </Typography>
              </Box>
              <Chip size="small" label={withdrawalStatusLabel(x.status)} data-testid={`sd-withdrawal-status-${x.withdrawal_id}`} data-status={x.status} sx={{ fontWeight: 800, fontSize: 12, backgroundColor: st.bg, color: st.fg, flexShrink: 0 }} />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
