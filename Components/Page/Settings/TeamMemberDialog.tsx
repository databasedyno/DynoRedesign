import React, { useCallback, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { CheckCircleRounded, ContentCopyRounded, VisibilityRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { Catalogue, Member, Role, Toast, apiErrorMessage } from "./teamTypes";

interface HookArgs {
  companyId: number | null | undefined;
  ownerEmail: string;
  catalogue: Catalogue | null;
  toast: Toast;
  onChanged: () => void;
}

/** Shared invite/edit dialog state (invite when editing === null, else edit). */
export const useTeamMemberDialog = ({ companyId, ownerEmail, catalogue, toast, onChanged }: HookArgs) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const defaultPermsFor = useCallback(
    (r: Role): Record<string, boolean> => {
      if (catalogue?.defaults?.[r]) return { ...catalogue.defaults[r] };
      const base: Record<string, boolean> = {};
      (catalogue?.keys || []).forEach((k) => (base[k] = r === "admin"));
      return base;
    },
    [catalogue],
  );

  const openInvite = () => {
    setEditing(null);
    setEmail("");
    setRole("member");
    setPerms(defaultPermsFor("member"));
    setInviteLink(null);
    setCopied(false);
    setOpen(true);
  };
  const openEdit = (m: Member) => {
    setEditing(m);
    setEmail(m.email);
    setRole(m.role);
    setPerms({ ...(m.permissions || {}) });
    setInviteLink(null);
    setOpen(true);
  };
  const onRoleChange = (r: Role) => {
    setRole(r);
    if (!editing) setPerms(defaultPermsFor(r)); // don't clobber an in-progress edit
  };
  const togglePerm = (k: string) => setPerms((p) => ({ ...p, [k]: !p[k] }));

  // Quick "Read-only" preset: grant only the view_* permissions (no manage_* actions).
  const applyReadOnlyPreset = () => {
    const next: Record<string, boolean> = {};
    (catalogue?.keys || Object.keys(perms)).forEach((k) => (next[k] = k.startsWith("view_")));
    setPerms(next);
    if (!editing) setRole("member");
  };

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
        setOpen(false);
        onChanged();
      } else {
        const em = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          toast("Enter a valid email address.", "error");
          setSaving(false);
          return;
        }
        if (ownerEmail && em === ownerEmail) {
          toast("You already own this business — you can't invite yourself.", "error");
          setSaving(false);
          return;
        }
        const res = await axiosBaseApi.post("team/invite", { email: em, role, permissions: perms, company_id: companyId });
        setInviteLink(res?.data?.data?.invite_link || null);
        toast("Invitation created.", "success");
        onChanged();
        // keep the dialog open to reveal the shareable link
      }
    } catch (e: unknown) {
      toast(apiErrorMessage(e, "Something went wrong."), "error");
    } finally {
      setSaving(false);
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

  const permKeys = catalogue?.keys || Object.keys(perms);
  const isSelfInvite = !editing && !!ownerEmail && email.trim().toLowerCase() === ownerEmail;

  return {
    openInvite,
    openEdit,
    dialogProps: { open, onClose: () => !saving && setOpen(false), editing, email, setEmail, role, onRoleChange, perms, togglePerm, permKeys, catalogue, saving, inviteLink, copied, copyLink, applyReadOnlyPreset, isSelfInvite, submit },
  };
};

type DialogProps = ReturnType<typeof useTeamMemberDialog>["dialogProps"];

export const TeamMemberDialog: React.FC<DialogProps> = (p) => {
  const { t } = useTranslation("common");
  return (
    <Dialog open={p.open} onClose={p.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {p.editing ? t("team.editTitle", { defaultValue: "Edit teammate" }) : t("team.inviteTitle", { defaultValue: "Invite a teammate" })}
      </DialogTitle>
      <DialogContent dividers>
        {p.inviteLink ? (
          <Box>
            <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
              <CheckCircleRounded color="success" />
              <Typography fontWeight={600}>{t("team.inviteReady", { defaultValue: "Invitation ready" })}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t("team.inviteShare", { defaultValue: `Share this secure link with ${p.email}. It lets them set a password and join this business.`, email: p.email })}
            </Typography>
            <Stack direction="row" gap={1}>
              <TextField value={p.inviteLink} fullWidth size="small" InputProps={{ readOnly: true }} data-testid="team-invite-link" />
              <Button variant="outlined" startIcon={<ContentCopyRounded />} onClick={p.copyLink} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>
                {p.copied ? t("team.copied", { defaultValue: "Copied" }) : t("team.copy", { defaultValue: "Copy" })}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Stack gap={2} sx={{ mt: 0.5 }}>
            {!p.editing ? (
              <Box>
                <TextField
                  label={t("team.emailLabel", { defaultValue: "Teammate email" })}
                  type="email"
                  value={p.email}
                  onChange={(e) => p.setEmail(e.target.value)}
                  fullWidth
                  size="small"
                  autoFocus
                  error={p.isSelfInvite}
                  data-testid="team-invite-email"
                />
                {p.isSelfInvite && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }} data-testid="team-self-invite-hint">
                    {t("team.selfInvite", { defaultValue: "You already own this business — you can't invite yourself. Enter a teammate's email." })}
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">{p.email}</Typography>
            )}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{t("team.role", { defaultValue: "Role" })}</Typography>
              <Select value={p.role} onChange={(e) => p.onRoleChange(e.target.value as Role)} fullWidth size="small" data-testid="team-role-select">
                <MenuItem value="member">{t("team.roleMember", { defaultValue: "Member — only the access you choose below" })}</MenuItem>
                <MenuItem value="admin">{t("team.roleAdmin", { defaultValue: "Admin — full access (except owner-only actions)" })}</MenuItem>
              </Select>
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{t("team.permissions", { defaultValue: "Permissions" })}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("team.ownerOnlyNote", { defaultValue: "Owner-only actions (changing payout wallets, deleting API keys, billing) are never granted to teammates." })}
              </Typography>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                <Typography variant="caption" color="text.secondary">{t("team.quickPresets", { defaultValue: "Quick preset:" })}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<VisibilityRounded fontSize="small" />}
                  onClick={p.applyReadOnlyPreset}
                  data-testid="team-preset-readonly"
                  sx={{ textTransform: "none", borderRadius: 2, py: 0.25 }}
                >
                  {t("team.presetReadOnly", { defaultValue: "Read-only (view only)" })}
                </Button>
              </Stack>
              <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5 }}>
                {p.permKeys.map((k) => (
                  <FormControlLabel
                    key={k}
                    control={<Switch size="small" checked={!!p.perms[k]} onChange={() => p.togglePerm(k)} data-testid={`team-perm-${k}`} />}
                    label={<Typography variant="body2">{p.catalogue?.labels?.[k] || k}</Typography>}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={p.onClose} sx={{ textTransform: "none" }} disabled={p.saving}>
          {p.inviteLink ? t("team.done", { defaultValue: "Done" }) : t("team.cancel", { defaultValue: "Cancel" })}
        </Button>
        {!p.inviteLink && (
          <Button variant="contained" onClick={p.submit} disabled={p.saving || p.isSelfInvite} data-testid="team-dialog-submit" sx={{ textTransform: "none", fontWeight: 600 }}>
            {p.saving
              ? t("team.saving", { defaultValue: "Saving..." })
              : p.editing
                ? t("team.saveChanges", { defaultValue: "Save changes" })
                : t("team.createInvite", { defaultValue: "Create invite" })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TeamMemberDialog;
