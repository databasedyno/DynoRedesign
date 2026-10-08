import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { SdRewards } from "@/api/safedeal";
import ShareInviteButtons from "../ShareInviteButtons";
import { SD_GOLD, SD_INK_LINE, SD_INK_MUTED, SD_INK, goldAlpha } from "../sdTheme";

const label = { fontSize: 11.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" } as const;

function CopyField({ value, testid, onCopy, mono = false }: { value: string; testid: string; onCopy: () => void; mono?: boolean }) {
  return (
    <Box component="button" type="button" onClick={onCopy} data-testid={testid} aria-label={`Copy ${value}`}
      sx={{ all: "unset", cursor: "pointer", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0, px: 1.6, py: 1.2, borderRadius: 2.5, border: `1px solid ${SD_INK_LINE}`, backgroundColor: "rgba(255,255,255,0.04)", transition: "border-color .15s, background-color .15s", "&:hover": { borderColor: SD_GOLD, backgroundColor: "rgba(255,255,255,0.07)" }, "&:focus-visible": { outline: `2px solid ${SD_GOLD}`, outlineOffset: 2 } }}>
      <Typography component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: mono ? 18 : 13.5, fontWeight: mono ? 900 : 600, letterSpacing: mono ? 2.5 : 0, fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit", color: "#fff" }}>{value}</Typography>
      <Icon icon="mdi:content-copy" width={17} color={SD_GOLD} aria-hidden />
    </Box>
  );
}

/** Ink hero: "Give $5, get $5" + personal link / code + 1-tap share. */
export default function InviteHero({ r, onCopy }: { r: SdRewards; onCopy: (text: string, what: string) => void }) {
  const give = r.rules.welcome_credit_usd;
  const get = r.rules.referrer_reward_usd;
  const shareText = `I use SafeDeal to buy & sell online safely — the money is held in escrow until the deal is done. Sign up with my link and get $${give} off your first deal fee.`;
  return (
    <Box data-testid="sd-rewards-invite" sx={{ position: "relative", overflow: "hidden", p: { xs: 2.4, md: 3.2 }, borderRadius: 4, backgroundColor: SD_INK, color: "#fff" }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(460px 260px at 100% 0%, ${goldAlpha(0.26)}, transparent 70%)` }} />
      <Box sx={{ position: "relative" }}>
        <Typography sx={{ ...label, color: SD_GOLD }}>Invite friends</Typography>
        <Typography component="h2" sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 900, letterSpacing: -1.1, lineHeight: 1.08, mt: 0.8 }} data-testid="sd-rewards-headline">
          Give ${give}. Get ${get}.
        </Typography>
        <Typography sx={{ fontSize: 14, color: SD_INK_MUTED, mt: 1, maxWidth: 520, lineHeight: 1.55 }}>
          Your friend gets <b style={{ color: "#fff" }}>${give} off</b> their first deal fee. You get <b style={{ color: "#fff" }}>${get} in fee credit</b> once their first deal of ${r.rules.qualify_min_deal_usd}+ is completed and released.
        </Typography>

        <Box sx={{ display: "grid", gap: 1.2, gridTemplateColumns: { xs: "1fr", sm: "1fr 190px" }, mt: 2.6 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ ...label, fontSize: 10.5, color: SD_INK_MUTED, mb: 0.6 }}>Your link</Typography>
            <CopyField value={r.link} testid="sd-rewards-link" onCopy={() => onCopy(r.link, "Link")} />
          </Box>
          <Box>
            <Typography sx={{ ...label, fontSize: 10.5, color: SD_INK_MUTED, mb: 0.6 }}>Your code</Typography>
            <CopyField value={r.code} testid="sd-rewards-code" onCopy={() => onCopy(r.code, "Code")} mono />
          </Box>
        </Box>

        <Box sx={{ mt: 2.2 }}>
          <ShareInviteButtons url={r.link} summary="" text={shareText} withX dark testidPrefix="sd-rewards-share" onCopy={() => onCopy(r.link, "Link")} />
        </Box>
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 2 }}>
          <Icon icon="mdi:link-variant" width={15} color={SD_GOLD} aria-hidden />
          <Typography sx={{ fontSize: 12.5, color: SD_INK_MUTED }} data-testid="sd-rewards-auto-note">Your code is added automatically to every deal invite you send.</Typography>
        </Stack>
      </Box>
    </Box>
  );
}
