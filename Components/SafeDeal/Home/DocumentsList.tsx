import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { SdInvoice, sdError } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR, absTime } from "../sdFormat";
import { SD_BORDER, SD_GOLD, SD_GOLD_DEEP, SD_INK, SD_NOTE_BG, SD_NOTE_FG, SD_PAGE, SD_TEXT_MUTED } from "../sdTheme";

const STATE_CHIP: Record<string, { bg: string; fg: string }> = {
  release: { bg: "#ECFDF5", fg: "#047857" },
  completed: { bg: "#ECFDF5", fg: "#047857" },
  credited: { bg: "#ECFDF5", fg: "#047857" },
  refund: { bg: "#FEF3C7", fg: "#92400E" },
  refunded: { bg: "#FEF3C7", fg: "#92400E" },
};
const chipColors = (state: string) => STATE_CHIP[state] || { bg: SD_NOTE_BG, fg: SD_NOTE_FG };

type Kind = "all" | "deposit" | "deal";
const KINDS: Array<{ key: Kind; label: string }> = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposit receipts" },
  { key: "deal", label: "Deal invoices" },
];

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

interface Props {
  now: number;
  dealHref: (token: string) => string;
  notify: (m: string, s?: "success" | "error") => void;
}

/** Documents: one PDF per deposit (DEP-n) and per funded/closed deal (SD-n) — a list, not a ledger. */
export default function DocumentsList({ dealHref, notify }: Props) {
  const [rows, setRows] = useState<SdInvoice[] | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    safedealApi.invoices().then(setRows).catch((e) => { notify(sdError(e), "error"); setRows([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => (rows || []).filter((r) => kind === "all" || r.type === kind), [rows, kind]);

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
    <Box data-testid="sd-invoices" sx={{ borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, p: { xs: 1.5, md: 2.2 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.2} sx={{ mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>Documents</Typography>
          <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED }}>A branded PDF for every deposit and every deal you fund or close — download any time.</Typography>
        </Box>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap role="tablist" aria-label="Filter documents">
          {KINDS.map((k) => (
            <Chip key={k.key} role="tab" aria-selected={kind === k.key} label={k.label} onClick={() => setKind(k.key)} data-testid={`sd-docs-filter-${k.key}`} sx={{ fontWeight: 800, fontSize: 12.5, backgroundColor: kind === k.key ? SD_GOLD : "#fff", color: SD_INK, border: `1px solid ${kind === k.key ? SD_GOLD : SD_BORDER}`, "&:hover": { backgroundColor: kind === k.key ? SD_GOLD : SD_PAGE } }} />
          ))}
        </Stack>
      </Stack>

      {!rows ? (
        <Skeleton variant="rounded" height={120} />
      ) : filtered.length === 0 ? (
        <Box sx={{ py: 4, textAlign: "center" }} data-testid="sd-invoices-empty">
          <Icon icon="mdi:file-document-outline" width={34} color="#C9C6BC" aria-hidden />
          <Typography sx={{ fontWeight: 800, mt: 1 }}>No documents yet</Typography>
          <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED }}>A receipt is issued for every wallet deposit and an invoice for every deal you fund or close, showing exactly what was charged.</Typography>
        </Box>
      ) : (
        <Stack spacing={0.4}>
          {filtered.map((inv) => {
            const c = chipColors(inv.state);
            const deposit = inv.type === "deposit";
            return (
              <Box key={inv.id} data-testid={`sd-invoice-${inv.id}`} data-type={inv.type} sx={{ display: "grid", gridTemplateColumns: { xs: "36px 1fr", sm: "40px 1fr auto" }, alignItems: "center", gap: { xs: 1.2, md: 1.8 }, px: { xs: 1, md: 1.5 }, py: 1.1, borderRadius: 3, "&:hover": { backgroundColor: SD_PAGE } }}>
                <Box sx={{ width: { xs: 36, sm: 40 }, height: { xs: 36, sm: 40 }, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: deposit ? "rgba(18,183,106,0.12)" : SD_NOTE_BG, color: deposit ? "#0E9F5C" : SD_GOLD_DEEP }} aria-hidden>
                  <Icon icon={deposit ? "mdi:receipt-text-outline" : "mdi:file-certificate-outline"} width={20} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: 14, fontWeight: 900, ...TABULAR }}>{inv.invoice_no}</Typography>
                    <Chip size="small" label={inv.state_label} sx={{ height: 20, fontSize: 12, fontWeight: 800, backgroundColor: c.bg, color: c.fg }} />
                    {!deposit && <Chip size="small" label={inv.funding_label} data-testid={`sd-invoice-funding-${inv.id}`} sx={{ height: 20, fontSize: 12, fontWeight: 700, backgroundColor: "#F3F5F7", color: "#4B4B52" }} />}
                  </Stack>
                  <Typography sx={{ fontSize: 13, color: SD_INK, mt: 0.2 }} noWrap>{deposit ? `Deposit · ${inv.coin_label} on ${inv.network}` : `${inv.title} · you were the ${inv.my_role}`}</Typography>
                  <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, ...TABULAR }} noWrap>
                    <Tooltip title={absTime(inv.date)}><time dateTime={inv.date}>{dateLabel(inv.date)}</time></Tooltip>
                    {deposit
                      ? <> · sent {money(inv.received_usd)} · fees {money(inv.total_fee_usd)} · <b>credited {money(inv.credited_usd)}</b></>
                      : <> · deal {money(inv.amount, inv.currency)} · fees &amp; costs {money(inv.total_cost)} · <b>your share {money(inv.my_fee_share)}</b>{inv.my_amount > 0 ? ` · you received ${money(inv.my_amount)}` : ""}</>}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.6} sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, justifyContent: { xs: "flex-end", sm: "flex-start" } }}>
                  {!deposit && <Button size="small" href={dealHref(inv.deal_token)} data-testid={`sd-invoice-open-${inv.escrow_id}`} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_INK }}>Open deal</Button>}
                  <Button size="small" variant="outlined" disabled={busy === inv.id} onClick={() => void download(inv)} data-testid={`sd-invoice-pdf-${inv.id}`} startIcon={<Icon icon="mdi:file-pdf-box" width={16} />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, whiteSpace: "nowrap", borderColor: SD_BORDER, color: SD_INK, "&:hover": { borderColor: SD_GOLD_DEEP, backgroundColor: SD_NOTE_BG } }}>
                    {busy === inv.id ? "…" : "PDF"}
                  </Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
