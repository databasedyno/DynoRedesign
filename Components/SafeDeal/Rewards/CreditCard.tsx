import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdRewards } from "@/api/safedeal";
import { money } from "@/Components/Page/Escrow/escrowUtils";
import { TABULAR } from "../sdFormat";
import { SD_BORDER, SD_GOLD_DEEP, SD_TEXT_MUTED, goldAlpha } from "../sdTheme";

const label = { fontSize: 11.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" } as const;

/** Fee-credit balance (non-cashable) with earned / used totals. */
export default function CreditCard({ credit }: { credit: SdRewards["credit"] }) {
  return (
    <Box data-testid="sd-rewards-credit" sx={{ p: { xs: 2.4, md: 2.8 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}`, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 2.5, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Typography sx={{ ...label, color: SD_TEXT_MUTED }}>Fee credit</Typography>
        <Box sx={{ width: 36, height: 36, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: goldAlpha(0.16), color: SD_GOLD_DEEP }}><Icon icon="mdi:ticket-percent-outline" width={19} aria-hidden /></Box>
      </Stack>
      <Box>
        <Typography sx={{ fontSize: { xs: 38, md: 46 }, fontWeight: 900, letterSpacing: -1.6, lineHeight: 1, ...TABULAR }} data-testid="sd-rewards-credit-balance">{money(credit.balance)}</Typography>
        <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED, mt: 1, lineHeight: 1.5 }}>
          Used automatically on the escrow fee of your next released deal where you pay the fee. Credit can&apos;t be cashed out.
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, pt: 2, borderTop: `1px dashed ${SD_BORDER}` }}>
        <Box>
          <Typography sx={{ fontSize: 11.5, color: SD_TEXT_MUTED, fontWeight: 700 }}>Earned</Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 900, ...TABULAR }} data-testid="sd-rewards-credit-earned">{money(credit.earned_total)}</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11.5, color: SD_TEXT_MUTED, fontWeight: 700 }}>Saved on fees</Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#047857", ...TABULAR }} data-testid="sd-rewards-credit-used">{money(credit.used_total)}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
