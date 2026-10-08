import React, { useEffect, useState } from "react";
import { Box, CircularProgress, IconButton, Typography, useTheme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { BRAND_ACCENT } from "@/constants/theme";
import type { Vertical } from "@/Components/UI/_shared";
import type { rootReducer } from "@/utils/types";

/**
 * PurposeCard — the dismissible "What brings you to Dynopay?" card on the
 * dashboard. Replaces the purpose picker that used to live inside sign-up
 * (2026 onboarding reset). Picking a vertical persists it to the account
 * (POST /user/purpose) and remembers the dismissal in localStorage so it
 * never nags twice.
 */

const PURPOSE_DISMISS_KEY = "dyno_dashboard_purpose_dismissed";

const OPTIONS: Array<{ vertical: Vertical; icon: string }> = [
  { vertical: "merchants", icon: "mdi:storefront-outline" },
  { vertical: "fundraisers", icon: "mdi:hand-heart-outline" },
  { vertical: "creators", icon: "mdi:sparkles-outline" },
  { vertical: "developers", icon: "mdi:code-tags" },
];

const PurposeCard: React.FC = () => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const dispatch = useDispatch();

  const purposeVertical = useSelector(
    (s: rootReducer) => (s as any).userReducer?.profile?.purpose_vertical,
  ) as string | undefined;
  // The profile is `null` until USER_PROFILE_FETCH returns. Deciding before then
  // read "no purpose chosen" and flashed this card on every refresh for users
  // who had already picked one.
  const profileLoaded = useSelector(
    (s: rootReducer) => Boolean((s as any).userReducer?.profile),
  );

  const [hidden, setHidden] = useState(true);
  const [saving, setSaving] = useState<Vertical | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(PURPOSE_DISMISS_KEY) === "1") { setHidden(true); return; }
    } catch { /* ignore */ }
    if (!profileLoaded || purposeVertical) { setHidden(true); return; }
    setHidden(false);
  }, [purposeVertical, profileLoaded]);

  const dismiss = () => {
    try { localStorage.setItem(PURPOSE_DISMISS_KEY, "1"); } catch { /* ignore */ }
    setHidden(true);
  };

  const pick = async (v: Vertical) => {
    if (saving) return;
    setSaving(v);
    try {
      await axiosBaseApi.post(API_ENDPOINTS.user.setPurpose, { purpose_vertical: v });
      try { localStorage.setItem(PURPOSE_DISMISS_KEY, "1"); } catch { /* ignore */ }
      dispatch({ type: TOAST_SHOW, payload: { message: t("purposeSavedToast", { defaultValue: "Thanks — we'll tailor Dynopay for you." }), severity: "success" } });
      setHidden(true);
    } catch {
      dispatch({ type: TOAST_SHOW, payload: { message: t("purposeSaveError", { defaultValue: "Could not save that. Please try again." }), severity: "error" } });
    } finally {
      setSaving(null);
    }
  };

  if (hidden) return null;

  return (
    <Box
      data-testid="dashboard-purpose-card"
      sx={{
        position: "relative",
        mb: 3,
        p: { xs: 2.25, sm: 2.75 },
        borderRadius: "18px",
        border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(18,18,20,0.08)"}`,
        background: dark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
        boxShadow: dark ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "0 1px 2px rgba(18,18,20,0.04)",
      }}
    >
      <IconButton
        data-testid="purpose-card-dismiss"
        aria-label={t("dismiss", { defaultValue: "Dismiss" })}
        onClick={dismiss}
        size="small"
        sx={{ position: "absolute", top: 8, right: 8, color: theme.palette.text.secondary }}
      >
        <CloseRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>

      <Typography
        sx={{
          display: "inline-flex", alignItems: "center", gap: 1,
          fontFamily: "var(--font-tech), ui-monospace, monospace",
          fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
          color: theme.palette.text.secondary, mb: 0.75,
          "&::before": { content: '""', width: 6, height: 6, borderRadius: "50%", backgroundColor: BRAND_ACCENT, boxShadow: `0 0 10px ${BRAND_ACCENT}` },
        }}
      >
        {t("purposeQuestion", { defaultValue: "What brings you to Dynopay?" })}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mb: 2, maxWidth: 520 }}>
        {t("purposeCardHint", { defaultValue: "Pick one so we can tailor your dashboard and tips. You can change it anytime." })}
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
        {OPTIONS.map((o) => {
          const isSaving = saving === o.vertical;
          return (
            <Box
              key={o.vertical}
              role="button"
              tabIndex={0}
              data-testid={`purpose-card-pill-${o.vertical}`}
              onClick={() => pick(o.vertical)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(o.vertical); } }}
              sx={{
                cursor: saving ? "default" : "pointer",
                opacity: saving && !isSaving ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: 1.5, minHeight: 60, px: 1.75, py: 1.25,
                borderRadius: "14px",
                border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(18,18,20,0.08)"}`,
                background: dark ? "rgba(255,255,255,0.02)" : "rgba(18,18,20,0.015)",
                transition: "border-color 160ms ease, transform 160ms ease, background-color 160ms ease",
                "&:hover": saving ? {} : { borderColor: BRAND_ACCENT, transform: "translateY(-2px)", background: dark ? "rgba(255,209,0,0.08)" : "rgba(255,209,0,0.06)" },
                "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 2 },
              }}
            >
              <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", background: dark ? "rgba(255,209,0,0.12)" : "rgba(255,209,0,0.14)", color: dark ? BRAND_ACCENT : "#8B5E00" }}>
                {isSaving ? <CircularProgress size={18} sx={{ color: "inherit" }} /> : <Icon icon={o.icon} width={20} />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontFamily: "var(--font-hero), var(--font-sans)", fontWeight: 700, fontSize: 14, lineHeight: 1.15, color: theme.palette.text.primary }}>
                  {t(`purposeOptions.${o.vertical}.label`)}
                </Typography>
                <Typography sx={{ fontFamily: "var(--font-body)", fontSize: 12, lineHeight: 1.35, color: theme.palette.text.secondary, mt: 0.25 }}>
                  {t(`purposeOptions.${o.vertical}.hint`)}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default PurposeCard;
