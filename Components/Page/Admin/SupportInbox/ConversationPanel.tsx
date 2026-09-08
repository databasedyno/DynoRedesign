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
  ContentCopyRounded,
  CheckRounded,
  CloseRounded,
  BookmarkAddRounded,
} from "@mui/icons-material";
import { CANNED_REPLIES } from "./cannedReplies";
import {
  EmailTemplate,
  loadEmailTemplates,
  saveEmailTemplate,
  deleteEmailTemplate,
} from "./emailTemplates";
import { relTime } from "./SessionList";

export interface SessionMeta {
  session_id: string;
  mode: string;
  status: string;
  contact_email: string | null;
  resolved_email?: string | null;
  user_name?: string | null;
  user_id?: number | null;
  email_source?: string;
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
  const [copied, setCopied] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const session = detail?.session;
  const messages = detail?.messages || [];
  const contactEmail = session?.resolved_email || session?.contact_email || "";

  const copyEmail = async () => {
    if (!contactEmail) return;
    try {
      await navigator.clipboard.writeText(contactEmail);
    } catch {
      // Fallback for older / non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = contactEmail;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  useEffect(() => {
    // Auto-scroll to newest message.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, detail?.session?.session_id]);

  useEffect(() => {
    setDraft("");
  }, [detail?.session?.session_id]);

  useEffect(() => {
    if (emailOpen) setTemplates(loadEmailTemplates());
  }, [emailOpen]);

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

  const openEmailDialog = () => {
    setEmailTo(contactEmail);
    setSavingTemplate(false);
    setTemplateName("");
    setEmailOpen(true);
  };

  const applyTemplate = (t: EmailTemplate) => {
    if (t.subject) setEmailSubject(t.subject);
    setEmailBody(t.body);
  };

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name || !emailBody.trim()) return;
    setTemplates(saveEmailTemplate({ label: name, subject: emailSubject.trim(), body: emailBody }));
    setSavingTemplate(false);
    setTemplateName("");
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(deleteEmailTemplate(id));
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "text.primary" }} noWrap data-testid="support-contact">
              {contactEmail || `Visitor · ${session.session_id.slice(0, 12)}`}
            </Typography>
            {contactEmail && (
              <Tooltip title={copied ? "Copied!" : "Copy email"}>
                <IconButton
                  size="small"
                  onClick={copyEmail}
                  data-testid="support-copy-email"
                  sx={{ p: 0.25, color: copied ? "success.main" : "text.secondary" }}
                >
                  {copied ? <CheckRounded sx={{ fontSize: 16 }} /> : <ContentCopyRounded sx={{ fontSize: 15 }} />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25, flexWrap: "wrap" }}>
            <Chip
              size="small"
              icon={isHuman ? <SupportAgentRounded /> : <SmartToyRounded />}
              label={isHuman ? "Human agent" : "AI (Emily)"}
              color={isHuman ? "success" : "primary"}
              variant="outlined"
              sx={{ height: 22, fontSize: 11 }}
            />
            {session.email_source === "account" && (
              <Chip
                size="small"
                label={session.user_name ? `Signed in · ${session.user_name}` : "Signed-in account"}
                color="info"
                variant="outlined"
                sx={{ height: 22, fontSize: 11 }}
                data-testid="support-email-source-account"
              />
            )}
            {session.email_source === "chat" && (
              <Chip
                size="small"
                label="Email from chat"
                variant="outlined"
                sx={{ height: 22, fontSize: 11 }}
                data-testid="support-email-source-chat"
              />
            )}
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
        <Button size="small" variant="outlined" startIcon={<EmailRounded />} onClick={openEmailDialog} data-testid="support-email-open">
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
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 2.5 }}>
          <TextField
            label="To"
            size="small"
            fullWidth
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="customer@email.com"
            helperText={contactEmail ? "" : "No contact email on file — enter one to send."}
            data-testid="support-email-to"
          />
          <TextField
            label="Subject"
            size="small"
            fullWidth
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
          />

          {/* Reply templates */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "text.secondary" }}>
                Templates
              </Typography>
              {!savingTemplate && (
                <Button
                  size="small"
                  startIcon={<BookmarkAddRounded sx={{ fontSize: 16 }} />}
                  onClick={() => setSavingTemplate(true)}
                  disabled={!emailBody.trim()}
                  data-testid="support-email-template-save-open"
                  sx={{ fontSize: 11 }}
                >
                  Save current
                </Button>
              )}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {templates.map((t) => (
                <Chip
                  key={t.id}
                  size="small"
                  label={t.label}
                  variant="outlined"
                  onClick={() => applyTemplate(t)}
                  onDelete={t.builtin ? undefined : () => handleDeleteTemplate(t.id)}
                  deleteIcon={<CloseRounded sx={{ fontSize: 14 }} />}
                  data-testid={`support-email-template-${t.id}`}
                />
              ))}
            </Box>
            {savingTemplate && (
              <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center" }}>
                <TextField
                  size="small"
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveTemplate();
                    }
                  }}
                  autoFocus
                  sx={{ flex: 1 }}
                  data-testid="support-email-template-name"
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || !emailBody.trim()}
                  data-testid="support-email-template-save"
                >
                  Save
                </Button>
                <Button size="small" onClick={() => { setSavingTemplate(false); setTemplateName(""); }}>
                  Cancel
                </Button>
              </Box>
            )}
          </Box>

          <TextField
            label="Message"
            multiline
            fullWidth
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
