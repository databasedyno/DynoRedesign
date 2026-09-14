import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
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
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import SentimentSatisfiedAltRoundedIcon from "@mui/icons-material/SentimentSatisfiedAltRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { BRAND_ACCENT } from "@/constants/theme";
import { formatDateTimeI18n } from "@/utils/formatDate";

/**
 * SupportChatWidget — "Emily", Dynopay's floating AI support chat.
 * Session 14 parity upgrade (Emergent-style): agent renamed to Emily with an
 * "Active" presence dot, per-message timestamps, emoji picker, and image/PDF
 * attachments (Emily can "see" uploaded screenshots via OpenAI vision).
 *
 * Backend API:
 *   POST support/chat          { session_id, message, attachment_url?, attachment_name?, attachment_type? }
 *                              → { data: { reply, replied_at } }
 *   GET  support/chat/history/:session_id → { data: { messages: [{ role, content, attachment_*, createdAt }] } }
 *   POST support/chat/escalate { session_id, contact_email?, note? }
 *   POST support/chat/upload   multipart "file" → { data: { url, name, type, size } }
 */

const LIME = "#4F46E5";
const INK = "#0A0A0B";
const GREEN = "#22C55E";
const SESSION_KEY = "support_chat_sid";
const MAX_CHARS = 2000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FILES = "image/png,image/jpeg,image/webp,image/gif,application/pdf";

const API_ORIGIN = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const absoluteAttachmentUrl = (url?: string | null): string =>
  url ? (url.startsWith("http") ? url : `${API_ORIGIN}${url}`) : "";

type ChatRole = "user" | "assistant" | "agent";
interface ChatAttachment {
  url: string;
  name: string;
  type: string;
}
interface ChatMsg {
  role: ChatRole;
  content: string;
  at?: string; // ISO timestamp
  attachment?: ChatAttachment | null;
  error?: boolean;
}

const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: "Smileys",
    emojis: ["😀", "😄", "😁", "😅", "😂", "🙂", "😉", "😊", "😍", "🤩", "😎", "🤔", "😐", "😕", "🙁", "😢", "😭", "😤", "😴", "🤯"],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👋", "🙏", "👏", "🙌", "🤝", "💪", "✌️", "🤞", "👌", "🫶", "❤️", "💛", "🔥", "✨", "🎉", "💯", "⭐", "✅"],
  },
  {
    label: "Objects",
    emojis: ["💰", "💳", "🪙", "📈", "📉", "🚀", "🔒", "🔑", "🧾", "📎", "📷", "💡", "⚙️", "🛠️", "📣", "❓", "❗", "⏳", "🌍", "🤖"],
  },
];

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

const formatTime = (iso?: string): string => {
  if (!iso) return "";
  return formatDateTimeI18n(iso, { hour: "2-digit", minute: "2-digit" });
};

interface SupportChatWidgetProps {
  layout?: "home" | "client";
}

