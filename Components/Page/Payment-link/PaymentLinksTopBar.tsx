import CustomDatePicker, { DatePickerRef } from "@/Components/UI/DatePicker";
import CalendarIcon from "@/assets/Icons/calendar-icon.svg";
import SearchIcon from "@/assets/Icons/search-icon.svg";
import useIsMobile from "@/hooks/useIsMobile";
import { DateRange } from "@/utils/types/dashboard";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, InputBase, MenuItem, Select, Typography, useTheme } from "@mui/material";
import { format } from "date-fns";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DatePickerTriggerButton,
  DatePickerWrapper,
  SearchIconButton,
} from "../Transactions/styled";
import { brandFg } from "@/constants/theme";

export type PaymentLinkStatusFilter = "all" | "active" | "earning" | "expiring" | "completed" | "expired" | "pending";
/** "links" = hand-made pay links & campaigns · "orders" = storefront order checkouts (auto-created, view-only). */
export type PaymentLinkKind = "links" | "orders";

interface PaymentLinksTopBarProps {
  onSearch: (value: string) => void;
  onStatusFilter: (status: PaymentLinkStatusFilter) => void;
  onDateFilter: (start: string, end: string) => void;
  statusFilter: PaymentLinkStatusFilter;
  kind: PaymentLinkKind;
  onKindChange: (kind: PaymentLinkKind) => void;
  /** Number of storefront order links — the segment is hidden when there are none. */
  orderCount: number;
}

/**
 * PaymentLinksTopBar — filter row for `/pay-links`.
 *
 * Cleaned up 2026-07-05: the two raw `<input type="date">` fields (which
 * rendered differently on every browser and looked completely unstyled
 * next to the app's other filter chips) were replaced with the same
 * `CustomDatePicker` component the Transactions page uses. This gives us
 * a single, consistent date-range experience across every merchant-facing
 * table (M3 — unified filter bar).
 */
