import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdRewards } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR, absTime } from "../sdFormat";
import { SD_BORDER, SD_GOLD_DEEP, SD_PAGE, SD_TEXT_MUTED, goldAlpha } from "../sdTheme";

const KIND: Record<string, { label: string; icon: string }> = {
  welcome: { label: "Welcome credit", icon: "mdi:hand-wave-outline" },
  referral: { label: "Referral reward", icon: "mdi:account-heart-outline" },
  milestone: { label: "Milestone bonus", icon: "mdi:trophy-outline" },
  applied: { label: "Used on a deal fee", icon: "mdi:ticket-percent-outline" },
};

/** Every fee-credit movement (earned and used). */
export default function CreditHistory({ history }: { history: SdRewards["history"] }) {
  return (
    <Box data-testid="sd-rewards-history" sx={{ p: { xs: 2.4, md: 2.8 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
      <Typography component="h2" sx={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.3, mb: 1.6 }}>Credit history</Typography>
      {history.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED, py: 3, textAlign: "center" }} data-testid="sd-rewards-history-empty">Credits you earn and use will show up here.</Typography>
      ) : (
        <Stack divider={<Box sx={{ borderTop: `1px solid ${SD_BORDER}` }} />}>
          {history.map((h) => {
            const k = KIND[h.kind] || KIND.referral;
            const plus = h.amount_usd > 0;
            return (
              <Stack key={h.entry_id} direction="row" spacing={1.4} alignItems="center" sx={{ py: 1.2 }} data-testid={`sd-rewards-history-${h.entry_id}`}>
                <Box sx={{ width: 32, height: 32, borderRadius: 2.2, display: "grid", placeItems: "center", flexShrink: 0, backgroundColor: plus ? goldAlpha(0.16) : SD_PAGE, color: plus ? SD_GOLD_DEEP : SD_TEXT_MUTED }} aria-hidden><Icon icon={k.icon} width={17} /></Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{k.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.note || "—"} · {absTime(h.created_at)}</Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 900, color: plus ? "#047857" : "#111", ...TABULAR }}>{plus ? "+" : "−"}{money(Math.abs(h.amount_usd))}</Typography>
                  <Typography sx={{ fontSize: 11, color: SD_TEXT_MUTED, ...TABULAR }}>bal {money(h.balance_after_usd)}</Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
