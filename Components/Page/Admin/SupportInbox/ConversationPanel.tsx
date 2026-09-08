import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  SendRounded,
  SupportAgentRounded,
  SmartToyRounded,
  EmailRounded,
  CheckCircleRounded,
  ReplayRounded,
  LockOpenRounded,
} from "@mui/icons-material";
import { CANNED_REPLIES } from "./cannedReplies";
import { relTime } from "./SessionList";

export interface SessionMeta {
  session_id: string;
  mode: string;
  status: string;
  contact_email: string | null;
  escalated?: boolean;
}
export interface SupportMessage {
  message_id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  createdAt: string;
}

interface Props {
  detail: { session: SessionMeta; messages: SupportMessage[] } | null;
  loading: boolean;
  sending: boolean;
  onReply: (message: string) => Promise<void>;
  onTakeover: () => Promise<void>;
  onHandback: () => Promise<void>;
  onClose: () => Promise<void>;
  onReopen: () => Promise<void>;
  onEmail: (subject: string, message: string, to?: string) => Promise<boolean>;
}

const ConversationPanel: React.FC<Props> = ({
  detail,
  loading,
  sending,
  onReply,
  onTakeover,
  onHandback,
  onClose,
  onReopen,
  onEmail,
}) => {
  const theme = useTheme();
  const [draft, setDraft] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("Re: your Dynopay support request");
  const [emailBody, setEmailBody] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const session = detail?.session;
  const messages = detail?.messages || [];

  useEffect(() => {
    // Auto-scroll to newest message.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, detail?.session?.session_id]);

  useEffect(() => {
    setDraft("");
  }, [detail?.session?.session_id]);

  if (!session) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          gap: 1,
        }}
      >
        <SupportAgentRounded sx={{ fontSize: 44, opacity: 0.4 }} />
        <Typography sx={{ fontSize: 14 }}>Select a conversation to view it here.</Typography>
      </Box>
    );
  }

  const isHuman = session.mode === "human";
  const isClosed = session.status === "closed";

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    await onReply(text);
    setDraft("");
  };

  const handleSendEmail = async () => {
    if (!emailBody.trim() || emailSending) return;
    setEmailSending(true);
    const ok = await onEmail(emailSubject.trim(), emailBody.trim(), emailTo.trim() || undefined);
    setEmailSending(false);
    if (ok) {
      setEmailOpen(false);
      setEmailBody("");
    }
  };

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }} noWrap>
            {session.contact_email || `Visitor · ${session.session_id.slice(0, 12)}`}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
            <Chip
              size="small"
              icon={isHuman ? <SupportAgentRounded /> : <SmartToyRounded />}
              label={isHuman ? "Human agent" : "AI (Emily)"}
              color={isHuman ? "success" : "primary"}
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
            {session.escalated && (
              <Chip size="small" label="Escalated" color="warning" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
            )}
            {isClosed && (
              <Chip size="small" label="Closed" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
            )}
          </Box>
        </Box>

        {isHuman ? (
          <Tooltip title="Hand the conversation back to the AI assistant">
            <span>
              <Button size="small" variant="outlined" color="primary" startIcon={<ReplayRounded />} onClick={onHandback} data-testid="support-handback">
                Return to AI
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Tooltip title="Pause the AI and take over this chat">
            <span>
              <Button size="small" variant="contained" color="success" startIcon={<LockOpenRounded />} onClick={onTakeover} data-testid="support-takeover">
                Take over
              </Button>
            </span>
          </Tooltip>
        )}
        <Button size="small" variant="outlined" startIcon={<EmailRounded />} onClick={() => { setEmailTo(session.contact_email || ""); setEmailOpen(true); }} data-testid="support-email-open">
          Email
        </Button>
        {isClosed ? (
          <Button size="small" variant="text" onClick={onReopen} data-testid="support-reopen">Reopen</Button>
        ) : (
          <Button size="small" variant="text" color="inherit" startIcon={<CheckCircleRounded />} onClick={onClose} data-testid="support-close">Close</Button>
        )}
      </Box>

      {/* Messages */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", minHeight: 0, p: 2, backgroundColor: theme.palette.action.hover }}>
        {loading && messages.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        )}
        {messages.map((m) => {
          const mine = m.role === "agent";
          const ai = m.role === "assistant";
          const align = m.role === "user" ? "flex-start" : "flex-end";
          const bg = m.role === "user"
            ? theme.palette.background.paper
            : ai
              ? theme.palette.primary.main
              : theme.palette.success.main;
          const color = m.role === "user" ? theme.palette.text.primary : "#fff";
          const label = m.role === "user" ? "Visitor" : ai ? "Emily (AI)" : "You (agent)";
          return (
            <Box key={m.message_id} sx={{ display: "flex", flexDirection: "column", alignItems: align, mb: 1.25 }}>
              <Typography sx={{ fontSize: 10.5, color: "text.secondary", mb: 0.25, px: 0.5 }}>
                {label} · {relTime(m.createdAt)}
              </Typography>
              <Box
                sx={{
                  maxWidth: "78%",
                  px: 1.5,
                  py: 1,
                  borderRadius: "12px",
                  backgroundColor: bg,
                  color,
                  border: m.role === "user" ? `1px solid ${theme.palette.divider}` : "none",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                }}
              >
                {m.content}
                {m.attachment_url && (
                  <Box sx={{ mt: 0.5 }}>
                    <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ color: m.role === "user" ? theme.palette.primary.main : "#fff", fontSize: 12 }}>
                      {m.attachment_name || "attachment"}
                    </a>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Canned replies */}
      <Box sx={{ px: 1.5, pt: 1, display: "flex", gap: 0.75, overflowX: "auto", borderTop: `1px solid ${theme.palette.divider}` }}>
        {CANNED_REPLIES.map((c) => (
          <Chip
            key={c.id}
            size="small"
            label={c.label}
            variant="outlined"
            onClick={() => setDraft((d) => (d ? d + "\n\n" + c.text : c.text))}
            data-testid={`canned-${c.id}`}
            sx={{ flexShrink: 0 }}
          />
        ))}
      </Box>

      {/* Composer */}
      <Box sx={{ p: 1.5, display: "flex", gap: 1, alignItems: "flex-end" }}>
        <TextField
          fullWidth
          multiline
          maxRows={5}
          size="small"
          placeholder={isHuman ? "Reply as a human agent…" : "Reply as agent (this takes over from the AI)…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          data-testid="support-reply-input"
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          endIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendRounded />}
          data-testid="support-reply-send"
          sx={{ minWidth: 96, height: 40 }}
        >
          Send
        </Button>
      </Box>

      {/* Email dialog */}
      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>Email the visitor</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
          <TextField
            label="To"
            size="small"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="customer@email.com"
            helperText={session.contact_email ? "" : "No contact email on file — enter one to send."}
            data-testid="support-email-to"
          />
          <TextField
            label="Subject"
            size="small"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
          />
          <TextField
            label="Message"
            multiline
            minRows={5}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            data-testid="support-email-body"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSendEmail}
            disabled={!emailBody.trim() || emailSending}
            endIcon={emailSending ? <CircularProgress size={16} color="inherit" /> : <EmailRounded />}
            data-testid="support-email-send"
          >
            Send email
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConversationPanel;
