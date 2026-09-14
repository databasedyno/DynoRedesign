import CalendarTodayIcon from "@/assets/Icons/calendar-icon.svg";
import CustomDatePicker, {
  DatePickerOpenEvent,
  DatePickerRef,
} from "@/Components/UI/DatePicker";
import useIsMobile from "@/hooks/useIsMobile";
import {
  Box,
  Button,
  SxProps,
  Theme,
  Typography,
  useTheme,
} from "@mui/material";
import { endOfDay, format, isAfter, isValid, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckIconStyled, PeriodTrigger } from "./styled";

import ExpandLessIcon from "@/assets/Icons/ExpendLess-Arrow.svg";
import ExpandMoreIcon from "@/assets/Icons/ExpendMore-Arrow.svg";
import { DateRange, TimePeriod } from "@/utils/types/dashboard";
import Image from "next/image";

export interface TimePeriodOption {
  value: TimePeriod;
  label: string;
}

interface TimePeriodSelectorProps {
  value?: TimePeriod;
  onChange?: (period: TimePeriod) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  sx?: SxProps<Theme>;
}

const getSafeFocusedIndex = (
  options: TimePeriodOption[],
  selectedValue: TimePeriod,
): number => {
  const foundIndex = options.findIndex(
    (option) => option.value === selectedValue,
  );
  return foundIndex >= 0 ? foundIndex : 0;
};

