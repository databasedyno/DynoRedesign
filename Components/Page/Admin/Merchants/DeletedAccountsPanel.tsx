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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { RestoreFromTrashRounded, DeleteForeverRounded, PersonOffRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { formatDate } from "../adminUi";

interface DeletedAccount {
  user_id: number;
  name: string | null;
  email: string | null;
  deleted_at: string | null;
  scheduled_purge_at: string | null;
  brand_count: number | string | null;
  days_remaining: number | null;
  expired: boolean;
}

interface Props {
  onChanged?: () => void;
}

const errMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const DeletedAccountsPanel: React.FC<Props> = ({ onChanged }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [accounts, setAccounts] = useState<DeletedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DeletedAccount | null>(null);

  const fetchDeleted = useCallback(async () => {
    try {
      const res = await adminBaseApi.get("/admin/deleted-accounts");
      setAccounts((res.data?.data || []) as DeletedAccount[]);
    } catch (e) {
      dispatch({ type: TOAST_SHOW, payload: { message: errMsg(e, "Could not load deleted accounts."), severity: "error" } });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchDeleted();
  }, [fetchDeleted]);

  const restore = useCallback(
    async (a: DeletedAccount) => {
      setBusyId(a.user_id);
      try {
        await adminBaseApi.post(`/admin/deleted-accounts/${a.user_id}/restore`);
        dispatch({ type: TOAST_SHOW, payload: { message: `Restored account ${a.email || `#${a.user_id}`}.`, severity: "success" } });
        await fetchDeleted();
        onChanged?.();
      } catch (e) {
        dispatch({ type: TOAST_SHOW, payload: { message: errMsg(e, "Restore failed."), severity: "error" } });
      } finally {
        setBusyId(null);
      }
    },
    [dispatch, fetchDeleted, onChanged]
  );

  const purge = useCallback(
    async (a: DeletedAccount) => {
      setBusyId(a.user_id);
      try {
        await adminBaseApi.post(`/admin/deleted-accounts/${a.user_id}/purge`);
        dispatch({ type: TOAST_SHOW, payload: { message: `Permanently deleted account ${a.email || `#${a.user_id}`}.`, severity: "success" } });
        setPurgeTarget(null);
        await fetchDeleted();
        onChanged?.();
      } catch (e) {
        dispatch({ type: TOAST_SHOW, payload: { message: errMsg(e, "Purge failed."), severity: "error" } });
      } finally {
        setBusyId(null);
      }
    },
    [dispatch, fetchDeleted, onChanged]
  );

  const daysChip = (a: DeletedAccount) => {
    if (a.expired || a.days_remaining == null || a.days_remaining <= 0) {
      return <Chip size="small" color="error" label="Purge due" sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />;
    }
    const urgent = a.days_remaining <= 2;
    return (
      <Chip
        size="small"
        color={urgent ? "warning" : "default"}
        variant={urgent ? "filled" : "outlined"}
        label={`${a.days_remaining} day${a.days_remaining === 1 ? "" : "s"} left`}
        sx={{ height: 22, fontSize: 11, fontWeight: urgent ? 700 : 500 }}
      />
    );
  };

  if (!loading && accounts.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      data-testid="deleted-accounts-panel"
      sx={{ borderRadius: "16px", overflow: "hidden", mb: 2.5, borderColor: theme.palette.error.main, borderWidth: 1 }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          backgroundColor: theme.palette.mode === "dark" ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.07)",
        }}
      >
        <PersonOffRounded sx={{ color: "error.main" }} fontSize="small" />
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
          Deleted accounts
          {!loading && (
            <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", ml: 0.75 }}>
              · {accounts.length} pending permanent deletion
            </Typography>
          )}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={22} />
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: theme.palette.action.hover } }}>
                <TableCell>Account</TableCell>
                <TableCell align="right">Brands</TableCell>
                <TableCell>Deleted</TableCell>
                <TableCell>Restore window</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.user_id} data-testid={`deleted-account-row-${a.user_id}`}>
                  <TableCell>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{a.name || `User #${a.user_id}`}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{a.email || "—"} · ID #{a.user_id}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 12.5 }}>{a.brand_count ?? 0}</TableCell>
                  <TableCell sx={{ fontSize: 12.5, color: "text.secondary" }}>{formatDate(a.deleted_at)}</TableCell>
                  <TableCell>
                    {daysChip(a)}
                    <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.5 }}>Purge: {formatDate(a.scheduled_purge_at)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={busyId === a.user_id ? <CircularProgress size={14} color="inherit" /> : <RestoreFromTrashRounded fontSize="small" />}
                        disabled={busyId != null}
                        onClick={() => restore(a)}
                        data-testid={`restore-account-${a.user_id}-btn`}
                        sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
                      >
                        Restore
                      </Button>
                      <Tooltip title="Permanently delete now (skips the remaining grace window)">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteForeverRounded fontSize="small" />}
                            disabled={busyId != null}
                            onClick={() => setPurgeTarget(a)}
                            data-testid={`purge-account-${a.user_id}-btn`}
                            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
                          >
                            Delete now
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Dialog open={Boolean(purgeTarget)} onClose={() => (busyId ? null : setPurgeTarget(null))} data-testid="purge-account-dialog">
        <DialogTitle sx={{ fontWeight: 700 }}>Permanently delete account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This immediately and permanently deletes the account <strong>{purgeTarget?.email || `#${purgeTarget?.user_id}`}</strong> and
            ALL of its data — every brand, wallet, payment link and customer. This cannot be undone and skips the remaining recovery window.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPurgeTarget(null)} disabled={busyId != null} sx={{ textTransform: "none" }} data-testid="purge-account-cancel-btn">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => purgeTarget && purge(purgeTarget)}
            disabled={busyId != null}
            startIcon={busyId != null ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverRounded fontSize="small" />}
            data-testid="purge-account-confirm-btn"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default DeletedAccountsPanel;
