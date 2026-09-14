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
import { RestoreFromTrashRounded, DeleteForeverRounded, WarningAmberRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { formatDate } from "../adminUi";

interface DeletedBrand {
  company_id: number;
  company_name: string | null;
  user_id: number;
  deleted_at: string | null;
  scheduled_purge_at: string | null;
  owner_name: string | null;
  owner_email: string | null;
  days_remaining: number | null;
  expired: boolean;
}

interface Props {
  /** Called after a restore/purge so the parent merchant list can refresh. */
  onChanged?: () => void;
}

const errMsg = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const DeletedBrandsPanel: React.FC<Props> = ({ onChanged }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [brands, setBrands] = useState<DeletedBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DeletedBrand | null>(null);

  const fetchDeleted = useCallback(async () => {
    try {
      const res = await adminBaseApi.get("/admin/deleted-brands");
      setBrands((res.data?.data || []) as DeletedBrand[]);
    } catch (e) {
      dispatch({ type: TOAST_SHOW, payload: { message: errMsg(e, "Could not load deleted brands."), severity: "error" } });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchDeleted();
  }, [fetchDeleted]);

  const restore = useCallback(
    async (b: DeletedBrand) => {
      setBusyId(b.company_id);
      try {
        await adminBaseApi.post(`/admin/deleted-brands/${b.company_id}/restore`);
        dispatch({ type: TOAST_SHOW, payload: { message: `Restored "${b.company_name || "brand"}".`, severity: "success" } });
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
    async (b: DeletedBrand) => {
      setBusyId(b.company_id);
      try {
        await adminBaseApi.post(`/admin/deleted-brands/${b.company_id}/purge`);
        dispatch({ type: TOAST_SHOW, payload: { message: `Permanently deleted "${b.company_name || "brand"}".`, severity: "success" } });
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

  const daysChip = (b: DeletedBrand) => {
    if (b.expired || b.days_remaining == null || b.days_remaining <= 0) {
      return <Chip size="small" color="error" label="Purge due" sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />;
    }
    const urgent = b.days_remaining <= 2;
    return (
      <Chip
        size="small"
        color={urgent ? "warning" : "default"}
        variant={urgent ? "filled" : "outlined"}
        label={`${b.days_remaining} day${b.days_remaining === 1 ? "" : "s"} left`}
        sx={{ height: 22, fontSize: 11, fontWeight: urgent ? 700 : 500 }}
      />
    );
  };

  // Nothing to show once loaded and empty — keep the merchants view clean.
  if (!loading && brands.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      data-testid="deleted-brands-panel"
      sx={{
        borderRadius: "16px",
        overflow: "hidden",
        mb: 2.5,
        borderColor: theme.palette.warning.main,
        borderWidth: 1,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          backgroundColor:
            theme.palette.mode === "dark" ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)",
        }}
      >
        <WarningAmberRounded sx={{ color: "warning.main" }} fontSize="small" />
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
          Deleted brands
          {!loading && (
            <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", ml: 0.75 }}>
              · {brands.length} pending permanent deletion
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
                <TableCell>Brand</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Deleted</TableCell>
                <TableCell>Restore window</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {brands.map((b) => (
                <TableRow key={b.company_id} data-testid={`deleted-brand-row-${b.company_id}`}>
                  <TableCell>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
                      {b.company_name || `Brand #${b.company_id}`}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>ID #{b.company_id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{b.owner_name || "—"}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{b.owner_email || "—"}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5, color: "text.secondary" }}>{formatDate(b.deleted_at)}</TableCell>
                  <TableCell>
                    {daysChip(b)}
                    <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.5 }}>
                      Purge: {formatDate(b.scheduled_purge_at)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={busyId === b.company_id ? <CircularProgress size={14} color="inherit" /> : <RestoreFromTrashRounded fontSize="small" />}
                        disabled={busyId != null}
                        onClick={() => restore(b)}
                        data-testid={`restore-brand-${b.company_id}-btn`}
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
                            onClick={() => setPurgeTarget(b)}
                            data-testid={`purge-brand-${b.company_id}-btn`}
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

      <Dialog open={Boolean(purgeTarget)} onClose={() => (busyId ? null : setPurgeTarget(null))} data-testid="purge-brand-dialog">
        <DialogTitle sx={{ fontWeight: 700 }}>Permanently delete brand?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This immediately and permanently deletes <strong>{purgeTarget?.company_name || `Brand #${purgeTarget?.company_id}`}</strong> and
            all of its data (API keys, payment links, customers). This cannot be undone and skips the remaining recovery window.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPurgeTarget(null)} disabled={busyId != null} sx={{ textTransform: "none" }} data-testid="purge-cancel-btn">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => purgeTarget && purge(purgeTarget)}
            disabled={busyId != null}
            startIcon={busyId != null ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverRounded fontSize="small" />}
            data-testid="purge-confirm-btn"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default DeletedBrandsPanel;
