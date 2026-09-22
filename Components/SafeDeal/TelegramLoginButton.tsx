import React, { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import safedealApi, { sdError, sdSession } from "@/api/safedeal";

const CALLBACK = "onSafeDealTelegramAuth";

/**
 * Telegram Login Widget. Injects Telegram's official widget script, which renders
 * a "Log in with Telegram" button and calls our global callback with a signed
 * payload. We POST it to /api/safedeal/auth/telegram (server verifies the HMAC),
 * store the returned SafeDeal session, then continue.
 *
 * NOTE: the widget only renders on the domain registered for this bot in @BotFather
 * (/setdomain). On a mismatched domain Telegram shows "Bot domain invalid".
 */
interface Props {
  bot: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  /** "signin" (default) mints a session; "link" attaches Telegram to the signed-in account for alerts. */
  mode?: "signin" | "link";
}

export default function TelegramLoginButton({ bot, onSuccess, onError, mode = "signin" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (window as any)[CALLBACK] = async (user: Record<string, unknown>) => {
      setBusy(true);
      try {
        if (mode === "link") {
          await safedealApi.telegramLink(user);
        } else {
          const r = await safedealApi.telegramAuth(user);
          sdSession.set(r.token, r.user);
        }
        onSuccess();
      } catch (e) {
        onError(sdError(e));
      } finally {
        setBusy(false);
      }
    };
    const host = ref.current;
    if (host) {
      host.innerHTML = "";
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://telegram.org/js/telegram-widget.js?22";
      s.setAttribute("data-telegram-login", bot);
      s.setAttribute("data-size", "large");
      s.setAttribute("data-radius", "12");
      s.setAttribute("data-request-access", "write");
      s.setAttribute("data-onauth", `${CALLBACK}(user)`);
      host.appendChild(s);
    }
    return () => {
      try {
        delete (window as any)[CALLBACK];
      } catch {
        /* noop */
      }
    };
  }, [bot, onSuccess, onError, mode]);

  return (
    <Box data-testid={mode === "link" ? "sd-telegram-link-widget" : "sd-signin-telegram"}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: 48 }}>
        {busy ? (
          <Stack direction="row" spacing={1} alignItems="center" data-testid="sd-signin-telegram-busy">
            <CircularProgress size={18} sx={{ color: "#229ED9" }} />
            <Typography sx={{ fontSize: 13.5, color: "#6B7280", fontWeight: 700 }}>{mode === "link" ? "Linking your Telegram…" : "Signing you in with Telegram…"}</Typography>
          </Stack>
        ) : (
          <Box ref={ref} sx={{ display: "flex", justifyContent: "center" }} aria-label="Log in with Telegram" />
        )}
      </Stack>
      {!busy && (
        <Stack direction="row" spacing={0.6} alignItems="center" justifyContent="center" sx={{ mt: 0.8 }}>
          <Icon icon="mdi:shield-check-outline" width={14} color="#229ED9" aria-hidden />
          <Typography sx={{ fontSize: 12, color: "#6B7280" }}>{mode === "link" ? "Telegram only shares your id and name — we never see your phone number." : "No email or password — sign in with your Telegram account."}</Typography>
        </Stack>
      )}
    </Box>
  );
}
