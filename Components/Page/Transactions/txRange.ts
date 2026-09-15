import { endOfDay, startOfDay, subDays } from "date-fns";
import { DateRange } from "@/utils/types/dashboard";
import { TxRangePreset } from "@/utils/types/transaction";

export const TX_RANGE_PRESETS: Array<{ id: Exclude<TxRangePreset, "custom">; key: string; fallback: string }> = [
  { id: "today", key: "rangeToday", fallback: "Today" },
  { id: "7d", key: "range7d", fallback: "7D" },
  { id: "30d", key: "range30d", fallback: "30D" },
  { id: "90d", key: "range90d", fallback: "90D" },
  { id: "all", key: "rangeAll", fallback: "All time" },
];

export const DEFAULT_TX_RANGE: TxRangePreset = "30d";

export const isTxRangePreset = (v: unknown): v is TxRangePreset =>
  v === "custom" || TX_RANGE_PRESETS.some((p) => p.id === v);

/** Preset → concrete date window (whole days). "all" and "custom" carry no dates of their own. */
export const rangeToDates = (preset: TxRangePreset, now = new Date()): DateRange => {
  const days: Partial<Record<TxRangePreset, number>> = { today: 0, "7d": 6, "30d": 29, "90d": 89 };
  const back = days[preset];
  if (back == null) return { startDate: null, endDate: null };
  return { startDate: startOfDay(subDays(now, back)), endDate: endOfDay(now) };
};
