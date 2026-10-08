import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { SdRewards } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR } from "../sdFormat";
import { SD_GOLD, SD_GOLD_DARK, SD_INK, SD_INK_MUTED, goldAlpha } from "../sdTheme";
import { LEVEL_ICON } from "./LevelCard";

/** Overview card: fee-credit balance, loyalty level and a shortcut to invite friends. */
export default function RewardsTeaser({ href }: { href: (p: string) => string }) {
  const [r, setR] = useState<SdRewards | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { safedealApi.rewards().then(setR).catch(() => setFailed(true)); }, []);
  if (failed) return null;
  if (!r) return <Skeleton variant="rounded" height={170} />;
  return (
    <Box data-testid="sd-home-rewards" sx={{ position: "relative", overflow: "hidden", p: { xs: 2, md: 2.2 }, borderRadius: 4, backgroundColor: SD_INK, color: "#fff" }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(260px 160px at 100% 0%, ${goldAlpha(0.24)}, transparent 70%)` }} />
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ position: "relative" }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: goldAlpha(0.18), color: SD_GOLD }} aria-hidden><Icon icon="mdi:gift-outline" width={18} /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>Give ${r.rules.welcome_credit_usd}, get ${r.rules.referrer_reward_usd}</Typography>
          <Typography sx={{ fontSize: 12.5, color: SD_INK_MUTED }}>Fee credit for every friend whose first deal closes.</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={3} sx={{ position: "relative", mt: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: SD_INK_MUTED }}>Fee credit</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 900, ...TABULAR }} data-testid="sd-home-rewards-credit">{money(r.credit.balance)}</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: SD_INK_MUTED }}>Level</Typography>
          <Stack direction="row" spacing={0.6} alignItems="center">
            <Icon icon={LEVEL_ICON[r.level.key] || LEVEL_ICON.member} width={18} color={SD_GOLD} aria-hidden />
            <Typography sx={{ fontSize: 22, fontWeight: 900 }} data-testid="sd-home-rewards-level">{r.level.label} · {r.level.fee_percent}%</Typography>
          </Stack>
        </Box>
      </Stack>
      <Link href={href("/rewards")} style={{ textDecoration: "none", position: "relative", display: "block", marginTop: 16 }} data-testid="sd-home-rewards-open">
        <Button fullWidth variant="contained" endIcon={<Icon icon="mdi:arrow-right" />} sx={{ textTransform: "none", fontWeight: 900, borderRadius: 99, color: SD_INK, backgroundColor: SD_GOLD, "&:hover": { backgroundColor: SD_GOLD_DARK } }}>Invite friends</Button>
      </Link>
    </Box>
  );
}
