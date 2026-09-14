import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { Icon } from "@/styles/uiKit";

/**
 * Backlog #6 — buyer-side / OSS destination tax report. Shows the VAT/GST
 * ACTUALLY COLLECTED FROM BUYERS (off tbl_product_order), grouped by
 * destination country — the figures a merchant needs for a VAT/OSS return,
 * unlike the fee-invoice "Tax report" tab. Amounts are in each order's own
 * currency (no cross-FX), which is what a return actually needs.
 */

interface CountryRow {
  country: string;
  country_name: string;
  currency: string;
  tax_label: string | null;
  tax_rate: number;
  taxable_base: number;
  tax_collected: number;
  reverse_charge_base: number;
  orders: number;
  reverse_charge_orders: number;
  is_eu: boolean;
}
interface CurrencyRow {
  currency: string;
  taxable_base: number;
  tax_collected: number;
  reverse_charge_base: number;
  orders: number;
}
interface ConvertedTotals {
  tax_collected: number;
  taxable_base: number;
  reverse_charge_base: number;
}
interface OssLine {
  country: string;
  country_name: string;
  currency: string;
  tax_rate: number;
  taxable_base: number;
  tax_collected: number;
}
interface ReportData {
  summary: {
    by_currency: CurrencyRow[];
    total_orders: number;
    display_currency?: string;
    currency_symbol?: string;
    converted_totals?: ConvertedTotals;
  };
  by_country: CountryRow[];
  oss_lines: OssLine[];
}

interface NexusRow {
  key: string;
  label: string;
  country: string | null;
  currency: string;
  threshold: number;
  current: number;
  pct: number;
  status: "ok" | "approaching" | "crossed";
  note: string;
}

const RANGES = [
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "this_quarter", label: "This quarter" },
  { value: "all", label: "All time" },
];

const rangeToDates = (range: string): { start?: string; end?: string } => {
  const now = new Date();
  const y = now.getFullYear();
  if (range === "this_year") return { start: new Date(y, 0, 1).toISOString(), end: new Date(y, 11, 31, 23, 59, 59).toISOString() };
  if (range === "last_year") return { start: new Date(y - 1, 0, 1).toISOString(), end: new Date(y - 1, 11, 31, 23, 59, 59).toISOString() };
  if (range === "this_quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return { start: new Date(y, q * 3, 1).toISOString(), end: new Date(y, q * 3 + 3, 0, 23, 59, 59).toISOString() };
  }
  return {};
};

