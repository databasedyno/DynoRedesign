import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import adminBaseApi from "@/axiosAdmin";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { AdminStatusChip, formatDateTime, formatCrypto, formatUSD } from "../adminUi";

interface CustomerTx {
  id?: string;
  createdAt?: string;
  company_name?: string;
  customer_name?: string;
  email?: string;
  base_amount?: number;
  base_currency?: string;
  crypto_amount?: number;
  crypto_currency?: string;
  usd_value?: number;
  transaction_type?: string;
  status?: string;
  transaction_reference?: string;
}
interface SelfTx {
  id?: string;
  createdAt?: string;
  base_amount?: number;
  base_currency?: string;
  transaction_details?: string;
  transaction_reference?: string;
  transaction_type?: string;
  status?: string;
}

const STATUS_FILTERS = ["all", "successful", "pending", "failed"];

const AdminTransactions: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const router = useRouter();
  const [customerTx, setCustomerTx] = useState<CustomerTx[]>([]);
  const [selfTx, setSelfTx] = useState<SelfTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Deep-link from the Merchants drawer: /admin/transactions?brand=<name>
  // pre-fills the search to that brand's customer payments.
  useEffect(() => {
    if (!router.isReady) return;
    const b = router.query.brand;
    const name = Array.isArray(b) ? b[0] : b;
    if (name) {
      setBrand(name);
      setQ(name);
      setTab(0);
    }
  }, [router.isReady, router.query.brand]);

  const clearBrand = () => {
    setBrand(null);
    setQ("");
    router.replace("/admin/transactions", undefined, { shallow: true });
  };

  const fetchTx = useCallback(async () => {
    try {
      const res = await adminBaseApi.get("/admin/getAllTransactions");
      setCustomerTx(res.data?.data?.customers_transactions || []);
      setSelfTx(res.data?.data?.users_transactions || []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      dispatch({ type: TOAST_SHOW, payload: { message: msg || "Could not load transactions.", severity: "error" } });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchTx();
  }, [fetchTx]);

  useEffect(() => setPage(0), [q, status, tab]);

  const matchStatus = (s?: string) => {
    if (status === "all") return true;
    const v = (s || "").toLowerCase();
    if (status === "successful") return ["successful", "success", "settled", "completed"].includes(v);
    return v === status;
  };

  const filteredCustomer = useMemo(() => {
    const query = q.trim().toLowerCase();
    return customerTx.filter((t) => {
      if (!matchStatus(t.status)) return false;
      if (!query) return true;
      return (
        (t.company_name || "").toLowerCase().includes(query) ||
        (t.email || "").toLowerCase().includes(query) ||
        (t.customer_name || "").toLowerCase().includes(query) ||
        (t.base_currency || "").toLowerCase().includes(query) ||
        (t.crypto_currency || "").toLowerCase().includes(query) ||
        (t.transaction_reference || "").toLowerCase().includes(query)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerTx, q, status]);

  const filteredSelf = useMemo(() => {
    const query = q.trim().toLowerCase();
    return selfTx.filter((t) => {
      if (!matchStatus(t.status)) return false;
      if (!query) return true;
      return (
        (t.transaction_details || "").toLowerCase().includes(query) ||
        (t.base_currency || "").toLowerCase().includes(query) ||
        (t.transaction_reference || "").toLowerCase().includes(query)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfTx, q, status]);

  const activeList: (CustomerTx | SelfTx)[] = tab === 0 ? filteredCustomer : filteredSelf;
  const paged = activeList.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box data-testid="admin-transactions">
      <Paper variant="outlined" sx={{ borderRadius: "16px", overflow: "hidden" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ px: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
        >
          <Tab label={`Customer payments (${customerTx.length})`} data-testid="tx-tab-customer" />
          <Tab label={`Platform transactions (${selfTx.length})`} data-testid="tx-tab-platform" />
        </Tabs>

        {/* Toolbar */}
        <Box sx={{ p: 2, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder={tab === 0 ? "Search company, customer, currency…" : "Search reference, details…"}
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
            data-testid="transactions-search"
          />
          {brand && (
            <Chip
              size="small"
              color="primary"
              label={`Brand: ${brand}`}
              onDelete={clearBrand}
              data-testid="transactions-brand-filter"
              sx={{ fontWeight: 700 }}
            />
          )}
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((s) => {
              const active = status === s;
              return (
                <Chip
                  key={s}
                  size="small"
                  label={s.charAt(0).toUpperCase() + s.slice(1)}
                  color={active ? "primary" : "default"}
                  variant={active ? "filled" : "outlined"}
                  onClick={() => setStatus(s)}
                  data-testid={`transactions-filter-${s}`}
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
              {tab === 0 ? (
                <Table size="small" sx={{ minWidth: 860 }}>
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: theme.palette.action.hover } }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Brand</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Crypto</TableCell>
                      <TableCell align="right">USD value</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                          No transactions match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                    {(paged as CustomerTx[]).map((t, i) => (
                      <TableRow key={t.id || i} hover data-testid={`tx-row-${t.id || i}`}>
                        <TableCell sx={{ fontSize: 12.5, color: "text.secondary", whiteSpace: "nowrap" }}>
                          {formatDateTime(t.createdAt)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, fontWeight: 600 }}>{t.company_name || "—"}</TableCell>
                        <TableCell sx={{ fontSize: 12.5 }}>{t.email || t.customer_name || "—"}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                          {formatCrypto(t.base_amount)} {t.base_currency}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "text.secondary" }}>
                          {t.crypto_amount ? `${formatCrypto(t.crypto_amount)} ${t.crypto_currency || ""}` : "—"}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                          {formatUSD(t.usd_value)}
                        </TableCell>
                        <TableCell>
                          <AdminStatusChip status={t.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: theme.palette.action.hover } }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Details</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
                          No transactions match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                    {(paged as SelfTx[]).map((t, i) => (
                      <TableRow key={t.id || i} hover data-testid={`tx-self-row-${t.id || i}`}>
                        <TableCell sx={{ fontSize: 12.5, color: "text.secondary", whiteSpace: "nowrap" }}>
                          {formatDateTime(t.createdAt)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12.5 }}>{t.transaction_details || "—"}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                          {formatCrypto(t.base_amount)} {t.base_currency}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t.transaction_type || "—"}
                            color={t.transaction_type === "DEBIT" ? "warning" : "success"}
                            sx={{ height: 22, fontSize: 11 }}
                          />
                        </TableCell>
                        <TableCell>
                          <AdminStatusChip status={t.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
            <TablePagination
              component="div"
              count={activeList.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              data-testid="transactions-pagination"
            />
          </>
        )}
      </Paper>
    </Box>
  );
};

export default AdminTransactions;
