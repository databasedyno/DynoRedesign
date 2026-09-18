import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  GavelRounded,
  ScheduleRounded,
  NotificationsActiveRounded,
  RefreshRounded,
} from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { escrowAdminApi, EscrowDeal, SettlementOutcome } from "@/api/escrow";
import { BRAND_ACCENT, brandAlpha } from "@/constants/theme";
import StatusChip from "@/Components/Page/Escrow/StatusChip";
import { money, shortDate, titleize } from "@/Components/Page/Escrow/escrowUtils";

type Tab = "disputes" | "all";

export default function AdminEscrow() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const notify = (message: string, severity: "success" | "error" = "success") =>
    dispatch({ type: "TOAST_SHOW", payload: { message, severity } });

  const [tab, setTab] = useState<Tab>("disputes");
  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [maint, setMaint] = useState<null | "auto" | "reminders">(null);

  // resolve dialog
  const [resolveTarget, setResolveTarget] = useState<EscrowDeal | null>(null);
  const [outcome, setOutcome] = useState<SettlementOutcome>("release");
  const [splitPct, setSplitPct] = useState(50);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list =
        tab === "disputes"
          ? await escrowAdminApi.disputes()
          : await escrowAdminApi.list({ status: statusFilter || undefined });
      setDeals(list);
    } catch (e: any) {
      notify(e?.response?.data?.message || "Could not load escrow deals.", "error");
      setDeals([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openResolve = (d: EscrowDeal) => {
    setResolveTarget(d);
    setOutcome("release");
    setSplitPct(d.split_percent_seller ?? 50);
    setNote("");
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    setBusy(true);
    try {
      await escrowAdminApi.resolve(resolveTarget.escrow_id, {
        outcome,
        split_percent_seller: outcome === "split" ? splitPct : undefined,
        note: note.trim() || undefined,
      });
      notify("Dispute resolved.");
      setResolveTarget(null);
      load();
    } catch (e: any) {
      notify(e?.response?.data?.message || "Could not resolve the dispute.", "error");
    } finally {
      setBusy(false);
    }
  };

  const runMaintenance = async (kind: "auto" | "reminders") => {
    setMaint(kind);
    try {
      if (kind === "auto") {
        const r = await escrowAdminApi.runAutoRelease();
        notify(`Auto-release processed ${r?.count ?? 0} deal(s).`);
      } else {
        await escrowAdminApi.runPayoutReminders();
        notify("Payout reminders processed.");
      }
      load();
    } catch (e: any) {
      notify(e?.response?.data?.message || "Maintenance task failed.", "error");
    } finally {
      setMaint(null);
    }
  };

  const cardBorder = `1px solid ${theme.palette.divider}`;

  const STATUS_OPTIONS = ["", "invited", "awaiting_payment", "funded", "delivered", "disputed", "completed", "refunded", "split", "cancelled"];

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", width: "100%", pb: 6 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <GavelRounded sx={{ color: BRAND_ACCENT }} />
        <Typography sx={{ fontWeight: 800, fontSize: 20 }}>Escrow oversight</Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={maint === "auto" ? <CircularProgress size={14} /> : <ScheduleRounded />}
          disabled={!!maint}
          onClick={() => runMaintenance("auto")}
          data-testid="escrow-admin-run-autorelease"
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Run auto-release
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={maint === "reminders" ? <CircularProgress size={14} /> : <NotificationsActiveRounded />}
          disabled={!!maint}
          onClick={() => runMaintenance("reminders")}
          data-testid="escrow-admin-run-reminders"
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Run payout reminders
        </Button>
      </Box>

      {/* Tabs */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Chip
          label="Dispute queue"
          onClick={() => setTab("disputes")}
          data-testid="escrow-admin-tab-disputes"
          variant={tab === "disputes" ? "filled" : "outlined"}
          sx={{ fontWeight: 600, backgroundColor: tab === "disputes" ? BRAND_ACCENT : "transparent", color: tab === "disputes" ? "#fff" : "text.primary" }}
        />
        <Chip
          label="All deals"
          onClick={() => setTab("all")}
          data-testid="escrow-admin-tab-all"
          variant={tab === "all" ? "filled" : "outlined"}
          sx={{ fontWeight: 600, backgroundColor: tab === "all" ? BRAND_ACCENT : "transparent", color: tab === "all" ? "#fff" : "text.primary" }}
        />
        {tab === "all" && (
          <Select
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            displayEmpty
            data-testid="escrow-admin-status-filter"
            sx={{ minWidth: 160 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s || "any"} value={s}>
                {s ? titleize(s) : "Any status"}
              </MenuItem>
            ))}
          </Select>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<RefreshRounded />} onClick={load} sx={{ textTransform: "none", color: "text.secondary" }} data-testid="escrow-admin-refresh">
          Refresh
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
          <CircularProgress size={28} sx={{ color: BRAND_ACCENT }} />
        </Box>
      ) : deals.length === 0 ? (
        <Box sx={{ py: 7, textAlign: "center", borderRadius: 3, border: `1px dashed ${theme.palette.divider}` }} data-testid="escrow-admin-empty">
          <Typography sx={{ fontWeight: 700 }}>{tab === "disputes" ? "No open disputes" : "No deals found"}</Typography>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
            {tab === "disputes" ? "The dispute queue is clear." : "Try a different status filter."}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.2} data-testid="escrow-admin-list">
          {deals.map((d) => (
            <Box key={d.escrow_id} sx={{ p: 2, borderRadius: 2.5, border: cardBorder, backgroundColor: theme.palette.background.paper }} data-testid={`escrow-admin-row-${d.escrow_id}`}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{d.title}</Typography>
                    <StatusChip deal={d} size="sm" />
                  </Box>
                  <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.3 }}>
                    #{d.escrow_id} · brand {d.company_id} · {titleize(d.creator_role)} created · {d.counterparty_email} · {shortDate(d.created_at)}
                  </Typography>
                  {d.status === "disputed" && d.dispute_reason && (
                    <Box sx={{ mt: 1, p: 1.2, borderRadius: 1.5, backgroundColor: brandAlpha(isDark ? 0.1 : 0.05) }}>
                      <Typography sx={{ fontSize: 12.5 }}>
                        <b>Dispute ({titleize(d.dispute_raised_by || "")}):</b> {d.dispute_reason}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{money(d.amount, d.currency)}</Typography>
                  {d.custody_amount_stable != null && (
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
                      custody {Number(d.custody_amount_stable).toFixed(2)} {d.custody_stablecoin}
                    </Typography>
                  )}
                </Box>
                {d.status === "disputed" && (
                  <Button
                    variant="contained"
                    onClick={() => openResolve(d)}
                    data-testid={`escrow-admin-resolve-${d.escrow_id}`}
                    sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
                  >
                    Resolve
                  </Button>
                )}
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {/* Resolve dialog */}
      <Dialog open={!!resolveTarget} onClose={busy ? undefined : () => setResolveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Resolve dispute · #{resolveTarget?.escrow_id}</DialogTitle>
        <DialogContent>
          {resolveTarget && (
            <>
              <Typography sx={{ fontSize: 13.5, color: "text.secondary", mb: 2 }}>
                {resolveTarget.title} · {money(resolveTarget.amount, resolveTarget.currency)} · custody{" "}
                {resolveTarget.custody_amount_stable != null ? `${Number(resolveTarget.custody_amount_stable).toFixed(2)} ${resolveTarget.custody_stablecoin}` : "—"}
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>Outcome</Typography>
              <Select fullWidth size="small" value={outcome} onChange={(e) => setOutcome(e.target.value as SettlementOutcome)} data-testid="escrow-admin-resolve-outcome" sx={{ mb: 2 }}>
                <MenuItem value="release">Release to seller</MenuItem>
                <MenuItem value="refund">Refund to buyer</MenuItem>
                <MenuItem value="split">Split between both</MenuItem>
              </Select>

              {outcome === "split" && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                    Seller gets {splitPct}% · buyer gets {100 - splitPct}%
                  </Typography>
                  <Slider
                    value={splitPct}
                    onChange={(_, v) => setSplitPct(v as number)}
                    step={5}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    data-testid="escrow-admin-resolve-split"
                    sx={{ color: BRAND_ACCENT }}
                  />
                </Box>
              )}

              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label="Resolution note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                inputProps={{ "data-testid": "escrow-admin-resolve-note" }}
              />
              <Divider sx={{ my: 2 }} />
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                Each party&apos;s payout waits until a valid destination address is on file, then settles per-leg.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResolveTarget(null)} disabled={busy} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submitResolve}
            disabled={busy}
            data-testid="escrow-admin-resolve-confirm"
            sx={{ backgroundColor: BRAND_ACCENT, textTransform: "none", fontWeight: 700 }}
          >
            {busy ? "Resolving…" : "Confirm resolution"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
