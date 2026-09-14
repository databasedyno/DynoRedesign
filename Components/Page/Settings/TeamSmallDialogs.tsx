import React from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { ContentCopyRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { Member } from "./teamTypes";

interface RevokeProps {
  target: Member | null;
  revoking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Revoke-access confirmation (replaces the native window.confirm). */
export const TeamRevokeDialog: React.FC<RevokeProps> = ({ target, revoking, onCancel, onConfirm }) => {
  const { t } = useTranslation("common");
  return (
    <Dialog open={!!target} onClose={() => !revoking && onCancel()} fullWidth maxWidth="xs" data-testid="team-revoke-dialog">
      <DialogTitle sx={{ fontWeight: 700 }}>{t("team.revokeTitle", { defaultValue: "Remove teammate?" })}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          {t("team.revokeBody", {
            defaultValue: `${target?.email || "This person"} will immediately lose access to this business. You can invite them again later.`,
            email: target?.email || "This person",
          })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onCancel} disabled={revoking} sx={{ textTransform: "none" }} data-testid="team-revoke-cancel">
          {t("team.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={revoking}
          startIcon={revoking ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineRounded />}
          sx={{ textTransform: "none", fontWeight: 600 }}
          data-testid="team-revoke-confirm"
        >
          {revoking ? t("team.revoking", { defaultValue: "Removing..." }) : t("team.revokeConfirm", { defaultValue: "Remove access" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface ResendProps {
  link: string | null;
  email: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

/** Shows the refreshed invite link after "Resend". */
export const TeamResendDialog: React.FC<ResendProps> = ({ link, email, copied, onCopy, onClose }) => {
  const { t } = useTranslation("common");
  return (
    <Dialog open={!!link} onClose={onClose} fullWidth maxWidth="sm" data-testid="team-resend-dialog">
      <DialogTitle sx={{ fontWeight: 700 }}>{t("team.resendTitle", { defaultValue: "Invite link refreshed" })}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("team.resendBody", { defaultValue: `Share this fresh link with ${email}. Any earlier link for them no longer works.`, email })}
        </Typography>
        <Stack direction="row" gap={1}>
          <TextField value={link || ""} fullWidth size="small" InputProps={{ readOnly: true }} data-testid="team-resend-link" />
          <Button variant="outlined" startIcon={<ContentCopyRounded />} onClick={onCopy} sx={{ textTransform: "none", whiteSpace: "nowrap" }}>
            {copied ? t("team.copied", { defaultValue: "Copied" }) : t("team.copy", { defaultValue: "Copy" })}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }} data-testid="team-resend-done">
          {t("team.done", { defaultValue: "Done" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
