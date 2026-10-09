import React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdRewards } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { absTime } from "../sdFormat";
import { SD_BORDER, SD_GOLD_DEEP, SD_NOTE_BG, SD_PAGE, SD_TEXT_MUTED } from "../sdTheme";

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  joined: { label: "First deal pending", bg: SD_NOTE_BG, fg: "#7A5300" },
  rewarded: { label: "Rewarded", bg: "#ECFDF5", fg: "#047857" },
  capped: { label: "Monthly cap reached", bg: SD_PAGE, fg: SD_TEXT_MUTED },
};

/** Friends who joined with your code and where each stands. */
export default function InvitesList({ r }: { r: SdRewards }) {
  const list = r.referrals.list;
  return (
    <Box data-testid="sd-rewards-invites" sx={{ p: { xs: 2.4, md: 2.8 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.6 }}>
        <Typography component="h2" sx={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3 }}>Your invites</Typography>
        <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED }} data-testid="sd-rewards-invites-summary">
          {r.referrals.total} joined · {r.referrals.pending} pending · {money(r.referrals.earned_usd)} earned
        </Typography>
      </Stack>
      {list.length === 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 4, textAlign: "center" }} data-testid="sd-rewards-invites-empty">
          <Box sx={{ width: 46, height: 46, borderRadius: 99, display: "grid", placeItems: "center", backgroundColor: SD_NOTE_BG, color: SD_GOLD_DEEP }}><Icon icon="mdi:account-multiple-plus-outline" width={22} aria-hidden /></Box>
          <Typography sx={{ fontWeight: 800 }}>No invites yet</Typography>
          <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED, maxWidth: 320 }}>Share your link — friends who sign up with it show up here, and you&apos;re rewarded when their first deal closes.</Typography>
        </Stack>
      ) : (
        <Stack divider={<Box sx={{ borderTop: `1px solid ${SD_BORDER}` }} />}>
          {list.map((f) => {
            const st = STATUS[f.status] || STATUS.joined;
            return (
              <Stack key={f.referral_id} direction="row" spacing={1.4} alignItems="center" sx={{ py: 1.3 }} data-testid={`sd-rewards-invite-${f.referral_id}`}>
                <Box sx={{ width: 34, height: 34, borderRadius: 99, display: "grid", placeItems: "center", backgroundColor: SD_PAGE, color: SD_TEXT_MUTED, flexShrink: 0 }} aria-hidden><Icon icon="mdi:account-outline" width={18} /></Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.friend}</Typography>
                  <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED }}>Joined {absTime(f.joined_at)}</Typography>
                </Box>
                {f.status === "rewarded" && <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#047857" }}>+{money(f.reward_usd)}</Typography>}
                <Chip size="small" label={st.label} data-testid={`sd-rewards-invite-status-${f.referral_id}`} sx={{ fontWeight: 800, fontSize: 12, backgroundColor: st.bg, color: st.fg }} />
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
