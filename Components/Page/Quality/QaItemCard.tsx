import React, { memo, useState } from "react";
import { Box, Button, Chip, CircularProgress, IconButton, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import type { QaWhere } from "@/data/qaWhere";

export type QaStatus = "pass" | "fail" | "blocked" | "awaiting_retest" | "not_tested";

export interface QaComment {
  id: number;
  item_key: string;
  section_id?: string | null;
  section_title?: string | null;
  case_title?: string | null;
  tester?: string | null;
  status: QaStatus;
  note?: string | null;
  created_at: string;
}

export interface QaItemMeta {
  item_key: string;
  section_id?: string;
  section_title?: string;
  case_title?: string;
}

export const STATUS_META: Record<QaStatus, { label: string; color: string }> = {
  pass: { label: "Pass", color: "#22C55E" },
  fail: { label: "Fail", color: "#EF4444" },
  blocked: { label: "Blocked", color: "#F59E0B" },
  awaiting_retest: { label: "Awaiting retest", color: "#8B5CF6" },
  not_tested: { label: "Not tested", color: "#9CA3AF" },
};

const STATUS_OPTIONS: QaStatus[] = ["pass", "fail", "blocked", "awaiting_retest", "not_tested"];

export const StatusChip = ({ status, small }: { status: QaStatus; small?: boolean }) => (
  <Chip
    label={STATUS_META[status].label}
    size="small"
    sx={{
      height: small ? 18 : 22,
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      color: "#fff",
      bgcolor: STATUS_META[status].color,
    }}
  />
);

/** "Where to test" — menu path + route with a one-click open. */
export const QaWhereLine = ({ where, isDark }: { where: QaWhere; isDark: boolean }) => (
  <Box
    data-testid="qa-where"
    sx={{
      mt: 0.75,
      display: "flex",
      alignItems: "flex-start",
      gap: 1,
      flexWrap: "wrap",
      p: 1,
      borderRadius: 1.5,
      bgcolor: isDark ? "rgba(99,102,241,0.10)" : "#EEF2FF",
      border: `1px solid ${isDark ? "rgba(99,102,241,0.35)" : "#C7D2FE"}`,
    }}
  >
    <PlaceOutlinedIcon sx={{ fontSize: 16, color: "#6366F1", mt: "1px" }} />
    <Box sx={{ flex: 1, minWidth: 200 }}>
      <Typography sx={{ fontSize: 12.5, lineHeight: 1.45 }}>
        <b>Where:</b> {where.menu}
      </Typography>
      {where.hint && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.4 }}>{where.hint}</Typography>
      )}
    </Box>
    <Button
      component="a"
      href={where.route}
      target="_blank"
      rel="noopener noreferrer"
      size="small"
      variant="outlined"
      endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
      data-testid="qa-where-open"
      sx={{ textTransform: "none", fontFamily: "monospace", fontSize: 12, py: 0.25, px: 1, whiteSpace: "nowrap", flexShrink: 0 }}
    >
      {where.route}
    </Button>
  </Box>
);

interface QaItemCardProps {
  itemKey: string;
  meta: Omit<QaItemMeta, "item_key">;
  header: React.ReactNode;
  body?: React.ReactNode;
  comments: QaComment[];
  saving: boolean;
  isDark: boolean;
  cardBg: string;
  border: string;
  onSave: (meta: QaItemMeta, draft: { status: QaStatus; note: string }) => Promise<boolean>;
  onQuick: (meta: QaItemMeta, status: QaStatus) => void;
  onDeleteComment: (itemKey: string, id: number) => void;
  onDeleteItem?: () => void;
}

/* Memoised so typing a note only re-renders THIS card, not the whole catalog. */
const QaItemCard = memo(function QaItemCard({
  itemKey, meta, header, body, comments, saving, isDark, cardBg, border, onSave, onQuick, onDeleteComment, onDeleteItem,
}: QaItemCardProps) {
  const [status, setStatus] = useState<QaStatus>("pass");
  const [note, setNote] = useState("");
  const latest: QaStatus = comments.length ? comments[comments.length - 1].status : "not_tested";
  const fullMeta: QaItemMeta = { item_key: itemKey, ...meta };

  const save = async () => {
    if (!note.trim() && status === "not_tested") return;
    const ok = await onSave(fullMeta, { status, note });
    if (ok) setNote("");
  };

  return (
    <Box data-testid={`qa-item-${itemKey}`} sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: cardBg, border }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{header}</Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusChip status={latest} />
          {latest === "awaiting_retest" && (
            <>
              <Button size="small" variant="outlined" color="error" disabled={saving} onClick={() => onQuick(fullMeta, "fail")}
                sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11, textTransform: "none", lineHeight: 1.4 }} data-testid={`qa-quick-reopen-${itemKey}`}>
                Reopen
              </Button>
              <Button size="small" variant="outlined" color="success" disabled={saving} onClick={() => onQuick(fullMeta, "pass")}
                sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11, textTransform: "none", lineHeight: 1.4 }} data-testid={`qa-quick-pass-${itemKey}`}>
                Pass
              </Button>
            </>
          )}
          {onDeleteItem && (
            <Tooltip title="Delete this custom test">
              <IconButton size="small" onClick={onDeleteItem}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {body}

      {comments.length > 0 && (
        <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
          {comments.map((c) => (
            <Box key={c.id} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC", border }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                <StatusChip status={c.status} small />
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{c.tester || "Anonymous"}</Typography>
                <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{new Date(c.created_at).toLocaleString()}</Typography>
                <Box sx={{ flex: 1 }} />
                <IconButton size="small" onClick={() => onDeleteComment(itemKey, c.id)} aria-label="Delete note">
                  <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
              {c.note && <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.note}</Typography>}
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 1.5, display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, alignItems: "flex-start" }}>
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value as QaStatus)}
          sx={{ minWidth: 140 }} data-testid={`qa-status-${itemKey}`}>
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>
          ))}
        </TextField>
        <TextField size="small" fullWidth multiline minRows={1} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for this test (bug, observation, steps to reproduce)…"
          inputProps={{ "data-testid": `qa-note-${itemKey}` }} />
        <Button variant="contained" onClick={save} disabled={saving} sx={{ whiteSpace: "nowrap", height: 40 }} data-testid={`qa-save-${itemKey}`}>
          {saving ? <CircularProgress size={18} color="inherit" /> : "Save note"}
        </Button>
      </Box>
    </Box>
  );
});

export default QaItemCard;
