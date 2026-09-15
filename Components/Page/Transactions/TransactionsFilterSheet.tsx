import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Drawer, IconButton, useTheme } from "@mui/material";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import CustomButton from "@/Components/UI/Buttons";
import CustomDatePicker, { DatePickerRef } from "@/Components/UI/DatePicker";
import { StatusDot } from "@/Components/UI/StatusDot";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { txStatusTone } from "@/helpers/txStatus";
import { ALLCRYPTOCURRENCIES } from "@/hooks/useWalletData";
import { Icon, MONO } from "@/styles/uiKit";
import { ICustomerTransactions } from "@/utils/types";
import { TxStatusFilter } from "@/utils/types/transaction";
import { STATUS_FILTERS } from "./TransactionsToolbar";
import { SOURCE_OPTIONS, TxFilters, EMPTY_TX_FILTERS, hasDateRange, matchesBaseFilters, matchesStatus } from "./txFilters";

const SHEET_STATUSES: Exclude<TxStatusFilter, "all">[] = ["needs_action", ...STATUS_FILTERS];

interface Props {
  open: boolean;
  onClose: () => void;
  filters: TxFilters;
  rows: ICustomerTransactions[];
  onApply: (next: TxFilters) => void;
}

const OptionChip: React.FC<{ selected: boolean; onClick: () => void; testId: string; children: React.ReactNode }> = ({ selected, onClick, testId, children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  return (
    <Box
      component="button"
      type="button"
      role="option"
      aria-selected={selected}
      data-testid={testId}
      data-selected={selected ? "true" : "false"}
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 38,
        px: 1.5,
        borderRadius: 999,
        border: `1px solid ${selected ? indigo : isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
        backgroundColor: selected ? indigo : "transparent",
        color: selected ? "#FFFFFF" : theme.palette.text.primary,
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
        "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: 2 },
      }}
    >
      {children}
    </Box>
  );
};

/** Phone bottom-sheet with every non-search filter (plan 2.5): Source · Status · Coin · Date range. */
const TransactionsFilterSheet: React.FC<Props> = ({ open, onClose, filters, rows, onApply }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("transactions");
  const [draft, setDraft] = useState<TxFilters>(filters);
  const datePickerRef = useRef<DatePickerRef>(null);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const eyebrowSx = { fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: muted, mb: 1.25 };

  const baseRows = useMemo(() => rows.filter((r) => matchesBaseFilters(r, draft)), [rows, draft]);
  const statusCounts = useMemo(() => {
    const counts = { all: baseRows.length } as Record<TxStatusFilter, number>;
    for (const s of SHEET_STATUSES) counts[s] = 0;
    for (const r of baseRows) for (const s of SHEET_STATUSES) if (matchesStatus(r, s)) counts[s] += 1;
    return counts;
  }, [baseRows]);
  const resultCount = useMemo(() => baseRows.filter((r) => matchesStatus(r, draft.selectedStatus)).length, [baseRows, draft.selectedStatus]);

  const statusLabel = (s: TxStatusFilter) =>
    s === "all"
      ? t("statusAll", { defaultValue: "All" })
      : s === "needs_action"
        ? t("needsAction", { defaultValue: "Needs action" })
        : s === "awaiting_payment"
          ? t("awaitingShort", { defaultValue: "Awaiting" })
          : String(t(s));

  const dateLabel = hasDateRange(draft.dateRange)
    ? `${format(draft.dateRange.startDate as Date, "d MMM yyyy")} – ${format(draft.dateRange.endDate as Date, "d MMM yyyy")}`
    : t("filterSheet.anyDate", { defaultValue: "Any date" });

  const clearAll = () => setDraft({ ...EMPTY_TX_FILTERS, searchTerm: draft.searchTerm });
  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      transitionDuration={{ enter: 240, exit: 180 }}
      PaperProps={{
        "data-testid": "tx-filter-sheet",
        sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90dvh", display: "flex", flexDirection: "column", backgroundColor: theme.palette.background.paper, backgroundImage: "none" },
      } as any}
      BackdropProps={{ sx: { backgroundColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(10,10,15,0.35)", backdropFilter: "blur(2px)" } }}
    >
      <Box sx={{ display: "flex", justifyContent: "center", pt: 1.25 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(10,10,15,0.14)" }} />
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, pt: 1.25, pb: 1.5, borderBottom: `1px solid ${border}` }}>
        <Box component="h2" sx={{ m: 0, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, color: theme.palette.text.primary }}>
          {t("filterSheet.title", { defaultValue: "Filters" })}
        </Box>
        <IconButton onClick={onClose} data-testid="tx-filter-sheet-close" aria-label={t("filterSheet.close", { defaultValue: "Close" })} size="small" sx={{ color: theme.palette.text.secondary }}>
          <Icon name="x" size={18} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2.5, display: "grid", gap: 3 }}>
        <Box data-testid="tx-filter-source">
          <Box sx={eyebrowSx}>{t("filterSheet.source", { defaultValue: "Source" })}</Box>
          <Box role="listbox" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {SOURCE_OPTIONS.map((o) => (
              <OptionChip key={o.value} selected={draft.selectedSource === o.value} onClick={() => setDraft({ ...draft, selectedSource: o.value })} testId={`tx-filter-source-${o.value}`}>
                {t(o.key, { defaultValue: o.fallback })}
              </OptionChip>
            ))}
          </Box>
        </Box>

        <Box data-testid="tx-filter-status">
          <Box sx={eyebrowSx}>{t("filterSheet.status", { defaultValue: "Status" })}</Box>
          <Box role="listbox" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {(["all", ...SHEET_STATUSES] as TxStatusFilter[])
              .filter((s) => s === "all" || s === "needs_action" || statusCounts[s] > 0 || draft.selectedStatus === s)
              .map((s) => {
                const selected = draft.selectedStatus === s;
                return (
                  <OptionChip key={s} selected={selected} onClick={() => setDraft({ ...draft, selectedStatus: s })} testId={`tx-filter-status-${s}`}>
                    {s === "needs_action" ? (
                      <Icon name="circle-alert" size={13} color={selected ? "#fff" : "#D97706"} />
                    ) : s !== "all" ? (
                      <StatusDot tone={txStatusTone(s)} sx={{ gap: 0, ...(selected ? { "& span": { backgroundColor: "#fff", borderColor: "#fff" } } : {}) }} />
                    ) : null}
                    <Box component="span" sx={{ textTransform: "capitalize" }}>{statusLabel(s)}</Box>
                    <Box component="span" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 600, opacity: 0.75 }}>{statusCounts[s].toLocaleString()}</Box>
                  </OptionChip>
                );
              })}
          </Box>
        </Box>

        <Box data-testid="tx-filter-wallet">
          <Box sx={eyebrowSx}>{t("filterSheet.wallet", { defaultValue: "Coin" })}</Box>
          <Box role="listbox" sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <OptionChip selected={draft.selectedWallet === "all"} onClick={() => setDraft({ ...draft, selectedWallet: "all" })} testId="tx-filter-wallet-all">
              {t("allWallets", { defaultValue: "All wallets" })}
            </OptionChip>
            {ALLCRYPTOCURRENCIES.map((c, i) => {
              const key = `wallet${i + 1}`;
              return (
                <OptionChip key={key} selected={draft.selectedWallet === key} onClick={() => setDraft({ ...draft, selectedWallet: key })} testId={`tx-filter-wallet-${c.code}`}>
                  <Box component="img" src={(c.icon as any)?.src || (c.icon as any)} alt="" sx={{ width: 16, height: 16, borderRadius: "50%" }} />
                  <Box component="span" sx={{ fontFamily: MONO, fontSize: 12.5 }}>{c.code}</Box>
                </OptionChip>
              );
            })}
          </Box>
        </Box>

        <Box data-testid="tx-filter-date">
          <Box sx={eyebrowSx}>{t("filterSheet.dateRange", { defaultValue: "Date range" })}</Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Box
              component="button"
              type="button"
              data-testid="tx-filter-date-trigger"
              onClick={(e: React.MouseEvent<HTMLElement>) => datePickerRef.current?.open(e)}
              sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, minHeight: 44, px: 1.5, borderRadius: "12px", border: `1px solid ${border}`, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: hasDateRange(draft.dateRange) ? theme.palette.text.primary : muted, textAlign: "left" }}
            >
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <Icon name="calendar" size={16} />
                <Box component="span" data-testid="tx-filter-date-label" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>{dateLabel}</Box>
              </Box>
              <Icon name="chevron-down" size={16} />
            </Box>
            {hasDateRange(draft.dateRange) && (
              <IconButton onClick={() => setDraft({ ...draft, dateRange: { startDate: null, endDate: null } })} data-testid="tx-filter-date-clear" aria-label={t("filterSheet.clearDates", { defaultValue: "Clear dates" })} sx={{ border: `1px solid ${border}`, borderRadius: "12px", minWidth: 44, minHeight: 44 }}>
                <Icon name="x" size={16} />
              </IconButton>
            )}
          </Box>
          <Box sx={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
            <CustomDatePicker ref={datePickerRef} value={draft.dateRange} onChange={(r) => setDraft({ ...draft, dateRange: r })} hideTrigger />
          </Box>
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0, display: "flex", gap: 1.25, px: 2.5, pt: 1.5, pb: "calc(16px + env(safe-area-inset-bottom))", borderTop: `1px solid ${border}` }}>
        <Box sx={{ flex: "0 0 auto", "& button": { minHeight: 46, px: 2 } }}>
          <CustomButton label={t("filterSheet.clearAll", { defaultValue: "Clear all" })} variant="secondary" onClick={clearAll} data-testid="tx-filter-clear-all" />
        </Box>
        <Box sx={{ flex: 1, "& button": { width: "100%", minHeight: 46 } }}>
          <CustomButton
            label={t("filterSheet.show", { count: resultCount, defaultValue: "Show {{count}} results" })}
            variant="primary"
            onClick={apply}
            data-testid="tx-filter-apply"
          />
        </Box>
      </Box>
    </Drawer>
  );
};

export default TransactionsFilterSheet;
