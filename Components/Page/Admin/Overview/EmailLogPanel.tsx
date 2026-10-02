import React, { useCallback, useEffect, useState } from "react";
import { Box, Button, Chip, CircularProgress, InputAdornment, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { MailOutlineRounded, RefreshRounded, SearchRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { useRefetchOnVisible } from "@/hooks/useRefetchOnVisible";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { SectionCard, formatDateTime } from "../adminUi";

interface EmailLogRow {
  log_id: number;
  to_email: string;
  subject: string;
  template: string | null;
  lane: string;
  status: string;
  attempts: number;
  brevo_message_id: string | null;
  last_error: string | null;
  last_event: string | null;
  sent_at: string | null;
  created_at: string;
}
interface Stats {
  last24h: Record<string, number>;
  bounced_users: number;
  queue: { waiting?: number; active?: number; delayed?: number; failed?: number; dlq?: number; worker_running?: boolean; error?: string };
}
interface DlqItem { job_id: string; to: string; subject: string; parked_at: string | null }

const STATUS_COLOR: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  queued: "info", sent: "success", delivered: "success", bounced: "error", failed: "error", suppressed: "warning", expired: "warning",
};
const STATUSES = ["queued", "sent", "delivered", "bounced", "failed", "suppressed", "expired"];

/** Admin › Overview — outbound email send log, queue health, bounces and the dead-letter queue. */
const EmailLogPanel: React.FC = () => {
  const dispatch = useDispatch();
  const [rows, setRows] = useState<EmailLogRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dlq, setDlq] = useState<DlqItem[]>([]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (email.trim()) params.set("email", email.trim());
      if (status) params.set("status", status);
      const [list, st, dq] = await Promise.all([
        adminBaseApi.get(`/admin/email-log?${params.toString()}`),
        adminBaseApi.get("/admin/email-log/stats"),
        adminBaseApi.get("/admin/email-log/dlq"),
      ]);
      setRows((list.data?.data?.rows as EmailLogRow[]) || []);
      setStats((st.data?.data as Stats) || null);
      setDlq((dq.data?.data?.items as DlqItem[]) || []);
    } catch {
      setRows([]);
    }
  }, [email, status]);

  useEffect(() => { load(); }, [load]);
  useRefetchOnVisible(load);

  const toast = (message: string, severity: "success" | "error") => dispatch({ type: TOAST_SHOW, payload: { message, severity } });

  const retry = async (jobId: string) => {
    setBusy(jobId);
    try {
      await adminBaseApi.post(`/admin/email-log/dlq/${encodeURIComponent(jobId)}/retry`, {});
      toast("Email re-queued.", "success");
      await load();
    } catch (e: unknown) {
      toast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Couldn't re-queue.", "error");
    } finally {
      setBusy(null);
    }
  };

  const clearBounce = async (addr: string) => {
    setBusy(addr);
    try {
      await adminBaseApi.post("/admin/email-log/bounces/clear", { email: addr });
      toast(`Bounce flag cleared for ${addr}.`, "success");
      await load();
    } catch (e: unknown) {
      toast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Couldn't clear bounce.", "error");
    } finally {
      setBusy(null);
    }
  };

  const q = stats?.queue || {};
  return (
    <SectionCard
      title="Email log"
      testid="admin-email-log"
      action={
        <Button size="small" onClick={load} startIcon={<RefreshRounded sx={{ fontSize: 16 }} />} data-testid="admin-email-log-refresh" sx={{ textTransform: "none", fontSize: 12.5 }}>
          Refresh
        </Button>
      }
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }} data-testid="admin-email-log-stats">
        {STATUSES.map((s) => (
          <Chip
            key={s}
            size="small"
            variant={status === s ? "filled" : "outlined"}
            color={STATUS_COLOR[s]}
            onClick={() => setStatus(status === s ? "" : s)}
            label={`${s} · ${stats?.last24h?.[s] ?? 0}`}
            data-testid={`admin-email-log-filter-${s}`}
            sx={{ height: 24, fontSize: 11.5, textTransform: "capitalize" }}
          />
        ))}
        <Tooltip title={q.error ? `Queue unreachable: ${q.error}` : `waiting ${q.waiting ?? 0} · active ${q.active ?? 0} · delayed ${q.delayed ?? 0} · failed ${q.failed ?? 0}`} arrow>
          <Chip size="small" variant="outlined" label={`queue ${(q.waiting ?? 0) + (q.active ?? 0) + (q.delayed ?? 0)} · DLQ ${q.dlq ?? 0}${q.worker_running ? "" : " · worker off"}`} data-testid="admin-email-log-queue" sx={{ height: 24, fontSize: 11.5 }} />
        </Tooltip>
        <Chip size="small" variant="outlined" color={stats?.bounced_users ? "error" : "default"} label={`bounced users ${stats?.bounced_users ?? 0}`} data-testid="admin-email-log-bounced-users" sx={{ height: 24, fontSize: 11.5 }} />
      </Box>

      <TextField
        size="small"
        fullWidth
        placeholder="Search by recipient email…"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        inputProps={{ "data-testid": "admin-email-log-search" }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 18 }} /></InputAdornment> }}
        sx={{ mb: 1.5 }}
      />

      {rows === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
      ) : rows.length === 0 ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2, color: "text.secondary" }} data-testid="admin-email-log-empty">
          <MailOutlineRounded sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: 13.5 }}>No emails match. Every queued / sent / bounced email shows up here (90-day history).</Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Detail</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.log_id} data-testid={`admin-email-log-row-${r.log_id}`} hover>
                  <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{formatDateTime(r.created_at)}</TableCell>
                  <TableCell sx={{ fontSize: 12.5, maxWidth: 220 }}><Typography noWrap sx={{ fontSize: 12.5 }}>{r.to_email}</Typography></TableCell>
                  <TableCell sx={{ fontSize: 12.5, maxWidth: 320 }}>
                    <Tooltip title={r.subject} placement="top" arrow><Typography noWrap sx={{ fontSize: 12.5 }}>{r.subject}</Typography></Tooltip>
                    {r.template && <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{r.template}{r.lane === "otp" ? " · otp lane" : ""}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || "default"} variant="outlined" sx={{ height: 22, fontSize: 11.5 }} data-testid={`admin-email-log-status-${r.log_id}`} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 11.5, color: "text.secondary", maxWidth: 260 }}>
                    <Tooltip title={r.last_error || r.brevo_message_id || ""} arrow>
                      <Typography noWrap sx={{ fontSize: 11.5 }}>
                        {r.attempts > 1 ? `${r.attempts} attempts · ` : ""}{r.last_event ? `${r.last_event} · ` : ""}{r.last_error || (r.sent_at ? `sent ${formatDateTime(r.sent_at)}` : "—")}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    {r.status === "bounced" && (
                      <Button size="small" variant="outlined" color="warning" disabled={busy === r.to_email} onClick={() => clearBounce(r.to_email)} data-testid={`admin-email-log-clear-bounce-${r.log_id}`} sx={{ textTransform: "none", fontSize: 12 }}>
                        Clear bounce
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {dlq.length > 0 && (
        <Box sx={{ mt: 2 }} data-testid="admin-email-log-dlq">
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.5 }}>Dead-letter queue ({dlq.length})</Typography>
          {dlq.map((d) => (
            <Box key={d.job_id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
              <Typography noWrap sx={{ fontSize: 12.5, flex: 1 }}>{d.to} — {d.subject}</Typography>
              <Button size="small" variant="outlined" disabled={busy === d.job_id} onClick={() => retry(d.job_id)} data-testid={`admin-email-log-dlq-retry-${d.job_id}`} sx={{ textTransform: "none", fontSize: 12 }}>
                Retry
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </SectionCard>
  );
};

export default EmailLogPanel;
