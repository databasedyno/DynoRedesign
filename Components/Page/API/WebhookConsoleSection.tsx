/**
 * WebhookConsoleSection — developer webhook console on the API / developer page.
 *
 * A self-contained card that lets a merchant:
 *   • configure their webhook endpoint URL + view/regenerate the signing secret
 *   • fire a test event
 *   • see recent delivery attempts (event, status, HTTP code, latency, retries)
 *     and drill into a single attempt (payload sent + response status + error)
 *
 * All data comes from EXISTING backend routes (no new endpoints, no schema
 * changes) — mounted under /api/company:
 *   GET  /company/webhook-settings/:id
 *   PUT  /company/webhook-settings/:id      { webhook_url } | { webhook_secret: 'generate' }
 *   POST /company/webhook-test/:id
 *   GET  /company/webhook-history/:id?page&limit&status&event_type
 *   GET  /company/webhook-history/:id/detail/:logId
 *   GET  /company/webhook-stats/:id?days
 */

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { Icon } from "@/styles/uiKit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import axiosBaseApi from "@/axiosConfig";
import PanelCard from "@/Components/UI/PanelCard";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer } from "@/utils/types";
import copyToClipboard from "@/helpers/copyToClipboard";

interface WebhookLog {
  log_id: number;
  event_type: string;
  webhook_id: string;
  status: "pending" | "success" | "failed" | string;
  response_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

interface WebhookLogDetail extends WebhookLog {
  company_id?: number;
  webhook_url?: string;
  payload?: string | null;
}

interface WebhookStats {
  total_deliveries: number;
  successful: number;
  failed: number;
  success_rate: string;
  avg_response_time_ms: number;
  last_delivery: string | null;
}

const statusMeta = (status: string) => {
  switch (status) {
    case "success":
      return { label: "Delivered", color: "#16A34A", bg: "rgba(22,163,74,0.12)", iconName: "circle-check" };
    case "failed":
      return { label: "Failed", color: "#DC2626", bg: "rgba(220,38,38,0.12)", iconName: "circle-alert" };
    default:
      return { label: "Pending", color: "#D97706", bg: "rgba(217,119,6,0.12)", iconName: "hourglass" };
  }
};

const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const prettyJson = (raw?: string | null) => {
  if (!raw) return "—";
  try {
    return JSON.stringify(typeof raw === "string" ? JSON.parse(raw) : raw, null, 2);
  } catch {
    return String(raw);
  }
};

const WebhookConsoleSection = () => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const dispatch = useDispatch();

  const selectedCompanyId = useSelector(
    (s: rootReducer) => (s as unknown as { companyReducer?: { selectedCompanyId?: string | number } }).companyReducer?.selectedCompanyId,
  );
  const companyList = useSelector(
    (s: rootReducer) => (s as unknown as { companyReducer?: { companyList?: Array<{ company_id?: string | number }> } }).companyReducer?.companyList,
  );
  const companyId = useMemo(
    () => selectedCompanyId || (Array.isArray(companyList) && companyList[0]?.company_id) || null,
    [selectedCompanyId, companyList],
  );

  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [detail, setDetail] = useState<WebhookLogDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toast = useCallback(
    (message: string, severity: "success" | "error" | "info" = "success") =>
      dispatch({ type: TOAST_SHOW, payload: { message, severity } }),
    [dispatch],
  );

