import React, { useCallback, useEffect, useState } from "react";
import { Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { sdError } from "@/api/safedeal";
import TelegramLoginButton from "../TelegramLoginButton";
import { SD_BORDER, SD_TEXT_MUTED, SD_INK, SD_PAGE, SD_GOLD_DEEP, SD_NOTE_BG } from "../sdTheme";

const TG_BLUE = "#229ED9";

/** Telegram alerts: link an account, send a test, unlink. Cashout/payout confirmations are pushed here. */
export default function TelegramAlertsCard({ notify }: { notify: (m: string, s?: "success" | "error") => void }) {
  const [status, setStatus] = useState<{ linked: boolean; bot: string | null; configured: boolean } | null>(null);
  const [busy, setBusy] = useState<null | "test" | "unlink">(null);

  const load = useCallback(() => safedealApi.telegramStatus().then(setStatus).catch(() => setStatus({ linked: false, bot: null, configured: false })), []);
  useEffect(() => { void load(); }, [load]);

  const onLinked = useCallback(() => { notify("Telegram linked — we sent you a hello message."); void load(); }, [notify, load]);
  const onLinkError = useCallback((m: string) => notify(m, "error"), [notify]);

  const test = async () => {
    setBusy("test");
    try { await safedealApi.telegramTest(); notify("Test message sent — check Telegram."); } catch (e) { notify(sdError(e), "error"); } finally { setBusy(null); }
  };
  const unlink = async () => {
    setBusy("unlink");
    try { await safedealApi.telegramUnlink(); notify("Telegram unlinked."); await load(); } catch (e) { notify(sdError(e), "error"); } finally { setBusy(null); }
  };

  if (status && !status.configured) return null;

  return (
    <Box data-testid="sd-telegram-card" data-linked={status?.linked ? "true" : "false"} sx={{ p: { xs: 2, md: 2.2 }, borderRadius: 4, backgroundColor: "#fff", border: `1px solid ${SD_BORDER}` }}>
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2.5, display: "grid", placeItems: "center", backgroundColor: "rgba(34,158,217,0.12)", color: TG_BLUE }} aria-hidden><Icon icon="mdi:send" width={18} /></Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>Telegram alerts</Typography>
          <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED }}>A message the moment a cashout or deal payout is confirmed on-chain, with the transaction link.</Typography>
        </Box>
        {status && <Chip size="small" label={status.linked ? "On" : "Off"} data-testid="sd-telegram-state" sx={{ fontWeight: 800, fontSize: 12, backgroundColor: status.linked ? "#ECFDF5" : SD_PAGE, color: status.linked ? "#047857" : SD_TEXT_MUTED }} />}
      </Stack>
      {!status ? (
        <Skeleton variant="rounded" height={48} />
      ) : status.linked ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" disabled={busy !== null} onClick={() => void test()} data-testid="sd-telegram-test" startIcon={<Icon icon="mdi:bell-ring-outline" width={16} />} sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, borderColor: SD_BORDER, color: SD_INK, "&:hover": { borderColor: SD_GOLD_DEEP, backgroundColor: SD_NOTE_BG } }}>{busy === "test" ? "Sending…" : "Send test"}</Button>
          <Button size="small" disabled={busy !== null} onClick={() => void unlink()} data-testid="sd-telegram-unlink" sx={{ textTransform: "none", fontWeight: 800, borderRadius: 99, color: SD_TEXT_MUTED }}>Unlink</Button>
        </Stack>
      ) : (
        <Box>
          {status.bot ? <TelegramLoginButton bot={status.bot} mode="link" onSuccess={onLinked} onError={onLinkError} /> : <Typography sx={{ fontSize: 13, color: SD_TEXT_MUTED }}>Telegram alerts aren&apos;t available right now.</Typography>}
          {status.bot && <Typography sx={{ fontSize: 12, color: SD_TEXT_MUTED, mt: 0.8, textAlign: "center" }} data-testid="sd-telegram-hint">Press the button, confirm in Telegram, and allow <b>@{status.bot}</b> to message you.</Typography>}
        </Box>
      )}
    </Box>
  );
}
