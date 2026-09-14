import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel,
  Tooltip,
  Divider,
  Stack,
  type SelectChangeEvent,
} from "@mui/material";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import { useAdminLogStream, type LogEntry } from "./useAdminLogStream";

const LEVELS = ["error", "warn", "info", "debug"] as const;

const LEVEL_META: Record<string, { color: string; label: string }> = {
  error: { color: "#ff5f56", label: "ERROR" },
  warn: { color: "#ffbd2e", label: "WARN" },
  info: { color: "#4aa3ff", label: "INFO" },
  debug: { color: "#9aa4b2", label: "DEBUG" },
};

const normLevel = (level: string): string => {
  const x = (level || "").toLowerCase();
  if (x === "warn" || x === "warning") return "warn";
  if (x === "error") return "error";
  if (x === "debug" || x === "verbose" || x === "silly") return "debug";
  return "info";
};

const fmtTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
};

const fmtUptime = (seconds?: number): string => {
  if (!seconds && seconds !== 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const CONN_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

const StatusDot: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <Stack direction="row" alignItems="center" spacing={0.75}>
    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: ok ? "#37d67a" : "#ff5f56" }} />
    <span>{label}</span>
  </Stack>
);

const Metric: React.FC<{ label: string; value: React.ReactNode; testid: string }> = ({
  label,
  value,
  testid,
}) => (
  <Box sx={{ minWidth: 84 }}>
    <Typography
      sx={{ fontSize: 10.5, letterSpacing: 0.4, textTransform: "uppercase", color: "#8a94a6", fontWeight: 700 }}
    >
      {label}
    </Typography>
    <Typography
      data-testid={testid}
      sx={{ fontSize: 14.5, fontWeight: 800, color: "#e6ebf2", fontFamily: "var(--font-mono, monospace)" }}
    >
      {value}
    </Typography>
  </Box>
);

