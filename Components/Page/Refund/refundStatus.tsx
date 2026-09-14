/**
 * Shared refund-status UI: status colors, a compact chip, a horizontal
 * progress timeline, and a hook that loads the merchant's refunds keyed by
 * source so tables can show a status at a glance.
 */
import React from "react";
import useSWR from "swr";
import { Box, Chip, Stack, Typography } from "@mui/material";
import axiosBaseApi from "@/axiosConfig";
import { getRuntimeFlags } from "@/helpers/runtimeFlags";
import { brandFg } from "@/constants/theme";

export const REFUND_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  created: { bg: "#E5E7EB", fg: "#4B5563" },
  awaiting_deposit: { bg: "#FEF3C7", fg: "#92400E" },
  deposit_detected: { bg: "#DBEAFE", fg: "#1E40AF" },
  forwarding: { bg: "#DBEAFE", fg: "#1E40AF" },
  completed: { bg: "#DCFCE7", fg: "#166534" },
  cancelled: { bg: "#E5E7EB", fg: "#4B5563" },
  failed: { bg: "#FEE2E2", fg: "#991B1B" },
  expired: { bg: "#E5E7EB", fg: "#4B5563" },
};

export const refundStatusLabel = (status: string): string =>
  String(status || "").replace(/_/g, " ").toUpperCase();

/**
 * Mask a customer wallet address for merchant-facing display (privacy): show
 * only the first 6 and last 4 chars. Short strings are returned unchanged.
 */
export const maskAddress = (addr: string): string => {
  const a = String(addr || "").trim();
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
};

export const RefundStatusChip: React.FC<{ status: string; testid?: string }> = ({
  status,
  testid,
}) => {
  const sc = REFUND_STATUS_COLORS[status] || REFUND_STATUS_COLORS.awaiting_deposit;
  return (
    <Chip
      size="small"
      label={refundStatusLabel(status)}
      sx={{ bgcolor: sc.bg, color: sc.fg, fontWeight: 700, fontSize: 11, height: 22 }}
      data-testid={testid || "refund-status-chip"}
    />
  );
};

const FLOW: { key: string; label: string }[] = [
  { key: "awaiting_deposit", label: "Awaiting deposit" },
  { key: "deposit_detected", label: "Deposit detected" },
  { key: "forwarding", label: "Forwarding" },
  { key: "completed", label: "Completed" },
];

const TERMINAL_NEGATIVE = ["cancelled", "failed", "expired"];

/**
 * Horizontal step timeline: awaiting deposit → deposit detected → forwarding →
 * completed. Terminal-negative states (cancelled/failed/expired) render as a
 * single status chip instead.
 */
export const RefundStatusTimeline: React.FC<{ status: string }> = ({ status }) => {
  if (TERMINAL_NEGATIVE.includes(status)) {
    return (
      <Box data-testid="refund-timeline">
        <RefundStatusChip status={status} testid="refund-timeline-terminal" />
      </Box>
    );
  }
  const isCompleted = status === "completed";
  const idx = FLOW.findIndex((s) => s.key === status);
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      sx={{ width: "100%", py: 0.5 }}
      data-testid="refund-timeline"
    >
      {FLOW.map((s, i) => {
        const done = isCompleted || i < idx;
        const active = !isCompleted && i === idx;
        const dotColor = done ? "#16A34A" : active ? "#2563EB" : "#D1D5DB";
        return (
          <React.Fragment key={s.key}>
            <Stack alignItems="center" spacing={0.5} sx={{ flex: "0 0 auto", width: 78 }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  bgcolor: done || active ? dotColor : "transparent",
                  border: `2px solid ${dotColor}`,
                  boxShadow: active ? "0 0 0 4px rgba(37,99,235,0.15)" : "none",
                  transition: "background-color 200ms, box-shadow 200ms",
                }}
                data-testid={`refund-step-${s.key}`}
                data-active={active ? "true" : "false"}
                data-done={done ? "true" : "false"}
              />
              <Typography
                variant="caption"
                sx={{
                  fontSize: 10.5,
                  lineHeight: 1.2,
                  textAlign: "center",
                  fontWeight: active ? 700 : 500,
                  color: (th) => (done ? th.palette.success.main : active ? brandFg(th.palette.mode === "dark") : th.palette.text.secondary),
                }}
              >
                {s.label}
              </Typography>
            </Stack>
            {i < FLOW.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  mt: "6px",
                  bgcolor: isCompleted || i < idx ? "#16A34A" : "#E5E7EB",
                  transition: "background-color 200ms",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Stack>
  );
};

export interface RefundLite {
  refund_id: string;
  source_ref: string;
  status: string;
  is_dry_run: boolean;
}

/**
 * Loads all of the merchant's refunds for a source type and returns a map keyed
 * by source_ref → the most recent refund, so a table row can show its status.
 */
export const useRefundMap = (sourceType: "product_order" | "payment_link") => {
  const { data, mutate } = useSWR<RefundLite[]>(
    getRuntimeFlags().enableCryptoRefunds ? ["refund-map", sourceType] : null,
    (async () => {
      const r = await axiosBaseApi.get(`refunds?source_type=${sourceType}`);
      return (r.data?.data || []) as RefundLite[];
    }) as any,
    { revalidateOnFocus: false }
  );
  const refundMap: Record<string, RefundLite> = {};
  // List is DESC by createdAt → first seen per source_ref is the most recent.
  (data || []).forEach((r) => {
    const k = String(r.source_ref);
    if (!refundMap[k]) refundMap[k] = r;
  });
  return { refundMap, mutateRefunds: mutate };
};