const PaymentLinksTopBar = ({
  onSearch,
  onStatusFilter,
  onDateFilter,
  statusFilter,
  kind,
  onKindChange,
  orderCount,
}: PaymentLinksTopBarProps) => {
  const { t } = useTranslation("paymentLinks");
  const isMobile = useIsMobile("md");
  const theme = useTheme();

  const datePickerRef = useRef<DatePickerRef>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  const handleDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range);
      const s = range.startDate ? format(range.startDate, "yyyy-MM-dd") : "";
      const e = range.endDate ? format(range.endDate, "yyyy-MM-dd") : "";
      onDateFilter(s, e);
    },
    [onDateFilter],
  );

  const handleCalendarButtonClick = (e: React.MouseEvent<HTMLElement>) => {
    if (datePickerRef.current) datePickerRef.current.open(e);
  };

  const formatDateRange = (): string => {
    if (dateRange.startDate && dateRange.endDate) {
      if (isMobile) {
        return `${format(dateRange.startDate, "dd.MM.yy")}-${format(
          dateRange.endDate,
          "dd.MM.yy",
        )}`;
      }
      return `${format(dateRange.startDate, "MMM dd, yyyy")} - ${format(
        dateRange.endDate,
        "MMM dd, yyyy",
      )}`;
    }
    if (dateRange.startDate) {
      return isMobile
        ? format(dateRange.startDate, "dd.MM.yy")
        : format(dateRange.startDate, "MMM dd, yyyy");
    }
    return isMobile ? "Period" : "Select date range";
  };

  const inputSx = {
    height: isMobile ? "32px" : "42px",
    borderRadius: "10px",
    border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E9ECF2"}`,
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF",
    px: "12px",
    fontFamily: "var(--font-sans)",
    fontSize: isMobile ? "10px" : "13px",
    color: theme.palette.text.primary,
  };

  const selectSx = {
    ...inputSx,
    "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    "& .MuiSelect-select": {
      py: 0,
      display: "flex",
      alignItems: "center",
    },
  };

  const segBtn = (value: PaymentLinkKind, label: string) => {
    const active = kind === value;
    return (
      <Box
        key={value}
        component="button"
        type="button"
        role="tab"
        aria-selected={active}
        data-testid={`paylinks-kind-${value}`}
        onClick={() => onKindChange(value)}
        sx={{
          border: "none",
          cursor: "pointer",
          borderRadius: "999px",
          px: 1.5,
          height: isMobile ? 28 : 32,
          fontFamily: "var(--font-sans)",
          fontSize: isMobile ? 12 : 13,
          fontWeight: 700,
          whiteSpace: "nowrap",
          color: active ? theme.palette.getContrastText(theme.palette.primary.main) : theme.palette.text.secondary,
          backgroundColor: active ? theme.palette.primary.main : "transparent",
          transition: "background-color 140ms ease, color 140ms ease",
          "&:hover": { color: active ? undefined : theme.palette.text.primary },
        }}
      >
        {label}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: isMobile ? "stretch" : "center",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? "8px" : "12px",
        p: { xs: "0px 16px", md: "0px" },
        flexWrap: "wrap",
      }}
    >
      {/* Links | Orders segment — storefront order checkouts are auto-created
          and view-only, so they no longer masquerade as hand-made links. */}
      {orderCount > 0 && (
        <Box
          role="tablist"
          data-testid="paylinks-kind-segment"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.25,
            p: "3px",
            borderRadius: "999px",
            border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E9ECF2"}`,
            backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF",
            alignSelf: isMobile ? "flex-start" : "center",
          }}
        >
          {segBtn("links", t("kindLinks", { defaultValue: "Links" }))}
          {segBtn("orders", t("kindOrders", { defaultValue: "Orders ({{count}})", count: orderCount }))}
        </Box>
      )}

      {/* Search */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flex: 1,
          minWidth: isMobile ? "100%" : "200px",
          maxWidth: isMobile ? "100%" : "280px",
        }}
      >
        <InputBase
          placeholder={t("searchInputPlaceholder")}
          onChange={(e) => onSearch(e.target.value)}
          sx={{ ...inputSx, width: "100%" }}
        />
        <SearchIconButton tabIndex={-1} aria-hidden disableRipple sx={{ pointerEvents: "none" }}>
          <Image
            src={SearchIcon}
            alt=""
            width={20}
            height={20}
            className="themed-icon-primary"
          />
        </SearchIconButton>
      </Box>

      {/* Date-range picker — SAME component as /transactions for consistency */}
      <DatePickerWrapper>
        <DatePickerTriggerButton
          ref={buttonRef}
          onClick={handleCalendarButtonClick}
        >
          <Image
            src={CalendarIcon}
            alt="calendar"
            width={14}
            height={14}
            className="themed-icon"
            style={{ marginTop: "-3px" }}
          />
          <Typography className="date-text">{formatDateRange()}</Typography>
          <Box className="separator" />
          <KeyboardArrowDownIcon className="arrow-icon" />
        </DatePickerTriggerButton>

        <Box
          sx={{
            position: "absolute",
            width: 0,
            height: 0,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <CustomDatePicker
            ref={datePickerRef}
            value={dateRange}
            onChange={handleDateRangeChange}
            hideTrigger={true}
          />
        </Box>
      </DatePickerWrapper>

      {/* Status filter */}
      <Select
        value={statusFilter}
        onChange={(e) => onStatusFilter(e.target.value as PaymentLinkStatusFilter)}
        size="small"
        displayEmpty
        data-testid="paylinks-status-filter"
        inputProps={{ "aria-label": t("statusFilterLabel", { defaultValue: "Filter by status" }) }}
        sx={{ ...selectSx, minWidth: isMobile ? "100%" : "170px" }}
      >
        <MenuItem value="all" data-testid="paylinks-status-all">{t("allStatuses")}</MenuItem>
        <MenuItem value="active" data-testid="paylinks-status-active">{t("statusActive")}</MenuItem>
        <MenuItem value="earning" data-testid="paylinks-status-earning">{t("statusEarning", { defaultValue: "Earning (30d)" })}</MenuItem>
        <MenuItem value="expiring" data-testid="paylinks-status-expiring">{t("statusExpiringSoon", { defaultValue: "Expiring soon" })}</MenuItem>
        <MenuItem value="completed" data-testid="paylinks-status-completed">{t("statusPaid")}</MenuItem>
        <MenuItem value="expired" data-testid="paylinks-status-expired">{t("statusExpired")}</MenuItem>
        <MenuItem value="pending" data-testid="paylinks-status-pending">{t("statusPending")}</MenuItem>
      </Select>

      {/* Clear-range button — only when a range is set */}
      {(dateRange.startDate || dateRange.endDate) && (
        <Box
          component="button"
          onClick={() => {
            setDateRange({ startDate: null, endDate: null });
            onDateFilter("", "");
          }}
          sx={{
            border: "none",
            background: "none",
            color: brandFg(theme.palette.mode === "dark"),
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            whiteSpace: "nowrap",
            p: "4px 8px",
            borderRadius: "4px",
            "&:hover": { bgcolor: theme.palette.primary.main + "10" },
          }}
        >
          {t("clearFilters", { defaultValue: "Clear" })}
        </Box>
      )}
    </Box>
  );
};

export default PaymentLinksTopBar;
