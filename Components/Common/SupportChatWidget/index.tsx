import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  IconButton,
  InputBase,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import axiosBaseApi from "@/axiosConfig";

/**
 * SupportChatWidget (session 12, 2026-07-10) — floating AI support chat,
 * available on the landing pages (anonymous) and inside the merchant app
 * (logged-in; the backend personalises answers via the Bearer token that
 * axiosConfig attaches automatically).
 *
 * Backend API:
 *   POST support/chat                     { session_id, message } → { data: { reply } }
 *   GET  support/chat/history/:session_id → { data: { messages: [...] } }
 *   POST support/chat/escalate            { session_id, contact_email?, note? }
 */

const LIME = "#CCFF00";
const INK = "#0A0A0B";
const SESSION_KEY = "support_chat_sid";
const MAX_CHARS = 2000;

type ChatRole = "user" | "assistant";
interface ChatMsg {
  role: ChatRole;
  content: string;
  error?: boolean;
}

const makeSessionId = (): string => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch (_e) { /* fall through */ }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const getOrCreateSessionId = (): string => {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
    const fresh = makeSessionId();
    localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch (_e) {
    return makeSessionId();
  }
};

const GREETING =
  "Hi, I'm Dyno — DynoPay's AI assistant. Ask me anything about fees, supported coins, payment links, wallets or our API. Need a person? Hit the headset icon above to reach human support.";

interface SupportChatWidgetProps {
  layout?: "home" | "client";
}

