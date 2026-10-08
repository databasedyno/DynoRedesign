import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, Container, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { sdReferral } from "@/api/safedeal";
import { SD_GOLD_DEEP, SD_NOTE_BG, SD_NOTE_BORDER, SD_NOTE_FG } from "../sdTheme";

/** Captures `?ref=` for guests and shows "A friend invited you — $5 off your first deal fee". */
export default function ReferralBanner({ wide = false, dark = false }: { wide?: boolean; dark?: boolean }) {
  const [credit, setCredit] = useState<number | null>(null);
  const q = useRouter().query.ref;
  useEffect(() => {
    if (typeof q === "string") sdReferral.capture(q);
    const code = sdReferral.get();
    if (!code) return;
    safedealApi.referralCheck(code).then((r) => (r.valid ? setCredit(r.welcome_credit_usd) : sdReferral.clear())).catch(() => undefined);
  }, [q]);
  if (credit == null) return null;
  return (
    <Container maxWidth={wide ? "xl" : "lg"} sx={{ pt: 1.5 }}>
      <Stack direction="row" spacing={1.2} alignItems="center" data-testid="sd-referral-banner"
        sx={{ px: 1.8, py: 1.2, borderRadius: 3, backgroundColor: dark ? "rgba(255,198,26,0.12)" : SD_NOTE_BG, border: `1px solid ${dark ? "rgba(255,198,26,0.3)" : SD_NOTE_BORDER}` }}>
        <Box sx={{ color: SD_GOLD_DEEP, display: "grid" }} aria-hidden><Icon icon="mdi:gift-outline" width={20} /></Box>
        <Typography sx={{ fontSize: 13.5, color: dark ? "#fff" : SD_NOTE_FG }}>
          <b>A friend invited you.</b> Sign up and get <b>${credit} off</b> your first deal fee.
        </Typography>
      </Stack>
    </Container>
  );
}
