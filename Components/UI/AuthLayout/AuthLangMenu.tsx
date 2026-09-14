import React, { useState } from "react";
import { Box, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography, useTheme } from "@mui/material";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Image, { StaticImageData } from "next/image";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "@/helpers/setAppLanguage";

import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import portugalFlag from "@/assets/Images/Icons/flags/portugal-flag.png";
import franceFlag from "@/assets/Images/Icons/flags/france-flag.png";
import spainFlag from "@/assets/Images/Icons/flags/spain-flag.png";
import germanyFlag from "@/assets/Images/Icons/flags/germany-flag.png";
import netherlandsFlag from "@/assets/Images/Icons/flags/netherlands-flag.png";

const LABELS: Record<(typeof SUPPORTED_LANGUAGES)[number], string> = {
  en: "English",
  pt: "Português",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  nl: "Nederlands",
};

// Country flag per language — mirrors HeaderLangMenu / MobileNavigationBar so
// the auth-card selector shows the same recognisable flags as the rest of the app.
const FLAGS: Record<(typeof SUPPORTED_LANGUAGES)[number], StaticImageData> = {
  en: unitedStatesFlag,
  pt: portugalFlag,
  fr: franceFlag,
  es: spainFlag,
  de: germanyFlag,
  nl: netherlandsFlag,
};

/** Compact globe + code control for the auth card header (pairs with ThemeToggle size="small"). */
const AuthLangMenu: React.FC = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation("auth");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = ((i18n.language || "en").split("-")[0] as (typeof SUPPORTED_LANGUAGES)[number]) || "en";
  const label = t("authShell.changeLanguage", { defaultValue: "Change language" });

  const pick = async (code: (typeof SUPPORTED_LANGUAGES)[number]) => {
    setAnchor(null);
    if (code === current) return;
    const { setAppLanguage } = await import("@/helpers/setAppLanguage");
    await setAppLanguage(code);
  };

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={anchor ? "true" : undefined}
          data-testid="auth-lang-trigger"
          data-current-lang={current}
          sx={{ minWidth: 44, minHeight: 44, borderRadius: 999, gap: 0.5, px: 1, color: theme.palette.text.secondary, "&:hover": { backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,15,20,0.05)" } }}
        >
          <LanguageRoundedIcon fontSize="small" />
          <Typography component="span" sx={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }} data-testid="auth-lang-current">
            {current.toUpperCase()}
          </Typography>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 200, borderRadius: "12px", border: `1px solid ${theme.palette.divider}` }, "data-testid": "auth-lang-menu" } as any }}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <MenuItem key={code} selected={code === current} onClick={() => pick(code)} data-testid={`auth-lang-option-${code}`} data-lang={code} data-selected={code === current ? "true" : "false"} sx={{ fontFamily: "var(--font-sans)", fontSize: 14, gap: 1 }}>
            <Box component="span" sx={{ display: "inline-flex", width: 22, flexShrink: 0 }}>
              <Image src={FLAGS[code]} alt="" width={22} height={16} draggable={false} unoptimized style={{ borderRadius: 3, objectFit: "cover", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }} />
            </Box>
            <Box component="span" sx={{ flex: 1 }}>{LABELS[code]}</Box>
            {code === current && (
              <ListItemIcon sx={{ minWidth: 0, color: theme.palette.primary.main }}>
                <CheckRoundedIcon fontSize="small" />
              </ListItemIcon>
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default AuthLangMenu;
