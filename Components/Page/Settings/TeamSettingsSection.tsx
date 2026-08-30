import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  GroupAddRounded,
  PersonAddAlt1Rounded,
  EditRounded,
  DeleteOutlineRounded,
  ContentCopyRounded,
  CheckCircleRounded,
} from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";

import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";
import TeamActivityPanel from "./TeamActivityPanel";

type Role = "admin" | "member";
type Status = "invited" | "active" | "revoked";

interface Member {
  id: number;
  company_id: number;
  email: string;
  name: string | null;
  role: Role;
  permissions: Record<string, boolean>;
  status: Status;
  invited_at?: string;
  accepted_at?: string | null;
}
interface Catalogue {
  keys: string[];
  labels: Record<string, string>;
  roles: string[];
  defaults: Record<string, Record<string, boolean>>;
}

const roleColor = (role: string): "warning" | "default" => (role === "admin" ? "warning" : "default");
const statusColor = (s: string): "success" | "info" | "default" =>
  s === "active" ? "success" : s === "invited" ? "info" : "default";

/**
 * Team Members / RBAC — owner-facing management panel (Settings -> Team).
 * Only the company Owner or a teammate with `manage_team` can load/use this;
 * the backend enforces that (a 403 simply shows an empty state here).
 */
const TeamSettingsSection: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");
  const companyId = useSelectedCompanyId();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const toast = useCallback(
    (message: string, severity: "success" | "error" | "info" = "info") => {
      dispatch({ type: TOAST_SHOW, payload: { message, severity } });
    },
    [dispatch]
  );

  // Shared dialog state (invite when editing === null, else edit).
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!companyId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setForbidden(false);
    try {
      const res = await axiosBaseApi.get("team/members", { params: { company_id: companyId } });
      setMembers(res?.data?.data?.members || []);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      if (err?.response?.status === 403) {
        setForbidden(true);
      } else {
        toast(err?.response?.data?.message || "Couldn't load team members.", "error");
      }
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await axiosBaseApi.get("team/permissions/catalogue");
        if (mounted) setCatalogue(res?.data?.data || null);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const defaultPermsFor = useCallback(
    (r: Role): Record<string, boolean> => {
      if (catalogue?.defaults?.[r]) return { ...catalogue.defaults[r] };
      const base: Record<string, boolean> = {};
      (catalogue?.keys || []).forEach((k) => (base[k] = r === "admin"));
      return base;
    },
    [catalogue]
  );

  const openInvite = () => {
    setEditing(null);
    setEmail("");
    setRole("member");
    setPerms(defaultPermsFor("member"));
    setInviteLink(null);
    setCopied(false);
    setDialogOpen(true);
  };
  const openEdit = (m: Member) => {
    setEditing(m);
    setEmail(m.email);
    setRole(m.role);
    setPerms({ ...(m.permissions || {}) });
    setInviteLink(null);
    setDialogOpen(true);
  };
  const onRoleChange = (r: Role) => {
    setRole(r);
    if (!editing) setPerms(defaultPermsFor(r)); // don't clobber an in-progress edit
  };
  const togglePerm = (k: string) => setPerms((p) => ({ ...p, [k]: !p[k] }));

  const submit = async () => {
    if (!companyId) {
      toast("Select a business first.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await axiosBaseApi.patch(`team/members/${editing.id}`, { role, permissions: perms });
        toast("Team member updated.", "success");
        setDialogOpen(false);
        fetchMembers();
      } else {
        const em = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          toast("Enter a valid email address.", "error");
          setSaving(false);
          return;
        }
        const res = await axiosBaseApi.post("team/invite", {
          email: em,
          role,
          permissions: perms,
          company_id: companyId,
        });
        setInviteLink(res?.data?.data?.invite_link || null);
        toast("Invitation created.", "success");
        fetchMembers();
        // keep the dialog open to reveal the shareable link
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err?.response?.data?.message || "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (m: Member) => {
    if (typeof window !== "undefined" && !window.confirm(`Remove ${m.email} from this business?`)) return;
    try {
      await axiosBaseApi.delete(`team/members/${m.id}`);
      toast("Access revoked.", "success");
      fetchMembers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err?.response?.data?.message || "Couldn't revoke access.", "error");
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still visible to copy manually */
    }
  };

  const activeMembers = useMemo(() => members.filter((m) => m.status !== "revoked"), [members]);
  const permKeys = catalogue?.keys || Object.keys(perms);

  return (
    <Box data-testid="team-settings-section">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <GroupAddRounded sx={{ fontSize: 22, color: theme.palette.primary.main }} />
            <Typography variant="h6" fontWeight={700}>
              {t("team.title", { defaultValue: "Team" })}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
            {t("team.subtitle", {
              defaultValue:
                "Invite teammates to help manage this business. You choose exactly what each person can access.",
            })}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddAlt1Rounded />}
          onClick={openInvite}
          disabled={!companyId || forbidden}
          data-testid="team-invite-button"
          sx={{ textTransform: "none", borderRadius: 2, fontWeight: 600 }}
        >
          {t("team.invite", { defaultValue: "Invite teammate" })}
        </Button>
      </Stack>

      {!companyId ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          {t("team.selectCompany", { defaultValue: "Select a business first." })}
        </Typography>
      ) : forbidden ? (
        <Box sx={{ py: 6, textAlign: "center", border: `1px dashed ${theme.palette.divider}`, borderRadius: 2 }}>
          <Typography fontWeight={600}>{t("team.noAccessTitle", { defaultValue: "Owner access required" })}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("team.noAccessBody", { defaultValue: "Only the account owner (or a teammate with the Manage team permission) can manage the team." })}
          </Typography>
        </Box>
      ) : loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={26} />
        </Box>
      ) : activeMembers.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center", border: `1px dashed ${theme.palette.divider}`, borderRadius: 2 }}>
          <Typography fontWeight={600}>{t("team.emptyTitle", { defaultValue: "No teammates yet" })}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("team.emptyBody", { defaultValue: "Invite someone to manage payments, links or customers with you." })}
          </Typography>
        </Box>
      ) : (
        <Stack
          divider={<Divider />}
          sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: "hidden" }}
        >
          {activeMembers.map((m) => {
            const grantCount = Object.values(m.permissions || {}).filter(Boolean).length;
            return (
              <Stack
                key={m.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ p: 2, gap: 1.5, flexWrap: "wrap" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ flexWrap: "wrap" }}>
                    <Typography fontWeight={600} noWrap>
                      {m.name || m.email}
                    </Typography>
                    <Chip size="small" label={m.role} color={roleColor(m.role)} variant="outlined" sx={{ textTransform: "capitalize" }} />
                    <Chip size="small" label={m.status} color={statusColor(m.status)} sx={{ textTransform: "capitalize" }} />
                  </Stack>
                  {m.name && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {m.email}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {m.role === "admin"
                      ? t("team.adminFullAccess", { defaultValue: "Full access (except owner-only actions)" })
                      : t("team.permCount", { defaultValue: `${grantCount} permission(s) granted`, count: grantCount })}
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.5}>
                  <Tooltip title={t("team.edit", { defaultValue: "Edit role & permissions" })}>
                    <IconButton onClick={() => openEdit(m)} size="small" data-testid={`team-edit-${m.id}`}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t("team.remove", { defaultValue: "Remove" })}>
                    <IconButton onClick={() => revoke(m)} size="small" color="error" data-testid={`team-remove-${m.id}`}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      )}

      <TeamActivityPanel />

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editing
            ? t("team.editTitle", { defaultValue: "Edit teammate" })
            : t("team.inviteTitle", { defaultValue: "Invite a teammate" })}
        </DialogTitle>
        <DialogContent dividers>
          {inviteLink ? (
            <Box>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <CheckCircleRounded color="success" />
                <Typography fontWeight={600}>{t("team.inviteReady", { defaultValue: "Invitation ready" })}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t("team.inviteShare", {
                  defaultValue: `Share this secure link with ${email}. It lets them set a password and join this business.`,
                })}
              </Typography>
              <Stack direction="row" gap={1}>
                <TextField value={inviteLink} fullWidth size="small" InputProps={{ readOnly: true }} data-testid="team-invite-link" />
                <Button variant="outlined" startIcon={<ContentCopyRounded />} onClick={copyLink} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>
                  {copied ? t("team.copied", { defaultValue: "Copied" }) : t("team.copy", { defaultValue: "Copy" })}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Stack gap={2} sx={{ mt: 0.5 }}>
              {!editing ? (
                <TextField
                  label={t("team.emailLabel", { defaultValue: "Teammate email" })}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  size="small"
                  autoFocus
                  data-testid="team-invite-email"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {email}
                </Typography>
              )}
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  {t("team.role", { defaultValue: "Role" })}
                </Typography>
                <Select value={role} onChange={(e) => onRoleChange(e.target.value as Role)} fullWidth size="small" data-testid="team-role-select">
                  <MenuItem value="member">{t("team.roleMember", { defaultValue: "Member — only the access you choose below" })}</MenuItem>
                  <MenuItem value="admin">{t("team.roleAdmin", { defaultValue: "Admin — full access (except owner-only actions)" })}</MenuItem>
                </Select>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  {t("team.permissions", { defaultValue: "Permissions" })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("team.ownerOnlyNote", {
                    defaultValue:
                      "Owner-only actions (changing payout wallets, deleting API keys, billing) are never granted to teammates.",
                  })}
                </Typography>
                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5 }}>
                  {permKeys.map((k) => (
                    <FormControlLabel
                      key={k}
                      control={<Switch size="small" checked={!!perms[k]} onChange={() => togglePerm(k)} data-testid={`team-perm-${k}`} />}
                      label={<Typography variant="body2">{catalogue?.labels?.[k] || k}</Typography>}
                    />
                  ))}
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }} disabled={saving}>
            {inviteLink ? t("team.done", { defaultValue: "Done" }) : t("team.cancel", { defaultValue: "Cancel" })}
          </Button>
          {!inviteLink && (
            <Button
              variant="contained"
              onClick={submit}
              disabled={saving}
              data-testid="team-dialog-submit"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {saving
                ? t("team.saving", { defaultValue: "Saving..." })
                : editing
                ? t("team.saveChanges", { defaultValue: "Save changes" })
                : t("team.createInvite", { defaultValue: "Create invite" })}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamSettingsSection;
