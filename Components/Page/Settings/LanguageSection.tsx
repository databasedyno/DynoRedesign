import React, { useState } from "react";
import Image from "next/image";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import PanelCard from "@/Components/UI/PanelCard";
import { setAppLanguage } from "@/helpers/setAppLanguage";
import portugalFlag from "@/assets/Images/Icons/flags/portugal-flag.png";
import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import franceFlag from "@/assets/Images/Icons/flags/france-flag.png";
import spainFlag from "@/assets/Images/Icons/flags/spain-flag.png";
import germanyFlag from "@/assets/Images/Icons/flags/germany-flag.png";
import netherlandsFlag from "@/assets/Images/Icons/flags/netherlands-flag.png";

const LANGUAGES = [
  { code: "en", label: "English", flag: unitedStatesFlag },
  { code: "pt", label: "Português", flag: portugalFlag },
  { code: "fr", label: "Français", flag: franceFlag },
  { code: "es", label: "Español", flag: spainFlag },
  { code: "de", label: "Deutsch", flag: germanyFlag },
  { code: "nl", label: "Nederlands", flag: netherlandsFlag },
] as const;

/** Wave 3e — Settings → Language: the same switcher the headers use, saved to the account. */
const LanguageSection: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("common");
  const current = (i18n.language || "en").split("-")[0];
  const [busy, setBusy] = useState<string | null>(null);
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const pick = async (code: string) => {
    if (code === current || busy) return;
    setBusy(code);
    try {
      await setAppLanguage(code);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box data-testid="settings-language-section">
      <PanelCard title={t("settingsPage.languagePick", { defaultValue: "Choose your language" })} bodyPadding={theme.spacing(1)}>
        <Box role="radiogroup" aria-label={t("settingsPage.language", { defaultValue: "Language" }) as string} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 0.5 }}>
          {LANGUAGES.map((l) => {
            const active = l.code === current;
            return (
              <Box
                key={l.code}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                data-testid={`settings-language-${l.code}`}
                onClick={() => pick(l.code)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(l.code);
                  }
                }}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.25, borderRadius: "12px", cursor: active ? "default" : "pointer",
                  border: `1px solid ${active ? indigo : "transparent"}`,
                  backgroundColor: active ? (isDark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.06)") : "transparent",
                  transition: "background-color 120ms ease, border-color 120ms ease",
                  "&:hover": { backgroundColor: active ? undefined : theme.palette.action.hover },
                  "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: 2 },
                  opacity: busy && busy !== l.code ? 0.6 : 1,
                }}
              >
                <Image src={l.flag} alt="" width={22} height={22} style={{ borderRadius: "50%", objectFit: "cover" }} />
                <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: active ? 700 : 500, color: theme.palette.text.primary, flex: 1 }}>
                  {l.label}
                </Typography>
                {active && <Icon name="check" size={16} color={indigo} />}
              </Box>
            );
          })}
        </Box>
      </PanelCard>
    </Box>
  );
};

export default LanguageSection;