const fmt = (currency: string, n: number) =>
  `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CollectedTaxReport: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [range, setRange] = useState("this_year");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nexus, setNexus] = useState<{ year: number; thresholds: NexusRow[] } | null>(null);

  useEffect(() => {
    axiosBaseApi
      .get("tax/nexus-status")
      .then((res) => setNexus(res.data?.data || res.data))
      .catch(() => setNexus(null));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = rangeToDates(range);
      const params: Record<string, string> = { group_by: "quarter" };
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      const res = await axiosBaseApi.get(API_ENDPOINTS.invoices.collectedTaxReport, { params });
      setData(res.data?.data || res.data);
    } catch (e) {
      setError("Could not load the collected-tax report.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const { start, end } = rangeToDates(range);
      const params: Record<string, string> = { group_by: "quarter" };
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      const res = await axiosBaseApi.get(API_ENDPOINTS.invoices.collectedTaxReportCsv, { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `collected-tax-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("CSV export failed.");
    } finally {
      setDownloading(false);
    }
  };

  const sub = theme.palette.text.secondary;
  const hasRows = !!data && data.by_country.length > 0;

  return (
    <Box data-testid="collected-tax-report">
      {/* Controls */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
        <Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: isMobile ? 16 : 18 }}>
            Collected VAT / GST (by buyer destination)
          </Typography>
          <Typography sx={{ fontSize: 13, color: sub, mt: 0.5, maxWidth: 620 }}>
            Tax you actually collected from buyers, grouped by their country — the figures for a VAT / OSS return.
            Amounts are shown in each order&rsquo;s own currency.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Select
            size="small"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            data-testid="collected-tax-range"
            sx={{ minWidth: 140, fontSize: 14 }}
          >
            {RANGES.map((r) => (
              <MenuItem key={r.value} value={r.value} data-testid={`collected-tax-range-${r.value}`}>
                {r.label}
              </MenuItem>
            ))}
          </Select>
          <CustomButton
            variant="outlined"
            size="medium"
            label={downloading ? "Exporting…" : "Export CSV"}
            onClick={downloadCsv}
            disabled={downloading || !hasRows}
            data-testid="collected-tax-csv-btn"
            startIcon={<Icon name="download" size={16} />}
          />
        </Box>
      </Box>

      {/* Converted grand total in the merchant's display currency (Settings →
          Payments). Per-currency chips stay below for the source figures. */}
      {hasRows && data!.summary.converted_totals && (
        <Box
          data-testid="collected-tax-total"
          sx={{
            px: 2.5, py: 2, mb: 2, borderRadius: "14px",
            border: `1px solid ${theme.palette.divider}`,
            background: `${theme.palette.primary.main}0A`,
          }}
        >
          <Typography sx={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: sub, fontFamily: "var(--font-tech)" }}>
            Total tax collected · {data!.summary.display_currency}
          </Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }} data-testid="collected-tax-total-value">
            {data!.summary.currency_symbol}
            {data!.summary.converted_totals.tax_collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
          <Typography sx={{ fontSize: 12, color: sub, mt: 0.25 }}>
            on {data!.summary.currency_symbol}
            {data!.summary.converted_totals.taxable_base.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} taxable
            {data!.summary.by_currency.length > 1 ? ` · converted from ${data!.summary.by_currency.length} currencies` : ""}
          </Typography>
        </Box>
      )}

      {/* Summary chips (per currency) */}
      {hasRows && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 3 }} data-testid="collected-tax-summary">
          {data!.summary.by_currency.map((c) => (
            <Box
              key={c.currency}
              sx={{
                px: 2, py: 1.25, borderRadius: "12px",
                border: `1px solid ${theme.palette.divider}`,
                background: theme.palette.background.paper,
                minWidth: 180,
              }}
            >
              <Typography sx={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: sub, fontFamily: "var(--font-tech)" }}>
                {c.currency} · tax collected
              </Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {fmt(c.currency, c.tax_collected)}
              </Typography>
              <Typography sx={{ fontSize: 12, color: sub }}>
                on {fmt(c.currency, c.taxable_base)} · {c.orders} order{c.orders === 1 ? "" : "s"}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <PanelCard title="By destination country">
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Typography sx={{ color: theme.palette.error.main, py: 4, textAlign: "center" }} data-testid="collected-tax-error">
            {error}
          </Typography>
        ) : !hasRows ? (
          <Box sx={{ py: 6, textAlign: "center" }} data-testid="collected-tax-empty">
            <Typography sx={{ fontWeight: 600 }}>No collected tax in this period</Typography>
            <Typography sx={{ fontSize: 13, color: sub, mt: 0.5 }}>
              Paid storefront orders with VAT / GST will appear here, grouped by the buyer&rsquo;s country.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" data-testid="collected-tax-table">
              <TableHead>
                <TableRow>
                  <TableCell>Country</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Taxable base</TableCell>
                  <TableCell align="right">Tax collected</TableCell>
                  <TableCell align="right">Orders</TableCell>
                  <TableCell align="right">Reverse-charge</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data!.by_country.map((r) => (
                  <TableRow key={`${r.country}-${r.currency}`} data-testid={`collected-tax-row-${r.country}`}>
                    <TableCell>
                      {r.country_name}
                      {r.is_eu && (
                        <Box component="span" sx={{ ml: 1, fontSize: 10, px: 0.75, py: 0.25, borderRadius: "6px", background: theme.palette.action.hover, color: sub }}>
                          EU/OSS
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{r.tax_label || "—"}</TableCell>
                    <TableCell align="right">{r.tax_rate ? `${r.tax_rate}%` : "—"}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.currency, r.taxable_base)}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(r.currency, r.tax_collected)}</TableCell>
                    <TableCell align="right">{r.orders}</TableCell>
                    <TableCell align="right">
                      {r.reverse_charge_orders > 0 ? `${r.reverse_charge_orders} · ${fmt(r.currency, r.reverse_charge_base)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PanelCard>

      {/* OSS return lines */}
      {hasRows && data!.oss_lines.length > 0 && (
        <Box sx={{ mt: 3 }} data-testid="collected-tax-oss">
          <PanelCard title="EU OSS return lines">
            <Typography sx={{ fontSize: 13, color: sub, mb: 2 }}>
              One line per EU destination for your One-Stop-Shop return (standard-rated B2C sales; reverse-charged B2B excluded).
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Member state</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Taxable amount</TableCell>
                    <TableCell align="right">VAT due</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data!.oss_lines.map((l) => (
                    <TableRow key={`${l.country}-${l.currency}`}>
                      <TableCell>{l.country_name}</TableCell>
                      <TableCell align="right">{l.tax_rate}%</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{fmt(l.currency, l.taxable_base)}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(l.currency, l.tax_collected)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </PanelCard>
        </Box>
      )}
      {/* Registration thresholds (backlog #4) */}
      {nexus && nexus.thresholds && nexus.thresholds.length > 0 && (
        <Box sx={{ mt: 3 }} data-testid="nexus-thresholds">
          <PanelCard title={`Registration thresholds · ${nexus.year}`}>
            <Typography sx={{ fontSize: 13, color: sub, mb: 2 }}>
              Where your sales this year stand against VAT/GST registration thresholds. We warn at 80% and flag once crossed. Not tax advice — confirm with your adviser.
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {nexus.thresholds.map((thr) => {
                const color =
                  thr.status === "crossed" ? theme.palette.error.main : thr.status === "approaching" ? theme.palette.warning.main : theme.palette.success.main;
                const chipLabel = thr.status === "crossed" ? "Crossed" : thr.status === "approaching" ? "Approaching" : "OK";
                return (
                  <Box key={thr.key} data-testid={`nexus-row-${thr.key}`}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{thr.label}</Typography>
                      <Box
                        component="span"
                        data-testid={`nexus-status-${thr.key}`}
                        sx={{ fontSize: 11, fontWeight: 700, px: 1, py: 0.25, borderRadius: "6px", color, background: `${color}1A`, textTransform: "uppercase", letterSpacing: "0.04em" }}
                      >
                        {chipLabel}
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, thr.pct)}
                      sx={{ height: 8, borderRadius: 4, backgroundColor: theme.palette.action.hover, "& .MuiLinearProgress-bar": { backgroundColor: color } }}
                    />
                    <Typography sx={{ fontSize: 12, color: sub, mt: 0.5 }}>
                      {fmt(thr.currency, thr.current)} of {fmt(thr.currency, thr.threshold)} ({thr.pct}%)
                    </Typography>
                    {thr.status !== "ok" && (
                      <Typography sx={{ fontSize: 12, color: theme.palette.text.primary, mt: 0.25 }}>{thr.note}</Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </PanelCard>
        </Box>
      )}
    </Box>
  );
};

export default CollectedTaxReport;
