import React, { useState } from "react";
import { Box, IconButton, ListItemIcon, Menu, MenuItem, Tooltip, Typography, useTheme } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { LANGUAGES, languageFor, type LanguageCode } from "@/helpers/languages";
import { brandFg } from "@/constants/theme";

/** Compact flag + native-name control for the auth card header (pairs with ThemeToggle size="small"). */
const AuthLangMenu: React.FC = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation("auth");
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const selected = languageFor(i18n.language);
  const current = selected.code;
  const label = t("authShell.changeLanguage", { defaultValue: "Change language" });

  const pick = async (code: LanguageCode) => {
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
          aria-label={`${label} · ${selected.name}`}
          aria-haspopup="menu"
          aria-expanded={anchor ? "true" : undefined}
          data-testid="auth-lang-trigger"
          data-current-lang={current}
          sx={{ minWidth: 44, minHeight: 44, borderRadius: 999, gap: 0.75, px: 1.25, color: theme.palette.text.secondary, "&:hover": { backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,15,20,0.05)" } }}
        >
          <Image src={selected.flag} alt="" width={18} height={18} draggable={false} unoptimized style={{ borderRadius: "50%" }} data-testid="auth-lang-flag" />
          <Typography component="span" sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap", color: theme.palette.text.primary }} data-testid="auth-lang-current">
            {selected.name}
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
        {LANGUAGES.map((lng) => (
          <MenuItem key={lng.code} selected={lng.code === current} onClick={() => pick(lng.code)} data-testid={`auth-lang-option-${lng.code}`} data-lang={lng.code} data-selected={lng.code === current ? "true" : "false"} aria-label={`${lng.name} (${lng.english})`} sx={{ fontFamily: "var(--font-sans)", fontSize: 14, gap: 1 }}>
            <Box component="span" sx={{ display: "inline-flex", width: 22, flexShrink: 0 }}>
              <Image src={lng.flag} alt="" width={20} height={20} draggable={false} unoptimized style={{ borderRadius: "50%", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }} />
            </Box>
            <Box component="span" sx={{ flex: 1 }}>{lng.name}</Box>
            {lng.code === current ? (
              <ListItemIcon sx={{ minWidth: 0, color: brandFg(theme.palette.mode === "dark") }}>
                <CheckRoundedIcon fontSize="small" />
              </ListItemIcon>
            ) : (
              <Typography component="span" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: theme.palette.text.disabled }}>
                {lng.code.toUpperCase()}
              </Typography>
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default AuthLangMenu;
