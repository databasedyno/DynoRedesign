import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TEST_SECTIONS } from "@/data/qaCatalog";
import { resolveWhere } from "@/data/qaWhere";
import { STATUS_META } from "./QaItemCard";
import type { QaStatus, QaComment, QaItemMeta } from "./QaItemCard";

export interface CustomItem {
  id: number;
  item_key: string;
  area?: string | null;
  title: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface QaMeta {
  item_key: string;
  section_id?: string | null;
  section_title?: string | null;
  case_title?: string | null;
  assignee?: string | null;
  signed_off?: boolean;
  signed_off_by?: string | null;
  signed_off_at?: string | null;
  updated_at?: string;
}

export type StatusFilter = QaStatus | "all";
export type CustomForm = { area: string; title: string; description: string };

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

/** All state + API handlers for the passcode-gated QA Quality Center. */
export const useQualityCenter = () => {
  const [authed, setAuthed] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passInput, setPassInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  const [tester, setTester] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [commentsByItem, setCommentsByItem] = useState<Record<string, QaComment[]>>({});
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [metaByItem, setMetaByItem] = useState<Record<string, QaMeta>>({});
  const [dataLoading, setDataLoading] = useState(false);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Refs so the memoised cards get stable callbacks (typing a note must not re-render the catalog).
  const passcodeRef = useRef(passcode);
  const testerRef = useRef(tester);
  passcodeRef.current = passcode;
  testerRef.current = tester;

  const [customForm, setCustomForm] = useState<CustomForm>({ area: "", title: "", description: "" });
  const [addingCustom, setAddingCustom] = useState(false);

  const loadData = useCallback(async (pass: string) => {
    setDataLoading(true);
    try {
      const res = await apiCall("/data", pass);
      if (res.ok) {
        const json = await res.json();
        setCommentsByItem(json.commentsByItem || {});
        setCustomItems(json.customItems || []);
        setMetaByItem(json.metaByItem || {});
      }
    } catch {
      /* ignore */
    } finally {
      setDataLoading(false);
    }
  }, []);

  // boot: restore session
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

  const appendComment = (itemKey: string, comment: QaComment) =>
    setCommentsByItem((prev) => ({ ...prev, [itemKey]: [...(prev[itemKey] || []), comment] }));

  const saveComment = useCallback(async (meta: QaItemMeta, draft: { status: QaStatus; note: string }) => {
    setSavingKey(meta.item_key);
    try {
      const res = await apiCall("/comment", passcodeRef.current, {
        method: "POST",
        body: JSON.stringify({ ...meta, tester: testerRef.current, status: draft.status, note: draft.note }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      appendComment(meta.item_key, json.comment);
      return true;
    } finally {
      setSavingKey(null);
    }
  }, []);

  const quickAction = useCallback(async (meta: QaItemMeta, status: QaStatus) => {
    setSavingKey(meta.item_key);
    try {
      const res = await apiCall("/comment", passcodeRef.current, {
        method: "POST",
        body: JSON.stringify({
          ...meta,
          tester: testerRef.current || "QA",
          status,
          note: `Status → ${STATUS_META[status].label} (quick action)`,
        }),
      });
      const json = await res.json();
      if (json.ok) appendComment(meta.item_key, json.comment);
    } finally {
      setSavingKey(null);
    }
  }, []);

  const deleteComment = useCallback(async (itemKey: string, id: number) => {
    const res = await apiCall(`/comment/${id}`, passcodeRef.current, { method: "DELETE" });
    if (res.ok) {
      setCommentsByItem((prev) => ({
        ...prev,
        [itemKey]: (prev[itemKey] || []).filter((c) => c.id !== id),
      }));
    }
  }, []);

  // Upsert item meta (assignee / release sign-off) via PUT /meta.
  const upsertMeta = useCallback(async (meta: QaItemMeta, patch: Partial<QaMeta>) => {
    const res = await apiCall("/meta", passcodeRef.current, {
      method: "PUT",
      body: JSON.stringify({ ...meta, ...patch }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.ok) setMetaByItem((prev) => ({ ...prev, [meta.item_key]: json.meta }));
    return !!json.ok;
  }, []);

  const assignItem = useCallback(
    (meta: QaItemMeta, assignee: string) => upsertMeta(meta, { assignee: assignee || null }),
    [upsertMeta],
  );

  const toggleSignoff = useCallback(
    (meta: QaItemMeta, signed_off: boolean, by?: string) =>
      upsertMeta(meta, { signed_off, signed_off_by: signed_off ? by || testerRef.current || "QA" : null }),
    [upsertMeta],
  );

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

  const latestStatus = useCallback((key: string): QaStatus => {
    const list = commentsByItem[key];
    if (!list || list.length === 0) return "not_tested";
    return list[list.length - 1].status;
  }, [commentsByItem]);

  // A journey's rolled-up status derives from its per-step pass/fail
  // (each step is stored under item_key `${caseKey}#s:${stepId}`).
  const deriveJourneyStatus = useCallback(
    (caseKey: string, steps: { id: string }[]): QaStatus => {
      if (!steps.length) return latestStatus(caseKey);
      const sts = steps.map((st) => latestStatus(`${caseKey}#s:${st.id}`));
      if (sts.some((x) => x === "fail")) return "fail";
      if (sts.every((x) => x === "pass")) return "pass";
      return "not_tested"; // partial / not started → not counted as pass
    },
    [latestStatus],
  );

  const stats = useMemo(() => {
    const counts = { total: 0, pass: 0, fail: 0, blocked: 0, awaiting_retest: 0, not_tested: 0 };
    TEST_SECTIONS.forEach((s) =>
      s.cases.forEach((c) => {
        const key = `${s.id}::${c.id}`;
        const st = s.id === "journeys" ? deriveJourneyStatus(key, c.steps) : latestStatus(key);
        counts[st] += 1;
        counts.total += 1;
      }),
    );
    customItems.forEach((c) => {
      counts[latestStatus(c.item_key)] += 1;
      counts.total += 1;
    });
    return counts;
  }, [customItems, latestStatus, deriveJourneyStatus]);

  const q = search.trim().toLowerCase();
  const matchesStatus = (key: string) => statusFilter === "all" || latestStatus(key) === statusFilter;
  const filteredSections = TEST_SECTIONS.map((section) => ({
    ...section,
    cases: section.cases.filter((c) => {
      const key = `${section.id}::${c.id}`;
      if (!matchesStatus(key)) return false;
      if (!q) return true;
      const where = resolveWhere(section.id, c.id);
      return (
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        section.title.toLowerCase().includes(q) ||
        (where ? `${where.menu} ${where.route} ${where.hint || ""}`.toLowerCase().includes(q) : false) ||
        c.steps.some((st) => st.action.toLowerCase().includes(q) || st.expected.toLowerCase().includes(q))
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

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const filterActive = !!q || statusFilter !== "all";

  return {
    authed, passInput, setPassInput, authError, authLoading, booting, handleUnlock, handleLock,
    tester, setTester, search, setSearch, statusFilter, setStatusFilter, dataLoading, stats, doExport,
    expanded, toggleExpanded, filterActive, filteredSections, customItems, visibleCustomItems,
    customForm, setCustomForm, addingCustom, addCustom, deleteCustom,
    commentsByItem, savingKey, saveComment, quickAction, deleteComment,
    metaByItem, assignItem, toggleSignoff, latestStatus, deriveJourneyStatus,
  };
};

export type QualityCenter = ReturnType<typeof useQualityCenter>;
