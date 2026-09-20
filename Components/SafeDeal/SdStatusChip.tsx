import React from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import StatusChip from "@/Components/Page/Escrow/StatusChip";
import { statusTone } from "@/Components/Page/Escrow/escrowUtils";
import type { SdDeal } from "@/api/safedeal";
import { STATUS_GLOSSARY } from "./sdFormat";
import { SD_GOLD_DEEP, SD_GOLD_SOFT, goldAlpha } from "./sdTheme";

/** Status chip with the glossary on hover/focus: what it means and who acts next. */
export default function SdStatusChip({ deal, size = "md", testId }: { deal: SdDeal; size?: "sm" | "md"; testId?: string }) {
  const g = STATUS_GLOSSARY[deal.status];
  const role = (deal.my_role || "buyer") as "buyer" | "seller";
  // The shared escrow "brand" tone is Dynopay indigo; recolor it to SafeDeal gold here only.
  const brandGold = statusTone(deal.status) === "brand" ? { fg: SD_GOLD_DEEP, bg: SD_GOLD_SOFT, border: goldAlpha(0.5) } : undefined;
  if (!g) return <StatusChip deal={deal} size={size} testId={testId} colorsOverride={brandGold} />;
  const chip = <StatusChip deal={deal} size={size} testId={testId ? `${testId}-chip` : undefined} colorsOverride={brandGold} />;
  return (
    <Tooltip
      arrow
      enterTouchDelay={0}
      title={
        <Box sx={{ p: 0.4 }} data-testid={testId ? `${testId}-glossary` : undefined}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.3 }}>{g.meaning}</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.85 }}>Next: {g.next(role, !!deal.is_creator)}</Typography>
        </Box>
      }
    >
      <Box component="span" tabIndex={0} role="button" aria-label={`Status: ${deal.status_label || deal.status}. ${g.meaning}`} data-testid={testId} data-status={deal.status} sx={{ display: "inline-flex", cursor: "help", borderRadius: 999 }}>
        {chip}
      </Box>
    </Tooltip>
  );
}
