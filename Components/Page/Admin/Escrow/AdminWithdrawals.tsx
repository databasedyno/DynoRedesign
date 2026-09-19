import React, { useCallback, useEffect, useState } from "react";
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { BRAND_ACCENT } from "@/constants/theme";
import { money, shortDate } from "@/Components/Page/Escrow/escrowUtils";
import { tabSx } from "./tabSx";

interface Withdrawal {
  withdrawal_id: number;
  customer_id: number;
  customer_email?: string | null;
  payout_key: string;
  address: string;
  amount_usd: string | number;
  fee_usd: string | number;
  net_usd: string | number;
  status: string;
  requires_approval: boolean;
  approved_by: string | null;
  tx_hash: string | null;
  simulated: boolean;
  rejected_reason: string | null;
  source: string;
  created_at: string;
}

const STATUSES = ["pending_approval", "sent", "rejected", "queued", ""];

/** Ops queue for SafeDeal customer withdrawals (> threshold need manual approval). */
export default function AdminWithdrawals() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const notify = (message: string, severity: "success" | "error" = "success") => dispatch({ type: "TOAST_SHOW", payload: { message, severity } });
  const [status, setStatus] = useState("pending_approval");
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [reject, setReject] = useState<Withdrawal | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminBaseApi.get("/safedeal/admin/withdrawals", { params: { status: status || undefined } });
      setRows(r.data?.data || []);
    } catch (e: any) {
      notify(e?.response?.data?.message || "Could not load withdrawals.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const approve = async (w: Withdrawal) => {
    setBusy(w.withdrawal_id);
    try {
      await adminBaseApi.post(`/safedeal/admin/withdrawals/${w.withdrawal_id}/approve`, {});
      notify(`Withdrawal #${w.withdrawal_id} approved and sent.`);
      await load();
    } catch (e: any) {
      notify(e?.response?.data?.message || "Approval failed.", "error");
    } finally {
      setBusy(null);
    }
  };
  const doReject = async () => {
    if (!reject) return;
    setBusy(reject.withdrawal_id);
    try {
      await adminBaseApi.post(`/safedeal/admin/withdrawals/${reject.withdrawal_id}/reject`, { reason });
      notify(`Withdrawal #${reject.withdrawal_id} rejected — funds returned to the customer.`);
      setReject(null);
      setReason("");
      await load();
    } catch (e: any) {
      notify(e?.response?.data?.message || "Rejection failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box data-testid="escrow-admin-withdrawals">
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
        {STATUSES.map((s) => (
          <Chip key={s || "all"} label={s ? s.replace("_", " ") : "All"} onClick={() => setStatus(s)} data-testid={`escrow-admin-wd-filter-${s || "all"}`} variant={status === s ? "filled" : "outlined"} sx={{ ...tabSx(status === s), textTransform: "capitalize" }} />
        ))}
      </Stack>
      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 8 }}><CircularProgress size={28} sx={{ color: BRAND_ACCENT }} /></Box>
      ) : rows.length === 0 ? (
        <Box sx={{ py: 7, textAlign: "center", borderRadius: 3, border: `1px dashed ${theme.palette.divider}` }} data-testid="escrow-admin-wd-empty">
          <Typography sx={{ fontWeight: 700 }}>No withdrawals {status ? `with status "${status.replace("_", " ")}"` : ""}</Typography>
        </Box>
      ) : (
        <Stack spacing={1.2}>
          {rows.map((w) => (
            <Box key={w.withdrawal_id} sx={{ p: 2, borderRadius: 2.5, border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }} data-testid={`escrow-admin-wd-row-${w.withdrawal_id}`}>
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ fontWeight: 700 }}>#{w.withdrawal_id} · {money(Number(w.amount_usd))}</Typography>
                  <Chip size="small" label={w.status.replace("_", " ")} data-testid={`escrow-admin-wd-status-${w.withdrawal_id}`} sx={{ fontWeight: 700, fontSize: 11, textTransform: "capitalize", backgroundColor: w.status === "sent" ? "#ECFDF5" : w.status === "rejected" ? "#FEF2F2" : "#FEF3C7", color: w.status === "sent" ? "#047857" : w.status === "rejected" ? "#B91C1C" : "#92400E" }} />
                  {w.source === "auto" && <Chip size="small" label="auto-withdraw" sx={{ fontSize: 11 }} />}
                  {w.simulated && <Chip size="small" label="simulated" sx={{ fontSize: 11 }} />}
                </Stack>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.3 }}>
                  {w.customer_email || `customer ${w.customer_id}`} · {w.payout_key} · <span style={{ fontFamily: "monospace" }}>{w.address}</span>
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                  {shortDate(w.created_at)} · fee {money(Number(w.fee_usd))} · net {money(Number(w.net_usd))}{w.tx_hash ? ` · ${w.tx_hash}` : ""}{w.approved_by ? ` · by ${w.approved_by}` : ""}{w.rejected_reason ? ` · ${w.rejected_reason}` : ""}
                </Typography>
              </Box>
              {w.status === "pending_approval" && (
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="contained" disabled={busy === w.withdrawal_id} onClick={() => void approve(w)} data-testid={`escrow-admin-wd-approve-${w.withdrawal_id}`} sx={{ textTransform: "none", fontWeight: 700, backgroundColor: theme.palette.success.main, "&:hover": { backgroundColor: theme.palette.success.dark } }}>Approve & send</Button>
                  <Button size="small" variant="outlined" color="error" disabled={busy === w.withdrawal_id} onClick={() => setReject(w)} data-testid={`escrow-admin-wd-reject-${w.withdrawal_id}`} sx={{ textTransform: "none", fontWeight: 700 }}>Reject</Button>
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      )}
      <Dialog open={!!reject} onClose={() => setReject(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reject withdrawal #{reject?.withdrawal_id}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 1.5 }}>The full amount is credited back to the customer&apos;s available balance and they&apos;ll see the reason on their statement.</Typography>
          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth size="small" inputProps={{ "data-testid": "escrow-admin-wd-reject-reason" }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReject(null)} sx={{ textTransform: "none" }}>Back</Button>
          <Button variant="contained" color="error" disabled={busy !== null || !reason.trim()} onClick={() => void doReject()} data-testid="escrow-admin-wd-reject-confirm" sx={{ textTransform: "none", fontWeight: 700 }}>Reject & refund</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
