import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Box,
  Typography,
  Tab,
  Tabs,
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
  Select,
  MenuItem,
  FormControl,
  useTheme,
  Tooltip,
} from "@mui/material";
import {
  DownloadRounded,
  PrintRounded,
  FileDownloadRounded,
  ReceiptLongRounded,
  AssessmentRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { pageProps } from "@/utils/types";
import useIsMobile from "@/hooks/useIsMobile";
import useDisplayFx from "@/hooks/useDisplayFx";
import axiosBaseApi from "@/axiosConfig";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import { theme as appTheme } from "@/styles/theme";
import { useSelector } from "react-redux";

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  transaction_id: number;
  company_id: number;
  customer_name: string;
  description: string;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  total_usd: number;
  crypto_currency: string;
  invoice_date: string;
  created_at: string;
}

interface TaxReportData {
  summary: {
    total_revenue: number;
    total_tax: number;
    total_invoices: number;
    group_by: string;
    display_currency?: string;
    currency_symbol?: string;
    usd_to_display_rate?: number;
  };
  by_period: Array<{
    period: string;
    period_label: string;
    revenue: number;
    tax_collected: number;
    invoice_count: number;
  }>;
  by_jurisdiction: Array<{
    country: string;
    tax_rate: number;
    revenue: number;
    tax_collected: number;
    invoice_count: number;
  }>;
}

