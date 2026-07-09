import useIsMobile from "@/hooks/useIsMobile";
import { DateRange } from "@/utils/types/dashboard";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Popover, Typography, useTheme } from "@mui/material";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarGrid,
  CalendarHeader,
  CalendarHeaderText,
  ContentContainer,
  DateButton,
  DateCellWrapper,
  DividerLine,
  NavigationButton,
  PresetItem,
  PresetsSidebar,
  PresetTitle,
  StyledDatePickerContainer,
  TriggerButton,
  WeekdayCell,
  WeekdayHeader,
} from "./styled";
import {
  detectPreset,
  getPresetDates,
  rangeHasFutureDate,
  sanitizeRange,
} from "./utils";

export interface DatePickerProps {
  datePickerType?: "single" | "range";
  value?: DateRange;
  onChange?: (dateRange: DateRange) => void;
  onPresetChange?: (preset: string) => void;
  onAudit?: (event: {
    type: "future_date_blocked" | "future_range_sanitized";
    attempted?: DateRange | Date;
    applied?: DateRange;
    today: Date;
  }) => void;
  showPresets?: boolean;
  className?: string;
  placeholder?: string;
  buttonText?: string;
  fullWidth?: boolean;
  hideTrigger?: boolean;
  trigger?:
    | React.ReactElement
    | ((
        onClick: (event: React.MouseEvent<HTMLElement>) => void,
      ) => React.ReactElement);
  disableFutureDates?: boolean;
  blockedDateMessage?: string;
  noscriptStartDateName?: string;
  noscriptEndDateName?: string;
}

type PresetType =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "last7Days"
  | "last30Days";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

interface CalendarMonthProps {
  month: Date;
  maxDate: Date;
  minDate: Date;
  disableFutureDates: boolean;
  selectedRange: DateRange;
  onDateClick: (date: Date) => void;
  hoverDate: Date | null;
  onDateHover: (date: Date | null) => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  showLeftArrow?: boolean;
  showRightArrow?: boolean;
}

const PRESETS: Array<{ key: PresetType; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "last7Days", label: "Last 7 Days" },
  { key: "last30Days", label: "Last 30 Days" },
];

interface DayCellProps {
  day: Date;
  inRange: boolean;
  isStart: boolean;
  isEnd: boolean;
  isWeekStart: boolean;
  isWeekEnd: boolean;
  selected: boolean;
  isDisabled: boolean;
  onDateClick: (date: Date) => void;
  onDateHover: (date: Date | null) => void;
}

const DayCell: React.FC<DayCellProps> = React.memo(
  ({
    day,
    inRange,
    isStart,
    isEnd,
    isWeekStart,
    isWeekEnd,
    selected,
    isDisabled,
    onDateClick,
    onDateHover,
  }) => {
    const handleClick = useCallback(() => onDateClick(day), [onDateClick, day]);
    const handleMouseEnter = useCallback(() => {
      if (!isDisabled) {
        onDateHover(day);
      }
    }, [onDateHover, day, isDisabled]);
    const handleMouseLeave = useCallback(() => {
      onDateHover(null);
    }, [onDateHover]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        let neighbor: Date | null = null;
        switch (e.key) {
          case "ArrowLeft":
            neighbor = subDays(day, 1);
            break;
          case "ArrowRight":
            neighbor = addDays(day, 1);
            break;
          case "ArrowUp":
            neighbor = subDays(day, 7);
            break;
          case "ArrowDown":
            neighbor = addDays(day, 7);
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            onDateClick(day);
            return;
        }
        if (neighbor) {
          e.preventDefault();
          const selector = `[data-date="${neighbor.toISOString()}"]`;
          const el = document.querySelector(selector) as HTMLElement | null;
          if (el) {
            el.focus();
          }
        }
      },
      [day, onDateClick],
    );

    return (
      <DateCellWrapper
        inRange={!!(inRange && !isStart && !isEnd)}
        isStart={!!(isStart && !isEnd)}
        isEnd={!!(isEnd && !isStart)}
        isWeekStart={isWeekStart}
        isWeekEnd={isWeekEnd}
      >
        <DateButton
          selected={!!selected}
          iscurrentmonth={true}
          isStart={!!(isStart && !isEnd)}
          isEnd={!!(isEnd && !isStart)}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          aria-selected={selected}
          role="gridcell"
          tabIndex={0}
          data-date={day.toISOString()}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleKeyDown}
        >
          {format(day, "d")}
        </DateButton>
      </DateCellWrapper>
    );
  },
);

