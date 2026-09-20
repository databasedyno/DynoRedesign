import React, { useEffect, useState } from "react";
import { Box, Button, Chip, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { SdInvoice, SdInvoiceDeal, SdInvoiceDeposit, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR, absTime, relTime } from "./sdFormat";
import { card, ghostBtn } from "./sdStyles";
import { SD_NOTE_BG, SD_NOTE_FG } from "./sdTheme";

const STATE_CHIP: Record<string, { bg: string; fg: string }> = {
  release: { bg: "#ECFDF5", fg: "#047857" },
  completed: { bg: "#ECFDF5", fg: "#047857" },
  credited: { bg: "#ECFDF5", fg: "#047857" },
  refund: { bg: "#FEF3C7", fg: "#92400E" },
  refunded: { bg: "#FEF3C7", fg: "#92400E" },
  funded: { bg: SD_NOTE_BG, fg: SD_NOTE_FG },
  split: { bg: SD_NOTE_BG, fg: SD_NOTE_FG },
};

const chipColors = (state: string) => STATE_CHIP[state] || STATE_CHIP.funded;

/** All my invoices & receipts: closed/funded deals + wallet deposits — downloadable any time. */
export default function InvoicesCard({ now, dealHref, notify }: { now: number; dealHref: (token: string) => string; notify: (m: string, s?: "success" | "error") => void }) {
  const [rows, setRows] = useState<SdInvoice[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    safedealApi.invoices().then(setRows).catch((e) => { notify(sdError(e), "error"); setRows([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async (inv: SdInvoice) => {
    setBusy(inv.id);
    try {
      const blob = inv.type === "deposit" ? await safedealApi.topupReceiptPdf(inv.topup_id) : await safedealApi.dealPdf(inv.deal_token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = inv.type === "deposit" ? `safedeal-deposit-${inv.topup_id}.pdf` : `safedeal-invoice-${inv.escrow_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notify(sdError(e), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ ...card, mt: 2.5 }} data-testid="sd-invoices">
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Invoices &amp; receipts</Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280" }}>Deposits &amp; deal payments, with fees</Typography>
      </Stack>
      {!rows ? (
        <Skeleton variant="rounded" height={80} />
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13.5, color: "#6B7280", py: 2, textAlign: "center" }} data-testid="sd-invoices-empty">No invoices yet — a receipt is issued for every wallet deposit and every deal you fund or close, showing exactly what was charged.</Typography>
      ) : (
        <Stack spacing={0.8}>
          {rows.map((inv) =>
            inv.type === "deposit" ? (
              <DepositRow key={inv.id} inv={inv} now={now} busy={busy === inv.id} onDownload={() => void download(inv)} />
            ) : (
              <DealRow key={inv.id} inv={inv} now={now} busy={busy === inv.id} dealHref={dealHref} onDownload={() => void download(inv)} />
            )
          )}
        </Stack>
      )}
    </Box>
  );
}

function DepositRow({ inv, now, busy, onDownload }: { inv: SdInvoiceDeposit; now: number; busy: boolean; onDownload: () => void }) {
  const c = chipColors(inv.state);
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ sm: "center" }} data-testid={`sd-invoice-${inv.id}`} data-type="deposit" sx={{ py: 1, borderBottom: "1px solid #F3F4F6" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
          <Icon icon="mdi:wallet-plus-outline" width={18} />
          <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{inv.invoice_no}</Typography>
          <Chip size="small" label={inv.state_label} sx={{ height: 20, fontSize: 10.5, fontWeight: 800, backgroundColor: c.bg, color: c.fg }} />
        </Stack>
        <Typography sx={{ fontSize: 13, color: "#374151", mt: 0.2 }} noWrap>Deposit to wallet balance · {inv.coin_label} on {inv.network}</Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", ...TABULAR }}>
          <Tooltip title={absTime(inv.date)}><time dateTime={inv.date}>{relTime(inv.date, now)}</time></Tooltip>
          {" · "}sent {money(inv.received_usd)} · network fee {money(inv.network_fee_usd)}
          {inv.total_fee_usd > inv.network_fee_usd ? ` · fees ${money(inv.total_fee_usd)}` : ""} · <b>credited {money(inv.credited_usd)}</b>
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.6} sx={{ flexShrink: 0 }}>
        <Button size="small" variant="outlined" disabled={busy} onClick={onDownload} sx={{ ...ghostBtn, whiteSpace: "nowrap" }} startIcon={<Icon icon="mdi:file-pdf-box" width={16} />} data-testid={`sd-invoice-pdf-${inv.id}`}>
          {busy ? "…" : "Receipt PDF"}
        </Button>
      </Stack>
    </Stack>
  );
}

function DealRow({ inv, now, busy, dealHref, onDownload }: { inv: SdInvoiceDeal; now: number; busy: boolean; dealHref: (token: string) => string; onDownload: () => void }) {
  const c = chipColors(inv.state);
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ sm: "center" }} data-testid={`sd-invoice-${inv.id}`} data-type="deal" sx={{ py: 1, borderBottom: "1px solid #F3F4F6" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{inv.invoice_no}</Typography>
          <Chip size="small" label={inv.state_label} sx={{ height: 20, fontSize: 10.5, fontWeight: 800, backgroundColor: c.bg, color: c.fg }} />
          <Chip size="small" label={inv.funding_label} sx={{ height: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: "#F3F4F6", color: "#374151" }} data-testid={`sd-invoice-funding-${inv.id}`} />
          <Typography sx={{ fontSize: 12, color: "#6B7280" }}>you were the {inv.my_role}</Typography>
        </Stack>
        <Typography sx={{ fontSize: 13, color: "#374151", mt: 0.2 }} noWrap>{inv.title}</Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", ...TABULAR }}>
          <Tooltip title={absTime(inv.date)}><time dateTime={inv.date}>{relTime(inv.date, now)}</time></Tooltip>
          {" · "}deal {money(inv.amount, inv.currency)} · fees &amp; costs {money(inv.total_cost)} · <b>your share {money(inv.my_fee_share)}</b>
          {inv.my_amount > 0 ? ` · you received ${money(inv.my_amount)}` : ""}
          {inv.my_payout ? ` · paid out to ${inv.my_payout.payout_key} (${inv.my_payout.status})` : ""}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.6} sx={{ flexShrink: 0 }}>
        <Button size="small" href={dealHref(inv.deal_token)} sx={ghostBtn} data-testid={`sd-invoice-open-${inv.escrow_id}`}>Open deal</Button>
        <Button size="small" variant="outlined" disabled={busy} onClick={onDownload} sx={{ ...ghostBtn, whiteSpace: "nowrap" }} startIcon={<Icon icon="mdi:file-pdf-box" width={16} />} data-testid={`sd-invoice-pdf-${inv.id}`}>
          {busy ? "…" : "Invoice PDF"}
        </Button>
      </Stack>
    </Stack>
  );
}
