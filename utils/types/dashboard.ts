export type TimePeriod = "7days" | "30days" | "90days" | "custom";

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

export interface TransactionData {
  date: string;
  value: number;
}

export interface FeeTierProgressProps {
  monthlyLimit?: number;
  usedAmount?: number;
  currentTier?: string;
  /** When true, bars are shorter and margins tighter — matches the dashboard
   *  "compact" density mode driven by useDashboardDensity. */
  compact?: boolean;
}

export interface ChartData {
  date: string;
  value: number;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ date: string; value: number; payload?: any }>;
  label?: string;
  coordinate?: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export interface ActiveTooltipState {
  payload: { date: string; value: number; payload?: any }[];
  coordinate: { x: number; y: number };
  label: string;
}
