import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  Chip,
  IconButton,
  Skeleton,
  useTheme,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import CurrencyExchangeRounded from "@mui/icons-material/CurrencyExchangeRounded";
import CodeRounded from "@mui/icons-material/CodeRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
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

/**
 * Customer record "source" classification (mirrors backend
 * dashboardController.ts recent-transactions CASE logic):
 *  - legacy-api-…@dynopay.internal  → synthetic record minted by
 *    legacyApiAuthMiddleware for merchant-API payments that carried no
 *    customer info. Display as "API payments" — never show the fake email.
 *  - recovered-…@dynopay.internal   → placeholder minted by merchantApi
 *    payment recovery. Display as "Recovered payment".
 *  - any other @dynopay.internal    → checkout-created placeholder.
 *  - real email                     → actual customer, shown as-is.
 */
type CustomerKind = "api" | "recovered" | "internal" | "real";

const classifyCustomer = (email?: string | null): CustomerKind => {
  if (!email || !email.endsWith("@dynopay.internal")) return "real";
  if (email.startsWith("legacy-api-")) return "api";
  if (email.startsWith("recovered-")) return "recovered";
  return "internal";
};

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

  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "#E9ECF2";
  const softBg = isDark ? "rgba(255,255,255,0.05)" : "#F6F7F9";

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

  /** Format any amount-ish value with commas and max 2 decimals */
  const fmtAmount = (v: unknown) => formatNumberWithComma(Number(Number(v || 0).toFixed(2)));

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
              fmtAmount(walletAmount)
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

  /** Humanized display fields for a customer record */
  const displayFor = useCallback(
    (name?: string | null, email?: string | null) => {
      const kind = classifyCustomer(email);
      if (kind === "api") {
        return {
          kind,
          name: t("customers.apiCustomerName"),
          email: t("customers.noCustomerDetails"),
          internal: true,
        };
      }
      if (kind === "recovered") {
        return {
          kind,
          name: t("customers.recoveredCustomerName"),
          email: t("customers.noCustomerDetails"),
          internal: true,
        };
      }
      if (kind === "internal") {
        return {
          kind,
          name: name || t("customers.unnamed"),
          email: t("customers.noCustomerDetails"),
          internal: true,
        };
      }
      return { kind, name: name || t("customers.unnamed"), email: email || "-", internal: false };
    },
    [t]
  );

  const eyebrowSx = {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: theme.palette.text.secondary,
    fontFamily: "var(--font-sans)",
  };

  const headCellSx = {
    ...eyebrowSx,
    fontSize: "11.5px",
    borderBottom: `1px solid ${cardBorder}`,
    py: 1.5,
    bgcolor: "transparent",
  };

  const statCards = useMemo(
    () => [
      {
        id: "total-customers",
        label: t("customers.totalCustomers"),
        icon: <PeopleAltRounded sx={{ fontSize: 18 }} />,
        value: formatNumberWithComma(aggregates.total_customers),
      },
      {
        id: "total-balance",
        label: t("customers.totalWalletBalance"),
        icon: <AccountBalanceWalletRounded sx={{ fontSize: 18 }} />,
        value: getCurrencySymbol(baseCurrency, fmtAmount(aggregates.total_balance || 0)),
      },
      {
        id: "base-currency",
        label: t("customers.baseCurrency"),
        icon: <CurrencyExchangeRounded sx={{ fontSize: 18 }} />,
        value: baseCurrency,
      },
    ],
    [aggregates, baseCurrency, t]
  );

  const ApiChip = ({ small }: { small?: boolean }) => (
    <Tooltip title={t("customers.apiRecordHint")} arrow>
      <Chip
        icon={<CodeRounded sx={{ fontSize: small ? 13 : 14 }} />}
        label={t("customers.sourceApi")}
        size="small"
        data-testid="customer-api-chip"
        sx={{
          height: small ? 20 : 22,
          borderRadius: "6px",
          fontSize: small ? "10.5px" : "11px",
          fontWeight: 600,
          fontFamily: "var(--font-sans)",
          bgcolor: softBg,
          color: theme.palette.text.secondary,
          border: `1px solid ${cardBorder}`,
          "& .MuiChip-icon": { color: theme.palette.text.secondary, ml: "6px" },
          cursor: "help",
        }}
      />
    </Tooltip>
  );

  const selectedDisplay = selectedCustomer
    ? displayFor(selectedCustomer.customer?.customer_name, selectedCustomer.customer?.email)
    : null;

  return (
    <Box sx={{ px: { xs: 2, md: 0 }, py: { xs: 1, md: 0 } }}>
      {/* Aggregate stat cards — dashboard design language */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: { xs: "12px", md: "16px" },
          mb: { xs: 2, md: 3 },
        }}
      >
        {statCards.map((card) => (
          <Box
            key={card.id}
            data-testid={`customers-stat-${card.id}`}
            sx={{
              bgcolor: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "14px",
              p: { xs: "16px 18px", md: "18px 22px" },
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={eyebrowSx}>{card.label}</Typography>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: "8px",
                  bgcolor: softBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: theme.palette.text.secondary,
                }}
              >
                {card.icon}
              </Box>
            </Box>
            <Typography
              className="tabular-nums"
              sx={{
                fontSize: { xs: "24px", md: "28px" },
                fontWeight: 700,
                lineHeight: 1.15,
                color: theme.palette.text.primary,
                fontFamily: "var(--font-sans)",
              }}
            >
              {loading ? <Skeleton width={90} /> : card.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Search + count */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
          flexWrap: "wrap",
        }}
      >
        <TextField
          placeholder={t("customers.searchPlaceholder")}
          value={search}
          size="small"
          data-testid="customers-search-input"
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 19, color: theme.palette.text.secondary }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: 380 },
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
              bgcolor: cardBg,
              fontFamily: "var(--font-sans)",
              fontSize: "14px",
              "& fieldset": { borderColor: cardBorder },
            },
          }}
        />
        {!loading && total > 0 && (
          <Typography
            data-testid="customers-count-label"
            sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
          >
            {t("customers.countLabel", { count: total })}
          </Typography>
        )}
      </Box>

      {/* Customers table */}
      <Box
        sx={{
          bgcolor: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={headCellSx}>{t("customers.colCustomer")}</TableCell>
                {!isMobile && <TableCell sx={headCellSx}>{t("customers.colEmail")}</TableCell>}
                <TableCell sx={headCellSx} align="right">{t("customers.colWalletBalance")}</TableCell>
                {!isMobile && <TableCell sx={headCellSx} align="right">{t("customers.colTransactions")}</TableCell>}
                {!isMobile && <TableCell sx={headCellSx}>{t("customers.colCreated")}</TableCell>}
                <TableCell sx={{ ...headCellSx, width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ borderColor: cardBorder }}><Skeleton /></TableCell>
                      {!isMobile && <TableCell sx={{ borderColor: cardBorder }}><Skeleton /></TableCell>}
                      <TableCell sx={{ borderColor: cardBorder }}><Skeleton /></TableCell>
                      {!isMobile && <TableCell sx={{ borderColor: cardBorder }}><Skeleton /></TableCell>}
                      {!isMobile && <TableCell sx={{ borderColor: cardBorder }}><Skeleton /></TableCell>}
                      <TableCell sx={{ borderColor: cardBorder }}><Skeleton /></TableCell>
                    </TableRow>
                  ))
                : customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8, border: "none" }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 56,
                              height: 56,
                              borderRadius: "16px",
                              bgcolor: softBg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <PeopleAltRounded sx={{ fontSize: 28, color: theme.palette.text.disabled }} />
                          </Box>
                          {search ? (
                            <Typography sx={{ color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                              {t("customers.noCustomersSearch")}
                            </Typography>
                          ) : (
                            <>
                              <Typography
                                sx={{
                                  fontWeight: 600,
                                  color: theme.palette.text.primary,
                                  fontSize: isMobile ? 15 : 16,
                                  fontFamily: "var(--font-sans)",
                                }}
                              >
                                {t("customers.noCustomersTitle")}
                              </Typography>
                              <Typography
                                sx={{
                                  color: theme.palette.text.secondary,
                                  fontSize: isMobile ? 12 : 13,
                                  maxWidth: 420,
                                  lineHeight: 1.55,
                                  fontFamily: "var(--font-sans)",
                                }}
                              >
                                {t("customers.noCustomersDesc")}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
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
                : customers.map((customer) => {
                    const d = displayFor(customer.customer_name, customer.email);
                    return (
                      <TableRow
                        key={customer.customer_id}
                        hover
                        data-testid={`customer-row-${customer.customer_id}`}
                        sx={{
                          cursor: "pointer",
                          "&:last-child td": { borderBottom: "none" },
                          "&:hover": { bgcolor: softBg },
                        }}
                        onClick={() => openDetail(customer.customer_id)}
                      >
                        <TableCell sx={{ borderColor: cardBorder, py: "14px" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: "10px",
                                flexShrink: 0,
                                bgcolor: d.internal ? softBg : (isDark ? "rgba(255,255,255,0.1)" : "#111214"),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                color: d.internal
                                  ? theme.palette.text.secondary
                                  : (isDark ? theme.palette.text.primary : "#FFFFFF"),
                                fontSize: 14,
                                fontFamily: "var(--font-sans)",
                              }}
                            >
                              {d.internal ? <CodeRounded sx={{ fontSize: 18 }} /> : d.name.charAt(0).toUpperCase()}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Typography
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: "14px",
                                    fontFamily: "var(--font-sans)",
                                    color: theme.palette.text.primary,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {d.name}
                                </Typography>
                                {d.internal && <ApiChip small />}
                              </Box>
                              {isMobile && (
                                <Typography
                                  sx={{
                                    fontSize: "12px",
                                    color: theme.palette.text.secondary,
                                    fontStyle: d.internal ? "italic" : "normal",
                                    fontFamily: "var(--font-sans)",
                                  }}
                                >
                                  {d.email}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        {!isMobile && (
                          <TableCell sx={{ borderColor: cardBorder }}>
                            <Typography
                              sx={{
                                fontSize: "13.5px",
                                color: theme.palette.text.secondary,
                                fontStyle: d.internal ? "italic" : "normal",
                                fontFamily: "var(--font-sans)",
                              }}
                            >
                              {d.email}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell align="right" sx={{ borderColor: cardBorder }}>
                          <Typography
                            className="tabular-nums"
                            sx={{ fontWeight: 600, fontSize: "14px", fontFamily: "var(--font-sans)" }}
                          >
                            {getCurrencySymbol(
                              customer.wallet_currency || baseCurrency,
                              fmtAmount(customer.wallet_balance || 0)
                            )}
                          </Typography>
                        </TableCell>
                        {!isMobile && (
                          <TableCell align="right" sx={{ borderColor: cardBorder }}>
                            <Typography
                              className="tabular-nums"
                              sx={{ fontSize: "13.5px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
                            >
                              {t("customers.txns", { count: customer.transaction_count })}
                            </Typography>
                          </TableCell>
                        )}
                        {!isMobile && (
                          <TableCell sx={{ borderColor: cardBorder }}>
                            <Typography sx={{ fontSize: "13.5px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                              {formatDate(customer.createdAt)}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell align="right" sx={{ borderColor: cardBorder, pr: 2 }}>
                          <ChevronRightRounded sx={{ fontSize: 20, color: theme.palette.text.disabled, verticalAlign: "middle" }} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Box>
      )}

      {/* Mobile-only bottom clearance (session 72) so the pagination clears the
          fixed support-chat FAB + bottom nav pill on mobile. */}
      {isMobile && totalPages > 1 && <Box sx={{ height: "96px", flexShrink: 0 }} />}

      {/* Customer Detail Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: "16px", maxHeight: "85vh", backgroundImage: "none" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1.5 }}>
          {selectedDisplay && !detailLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "12px",
                  flexShrink: 0,
                  bgcolor: selectedDisplay.internal ? softBg : (isDark ? "rgba(255,255,255,0.1)" : "#111214"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: selectedDisplay.internal
                    ? theme.palette.text.secondary
                    : (isDark ? theme.palette.text.primary : "#FFFFFF"),
                  fontSize: 16,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {selectedDisplay.internal ? <CodeRounded sx={{ fontSize: 20 }} /> : selectedDisplay.name.charAt(0).toUpperCase()}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "17px", fontFamily: "var(--font-sans)" }} noWrap>
                    {selectedDisplay.name}
                  </Typography>
                  {selectedDisplay.internal && <ApiChip />}
                </Box>
                <Typography
                  sx={{
                    fontSize: "12.5px",
                    color: theme.palette.text.secondary,
                    fontStyle: selectedDisplay.internal ? "italic" : "normal",
                    fontFamily: "var(--font-sans)",
                  }}
                  noWrap
                >
                  {selectedDisplay.email}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "var(--font-hero), var(--font-sans)" }}>
              {t("customers.customerDetails")}
            </Typography>
          )}
          <IconButton onClick={() => setDetailOpen(false)} data-testid="customer-detail-close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: cardBorder }}>
          {detailLoading ? (
            <Box sx={{ py: 4 }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </Box>
          ) : selectedCustomer ? (
            <Box>
              {selectedDisplay?.internal && (
                <Box
                  sx={{
                    display: "flex",
                    gap: 1.25,
                    alignItems: "flex-start",
                    p: "12px 14px",
                    borderRadius: "10px",
                    bgcolor: softBg,
                    border: `1px solid ${cardBorder}`,
                    mb: 2.5,
                  }}
                  data-testid="customer-api-hint"
                >
                  <InfoOutlined sx={{ fontSize: 17, color: theme.palette.text.secondary, mt: "1px" }} />
                  <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, lineHeight: 1.55, fontFamily: "var(--font-sans)" }}>
                    {t("customers.apiRecordHint")}
                  </Typography>
                </Box>
              )}

              {/* Customer info grid */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: 1.5,
                  mb: 3,
                }}
              >
                {[
                  { label: t("customers.name"), value: selectedDisplay?.name || "-" },
                  {
                    label: t("customers.email"),
                    value: selectedDisplay?.email || "-",
                    italic: selectedDisplay?.internal,
                  },
                  { label: t("customers.mobile"), value: selectedCustomer.customer?.mobile || "-" },
                  { label: t("customers.company"), value: selectedCustomer.customer?.company_name || "-" },
                  { label: t("customers.created"), value: formatDate(selectedCustomer.customer?.createdAt) },
                ].map((f, i) => (
                  <Box key={i} sx={{ p: "12px 16px", borderRadius: "10px", bgcolor: softBg, border: `1px solid ${cardBorder}` }}>
                    <Typography sx={{ ...eyebrowSx, mb: 0.5 }}>{f.label}</Typography>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: "14px",
                        fontFamily: "var(--font-sans)",
                        fontStyle: f.italic ? "italic" : "normal",
                        color: f.italic ? theme.palette.text.secondary : theme.palette.text.primary,
                        wordBreak: "break-word",
                      }}
                    >
                      {f.value}
                    </Typography>
                  </Box>
                ))}
                <Box
                  sx={{
                    p: "12px 16px",
                    borderRadius: "10px",
                    bgcolor: isDark ? "rgba(255,255,255,0.07)" : "#111214",
                    border: `1px solid ${cardBorder}`,
                  }}
                >
                  <Typography sx={{ ...eyebrowSx, mb: 0.5, color: isDark ? theme.palette.text.secondary : "rgba(255,255,255,0.65)" }}>
                    {t("customers.walletBalance")}
                  </Typography>
                  <Typography
                    className="tabular-nums"
                    sx={{
                      fontWeight: 700,
                      fontSize: "20px",
                      fontFamily: "var(--font-sans)",
                      color: isDark ? theme.palette.text.primary : "#FFFFFF",
                    }}
                  >
                    {getCurrencySymbol(
                      selectedCustomer.wallet?.wallet_type || baseCurrency,
                      fmtAmount(selectedCustomer.wallet?.amount || 0)
                    )}
                  </Typography>
                </Box>
              </Box>

              {/* Wallet Management Buttons */}
              <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                  onClick={() => openWalletModal("credit")}
                  data-testid="customer-credit-btn"
                  sx={{
                    flex: isMobile ? "1 1 100%" : "0 0 auto",
                    textTransform: "none",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                    color: "#0E9F6E",
                    borderColor: isDark ? "rgba(16,185,129,0.4)" : "rgba(14,159,110,0.45)",
                    "&:hover": { borderColor: "#0E9F6E", bgcolor: "rgba(14,159,110,0.06)" },
                  }}
                >
                  {t("customers.creditWallet")}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RemoveIcon sx={{ fontSize: 18 }} />}
                  onClick={() => openWalletModal("debit")}
                  data-testid="customer-debit-btn"
                  sx={{
                    flex: isMobile ? "1 1 100%" : "0 0 auto",
                    textTransform: "none",
                    borderRadius: "10px",
                    fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                    color: theme.palette.error.main,
                    borderColor: isDark ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.45)",
                    "&:hover": { borderColor: theme.palette.error.main, bgcolor: "rgba(239,68,68,0.06)" },
                  }}
                >
                  {t("customers.debitWallet")}
                </Button>
              </Box>

              {/* Transaction history */}
              <Typography sx={{ ...eyebrowSx, mb: 1.5 }}>{t("customers.transactions")}</Typography>
              {selectedCustomer.transactions?.data?.length === 0 ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography sx={{ color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", fontSize: "13.5px" }}>
                    {t("customers.noCustomerTransactions")}
                  </Typography>
                </Box>
              ) : (
                <>
                  <TableContainer sx={{ borderRadius: "10px", border: `1px solid ${cardBorder}` }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={headCellSx}>{t("customers.colType")}</TableCell>
                          <TableCell sx={headCellSx} align="right">{t("customers.colAmount")}</TableCell>
                          <TableCell sx={headCellSx}>{t("customers.colStatus")}</TableCell>
                          <TableCell sx={headCellSx}>{t("customers.colDate")}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(selectedCustomer.transactions?.data || []).map((tx: any, idx: number) => (
                          <TableRow key={idx} sx={{ "&:last-child td": { borderBottom: "none" } }}>
                            <TableCell sx={{ borderColor: cardBorder }}>
                              <Chip
                                label={tx.transaction_type || tx.type || "N/A"}
                                size="small"
                                sx={{
                                  height: 22,
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  fontSize: "11px",
                                  fontFamily: "var(--font-sans)",
                                  bgcolor:
                                    tx.transaction_type === "CREDIT"
                                      ? "rgba(16,185,129,0.12)"
                                      : "rgba(245,158,11,0.12)",
                                  color: tx.transaction_type === "CREDIT" ? "#0E9F6E" : "#B45309",
                                }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ borderColor: cardBorder }}>
                              <Typography className="tabular-nums" sx={{ fontWeight: 600, fontSize: "13.5px", fontFamily: "var(--font-sans)" }}>
                                {getCurrencySymbol(
                                  tx.currency || baseCurrency,
                                  fmtAmount(tx.amount || 0)
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ borderColor: cardBorder }}>
                              <Chip
                                label={tx.status || "N/A"}
                                size="small"
                                sx={{
                                  height: 22,
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  fontSize: "11px",
                                  fontFamily: "var(--font-sans)",
                                  bgcolor:
                                    tx.status === "successful"
                                      ? "rgba(16,185,129,0.12)"
                                      : tx.status === "pending"
                                        ? "rgba(245,158,11,0.12)"
                                        : softBg,
                                  color:
                                    tx.status === "successful"
                                      ? "#0E9F6E"
                                      : tx.status === "pending"
                                        ? "#B45309"
                                        : theme.palette.text.secondary,
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ borderColor: cardBorder }}>
                              <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
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
          ) : (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography sx={{ color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                {t("customers.customerNotFound")}
              </Typography>
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
        PaperProps={{ sx: { borderRadius: "16px", backgroundImage: "none" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {walletAction === "credit" ? (
              <AddIcon sx={{ color: "#0E9F6E" }} />
            ) : (
              <RemoveIcon sx={{ color: "error.main" }} />
            )}
            <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "var(--font-hero), var(--font-sans)" }}>
              {walletAction === "credit" ? t("customers.creditWallet") : t("customers.debitWallet")}
            </Typography>
          </Box>
          <IconButton onClick={closeWalletModal} disabled={walletLoading}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: cardBorder }}>
          {walletSuccess && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: "10px" }}>
              {walletSuccess}
            </Alert>
          )}
          {walletError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
              {walletError}
            </Alert>
          )}

          {selectedCustomer && (
            <Box sx={{ mb: 2, p: "12px 16px", borderRadius: "10px", bgcolor: softBg, border: `1px solid ${cardBorder}` }}>
              <Typography sx={{ ...eyebrowSx, mb: 0.5 }}>{t("customers.currentBalance")}</Typography>
              <Typography className="tabular-nums" sx={{ fontWeight: 700, fontSize: "22px", fontFamily: "var(--font-sans)" }}>
                {getCurrencySymbol(
                  selectedCustomer.wallet?.wallet_type || baseCurrency,
                  fmtAmount(selectedCustomer.wallet?.amount || 0)
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
            data-testid="wallet-amount-input"
            sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
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
            data-testid="wallet-description-input"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={closeWalletModal}
            disabled={walletLoading}
            sx={{ textTransform: "none", borderRadius: "10px", fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}
          >
            {t("customers.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleWalletOperation}
            disabled={walletLoading || !walletAmount || !walletDescription}
            startIcon={walletLoading ? <CircularProgress size={16} /> : undefined}
            data-testid="wallet-submit-btn"
            sx={{
              textTransform: "none",
              borderRadius: "10px",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              boxShadow: "none",
              bgcolor: walletAction === "credit" ? "#0E9F6E" : theme.palette.error.main,
              "&:hover": {
                bgcolor: walletAction === "credit" ? "#0B8459" : theme.palette.error.dark,
                boxShadow: "none",
              },
            }}
          >
            {walletLoading ? t("customers.processing") : walletAction === "credit" ? t("customers.creditWallet") : t("customers.debitWallet")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomersPage;
