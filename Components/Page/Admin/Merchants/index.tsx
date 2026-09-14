import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { AdminStatusChip, formatDate, formatUSD } from "../adminUi";
import MerchantDrawer, { Merchant } from "./MerchantDrawer";
import DeletedBrandsPanel from "./DeletedBrandsPanel";
import DeletedAccountsPanel from "./DeletedAccountsPanel";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "banned", label: "Banned" },
];

const merchantName = (m: Merchant) =>
  m.name || [m.first_name, m.last_name].filter(Boolean).join(" ") || "—";

const AdminMerchants: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Merchant | null>(null);

  const fetchMerchants = useCallback(async () => {
    try {
      const res = await adminBaseApi.get("/admin/getAllUsers");
      setMerchants((res.data?.data || []) as Merchant[]);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      dispatch({ type: TOAST_SHOW, payload: { message: msg || "Could not load merchants.", severity: "error" } });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: merchants.length };
    merchants.forEach((m) => {
      const s = (m.status || "active").toLowerCase();
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [merchants]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return merchants.filter((m) => {
      if (status !== "all" && (m.status || "active").toLowerCase() !== status) return false;
      if (!query) return true;
      return (
        merchantName(m).toLowerCase().includes(query) ||
        (m.email || "").toLowerCase().includes(query) ||
        String(m.user_id).includes(query) ||
        (m.handle || "").toLowerCase().includes(query)
      );
    });
  }, [merchants, q, status]);

  useEffect(() => setPage(0), [q, status]);

  const paged = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box data-testid="admin-merchants">
      <DeletedAccountsPanel onChanged={fetchMerchants} />
      <DeletedBrandsPanel onChanged={fetchMerchants} />
      <Paper variant="outlined" sx={{ borderRadius: "16px", overflow: "hidden" }}>
        {/* Toolbar */}
        <Box sx={{ p: 2, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder="Search name, email or ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ minWidth: 260, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" />
                </InputAdornment>
              ),
            }}
            data-testid="merchants-search"
          />
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((f) => {
              const active = status === f.key;
              const count = counts[f.key];
              return (
                <Chip
                  key={f.key}
                  size="small"
                  label={count != null ? `${f.label} ${count}` : f.label}
                  color={active ? "primary" : "default"}
                  variant={active ? "filled" : "outlined"}
                  onClick={() => setStatus(f.key)}
                  data-testid={`merchants-filter-${f.key}`}
                  sx={{ fontWeight: active ? 700 : 500 }}
                />
              );
            })}
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: theme.palette.action.hover } }}>
                    <TableCell>Merchant</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Tier</TableCell>
                    <TableCell align="right">Volume</TableCell>
                    <TableCell>Login</TableCell>
                    <TableCell>Joined</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                        No merchants match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {paged.map((m) => (
                    <TableRow
                      key={m.user_id}
                      hover
                      onClick={() => setSelected(m)}
                      data-testid={`merchant-row-${m.user_id}`}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{merchantName(m)}</Typography>
                        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{m.email || "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <AdminStatusChip status={m.status || "active"} testid={`merchant-status-${m.user_id}`} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" label={m.fee_tier || "—"} sx={{ height: 22, fontSize: 11, textTransform: "capitalize" }} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                        {formatUSD(m.cumulative_volume_usd)}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12.5, color: "text.secondary" }}>{m.login_type || "EMAIL"}</TableCell>
                      <TableCell sx={{ fontSize: 12.5, color: "text.secondary" }}>{formatDate(m.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              data-testid="merchants-pagination"
            />
          </>
        )}
      </Paper>

      <MerchantDrawer
        merchant={selected}
        onClose={() => setSelected(null)}
        onChanged={fetchMerchants}
      />
    </Box>
  );
};

export default AdminMerchants;
