import { DateRange } from "@/utils/types/dashboard";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  isAfter,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";

export type PresetType =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "last7Days"
  | "last30Days";

export const clampToMax = (date: Date, maxDate: Date) => {
  const d = startOfDay(date);
  const max = startOfDay(maxDate);
  return isAfter(d, max) ? max : d;
};

export const rangeHasFutureDate = (range: DateRange, maxDate: Date) => {
  const max = startOfDay(maxDate);
  const start = range.startDate ? startOfDay(range.startDate) : null;
  const end = range.endDate ? startOfDay(range.endDate) : null;
  return Boolean((start && isAfter(start, max)) || (end && isAfter(end, max)));
};

export const sanitizeRange = (range: DateRange, maxDate: Date): DateRange => {
  const max = startOfDay(maxDate);
  const start = range.startDate ? clampToMax(range.startDate, max) : null;
  const end = range.endDate ? clampToMax(range.endDate, max) : null;

  if (start && end && isAfter(start, end)) {
    return { startDate: start, endDate: start };
  }

  return { startDate: start, endDate: end };
};

export const getPresetDates = (
  preset: PresetType,
  maxDate: Date,
): DateRange => {
  const today = startOfDay(maxDate);
  const startOfToday = today;
  const endOfToday = today;

  switch (preset) {
    case "today":
      return { startDate: startOfToday, endDate: endOfToday };
    case "yesterday": {
      const yesterday = subDays(today, 1);
      return { startDate: yesterday, endDate: yesterday };
    }
    case "thisWeek":
      return { startDate: startOfWeek(today), endDate: today };
    case "lastWeek": {
      const lastWeekStart = startOfWeek(subDays(today, 7));
      return { startDate: lastWeekStart, endDate: endOfWeek(lastWeekStart) };
    }
    case "thisMonth":
      return { startDate: startOfMonth(today), endDate: today };
    case "lastMonth": {
      const lastMonth = subMonths(today, 1);
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth),
      };
    }
    case "last7Days":
      return { startDate: subDays(today, 6), endDate: today };
    case "last30Days":
      return { startDate: subDays(today, 29), endDate: today };
    default:
      return { startDate: null, endDate: null };
  }
};

export const detectPreset = (
  dateRange: DateRange,
  maxDate: Date,
): PresetType | null => {
  if (!dateRange.startDate || !dateRange.endDate) {
    return null;
  }

  const presets: PresetType[] = [
    "today",
    "yesterday",
    "thisWeek",
    "lastWeek",
    "thisMonth",
    "lastMonth",
    "last7Days",
    "last30Days",
  ];

  for (const preset of presets) {
    const presetDates = getPresetDates(preset, maxDate);
    if (
      presetDates.startDate &&
      presetDates.endDate &&
      isSameDay(dateRange.startDate, presetDates.startDate) &&
      isSameDay(dateRange.endDate, presetDates.endDate)
    ) {
      return preset;
    }
  }

  return null;
};

export const getPreferredMonthPair = (rangeStart: Date, maxDate: Date) => {
  const startMonth = startOfMonth(rangeStart);
  const maxMonth = startOfMonth(maxDate);
  const preferredRight = addMonths(startMonth, 1);
  const nextRight = isAfter(preferredRight, maxMonth)
    ? maxMonth
    : preferredRight;
  const nextLeft =
    nextRight.getTime() === maxMonth.getTime()
      ? subMonths(maxMonth, 1)
      : startMonth;
  return { left: nextLeft, right: nextRight };
};