  const loadSettings = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await axiosBaseApi.get(`/company/webhook-settings/${companyId}`);
      const d = res?.data?.data;
      if (d) {
        setUrl(d.webhook_url ?? "");
        setSavedUrl(d.webhook_url ?? "");
        setSecret(d.webhook_secret ?? "");
      }
    } catch {
      /* non-fatal */
    }
  }, [companyId]);

  const loadStats = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await axiosBaseApi.get(`/company/webhook-stats/${companyId}?days=30`);
      setStats(res?.data?.data?.summary ?? null);
    } catch {
      setStats(null);
    }
  }, [companyId]);

  const loadLogs = useCallback(async () => {
    if (!companyId) return;
    setLoadingLogs(true);
    try {
      const q = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const res = await axiosBaseApi.get(`/company/webhook-history/${companyId}?page=1&limit=20${q}`);
      const list = res?.data?.data?.logs;
      setLogs(Array.isArray(list) ? list : []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [companyId, statusFilter]);

  const refreshAll = useCallback(() => {
    loadStats();
    loadLogs();
  }, [loadStats, loadLogs]);

  useEffect(() => {
    if (!companyId) return;
    loadSettings();
    loadStats();
    loadLogs();
  }, [companyId, loadSettings, loadStats, loadLogs]);

  const saveUrl = async () => {
    if (!companyId) return;
    const trimmed = url.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast("Webhook URL must start with http:// or https://", "error");
      return;
    }
    setSavingUrl(true);
    try {
      await axiosBaseApi.put(`/company/webhook-settings/${companyId}`, { webhook_url: trimmed });
      setSavedUrl(trimmed);
      toast("Webhook endpoint saved");
    } catch {
      toast("Failed to save webhook endpoint", "error");
    } finally {
      setSavingUrl(false);
    }
  };

  const regenerateSecret = async () => {
    if (!companyId) return;
    setRegenerating(true);
    try {
      const res = await axiosBaseApi.put(`/company/webhook-settings/${companyId}`, { webhook_secret: "generate" });
      const d = res?.data?.data;
      if (d?.webhook_secret) {
        setSecret(d.webhook_secret);
        setShowSecret(true);
        toast("Signing secret regenerated");
      }
    } catch {
      toast("Failed to regenerate secret", "error");
    } finally {
      setRegenerating(false);
    }
  };

  const sendTest = async () => {
    if (!companyId) return;
    if (!savedUrl) {
      toast("Save a webhook endpoint URL first", "error");
      return;
    }
    setSendingTest(true);
    try {
      await axiosBaseApi.post(`/company/webhook-test/${companyId}`);
      toast("Test event sent — check recent deliveries");
      setTimeout(refreshAll, 1200);
      setTimeout(refreshAll, 4000);
    } catch {
      toast("Failed to send test event", "error");
    } finally {
      setSendingTest(false);
    }
  };

  const openDetail = async (logId: number) => {
    if (!companyId) return;
    setLoadingDetail(true);
    setDetail({ log_id: logId } as WebhookLogDetail);
    try {
      const res = await axiosBaseApi.get(`/company/webhook-history/${companyId}/detail/${logId}`);
      setDetail(res?.data?.data ?? null);
    } catch {
      toast("Failed to load delivery detail", "error");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const copy = (text: string, label: string) => {
    if (!text) return;
    copyToClipboard(text).then(
      () => toast(`${label} copied`),
      () => toast(`Failed to copy ${label}`, "error"),
    );
  };

  const t = theme.palette.text;
  const urlDirty = url.trim() !== savedUrl.trim();

  return (
    <>
      <PanelCard
        title="Webhooks"
        subTitle="Receive real-time events and inspect recent delivery attempts"
        headerIcon={<Icon name="webhook" color={theme.palette.primary.main} />}
        headerAction={
          <Tooltip title="Refresh">
            <IconButton onClick={refreshAll} size="small" data-testid="webhook-refresh">
              <Icon name="refresh-cw" size={20} />
            </IconButton>
          </Tooltip>
        }
      >
        {!companyId ? (
          <Typography sx={{ fontSize: 13, color: t.secondary, py: 2 }}>
            Select a company to configure webhooks.
          </Typography>
        ) : (
          <Box data-testid="webhook-console">
            {/* Endpoint URL */}
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: t.secondary, mb: 0.75 }}>
              Endpoint URL
            </Typography>
            <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="https://yoursite.com/webhooks/dynopay"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                data-testid="webhook-url-input"
                inputProps={{ "aria-label": "Webhook endpoint URL" }}
              />
              <Button
                variant="contained"
                onClick={saveUrl}
                disabled={savingUrl || !urlDirty}
                data-testid="webhook-url-save"
                sx={{ minWidth: 96, textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap" }}
              >
                {savingUrl ? <CircularProgress size={18} color="inherit" /> : "Save"}
              </Button>
            </Box>

            {/* Signing secret */}
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: t.secondary, mb: 0.75 }}>
              Signing secret
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
              <Box
                sx={{
                  flex: 1, minWidth: 180, display: "flex", alignItems: "center", justifyContent: "space-between",
                  px: 1.25, py: 1, borderRadius: 2, border: `1px solid ${theme.palette.divider}`,
                  bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                }}
              >
                <Typography sx={{ fontFamily: "monospace", fontSize: 13, color: t.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {secret ? (showSecret ? secret : "•".repeat(Math.min(secret.length, 28))) : "No secret set — regenerate to create one"}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                  {secret && (
                    <>
                      <Tooltip title={showSecret ? "Hide" : "Reveal"}>
                        <IconButton size="small" onClick={() => setShowSecret((s) => !s)} data-testid="webhook-secret-toggle">
                          {showSecret ? <Icon name="eye-off" size={20} /> : <Icon name="eye" size={20} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy secret">
                        <IconButton size="small" onClick={() => copy(secret, "Secret")}>
                          <Icon name="copy" size={20} />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>
              <Button
                variant="outlined"
                onClick={regenerateSecret}
                disabled={regenerating}
                startIcon={regenerating ? <CircularProgress size={14} color="inherit" /> : <Icon name="refresh-cw" size={20} />}
                data-testid="webhook-secret-regen"
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap" }}
              >
                Regenerate
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={sendTest}
                disabled={sendingTest}
                startIcon={sendingTest ? <CircularProgress size={14} color="inherit" /> : <Icon name="send" size={20} />}
                data-testid="webhook-send-test"
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap" }}
              >
                Send test event
              </Button>
            </Box>

            {/* Stats strip */}
            {stats && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }} data-testid="webhook-stats">
                {[
                  { k: "Delivered", v: String(stats.successful ?? 0), c: "#16A34A" },
                  { k: "Failed", v: String(stats.failed ?? 0), c: "#DC2626" },
                  { k: "Success rate", v: stats.success_rate ?? "—", c: t.primary },
                  { k: "Avg latency", v: stats.avg_response_time_ms ? `${stats.avg_response_time_ms} ms` : "—", c: t.primary },
                ].map((s) => (
                  <Box key={s.k} sx={{ px: 1.5, py: 1, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, minWidth: 92 }}>
                    <Typography sx={{ fontSize: 10.5, color: t.secondary, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>{s.k}</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</Typography>
                  </Box>
                ))}
              </Box>
            )}

            {/* Recent deliveries */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: t.secondary }}>
                Recent deliveries
              </Typography>
              <Select
                size="small"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "success" | "failed")}
                data-testid="webhook-status-filter"
                sx={{ fontSize: 12, height: 30, ".MuiSelect-select": { py: 0.5 } }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="success">Delivered</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </Box>

            <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: "hidden" }} data-testid="webhook-deliveries">
              {loadingLogs ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={22} />
                </Box>
              ) : logs.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4, px: 2 }} data-testid="webhook-deliveries-empty">
                  <Typography sx={{ fontSize: 13, color: t.secondary }}>
                    No deliveries yet. Save an endpoint and click “Send test event”.
                  </Typography>
                </Box>
              ) : (
                logs.map((lg, i) => {
                  const m = statusMeta(lg.status);
                  return (
                    <Box
                      key={lg.log_id}
                      onClick={() => openDetail(lg.log_id)}
                      data-testid="webhook-delivery-row"
                      sx={{
                        display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.25, cursor: "pointer",
                        borderTop: i === 0 ? "none" : `1px solid ${theme.palette.divider}`,
                        "&:hover": { bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" },
                      }}
                    >
                      <Icon name={m.iconName} size={18} color={m.color} style={{ flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: t.primary, fontFamily: "monospace" }}>
                          {lg.event_type}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: t.secondary }}>
                          {fmtTime(lg.created_at)}
                          {lg.retry_count > 0 ? ` · ${lg.retry_count} retr${lg.retry_count === 1 ? "y" : "ies"}` : ""}
                        </Typography>
                      </Box>
                      {lg.response_time_ms != null && !isMobile && (
                        <Typography sx={{ fontSize: 12, color: t.secondary, fontFamily: "monospace" }}>{lg.response_time_ms} ms</Typography>
                      )}
                      <Chip
                        label={lg.response_status != null ? `${m.label} · ${lg.response_status}` : m.label}
                        size="small"
                        sx={{ bgcolor: m.bg, color: m.color, fontWeight: 700, fontSize: 11, height: 22 }}
                      />
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        )}
      </PanelCard>

      {/* Delivery detail modal */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography sx={{ fontWeight: 800, fontSize: 15 }}>Delivery attempt</Typography>
            <IconButton size="small" onClick={() => setDetail(null)} aria-label="Close">
              <Icon name="x" size={20} />
            </IconButton>
          </Box>
          {loadingDetail || !detail ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ p: 2.5 }}>
              {[
                ["Event", detail.event_type],
                ["Status", detail.status],
                ["HTTP response", detail.response_status != null ? String(detail.response_status) : "—"],
                ["Latency", detail.response_time_ms != null ? `${detail.response_time_ms} ms` : "—"],
                ["Retries", String(detail.retry_count ?? 0)],
                ["Endpoint", detail.webhook_url || "—"],
                ["Sent at", fmtTime(detail.created_at)],
                ["Completed at", fmtTime(detail.completed_at)],
                ["Delivery ID", detail.webhook_id || "—"],
              ].map(([k, v]) => (
                <Box key={String(k)} sx={{ display: "flex", gap: 2, py: 0.75, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography sx={{ fontSize: 12, color: t.secondary, minWidth: 110, fontWeight: 600 }}>{k}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: t.primary, wordBreak: "break-all", fontFamily: k === "Endpoint" || k === "Delivery ID" ? "monospace" : "inherit" }}>{v}</Typography>
                </Box>
              ))}
              {detail.error_message && (
                <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.3)" }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#DC2626", mb: 0.5 }}>ERROR</Typography>
                  <Typography sx={{ fontSize: 12.5, color: "#DC2626", wordBreak: "break-word" }}>{detail.error_message}</Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: t.secondary, mt: 2, mb: 0.5 }}>
                Payload sent
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0, p: 1.5, borderRadius: 2, maxHeight: 220, overflow: "auto", fontSize: 11.5,
                  fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                  color: t.primary, border: `1px solid ${theme.palette.divider}`,
                }}
              >
                {prettyJson(detail.payload)}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WebhookConsoleSection;
