import React from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdRewards } from "@/api/safedeal";
import { SD_BORDER, SD_GOLD, SD_INK, SD_TEXT_MUTED } from "../sdTheme";

/** Three-step explainer of how a referral turns into fee credit. */
export default function HowItWorks({ rules }: { rules: SdRewards["rules"] }) {
  const steps = [
    { icon: "mdi:share-variant-outline", title: "Share your link", body: "Send it on WhatsApp, Telegram or X — or just invite someone to a deal. Your code rides along." },
    { icon: "mdi:handshake-outline", title: `Their first $${rules.qualify_min_deal_usd}+ deal closes`, body: `They get $${rules.welcome_credit_usd} off that deal's fee. When it's completed and released, it counts.` },
    { icon: "mdi:ticket-percent-outline", title: `You get $${rules.referrer_reward_usd} fee credit`, body: "It comes off the escrow fee of your next released deal automatically. Credit can't be withdrawn." },
  ];
  return (
    <Box data-testid="sd-rewards-how" sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
      {steps.map((s, i) => (
        <Box key={s.title} sx={{ p: 2.4, borderRadius: 4, border: `1px dashed ${SD_BORDER}`, backgroundColor: "rgba(255,255,255,0.6)" }} data-testid={`sd-rewards-how-${i + 1}`}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 1.2 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: 99, display: "grid", placeItems: "center", backgroundColor: SD_INK, color: SD_GOLD, fontSize: 13, fontWeight: 900 }}>{i + 1}</Box>
            <Icon icon={s.icon} width={20} color={SD_TEXT_MUTED} aria-hidden />
          </Box>
          <Typography sx={{ fontWeight: 900, fontSize: 15.5, letterSpacing: -0.2 }}>{s.title}</Typography>
          <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED, mt: 0.5, lineHeight: 1.55 }}>{s.body}</Typography>
        </Box>
      ))}
    </Box>
  );
}
