import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Paper, useTheme } from "@mui/material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import SessionList, { SupportSession, SummaryCounts } from "./SessionList";
import ConversationPanel, { SessionMeta, SupportMessage } from "./ConversationPanel";

const POLL_MS = 4000;

const SupportInbox: React.FC = () => {
  const dispatch = useDispatch();
  const theme = useTheme();

  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [summary, setSummary] = useState<SummaryCounts>({});
  const [status, setStatus] = useState("all");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ session: SessionMeta; messages: SupportMessage[] } | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);

  // Refs so the polling interval always reads the latest filters/selection.
  const selectedRef = useRef<string | null>(null);
  const statusRef = useRef(status);
  const qRef = useRef(q);
  selectedRef.current = selectedId;
  statusRef.current = status;
  qRef.current = q;

  const toast = useCallback(
    (message: string, severity: "success" | "error" | "info" = "success") =>
      dispatch({ type: TOAST_SHOW, payload: { message, severity } }),
    [dispatch]
  );

  // Debounce the search input into the committed query.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const fetchList = useCallback(async () => {
    try {
      const [sRes, sumRes] = await Promise.all([
        adminBaseApi.get(`/admin/support/sessions`, { params: { status: statusRef.current, q: qRef.current } }),
        adminBaseApi.get(`/admin/support/summary`),
      ]);
      setSessions(sRes.data?.data?.sessions || []);
      setSummary(sumRes.data?.data || {});
    } catch {
      /* silent — polling should not spam toasts */
    }
  }, []);

  const fetchDetail = useCallback(async (id: string, silent = false) => {
    if (!silent) setLoadingDetail(true);
    try {
      const res = await adminBaseApi.get(`/admin/support/sessions/${id}`);
      // Ignore late responses after the user switched conversations.
      if (selectedRef.current === id) setDetail(res.data?.data || null);
    } catch (e: unknown) {
      if (!silent) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast(msg || "Could not load the conversation.", "error");
      }
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, [toast]);

  // Initial + on filter change list load.
  useEffect(() => {
    setLoadingList(true);
    fetchList().finally(() => setLoadingList(false));
  }, [status, q, fetchList]);

  // Near-real-time polling (list + open conversation).
  useEffect(() => {
    const t = setInterval(() => {
      fetchList();
      if (selectedRef.current) fetchDetail(selectedRef.current, true);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [fetchList, fetchDetail]);

  const selectSession = useCallback(
    (id: string) => {
      setSelectedId(id);
      setDetail(null);
      selectedRef.current = id;
      fetchDetail(id);
      fetchList(); // clears unread badge immediately
    },
    [fetchDetail, fetchList]
  );

  const action = useCallback(
    async (path: string, okMsg?: string) => {
      if (!selectedId) return false;
      try {
        await adminBaseApi.post(`/admin/support/sessions/${selectedId}/${path}`);
        await fetchDetail(selectedId, true);
        fetchList();
        if (okMsg) toast(okMsg);
        return true;
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast(msg || "Action failed.", "error");
        return false;
      }
    },
    [selectedId, fetchDetail, fetchList, toast]
  );

  const onReply = useCallback(
    async (message: string) => {
      if (!selectedId) return;
      setSending(true);
      try {
        await adminBaseApi.post(`/admin/support/sessions/${selectedId}/reply`, { message });
        await fetchDetail(selectedId, true);
        fetchList();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast(msg || "Could not send the reply.", "error");
      } finally {
        setSending(false);
      }
    },
    [selectedId, fetchDetail, fetchList, toast]
  );

  const onEmail = useCallback(
    async (subject: string, message: string, to?: string) => {
      if (!selectedId) return false;
      try {
        const res = await adminBaseApi.post(`/admin/support/sessions/${selectedId}/email`, { subject, message, to });
        const data = res.data?.data || {};
        toast(
          data.disabled_in_preview
            ? `Email queued to ${data.to} (sending is disabled in this preview).`
            : `Email sent to ${data.to}.`,
          "success"
        );
        await fetchDetail(selectedId, true);
        return true;
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast(msg || "Could not send the email.", "error");
        return false;
      }
    },
    [selectedId, fetchDetail, toast]
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        height: { xs: "auto", md: "calc(100vh - 160px)" },
        minHeight: 480,
        overflow: "hidden",
        borderColor: theme.palette.divider,
      }}
    >
      <SessionList
        sessions={sessions}
        selectedId={selectedId}
        onSelect={selectSession}
        status={status}
        onStatusChange={setStatus}
        q={qInput}
        onSearch={setQInput}
        loading={loadingList}
        summary={summary}
      />
      <ConversationPanel
        detail={detail}
        loading={loadingDetail}
        sending={sending}
        onReply={onReply}
        onTakeover={async () => {
          await action("takeover", "You've taken over this chat.");
        }}
        onHandback={async () => {
          await action("handback", "Returned to the AI assistant.");
        }}
        onClose={async () => {
          await action("close", "Conversation closed.");
        }}
        onReopen={async () => {
          await action("reopen", "Conversation reopened.");
        }}
        onEmail={onEmail}
      />
    </Paper>
  );
};

export default SupportInbox;
