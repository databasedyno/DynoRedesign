import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { Box, Button, IconButton, useTheme } from "@mui/material";
import Image, { StaticImageData } from "next/image";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import i18n from "@/i18n";
import { setAppLanguage, SUPPORTED_LANGUAGES } from "@/helpers/setAppLanguage";

import portugalFlag from "@/assets/Images/Icons/flags/portugal-flag.png";
import franceFlag from "@/assets/Images/Icons/flags/france-flag.png";
import spainFlag from "@/assets/Images/Icons/flags/spain-flag.png";
import germanyFlag from "@/assets/Images/Icons/flags/germany-flag.png";
import netherlandsFlag from "@/assets/Images/Icons/flags/netherlands-flag.png";
import unitedStatesFlag from "@/assets/Images/Icons/flags/united-states-flag.png";

// Native names + flags for the languages we can suggest (English excluded — it
// is the app default, so there is nothing to suggest when the browser is EN).
const NATIVE: Record<string, { label: string; flag: StaticImageData }> = {
  en: { label: "English", flag: unitedStatesFlag },
  pt: { label: "Português", flag: portugalFlag },
  fr: { label: "Français", flag: franceFlag },
  es: { label: "Español", flag: spainFlag },
  de: { label: "Deutsch", flag: germanyFlag },
  nl: { label: "Nederlands", flag: netherlandsFlag },
};

const DISMISS_KEY = "lang_suggest_dismissed";

function isLoggedIn(): boolean {
  try {
    return typeof window !== "undefined" && !!localStorage.getItem("token");
  } catch {
    return false;
  }
}

// Buyer/checkout surfaces carry the customer's session language, never the
// merchant's — never prompt (or PUT the merchant profile) there.
function isBuyerRoute(pathname: string): boolean {
  return (
    pathname === "/pay" ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/payment") ||
    pathname === "/[handle]" ||
    pathname.startsWith("/[handle]/") ||
    pathname.startsWith("/order/")
  );
}

// First supported base language from the browser's preferred list.
function detectBrowserLang(): string | null {
  if (typeof navigator === "undefined") return null;
  const candidates: string[] = [
    navigator.language,
    ...((navigator.languages as string[] | undefined) || []),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const base = (c || "").toLowerCase().split("-")[0];
    if ((SUPPORTED_LANGUAGES as readonly string[]).includes(base)) return base;
  }
  return null;
}

/**
 * Merchant browser-language suggestion — a gentle, one-tap prompt shown to a
 * SIGNED-IN merchant whose browser is set to a supported language that differs
 * from the app's current language. English stays the default; this only
 * *offers* the browser language. Accepting switches + syncs to the account
 * (setAppLanguage); accepting or dismissing sets a one-time flag so it never
 * nags again.
 */