DayCell.displayName = "DayCell";

const CalendarMonth: React.FC<CalendarMonthProps> = React.memo(
  ({
    month,
    maxDate,
    minDate,
    disableFutureDates,
    selectedRange,
    onDateClick,
    hoverDate,
    onDateHover,
    onNavigateLeft,
    onNavigateRight,
    showLeftArrow = false,
    showRightArrow = false,
  }) => {
    const monthStart = useMemo(() => startOfMonth(month), [month]);
    const monthEnd = useMemo(() => endOfMonth(month), [month]);

    const days = useMemo(
      () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
      [monthStart, monthEnd],
    );

    const startDayOfWeek = monthStart.getDay();
    const emptyCells = useMemo(
      () => Array(startDayOfWeek).fill(null),
      [startDayOfWeek],
    );

    const isInRange = useCallback(
      (date: Date) => {
        const { startDate, endDate } = selectedRange;
        if (!startDate) return false;

        const end = endDate || hoverDate;
        if (!end) return false;

        const start = startDate < end ? startDate : end;
        const endDateValue = startDate < end ? end : startDate;

        return isWithinInterval(date, { start, end: endDateValue });
      },
      [selectedRange, hoverDate],
    );

    const isRangeStart = useCallback(
      (date: Date) => {
        const { startDate, endDate } = selectedRange;
        if (!startDate) return false;
        const end = endDate || hoverDate;
        if (!end) return isSameDay(date, startDate);
        return isSameDay(date, startDate < end ? startDate : end);
      },
      [selectedRange, hoverDate],
    );

    const isRangeEnd = useCallback(
      (date: Date) => {
        const { startDate, endDate } = selectedRange;
        if (!startDate) return false;
        const end = endDate || hoverDate;
        if (!end) return false;
        return isSameDay(date, startDate < end ? end : startDate);
      },
      [selectedRange, hoverDate],
    );

    const isSelected = useCallback(
      (date: Date) => {
        const { startDate, endDate } = selectedRange;
        return (
          (startDate && isSameDay(date, startDate)) ||
          (endDate && isSameDay(date, endDate))
        );
      },
      [selectedRange],
    );

    return (
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignSelf: "stretch",
        }}
      >
        <CalendarHeader>
          {showLeftArrow && onNavigateLeft ? (
            <NavigationButton onClick={onNavigateLeft} size="small">
              <ChevronLeftIcon sx={{ fontSize: "16px" }} />
            </NavigationButton>
          ) : (
            <Box sx={{ width: "28px" }} />
          )}
          <CalendarHeaderText>{format(month, "MMMM yyyy")}</CalendarHeaderText>
          {showRightArrow && onNavigateRight ? (
            <NavigationButton onClick={onNavigateRight} size="small">
              <ChevronRightIcon sx={{ fontSize: "16px" }} />
            </NavigationButton>
          ) : (
            <Box sx={{ width: "28px" }} />
          )}
        </CalendarHeader>

        <WeekdayHeader>
          {WEEKDAYS.map((day) => (
            <WeekdayCell key={day}>{day}</WeekdayCell>
          ))}
        </WeekdayHeader>

        <CalendarGrid>
          {emptyCells.map((_, i) => (
            <DateCellWrapper key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const inRange = isInRange(day);
            const isStart = isRangeStart(day);
            const isEnd = isRangeEnd(day);
            const selected = isSelected(day);
            const isDisabled =
              (disableFutureDates &&
                isAfter(startOfDay(day), startOfDay(maxDate))) ||
              isBefore(startOfDay(day), startOfDay(minDate));

            const dayOfWeek = day.getDay();
            const isWeekStart = dayOfWeek === 0;
            const isWeekEnd = dayOfWeek === 6;

            const shouldRoundWeekStart =
              inRange && !isStart && !isEnd && isWeekStart;
            const shouldRoundWeekEnd =
              inRange && !isStart && !isEnd && isWeekEnd;

            return (
              <DayCell
                key={day.toISOString()}
                day={day}
                inRange={inRange}
                isStart={isStart}
                isEnd={isEnd}
                isWeekStart={shouldRoundWeekStart}
                isWeekEnd={shouldRoundWeekEnd}
                selected={!!selected}
                isDisabled={isDisabled}
                onDateClick={onDateClick}
                onDateHover={onDateHover}
              />
            );
          })}
        </CalendarGrid>
      </Box>
    );
  },
);

