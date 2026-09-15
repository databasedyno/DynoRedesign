import React, { useState } from "react";
import { Box, Skeleton, Tooltip, Typography, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { useApiSWR } from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { API_ENDPOINTS } from "@/api/endpoints";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { relativeTime } from "@/Components/Page/Dashboard/v2026/command/format";

export interface DeveloperHealth {
  webhooks: {
    configured: boolean;
    url: string | null;
    disabled: boolean;
    disabled_reason: string | null;
    total_24h: number;
    failed_24h: number;
    success_rate_24h: number | null;
    avg_response_ms: number;
    last_failure: { log_id: number; event_type: string; webhook_url: string | null; response_status: number | null; error_message: string | null; retry_count: number; at: string } | null;
  };
  keys: {
    active: number;
    rotate_due: number;
    rotate_after_days: number;
    items: Array<{ api_id: number; api_name: string; key_hint: string | null; environment: string; since: string | null; age_days: number; rotate_due: boolean }>;
  };
}

export const useDeveloperHealth = () => {
  const { selectedCompanyId } = useCompanyStore();
  return useApiSWR<DeveloperHealth | null>(
    selectedCompanyId != null ? `dashboard/developer-health?company_id=${selectedCompanyId}` : null,
    { refreshInterval: 60_000, revalidateOnFocus: true, keepPreviousData: true, select: (raw) => (raw?.data as DeveloperHealth) ?? null },
  );
};

type Tone = "positive" | "negative" | "warning" | "info";
const toneColor = (tone: Tone, isDark: boolean) => CB_TOKENS.semantic[tone][isDark ? "dark" : "light"];

const Tile: React.FC<{ testId: string; icon: string; label: string; tone: Tone; value: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }> = ({ testId, icon, label, tone, value, sub, action }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const color = toneColor(tone, isDark);
  return (
    <Box data-testid={testId} data-tone={tone} sx={{ flex: "1 1 240px", minWidth: 0, p: 2, borderRadius: "14px", border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.background.paper, display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: theme.palette.text.secondary }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 0 3px ${color}26` }} />
        <Icon name={icon} size={14} />
        <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", color: theme.palette.text.primary }}>{value}</Typography>
      {sub && <Typography component="div" sx={{ fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</Typography>}
      {action && <Box sx={{ mt: "auto", pt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>{action}</Box>}
    </Box>
  );
};

const LinkBtn: React.FC<{ testId: string; onClick: () => void; children: React.ReactNode; busy?: boolean; icon?: string }> = ({ testId, onClick, children, busy, icon }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  return (
    <Box component="button" type="button" data-testid={testId} onClick={onClick} disabled={busy} sx={{ all: "unset", cursor: busy ? "progress" : "pointer", display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, color: indigo, opacity: busy ? 0.6 : 1, "&:hover": { textDecoration: "underline" } }}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </Box>
  );
};

interface Props { onGoTab: (tab: "keys" | "webhooks" | "events" | "docs") => void }

/** Wave 3f — Developers health strip: webhook delivery (24 h), API-key age, quick links. */
const DeveloperHealthStrip: React.FC<Props> = ({ onGoTab }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation(["apiScreen", "common", "dashboardLayout"]);
  const tr = (k: string, o?: Record<string, unknown>) => t(k, { ns: "apiScreen", ...(o || {}) }) as string;
  const tf = (k: string, o?: Record<string, unknown>) => t(k, { ns: "dashboardLayout", ...(o || {}) }) as string;
  const { selectedCompanyId } = useCompanyStore();
  const { data, isLoading, mutate } = useDeveloperHealth();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    const lf = data?.webhooks.last_failure;
    if (!lf || !selectedCompanyId || retrying) return;
    setRetrying(true);
    try {
      const res = await axiosBaseApi.post(API_ENDPOINTS.company.webhookHistoryResend(selectedCompanyId, lf.log_id));
      const ok = res?.data?.data?.resent;
      dispatch({ type: TOAST_SHOW, payload: { message: ok ? tr("webhook.toastResent", { defaultValue: "Event re-sent" }) : tr("webhook.toastResendFailed", { defaultValue: "Re-send attempted but the endpoint did not accept it{{err}}", err: res?.data?.data?.error ? `: ${res.data.data.error}` : "" }), severity: ok ? "success" : "error" } });
      mutate();
    } catch {
      dispatch({ type: TOAST_SHOW, payload: { message: tr("webhook.toastResendError", { defaultValue: "Failed to re-send this event" }), severity: "error" } });
    } finally {
      setRetrying(false);
    }
  };

  if (isLoading && !data) {
    return (
      <Box data-testid="dev-health-loading" sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={118} sx={{ flex: "1 1 240px", borderRadius: "14px" }} />)}
      </Box>
    );
  }
  if (!data) return null;

  const w = data.webhooks;
  const k = data.keys;
  const whTone: Tone = !w.configured ? "info" : w.disabled ? "negative" : w.failed_24h > 0 ? (w.success_rate_24h != null && w.success_rate_24h < 90 ? "negative" : "warning") : "positive";
  const whValue = !w.configured
    ? tr("health.notConfigured", { defaultValue: "Not set up" })
    : w.disabled
      ? tr("health.paused", { defaultValue: "Paused" })
      : w.success_rate_24h == null
        ? tr("health.noDeliveries", { defaultValue: "No deliveries" })
        : `${w.success_rate_24h}%`;
  const whSub = !w.configured
    ? tr("health.notConfiguredHint", { defaultValue: "Add an endpoint to get payment events pushed to your server." })
    : w.last_failure
      ? tr("health.lastFailure", { when: relativeTime(w.last_failure.at, tf, i18n.language), event: w.last_failure.event_type, status: w.last_failure.response_status ?? "—", defaultValue: "Last failure {{when}} · {{event}} · HTTP {{status}}" })
      : w.total_24h > 0
        ? tr("health.deliveries24h", { count: w.total_24h, ms: w.avg_response_ms, defaultValue: "{{count}} deliveries in 24 h · avg {{ms}} ms" })
        : tr("health.quiet24h", { defaultValue: "Nothing sent in the last 24 h — no failures on record." });

  const oldest = k.items[0];
  const keyTone: Tone = k.active === 0 ? "info" : k.rotate_due > 0 ? "warning" : "positive";
  const keyValue = k.active === 0 ? tr("health.noKeys", { defaultValue: "No keys" }) : tr("health.activeKeys", { count: k.active, defaultValue: "{{count}} active" });
  const keySub = k.rotate_due > 0
    ? tr("health.rotateDue", { count: k.rotate_due, days: Math.round(k.rotate_after_days / 30), defaultValue: "{{count}} live key older than {{days}} months — rotate it to limit exposure." })
    : oldest
      ? tr("health.oldestKey", { name: oldest.api_name, days: oldest.age_days, defaultValue: "Oldest: {{name}} · {{days}} days since issue/rotation" })
      : tr("health.noKeysHint", { defaultValue: "Create a key to start integrating." });

  return (
    <Box data-testid="dev-health-strip" sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap", alignItems: "stretch" }}>
      <Tile
        testId="dev-health-webhooks"
        icon="webhook"
        tone={whTone}
        label={tr("health.webhooks", { defaultValue: "Webhooks · 24 h" })}
        value={whValue}
        sub={whSub}
        action={
          <>
            {w.last_failure && !w.disabled && (
              <LinkBtn testId="dev-health-retry" onClick={retry} busy={retrying} icon="refresh-cw">
                {retrying ? tr("health.retrying", { defaultValue: "Retrying…" }) : tr("health.retry", { defaultValue: "Retry last failure" })}
              </LinkBtn>
            )}
            <LinkBtn testId="dev-health-open-webhooks" onClick={() => onGoTab(w.configured && !w.disabled ? "events" : "webhooks")} icon={w.disabled ? "refresh-cw" : "list"}>
              {w.disabled
                ? tr("health.reenable", { defaultValue: "Re-enable webhook" })
                : w.configured
                  ? tr("health.viewEvents", { defaultValue: "Events log" })
                  : tr("health.setupWebhook", { defaultValue: "Set up webhook" })}
            </LinkBtn>
          </>
        }
      />
      <Tile
        testId="dev-health-keys"
        icon="key-round"
        tone={keyTone}
        label={tr("health.apiKeys", { defaultValue: "API keys" })}
        value={keyValue}
        sub={keySub}
        action={
          <LinkBtn testId="dev-health-open-keys" onClick={() => onGoTab("keys")} icon={k.rotate_due > 0 ? "refresh-cw" : "key-round"}>
            {k.rotate_due > 0 ? tr("health.rotateNow", { defaultValue: "Rotate now" }) : tr("health.manageKeys", { defaultValue: "Manage keys" })}
          </LinkBtn>
        }
      />
      <Tile
        testId="dev-health-links"
        icon="lucide:book-open"
        tone="info"
        label={tr("health.quickLinks", { defaultValue: "Quick links" })}
        value={tr("health.docsTitle", { defaultValue: "Docs & tools" })}
        sub={tr("health.docsHint", { defaultValue: "Reference, signatures and the delivery log — everything to debug an integration." })}
        action={
          <>
            <LinkBtn testId="dev-health-open-docs" onClick={() => onGoTab("docs")} icon="lucide:book-open">{tr("tabs.docs", { defaultValue: "Docs" })}</LinkBtn>
            <Tooltip title={tr("health.apiReferenceTip", { defaultValue: "Full API reference (opens in a new tab)" })} arrow>
              <Box component="a" href="/documentation" target="_blank" rel="noopener" data-testid="dev-health-open-reference" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                <Icon name="external-link" size={13} />
                {tr("health.apiReference", { defaultValue: "API reference" })}
              </Box>
            </Tooltip>
          </>
        }
      />
    </Box>
  );
};

export default DeveloperHealthStrip;
