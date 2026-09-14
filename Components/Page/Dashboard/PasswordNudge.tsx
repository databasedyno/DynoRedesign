import React, { useEffect, useState } from "react";
import { Box, IconButton, useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";

const DISMISS_KEY = "dyno_pw_nudge_dismissed";

/** A5 — passwordless (OTP-only) accounts fetch a code on every login; offer a one-time password set-up. */
const PasswordNudge: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const dispatch = useDispatch();
  const { t } = useTranslation("dashboardLayout");
  const profile = useSelector((s: rootReducer) => (s as any).userReducer.profile) as any;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!profile?.user_id) dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch, profile?.user_id]);

  if (dismissed || !profile?.user_id || profile.has_password !== false) return null;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Box
      data-testid="password-nudge"
      sx={{
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        flexDirection: { xs: "column", sm: "row" },
        gap: 1.5,
        p: { xs: 1.75, sm: 2 },
        borderRadius: "14px",
        border: `1px solid ${border}`,
        backgroundColor: isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
      }}
    >
      <Box sx={{ width: 36, height: 36, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: indigo, backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow }}>
        <Icon name="key-round" size={18} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: ink }}>
          {t("pwNudge.title", { defaultValue: "Skip the code next time" })}
        </Box>
        <Box sx={{ mt: 0.25, fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: muted }}>
          {t("pwNudge.body", { defaultValue: "You log in with a one-time code. Set a password once and sign in instantly — the code stays as a backup." })}
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}>
        <Box sx={{ flex: 1, "& button": { minHeight: 38, whiteSpace: "nowrap" } }}>
          <CustomButton
            label={t("pwNudge.cta", { defaultValue: "Set a password" })}
            variant="secondary"
            size="small"
            onClick={() => router.push("/settings?section=profile")}
            data-testid="password-nudge-cta"
          />
        </Box>
        <IconButton onClick={dismiss} aria-label={t("pwNudge.dismiss", { defaultValue: "Dismiss" })} data-testid="password-nudge-dismiss" sx={{ color: muted }}>
          <Icon name="x" size={16} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default PasswordNudge;
