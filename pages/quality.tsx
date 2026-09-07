import React, { useState, useCallback, useEffect, useMemo } from "react";
import Head from "next/head";
import {
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Divider,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import AddIcon from "@mui/icons-material/Add";
import { TEST_SECTIONS } from "@/data/qaCatalog";

/* ==================== TYPES ==================== */
type QaStatus = "pass" | "fail" | "blocked" | "awaiting_retest" | "not_tested";

interface QaComment {
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

interface CustomItem {
  id: number;
  item_key: string;
  area?: string | null;
  title: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
}

/* ==================== CONSTANTS ==================== */
const STATUS_META: Record<QaStatus, { label: string; color: string }> = {
  pass: { label: "Pass", color: "#22C55E" },
  fail: { label: "Fail", color: "#EF4444" },
  blocked: { label: "Blocked", color: "#F59E0B" },
  awaiting_retest: { label: "Awaiting retest", color: "#8B5CF6" },
  not_tested: { label: "Not tested", color: "#9CA3AF" },
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#6B7280",
};

const STATUS_OPTIONS: QaStatus[] = ["pass", "fail", "blocked", "awaiting_retest", "not_tested"];

const StatusChip = ({ status, small }: { status: QaStatus; small?: boolean }) => (
  <Chip
    label={STATUS_META[status].label}
    size="small"
    sx={{
      height: small ? 20 : 24,
      fontSize: small ? 11 : 12,
      fontWeight: 600,
      color: "#fff",
      bgcolor: STATUS_META[status].color,
    }}
  />
);

/* ==================== API HELPER ==================== */
const apiCall = async (path: string, passcode: string, opts: RequestInit = {}) => {
  const res = await fetch(`/api/quality${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-qa-passcode": passcode,
      ...(opts.headers || {}),
    },
  });
  return res;
};

/* ==================== COMPONENT ==================== */
const QualityPage = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [authed, setAuthed] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passInput, setPassInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  const [tester, setTester] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<QaStatus | "all">("all");

  const [commentsByItem, setCommentsByItem] = useState<Record<string, QaComment[]>>({});
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // per-item draft { status, note }
  const [drafts, setDrafts] = useState<Record<string, { status: QaStatus; note: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // custom item form
  const [customForm, setCustomForm] = useState({ area: "", title: "", description: "" });
  const [addingCustom, setAddingCustom] = useState(false);

  const cardBg = isDark ? "#151921" : "#FFFFFF";
  const border = `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`;

  /* ---------- load data ---------- */
  const loadData = useCallback(async (pass: string) => {
    setDataLoading(true);
    try {
      const res = await apiCall("/data", pass);
      if (res.ok) {
        const json = await res.json();
        setCommentsByItem(json.commentsByItem || {});
        setCustomItems(json.customItems || []);
      }
    } catch {
      /* ignore */
    } finally {
      setDataLoading(false);
    }
  }, []);

  /* ---------- boot: restore session ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTester = localStorage.getItem("qa_tester");
    if (savedTester) setTester(savedTester);
    const savedPass = localStorage.getItem("qa_passcode");
    if (savedPass) {
      apiCall("/auth", savedPass, { method: "POST", body: "{}" })
        .then((res) => {
          if (res.ok) {
            setPasscode(savedPass);
            setAuthed(true);
            loadData(savedPass);
          } else {
            localStorage.removeItem("qa_passcode");
          }
        })
        .catch(() => {})
        .finally(() => setBooting(false));
    } else {
      setBooting(false);
    }
  }, [loadData]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("qa_tester", tester);
  }, [tester]);

  /* ---------- auth ---------- */
  const handleUnlock = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await apiCall("/auth", passInput, { method: "POST", body: "{}" });
      if (res.ok) {
        localStorage.setItem("qa_passcode", passInput);
        setPasscode(passInput);
        setAuthed(true);
        loadData(passInput);
      } else {
        setAuthError("Incorrect passcode. Please try again.");
      }
    } catch {
      setAuthError("Network error. Please retry.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLock = () => {
    localStorage.removeItem("qa_passcode");
    setAuthed(false);
    setPasscode("");
    setPassInput("");
  };

  /* ---------- drafts ---------- */
  const getDraft = (key: string) => drafts[key] || { status: "pass" as QaStatus, note: "" };
  const setDraft = (key: string, patch: Partial<{ status: QaStatus; note: string }>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...getDraft(key), ...patch } }));

  /* ---------- save comment ---------- */
  const saveComment = async (meta: {
    item_key: string;
    section_id?: string;
    section_title?: string;
    case_title?: string;
  }) => {
    const draft = getDraft(meta.item_key);
    if (!draft.note.trim() && draft.status === "not_tested") return;
    setSavingKey(meta.item_key);
    try {
      const res = await apiCall("/comment", passcode, {
        method: "POST",
        body: JSON.stringify({ ...meta, tester, status: draft.status, note: draft.note }),
      });
      if (res.ok) {
        const json = await res.json();
        setCommentsByItem((prev) => ({
          ...prev,
          [meta.item_key]: [...(prev[meta.item_key] || []), json.comment],
        }));
        setDraft(meta.item_key, { note: "" });
      }
    } finally {
      setSavingKey(null);
    }
  };

  const quickAction = async (
    meta: { item_key: string; section_id?: string; section_title?: string; case_title?: string },
    status: QaStatus
  ) => {
    setSavingKey(meta.item_key);
    try {
      const res = await apiCall("/comment", passcode, {
        method: "POST",
        body: JSON.stringify({
          ...meta,
          tester: tester || "QA",
          status,
          note: `Status → ${STATUS_META[status].label} (quick action)`,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setCommentsByItem((prev) => ({
          ...prev,
          [meta.item_key]: [...(prev[meta.item_key] || []), json.comment],
        }));
      }
    } finally {
      setSavingKey(null);
    }
  };

  const deleteComment = async (itemKey: string, id: number) => {
    const res = await apiCall(`/comment/${id}`, passcode, { method: "DELETE" });
    if (res.ok) {
      setCommentsByItem((prev) => ({
        ...prev,
        [itemKey]: (prev[itemKey] || []).filter((c) => c.id !== id),
      }));
    }
  };

  /* ---------- custom items ---------- */
  const addCustom = async () => {
    if (!customForm.title.trim()) return;
    setAddingCustom(true);
    try {
      const res = await apiCall("/custom", passcode, {
        method: "POST",
        body: JSON.stringify({ ...customForm, created_by: tester }),
      });
      if (res.ok) {
        const json = await res.json();
        setCustomItems((prev) => [...prev, json.item]);
        setCustomForm({ area: "", title: "", description: "" });
      }
    } finally {
      setAddingCustom(false);
    }
  };

  const deleteCustom = async (id: number) => {
    const res = await apiCall(`/custom/${id}`, passcode, { method: "DELETE" });
    if (res.ok) {
      setCustomItems((prev) => prev.filter((c) => c.id !== id));
      setCommentsByItem((prev) => {
        const copy = { ...prev };
        delete copy[`custom::${id}`];
        return copy;
      });
    }
  };

  /* ---------- export ---------- */
  const doExport = async (format: "json" | "csv") => {
    const res = await apiCall(`/export?format=${format}`, passcode);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dynopay-qa-notes.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* ---------- derived: latest status per item ---------- */
  const latestStatus = (key: string): QaStatus => {
    const list = commentsByItem[key];
    if (!list || list.length === 0) return "not_tested";
    return list[list.length - 1].status;
  };

  const stats = useMemo(() => {
    const allKeys: string[] = [];
    TEST_SECTIONS.forEach((s) => s.cases.forEach((c) => allKeys.push(`${s.id}::${c.id}`)));
    customItems.forEach((c) => allKeys.push(c.item_key));
    const counts = { total: allKeys.length, pass: 0, fail: 0, blocked: 0, awaiting_retest: 0, not_tested: 0 };
    allKeys.forEach((k) => {
      counts[latestStatus(k)] += 1;
    });
    return counts;
  }, [commentsByItem, customItems]);

  /* ---------- search + status filter ---------- */
  const q = search.trim().toLowerCase();
  const matchesStatus = (key: string) => statusFilter === "all" || latestStatus(key) === statusFilter;
  const filteredSections = TEST_SECTIONS.map((section) => ({
    ...section,
    cases: section.cases.filter((c) => {
      const key = `${section.id}::${c.id}`;
      if (!matchesStatus(key)) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        section.title.toLowerCase().includes(q) ||
        c.steps.some(
          (st) => st.action.toLowerCase().includes(q) || st.expected.toLowerCase().includes(q)
        )
      );
    }),
  })).filter((s) => s.cases.length > 0);
  const visibleCustomItems = customItems.filter((item) => {
    if (!matchesStatus(item.item_key)) return false;
    if (!q) return true;
    return (
      (item.title || "").toLowerCase().includes(q) ||
      (item.area || "").toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q)
    );
  });

  /* ==================== RENDER: STATUS CHIP ==================== */

  /* ==================== RENDER: ITEM CARD (shared) ==================== */
  const renderItemCard = (
    itemKey: string,
    meta: { section_id?: string; section_title?: string; case_title?: string },
    header: React.ReactNode,
    body?: React.ReactNode,
    onDeleteItem?: () => void
  ) => {
    const comments = commentsByItem[itemKey] || [];
    const draft = getDraft(itemKey);
    return (
      <Box
        key={itemKey}
        sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: cardBg, border }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ flex: 1 }}>{header}</Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatusChip status={latestStatus(itemKey)} />
            {latestStatus(itemKey) === "awaiting_retest" && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={savingKey === itemKey}
                  onClick={() => quickAction({ item_key: itemKey, ...meta }, "fail")}
                  sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11, textTransform: "none", lineHeight: 1.4 }}
                  data-testid={`qa-quick-reopen-${itemKey}`}
                >
                  Reopen
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  disabled={savingKey === itemKey}
                  onClick={() => quickAction({ item_key: itemKey, ...meta }, "pass")}
                  sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11, textTransform: "none", lineHeight: 1.4 }}
                  data-testid={`qa-quick-pass-${itemKey}`}
                >
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

        {/* existing comments thread */}
        {comments.length > 0 && (
          <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
            {comments.map((c) => (
              <Box
                key={c.id}
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                  border,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                  <StatusChip status={c.status} small />
                  <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                    {c.tester || "Anonymous"}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
                    {new Date(c.created_at).toLocaleString()}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <IconButton size="small" onClick={() => deleteComment(itemKey, c.id)}>
                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>
                {c.note && (
                  <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{c.note}</Typography>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* add note form */}
        <Box sx={{ mt: 1.5, display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, alignItems: "flex-start" }}>
          <TextField
            select
            size="small"
            label="Status"
            value={draft.status}
            onChange={(e) => setDraft(itemKey, { status: e.target.value as QaStatus })}
            sx={{ minWidth: 140 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_META[s].label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={1}
            placeholder="Add a note for this test (bug, observation, steps to reproduce)…"
            value={draft.note}
            onChange={(e) => setDraft(itemKey, { note: e.target.value })}
          />
          <Button
            variant="contained"
            onClick={() => saveComment({ item_key: itemKey, ...meta })}
            disabled={savingKey === itemKey}
            sx={{ whiteSpace: "nowrap", height: 40 }}
          >
            {savingKey === itemKey ? <CircularProgress size={18} color="inherit" /> : "Save note"}
          </Button>
        </Box>
      </Box>
    );
  };

  /* ==================== RENDER: GATE ==================== */
  if (booting) {
    return (
      <>
        <Head>
          <title>QA Quality Center · Dynopay</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  if (!authed) {
    return (
      <>
        <Head>
          <title>QA Quality Center · Dynopay</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <Box
          sx={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            bgcolor: isDark ? "#0B0E11" : "#F8FAFC",
            p: 2,
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 420,
              p: 4,
              borderRadius: 3,
              bgcolor: cardBg,
              border,
              textAlign: "center",
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
            <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 0.5 }}>
              Dynopay Quality Center
            </Typography>
            <Typography sx={{ fontSize: 14, color: "text.secondary", mb: 3 }}>
              Enter the QA passcode to access the end-to-end test plan.
            </Typography>
            <TextField
              fullWidth
              type="password"
              label="Passcode"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              error={!!authError}
              helperText={authError}
              sx={{ mb: 2 }}
              autoFocus
            />
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleUnlock}
              disabled={authLoading || !passInput}
            >
              {authLoading ? <CircularProgress size={22} color="inherit" /> : "Unlock"}
            </Button>
          </Box>
        </Box>
      </>
    );
  }

  /* ==================== RENDER: MAIN ==================== */
  return (
    <>
      <Head>
        <title>QA Quality Center · Dynopay</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: isDark ? "#0B0E11" : "#F8FAFC",
          py: { xs: 3, md: 6 },
        }}
      >
        <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 2, md: 3 } }}>
          {/* Header */}
          <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography sx={{ fontSize: { xs: 26, md: 36 }, fontWeight: 800 }}>
                Dynopay Quality Center
              </Typography>
              <Typography sx={{ fontSize: 14, color: "text.secondary", maxWidth: 640 }}>
                End-to-end functional test plan. Record a status and notes for each test — every note is
                saved to the database so the team can review and fix.
              </Typography>
            </Box>
            <Tooltip title="Lock / sign out">
              <IconButton onClick={handleLock}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Stats + toolbar */}
          <Box sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: cardBg, border }}>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2, alignItems: "center" }}>
              <Chip
                label={`Total: ${stats.total}`}
                onClick={() => setStatusFilter("all")}
                data-testid="qa-filter-all"
                sx={{ fontWeight: 600, cursor: "pointer", boxShadow: statusFilter === "all" ? "0 0 0 3px rgba(99,102,241,0.55)" : "none" }}
              />
              {(["pass", "fail", "blocked", "awaiting_retest", "not_tested"] as QaStatus[]).map((st) => {
                const labels: Record<QaStatus, string> = {
                  pass: "Pass",
                  fail: "Fail",
                  blocked: "Blocked",
                  awaiting_retest: "Awaiting retest",
                  not_tested: "Untested",
                };
                const active = statusFilter === st;
                return (
                  <Chip
                    key={st}
                    label={`${labels[st]}: ${stats[st]}`}
                    onClick={() => setStatusFilter((prev) => (prev === st ? "all" : st))}
                    data-testid={`qa-filter-${st}`}
                    sx={{ fontWeight: 600, color: "#fff", bgcolor: STATUS_META[st].color, cursor: "pointer", boxShadow: active ? "0 0 0 3px rgba(17,17,17,0.55)" : "none" }}
                  />
                );
              })}
              {statusFilter !== "all" && (
                <Button size="small" onClick={() => setStatusFilter("all")} sx={{ textTransform: "none" }} data-testid="qa-filter-clear">
                  Clear filter
                </Button>
              )}
              {dataLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
              <TextField
                size="small"
                label="Your name / initials"
                value={tester}
                onChange={(e) => setTester(e.target.value)}
                sx={{ minWidth: 200 }}
              />
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

          {/* Catalog sections */}
          {filteredSections.map((section) => {
            const isOpen = expanded.includes(section.id) || !!q || statusFilter !== "all";
            return (
              <Accordion
                key={section.id}
                expanded={isOpen}
                onChange={() =>
                  setExpanded((prev) =>
                    prev.includes(section.id)
                      ? prev.filter((x) => x !== section.id)
                      : [...prev, section.id]
                  )
                }
                sx={{ mb: 1.5, borderRadius: "12px !important", bgcolor: cardBg, border, "&:before": { display: "none" } }}
                disableGutters
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontSize: 17, fontWeight: 700 }}>
                    {section.icon} {section.title}
                  </Typography>
                  <Chip
                    label={`${section.cases.length} tests`}
                    size="small"
                    sx={{ ml: 1.5, fontSize: 11 }}
                  />
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
                    {section.description}
                  </Typography>
                  {section.cases.map((c) => {
                    const itemKey = `${section.id}::${c.id}`;
                    return renderItemCard(
                      itemKey,
                      {
                        section_id: section.id,
                        section_title: section.title,
                        case_title: c.title,
                      },
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{c.title}</Typography>
                          <Chip
                            label={c.priority}
                            size="small"
                            sx={{ height: 20, fontSize: 10, fontWeight: 700, color: "#fff", bgcolor: PRIORITY_COLORS[c.priority] }}
                          />
                        </Box>
                        {c.preconditions && (
                          <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>
                            <b>Preconditions:</b> {c.preconditions}
                          </Typography>
                        )}
                      </Box>,
                      <Box sx={{ mt: 1, mb: 1 }}>
                        {c.steps.map((st, i) => (
                          <Box key={st.id} sx={{ display: "flex", gap: 1, mb: 0.5 }}>
                            <Typography sx={{ fontSize: 12.5, color: "text.secondary", minWidth: 20 }}>
                              {i + 1}.
                            </Typography>
                            <Typography sx={{ fontSize: 12.5 }}>
                              <b>{st.action}</b> → <span style={{ color: theme.palette.text.secondary }}>{st.expected}</span>
                            </Typography>
                          </Box>
                        ))}
                        {c.notes && (
                          <Typography sx={{ fontSize: 12, color: STATUS_META.blocked.color, mt: 0.5 }}>
                            ⚠️ {c.notes}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* Custom tests */}
          <Accordion
            expanded={expanded.includes("__custom") || !!q || statusFilter !== "all"}
            onChange={() =>
              setExpanded((prev) =>
                prev.includes("__custom") ? prev.filter((x) => x !== "__custom") : [...prev, "__custom"]
              )
            }
            sx={{ mt: 3, mb: 1.5, borderRadius: "12px !important", bgcolor: cardBg, border, "&:before": { display: "none" } }}
            disableGutters
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontSize: 17, fontWeight: 700 }}>➕ Custom Tests</Typography>
              <Chip label={`${customItems.length}`} size="small" sx={{ ml: 1.5, fontSize: 11 }} />
            </AccordionSummary>
            <AccordionDetails>
              {/* add form */}
              <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC", border }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Add a custom test</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                    <TextField
                      size="small"
                      label="Area (optional)"
                      value={customForm.area}
                      onChange={(e) => setCustomForm((f) => ({ ...f, area: e.target.value }))}
                      sx={{ minWidth: 200 }}
                    />
                    <TextField
                      size="small"
                      label="Test title"
                      value={customForm.title}
                      onChange={(e) => setCustomForm((f) => ({ ...f, title: e.target.value }))}
                      sx={{ minWidth: 260, flex: 1 }}
                    />
                  </Box>
                  <TextField
                    size="small"
                    label="What to test / expected result (optional)"
                    multiline
                    minRows={2}
                    value={customForm.description}
                    onChange={(e) => setCustomForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <Box>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={addCustom}
                      disabled={addingCustom || !customForm.title.trim()}
                    >
                      {addingCustom ? <CircularProgress size={18} color="inherit" /> : "Add test"}
                    </Button>
                  </Box>
                </Box>
              </Box>

              {visibleCustomItems.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  {statusFilter !== "all" || q
                    ? "No custom tests match the current filter."
                    : "No custom tests yet. Add one above to track anything not covered by the catalog."}
                </Typography>
              ) : (
                visibleCustomItems.map((item) =>
                  renderItemCard(
                    item.item_key,
                    { section_id: "custom", section_title: item.area || "Custom Tests", case_title: item.title },
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{item.title}</Typography>
                        {item.area && <Chip label={item.area} size="small" sx={{ height: 20, fontSize: 10 }} />}
                      </Box>
                      {item.description && (
                        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                          {item.description}
                        </Typography>
                      )}
                    </Box>,
                    undefined,
                    () => deleteCustom(item.id)
                  )
                )
              )}
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 3 }} />
          <Typography sx={{ fontSize: 12, color: "text.secondary", textAlign: "center", pb: 4 }}>
            All notes are stored in the database. Use the CSV / JSON export above to hand the full list to
            the dev team.
          </Typography>
        </Box>
      </Box>
    </>
  );
};

export default QualityPage;

// Render standalone (no marketing/app shell) — this is a passcode-gated internal tool.
(QualityPage as unknown as { layout: string }).layout = "none";
