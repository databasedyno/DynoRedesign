import React from "react";
import type { SxProps, Theme } from "@mui/material";
import { StatusDot } from "@/Components/UI/StatusDot";

/**
 * StatusPill — REDESIGNED for the "Quiet Money" blueprint (§2 rule 2, §3).
 *
 * Previously a filled, uppercase, ring-bordered monospace pill. It is now a
 * thin wrapper over the shared <StatusDot/> primitive (6px dot + tinted text,
 * no background) so every existing call site — tables, transaction rows,
 * invoice status columns, wallet cards — instantly adopts the calmer look with
 * zero call-site changes. The `tone` prop + text children API is preserved.
 */
export type StatusPillTone =
  | "settled"
  | "pending"
  | "failed"
  | "info"
  | "neutral"
  | "draft"
  | "overdue";

export interface StatusPillProps {
  tone?: StatusPillTone;
  children?: React.ReactNode;
  sx?: SxProps<Theme>;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  tone = "neutral",
  children,
  sx,
  className,
}) => (
  <StatusDot tone={tone} className={className} sx={sx}>
    {children}
  </StatusDot>
);

export default StatusPill;
