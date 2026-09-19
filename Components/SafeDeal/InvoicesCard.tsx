import React, { useEffect, useState } from "react";
import { Box, Button, Chip, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { SdInvoice, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR, absTime, relTime } from "./sdFormat";
import { card, ghostBtn } from "./sdStyles";
import { SD_NOTE_BG, SD_NOTE_FG } from "./sdTheme";

const OUTCOME: Record<string, { label: string; bg: string; fg: string }> = {
  release: { label: "Completed", bg: "#ECFDF5", fg: "#047857" },
  refund: { label: "Refunded", bg: "#FEF3C7", fg: "#92400E" },
  split: { label: "Split", bg: SD_NOTE_BG, fg: SD_NOTE_FG },
};

/** Every closed deal with its final fee stack — the user's invoices, downloadable any time. */
export default function InvoicesCard({ now, dealHref, notify }: { now: number; dealHref: (token: string) => string; notify: (m: string, s?: "success" | "error") => void }) {
  const [rows, setRows] = useState<SdInvoice[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    safedealApi.invoices().then(setRows).catch((e) => { notify(sdError(e), "error"); setRows([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async (inv: SdInvoice) => {
    setBusy(inv.escrow_id);
    try {
      const blob = await safedealApi.dealPdf(inv.deal_token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `safedeal-invoice-${inv.escrow_id}.pdf`;
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
        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Invoices</Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280" }}>Final fees & costs per closed deal</Typography>
      </Stack>
      {!rows ? (
        <Skeleton variant="rounded" height={80} />
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 13.5, color: "#6B7280", py: 2, textAlign: "center" }} data-testid="sd-invoices-empty">No invoices yet — one is issued for every deal that completes, refunds or splits, showing exactly what was charged.</Typography>
      ) : (
        <Stack spacing={0.8}>
          {rows.map((inv) => {
            const o = OUTCOME[inv.outcome || "release"] || OUTCOME.release;
            return (
              <Stack key={inv.escrow_id} direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ sm: "center" }} data-testid={`sd-invoice-${inv.escrow_id}`} sx={{ py: 1, borderBottom: "1px solid #F3F4F6" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{inv.invoice_no}</Typography>
                    <Chip size="small" label={o.label} sx={{ height: 20, fontSize: 10.5, fontWeight: 800, backgroundColor: o.bg, color: o.fg }} />
                    <Typography sx={{ fontSize: 12, color: "#6B7280" }}>you were the {inv.my_role}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 13, color: "#374151", mt: 0.2 }} noWrap>{inv.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", ...TABULAR }}>
                    <Tooltip title={absTime(inv.closed_at)}><time dateTime={inv.closed_at}>{relTime(inv.closed_at, now)}</time></Tooltip>
                    {" · "}deal {money(inv.amount, inv.currency)} · fees & costs {money(inv.total_cost)} · <b>your share {money(inv.my_fee_share)}</b>
                    {inv.my_amount > 0 ? ` · you received ${money(inv.my_amount)}` : ""}
                    {inv.my_payout ? ` · paid out to ${inv.my_payout.payout_key} (${inv.my_payout.status})` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.6} sx={{ flexShrink: 0 }}>
                  <Button size="small" href={dealHref(inv.deal_token)} sx={ghostBtn} data-testid={`sd-invoice-open-${inv.escrow_id}`}>Open deal</Button>
                  <Button size="small" variant="outlined" disabled={busy === inv.escrow_id} onClick={() => void download(inv)} sx={{ ...ghostBtn, whiteSpace: "nowrap" }} startIcon={<Icon icon="mdi:file-pdf-box" width={16} />} data-testid={`sd-invoice-pdf-${inv.escrow_id}`}>
                    {busy === inv.escrow_id ? "…" : "Invoice PDF"}
                  </Button>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
