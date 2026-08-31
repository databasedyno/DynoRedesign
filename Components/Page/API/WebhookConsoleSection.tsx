import { brandFg } from "@/constants/theme";
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

import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { formatDateTimeI18n } from "@/utils/formatDate";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControlLabel,
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
import useApiSWR from "@/hooks/useApiSWR";

import axiosBaseApi from "@/axiosConfig";
import PanelCard from "@/Components/UI/PanelCard";
import { StatusDot } from "@/Components/UI/StatusDot";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import useIsMobile from "@/hooks/useIsMobile";
import { rootReducer } from "@/utils/types";
import copyToClipboard from "@/helpers/copyToClipboard";
import { API_ENDPOINTS } from "@/api/endpoints";

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

const OPT_IN_EVENTS = [
  { id: "payment.created", hint: "A checkout was created and an address issued — nothing paid yet" },
  { id: "payment.expired", hint: "A payment link passed its expiry without being paid" },
  { id: "payment.overpaid", hint: "The customer sent more than requested, above your threshold" },
];

const statusMeta = (status: string) => {
  switch (status) {
    case "success":
      return { label: "Delivered", color: "#16A34A", bg: "rgba(22,163,74,0.12)", iconName: "circle-check", tone: "settled" as const };
    case "failed":
      return { label: "Failed", color: "#DC2626", bg: "rgba(220,38,38,0.12)", iconName: "circle-alert", tone: "failed" as const };
    default:
      return { label: "Pending", color: "#D97706", bg: "rgba(217,119,6,0.12)", iconName: "hourglass", tone: "pending" as const };
  }
};

const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  return formatDateTimeI18n(iso, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }) || "—";
};

const prettyJson = (raw?: string | null) => {
  if (!raw) return "—";
  try {
    return JSON.stringify(typeof raw === "string" ? JSON.parse(raw) : raw, null, 2);
  } catch {
    return String(raw);
  }
};

/**
 * view — which half of the console to render (Batch B / N4 Developers tabs):
 *   "all"      (default) config + delivery log, the original single-card console
 *   "settings" endpoint URL + signing secret + test event only  (Webhooks tab)
 *   "events"   stats strip + recent deliveries only             (Events log tab)
 * One component, conditionally rendered — moved, not forked (audit law).
 */
