import React from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import StatusChip from "@/Components/Page/Escrow/StatusChip";
import type { SdDeal } from "@/api/safedeal";
import { STATUS_GLOSSARY } from "./sdFormat";

/** Status chip with the glossary on hover/focus: what it means and who acts next. */
export default function SdStatusChip({ deal, size = "md", testId }: { deal: SdDeal; size?: "sm" | "md"; testId?: string }) {
  const g = STATUS_GLOSSARY[deal.status];
  const role = (deal.my_role || "buyer") as "buyer" | "seller";
  const chip = <StatusChip deal={deal} size={size} testId={testId} />;
  if (!g) return chip;
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
      <Box component="span" tabIndex={0} sx={{ display: "inline-flex", cursor: "help", borderRadius: 999, "&:focus-visible": { outline: "2px solid #4338CA", outlineOffset: 2 } }}>
        {chip}
      </Box>
    </Tooltip>
  );
}
