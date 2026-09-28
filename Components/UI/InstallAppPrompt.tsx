import React from "react";
import { Box, IconButton, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import { usePwaInstall } from "@/hooks/usePwaInstall";

type Brand = "dynopay" | "safedeal";

const BRANDS: Record<Brand, { name: string; icon: string; accent: string; accentText: string; storageKey: string }> = {
  dynopay: { name: "Dynopay", icon: "/pwa-192.png?v=7", accent: "#FFD100", accentText: "#121214", storageKey: "dp_pwa" },
  safedeal: { name: "SafeDeal", icon: "/safedeal/favicon-192.png?v=1", accent: "#FFC61A", accentText: "#121214", storageKey: "sd_pwa" },
};

interface Props {
  brand: Brand;
  /** Optional copy override for the one-line benefit (SafeDeal is English-only). */
  body?: string;
  sx?: Record<string, unknown>;
  /** Padding wrapper rendered ONLY when the prompt shows (keeps layouts free of empty gutters). */
  wrapSx?: Record<string, unknown>;
}

/**
 * Inline, dismissible "Add to Home Screen" nudge — phones only, never inside an installed app.
 * Android/Chrome gets a real Install button (native sheet); iOS gets the Share → Add to Home Screen hint.
 */
export const InstallAppPrompt: React.FC<Props> = ({ brand, body, sx, wrapSx }) => {
  const theme = useTheme();
  const isPhone = useMediaQuery("(max-width:767.95px)");
  const { t } = useTranslation("common");
  const b = BRANDS[brand];
  const { eligible, canPrompt, platform, install, dismiss } = usePwaInstall(b.storageKey);

  if (!isPhone || !eligible) return null;

  const dark = theme.palette.mode === "dark" && brand === "dynopay";
  const ios = platform === "ios" && !canPrompt;
  const title = t("pwa.installTitle", { brand: b.name, defaultValue: "Add {{brand}} to your Home Screen" });
  const line = body || (ios
    ? t("pwa.installBodyIos", { defaultValue: "In Safari, tap Share, then “Add to Home Screen”." })
    : t("pwa.installBodyAndroid", { defaultValue: "One tap to your payments — no app store needed." }));

  const card = (
    <Box
      data-testid="pwa-install-banner"
      data-brand={brand}
      data-platform={ios ? "ios" : "android"}
      role="region"
      aria-label={title}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        borderRadius: 3,
        border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(18,18,20,0.1)"}`,
        backgroundColor: dark ? "#16161A" : "#FFFFFF",
        color: dark ? "#F5F7FA" : "#121214",
        boxShadow: dark ? "0 8px 24px rgba(0,0,0,0.35)" : "0 8px 24px rgba(16,24,40,0.08)",
        fontFamily: "var(--font-sans)",
        animation: "dpInstallIn 320ms cubic-bezier(0.16,1,0.3,1) both",
        "@keyframes dpInstallIn": { from: { opacity: 0, transform: "translateY(-6px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        ...sx,
      }}
    >
      <Box component="img" src={b.icon} alt="" width={40} height={40} sx={{ width: 40, height: 40, borderRadius: "10px", flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box data-testid="pwa-install-title" sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.1 }}>{title}</Box>
        <Box
          data-testid="pwa-install-body"
          sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25, fontSize: 12.5, lineHeight: 1.35, color: dark ? "rgba(245,247,250,0.7)" : "#5B5F66" }}
        >
          {ios && <IosShareRoundedIcon sx={{ fontSize: 15, color: "#0A84FF", flexShrink: 0 }} aria-hidden />}
          <span>{line}</span>
          {ios && <AddBoxOutlinedIcon sx={{ fontSize: 15, flexShrink: 0 }} aria-hidden />}
        </Box>
      </Box>
      {!ios && (
        <Box
          component="button"
          type="button"
          data-testid="pwa-install-btn"
          onClick={() => void install()}
          sx={{
            flexShrink: 0,
            border: 0,
            cursor: "pointer",
            minHeight: 40,
            px: 2,
            borderRadius: 999,
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 800,
            color: b.accentText,
            backgroundColor: b.accent,
            transition: "transform 120ms ease, filter 120ms ease",
            "&:active": { transform: "scale(0.97)" },
            "&:hover": { filter: "brightness(0.96)" },
          }}
        >
          {t("pwa.install", { defaultValue: "Install" })}
        </Box>
      )}
      <IconButton
        data-testid="pwa-install-dismiss"
        aria-label={t("pwa.dismiss", { defaultValue: "Not now" })}
        onClick={dismiss}
        sx={{ flexShrink: 0, width: 40, height: 40, color: dark ? "rgba(245,247,250,0.6)" : "#6B6F76" }}
      >
        <CloseRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Box>
  );
  return wrapSx ? <Box sx={wrapSx}>{card}</Box> : card;
};

export default InstallAppPrompt;