const WebhookConsoleSection = ({ view = "all" }: { view?: "all" | "settings" | "events" }) => {
  const showSettings = view === "all" || view === "settings";
  const showEvents = view === "all" || view === "events";
  const theme = useTheme();
  const isMobile = useIsMobile();
  const dispatch = useDispatch();

  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const companyList = useCompanyStore().companyList;
  const companyId = useMemo(
    () => selectedCompanyId || (Array.isArray(companyList) && companyList[0]?.company_id) || null,
    [selectedCompanyId, companyList],
  );

  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [secretIsPreview, setSecretIsPreview] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [reenabling, setReenabling] = useState(false);

  // Circuit-breaker state: the backend auto-disables webhook delivery after
  // repeated endpoint failures (see utils/webhookRetry.ts). Surface it here so
  // the merchant can see WHY delivery stopped and re-enable it in one click.
  const [disabledInfo, setDisabledInfo] = useState<{ disabled: boolean; at: string | null; reason: string | null }>({
    disabled: false,
    at: null,
    reason: null,
  });

  // Opt-in event subscriptions (backend: tbl_company.webhook_events).
  // Core payment updates are always delivered and are not listed here.
  const [events, setEvents] = useState<string[]>([]);
  const [savedEvents, setSavedEvents] = useState<string[]>([]);
  const [savingEvents, setSavingEvents] = useState(false);

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
      const res = await axiosBaseApi.get(API_ENDPOINTS.company.webhookSettings(companyId));
      const d = res?.data?.data;
      if (d) {
        setUrl(d.webhook_url ?? "");
        setSavedUrl(d.webhook_url ?? "");
        // GET only returns a masked preview (the full secret is shown once, on
        // generation). Showing the preview stops merchants thinking they have
        // no secret and regenerating one — which would break a live integration.
        if (d.webhook_secret) {
          setSecret(d.webhook_secret);
          setSecretIsPreview(false);
        } else if (d.webhook_secret_set) {
          setSecret(d.webhook_secret_preview ?? "********");
          setSecretIsPreview(true);
        } else {
          setSecret("");
          setSecretIsPreview(false);
        }
        const subscribed = Array.isArray(d.webhook_events) ? d.webhook_events : [];
        setEvents(subscribed);
        setSavedEvents(subscribed);
        setDisabledInfo({
          disabled: !!d.webhook_disabled,
          at: d.webhook_disabled_at ?? null,
          reason: d.webhook_disabled_reason ?? null,
        });
      }
    } catch {
      /* non-fatal */
    }
  }, [companyId]);

  // Stats + logs are read-only lists → SWR-backed (cached across tab switches,
  // deduped). Keyed by company (+ status filter for logs) so switching either
  // refetches the right data. `refreshAll` revalidates both SWR caches so the
  // "send test" + manual refresh handlers below work unchanged.
  const { data: statsData, mutate: mutateStats } = useApiSWR<WebhookStats | null>(
    companyId ? API_ENDPOINTS.company.webhookStats(companyId) : null,
    {
      select: (raw) => (raw?.data?.summary ?? null) as WebhookStats | null,
      dedupingInterval: 15_000,
    },
  );
  const stats = statsData ?? null;

  const {
    data: logsData,
    isLoading: logsLoading,
    mutate: mutateLogs,
  } = useApiSWR<WebhookLog[]>(
    companyId
      ? API_ENDPOINTS.company.webhookHistory(
          companyId,
          statusFilter !== "all" ? `&status=${statusFilter}` : "",
        )
      : null,
    {
      select: (raw) =>
        (Array.isArray(raw?.data?.logs) ? raw.data.logs : []) as WebhookLog[],
      dedupingInterval: 10_000,
      keepPreviousData: true,
    },
  );
  const logs = logsData ?? [];
  const loadingLogs = logsLoading && logsData === undefined;

  const refreshAll = useCallback(() => {
    mutateStats();
    mutateLogs();
  }, [mutateStats, mutateLogs]);

  useEffect(() => {
    if (!companyId) return;
    loadSettings();
  }, [companyId, loadSettings]);

  const saveUrl = async () => {
    if (!companyId) return;
    const trimmed = url.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast("Webhook URL must start with http:// or https://", "error");
      return;
    }
    setSavingUrl(true);
    try {
      await axiosBaseApi.put(API_ENDPOINTS.company.webhookSettings(companyId), { webhook_url: trimmed });
      setSavedUrl(trimmed);
      toast("Webhook endpoint saved");
    } catch {
      toast("Failed to save webhook endpoint", "error");
    } finally {
      setSavingUrl(false);
    }
  };

  const reenableWebhook = async () => {
    if (!companyId) return;
    setReenabling(true);
    try {
      await axiosBaseApi.post(API_ENDPOINTS.company.webhookReenable(companyId));
      setDisabledInfo({ disabled: false, at: null, reason: null });
      toast("Webhook delivery re-enabled");
      loadSettings();
    } catch {
      toast("Failed to re-enable webhook delivery", "error");
    } finally {
      setReenabling(false);
    }
  };

  const regenerateSecret = async () => {    if (!companyId) return;
    setRegenerating(true);
    try {
      const res = await axiosBaseApi.put(API_ENDPOINTS.company.webhookSettings(companyId), { webhook_secret: "generate" });
      const d = res?.data?.data;
      if (d?.webhook_secret) {
        setSecret(d.webhook_secret);
        setSecretIsPreview(false);
        setShowSecret(true);
        toast("Signing secret regenerated");
      }
    } catch {
      toast("Failed to regenerate secret", "error");
    } finally {
      setRegenerating(false);
    }
  };

  const toggleEvent = (eventId: string) =>
    setEvents((prev) => (prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]));

  const saveEvents = async () => {
    if (!companyId) return;
    setSavingEvents(true);
    try {
      await axiosBaseApi.put(API_ENDPOINTS.company.webhookSettings(companyId), { webhook_events: events });
      setSavedEvents(events);
      toast(events.length ? "Event subscriptions saved" : "All optional events turned off");
    } catch {
      toast("Failed to save event subscriptions", "error");
    } finally {
      setSavingEvents(false);
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
      const res = await axiosBaseApi.post(
        API_ENDPOINTS.company.webhookTest(companyId)
      );
      // Backend returns HTTP 200 for both a delivered and a failed-delivery test;
      // reflect the ACTUAL delivery outcome so the user isn't told "sent" when the
      // endpoint rejected it.
      const data = res?.data?.data ?? res?.data;
      if (data && data.status === "failed") {
        const code = data.response_status
          ? ` (HTTP ${data.response_status})`
          : "";
        toast(
          `Test event could not be delivered${code}. Check your endpoint URL and try again.`,
          "error"
        );
      } else {
        const code = data?.response_status ? ` (HTTP ${data.response_status})` : "";
        toast(`Test event delivered${code} — check recent deliveries`);
      }
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
      const res = await axiosBaseApi.get(API_ENDPOINTS.company.webhookHistoryDetail(companyId, logId));
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
  const eventsDirty = useMemo(
    () => [...events].sort().join(",") !== [...savedEvents].sort().join(","),
    [events, savedEvents],
  );

  return (
    <>
      <PanelCard
        title={view === "events" ? "Events log" : "Webhooks"}
        subTitle={
          view === "events"
            ? "Recent webhook delivery attempts — click a row for the payload and response"
            : view === "settings"
              ? "Configure your endpoint URL, signing secret and test events"
              : "Receive real-time events and inspect recent delivery attempts"
        }
        headerIcon={<Icon name={view === "events" ? "list" : "webhook"} color={brandFg(theme.palette.mode === "dark")} />}
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
            {disabledInfo.disabled && (
              <Box
                data-testid="webhook-disabled-banner"
                sx={{
                  mb: 2, p: 1.75, borderRadius: 2,
                  bgcolor: "rgba(220,38,38,0.10)",
                  border: "1px solid rgba(220,38,38,0.35)",
                  display: "flex", gap: 1.5, alignItems: "flex-start",
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                <Icon name="circle-alert" size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "#DC2626" }}>
                    Webhook delivery is turned off
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: t.primary, mt: 0.5 }}>
                    We stopped sending events because your endpoint repeatedly failed to respond
                    {disabledInfo.at ? ` (since ${fmtTime(disabledInfo.at)})` : ""}. Fix or update your
                    endpoint URL {showSettings ? "above" : "in the Webhooks tab"}, then re-enable delivery.
                  </Typography>
                  {disabledInfo.reason && (
                    <Typography
                      data-testid="webhook-disabled-reason"
                      sx={{ fontSize: 11.5, color: t.secondary, mt: 0.5, fontFamily: "monospace", wordBreak: "break-word" }}
                    >
                      {disabledInfo.reason}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  onClick={reenableWebhook}
                  disabled={reenabling}
                  data-testid="webhook-reenable-btn"
                  startIcon={reenabling ? <CircularProgress size={14} color="inherit" /> : <Icon name="refresh-cw" size={18} />}
                  sx={{
                    textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap", flexShrink: 0,
                    bgcolor: "#DC2626", "&:hover": { bgcolor: "#B91C1C" },
                    alignSelf: isMobile ? "stretch" : "flex-start",
                  }}
                >
                  {reenabling ? "Re-enabling…" : "Re-enable"}
                </Button>
              </Box>
            )}
            {showSettings && (
              <>
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
                  {secret
                    ? secretIsPreview
                      ? `${secret} · set — regenerate to replace`
                      : (showSecret ? secret : "•".repeat(Math.min(secret.length, 28)))
                    : "No secret set — regenerate to create one"}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                  {secret && !secretIsPreview && (
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

            {/* Event subscriptions — opt-in extras on top of the always-on payment updates */}
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: t.secondary, mb: 0.5 }}>
              Event subscriptions
            </Typography>
            <Typography sx={{ fontSize: 12, color: t.secondary, mb: 1 }}>
              Payment updates (pending, confirmed, underpaid, settled) are always delivered. Tick any extra events you want.
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", mb: 1 }} data-testid="webhook-event-subscriptions">
              {OPT_IN_EVENTS.map((ev) => (
                <FormControlLabel
                  key={ev.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={events.includes(ev.id)}
                      onChange={() => toggleEvent(ev.id)}
                      data-testid={`webhook-event-${ev.id.replace(".", "-")}`}
                      inputProps={{ "aria-label": `Subscribe to ${ev.id}` } as React.InputHTMLAttributes<HTMLInputElement>}
                    />
                  }
                  label={
                    <Box sx={{ py: 0.25 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: t.primary }}>
                        {ev.id}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: t.secondary }}>{ev.hint}</Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", ml: 0, mb: 0.5 }}
                />
              ))}
            </Box>
            <Box sx={{ mb: 2 }}>
              <Button
                variant="contained"
                onClick={saveEvents}
                disabled={savingEvents || !eventsDirty}
                data-testid="webhook-events-save"
                sx={{ minWidth: 130, textTransform: "none", fontWeight: 700, borderRadius: 2, whiteSpace: "nowrap" }}
              >
                {savingEvents ? <CircularProgress size={18} color="inherit" /> : "Save events"}
              </Button>
            </Box>
              </>
            )}

            {showEvents && (
              <>
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
                      <StatusDot tone={m.tone}>
                        {lg.response_status != null ? `${m.label} · ${lg.response_status}` : m.label}
                      </StatusDot>
                    </Box>
                  );
                })
              )}
            </Box>
              </>
            )}
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
