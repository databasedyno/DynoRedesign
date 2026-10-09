import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdRewards } from "@/api/safedeal";
import { SD_BORDER, SD_GOLD, SD_INK, SD_PAGE, SD_TEXT_MUTED } from "../sdTheme";

/** Milestone bonuses on top of the per-friend reward (3 / 10 / 25 rewarded friends). */
export default function MilestonesCard({ r }: { r: SdRewards }) {
  const done = r.referrals.rewarded;
  const max = r.milestones[r.milestones.length - 1]?.friends || 1;
  return (
    <Box data-testid="sd-rewards-milestones" sx={{ p: { xs: 2.4, md: 2.8 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: SD_TEXT_MUTED }}>Milestone bonuses</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, mt: 0.3 }} data-testid="sd-rewards-milestone-count">
        {done} {done === 1 ? "friend" : "friends"} rewarded
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED }} data-testid="sd-rewards-next-milestone">
        {r.next_milestone ? `${r.next_milestone.remaining} more to unlock +$${r.next_milestone.bonus_usd}` : "Every milestone unlocked — legend."}
      </Typography>

      <Box sx={{ position: "relative", height: 8, borderRadius: 99, backgroundColor: SD_PAGE, mt: 2.6, mb: 1 }}>
        <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, (done / max) * 100)}%`, borderRadius: 99, backgroundColor: SD_GOLD, transition: "width .6s ease" }} />
      </Box>
      <Stack spacing={1.1} sx={{ mt: 2 }}>
        {r.milestones.map((m) => (
          <Stack key={m.friends} direction="row" spacing={1.2} alignItems="center" data-testid={`sd-rewards-milestone-${m.friends}`} data-reached={m.reached ? "true" : "false"}>
            <Box sx={{ width: 30, height: 30, borderRadius: 99, display: "grid", placeItems: "center", flexShrink: 0, backgroundColor: m.reached ? SD_GOLD : SD_PAGE, color: m.reached ? SD_INK : SD_TEXT_MUTED }} aria-hidden>
              <Icon icon={m.reached ? "mdi:check-bold" : "mdi:gift-outline"} width={16} />
            </Box>
            <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{m.friends} friends</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 900, color: m.reached ? "#047857" : SD_INK }}>+${m.bonus_usd}</Typography>
          </Stack>
        ))}
      </Stack>
      <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, mt: 2 }}>Up to {r.rules.monthly_reward_cap} rewarded friends per month.</Typography>
    </Box>
  );
}
