import { useEffect, useState } from "react";
import { Box, IconButton, useTheme } from "@mui/material";
import Image, { StaticImageData } from "next/image";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import { setAppLanguage } from "@/helpers/setAppLanguage";

import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";
import portugalFlag from "@/assets/Images/Icons/flags/portugal-flag.png";
import franceFlag from "@/assets/Images/Icons/flags/france-flag.png";
import spainFlag from "@/assets/Images/Icons/flags/spain-flag.png";
import germanyFlag from "@/assets/Images/Icons/flags/germany-flag.png";
import netherlandsFlag from "@/assets/Images/Icons/flags/netherlands-flag.png";

type Lang = { code: string; label: string; flag: StaticImageData };

const LANGS: readonly Lang[] = [
  { code: "en", label: "English", flag: unitedStatesFlag },
  { code: "pt", label: "Português", flag: portugalFlag },
  { code: "fr", label: "Français", flag: franceFlag },
  { code: "es", label: "Español", flag: spainFlag },
  { code: "de", label: "Deutsch", flag: germanyFlag },
  { code: "nl", label: "Nederlands", flag: netherlandsFlag },
];

const DISMISS_KEY = "lang_onboard";

/**
 * First-visit language chooser — a slim, dismissible bottom bar shown to
 * ANONYMOUS visitors on public pages who haven't picked a language yet. One tap
 * sets the language (persisted + synced to the account on login via
 * setAppLanguage); picking or closing hides it permanently.
 */
export const LanguageOnboardingBar = () => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    try {
      const hasToken = !!localStorage.getItem("token");
      const chose = localStorage.getItem("lang_manual") === "true";
      const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      if (!hasToken && !chose && !dismissed) {
        setVisible(true);
        requestAnimationFrame(() => setEntered(true));
      }
    } catch {
      /* localStorage unavailable — never block the page */
    }
  }, []);

  const hide = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setEntered(false);
    window.setTimeout(() => setVisible(false), 260);
  };

  const pick = async (code: string) => {
    hide();
    await setAppLanguage(code);
  };

  if (!visible) return null;

  const dark = theme.palette.mode === "dark";
  const accent = dark ? "#6366F1" : "#4338CA";

  return (
    <Box
      data-testid="language-onboarding-bar"
      role="region"
      aria-label="Choose your language"
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        gap: { xs: 1, sm: 1.5 },
        px: { xs: 1.5, sm: 3 },
        py: { xs: 1.25, sm: 1.5 },
        bgcolor: dark ? "rgba(17,19,26,0.92)" : "rgba(255,255,255,0.94)",
        backdropFilter: "blur(16px)",
        borderTop: `1px solid ${theme.palette.divider}`,
        boxShadow: dark
          ? "0 -8px 24px rgba(0,0,0,0.45)"
          : "0 -8px 24px rgba(16,24,40,0.08)",
        transform: entered ? "translateY(0)" : "translateY(100%)",
        transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <LanguageRoundedIcon
        sx={{ fontSize: 20, color: accent, flexShrink: 0, display: { xs: "none", sm: "block" } }}
      />

      {/* Chips — horizontally scrollable on small screens */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flex: 1,
          minWidth: 0,
          overflowX: "auto",
          py: 0.25,
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        {LANGS.map((l) => (
          <Box
            key={l.code}
            component="button"
            type="button"
            data-testid={`lang-onboard-${l.code}`}
            onClick={() => pick(l.code)}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
              cursor: "pointer",
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: "999px",
              bgcolor: "transparent",
              color: theme.palette.text.primary,
              px: 1.5,
              py: 0.75,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              lineHeight: 1,
              whiteSpace: "nowrap",
              transition: "background-color 160ms ease, border-color 160ms ease",
              "&:hover": {
                bgcolor: theme.palette.action.hover,
                borderColor: accent,
              },
            }}
          >
            <Image src={l.flag} alt="" width={18} height={18} draggable={false} unoptimized />
            {l.label}
          </Box>
        ))}
      </Box>

      <IconButton
        data-testid="language-onboarding-close"
        aria-label="Dismiss language chooser"
        onClick={hide}
        size="small"
        sx={{ flexShrink: 0, color: theme.palette.text.secondary }}
      >
        <CloseRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

export default LanguageOnboardingBar;
