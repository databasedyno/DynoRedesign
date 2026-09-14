import React, { useCallback, useEffect, useState } from "react";
import { Box, Button, Chip, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { LockOpenRounded, RefreshRounded, ShieldRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { SectionCard, formatDateTime } from "../adminUi";

interface SecurityEventRow {
  id: number;
  user_id: number;
  email: string | null;
  name: string | null;
  type: "2fa_reset" | "wallet_unfrozen";
  severity: string;
  summary: string;
  freeze_until: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  wallet_frozen: boolean;
}

const TYPE_LABEL: Record<string, string> = { "2fa_reset": "2FA reset", wallet_unfrozen: "Wallet unfrozen" };

/** Admin › Overview — account-security incidents (2FA resets) with an early "Unfreeze" for the 24h wallet lock. */
const SecurityEventsPanel: React.FC = () => {
  const dispatch = useDispatch();
  const [rows, setRows] = useState<SecurityEventRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminBaseApi.get("/admin/security/events?limit=25");
      setRows((res.data?.data?.events as SecurityEventRow[]) || []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const unfreeze = async (userId: number) => {
    setBusy(userId);
    try {
      const res = await adminBaseApi.post(`/admin/security/users/${userId}/unfreeze`, {});
      dispatch({ type: TOAST_SHOW, payload: { message: res.data?.message || "Wallet changes unlocked.", severity: "success" } });
      await load();
    } catch (e: unknown) {
      dispatch({ type: TOAST_SHOW, payload: { message: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Couldn't unfreeze.", severity: "error" } });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard
      title="Security events"
      testid="admin-security-events"
      action={
        <Button size="small" onClick={load} startIcon={<RefreshRounded sx={{ fontSize: 16 }} />} data-testid="admin-security-refresh" sx={{ textTransform: "none", fontSize: 12.5 }}>
          Refresh
        </Button>
      }
    >
      {rows === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
      ) : rows.length === 0 ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2, color: "text.secondary" }} data-testid="admin-security-empty">
          <ShieldRounded sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: 13.5 }}>No security events yet. 2FA resets and wallet freezes will show up here.</Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Merchant</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Wallet lock</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-testid={`admin-security-row-${r.id}`} hover>
                  <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12.5 }}>{formatDateTime(r.created_at)}</TableCell>
                  <TableCell sx={{ fontSize: 12.5 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{r.name || "—"}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{r.email || `user #${r.user_id}`}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={TYPE_LABEL[r.type] || r.type} color={r.severity === "high" ? "error" : "default"} variant="outlined" sx={{ height: 22, fontSize: 11.5 }} data-testid={`admin-security-type-${r.id}`} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5, maxWidth: 360 }}>
                    <Tooltip title={r.summary} placement="top" arrow>
                      <Typography noWrap sx={{ fontSize: 12.5 }}>{r.summary}</Typography>
                    </Tooltip>
                    {r.resolved_at && (
                      <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Resolved by {r.resolved_by || "admin"} · {formatDateTime(r.resolved_at)}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12.5, whiteSpace: "nowrap" }} data-testid={`admin-security-freeze-${r.id}`}>
                    {r.type === "2fa_reset"
                      ? r.wallet_frozen
                        ? <Chip size="small" color="warning" label={`Locked until ${formatDateTime(r.freeze_until)}`} sx={{ height: 22, fontSize: 11.5 }} />
                        : <Chip size="small" label="Unlocked" variant="outlined" sx={{ height: 22, fontSize: 11.5 }} />
                      : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {r.type === "2fa_reset" && r.wallet_frozen && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => unfreeze(r.user_id)}
                        disabled={busy !== null}
                        startIcon={busy === r.user_id ? <CircularProgress size={12} color="inherit" /> : <LockOpenRounded sx={{ fontSize: 15 }} />}
                        data-testid={`admin-security-unfreeze-${r.id}`}
                        sx={{ textTransform: "none", fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        Unfreeze
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </SectionCard>
  );
};

export default SecurityEventsPanel;