const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({ layout = "home" }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateEmail, setEscalateEmail] = useState("");
  const [escalateNote, setEscalateNote] = useState("");
  const [escalating, setEscalating] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Allow any part of the app to open the chat programmatically, e.g. the
  // landing page "Chat with us" link in FinalCTA (which previously pointed at
  // the auth-gated /help-support page and bounced visitors to login).
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("dynopay:open-support-chat", openChat);
    return () => window.removeEventListener("dynopay:open-support-chat", openChat);
  }, []);

  // Auto-scroll on new messages / typing indicator
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open, escalateOpen]);

  // Load history once, on first open
  useEffect(() => {
    if (!open || historyLoaded || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosBaseApi.get(`support/chat/history/${sessionId}`);
        const rows = res?.data?.data?.messages;
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          setMessages(
            rows.map((r: { role: string; content: string }) => ({
              role: r.role === "assistant" ? "assistant" : "user",
              content: r.content,
            }))
          );
        }
      } catch (_e) {
        // History is best-effort — chat still works without it
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, historyLoaded, sessionId]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;
    if (text.length > MAX_CHARS) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await axiosBaseApi.post("support/chat", { session_id: sessionId, message: text });
      const reply = res?.data?.data?.reply;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply || "Sorry — I could not generate a reply. Please try again." , error: !reply },
      ]);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const friendly =
        status === 429
          ? "You're sending messages a little fast — please wait a moment and try again."
          : "Sorry, something went wrong reaching support. Please try again in a moment.";
      setMessages((prev) => [...prev, { role: "assistant", content: friendly, error: true }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, sessionId]);

  const submitEscalation = useCallback(async () => {
    if (escalating || !sessionId) return;
    setEscalating(true);
    try {
      await axiosBaseApi.post("support/chat/escalate", {
        session_id: sessionId,
        contact_email: escalateEmail.trim() || undefined,
        note: escalateNote.trim() || undefined,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Done — your conversation has been forwarded to our support team. A human will get back to you by email as soon as possible.",
        },
      ]);
      setEscalateOpen(false);
      setEscalateEmail("");
      setEscalateNote("");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            status === 400 && apiMsg
              ? apiMsg
              : "Sorry, the escalation could not be sent right now. Please try again shortly.",
          error: true,
        },
      ]);
    } finally {
      setEscalating(false);
    }
  }, [escalating, sessionId, escalateEmail, escalateNote]);

  const resetConversation = useCallback(() => {
    const fresh = makeSessionId();
    try { localStorage.setItem(SESSION_KEY, fresh); } catch (_e) { /* noop */ }
    setSessionId(fresh);
    setMessages([]);
    setHistoryLoaded(true); // fresh session — nothing to load
    setEscalateOpen(false);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send]
  );

  // ---- styles -------------------------------------------------------------
  const panelBg = isDark ? "#101014" : "#FFFFFF";
  const panelBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const assistantBubbleBg = isDark ? "rgba(255,255,255,0.07)" : "#F2F3F5";
  const userBubbleBg = isDark ? LIME : INK;
  const userBubbleColor = isDark ? INK : "#FFFFFF";
  // Keep clear of the in-app floating mobile nav pill
  const fabBottom = layout === "client" ? { xs: 88, md: 24 } : { xs: 20, md: 24 };

  const inputSx = {
    width: "100%",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    color: theme.palette.text.primary,
    border: `1px solid ${panelBorder}`,
    borderRadius: "10px",
    padding: "8px 10px",
    background: isDark ? "rgba(255,255,255,0.04)" : "#FAFAFA",
  } as const;

  const dotSx = (delay: string) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    bgcolor: theme.palette.text.secondary,
    animation: "dyno-chat-dot 1.2s infinite",
    animationDelay: delay,
    "@keyframes dyno-chat-dot": {
      "0%, 80%, 100%": { opacity: 0.25 },
      "40%": { opacity: 1 },
    },
  });

  const visibleMessages = useMemo<ChatMsg[]>(
    () => (messages.length === 0 ? [{ role: "assistant", content: GREETING }] : messages),
    [messages]
  );

  return (
    <>
      {/* ── Floating panel ── */}
      {open && (
        <Box
          data-testid="support-chat-panel"
          sx={{
            position: "fixed",
            bottom: { xs: `calc(${typeof fabBottom.xs === "number" ? fabBottom.xs : 20}px + 68px)`, md: "calc(24px + 68px)" },
            right: { xs: 12, md: 24 },
            width: { xs: "calc(100vw - 24px)", sm: 384 },
            maxWidth: 384,
            height: { xs: "min(560px, 68vh)", md: 560 },
            zIndex: 1450,
            display: "flex",
            flexDirection: "column",
            borderRadius: "16px",
            overflow: "hidden",
            background: panelBg,
            border: `1px solid ${panelBorder}`,
            boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.6)" : "0 16px 48px rgba(0,0,0,0.16)",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 2,
              py: 1.5,
              background: INK,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: LIME,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <SupportAgentRoundedIcon sx={{ fontSize: 20, color: INK }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.2 }}>
                DynoPay Support
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "rgba(255,255,255,0.65)", display: "flex", alignItems: "center", gap: 0.6 }}>
                <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: LIME, display: "inline-block" }} />
                AI assistant · replies instantly
              </Typography>
            </Box>
            <Tooltip title="Talk to a human">
              <IconButton
                size="small"
                data-testid="support-chat-escalate"
                onClick={() => setEscalateOpen((v) => !v)}
                sx={{ color: escalateOpen ? LIME : "rgba(255,255,255,0.75)" }}
                aria-label="Talk to a human"
              >
                <SupportAgentRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="New conversation">
              <IconButton size="small" onClick={resetConversation} sx={{ color: "rgba(255,255,255,0.75)" }} aria-label="New conversation">
                <RestartAltRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "rgba(255,255,255,0.75)" }} aria-label="Close chat">
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            ref={listRef}
            sx={{ flex: 1, overflowY: "auto", px: 1.75, py: 1.75, display: "flex", flexDirection: "column", gap: 1.1 }}
          >
            {visibleMessages.map((m, i) => (
              <Box
                key={i}
                sx={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "84%",
                  px: 1.5,
                  py: 1,
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? userBubbleBg : assistantBubbleBg,
                  border: m.error ? `1px solid ${isDark ? "rgba(255,120,120,0.5)" : "rgba(200,40,40,0.35)"}` : "none",
                }}
              >
                <Typography
                  sx={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: m.role === "user" ? userBubbleColor : theme.palette.text.primary,
                  }}
                >
                  {m.content}
                </Typography>
              </Box>
            ))}

            {sending && (
              <Box sx={{ alignSelf: "flex-start", display: "flex", gap: 0.6, alignItems: "center", px: 1.5, py: 1.2, borderRadius: "14px 14px 14px 4px", background: assistantBubbleBg }}>
                <Box sx={dotSx("0s")} />
                <Box sx={dotSx("0.2s")} />
                <Box sx={dotSx("0.4s")} />
              </Box>
            )}

            {/* Escalation form */}
            {escalateOpen && (
              <Box sx={{ border: `1px solid ${panelBorder}`, borderRadius: "12px", p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: theme.palette.text.primary }}>
                  Talk to a human
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: theme.palette.text.secondary }}>
                  We'll email this conversation to our support team and reply to you by email.
                </Typography>
                <InputBase
                  data-testid="support-chat-escalate-email"
                  placeholder="Your email (optional if signed in)"
                  value={escalateEmail}
                  onChange={(e) => setEscalateEmail(e.target.value)}
                  sx={inputSx}
                  inputProps={{ maxLength: 120, "aria-label": "Contact email" }}
                />
                <InputBase
                  placeholder="Anything to add? (optional)"
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  multiline
                  maxRows={3}
                  sx={inputSx}
                  inputProps={{ maxLength: 1000, "aria-label": "Note for support" }}
                />
                <Box
                  component="button"
                  type="button"
                  data-testid="support-chat-escalate-submit"
                  onClick={() => void submitEscalation()}
                  disabled={escalating}
                  sx={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    fontWeight: 600,
                    border: "none",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    cursor: escalating ? "wait" : "pointer",
                    background: INK,
                    color: LIME,
                    opacity: escalating ? 0.6 : 1,
                  }}
                >
                  {escalating ? "Sending…" : "Send to support team"}
                </Box>
              </Box>
            )}
          </Box>

          {/* Input */}
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, px: 1.5, py: 1.25, borderTop: `1px solid ${panelBorder}`, flexShrink: 0 }}>
            <InputBase
              data-testid="support-chat-input"
              inputRef={inputRef}
              placeholder="Ask about fees, coins, API…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              multiline
              maxRows={4}
              sx={{ ...inputSx, flex: 1 }}
              inputProps={{ maxLength: MAX_CHARS, "aria-label": "Message" }}
            />
            <IconButton
              data-testid="support-chat-send"
              onClick={() => void send()}
              disabled={sending || input.trim().length === 0}
              aria-label="Send message"
              sx={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                background: INK,
                color: LIME,
                flexShrink: 0,
                "&:hover": { background: "#1C1C21" },
                "&.Mui-disabled": { background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", color: theme.palette.text.disabled },
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* ── Floating launcher button ── */}
      <Tooltip title={open ? "Close support chat" : "Chat with support"}>
        <IconButton
          data-testid="support-chat-button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close support chat" : "Open support chat"}
          sx={{
            position: "fixed",
            bottom: fabBottom,
            right: { xs: 16, md: 24 },
            zIndex: 1451,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: INK,
            color: LIME,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
            transition: "transform 0.2s ease, background 0.2s ease",
            "&:hover": { background: "#1C1C21", transform: "translateY(-2px)" },
          }}
        >
          {open ? <CloseRoundedIcon sx={{ fontSize: 26 }} /> : <ChatRoundedIcon sx={{ fontSize: 26 }} />}
        </IconButton>
      </Tooltip>
    </>
  );
};

export default SupportChatWidget;