const AdminLiveConsole: React.FC = () => {
  const [paused, setPaused] = useState(false);
  const { logs, health, connState, pendingCount, clear, reconnect } = useAdminLogStream(paused);

  const [activeLevels, setActiveLevels] = useState<string[]>(["error", "warn", "info", "debug"]);
  const [service, setService] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const services = useMemo(
    () => Array.from(new Set((logs ?? []).map((l) => l.service))).sort(),
    [logs]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (logs ?? []).filter((l) => {
      if (!activeLevels.includes(normLevel(l.level))) return false;
      if (service && l.service !== service) return false;
      if (q && !`${l.message} ${l.service} ${l.meta || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, activeLevels, service, query]);

  useEffect(() => {
    if (autoScroll && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [visible, autoScroll]);

  const onScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (nearBottom !== autoScroll) setAutoScroll(nearBottom);
  };

  const jumpToLatest = () => {
    setAutoScroll(true);
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const isLive = connState === "live";
  const stateColor = isLive ? "#37d67a" : connState === "reconnecting" ? "#ffbd2e" : "#8a94a6";
  const rows = (visible ?? []).slice(-1500);

  return (
    <Box data-testid="admin-live-console" sx={{ pb: 5 }}>
      {/* ── System health strip ─────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        data-testid="live-console-health"
        sx={{ p: 2, borderRadius: "16px", mb: 2, background: "#0b0f1a", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <Stack direction="row" alignItems="center" spacing={2.5} useFlexGap flexWrap="wrap">
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              data-testid="live-console-pulse"
              sx={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                bgcolor: stateColor,
                "@keyframes dpPulse": {
                  "0%": { boxShadow: `0 0 0 0 ${stateColor}88` },
                  "70%": { boxShadow: `0 0 0 9px ${stateColor}00` },
                  "100%": { boxShadow: `0 0 0 0 ${stateColor}00` },
                },
                animation: isLive ? "dpPulse 1.6s ease-in-out infinite" : "none",
              }}
            />
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#e6ebf2" }}>System Health</Typography>
              <Typography
                data-testid="live-console-conn-state"
                sx={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: stateColor }}
              >
                {CONN_LABEL[connState]}
              </Typography>
            </Box>
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
          <Metric label="Uptime" value={fmtUptime(health?.uptime_seconds)} testid="live-console-uptime" />
          <Metric label="Memory" value={health ? `${health.memory.rss_mb} MB` : "—"} testid="live-console-memory" />
          <Metric
            label="Heap"
            value={health ? `${health.memory.heap_used_mb}/${health.memory.heap_total_mb}` : "—"}
            testid="live-console-heap"
          />
          <Metric
            label="Database"
            value={<StatusDot ok={health?.db === "up"} label={health?.db || "—"} />}
            testid="live-console-db"
          />
          <Metric
            label="Redis"
            value={<StatusDot ok={health?.redis === "up"} label={health?.redis || "—"} />}
            testid="live-console-redis"
          />
          <Metric label="Streams" value={health ? String(health.sse_clients) : "—"} testid="live-console-streams" />
          <Metric label="Node" value={health?.node || "—"} testid="live-console-node" />
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Reconnect stream">
            <span>
              <IconButton
                size="small"
                onClick={reconnect}
                data-testid="live-console-reconnect"
                sx={{ color: "#8a94a6" }}
              >
                <RefreshRounded fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "center", mb: 1.5 }}>
        <ToggleButtonGroup
          size="small"
          value={activeLevels}
          onChange={(_e, next: string[]) => {
            if (next.length) setActiveLevels(next);
          }}
          data-testid="live-console-level-filter"
          sx={{ flexWrap: "wrap" }}
        >
          {(LEVELS ?? []).map((lv) => (
            <ToggleButton
              key={lv}
              value={lv}
              data-testid={`live-console-level-${lv}`}
              sx={{
                px: 1.5,
                py: 0.5,
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.3,
                borderColor: "divider",
                color: LEVEL_META[lv].color,
                "&.Mui-selected": {
                  bgcolor: `${LEVEL_META[lv].color}22`,
                  color: LEVEL_META[lv].color,
                  "&:hover": { bgcolor: `${LEVEL_META[lv].color}33` },
                },
              }}
            >
              {LEVEL_META[lv].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Select
          size="small"
          displayEmpty
          value={service}
          onChange={(e: SelectChangeEvent) => setService(e.target.value)}
          data-testid="live-console-service-filter"
          sx={{ minWidth: 168, fontSize: 13 }}
        >
          <MenuItem value="" data-testid="live-console-service-all">
            All services
          </MenuItem>
          {(services ?? []).map((s) => (
            <MenuItem key={s} value={s} data-testid={`live-console-service-${s}`} sx={{ fontSize: 13 }}>
              {s}
            </MenuItem>
          ))}
        </Select>

        <TextField
          size="small"
          placeholder="Filter logs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="live-console-search"
          sx={{ flexGrow: 1, minWidth: 180 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Button
          variant={paused ? "contained" : "outlined"}
          size="small"
          startIcon={paused ? <PlayArrowRounded /> : <PauseRounded />}
          onClick={() => setPaused((p) => !p)}
          data-testid="live-console-pause-toggle"
          color={paused ? "warning" : "primary"}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {paused ? (pendingCount > 0 ? `Resume (${pendingCount})` : "Resume") : "Pause"}
        </Button>

        <Button
          variant="outlined"
          size="small"
          color="inherit"
          startIcon={<DeleteOutlineRounded />}
          onClick={clear}
          data-testid="live-console-clear"
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Clear
        </Button>

        <FormControlLabel
          sx={{ ml: 0.5, mr: 0 }}
          control={
            <Switch
              size="small"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              data-testid="live-console-autoscroll"
            />
          }
          label={<Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>Auto-scroll</Typography>}
        />
      </Box>

      {/* ── Console viewport ────────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{ position: "relative", borderRadius: "14px", overflow: "hidden", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <Box
          ref={viewportRef}
          onScroll={onScroll}
          data-testid="live-console-viewport"
          sx={{
            height: "60vh",
            overflowY: "auto",
            background: "#0b0f1a",
            p: 1.25,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12.5,
            lineHeight: 1.7,
          }}
        >
          {rows.length === 0 ? (
            <Box
              data-testid="live-console-empty"
              sx={{ color: "#6b7280", textAlign: "center", py: 6, fontSize: 13 }}
            >
              {connState === "live"
                ? "Waiting for activity… trigger some traffic and it will appear here."
                : "Connecting to the live log stream…"}
            </Box>
          ) : (
            (rows ?? []).map((l: LogEntry) => {
              const meta = LEVEL_META[normLevel(l.level)];
              return (
                <Box
                  key={l.id}
                  data-testid="live-console-log-row"
                  sx={{
                    display: "flex",
                    gap: 1.25,
                    px: 1,
                    py: 0.25,
                    borderRadius: "6px",
                    borderLeft: `2px solid ${meta.color}`,
                    "&:hover": { background: "rgba(255,255,255,0.04)" },
                  }}
                >
                  <Box component="span" sx={{ color: "#5c6672", flexShrink: 0 }}>
                    {fmtTime(l.ts)}
                  </Box>
                  <Box
                    component="span"
                    sx={{ color: meta.color, fontWeight: 800, width: 46, flexShrink: 0 }}
                  >
                    {meta.label}
                  </Box>
                  <Box component="span" sx={{ color: "#7c8aa0", width: 116, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.service}
                  </Box>
                  <Box component="span" sx={{ color: "#cdd5e0", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1 }}>
                    {l.message}
                    {l.meta ? <Box component="span" sx={{ color: "#7a8598", display: "block", fontSize: 11.5 }}>{l.meta}</Box> : null}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {!autoScroll && (
          <Button
            size="small"
            variant="contained"
            startIcon={<ArrowDownwardRounded />}
            onClick={jumpToLatest}
            data-testid="live-console-jump-latest"
            sx={{
              position: "absolute",
              right: 16,
              bottom: 16,
              textTransform: "none",
              fontWeight: 700,
              boxShadow: 3,
            }}
          >
            Jump to latest
          </Button>
        )}
      </Paper>

      <Typography sx={{ mt: 1, fontSize: 12, color: "text.secondary" }}>
        Showing <strong data-testid="live-console-count">{rows.length}</strong> of {(logs ?? []).length} buffered
        events{paused ? " · stream paused" : ""}. Live tail of the backend winston loggers with a 5s health pulse.
      </Typography>
    </Box>
  );
};

export default AdminLiveConsole;
