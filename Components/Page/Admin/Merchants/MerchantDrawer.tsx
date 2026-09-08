import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  CloseRounded,
  BlockRounded,
  PauseCircleRounded,
  CheckCircleRounded,
  LockOpenRounded,
} from "@mui/icons-material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { AdminStatusChip, formatDate, formatUSD } from "../adminUi";

export interface Merchant {
  user_id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  fee_tier?: string;
  cumulative_volume_usd?: string | number;
  fee_free_remaining_usd?: string | number;
  login_type?: string;
  createdAt?: string;
  signup_country?: string;
  referral_count?: number;
  referral_code?: string;
  email_verified?: boolean;
  handle?: string;
  mobile?: string;
  language?: string;
  last_login_ip?: string;
  transaction_count?: number;
}

type ActionKind = "ban" | "suspend" | "activate" | "unlock";

const ACTION_META: Record<ActionKind, { title: string; body: string; confirm: string; needsReason: boolean }> = {
  ban: {
    title: "Ban this merchant?",
    body: "The account will be marked as banned and will no longer be able to sign in or process payments.",
    confirm: "Ban merchant",
    needsReason: true,
  },
  suspend: {
    title: "Suspend this merchant?",
    body: "The account will be temporarily suspended. You can re-activate it at any time.",
    confirm: "Suspend merchant",
    needsReason: true,
  },
  activate: {
    title: "Re-activate this merchant?",
    body: "The account will be restored to active status.",
    confirm: "Activate merchant",
    needsReason: false,
  },
  unlock: {
    title: "Unlock this account?",
    body: "Clears the failed-login lockout so the merchant can sign in again immediately.",
    confirm: "Unlock login",
    needsReason: false,
  },
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.75 }}>
    <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{label}</Typography>
    <Typography sx={{ fontSize: 12.5, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>
      {value}
    </Typography>
  </Box>
);

const MerchantDrawer: React.FC<{
  merchant: Merchant | null;
  onClose: () => void;
  onChanged: () => void;
}> = ({ merchant, onClose, onChanged }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [detail, setDetail] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const toast = useCallback(
    (message: string, severity: "success" | "error" = "success") =>
      dispatch({ type: TOAST_SHOW, payload: { message, severity } }),
    [dispatch]
  );

  useEffect(() => {
    if (!merchant) {
      setDetail(null);
      return;
    }
    setDetail(merchant);
    setLoading(true);
    adminBaseApi
      .get(`/admin/users/${merchant.user_id}`)
      .then((res) => setDetail({ ...merchant, ...(res.data?.data || {}) }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [merchant]);

  const runAction = async () => {
    if (!merchant || !pending) return;
    setBusy(true);
    try {
      if (pending === "unlock") {
        await adminBaseApi.post(`/admin/users/unlock`, { email: merchant.email });
        toast(`Login unlocked for ${merchant.email}.`);
      } else {
        await adminBaseApi.put(`/admin/users/${merchant.user_id}/ban`, {
          action: pending,
          reason: reason.trim() || undefined,
        });
        toast(`Merchant ${pending === "activate" ? "re-activated" : `${pending}ned`} successfully.`);
      }
      setPending(null);
      setReason("");
      onChanged();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg || "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const m = detail;
  const statusLower = (m?.status || "active").toLowerCase();
  const isActive = statusLower === "active";
  const meta = pending ? ACTION_META[pending] : null;

  return (
    <>
      <Drawer
        anchor="right"
        open={Boolean(merchant)}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 0 } }}
        data-testid="merchant-drawer"
      >
        {m && (
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <Box
              sx={{
                p: 2.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 17, fontWeight: 800 }} noWrap>
                  {m.name || [m.first_name, m.last_name].filter(Boolean).join(" ") || "Merchant"}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }} noWrap>
                  {m.email || "—"}
                </Typography>
                <Box sx={{ mt: 1, display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
                  <AdminStatusChip status={m.status || "active"} testid="merchant-drawer-status" />
                  <Chip size="small" variant="outlined" label={`#${m.user_id}`} sx={{ height: 22, fontSize: 11 }} />
                  {m.email_verified && (
                    <Chip size="small" color="success" variant="outlined" label="Email verified" sx={{ height: 22, fontSize: 11 }} />
                  )}
                </Box>
              </Box>
              <IconButton onClick={onClose} size="small" data-testid="merchant-drawer-close">
                <CloseRounded />
              </IconButton>
            </Box>

            {/* Body */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 2.5 }}>
              {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              )}
              <InfoRow label="Lifetime volume" value={formatUSD(m.cumulative_volume_usd)} />
              <InfoRow label="Fee tier" value={<span style={{ textTransform: "capitalize" }}>{m.fee_tier || "—"}</span>} />
              <InfoRow label="Fee-free remaining" value={formatUSD(m.fee_free_remaining_usd)} />
              {m.transaction_count != null && (
                <InfoRow label="Transactions" value={m.transaction_count.toLocaleString()} />
              )}
              <Divider sx={{ my: 1 }} />
              <InfoRow label="Login method" value={m.login_type || "EMAIL"} />
              <InfoRow label="Mobile" value={m.mobile || "—"} />
              <InfoRow label="Country" value={m.signup_country || "—"} />
              <InfoRow label="Language" value={(m.language || "en").toUpperCase()} />
              <InfoRow label="Last login IP" value={m.last_login_ip || "—"} />
              <Divider sx={{ my: 1 }} />
              <InfoRow label="Creator handle" value={m.handle ? `@${m.handle}` : "—"} />
              <InfoRow label="Referrals" value={String(m.referral_count ?? 0)} />
              <InfoRow label="Referral code" value={m.referral_code || "—"} />
              <InfoRow label="Joined" value={formatDate(m.createdAt)} />
            </Box>

            {/* Actions */}
            <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, display: "flex", flexWrap: "wrap", gap: 1 }}>
              {isActive ? (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<PauseCircleRounded />}
                    onClick={() => setPending("suspend")}
                    data-testid="merchant-action-suspend"
                  >
                    Suspend
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<BlockRounded />}
                    onClick={() => setPending("ban")}
                    data-testid="merchant-action-ban"
                  >
                    Ban
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleRounded />}
                  onClick={() => setPending("activate")}
                  data-testid="merchant-action-activate"
                >
                  Re-activate
                </Button>
              )}
              <Button
                size="small"
                variant="text"
                startIcon={<LockOpenRounded />}
                onClick={() => setPending("unlock")}
                disabled={!m.email}
                data-testid="merchant-action-unlock"
              >
                Unlock login
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Confirm dialog */}
      <Dialog open={Boolean(pending)} onClose={() => (busy ? null : setPending(null))} fullWidth maxWidth="xs">
        {meta && (
          <>
            <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{meta.title}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ fontSize: 13.5, mb: meta.needsReason ? 2 : 0 }}>
                {meta.body}
              </DialogContentText>
              {meta.needsReason && (
                <TextField
                  fullWidth
                  size="small"
                  label="Reason (optional)"
                  multiline
                  minRows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  data-testid="merchant-action-reason"
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color={pending === "ban" ? "error" : pending === "suspend" ? "warning" : "primary"}
                onClick={runAction}
                disabled={busy}
                data-testid="merchant-action-confirm"
              >
                {busy ? <CircularProgress size={18} color="inherit" /> : meta.confirm}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default MerchantDrawer;