export const LanguageSuggestBanner = () => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const router = useRouter();
  const [suggest, setSuggest] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);

  const evaluate = useCallback(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* localStorage unavailable — never block the page */
    }
    const eligible =
      isLoggedIn() && !isBuyerRoute(router.pathname) && !dismissed;
    if (!eligible) {
      setEntered(false);
      setSuggest(null);
      return;
    }
    const browser = detectBrowserLang();
    const current = (i18n.language || "en").split("-")[0];
    // Only suggest a real, different, supported language (skip EN — it is the
    // default, and skip when it already matches the current UI language).
    if (browser && browser !== "en" && browser !== current && NATIVE[browser]) {
      setSuggest(browser);
      requestAnimationFrame(() => setEntered(true));
    } else {
      setEntered(false);
      setSuggest(null);
    }
  }, [router.pathname]);

  // Re-evaluate on mount, route change, window focus, and whenever the app
  // language changes (the on-auth reconcile can set it AFTER this mounts).
  useEffect(() => {
    evaluate();
    window.addEventListener("focus", evaluate);
    i18n.on("languageChanged", evaluate);
    return () => {
      window.removeEventListener("focus", evaluate);
      i18n.off("languageChanged", evaluate);
    };
  }, [evaluate]);

  const remember = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const hide = () => {
    setEntered(false);
    window.setTimeout(() => setSuggest(null), 260);
  };

  const dismiss = () => {
    remember();
    hide();
  };

  const accept = async () => {
    if (!suggest) return;
    remember();
    hide();
    await setAppLanguage(suggest);
  };

  if (!suggest) return null;

  const dark = theme.palette.mode === "dark";
  const accent = dark ? "#6366F1" : "#4338CA";
  const langName = NATIVE[suggest].label;

  return (
    <Box
      data-testid="language-suggest-banner"
      role="region"
      aria-label={t("langSuggest.title", { defaultValue: "Prefer {{lang}}?", lang: langName })}
      sx={{
        position: "fixed",
        left: "50%",
        transform: entered
          ? "translateX(-50%) translateY(0)"
          : "translateX(-50%) translateY(24px)",
        // Clear the mobile bottom-nav pill (fixed at bottom:0, ~64px tall) on
        // small screens; sit closer to the edge on desktop.
        bottom: { xs: 88, sm: 24 },
        width: { xs: "calc(100% - 24px)", sm: "auto" },
        maxWidth: 440,
        zIndex: 1400,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: { xs: 1.75, sm: 2 },
        py: { xs: 1.25, sm: 1.5 },
        borderRadius: "14px",
        bgcolor: dark ? "rgba(17,19,26,0.96)" : "rgba(255,255,255,0.98)",
        "@media (min-width: 1026px)": { backdropFilter: "blur(16px)" },
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: dark
          ? "0 12px 32px rgba(0,0,0,0.5)"
          : "0 12px 32px rgba(16,24,40,0.14)",
        opacity: entered ? 1 : 0,
        transition:
          "transform 260ms cubic-bezier(0.16,1,0.3,1), opacity 260ms ease",
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: dark ? "rgba(99,102,241,0.14)" : "rgba(67,56,202,0.08)",
          position: "relative",
        }}
      >
        <LanguageRoundedIcon sx={{ fontSize: 20, color: accent }} />
        <Box
          sx={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: 18,
            height: 18,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid ${dark ? "#11131A" : "#FFFFFF"}`,
            display: "flex",
          }}
        >
          <Image
            src={NATIVE[suggest].flag}
            alt=""
            width={18}
            height={18}
            draggable={false}
            unoptimized
            style={{ objectFit: "cover" }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          data-testid="language-suggest-title"
          sx={{
            fontSize: { xs: 13.5, sm: 14 },
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontFamily: "var(--font-sans)",
            lineHeight: 1.25,
          }}
        >
          {t("langSuggest.title", { defaultValue: "Prefer {{lang}}?", lang: langName })}
        </Box>
        <Box
          sx={{
            fontSize: 12,
            color: theme.palette.text.secondary,
            fontFamily: "var(--font-sans)",
            lineHeight: 1.3,
            mt: 0.25,
          }}
        >
          {t("langSuggest.body", {
            defaultValue: "Your browser is set to {{lang}}.",
            lang: langName,
          })}
        </Box>
      </Box>

      <Button
        data-testid="language-suggest-accept"
        onClick={accept}
        disableElevation
        sx={{
          flexShrink: 0,
          textTransform: "none",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 700,
          borderRadius: "999px",
          px: 1.75,
          py: 0.6,
          color: "#FFFFFF",
          backgroundColor: accent,
          whiteSpace: "nowrap",
          "&:hover": { backgroundColor: accent, opacity: 0.92 },
        }}
      >
        {t("langSuggest.switch", { defaultValue: "Switch to {{lang}}", lang: langName })}
      </Button>

      <IconButton
        data-testid="language-suggest-dismiss"
        aria-label={t("langSuggest.dismiss", { defaultValue: "Not now" })}
        onClick={dismiss}
        size="small"
        sx={{ flexShrink: 0, color: theme.palette.text.secondary }}
      >
        <CloseRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

export default LanguageSuggestBanner;
