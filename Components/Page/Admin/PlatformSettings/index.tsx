import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Tabs, Tab, Typography, CircularProgress, Button, Switch, Chip,
  Drawer, Divider, useTheme,
} from "@mui/material";
import { PowerSettingsNewRounded, HistoryRounded, WarningAmberRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useRefetchOnVisible } from "@/hooks/useRefetchOnVisible";
import platformSettingsApi, { SettingGroup, PlatformSetting, SettingHistoryRow } from "@/api/platformSettings";
import { SectionCard, formatDateTime } from "../adminUi";
import SettingRow from "./SettingRow";
import StepUpModal, { PendingChange } from "./StepUpModal";

type PendingAction =
  | { type: "update"; setting: PlatformSetting; value: unknown }
  | { type: "revert"; setting: PlatformSetting };

const displayValue = (s: PlatformSetting, v: unknown): string => {
  if (s.type === "boolean") return v === true || v === "true" ? "On" : "Off";
  return `${v ?? "—"}${s.unit ? ` ${s.unit}` : ""}`;
};

/** Admin → Platform Settings: dashboard-managed config + kill switches with step-up + audit. */
const AdminPlatformSettings: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<SettingHistoryRow[]>([]);

  const toast = (message: string, severity: "success" | "error" | "info" = "info") =>
    dispatch({ type: TOAST_SHOW, payload: { message, severity } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await platformSettingsApi.getAll());
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg || "Could not load platform settings.", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);
  useRefetchOnVisible(load);

  const askSave = (setting: PlatformSetting, value: unknown) => {
    setPending({ type: "update", setting, value });
    setError(null);
    setModalOpen(true);
  };
  const askRevert = (setting: PlatformSetting) => {
    setPending({ type: "revert", setting });
    setError(null);
    setModalOpen(true);
  };

  const pendingChange: PendingChange | null = useMemo(() => {
    if (!pending) return null;
    const s = pending.setting;
    if (pending.type === "revert") {
      return { key: s.key, label: s.label, summary: "Revert to environment default", danger: s.danger };
    }
    return {
      key: s.key,
      label: s.label,
      summary: `${displayValue(s, s.value)}  →  ${displayValue(s, pending.value)}`,
      danger: s.danger,
    };
  }, [pending]);

  const onConfirm = async (reason: string, code: string) => {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await platformSettingsApi.stepUp(code);
      if (pending.type === "update") {
        await platformSettingsApi.update(pending.setting.key, pending.value, reason, token);
      } else {
        await platformSettingsApi.revert(pending.setting.key, reason, token);
      }
      toast(`${pending.setting.label} updated.`, "success");
      setModalOpen(false);
      setPending(null);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Verification failed. Check the code and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openLog = async () => {
    setLogOpen(true);
    try {
      setLog(await platformSettingsApi.history(undefined, 100));
    } catch {
      setLog([]);
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }} data-testid="platform-settings-loading"><CircularProgress /></Box>;
  }

  const active = groups[tab];

  return (
    <Box data-testid="platform-settings-root">
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          Changes apply live across the platform (no redeploy). Every change is audited.
        </Typography>
        <Button size="small" variant="outlined" startIcon={<HistoryRounded sx={{ fontSize: 16 }} />} onClick={openLog}
          data-testid="ps-history-open" sx={{ textTransform: "none", fontSize: 12.5 }}>
          Change log
        </Button>
      </Box>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: "1px solid", borderColor: "divider", minHeight: 40 }}
      >
        {groups.map((g, i) => (
          <Tab key={g.id} label={g.label} data-testid={`ps-tab-${g.id}`} sx={{ textTransform: "none", fontSize: 13, fontWeight: 600, minHeight: 40 }} value={i} />
        ))}
      </Tabs>

      {active && (
        <SectionCard title={active.label} testid={`ps-group-${active.id}`}>
          {active.description && <Typography sx={{ fontSize: 12.5, color: "text.secondary", mb: 2 }}>{active.description}</Typography>}

          {active.id === "kill_switches" ? (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {active.settings.map((s) =>
                s.type === "boolean" ? (
                  <Box
                    key={s.key}
                    data-testid={`ps-kill-switch-${s.key}`}
                    sx={{
                      display: "flex", alignItems: "center", gap: 2, p: 2, borderRadius: "12px",
                      border: "1px solid", borderColor: s.value ? "error.main" : "divider",
                      bgcolor: s.value ? `${theme.palette.error.main}0D` : "transparent",
                    }}
                  >
                    <PowerSettingsNewRounded sx={{ color: s.value ? "error.main" : "text.disabled" }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{s.label}</Typography>
                        <Chip size="small" label={s.value ? "ACTIVE" : "Off"} color={s.value ? "error" : "default"}
                          variant={s.value ? "filled" : "outlined"} sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
                          data-testid={`ps-kill-switch-${s.key}-state`} data-on={s.value ? "true" : "false"} />
                      </Box>
                      {s.description && <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>{s.description}</Typography>}
                    </Box>
                    {s.source === "override" && (
                      <Button size="small" color="inherit" onClick={() => askRevert(s)}
                        data-testid={`ps-kill-switch-${s.key}-revert`}
                        sx={{ textTransform: "none", fontSize: 11.5, minWidth: 0 }}>
                        Revert
                      </Button>
                    )}
                    <Switch
                      color="error"
                      checked={!!s.value}
                      onChange={(e) => askSave(s, e.target.checked)}
                      inputProps={{ "data-testid": `ps-kill-switch-${s.key}-toggle` } as React.InputHTMLAttributes<HTMLInputElement>}
                    />
                  </Box>
                ) : (
                  <SettingRow key={s.key} setting={s} onSave={askSave} onRevert={askRevert} />
                )
              )}
            </Box>
          ) : (
            <Box>
              {active.settings.map((s) => (
                <SettingRow key={s.key} setting={s} onSave={askSave} onRevert={askRevert} />
              ))}
            </Box>
          )}
        </SectionCard>
      )}

      <StepUpModal
        open={modalOpen}
        pending={pendingChange}
        submitting={submitting}
        error={error}
        onConfirm={onConfirm}
        onClose={() => { if (!submitting) { setModalOpen(false); setPending(null); } }}
      />

      <Drawer anchor="right" open={logOpen} onClose={() => setLogOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 460 }, p: 2.5 }, "data-testid": "ps-history-drawer" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <HistoryRounded fontSize="small" />
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Settings change log</Typography>
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        {log.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "text.secondary" }} data-testid="ps-history-empty">No changes recorded yet.</Typography>
        ) : (
          log.map((r) => (
            <Box key={r.history_id} sx={{ py: 1.25, borderBottom: "1px solid", borderColor: "divider" }} data-testid={`ps-history-row-${r.history_id}`}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 600, fontFamily: "monospace" }}>{r.key}</Typography>
              <Typography sx={{ fontSize: 13 }}>
                {JSON.stringify(r.old_value)} <WarningAmberRounded sx={{ fontSize: 0 }} />→ {r.new_value === null ? "(reverted)" : JSON.stringify(r.new_value)}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                {r.changed_by || "admin"} · {formatDateTime(r.changed_at)}{r.reason ? ` · ${r.reason}` : ""}
              </Typography>
            </Box>
          ))
        )}
      </Drawer>
    </Box>
  );
};

export default AdminPlatformSettings;
