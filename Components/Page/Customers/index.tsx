import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Skeleton,
  useTheme,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import PeopleIcon from "@mui/icons-material/People";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import axiosBaseApi from "@/axiosConfig";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useRouter } from "next/router";
import CustomButton from "@/Components/UI/Buttons";

interface Customer {
  customer_id: string;
  id: number;
  customer_name: string;
  email: string;
  mobile: string | null;
  company_id: number;
  company_name: string;
  wallet_balance: number;
  wallet_currency: string;
  transaction_count: number;
  createdAt: string;
}

interface CustomerDetail {
  customer: any;
  wallet: any;
  transactions: {
    data: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface Aggregates {
  total_customers: number;
  total_balance: number;
  currency: string;
}

const CustomersPage: React.FC = () => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("common");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [aggregates, setAggregates] = useState<Aggregates>({
    total_customers: 0,
    total_balance: 0,
    currency: "USD",
  });
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [txPage, setTxPage] = useState(1);

  // Wallet management states
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAction, setWalletAction] = useState<"credit" | "debit" | null>(null);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletDescription, setWalletDescription] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [walletSuccess, setWalletSuccess] = useState("");

  // Get company's base currency from API state if available
  const apiState = useSelector((state: any) => state?.api);
  const baseCurrency = apiState?.apiData?.[0]?.base_currency || aggregates.currency || "USD";

  const selectedCompanyId = useSelector(
    (state: any) => state?.companyReducer?.selectedCompanyId
  );

  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedCompanyId) params.company_id = selectedCompanyId;
      const res = await axiosBaseApi.get("/userApi/customers", { params });
      const data = res.data?.data;
      setCustomers(data?.customers || []);
      setTotalPages(data?.pages || 1);
      setTotal(data?.total || 0);
      setAggregates(data?.aggregates || { total_customers: 0, total_balance: 0, currency: "USD" });
    } catch (err) {
      console.error("Failed to fetch customers", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCompanyId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openDetail = async (customerId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetailTab(0);
    setTxPage(1);
    try {
      const res = await axiosBaseApi.get(`/userApi/customer/${customerId}`);
      setSelectedCustomer(res.data?.data || null);
    } catch (err) {
      console.error("Failed to fetch customer detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchDetailTransactions = async (customerId: string, p: number) => {
    try {
      const res = await axiosBaseApi.get(`/userApi/customer/${customerId}`, { params: { page: p, limit: 10 } });
      setSelectedCustomer(res.data?.data || null);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const openWalletModal = (action: "credit" | "debit") => {
    setWalletAction(action);
    setWalletAmount("");
    setWalletDescription("");
    setWalletError("");
    setWalletSuccess("");
    setWalletModalOpen(true);
  };

  const closeWalletModal = () => {
    setWalletModalOpen(false);
    setWalletAction(null);
    setWalletAmount("");
    setWalletDescription("");
    setWalletError("");
    setWalletSuccess("");
  };

  const handleWalletOperation = async () => {
    if (!selectedCustomer || !walletAction) return;

    // Validation
    if (!walletAmount || isNaN(Number(walletAmount)) || Number(walletAmount) <= 0) {
      setWalletError(t("customers.validAmountError"));
      return;
    }

    if (!walletDescription.trim()) {
      setWalletError(t("customers.descriptionRequired"));
      return;
    }

    setWalletLoading(true);
    setWalletError("");
    setWalletSuccess("");

    try {
      const endpoint = `/admin/customers/${selectedCustomer.customer.customer_id}/${walletAction}`;
      const res = await axiosBaseApi.post(endpoint, {
        amount: Number(walletAmount),
        description: walletDescription.trim(),
      });

      if (res.data?.success) {
        setWalletSuccess(
          t(walletAction === "credit" ? "customers.creditSuccess" : "customers.debitSuccess", {
            amount: getCurrencySymbol(
              selectedCustomer.wallet?.wallet_type || baseCurrency,
              formatNumberWithComma(Number(walletAmount).toFixed(2))
            ),
          })
        );

        // Refresh customer details
        const detailRes = await axiosBaseApi.get(`/userApi/customer/${selectedCustomer.customer.customer_id}`);
        setSelectedCustomer(detailRes.data?.data || null);

        // Refresh customer list
        fetchCustomers();

        // Close modal after 1.5 seconds
        setTimeout(() => {
          closeWalletModal();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Wallet operation error:", err);
      setWalletError(err.response?.data?.message || t("customers.walletOpFailed"));
    } finally {
      setWalletLoading(false);
    }
  };

  const currencySymbol = getCurrencySymbol(baseCurrency, "").replace(/[\d,. ]/g, "") || "$";

  return (
    <Box sx={{ p: isMobile ? 2 : 3, maxWidth: 1200, mx: "auto" }}>
      {/* Aggregate Stats */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
          gap: 2,
          mb: 3,
        }}
      >
        <Box
          sx={{
            background: theme.palette.background.paper,
            borderRadius: 3,
            p: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              bgcolor: theme.palette.primary.main + "20",
              borderRadius: 2,
              p: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PeopleIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t("customers.totalCustomers")}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {loading ? <Skeleton width={60} /> : formatNumberWithComma(aggregates.total_customers)}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            background: theme.palette.background.paper,
            borderRadius: 3,
            p: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              bgcolor: "#10b98120",
              borderRadius: 2,
              p: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AccountBalanceWalletIcon sx={{ color: "#10b981", fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t("customers.totalWalletBalance")}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {loading ? (
                <Skeleton width={80} />
              ) : (
                getCurrencySymbol(baseCurrency, formatNumberWithComma(aggregates.total_balance))
              )}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            background: theme.palette.background.paper,
            borderRadius: 3,
            p: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              bgcolor: "#6366f120",
              borderRadius: 2,
              p: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AccountBalanceWalletIcon sx={{ color: "#6366f1", fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t("customers.baseCurrency")}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {loading ? <Skeleton width={60} /> : baseCurrency}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder={t("customers.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              bgcolor: theme.palette.background.paper,
            },
          }}
        />
      </Box>

      {/* Customers Table */}
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 3,
          boxShadow: "none",
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>{t("customers.colCustomer")}</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>{t("customers.colEmail")}</TableCell>
              {!isMobile && <TableCell sx={{ fontWeight: 700 }}>{t("customers.colWalletBalance")}</TableCell>}
              {!isMobile && <TableCell sx={{ fontWeight: 700 }}>{t("customers.colTransactions")}</TableCell>}
              {!isMobile && <TableCell sx={{ fontWeight: 700 }}>{t("customers.colCreated")}</TableCell>}
              <TableCell sx={{ fontWeight: 700 }} align="center">{t("customers.colActions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    {!isMobile && <TableCell><Skeleton /></TableCell>}
                    {!isMobile && <TableCell><Skeleton /></TableCell>}
                    {!isMobile && <TableCell><Skeleton /></TableCell>}
                    <TableCell><Skeleton /></TableCell>
                  </TableRow>
                ))
              : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6, border: "none" }}>
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                        <PeopleIcon sx={{ fontSize: 48, color: theme.palette.text.disabled }} />
                        {search ? (
                          <Typography color="text.secondary">
                            {t("customers.noCustomersSearch")}
                          </Typography>
                        ) : (
                          <>
                            <Typography
                              sx={{
                                fontWeight: 600,
                                color: theme.palette.text.primary,
                                fontSize: isMobile ? 15 : 16,
                              }}
                            >
                              {t("customers.noCustomersTitle")}
                            </Typography>
                            <Typography
                              sx={{
                                color: theme.palette.text.secondary,
                                fontSize: isMobile ? 12 : 13,
                                maxWidth: 400,
                                lineHeight: 1.5,
                              }}
                            >
                              {t("customers.noCustomersDesc")}
                            </Typography>
                            <Box
                              sx={{
                                display: "flex",
                                gap: 1.5,
                                mt: 1,
                                flexWrap: "wrap",
                                justifyContent: "center",
                              }}
                            >
                              <CustomButton
                                label={t("customers.noCustomersCtaDocs")}
                                variant="primary"
                                size="small"
                                onClick={() => router.push("/documentation")}
                              />
                              <CustomButton
                                label={t("customers.noCustomersCtaKeys")}
                                variant="secondary"
                                size="small"
                                onClick={() => router.push("/developer-keys")}
                              />
                            </Box>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              : customers.map((customer) => (
                  <TableRow
                    key={customer.customer_id}
                    hover
                    sx={{ cursor: "pointer", "&:hover": { bgcolor: theme.palette.action.hover } }}
                    onClick={() => openDetail(customer.customer_id)}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            bgcolor: theme.palette.primary.main + "20",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            color: theme.palette.primary.main,
                            fontSize: 14,
                          }}
                        >
                          {(customer.customer_name || "?").charAt(0).toUpperCase()}
                        </Box>
                        <Typography fontWeight={600}>
                          {customer.customer_name || t("customers.unnamed")}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {customer.email || "-"}
                      </Typography>
                    </TableCell>
                    {!isMobile && (
                      <TableCell>
                        <Typography fontWeight={600}>
                          {getCurrencySymbol(
                            customer.wallet_currency || baseCurrency,
                            formatNumberWithComma(Number(customer.wallet_balance || 0).toFixed(2))
                          )}
                        </Typography>
                      </TableCell>
                    )}
                    {!isMobile && (
                      <TableCell>
                        <Chip
                          label={t("customers.txns", { count: customer.transaction_count })}
                          size="small"
                          sx={{ fontWeight: 600, borderRadius: 2 }}
                        />
                      </TableCell>
                    )}
                    {!isMobile && (
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(customer.createdAt)}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <IconButton size="small">
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}

      {/* Customer Detail Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: "85vh",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {t("customers.customerDetails")}
          </Typography>
          <IconButton onClick={() => setDetailOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ py: 4 }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </Box>
          ) : selectedCustomer ? (
            <Box>
              {/* Customer Info */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: theme.palette.background.default }}>
                  <Typography variant="body2" color="text.secondary">{t("customers.name")}</Typography>
                  <Typography fontWeight={600}>{selectedCustomer.customer?.customer_name || "-"}</Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: theme.palette.background.default }}>
                  <Typography variant="body2" color="text.secondary">{t("customers.email")}</Typography>
                  <Typography fontWeight={600}>{selectedCustomer.customer?.email || "-"}</Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: theme.palette.background.default }}>
                  <Typography variant="body2" color="text.secondary">{t("customers.mobile")}</Typography>
                  <Typography fontWeight={600}>{selectedCustomer.customer?.mobile || "-"}</Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: theme.palette.background.default }}>
                  <Typography variant="body2" color="text.secondary">{t("customers.walletBalance")}</Typography>
                  <Typography fontWeight={700} variant="h6" color="primary">
                    {getCurrencySymbol(
                      selectedCustomer.wallet?.wallet_type || baseCurrency,
                      formatNumberWithComma(Number(selectedCustomer.wallet?.amount || 0).toFixed(2))
                    )}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: theme.palette.background.default }}>
                  <Typography variant="body2" color="text.secondary">{t("customers.company")}</Typography>
                  <Typography fontWeight={600}>{selectedCustomer.customer?.company_name || "-"}</Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: theme.palette.background.default }}>
                  <Typography variant="body2" color="text.secondary">{t("customers.created")}</Typography>
                  <Typography fontWeight={600}>{formatDate(selectedCustomer.customer?.createdAt)}</Typography>
                </Box>
              </Box>

              {/* Wallet Management Buttons */}
              <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<AddIcon />}
                  onClick={() => openWalletModal("credit")}
                  sx={{ flex: isMobile ? "1 1 100%" : "1 1 auto" }}
                >
                  {t("customers.creditWallet")}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<RemoveIcon />}
                  onClick={() => openWalletModal("debit")}
                  sx={{ flex: isMobile ? "1 1 100%" : "1 1 auto" }}
                >
                  {t("customers.debitWallet")}
                </Button>
              </Box>

              {/* Tabs: Overview, Transactions */}
              <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                <Tab label={t("customers.transactions")} />
              </Tabs>

              {/* Transaction History */}
              {detailTab === 0 && (
                <Box>
                  {selectedCustomer.transactions?.data?.length === 0 ? (
                    <Box sx={{ py: 4, textAlign: "center" }}>
                      <Typography color="text.secondary">{t("customers.noCustomerTransactions")}</Typography>
                    </Box>
                  ) : (
                    <>
                      <TableContainer sx={{ borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>{t("customers.colType")}</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{t("customers.colAmount")}</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{t("customers.colStatus")}</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>{t("customers.colDate")}</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(selectedCustomer.transactions?.data || []).map((tx: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <Chip
                                    label={tx.transaction_type || tx.type || "N/A"}
                                    size="small"
                                    color={tx.transaction_type === "CREDIT" ? "success" : "warning"}
                                    variant="outlined"
                                    sx={{ fontWeight: 600, borderRadius: 1.5 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography fontWeight={600}>
                                    {getCurrencySymbol(
                                      tx.currency || baseCurrency,
                                      formatNumberWithComma(Number(tx.amount || 0).toFixed(2))
                                    )}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={tx.status || "N/A"}
                                    size="small"
                                    color={tx.status === "successful" ? "success" : tx.status === "pending" ? "warning" : "default"}
                                    sx={{ fontWeight: 600, borderRadius: 1.5 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {formatDate(tx.createdAt)}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {selectedCustomer.transactions?.pages > 1 && (
                        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                          <Pagination
                            count={selectedCustomer.transactions.pages}
                            page={txPage}
                            onChange={(_, p) => {
                              setTxPage(p);
                              fetchDetailTransactions(selectedCustomer.customer?.customer_id, p);
                            }}
                            size="small"
                            color="primary"
                          />
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">{t("customers.customerNotFound")}</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Management Modal */}
      <Dialog
        open={walletModalOpen}
        onClose={closeWalletModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {walletAction === "credit" ? (
              <AddIcon sx={{ color: "success.main" }} />
            ) : (
              <RemoveIcon sx={{ color: "error.main" }} />
            )}
            <Typography variant="h6" fontWeight={700}>
              {walletAction === "credit" ? t("customers.creditWallet") : t("customers.debitWallet")}
            </Typography>
          </Box>
          <IconButton onClick={closeWalletModal} disabled={walletLoading}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {walletSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {walletSuccess}
            </Alert>
          )}
          {walletError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {walletError}
            </Alert>
          )}

          {selectedCustomer && (
            <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: theme.palette.background.default }}>
              <Typography variant="body2" color="text.secondary">{t("customers.currentBalance")}</Typography>
              <Typography variant="h5" fontWeight={700} color="primary">
                {getCurrencySymbol(
                  selectedCustomer.wallet?.wallet_type || baseCurrency,
                  formatNumberWithComma(Number(selectedCustomer.wallet?.amount || 0).toFixed(2))
                )}
              </Typography>
            </Box>
          )}

          <TextField
            fullWidth
            label={t("customers.amount")}
            type="number"
            value={walletAmount}
            onChange={(e) => setWalletAmount(e.target.value)}
            placeholder={t("customers.enterAmount")}
            disabled={walletLoading}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {getCurrencySymbol(selectedCustomer?.wallet?.wallet_type || baseCurrency, "").replace(/[\d,. ]/g, "") || "$"}
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label={t("customers.descriptionReason")}
            multiline
            rows={3}
            value={walletDescription}
            onChange={(e) => setWalletDescription(e.target.value)}
            placeholder={t("customers.enterDescription")}
            disabled={walletLoading}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeWalletModal} disabled={walletLoading}>
            {t("customers.cancel")}
          </Button>
          <Button
            variant="contained"
            color={walletAction === "credit" ? "success" : "error"}
            onClick={handleWalletOperation}
            disabled={walletLoading || !walletAmount || !walletDescription}
            startIcon={walletLoading && <CircularProgress size={16} />}
          >
            {walletLoading ? t("customers.processing") : walletAction === "credit" ? t("customers.creditWallet") : t("customers.debitWallet")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomersPage;
