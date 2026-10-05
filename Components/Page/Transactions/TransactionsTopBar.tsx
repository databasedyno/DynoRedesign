import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomDatePicker, { DatePickerRef } from "@/Components/UI/DatePicker";
import useTableCardView from "@/hooks/useTableCardView";
import { Icon, MONO } from "@/styles/uiKit";
import { DateRange } from "@/utils/types/dashboard";
import { TransactionsTopBarProps } from "@/utils/types/transaction";
import { Box, useTheme } from "@mui/material";
import { format } from "date-fns";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerWrapper, SearchContainer, TransactionsTopBarContainer } from "./styled";
import TxRangePresets from "./TxRangePresets";

type ActivePill = { key: string; label: string; onRemove: () => void };

/**
 * ONE toolbar row (2026-10 UX audit #4): search (icon inside, live) · period presets · "Filters"
 * (source / status / payout address / dates live in TransactionsFilterSheet) · active-filter pills.
 */
const TransactionsTopBar: React.FC<
  TransactionsTopBarProps & { initialSearch?: string; initialDateRange?: DateRange; activeFilters?: ActivePill[] }
> = ({
  onSearch,
  onDateRangeChange,
  onOpenFilters,
  activeFilterCount = 0,
  activeFilters,
  initialSearch,
  initialDateRange,
  range = "30d",
  onRangeChange,
}) => {
  const theme = useTheme();
  const cardView = useTableCardView();
  const { t } = useTranslation("transactions");
  const tTransactions = useCallback(
    (key: string, options?: any): string => t(key, { ns: "transactions", ...options }) as unknown as string,
    [t],
  );
  const datePickerRef = useRef<DatePickerRef>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearch || "");
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });

  // ⌘K palette deep-link (?search=) → show it in the input.
  useEffect(() => {
    if (initialSearch && initialSearch !== searchTerm) setSearchTerm(initialSearch);
  }, [initialSearch]);

  // Dates applied from the filter sheet — keep the custom pill label in sync.
  useEffect(() => {
    if (initialDateRange) setDateRange(initialDateRange);
  }, [initialDateRange?.startDate, initialDateRange?.endDate]);

  // Live search (debounced) — the separate search button is gone.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = window.setTimeout(() => onSearch?.(searchTerm), 250);
    return () => window.clearTimeout(id);
  }, [searchTerm]);

  const handleDateRangeChange = (next: DateRange) => {
    setDateRange(next);
    onDateRangeChange?.(next);
  };

  const customRangeLabel = (): string =>
    dateRange.startDate && dateRange.endDate
      ? `${format(dateRange.startDate, "MMM d")} – ${format(dateRange.endDate, "MMM d")}`
      : tTransactions("customShort", { defaultValue: "Custom" });

  const filtersButton = (
    <Box
      component="button"
      type="button"
      data-testid="transactions-filters-btn"
      data-active-count={activeFilterCount}
      aria-label={tTransactions("filters", { defaultValue: "Filters" })}
      onClick={onOpenFilters}
      sx={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        height: 40,
        px: 1.5,
        borderRadius: "10px",
        border: `1px solid ${activeFilterCount ? theme.palette.text.primary : theme.palette.border.main}`,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background-color 150ms ease, border-color 150ms ease",
        "&:hover": { backgroundColor: theme.palette.action.hover },
        "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      }}
    >
      <Icon name="sliders-horizontal" size={16} />
      {tTransactions("filters", { defaultValue: "Filters" })}
      {activeFilterCount > 0 && (
        <Box
          component="span"
          data-testid="transactions-filters-count"
          sx={{ minWidth: 20, height: 20, px: 0.5, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: theme.palette.text.primary, color: theme.palette.background.paper, fontFamily: MONO, fontSize: 11.5, fontWeight: 700, lineHeight: 1 }}
        >
          {activeFilterCount}
        </Box>
      )}
    </Box>
  );

  const rangePresets = (
    <TxRangePresets
      range={range}
      customLabel={customRangeLabel()}
      fullWidth={cardView}
      onChange={(preset) => onRangeChange?.(preset)}
      onOpenCustom={(anchor) => {
        if (cardView) onOpenFilters?.();
        else datePickerRef.current?.open({ currentTarget: anchor });
      }}
    />
  );

  return (
    <TransactionsTopBarContainer
      data-testid="transactions-topbar"
      sx={{ px: { xs: "16px", md: "0px" }, gap: { xs: "8px", md: "12px" } }}
    >
      <SearchContainer
        sx={cardView ? { flex: "1 1 0 !important", minWidth: 0 } : { flex: "1 1 260px !important", minWidth: "220px !important", maxWidth: 440 }}
      >
        <InputField
          inputHeight="40px"
          placeholder={tTransactions("search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch?.(searchTerm);
          }}
          startAdornment={<Icon name="search" size={16} style={{ opacity: 0.55 }} />}
          ariaLabel={tTransactions("search")}
          data-testid="transactions-search-input"
        />
      </SearchContainer>

      {cardView ? (
        <>
          {filtersButton}
          <Box data-testid="transactions-range-row-phone" sx={{ flexBasis: "100%", minWidth: 0, display: "flex" }}>
            {rangePresets}
          </Box>
        </>
      ) : (
        <>
          <DatePickerWrapper sx={{ width: "auto", flexShrink: 0 }}>
            {rangePresets}
            <Box sx={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
              <CustomDatePicker ref={datePickerRef} value={dateRange} onChange={handleDateRangeChange} hideTrigger={true} />
            </Box>
          </DatePickerWrapper>
          {filtersButton}
          {activeFilters?.map((f) => (
            <Box
              key={f.key}
              component="button"
              type="button"
              data-testid={`transactions-topbar-filter-${f.key}`}
              aria-label={tTransactions("removeFilter", { label: f.label, defaultValue: "Remove filter {{label}}" })}
              onClick={f.onRemove}
              sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 0.5, height: 30, pl: 1.25, pr: 0.75, borderRadius: 999, border: `1px solid ${theme.palette.border.main}`, backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", "&:hover": { backgroundColor: theme.palette.action.hover } }}
            >
              {f.label}
              <Icon name="x" size={14} />
            </Box>
          ))}
        </>
      )}
    </TransactionsTopBarContainer>
  );
};

export default TransactionsTopBar;
