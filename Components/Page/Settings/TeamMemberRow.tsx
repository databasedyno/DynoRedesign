import React from "react";
import { Box, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { DeleteOutlineRounded, EditRounded, ScheduleRounded, SendRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { Member, roleColor, statusColor } from "./teamTypes";

interface Props {
  member: Member;
  resending: boolean;
  onEdit: (m: Member) => void;
  onResend: (m: Member) => void;
  onRevoke: (m: Member) => void;
}

/** One teammate row: name/email, role + status chips, invite expiry, edit / resend / remove. */
export const TeamMemberRow: React.FC<Props> = ({ member: m, resending, onEdit, onResend, onRevoke }) => {
  const { t } = useTranslation("common");
  const grantCount = Object.values(m.permissions || {}).filter(Boolean).length;

  // Friendly "expires in X days" hint for a pending invite link.
  const inviteExpiry = (iso?: string | null): { label: string; color: "error" | "warning" | "default"; tooltip: string } | null => {
    if (!iso) return null;
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) return null;
    const ms = target - Date.now();
    const tooltip = t("team.expiresOn", { defaultValue: `Link expires ${new Date(iso).toLocaleString()}`, date: new Date(iso).toLocaleString() });
    if (ms <= 0) return { label: t("team.expired", { defaultValue: "Expired" }), color: "error", tooltip };
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    const color: "warning" | "default" = days <= 2 ? "warning" : "default";
    const label = days <= 1
      ? t("team.expiresSoon", { defaultValue: "Expires within a day" })
      : t("team.expiresInDays", { defaultValue: `Expires in ${days} days`, days });
    return { label, color, tooltip };
  };
  const exp = m.status === "invited" ? inviteExpiry(m.expires_at) : null;

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, gap: 1.5, flexWrap: "wrap" }}>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ flexWrap: "wrap" }}>
          <Typography fontWeight={600} noWrap>{m.name || m.email}</Typography>
          <Chip size="small" label={m.role} color={roleColor(m.role)} variant="outlined" sx={{ textTransform: "capitalize" }} />
          <Chip size="small" label={m.status} color={statusColor(m.status)} sx={{ textTransform: "capitalize" }} />
        </Stack>
        {m.name && (
          <Typography variant="body2" color="text.secondary" noWrap>{m.email}</Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {m.role === "admin"
            ? t("team.adminFullAccess", { defaultValue: "Full access (except owner-only actions)" })
            : t("team.permCount", { defaultValue: `${grantCount} permission(s) granted`, num: grantCount })}
        </Typography>
      </Box>
      <Stack direction="row" gap={0.5} alignItems="center">
        <Tooltip title={t("team.edit", { defaultValue: "Edit role & permissions" })}>
          <IconButton onClick={() => onEdit(m)} size="small" data-testid={`team-edit-${m.id}`}>
            <EditRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        {exp && (
          <Tooltip title={exp.tooltip}>
            <Chip
              size="small"
              variant="outlined"
              color={exp.color}
              icon={<ScheduleRounded sx={{ fontSize: 14 }} />}
              label={exp.label}
              data-testid={`team-invite-expiry-${m.id}`}
              sx={{ height: 24, fontWeight: 500 }}
            />
          </Tooltip>
        )}
        {m.status === "invited" && (
          <Tooltip title={t("team.resend", { defaultValue: "Resend invite link" })}>
            <span>
              <IconButton onClick={() => onResend(m)} size="small" color="primary" disabled={resending} data-testid={`team-resend-${m.id}`}>
                {resending ? <CircularProgress size={16} /> : <SendRounded fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title={t("team.remove", { defaultValue: "Remove" })}>
          <IconButton onClick={() => onRevoke(m)} size="small" color="error" data-testid={`team-remove-${m.id}`}>
            <DeleteOutlineRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
};

export default TeamMemberRow;
