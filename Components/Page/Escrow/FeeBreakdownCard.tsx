import React from "react";
import { Box, Divider, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import { Icon } from "@iconify/react";
import { brandAlpha, brandFg } from "@/constants/theme";
import type { FeeBreakdown, CostItem } from "@/api/escrow";
import { money } from "./escrowUtils";

const COST_ICON: Record<CostItem["key"], string> = {
  escrow_fee: "mdi:shield-check-outline",
  network_fee: "mdi:transit-connection-variant",
  conversion_fee: "mdi:swap-horizontal",
  withdrawal_fee: "mdi:bank-transfer-out",
};

/**
 * Itemised escrow cost summary — reused by the create dialog, the deal detail
 * and the public invite so the buyer/seller see the exact same numbers:
 * escrow fee + network + conversion + withdrawal → total, then who pays what.
 */
export default function FeeBreakdownCard({
  breakdown: b,
  currency,
  buyerPaysTestId,
  sellerReceivesTestId,
  totalTestId,
}: {
  breakdown: FeeBreakdown;
  currency: string;
  buyerPaysTestId?: string;
  sellerReceivesTestId?: string;
  totalTestId?: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const items: CostItem[] = b.costItems && b.costItems.length ? b.costItems : [{ key: "escrow_fee", label: `Escrow fee (${b.feePercent}%)`, amount: b.escrowFee }];
  const total = b.totalCost != null ? b.totalCost : b.escrowFee;

  return (
    <Box data-testid="escrow-fee-preview">
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, mb: 1.2 }}>
        <Icon icon="mdi:receipt-text-outline" width={16} color={brandFg(isDark)} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", color: brandFg(isDark) }}>
          Cost breakdown
        </Typography>
      </Box>

      <Stack spacing={0.75}>
        <Line label="Deal amount" value={money(b.amount, currency)} />

        {items.map((it) => (
          <Box key={it.key} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }} data-testid={`escrow-cost-${it.key}`}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, minWidth: 0 }}>
              <Icon icon={COST_ICON[it.key]} width={15} color={theme.palette.text.secondary} />
              {it.note ? (
                <Tooltip title={it.note} arrow>
                  <Typography sx={{ fontSize: 12.5, color: "text.secondary", borderBottom: `1px dotted ${theme.palette.divider}`, cursor: "help" }}>
                    {it.label}
                  </Typography>
                </Tooltip>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{it.label}</Typography>
              )}
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{money(it.amount, currency)}</Typography>
          </Box>
        ))}

        {b.totalCost != null && (
          <Box
            data-testid={totalTestId}
            sx={{
              mt: 0.4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 1.2,
              py: 0.8,
              borderRadius: 1.5,
              backgroundColor: brandAlpha(isDark ? 0.14 : 0.07),
            }}
          >
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: brandFg(isDark) }}>Total escrow cost</Typography>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: brandFg(isDark) }}>{money(total, currency)}</Typography>
          </Box>
        )}

        <Divider sx={{ my: 0.6 }} />
        <Line label="Buyer pays" value={money(b.buyerPays, currency)} bold testId={buyerPaysTestId} />
        <Line label="Seller receives" value={money(b.sellerReceives, currency)} bold testId={sellerReceivesTestId} />
      </Stack>

      {b.costsEstimated && (
        <Typography sx={{ fontSize: 10.5, color: "text.secondary", mt: 1, lineHeight: 1.4 }}>
          Network, conversion &amp; withdrawal are estimates folded into the price and settled from the funded amount. The
          exact withdrawal fee depends on the payout network chosen at cash-out.
        </Typography>
      )}
    </Box>
  );
}

function Line({ label, value, bold, testId }: { label: string; value: string; bold?: boolean; testId?: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5 }}>
      <Typography sx={{ fontSize: 13, color: bold ? "text.primary" : "text.secondary", fontWeight: bold ? 700 : 400 }}>{label}</Typography>
      <Typography data-testid={testId} sx={{ fontSize: 13.5, fontWeight: bold ? 800 : 600, whiteSpace: "nowrap" }}>
        {value}
      </Typography>
    </Box>
  );
}