CalendarMonth.displayName = "CalendarMonth";

export interface DatePickerRef {
  open: (event: DatePickerOpenEvent) => void;
  close: () => void;
  isOpen: () => boolean;
}

export interface DatePickerOpenEvent {
  currentTarget: HTMLElement;
}

// Main Component
const CustomDatePicker = forwardRef<DatePickerRef, DatePickerProps>(
  (
    {
      datePickerType = "range",
      value,
      onChange,
      onPresetChange,
      onAudit,
      showPresets = datePickerType === "range",
      className,
      placeholder = "Select date range",
      buttonText,
      fullWidth = false,
      hideTrigger = false,
      trigger,
      disableFutureDates = datePickerType === "range",
      blockedDateMessage = "You can't select a future date.",
      noscriptStartDateName,
      noscriptEndDateName,
    },
    ref,
  ) => {
    const theme = useTheme();
    const isMobile = useIsMobile("md");
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const today = useMemo(() => startOfDay(new Date()), []);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const minSelectableDate = useMemo(
      () => (datePickerType === "single" ? today : subMonths(today, 6)),
      [today, datePickerType],
    );

    const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
      if (value && value.startDate && value.endDate) {
        return sanitizeRange(value, today);
      }
      return getPresetDates("thisMonth", today);
    });
    const [leftMonth, setLeftMonth] = useState<Date>(() =>
      datePickerType === "single"
        ? today
        : isMobile
          ? today
          : subMonths(today, 1),
    );
    const [rightMonth, setRightMonth] = useState<Date>(() => today);
    const [activePreset, setActivePreset] = useState<PresetType | null>(() => {
      if (value && value.startDate && value.endDate) {
        return detectPreset(value, today);
      }
      return "thisMonth";
    });
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const [isSelectingEnd, setIsSelectingEnd] = useState(false);

    const isOpen = Boolean(anchorEl);

    const handleOpen = useCallback(
      (event: DatePickerOpenEvent) => {
        const baseDate =
          value?.startDate && isSameDay(value.startDate, value.startDate)
            ? startOfMonth(value.startDate)
            : startOfMonth(today);

        if (datePickerType === "single") {
          setRightMonth(baseDate);
        } else {
          if (isMobile) {
            setLeftMonth(baseDate);
            setRightMonth(addMonths(baseDate, 1));
          } else {
            setLeftMonth(subMonths(baseDate, 1));
            setRightMonth(baseDate);
          }
        }

        setAnchorEl(event.currentTarget);
      },
      [value, today, isMobile, datePickerType],
    );

    const handleClose = useCallback(() => {
      setAnchorEl(null);
      setHoverDate(null);
      setIsSelectingEnd(false);
      setErrorMessage(null);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        open: (event: DatePickerOpenEvent) => {
          handleOpen(event);
        },
        close: () => {
          handleClose();
        },
        isOpen: () => {
          return isOpen;
        },
      }),
      [handleOpen, handleClose, isOpen],
    );

    const formatDateRange = useMemo((): string => {
      const { startDate, endDate } = selectedRange;
      if (startDate && endDate) {
        if (isMobile) {
          return `${format(startDate, "dd.MM.yy")}-${format(endDate, "dd.MM.yy")}`;
        }
        return `${format(startDate, "MMM dd, yyyy")} - ${format(
          endDate,
          "MMM dd, yyyy",
        )}`;
      }
      if (startDate) {
        if (isMobile) {
          return format(startDate, "dd.MM.yy");
        }
        return format(startDate, "MMM dd, yyyy");
      }
      if (buttonText) {
        return buttonText;
      }
      return placeholder;
    }, [selectedRange, isMobile, buttonText, placeholder]);

    const navigateLeft = useCallback(() => {
      if (datePickerType === "single") {
        setRightMonth((prev) => {
          const candidate = subMonths(prev, 1);
          const minMonth = startOfMonth(minSelectableDate);

          if (isBefore(startOfMonth(candidate), minMonth)) {
            return prev;
          }

          return candidate;
        });

        return;
      }

      const nextLeft = subMonths(leftMonth, 1);
      const nextRight = subMonths(rightMonth, 1);
      const minMonth = startOfMonth(minSelectableDate);

      if (isBefore(startOfMonth(nextLeft), minMonth)) {
        return;
      }

      setLeftMonth(nextLeft);
      setRightMonth(nextRight);
    }, [leftMonth, rightMonth, minSelectableDate, datePickerType]);

    const navigateRight = useCallback(() => {
      if (datePickerType === "single") {
        setRightMonth((prev) => {
          const candidate = addMonths(prev, 1);

          if (
            disableFutureDates &&
            isAfter(startOfMonth(candidate), startOfMonth(today))
          ) {
            return prev;
          }

          return candidate;
        });

        return;
      }

      const nextLeft = addMonths(leftMonth, 1);
      const nextRight = addMonths(rightMonth, 1);

      if (
        disableFutureDates &&
        isAfter(startOfMonth(nextRight), startOfMonth(today))
      ) {
        return;
      }

      setLeftMonth(nextLeft);
      setRightMonth(nextRight);
    }, [leftMonth, rightMonth, disableFutureDates, today, datePickerType]);

    const renderTrigger = useCallback(() => {
      if (hideTrigger) return null;

      if (trigger) {
        if (React.isValidElement(trigger)) {
          return React.cloneElement(trigger as React.ReactElement<any>, {
            onClick: handleOpen,
          });
        }
        if (typeof trigger === "function") {
          return trigger(handleOpen);
        }
      }

      return (
        <TriggerButton
          ref={triggerRef}
          onClick={handleOpen}
          fullWidth={fullWidth}
          variant="outlined"
          endIcon={<KeyboardArrowDownIcon />}
        >
          <CalendarTodayIcon fontSize="small" />
          <Typography>{formatDateRange}</Typography>
        </TriggerButton>
      );
    }, [hideTrigger, trigger, handleOpen, formatDateRange, fullWidth]);

    const rangeEqual = useCallback((r1: DateRange, r2: DateRange) => {
      const sameStart =
        (!r1.startDate && !r2.startDate) ||
        (r1.startDate && r2.startDate && isSameDay(r1.startDate, r2.startDate));
      const sameEnd =
        (!r1.endDate && !r2.endDate) ||
        (r1.endDate && r2.endDate && isSameDay(r1.endDate, r2.endDate));
      return sameStart && sameEnd;
    }, []);

    useEffect(() => {
      if (!value) return;

      const sanitized = disableFutureDates
        ? sanitizeRange(value, today)
        : value;

      if (disableFutureDates && rangeHasFutureDate(value, today)) {
        onAudit?.({
          type: "future_range_sanitized",
          attempted: value,
          applied: sanitized,
          today,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("date-picker-audit", {
              detail: {
                type: "future_range_sanitized",
                attempted: value,
                applied: sanitized,
                today,
              },
            }),
          );
        }
      }

      setSelectedRange((prev) => {
        return rangeEqual(prev, sanitized) ? prev : sanitized;
      });

      setActivePreset((prev) => {
        const detected = detectPreset(sanitized, today);
        return detected === prev ? prev : detected;
      });

      if (sanitized.startDate) {
        const startMonth = startOfMonth(sanitized.startDate);
        const todayMonth = startOfMonth(today);

        let newLeft: Date;
        let newRight: Date;
        if (isMobile) {
          newLeft = startMonth;
          newRight = addMonths(startMonth, 1);
        } else if (isSameMonth(startMonth, todayMonth) && disableFutureDates) {
          newLeft = subMonths(todayMonth, 1);
          newRight = todayMonth;
        } else {
          newLeft = startMonth;
          newRight = addMonths(startMonth, 1);
        }

        setLeftMonth((prev) => (isSameMonth(prev, newLeft) ? prev : newLeft));
        setRightMonth((prev) =>
          isSameMonth(prev, newRight) ? prev : newRight,
        );
      }
    }, [value, disableFutureDates, today, isMobile, onAudit, rangeEqual]);

    const handlePresetClick = useCallback(
      (preset: PresetType) => {
        setActivePreset(preset);
        const presetDates = getPresetDates(preset, today);
        setSelectedRange(presetDates);
        onChange?.(presetDates);
        onPresetChange?.(preset);

        if (presetDates.startDate) {
          const startMonth = startOfMonth(presetDates.startDate);
          const todayMonth = startOfMonth(today);

          let newLeft: Date;
          let newRight: Date;
          if (isMobile) {
            newLeft = startMonth;
            newRight = addMonths(startMonth, 1);
          } else if (
            isSameMonth(startMonth, todayMonth) &&
            disableFutureDates
          ) {
            newLeft = subMonths(todayMonth, 1);
            newRight = todayMonth;
          } else {
            newLeft = startMonth;
            newRight = addMonths(startMonth, 1);
          }

          setLeftMonth((prev) => (isSameMonth(prev, newLeft) ? prev : newLeft));
          setRightMonth((prev) =>
            isSameMonth(prev, newRight) ? prev : newRight,
          );
        }
      },
      [onChange, onPresetChange, today, disableFutureDates, isMobile],
    );

    const handleDateClick = useCallback(
      (date: Date) => {
        if (datePickerType === "single") {
          const newRange = { startDate: date, endDate: null };
          setSelectedRange(newRange);
          onChange?.(newRange);
          handleClose();
          return;
        }
        if (disableFutureDates && isAfter(startOfDay(date), today)) {
          setErrorMessage(blockedDateMessage);
          onAudit?.({ type: "future_date_blocked", attempted: date, today });
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("date-picker-audit", {
                detail: { type: "future_date_blocked", attempted: date, today },
              }),
            );
          }
          return;
        }
        setErrorMessage(null);
        if (!isSelectingEnd || !selectedRange.startDate) {
          const newRange = { startDate: date, endDate: null };
          setSelectedRange(newRange);
          setActivePreset(null);
          setIsSelectingEnd(true);
        } else {
          const newRange = {
            startDate:
              selectedRange.startDate < date ? selectedRange.startDate : date,
            endDate:
              selectedRange.startDate < date ? date : selectedRange.startDate,
          };
          const sanitized = disableFutureDates
            ? sanitizeRange(newRange, today)
            : newRange;
          setSelectedRange(sanitized);
          const detectedPreset = detectPreset(sanitized, today);
          setActivePreset(detectedPreset);
          onChange?.(sanitized);
          setIsSelectingEnd(false);
        }
      },
      [
        disableFutureDates,
        today,
        isSelectingEnd,
        selectedRange,
        blockedDateMessage,
        onAudit,
        onChange,
      ],
    );

    return (
      <Box sx={{ width: fullWidth ? "100%" : "auto", position: "relative" }}>
        {renderTrigger()}

        <Popover
          anchorEl={anchorEl}
          open={isOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          PaperProps={{
            sx: {
              mt: "8px",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "rgba(16, 24, 40, 0.12) 0px 8px 24px 0px",
              maxWidth: isMobile ? "95vw" : "auto",
              border: `1px solid ${theme.palette.border.main}`,
            },
          }}
        >
          <StyledDatePickerContainer className={className}>
            <ContentContainer>
              {showPresets && (
                <>
                  <PresetsSidebar>
                    <PresetTitle>Presets</PresetTitle>
                    {PRESETS.map((preset) => (
                      <PresetItem
                        key={preset.key}
                        active={activePreset === preset.key}
                        onClick={() => handlePresetClick(preset.key)}
                      >
                        <p className="label">{preset.label}</p>
                        {activePreset === preset.key && (
                          <Box className="arrow">
                            <ArrowForwardIosIcon
                              sx={{
                                fontSize: "12px",
                                color: theme.palette.text.secondary,
                              }}
                            />
                          </Box>
                        )}
                      </PresetItem>
                    ))}
                  </PresetsSidebar>

                  <DividerLine />
                </>
              )}

              {datePickerType === "range" && (
                <>
                  <CalendarMonth
                    month={leftMonth}
                    maxDate={today}
                    minDate={minSelectableDate}
                    disableFutureDates={disableFutureDates}
                    selectedRange={selectedRange}
                    onDateClick={handleDateClick}
                    hoverDate={isSelectingEnd ? hoverDate : null}
                    onDateHover={setHoverDate}
                    onNavigateLeft={navigateLeft}
                    onNavigateRight={navigateRight}
                    showLeftArrow={true}
                    showRightArrow={isMobile}
                  />

                  <DividerLine
                    sx={{ [theme.breakpoints.down("md")]: { display: "none" } }}
                  />
                </>
              )}

              {(datePickerType !== "range" || !isMobile) && (
                <CalendarMonth
                  month={rightMonth}
                  maxDate={today}
                  minDate={minSelectableDate}
                  disableFutureDates={disableFutureDates}
                  selectedRange={selectedRange}
                  onDateClick={handleDateClick}
                  hoverDate={isSelectingEnd ? hoverDate : null}
                  onDateHover={setHoverDate}
                  onNavigateLeft={
                    datePickerType === "single" ? navigateLeft : undefined
                  }
                  onNavigateRight={navigateRight}
                  showLeftArrow={datePickerType === "single" ? true : false}
                  showRightArrow={true}
                />
              )}
            </ContentContainer>
            {errorMessage && (
              <Box sx={{ pt: "10px" }}>
                <Typography
                  sx={{
                    fontSize: "13px",
                    fontFamily: "var(--font-sans)",
                    color: theme.palette.error.main,
                    lineHeight: 1.2,
                  }}
                  role="alert"
                >
                  {errorMessage}
                </Typography>
              </Box>
            )}
          </StyledDatePickerContainer>
        </Popover>

        {(noscriptStartDateName || noscriptEndDateName) && (
          <noscript>
            <div>
              {noscriptStartDateName && (
                <input
                  type="date"
                  name={noscriptStartDateName}
                  max={format(today, "yyyy-MM-dd")}
                />
              )}
              {noscriptEndDateName && (
                <input
                  type="date"
                  name={noscriptEndDateName}
                  max={format(today, "yyyy-MM-dd")}
                />
              )}
            </div>
          </noscript>
        )}
      </Box>
    );
  },
);

CustomDatePicker.displayName = "CustomDatePicker";

export default CustomDatePicker;
