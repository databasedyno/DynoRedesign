export type RangeId = "today" | "7d" | "30d" | "90d" | "1y";

export const RANGES: Array<{ id: RangeId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

export type CustomRange = { startDate: string; endDate: string } | null;