const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({ layout = "home" }) => {
  const theme = useTheme();
  const { t } = useTranslation("helpAndSupport");
  const isDark = theme.palette.mode === "dark";

  const GREETING = t("supportChat.greeting", {
    defaultValue:
      "Hi, I'm Emily — your Dynopay support assistant. Ask me anything about fees, supported coins, payment links, wallets or our API. You can also attach a screenshot and I'll take a look. Need a person? Hit the headset icon above to reach human support.",
  });
  // One-tap starter questions shown under the greeting so first-time visitors get
  // value instantly (and are more likely to engage / convert).
  const QUICK_REPLIES = [
    t("supportChat.quickFees", { defaultValue: "How are fees calculated?" }),
    t("supportChat.quickCoins", { defaultValue: "Which coins are supported?" }),
    t("supportChat.quickLinks", { defaultValue: "How do payment links work?" }),
    t("supportChat.quickPayouts", { defaultValue: "How do payouts & settlement work?" }),
  ];
  const emojiGroupLabel = (id: string): string => {
    if (id === "Smileys") return t("supportChat.emojiSmileys", { defaultValue: "Smileys" });
    if (id === "Gestures") return t("supportChat.emojiGestures", { defaultValue: "Gestures" });
    return t("supportChat.emojiObjects", { defaultValue: "Objects" });
  };

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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Session mode: 'human' means a support agent has taken over — the AI is
  // paused and the agent's replies arrive via history polling.
  const [mode, setMode] = useState<"ai" | "human">("ai");

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Allow any part of the app to open the chat programmatically, e.g. the
  // landing page "Chat with us" link in FinalCTA.
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("dynopay:open-support-chat", openChat);
    return () => window.removeEventListener("dynopay:open-support-chat", openChat);
  }, []);

  // S4.2: broadcast the panel's open/closed state so global chrome (the
  // scroll-to-top button) can step aside on mobile and not overlap the panel's
  // send-button row. Decoupled via a body attribute + a window event.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.body.setAttribute("data-dp-support-chat-open", "1");
    } else {
      document.body.removeAttribute("data-dp-support-chat-open");
    }
    window.dispatchEvent(
      new CustomEvent("dynopay:support-chat-toggle", { detail: { open } })
    );
    return () => {
      document.body.removeAttribute("data-dp-support-chat-open");
    };
  }, [open]);

  // Auto-scroll on new messages / typing indicator
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open, escalateOpen, pendingAttachment]);

  // Load full transcript + session mode. Reused for the first open AND for the
  // near-real-time poll so a human agent's replies (and takeover/hand-back)
  // appear in the visitor's widget within a few seconds.
  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await axiosBaseApi.get(`support/chat/history/${sessionId}`);
      const data = res?.data?.data;
      const rows = data?.messages;
      if (data?.mode === "human" || data?.mode === "ai") setMode(data.mode);
      if (Array.isArray(rows) && rows.length > 0) {
        setMessages(
          rows.map(
            (r: {
              role: string;
              content: string;
              createdAt?: string;
              attachment_url?: string | null;
              attachment_name?: string | null;
              attachment_type?: string | null;
            }) => ({
              role: r.role === "assistant" ? "assistant" : r.role === "agent" ? "agent" : "user",
              content: r.content,
              at: r.createdAt,
              attachment: r.attachment_url
                ? { url: r.attachment_url, name: r.attachment_name || "file", type: r.attachment_type || "" }
                : null,
            })
          )
        );
      }
    } catch (_e) {
      // Best-effort — chat still works without history.
    }
  }, [sessionId]);

  // Load history once, on first open.
  useEffect(() => {
    if (!open || historyLoaded || !sessionId) return;
    let cancelled = false;
    (async () => {
      await loadHistory();
      if (!cancelled) setHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [open, historyLoaded, sessionId, loadHistory]);

  // Near-real-time polling while the panel is open so agent replies / takeover
  // show up. Paused while the visitor is mid-send/upload/escalate to avoid a
  // full-list replace clobbering the optimistic message.
  useEffect(() => {
    if (!open || !historyLoaded || !sessionId) return;
    const t = setInterval(() => {
      if (sending || uploading || escalating) return;
      loadHistory();
    }, 3000);
    return () => clearInterval(t);
  }, [open, historyLoaded, sessionId, sending, uploading, escalating, loadHistory]);

  const send = useCallback(async (overrideText?: string) => {
    const text = (typeof overrideText === "string" ? overrideText : input).trim();
    const attachment = typeof overrideText === "string" ? null : pendingAttachment;
    if ((!text && !attachment) || sending || !sessionId || uploading) return;
    if (text.length > MAX_CHARS) return;

    if (typeof overrideText !== "string") setInput("");
    setPendingAttachment(null);
    setEmojiOpen(false);
    setUploadError("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, at: new Date().toISOString(), attachment },
    ]);
    setSending(true);
    try {
      const res = await axiosBaseApi.post("support/chat", {
        session_id: sessionId,
        message: text,
        attachment_url: attachment?.url || undefined,
        attachment_name: attachment?.name || undefined,
        attachment_type: attachment?.type || undefined,
      });
      const respMode = res?.data?.data?.mode;
      const reply = res?.data?.data?.reply;
      const repliedAt = res?.data?.data?.replied_at || new Date().toISOString();
      if (respMode === "human" || respMode === "ai") setMode(respMode);
      // When a human agent has taken over, the API stores the visitor's message
      // but returns no AI reply — the agent's response arrives via polling, so
      // don't render an "error" bubble here.
      if (respMode === "human" || reply === null) {
        // no-op; agent reply will stream in through loadHistory()
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply || t("supportChat.replyError", { defaultValue: "Sorry — I could not generate a reply. Please try again." }),
            at: repliedAt,
            error: !reply,
          },
        ]);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const friendly =
        status === 429
          ? t("supportChat.rateLimit", { defaultValue: "You're sending messages a little fast — please wait a moment and try again." })
          : t("supportChat.sendError", { defaultValue: "Sorry, something went wrong reaching support. Please try again in a moment." });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: friendly, at: new Date().toISOString(), error: true },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, sessionId, pendingAttachment, uploading, t]);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // allow re-selecting the same file later
    e.target.value = "";
    if (!file) return;
    setUploadError("");
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(t("supportChat.fileTooLarge", { defaultValue: "File too large (max 5MB)." }));
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axiosBaseApi.post("support/chat/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res?.data?.data;
      if (data?.url) {
        setPendingAttachment({ url: data.url, name: data.name || file.name, type: data.type || file.type });
      } else {
        setUploadError(t("supportChat.uploadFailed", { defaultValue: "Upload failed. Please try again." }));
      }
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadError(apiMsg || t("supportChat.uploadFailed", { defaultValue: "Upload failed. Please try again." }));
    } finally {
      setUploading(false);
    }
  }, [t]);

  const insertEmoji = useCallback((emoji: string) => {
    const el = inputRef.current;
    setInput((prev) => {
      if (el && typeof el.selectionStart === "number") {
        const start = el.selectionStart;
        const end = el.selectionEnd ?? start;
        const next = prev.slice(0, start) + emoji + prev.slice(end);
        // restore caret after the inserted emoji on next tick
        setTimeout(() => {
          try {
            el.focus();
            const pos = start + emoji.length;
            el.setSelectionRange(pos, pos);
          } catch (_e) { /* noop */ }
        }, 0);
        return next.length <= MAX_CHARS ? next : prev;
      }
      const appended = prev + emoji;
      return appended.length <= MAX_CHARS ? appended : prev;
    });
  }, []);

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
            t("supportChat.escalated", { defaultValue: "Done — your conversation has been forwarded to our support team. A human will get back to you by email as soon as possible." }),
          at: new Date().toISOString(),
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
              : t("supportChat.escalateError", { defaultValue: "Sorry, the escalation could not be sent right now. Please try again shortly." }),
          at: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setEscalating(false);
    }
  }, [escalating, sessionId, escalateEmail, escalateNote, t]);

  const resetConversation = useCallback(() => {
    const fresh = makeSessionId();
    try { localStorage.setItem(SESSION_KEY, fresh); } catch (_e) { /* noop */ }
    setSessionId(fresh);
    setMessages([]);
    setMode("ai");
    setHistoryLoaded(true); // fresh session — nothing to load
    setEscalateOpen(false);
    setEmojiOpen(false);
    setPendingAttachment(null);
    setUploadError("");
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
  const userBubbleBg = isDark ? "#6366F1" : BRAND_ACCENT;
  const userBubbleColor = "#FFFFFF";
  // Keep clear of the in-app floating mobile nav pill.
  // F1: On mobile in the client shell, lift the FAB further so it no longer
  // occludes the last ~20px of "Create Company" / "View all" / row action
  // regions. Sits above the bottom tab bar with breathing room.
  // F2 (iter_83): ALSO lift the FAB above the bottom language-onboarding bar
  // (--dp-lang-bar, ~76px, zIndex 1500) so its lower half is never trapped
  // behind the bar — otherwise real clicks land on the bar, not the FAB.
  const LANG_BAR = "var(--dp-lang-bar, 0px)";
  // Phone-only sticky CTAs (checkout pay bar, creator/donation Support bar)
  // publish --dp-sticky-cta; lift the FAB above them too.
  const STICKY_CTA = "var(--dp-sticky-cta, 0px)";
  const fabBaseXs = layout === "client" ? 108 : 24;
  const fabBaseMd = 24;
  const fabBottom = {
    xs: `calc(${LANG_BAR} + ${STICKY_CTA} + ${fabBaseXs}px)`,
    md: `calc(${LANG_BAR} + ${fabBaseMd}px)`,
  };

  // F1: Hide the floating FAB while any blocking MUI Dialog / Modal is open
  // (onboarding wizard, promo, delete confirms, etc.). We watch for the
  // MUI backdrop element in the DOM; body also gets `overflow: hidden` when
  // a Dialog opens which makes this a reliable signal. Also allow explicit
  // suppression via a `data-dyno-suppress-chat="1"` attribute on <body>.
  const [suppressed, setSuppressed] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      try {
        const body = document.body;
        const explicit = body?.getAttribute("data-dyno-suppress-chat") === "1";
        const hasDialog = !!document.querySelector(
          '.MuiDialog-root:not([aria-hidden="true"]), .MuiModal-root:not([aria-hidden="true"])'
        );
        setSuppressed(explicit || hasDialog);
      } catch {
        setSuppressed(false);
      }
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-hidden", "data-dyno-suppress-chat"] });
    return () => obs.disconnect();
  }, []);

  // F1: A fixed bottom-right launcher inevitably overlaps bottom-right page
  // content at some scroll offsets (e.g. the Recent Transactions "View all"
  // link on the mobile dashboard, Settings save buttons). Rather than occlude
  // a tappable control, we detect on small screens whether an interactive
  // element sits directly beneath the FAB and, if so, smoothly slide the FAB
  // off-screen until the area is clear again.
  //
  // Session 74 upgrade:
  //   - sample 9 points (3×3 grid) across the FAB square instead of 3
  //     verticals — catches wider CTAs that only overlap the left/right edges
  //   - keep FAB in the DOM at all times but translate it off-screen with a
  //     220ms CSS transition, so the launcher "tucks" instead of hard-hiding
  //   - debounce the return-to-visible transition by 120ms so a fast scroll
  //     over a button doesn't cause a jitter of appear/disappear
  //   - also treat elements with `data-dyno-anchor="cta"` as blocking
  //     (opt-in for Save / Continue / Update buttons that live near the FAB)
  const [occluding, setOccluding] = useState(false);
  const occludingRef = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const FAB_SIZE = 56;
    const rightPx = 16;
    let raf = 0;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    // S1.2 (iter_83): on mobile the FAB tucks off-screen when an interactive
    // element sits beneath it — but if that state persists AT REST the user has
    // no way to open support chat. So on mobile we only tuck WHILE actively
    // scrolling and always reveal the FAB once scrolling stops.
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let isScrolling = false;

    const insideChat = (node: Element | null): boolean => {
      let el: Element | null = node;
      while (el) {
        const tid = el.getAttribute?.("data-testid");
        if (tid === "support-chat-button" || tid === "support-chat-panel") return true;
        el = el.parentElement;
      }
      return false;
    };
    const isInteractive = (node: Element | null): boolean => {
      let el: Element | null = node;
      let hops = 0;
      while (el && hops < 6) {
        const tag = el.tagName;
        if (tag === "A" && (el as HTMLAnchorElement).getAttribute("href")) return true;
        if (tag === "BUTTON" && !(el as HTMLButtonElement).disabled) return true;
        const role = el.getAttribute?.("role");
        if (role === "button" || role === "link" || role === "tab") return true;
        // Opt-in blocking: any element with data-dyno-anchor="cta" (Save,
        // Continue, Update, Publish buttons that must never be overlapped).
        if (el.getAttribute?.("data-dyno-anchor") === "cta") return true;
        el = el.parentElement;
        hops++;
      }
      return false;
    };
    // Desktop-only blocking is restricted to opt-in CTAs so the FAB doesn't
    // over-tuck on the many pages with bottom-right buttons.
    const isCta = (node: Element | null): boolean => {
      let el: Element | null = node;
      let hops = 0;
      while (el && hops < 6) {
        if (el.getAttribute?.("data-dyno-anchor") === "cta") return true;
        el = el.parentElement;
        hops++;
      }
      return false;
    };

    const applyOcclusion = (next: boolean) => {
      if (next === occludingRef.current) return;
      if (next === true) {
        // Hide immediately (avoid tapping through)
        if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
        occludingRef.current = true;
        setOccluding(true);
      } else {
        // Return-to-visible: debounce 120ms so we don't flicker while a
        // fast-scrolling button crosses the FAB region.
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
          clearTimer = null;
          occludingRef.current = false;
          setOccluding(false);
        }, 120);
      }
    };

    const check = () => {
      raf = 0;
      try {
        if (open) {
          applyOcclusion(false);
          return;
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const desktop = vw > 900;
        // Mobile: never tuck the FAB away while at rest — otherwise a bottom
        // interactive element hides the chat launcher with no way back.
        if (!desktop && !isScrolling) {
          applyOcclusion(false);
          return;
        }
        // Also lift the probe rect above the language-onboarding bar so the
        // occlusion check samples where the FAB actually is.
        const langBarPx = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--dp-lang-bar")
        ) || 0;
        const stickyCtaPx = desktop ? 0 : (parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--dp-sticky-cta")
        ) || 0);
        const bottomPx = ((!desktop && layout === "client") ? 108 : 24) + langBarPx + stickyCtaPx;
        // FAB square bounding box in viewport
        const leftEdge = vw - rightPx - FAB_SIZE;
        const rightEdge = vw - rightPx;
        const topEdge = vh - bottomPx - FAB_SIZE;
        const bottomEdge = vh - bottomPx;
        // 3×3 sample grid — corners + edges + center. Padded 6px inward so
        // we don't pick up border pixels of adjacent tiles that happen to
        // touch the FAB circle without being tappable.
        const inset = 6;
        const xs = [leftEdge + inset, (leftEdge + rightEdge) / 2, rightEdge - inset];
        const ys = [topEdge + inset, (topEdge + bottomEdge) / 2, bottomEdge - inset];
        let hit = false;
        outer: for (const y of ys) {
          for (const x of xs) {
            const stack = document.elementsFromPoint(x, y);
            for (const node of stack) {
              if (insideChat(node)) continue;
              const blocks = desktop ? isCta(node) : isInteractive(node);
              if (blocks) { hit = true; break outer; }
              break; // first non-chat element = what's beneath; stop probing stack
            }
          }
        }
        applyOcclusion(hit);
      } catch {
        applyOcclusion(false);
      }
    };
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(check);
    };
    // Track active scrolling so the mobile reveal-at-rest logic above works.
    const onScroll = () => {
      isScrolling = true;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isScrolling = false;
        schedule(); // re-check → mobile FAB comes back once scrolling stops
      }, 900);
      schedule();
    };
    schedule();
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true } as any);
      window.removeEventListener("resize", schedule);
      obs.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
      if (clearTimer) clearTimeout(clearTimer);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [open, layout]);

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
    [messages, GREETING]
  );

  const composerIconSx = {
    width: 34,
    height: 34,
    borderRadius: "9px",
    color: theme.palette.text.secondary,
    flexShrink: 0,
    "&:hover": { background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" },
  } as const;

  return (
    <>
      {/* ── Floating panel ── */}
      {open && !suppressed && (
        <Box
          data-testid="support-chat-panel"
          sx={{
            position: "fixed",
            bottom: {
              xs: `calc(${LANG_BAR} + ${fabBaseXs}px + 68px)`,
              md: `calc(${LANG_BAR} + ${fabBaseMd}px + 68px)`,
            },
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
            <Box sx={{ position: "relative", flexShrink: 0 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: BRAND_ACCENT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}>
                  E
                </Typography>
              </Box>
              {/* presence dot */}
              <Box
                sx={{
                  position: "absolute",
                  right: -1,
                  bottom: -1,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: GREEN,
                  border: `2px solid ${INK}`,
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography data-testid="support-chat-agent-name" sx={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.2 }}>
                Emily
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "rgba(255,255,255,0.65)", display: "flex", alignItems: "center", gap: 0.6 }}>
                <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: GREEN, display: "inline-block" }} />
                {t("supportChat.active", { defaultValue: "Active" })}
              </Typography>
            </Box>
            <Tooltip title={t("supportChat.talkToHuman", { defaultValue: "Talk to a human" })}>
              <IconButton
                size="small"
                data-testid="support-chat-escalate"
                onClick={() => setEscalateOpen((v) => !v)}
                sx={{ color: escalateOpen ? "#818CF8" : "rgba(255,255,255,0.75)" }}
                aria-label={t("supportChat.talkToHuman", { defaultValue: "Talk to a human" })}
              >
                <SupportAgentRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("supportChat.newConversation", { defaultValue: "New conversation" })}>
              <IconButton size="small" onClick={resetConversation} sx={{ color: "rgba(255,255,255,0.75)" }} aria-label={t("supportChat.newConversation", { defaultValue: "New conversation" })}>
                <RestartAltRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "rgba(255,255,255,0.75)" }} aria-label={t("supportChat.closeChat", { defaultValue: "Close chat" })}>
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Human-agent banner — a support agent has taken over from the AI. */}
          {mode === "human" && (
            <Box
              data-testid="support-chat-human-banner"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.75,
                py: 1,
                background: isDark ? "rgba(46,160,67,0.14)" : "rgba(46,160,67,0.10)",
                borderBottom: `1px solid ${theme.palette.success.main}40`,
              }}
            >
              <SupportAgentRoundedIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.primary }}>
                {t("supportChat.humanBanner", {
                  defaultValue: "You're now chatting with a human support agent.",
                })}
              </Typography>
            </Box>
          )}

          {/* Messages */}
          <Box
            ref={listRef}
            sx={{ flex: 1, overflowY: "auto", px: 1.75, py: 1.75, display: "flex", flexDirection: "column", gap: 1.1 }}
          >
            {visibleMessages.map((m, i) => {
              const isUser = m.role === "user";
              const isAgent = m.role === "agent";
              const time = formatTime(m.at);
              const isImageAttachment = !!m.attachment && m.attachment.type.startsWith("image/");
              return (
                <Box key={i} sx={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "84%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
                  {isAgent && (
                    <Typography
                      sx={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: theme.palette.success.main,
                        mb: 0.3,
                        px: 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.4,
                      }}
                    >
                      <SupportAgentRoundedIcon sx={{ fontSize: 13 }} />
                      {t("supportChat.agentLabel", { defaultValue: "Support agent" })}
                    </Typography>
                  )}
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: isUser ? userBubbleBg : assistantBubbleBg,
                      border: m.error
                        ? `1px solid ${isDark ? "rgba(255,120,120,0.5)" : "rgba(200,40,40,0.35)"}`
                        : isAgent
                          ? `1px solid ${theme.palette.success.main}66`
                          : "none",
                    }}
                  >
                    {m.attachment && (
                      <Box sx={{ mb: m.content ? 0.75 : 0 }}>
                        {isImageAttachment ? (
                          <Box
                            component="a"
                            href={absoluteAttachmentUrl(m.attachment.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: "block", lineHeight: 0 }}
                          >
                            <Box
                              component="img"
                              src={absoluteAttachmentUrl(m.attachment.url)}
                              alt={m.attachment.name}
                              sx={{ maxWidth: 200, maxHeight: 160, borderRadius: "10px", display: "block", objectFit: "cover" }}
                            />
                          </Box>
                        ) : (
                          <Box
                            component="a"
                            href={absoluteAttachmentUrl(m.attachment.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.75,
                              px: 1,
                              py: 0.6,
                              borderRadius: "8px",
                              background: isUser ? "rgba(255,255,255,0.14)" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                              textDecoration: "none",
                            }}
                          >
                            <InsertDriveFileRoundedIcon sx={{ fontSize: 16, color: isUser ? userBubbleColor : theme.palette.text.secondary }} />
                            <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: isUser ? userBubbleColor : theme.palette.text.primary, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.attachment.name}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                    {m.content && (
                      <Typography
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 14,
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          color: isUser ? userBubbleColor : theme.palette.text.primary,
                        }}
                      >
                        {m.content}
                      </Typography>
                    )}
                  </Box>
                  {time && (
                    <Typography
                      data-testid="support-chat-timestamp"
                      sx={{ fontFamily: "var(--font-sans)", fontSize: 10.5, color: theme.palette.text.disabled, mt: 0.35, px: 0.5 }}
                    >
                      {time}
                    </Typography>
                  )}
                </Box>
              );
            })}

            {/* One-tap starter questions — only while the greeting is the sole message */}
            {messages.length === 0 && !escalateOpen && (
              <Box
                data-testid="support-chat-quick-replies"
                sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignSelf: "flex-start", mt: 0.25 }}
              >
                {QUICK_REPLIES.map((q) => (
                  <Box
                    key={q}
                    component="button"
                    type="button"
                    data-testid={`support-chat-quick-reply-${q.slice(0, 12).replace(/[^a-z]/gi, "-").toLowerCase()}`}
                    onClick={() => void send(q)}
                    disabled={sending || !sessionId}
                    sx={{
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: theme.palette.text.primary,
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                      border: `1px solid ${panelBorder}`,
                      borderRadius: "999px",
                      px: 1.4,
                      py: 0.7,
                      transition: "background-color 0.15s ease, border-color 0.15s ease",
                      "&:hover": { background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderColor: theme.palette.text.disabled },
                      "&:disabled": { opacity: 0.5, cursor: "default" },
                    }}
                  >
                    {q}
                  </Box>
                ))}
              </Box>
            )}

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
                  {t("supportChat.talkToHuman", { defaultValue: "Talk to a human" })}
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: theme.palette.text.secondary }}>
                  {t("supportChat.escalateIntro", { defaultValue: "We'll email this conversation to our support team and reply to you by email." })}
                </Typography>
                <InputBase
                  data-testid="support-chat-escalate-email"
                  placeholder={t("supportChat.emailPlaceholder", { defaultValue: "Your email (optional if signed in)" })}
                  value={escalateEmail}
                  onChange={(e) => setEscalateEmail(e.target.value)}
                  sx={inputSx}
                  inputProps={{ maxLength: 120, "aria-label": t("supportChat.contactEmailAria", { defaultValue: "Contact email" }) }}
                />
                <InputBase
                  placeholder={t("supportChat.notePlaceholder", { defaultValue: "Anything to add? (optional)" })}
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  multiline
                  maxRows={3}
                  sx={inputSx}
                  inputProps={{ maxLength: 1000, "aria-label": t("supportChat.noteAria", { defaultValue: "Note for support" }) }}
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
                    background: BRAND_ACCENT,
                    color: "#FFFFFF",
                    opacity: escalating ? 0.6 : 1,
                  }}
                >
                  {escalating ? t("supportChat.sending", { defaultValue: "Sending…" }) : t("supportChat.sendToTeam", { defaultValue: "Send to support team" })}
                </Box>
              </Box>
            )}
          </Box>

          {/* Emoji picker */}
          {emojiOpen && (
            <Box
              data-testid="support-chat-emoji-picker"
              sx={{
                borderTop: `1px solid ${panelBorder}`,
                px: 1.5,
                py: 1,
                maxHeight: 168,
                overflowY: "auto",
                background: isDark ? "rgba(255,255,255,0.02)" : "#FCFCFD",
                flexShrink: 0,
              }}
            >
              {EMOJI_GROUPS.map((group) => (
                <Box key={group.label} sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 10.5, fontWeight: 600, color: theme.palette.text.disabled, textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.25 }}>
                    {emojiGroupLabel(group.label)}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                    {group.emojis.map((emoji) => (
                      <Box
                        key={emoji}
                        component="button"
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        aria-label={`Insert ${emoji}`}
                        sx={{
                          border: "none",
                          background: "transparent",
                          fontSize: 19,
                          lineHeight: 1,
                          p: "5px",
                          borderRadius: "7px",
                          cursor: "pointer",
                          "&:hover": { background: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)" },
                        }}
                      >
                        {emoji}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Pending attachment / upload state */}
          {(pendingAttachment || uploading || uploadError) && (
            <Box sx={{ px: 1.5, pt: 1, display: "flex", alignItems: "center", gap: 1, borderTop: `1px solid ${panelBorder}`, flexShrink: 0 }}>
              {uploading && (
                <>
                  <CircularProgress size={16} sx={{ color: theme.palette.text.secondary }} />
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.secondary }}>
                    {t("supportChat.uploading", { defaultValue: "Uploading…" })}
                  </Typography>
                </>
              )}
              {!uploading && pendingAttachment && (
                <Box
                  data-testid="support-chat-pending-attachment"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1,
                    py: 0.5,
                    borderRadius: "9px",
                    border: `1px solid ${panelBorder}`,
                    background: isDark ? "rgba(255,255,255,0.05)" : "#F7F7F8",
                    maxWidth: "100%",
                  }}
                >
                  {pendingAttachment.type.startsWith("image/") ? (
                    <Box
                      component="img"
                      src={absoluteAttachmentUrl(pendingAttachment.url)}
                      alt={pendingAttachment.name}
                      sx={{ width: 28, height: 28, borderRadius: "6px", objectFit: "cover" }}
                    />
                  ) : (
                    <InsertDriveFileRoundedIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                  )}
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: theme.palette.text.primary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pendingAttachment.name}
                  </Typography>
                  <IconButton size="small" onClick={() => setPendingAttachment(null)} aria-label={t("supportChat.removeAttachment", { defaultValue: "Remove attachment" })} sx={{ p: 0.25 }}>
                    <CloseRoundedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>
              )}
              {!uploading && !pendingAttachment && uploadError && (
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: isDark ? "#FF8A8A" : "#C22828" }}>
                  {uploadError}
                </Typography>
              )}
            </Box>
          )}

          {/* Input */}
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, px: 1.5, py: 1.25, borderTop: (pendingAttachment || uploading || uploadError) ? "none" : `1px solid ${panelBorder}`, flexShrink: 0 }}>
            <Tooltip title={t("supportChat.emoji", { defaultValue: "Emoji" })}>
              <IconButton
                data-testid="support-chat-emoji"
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label={t("supportChat.insertEmoji", { defaultValue: "Insert emoji" })}
                sx={{ ...composerIconSx, color: emojiOpen ? (isDark ? "#818CF8" : BRAND_ACCENT) : theme.palette.text.secondary }}
              >
                <SentimentSatisfiedAltRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("supportChat.attachTooltip", { defaultValue: "Attach image or PDF (max 5MB)" })}>
              <span>
                <IconButton
                  data-testid="support-chat-attach"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label={t("supportChat.attachFile", { defaultValue: "Attach a file" })}
                  sx={composerIconSx}
                >
                  <AttachFileRoundedIcon sx={{ fontSize: 19 }} />
                </IconButton>
              </span>
            </Tooltip>
            <input
              ref={fileInputRef}
              data-testid="support-chat-file-input"
              type="file"
              accept={ACCEPTED_FILES}
              onChange={(e) => void handleFileSelected(e)}
              style={{ display: "none" }}
              aria-hidden="true"
            />
            <InputBase
              data-testid="support-chat-input"
              inputRef={inputRef}
              placeholder={t("supportChat.inputPlaceholder", { defaultValue: "Ask about fees, coins, API…" })}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              multiline
              maxRows={4}
              sx={{ ...inputSx, flex: 1 }}
              inputProps={{ maxLength: MAX_CHARS, "aria-label": t("supportChat.messageAria", { defaultValue: "Message" }) }}
            />
            <IconButton
              data-testid="support-chat-send"
              onClick={() => void send()}
              disabled={sending || uploading || (input.trim().length === 0 && !pendingAttachment)}
              aria-label={t("supportChat.sendMessage", { defaultValue: "Send message" })}
              sx={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                background: BRAND_ACCENT,
                color: "#FFFFFF",
                flexShrink: 0,
                "&:hover": { background: "#4338CA" },
                "&.Mui-disabled": { background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)", color: theme.palette.text.disabled },
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* ── Floating launcher button ──
          Session 74 P1-5: instead of removing the FAB from DOM when
          occluding a CTA (jarring pop), we keep it mounted and translate it
          off-screen with a 220ms transition. Result: FAB smoothly "tucks"
          away as the user scrolls a Save/CTA button under it, and slides
          back in once the button leaves the FAB region. */}
      {!suppressed && (
      <Tooltip title={open ? t("supportChat.closeSupportChat", { defaultValue: "Close support chat" }) : t("supportChat.chatWithSupport", { defaultValue: "Chat with support" })}>
        <IconButton
          data-testid="support-chat-button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? t("supportChat.closeSupportChat", { defaultValue: "Close support chat" }) : t("supportChat.openSupportChat", { defaultValue: "Open support chat" })}
          aria-hidden={occluding ? "true" : "false"}
          tabIndex={occluding ? -1 : 0}
          sx={{
            position: "fixed",
            bottom: fabBottom,
            right: { xs: 16, md: 24 },
            zIndex: 1501,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: BRAND_ACCENT,
            color: "#FFFFFF",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
            // Smooth slide-out tuck when overlapping a CTA. transform is
            // GPU-accelerated so the animation stays 60fps on scroll.
            transform: occluding ? "translateX(96px) scale(0.9)" : "translateX(0) scale(1)",
            opacity: occluding ? 0 : 1,
            pointerEvents: occluding ? "none" : "auto",
            transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease, background 0.2s ease",
            "&:hover": { background: "#4338CA", transform: occluding ? "translateX(96px) scale(0.9)" : "translateY(-2px)" },
          }}
        >
          {open ? <CloseRoundedIcon sx={{ fontSize: 26 }} /> : <ChatRoundedIcon sx={{ fontSize: 26 }} />}
        </IconButton>
      </Tooltip>
      )}
    </>
  );
};

export default SupportChatWidget;
