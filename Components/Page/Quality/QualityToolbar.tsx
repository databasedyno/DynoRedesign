import React from "react";
import { Box, Button, Chip, CircularProgress, InputAdornment, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import { STATUS_META } from "./QaItemCard";
import type { QaStatus } from "./QaItemCard";
import type { QualityCenter } from "./useQualityCenter";

const STATUS_LABELS: Record<QaStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
  awaiting_retest: "Awaiting retest",
  not_tested: "Untested",
};

interface Props {
  qc: QualityCenter;
  cardBg: string;
  border: string;
}

/** Status counters (click = filter), tester name, search and CSV/JSON export. */
export const QualityToolbar: React.FC<Props> = ({ qc, cardBg, border }) => {
  const { stats, statusFilter, setStatusFilter, dataLoading, tester, setTester, search, setSearch, doExport } = qc;
  return (
    <Box sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: cardBg, border }}>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2, alignItems: "center" }}>
        <Chip
          label={`Total: ${stats.total}`}
          onClick={() => setStatusFilter("all")}
          data-testid="qa-filter-all"
          sx={{ fontWeight: 600, cursor: "pointer", boxShadow: statusFilter === "all" ? "0 0 0 3px rgba(99,102,241,0.55)" : "none" }}
        />
        {(["pass", "fail", "blocked", "awaiting_retest", "not_tested"] as QaStatus[]).map((st) => (
          <Chip
            key={st}
            label={`${STATUS_LABELS[st]}: ${stats[st]}`}
            onClick={() => setStatusFilter(statusFilter === st ? "all" : st)}
            data-testid={`qa-filter-${st}`}
            sx={{ fontWeight: 600, color: "#fff", bgcolor: STATUS_META[st].color, cursor: "pointer", boxShadow: statusFilter === st ? "0 0 0 3px rgba(17,17,17,0.55)" : "none" }}
          />
        ))}
        {statusFilter !== "all" && (
          <Button size="small" onClick={() => setStatusFilter("all")} sx={{ textTransform: "none" }} data-testid="qa-filter-clear">
            Clear filter
          </Button>
        )}
        {dataLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
      </Box>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
        <TextField size="small" label="Your name / initials" value={tester} onChange={(e) => setTester(e.target.value)} sx={{ minWidth: 200 }} />
        <TextField
          size="small"
          placeholder="Search tests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => doExport("csv")}>
          CSV
        </Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => doExport("json")}>
          JSON
        </Button>
      </Box>
      {!tester && (
        <Typography sx={{ fontSize: 12, color: STATUS_META.fail.color, mt: 1 }}>
          Tip: add your name so notes are attributed to you.
        </Typography>
      )}
    </Box>
  );
};

export default QualityToolbar;