export default function TimePeriodSelector({
  value = "7days",
  onChange,
  dateRange,
  onDateRangeChange,
  sx,
}: TimePeriodSelectorProps) {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const namespaces = ["dashboardLayout", "common"];
  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );

  const timePeriods: TimePeriodOption[] = useMemo(
    () => [
      { value: "7days", label: tDashboard("last7Days") },
      { value: "30days", label: tDashboard("last30Days") },
      { value: "90days", label: tDashboard("last90Days") },
      { value: "custom", label: tDashboard("customPeriod") },
    ],
    [tDashboard],
  );

  const datePickerRef = useRef<DatePickerRef>(null);
  const calendarButtonRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [uncontrolledCustomDateRange, setUncontrolledCustomDateRange] =
    useState<DateRange>({
      startDate: null,
      endDate: null,
    });
  const customDateRange = dateRange ?? uncontrolledCustomDateRange;
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const openDatePicker = useCallback((anchorTarget: HTMLElement) => {
    const openEvent: DatePickerOpenEvent = { currentTarget: anchorTarget };
    datePickerRef.current?.open(openEvent);
  }, []);

  const handleCalendarButtonClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      openDatePicker(event.currentTarget);
    },
    [openDatePicker],
  );

  const handleOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorElement(event.currentTarget);
      setFocusedIndex(getSafeFocusedIndex(timePeriods, value));
    },
    [timePeriods, value],
  );

  const handleClose = useCallback(() => {
    setAnchorElement(null);
    setFocusedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (period: TimePeriod) => {
      onChange?.(period);
      handleClose();
    },
    [handleClose, onChange],
  );

  const handleSelectWithEvent = useCallback(
    (event: React.MouseEvent<HTMLElement>, period: TimePeriod) => {
      if (period !== "custom") {
        handleSelect(period);
        return;
      }

      onChange?.("custom");
      handleClose();

      window.requestAnimationFrame(() => {
        const fallbackTarget = event.currentTarget as HTMLElement;
        const anchorTarget = calendarButtonRef.current ?? fallbackTarget;
        openDatePicker(anchorTarget);
      });
    },
    [handleClose, handleSelect, onChange, openDatePicker],
  );

  const handleCustomDateRangeChange = useCallback(
    (range: DateRange) => {
      const normalizedStart =
        range.startDate && isValid(range.startDate)
          ? startOfDay(range.startDate)
          : null;
      const normalizedEnd =
        range.endDate && isValid(range.endDate)
          ? endOfDay(range.endDate)
          : null;

      const normalizedRange: DateRange = {
        startDate: normalizedStart,
        endDate:
          normalizedStart &&
          normalizedEnd &&
          isAfter(normalizedStart, normalizedEnd)
            ? null
            : normalizedEnd,
      };

      if (dateRange === undefined) {
        setUncontrolledCustomDateRange(normalizedRange);
      }

      onDateRangeChange?.(normalizedRange);
    },
    [dateRange, onDateRangeChange],
  );

  const formattedCustomDateRange = useMemo(() => {
    if (customDateRange.startDate && customDateRange.endDate) {
      if (isMobile) {
        return `${format(customDateRange.startDate, "dd.MM.yy")}-${format(customDateRange.endDate, "dd.MM.yy")}`;
      }

      return `${format(customDateRange.startDate, "MMM dd, yyyy")} - ${format(
        customDateRange.endDate,
        "MMM dd, yyyy",
      )}`;
    }

    if (customDateRange.startDate) {
      return isMobile
        ? format(customDateRange.startDate, "dd.MM.yy")
        : format(customDateRange.startDate, "MMM dd, yyyy");
    }

    return tDashboard("customPeriod");
  }, [
    customDateRange.endDate,
    customDateRange.startDate,
    isMobile,
    tDashboard,
  ]);

  useEffect(() => {
    if (!anchorElement) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((currentIndex) =>
            currentIndex < timePeriods.length - 1 ? currentIndex + 1 : 0,
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((currentIndex) =>
            currentIndex > 0 ? currentIndex - 1 : timePeriods.length - 1,
          );
          break;
        case "Enter":
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < timePeriods.length) {
            handleSelect(timePeriods[focusedIndex].value);
          }
          break;
        case "Escape":
          event.preventDefault();
          handleClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorElement, focusedIndex, handleClose, handleSelect, timePeriods]);

  useEffect(() => {
    if (!anchorElement) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [anchorElement, handleClose]);

  const selectedOption =
    timePeriods.find((option) => option.value === value) ?? timePeriods[0];

  const handleCustomToggleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const nearestButton = event.currentTarget.closest("button");
      if (nearestButton) {
        setAnchorElement(nearestButton);
        setFocusedIndex(getSafeFocusedIndex(timePeriods, value));
      }
    },
    [timePeriods, value],
  );

  return (
    <Box
      ref={wrapperRef}
      sx={{
        position: "relative",
        width: "fit-content",
        mt: Boolean(anchorElement) && isMobile ? "-16px !important" : "0px",
      }}
    >
      {value === "custom" ? (
        <>
          <Button
            ref={calendarButtonRef}
            onClick={handleCalendarButtonClick}
            sx={[
              {
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: isMobile ? "8px 10px" : "9px 16px",
                borderRadius: "6px",
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 500,
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.border.main}`,
                justifyContent: "space-between",
                whiteSpace: "nowrap",
                width: "fit-content",
                height: isMobile ? "32px" : "40px",
                minWidth: isMobile ? "fit-content" : "200px",
                "&:hover": {
                  backgroundColor: "#F5F5F5",
                  borderColor: theme.palette.border.focus,
                },
                "& .separator": {
                  width: "1px",
                  height: isMobile ? "16px" : "20px",
                  backgroundColor: theme.palette.border.main,
                },
              },
              ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
            ]}
          >
            <Image
              src={CalendarTodayIcon}
              alt="calendar"
              width={isMobile ? 13 : 14}
              height={isMobile ? 13 : 14}
            />

            <Typography
              sx={{
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "var(--font-sans)",
                flex: 1,
                textAlign: "left",
              }}
            >
              {formattedCustomDateRange}
            </Typography>

            <Box
              sx={{ display: "flex", alignItems: "center", gap: "14px" }}
              onClick={handleCustomToggleClick}
            >
              <Box className="separator" />
              <Image
                src={ExpandMoreIcon.src}
                width={isMobile ? 8 : 11}
                height={isMobile ? 4 : 6}
                alt="expand"
              />
            </Box>
          </Button>

          <Box sx={{ position: "absolute", width: 0, height: 0, opacity: 0 }}>
            <CustomDatePicker
              ref={datePickerRef}
              value={customDateRange}
              onChange={handleCustomDateRangeChange}
              hideTrigger
            />
          </Box>
        </>
      ) : (
        <PeriodTrigger onClick={handleOpen}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "4px" : "6px",
            }}
          >
            <Box
              component="img"
              src={CalendarTodayIcon.src}
              sx={{
                width: isMobile ? 13 : 14,
                height: isMobile ? 13 : 14,
                mt: "-2px",
              }}
            />
            <Typography
              style={{
                fontWeight: "500",
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "var(--font-sans)",
                lineHeight: 1.2,
                letterSpacing: 0,
                whiteSpace: "nowrap",
              }}
            >
              {selectedOption.label}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Box
              sx={{
                width: 1.1,
                height: isMobile ? 16 : 20,
                backgroundColor: theme.palette.border.main,
              }}
            />
            {!anchorElement ? (
              <Image
                src={ExpandMoreIcon.src}
                width={isMobile ? 8 : 11}
                height={isMobile ? 4 : 6}
                alt="expand"
              />
            ) : (
              <Image
                src={ExpandLessIcon.src}
                width={isMobile ? 8 : 11}
                height={isMobile ? 4 : 6}
                alt="collapse"
              />
            )}
          </Box>
        </PeriodTrigger>
      )}

      {Boolean(anchorElement) && (
        <Box
          sx={{
            position: "absolute",
            top: "0",
            left: 0,
            minWidth: isMobile
              ? "210px"
              : value === "custom"
                ? "260px"
                : "175px",
            border: `1px solid ${theme.palette.border?.main || "rgba(233,236,242,1)"}`,
            borderRadius: "6px",
            backgroundColor: theme.palette.background.paper,
            padding: "7px 8px",
            zIndex: 100,
            boxShadow: "0px 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          <Box
            onClick={handleClose}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0px 6px",
              cursor: "pointer",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Box
                component="img"
                src={CalendarTodayIcon.src}
                sx={{ width: 14, height: 14 }}
              />
              <Typography
                style={{
                  fontWeight: "500",
                  fontSize: isMobile ? "13px" : "15px",
                  fontFamily: "var(--font-sans)",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedOption.label}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <Box
                sx={{
                  width: 1.1,
                  height: isMobile ? 16 : 20,
                  backgroundColor: theme.palette.border.main,
                }}
              />
              <Image
                src={ExpandLessIcon.src}
                width={isMobile ? 8 : 11}
                height={isMobile ? 4 : 6}
                alt="collapse"
              />
            </Box>
          </Box>

          <Box
            sx={{
              mt: "13px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {timePeriods.map((period, index) => (
              <Box
                key={period.value}
                onMouseEnter={() => setFocusedIndex(index)}
                onClick={(event) => handleSelectWithEvent(event, period.value)}
                sx={{
                  borderRadius: "63px",
                  fontSize: isMobile ? "13px" : "15px",
                  fontFamily: "var(--font-sans)",
                  height: "32px",
                  px: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  background:
                    period.value === value || focusedIndex === index
                      ? theme.palette.primary.light
                      : "transparent",
                  "&:hover": {
                    background: theme.palette.primary.light,
                  },
                }}
              >
                {period.label}
                {period.value === value && (
                  <CheckIconStyled sx={{ width: 16, height: 16 }} />
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
