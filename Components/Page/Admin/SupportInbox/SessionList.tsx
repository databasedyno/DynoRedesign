import React from "react";
import {
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  SearchRounded,
  SmartToyRounded,
  SupportAgentRounded,
  PriorityHighRounded,
} from "@mui/icons-material";

export interface SupportSession {
  session_id: string;
  message_count: number;
  last_message_at: string | null;
  escalated: boolean;
  mode: string;
  status: string;
  admin_unread: number;
  contact_email: string | null;
  user_id: number | null;
  preview: string | null;
  last_role?: string | null;
}

export interface SummaryCounts {
  open?: number;
  human?: number;
  escalated?: number;
  unread?: number;
  total?: number;
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread", countKey: "unread" as const },
  { key: "escalated", label: "Escalated", countKey: "escalated" as const },
  { key: "human", label: "Live", countKey: "human" as const },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
];

export const relTime = (iso: string | null): string => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

interface Props {
  sessions: SupportSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  status: string;
  onStatusChange: (s: string) => void;
  q: string;
  onSearch: (q: string) => void;
  loading: boolean;
  summary: SummaryCounts;
}

const SessionList: React.FC<Props> = ({
  sessions,
  selectedId,
  onSelect,
  status,
  onStatusChange,
  q,
  onSearch,
  loading,
  summary,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: { xs: "100%", md: 340 },
        flexShrink: 0,
        borderRight: { md: `1px solid ${theme.palette.divider}` },
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Search */}
      <Box sx={{ p: 1.5, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search email, text or session id"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
          }}
          data-testid="support-search"
        />
      </Box>

      {/* Status filter chips */}
      <Box sx={{ px: 1.5, pb: 1, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {STATUS_FILTERS.map((f) => {
          const count = f.countKey ? (summary as Record<string, number>)[f.countKey] : undefined;
          const active = status === f.key;
          return (
            <Chip
              key={f.key}
              size="small"
              label={count ? `${f.label} ${count}` : f.label}
              color={active ? "primary" : "default"}
              variant={active ? "filled" : "outlined"}
              onClick={() => onStatusChange(f.key)}
              data-testid={`support-filter-${f.key}`}
              sx={{ fontWeight: active ? 700 : 500 }}
            />
          );
        })}
      </Box>

      {/* Session list */}
      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading && sessions.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        )}
        {!loading && sessions.length === 0 && (
          <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4, fontSize: 13 }}>
            No conversations found.
          </Typography>
        )}
        {sessions.map((s) => {
          const selected = s.session_id === selectedId;
          const isHuman = s.mode === "human";
          return (
            <Box
              key={s.session_id}
              onClick={() => onSelect(s.session_id)}
              data-testid={`support-session-${s.session_id}`}
              sx={{
                px: 1.5,
                py: 1.25,
                cursor: "pointer",
                borderBottom: `1px solid ${theme.palette.divider}`,
                borderLeft: `3px solid ${selected ? theme.palette.primary.main : "transparent"}`,
                backgroundColor: selected ? theme.palette.action.selected : "transparent",
                "&:hover": { backgroundColor: theme.palette.action.hover },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
                {isHuman ? (
                  <SupportAgentRounded sx={{ fontSize: 16, color: theme.palette.success.main }} />
                ) : (
                  <SmartToyRounded sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                )}
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "text.primary",
                  }}
                >
                  {s.contact_email || `Visitor · ${s.session_id.slice(0, 8)}`}
                </Typography>
                {s.escalated && (
                  <PriorityHighRounded sx={{ fontSize: 15, color: theme.palette.warning.main }} />
                )}
                {s.admin_unread > 0 && (
                  <Box
                    sx={{
                      minWidth: 18,
                      height: 18,
                      px: 0.5,
                      borderRadius: "9px",
                      backgroundColor: theme.palette.error.main,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {s.admin_unread}
                  </Box>
                )}
                <Typography sx={{ fontSize: 11, color: "text.secondary", ml: 0.5 }}>
                  {relTime(s.last_message_at)}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: 12.5,
                  color: "text.secondary",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.last_role === "agent" ? "You: " : s.last_role === "assistant" ? "AI: " : ""}
                {s.preview || "(no messages)"}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default SessionList;
