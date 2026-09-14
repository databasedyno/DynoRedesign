import React, { useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl, FormControlLabel, MenuItem, Select, Skeleton, Stack, TextField, Typography, useTheme } from "@mui/material";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import axiosBaseApi from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { CardSx, RANGE_PRESETS, amountLabel, coinOf, coinTransactionsHref, fiatLabel, formatDate, payerLabel, statusMeta } from "./payoutsHelpers";

interface Props {
  companyId: number | null;
  cardSx: CardSx;
  sym: string;
  loading: boolean;
  txns: any[];
}

/** Recent settlements list + date-ranged payout history CSV export. */
const RecentSettlementsCard: React.FC<Props> = ({ companyId, cardSx, sym, loading, txns }) => {
  const router = useRouter();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("common");

  const [exportRange, setExportRange] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [settledOnly, setSettledOnly] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toast = (message: string, severity: "success" | "error") =>
    dispatch({ type: TOAST_SHOW, payload: { message, severity } });

  const handleExportPayouts = async () => {
    if (!companyId || exporting) return;

    let dateFrom: string;
    let dateTo: string;
    if (exportRange === "custom") {
      if (!customFrom || !customTo) {
        toast(t("payouts.pickBothDates", { defaultValue: "Pick both a start and end date" }), "error");
        return;
      }
      const f = new Date(`${customFrom}T00:00:00`);
      const toDate = new Date(`${customTo}T23:59:59.999`);
      if (f > toDate) {
        toast(t("payouts.startBeforeEnd", { defaultValue: "Start date must be before the end date" }), "error");
        return;
      }
      dateFrom = f.toISOString();
      dateTo = toDate.toISOString();
    } else {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - parseInt(exportRange, 10));
      dateFrom = from.toISOString();
      dateTo = to.toISOString();
    }

    setExporting(true);
    try {
      const res = await axiosBaseApi.post(
        "/wallet/transactions/export",
        { date_from: dateFrom, date_to: dateTo, company_id: String(companyId), settled_only: settledOnly },
        { responseType: "blob" },
      );
      const blob = new Blob([res.data], { type: (res.headers?.["content-type"] as string | undefined) || "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `payout_history_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast(t("payouts.exported", { defaultValue: "Payout history exported" }), "success");
    } catch {
      toast(t("payouts.exportFailed", { defaultValue: "Export failed. Please try again." }), "error");
    } finally {
      setExporting(false);
    }
  };

  const dateFieldSx = { width: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } };

  return (
    <Box sx={cardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700 }}>{t("payouts.recentSettlements", { defaultValue: "Recent settlements" })}</Typography>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" justifyContent="flex-end">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={exportRange}
              onChange={(e) => setExportRange(e.target.value as string)}
              data-testid="payouts-export-range-select"
              sx={{ borderRadius: 2, fontSize: 13 }}
            >
              {RANGE_PRESETS.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {t(`payouts.range_${r.value}`, { defaultValue: r.label })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {exportRange === "custom" && (
            <>
              <TextField
                size="small"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                label={t("payouts.dateFrom", { defaultValue: "From" })}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: customTo || undefined, "data-testid": "payouts-export-custom-from" }}
                sx={dateFieldSx}
              />
              <TextField
                size="small"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                label={t("payouts.dateTo", { defaultValue: "To" })}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: customFrom || undefined, "data-testid": "payouts-export-custom-to" }}
                sx={dateFieldSx}
              />
            </>
          )}
          <FormControlLabel
            control={<Checkbox size="small" checked={settledOnly} onChange={(e) => setSettledOnly(e.target.checked)} data-testid="payouts-export-settled-only" />}
            label={t("payouts.settledOnly", { defaultValue: "Settled only" })}
            sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 13 } }}
          />
          <Button
            size="small"
            variant="outlined"
            disabled={exporting || !companyId}
            onClick={handleExportPayouts}
            data-testid="payouts-export-csv-btn"
            startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadRounded />}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {exporting ? t("payouts.exporting", { defaultValue: "Exporting\u2026" }) : t("payouts.exportCsv", { defaultValue: "Export CSV" })}
          </Button>
          <Button size="small" endIcon={<ArrowForwardRounded />} onClick={() => router.push("/transactions")} sx={{ textTransform: "none" }}>
            {t("payouts.viewAll", { defaultValue: "View all" })}
          </Button>
        </Stack>
      </Stack>
      {loading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={40} />
          ))}
        </Stack>
      ) : txns.length === 0 ? (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, py: 2, textAlign: "center" }}>
          {t("payouts.noPaymentsYet", { defaultValue: "No payments yet. Your settled payments will appear here." })}
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={0}>
          {txns.slice(0, 6).map((tx, i) => {
            const meta = statusMeta(tx?.status);
            const who = payerLabel(tx);
            const date = formatDate(tx?.createdAt || tx?.created_at);
            return (
              <Stack
                key={tx?.id || i}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                role="link"
                tabIndex={0}
                aria-label={t("payouts.viewCoinTransactions", { defaultValue: "View {{coin}} transactions", coin: coinOf(tx) || "" })}
                onClick={() => router.push(coinTransactionsHref(tx))}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") router.push(coinTransactionsHref(tx)); }}
                sx={{ py: 1.25, px: 0.75, mx: -0.75, borderRadius: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" }, "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 } }}
                data-testid={`payouts-settlement-row-${i}`}
                data-coin={coinOf(tx) || ""}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                    {amountLabel(tx, sym)}
                    {fiatLabel(tx) && (
                      <Box component="span" data-testid={`payouts-settlement-fiat-${i}`} sx={{ color: theme.palette.text.secondary, fontWeight: 500, fontSize: 13, ml: 0.75 }}>
                        {"\u2248"} {fiatLabel(tx)}
                      </Box>
                    )}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {who || "\u2014"}
                    {date ? ` \u00b7 ${date}` : ""}
                  </Typography>
                </Box>
                <Chip size="small" label={meta.label} sx={{ color: meta.color, bgcolor: `${meta.color}1A`, fontWeight: 700, textTransform: "capitalize" }} />
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default RecentSettlementsCard;