const InvoicesPage = ({ setPageName, setPageDescription }: pageProps) => {
  const router = useRouter();
  const muiTheme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("common");

  const [activeTab, setActiveTab] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [page, setPage] = useState(1);

  const [taxReport, setTaxReport] = useState<TaxReportData | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [groupBy, setGroupBy] = useState<string>("month");
  const [taxPeriod, setTaxPeriod] = useState<string>("all");

  // "Fiat Everywhere" — resolve the merchant's chosen DISPLAY currency
  // (USD/EUR/GBP/NGN/CAD/AUD) via cached Redis-backed FX rate. Used for the
  // Invoices list (total_usd is USD-canonical → converted client-side) and
  // as a fallback label on the Tax Report (backend already pre-converts
  // those revenue/tax_collected numbers).
  const fx = useDisplayFx();

  // Backend now pre-converts Tax Report numbers on the server. Prefer the
  // display currency + symbol returned in `summary`, fall back to useDisplayFx.
  const taxCurrency =
    taxReport?.summary?.display_currency || fx.currency || "USD";
  const taxSymbol =
    taxReport?.summary?.currency_symbol || fx.symbol || "$";

  const formatTaxAmount = (raw: number | string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${taxSymbol}0.00`;
    return `${taxSymbol}${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Invoices list totals are USD-canonical (`total_usd` column). Convert them
  // client-side via useDisplayFx so they match the Tax Report + Transactions
  // export in the merchant's display currency.
  const formatUsdInDisplay = (usd: number | string) => {
    const converted = fx.formatFromUsd(usd);
    if (converted) return converted;
    const n = Number(usd);
    if (!Number.isFinite(n)) return "$0.00";
    return `$${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // "Fiat Everywhere" — resolve the merchant's chosen DISPLAY currency

  const selectedCompanyId = useSelector(
    (state: any) => state?.companyReducer?.selectedCompanyId
  );

  useEffect(() => {
    if (setPageName && setPageDescription) {
      setPageName(t("invoices.pageName"));
      setPageDescription(t("invoices.pageDescription"));
    }
  }, [setPageName, setPageDescription]);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    setInvoiceLoading(true);
    try {
      const params: Record<string, any> = { page, limit: 20 };
      if (selectedCompanyId) params.company_id = selectedCompanyId;
      const res = await axiosBaseApi.get("/invoices", {
        params,
      });
      const data = res?.data?.data;
      if (data) {
        setInvoices(data.invoices || []);
        setTotalInvoices(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setInvoiceLoading(false);
    }
  }, [page, selectedCompanyId]);

  // Fetch tax report
  const fetchTaxReport = useCallback(async () => {
    setTaxLoading(true);
    try {
      const params: Record<string, string> = { group_by: groupBy };
      if (selectedCompanyId) params.company_id = String(selectedCompanyId);

      if (taxPeriod !== "all") {
        const now = new Date();
        let startDate: Date;

        switch (taxPeriod) {
          case "thisMonth":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "lastMonth":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            params.end_date = new Date(
              now.getFullYear(),
              now.getMonth(),
              0
            ).toISOString();
            break;
          case "thisQuarter": {
            const q = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), q, 1);
            break;
          }
          case "thisYear":
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case "lastYear":
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            params.end_date = new Date(
              now.getFullYear() - 1,
              11,
              31
            ).toISOString();
            break;
          default:
            startDate = new Date(2020, 0, 1);
        }

        params.start_date = startDate.toISOString();
        if (!params.end_date) params.end_date = now.toISOString();
      }

      const res = await axiosBaseApi.get("/invoices/tax-report", { params });
      if (res?.data?.data) {
        setTaxReport(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch tax report:", err);
    } finally {
      setTaxLoading(false);
    }
  }, [groupBy, taxPeriod]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchTaxReport();
    }
  }, [activeTab, fetchTaxReport]);

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      const res = await axiosBaseApi.get(`/invoices/${invoiceId}/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download invoice PDF:", err);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedCompanyId) params.company_id = String(selectedCompanyId);
      if (taxPeriod !== "all") {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;
        switch (taxPeriod) {
          case "thisMonth":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case "lastMonth":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
          case "thisQuarter": {
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            break;
          }
          case "thisYear":
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case "lastYear":
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            break;
          default:
            startDate = new Date(2020, 0, 1);
        }
        params.start_date = startDate.toISOString();
        params.end_date = endDate.toISOString();
      }

      const res = await axiosBaseApi.get("/invoices/tax-report/csv", {
        params,
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `tax-report-${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export CSV:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Head>
        <title>Invoices — DynoPay</title>
      </Head>
      <Box sx={{ px: { xs: "16px", md: 0 } }}>
        {/* Tabs */}
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            mb: 3,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              "& .MuiTab-root": {
                fontFamily: "var(--font-sans)",
                fontSize: isMobile ? 13 : 15,
                textTransform: "none",
              },
            }}
          >
            <Tab
              icon={<ReceiptLongRounded sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={t("invoices.tabInvoices")}
            />
            <Tab
              icon={<AssessmentRounded sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={t("invoices.tabTaxReport")}
            />
          </Tabs>
        </Box>

        {/* INVOICES TAB */}
        {activeTab === 0 && (
          <Box>
            <PanelCard
              title={t("invoices.invoicesTitle", { count: totalInvoices })}
              showHeaderBorder
              headerPadding={appTheme.spacing(2.5)}
              bodyPadding={appTheme.spacing(0)}
            >
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.colInvoiceNumber")}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.colDate")}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.colCustomer")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.colVat")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.colTotal")}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.colPdf")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoiceLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton width={100} />
                            </TableCell>
                            <TableCell>
                              <Skeleton width={80} />
                            </TableCell>
                            <TableCell>
                              <Skeleton width={120} />
                            </TableCell>
                            <TableCell align="right">
                              <Skeleton width={60} />
                            </TableCell>
                            <TableCell align="right">
                              <Skeleton width={80} />
                            </TableCell>
                            <TableCell align="center">
                              <Skeleton
                                variant="circular"
                                width={32}
                                height={32}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      : invoices.length === 0
                        ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              align="center"
                              sx={{ py: 6, border: "none" }}
                            >
                              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                                <Box
                                  sx={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: "50%",
                                    bgcolor: `${muiTheme.palette.primary.main}10`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    mb: 0.5,
                                  }}
                                >
                                  <Typography sx={{ fontSize: 28 }}>📄</Typography>
                                </Box>
                                <Typography
                                  sx={{
                                    fontFamily: "var(--font-sans)",
                                    fontWeight: 600,
                                    color: muiTheme.palette.text.primary,
                                    fontSize: isMobile ? 15 : 16,
                                  }}
                                >
                                  {t("invoices.noInvoicesTitle")}
                                </Typography>
                                <Typography
                                  sx={{
                                    fontFamily: "var(--font-sans)",
                                    color: muiTheme.palette.text.secondary,
                                    fontSize: isMobile ? 12 : 13,
                                    maxWidth: 340,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {t("invoices.noInvoicesDesc")}
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                  <CustomButton
                                    label={t("invoices.noInvoicesCta")}
                                    variant="primary"
                                    size="small"
                                    onClick={() => router.push("/create-pay-link")}
                                  />
                                </Box>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )
                        : invoices.map((inv) => (
                          <TableRow key={inv.invoice_id} hover>
                            <TableCell>
                              <Typography
                                sx={{
                                  fontFamily: "var(--font-sans)",
                                  fontSize: isMobile ? 12 : 14,
                                  color: muiTheme.palette.text.primary,
                                }}
                              >
                                {inv.invoice_number}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                sx={{
                                  fontFamily: "var(--font-sans)",
                                  fontSize: isMobile ? 11 : 13,
                                  color: muiTheme.palette.text.secondary,
                                }}
                              >
                                {formatDate(inv.invoice_date)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                sx={{
                                  fontFamily: "var(--font-sans)",
                                  fontSize: isMobile ? 11 : 13,
                                  color: muiTheme.palette.text.primary,
                                }}
                              >
                                {inv.customer_name}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {parseFloat(String(inv.vat_amount)) > 0 ? (
                                <Chip
                                  label={`${formatUsdInDisplay(inv.vat_amount)} (${inv.vat_rate}%)`}
                                  size="small"
                                  sx={{
                                    fontFamily: "var(--font-sans)",
                                    fontSize: isMobile ? 10 : 12,
                                    backgroundColor: "#22C55E1A",
                                    color: "#22C55E",
                                    fontWeight: 500,
                                  }}
                                />
                              ) : (
                                <Typography
                                  sx={{
                                    fontFamily: "var(--font-sans)",
                                    fontSize: isMobile ? 11 : 13,
                                    color: muiTheme.palette.text.secondary,
                                  }}
                                >
                                  —
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                sx={{
                                  fontFamily: "var(--font-sans)",
                                  fontSize: isMobile ? 12 : 14,
                                  fontWeight: 500,
                                  color: muiTheme.palette.text.primary,
                                }}
                              >
                                {/* "Fiat Everywhere" — `total_usd` is a
                                    USD-canonical amount. Convert into the
                                    merchant's DISPLAY currency (Settings →
                                    Payments) via useDisplayFx so the on-screen
                                    total matches the /transactions export +
                                    the tax report + the CSV export. */}
                                {formatUsdInDisplay(inv.total_usd)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title={t("invoices.downloadPdf")}>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleDownloadPDF(inv.invoice_id)
                                  }
                                  sx={{
                                    color: muiTheme.palette.primary.main,
                                  }}
                                >
                                  <DownloadRounded fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {totalInvoices > 20 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 1,
                    py: 2,
                  }}
                >
                  <CustomButton
                    label={t("invoices.previous")}
                    variant="secondary"
                    size="small"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  />
                  <Typography
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      px: 1,
                    }}
                  >
                    {t("invoices.pageOf", { page, total: Math.ceil(totalInvoices / 20) })}
                  </Typography>
                  <CustomButton
                    label={t("invoices.next")}
                    variant="secondary"
                    size="small"
                    disabled={page >= Math.ceil(totalInvoices / 20)}
                    onClick={() => setPage((p) => p + 1)}
                  />
                </Box>
              )}
            </PanelCard>
            {/* Mobile-only bottom clearance (session 72) so the pager clears the
                fixed support-chat FAB + bottom nav pill on mobile. */}
            {isMobile && totalInvoices > 20 && (
              <Box sx={{ height: "96px", flexShrink: 0 }} />
            )}
          </Box>
        )}

        {/* TAX REPORT TAB */}
        {activeTab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Controls */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <FormControl size="small">
                  <Select
                    value={taxPeriod}
                    onChange={(e) => setTaxPeriod(e.target.value)}
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      minWidth: 140,
                      height: 36,
                    }}
                  >
                    <MenuItem value="all">{t("invoices.allTime")}</MenuItem>
                    <MenuItem value="thisMonth">{t("invoices.thisMonth")}</MenuItem>
                    <MenuItem value="lastMonth">{t("invoices.lastMonth")}</MenuItem>
                    <MenuItem value="thisQuarter">{t("invoices.thisQuarter")}</MenuItem>
                    <MenuItem value="thisYear">{t("invoices.thisYear")}</MenuItem>
                    <MenuItem value="lastYear">{t("invoices.lastYear")}</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <Select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      minWidth: 120,
                      height: 36,
                    }}
                  >
                    <MenuItem value="month">{t("invoices.byMonth")}</MenuItem>
                    <MenuItem value="quarter">{t("invoices.byQuarter")}</MenuItem>
                    <MenuItem value="year">{t("invoices.byYear")}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <CustomButton
                  label={t("invoices.exportCsv")}
                  startIcon={<FileDownloadRounded sx={{ fontSize: 16 }} />}
                  variant="secondary"
                  size="small"
                  onClick={handleExportCSV}
                  sx={{ fontSize: 13 }}
                />
                <CustomButton
                  label={t("invoices.print")}
                  startIcon={<PrintRounded sx={{ fontSize: 16 }} />}
                  variant="secondary"
                  size="small"
                  onClick={handlePrint}
                  sx={{ fontSize: 13 }}
                />
              </Box>
            </Box>

            {/* "Fiat Everywhere" — subtle hint so merchants understand tax
                report numbers are shown in their DISPLAY currency (Settings →
                Payments). Only surfaces the notice when a non-USD currency is
                active + we actually have a rate (otherwise it's just USD @ 1
                and there's nothing to disclose). */}
            {taxReport?.summary?.display_currency &&
              taxReport.summary.display_currency !== "USD" && (
                <Box
                  data-testid="tax-report-fiat-hint"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderRadius: "10px",
                    border: `1px solid ${muiTheme.palette.divider}`,
                    backgroundColor: `${muiTheme.palette.primary.main}0A`,
                    width: "fit-content",
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: isMobile ? 11 : 12,
                      color: muiTheme.palette.text.secondary,
                    }}
                  >
                    {t("invoices.valuesShownIn", {
                      defaultValue:
                        "Amounts shown in {{currency}} (converted from USD @ {{rate}})",
                      currency: taxReport.summary.display_currency,
                      rate:
                        typeof taxReport.summary.usd_to_display_rate ===
                        "number"
                          ? taxReport.summary.usd_to_display_rate.toFixed(4)
                          : "1.0000",
                    })}
                  </Typography>
                </Box>
              )}

            {/* Summary Cards */}
            <Box
              sx={{
                display: "flex",
                gap: isMobile ? 1.5 : 2.5,
                flexWrap: "wrap",
              }}
            >
              {[
                {
                  label: t("invoices.totalRevenue"),
                  value: taxReport
                    ? formatTaxAmount(taxReport.summary.total_revenue)
                    : "—",
                  color: muiTheme.palette.text.primary,
                },
                {
                  label: t("invoices.taxCollected"),
                  value: taxReport
                    ? formatTaxAmount(taxReport.summary.total_tax)
                    : "—",
                  color: "#22C55E",
                },
                {
                  label: t("invoices.totalInvoices"),
                  value: taxReport
                    ? String(taxReport.summary.total_invoices)
                    : "—",
                  color: muiTheme.palette.primary.main,
                },
              ].map((card) => (
                <Box
                  key={card.label}
                  sx={{
                    flex: isMobile ? "1 1 100%" : "1 1 0",
                    minWidth: isMobile ? "100%" : 180,
                    border: "1px solid",
                    borderColor: muiTheme.palette.divider,
                    borderRadius: "14px",
                    p: isMobile ? 2 : 2.5,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: "var(--font-sans)",
                      fontSize: isMobile ? 11 : 13,
                      color: muiTheme.palette.text.secondary,
                      mb: 0.5,
                    }}
                  >
                    {card.label}
                  </Typography>
                  {taxLoading ? (
                    <Skeleton width={80} height={32} />
                  ) : (
                    <Typography
                      sx={{
                        fontFamily: "var(--font-sans)",
                        fontSize: isMobile ? 20 : 28,
                        fontWeight: 500,
                        color: card.color,
                        lineHeight: 1.2,
                      }}
                    >
                      {card.value}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>

            {/* Tax by Period */}
            <PanelCard
              title={t("invoices.taxByPeriod")}
              showHeaderBorder
              headerPadding={appTheme.spacing(2.5)}
              bodyPadding={appTheme.spacing(0)}
            >
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.period")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.revenue")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.taxCollected")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.colInvoices")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {taxLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton width={80} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                          <TableCell align="right"><Skeleton width={30} /></TableCell>
                        </TableRow>
                      ))
                    ) : !taxReport || taxReport.by_period.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Typography
                            sx={{
                              fontFamily: "var(--font-sans)",
                              fontSize: 13,
                              color: muiTheme.palette.text.secondary,
                            }}
                          >
                            {t("invoices.noTaxData")}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      taxReport.by_period.map((row) => (
                        <TableRow key={row.period} hover>
                          <TableCell>
                            <Typography
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {row.period_label}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {formatTaxAmount(row.revenue)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? 12 : 14,
                                color: "#22C55E",
                                fontWeight: 500,
                              }}
                            >
                              {formatTaxAmount(row.tax_collected)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {row.invoice_count}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </PanelCard>

            {/* Tax by Jurisdiction */}
            <PanelCard
              title={t("invoices.taxByJurisdiction")}
              showHeaderBorder
              headerPadding={appTheme.spacing(2.5)}
              bodyPadding={appTheme.spacing(0)}
            >
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.country")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.taxRate")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.taxCollected")}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          color: muiTheme.palette.text.secondary,
                          fontSize: isMobile ? 11 : 13,
                        }}
                      >
                        {t("invoices.revenue")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {taxLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton width={80} /></TableCell>
                          <TableCell align="right"><Skeleton width={40} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                          <TableCell align="right"><Skeleton width={60} /></TableCell>
                        </TableRow>
                      ))
                    ) : !taxReport || taxReport.by_jurisdiction.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          <Typography
                            sx={{
                              fontFamily: "var(--font-sans)",
                              fontSize: 13,
                              color: muiTheme.palette.text.secondary,
                            }}
                          >
                            {t("invoices.noJurisdictionData")}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      taxReport.by_jurisdiction.map((row) => (
                        <TableRow key={row.country} hover>
                          <TableCell>
                            <Typography
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {row.country}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${row.tax_rate}%`}
                              size="small"
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: 11,
                                backgroundColor:
                                  row.tax_rate > 0 ? "#22C55E1A" : "#F3F4F6",
                                color:
                                  row.tax_rate > 0
                                    ? "#22C55E"
                                    : muiTheme.palette.text.secondary,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? 12 : 14,
                                color: "#22C55E",
                                fontWeight: 500,
                              }}
                            >
                              {formatTaxAmount(row.tax_collected)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              sx={{
                                fontFamily: "var(--font-sans)",
                                fontSize: isMobile ? 12 : 14,
                              }}
                            >
                              {formatTaxAmount(row.revenue)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </PanelCard>
          </Box>
        )}
      </Box>
    </>
  );
};

export default InvoicesPage;
