import React from "react";
import { Chip, Tooltip } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdDeal } from "@/api/safedeal";
import { absTime, deadlinePill, useNow } from "./sdFormat";

/** Time-pressure pill for a deal row ("Auto-releases in 2d 4h", "Invited 5d ago"). */
export default function DeadlinePill({ deal, testId }: { deal: SdDeal; testId?: string }) {
  const now = useNow(30000);
  const p = deadlinePill(deal, now);
  if (!p) return null;
  return (
    <Tooltip title={absTime(p.iso)} arrow>
      <Chip
        size="small"
        icon={<Icon icon={p.urgent ? "mdi:timer-alert-outline" : "mdi:timer-sand"} width={13} />}
        label={p.text}
        data-testid={testId}
        data-urgent={p.urgent ? "1" : "0"}
        sx={{
          fontWeight: 700,
          fontSize: 11,
          height: 22,
          backgroundColor: p.urgent ? "#FEF3C7" : "#F3F4F6",
          color: p.urgent ? "#92400E" : "#4B5563",
          "& .MuiChip-icon": { color: "inherit", ml: 0.6 },
        }}
      />
    </Tooltip>
  );
}
