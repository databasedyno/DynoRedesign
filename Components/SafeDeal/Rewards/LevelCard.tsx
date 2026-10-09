import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdRewards } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR } from "../sdFormat";
import { SD_BORDER, SD_GOLD, SD_GOLD_DEEP, SD_INK, SD_PAGE, SD_TEXT_MUTED } from "../sdTheme";

export const LEVEL_ICON: Record<string, string> = { member: "mdi:account-outline", silver: "mdi:medal-outline", gold: "mdi:crown-outline", platinum: "mdi:diamond-stone" };
const LEVEL_TINT: Record<string, string> = { member: "#6B6B72", silver: "#64748B", gold: SD_GOLD_DEEP, platinum: "#0F766E" };

const needText = (n: NonNullable<SdRewards["level"]["next"]>) =>
  `${n.deals_needed} more completed ${n.deals_needed === 1 ? "deal" : "deals"} or ${money(n.volume_needed_usd)} more volume`;

/** Loyalty level: current rate, progress to the next level and the full ladder. */
export default function LevelCard({ level, minFeeUsd }: { level: SdRewards["level"]; minFeeUsd: number }) {
  const idx = level.levels.findIndex((l) => l.key === level.key);
  return (
    <Box data-testid="sd-rewards-level" data-level={level.key} sx={{ p: { xs: 2.4, md: 2.8 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
      <Stack direction="row" spacing={1.6} alignItems="center">
        <Box sx={{ width: 48, height: 48, borderRadius: 3, display: "grid", placeItems: "center", backgroundColor: SD_INK, color: SD_GOLD, flexShrink: 0 }} aria-hidden>
          <Icon icon={LEVEL_ICON[level.key] || LEVEL_ICON.member} width={24} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: SD_TEXT_MUTED }}>Loyalty level</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, color: LEVEL_TINT[level.key] }} data-testid="sd-rewards-level-label">{level.label}</Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, ...TABULAR }} data-testid="sd-rewards-level-rate">{level.fee_percent}%</Typography>
          <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED }}>escrow fee{level.fee_percent < level.base_fee_percent ? ` · standard ${level.base_fee_percent}%` : ""}</Typography>
        </Box>
      </Stack>

      {level.next ? (
        <Box sx={{ mt: 2.4 }} data-testid="sd-rewards-level-next">
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Next: {level.next.label} · {level.next.fee_percent}%</Typography>
            <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, ...TABULAR }}>{Math.round(level.next.progress * 100)}%</Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 99, backgroundColor: SD_PAGE, overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${Math.max(3, level.next.progress * 100)}%`, borderRadius: 99, backgroundColor: SD_GOLD, transition: "width .6s ease" }} />
          </Box>
          <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, mt: 0.8 }}>{needText(level.next)}</Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED, mt: 2.4 }} data-testid="sd-rewards-level-top">You&apos;re on our best rate. Thank you for trading with SafeDeal.</Typography>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.8, mt: 2.4 }} data-testid="sd-rewards-level-ladder">
        {level.levels.map((l, i) => {
          const on = i <= idx;
          return (
            <Box key={l.key} data-testid={`sd-rewards-ladder-${l.key}`} sx={{ p: 1.1, borderRadius: 2.5, border: `1px solid ${i === idx ? SD_GOLD : SD_BORDER}`, backgroundColor: i === idx ? "#FFFBEB" : "#fff", opacity: on ? 1 : 0.75 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 900, color: on ? SD_INK : SD_TEXT_MUTED }}>{l.label}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 900, ...TABULAR }}>{l.fee_percent}%</Typography>
              <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, lineHeight: 1.3 }}>{l.min_deals === 0 ? "Everyone" : `${l.min_deals} deals or ${money(l.min_volume_usd).replace(/\.00$/, "")}`}</Typography>
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, mt: 1.4 }}>
        Counted on your completed deals: <b style={{ ...TABULAR }} data-testid="sd-rewards-level-stats">{level.completed_deals} · {money(level.completed_volume_usd)}</b>. The {money(minFeeUsd).replace(/\.00$/, "")} minimum fee still applies.
      </Typography>
    </Box>
  );
}
